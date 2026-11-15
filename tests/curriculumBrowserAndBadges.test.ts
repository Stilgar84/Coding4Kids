import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import { CURRICULUM_ACTIVITIES } from '../src/data/curriculum';
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
    it('keeps seq unlocked initially, locks param/loop/func until unlocked or Unlock All is toggled per profile', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setLessonPickerOpen(true);

      const initialProgress = getProfileProgress(store.activeProfileId);
      expect(isCurriculumModuleUnlocked('seq', initialProgress, '')).toBe(true);
      expect(isCurriculumModuleUnlocked('param', initialProgress, '')).toBe(false);
      expect(isCurriculumModuleUnlocked('loop', initialProgress, '')).toBe(false);
      expect(isCurriculumModuleUnlocked('func', initialProgress, '')).toBe(false);

      // ?dev=1 query string unlocks modules non-destructively
      expect(isDevQueryEnabled('?dev=1')).toBe(true);
      expect(isDevQueryEnabled('?dev=true')).toBe(true);
      expect(isDevQueryEnabled('?dev=0')).toBe(false);
      expect(isCurriculumModuleUnlocked('param', initialProgress, '?dev=1')).toBe(true);

      const htmlLocked = renderToStaticMarkup(React.createElement(LessonPickerModal));
      expect(htmlLocked).toContain('data-testid="btn-open-badges"');
      expect(htmlLocked).toContain('data-testid="btn-toggle-unlock-all"');
      expect(htmlLocked).toContain('aria-pressed="false"');

      // seq unlocked; param & loop locked
      expect(htmlLocked).toContain('data-testid="module-section-seq" data-unlocked="true"');
      expect(htmlLocked).toContain('data-testid="module-section-param" data-unlocked="false"');
      expect(htmlLocked).toContain('data-testid="module-section-loop" data-unlocked="false"');
      expect(htmlLocked).toContain('data-testid="module-locked-param"');
      expect(htmlLocked).toContain('data-testid="module-locked-loop"');

      // Locked module activity buttons carry disabled + aria-disabled="true"
      const paramCardMatch = htmlLocked.match(/<button[^>]*data-testid="btn-activity-param\.1"[^>]*>/);
      expect(paramCardMatch).not.toBeNull();
      expect(paramCardMatch![0]).toContain('disabled=""');
      expect(paramCardMatch![0]).toContain('aria-disabled="true"');

      // Unlocked seq activity buttons are enabled
      const seqCardMatch = htmlLocked.match(/<button[^>]*data-testid="btn-activity-seq\.1"[^>]*>/);
      expect(seqCardMatch).not.toBeNull();
      expect(seqCardMatch![0]).not.toContain('disabled=""');

      // Format badge cues (`📖`, `🤖`, `🐢`, `🎵`, `🏆`, `🎨`)
      expect(htmlLocked).toContain('data-testid="format-badge-seq.0"');
      expect(htmlLocked).toContain('📖');
      expect(htmlLocked).toContain('🤖');
      expect(htmlLocked).toContain('🐢');
      expect(htmlLocked).toContain('🎵');
      expect(htmlLocked).toContain('🏆');
      expect(htmlLocked).toContain('🎨');

      // Toggle Unlock All -> unlocks param & loop immediately and persists per profile
      store.toggleUnlockAllModules();
      expect(useAppStore.getState().unlockAllModules).toBe(true);
      expect(getProfileProgress(store.activeProfileId).unlockAllModules).toBe(true);

      const htmlUnlocked = renderToStaticMarkup(React.createElement(LessonPickerModal));
      expect(htmlUnlocked).toContain('data-testid="module-section-param" data-unlocked="true"');
      expect(htmlUnlocked).toContain('data-testid="module-section-loop" data-unlocked="true"');
      expect(htmlUnlocked).not.toContain('data-testid="module-locked-param"');
      expect(htmlUnlocked).not.toContain('data-testid="module-locked-loop"');

      const paramUnlockedMatch = htmlUnlocked.match(
        /<button[^>]*data-testid="btn-activity-param\.1"[^>]*>/
      );
      expect(paramUnlockedMatch).not.toBeNull();
      expect(paramUnlockedMatch![0]).not.toContain('disabled=""');

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

      const demoAct = CURRICULUM_ACTIVITIES.find((a) => a.id === 'seq.0')!;
      expect(getActivityFormatCues(demoAct)).toEqual({ formatIcon: '📖', worldIcon: '🤖' });

      const robotAct = CURRICULUM_ACTIVITIES.find((a) => a.id === 'seq.3')!;
      expect(getActivityFormatCues(robotAct)).toEqual({ formatIcon: '🤖', worldIcon: '🤖' });

      const turtleAct = CURRICULUM_ACTIVITIES.find((a) => a.id === 'seq.6')!;
      expect(getActivityFormatCues(turtleAct)).toEqual({ formatIcon: '🐢', worldIcon: '🐢' });

      const beatCapstone = CURRICULUM_ACTIVITIES.find((a) => a.id === 'seq.C')!;
      expect(getActivityFormatCues(beatCapstone)).toEqual({ formatIcon: '🎨', worldIcon: '🎵' });
    });
  });

  describe('Module Mastery Badge Ceremony, Sequential Unlock & Celebration Audio', () => {
    it('awards badge-seq upon completing seq.A + seq.B + seq.C, unlocks param, and renders grand badge ceremony + polite announcement', () => {
      const fanfareSpy = vi.spyOn(beatSynth, 'playVictoryFanfare');
      try {
        const store = useAppStore.getState();
        const profileId = store.activeProfileId;

        // Pre-complete seq.A and seq.B -> badge not earned yet, param still locked
        const resA = markLessonCompleted(profileId, 'seq.A', 1);
        expect(resA.newlyEarnedBadges).toEqual([]);
        const resB = markLessonCompleted(profileId, 'seq.B', 1);
        expect(resB.newlyEarnedBadges).toEqual([]);
        expect(getProfileProgress(profileId).unlockedModules).toEqual(['seq']);

        store.reloadActiveProfileState();
        store.setAppMode('curriculum');
        store.setCurriculumActivity('seq.C');
        store.addBlock('MAIN', 'DRUM_KICK');

        fanfareSpy.mockClear();

        // Completing seq.C finishes all seq capstones (seq.A, seq.B, seq.C)!
        useAppStore.getState().completeCreativeActivity();

        const updatedProgress = getProfileProgress(profileId);
        expect(updatedProgress.earnedBadges).toContain('badge-seq');
        expect(updatedProgress.unlockedModules).toContain('param');

        const liveState = useAppStore.getState();
        expect(liveState.isVictoryModalOpen).toBe(true);
        expect(liveState.victoryEarnedBadges).toEqual(['badge-seq']);
        expect(liveState.statusAnnouncement).toContain('Sequence Navigator');
        expect(fanfareSpy).toHaveBeenCalledWith(true);

        const victoryHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
        expect(victoryHtml).toContain('data-testid="victory-modal"');
        expect(victoryHtml).toContain('data-ceremony="badge"');
        expect(victoryHtml).toContain('data-testid="victory-earned-badge"');
        expect(victoryHtml).toContain('Sequence Navigator');
        expect(victoryHtml).toContain('data-testid="victory-live-announcement"');
        expect(victoryHtml).toContain('aria-live="polite"');

        // LessonPickerModal now shows module-badge-seq earned and param unlocked automatically!
        useAppStore.getState().dismissVictoryModal();
        useAppStore.getState().setLessonPickerOpen(true);
        const pickerHtml = renderToStaticMarkup(React.createElement(LessonPickerModal));
        expect(pickerHtml).toContain('data-testid="module-badge-seq" data-earned="true"');
        expect(pickerHtml).toContain('data-testid="module-section-param" data-unlocked="true"');
      } finally {
        fanfareSpy.mockRestore();
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
    it('renders earned vs locked badges across seq/param/loop/func and capstone completion chips accurately', () => {
      // Closed by default
      expect(renderToStaticMarkup(React.createElement(BadgeCollectionModal))).toBe('');

      const profileId = useAppStore.getState().activeProfileId;
      markLessonCompleted(profileId, 'seq.A', 1);
      markLessonCompleted(profileId, 'seq.B', 1);
      markLessonCompleted(profileId, 'seq.C', 1);
      useAppStore.getState().reloadActiveProfileState();
      useAppStore.getState().setBadgeModalOpen(true);

      const html = renderToStaticMarkup(React.createElement(BadgeCollectionModal));
      expect(html).toContain('data-testid="badge-collection-modal"');
      expect(html).toContain('data-testid="badge-collection-count"');
      expect(html).toContain('1/4');

      // seq earned; param & loop unearned (func also shown locked)
      expect(html).toContain(
        'data-testid="badge-card-seq" data-badge-id="badge-seq" data-earned="true"'
      );
      expect(html).toContain(
        'data-testid="badge-card-param" data-badge-id="badge-param" data-earned="false"'
      );
      expect(html).toContain(
        'data-testid="badge-card-loop" data-badge-id="badge-loop" data-earned="false"'
      );

      expect(html).toContain('Sequence Navigator');
      expect(html).toContain('Parameter &amp; Gadget Crafter');
      expect(html).toContain('Loop Architect');

      // Capstone chips show completion status (`seq.A`..`seq.C` completed; `param.A` uncompleted but enabled because param unlocked; `loop.A` disabled because loop locked)
      expect(html).toContain('data-testid="badge-capstone-chip-seq.A" data-completed="true"');
      expect(html).toContain('data-testid="badge-capstone-chip-seq.B" data-completed="true"');
      expect(html).toContain('data-testid="badge-capstone-chip-seq.C" data-completed="true"');
      expect(html).toContain('data-testid="badge-capstone-chip-param.A" data-completed="false"');

      const chipParamAMatch = html.match(
        /<button[^>]*data-testid="badge-capstone-chip-param\.A"[^>]*>/
      );
      expect(chipParamAMatch).not.toBeNull();
      expect(chipParamAMatch![0]).not.toContain('disabled=""');

      const chipLoopAMatch = html.match(
        /<button[^>]*data-testid="badge-capstone-chip-loop\.A"[^>]*>/
      );
      expect(chipLoopAMatch).not.toBeNull();
      expect(chipLoopAMatch![0]).toContain('disabled=""');
    });
  });

  describe('Whole-Profile JSON & QR Backup Round-Trip for Badges & unlockAllModules', () => {
    it('preserves earnedBadges, unlockedModules, and unlockAllModules across JSON and QR export/import (new and replace)', () => {
      const store = useAppStore.getState();
      const sourceProfileId = store.activeProfileId;

      markLessonCompleted(sourceProfileId, 'seq.A', 1);
      markLessonCompleted(sourceProfileId, 'seq.B', 1);
      markLessonCompleted(sourceProfileId, 'seq.C', 1);
      setUnlockAllModules(sourceProfileId, true);

      const sourceProgress = getProfileProgress(sourceProfileId);
      expect(sourceProgress.earnedBadges).toEqual(['badge-seq']);
      expect(sourceProgress.unlockedModules).toContain('param');
      expect(sourceProgress.unlockAllModules).toBe(true);

      // 1) JSON round-trip as 'new' profile
      const jsonBackup = exportProfileBackupToJson(sourceProfileId);
      const importedFromJson = importProfileBackup(jsonBackup, 'new');
      expect(importedFromJson.success).toBe(true);
      if (!importedFromJson.success) throw new Error(importedFromJson.error);
      const jsonProgress = getProfileProgress(importedFromJson.profile.id);
      expect(jsonProgress.earnedBadges).toEqual(['badge-seq']);
      expect(jsonProgress.unlockedModules).toContain('param');
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
      expect(qrProgress.earnedBadges).toEqual(['badge-seq']);
      expect(qrProgress.unlockedModules).toContain('param');
      expect(qrProgress.unlockAllModules).toBe(true);
    });
  });
});
