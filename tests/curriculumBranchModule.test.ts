import { describe, expect, it } from 'vitest';
import { BRANCH_ACTIVITIES } from '../src/data/curriculum/branchActivities';
import {
  CurriculumGridDefinition,
  CurriculumSwitchyardDefinition,
  PaletteConfig,
  SimId,
  SlotCapConfig,
  createCurriculumGridState,
} from '../src/data/curriculum/types';
import {
  exportLessonToBinary,
  importFromBinary,
} from '../src/engine/serialization/codeSerializer';
import {
  ensureSimEnvironmentsRegistered,
  runHeadlessSimulation,
} from '../src/engine/simulationRunner';
import { getSimEnvironment } from '../src/engine/simulation/registry';
import { validateLoopStructure } from '../src/engine/interpreter';
import {
  checkReferenceSolution,
  checkScaffoldWorkspace,
  verifyActivityConstraints,
} from '../src/engine/verification/constraintSolver';
import { computeSlotBudget } from '../src/utils/curriculumStagePolicy';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import type { BeatState } from '../src/simulations/beat/types';
import { createInitialSwitchyardState } from '../src/simulations/switchyard/physics';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import type { TurtlePathItem, TurtleState } from '../src/simulations/turtle/types';
import type { CodeBlock, ScopeType, WorkspaceState } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_SCOPES: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];

const EXPECTED_ORDER = [
  'branch.0',
  'branch.1',
  'branch.2',
  'branch.3',
  'branch.4',
  'branch.5',
  'branch.5a',
  'branch.6',
  'branch.6a',
  'branch.6b',
  'branch.7',
  'branch.9',
  'branch.7a',
  'branch.7b',
  'branch.8a',
  'branch.8',
  'branch.10a',
  'branch.10',
  'branch.A',
  'branch.B',
  'branch.C',
] as const;

function collectActivityWorkspaces(
  activity: (typeof BRANCH_ACTIVITIES)[number]
): Array<{ label: string; simId: typeof activity.simId; workspace: WorkspaceState }> {
  const items: Array<{ label: string; simId: typeof activity.simId; workspace: WorkspaceState }> =
    [];

  activity.demoTabs?.forEach((tab) => {
    items.push({
      label: `demoTab:${tab.id}`,
      simId: tab.simId ?? activity.simId,
      workspace: tab.workspace,
    });
  });

  if (activity.starterWorkspace) {
    items.push({
      label: 'starterWorkspace',
      simId: activity.simId,
      workspace: activity.starterWorkspace,
    });
  }
  if (activity.partialHelp?.scaffoldWorkspace) {
    items.push({
      label: 'partialHelp.scaffoldWorkspace',
      simId: activity.simId,
      workspace: activity.partialHelp.scaffoldWorkspace,
    });
  }
  if (activity.referenceSolution) {
    items.push({
      label: 'referenceSolution',
      simId: activity.simId,
      workspace: activity.referenceSolution,
    });
  }
  activity.variations?.forEach((variation) => {
    items.push({
      label: `variation:${variation.id}`,
      simId: activity.simId,
      workspace: variation.workspace,
    });
  });

  return items;
}

function stripBlockIds(ws: WorkspaceState): Record<ScopeType, unknown[]> {
  const out: Record<ScopeType, unknown[]> = { MAIN: [], F1: [], F2: [], F3: [] };
  for (const scope of ALL_SCOPES) {
    out[scope] = (ws[scope] ?? []).map((b) => {
      const normalizedParams =
        b.type === 'SWITCH_LEFT' || b.type === 'SWITCH_RIGHT'
          ? { ...(b.params ?? {}), junction: (b.params?.junction as string | undefined) ?? 'A' }
          : b.params
          ? { ...b.params }
          : undefined;
      return {
        type: b.type,
        ...(b.repeatCount !== undefined && b.repeatCount !== 1
          ? { repeatCount: b.repeatCount }
          : {}),
        ...(normalizedParams && Object.keys(normalizedParams).length > 0
          ? { params: normalizedParams }
          : {}),
      };
    });
  }
  return out;
}

function assertBalancedControlBlocks(blocks: readonly CodeBlock[], contextLabel: string): void {
  const loopStack: number[] = [];
  const ifStack: Array<{ sawElse: boolean }> = [];

  blocks.forEach((block, idx) => {
    switch (block.type) {
      case 'LOOP_START':
        loopStack.push(idx);
        break;
      case 'LOOP_END':
        expect(loopStack.length, `${contextLabel}: unexpected LOOP_END at ${idx}`).toBeGreaterThan(
          0
        );
        loopStack.pop();
        break;
      case 'IF':
        ifStack.push({ sawElse: false });
        break;
      case 'ELSE_IF':
        expect(ifStack.length, `${contextLabel}: ELSE_IF outside IF at ${idx}`).toBeGreaterThan(0);
        expect(
          ifStack[ifStack.length - 1].sawElse,
          `${contextLabel}: ELSE_IF after ELSE at ${idx}`
        ).toBe(false);
        break;
      case 'ELSE':
        expect(ifStack.length, `${contextLabel}: ELSE outside IF at ${idx}`).toBeGreaterThan(0);
        expect(
          ifStack[ifStack.length - 1].sawElse,
          `${contextLabel}: duplicate ELSE at ${idx}`
        ).toBe(false);
        ifStack[ifStack.length - 1].sawElse = true;
        break;
      case 'END_IF':
        expect(ifStack.length, `${contextLabel}: unexpected END_IF at ${idx}`).toBeGreaterThan(0);
        ifStack.pop();
        break;
    }
  });

  expect(loopStack.length, `${contextLabel}: unclosed LOOP_START`).toBe(0);
  expect(ifStack.length, `${contextLabel}: unclosed IF`).toBe(0);
}

function measureTurtleInkSpan(paths: readonly TurtlePathItem[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  maxSpan: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const include = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const p of paths) {
    include(p.fromX, p.fromY);
    include(p.toX, p.toY);
    if (p.type === 'ARC') {
      // Compute arc center and include cardinal extrema covered by the arc sweep
      const radHeading = (p.startHeading * Math.PI) / 180;
      const side = p.sweepAngle >= 0 ? 1 : -1;
      const perpRad = radHeading + (side * Math.PI) / 2;
      const cx = p.fromX + Math.sin(perpRad) * p.radius;
      const cy = p.fromY - Math.cos(perpRad) * p.radius;
      const startDeg =
        ((Math.atan2(p.fromY - cy, p.fromX - cx) * 180) / Math.PI + 360) % 360;
      const sweep = p.sweepAngle;
      const steps = Math.max(8, Math.ceil(Math.abs(sweep) / 15));
      for (let i = 0; i <= steps; i++) {
        const deg = startDeg + (sweep * i) / steps;
        const r = (deg * Math.PI) / 180;
        include(cx + Math.cos(r) * p.radius, cy + Math.sin(r) * p.radius);
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, maxSpan: 0 };
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    maxSpan: Math.max(maxX - minX, maxY - minY),
  };
}

function getActivityById(id: string) {
  const act = BRANCH_ACTIVITIES.find((a) => a.id === id);
  expect(act, `Missing activity ${id}`).toBeDefined();
  return act!;
}

const CONTROL_BLOCK_TYPES = new Set<string>([
  'LOOP_START',
  'LOOP_END',
  'CALL_F1',
  'CALL_F2',
  'CALL_F3',
  'IF',
  'ELSE_IF',
  'ELSE',
  'END_IF',
  'WHILE',
  'END_WHILE',
  'VAR_ASSIGN',
  'VAR_OP',
]);

function checkSlotCapViolation(workspace: WorkspaceState, slotCap?: SlotCapConfig): string | null {
  if (!slotCap) return null;
  for (const scope of ALL_SCOPES) {
    const budget = computeSlotBudget(workspace, scope, 'curriculum', slotCap);
    if (budget.totalLimit !== undefined && budget.totalUsed > budget.totalLimit) {
      return `Program uses ${budget.totalUsed} total blocks, exceeding slotCap.maxTotal=${budget.totalLimit}`;
    }
    if (budget.scopeLimit !== undefined && budget.scopeUsed > budget.scopeLimit) {
      return `Scope ${scope} uses ${budget.scopeUsed} blocks, exceeding slotCap.perScope.${scope}=${budget.scopeLimit}`;
    }
  }
  return null;
}

function collectPaletteViolations(
  workspace: WorkspaceState,
  palette: PaletteConfig,
  simId: SimId,
  allowPlaceholders: boolean
): string[] {
  const violations: string[] = [];
  const simEnv = getSimEnvironment(simId);
  const registeredSimTypes = new Set(simEnv?.paletteItems.map((p) => p.actionType) ?? []);
  const allowedSimTypes =
    palette.allowedSimBlocks !== undefined
      ? new Set(palette.allowedSimBlocks)
      : registeredSimTypes;
  const allowedControlTypes = new Set(palette.allowedControlBlocks ?? []);
  const allowedScopes = new Set<ScopeType>(
    palette.allowedScopes && palette.allowedScopes.length > 0 ? palette.allowedScopes : ['MAIN']
  );
  const allowRepeatBadges = palette.allowRepeatBadges === true;
  const allowVariables = palette.allowVariables === true;
  const allowActionParams = palette.allowActionParams !== false;

  for (const scope of ALL_SCOPES) {
    const blocks = workspace[scope] ?? [];
    if (blocks.length === 0) continue;

    if (!allowedScopes.has(scope)) {
      violations.push(`Scope '${scope}' has blocks but is not in allowedScopes`);
    }
    if (validateLoopStructure(blocks).hasError) {
      violations.push(`Scope '${scope}' fails validateLoopStructure`);
    }

    for (const block of blocks) {
      if (block.type === 'PLACEHOLDER') {
        if (!allowPlaceholders) {
          violations.push(`Unexpected PLACEHOLDER in scope '${scope}'`);
        }
        continue;
      }

      const isControl = CONTROL_BLOCK_TYPES.has(block.type);
      if (isControl) {
        if (!allowedControlTypes.has(block.type)) {
          violations.push(`Control block '${block.type}' not in allowedControlBlocks`);
        }
      } else if (!allowedSimTypes.has(block.type)) {
        violations.push(`Sim block '${block.type}' not in allowedSimBlocks`);
      }

      if (block.repeatCount !== undefined) {
        if (typeof block.repeatCount === 'string') {
          if (!allowVariables) {
            violations.push(`Variable repeatCount '${block.repeatCount}' disallowed`);
          }
        } else if (block.type === 'LOOP_START') {
          const maxLoop = simId === 'turtle' ? 12 : 9;
          if (block.repeatCount < 2 || block.repeatCount > maxLoop) {
            violations.push(`LOOP_START repeatCount ${block.repeatCount} outside 2..${maxLoop}`);
          } else if (block.repeatCount > 2 && !allowRepeatBadges) {
            violations.push(`LOOP_START repeatCount ${block.repeatCount} > 2 with allowRepeatBadges=false`);
          }
        } else if (block.repeatCount !== 1 && !allowRepeatBadges) {
          violations.push(`Block '${block.type}' repeatCount ${block.repeatCount} with allowRepeatBadges=false`);
        }
      }

      if (!isControl && block.params && Object.keys(block.params).length > 0) {
        if (!allowActionParams) {
          violations.push(`Block '${block.type}' has params while allowActionParams=false`);
        } else if (palette.allowedBlockParams !== undefined) {
          const permitted = new Set(palette.allowedBlockParams[block.type] ?? []);
          for (const k of Object.keys(block.params)) {
            if (!permitted.has(k)) {
              violations.push(`Param '${k}' on '${block.type}' not in allowedBlockParams`);
            }
          }
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// 1. Structural & Pedagogical Integrity Tests (All 21 Activities)
// ---------------------------------------------------------------------------

describe('Module `branch` — Structural, Palette, Zero-Reading & Codec Integrity', () => {
  it('exports exactly 21 activities in exact overview.md §3 order', () => {
    expect(BRANCH_ACTIVITIES).toHaveLength(21);
    expect(BRANCH_ACTIVITIES.map((a) => a.id)).toEqual([...EXPECTED_ORDER]);
  });

  it('enforces moduleId="branch", version=1, allowVariables=false, and allowRecursion=false on all 21 activities', () => {
    for (const act of BRANCH_ACTIVITIES) {
      expect(act.moduleId).toBe('branch');
      expect(act.version).toBe(1);
      expect(act.palette.allowVariables).toBe(false);
      expect(act.palette.allowRecursion).toBe(false);

      const ctrl = act.palette.allowedControlBlocks ?? [];
      if (ctrl.includes('LOOP_START')) {
        expect(ctrl, `${act.id}: LOOP_START requires explicit LOOP_END`).toContain('LOOP_END');
      }
      if (ctrl.includes('IF')) {
        expect(ctrl, `${act.id}: IF requires explicit END_IF`).toContain('END_IF');
      }
      expect(act.palette.allowedSimBlocks ?? []).not.toContain('CALL_FN');
    }
  });

  it('keeps learner-facing tab and variant pills strictly numeric (Zero-Reading Rule)', () => {
    for (const act of BRANCH_ACTIVITIES) {
      act.demoTabs?.forEach((tab, idx) => {
        expect(tab.label, `${act.id} demoTab ${idx}`).toBe(`${idx + 1}`);
      });
      act.gridVariants?.forEach((g, idx) => {
        expect(g.label, `${act.id} gridVariant ${idx}`).toBe(`${idx + 1}`);
      });
      act.switchyardVariants?.forEach((s, idx) => {
        expect(s.label, `${act.id} switchyardVariant ${idx}`).toBe(`${idx + 1}`);
      });
    }
  });

  it('validates balanced LOOP/IF blocks, palette membership, and slotCap across all workspaces', () => {
    ensureSimEnvironmentsRegistered();

    for (const act of BRANCH_ACTIVITIES) {
      const workspaces = collectActivityWorkspaces(act);
      expect(workspaces.length, `${act.id} has at least one workspace`).toBeGreaterThan(0);

      for (const entry of workspaces) {
        for (const scope of ALL_SCOPES) {
          assertBalancedControlBlocks(
            entry.workspace[scope] ?? [],
            `${act.id}/${entry.label}/${scope}`
          );
        }

        const simEnv = getSimEnvironment(entry.simId);
        expect(simEnv, `${act.id} ${entry.label} missing simEnv ${entry.simId}`).toBeDefined();
        const allowPlaceholders = entry.label === 'partialHelp.scaffoldWorkspace';
        const paletteViolations = collectPaletteViolations(
          entry.workspace,
          act.palette,
          entry.simId,
          allowPlaceholders
        );
        expect(
          paletteViolations,
          `${act.id} ${entry.label} palette violations`
        ).toEqual([]);

        if (entry.label !== 'partialHelp.scaffoldWorkspace') {
          const slotErr = checkSlotCapViolation(entry.workspace, act.slotCap);
          expect(slotErr, `${act.id} ${entry.label} slotCap violation`).toBeNull();
        }
      }
    }
  });

  it('enforces exact 2-switch junction params on branch.8a, branch.8, and branch.A', () => {
    for (const id of ['branch.8a', 'branch.8', 'branch.A']) {
      const act = getActivityById(id);
      expect(act.palette.allowActionParams, `${id} allowActionParams`).toBe(true);
      expect(act.palette.allowedBlockParams).toEqual({
        SWITCH_LEFT: ['junction'],
        SWITCH_RIGHT: ['junction'],
      });
      const variants: CurriculumSwitchyardDefinition[] =
        act.switchyardVariants ??
        (act.demoTabs?.map((t) => t.switchyardState!).filter(Boolean) ?? []);
      expect(variants.length).toBeGreaterThan(0);
      for (const sy of variants) {
        expect(sy.switches.map((s) => s.id)).toEqual(['A', 'B']);
        expect(sy.docks.map((d) => d.id)).toEqual(['DOCK_A', 'DOCK_B', 'DOCK_C']);
      }
    }
  });

  it('enforces Beat capstone grid/pitch bounds on branch.C', () => {
    const branchC = getActivityById('branch.C');
    expect(branchC.beatRules).toEqual({
      isLoopingDefault: true,
      cleanResetOnInputChange: true,
    });
    expect(branchC.defaultLoopPlayback).toBe(true);
    expect(branchC.palette.allowedSimBlocks).not.toContain('LIGHT_ROW');
    expect(branchC.palette.allowedSimBlocks).not.toContain('LIGHT_COL');

    const allBeatWorkspaces = collectActivityWorkspaces(branchC);
    for (const { label, workspace } of allBeatWorkspaces) {
      for (const scope of ALL_SCOPES) {
        for (const blk of workspace[scope]) {
          if (blk.type === 'PLAY_NOTE') {
            const pitch = Number(blk.params?.pitch ?? 0);
            expect(pitch, `${label}/${scope} pitch`).toBeGreaterThanOrEqual(1);
            expect(pitch, `${label}/${scope} pitch`).toBeLessThanOrEqual(8);
          }
          if (blk.type === 'LIGHT_PIXEL') {
            const x = Number(blk.params?.x ?? 0);
            const y = Number(blk.params?.y ?? 0);
            expect(x, `${label}/${scope} x`).toBeGreaterThanOrEqual(1);
            expect(x, `${label}/${scope} x`).toBeLessThanOrEqual(8);
            expect(y, `${label}/${scope} y`).toBeGreaterThanOrEqual(1);
            expect(y, `${label}/${scope} y`).toBeLessThanOrEqual(8);
          }
          if (blk.type === 'SET_BEAT_DELAY') {
            const delay = Number(blk.params?.delay ?? -1);
            expect([0, 1]).toContain(delay);
          }
        }
      }
    }
  });

  it('round-trips every workspace across all 21 activities cleanly through binary serialization', () => {
    for (const act of BRANCH_ACTIVITIES) {
      const workspaces = collectActivityWorkspaces(act);
      for (const { label, simId, workspace } of workspaces) {
        // Placeholders do not encode inside exportLessonToBinary workspaces except raw blocks;
        // substitute a harmless motion opcode if testing non-scaffold or skip only placeholder block arrays.
        if (label === 'partialHelp.scaffoldWorkspace') continue;

        const bytes = exportLessonToBinary(workspace, simId, act.id, act.version);
        const decoded = importFromBinary(bytes);

        expect(decoded.error, `${act.id} ${label} binary decode error`).toBeUndefined();
        expect(decoded.lessonId).toBe(act.id);
        expect(decoded.lessonVersion).toBe(act.version);
        expect(decoded.envId).toBe('lesson');
        expect(decoded.innerEnvId).toBe(simId === 'grid' ? 'generic' : simId);
        expect(stripBlockIds(decoded.workspace)).toEqual(stripBlockIds(workspace));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Robot Grid Verification (`verifyActivityConstraints` & Simulation Runs)
// ---------------------------------------------------------------------------

describe('Module `branch` — Robot Grid Solver & Headless Simulation Verification', () => {
  it('runs branch.0 multi-map demo to SUCCESS on both variants', () => {
    const act = getActivityById('branch.0');
    for (const tab of act.demoTabs!) {
      const initial = createCurriculumGridState(tab.gridState!, false);
      const run = runHeadlessSimulation(tab.workspace, 'grid', initial, 100);
      expect(run.status, tab.id).toBe('SUCCESS');
      expect(run.finalState.worldItems?.length ?? 0, `${tab.id} collects star`).toBe(0);
    }
  });

  it('verifies branch.1 referenceSolution passes all 3 variants and starter fails all 3', () => {
    const act = getActivityById('branch.1');
    const refCheck = checkReferenceSolution(act);
    expect(refCheck.passed, refCheck.reason).toBe(true);

    const scafCheck = checkScaffoldWorkspace(act);
    expect(scafCheck.passed, scafCheck.reason).toBe(true);

    for (const gridDef of act.gridVariants!) {
      const starterRun = runHeadlessSimulation(
        act.starterWorkspace!,
        'grid',
        createCurriculumGridState(gridDef, false),
        100
      );
      expect(starterRun.status).toBe('IDLE');

      const refRun = runHeadlessSimulation(
        act.referenceSolution!,
        'grid',
        createCurriculumGridState(gridDef, false),
        100
      );
      expect(refRun.status).toBe('SUCCESS');
      expect(refRun.finalState.worldItems?.length ?? 0).toBe(0);
    }
  });

  it('runs branch.6 spatial directional demo tabs to SUCCESS', () => {
    const act = getActivityById('branch.6');
    for (const tab of act.demoTabs!) {
      const initial = createCurriculumGridState(tab.gridState!, false);
      const run = runHeadlessSimulation(tab.workspace, 'grid', initial, 100);
      expect(run.status, tab.id).toBe('SUCCESS');
    }
  });

  it('runs branch.6b side-corridor solver verification (incl. SOUTH start) under 500ms', () => {
    const act = getActivityById('branch.6b');
    const report = verifyActivityConstraints(act);
    expect(report.passed, JSON.stringify(report.ruleResults)).toBe(true);
    expect(report.referenceCheck.passed, report.referenceCheck.reason).toBe(true);
    expect(report.scaffoldCheck.passed, report.scaffoldCheck.reason).toBe(true);
    expect(report.ruleResults.every((r) => r.passed)).toBe(true);
    expect(report.elapsedMs).toBeLessThan(500);
  });

  it('runs branch.7 Tab 1 NOT pathAhead demo to SUCCESS', () => {
    const act = getActivityById('branch.7');
    const tab1 = act.demoTabs![0];
    const run = runHeadlessSimulation(
      tab1.workspace,
      'grid',
      createCurriculumGridState(tab1.gridState!, false),
      100
    );
    expect(run.status).toBe('SUCCESS');
  });

  it('verifies branch.9 Fix-It bug hunt: starter fails Var 1 & 2 overshoot, passes Var 3; fix passes all 3 under 500ms', () => {
    const act = getActivityById('branch.9');
    const starterStatuses = act.gridVariants!.map((gridDef: CurriculumGridDefinition) =>
      runHeadlessSimulation(
        act.starterWorkspace!,
        'grid',
        createCurriculumGridState(gridDef, false),
        100
      ).status
    );
    expect(starterStatuses).toEqual(['IDLE', 'IDLE', 'SUCCESS']);

    const report = verifyActivityConstraints(act);
    expect(report.passed, JSON.stringify(report.ruleResults)).toBe(true);
    expect(report.referenceCheck.passed, report.referenceCheck.reason).toBe(true);
    expect(report.scaffoldCheck.passed, report.scaffoldCheck.reason).toBe(true);
    expect(report.ruleResults.every((r) => r.passed)).toBe(true);
    expect(report.elapsedMs).toBeLessThan(500);
  });

  it('verifies branch.7a compound key vault: starter blocked at gate on all 3 maps, reference passes all 3', () => {
    const act = getActivityById('branch.7a');
    act.gridVariants!.forEach((gridDef, idx) => {
      const starterRun = runHeadlessSimulation(
        act.starterWorkspace!,
        'grid',
        createCurriculumGridState(gridDef, false),
        100
      );
      expect(starterRun.status, `branch.7a starter var ${idx + 1}`).toBe('COLLISION');

      const refRun = runHeadlessSimulation(
        act.referenceSolution!,
        'grid',
        createCurriculumGridState(gridDef, false),
        100
      );
      expect(refRun.status, `branch.7a ref var ${idx + 1}`).toBe('SUCCESS');
      expect(refRun.finalState.robot.carriedItem).toBeNull();
    });
  });

  it('passes full constraint solver (< 500ms) unconditionally on remaining Grid puzzles (branch.1, branch.6a, branch.7a)', () => {
    for (const id of ['branch.1', 'branch.6a', 'branch.7a'] as const) {
      const act = getActivityById(id);
      const report = verifyActivityConstraints(act);
      expect(report.passed, `${id} constraints`).toBe(true);
      expect(report.elapsedMs, `${id} < 500ms`).toBeLessThan(500);
    }
  });

  it('executes branch.4 Tabs 1-2 (tileColor beacons) and branch.7 Tab 2 (decoy vs blue gem) cleanly to SUCCESS', () => {
    const b4 = getActivityById('branch.4');
    for (const tabIdx of [0, 1]) {
      const tab = b4.demoTabs![tabIdx];
      const run = runHeadlessSimulation(
        tab.workspace,
        'grid',
        createCurriculumGridState(tab.gridState!, false),
        100
      );
      expect(run.status, `branch.4 tab ${tab.label}`).toBe('SUCCESS');
    }

    const b7 = getActivityById('branch.7');
    const t2 = b7.demoTabs![1];
    const t2Run = runHeadlessSimulation(
      t2.workspace,
      'grid',
      createCurriculumGridState(t2.gridState!, false),
      100
    );
    expect(t2Run.status, 'branch.7 tab 2').toBe('SUCCESS');
    // Decoy item on (1,0) non-blue tile must remain uncollected while target at (3,0) is picked up
    expect(t2Run.finalState.worldItems?.some((it) => it.x === 1 && it.y === 0)).toBe(true);
    expect(t2Run.finalState.worldItems?.some((it) => it.x === 3 && it.y === 0)).toBe(false);
  });
});

describe('Module `branch` — Switchyard v2 Solver & Demo Execution Verification', () => {
  it('executes all Switchyard explanation demo tabs (branch.2, branch.4 Tab 3, branch.7 Tab 3, branch.8a) to SUCCESS', () => {
    const switchyardDemos: Array<{ id: string; tabIndices: number[] }> = [
      { id: 'branch.2', tabIndices: [0, 1] },
      { id: 'branch.4', tabIndices: [2] },
      { id: 'branch.7', tabIndices: [2] },
      { id: 'branch.8a', tabIndices: [0, 1] },
    ];

    for (const { id, tabIndices } of switchyardDemos) {
      const act = getActivityById(id);
      for (const tabIdx of tabIndices) {
        const tab = act.demoTabs![tabIdx];
        const initial = createInitialSwitchyardState(tab.switchyardState!);
        const run = runHeadlessSimulation(tab.workspace, 'switchyard', initial, 350);
        expect(run.status, `${id} tab ${tab.label}`).toBe('SUCCESS');
      }
    }
  });

  it('passes full anti-bypass solver (< 500ms) and multi-variant runtime across all Switchyard branch puzzles', () => {
    const switchyardPuzzleIds = [
      'branch.3',
      'branch.5',
      'branch.5a',
      'branch.7b',
      'branch.8',
      'branch.A',
    ] as const;

    for (const id of switchyardPuzzleIds) {
      const act = getActivityById(id);
      const report = verifyActivityConstraints(act);
      expect(report.passed, `${id} solver report`).toBe(true);
      expect(report.referenceCheck.passed, `${id} referenceCheck`).toBe(true);
      if (report.scaffoldCheck.applicable) {
        expect(report.scaffoldCheck.passed, `${id} scaffoldCheck`).toBe(true);
      }
      for (const rule of report.ruleResults) {
        expect(rule.passed, `${id} rule ${rule.ruleId}: ${rule.diagnostic ?? ''}`).toBe(true);
      }
      expect(report.elapsedMs, `${id} < 500ms`).toBeLessThan(500);

      const variants = act.switchyardVariants ?? (act.switchyard ? [act.switchyard] : []);
      expect(variants.length, `${id} has switchyard variants`).toBeGreaterThan(0);

      let starterFailedAny = false;
      variants.forEach((v, idx) => {
        const refRun = runHeadlessSimulation(
          act.referenceSolution!,
          'switchyard',
          createInitialSwitchyardState(v),
          350
        );
        expect(refRun.status, `${id} ref variant ${idx + 1}`).toBe('SUCCESS');

        const startRun = runHeadlessSimulation(
          act.starterWorkspace!,
          'switchyard',
          createInitialSwitchyardState(v),
          350
        );
        if (startRun.status !== 'SUCCESS') starterFailedAny = true;
      });
      expect(starterFailedAny, `${id} starter must fail at least one variant`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Turtle LOGO `$input` Execution Tests (`branch.10a`, `branch.10`, `branch.B`)
// ---------------------------------------------------------------------------

describe('Module `branch` — Turtle $input Scene Execution & Scale Verification', () => {
  function runTurtle(ws: WorkspaceState, sceneInput: number | string): TurtleState {
    const initial = createInitialTurtleState();
    const res = runHeadlessSimulation(ws, 'turtle', initial, 800, { sceneInput });
    return res.finalState;
  }

  it('executes branch.10a both demo tabs across all $input options with crisp >= 180px ink span', () => {
    const act = getActivityById('branch.10a');
    const [tab1, tab2] = act.demoTabs!;

    const t1Input1 = runTurtle(tab1.workspace, 1);
    const t1Input2 = runTurtle(tab1.workspace, 2);
    expect(t1Input1.paths.length).toBe(4);
    expect(t1Input1.penColor).toBe('#ef4444');
    expect(t1Input2.penColor).toBe('#3b82f6');
    expect(measureTurtleInkSpan(t1Input1.paths).maxSpan).toBeCloseTo(180, 1);

    const t2Input1 = runTurtle(tab2.workspace, 1);
    const t2Input2 = runTurtle(tab2.workspace, 2);
    const t2Input3 = runTurtle(tab2.workspace, 3);
    expect(t2Input1.paths.length).toBe(4);
    expect(t2Input1.penColor).toBe('#ef4444');
    expect(t2Input2.paths.length).toBe(6);
    expect(t2Input2.penColor).toBe('#06b6d4');
    expect(measureTurtleInkSpan(t2Input2.paths).maxSpan).toBeCloseTo(200, 1);
    expect(t2Input3.paths.length).toBe(5);
    expect(t2Input3.penColor).toBe('#8b5cf6');
    expect(measureTurtleInkSpan(t2Input3.paths).maxSpan).toBeGreaterThanOrEqual(180);
  });

  it('executes branch.10 Starter and Variations 1..3 across all options matching SVG geometry metrics', () => {
    const act = getActivityById('branch.10');

    // Starter across 1..4
    for (const opt of act.inputConfig!.options) {
      const st = runTurtle(act.starterWorkspace!, opt);
      expect(st.paths.length, `starter input ${opt}`).toBeGreaterThan(0);
      expect(measureTurtleInkSpan(st.paths).maxSpan, `starter span ${opt}`).toBeGreaterThanOrEqual(
        180
      );
    }
    const start1 = runTurtle(act.starterWorkspace!, 1);
    expect(start1.robot.x).toBeCloseTo(0, 1);
    expect(start1.robot.y).toBeCloseTo(0, 1);
    expect(Math.round(start1.robot.heading)).toBe(18);
    expect(measureTurtleInkSpan(start1.paths).maxSpan).toBeCloseTo(200, 1);

    // Variation 1 (House Sticker on $input=3 matches exact SVG pose (100, -160) heading 150)
    const var1 = act.variations![0];
    for (const opt of var1.inputConfig!.options) {
      const st = runTurtle(var1.workspace, opt);
      expect(st.paths.length, `var1 input ${opt}`).toBeGreaterThan(0);
      expect(measureTurtleInkSpan(st.paths).maxSpan, `var1 span ${opt}`).toBeGreaterThanOrEqual(
        180
      );
    }
    const v1i3 = runTurtle(var1.workspace, 3);
    expect(v1i3.robot.x).toBeCloseTo(100, 1);
    expect(v1i3.robot.y).toBeCloseTo(-160, 1);
    expect(Math.round(v1i3.robot.heading)).toBe(150);

    // Variation 2 (Shared Cyan Halo on $input=2 -> span 385, back at origin)
    const var2 = act.variations![1];
    for (const opt of var2.inputConfig!.options) {
      const st = runTurtle(var2.workspace, opt);
      expect(st.paths.length, `var2 input ${opt}`).toBeGreaterThan(0);
      expect(measureTurtleInkSpan(st.paths).maxSpan, `var2 span ${opt}`).toBeGreaterThanOrEqual(
        180
      );
    }
    const v2i2 = runTurtle(var2.workspace, 2);
    expect(v2i2.robot.x).toBeCloseTo(0, 1);
    expect(v2i2.robot.y).toBeCloseTo(0, 1);
    expect(measureTurtleInkSpan(v2i2.paths).maxSpan).toBeCloseTo(385, 0);

    // Variation 3 (Color Swatches mode: 'red', 'blue', 'green', 'yellow')
    const var3 = act.variations![2];
    expect(var3.inputConfig?.mode).toBe('color');
    for (const opt of var3.inputConfig!.options) {
      const st = runTurtle(var3.workspace, opt);
      expect(st.paths.length, `var3 input ${opt}`).toBeGreaterThan(0);
      expect(measureTurtleInkSpan(st.paths).maxSpan, `var3 span ${opt}`).toBeGreaterThanOrEqual(
        180
      );
    }
    const v3Red = runTurtle(var3.workspace, 'red');
    expect(v3Red.penColor).toBe('#f97316');
    expect(v3Red.robot.x).toBeCloseTo(0, 1);
    expect(v3Red.robot.y).toBeCloseTo(0, 1);
    expect(measureTurtleInkSpan(v3Red.paths).maxSpan).toBeCloseTo(340, 0);
  });

  it('executes branch.B Capstone Starter and Variations 1..3 matching exact SVG scale and white stencil paths', () => {
    const act = getActivityById('branch.B');

    const s1 = runTurtle(act.starterWorkspace!, 1);
    expect(measureTurtleInkSpan(s1.paths).maxSpan).toBeCloseTo(300, 0);
    expect(Math.round(s1.robot.heading)).toBe(0);

    // Variation 1 (Kaleidoscope, $input=2 -> 346x400 hex lattice + cyan lotus)
    const v1 = act.variations![0];
    const v1i2 = runTurtle(v1.workspace, 2);
    expect(measureTurtleInkSpan(v1i2.paths).maxSpan).toBeCloseTo(400, 0);
    expect(v1i2.paths.some((p) => p.color === '#8b5cf6')).toBe(true);
    expect(v1i2.paths.some((p) => p.color === '#06b6d4')).toBe(true);

    // Variation 2 (6-Mood Dial 1..6, $input=5 -> blue r=180 halo + amber r=80 circles -> span 360)
    const v2 = act.variations![1];
    for (const opt of v2.inputConfig!.options) {
      const st = runTurtle(v2.workspace, opt);
      expect(st.paths.length, `branch.B var2 input ${opt}`).toBeGreaterThan(0);
      expect(measureTurtleInkSpan(st.paths).maxSpan).toBeGreaterThanOrEqual(180);
    }
    const v2i5 = runTurtle(v2.workspace, 5);
    expect(measureTurtleInkSpan(v2i5.paths).maxSpan).toBeCloseTo(360, 0);
    expect(v2i5.paths.some((p) => p.color === '#3b82f6')).toBe(true);
    expect(v2i5.paths.some((p) => p.color === '#f59e0b')).toBe(true);

    // Variation 3 (White-Eraser Stencil 1..6, $input=3 -> span 350 with white width-8 strokes)
    const v3 = act.variations![2];
    const v3i3 = runTurtle(v3.workspace, 3);
    expect(measureTurtleInkSpan(v3i3.paths).maxSpan).toBeCloseTo(350, 0);
    expect(v3i3.paths.some((p) => p.color === '#ffffff' && p.width === 8)).toBe(true);
    expect(v3i3.paths.some((p) => p.color === '#f59e0b')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Beat Jukebox `$input` Execution Tests (`branch.C`)
// ---------------------------------------------------------------------------

describe('Module `branch` — Beat Jukebox $input Execution (`branch.C`)', () => {
  function runBeat(ws: WorkspaceState, sceneInput: number | string): BeatState {
    const initial = createInitialBeatState(true);
    const res = runHeadlessSimulation(ws, 'beat', initial, 400, { sceneInput });
    return res.finalState;
  }

  it('executes branch.C Starter across $input 1..4 cleanly with hidden unused cursor', () => {
    const act = getActivityById('branch.C');
    for (const opt of act.inputConfig!.options) {
      const st = runBeat(act.starterWorkspace!, opt);
      expect(st.cursor.visible, `starter cursor hidden for input ${opt}`).toBe(false);
      expect(st.beatIndex, `starter beatIndex > 0 for input ${opt}`).toBeGreaterThan(0);
    }

    const track1 = runBeat(act.starterWorkspace!, 1);
    expect(track1.leds[3][3]).toBe('#fbbf24');
    expect(track1.leds[3][4]).toBe('#fbbf24');

    const track4 = runBeat(act.starterWorkspace!, 4);
    expect(track4.leds.flat().every((c) => c === null)).toBe(true);
  });

  it('executes branch.C Variations 1..3 including Black off-pad cutout and color swatches', () => {
    const act = getActivityById('branch.C');
    const [var1, var2, var3] = act.variations!;

    // Var 1 ($input = 1 -> corner amber pixels (1,1) and (8,8))
    const v1i1 = runBeat(var1.workspace, 1);
    expect(v1i1.leds[0][0]).toBe('#fbbf24');
    expect(v1i1.leds[7][7]).toBe('#fbbf24');

    // Var 2 ($input = 3 -> NOTE stamp followed by Black (#0f172a) erasing (4,4) & (5,5))
    const v2i1 = runBeat(var2.workspace, 1);
    const v2i3 = runBeat(var2.workspace, 3);
    expect(v2i1.leds[3][3]).toBe('#fbbf24');
    expect(v2i3.leds[3][3]).toBeNull();
    expect(v2i3.leds[4][4]).toBeNull();

    // Var 3 (color mode options: 'red', 'blue', 'green', 'yellow')
    expect(var3.inputConfig?.mode).toBe('color');
    for (const colorOpt of var3.inputConfig!.options) {
      const st = runBeat(var3.workspace, colorOpt);
      expect(st.beatIndex, `var3 color ${colorOpt} plays notes`).toBeGreaterThan(0);
      expect(st.leds.flat().some((c) => c !== null), `var3 color ${colorOpt} lights pad`).toBe(
        true
      );
    }
  });
});
