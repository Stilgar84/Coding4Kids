import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  clearAllSavedPrograms,
  deleteProgram,
  getLessonSaveSlots,
  getNextAvailableLessonSlot,
  getSavedPrograms,
  saveProgram,
  setStorageItem,
} from '../src/services/localSaveService';
import {
  DEFAULT_PROFILE_ID,
  awardBadgeForProfile,
  ensureProfilesInitialized,
  exportProfileBackup,
  exportProfileBackupToBinary,
  exportProfileBackupToJson,
  exportProfileBackupToQrBytes,
  exportProfileBackupToString,
  getLessonAutosave,
  getProfileProgress,
  getProfiles,
  getSandboxAutosave,
  isProfileBackupPayload,
  markLessonCompleted,
  parseProfileBackup,
  resetAllProfileDataForTests,
  saveLessonAutosave,
  saveSandboxAutosave,
} from '../src/services/profileService';
import {
  exportLessonCodeOnly,
  exportLessonToBinary,
  exportLessonToString,
  exportToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { CURRICULUM_ACTIVITIES, getActivityLatest } from '../src/data/curriculum';
import { GridState, WorkspaceState } from '../src/types';
import { useAppStore } from '../src/store/useAppStore';
import { LessonVersionMismatchModal } from '../src/components/LessonVersionMismatchModal';
import { SaveProgramModal } from '../src/components/SaveProgramModal';
import { LoadProgramModal } from '../src/components/LoadProgramModal';
import { ExportImportModal } from '../src/components/ExportImportModal';
import { ProfileSwitcherModal } from '../src/components/ProfileSwitcherModal';

const normalizeBlock = ({ id: _id, repeatCount, params, ...rest }: any) => ({
  ...rest,
  repeatCount: repeatCount ?? 1,
  params: params ?? undefined,
});

const stripIds = (ws?: WorkspaceState) => ({
  MAIN: (ws?.MAIN || []).map(normalizeBlock),
  F1: (ws?.F1 || []).map(normalizeBlock),
  F2: (ws?.F2 || []).map(normalizeBlock),
  F3: (ws?.F3 || []).map(normalizeBlock),
});

describe('Commit 4: Versioned Lesson Saves, Slots, Mismatch Modal & Whole-Profile Backup', () => {
  beforeEach(() => {
    clearAllSavedPrograms();
    resetAllProfileDataForTests();
    ensureProfilesInitialized();
    const store = useAppStore.getState();
    store.dismissVersionMismatch();
    store.reloadActiveProfileState();
    store.setAppMode('curriculum');
    store.setCurriculumActivity('1.1');
    store.setSaveModalOpen(false);
    store.setLoadModalOpen(false);
    store.setExportImportOpen(false);
    store.setProfileModalOpen(false);
  });

  describe('1. Store Dual-Path Lesson Round-Trip (Path A Slot vs Path B Share Envelope)', () => {
    it('loads identical curriculum lesson & workspace from both Path A (SavedProgramEntry) and Path B (ENV_ID_LESSON = 0x04)', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.2');
      store.clearWorkspace();
      store.addBlock('MAIN', 'MOVE_FWD', 2);
      store.addBlock('MAIN', 'TURN_RIGHT');
      store.addBlock('MAIN', 'MOVE_FWD', 1);

      const expectedWs = stripIds(useAppStore.getState().workspace);
      const activeVer = useAppStore.getState().activeActivityVersion;

      // Path A: Code-only payload + top-level JSON metadata
      const pathACode = useAppStore.getState().exportCode(false);
      expect(importFromString(pathACode).envId).toBe('generic');
      expect(importFromString(pathACode).gridState).toBeUndefined();

      const slotEntry = saveProgram({
        title: 'Activity 1.2 — Slot 1',
        profileId: useAppStore.getState().activeProfileId,
        simId: 'grid',
        code: pathACode,
        screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        status: 'SUCCESS',
        stepCount: 4,
        lessonId: '1.2',
        lessonVersion: activeVer,
        slotIndex: 1,
      });

      // Path B: Self-contained ENV_ID_LESSON = 0x04 Base64URL string
      const pathBShare = useAppStore.getState().exportCode(true);
      const decodedB = importFromString(pathBShare);
      expect(decodedB.envId).toBe('lesson');
      expect(decodedB.lessonId).toBe('1.2');
      expect(decodedB.lessonVersion).toBe(activeVer);

      // Switch away to Sandbox Turtle and clear blocks
      store.setAppMode('sandbox');
      store.setSimEnvironment('turtle');
      store.clearWorkspace();
      expect(useAppStore.getState().appMode).toBe('sandbox');

      // 1) Load Path A slot -> switches to Curriculum Activity 1.2 with exact blocks
      const resA = useAppStore.getState().loadSavedProgram(slotEntry);
      expect(resA.success).toBe(true);
      expect(resA.versionMismatchPending).toBeUndefined();
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('1.2');
      expect(useAppStore.getState().activeActivityVersion).toBe(activeVer);
      expect(stripIds(useAppStore.getState().workspace)).toEqual(expectedWs);

      // Switch back to Sandbox again
      store.setAppMode('sandbox');
      store.clearWorkspace();

      // 2) Import Path B share string -> switches to Curriculum Activity 1.2 with exact blocks
      const resB = useAppStore.getState().importCode(pathBShare);
      expect(resB.success).toBe(true);
      expect(resB.versionMismatchPending).toBeUndefined();
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('1.2');
      expect(useAppStore.getState().activeActivityVersion).toBe(activeVer);
      expect(stripIds(useAppStore.getState().workspace)).toEqual(expectedWs);
    });
  });

  describe('2. Legacy v1 Local Saves & Sandbox Backward Compatibility', () => {
    it('associates legacy v1 saves with default profile and opens them in Free-Play Sandbox with embedded map intact', () => {
      const customGrid: GridState = {
        width: 7,
        height: 6,
        robot: { x: 1, y: 2, dir: 'SOUTH', initialX: 1, initialY: 2, initialDir: 'SOUTH' },
        barriers: [{ x: 1, y: 2, orientation: 'H' }],
        flags: [{ id: 'g1', x: 5, y: 4, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 1, y: 2 }],
        status: 'IDLE',
      };
      const legacyWs: WorkspaceState = {
        MAIN: [
          { id: 'l1', type: 'MOVE_FWD', repeatCount: 3 },
          { id: 'l2', type: 'TURN_LEFT' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const v1GridCode = exportToString(legacyWs, 'grid', customGrid);

      // Write raw v1 entry (missing `profileId`, `lessonId`, `lessonVersion`, `slotIndex`)
      setStorageItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            version: 1,
            id: 'legacy_v1_maze',
            title: 'Classic Maze Save',
            createdAt: 1700000000000,
            simId: 'grid',
            code: v1GridCode,
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'SUCCESS',
            stepCount: 4,
            levelId: 3,
          },
          {
            version: 1,
            id: 'legacy_v1_turtle',
            title: 'TODO Star Drawing',
            createdAt: 1700000001000,
            simId: 'turtle',
            code: 'AQIBAQALUAIUZI4CUAIWEBJaERdQAxSWAY4CUAM',
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'IDLE',
            stepCount: 11,
          },
        ])
      );

      const defaultSaves = getSavedPrograms(DEFAULT_PROFILE_ID);
      expect(defaultSaves).toHaveLength(2);
      const mazeSave = defaultSaves.find((s) => s.id === 'legacy_v1_maze')!;
      const turtleSave = defaultSaves.find((s) => s.id === 'legacy_v1_turtle')!;
      expect(mazeSave.profileId).toBe(DEFAULT_PROFILE_ID);
      expect(mazeSave.lessonId).toBeUndefined();

      // Ensure we start in Curriculum mode
      const store = useAppStore.getState();
      expect(store.appMode).toBe('curriculum');

      // Loading legacy v1 Grid save switches to Sandbox and restores 7x6 custom map & levelId = 3
      const loadRes = store.loadSavedProgram(mazeSave);
      expect(loadRes.success).toBe(true);
      const afterMaze = useAppStore.getState();
      expect(afterMaze.appMode).toBe('sandbox');
      expect(afterMaze.activeSimId).toBe('grid');
      expect(afterMaze.currentLevel).toBe(3);
      expect(afterMaze.grid.width).toBe(7);
      expect(afterMaze.grid.height).toBe(6);
      expect(afterMaze.grid.robot.initialDir).toBe('SOUTH');
      expect(afterMaze.grid.barriers).toHaveLength(1);
      expect(afterMaze.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'TURN_LEFT']);

      // Loading legacy v1 Turtle save from Curriculum mode also switches cleanly to Sandbox Turtle
      store.setAppMode('curriculum');
      const loadTurtleRes = useAppStore.getState().loadSavedProgram(turtleSave);
      expect(loadTurtleRes.success).toBe(true);
      expect(useAppStore.getState().appMode).toBe('sandbox');
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().workspace.MAIN.length).toBeGreaterThan(0);
    });
  });

  describe('3. Numbered Manual Save Slots per Profile & Lesson', () => {
    it('manages unique numbered slots per (profileId, lessonId) with upsert and gap filling', () => {
      const ws1: WorkspaceState = {
        MAIN: [{ id: '1', type: 'MOVE_FWD' }],
        F1: [],
        F2: [],
        F3: [],
      };
      const ws2: WorkspaceState = {
        MAIN: [{ id: '2', type: 'TURN_LEFT' }],
        F1: [],
        F2: [],
        F3: [],
      };

      expect(getNextAvailableLessonSlot('default', '1.1')).toBe(1);

      const s1 = saveProgram({
        title: 'Activity 1.1 — Slot 1',
        profileId: 'default',
        simId: 'grid',
        code: exportLessonCodeOnly(ws1, 'grid'),
        screenshot: '',
        status: 'IDLE',
        stepCount: 1,
        lessonId: '1.1',
        lessonVersion: 1,
        slotIndex: 1,
      });

      expect(getNextAvailableLessonSlot('default', '1.1')).toBe(2);

      const s2 = saveProgram({
        title: 'Activity 1.1 — Slot 2',
        profileId: 'default',
        simId: 'grid',
        code: exportLessonCodeOnly(ws2, 'grid'),
        screenshot: '',
        status: 'SUCCESS',
        stepCount: 2,
        lessonId: '1.1',
        lessonVersion: 1,
        slotIndex: 2,
      });

      expect(getNextAvailableLessonSlot('default', '1.1')).toBe(3);

      // Overwriting Slot 1 without passing `id` upserts Slot 1 in-place
      const s1Updated = saveProgram({
        title: 'Activity 1.1 — Slot 1 Improved',
        profileId: 'default',
        simId: 'grid',
        code: exportLessonCodeOnly(ws2, 'grid'),
        screenshot: '',
        status: 'SUCCESS',
        stepCount: 3,
        lessonId: '1.1',
        lessonVersion: 1,
        slotIndex: 1,
      });

      expect(s1Updated.id).toBe(s1.id);
      const slots = getLessonSaveSlots('default', '1.1');
      expect(slots).toHaveLength(2);
      expect(slots.map((s) => s.slotIndex)).toEqual([1, 2]);
      expect(slots[0].title).toBe('Activity 1.1 — Slot 1 Improved');

      // Other lessons and profiles start cleanly at Slot 1
      expect(getNextAvailableLessonSlot('default', '1.2')).toBe(1);
      expect(getNextAvailableLessonSlot('profile_other', '1.1')).toBe(1);

      // Deleting Slot 1 opens Slot 1 as next available
      deleteProgram(s1.id);
      expect(getNextAvailableLessonSlot('default', '1.1')).toBe(1);
      expect(getLessonSaveSlots('default', '1.1').map((s) => s.id)).toEqual([s2.id]);
    });
  });

  describe('4. Synthetic v1 -> v2 Lesson Version Mismatch Flows', () => {
    it('triggers LessonVersionMismatchModal for both Path A slots and Path B share strings and supports Latest vs Original version choices', () => {
      const targetIdx = CURRICULUM_ACTIVITIES.findIndex((a) => a.id === '1.2');
      expect(targetIdx).toBeGreaterThanOrEqual(0);
      const targetActivity = CURRICULUM_ACTIVITIES[targetIdx];
      const originalSnapshot = JSON.parse(JSON.stringify(targetActivity));

      try {
        // Synthesize v2 update on Activity 1.2 while retaining v1 in `historicalVersions`
        const v1Historical = JSON.parse(JSON.stringify(originalSnapshot));
        v1Historical.version = 1;
        v1Historical.historicalVersions = undefined;

        const v1Width = v1Historical.grid.width;
        const v2Width = v1Width + 2;

        targetActivity.version = 2;
        targetActivity.grid = {
          ...JSON.parse(JSON.stringify(v1Historical.grid)),
          width: v2Width,
        };
        targetActivity.historicalVersions = { 1: v1Historical };

        expect(getActivityLatest('1.2')?.version).toBe(2);

        const savedWs: WorkspaceState = {
          MAIN: [
            { id: 'm1', type: 'MOVE_FWD', repeatCount: 2 },
            { id: 'm2', type: 'TURN_RIGHT' },
          ],
          F1: [],
          F2: [],
          F3: [],
        };

        // --- Flow A: Manual Save Slot saved at v1 ---
        const v1Slot = saveProgram({
          title: 'Old v1 Attempt',
          profileId: 'default',
          simId: 'grid',
          code: exportLessonCodeOnly(savedWs, 'grid'),
          screenshot: '',
          status: 'IDLE',
          stepCount: 2,
          lessonId: '1.2',
          lessonVersion: 1,
          slotIndex: 1,
        });

        const loadSlotRes = useAppStore.getState().loadSavedProgram(v1Slot);
        expect(loadSlotRes.success).toBe(true);
        expect(loadSlotRes.versionMismatchPending).toBe(true);

        const mismatchA = useAppStore.getState().pendingVersionMismatch;
        expect(mismatchA).not.toBeNull();
        expect(mismatchA?.source).toBe('slot');
        expect(mismatchA?.lessonId).toBe('1.2');
        expect(mismatchA?.savedVersion).toBe(1);
        expect(mismatchA?.latestVersion).toBe(2);
        expect(mismatchA?.hasHistoricalVersion).toBe(true);

        // Choice 2: Open in Original Lesson Version (v1)
        const resolvedOriginal = useAppStore.getState().resolveVersionMismatch('original');
        expect(resolvedOriginal).toBe(true);
        expect(useAppStore.getState().pendingVersionMismatch).toBeNull();
        expect(useAppStore.getState().appMode).toBe('curriculum');
        expect(useAppStore.getState().activeActivityId).toBe('1.2');
        expect(useAppStore.getState().activeActivityVersion).toBe(1);
        expect(useAppStore.getState().grid.width).toBe(v1Width);
        expect(stripIds(useAppStore.getState().workspace)).toEqual(stripIds(savedWs));

        // --- Flow B: Standalone Share String (`ENV_ID_LESSON = 0x04`) encoded at v1 ---
        const v1ShareString = exportLessonToString(savedWs, 'grid', '1.2', 1);
        useAppStore.getState().setExportImportOpen(true);
        const importShareRes = useAppStore.getState().importCode(v1ShareString);
        expect(importShareRes.success).toBe(true);
        expect(importShareRes.versionMismatchPending).toBe(true);
        expect(useAppStore.getState().isExportImportOpen).toBe(false);
        expect(useAppStore.getState().pendingVersionMismatch?.source).toBe('share');

        // Choice 1: Load into Latest Lesson (v2)
        const resolvedLatest = useAppStore.getState().resolveVersionMismatch('latest');
        expect(resolvedLatest).toBe(true);
        expect(useAppStore.getState().pendingVersionMismatch).toBeNull();
        expect(useAppStore.getState().activeActivityId).toBe('1.2');
        expect(useAppStore.getState().activeActivityVersion).toBe(2);
        expect(useAppStore.getState().grid.width).toBe(v2Width);
        expect(stripIds(useAppStore.getState().workspace)).toEqual(stripIds(savedWs));

        // --- Flow C: Unavailable Historical Version (e.g., v1 pruned at v3) ---
        targetActivity.version = 3;
        targetActivity.historicalVersions = {};

        const importPrunedRes = useAppStore
          .getState()
          .importBinary(exportLessonToBinary(savedWs, 'grid', '1.2', 1));
        expect(importPrunedRes.success).toBe(true);
        expect(importPrunedRes.versionMismatchPending).toBe(true);
        expect(useAppStore.getState().pendingVersionMismatch?.hasHistoricalVersion).toBe(false);

        // Attempting 'original' returns false gracefully; 'latest' succeeds into v3
        expect(useAppStore.getState().resolveVersionMismatch('original')).toBe(false);
        expect(useAppStore.getState().pendingVersionMismatch).not.toBeNull();
        expect(useAppStore.getState().resolveVersionMismatch('latest')).toBe(true);
        expect(useAppStore.getState().activeActivityVersion).toBe(3);
      } finally {
        Object.assign(targetActivity, originalSnapshot);
      }
    });
  });

  describe('5. Whole-Profile Backup Export & Import (Add as New vs Replace Active)', () => {
    it('exports full profile backup (JSON & QR bytes) and imports cleanly via both Add as New Profile and Replace Active Profile without ID collisions', () => {
      const store = useAppStore.getState();

      // Create a rich custom profile "Leo"
      const leo = store.createAndSwitchProfile({
        avatarId: 'fox',
        colorId: 'amber',
        name: 'Leo',
      });

      markLessonCompleted(leo.id, '1.1', 1, 1700000100000);
      markLessonCompleted(leo.id, '1.2', 1, 1700000200000);
      awardBadgeForProfile(leo.id, 'badge-explorer');

      const lessonWs: WorkspaceState = {
        MAIN: [{ id: 'lw1', type: 'MOVE_FWD', repeatCount: 3 }],
        F1: [],
        F2: [],
        F3: [],
      };
      const sandboxWs: WorkspaceState = {
        MAIN: [{ id: 'sw1', type: 'FORWARD', params: { length: 60 } }],
        F1: [],
        F2: [],
        F3: [],
      };
      saveLessonAutosave(leo.id, '1.2', lessonWs, 1, 1700000300000);
      saveSandboxAutosave(leo.id, 'turtle', sandboxWs, 1700000400000);

      const leoSlot = saveProgram({
        title: 'Leo Slot 1',
        profileId: leo.id,
        simId: 'grid',
        code: exportLessonCodeOnly(lessonWs, 'grid'),
        screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%20id%3D%22custom%22%3E%3C%2Fsvg%3E',
        status: 'SUCCESS',
        stepCount: 3,
        lessonId: '1.2',
        lessonVersion: 1,
        slotIndex: 1,
      });

      const backupJson = exportProfileBackupToJson(leo.id);
      const backupBinary = exportProfileBackupToBinary(leo.id);
      const backupString = exportProfileBackupToString(leo.id);
      const backupQrBytes = exportProfileBackupToQrBytes(leo.id);

      expect(backupString.startsWith('AQYB')).toBe(true);
      expect(backupQrBytes.length).toBeLessThan(200);
      expect(isProfileBackupPayload(backupJson)).toBe(true);
      expect(isProfileBackupPayload(backupBinary)).toBe(true);
      expect(isProfileBackupPayload(backupString)).toBe(true);
      expect(isProfileBackupPayload(backupQrBytes)).toBe(true);
      expect(isProfileBackupPayload(exportLessonToString(lessonWs, 'grid', '1.2', 1))).toBe(false);
      expect(isProfileBackupPayload(exportLessonToBinary(lessonWs, 'grid', '1.2', 1))).toBe(false);

      const parsedJson = parseProfileBackup(backupJson);
      expect(parsedJson.success).toBe(true);
      const parsedCompact = parseProfileBackup(backupString);
      expect(parsedCompact.success).toBe(true);
      expect(exportProfileBackup(leo.id).savedPrograms).toHaveLength(1);

      // 1) Import compact Base64URL string as NEW profile on the SAME browser where Leo still exists
      const importNewRes = useAppStore.getState().importUserProfileBackup(backupString, 'new');
      expect(importNewRes.success).toBe(true);
      const clonedProfile = importNewRes.profile!;
      expect(clonedProfile.id).not.toBe(leo.id);
      expect(clonedProfile.name).toBe('Leo');
      expect(clonedProfile.avatarId).toBe('fox');
      expect(useAppStore.getState().activeProfileId).toBe(clonedProfile.id);

      const clonedProg = getProfileProgress(clonedProfile.id);
      expect(Object.keys(clonedProg.completedLessons)).toEqual(['1.1', '1.2']);
      expect(clonedProg.earnedBadges).toContain('badge-explorer');
      expect(stripIds(getLessonAutosave(clonedProfile.id, '1.2')?.workspace)).toEqual(
        stripIds(lessonWs)
      );
      expect(stripIds(getSandboxAutosave(clonedProfile.id, 'turtle')?.workspace)).toEqual(
        stripIds(sandboxWs)
      );

      // Verify zero ID collision between source Leo and cloned Leo manual save slots
      const leoSavesAfter = getSavedPrograms(leo.id);
      const clonedSaves = getSavedPrograms(clonedProfile.id);
      expect(leoSavesAfter).toHaveLength(1);
      expect(clonedSaves).toHaveLength(1);
      expect(clonedSaves[0].id).not.toBe(leoSlot.id);
      expect(clonedSaves[0].slotIndex).toBe(1);
      expect(clonedSaves[0].code).toBe(leoSlot.code);

      // Legacy v1 JSON backup also continues to import cleanly as NEW profile
      const legacyImportRes = useAppStore.getState().importUserProfileBackup(backupJson, 'new');
      expect(legacyImportRes.success).toBe(true);
      expect(legacyImportRes.profile?.name).toBe('Leo');

      // 2) Switch to `'default'` profile, add a dummy save, then REPLACE `'default'` using QR bytes
      useAppStore.getState().switchProfile(DEFAULT_PROFILE_ID);
      saveProgram({
        title: 'Old Default Save To Be Replaced',
        profileId: DEFAULT_PROFILE_ID,
        simId: 'grid',
        code: exportLessonCodeOnly(lessonWs, 'grid'),
        screenshot: '',
        status: 'IDLE',
        stepCount: 1,
      });
      expect(getSavedPrograms(DEFAULT_PROFILE_ID)).toHaveLength(1);

      const replaceRes = useAppStore.getState().importUserProfileBackup(backupQrBytes, 'replace');
      expect(replaceRes.success).toBe(true);
      expect(replaceRes.profile?.id).toBe(DEFAULT_PROFILE_ID);
      expect(replaceRes.profile?.name).toBe('Leo');
      expect(getProfiles().some((p) => p.id === leo.id)).toBe(true);

      const replacedDefaultSaves = getSavedPrograms(DEFAULT_PROFILE_ID);
      expect(replacedDefaultSaves).toHaveLength(1);
      expect(replacedDefaultSaves[0].title).toBe('Leo Slot 1');
      // Thumbnail was regenerated from QR backup (contains rendered Grid SVG rather than blank fallback)
      expect(decodeURIComponent(replacedDefaultSaves[0].screenshot)).toContain('#0c0c1d');
      // Source Leo profile saves remain completely untouched
      expect(getSavedPrograms(leo.id)).toHaveLength(1);
    });
  });

  describe('6. UI Components & Accessibility Rendering', () => {
    it('renders LessonVersionMismatchModal, numbered Save/Load slot badges, Share Lesson envelope controls, and Profile Backup controls with accessible roles', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };

      try {
        const ws: WorkspaceState = {
          MAIN: [{ id: 'u1', type: 'MOVE_FWD' }],
          F1: [],
          F2: [],
          F3: [],
        };

        // Populate Slot 1 on Activity 1.1 with synthetic v0 mismatch badge for Load modal preview
        const slot1 = saveProgram({
          title: 'Activity 1.1 — Slot 1',
          profileId: DEFAULT_PROFILE_ID,
          simId: 'grid',
          code: exportLessonCodeOnly(ws, 'grid'),
          screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
          status: 'SUCCESS',
          stepCount: 1,
          lessonId: '1.1',
          lessonVersion: 1,
          slotIndex: 1,
        });

        // 1) LessonVersionMismatchModal (historical available vs unavailable)
        useAppStore.setState({
          pendingVersionMismatch: {
            source: 'slot',
            lessonId: '1.1',
            savedVersion: 1,
            latestVersion: 2,
            workspace: ws,
            hasHistoricalVersion: true,
            title: 'Activity 1.1 — Slot 1',
            slotIndex: 1,
          },
        });
        Object.assign(initialRef, useAppStore.getState());

        const mismatchAvailHtml = renderToStaticMarkup(
          React.createElement(LessonVersionMismatchModal)
        );
        expect(mismatchAvailHtml).toContain('role="dialog"');
        expect(mismatchAvailHtml).toContain('aria-modal="true"');
        expect(mismatchAvailHtml).toContain('data-testid="lesson-version-mismatch-modal"');
        expect(mismatchAvailHtml).toContain('data-testid="btn-mismatch-load-latest"');
        expect(mismatchAvailHtml).toContain('data-testid="btn-mismatch-open-original"');
        expect(mismatchAvailHtml).not.toContain('data-testid="mismatch-original-unavailable-note"');

        useAppStore.setState({
          pendingVersionMismatch: {
            source: 'share',
            lessonId: '1.1',
            savedVersion: 1,
            latestVersion: 3,
            workspace: ws,
            hasHistoricalVersion: false,
          },
        });
        Object.assign(initialRef, useAppStore.getState());

        const mismatchUnavailHtml = renderToStaticMarkup(
          React.createElement(LessonVersionMismatchModal)
        );
        expect(mismatchUnavailHtml).toContain('data-testid="mismatch-original-unavailable-note"');
        expect(mismatchUnavailHtml).toMatch(/data-testid="btn-mismatch-open-original"[^>]*disabled/);

        useAppStore.getState().dismissVersionMismatch();

        // 2) SaveProgramModal in Curriculum mode renders visual numbered Lesson Save Slots
        useAppStore.setState({
          appMode: 'curriculum',
          activeActivityId: '1.1',
          activeActivityVersion: 1,
          isSaveModalOpen: true,
        });
        Object.assign(initialRef, useAppStore.getState());

        const saveHtml = renderToStaticMarkup(React.createElement(SaveProgramModal));
        expect(saveHtml).toContain('data-testid="save-program-modal"');
        expect(saveHtml).toContain('data-testid="lesson-save-slots-grid"');
        expect(saveHtml).toContain('data-testid="save-slot-btn-1"');
        expect(saveHtml).toContain('data-testid="save-slot-btn-2"');
        expect(saveHtml).toContain('data-testid="save-slot-btn-3"');

        // 3) LoadProgramModal renders filter pills & numbered Slot 1 badge
        useAppStore.setState({
          isSaveModalOpen: false,
          isLoadModalOpen: true,
        });
        Object.assign(initialRef, useAppStore.getState());

        const loadHtml = renderToStaticMarkup(React.createElement(LoadProgramModal));
        expect(loadHtml).toContain('data-testid="load-program-modal"');
        expect(loadHtml).toContain('data-testid="load-filter-current-lesson"');
        expect(loadHtml).toContain(`data-testid="load-slot-badge-${slot1.id}"`);
        expect(loadHtml).toContain('Slot 1');

        // 4) ExportImportModal renders Program vs Whole Profile scope & Curriculum Lesson envelope badge
        useAppStore.setState({
          isLoadModalOpen: false,
          isExportImportOpen: true,
        });
        Object.assign(initialRef, useAppStore.getState());

        const shareHtml = renderToStaticMarkup(React.createElement(ExportImportModal));
        expect(shareHtml).toContain('data-testid="share-scope-program"');
        expect(shareHtml).toContain('data-testid="share-scope-profile"');
        expect(shareHtml).toContain('data-testid="export-lesson-envelope-badge"');
        expect(shareHtml).toContain('data-testid="checkbox-include-lesson-envelope"');

        // 5) ProfileSwitcherModal renders Backup or Move Profile toggle
        useAppStore.setState({
          isExportImportOpen: false,
          isProfileModalOpen: true,
        });
        Object.assign(initialRef, useAppStore.getState());

        const profileHtml = renderToStaticMarkup(React.createElement(ProfileSwitcherModal));
        expect(profileHtml).toContain('data-testid="btn-toggle-profile-backup"');
      } finally {
        Object.assign(initialRef, backupInitial);
      }
    });

    it('maintains logical keyboard Tab focus order, button types, and polite status announcements across modals', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };

      try {
        const ws: WorkspaceState = {
          MAIN: [{ id: 'k1', type: 'MOVE_FWD' }],
          F1: [],
          F2: [],
          F3: [],
        };

        // Verify LessonVersionMismatchModal interactive button tab order:
        // [Close/Cancel -> Load into Latest Lesson -> Open in Original Lesson Version]
        useAppStore.setState({
          pendingVersionMismatch: {
            source: 'slot',
            lessonId: '1.1',
            savedVersion: 1,
            latestVersion: 2,
            workspace: ws,
            hasHistoricalVersion: true,
            title: 'Keyboard Slot 1',
            slotIndex: 1,
          },
        });
        Object.assign(initialRef, useAppStore.getState());

        const mismatchHtml = renderToStaticMarkup(React.createElement(LessonVersionMismatchModal));
        const buttonOrder = Array.from(
          mismatchHtml.matchAll(/data-testid="(btn-mismatch-[^"]+)"/g)
        ).map((m) => m[1]);
        expect(buttonOrder).toEqual([
          'btn-mismatch-cancel',
          'btn-mismatch-load-latest',
          'btn-mismatch-open-original',
        ]);
        expect(mismatchHtml).toContain('aria-labelledby="lesson-version-mismatch-title"');
        expect(mismatchHtml).toContain('aria-describedby="lesson-version-mismatch-desc"');

        // Dismissing updates polite statusAnnouncement cleanly
        useAppStore.getState().dismissVersionMismatch();
        expect(useAppStore.getState().pendingVersionMismatch).toBeNull();
        expect(useAppStore.getState().statusAnnouncement).toMatch(/Cancelled loading mismatched/);

        // Verify SaveProgramModal slot buttons appear in numeric keyboard order (Slot 1 -> Slot 2 -> Slot 3 -> Save)
        useAppStore.setState({
          appMode: 'curriculum',
          activeActivityId: '1.1',
          activeActivityVersion: 1,
          isSaveModalOpen: true,
        });
        Object.assign(initialRef, useAppStore.getState());

        const saveHtml = renderToStaticMarkup(React.createElement(SaveProgramModal));
        const idxSlot1 = saveHtml.indexOf('data-testid="save-slot-btn-1"');
        const idxSlot2 = saveHtml.indexOf('data-testid="save-slot-btn-2"');
        const idxSlot3 = saveHtml.indexOf('data-testid="save-slot-btn-3"');
        const idxTitleInput = saveHtml.indexOf('data-testid="input-save-title"');
        const idxConfirmSave = saveHtml.indexOf('data-testid="btn-confirm-save"');
        expect(idxSlot1).toBeGreaterThan(0);
        expect(idxSlot1).toBeLessThan(idxSlot2);
        expect(idxSlot2).toBeLessThan(idxSlot3);
        expect(idxSlot3).toBeLessThan(idxTitleInput);
        expect(idxTitleInput).toBeLessThan(idxConfirmSave);
      } finally {
        Object.assign(initialRef, backupInitial);
      }
    });
  });
});
