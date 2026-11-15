import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import { CURRICULUM_ACTIVITIES } from '../src/data/curriculum';
import {
  getProfileProgress,
  isLessonCompleted,
  markLessonCompleted,
  resetAllProfileDataForTests,
} from '../src/services/profileService';
import { clearAllSavedPrograms } from '../src/services/localSaveService';
import { VictoryCelebrationModal } from '../src/components/VictoryCelebrationModal';
import { LessonPickerModal } from '../src/components/LessonPickerModal';
import { Toolbar } from '../src/components/Toolbar';
import { MobileDrawerMenu } from '../src/components/MobileDrawerMenu';
import { BlockPalette } from '../src/components/BlockPalette';
import { VariationCardsPanel } from '../src/components/VariationCardsPanel';
import { CurriculumNextLessonBar } from '../src/components/CurriculumNextLessonBar';

function resetEverything() {
  clearAllSavedPrograms();
  resetAllProfileDataForTests();

  const s = useAppStore.getState();
  s.pause();
  s.setAppMode('sandbox');
  s.setSimEnvironment('grid');
  s.setLevel(1);
  s.setSpeed(400);
  s.setLessonPickerOpen(false);
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
    victoryEarnedBadges: [],
  });
}

describe('Kid-Friendly UI Simplification, VictoryCelebrationModal & Creative Completion', () => {
  beforeEach(() => {
    resetEverything();
  });

  describe('VictoryCelebrationModal & Store Trigger/Spam Guards', () => {
    it('opens VictoryCelebrationModal synchronously on step() puzzle SUCCESS and dismisses without clearing SUCCESS status', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.1');

      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');

      // Non-instant speed: adding blocks does not auto-run
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      for (let i = 0; i < 6 && useAppStore.getState().grid.status !== 'SUCCESS'; i++) {
        useAppStore.getState().step();
      }

      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(true);

      // SSR render reflects live store state without getInitialState() sync hacks
      const html = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
      expect(html).toContain('data-testid="victory-modal"');
      expect(html).toContain('data-ceremony="standard"');
      expect(html).toContain('data-testid="btn-victory-next"');

      // Dismissing modal leaves grid.status === 'SUCCESS' untouched underneath!
      useAppStore.getState().dismissVictoryModal();
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(renderToStaticMarkup(React.createElement(VictoryCelebrationModal))).toBe('');
    });

    it('opens VictoryCelebrationModal on direct user block edit in instant mode, and NEVER on loadSolution, explanation, map edit, undo/redo, or switches', () => {
      const store = useAppStore.getState();

      // 1) loadSolution() in instant mode NEVER triggers VictoryCelebrationModal
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.1');
      store.setSpeed('instant');
      store.loadSolution();
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // 2) Switching activity resets isVictoryModalOpen and does not trigger on load
      store.setCurriculumActivity('seq.2');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // 3) Direct user block mutations in instant mode transitioning IDLE -> SUCCESS DO trigger!
      store.setCurriculumActivity('seq.1');
      store.resetActivityToStarter();
      expect(useAppStore.getState().grid.status).toBe('IDLE');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      store.addBlock('MAIN', 'MOVE_FWD'); // reaches goal!
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(true);

      // 4) Adding a 4th block while already at SUCCESS does NOT re-trigger after dismissal
      store.dismissVictoryModal();
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
      store.addBlock('MAIN', 'TURN_LEFT');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // 5) undo() & redo() NEVER trigger VictoryCelebrationModal and auto-close it if open
      useAppStore.setState({ isVictoryModalOpen: true });
      store.undo();
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
      store.undo(); // back to 2 blocks (not SUCCESS)
      expect(useAppStore.getState().grid.status).not.toBe('SUCCESS');
      store.redo(); // back to 3 blocks (SUCCESS via redo -> MUST NOT trigger!)
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // 6) Sandbox map edits in instant mode NEVER trigger VictoryCelebrationModal
      store.setAppMode('sandbox');
      store.setLevel(1);
      store.clearWorkspace();
      store.addBlock('MAIN', 'MOVE_FWD'); // reaches (1,2)
      expect(useAppStore.getState().grid.status).not.toBe('SUCCESS');
      // Place goal directly at (1,2) via map editor -> grid becomes SUCCESS, modal MUST stay closed
      store.setEditorTool('GOAL');
      store.setCellContent(1, 2);
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // 7) Lesson seq.0 (explanation) NEVER triggers VictoryCelebrationModal
      store.setSpeed(400);
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.0');
      for (let i = 0; i < 6; i++) {
        useAppStore.getState().step();
      }
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
    });

    it('upgrades VictoryCelebrationModal to Golden Trophy + Module Badge ceremony on Capstones and badge unlocks', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');

      // Mark all seq activities except seq.C completed first
      const seqActs = CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === 'seq');
      for (const act of seqActs) {
        if (act.id !== 'seq.C') {
          markLessonCompleted('default', act.id, act.version);
        }
      }
      store.reloadActiveProfileState();

      // Switch to Creative Capstone seq.C (Beat Maker) and verify VariationCardsPanel Done button
      store.setCurriculumActivity('seq.C');
      const varPanelHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(varPanelHtml).toContain('data-testid="btn-complete-creative-activity"');
      expect(varPanelHtml).not.toContain('data-testid="btn-variation-undo"');

      store.completeCreativeActivity(false);
      expect(isLessonCompleted('default', 'seq.C')).toBe(true);
      expect(getProfileProgress('default').earnedBadges).toContain('badge-seq');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(true);
      expect(useAppStore.getState().victoryEarnedBadges).toEqual(['badge-seq']);

      const ceremonyHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
      expect(ceremonyHtml).toContain('data-ceremony="badge"');
      expect(ceremonyHtml).toContain('🏅');
    });
  });

  describe('Creative Sandbox Completion (seq.6, seq.7, seq.8, seq.B, seq.C)', () => {
    it('marks Beat and Turtle creative sandbox activities completed when a Play run finishes cleanly', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');

      // 1) Beat creative sandbox seq.8 finishing a normal-speed Play run
      store.setCurriculumActivity('seq.8');
      expect(isLessonCompleted('default', 'seq.8')).toBe(false);
      useAppStore.setState({ isPlaying: true });
      for (let i = 0; i < 100 && useAppStore.getState().isPlaying; i++) {
        useAppStore.getState().step();
      }
      expect(isLessonCompleted('default', 'seq.8')).toBe(true);
      expect(useAppStore.getState().completedActivities['seq.8']).toBe(true);
      // Regular creative sandbox (not capstone, no new module badge yet) records ★ quietly without modal spam
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

      // 2) Turtle creative sandbox seq.6 via Play in instant mode
      store.setCurriculumActivity('seq.6');
      expect(isLessonCompleted('default', 'seq.6')).toBe(false);
      store.setSpeed('instant');
      store.play();
      expect(isLessonCompleted('default', 'seq.6')).toBe(true);
      expect(useAppStore.getState().completedActivities['seq.6']).toBe(true);
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
    });
  });

  describe('Unified Single-Row Toolbar, LessonPickerModal, MobileDrawerMenu & Smart Trash', () => {
    it('renders LessonPickerModal with seq progress counter, earned badge pill, and world/level switchers', () => {
      const store = useAppStore.getState();
      markLessonCompleted('default', 'seq.0', 1);
      markLessonCompleted('default', 'seq.1', 1);
      store.reloadActiveProfileState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.2');
      store.setLessonPickerOpen(true);

      const pickerHtml = renderToStaticMarkup(React.createElement(LessonPickerModal));
      expect(pickerHtml).toContain('data-testid="lesson-picker-modal"');
      expect(pickerHtml).toContain('data-testid="picker-mode-curriculum"');
      expect(pickerHtml).toContain('data-testid="picker-mode-sandbox"');
      expect(pickerHtml).toContain('data-testid="module-progress-seq"');
      expect(pickerHtml).toContain(
        `2/${CURRICULUM_ACTIVITIES.filter((a) => a.moduleId === 'seq').length}`
      );
      expect(pickerHtml).toContain('data-testid="btn-activity-seq.2"');

      // Switch LessonPickerModal to Sandbox view -> renders Grid/Turtle/Beat tabs and Preset Levels 1-3
      store.setAppMode('sandbox');
      const sandboxPickerHtml = renderToStaticMarkup(React.createElement(LessonPickerModal));
      expect(sandboxPickerHtml).toContain('data-testid="sim-tab-grid"');
      expect(sandboxPickerHtml).toContain('data-testid="sim-tab-turtle"');
      expect(sandboxPickerHtml).toContain('data-testid="sim-tab-beat"');
      expect(sandboxPickerHtml).toContain('data-testid="btn-level-1"');
      expect(sandboxPickerHtml).toContain('data-testid="btn-level-2"');
      expect(sandboxPickerHtml).toContain('data-testid="btn-level-3"');
    });

    it('renders unified smart btn-trash inline in BlockPalette and unified single-row Toolbar + MobileDrawerMenu', () => {
      const store = useAppStore.getState();
      store.setAppMode('sandbox');

      // Empty workspace -> btn-trash is disabled
      const emptyPaletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(emptyPaletteHtml).toContain('data-testid="btn-trash"');
      expect(emptyPaletteHtml).toMatch(/data-testid="btn-trash"[^>]*disabled/);
      expect(emptyPaletteHtml).not.toContain('data-testid="btn-palette-delete-block"');
      expect(emptyPaletteHtml).not.toContain('data-testid="btn-clear-workspace"');

      // Add block -> btn-trash becomes enabled and unarmed
      store.addBlock('MAIN', 'MOVE_FWD');
      const nonEmptyPaletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(nonEmptyPaletteHtml).toContain('data-armed="false"');
      expect(nonEmptyPaletteHtml).not.toMatch(/data-testid="btn-trash"[^>]*disabled/);

      // Single-row Toolbar contains flex-nowrap, btn-lesson-picker, btn-step, btn-speed, and no multi-row clutter
      const toolbarHtml = renderToStaticMarkup(React.createElement(Toolbar));
      expect(toolbarHtml).toContain('flex-nowrap');
      expect(toolbarHtml).toContain('data-testid="btn-lesson-picker"');
      expect(toolbarHtml).toContain('data-testid="btn-step"');
      expect(toolbarHtml).toContain('data-testid="btn-speed"');

      // Unified Menu Drawer contains Save/Open/Share, Player card, Mode switch, Sound, Redo, Fullscreen
      store.setMobileMenuOpen(true);
      const drawerHtml = renderToStaticMarkup(React.createElement(MobileDrawerMenu));
      expect(drawerHtml).toContain('data-testid="drawer-btn-save"');
      expect(drawerHtml).toContain('data-testid="drawer-btn-load"');
      expect(drawerHtml).toContain('data-testid="drawer-btn-share"');
      expect(drawerHtml).toContain('data-testid="drawer-btn-profile-switcher"');
      expect(drawerHtml).toContain('data-testid="drawer-btn-sound"');
      expect(drawerHtml).toContain('data-testid="drawer-btn-redo"');
    });
  });

  describe('Clear Next Lesson Progression for Open Lessons & Solved Exercises', () => {
    it('renders prominent Next CTA on open LOGO lesson seq.6 and advances on second click after creative capstone dismissal', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.6');

      const panelHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(panelHtml).toContain('data-testid="btn-complete-creative-activity"');
      expect(panelHtml).toContain('>Next<');

      const advancedFromLogo = store.completeCreativeActivity(true);
      expect(advancedFromLogo).toBe('seq.7');
      expect(useAppStore.getState().activeActivityId).toBe('seq.7');

      // Creative capstone seq.B: first completion opens VictoryCelebrationModal; second click after dismissal advances directly to seq.C
      useAppStore.getState().setCurriculumActivity('seq.B');
      useAppStore.getState().completeCreativeActivity(true);
      expect(useAppStore.getState().isVictoryModalOpen).toBe(true);
      expect(useAppStore.getState().activeActivityId).toBe('seq.B');

      useAppStore.getState().dismissVictoryModal();
      const nextAfterDismiss = useAppStore.getState().completeCreativeActivity(true);
      expect(nextAfterDismiss).toBe('seq.C');
      expect(useAppStore.getState().activeActivityId).toBe('seq.C');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
    });

    it('surfaces CurriculumNextLessonBar when a puzzle exercise is solved and hides when unsolved or in sandbox', () => {
      const store = useAppStore.getState();
      store.setAppMode('sandbox');
      expect(renderToStaticMarkup(React.createElement(CurriculumNextLessonBar))).toBe('');

      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.1');
      expect(renderToStaticMarkup(React.createElement(CurriculumNextLessonBar))).toBe('');

      // Solving via loadSolution (or dismissing VictoryCelebrationModal) surfaces Next button -> seq.2
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().loadSolution();
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      const solvedHtml = renderToStaticMarkup(React.createElement(CurriculumNextLessonBar));
      expect(solvedHtml).toContain('data-testid="solved-lesson-next-bar"');
      expect(solvedHtml).toContain('data-testid="btn-next-solved-lesson"');
      expect(solvedHtml).toContain('>Next<');
    });

    it('keeps creative Next CTA reachable when map pane is hidden', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.6');
      const hiddenMapHtml = renderToStaticMarkup(
        React.createElement(CurriculumNextLessonBar, { forHiddenMapPane: true })
      );
      expect(hiddenMapHtml).toContain('data-testid="hidden-map-creative-next-bar"');
      expect(hiddenMapHtml).toContain('data-testid="btn-complete-creative-activity"');
      expect(hiddenMapHtml).toContain('>Next<');
    });
  });
});
