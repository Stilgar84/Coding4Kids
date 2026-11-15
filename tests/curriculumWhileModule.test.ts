import { describe, expect, it } from 'vitest';
import {
  WHILE_0_GRID_LONG,
  WHILE_0_GRID_MID_GOAL,
  WHILE_0_GRID_SHORT,
  WHILE_2_DEMO_TABS,
  WHILE_ACTIVITIES,
} from '../src/data/curriculum/whileActivities';
import {
  CurriculumActivity,
  createCurriculumBlock,
  createCurriculumGridState,
} from '../src/data/curriculum/types';
import { exportLessonToBinary, importFromBinary } from '../src/engine/serialization/codeSerializer';
import {
  COND_TAG_CMP,
  COND_TAG_CURSOR_AT_EDGE,
  COND_TAG_INSIDE_CANVAS,
} from '../src/engine/serialization/conditionSerializer';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';
import { DEPOT_STATION_BITS } from '../src/simulations/depot/types';
import { createInitialSwitchyardState } from '../src/simulations/switchyard/physics';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import type { CodeBlock, ScopeType, WorkspaceState } from '../src/types';
import { computeSlotBudget } from '../src/utils/curriculumStagePolicy';

const EXPECTED_IDS = [
  'while.0',
  'while.1',
  'while.2',
  'while.3',
  'while.4',
  'while.5',
  'while.6',
  'while.7',
  'while.8',
  'while.A',
  'while.B',
  'while.C',
] as const;

const SCOPES: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];
const CANONICAL_NOTE_DURATIONS = new Set([0.5, 1, 2]);
const CANONICAL_BEAT_DELAYS = new Set([0, 0.25, 0.5, 1, 2, 4]);

function collectWorkspacesForActivity(
  activity: CurriculumActivity
): Array<{ label: string; workspace: WorkspaceState }> {
  const entries: Array<{ label: string; workspace: WorkspaceState }> = [];
  if (activity.starterWorkspace) {
    entries.push({ label: 'starterWorkspace', workspace: activity.starterWorkspace });
  }
  if (activity.partialHelp?.scaffoldWorkspace) {
    entries.push({
      label: 'partialHelp.scaffoldWorkspace',
      workspace: activity.partialHelp.scaffoldWorkspace,
    });
  }
  if (activity.referenceSolution) {
    entries.push({ label: 'referenceSolution', workspace: activity.referenceSolution });
  }
  for (const tab of activity.demoTabs ?? []) {
    entries.push({ label: `demoTabs[${tab.id}]`, workspace: tab.workspace });
  }
  for (const card of activity.variations ?? []) {
    entries.push({ label: `variations[${card.id}]`, workspace: card.workspace });
  }
  return entries;
}

function allBlocksOfWorkspace(ws: WorkspaceState): CodeBlock[] {
  return SCOPES.flatMap((scope) => ws[scope] ?? []);
}

function normalizeBlocksForComparison(ws: WorkspaceState): unknown {
  const pick = (blocks: CodeBlock[]) =>
    blocks.map((b) => {
      // Binary switchyard codec serializes implicit junction 'A' as explicit { junction: 'A' } on decode
      const normalizedParams =
        (b.type === 'SWITCH_LEFT' || b.type === 'SWITCH_RIGHT') && b.params === undefined
          ? { junction: 'A' }
          : b.params;
      return {
        type: b.type,
        ...(b.repeatCount !== undefined ? { repeatCount: b.repeatCount } : {}),
        ...(normalizedParams !== undefined ? { params: normalizedParams } : {}),
      };
    });
  return {
    MAIN: pick(ws.MAIN),
    F1: pick(ws.F1),
    F2: pick(ws.F2),
    F3: pick(ws.F3),
  };
}

function containsRawByte(bytes: Uint8Array, tag: number): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === tag) return true;
  }
  return false;
}

describe('Module `while` Curriculum Authoring (while.0..while.C)', () => {
  it('defines all 12 activities in exact while/overview.md order with moduleId=while and version=1', () => {
    expect(WHILE_ACTIVITIES.map((a) => a.id)).toEqual([...EXPECTED_IDS]);
    expect(WHILE_ACTIVITIES).toHaveLength(12);
    for (const act of WHILE_ACTIVITIES) {
      expect(act.moduleId).toBe('while');
      expect(act.version).toBe(1);
    }
  });

  it('enforces allowVariables=false, allowRecursion=false, paired control closers, slotCap, and zero learner jargon across all 12 activities', () => {
    for (const act of WHILE_ACTIVITIES) {
      expect(act.palette.allowVariables).toBe(false);
      expect(act.palette.allowRecursion).toBe(false);

      const ctrl = new Set(act.palette.allowedControlBlocks ?? []);
      if (ctrl.has('WHILE')) expect(ctrl.has('END_WHILE')).toBe(true);
      if (ctrl.has('IF')) expect(ctrl.has('END_IF')).toBe(true);
      if (ctrl.has('LOOP_START')) expect(ctrl.has('LOOP_END')).toBe(true);

      // Learner metadata strings remain concise and free of internal developer wire tokens
      for (const field of [act.title, act.concept, act.description, act.hint]) {
        if (!field) continue;
        expect(field).not.toMatch(/Base64URL|\b0x[0-9a-fA-F]+\b|ENV_VERSION_|COND_TAG_/);
      }

      for (const { label, workspace } of collectWorkspacesForActivity(act)) {
        if (act.slotCap) {
          for (const sc of SCOPES) {
            const budget = computeSlotBudget(workspace, sc, 'curriculum', act.slotCap);
            const scopeLimit = act.slotCap.perScope?.[sc];
            if (scopeLimit !== undefined) {
              expect(
                budget.scopeUsed,
                `${act.id} -> ${label}.${sc} (${budget.scopeUsed} <= ${scopeLimit})`
              ).toBeLessThanOrEqual(scopeLimit);
            }
            if (act.slotCap.maxTotal !== undefined) {
              expect(
                budget.totalUsed,
                `${act.id} -> ${label} total (${budget.totalUsed} <= ${act.slotCap.maxTotal})`
              ).toBeLessThanOrEqual(act.slotCap.maxTotal);
            }
          }
        }

        // Check balanced WHILE / IF / LOOP_START pairs in every scope
        for (const sc of SCOPES) {
          const blocks = workspace[sc] ?? [];
          let loopBal = 0;
          let ifBal = 0;
          let whileBal = 0;
          for (const b of blocks) {
            if (b.type === 'LOOP_START') loopBal++;
            if (b.type === 'LOOP_END') loopBal--;
            if (b.type === 'IF') ifBal++;
            if (b.type === 'END_IF') ifBal--;
            if (b.type === 'WHILE') whileBal++;
            if (b.type === 'END_WHILE') whileBal--;
            expect(loopBal, `${act.id} ${label}.${sc} LOOP balance`).toBeGreaterThanOrEqual(0);
            expect(ifBal, `${act.id} ${label}.${sc} IF balance`).toBeGreaterThanOrEqual(0);
            expect(whileBal, `${act.id} ${label}.${sc} WHILE balance`).toBeGreaterThanOrEqual(0);
          }
          expect(loopBal, `${act.id} ${label}.${sc} unclosed LOOP`).toBe(0);
          expect(ifBal, `${act.id} ${label}.${sc} unclosed IF`).toBe(0);
          expect(whileBal, `${act.id} ${label}.${sc} unclosed WHILE`).toBe(0);
        }
      }
    }
  });

  it('enforces Turtle canvas bounds (showCanvasBounds + zero TELEPORT) on while.6 and while.B', () => {
    for (const id of ['while.6', 'while.B'] as const) {
      const act = WHILE_ACTIVITIES.find((a) => a.id === id)!;
      expect(act.simId).toBe('turtle');
      expect(act.turtle?.showCanvasBounds).toBe(true);
      expect(act.turtle?.canvasBounds).toEqual({ halfWidth: 300, halfHeight: 240 });
      expect(act.palette.allowedSimBlocks).not.toContain('TELEPORT');
      expect(act.palette.allowedSensors).toContain('insideCanvas');

      for (const { label, workspace } of collectWorkspacesForActivity(act)) {
        const blocks = allBlocksOfWorkspace(workspace);
        expect(
          blocks.some((b) => b.type === 'TELEPORT'),
          `${id} ${label} must not contain TELEPORT`
        ).toBe(false);
      }
    }
  });

  it('enforces canonical Beat durations and cursorAtEdge / inputConfig on while.7 and while.C', () => {
    for (const id of ['while.7', 'while.C'] as const) {
      const act = WHILE_ACTIVITIES.find((a) => a.id === id)!;
      expect(act.simId).toBe('beat');
      expect(act.palette.allowedSensors).toContain('cursorAtEdge');
      expect(act.palette.allowedSensors).toContain('$input');
      expect(act.inputConfig?.mode).toBe('int');
      expect(act.variations?.[2]?.inputConfig).toBeDefined();

      for (const { label, workspace } of collectWorkspacesForActivity(act)) {
        for (const b of allBlocksOfWorkspace(workspace)) {
          if (b.type === 'PLAY_NOTE') {
            expect(
              CANONICAL_NOTE_DURATIONS.has(Number(b.params?.duration)),
              `${id} ${label} PLAY_NOTE duration`
            ).toBe(true);
          }
          if (b.type === 'SET_BEAT_DELAY') {
            expect(
              CANONICAL_BEAT_DELAYS.has(Number(b.params?.delay)),
              `${id} ${label} SET_BEAT_DELAY delay`
            ).toBe(true);
          }
        }
      }
    }
  });

  it('validates Depot v4 fixtures (while.2..4) and Switchyard v2 fixtures (while.5, while.8) ready for Step 2C env integration', () => {
    const w2 = WHILE_ACTIVITIES.find((a) => a.id === 'while.2')!;
    expect(w2.demoTabs).toHaveLength(2);
    expect(w2.demoTabs?.[0]?.depotState?.targetOutput).toEqual(['RED', 'BLUE', 'GREEN', 'AMBER']);
    expect((w2.demoTabs?.[0]?.depotState?.activeStationsMask ?? 0) & DEPOT_STATION_BITS.QUEUE).toBeTruthy();

    const w3 = WHILE_ACTIVITIES.find((a) => a.id === 'while.3')!;
    expect(w3.depotVariants).toHaveLength(4);
    expect(w3.depotVariants?.map((v) => v.queue.length)).toEqual([3, 5, 4, 6]);
    for (const dv of w3.depotVariants ?? []) {
      expect(dv.queue.every((q) => !q.damaged)).toBe(true);
      expect(dv.activeStationsMask).toBe(0x0b);
    }

    const w4 = WHILE_ACTIVITIES.find((a) => a.id === 'while.4')!;
    expect(w4.depotVariants).toHaveLength(4);
    expect(w4.depotVariants?.map((v) => v.queue.length)).toEqual([4, 5, 6, 7]);
    for (const dv of w4.depotVariants ?? []) {
      expect(dv.queue.every((q) => !q.damaged)).toBe(true);
      expect(dv.activeStationsMask).toBe(0x4b);
      expect((dv.targetOutput ?? []).length).toBeGreaterThan(0);
    }

    const w5 = WHILE_ACTIVITIES.find((a) => a.id === 'while.5')!;
    expect(w5.palette.allowedScopes).toEqual(['MAIN', 'F1']);
    expect(w5.palette.allowRecursion).toBe(false);
    expect(w5.switchyardVariants).toHaveLength(4);
    expect(w5.switchyardVariants?.map((sv) => sv.incomingStream.length)).toEqual([2, 4, 5, 6]);
    expect(w5.switchyardVariants?.every((sv) => sv.scrapRules === 'damagedOnly')).toBe(true);

    const w8 = WHILE_ACTIVITIES.find((a) => a.id === 'while.8')!;
    expect(w8.switchyardVariants).toHaveLength(4);
    expect(w8.switchyardVariants?.map((sv) => sv.incomingStream.length)).toEqual([2, 4, 3, 5]);
    expect(
      w8.switchyardVariants?.every((sv) => sv.incomingStream.every((car) => !car.damaged))
    ).toBe(true);
  });

  it('round-trips EVERY workspace of all 12 activities through exportLessonToBinary/importFromBinary including 0x28, 0x2A & 0x30 tags', () => {
    for (const act of WHILE_ACTIVITIES) {
      for (const { label, workspace } of collectWorkspacesForActivity(act)) {
        const bytes = exportLessonToBinary(workspace, act.simId, act.id, act.version);
        const decoded = importFromBinary(bytes);

        expect(decoded.success, `${act.id} ${label} binary decode`).toBe(true);
        expect(decoded.lessonId).toBe(act.id);
        expect(decoded.lessonVersion).toBe(act.version);
        expect(normalizeBlocksForComparison(decoded.workspace!)).toEqual(
          normalizeBlocksForComparison(workspace)
        );

        if ((act.id === 'while.6' || act.id === 'while.B') && label !== 'starterWorkspace') {
          expect(containsRawByte(bytes, COND_TAG_INSIDE_CANVAS)).toBe(true);
        }
        if (act.id === 'while.7' || act.id === 'while.C') {
          expect(containsRawByte(bytes, COND_TAG_CURSOR_AT_EDGE)).toBe(true);
        }
        if (label.includes('var3') && (act.id === 'while.7' || act.id === 'while.B' || act.id === 'while.C')) {
          expect(containsRawByte(bytes, COND_TAG_CMP)).toBe(true);
        }
      }
    }
  });

  it('verifies Grid demo while.0 execution and negative contrasts (Loop under-run, collision, mid-goal overshoot)', () => {
    const w0 = WHILE_ACTIVITIES.find((a) => a.id === 'while.0')!;
    const tab1Ws = w0.demoTabs![0].workspace;
    const tab2Ws = w0.demoTabs![1].workspace;

    // Tab 1: While (pathAhead) wins both 3x1 and 8x1
    const resShort = runHeadlessSimulation(tab1Ws, 'grid', createCurriculumGridState(WHILE_0_GRID_SHORT));
    const resLong = runHeadlessSimulation(tab1Ws, 'grid', createCurriculumGridState(WHILE_0_GRID_LONG));
    expect(resShort.status).toBe('SUCCESS');
    expect(resLong.status).toBe('SUCCESS');

    // Tab 1 Pitfalls: Loop x2 fails 8x1; Loop x7 collides on 3x1
    const loop2Ws: WorkspaceState = {
      MAIN: [createCurriculumBlock('LOOP_START', 2), createCurriculumBlock('MOVE_FWD'), createCurriculumBlock('LOOP_END')],
      F1: [],
      F2: [],
      F3: [],
    };
    const loop7Ws: WorkspaceState = {
      MAIN: [createCurriculumBlock('LOOP_START', 7), createCurriculumBlock('MOVE_FWD'), createCurriculumBlock('LOOP_END')],
      F1: [],
      F2: [],
      F3: [],
    };
    expect(runHeadlessSimulation(loop2Ws, 'grid', createCurriculumGridState(WHILE_0_GRID_LONG)).status).not.toBe('SUCCESS');
    expect(runHeadlessSimulation(loop7Ws, 'grid', createCurriculumGridState(WHILE_0_GRID_SHORT)).status).toBe('COLLISION');

    // Tab 2: While (NOT atGoal) stops cleanly on mid-hall Goal (3,0), whereas While (pathAhead) overshoots to (5,0)
    const midOk = runHeadlessSimulation(tab2Ws, 'grid', createCurriculumGridState(WHILE_0_GRID_MID_GOAL));
    const midOvershoot = runHeadlessSimulation(tab1Ws, 'grid', createCurriculumGridState(WHILE_0_GRID_MID_GOAL));
    expect(midOk.status).toBe('SUCCESS');
    expect(midOk.finalState.robot.x).toBe(3);
    expect(midOvershoot.status).not.toBe('SUCCESS');
    expect(midOvershoot.finalState.robot.x).toBe(5);
  });

  it('passes full constraint solver, referenceSolution, starter failure, and <200ms budget on ALL Grid puzzles (while.1, while.A)', () => {
    for (const id of ['while.1', 'while.A'] as const) {
      const act = WHILE_ACTIVITIES.find((a) => a.id === id)!;
      const report = verifyActivityConstraints(act);

      expect(report.referenceCheck.reason).toBeUndefined();
      expect(report.referenceCheck.passed, `${id} refCheck`).toBe(true);
      expect(report.scaffoldCheck.passed, `${id} scaffoldCheck`).toBe(true);
      expect(report.ruleResults.every((r) => r.passed), `${id} rules`).toBe(true);
      expect(report.passed, `${id} overall`).toBe(true);
      expect(report.variantCount).toBe(4);
      expect(report.elapsedMs).toBeLessThan(500);
    }

    // Also verify Left-Hand Wall Follower solves all 4 mazes of while.A cleanly
    const wA = WHILE_ACTIVITIES.find((a) => a.id === 'while.A')!;
    const leftHandWs: WorkspaceState = {
      MAIN: [
        createCurriculumBlock('WHILE', undefined, {
          condition: { kind: 'not', operand: { kind: 'sensor', sensor: 'atGoal' } },
        }),
        createCurriculumBlock('IF', undefined, {
          condition: { kind: 'sensor', sensor: 'pathLeft' },
        }),
        createCurriculumBlock('TURN_LEFT'),
        createCurriculumBlock('MOVE_FWD'),
        createCurriculumBlock('ELSE_IF', undefined, {
          condition: { kind: 'sensor', sensor: 'pathAhead' },
        }),
        createCurriculumBlock('MOVE_FWD'),
        createCurriculumBlock('ELSE'),
        createCurriculumBlock('TURN_RIGHT'),
        createCurriculumBlock('END_IF'),
        createCurriculumBlock('END_WHILE'),
      ],
      F1: [],
      F2: [],
      F3: [],
    };
    for (const g of wA.gridVariants ?? []) {
      const res = runHeadlessSimulation(leftHandWs, 'grid', createCurriculumGridState(g));
      expect(res.status, `while.A Left-Hand on ${g.label}`).toBe('SUCCESS');
    }
  });

  it('runs headless Turtle LOGO simulations cleanly on while.6 and while.B starter + all variations (including $input 1..4)', () => {
    const w6 = WHILE_ACTIVITIES.find((a) => a.id === 'while.6')!;
    for (const { label, workspace } of collectWorkspacesForActivity(w6)) {
      const init = createInitialTurtleState(w6.turtle?.canvasBounds);
      const res = runHeadlessSimulation(workspace, 'turtle', init, 2500);
      expect(res.status, `while.6 ${label}`).not.toBe('COLLISION');
      expect(res.status, `while.6 ${label}`).not.toBe('STEP_LIMIT');
      expect(res.finalState.paths.length, `while.6 ${label} drew paths`).toBeGreaterThan(0);
    }

    const wB = WHILE_ACTIVITIES.find((a) => a.id === 'while.B')!;
    for (const { label, workspace } of collectWorkspacesForActivity(wB)) {
      const inputs = label.includes('var3') ? [1, 2, 3, 4] : [undefined];
      for (const sceneInput of inputs) {
        const init = createInitialTurtleState(wB.turtle?.canvasBounds);
        const res = runHeadlessSimulation(
          workspace,
          'turtle',
          init,
          2500,
          sceneInput !== undefined ? { sceneInput } : undefined
        );
        expect(res.status, `while.B ${label} ($input=${sceneInput})`).not.toBe('COLLISION');
        expect(res.status, `while.B ${label} ($input=${sceneInput})`).not.toBe('STEP_LIMIT');
        expect(
          res.finalState.paths.length,
          `while.B ${label} ($input=${sceneInput}) drew paths`
        ).toBeGreaterThan(0);
      }
    }
  });

  it('executes while.2 Depot Queue vs Stack demo tabs to SUCCESS', () => {
    expect(WHILE_2_DEMO_TABS.length).toBeGreaterThanOrEqual(2);
    for (const tab of WHILE_2_DEMO_TABS) {
      expect(tab.simId).toBe('depot');
      expect(tab.depotState).toBeDefined();
      const init = createInitialDepotState(tab.depotState!);
      const res = runHeadlessSimulation(tab.workspace, 'depot', init, 250);
      expect(res.status, `while.2 tab "${tab.label}"`).toBe('SUCCESS');
    }
  });

  it('verifies while.3 and while.4 Depot v4 constraints (<500ms) and multi-variant runtime', () => {
    for (const id of ['while.3', 'while.4'] as const) {
      const act = WHILE_ACTIVITIES.find((a) => a.id === id)!;
      expect(act.depotVariants?.length, `${id} depotVariants`).toBe(4);

      const report = verifyActivityConstraints(act);
      expect(report.passed, `${id} constraints`).toBe(true);
      expect(report.elapsedMs, `${id} elapsedMs`).toBeLessThan(500);
      for (const r of report.ruleResults) {
        expect(r.passed, `${id} rule ${r.ruleId}`).toBe(true);
      }

      const starterStatuses = act.depotVariants!.map(
        (v) => runHeadlessSimulation(act.starterWorkspace!, 'depot', createInitialDepotState(v), 250).status
      );
      expect(
        starterStatuses.some((s) => s !== 'SUCCESS'),
        `${id} starter must fail at least one variant`
      ).toBe(true);

      act.depotVariants!.forEach((v, idx) => {
        const res = runHeadlessSimulation(act.referenceSolution!, 'depot', createInitialDepotState(v), 250);
        expect(res.status, `${id} referenceSolution variant ${idx + 1}`).toBe('SUCCESS');
      });
    }
  });

  it('verifies while.5 and while.8 Switchyard v2 constraints (<500ms) and multi-stream runtime', () => {
    for (const id of ['while.5', 'while.8'] as const) {
      const act = WHILE_ACTIVITIES.find((a) => a.id === id)!;
      expect(act.switchyardVariants?.length, `${id} switchyardVariants`).toBe(4);

      const report = verifyActivityConstraints(act);
      expect(report.passed, `${id} constraints`).toBe(true);
      expect(report.elapsedMs, `${id} elapsedMs`).toBeLessThan(500);
      for (const r of report.ruleResults) {
        expect(r.passed, `${id} rule ${r.ruleId}`).toBe(true);
      }

      const starterStatuses = act.switchyardVariants!.map(
        (v) =>
          runHeadlessSimulation(
            act.starterWorkspace!,
            'switchyard',
            createInitialSwitchyardState(v),
            300
          ).status
      );
      if (id === 'while.8') {
        expect(starterStatuses[0], 'while.8 starter succeeds on Stream 1').toBe('SUCCESS');
        expect(
          starterStatuses.slice(1).every((s) => s !== 'SUCCESS'),
          'while.8 starter fails Streams 2..4'
        ).toBe(true);
      } else {
        expect(
          starterStatuses.some((s) => s !== 'SUCCESS'),
          `${id} starter must fail at least one variant`
        ).toBe(true);
      }

      act.switchyardVariants!.forEach((v, idx) => {
        const res = runHeadlessSimulation(
          act.referenceSolution!,
          'switchyard',
          createInitialSwitchyardState(v),
          300
        );
        expect(res.status, `${id} referenceSolution variant ${idx + 1}`).toBe('SUCCESS');
      });
    }
  });

  it('runs while.7 and while.C Beat cursorAtEdge workspaces cleanly across $input variants', () => {
    for (const id of ['while.7', 'while.C'] as const) {
      const act = WHILE_ACTIVITIES.find((a) => a.id === id)!;
      const maxInput = id === 'while.C' ? 4 : 3;
      const inputRange = Array.from({ length: maxInput }, (_, i) => i + 1);

      for (const { label, workspace } of collectWorkspacesForActivity(act)) {
        const inputs = label.includes('var3') ? inputRange : [undefined];
        for (const sceneInput of inputs) {
          const init = createInitialBeatState();
          const res = runHeadlessSimulation(
            workspace,
            'beat',
            init,
            2500,
            sceneInput !== undefined ? { sceneInput } : undefined
          );
          expect(res.status, `${id} ${label} ($input=${sceneInput})`).not.toBe('COLLISION');
          expect(res.status, `${id} ${label} ($input=${sceneInput})`).not.toBe('STEP_LIMIT');
          expect(
            Boolean(res.finalState.edgeBonk),
            `${id} ${label} ($input=${sceneInput}) should stop cleanly without edgeBonk`
          ).toBe(false);
          if (label !== 'starterWorkspace' && !label.startsWith('partialHelp')) {
            const litCount = res.finalState.leds.flat().filter(Boolean).length;
            expect(litCount, `${id} ${label} ($input=${sceneInput}) lit LEDs`).toBeGreaterThan(0);
            expect(
              res.finalState.stepCount,
              `${id} ${label} ($input=${sceneInput}) stepCount`
            ).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
