import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  MODULE_1_ROBOT_ACTIVITIES,
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

describe('Wave 4 / Commit 8b: Finalized Module 1 Robot Puzzles (1.1–1.5, Capstone 1A) & Canonical Ordering', () => {
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
      activeActivityId: '1.0',
      activeActivityVersion: 1,
      statusAnnouncement: '',
      ghostPreview: null,
    });
    useAppStore.getState().clearHistory();
  });

  describe('1. Canonical Curriculum Activity Ordering (Modules 1–3)', () => {
    it('keeps 1.0 first in CURRICULUM_ACTIVITIES and orders all 12 Module 1 activities canonically', () => {
      expect(CURRICULUM_ACTIVITIES[0].id).toBe('1.0');
      expect(CURRICULUM_ACTIVITIES[1].id).toBe('1.1');

      const m1Ids = getActivitiesForModule('module-1').map((a) => a.id);
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

      expect(MODULE_1_ROBOT_ACTIVITIES.map((a) => a.id)).toEqual([
        '1.1',
        '1.2',
        '1.3',
        '1.4',
        '1.5',
        '1A',
      ]);
    });

    it('sorts out-of-order Module 1, Module 2, and Module 3 slices into canonical pedagogical order', () => {
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
        makeStub('3C', 'module-3', 'capstone'),
        makeStub('2B', 'module-2', 'capstone'),
        makeStub('2.1', 'module-2'),
        makeStub('2.5', 'module-2', 'sandbox'),
        makeStub('1C', 'module-1', 'capstone'),
        makeStub('1A', 'module-1', 'capstone'),
        makeStub('1.8', 'module-1', 'sandbox'),
        makeStub('1.0', 'module-1', 'explanation'),
        makeStub('2.7', 'module-2'),
        makeStub('2A', 'module-2', 'capstone'),
        makeStub('2.6', 'module-2', 'explanation'),
        makeStub('3.0', 'module-3', 'explanation'),
        makeStub('3.4', 'module-3', 'sandbox'),
        makeStub('3A', 'module-3', 'capstone'),
        makeStub('3.7', 'module-3', 'sandbox'),
        makeStub('3B', 'module-3', 'capstone'),
        makeStub('1B', 'module-1', 'capstone'),
        makeStub('1.4', 'module-1'),
      ];

      const sortedIds = sortCurriculumActivities(shuffled).map((a) => a.id);
      expect(sortedIds).toEqual([
        '1.0',
        '1.4',
        '1.8',
        '1A',
        '1B',
        '1C',
        '2.1',
        '2.5',
        '2.6',
        '2.7',
        '2A',
        '2B',
        '3.0',
        '3.4',
        '3.7',
        '3A',
        '3B',
        '3C',
      ]);

      // Multi-digit lesson numbers sort numerically rather than lexicographically (5.2 < 5.10)
      expect(compareCurriculumActivityIds('5.2', '5.10')).toBeLessThan(0);
      expect(compareCurriculumActivityIds('5.10', '5A')).toBeLessThan(0);
    });
  });

  describe('2. All 6 Module 1 Robot Puzzles (1.1–1.5, 1A): Reference Solutions, Slot Caps & Scaffolds', () => {
    const robotPuzzleIds = ['1.1', '1.2', '1.3', '1.4', '1.5', '1A'] as const;

    it('validates schema, compact 3x3–4x4 grids, staged palettes, reference solutions, and solver speed (< 50 ms) across 1.1–1A', () => {
      for (const id of robotPuzzleIds) {
        const activity = getActivityLatest(id)!;
        expect(activity).toBeDefined();
        expect(isValidatedPuzzleActivity(activity)).toBe(true);
        expect(activity.moduleId).toBe('module-1');
        expect(activity.version).toBe(1);
        expect(activity.simId).toBe('grid');
        expect(activity.grid).toBeDefined();

        // Compact Module 1 grid dimensions (3x3 to 4x4)
        expect(activity.grid!.width).toBeGreaterThanOrEqual(3);
        expect(activity.grid!.width).toBeLessThanOrEqual(4);
        expect(activity.grid!.height).toBeGreaterThanOrEqual(3);
        expect(activity.grid!.height).toBeLessThanOrEqual(4);

        // Staged Module 1 palette invariants
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

    it('pauses cleanly on PLACEHOLDER for all ? scaffolds (1.4, 1.5, 1A) and solves when filled', () => {
      for (const id of ['1.4', '1.5', '1A'] as const) {
        const activity = getActivityLatest(id)!;
        expect(activity.partialHelp?.mode).toBe('scaffold');
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
        const scafCheck = checkScaffoldWorkspace(activity);
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
    it('Lesson 1.1: preserves 4x3 corridor, Ghost Preview, and proves < 3 blocks cannot reach Goal', () => {
      const act11 = getActivityLatest('1.1')!;
      expect(act11.grid!.width).toBe(4);
      expect(act11.grid!.height).toBe(3);
      expect(act11.slotCap?.maxTotal).toBe(4);
      expect(act11.partialHelp?.mode).toBe('ghost');
      expect(act11.referenceSolution!.MAIN).toHaveLength(3);

      // Prove < 3 blocks (slotCap = 2) yields 0 solutions, and exact minimum is 3 blocks
      const twoSlotActivity: CurriculumActivity = {
        ...act11,
        slotCap: { maxTotal: 2 },
      };
      const underThreeCheck = verifyActivityRule(twoSlotActivity, {
        id: '1.1-min-3-blocks',
        description: 'Cannot reach Goal in fewer than 3 blocks',
        maxLoopNestingDepth: 0,
      });
      expect(underThreeCheck.passed).toBe(true);
      expect(underThreeCheck.minWinningBlocks).toBe(3);
    });

    it('Lesson 1.4 (Visual Step-Debugging): 5-block starter fails unmodified, 1-block replacement reaches SUCCESS, and shortest solution requires >= 5 blocks', () => {
      const act14 = getActivityLatest('1.4')!;
      expect(act14.format).toBe('puzzle');
      expect(act14.icon).toBe('🤖');
      expect(act14.grid!.width).toBe(4);
      expect(act14.grid!.height).toBe(4);
      expect(act14.slotCap?.maxTotal).toBe(6);
      expect(act14.starterWorkspace).toBeDefined();
      expect(act14.starterWorkspace!.MAIN).toHaveLength(5);
      expect(act14.referenceSolution!.MAIN).toHaveLength(5);

      // 1. Unmodified 5-block starterWorkspace fails
      const initialGrid = createCurriculumGridState(act14.grid!);
      const starterRun = runHeadlessSimulation(act14.starterWorkspace!, 'grid', initialGrid, 200);
      expect(starterRun.status).not.toBe('SUCCESS');
      expect(starterRun.status).toBe('COLLISION');

      // 2. Replacing exactly 1 wrong block reaches SUCCESS in 5 blocks
      const editDist = computeWorkspaceEditDistance(
        act14.starterWorkspace!,
        act14.referenceSolution!
      );
      expect(editDist).toBe(1);
      const fixedRun = runHeadlessSimulation(
        act14.referenceSolution!,
        'grid',
        createCurriculumGridState(act14.grid!),
        200
      );
      expect(fixedRun.status).toBe('SUCCESS');

      // 3. '?' scaffold replaces the 1 wrong block (index 2) with PLACEHOLDER so Step-by-Step pauses on '?'
      const scaf = act14.partialHelp!.scaffoldWorkspace!;
      expect(scaf.MAIN).toHaveLength(5);
      expect(scaf.MAIN[2].type).toBe('PLACEHOLDER');
      const scafRun = runHeadlessSimulation(
        scaf,
        'grid',
        createCurriculumGridState(act14.grid!),
        200
      );
      expect(scafRun.status).toBe('PAUSED');
      expect((scafRun.finalState as GridState).robot).toMatchObject({ x: 2, y: 1, dir: 'EAST' });

      // 4. Shortest from-scratch solution requires >= 5 blocks (< 5 blocks cannot reach Goal)
      const fourSlotActivity: CurriculumActivity = {
        ...act14,
        slotCap: { maxTotal: 4 },
      };
      const minFiveCheck = verifyActivityRule(fourSlotActivity, {
        id: '1.4-min-5-blocks',
        description: 'Map walls prevent reaching Goal in fewer than 5 blocks',
        maxLoopNestingDepth: 0,
      });
      expect(minFiveCheck.passed).toBe(true);
      expect(minFiveCheck.minWinningBlocks).toBe(5);
    });

    it('Lesson 1.5 (Ordered Waypoints): direct-to-goal (<= 3 blocks), 2 -> Goal, and 2 -> 1 -> Goal all fail lock, while 1 -> 2 -> Goal succeeds in <= 6 blocks', () => {
      const act15 = getActivityLatest('1.5')!;
      expect(act15.format).toBe('puzzle');
      expect(act15.icon).toBe('🤖');
      expect(act15.grid!.width).toBe(4);
      expect(act15.grid!.height).toBe(4);
      expect(act15.slotCap?.maxTotal).toBe(6);

      const initialGrid = createCurriculumGridState(act15.grid!);
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

      // 1. Direct-to-Goal in 2 blocks (<= 3 blocks): lands on (goal.x, goal.y) and stays padlocked
      const directWs: WorkspaceState = {
        MAIN: [createCurriculumBlock('TURN_RIGHT'), createCurriculumBlock('MOVE_FWD')],
        F1: [],
        F2: [],
        F3: [],
      };
      expect(directWs.MAIN.length).toBeLessThanOrEqual(3);
      const directRun = runHeadlessSimulation(
        directWs,
        'grid',
        createCurriculumGridState(act15.grid!),
        200
      );
      const directState = directRun.finalState as GridState;
      expect(directState.robot.x).toBe(goal.x);
      expect(directState.robot.y).toBe(goal.y);
      expect(directRun.status).not.toBe('SUCCESS');
      expect(directState.flags.find((f) => f.isGoal)!.collected).toBe(false);

      // 2. Visiting Flag 2 -> Goal without Flag 1 leaves Flag 2 and Goal locked
      const twoToGoalWs: WorkspaceState = {
        MAIN: [
          createCurriculumBlock('MOVE_FWD'),
          createCurriculumBlock('MOVE_BACK'),
          createCurriculumBlock('TURN_RIGHT'),
          createCurriculumBlock('MOVE_FWD'),
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const twoToGoalRun = runHeadlessSimulation(
        twoToGoalWs,
        'grid',
        createCurriculumGridState(act15.grid!),
        200
      );
      const twoToGoalState = twoToGoalRun.finalState as GridState;
      expect(twoToGoalRun.status).not.toBe('SUCCESS');
      expect(twoToGoalState.flags.find((f) => f.order === 2)!.collected).toBe(false);
      expect(twoToGoalState.flags.find((f) => f.isGoal)!.collected).toBe(false);

      // 3. Visiting Flag 2 -> Flag 1 -> Goal (without revisiting Flag 2 after unlocking) fails
      const twoOneGoalWs: WorkspaceState = {
        MAIN: [
          createCurriculumBlock('MOVE_FWD'),
          createCurriculumBlock('MOVE_BACK'),
          createCurriculumBlock('MOVE_BACK'),
          createCurriculumBlock('MOVE_FWD'),
          createCurriculumBlock('TURN_RIGHT'),
          createCurriculumBlock('MOVE_FWD'),
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const twoOneGoalRun = runHeadlessSimulation(
        twoOneGoalWs,
        'grid',
        createCurriculumGridState(act15.grid!),
        200
      );
      const twoOneGoalState = twoOneGoalRun.finalState as GridState;
      expect(twoOneGoalRun.status).not.toBe('SUCCESS');
      expect(twoOneGoalState.flags.find((f) => f.order === 1)!.collected).toBe(true);
      expect(twoOneGoalState.flags.find((f) => f.order === 2)!.collected).toBe(false);
      expect(twoOneGoalState.flags.find((f) => f.isGoal)!.collected).toBe(false);

      // 4. Collecting 1 -> 2 -> Goal in order succeeds in <= 6 blocks
      expect(act15.referenceSolution!.MAIN.length).toBeLessThanOrEqual(6);
      const inOrderRun = runHeadlessSimulation(
        act15.referenceSolution!,
        'grid',
        createCurriculumGridState(act15.grid!),
        200
      );
      expect(inOrderRun.status).toBe('SUCCESS');
    });

    it('Capstone 1A (The Compact Labyrinth): synthesizes 3 ordered flags, South/West turns, alcove MOVE_BACK, broken starter leg, and passes all 5 anti-bypass rules < 50 ms', () => {
      const act1A = getActivityLatest('1A')!;
      expect(act1A.format).toBe('capstone');
      expect(act1A.capstoneType).toBe('puzzle');
      expect(act1A.icon).toBe('🏆');
      expect(act1A.grid!.width).toBe(4);
      expect(act1A.grid!.height).toBe(4);
      expect(act1A.grid!.flags).toHaveLength(3);
      expect(act1A.slotCap?.maxTotal).toBe(10);

      const refLen = act1A.referenceSolution!.MAIN.length;
      expect(refLen).toBeGreaterThanOrEqual(8);
      expect(refLen).toBeLessThanOrEqual(10);

      // Broken starter leg fails unmodified
      expect(act1A.starterWorkspace).toBeDefined();
      const starterRun = runHeadlessSimulation(
        act1A.starterWorkspace!,
        'grid',
        createCurriculumGridState(act1A.grid!),
        200
      );
      expect(starterRun.status).not.toBe('SUCCESS');

      // Verify all 5 mandatory §4.3 anti-bypass rules pass cleanly and rapidly
      const report = verifyActivityConstraints(act1A);
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
      expect(moveBackRule?.minWinningBlocks).toBe(11);

      expect(turnLeftRule?.passed).toBe(true);
      expect(turnLeftRule?.minWinningBlocks).toBe(13);

      expect(turnRightRule?.passed).toBe(true);
      expect(turnRightRule?.minWinningBlocks).toBe(11);

      expect(directLockRule?.passed).toBe(true);
      expect(directLockRule?.minWinningBlocks).toBe(5);
    });

    it('integrates cleanly with useAppStore for starter loading, ? scaffold stepping, in-place replacement, and 1-tap Undo on 1.4, 1.5, and 1A', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');

      // 1.4 loads its 5-block buggy starterWorkspace automatically
      store.setCurriculumActivity('1.4');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'MOVE_FWD',
        'TURN_LEFT',
        'MOVE_FWD',
        'MOVE_FWD',
      ]);

      // Load '?' scaffold on 1.4 -> replaces buggy index 2 with PLACEHOLDER, and Undo restores buggy starter!
      expect(store.loadPartialScaffold()).toBe(true);
      expect(useAppStore.getState().workspace.MAIN[2].type).toBe('PLACEHOLDER');
      store.undo();
      expect(useAppStore.getState().workspace.MAIN[2].type).toBe('TURN_LEFT');
      store.redo();

      // Step through 1.4 scaffold -> pauses cleanly at step 3 on PLACEHOLDER, then replace with TURN_RIGHT to solve!
      store.step(); // (1, 1, E)
      store.step(); // (2, 1, E)
      store.step(); // pauses on PLACEHOLDER!
      expect(useAppStore.getState().runtime?.status).toBe('PAUSED');
      const ph14Id = useAppStore.getState().workspace.MAIN[2].id;
      expect(store.replacePlaceholderBlock('MAIN', ph14Id, 'TURN_RIGHT')).toBe(true);
      store.step(); // executes newly placed TURN_RIGHT -> (2, 1, S)
      store.step(); // (2, 2, S)
      store.step(); // (2, 3, S) -> Goal!
      if (useAppStore.getState().grid.status === 'RUNNING') {
        store.step();
      }
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');

      // 1A loads its 4-block broken starter leg automatically, and '?' scaffold solves cleanly when filled
      store.setCurriculumActivity('1A');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_LEFT',
        'MOVE_FWD',
        'MOVE_BACK',
      ]);
      expect(store.loadPartialScaffold()).toBe(true);
      const scaf1A = useAppStore.getState().workspace.MAIN;
      expect(scaf1A.filter((b) => b.type === 'PLACEHOLDER')).toHaveLength(2);
      expect(store.replacePlaceholderBlock('MAIN', scaf1A[1].id, 'TURN_RIGHT')).toBe(true);
      const scaf1AAfterFirst = useAppStore.getState().workspace.MAIN;
      expect(store.replacePlaceholderBlock('MAIN', scaf1AAfterFirst[6].id, 'TURN_LEFT')).toBe(true);
      store.setSpeed('instant');
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
    });
  });
});
