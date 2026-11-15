import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  SEQ_ACTIVITIES,
  compareCurriculumActivityIds,
  createCurriculumBlock,
  createCurriculumGridState,
  getActivitiesForModule,
  getActivityLatest,
  isValidatedPuzzleActivity,
  sortCurriculumActivities,
} from '../src/data/curriculum';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  checkScaffoldWorkspace,
  computeWorkspaceEditDistance,
  verifyActivityConstraints,
  verifyActivityRule,
} from '../src/engine/verification/constraintSolver';
import { isFlagPadlocked } from '../src/engine/physics';
import { resolveActivityScaffoldWorkspace } from '../src/engine/placeholderHelpers';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';
import { GridState, WorkspaceState } from '../src/types';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';
import '../src/simulations/beat/beatEnvironment';

describe('Sequencing (seq): Robot Puzzles (seq.1–seq.5, Capstone seq.A) & Canonical Ordering', () => {
  const seqRobotPuzzles = SEQ_ACTIVITIES.filter(isValidatedPuzzleActivity);

  beforeEach(() => {
    clearPendingUpdateState();
    const store = useAppStore.getState();
    store.pause();
    store.stopGhostPreview();
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.clearWorkspace();
    store.setSpeed(400);
    store.setEditorTool('NONE');
    useAppStore.setState({
      curriculumWorkspaces: {},
      sandboxSnapshot: null,
      activeActivityId: 'seq.0',
      activeActivityVersion: 1,
      statusAnnouncement: '',
      ghostPreview: null,
    });
    useAppStore.getState().clearHistory();
  });

  describe('1. Canonical Curriculum Activity Ordering (seq–func + legacy compat)', () => {
    it('keeps seq.0 first in CURRICULUM_ACTIVITIES and orders all 14 seq activities canonically', () => {
      expect(CURRICULUM_ACTIVITIES[0].id).toBe('seq.0');
      expect(CURRICULUM_ACTIVITIES[1].id).toBe('seq.1');

      const seqIds = getActivitiesForModule('seq').map((a) => a.id);
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

      expect(seqRobotPuzzles.map((a) => a.id)).toEqual([
        'seq.1',
        'seq.2',
        'seq.2a',
        'seq.3',
        'seq.4',
        'seq.5',
        'seq.A',
      ]);
    });

    it('sorts out-of-order seq, param, loop, and func slices into canonical pedagogical order', () => {
      const makeStub = (
        id: string,
        moduleId: string,
        format: CurriculumActivity['format'] = 'puzzle'
      ): CurriculumActivity => ({
        id,
        moduleId,
        version: 1,
        format,
        simId: 'grid',
        icon: '🤖',
        title: `Stub ${id}`,
        concept: 'Stub',
        palette: { allowedSimBlocks: ['MOVE_FWD'] },
      });

      const shuffled = [
        makeStub('loop.C', 'loop', 'capstone'),
        makeStub('param.B', 'param', 'capstone'),
        makeStub('param.1', 'param'),
        makeStub('param.5', 'param', 'sandbox'),
        makeStub('seq.C', 'seq', 'capstone'),
        makeStub('seq.A', 'seq', 'capstone'),
        makeStub('seq.8', 'seq', 'sandbox'),
        makeStub('seq.0', 'seq', 'explanation'),
        makeStub('param.8', 'param'),
        makeStub('param.A', 'param', 'capstone'),
        makeStub('param.C', 'param', 'capstone'),
        makeStub('param.7', 'param', 'explanation'),
        makeStub('loop.0', 'loop', 'explanation'),
        makeStub('loop.4', 'loop', 'sandbox'),
        makeStub('loop.A', 'loop', 'capstone'),
        makeStub('func.0', 'func', 'explanation'),
        makeStub('seq.2a', 'seq'),
        makeStub('seq.B', 'seq', 'capstone'),
        makeStub('seq.4', 'seq'),
      ];

      const sortedIds = sortCurriculumActivities(shuffled).map((a) => a.id);
      expect(sortedIds).toEqual([
        'seq.0',
        'seq.2a',
        'seq.4',
        'seq.8',
        'seq.A',
        'seq.B',
        'seq.C',
        'param.1',
        'param.5',
        'param.C',
        'param.7',
        'param.8',
        'param.A',
        'param.B',
        'loop.0',
        'loop.4',
        'loop.A',
        'loop.C',
        'func.0',
      ]);

      // Multi-digit lesson numbers sort numerically rather than lexicographically (5.2 < 5.10)
      expect(compareCurriculumActivityIds('5.2', '5.10')).toBeLessThan(0);
      expect(compareCurriculumActivityIds('5.10', '5A')).toBeLessThan(0);
    });
  });

  describe('2. All 7 seq Robot Puzzles (seq.1–seq.5, seq.A): Reference Solutions, Slot Caps & Scaffolds', () => {
    const robotPuzzleIds = ['seq.1', 'seq.2', 'seq.2a', 'seq.3', 'seq.4', 'seq.5', 'seq.A'] as const;

    it('validates schema, compact 3x3–4x4 grids, staged palettes, reference solutions, and solver speed (< 50 ms) across seq.1–seq.A', () => {
      for (const id of robotPuzzleIds) {
        const activity = getActivityLatest(id)!;
        expect(activity).toBeDefined();
        expect(isValidatedPuzzleActivity(activity)).toBe(true);
        expect(activity.moduleId).toBe('seq');
        expect(activity.version).toBe(1);
        expect(activity.simId).toBe('grid');
        expect(activity.grid).toBeDefined();

        // Compact seq grid dimensions (3x3 to 4x4)
        expect(activity.grid!.width).toBeGreaterThanOrEqual(3);
        expect(activity.grid!.width).toBeLessThanOrEqual(4);
        expect(activity.grid!.height).toBeGreaterThanOrEqual(3);
        expect(activity.grid!.height).toBeLessThanOrEqual(4);

        // Staged seq palette invariants
        expect(activity.palette.allowRepeatBadges).toBe(false);
        expect(activity.palette.allowActionParams).toBe(false);
        expect(activity.palette.allowVariables).toBe(false);
        expect(activity.palette.allowedControlBlocks).toEqual([]);
        expect(activity.palette.allowedScopes).toEqual(['MAIN']);

        const report = verifyActivityConstraints(activity);
        expect(
          report.passed,
          `Activity ${id} failed constraint check: ${JSON.stringify(report, null, 2)}`
        ).toBe(true);
        expect(report.referenceCheck.passed).toBe(true);
        expect(report.elapsedMs).toBeLessThan(200);
        expect(report.elapsedMs).toBeLessThan(50);
      }
    });

    it('pauses cleanly on PLACEHOLDER for all ? scaffolds and solves when filled', () => {
      for (const id of ['seq.1', 'seq.2', 'seq.2a', 'seq.3', 'seq.4', 'seq.5', 'seq.A'] as const) {
        const activity = getActivityLatest(id)!;
        const expectedMode =
          id === 'seq.1' || id === 'seq.2' || id === 'seq.3' ? 'ghost' : 'scaffold';
        expect(activity.partialHelp?.mode).toBe(expectedMode);
        const scaffold = resolveActivityScaffoldWorkspace(activity)!;
        expect(scaffold).toBeDefined();
        expect(scaffold.MAIN.some((b) => b.type === 'PLACEHOLDER')).toBe(true);
        expect(scaffold.MAIN.length).toBeLessThanOrEqual(activity.slotCap!.maxTotal!);

        // Running the unfilled '?' scaffold pauses cleanly on the first PLACEHOLDER block
        const initialGrid = createCurriculumGridState(activity.grid!);
        const pausedRun = runHeadlessSimulation(scaffold, 'grid', initialGrid, 200);
        expect(pausedRun.status).toBe('PAUSED');
        const firstPh = scaffold.MAIN.find((b) => b.type === 'PLACEHOLDER')!;
        expect(pausedRun.finalRuntime.activeBlockId).toBe(firstPh.id);

        // Solver scaffold completion check proves valid palette blocks fill '?' to reach SUCCESS
        const scaffoldActivity =
          expectedMode === 'ghost'
            ? { ...activity, partialHelp: { ...activity.partialHelp!, mode: 'scaffold' as const } }
            : activity;
        const scafCheck = checkScaffoldWorkspace(scaffoldActivity);
        expect(scafCheck.applicable).toBe(true);
        expect(scafCheck.passed).toBe(true);
        expect(scafCheck.completedWorkspace).toBeDefined();

        const solvedRun = runHeadlessSimulation(
          scafCheck.completedWorkspace!,
          'grid',
          createCurriculumGridState(activity.grid!),
          200
        );
        expect(solvedRun.status).toBe('SUCCESS');
      }
    });
  });

  describe('3. Puzzle-Specific Pedagogical & Anti-Bypass Proofs', () => {
    it('Lesson seq.1: preserves 4x4 hallway, ghostPreview + ? scaffold, and proves < 3 blocks cannot reach Goal', () => {
      const actSeq1 = getActivityLatest('seq.1')!;
      expect(actSeq1.grid!.width).toBe(4);
      expect(actSeq1.grid!.height).toBe(4);
      expect(actSeq1.slotCap?.maxTotal).toBe(4);
      expect(actSeq1.partialHelp?.mode).toBe('ghost');
      expect(actSeq1.partialHelp?.ghostPreview?.maxSteps).toBe(1);
      expect(actSeq1.referenceSolution!.MAIN).toHaveLength(3);

      // Prove < 3 blocks (slotCap = 2) yields 0 solutions, and exact minimum is 3 blocks
      const twoSlotActivity: CurriculumActivity = {
        ...actSeq1,
        slotCap: { maxTotal: 2 },
      };
      const underThreeCheck = verifyActivityRule(twoSlotActivity, {
        id: 'seq.1-min-3-blocks',
        description: 'Cannot reach Goal in fewer than 3 blocks',
        maxLoopNestingDepth: 0,
      });
      expect(underThreeCheck.passed).toBe(true);
      expect(underThreeCheck.minWinningBlocks).toBe(3);
    });

    it('Lesson seq.4 (Visual Step-Debugging): 5-block starter fails unmodified, 1-block replacement reaches SUCCESS, and shortest solution requires >= 5 blocks', () => {
      const actSeq4 = getActivityLatest('seq.4')!;
      expect(actSeq4.format).toBe('puzzle');
      expect(actSeq4.icon).toBe('🐞');
      expect(actSeq4.grid!.width).toBe(3);
      expect(actSeq4.grid!.height).toBe(3);
      expect(actSeq4.slotCap?.maxTotal).toBe(5);
      expect(actSeq4.starterWorkspace).toBeDefined();
      expect(actSeq4.starterWorkspace!.MAIN).toHaveLength(5);
      expect(actSeq4.referenceSolution!.MAIN).toHaveLength(5);

      // 1. Unmodified 5-block starterWorkspace fails
      const initialGrid = createCurriculumGridState(actSeq4.grid!);
      const starterRun = runHeadlessSimulation(actSeq4.starterWorkspace!, 'grid', initialGrid, 200);
      expect(starterRun.status).not.toBe('SUCCESS');
      expect(starterRun.status).toBe('COLLISION');

      // 2. Replacing exactly 1 wrong block reaches SUCCESS in 5 blocks
      const editDist = computeWorkspaceEditDistance(
        actSeq4.starterWorkspace!,
        actSeq4.referenceSolution!
      );
      expect(editDist).toBe(1);
      const fixedRun = runHeadlessSimulation(
        actSeq4.referenceSolution!,
        'grid',
        createCurriculumGridState(actSeq4.grid!),
        200
      );
      expect(fixedRun.status).toBe('SUCCESS');

      // 3. '?' scaffold replaces the 1 wrong block (index 3) with PLACEHOLDER so Step-by-Step pauses on '?'
      const scaf = actSeq4.partialHelp!.scaffoldWorkspace!;
      expect(scaf.MAIN).toHaveLength(5);
      expect(scaf.MAIN[3].type).toBe('PLACEHOLDER');
      const scafRun = runHeadlessSimulation(
        scaf,
        'grid',
        createCurriculumGridState(actSeq4.grid!),
        200
      );
      expect(scafRun.status).toBe('PAUSED');
      expect((scafRun.finalState as GridState).robot).toMatchObject({ x: 1, y: 1, dir: 'EAST' });

      // 4. Shortest from-scratch solution requires >= 5 blocks (< 5 blocks cannot reach Goal)
      const fourSlotActivity: CurriculumActivity = {
        ...actSeq4,
        slotCap: { maxTotal: 4 },
      };
      const minFiveCheck = verifyActivityRule(fourSlotActivity, {
        id: 'seq.4-min-5-blocks',
        description: 'Map walls prevent reaching Goal in fewer than 5 blocks',
        maxLoopNestingDepth: 0,
      });
      expect(minFiveCheck.passed).toBe(true);
      expect(minFiveCheck.minWinningBlocks).toBe(5);
    });

    it('Lesson seq.5 (Ordered Waypoints): direct-to-goal, 2 -> Goal, and 2 -> 1 -> Goal all fail lock, while 1 -> 2 -> Goal succeeds in <= 7 blocks', () => {
      const actSeq5 = getActivityLatest('seq.5')!;
      expect(actSeq5.format).toBe('puzzle');
      expect(actSeq5.icon).toBe('🚩');
      expect(actSeq5.grid!.width).toBe(3);
      expect(actSeq5.grid!.height).toBe(3);
      expect(actSeq5.slotCap?.maxTotal).toBe(7);

      const initialGrid = createCurriculumGridState(actSeq5.grid!);
      const flag1 = initialGrid.flags.find((f) => f.order === 1 && !f.isGoal)!;
      const flag2 = initialGrid.flags.find((f) => f.order === 2 && !f.isGoal)!;
      const goal = initialGrid.flags.find((f) => f.isGoal)!;
      expect(flag1).toBeDefined();
      expect(flag2).toBeDefined();
      expect(goal).toBeDefined();
      expect(goal.order).toBe(3);

      // Initially Flag 1 is unlocked, while Flag 2 and Goal are padlocked
      expect(isFlagPadlocked(flag1, initialGrid.flags)).toBe(false);
      expect(isFlagPadlocked(flag2, initialGrid.flags)).toBe(true);
      expect(isFlagPadlocked(goal, initialGrid.flags)).toBe(true);

      // 1. Direct-to-Goal via Flag 2 (4 blocks, skipping Flag 1): lands on (goal.x, goal.y) and stays padlocked
      const directWs: WorkspaceState = {
        MAIN: [
          createCurriculumBlock('TURN_RIGHT'),
          createCurriculumBlock('MOVE_FWD'),
          createCurriculumBlock('TURN_RIGHT'),
          createCurriculumBlock('MOVE_FWD'),
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const directRun = runHeadlessSimulation(
        directWs,
        'grid',
        createCurriculumGridState(actSeq5.grid!),
        200
      );
      const directState = directRun.finalState as GridState;
      expect(directState.robot.x).toBe(goal.x);
      expect(directState.robot.y).toBe(goal.y);
      expect(directRun.status).not.toBe('SUCCESS');
      expect(directState.flags.find((f) => f.isGoal)!.collected).toBe(false);

      // 2. Visiting Flag 2 -> Goal without Flag 1 leaves Flag 2 and Goal locked
      expect(directState.flags.find((f) => f.order === 2)!.collected).toBe(false);
      expect(directState.flags.find((f) => f.isGoal)!.collected).toBe(false);

      // 3. Visiting Flag 2 -> Flag 1 (without revisiting Flag 2 after unlocking) leaves Flag 2 & Goal uncollected
      const twoThenOneWs: WorkspaceState = {
        MAIN: [
          createCurriculumBlock('TURN_RIGHT'),
          createCurriculumBlock('MOVE_FWD'),
          createCurriculumBlock('MOVE_BACK'),
          createCurriculumBlock('TURN_LEFT'),
          createCurriculumBlock('MOVE_FWD'),
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const twoThenOneRun = runHeadlessSimulation(
        twoThenOneWs,
        'grid',
        createCurriculumGridState(actSeq5.grid!),
        200
      );
      const twoThenOneState = twoThenOneRun.finalState as GridState;
      expect(twoThenOneRun.status).not.toBe('SUCCESS');
      expect(twoThenOneState.flags.find((f) => f.order === 1)!.collected).toBe(true);
      expect(twoThenOneState.flags.find((f) => f.order === 2)!.collected).toBe(false);
      expect(twoThenOneState.flags.find((f) => f.isGoal)!.collected).toBe(false);

      // 4. Collecting 1 -> 2 -> Goal in order succeeds in <= 7 blocks
      expect(actSeq5.referenceSolution!.MAIN.length).toBeLessThanOrEqual(7);
      const inOrderRun = runHeadlessSimulation(
        actSeq5.referenceSolution!,
        'grid',
        createCurriculumGridState(actSeq5.grid!),
        200
      );
      expect(inOrderRun.status).toBe('SUCCESS');
    });

    it('Capstone seq.A (Compact Labyrinth): synthesizes 3 ordered flags, South/West turns, MOVE_BACK, broken starter leg, and passes all 5 anti-bypass rules < 50 ms', () => {
      const actSeqA = getActivityLatest('seq.A')!;
      expect(actSeqA.format).toBe('capstone');
      expect(actSeqA.capstoneType).toBe('puzzle');
      expect(actSeqA.icon).toBe('🏆');
      expect(actSeqA.grid!.width).toBe(4);
      expect(actSeqA.grid!.height).toBe(4);
      expect(actSeqA.grid!.flags).toHaveLength(3);
      expect(actSeqA.slotCap?.maxTotal).toBe(10);

      const refLen = actSeqA.referenceSolution!.MAIN.length;
      expect(refLen).toBeGreaterThanOrEqual(8);
      expect(refLen).toBeLessThanOrEqual(10);

      // Broken starter leg fails unmodified
      expect(actSeqA.starterWorkspace).toBeDefined();
      const starterRun = runHeadlessSimulation(
        actSeqA.starterWorkspace!,
        'grid',
        createCurriculumGridState(actSeqA.grid!),
        200
      );
      expect(starterRun.status).not.toBe('SUCCESS');

      // Verify all 5 mandatory anti-bypass rules pass cleanly and rapidly
      const report = verifyActivityConstraints(actSeqA);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.elapsedMs).toBeLessThan(50);
      expect(report.ruleResults).toHaveLength(5);

      const starterRule = report.ruleResults.find((r) => r.rule.unmodifiedStarterMustFail);
      const moveBackRule = report.ruleResults.find((r) =>
        r.rule.forbidBlocks?.includes('MOVE_BACK')
      );
      const turnLeftRule = report.ruleResults.find((r) =>
        r.rule.forbidBlocks?.includes('TURN_LEFT')
      );
      const turnRightRule = report.ruleResults.find((r) =>
        r.rule.forbidBlocks?.includes('TURN_RIGHT')
      );
      const directLockRule = report.ruleResults.find((r) => r.rule.directToGoalMustFailLock);

      expect(starterRule?.passed).toBe(true);
      expect(starterRule?.rule.minStarterEditDistance).toBe(1);

      expect(moveBackRule?.passed).toBe(true);
      expect(turnLeftRule?.passed).toBe(true);
      expect(turnRightRule?.passed).toBe(true);
      expect(directLockRule?.passed).toBe(true);
    });

    it('integrates cleanly with useAppStore for starter loading, ? scaffold stepping, in-place replacement, and 1-tap Undo on seq.4 and seq.A', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');

      // seq.4 loads its 5-block buggy starterWorkspace automatically
      store.setCurriculumActivity('seq.4');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_RIGHT',
        'MOVE_FWD',
        'TURN_RIGHT',
        'MOVE_FWD',
      ]);

      // Load '?' scaffold on seq.4 -> replaces buggy index 3 with PLACEHOLDER, and Undo restores buggy starter!
      expect(store.loadPartialScaffold()).toBe(true);
      expect(useAppStore.getState().workspace.MAIN[3].type).toBe('PLACEHOLDER');
      store.undo();
      expect(useAppStore.getState().workspace.MAIN[3].type).toBe('TURN_RIGHT');
      store.redo();

      // Step through seq.4 scaffold -> pauses cleanly on PLACEHOLDER, then replace with TURN_LEFT to solve!
      store.step(); // (0, 1, N)
      store.step(); // (0, 1, E)
      store.step(); // (1, 1, E)
      store.step(); // pauses on PLACEHOLDER!
      expect(useAppStore.getState().runtime?.status).toBe('PAUSED');
      const phSeq4Id = useAppStore.getState().workspace.MAIN[3].id;
      expect(store.replacePlaceholderBlock('MAIN', phSeq4Id, 'TURN_LEFT')).toBe(true);
      store.step(); // executes newly placed TURN_LEFT -> (1, 1, N)
      store.step(); // (1, 0, N) -> Goal!
      if (useAppStore.getState().grid.status === 'RUNNING') {
        store.step();
      }
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');

      // seq.A loads its 4-block broken starter leg automatically, and '?' scaffold solves cleanly when filled
      store.setCurriculumActivity('seq.A');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_RIGHT',
        'MOVE_FWD',
        'MOVE_BACK',
      ]);
      expect(store.loadPartialScaffold()).toBe(true);
      const scafSeqA = useAppStore.getState().workspace.MAIN;
      expect(scafSeqA.filter((b) => b.type === 'PLACEHOLDER')).toHaveLength(2);
      expect(store.replacePlaceholderBlock('MAIN', scafSeqA[1].id, 'TURN_LEFT')).toBe(true);
      const scafSeqAAfterFirst = useAppStore.getState().workspace.MAIN;
      expect(store.replacePlaceholderBlock('MAIN', scafSeqAAfterFirst[6].id, 'TURN_RIGHT')).toBe(
        true
      );
      store.setSpeed('instant');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
    });
  });
});
