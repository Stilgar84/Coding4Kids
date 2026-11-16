import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { BadgeCollectionModal } from '../src/components/BadgeCollectionModal';
import { computeLoopNestingMetadata } from '../src/components/BlockItem';
import {
  renderBeatVariationPreview,
  renderTurtleVariationPreview,
} from '../src/components/VariationCardsPanel';
import { VictoryCelebrationModal } from '../src/components/VictoryCelebrationModal';
import { WorkspaceCanvas } from '../src/components/WorkspaceCanvas';
import {
  CURRICULUM_ACTIVITIES,
  LOOP_ACTIVITIES,
  createCurriculumGridState,
  getActivitiesForModule,
  getActivityLatest,
  getCurriculumModule,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import { validateLoopStructure } from '../src/engine/interpreter';
import {
  exportLessonCodeOnly,
  exportLessonToBinary,
  exportLessonToString,
  exportToBinary,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_GENERIC,
  ENV_ID_GRID,
  ENV_ID_LESSON,
  ENV_VERSION_GRID_V3,
  FORMAT_VERSION,
} from '../src/engine/serialization/types';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { countLitLeds } from '../src/simulations/beat/presets';
import { clearAllSavedPrograms, saveProgram, getSavedPrograms } from '../src/services/localSaveService';
import {
  getProfileProgress,
  resetAllProfileDataForTests,
} from '../src/services/profileService';
import { useAppStore } from '../src/store/useAppStore';
import { GridState } from '../src/types';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';
import '../src/simulations/beat/beatEnvironment';

function resetTestStoreState() {
  clearAllSavedPrograms();
  resetAllProfileDataForTests();

  const s = useAppStore.getState();
  s.pause();
  s.setAppMode('sandbox');
  s.setSimEnvironment('grid');
  s.setLevel(1);
  s.setSpeed(400);
  s.dismissVictoryModal();
  s.setBadgeModalOpen(false);
  s.setLessonPickerOpen(false);
  s.reloadActiveProfileState();
  useAppStore.setState({
    curriculumWorkspaces: {},
    sandboxSnapshot: null,
    statusAnnouncement: '',
    isVictoryModalOpen: false,
    victoryEarnedBadges: [],
  });
  useAppStore.getState().clearHistory();
}

describe('Phase 1 V2: Loop Activities (loop.5–loop.C) & Full 56-Activity Catalog', () => {
  beforeEach(() => {
    resetTestStoreState();
  });

  describe('1. Complete 56-Activity Phase 1 Canonical Catalog & 26 Validated Puzzles', () => {
    it('registers all 56 canonical activities across seq/param/loop/func in exact curriculum order', () => {
      expect(LOOP_ACTIVITIES.map((a) => a.id)).toEqual([
        'loop.0',
        'loop.1',
        'loop.2',
        'loop.3',
        'loop.3a',
        'loop.4',
        'loop.5',
        'loop.5a',
        'loop.6',
        'loop.7',
        'loop.8',
        'loop.9',
        'loop.10',
        'loop.11',
        'loop.A',
        'loop.B',
        'loop.C',
      ]);

      const seqIds = getActivitiesForModule('seq').map((a) => a.id);
      const paramIds = getActivitiesForModule('param').map((a) => a.id);
      const loopIds = getActivitiesForModule('loop').map((a) => a.id);
      const funcIds = getActivitiesForModule('func').map((a) => a.id);

      expect(seqIds).toEqual([
        'seq.0',
        'seq.1',
        'seq.2',
        'seq.2a',
        'seq.3',
        'seq.4',
        'seq.5',
        'seq.6',
        'seq.7',
        'seq.7a',
        'seq.8',
        'seq.A',
        'seq.B',
        'seq.C',
      ]);
      expect(paramIds).toEqual([
        'param.0',
        'param.1',
        'param.2',
        'param.3',
        'param.4',
        'param.5',
        'param.6',
        'param.C',
        'param.7',
        'param.8',
        'param.9',
        'param.10',
        'param.A',
        'param.B',
      ]);
      expect(loopIds).toEqual([
        'loop.0',
        'loop.1',
        'loop.2',
        'loop.3',
        'loop.3a',
        'loop.4',
        'loop.5',
        'loop.5a',
        'loop.6',
        'loop.7',
        'loop.8',
        'loop.9',
        'loop.10',
        'loop.11',
        'loop.A',
        'loop.B',
        'loop.C',
      ]);
      expect(funcIds).toEqual([
        'func.0',
        'func.1',
        'func.2',
        'func.3',
        'func.4',
        'func.5',
        'func.6',
        'func.7',
        'func.A',
        'func.B',
        'func.C',
      ]);

      expect(seqIds).toHaveLength(14);
      expect(paramIds).toHaveLength(14);
      expect(loopIds).toHaveLength(17);
      expect(funcIds).toHaveLength(11);
      expect(CURRICULUM_ACTIVITIES).toHaveLength(123);

      const validatedPuzzleIds = CURRICULUM_ACTIVITIES.filter((a) => isValidatedPuzzleActivity(a)).map(
        (a) => a.id
      );
      expect(validatedPuzzleIds).toEqual([
        'seq.1',
        'seq.2',
        'seq.2a',
        'seq.3',
        'seq.4',
        'seq.5',
        'seq.A',
        'param.1',
        'param.8',
        'param.9',
        'param.10',
        'param.A',
        'loop.1',
        'loop.2',
        'loop.5',
        'loop.6',
        'loop.9',
        'loop.10',
        'loop.11',
        'loop.A',
        'func.1',
        'func.4',
        'func.5',
        'func.6',
        'func.7',
        'func.A',
        'branch.1',
        'branch.3',
        'branch.5',
        'branch.5a',
        'branch.6a',
        'branch.6b',
        'branch.9',
        'branch.7a',
        'branch.7b',
        'branch.8',
        'branch.A',
        'while.1',
        'while.3',
        'while.4',
        'while.5',
        'while.8',
        'while.A',
        'var.2',
        'var.4',
        'var.4a',
        'var.A',
        'cmp.1',
        'cmp.1a',
        'cmp.2',
        'cmp.4',
        'cmp.5a',
        'cmp.7',
        'cmp.8',
        'cmp.9',
        'cmp.A',
        'cmp.B',
        'var.M1',
        'cmp.M1',
        'cmp.M2',
        'cmp.M3',
      ]);
    });
  });

  describe('2. Robot Puzzles & Capstone (loop.5, loop.6, loop.A): Reference Solutions, ? Scaffolds, Anti-Bypass & Binary Sync', () => {
    it('solves loop.5 (Bridge Builder Loop) in 8 blocks <= 8 slots, pauses on ? scaffold, and passes anti-bypass rules', () => {
      const activity = getActivityLatest('loop.5')!;
      expect(activity).toBeDefined();
      expect(activity.slotCap?.maxTotal).toBe(8);
      expect(activity.grid?.width).toBe(7);
      expect(activity.grid?.waterCells).toHaveLength(3);
      expect(activity.referenceSolution!.MAIN).toHaveLength(8);

      const initialGrid = createCurriculumGridState(activity.grid!);
      const refRun = runHeadlessSimulation(activity.referenceSolution!, 'grid', initialGrid, 300);
      expect(refRun.status).toBe('SUCCESS');
      const solvedGrid = refRun.finalState as GridState;
      expect(solvedGrid.worldItems).toHaveLength(0);
      expect(solvedGrid.flags.every((f) => f.collected)).toBe(true);
      expect(solvedGrid.robot.x).toBe(6);
      expect(solvedGrid.robot.y).toBe(1);

      // Scaffold pauses cleanly on first PLACEHOLDER (index 4) and succeeds after completing both turn slots
      const scaffoldWs = activity.partialHelp!.scaffoldWorkspace!;
      const pausedRun = runHeadlessSimulation(scaffoldWs, 'grid', initialGrid, 300);
      expect(pausedRun.status).toBe('PAUSED');
      expect(pausedRun.finalRuntime.activeBlockId).toBe(scaffoldWs.MAIN[4].id);

      const store = useAppStore.getState();
      store.setCurriculumActivity('loop.5');
      expect(store.loadPartialScaffold()).toBe(true);
      const phIds5 = useAppStore
        .getState()
        .workspace.MAIN.filter((b) => b.type === 'PLACEHOLDER')
        .map((b) => b.id);
      expect(phIds5).toHaveLength(2);
      expect(store.replacePlaceholderBlock('MAIN', phIds5[0], 'TURN_RIGHT')).toBe(true);
      store.updateBlockRepeat('MAIN', useAppStore.getState().workspace.MAIN[4].id, 2);
      expect(store.replacePlaceholderBlock('MAIN', phIds5[1], 'TURN_RIGHT')).toBe(true);
      store.updateBlockRepeat('MAIN', useAppStore.getState().workspace.MAIN[6].id, 2);

      const completedScaffoldRun = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'grid',
        initialGrid,
        300
      );
      expect(completedScaffoldRun.status).toBe('SUCCESS');

      const report = verifyActivityConstraints(activity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults).toHaveLength(2);
      expect(report.ruleResults.every((r) => r.passed && !r.bypassSolution)).toBe(true);
    });

    it('solves loop.6 (Four-Corner Pillar Patrol) in 7 blocks <= 7 slots with depth-2 brackets, pauses on ? scaffold, and proves nesting depth >= 2', () => {
      const activity = getActivityLatest('loop.6')!;
      expect(activity).toBeDefined();
      expect(activity.slotCap?.maxTotal).toBe(7);
      expect(activity.grid?.width).toBe(5);
      expect(activity.grid?.flags).toHaveLength(5);
      expect(activity.referenceSolution!.MAIN).toHaveLength(7);

      const nesting = computeLoopNestingMetadata(activity.referenceSolution!.MAIN);
      expect(nesting.maxDepth).toBe(2);
      expect(nesting.matchedSpans).toHaveLength(2);

      // Render nested purple + cyan solid loop brackets via SSR
      useAppStore.getState().setCurriculumActivity('loop.6');
      useAppStore.setState({ workspace: activity.referenceSolution! });
      const wsHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(wsHtml).toContain('data-max-loop-depth="2"');
      expect(wsHtml).toContain('Loop level 2 (nested)');

      const initialGrid = createCurriculumGridState(activity.grid!);
      const refRun = runHeadlessSimulation(activity.referenceSolution!, 'grid', initialGrid, 400);
      expect(refRun.status).toBe('SUCCESS');
      const solvedGrid = refRun.finalState as GridState;
      expect(solvedGrid.flags.every((f) => f.collected)).toBe(true);
      expect(solvedGrid.robot.x).toBe(2);
      expect(solvedGrid.robot.y).toBe(2);

      // Scaffold pauses on first '?' inside the inner loop (index 3) and succeeds when completed
      const store = useAppStore.getState();
      store.setCurriculumActivity('loop.6');
      expect(store.loadPartialScaffold()).toBe(true);
      const phIds6 = useAppStore
        .getState()
        .workspace.MAIN.filter((b) => b.type === 'PLACEHOLDER')
        .map((b) => b.id);
      expect(phIds6).toHaveLength(2);
      const pausedRun = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'grid',
        initialGrid,
        400
      );
      expect(pausedRun.status).toBe('PAUSED');
      expect(pausedRun.finalRuntime.activeBlockId).toBe(phIds6[0]);

      expect(store.replacePlaceholderBlock('MAIN', phIds6[0], 'TURN_RIGHT')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIds6[1], 'TURN_RIGHT')).toBe(true);

      const completedRun = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'grid',
        initialGrid,
        400
      );
      expect(completedRun.status).toBe('SUCCESS');

      const report = verifyActivityConstraints(activity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults[0].ruleId).toBe('loop.6-require-nested-loops');
      expect(report.ruleResults[0].passed).toBe(true);
    });

    it('solves Capstone loop.A (Automated Greenhouse) in 10 blocks <= 10 slots with 8 crates + floor switches + nested loops and round-trips V2 binary & ENV_ID_LESSON', () => {
      const activity = getActivityLatest('loop.A')!;
      expect(activity).toBeDefined();
      expect(activity.format).toBe('capstone');
      expect(activity.capstoneType).toBe('puzzle');
      expect(activity.slotCap?.maxTotal).toBe(10);
      expect(activity.grid?.width).toBe(9);
      expect(activity.grid?.worldItems).toHaveLength(8);
      expect(activity.grid?.floorSwitches).toHaveLength(8);
      expect(activity.referenceSolution!.MAIN).toHaveLength(10);
      expect(computeLoopNestingMetadata(activity.referenceSolution!.MAIN).maxDepth).toBe(2);

      const initialGrid = createCurriculumGridState(activity.grid!);
      const refRun = runHeadlessSimulation(activity.referenceSolution!, 'grid', initialGrid, 500);
      expect(refRun.status).toBe('SUCCESS');
      const solvedGrid = refRun.finalState as GridState;
      expect(solvedGrid.flags.every((f) => f.collected)).toBe(true);
      expect(solvedGrid.robot.x).toBe(4);
      expect(solvedGrid.robot.y).toBe(4);

      // Scaffold replacement check
      const store = useAppStore.getState();
      store.setCurriculumActivity('loop.A');
      expect(store.loadPartialScaffold()).toBe(true);
      const phIdsA = useAppStore
        .getState()
        .workspace.MAIN.filter((b) => b.type === 'PLACEHOLDER')
        .map((b) => b.id);
      expect(phIdsA).toHaveLength(3);
      expect(store.replacePlaceholderBlock('MAIN', phIdsA[0], 'PICK_UP')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIdsA[1], 'USE_DROP')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIdsA[2], 'TURN_RIGHT')).toBe(true);
      const scaffoldSolved = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'grid',
        initialGrid,
        500
      );
      expect(scaffoldSolved.status).toBe('SUCCESS');

      // Dual-path serialization check:
      // Path A: Local storage SavedProgramEntry (code-only)
      const codeOnlyPayload = exportLessonCodeOnly(activity.referenceSolution!, 'grid');
      const savedEntry = saveProgram({
        title: 'Greenhouse Solution',
        simId: 'grid',
        code: codeOnlyPayload,
        screenshot: '',
        status: 'SUCCESS',
        stepCount: refRun.stepCount,
        profileId: 'default',
        lessonId: 'loop.A',
        lessonVersion: 1,
        slotIndex: 1,
      });
      expect(savedEntry).not.toBeNull();
      const savedForLoopA = getSavedPrograms('default').filter((p) => p.lessonId === 'loop.A');
      expect(savedForLoopA).toHaveLength(1);
      expect(savedForLoopA[0].slotIndex).toBe(1);

      // Path B: Standalone ENV_ID_LESSON = 0x04 share envelope
      const lessonBytes = exportLessonToBinary(activity.referenceSolution!, 'grid', 'loop.A', 1);
      expect(lessonBytes[0]).toBe(FORMAT_VERSION);
      expect(lessonBytes[1]).toBe(ENV_ID_LESSON);
      expect(lessonBytes[2]).toBe(ENV_ID_GENERIC);
      const lessonShareStr = exportLessonToString(activity.referenceSolution!, 'grid', 'loop.A', 1);
      const importedLesson = importFromString(lessonShareStr);
      expect(importedLesson.envId).toBe('lesson');
      expect(importedLesson.innerEnvId).toBe('generic');
      expect(importedLesson.lessonId).toBe('loop.A');
      expect(importedLesson.lessonVersion).toBe(1);
      expect(importedLesson.workspace!.MAIN.map((b) => b.type)).toEqual(
        activity.referenceSolution!.MAIN.map((b) => b.type)
      );

      // Grid V3 map binary round-trip preserves worldItems & v3 rule flags
      const v2MapBytes = exportToBinary(activity.referenceSolution!, 'grid', initialGrid);
      expect(v2MapBytes[1]).toBe(ENV_ID_GRID);
      expect(v2MapBytes[2]).toBe(ENV_VERSION_GRID_V3);
      const decodedV2 = importFromBinary(v2MapBytes);
      const roundTripGrid = decodedV2.gridState!;
      expect(roundTripGrid.worldItems).toHaveLength(8);

      const report = verifyActivityConstraints(activity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults).toHaveLength(2);
    });
  });

  describe('3. Creative Sandboxes & Capstones (loop.7, loop.B, loop.C): Nested Starters, Distinct Variations & Round-Trip', () => {
    it.each(['loop.7', 'loop.B'])('executes %s starter and 3 Turtle variations cleanly with distinct non-empty geometries', (activityId) => {
      const activity = getActivityLatest(activityId)!;
      expect(activity).toBeDefined();
      expect(activity.simId).toBe('turtle');
      expect(activity.starterWorkspace).toBeDefined();
      expect(activity.variations).toHaveLength(3);

      expect(validateLoopStructure(activity.starterWorkspace!.MAIN).hasError).toBe(false);
      expect(computeLoopNestingMetadata(activity.starterWorkspace!.MAIN).maxDepth).toBe(2);

      const starterPreview = renderTurtleVariationPreview(activity.starterWorkspace!);
      expect(starterPreview.finalState.paths.length).toBeGreaterThan(0);
      expect(starterPreview.svgMarkup).toContain('<svg');

      const svgs = new Set<string>([starterPreview.svgMarkup]);
      for (const card of activity.variations!) {
        expect(validateLoopStructure(card.workspace.MAIN).hasError).toBe(false);
        expect(computeLoopNestingMetadata(card.workspace.MAIN).maxDepth).toBe(2);

        const cardPreview = renderTurtleVariationPreview(card.workspace);
        expect(cardPreview.finalState.paths.length).toBeGreaterThan(0);
        svgs.add(cardPreview.svgMarkup);

        const shareStr = exportLessonToString(card.workspace, 'turtle', activityId, activity.version);
        const decoded = importFromString(shareStr);
        expect(decoded.envId).toBe('lesson');
        expect(decoded.innerEnvId).toBe('turtle');
        expect(decoded.lessonId).toBe(activityId);
        expect(decoded.lessonVersion).toBe(activity.version);
        expect(decoded.workspace!.MAIN.map((b) => b.type)).toEqual(
          card.workspace.MAIN.map((b) => b.type)
        );
      }
      // Starter + 3 variations produce 4 distinct visual drawings
      expect(svgs.size).toBe(4);
    });

    it('executes Capstone loop.C (Looping Lightshow) starter and 3 Beat variations with nested loops, LED cursor sweeps, and Beat binary round-trip', () => {
      const activity = getActivityLatest('loop.C')!;
      expect(activity).toBeDefined();
      expect(activity.format).toBe('capstone');
      expect(activity.capstoneType).toBe('creative');
      expect(activity.simId).toBe('beat');
      expect(activity.palette.allowedSimBlocks).toContain('STAMP_PRESET');
      expect(activity.palette.allowedSimBlocks).toContain('CURSOR_STEP');
      expect(activity.variations).toHaveLength(3);

      expect(validateLoopStructure(activity.starterWorkspace!.MAIN).hasError).toBe(false);
      expect(computeLoopNestingMetadata(activity.starterWorkspace!.MAIN).maxDepth).toBe(2);

      const starterPreview = renderBeatVariationPreview(activity.starterWorkspace!);
      expect(starterPreview.totalBeats).toBeGreaterThan(4);
      expect(countLitLeds(starterPreview.representativeState.leds)).toBeGreaterThan(0);
      expect(starterPreview.finalState.cursor.visible).toBe(true);

      const thumbnailUrls = new Set<string>([starterPreview.thumbnailUrl]);
      for (const card of activity.variations!) {
        expect(validateLoopStructure(card.workspace.MAIN).hasError).toBe(false);
        expect(computeLoopNestingMetadata(card.workspace.MAIN).maxDepth).toBe(2);

        const preview = renderBeatVariationPreview(card.workspace);
        expect(preview.totalBeats).toBeGreaterThan(2);
        expect(countLitLeds(preview.representativeState.leds)).toBeGreaterThan(0);
        thumbnailUrls.add(preview.thumbnailUrl);

        const shareStr = exportLessonToString(card.workspace, 'beat', 'loop.C', activity.version);
        const decoded = importFromString(shareStr);
        expect(decoded.envId).toBe('lesson');
        expect(decoded.innerEnvId).toBe('beat');
        expect(decoded.lessonId).toBe('loop.C');
        expect(decoded.lessonVersion).toBe(activity.version);
        expect(decoded.workspace!.MAIN.map((b) => b.type)).toEqual(
          card.workspace.MAIN.map((b) => b.type)
        );
      }
      expect(thumbnailUrls.size).toBe(4);
    });
  });

  describe('4. Loop Mastery Badge (badge-loop — Loop Architect) Ceremony', () => {
    it('unlocks badge-loop (Loop Architect) only after completing all three Loop capstones (loop.A, loop.B, loop.C)', () => {
      const mLoop = getCurriculumModule('loop')!;
      expect(mLoop.badgeId).toBe('badge-loop');
      expect(mLoop.badgeTitle).toBe('Loop Architect');
      expect(mLoop.capstoneIds).toEqual(['loop.A', 'loop.B', 'loop.C']);

      const store = useAppStore.getState();

      // 1. Solve loop.A via instant execution -> completes loop.A, badge-loop not yet unlocked
      store.setCurriculumActivity('loop.A');
      useAppStore.setState({ workspace: getActivityLatest('loop.A')!.referenceSolution! });
      store.setSpeed('instant');
      store.runInstantIfActive({ allowVictoryModal: true });
      expect(getProfileProgress('default').completedLessons['loop.A']).toBeDefined();
      expect(getProfileProgress('default').earnedBadges).not.toContain('badge-loop');
      store.dismissVictoryModal();

      // 2. Complete loop.B creative capstone -> completes loop.B, badge-loop still awaiting loop.C
      store.setCurriculumActivity('loop.B');
      store.completeCreativeActivity(false);
      expect(getProfileProgress('default').completedLessons['loop.B']).toBeDefined();
      expect(getProfileProgress('default').earnedBadges).not.toContain('badge-loop');
      store.dismissVictoryModal();

      // 3. Complete loop.C creative capstone -> unlocks badge-loop & opens grand badge ceremony!
      store.setCurriculumActivity('loop.C');
      store.completeCreativeActivity(false);

      const progressAfterC = getProfileProgress('default');
      expect(progressAfterC.completedLessons['loop.C']).toBeDefined();
      expect(progressAfterC.earnedBadges).toContain('badge-loop');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(true);
      expect(useAppStore.getState().victoryEarnedBadges).toEqual(['badge-loop']);

      const modalHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
      expect(modalHtml).toContain('data-ceremony="badge"');
      expect(modalHtml).toContain('Loop Architect');
      expect(modalHtml).toContain('Module Mastery Badge unlocked: Loop Architect!');

      // Also verify BadgeCollectionModal displays Loop Architect as unlocked
      store.dismissVictoryModal();
      store.setBadgeModalOpen(true);
      const badgeModalHtml = renderToStaticMarkup(React.createElement(BadgeCollectionModal));
      expect(badgeModalHtml).toContain('Loop Architect');
      expect(badgeModalHtml).toContain('data-testid="badge-capstone-chip-loop.A"');
      expect(badgeModalHtml).toContain('data-testid="badge-capstone-chip-loop.B"');
      expect(badgeModalHtml).toContain('data-testid="badge-capstone-chip-loop.C"');
    });
  });
});
