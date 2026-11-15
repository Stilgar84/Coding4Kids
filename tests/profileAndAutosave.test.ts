import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CURRICULUM_PROGRESS_STORAGE_KEY,
  DEFAULT_PROFILE_ID,
  LESSON_AUTOSAVE_STORAGE_KEY,
  PROFILES_STORAGE_KEY,
  PROFILE_AVATARS,
  PROFILE_COLORS,
  createProfile,
  deleteProfile,
  ensureProfilesInitialized,
  getActiveProfile,
  getActiveProfileId,
  getLessonAutosave,
  getProfileColor,
  getProfileProgress,
  getProfiles,
  getSandboxAutosave,
  isLessonCompleted,
  markLessonCompleted,
  resetAllProfileDataForTests,
} from '../src/services/profileService';
import {
  clearAllSavedPrograms,
  getSavedPrograms,
  getStorageItem,
  migrateLegacySavedProgramsToDefault,
  saveProgram,
  setStorageItem,
} from '../src/services/localSaveService';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  createCurriculumBlock,
} from '../src/data/curriculum';
import { useAppStore } from '../src/store/useAppStore';
import { ProfileSwitcherModal } from '../src/components/ProfileSwitcherModal';
import { Toolbar } from '../src/components/Toolbar';
import { MobileDrawerMenu } from '../src/components/MobileDrawerMenu';

function resetStoreAndStorage() {
  clearAllSavedPrograms();
  resetAllProfileDataForTests();

  const s = useAppStore.getState();
  s.pause();
  s.setAppMode('sandbox');
  s.setSimEnvironment('grid');
  s.setLevel(1);
  s.setSpeed(400);
  s.setProfileModalOpen(false);
  s.setMobileMenuOpen(false);

  // Re-initialize clean default profile & state
  clearAllSavedPrograms();
  resetAllProfileDataForTests();
  useAppStore.getState().reloadActiveProfileState();
  useAppStore.setState({
    statusAnnouncement: '',
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
}

describe('Commit 3 (Wave 2): Kid-Friendly Multi-Profile, Lesson Auto-Save & Reset-to-Starter', () => {
  beforeEach(() => {
    resetStoreAndStorage();
  });

  describe('Default Profile Bootstrap & Color-Blind Accessible Metadata', () => {
    it('auto-creates default profile ("default") in robotemu_profiles_v1 on first boot', () => {
      resetAllProfileDataForTests();
      expect(getStorageItem(PROFILES_STORAGE_KEY)).toBeNull();

      const state = ensureProfilesInitialized();
      expect(state.version).toBe(1);
      expect(state.activeProfileId).toBe(DEFAULT_PROFILE_ID);
      expect(state.profiles).toHaveLength(1);
      expect(state.profiles[0]).toMatchObject({
        id: 'default',
        avatarId: 'robot',
        colorId: 'sky',
        name: 'Player 1',
      });

      const persistedRaw = getStorageItem(PROFILES_STORAGE_KEY);
      expect(persistedRaw).not.toBeNull();
      expect(JSON.parse(persistedRaw!).activeProfileId).toBe('default');
    });

    it('pairs every profile color swatch with a distinct geometric shape cue for color-blind accessibility', () => {
      expect(PROFILE_AVATARS.length).toBeGreaterThanOrEqual(8);
      expect(PROFILE_COLORS.length).toBeGreaterThanOrEqual(6);

      const shapes = new Set(PROFILE_COLORS.map((c) => c.shapeSymbol));
      expect(shapes.size).toBe(PROFILE_COLORS.length);

      const defaultProfile = getActiveProfile();
      const colorMeta = getProfileColor(defaultProfile.colorId);
      expect(colorMeta.accentColor).toBe(defaultProfile.accentColor);
      expect(colorMeta.shapeSymbol.length).toBeGreaterThan(0);
    });

    it('recovers gracefully from corrupted robotemu_profiles_v1 JSON and protects "default" from deletion', () => {
      setStorageItem(PROFILES_STORAGE_KEY, '{corrupted_json!!');
      const recovered = ensureProfilesInitialized();
      expect(recovered.activeProfileId).toBe('default');
      expect(recovered.profiles.map((p) => p.id)).toEqual(['default']);

      expect(deleteProfile('default')).toBe(false);
      expect(useAppStore.getState().deleteUserProfile('default')).toBe(false);
      expect(getProfiles().some((p) => p.id === 'default')).toBe(true);
    });
  });

  describe('Legacy robotemu_saved_programs Non-Destructive Migration', () => {
    it('associates legacy v1 saved programs missing profileId with "default" without mutating existing fields', () => {
      const legacyPayload = [
        {
          version: 1,
          id: 'legacy_save_1',
          title: 'Legacy Maze Winner',
          createdAt: 1700000001000,
          simId: 'grid',
          code: 'ROBOTEMU_V1_TESTCODE_1',
          screenshot: 'data:image/svg+xml;utf8,<svg></svg>',
          status: 'SUCCESS',
          stepCount: 5,
          levelId: 2,
        },
        {
          version: 1,
          id: 'legacy_save_2',
          title: 'Legacy Turtle Star',
          createdAt: 1700000002000,
          simId: 'turtle',
          code: 'ROBOTEMU_V1_TESTCODE_2',
          screenshot: 'data:image/svg+xml;utf8,<svg></svg>',
          status: 'COMPLETED',
          stepCount: 12,
        },
      ];

      setStorageItem('robotemu_saved_programs', JSON.stringify(legacyPayload));
      resetAllProfileDataForTests();

      // Initializing profiles triggers non-destructive legacy save migration
      ensureProfilesInitialized();

      const rawAfter = JSON.parse(getStorageItem('robotemu_saved_programs')!);
      expect(Array.isArray(rawAfter)).toBe(true);
      expect(rawAfter).toHaveLength(2);
      expect(rawAfter[0]).toMatchObject({
        id: 'legacy_save_1',
        profileId: 'default',
        title: 'Legacy Maze Winner',
        createdAt: 1700000001000,
        simId: 'grid',
        code: 'ROBOTEMU_V1_TESTCODE_1',
        status: 'SUCCESS',
        stepCount: 5,
        levelId: 2,
      });
      expect(rawAfter[1].profileId).toBe('default');

      // Calling getSavedPrograms() with no args still returns all saves (legacy test compatibility)
      expect(getSavedPrograms()).toHaveLength(2);
      // Filtering by 'default' returns the migrated legacy saves
      expect(getSavedPrograms('default')).toHaveLength(2);

      // Creating a second profile isolates new saves per profile
      const profile2 = createProfile({ avatarId: 'fox', colorId: 'orange', name: 'Maya' });
      saveProgram({
        title: 'Maya Exclusive Save',
        profileId: profile2.id,
        simId: 'grid',
        code: 'ROBOTEMU_V1_MAYA',
        screenshot: '',
        status: 'SUCCESS',
        stepCount: 3,
      });

      expect(getSavedPrograms('default').map((s) => s.title)).toEqual([
        'Legacy Turtle Star',
        'Legacy Maze Winner',
      ]);
      expect(getSavedPrograms(profile2.id).map((s) => s.title)).toEqual(['Maya Exclusive Save']);
      expect(getSavedPrograms()).toHaveLength(3);

      // Re-running migration is idempotent (0 newly migrated)
      expect(migrateLegacySavedProgramsToDefault()).toBe(0);
    });
  });

  describe('Multi-Profile Creation, Switching & Isolated Lesson/Sandbox Auto-Save', () => {
    it('auto-saves and restores per-lesson and sandbox workspaces across activity switches, profile switches, and reloads', () => {
      const store = useAppStore.getState();
      const firstMod = CURRICULUM_MODULES[0];
      const puzzles = CURRICULUM_ACTIVITIES.filter(
        (a) => a.moduleId === firstMod.id && a.format === 'puzzle'
      );
      const act1Id = puzzles[0]?.id ?? '1.1';
      const act2Id = puzzles[1]?.id ?? '1.2';

      // Default profile: build a Sandbox Grid workspace first
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(getSandboxAutosave('default', 'grid')?.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
      ]);

      // Switch to Curriculum mode -> First puzzle activity
      store.setAppMode('curriculum');
      store.setCurriculumActivity(act1Id);
      const initialAct1Types = useAppStore.getState().workspace.MAIN.map((b) => b.type);

      // Default profile edits Activity 1
      store.clearWorkspace();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');

      const savedAct1Default = getLessonAutosave('default', act1Id);
      expect(savedAct1Default).not.toBeNull();
      expect(savedAct1Default?.lessonVersion).toBe(puzzles[0]?.version ?? 1);
      expect(savedAct1Default?.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'MOVE_FWD']);

      // Default profile switches to Activity 2 and adds different blocks
      store.setCurriculumActivity(act2Id);
      store.clearWorkspace();
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');

      // Switch back to Activity 1 -> restores Default's Activity 1 blocks
      store.setCurriculumActivity(act1Id);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'MOVE_FWD',
      ]);

      // Create & switch to Profile 2 (Frog / Leo)
      const leo = store.createAndSwitchProfile({
        avatarId: 'frog',
        colorId: 'emerald',
        name: 'Leo',
      });
      expect(useAppStore.getState().activeProfileId).toBe(leo.id);
      expect(getActiveProfileId()).toBe(leo.id);
      expect(useAppStore.getState().statusAnnouncement).toContain('Leo');

      // Leo sees a clean starter workspace on Activity 1 and Activity 2!
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(initialAct1Types);
      store.setCurriculumActivity(act2Id);

      // Leo places TURN_RIGHT on Activity 2
      store.clearWorkspace();
      store.addBlock('MAIN', 'TURN_RIGHT');
      expect(getLessonAutosave(leo.id, act2Id)?.workspace.MAIN.map((b) => b.type)).toEqual([
        'TURN_RIGHT',
      ]);

      // Simulate browser reload while Leo is active on Activity 2:
      // Clear in-memory store workspaces and re-hydrate from robotemu_lesson_autosave_v1
      useAppStore.setState({
        workspace: { MAIN: [], F1: [], F2: [], F3: [] },
        curriculumWorkspaces: {},
        savedWorkspaces: {},
      });
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      useAppStore.getState().reloadActiveProfileState();
      expect(useAppStore.getState().activeProfileId).toBe(leo.id);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['TURN_RIGHT']);

      // Switch back to 'default' profile -> restores Default's Activity 2 and Activity 1 workspaces + Sandbox workspace!
      useAppStore.getState().switchProfile('default');
      expect(useAppStore.getState().activeProfileId).toBe('default');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
      ]);

      useAppStore.getState().setCurriculumActivity(act1Id);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'MOVE_FWD',
      ]);

      // Switch Default back to Sandbox -> Default's Sandbox Grid block is restored
      useAppStore.getState().setAppMode('sandbox');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD']);

      // Delete Leo's profile while Leo is active -> falls back to 'default' and purges Leo's autosave data
      useAppStore.getState().switchProfile(leo.id);
      expect(useAppStore.getState().deleteUserProfile(leo.id)).toBe(true);
      expect(useAppStore.getState().activeProfileId).toBe('default');
      expect(getLessonAutosave(leo.id, act2Id)).toBeNull();
      expect(getLessonAutosave('default', act1Id)?.workspace.MAIN).toHaveLength(2);
    });
  });

  describe('Curriculum Progress & Puzzle Completion Tracking (robotemu_curriculum_progress_v1)', () => {
    it('marks curriculum puzzles completed on SUCCESS (step & instant), unlocks next module, and isolates progress per profile', () => {
      const store = useAppStore.getState();
      const firstMod = CURRICULUM_MODULES[0];
      const secondMod = CURRICULUM_MODULES[1];
      const puzzles = CURRICULUM_ACTIVITIES.filter(
        (a) => a.moduleId === firstMod.id && a.format === 'puzzle'
      );
      const puzzle1 = puzzles[0];
      const puzzle2 = puzzles[1];
      const puzzle3 = puzzles[2];

      // Solving a preset map in Sandbox mode does NOT record curriculum progress
      store.setAppMode('sandbox');
      store.setLevel(1);
      store.loadSolution(1);
      store.setSpeed('instant');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(Object.keys(getProfileProgress('default').completedLessons)).toHaveLength(0);

      // Switch to Curriculum mode Activity 1 and solve via step()
      store.setSpeed(400);
      store.setAppMode('curriculum');
      store.setCurriculumActivity(puzzle1.id);
      store.clearWorkspace();
      for (const b of puzzle1.referenceSolution?.MAIN ?? [
        createCurriculumBlock('MOVE_FWD'),
        createCurriculumBlock('MOVE_FWD'),
        createCurriculumBlock('MOVE_FWD'),
      ]) {
        store.addBlock('MAIN', b.type, b.params);
      }

      for (let i = 0; i < 30 && useAppStore.getState().grid.status !== 'SUCCESS'; i++) {
        useAppStore.getState().step();
      }

      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(isLessonCompleted('default', puzzle1.id)).toBe(true);
      expect(useAppStore.getState().completedActivities[puzzle1.id]).toBe(true);

      const rawProg = JSON.parse(getStorageItem(CURRICULUM_PROGRESS_STORAGE_KEY)!);
      expect(rawProg.profiles.default.completedLessons[puzzle1.id].version).toBe(puzzle1.version);

      // Solve Activity 2 in Instant mode -> also records completion!
      store.setCurriculumActivity(puzzle2.id);
      store.loadSolution();
      store.setSpeed('instant');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(isLessonCompleted('default', puzzle2.id)).toBe(true);
      expect(useAppStore.getState().completedActivities[puzzle2.id]).toBe(true);

      // Solve Activity 3 and any remaining registered first-module activities -> unlocks next module
      store.setCurriculumActivity(puzzle3.id);
      store.loadSolution();
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(isLessonCompleted('default', puzzle3.id)).toBe(true);

      const newlyEarnedFromM1: string[] = [];
      for (const act of CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === firstMod.id)) {
        if (!isLessonCompleted('default', act.id)) {
          const r = markLessonCompleted('default', act.id, act.version);
          newlyEarnedFromM1.push(...r.newlyEarnedBadges);
        }
      }

      const defaultProgress = getProfileProgress('default');
      expect(defaultProgress.unlockedModules).toContain(firstMod.id);
      if (secondMod) {
        expect(defaultProgress.unlockedModules).toContain(secondMod.id);
      }

      // Completing capstones awards first module's badge exactly once
      const capstoneEarned: string[] = [];
      for (const capId of firstMod.capstoneIds) {
        const res = markLessonCompleted('default', capId, 1);
        capstoneEarned.push(...res.newlyEarnedBadges);
      }
      expect([...newlyEarnedFromM1, ...capstoneEarned]).toEqual([firstMod.badgeId]);
      expect(getProfileProgress('default').earnedBadges).toContain(firstMod.badgeId);

      // Secondary profile starts with zero completed lessons and only the first module unlocked
      const owl = store.createAndSwitchProfile({ avatarId: 'owl', colorId: 'violet' });
      expect(useAppStore.getState().completedActivities).toEqual({});
      expect(isLessonCompleted(owl.id, puzzle1.id)).toBe(false);
      expect(getProfileProgress(owl.id).unlockedModules).toEqual([firstMod.id]);
      expect(getProfileProgress(owl.id).earnedBadges).toEqual([]);
    });
  });

  describe('Undo-Protected Reset to Starter (resetActivityToStarter)', () => {
    it('pushes prior blocks onto Undo history, resets to starterWorkspace (or empty), resets runtime, and restores blocks on undo()', () => {
      const store = useAppStore.getState();
      const firstMod = CURRICULUM_MODULES[0];
      const candidate =
        CURRICULUM_ACTIVITIES.find(
          (a) => a.moduleId === firstMod.id && a.format === 'puzzle' && !a.starterWorkspace
        ) ??
        CURRICULUM_ACTIVITIES.find((a) => a.moduleId === firstMod.id && a.format === 'puzzle') ??
        CURRICULUM_ACTIVITIES[0];
      const expectedStarterTypes = (candidate.starterWorkspace?.MAIN ?? []).map((b) => b.type);

      store.setAppMode('curriculum');
      store.setCurriculumActivity(candidate.id);

      // Build user blocks & step once so runtime & robot pose have advanced
      store.clearWorkspace();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.step();
      expect(useAppStore.getState().runtime).not.toBeNull();

      // Reset to Starter
      useAppStore.getState().resetActivityToStarter();

      const afterReset = useAppStore.getState();
      expect(afterReset.workspace.MAIN.map((b) => b.type)).toEqual(expectedStarterTypes);
      expect(afterReset.runtime).toBeNull();
      expect(afterReset.grid.robot.x).toBe(afterReset.grid.robot.initialX);
      expect(afterReset.grid.robot.y).toBe(afterReset.grid.robot.initialY);
      expect(afterReset.canUndo).toBe(true);
      expect(afterReset.statusAnnouncement).toContain(
        `Reset Activity ${candidate.id} to starter blocks`
      );
      expect(getLessonAutosave('default', candidate.id)?.workspace.MAIN.map((b) => b.type)).toEqual(
        expectedStarterTypes
      );

      // Clicking Undo cleanly restores the user's 3 blocks and updates auto-save!
      useAppStore.getState().undo();
      const afterUndo = useAppStore.getState();
      expect(afterUndo.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
        'MOVE_FWD',
      ]);
      expect(getLessonAutosave('default', candidate.id)?.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
        'MOVE_FWD',
      ]);

      // Clicking Redo re-applies Reset to Starter
      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(expectedStarterTypes);
    });

    it('restores non-empty starterWorkspace with fresh block IDs and supports Undo back to user edits', () => {
      const targetAct = CURRICULUM_ACTIVITIES[0];
      const originalStarter = targetAct.starterWorkspace;

      try {
        targetAct.starterWorkspace = {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'starter_1'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'starter_2'),
          ],
          F1: [],
          F2: [],
          F3: [],
        };

        // Reload clean curriculum state so starterWorkspace loads initially
        resetAllProfileDataForTests();
        const store = useAppStore.getState();
        store.setAppMode('curriculum');
        useAppStore.setState({ curriculumWorkspaces: {} });
        store.setCurriculumActivity(targetAct.id);

        expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
          'MOVE_FWD',
          'MOVE_FWD',
        ]);

        // User modifies workspace (removes a block and adds TURN_RIGHT + MOVE_BACK)
        store.clearWorkspace();
        store.addBlock('MAIN', 'TURN_RIGHT');
        expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['TURN_RIGHT']);

        // Trigger Reset to Starter -> restores the 2 starter MOVE_FWD blocks!
        store.resetActivityToStarter();
        expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
          'MOVE_FWD',
          'MOVE_FWD',
        ]);
        expect(useAppStore.getState().canUndo).toBe(true);

        // Undo restores user's ['TURN_RIGHT'] workspace!
        store.undo();
        expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['TURN_RIGHT']);
      } finally {
        targetAct.starterWorkspace = originalStarter;
      }
    });
  });

  describe('UI Components: ProfileSwitcherModal, Toolbar & MobileDrawerMenu', () => {
    it('renders accessible avatar cards, color-blind shape cues, profile switcher buttons, and Reset-to-Starter controls', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };

      try {
        const store = useAppStore.getState();
        const panda = store.createAndSwitchProfile({
          avatarId: 'panda',
          colorId: 'rose',
          name: 'Zoe',
        });
        store.setAppMode('curriculum');
        store.setCurriculumActivity(CURRICULUM_ACTIVITIES[0].id);
        store.setProfileModalOpen(true);

        // Sync Zustand v5 server-snapshot object for React SSR renderToStaticMarkup
        Object.assign(initialRef, useAppStore.getState());

        const modalMarkup = renderToStaticMarkup(React.createElement(ProfileSwitcherModal));
        expect(modalMarkup).toContain('role="dialog"');
        expect(modalMarkup).toContain('aria-modal="true"');
        expect(modalMarkup).toContain('data-testid="profile-switcher-modal"');
        expect(modalMarkup).toContain('data-testid="profile-card-default"');
        expect(modalMarkup).toContain(`data-testid="profile-card-${panda.id}"`);
        expect(modalMarkup).toContain('Zoe');
        expect(modalMarkup).toContain('🐼');
        expect(modalMarkup).toContain('★'); // Rose Star shape cue

        // Default profile cannot be deleted; secondary profile has a non-nested delete button
        expect(modalMarkup).not.toContain('data-testid="btn-delete-profile-default"');
        expect(modalMarkup).toContain(`data-testid="btn-delete-profile-${panda.id}"`);
        expect(modalMarkup).toContain('data-testid="btn-show-create-profile"');

        // Toolbar in Curriculum mode renders profile switcher, lesson picker, and aria-live announcer
        const toolbarMarkup = renderToStaticMarkup(React.createElement(Toolbar));
        expect(toolbarMarkup).toContain('data-testid="btn-profile-switcher"');
        expect(toolbarMarkup).toContain('data-testid="btn-lesson-picker"');
        expect(toolbarMarkup).toContain('data-testid="mode-status-announcer"');
        expect(toolbarMarkup).toContain('aria-live="polite"');

        // MobileDrawerMenu in Curriculum mode renders mobile profile switcher and Reset to Starter
        store.setMobileMenuOpen(true);
        Object.assign(initialRef, useAppStore.getState());
        const drawerMarkup = renderToStaticMarkup(React.createElement(MobileDrawerMenu));
        expect(drawerMarkup).toContain('data-testid="drawer-btn-profile-switcher"');
        expect(drawerMarkup).toContain('data-testid="drawer-btn-reset-to-starter"');

        // Verify LESSON_AUTOSAVE_STORAGE_KEY is populated cleanly
        store.addBlock('MAIN', 'MOVE_FWD');
        expect(getStorageItem(LESSON_AUTOSAVE_STORAGE_KEY)).not.toBeNull();
      } finally {
        Object.assign(initialRef, backupInitial);
      }
    });
  });
});
