import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import { CURRICULUM_ACTIVITIES, CurriculumActivity } from '../src/data/curriculum';
import {
  exportProfileBackupToJson,
  exportProfileBackupToQrBytes,
  getProfileProgress,
  importProfileBackup,
  markLessonCompleted,
  resetAllProfileDataForTests,
  setUnlockAllModules,
} from '../src/services/profileService';
import { clearAllSavedPrograms } from '../src/services/localSaveService';
import {
  LessonPickerModal,
  getActivityFormatCues,
  getNextGridFocusIndex,
  isCurriculumModuleUnlocked,
  isDevQueryEnabled,
} from '../src/components/LessonPickerModal';
import { CurriculumBrowserModal } from '../src/components/CurriculumBrowserModal';
import { CelebrationOverlay } from '../src/components/CelebrationOverlay';
import { VictoryCelebrationModal } from '../src/components/VictoryCelebrationModal';
import { BadgeCollectionModal } from '../src/components/BadgeCollectionModal';
import { MobileDrawerMenu } from '../src/components/MobileDrawerMenu';
import { beatSynth } from '../src/simulations/beat/beatSynth';
import {
  playCelebrationAudio,
  playGrandBadgeFanfare,
  playStandardVictoryJingle,
} from '../src/services/celebrationAudio';

function resetEverything() {
  clearAllSavedPrograms();
  resetAllProfileDataForTests();
  beatSynth.setMuted(false);

  const s = useAppStore.getState();
  s.pause();
  s.setAppMode('sandbox');
  s.setSimEnvironment('grid');
  s.setLevel(1);
  s.setSpeed(400);
  s.setLessonPickerOpen(false);
  s.setBadgeModalOpen(false);
  s.dismissVictoryModal();
  s.setProfileModalOpen(false);
  s.setMobileMenuOpen(false);
  s.reloadActiveProfileState();
  useAppStore.setState({
    statusAnnouncement: '',
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    isVictoryModalOpen: false,
    isBadgeModalOpen: false,
    victoryEarnedBadges: [],
  });
}

function createSyntheticModuleActivities(): CurriculumActivity[] {
  const synth1A: CurriculumActivity = {
    id: '1A',
    version: 1,
    moduleId: 'module-1',
    title: 'Robot Treasure Trail',
    shortDescription: 'Capstone puzzle 1A',
    icon: '🏆',
    simId: 'grid',
    format: 'capstone',
    capstoneType: 'puzzle',
    allowedBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
    starterBlocks: [],
    simConfig: {
      width: 4,
      height: 4,
      start: { x: 0, y: 0, dir: 1 },
      goal: { x: 1, y: 0 },
      walls: [],
      coins: [],
      keys: [],
      doors: [],
    },
    referenceSolution: [{ id: 'sol-1a', type: 'MOVE_FWD' }],
    variationCards: ['Try turning right first!'],
  };

  const synth2_1: CurriculumActivity = {
    id: '2.1',
    version: 1,
    moduleId: 'module-2',
    title: 'Loop March',
    shortDescription: 'Repeat forward steps',
    icon: '🔁',
    simId: 'grid',
    format: 'activity',
    allowedBlocks: ['MOVE_FWD', 'REPEAT'],
    starterBlocks: [],
    simConfig: {
      width: 5,
      height: 5,
      start: { x: 0, y: 0, dir: 1 },
      goal: { x: 3, y: 0 },
      walls: [],
      coins: [],
      keys: [],
      doors: [],
    },
  };

  const synth2A: CurriculumActivity = {
    id: '2A',
    version: 1,
    moduleId: 'module-2',
    title: 'Loop Mandalas',
    shortDescription: 'Module 2 Capstone',
    icon: '🎨',
    simId: 'turtle',
    format: 'capstone',
    capstoneType: 'creative',
    allowedBlocks: ['MOVE_FWD', 'TURN_RIGHT', 'REPEAT'],
    starterBlocks: [],
    simConfig: {
      start: { x: 0, y: 0, dir: 0 },
    },
  };

  const synth3_1: CurriculumActivity = {
    id: '3.1',
    version: 1,
    moduleId: 'module-3',
    title: 'Chorus Builder',
    shortDescription: 'Call P1 subroutine',
    icon: '🧩',
    simId: 'beat',
    format: 'activity',
    allowedBlocks: ['CALL_P1'],
    starterBlocks: [],
    simConfig: {},
  };

  return [synth1A, synth2_1, synth2A, synth3_1];
}

describe('Commit 12: Hierarchical Curriculum Browser, Victory Celebrations & Collectible Module Badges', () => {
  beforeEach(() => {
    resetEverything();
  });

  describe('Re-exports & MobileDrawerMenu integration', () => {
    it('exports CurriculumBrowserModal and CelebrationOverlay cleanly and renders drawer-btn-badges without disturbing profile switcher', () => {
      expect(CurriculumBrowserModal).toBe(LessonPickerModal);
      expect(CelebrationOverlay).toBe(VictoryCelebrationModal);

      useAppStore.getState().setMobileMenuOpen(true);
      const drawerHtml = renderToStaticMarkup(React.createElement(MobileDrawerMenu));
      expect(drawerHtml).toContain('data-testid="drawer-btn-profile-switcher"');
      expect(drawerHtml).toContain('data-testid="drawer-btn-badges"');
    });
  });

  describe('Sequential Module Unlock, Unlock All Toggle & Format Cues', () => {
    it('keeps Module 1 unlocked initially, locks populated Module 2 & 3 until unlocked or Unlock All is toggled per profile', () => {
      const snapshot = [...CURRICULUM_ACTIVITIES];
      try {
        // Inject synthetic M2/M3 activities (and 1A if not yet registered) for multi-module browser verification
        for (const synth of createSyntheticModuleActivities()) {
          if (!CURRICULUM_ACTIVITIES.some((a) => a.id === synth.id)) {
            CURRICULUM_ACTIVITIES.push(synth);
          }
        }

        const store = useAppStore.getState();
        store.setAppMode('curriculum');
        store.setLessonPickerOpen(true);

        const initialProgress = getProfileProgress(store.activeProfileId);
        expect(isCurriculumModuleUnlocked('module-1', initialProgress, '')).toBe(true);
        expect(isCurriculumModuleUnlocked('module-2', initialProgress, '')).toBe(false);
        expect(isCurriculumModuleUnlocked('module-3', initialProgress, '')).toBe(false);

        // ?dev=1 query string unlocks modules non-destructively
        expect(isDevQueryEnabled('?dev=1')).toBe(true);
        expect(isDevQueryEnabled('?dev=true')).toBe(true);
        expect(isDevQueryEnabled('?dev=0')).toBe(false);
        expect(isCurriculumModuleUnlocked('module-2', initialProgress, '?dev=1')).toBe(true);

        const htmlLocked = renderToStaticMarkup(React.createElement(LessonPickerModal));
        expect(htmlLocked).toContain('data-testid="btn-open-badges"');
        expect(htmlLocked).toContain('data-testid="btn-toggle-unlock-all"');
        expect(htmlLocked).toContain('aria-pressed="false"');

        // Module 1 unlocked; Module 2 & Module 3 locked
        expect(htmlLocked).toContain('data-testid="module-section-module-1" data-unlocked="true"');
        expect(htmlLocked).toContain('data-testid="module-section-module-2" data-unlocked="false"');
        expect(htmlLocked).toContain('data-testid="module-section-module-3" data-unlocked="false"');
        expect(htmlLocked).toContain('data-testid="module-locked-module-2"');
        expect(htmlLocked).toContain('data-testid="module-locked-module-3"');

        // Locked module activity buttons carry disabled + aria-disabled="true"
        const m2CardMatch = htmlLocked.match(/<button[^>]*data-testid="btn-activity-2\.1"[^>]*>/);
        expect(m2CardMatch).not.toBeNull();
        expect(m2CardMatch![0]).toContain('disabled=""');
        expect(m2CardMatch![0]).toContain('aria-disabled="true"');

        // Unlocked Module 1 activity buttons are enabled
        const m1CardMatch = htmlLocked.match(/<button[^>]*data-testid="btn-activity-1\.1"[^>]*>/);
        expect(m1CardMatch).not.toBeNull();
        expect(m1CardMatch![0]).not.toContain('disabled=""');

        // Format badge cues (`📖`, `🤖`, `🐢`, `🎵`, `🏆`, `🎨`)
        expect(htmlLocked).toContain('data-testid="format-badge-1.0"');
        expect(htmlLocked).toContain('📖');
        expect(htmlLocked).toContain('🤖');
        expect(htmlLocked).toContain('🐢');
        expect(htmlLocked).toContain('🎵');
        expect(htmlLocked).toContain('🏆');
        expect(htmlLocked).toContain('🎨');

        // Toggle Unlock All -> unlocks Module 2 & Module 3 immediately and persists per profile
        store.toggleUnlockAllModules();
        expect(useAppStore.getState().unlockAllModules).toBe(true);
        expect(getProfileProgress(store.activeProfileId).unlockAllModules).toBe(true);

        const htmlUnlocked = renderToStaticMarkup(React.createElement(LessonPickerModal));
        expect(htmlUnlocked).toContain('data-testid="module-section-module-2" data-unlocked="true"');
        expect(htmlUnlocked).toContain('data-testid="module-section-module-3" data-unlocked="true"');
        expect(htmlUnlocked).not.toContain('data-testid="module-locked-module-2"');
        expect(htmlUnlocked).not.toContain('data-testid="module-locked-module-3"');

        const m2UnlockedMatch = htmlUnlocked.match(
          /<button[^>]*data-testid="btn-activity-2\.1"[^>]*>/
        );
        expect(m2UnlockedMatch).not.toBeNull();
        expect(m2UnlockedMatch![0]).not.toContain('disabled=""');

        // Switching to a newly created profile isolates unlockAllModules (defaults back to false)
        const player1Id = useAppStore.getState().activeProfileId;
        const player2 = useAppStore.getState().createAndSwitchProfile({
          name: 'Ada',
          avatarId: 'turtle',
          colorId: 'emerald',
        });
        expect(useAppStore.getState().activeProfileId).toBe(player2.id);
        expect(useAppStore.getState().unlockAllModules).toBe(false);
        expect(getProfileProgress(player2.id).unlockAllModules).toBe(false);

        // Switching back to Player 1 restores unlockAllModules === true
        useAppStore.getState().switchProfile(player1Id);
        expect(useAppStore.getState().unlockAllModules).toBe(true);
      } finally {
        CURRICULUM_ACTIVITIES.length = 0;
        CURRICULUM_ACTIVITIES.push(...snapshot);
      }
    });

    it('computes 2D keyboard arrow-key grid navigation indices cleanly and resolves format cues', () => {
      expect(getNextGridFocusIndex(0, 8, 'ArrowRight', 4)).toBe(1);
      expect(getNextGridFocusIndex(0, 8, 'ArrowLeft', 4)).toBe(7);
      expect(getNextGridFocusIndex(1, 8, 'ArrowDown', 4)).toBe(5);
      expect(getNextGridFocusIndex(5, 8, 'ArrowDown', 4)).toBe(1);
      expect(getNextGridFocusIndex(5, 8, 'ArrowUp', 4)).toBe(1);
      expect(getNextGridFocusIndex(1, 7, 'ArrowUp', 4)).toBe(5);
      expect(getNextGridFocusIndex(3, 7, 'ArrowUp', 4)).toBe(3); // wraps cleanly when last row has 3 items
      expect(getNextGridFocusIndex(4, 8, 'Home', 4)).toBe(0);
      expect(getNextGridFocusIndex(4, 8, 'End', 4)).toBe(7);
      expect(getNextGridFocusIndex(0, 8, 'Enter', 4)).toBeNull();

      const demoAct = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.0')!;
      expect(getActivityFormatCues(demoAct)).toEqual({ formatIcon: '📖', worldIcon: '🤖' });

      const robotAct = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.3')!;
      expect(getActivityFormatCues(robotAct)).toEqual({ formatIcon: '🤖', worldIcon: '🤖' });

      const turtleAct = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.6')!;
      expect(getActivityFormatCues(turtleAct)).toEqual({ formatIcon: '🐢', worldIcon: '🐢' });

      const beatCapstone = CURRICULUM_ACTIVITIES.find((a) => a.id === '1C')!;
      expect(getActivityFormatCues(beatCapstone)).toEqual({ formatIcon: '🎨', worldIcon: '🎵' });
    });
  });

  describe('Module Mastery Badge Ceremony, Sequential Unlock & Celebration Audio', () => {
    it('awards badge-module-1 upon completing 1A + 1B + 1C, unlocks module-2, and renders grand badge ceremony + polite announcement', () => {
      const snapshot = [...CURRICULUM_ACTIVITIES];
      const fanfareSpy = vi.spyOn(beatSynth, 'playVictoryFanfare');
      try {
        for (const synth of createSyntheticModuleActivities()) {
          if (!CURRICULUM_ACTIVITIES.some((a) => a.id === synth.id)) {
            CURRICULUM_ACTIVITIES.push(synth);
          }
        }

        const store = useAppStore.getState();
        const profileId = store.activeProfileId;

        // Pre-complete 1A and 1B -> badge not earned yet, module-2 still locked
        const res1A = markLessonCompleted(profileId, '1A', 1);
        expect(res1A.newlyEarnedBadges).toEqual([]);
        const res1B = markLessonCompleted(profileId, '1B', 1);
        expect(res1B.newlyEarnedBadges).toEqual([]);
        expect(getProfileProgress(profileId).unlockedModules).toEqual(['module-1']);

        store.reloadActiveProfileState();
        store.setAppMode('curriculum');
        store.setCurriculumActivity('1C');
        store.addBlock('MAIN', 'BEAT_KICK');

        fanfareSpy.mockClear();

        // Completing 1C finishes all Module 1 capstones (1A, 1B, 1C)!
        useAppStore.getState().completeCreativeActivity();

        const updatedProgress = getProfileProgress(profileId);
        expect(updatedProgress.earnedBadges).toContain('badge-module-1');
        expect(updatedProgress.unlockedModules).toContain('module-2');

        const liveState = useAppStore.getState();
        expect(liveState.isVictoryModalOpen).toBe(true);
        expect(liveState.victoryEarnedBadges).toEqual(['badge-module-1']);
        expect(liveState.statusAnnouncement).toContain('Sequence Navigator');
        expect(fanfareSpy).toHaveBeenCalledWith(true);

        const victoryHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
        expect(victoryHtml).toContain('data-testid="victory-modal"');
        expect(victoryHtml).toContain('data-ceremony="badge"');
        expect(victoryHtml).toContain('data-testid="victory-earned-badge"');
        expect(victoryHtml).toContain('Sequence Navigator');
        expect(victoryHtml).toContain('data-testid="victory-live-announcement"');
        expect(victoryHtml).toContain('aria-live="polite"');

        // LessonPickerModal now shows module-badge-module-1 earned and module-2 unlocked automatically!
        useAppStore.getState().dismissVictoryModal();
        useAppStore.getState().setLessonPickerOpen(true);
        const pickerHtml = renderToStaticMarkup(React.createElement(LessonPickerModal));
        expect(pickerHtml).toContain('data-testid="module-badge-module-1" data-earned="true"');
        expect(pickerHtml).toContain('data-testid="module-section-module-2" data-unlocked="true"');
      } finally {
        fanfareSpy.mockRestore();
        CURRICULUM_ACTIVITIES.length = 0;
        CURRICULUM_ACTIVITIES.push(...snapshot);
      }
    });

    it('plays standard vs grand fanfares when unmuted and suppresses audio when muted or in instant mode', () => {
      const fanfareSpy = vi.spyOn(beatSynth, 'playVictoryFanfare');
      try {
        beatSynth.setMuted(false);
        expect(playStandardVictoryJingle({ speed: 400 })).toBe(true);
        expect(fanfareSpy).toHaveBeenLastCalledWith(false);

        expect(playGrandBadgeFanfare({ speed: 400 })).toBe(true);
        expect(fanfareSpy).toHaveBeenLastCalledWith(true);

        // Suppressed in instant mode
        fanfareSpy.mockClear();
        expect(playCelebrationAudio(false, { speed: 'instant' })).toBe(false);
        expect(playCelebrationAudio(true, { speed: 0 })).toBe(false);
        expect(fanfareSpy).not.toHaveBeenCalled();

        // Suppressed when muted
        beatSynth.setMuted(true);
        expect(playStandardVictoryJingle({ speed: 400 })).toBe(false);
        expect(playGrandBadgeFanfare({ speed: 400 })).toBe(false);
        expect(fanfareSpy).not.toHaveBeenCalled();
      } finally {
        beatSynth.setMuted(false);
        fanfareSpy.mockRestore();
      }
    });
  });

  describe('BadgeCollectionModal Showcase', () => {
    it('renders earned vs locked badges across M1-M3 and capstone completion chips accurately', () => {
      const snapshot = [...CURRICULUM_ACTIVITIES];
      try {
        for (const synth of createSyntheticModuleActivities()) {
          if (!CURRICULUM_ACTIVITIES.some((a) => a.id === synth.id)) {
            CURRICULUM_ACTIVITIES.push(synth);
          }
        }

        // Closed by default
        expect(renderToStaticMarkup(React.createElement(BadgeCollectionModal))).toBe('');

        const profileId = useAppStore.getState().activeProfileId;
        markLessonCompleted(profileId, '1A', 1);
        markLessonCompleted(profileId, '1B', 1);
        markLessonCompleted(profileId, '1C', 1);
        useAppStore.getState().reloadActiveProfileState();
        useAppStore.getState().setBadgeModalOpen(true);

        const html = renderToStaticMarkup(React.createElement(BadgeCollectionModal));
        expect(html).toContain('data-testid="badge-collection-modal"');
        expect(html).toContain('data-testid="badge-collection-count"');
        expect(html).toContain('1/3');

        // M1 earned; M2 and M3 unearned
        expect(html).toContain(
          'data-testid="badge-card-module-1" data-badge-id="badge-module-1" data-earned="true"'
        );
        expect(html).toContain(
          'data-testid="badge-card-module-2" data-badge-id="badge-module-2" data-earned="false"'
        );
        expect(html).toContain(
          'data-testid="badge-card-module-3" data-badge-id="badge-module-3" data-earned="false"'
        );

        expect(html).toContain('Sequence Navigator');
        expect(html).toContain('Parameter &amp; Gadget Crafter');
        expect(html).toContain('Loop Architect');

        // Capstone chips show completion status (`1A`..`1C` completed; `2A` uncompleted but enabled because M2 unlocked; `3A` disabled because M3 locked)
        expect(html).toContain('data-testid="badge-capstone-chip-1A" data-completed="true"');
        expect(html).toContain('data-testid="badge-capstone-chip-1B" data-completed="true"');
        expect(html).toContain('data-testid="badge-capstone-chip-1C" data-completed="true"');
        expect(html).toContain('data-testid="badge-capstone-chip-2A" data-completed="false"');

        const chip2AMatch = html.match(
          /<button[^>]*data-testid="badge-capstone-chip-2A"[^>]*>/
        );
        expect(chip2AMatch).not.toBeNull();
        expect(chip2AMatch![0]).not.toContain('disabled=""');

        const chip3AMatch = html.match(
          /<button[^>]*data-testid="badge-capstone-chip-3A"[^>]*>/
        );
        expect(chip3AMatch).not.toBeNull();
        expect(chip3AMatch![0]).toContain('disabled=""');
      } finally {
        CURRICULUM_ACTIVITIES.length = 0;
        CURRICULUM_ACTIVITIES.push(...snapshot);
      }
    });
  });

  describe('Whole-Profile JSON & QR Backup Round-Trip for Badges & unlockAllModules', () => {
    it('preserves earnedBadges, unlockedModules, and unlockAllModules across JSON and QR export/import (new and replace)', () => {
      const store = useAppStore.getState();
      const sourceProfileId = store.activeProfileId;

      markLessonCompleted(sourceProfileId, '1A', 1);
      markLessonCompleted(sourceProfileId, '1B', 1);
      markLessonCompleted(sourceProfileId, '1C', 1);
      setUnlockAllModules(sourceProfileId, true);

      const sourceProgress = getProfileProgress(sourceProfileId);
      expect(sourceProgress.earnedBadges).toEqual(['badge-module-1']);
      expect(sourceProgress.unlockedModules).toContain('module-2');
      expect(sourceProgress.unlockAllModules).toBe(true);

      // 1) JSON round-trip as 'new' profile
      const jsonBackup = exportProfileBackupToJson(sourceProfileId);
      const importedFromJson = importProfileBackup(jsonBackup, 'new');
      expect(importedFromJson.success).toBe(true);
      if (!importedFromJson.success) throw new Error(importedFromJson.error);
      const jsonProgress = getProfileProgress(importedFromJson.profile.id);
      expect(jsonProgress.earnedBadges).toEqual(['badge-module-1']);
      expect(jsonProgress.unlockedModules).toContain('module-2');
      expect(jsonProgress.unlockAllModules).toBe(true);

      // 2) Compressed QR bytes round-trip via store importUserProfileBackup in 'replace' mode
      const qrBytes = exportProfileBackupToQrBytes(sourceProfileId);
      const freshTarget = useAppStore.getState().createAndSwitchProfile({
        name: 'Fresh Learner',
        avatarId: 'rocket',
        colorId: 'violet',
      });
      expect(useAppStore.getState().activeProfileId).toBe(freshTarget.id);
      expect(useAppStore.getState().unlockAllModules).toBe(false);
      expect(getProfileProgress(freshTarget.id).earnedBadges).toEqual([]);

      const replaced = useAppStore.getState().importUserProfileBackup(qrBytes, 'replace');
      expect(replaced.success).toBe(true);
      expect(replaced.profile?.id).toBe(freshTarget.id);
      expect(useAppStore.getState().unlockAllModules).toBe(true);

      const qrProgress = getProfileProgress(replaced.profile!.id);
      expect(qrProgress.earnedBadges).toEqual(['badge-module-1']);
      expect(qrProgress.unlockedModules).toContain('module-2');
      expect(qrProgress.unlockAllModules).toBe(true);
    });
  });
});
