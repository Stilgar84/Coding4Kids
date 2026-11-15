import { describe, expect, it } from 'vitest';
import { VAR_ACTIVITIES } from '../src/data/curriculum/varActivities';
import {
  ConditionExpr,
  CurriculumActivity,
  CurriculumGridDefinition,
  ScopeType,
  createCurriculumGridState,
} from '../src/data/curriculum/types';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  checkReferenceSolution,
  checkScaffoldWorkspace,
  verifyActivityConstraints,
} from '../src/engine/verification/constraintSolver';
import { exportLessonToBinary, importFromBinary } from '../src/engine/serialization/codeSerializer';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import { isBeatLedOffHex } from '../src/simulations/beat/presets';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { turtleSimulationEnvironment } from '../src/simulations/turtle/turtleEnvironment';
import { beatSimulationEnvironment } from '../src/simulations/beat/beatEnvironment';
import { ALL_SCOPES, computeSlotBudget, computeStagedPalettePolicy } from '../src/utils/curriculumStagePolicy';
import { useAppStore } from '../src/store/useAppStore';
import { CodeBlock, WorkspaceState } from '../src/types';
import { TurtleState } from '../src/simulations/turtle/types';

// Ensure all three simulation environments are registered
void gridSimulationEnvironment;
void turtleSimulationEnvironment;
void beatSimulationEnvironment;

const EXPECTED_VAR_ORDER = [
  'var.0',
  'var.1',
  'var.2',
  'var.3',
  'var.4',
  'var.4a',
  'var.5',
  'var.6',
  'var.7',
  'var.8',
  'var.9',
  'var.10',
  'var.A',
  'var.B',
  'var.M1',
  'var.M2',
] as const;

const COPILOT_IDS = new Set(['var.0', 'var.3', 'var.6', 'var.8']);
const PUZZLE_AND_M1_IDS = new Set(['var.2', 'var.4', 'var.4a', 'var.A', 'var.M1']);
const VALIDATED_OP_SET = new Set(['+', '-', '*']);
const SINGLE_LOWERCASE_VAR_RE = /^[a-z]$/;

function getActivity(id: string): CurriculumActivity {
  const act = VAR_ACTIVITIES.find((a) => a.id === id);
  if (!act) throw new Error(`Missing activity '${id}' in VAR_ACTIVITIES`);
  return act;
}

function collectAllWorkspaces(
  activity: CurriculumActivity
): Array<{ label: string; simId: 'grid' | 'turtle' | 'beat'; workspace: WorkspaceState }> {
  const entries: Array<{
    label: string;
    simId: 'grid' | 'turtle' | 'beat';
    workspace: WorkspaceState;
  }> = [];
  const defaultSimId = activity.simId as 'grid' | 'turtle' | 'beat';

  entries.push({ label: 'starterWorkspace', simId: defaultSimId, workspace: activity.starterWorkspace });
  if (activity.referenceSolution) {
    entries.push({
      label: 'referenceSolution',
      simId: defaultSimId,
      workspace: activity.referenceSolution,
    });
  }
  if (activity.partialHelp?.scaffoldWorkspace) {
    entries.push({
      label: 'partialHelp.scaffoldWorkspace',
      simId: defaultSimId,
      workspace: activity.partialHelp.scaffoldWorkspace,
    });
  }
  if (activity.variations) {
    for (const v of activity.variations) {
      entries.push({ label: `variation:${v.id}`, simId: defaultSimId, workspace: v.workspace });
    }
  }
  if (activity.demoTabs) {
    for (const tab of activity.demoTabs) {
      if (tab.workspace) {
        entries.push({
          label: `demoTab:${tab.id}`,
          simId: (tab.simId ?? defaultSimId) as 'grid' | 'turtle' | 'beat',
          workspace: tab.workspace,
        });
      }
    }
  }
  return entries;
}

function visitCondition(expr: ConditionExpr | undefined, cb: (node: ConditionExpr) => void): void {
  if (!expr) return;
  cb(expr);
  if (expr.kind === 'not') {
    visitCondition(expr.operand, cb);
  } else if (expr.kind === 'and' || expr.kind === 'or') {
    visitCondition(expr.left, cb);
    visitCondition(expr.right, cb);
  }
}

function assertBalancedControlStructure(blocks: CodeBlock[], contextLabel: string): void {
  const stack: string[] = [];
  for (const b of blocks) {
    if (b.type === 'LOOP_START') stack.push('LOOP');
    else if (b.type === 'LOOP_END') {
      expect(stack.pop(), `${contextLabel}: unmatched LOOP_END`).toBe('LOOP');
    } else if (b.type === 'WHILE') stack.push('WHILE');
    else if (b.type === 'END_WHILE') {
      expect(stack.pop(), `${contextLabel}: unmatched END_WHILE`).toBe('WHILE');
    } else if (b.type === 'IF') stack.push('IF');
    else if (b.type === 'ELSE' || b.type === 'ELSE_IF') {
      expect(stack[stack.length - 1], `${contextLabel}: ${b.type} without IF`).toBe('IF');
    } else if (b.type === 'END_IF') {
      expect(stack.pop(), `${contextLabel}: unmatched END_IF`).toBe('IF');
    }
  }
  expect(stack, `${contextLabel}: unclosed control block(s)`).toEqual([]);
}

function computeTurtleInkMaxSpan(state: TurtleState): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of state.paths) {
    minX = Math.min(minX, item.fromX, item.toX);
    maxX = Math.max(maxX, item.fromX, item.toX);
    minY = Math.min(minY, item.fromY, item.toY);
    maxY = Math.max(maxY, item.fromY, item.toY);
  }
  if (!Number.isFinite(minX)) return 0;
  return Math.max(maxX - minX, maxY - minY);
}

function countLitLeds(leds: string[][]): number {
  let count = 0;
  for (const row of leds) {
    for (const hex of row) {
      if (!isBeatLedOffHex(hex)) count++;
    }
  }
  return count;
}

describe('Module var Curriculum & Anti-Bypass Verification', () => {
  it('boots app store in curriculum mode by default', () => {
    expect(useAppStore.getState().appMode).toBe('curriculum');
  });

  it('defines all 16 activities in exact var/overview.md order with valid metadata', () => {
    expect(VAR_ACTIVITIES).toHaveLength(16);
    expect(VAR_ACTIVITIES.map((a) => a.id)).toEqual([...EXPECTED_VAR_ORDER]);

    for (const act of VAR_ACTIVITIES) {
      expect(act.moduleId).toBe('var');
      expect(act.version).toBe(1);
      expect(act.title.length).toBeGreaterThan(0);
      expect(act.palette.allowVariables).toBe(true);
      expect(act.palette.allowedVariableNames?.length).toBeGreaterThan(0);
      for (const varName of act.palette.allowedVariableNames ?? []) {
        expect(SINGLE_LOWERCASE_VAR_RE.test(varName), `${act.id} var '${varName}'`).toBe(true);
      }
    }
  });

  it('places Guided Co-Pilot cards ONLY on var.0, var.3, var.6, var.8', () => {
    for (const act of VAR_ACTIVITIES) {
      if (COPILOT_IDS.has(act.id)) {
        expect(act.coPilotCard?.trim().length, `${act.id} coPilotCard`).toBeGreaterThan(0);
        expect(act.demoTabs?.length ?? 0, `${act.id} demoTabs`).toBeGreaterThan(0);
        for (const tab of act.demoTabs ?? []) {
          expect(tab.coPilotCard?.trim().length, `${act.id}:${tab.id} coPilotCard`).toBeGreaterThan(
            0
          );
        }
      } else {
        expect(act.coPilotCard, `${act.id} must NOT have coPilotCard`).toBeUndefined();
        for (const tab of act.demoTabs ?? []) {
          expect(tab.coPilotCard, `${act.id}:${tab.id} must NOT have coPilotCard`).toBeUndefined();
        }
      }
    }
  });

  it('enforces +, -, * only (no /, %, or CMP) and strict 3-address variable rules', () => {
    for (const act of VAR_ACTIVITIES) {
      for (const op of act.palette.allowedVarOps ?? []) {
        expect(VALIDATED_OP_SET.has(op), `${act.id} disallowed op '${op}'`).toBe(true);
      }
      expect(act.palette.allowedCmpOps, `${act.id} should not unlock CMP`).toBeUndefined();

      const allowedVars = new Set(act.palette.allowedVariableNames ?? []);
      const allowedSensors = new Set(act.palette.allowedValueSensors ?? []);

      for (const entry of collectAllWorkspaces(act)) {
        for (const scope of ALL_SCOPES) {
          const blocks = entry.workspace[scope] ?? [];
          assertBalancedControlStructure(blocks, `${act.id}:${entry.label}:${scope}`);

          for (const blk of blocks) {
            if (blk.type === 'VAR_ASSIGN') {
              const target = blk.params?.a;
              const src = blk.params?.b;
              expect(typeof target).toBe('string');
              expect(SINGLE_LOWERCASE_VAR_RE.test(String(target))).toBe(true);
              expect(allowedVars.has(String(target)), `${act.id} undeclared var ${target}`).toBe(
                true
              );
              if (typeof src === 'string' && src.startsWith('$')) {
                expect(allowedSensors.has(src), `${act.id} undeclared sensor ${src}`).toBe(true);
              } else if (typeof src === 'string') {
                expect(allowedVars.has(src), `${act.id} undeclared source var ${src}`).toBe(true);
              } else {
                expect(typeof src).toBe('number');
              }
            }

            if (blk.type === 'VAR_OP') {
              const target = blk.params?.a;
              const left = blk.params?.b;
              const op = blk.params?.op;
              const right = blk.params?.c;
              expect(VALIDATED_OP_SET.has(String(op)), `${act.id} VAR_OP '${op}'`).toBe(true);
              expect(allowedVars.has(String(target)), `${act.id} VAR_OP target ${target}`).toBe(
                true
              );
              for (const operand of [left, right]) {
                if (typeof operand === 'string') {
                  expect(allowedVars.has(operand), `${act.id} operand var ${operand}`).toBe(true);
                } else {
                  expect(typeof operand).toBe('number');
                }
              }
            }

            if (blk.type === 'IF' || blk.type === 'ELSE_IF' || blk.type === 'WHILE') {
              visitCondition(blk.params?.condition as ConditionExpr | undefined, (node) => {
                expect(node.kind, `${act.id} must not use CMP conditions`).not.toBe('cmp');
              });
            }

            if (typeof blk.repeatCount === 'string') {
              expect(
                allowedVars.has(blk.repeatCount),
                `${act.id} repeatCount '${blk.repeatCount}'`
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it('enforces slotCap budgets, allowRepeatBadges, and neutral ? PLACEHOLDERs', () => {
    const repeatRequiredIds = [
      'var.1',
      'var.2',
      'var.4',
      'var.4a',
      'var.6',
      'var.7',
      'var.8',
      'var.9',
      'var.10',
      'var.A',
      'var.B',
      'var.M1',
      'var.M2',
    ];
    for (const id of repeatRequiredIds) {
      const act = getActivity(id);
      expect(act.palette.allowRepeatBadges, `${id} allowRepeatBadges`).toBe(true);
      const policy = computeStagedPalettePolicy('curriculum', act, []);
      expect(policy.allowRepeatBadges).toBe(true);
    }

    expect(getActivity('var.0').palette.allowRepeatBadges).toBe(false);
    expect(getActivity('var.5').palette.allowRepeatBadges).toBe(false);

    // Every puzzle + var.M2 must have neutral '?' PLACEHOLDER blocks
    for (const id of [...PUZZLE_AND_M1_IDS, 'var.M2']) {
      const act = getActivity(id);
      expect(act.partialHelp?.mode).toBe('scaffold');
      const scaf = act.partialHelp?.scaffoldWorkspace;
      expect(scaf).toBeDefined();
      const allBlocks = ALL_SCOPES.flatMap((s) => scaf?.[s] ?? []);
      const placeholders = allBlocks.filter((b) => b.type === 'PLACEHOLDER');
      expect(placeholders.length, `${id} placeholder count`).toBeGreaterThan(0);
      for (const ph of placeholders) {
        expect(ph.params?.hintCategory ?? 'any').toBe('any');
      }
    }

    // var.M1 mastery has 0-starter; var.M2 has non-empty 10-block starter
    expect(getActivity('var.M1').starterWorkspace.MAIN).toHaveLength(0);
    expect(getActivity('var.M2').starterWorkspace.MAIN.length).toBeGreaterThan(0);

    // Every non-explanation activity respects its slotCap on all workspaces
    for (const act of VAR_ACTIVITIES) {
      if (!act.slotCap) continue;
      for (const entry of collectAllWorkspaces(act)) {
        const total = ALL_SCOPES.reduce((sum, s) => sum + (entry.workspace[s]?.length ?? 0), 0);
        if (act.slotCap.maxTotal !== undefined) {
          expect(total, `${act.id}:${entry.label} maxTotal`).toBeLessThanOrEqual(
            act.slotCap.maxTotal
          );
        }
        for (const scope of ALL_SCOPES) {
          const budget = computeSlotBudget(entry.workspace, scope as ScopeType, 'curriculum', act.slotCap);
          if (budget.scopeLimit !== undefined) {
            expect(budget.scopeUsed, `${act.id}:${entry.label}:${scope}`).toBeLessThanOrEqual(
              budget.scopeLimit
            );
          }
        }
      }
    }
  });

  it('round-trips all Module var workspaces through binary serialization cleanly', () => {
    for (const act of VAR_ACTIVITIES) {
      for (const entry of collectAllWorkspaces(act)) {
        const bytes = exportLessonToBinary(entry.workspace, entry.simId, act.id, act.version);
        const decoded = importFromBinary(bytes);
        expect(decoded.success, `${act.id}:${entry.label} import`).toBe(true);
        if (!decoded.success || decoded.envId !== 'lesson' || !decoded.workspace) {
          throw new Error(`Expected lesson decode for ${act.id}:${entry.label}`);
        }
        expect(decoded.lessonId).toBe(act.id);
        expect(decoded.lessonVersion).toBe(act.version);
        for (const scope of ALL_SCOPES) {
          const origBlocks = entry.workspace[scope] ?? [];
          const decBlocks = decoded.workspace[scope] ?? [];
          expect(decBlocks.length, `${act.id}:${entry.label}:${scope} length`).toBe(
            origBlocks.length
          );
          for (let i = 0; i < origBlocks.length; i++) {
            expect(decBlocks[i].type, `${act.id}:${entry.label}:${scope}[${i}]`).toBe(
              origBlocks[i].type
            );
            if (origBlocks[i].repeatCount !== undefined) {
              expect(decBlocks[i].repeatCount).toBe(origBlocks[i].repeatCount);
            }
          }
        }
      }
    }
  });

  it('executes all Turtle lessons & mastery targets cleanly with inkMaxSpan >= 160px', () => {
    const turtleChecks: Array<{
      id: string;
      label: string;
      workspace: WorkspaceState;
      seed?: number;
    }> = [];

    const act0 = getActivity('var.0');
    turtleChecks.push({ id: 'var.0', label: 'tab1', workspace: act0.demoTabs![0].workspace! });

    for (const id of ['var.1', 'var.5', 'var.10', 'var.B', 'var.M2']) {
      const act = getActivity(id);
      turtleChecks.push({ id, label: 'starter', workspace: act.starterWorkspace, seed: 77 });
      if (act.referenceSolution) {
        turtleChecks.push({ id, label: 'reference', workspace: act.referenceSolution });
      }
      for (const v of act.variations ?? []) {
        turtleChecks.push({ id, label: v.id, workspace: v.workspace, seed: 24 });
      }
    }

    const act6 = getActivity('var.6');
    for (const tab of act6.demoTabs ?? []) {
      turtleChecks.push({ id: 'var.6', label: tab.id, workspace: tab.workspace! });
    }
    const act8 = getActivity('var.8');
    turtleChecks.push({
      id: 'var.8',
      label: 'tab2',
      workspace: act8.demoTabs![1].workspace!,
      seed: 42,
    });

    for (const item of turtleChecks) {
      const res = runHeadlessSimulation(
        item.workspace,
        'turtle',
        createInitialTurtleState(),
        2000,
        item.seed !== undefined ? { seed: item.seed } : undefined
      );
      expect(res.finalState.status, `${item.id}:${item.label}`).not.toBe('COLLISION');
      expect(res.finalState.status, `${item.id}:${item.label}`).not.toBe('STEP_LIMIT');
      const span = computeTurtleInkMaxSpan(res.finalState as TurtleState);
      expect(span, `${item.id}:${item.label} inkMaxSpan=${span}`).toBeGreaterThanOrEqual(160);
    }
  });

  it('executes Grid explanation tabs (var.0 Tabs 2..3, var.3 Tabs 1..3) to SUCCESS', () => {
    const act0 = getActivity('var.0');
    for (const tab of [act0.demoTabs![1], act0.demoTabs![2]]) {
      const res = runHeadlessSimulation(
        tab.workspace!,
        'grid',
        createCurriculumGridState(tab.grid as CurriculumGridDefinition),
        500
      );
      expect(res.finalState.status, `var.0:${tab.id}`).toBe('SUCCESS');
    }

    const act3 = getActivity('var.3');
    for (const tab of act3.demoTabs ?? []) {
      const res = runHeadlessSimulation(
        tab.workspace!,
        'grid',
        createCurriculumGridState(tab.grid as CurriculumGridDefinition),
        500
      );
      expect(res.finalState.status, `var.3:${tab.id}`).toBe('SUCCESS');
    }
  });

  it('executes Beat activities (var.7, var.8 Tab 1, var.9) with cursor.visible=false, Loop x[0], and seeded determinism', () => {
    const act7 = getActivity('var.7');
    const beatRuns: Array<{ id: string; label: string; ws: WorkspaceState; seed?: number }> = [
      { id: 'var.7', label: 'starter', ws: act7.starterWorkspace },
      ...(act7.variations ?? []).map((v) => ({ id: 'var.7', label: v.id, ws: v.workspace })),
      { id: 'var.8', label: 'tab1', ws: getActivity('var.8').demoTabs![0].workspace!, seed: 42 },
      { id: 'var.9', label: 'starter', ws: getActivity('var.9').starterWorkspace, seed: 101 },
      ...(getActivity('var.9').variations ?? []).map((v, i) => ({
        id: 'var.9',
        label: v.id,
        ws: v.workspace,
        seed: [202, 303, 404][i],
      })),
    ];

    for (const item of beatRuns) {
      const res = runHeadlessSimulation(
        item.ws,
        'beat',
        createInitialBeatState(true),
        1000,
        item.seed !== undefined ? { seed: item.seed } : undefined
      );
      expect(res.finalState.cursor.visible, `${item.id}:${item.label} cursor.visible`).toBe(false);
      expect(res.stepCount, `${item.id}:${item.label} steps`).toBeGreaterThan(0);
      expect(countLitLeds(res.finalState.leds), `${item.id}:${item.label} lit LEDs`).toBeGreaterThan(
        0
      );
    }

    // Verify seeded determinism on var.8 Tab 1 & var.9 Var 2 (Loop x[0] safe coin-flip skip)
    const coinFlipWs = getActivity('var.9').variations![1].workspace;
    const runA = runHeadlessSimulation(coinFlipWs, 'beat', createInitialBeatState(true), 1000, {
      seed: 303,
    });
    const runB = runHeadlessSimulation(coinFlipWs, 'beat', createInitialBeatState(true), 1000, {
      seed: 303,
    });
    expect(runA.finalState.leds).toEqual(runB.finalState.leds);
    expect(runA.stepCount).toBe(runB.stepCount);
  });

  it('verifies every validated puzzle & mastery (var.2, var.4, var.4a, var.A, var.M1) passes reference, scaffold, and < 500ms anti-bypass proofs', () => {
    for (const id of PUZZLE_AND_M1_IDS) {
      const act = getActivity(id);
      const variants = act.gridVariants ?? (act.grid ? [act.grid] : []);
      expect(variants.length, `${id} variants`).toBeGreaterThan(0);

      // Starter must fail on at least one variant (and for M1 empty starter fails all)
      const starterStatuses = variants.map(
        (g) => runHeadlessSimulation(act.starterWorkspace, 'grid', createCurriculumGridState(g), 500).finalState.status
      );
      expect(starterStatuses.every((s) => s === 'SUCCESS'), `${id} starter must fail`).toBe(false);

      // Reference solution check & scaffold check
      const refCheck = checkReferenceSolution(act, gridSimulationEnvironment);
      expect(refCheck.passed, `${id} refCheck: ${refCheck.reason}`).toBe(true);

      const scafCheck = checkScaffoldWorkspace(act, gridSimulationEnvironment);
      expect(scafCheck.passed, `${id} scafCheck: ${scafCheck.reason}`).toBe(true);

      // Explicit check on every variant + inventory/switch invariants on var.A & var.M1
      for (const g of variants) {
        const res = runHeadlessSimulation(
          act.referenceSolution!,
          'grid',
          createCurriculumGridState(g),
          500
        );
        expect(res.finalState.status, `${id}:${g.label}`).toBe('SUCCESS');
        if (id === 'var.A' || id === 'var.M1') {
          expect(res.finalState.robot.carriedItem).toBeNull();
          for (const sw of res.finalState.floorSwitches ?? []) {
            if (sw.requiredForGoal) expect(sw.active).toBe(true);
          }
        }
      }

      // Full Anti-Bypass Constraint Verification (< 500ms hard cap, 200ms soft notice)
      const report = verifyActivityConstraints(act);
      if (report.elapsedMs >= 200) {
        console.warn(
          `[var-perf] ${id} verifyActivityConstraints took ${report.elapsedMs.toFixed(1)}ms (>= 200ms soft budget)`
        );
      }
      expect(
        report.elapsedMs,
        `${id} exceeded 500ms anti-bypass budget (${report.elapsedMs.toFixed(1)}ms)`
      ).toBeLessThan(500);
      expect(report.passed, `${id} report: ${JSON.stringify(report.ruleResults)}`).toBe(true);
    }
  });
});
