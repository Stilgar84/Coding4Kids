import { describe, it, expect } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_4_PUZZLE_ACTIVITIES,
  getActivitiesForModule,
  getActivityLatest,
} from '../src/data/curriculum';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';

describe('Commit 29: Module 4 Validated Robot & Depot Function Puzzles', () => {
  describe('1. Activity Registration & Ordering', () => {
    it('registers all 5 Module 4 puzzles (4.1, 4.4, 4.5, 4.6, 4A)', () => {
      expect(MODULE_4_PUZZLE_ACTIVITIES).toHaveLength(5);
      const puzzleIds = MODULE_4_PUZZLE_ACTIVITIES.map((a) => a.id);
      expect(puzzleIds).toEqual(['4.1', '4.4', '4.5', '4.6', '4A']);

      for (const id of puzzleIds) {
        const act = getActivityLatest(id);
        expect(act).toBeDefined();
        expect(act?.moduleId).toBe('module-4');
      }
    });

    it('orders Module 4 activities canonically in CURRICULUM_ACTIVITIES', () => {
      const m4Activities = getActivitiesForModule('module-4');
      const m4Ids = m4Activities.map((a) => a.id);

      // Total Module 4 activities: 10 activities (4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4A, 4B, 4C)
      expect(m4Ids).toEqual([
        '4.0',
        '4.1',
        '4.2',
        '4.3',
        '4.4',
        '4.5',
        '4.6',
        '4A',
        '4B',
        '4C',
      ]);
    });
  });

  describe('2. Anti-Bypass & Constraint Verification (< 200 ms per puzzle)', () => {
    for (const puzzle of MODULE_4_PUZZLE_ACTIVITIES) {
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
        expect(elapsed).toBeLessThan(200);
      });
    }
  });
});
