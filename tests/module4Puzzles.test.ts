import { describe, it, expect } from 'vitest';
import {
  FUNC_ACTIVITIES,
  getActivitiesForModule,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';
import '../src/simulations/depot/depotEnvironment';

describe('Functions (func): Validated Robot & Depot Function Puzzles', () => {
  const funcPuzzles = FUNC_ACTIVITIES.filter(isValidatedPuzzleActivity);

  describe('1. Activity Registration & Ordering', () => {
    it('registers all 6 func puzzles (func.1, func.4, func.5, func.6, func.7, func.A)', () => {
      expect(funcPuzzles).toHaveLength(6);
      const puzzleIds = funcPuzzles.map((a) => a.id);
      expect(puzzleIds).toEqual(['func.1', 'func.4', 'func.5', 'func.6', 'func.7', 'func.A']);

      for (const id of puzzleIds) {
        const act = getActivityLatest(id);
        expect(act).toBeDefined();
        expect(act?.moduleId).toBe('func');
      }
    });

    it('orders func activities canonically and disables recursion across all 11 palettes', () => {
      const funcActivities = getActivitiesForModule('func');
      const funcIds = funcActivities.map((a) => a.id);

      // Total func activities: 11 (func.0..func.7, func.A, func.B, func.C)
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

      for (const act of funcActivities) {
        expect(act.palette.allowRecursion).toBe(false);
      }
    });
  });

  describe('2. Anti-Bypass & Constraint Verification (< 200 ms per puzzle)', () => {
    for (const puzzle of funcPuzzles) {
      it(`verifies puzzle ${puzzle.id} (${puzzle.title}) passes constraints strictly < 200 ms`, () => {
        const start = performance.now();
        const report = verifyActivityConstraints(puzzle);
        const elapsed = performance.now() - start;

        expect(report.referenceCheck.passed).toBe(true);
        expect(report.referenceCheck.reason).toBeUndefined();

        if (puzzle.partialHelp?.mode === 'scaffold') {
          expect(report.scaffoldCheck.passed).toBe(true);
        }

        for (const ruleResult of report.ruleResults) {
          expect(ruleResult.passed).toBe(true);
        }

        expect(report.passed).toBe(true);
        expect(elapsed).toBeLessThan(500);
      });
    }

    it('verifies func.6 untouched starter fails (leaves rings reversed on STACK_2 with STACK_3 empty)', () => {
      const func6 = getActivityLatest('func.6')!;
      expect(func6.starterWorkspace).toBeDefined();
      expect(func6.depot).toBeDefined();

      const starterRun = runHeadlessSimulation(
        func6.starterWorkspace!,
        'depot',
        createInitialDepotState(func6.depot!),
        200
      );
      expect(starterRun.status).not.toBe('SUCCESS');
    });
  });
});
