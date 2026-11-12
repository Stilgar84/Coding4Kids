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
  CAPSTONE_3A_GRID,
  CURRICULUM_ACTIVITIES,
  LESSON_3_5_GRID,
  LESSON_3_6_GRID,
  MODULE_3_BEAT_ALLOWED_BLOCKS,
  MODULE_3_PART2_ACTIVITIES,
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
  ENV_VERSION_GRID_V2,
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

describe('Wave 6 (Commit 18): Module 3 Part 2 (3.5–3.7, 3A, 3B, 3C) & Full 32-Activity Catalog', () => {
  beforeEach(() => {
    resetTestStoreState();
  });

  describe('1. Complete 32-Activity M1–M3 Canonical Catalog & 14 Validated Puzzles', () => {
    it('registers all 32 canonical activities across Modules 1–3 in exact curriculum order', () => {
      expect(MODULE_3_PART2_ACTIVITIES.map((a) => a.id)).toEqual([
        '3.5',
        '3.6',
        '3.7',
        '3A',
        '3B',
        '3C',
      ]);

      const m1Ids = getActivitiesForModule('module-1').map((a) => a.id);
      const m2Ids = getActivitiesForModule('module-2').map((a) => a.id);
      const m3Ids = getActivitiesForModule('module-3').map((a) => a.id);

      expect(m1Ids).toEqual([
        '1.0',
        '1.1',
        '1.2',
        '1.3',
        '1.4',
        '1.5',
        '1.6',
        '1.7',
        '1.8',
        '1A',
        '1B',
        '1C',
      ]);
      expect(m2Ids).toEqual([
        '2.1',
        '2.2',
        '2.3',
        '2.4',
        '2.5',
        '2.6',
        '2.7',
        '2A',
        '2B',
      ]);
      expect(m3Ids).toEqual([
        '3.0',
        '3.1',
        '3.2',
        '3.3',
        '3.4',
        '3.5',
        '3.6',
        '3.7',
        '3A',
        '3B',
        '3C',
      ]);

      expect(m1Ids).toHaveLength(12);
      expect(m2Ids).toHaveLength(9);
      expect(m3Ids).toHaveLength(11);
      expect(CURRICULUM_ACTIVITIES).toHaveLength(32);

      const validatedPuzzleIds = CURRICULUM_ACTIVITIES.filter(isValidatedPuzzleActivity).map(
        (a) => a.id
      );
      expect(validatedPuzzleIds).toEqual([
        '1.1',
        '1.2',
        '1.3',
        '1.4',
        '1.5',
        '1A',
        '2.1',
        '2.7',
        '2A',
        '3.1',
        '3.2',
        '3.5',
        '3.6',
        '3A',
      ]);
    });
  });

  describe('2. Robot Puzzles & Capstone (3.5, 3.6, 3A): Reference Solutions, ? Scaffolds, Anti-Bypass & Binary Sync', () => {
    it('solves 3.5 (Loops with Object Workflows) in 7 blocks <= 8 slots, pauses on ? scaffold, and passes anti-bypass rules', () => {
      const activity = getActivityLatest('3.5')!;
      expect(activity).toBeDefined();
      expect(activity.slotCap?.maxTotal).toBe(8);
      expect(activity.grid).toEqual(LESSON_3_5_GRID);
      expect(activity.referenceSolution!.MAIN).toHaveLength(7);

      const initialGrid = createCurriculumGridState(activity.grid!);
      const refRun = runHeadlessSimulation(activity.referenceSolution!, 'grid', initialGrid, 300);
      expect(refRun.status).toBe('SUCCESS');
      const solvedGrid = refRun.finalState as GridState;
      expect(solvedGrid.bridgedWaterCells).toHaveLength(3); // all 3 canals bridged!
      expect(solvedGrid.worldItems).toHaveLength(0);
      expect(solvedGrid.flags.every((f) => f.collected)).toBe(true);
      expect(solvedGrid.robot.x).toBe(4);
      expect(solvedGrid.robot.y).toBe(4);

      // Scaffold pauses cleanly on first PLACEHOLDER (index 2) and succeeds after replacing all 3 '?' slots
      const scaffoldWs = activity.partialHelp!.scaffoldWorkspace!;
      const pausedRun = runHeadlessSimulation(scaffoldWs, 'grid', initialGrid, 300);
      expect(pausedRun.status).toBe('PAUSED');
      expect(pausedRun.finalRuntime.activeBlockId).toBe(scaffoldWs.MAIN[2].id);

      const store = useAppStore.getState();
      store.setCurriculumActivity('3.5');
      expect(store.loadPartialScaffold()).toBe(true);
      const phIds35 = useAppStore
        .getState()
        .workspace.MAIN.filter((b) => b.type === 'PLACEHOLDER')
        .map((b) => b.id);
      expect(phIds35).toHaveLength(3);
      expect(store.replacePlaceholderBlock('MAIN', phIds35[0], 'PICK_UP')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIds35[1], 'USE_DROP')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIds35[2], 'TURN_RIGHT')).toBe(true);

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

    it('solves 3.6 (Nested Loops) in 7 blocks <= 8 slots with depth-2 brackets, pauses on ? scaffold, and proves nesting depth >= 2', () => {
      const activity = getActivityLatest('3.6')!;
      expect(activity).toBeDefined();
      expect(activity.slotCap?.maxTotal).toBe(8);
      expect(activity.grid).toEqual(LESSON_3_6_GRID);
      expect(activity.referenceSolution!.MAIN).toHaveLength(7);

      const nesting = computeLoopNestingMetadata(activity.referenceSolution!.MAIN);
      expect(nesting.maxDepth).toBe(2);
      expect(nesting.matchedSpans).toHaveLength(2);

      // Render nested purple + cyan solid loop brackets via SSR
      useAppStore.getState().setCurriculumActivity('3.6');
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
      store.setCurriculumActivity('3.6');
      expect(store.loadPartialScaffold()).toBe(true);
      const phIds36 = useAppStore
        .getState()
        .workspace.MAIN.filter((b) => b.type === 'PLACEHOLDER')
        .map((b) => b.id);
      expect(phIds36).toHaveLength(2);
      const pausedRun = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'grid',
        initialGrid,
        400
      );
      expect(pausedRun.status).toBe('PAUSED');
      expect(pausedRun.finalRuntime.activeBlockId).toBe(phIds36[0]);

      expect(store.replacePlaceholderBlock('MAIN', phIds36[0], 'TURN_RIGHT')).toBe(true);
      const motionReplaced = store.replacePlaceholderBlock('MAIN', phIds36[1], 'MOVE_FWD');
      expect(motionReplaced).toBe(true);
      const replacedMotionBlock = useAppStore.getState().workspace.MAIN[5];
      store.updateBlockRepeat('MAIN', replacedMotionBlock.id, 2);

      const completedRun = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'grid',
        initialGrid,
        400
      );
      expect(completedRun.status).toBe('SUCCESS');

      const report = verifyActivityConstraints(activity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults[0].ruleId).toBe('3.6-require-nested-loop');
      expect(report.ruleResults[0].passed).toBe(true);
    });

    it('solves Capstone 3A (The Automated Greenhouse) in 10 blocks <= 10 slots with planks + keys + nested loops and round-trips V2 binary & ENV_ID_LESSON', () => {
      const activity = getActivityLatest('3A')!;
      expect(activity).toBeDefined();
      expect(activity.format).toBe('capstone');
      expect(activity.capstoneType).toBe('puzzle');
      expect(activity.slotCap?.maxTotal).toBe(10);
      expect(activity.grid).toEqual(CAPSTONE_3A_GRID);
      expect(activity.referenceSolution!.MAIN).toHaveLength(10);
      expect(computeLoopNestingMetadata(activity.referenceSolution!.MAIN).maxDepth).toBe(2);

      const initialGrid = createCurriculumGridState(activity.grid!);
      const refRun = runHeadlessSimulation(activity.referenceSolution!, 'grid', initialGrid, 500);
      expect(refRun.status).toBe('SUCCESS');
      const solvedGrid = refRun.finalState as GridState;
      expect(solvedGrid.bridgedWaterCells).toHaveLength(3);
      expect(solvedGrid.worldItems).toHaveLength(0);
      expect(solvedGrid.lockedGates?.every((g) => g.unlocked)).toBe(true);
      expect(solvedGrid.flags.every((f) => f.collected)).toBe(true);
      expect(solvedGrid.robot.x).toBe(5);
      expect(solvedGrid.robot.y).toBe(4);

      // Scaffold replacement check
      const store = useAppStore.getState();
      store.setCurriculumActivity('3A');
      expect(store.loadPartialScaffold()).toBe(true);
      const phIds3A = useAppStore
        .getState()
        .workspace.MAIN.filter((b) => b.type === 'PLACEHOLDER')
        .map((b) => b.id);
      expect(phIds3A).toHaveLength(3);
      expect(store.replacePlaceholderBlock('MAIN', phIds3A[0], 'PICK_UP')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIds3A[1], 'USE_DROP')).toBe(true);
      expect(store.replacePlaceholderBlock('MAIN', phIds3A[2], 'TURN_RIGHT')).toBe(true);
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
        lessonId: '3A',
        lessonVersion: 1,
        slotIndex: 1,
      });
      expect(savedEntry).not.toBeNull();
      const savedFor3A = getSavedPrograms('default').filter((p) => p.lessonId === '3A');
      expect(savedFor3A).toHaveLength(1);
      expect(savedFor3A[0].slotIndex).toBe(1);

      // Path B: Standalone ENV_ID_LESSON = 0x04 share envelope
      const lessonBytes = exportLessonToBinary(activity.referenceSolution!, 'grid', '3A', 1);
      expect(lessonBytes[0]).toBe(FORMAT_VERSION);
      expect(lessonBytes[1]).toBe(ENV_ID_LESSON);
      expect(lessonBytes[2]).toBe(ENV_ID_GENERIC);
      const lessonShareStr = exportLessonToString(activity.referenceSolution!, 'grid', '3A', 1);
      const importedLesson = importFromString(lessonShareStr);
      expect(importedLesson.envId).toBe('lesson');
      expect(importedLesson.innerEnvId).toBe('generic');
      expect(importedLesson.lessonId).toBe('3A');
      expect(importedLesson.lessonVersion).toBe(1);
      expect(importedLesson.workspace!.MAIN.map((b) => b.type)).toEqual(
        activity.referenceSolution!.MAIN.map((b) => b.type)
      );

      // Grid V2 map binary round-trip preserves waterCells, lockedGates, and worldItems
      const v2MapBytes = exportToBinary(activity.referenceSolution!, 'grid', initialGrid);
      expect(v2MapBytes[1]).toBe(ENV_ID_GRID);
      expect(v2MapBytes[2]).toBe(ENV_VERSION_GRID_V2);
      const decodedV2 = importFromBinary(v2MapBytes);
      const roundTripGrid = decodedV2.gridState!;
      expect(roundTripGrid.waterCells).toHaveLength(3);
      expect(roundTripGrid.lockedGates).toHaveLength(3);
      expect(roundTripGrid.worldItems).toHaveLength(6);

      const report = verifyActivityConstraints(activity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults).toHaveLength(2);
    });
  });

  describe('3. Creative Sandboxes & Capstones (3.7, 3B, 3C): Nested Starters, Distinct Variations & Round-Trip', () => {
    it.each(['3.7', '3B'])('executes %s starter and 3 Turtle variations cleanly with distinct non-empty geometries', (activityId) => {
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

        const shareStr = exportLessonToString(card.workspace, 'turtle', activityId, 1);
        const decoded = importFromString(shareStr);
        expect(decoded.envId).toBe('lesson');
        expect(decoded.innerEnvId).toBe('turtle');
        expect(decoded.lessonId).toBe(activityId);
        expect(decoded.lessonVersion).toBe(1);
        expect(decoded.workspace!.MAIN.map((b) => b.type)).toEqual(
          card.workspace.MAIN.map((b) => b.type)
        );
      }
      // Starter + 3 variations produce 4 distinct visual drawings
      expect(svgs.size).toBe(4);
    });

    it('executes Capstone 3C (Looping Lightshow) starter and 3 Beat variations with nested loops, LED cursor sweeps, and Beat binary round-trip', () => {
      const activity = getActivityLatest('3C')!;
      expect(activity).toBeDefined();
      expect(activity.format).toBe('capstone');
      expect(activity.capstoneType).toBe('creative');
      expect(activity.simId).toBe('beat');
      expect(activity.palette.allowedSimBlocks).toEqual(MODULE_3_BEAT_ALLOWED_BLOCKS);
      expect(activity.variations).toHaveLength(3);

      expect(validateLoopStructure(activity.starterWorkspace!.MAIN).hasError).toBe(false);
      expect(computeLoopNestingMetadata(activity.starterWorkspace!.MAIN).maxDepth).toBe(2);

      const starterPreview = renderBeatVariationPreview(activity.starterWorkspace!);
      expect(starterPreview.totalBeats).toBeGreaterThan(20);
      expect(countLitLeds(starterPreview.representativeState.leds)).toBeGreaterThan(0);
      expect(starterPreview.finalState.cursor.visible).toBe(true);

      const thumbnailUrls = new Set<string>([starterPreview.thumbnailUrl]);
      for (const card of activity.variations!) {
        expect(validateLoopStructure(card.workspace.MAIN).hasError).toBe(false);
        expect(computeLoopNestingMetadata(card.workspace.MAIN).maxDepth).toBe(2);

        const preview = renderBeatVariationPreview(card.workspace);
        expect(preview.totalBeats).toBeGreaterThan(10);
        expect(countLitLeds(preview.representativeState.leds)).toBeGreaterThan(0);
        thumbnailUrls.add(preview.thumbnailUrl);

        const shareStr = exportLessonToString(card.workspace, 'beat', '3C', 1);
        const decoded = importFromString(shareStr);
        expect(decoded.envId).toBe('lesson');
        expect(decoded.innerEnvId).toBe('beat');
        expect(decoded.lessonId).toBe('3C');
        expect(decoded.lessonVersion).toBe(1);
        expect(decoded.workspace!.MAIN.map((b) => b.type)).toEqual(
          card.workspace.MAIN.map((b) => b.type)
        );
      }
      expect(thumbnailUrls.size).toBe(4);
    });
  });

  describe('4. Module 3 Mastery Badge (badge-module-3 — Loop Architect) Ceremony', () => {
    it('unlocks badge-module-3 (Loop Architect) only after completing all three Module 3 capstones (3A, 3B, 3C)', () => {
      const m3 = getCurriculumModule('module-3')!;
      expect(m3.badgeId).toBe('badge-module-3');
      expect(m3.badgeTitle).toBe('Loop Architect');
      expect(m3.capstoneIds).toEqual(['3A', '3B', '3C']);

      const store = useAppStore.getState();

      // 1. Solve 3A via instant execution -> completes 3A, badge-module-3 not yet unlocked
      store.setCurriculumActivity('3A');
      useAppStore.setState({ workspace: getActivityLatest('3A')!.referenceSolution! });
      store.setSpeed('instant');
      store.runInstantIfActive({ allowVictoryModal: true });
      expect(getProfileProgress('default').completedLessons['3A']).toBeDefined();
      expect(getProfileProgress('default').earnedBadges).not.toContain('badge-module-3');
      store.dismissVictoryModal();

      // 2. Complete 3B creative capstone -> completes 3B, badge-module-3 still awaiting 3C
      store.setCurriculumActivity('3B');
      store.completeCreativeActivity(false);
      expect(getProfileProgress('default').completedLessons['3B']).toBeDefined();
      expect(getProfileProgress('default').earnedBadges).not.toContain('badge-module-3');
      store.dismissVictoryModal();

      // 3. Complete 3C creative capstone -> unlocks badge-module-3 & opens grand badge ceremony!
      store.setCurriculumActivity('3C');
      store.completeCreativeActivity(false);

      const progressAfter3C = getProfileProgress('default');
      expect(progressAfter3C.completedLessons['3C']).toBeDefined();
      expect(progressAfter3C.earnedBadges).toContain('badge-module-3');
      expect(useAppStore.getState().isVictoryModalOpen).toBe(true);
      expect(useAppStore.getState().victoryEarnedBadges).toEqual(['badge-module-3']);

      const modalHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
      expect(modalHtml).toContain('data-ceremony="badge"');
      expect(modalHtml).toContain('Loop Architect');
      expect(modalHtml).toContain('Module Mastery Badge unlocked: Loop Architect!');

      // Also verify BadgeCollectionModal displays Loop Architect as unlocked
      store.dismissVictoryModal();
      store.setBadgeModalOpen(true);
      const badgeModalHtml = renderToStaticMarkup(React.createElement(BadgeCollectionModal));
      expect(badgeModalHtml).toContain('Loop Architect');
      expect(badgeModalHtml).toContain('data-testid="badge-capstone-chip-3A"');
      expect(badgeModalHtml).toContain('data-testid="badge-capstone-chip-3B"');
      expect(badgeModalHtml).toContain('data-testid="badge-capstone-chip-3C"');
    });
  });
});
