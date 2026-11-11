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
import { CURRICULUM_ACTIVITIES, createCurriculumBlock } from '../src/data/curriculum';
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

      // Default profile: build a Sandbox Grid workspace first
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(getSandboxAutosave('default', 'grid')?.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
      ]);

      // Switch to Curriculum mode -> Activity 1.1
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.1');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Default profile edits Activity 1.1
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');

      const saved11Default = getLessonAutosave('default', '1.1');
      expect(saved11Default).not.toBeNull();
      expect(saved11Default?.lessonVersion).toBe(1);
      expect(saved11Default?.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'MOVE_FWD']);

      // Default profile switches to Activity 1.2 and adds different blocks
      store.setCurriculumActivity('1.2');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');

      // Switch back to 1.1 -> restores Default's 1.1 blocks
      store.setCurriculumActivity('1.1');
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

      // Leo sees a completely clean workspace on Activity 1.1 and 1.2!
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);
      store.setCurriculumActivity('1.2');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Leo places TURN_RIGHT on Activity 1.2
      store.addBlock('MAIN', 'TURN_RIGHT');
      expect(getLessonAutosave(leo.id, '1.2')?.workspace.MAIN.map((b) => b.type)).toEqual([
        'TURN_RIGHT',
      ]);

      // Simulate browser reload while Leo is active on 1.2:
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

      // Switch back to 'default' profile -> restores Default's 1.2 and 1.1 workspaces + Sandbox workspace!
      useAppStore.getState().switchProfile('default');
      expect(useAppStore.getState().activeProfileId).toBe('default');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
      ]);

      useAppStore.getState().setCurriculumActivity('1.1');
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
      expect(getLessonAutosave(leo.id, '1.2')).toBeNull();
      expect(getLessonAutosave('default', '1.1')?.workspace.MAIN).toHaveLength(2);
    });
  });

  describe('Curriculum Progress & Puzzle Completion Tracking (robotemu_curriculum_progress_v1)', () => {
    it('marks curriculum puzzles completed on SUCCESS (step & instant), unlocks next module, and isolates progress per profile', () => {
      const store = useAppStore.getState();

      // Solving a preset map in Sandbox mode does NOT record curriculum progress
      store.setAppMode('sandbox');
      store.setLevel(1);
      store.loadSolution(1);
      store.setSpeed('instant');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(Object.keys(getProfileProgress('default').completedLessons)).toHaveLength(0);

      // Switch to Curriculum mode Activity 1.1 and solve via step()
      store.setSpeed(400);
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.1');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');

      for (let i = 0; i < 6 && useAppStore.getState().grid.status !== 'SUCCESS'; i++) {
        useAppStore.getState().step();
      }

      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(isLessonCompleted('default', '1.1')).toBe(true);
      expect(useAppStore.getState().completedActivities['1.1']).toBe(true);

      const rawProg = JSON.parse(getStorageItem(CURRICULUM_PROGRESS_STORAGE_KEY)!);
      expect(rawProg.profiles.default.completedLessons['1.1'].version).toBe(1);

      // Solve Activity 1.2 in Instant mode -> also records completion!
      store.setCurriculumActivity('1.2');
      store.loadSolution();
      store.setSpeed('instant');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(isLessonCompleted('default', '1.2')).toBe(true);
      expect(useAppStore.getState().completedActivities['1.2']).toBe(true);

      // Solve Activity 1.3 and any remaining registered Module 1 activities -> unlocks 'module-2'
      store.setCurriculumActivity('1.3');
      store.loadSolution();
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(isLessonCompleted('default', '1.3')).toBe(true);

      const newlyEarnedFromM1: string[] = [];
      for (const act of CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === 'module-1')) {
        if (!isLessonCompleted('default', act.id)) {
          const r = markLessonCompleted('default', act.id, act.version);
          newlyEarnedFromM1.push(...r.newlyEarnedBadges);
        }
      }

      const defaultProgress = getProfileProgress('default');
      expect(defaultProgress.unlockedModules).toContain('module-1');
      expect(defaultProgress.unlockedModules).toContain('module-2');

      // Completing capstones 1A, 1B, 1C awards badge-module-1 exactly once
      const capResA = markLessonCompleted('default', '1A', 1);
      const capResB = markLessonCompleted('default', '1B', 1);
      const capResC = markLessonCompleted('default', '1C', 1);
      expect([
        ...newlyEarnedFromM1,
        ...capResA.newlyEarnedBadges,
        ...capResB.newlyEarnedBadges,
        ...capResC.newlyEarnedBadges,
      ]).toEqual(['badge-module-1']);
      expect(getProfileProgress('default').earnedBadges).toContain('badge-module-1');

      // Secondary profile starts with zero completed lessons and only module-1 unlocked
      const owl = store.createAndSwitchProfile({ avatarId: 'owl', colorId: 'violet' });
      expect(useAppStore.getState().completedActivities).toEqual({});
      expect(isLessonCompleted(owl.id, '1.1')).toBe(false);
      expect(getProfileProgress(owl.id).unlockedModules).toEqual(['module-1']);
      expect(getProfileProgress(owl.id).earnedBadges).toEqual([]);
    });
  });

  describe('Undo-Protected Reset to Starter (resetActivityToStarter)', () => {
    it('pushes prior blocks onto Undo history, resets to starterWorkspace (or empty), resets runtime, and restores blocks on undo()', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.2');

      // Build user blocks & step once so runtime & robot pose have advanced
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.step();
      expect(useAppStore.getState().runtime).not.toBeNull();

      // Reset to Starter (Activity 1.2 has no starterWorkspace -> resets to empty workspace)
      useAppStore.getState().resetActivityToStarter();

      const afterReset = useAppStore.getState();
      expect(afterReset.workspace.MAIN).toEqual([]);
      expect(afterReset.runtime).toBeNull();
      expect(afterReset.grid.robot.x).toBe(afterReset.grid.robot.initialX);
      expect(afterReset.grid.robot.y).toBe(afterReset.grid.robot.initialY);
      expect(afterReset.canUndo).toBe(true);
      expect(afterReset.statusAnnouncement).toContain('Reset Activity 1.2 to starter blocks');
      expect(getLessonAutosave('default', '1.2')?.workspace.MAIN).toEqual([]);

      // Clicking Undo cleanly restores the user's 3 blocks and updates auto-save!
      useAppStore.getState().undo();
      const afterUndo = useAppStore.getState();
      expect(afterUndo.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
        'MOVE_FWD',
      ]);
      expect(getLessonAutosave('default', '1.2')?.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
        'MOVE_FWD',
      ]);

      // Clicking Redo re-applies Reset to Starter
      useAppStore.getState().redo();
      expect(useAppStore.getState().workspace.MAIN).toEqual([]);
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
        store.setCurriculumActivity('1.1');
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
