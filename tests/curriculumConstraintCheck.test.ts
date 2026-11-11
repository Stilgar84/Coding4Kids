import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  createCurriculumBlock,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import {
  canonicalizeGridState,
  computeWorkspaceEditDistance,
  formatWorkspaceCompact,
  verifyActivityConstraints,
  verifyActivityRule,
} from '../src/engine/verification/constraintSolver';
import { executeRobotAction, DIR_DELTAS } from '../src/engine/physics';
import { SimulationEnvironment, SimActionResult } from '../src/engine/simulation/types';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import {
  SolutionModal,
  isDevProofInspectorEnabled,
  shouldToggleDisclosureOnKey,
} from '../src/components/SolutionModal';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';
import { CellCoord, Direction, GridState, WallEdge } from '../src/types';

/**
 * Helper: given an ordered path of adjacent cells on a `width × height` grid,
 * builds a complete set of interior `WallEdge` barriers sealing every edge NOT
 * traversed by consecutive cells in `corridorCells`.
 */
function buildSealedCorridorBarriers(
  width: number,
  height: number,
  corridorCells: readonly CellCoord[]
): WallEdge[] {
  const openPassages = new Set<string>();
  const edgeKey = (a: CellCoord, b: CellCoord): string => {
    if (a.x === b.x) {
      const maxY = Math.max(a.y, b.y);
      return `H:${a.x},${maxY}`;
    }
    const maxX = Math.max(a.x, b.x);
    return `V:${maxX},${a.y}`;
  };

  for (let i = 0; i + 1 < corridorCells.length; i++) {
    openPassages.add(edgeKey(corridorCells[i], corridorCells[i + 1]));
  }

  const barriers: WallEdge[] = [];
  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!openPassages.has(`H:${x},${y}`)) {
        barriers.push({ orientation: 'H', x, y });
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      if (!openPassages.has(`V:${x},${y}`)) {
        barriers.push({ orientation: 'V', x, y });
      }
    }
  }
  return barriers;
}

/**
 * Lightweight Module 2 interactive world-item simulation environment fixture
 * (exercising `waterCells`, `lockedGates`, `worldItems`, `robot.carriedItem`,
 * `PICK_UP`, and `USE_DROP`) to verify forward-compatible canonicalization & solver rules.
 */
function createMockM2GridEnvironment(): SimulationEnvironment<GridState> {
  return {
    ...gridSimulationEnvironment,
    paletteItems: [
      ...gridSimulationEnvironment.paletteItems,
      {
        id: 'pick-up',
        actionType: 'PICK_UP',
        name: 'Pick Up',
        category: 'item' as any,
        icon: () => null,
        bgClass: 'bg-teal-600',
        borderClass: 'border-teal-400',
        supportsRepeat: false,
      },
      {
        id: 'use-drop',
        actionType: 'USE_DROP',
        name: 'Use / Drop',
        category: 'item' as any,
        icon: () => null,
        bgClass: 'bg-teal-700',
        borderClass: 'border-teal-400',
        supportsRepeat: false,
      },
    ],
    resetState: (state: GridState): GridState => {
      const base = gridSimulationEnvironment.resetState(state);
      const raw = state as unknown as Record<string, any>;
      return {
        ...base,
        robot: {
          ...base.robot,
          ...({ carriedItem: null } as any),
        },
        ...(raw.waterCells
          ? { waterCells: raw.waterCells.map((w: any) => ({ ...w, bridged: Boolean(w.bridged) })) }
          : {}),
        ...(raw.lockedGates
          ? { lockedGates: raw.lockedGates.map((g: any) => ({ ...g, unlocked: Boolean(g.unlocked) })) }
          : {}),
        ...(raw.worldItems
          ? { worldItems: raw.worldItems.map((it: any) => ({ ...it, pickedUp: Boolean(it.pickedUp) })) }
          : {}),
      } as GridState;
    },
    executeAction: (actionType: string, state: GridState): SimActionResult<GridState> => {
      const raw = state as unknown as Record<string, any>;
      const carried = (state.robot as any).carriedItem ?? null;
      const worldItems: Array<Record<string, any>> = raw.worldItems ?? [];
      const waterCells: Array<Record<string, any>> = raw.waterCells ?? [];
      const lockedGates: Array<Record<string, any>> = raw.lockedGates ?? [];

      if (actionType === 'PICK_UP') {
        if (carried !== null) {
          return {
            nextState: { ...state, status: 'COLLISION' },
            status: 'COLLISION',
            isCollision: true,
            isSuccess: false,
          };
        }
        const itemIdx = worldItems.findIndex(
          (it) => !it.pickedUp && it.x === state.robot.x && it.y === state.robot.y
        );
        if (itemIdx === -1) {
          return {
            nextState: { ...state, status: 'COLLISION' },
            status: 'COLLISION',
            isCollision: true,
            isSuccess: false,
          };
        }
        const picked = worldItems[itemIdx];
        const nextItems = worldItems.map((it, idx) =>
          idx === itemIdx ? { ...it, pickedUp: true } : it
        );
        const nextState = {
          ...state,
          robot: { ...state.robot, carriedItem: { type: picked.type, keyId: picked.keyId } },
          worldItems: nextItems,
          status: 'RUNNING',
        } as unknown as GridState;
        return { nextState, status: 'RUNNING', isCollision: false, isSuccess: false };
      }

      if (actionType === 'USE_DROP') {
        if (!carried) {
          return {
            nextState: { ...state, status: 'COLLISION' },
            status: 'COLLISION',
            isCollision: true,
            isSuccess: false,
          };
        }
        const delta = DIR_DELTAS[state.robot.dir];
        const aheadX = state.robot.x + delta.dx;
        const aheadY = state.robot.y + delta.dy;

        if (carried.type === 'key') {
          const gateIdx = lockedGates.findIndex(
            (g) => !g.unlocked && g.x === aheadX && g.y === aheadY && g.keyId === carried.keyId
          );
          if (gateIdx === -1) {
            return {
              nextState: { ...state, status: 'COLLISION' },
              status: 'COLLISION',
              isCollision: true,
              isSuccess: false,
            };
          }
          const nextGates = lockedGates.map((g, idx) =>
            idx === gateIdx ? { ...g, unlocked: true } : g
          );
          const nextState = {
            ...state,
            robot: { ...state.robot, carriedItem: null },
            lockedGates: nextGates,
            status: 'RUNNING',
          } as unknown as GridState;
          return { nextState, status: 'RUNNING', isCollision: false, isSuccess: false };
        }

        if (carried.type === 'plank') {
          const waterIdx = waterCells.findIndex(
            (w) => !w.bridged && w.x === aheadX && w.y === aheadY
          );
          if (waterIdx === -1) {
            return {
              nextState: { ...state, status: 'COLLISION' },
              status: 'COLLISION',
              isCollision: true,
              isSuccess: false,
            };
          }
          const nextWater = waterCells.map((w, idx) =>
            idx === waterIdx ? { ...w, bridged: true } : w
          );
          const nextState = {
            ...state,
            robot: { ...state.robot, carriedItem: null },
            waterCells: nextWater,
            status: 'RUNNING',
          } as unknown as GridState;
          return { nextState, status: 'RUNNING', isCollision: false, isSuccess: false };
        }

        return {
          nextState: { ...state, status: 'COLLISION' },
          status: 'COLLISION',
          isCollision: true,
          isSuccess: false,
        };
      }

      // Check water & locked gate tiles before delegating movement
      if (actionType === 'MOVE_FWD' || actionType === 'MOVE_BACK') {
        const delta = DIR_DELTAS[state.robot.dir];
        const mult = actionType === 'MOVE_FWD' ? 1 : -1;
        const tx = state.robot.x + delta.dx * mult;
        const ty = state.robot.y + delta.dy * mult;

        const hitsUnbridgedWater = waterCells.some(
          (w) => !w.bridged && w.x === tx && w.y === ty
        );
        const hitsLockedGate = lockedGates.some(
          (g) => !g.unlocked && g.x === tx && g.y === ty
        );
        if (hitsUnbridgedWater || hitsLockedGate) {
          return {
            nextState: { ...state, status: 'COLLISION' },
            status: 'COLLISION',
            isCollision: true,
            isSuccess: false,
          };
        }
      }

      const res = executeRobotAction(
        actionType as 'MOVE_FWD' | 'MOVE_BACK' | 'TURN_LEFT' | 'TURN_RIGHT',
        state
      );
      const nextState = {
        ...state,
        robot: {
          ...state.robot,
          x: res.newX,
          y: res.newY,
          dir: res.newDir as Direction,
          carriedItem: carried,
        },
        flags: res.flags,
        trace: res.trace,
        status: res.isCollision ? 'COLLISION' : res.isSuccess ? 'SUCCESS' : 'RUNNING',
      } as unknown as GridState;

      return {
        nextState,
        status: nextState.status,
        isCollision: res.isCollision,
        isSuccess: res.isSuccess,
      };
    },
  };
}

describe('Wave 3 / Commit 5: Automated Anti-Bypass Constraint Solver, CI Perf Gate & Dev Proof Inspector', () => {
  describe('1. Live Curriculum Catalog Anti-Bypass & Performance Gate (< 200 ms)', () => {
    const validatedPuzzles = CURRICULUM_ACTIVITIES.filter(isValidatedPuzzleActivity);

    it('finds validated puzzle activities in CURRICULUM_ACTIVITIES', () => {
      expect(validatedPuzzles.length).toBeGreaterThanOrEqual(3);
    });

    validatedPuzzles.forEach((activity) => {
      it(`Activity ${activity.id} (${activity.title}): solves cleanly, yields 0 bypasses, and finishes < 200 ms`, () => {
        const report = verifyActivityConstraints(activity);

        if (report.elapsedMs > 50) {
          console.warn(
            `[ConstraintSolver Perf Warning] Activity ${activity.id} (${activity.title}) took ${report.elapsedMs.toFixed(
              1
            )} ms (> 50 ms soft threshold)`
          );
        }

        // Hard CI performance gate (< 200 ms per puzzle)
        expect(
          report.elapsedMs,
          `Activity ${activity.id} exceeded the 200 ms CI performance budget (${report.elapsedMs.toFixed(1)} ms)`
        ).toBeLessThan(200);

        // 1. Reference solution must pass within slot/palette caps
        expect(
          report.referenceCheck.passed,
          `Activity ${activity.id} referenceSolution failed: ${report.referenceCheck.reason}`
        ).toBe(true);

        // 2. Scaffold workspace check (when applicable)
        if (report.scaffoldCheck.applicable) {
          expect(
            report.scaffoldCheck.passed,
            `Activity ${activity.id} scaffoldWorkspace failed: ${report.scaffoldCheck.reason}`
          ).toBe(true);
        }

        // 3. Every antiBypassRule must yield 0 winning bypass programs
        expect(activity.antiBypassRules?.length ?? 0).toBeGreaterThan(0);
        for (const ruleRes of report.ruleResults) {
          const failureMsg = ruleRes.passed
            ? ''
            : `Anti-bypass rule '${ruleRes.ruleId}' (${ruleRes.description}) FAILED on Activity ${
                activity.id
              }!\n  Diagnostic: ${ruleRes.diagnostic ?? 'Bypass found'}\n  Offending Bypass Program (${
                ruleRes.minWinningBlocks
              } blocks): ${
                ruleRes.formattedCounterexample ??
                (ruleRes.counterexampleWorkspace
                  ? formatWorkspaceCompact(ruleRes.counterexampleWorkspace)
                  : 'N/A')
              }`;
          expect(ruleRes.passed, failureMsg).toBe(true);
        }

        expect(report.passed).toBe(true);
      });
    });

    it('reports exact restricted minimum block counts (> slotCap) on 1.2 and 1.3', () => {
      const act12 = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.2')!;
      const rep12 = verifyActivityConstraints(act12);
      expect(rep12.passed).toBe(true);
      // Without turns: unreachable (null); without TURN_LEFT or TURN_RIGHT: requires 7 blocks (> 6 slots)
      expect(rep12.ruleResults[0].minWinningBlocks).toBeNull();
      expect(rep12.ruleResults[1].minWinningBlocks).toBe(7);
      expect(rep12.ruleResults[2].minWinningBlocks).toBe(7);

      const act13 = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.3')!;
      const rep13 = verifyActivityConstraints(act13);
      expect(rep13.passed).toBe(true);
      // Turning 180° inside the alcove without MOVE_BACK requires 7 blocks (> 5-slot tray)
      expect(rep13.ruleResults[0].minWinningBlocks).toBe(7);
    });
  });

  describe('2. Exhaustive Rule Coverage & Counterexample Detection on Synthetic Fixtures', () => {
    it('detects a minimal counterexample when a puzzle IS bypassable under forbidBlocks', () => {
      // Intentionally leaky slotCap (7 instead of 5) on 1.3 allows turning 180° without MOVE_BACK!
      const act13 = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.3')!;
      const leakyPuzzle: CurriculumActivity = {
        ...act13,
        id: '1.3-leaky',
        slotCap: { maxTotal: 7 },
      };

      const report = verifyActivityConstraints(leakyPuzzle);
      expect(report.passed).toBe(false);
      expect(report.ruleResults[0].passed).toBe(false);
      expect(report.ruleResults[0].minWinningBlocks).toBe(7);
      expect(report.ruleResults[0].counterexampleWorkspace).toBeDefined();
      expect(report.ruleResults[0].formattedCounterexample).toContain('MOVE_FWD');
      expect(report.ruleResults[0].formattedCounterexample).not.toContain('MOVE_BACK');
    });

    it('verifies allowRepeatBadges: false (proving ×N badges are strictly required)', () => {
      // L-corridor (0,0)->(4,0)->(4,4): 3 blocks with ×4 badges, 9 blocks unrolled (> 5 slots)
      const corridorCells: CellCoord[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
        { x: 4, y: 3 },
        { x: 4, y: 4 },
      ];

      const repeatPuzzle: CurriculumActivity = {
        id: 'syn-2.1',
        moduleId: 'module-2',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🤖',
        title: 'Repeat Badges Required',
        concept: 'Action Repeat Badges',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: [],
          allowRepeatBadges: true,
        },
        slotCap: { maxTotal: 5 },
        grid: {
          width: 5,
          height: 5,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: buildSealedCorridorBarriers(5, 5, corridorCells),
          flags: [{ id: 'g', x: 4, y: 4, isGoal: true, order: 1, collected: false }],
        },
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', 4),
            createCurriculumBlock('TURN_RIGHT'),
            createCurriculumBlock('MOVE_FWD', 4),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'require-repeat-badges',
            description: 'Cannot solve 9-step L-corridor in 5 slots without ×N badges',
            allowRepeatBadges: false,
          },
        ],
      };

      const report = verifyActivityConstraints(repeatPuzzle);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.ruleResults[0].minWinningBlocks).toBe(9);
    });

    it('verifies maxLoopNestingDepth: 0 and pureSingleLoopOnly: true (setup + loop puzzle)', () => {
      // Setup: (0,3,N) -> (0,0,N) -> TURN_RIGHT (East) [2 blocks: MOVE_FWD ×3, TURN_RIGHT]
      // Loop ×3: [MOVE_FWD, TURN_RIGHT, MOVE_FWD, TURN_LEFT] stepping (0,0)->(1,0)->(1,1)->(2,1)->(2,2)->(3,2)->(3,3)
      const path: CellCoord[] = [
        { x: 0, y: 3 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
      ];

      const loopSetupPuzzle: CurriculumActivity = {
        id: 'syn-3.2',
        moduleId: 'module-3',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🔁',
        title: 'Setup Before Loop',
        concept: 'Pre-Loop Setup + Multi-Block Loop',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
          allowRepeatBadges: true,
        },
        slotCap: { maxTotal: 8 },
        grid: {
          width: 4,
          height: 4,
          robot: { x: 0, y: 3, dir: 'NORTH' },
          barriers: buildSealedCorridorBarriers(4, 4, path),
          flags: [{ id: 'g', x: 3, y: 3, isGoal: true, order: 1, collected: false }],
        },
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', 3),
            createCurriculumBlock('TURN_RIGHT'),
            createCurriculumBlock('LOOP_START', 3),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('TURN_RIGHT'),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('TURN_LEFT'),
            createCurriculumBlock('LOOP_END'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'require-loop',
            description: 'Cannot solve staircase without loops in 8 slots',
            maxLoopNestingDepth: 0,
          },
          {
            id: 'require-pre-loop-setup',
            description: 'Cannot absorb 3-cell North setup corridor into a single outer loop',
            pureSingleLoopOnly: true,
          },
        ],
      };

      const report = verifyActivityConstraints(loopSetupPuzzle);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[0].minWinningBlocks).toBe(13);
      expect(report.ruleResults[1].passed).toBe(true);

      // Conversely, if robot starts directly at (0, 0, EAST), a pure single loop DOES solve it — solver must catch it!
      const noSetupPuzzle: CurriculumActivity = {
        ...loopSetupPuzzle,
        id: 'syn-3.2-bypassable',
        grid: {
          ...loopSetupPuzzle.grid!,
          robot: { x: 0, y: 0, dir: 'EAST' },
        },
      };
      const pureRuleCheck = verifyActivityRule(
        noSetupPuzzle,
        noSetupPuzzle.antiBypassRules![1],
        1
      );
      expect(pureRuleCheck.passed).toBe(false);
      expect(pureRuleCheck.minWinningBlocks).toBe(6);
      expect(pureRuleCheck.formattedCounterexample).toContain('LOOP_START ×3');
    });

    it('verifies maxLoopNestingDepth: 1 (proving true nested loops depth >= 2 are required)', () => {
      // 3 outer sides × 3 inner stair-steps on a 7×7 diamond path:
      // Nested loop uses 9 slots; shortest flat loop (depth <= 1) requires 12 slots!
      const diamondPath: CellCoord[] = [
        // Outer 1 from (0,3,N): 3× [F, R, F, L] + R -> (3,0,E)
        { x: 0, y: 3 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        // Outer 2 from (3,0,E): 3× [F, R, F, L] + R -> (6,3,S)
        { x: 4, y: 0 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 6, y: 2 },
        { x: 6, y: 3 },
        // Outer 3 from (6,3,S): 3× [F, R, F, L] -> Goal at (3,6)
        { x: 6, y: 4 },
        { x: 5, y: 4 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 6 },
        { x: 3, y: 6 },
      ];

      const nestedLoopPuzzle: CurriculumActivity = {
        id: 'syn-3.6',
        moduleId: 'module-3',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🔁',
        title: 'Nested Diamond Stairs',
        concept: 'Nested Loops (Depth 2)',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
          allowRepeatBadges: true,
        },
        slotCap: { maxTotal: 9 },
        grid: {
          width: 7,
          height: 7,
          robot: { x: 0, y: 3, dir: 'NORTH' },
          barriers: buildSealedCorridorBarriers(7, 7, diamondPath),
          flags: [{ id: 'g', x: 3, y: 6, isGoal: true, order: 1, collected: false }],
        },
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('LOOP_START', 3),
            createCurriculumBlock('LOOP_START', 3),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('TURN_RIGHT'),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('TURN_LEFT'),
            createCurriculumBlock('LOOP_END'),
            createCurriculumBlock('TURN_RIGHT'),
            createCurriculumBlock('LOOP_END'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'require-nested-loops',
            description: 'Flat sequential loops (depth <= 1) cannot solve 3×3 diamond stairs in 9 slots',
            maxLoopNestingDepth: 1,
          },
        ],
      };

      const report = verifyActivityConstraints(nestedLoopPuzzle);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
    });

    it('verifies M2 interactive world-item canonicalization, PICK_UP/USE_DROP, and maxActionExecutions', () => {
      // Single 1×6 corridor: Start(0,0,E) -> Key(1,0) -> Gate(2,0) -> Plank(3,0) -> Water(4,0) -> Goal(5,0)
      const corridor: CellCoord[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ];

      const supplyCourierPuzzle: CurriculumActivity = {
        id: 'syn-2A',
        moduleId: 'module-2',
        version: 1,
        format: 'capstone',
        capstoneType: 'puzzle',
        simId: 'grid',
        icon: '🏆',
        title: 'Synthetic Supply Courier',
        concept: 'Key + Locked Gate + Plank + Water',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT', 'PICK_UP', 'USE_DROP'],
          allowedControlBlocks: [],
          allowRepeatBadges: true,
        },
        slotCap: { maxTotal: 8 },
        grid: {
          width: 6,
          height: 1,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: buildSealedCorridorBarriers(6, 1, corridor),
          flags: [{ id: 'goal', x: 5, y: 0, isGoal: true, order: 1, collected: false }],
          waterCells: [{ x: 4, y: 0 }],
          lockedGates: [{ id: 'gate_1', x: 2, y: 0, shape: 'circle', color: 'amber', unlocked: false }],
          worldItems: [
            { id: 'item_key', type: 'key', shape: 'circle', color: 'amber', x: 1, y: 0 },
            { id: 'item_plank', type: 'plank', x: 3, y: 0 },
          ],
        },
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('PICK_UP'),
            createCurriculumBlock('USE_DROP'),
            createCurriculumBlock('MOVE_FWD', 2),
            createCurriculumBlock('PICK_UP'),
            createCurriculumBlock('USE_DROP'),
            createCurriculumBlock('MOVE_FWD', 2),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'forbid-items',
            description: 'Cannot cross locked gate or water without PICK_UP / USE_DROP',
            forbidBlocks: ['PICK_UP', 'USE_DROP'],
          },
          {
            id: 'require-both-uses',
            description: 'Cannot skip either Key+Gate or Plank+Water (requires >= 2 USE_DROP executions)',
            maxActionExecutions: { USE_DROP: 1 },
          },
          {
            id: 'require-repeat-badges',
            description: 'Cannot fit inside 8-slot tray without ×N badges',
            allowRepeatBadges: false,
          },
        ],
      };

      const report = verifyActivityConstraints(supplyCourierPuzzle);
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[1].passed).toBe(true);
      expect(report.ruleResults[2].passed).toBe(true);
      expect(report.ruleResults[2].minWinningBlocks).toBe(9);

      // Verify state canonicalization distinguishes carried item, gate state, and bridged water
      const mockM2Env = createMockM2GridEnvironment();
      const s0 = mockM2Env.resetState(
        {
          width: 6,
          height: 1,
          robot: { x: 1, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
          barriers: [],
          flags: [],
          trace: [],
          status: 'IDLE',
          showTrace: true,
          waterCells: [{ x: 4, y: 0, bridged: false }],
          lockedGates: [{ id: 'g1', x: 2, y: 0, unlocked: false }],
          worldItems: [{ type: 'key', keyId: 'gold', x: 1, y: 0, pickedUp: false }],
        } as unknown as GridState
      );
      const afterPickup = mockM2Env.executeAction('PICK_UP', {
        ...s0,
        robot: { ...s0.robot, x: 1, y: 0 },
      }).nextState;
      expect(canonicalizeGridState(afterPickup, s0)).not.toBe(
        canonicalizeGridState({ ...s0, robot: { ...s0.robot, x: 1, y: 0 } }, s0)
      );

      // Allowing 2 USE_DROP executions finds the 7-block winning solution
      const allowTwoRule = verifyActivityRule(
        supplyCourierPuzzle,
        {
          id: 'allow-2-uses',
          description: '2 USE_DROP executions CAN solve',
          maxActionExecutions: { USE_DROP: 2 },
        },
        0
      );
      expect(allowTwoRule.passed).toBe(false);
      expect(allowTwoRule.minWinningBlocks).toBe(7);
    });

    it('verifies unmodifiedStarterMustFail, minStarterEditDistance, directToGoalMustFailLock, and ? scaffolds', () => {
      expect(
        computeWorkspaceEditDistance(
          { MAIN: [createCurriculumBlock('MOVE_FWD'), createCurriculumBlock('TURN_LEFT')], F1: [], F2: [], F3: [] },
          { MAIN: [createCurriculumBlock('MOVE_FWD'), createCurriculumBlock('TURN_RIGHT')], F1: [], F2: [], F3: [] }
        )
      ).toBe(1);

      // Ordered-waypoint + buggy-starter + '?' scaffold puzzle:
      // Robot at (1, 1, EAST):
      // - Goal is at (2, 1) (just 1 step East! Direct path = 1 block, stays padlocked!)
      // - Flag 1 is at (0, 1) (1 step West via MOVE_BACK, then MOVE_FWD ×2 to Goal = 3 blocks, or unrolled 3 blocks)
      const debugAndLockPuzzle: CurriculumActivity = {
        id: 'syn-1.4-1.5',
        moduleId: 'module-1',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🤖',
        title: 'Debug & Padlocked Goal',
        concept: 'Ordered Waypoints & Debugging',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: [],
          allowRepeatBadges: false,
        },
        slotCap: { maxTotal: 4 },
        grid: {
          width: 3,
          height: 3,
          robot: { x: 1, y: 1, dir: 'EAST' },
          barriers: [],
          flags: [
            { id: 'f1', x: 0, y: 1, isGoal: false, order: 1, collected: false },
            { id: 'goal', x: 2, y: 1, isGoal: true, order: 2, collected: false },
          ],
        },
        // Starter has 2 wrong blocks -> requires edit distance >= 2 to fix!
        starterWorkspace: {
          MAIN: [
            createCurriculumBlock('TURN_LEFT'),
            createCurriculumBlock('TURN_LEFT'),
            createCurriculumBlock('MOVE_FWD'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        partialHelp: {
          mode: 'scaffold',
          scaffoldWorkspace: {
            MAIN: [
              { id: 'scaf_1', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
              createCurriculumBlock('MOVE_FWD'),
              createCurriculumBlock('MOVE_FWD'),
            ],
            F1: [],
            F2: [],
            F3: [],
          },
        },
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('MOVE_BACK'),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('MOVE_FWD'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'starter-must-fail',
            description: 'Unmodified starter must fail and require >= 2 edits',
            unmodifiedStarterMustFail: true,
            minStarterEditDistance: 2,
          },
          {
            id: 'goal-padlocked',
            description: 'Stepping directly onto (2,1) in 1 block leaves Goal padlocked',
            directToGoalMustFailLock: true,
          },
        ],
      };

      const report = verifyActivityConstraints(debugAndLockPuzzle);
      expect(report.passed).toBe(true);
      expect(report.scaffoldCheck.applicable).toBe(true);
      expect(report.scaffoldCheck.passed).toBe(true);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[1].passed).toBe(true);
      expect(report.ruleResults[1].minWinningBlocks).toBe(1);

      // Asking for minStarterEditDistance: 3 fails because a 2-edit solution exists!
      const editDist3Check = verifyActivityRule(
        debugAndLockPuzzle,
        {
          id: 'too-strict-edit-dist',
          description: 'Requires 3 edits',
          minStarterEditDistance: 3,
        },
        0
      );
      expect(editDist3Check.passed).toBe(false);
      expect(editDist3Check.counterexampleWorkspace).toBeDefined();
    });
  });

  describe('3. SolutionModal ?dev=1 Constraint Proofs Inspector & Accessibility', () => {
    const originalWindow = (globalThis as any).window;

    beforeEach(() => {
      clearPendingUpdateState();
      const s = useAppStore.getState();
      s.pause();
      s.setAppMode('curriculum');
      s.setCurriculumActivity('1.2');
      s.setSolutionOpen(true);
    });

    afterEach(() => {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
      useAppStore.getState().setSolutionOpen(false);
    });

    it('detects ?dev=1 accurately via isDevProofInspectorEnabled and handles Enter/Space toggle keys', () => {
      expect(isDevProofInspectorEnabled('')).toBe(false);
      expect(isDevProofInspectorEnabled('?dev=0')).toBe(false);
      expect(isDevProofInspectorEnabled('?foo=bar')).toBe(false);
      expect(isDevProofInspectorEnabled('?dev=1')).toBe(true);
      expect(isDevProofInspectorEnabled('?mode=learn&dev=1')).toBe(true);

      expect(shouldToggleDisclosureOnKey('Enter')).toBe(true);
      expect(shouldToggleDisclosureOnKey(' ')).toBe(true);
      expect(shouldToggleDisclosureOnKey('Tab')).toBe(false);
      expect(shouldToggleDisclosureOnKey('Escape')).toBe(false);
    });

    it('hides Constraint Proofs in normal mode and renders accessible proofs + counterexamples when ?dev=1', () => {
      // 1. Normal mode (no ?dev=1): inspector must NOT render
      (globalThis as any).window = {
        location: { search: '' },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      const normalHtml = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(normalHtml).toContain('data-testid="solution-modal"');
      expect(normalHtml).not.toContain('data-testid="dev-constraint-proofs-section"');
      expect(normalHtml).not.toContain('Constraint Proofs');

      // 2. Dev mode (?dev=1) on valid puzzle 1.2: renders verified badges, timing in ms, and aria-expanded
      (globalThis as any).window = {
        location: { search: '?dev=1' },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      const devHtml = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(devHtml).toContain('data-testid="dev-constraint-proofs-section"');
      expect(devHtml).toContain('data-testid="btn-toggle-constraint-proofs"');
      expect(devHtml).toContain('aria-expanded="true"');
      expect(devHtml).toContain('aria-controls="dev-constraint-proofs-panel"');
      expect(devHtml).toContain('Constraint Proofs');
      expect(devHtml).toContain('Verified');
      expect(devHtml).toContain('ms');
      expect(devHtml).toContain('data-testid="constraint-rule-1.2-require-turn-left"');
      expect(devHtml).toContain('data-rule-passed="true"');

      // 3. Collapsed disclosure state (`defaultDevProofsExpanded={false}`) sets aria-expanded="false" and hides panel
      const collapsedHtml = renderToStaticMarkup(
        React.createElement(SolutionModal, { defaultDevProofsExpanded: false })
      );
      expect(collapsedHtml).toContain('data-testid="btn-toggle-constraint-proofs"');
      expect(collapsedHtml).toContain('aria-expanded="false"');
      expect(collapsedHtml).not.toContain('data-testid="dev-constraint-proofs-panel"');

      // 4. Bypassable puzzle renders FAIL badge and formatted counterexample sequence
      const act13 = CURRICULUM_ACTIVITIES.find((a) => a.id === '1.3')!;
      const bypassableActivity: CurriculumActivity = {
        ...act13,
        id: '1.3-broken',
        slotCap: { maxTotal: 7 },
      };
      const failHtml = renderToStaticMarkup(
        React.createElement(SolutionModal, { activityOverride: bypassableActivity })
      );
      expect(failHtml).toContain('Bypass Found');
      expect(failHtml).toContain('data-rule-passed="false"');
      expect(failHtml).toContain('data-testid="constraint-counterexample"');
      expect(failHtml).toContain('Offending Bypass Counterexample:');
    });
  });
});
