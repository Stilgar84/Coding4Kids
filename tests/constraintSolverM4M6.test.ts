import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  CurriculumActivity,
  createCurriculumBlock,
} from '../src/data/curriculum';
import {
  verifyActivityConstraints,
  verifyActivityRule,
} from '../src/engine/verification/constraintSolver';
import { SolutionModal } from '../src/components/SolutionModal';
import { useAppStore } from '../src/store/useAppStore';

describe('Commit 26: Multi-Scope, Multi-Variant & Variable Anti-Bypass Constraint Solver v2', () => {
  describe('1. Multi-Scope Verification (M4 Grid & Depot)', () => {
    it('verifies M4 Grid Function Puzzle slotCap.perScope.MAIN cap when CALL_F1 is forbidden', () => {
      // Synthetic M4.1 activity:
      // Robot starts at (0, 0) East; goal flag at (3, 0).
      // Reference solution calls F1 in MAIN.
      // Unrolled solution requires 3 MOVE_FWD blocks.
      // If MAIN cap is 2 slots, direct solve without F1 is impossible!
      const activity: CurriculumActivity = {
        id: 'synth-4.1',
        title: 'Synthetic Function Helper',
        simId: 'grid',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: ['CALL_F1'],
          allowedScopes: ['MAIN', 'F1'],
          allowRepeatBadges: false,
        },
        slotCap: {
          perScope: { MAIN: 2, F1: 3 },
          maxTotal: 5,
        },
        grid: {
          width: 5,
          height: 3,
          robot: { x: 0, y: 0, dir: 'EAST' },
          flags: [{ x: 3, y: 0 }],
          barriers: [],
        },
        referenceSolution: {
          MAIN: [createCurriculumBlock('CALL_F1')],
          F1: [
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('MOVE_FWD'),
          ],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-require-f1',
            description: 'Direct solve in MAIN without F1 must fail within MAIN cap (2 slots)',
            forbidBlocks: ['CALL_F1'],
          },
        ],
      };

      const start = performance.now();
      const report = verifyActivityConstraints(activity);
      const elapsed = performance.now() - start;

      expect(report.referenceCheck.reason).toBeUndefined();
      expect(report.referenceCheck.passed).toBe(true);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.passed).toBe(true);
      expect(report.ruleResults[0].minWinningBlocks).toBe(3); // 3 MOVE_FWD > 2 MAIN cap
      expect(elapsed).toBeLessThan(200); // < 200 ms gate
    });

    it('detects a multi-scope bypass when MAIN slot cap is too loose', () => {
      const leakyActivity: CurriculumActivity = {
        id: 'synth-4.1-leaky',
        title: 'Leaky Function Activity',
        simId: 'grid',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['CALL_F1'],
          allowedScopes: ['MAIN', 'F1'],
          allowRepeatBadges: false,
        },
        slotCap: {
          perScope: { MAIN: 4, F1: 3 }, // MAIN cap is 4, but goal needs only 3 MOVE_FWD!
          maxTotal: 7,
        },
        grid: {
          width: 5,
          height: 3,
          robot: { x: 0, y: 0, dir: 'EAST' },
          flags: [{ x: 3, y: 0 }],
          barriers: [],
        },
        referenceSolution: {
          MAIN: [createCurriculumBlock('CALL_F1')],
          F1: [
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('MOVE_FWD'),
          ],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-require-f1',
            description: 'Direct solve in MAIN without F1 must fail within MAIN cap',
            forbidBlocks: ['CALL_F1'],
          },
        ],
      };

      const report = verifyActivityConstraints(leakyActivity);
      expect(report.passed).toBe(false);
      expect(report.ruleResults[0].passed).toBe(false);
      expect(report.ruleResults[0].counterexampleWorkspace).toBeDefined();
      expect(report.ruleResults[0].counterexampleWorkspace?.MAIN.length).toBe(3);
    });

    it('enforces maxLoopNestingDepthPerScope: { MAIN: 0 } on M4 loops in functions', () => {
      const loopActivity: CurriculumActivity = {
        id: 'synth-4.4',
        title: 'Functions and Loops Together',
        simId: 'grid',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['CALL_F1', 'LOOP_START', 'LOOP_END'],
          allowedScopes: ['MAIN', 'F1'],
          allowRepeatBadges: false,
        },
        slotCap: {
          perScope: { MAIN: 2, F1: 4 },
          maxTotal: 6,
        },
        grid: {
          width: 6,
          height: 3,
          robot: { x: 0, y: 0, dir: 'EAST' },
          flags: [{ x: 4, y: 0 }],
          barriers: [],
        },
        referenceSolution: {
          MAIN: [createCurriculumBlock('CALL_F1'), createCurriculumBlock('CALL_F1')],
          F1: [
            createCurriculumBlock('LOOP_START', 2),
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('LOOP_END'),
          ],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-forbid-loops-in-main',
            description: 'Direct solve in MAIN without loop or F1 must fail',
            forbidBlocks: ['CALL_F1'],
            maxLoopNestingDepthPerScope: { MAIN: 0 },
          },
        ],
      };

      const report = verifyActivityConstraints(loopActivity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults[0].passed).toBe(true);
    });

    it('verifies Depot multi-scope rule with CALL_F1 forbidden', () => {
      const depotActivity: CurriculumActivity = {
        id: 'synth-4.6',
        title: 'Depot Double Stack Reversal',
        simId: 'depot',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['DEPOT_MOVE_TO', 'DEPOT_GRAB', 'DEPOT_PLACE', 'DEPOT_SEND_OUT'],
          allowedControlBlocks: ['CALL_F1'],
          allowedScopes: ['MAIN', 'F1'],
        },
        slotCap: {
          perScope: { MAIN: 1, F1: 3 },
          maxTotal: 4,
        },
        depot: {
          workerStation: 0,
          heldCrate: null,
          stacks: [['B'], [], []],
          output: [],
          targetOutput: ['B'],
        },
        referenceSolution: {
          MAIN: [createCurriculumBlock('CALL_F1')],
          F1: [
            createCurriculumBlock('DEPOT_GRAB'),
            createCurriculumBlock('DEPOT_SEND_OUT'),
          ],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-depot-f1',
            description: 'Direct solve in MAIN without F1 must fail within 1 slot',
            forbidBlocks: ['CALL_F1'],
          },
        ],
      };

      const report = verifyActivityConstraints(depotActivity);
      expect(report.passed).toBe(true);
      expect(report.ruleResults[0].passed).toBe(true);
    });
  });

  describe('2. Multi-Variant Product-State BFS & Early Joint Collision Pruning (M5)', () => {
    it('verifies Grid multi-variant with Early Joint Collision Pruning and singleVariantBypassMustExist', () => {
      // 2 variants:
      // Variant 0: Robot starts at (0, 0) East; flag at (2, 0). (Solvable by 2 MOVE_FWD)
      // Variant 1: Robot starts at (0, 0) East; flag at (0, 2). Needs turning South.
      // Rule forbids TURN_RIGHT. Variant 0 can reach (2, 0) directly, but Variant 1 cannot!
      // Product BFS: No straight move sequence solves both variants!
      // singleVariantBypassMustExist: Variant 0 alone CAN be solved by 2 MOVE_FWD.
      const multiGridActivity: CurriculumActivity = {
        id: 'synth-5.1',
        title: 'Multi-Variant Sensing Warmup',
        simId: 'grid',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: ['IF', 'END_IF'],
          allowRepeatBadges: false,
        },
        slotCap: 5,
        gridVariants: [
          {
            width: 4,
            height: 3,
            robot: { x: 0, y: 0, dir: 'EAST' },
            flags: [{ x: 2, y: 0 }],
            barriers: [],
          },
          {
            width: 4,
            height: 3,
            robot: { x: 0, y: 0, dir: 'EAST' },
            flags: [{ x: 0, y: 2 }],
            barriers: [],
          },
        ],
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD'),
            createCurriculumBlock('MOVE_FWD'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-multi-variant-joint-prune',
            description: 'Straight moves cannot solve both East and South goals, but solve Variant 1 alone',
            forbidBlocks: ['TURN_LEFT', 'TURN_RIGHT'],
            singleVariantBypassMustExist: true,
          },
        ],
      };

      const start = performance.now();
      const report = verifyActivityConstraints(multiGridActivity);
      const elapsed = performance.now() - start;

      expect(report.variantCount).toBe(2);
      expect(report.variantResults?.length).toBe(2);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.ruleResults[0].diagnostic).toContain('Multi-variant product verified');
      expect(elapsed).toBeLessThan(200); // < 200 ms gate
    });

    it('verifies Switchyard multi-stream sorting and forbidBlocks: IF constraint', () => {
      const switchyardActivity: CurriculumActivity = {
        id: 'synth-5.5',
        title: 'Switchyard Binary Sorting',
        simId: 'switchyard',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['SWITCH_LEFT', 'SWITCH_RIGHT', 'SEND_NEXT'],
          allowedControlBlocks: ['IF', 'ELSE', 'END_IF', 'LOOP_START', 'LOOP_END'],
          allowRepeatBadges: false,
        },
        slotCap: 8,
        switchyardVariants: [
          {
            queue: [
              { color: 'RED', icon: 'CRATE', damaged: false },
              { color: 'BLUE', icon: 'CRATE', damaged: false },
            ],
            initialDockSpecs: [
              { id: 'DOCK_A', acceptColor: 'RED' },
              { id: 'DOCK_B', acceptColor: 'BLUE' },
            ],
            switches: [{ id: 'A', direction: 'LEFT' }],
          } as any,
          {
            queue: [
              { color: 'BLUE', icon: 'CRATE', damaged: false },
              { color: 'RED', icon: 'CRATE', damaged: false },
            ],
            initialDockSpecs: [
              { id: 'DOCK_A', acceptColor: 'RED' },
              { id: 'DOCK_B', acceptColor: 'BLUE' },
            ],
            switches: [{ id: 'A', direction: 'LEFT' }],
          } as any,
        ],
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('LOOP_START', 2),
            createCurriculumBlock('IF', undefined, { sensor: 'itemColor', param: 'RED' }),
            createCurriculumBlock('SWITCH_LEFT'),
            createCurriculumBlock('ELSE'),
            createCurriculumBlock('SWITCH_RIGHT'),
            createCurriculumBlock('END_IF'),
            createCurriculumBlock('SEND_NEXT'),
            createCurriculumBlock('LOOP_END'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-require-if',
            description: 'Sorting opposing train streams requires IF branching within 8 slots',
            forbidBlocks: ['IF'],
          },
        ],
      };

      const start = performance.now();
      const report = verifyActivityConstraints(switchyardActivity);
      const elapsed = performance.now() - start;

      expect(report.referenceCheck.reason).toBeUndefined();
      expect(report.referenceCheck.passed).toBe(true);
      expect(report.ruleResults[0].passed).toBe(true);
      expect(report.passed).toBe(true);
      expect(report.ruleResults[0].minWinningBlocks).toBeNull();
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('3. Variable & Dial Anti-Bypass Verification (M6)', () => {
    it('proves fixed repeat sequences fail across tile dial variants without variables', () => {
      // 2 variants with different distance requirements:
      // Variant 0: Robot needs 2 steps to flag at (2, 0).
      // Variant 1: Robot needs 4 steps to flag at (4, 0).
      // slotCap: 1 slot.
      // Candidate action has fixed repeat count: ×1, ×2, etc.
      // ×2 reaches flag on Variant 0, but stops 2 steps short on Variant 1!
      // With allowVariables: false, candidate actions have fixed repeat numbers.
      // No fixed repeat can reach SUCCESS on BOTH variants within 1 slot!
      const dialActivity: CurriculumActivity = {
        id: 'synth-6.2',
        title: 'Tile Dial Walking',
        simId: 'grid',
        kind: 'puzzle',
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowRepeatBadges: true,
        },
        slotCap: 1,
        gridVariants: [
          {
            width: 3,
            height: 2,
            robot: { x: 0, y: 0, dir: 'EAST' },
            flags: [{ x: 2, y: 0, isGoal: true }],
            barriers: [],
          },
          {
            width: 6,
            height: 2,
            robot: { x: 0, y: 0, dir: 'EAST' },
            flags: [{ x: 4, y: 0, isGoal: true }],
            barriers: [],
          },
        ],
        referenceSolution: {
          MAIN: [createCurriculumBlock('MOVE_FWD', 2)],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'rule-require-dial-reading',
            description: 'Fixed moves cannot solve both 2-step and 4-step variants within 1 slot',
            allowVariables: false,
            singleVariantBypassMustExist: true,
          },
        ],
      };

      const start = performance.now();
      const ruleRes = verifyActivityRule(dialActivity, dialActivity.antiBypassRules![0]);
      const elapsed = performance.now() - start;

      expect(ruleRes.passed).toBe(true);
      expect(ruleRes.diagnostic).toContain('Multi-variant product verified');
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('4. SolutionModal ?dev=1 Constraint Proofs Inspector', () => {
    it('renders per-variant pass/fail pills and multi-scope counterexamples', () => {
      const origWindow = (globalThis as any).window;
      try {
        (globalThis as any).window = {
          location: { search: '?dev=1' },
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        const s = useAppStore.getState();
        s.setAppMode('curriculum');
        s.setSolutionOpen(true);

        const testActivity: CurriculumActivity = {
          id: 'modal-synth-test',
          title: 'Modal Multi-Variant Proof Inspector',
          simId: 'grid',
          kind: 'puzzle',
          palette: {
            allowedSimBlocks: ['MOVE_FWD'],
          },
          slotCap: 4,
          gridVariants: [
            {
              width: 3,
              height: 2,
              robot: { x: 0, y: 0, dir: 'EAST' },
              flags: [{ x: 1, y: 0, isGoal: true }],
              barriers: [],
            },
            {
              width: 3,
              height: 2,
              robot: { x: 0, y: 0, dir: 'EAST' },
              flags: [{ x: 1, y: 0, isGoal: true }],
              barriers: [],
            },
          ],
          referenceSolution: {
            MAIN: [createCurriculumBlock('MOVE_FWD')],
            F1: [],
            F2: [],
            F3: [],
          },
          antiBypassRules: [
            {
              id: 'test-rule-fail',
              description: 'Synthetic failing rule to test counterexample inspector',
              forbidBlocks: ['TURN_LEFT'],
            },
          ],
        };

        const html = renderToStaticMarkup(
          React.createElement(SolutionModal, {
            activityOverride: testActivity,
            defaultDevProofsExpanded: true,
          })
        );

        // Verify Dev Constraint Proofs section is present
        expect(html).toContain('data-testid="dev-constraint-proofs-section"');
        expect(html).toContain('Constraint Proofs');
        // Verify per-variant pills are rendered
        expect(html).toContain('data-testid="constraint-variant-pills"');
        expect(html).toContain('data-testid="constraint-variant-pill-0"');
        expect(html).toContain('data-testid="constraint-variant-pill-1"');
        // Verify multi-scope counterexample scope rendering
        expect(html).toContain('data-testid="counterexample-scope-MAIN"');
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = origWindow;
        }
      }
    });
  });
});
