import { describe, expect, it } from 'vitest';
import {
  CMP_5A_ROW_VARIANTS,
  CMP_ACTIVITIES,
} from '../src/data/curriculum/cmpActivities';
import {
  type ConditionExpr,
  type CurriculumActivity,
  type CurriculumDepotDefinition,
  type CurriculumSwitchyardDefinition,
  createCurriculumGridState,
} from '../src/data/curriculum/types';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateControlStructure,
} from '../src/engine/interpreter';
import { getPlaceholderHintCategory } from '../src/engine/placeholderHelpers';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { readCodeScopes, writeCodeScopes } from '../src/engine/serialization/codeScopes';
import {
  ENV_ID_BEAT,
  ENV_ID_DEPOT,
  ENV_ID_GRID_V3,
  ENV_ID_SWITCHYARD,
  ENV_ID_TURTLE,
} from '../src/engine/serialization/types';
import type { SimulationEnvironment } from '../src/engine/simulation/types';
import {
  checkScaffoldWorkspace,
  verifyActivityConstraints,
} from '../src/engine/verification/constraintSolver';
import {
  beatSimulationEnvironment,
  createInitialBeatState,
} from '../src/simulations/beat/beatEnvironment';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { turtleSimulationEnvironment } from '../src/simulations/turtle/turtleEnvironment';
import type { TurtleBounds, TurtleState } from '../src/simulations/turtle/types';
import type { CodeBlock, GridState, ScopeType, SimulationStatus, WorkspaceState } from '../src/types';

// ---------------------------------------------------------------------------
// Shared Test Helpers
// ---------------------------------------------------------------------------

const EXPECTED_CMP_IDS = [
  'cmp.0',
  'cmp.1',
  'cmp.1a',
  'cmp.2',
  'cmp.3',
  'cmp.4',
  'cmp.5',
  'cmp.5a',
  'cmp.6',
  'cmp.7',
  'cmp.8',
  'cmp.9',
  'cmp.A',
  'cmp.B',
  'cmp.C',
  'cmp.M1',
  'cmp.M2',
  'cmp.M3',
] as const;

const SCOPES: readonly ScopeType[] = ['MAIN', 'F1', 'F2', 'F3'];

function getActivity(id: string): CurriculumActivity {
  const found = CMP_ACTIVITIES.find((a) => a.id === id);
  if (!found) throw new Error(`Missing activity ${id}`);
  return found;
}

function envByteForSimId(simId: CurriculumActivity['simId']): number {
  switch (simId) {
    case 'grid':
      return ENV_ID_GRID_V3;
    case 'turtle':
      return ENV_ID_TURTLE;
    case 'beat':
      return ENV_ID_BEAT;
    case 'depot':
      return ENV_ID_DEPOT;
    case 'switchyard':
      return ENV_ID_SWITCHYARD;
  }
}

function countSentences(text: string): number {
  return text
    .trim()
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

function normalizeCondForWireCompare(cond: ConditionExpr): unknown {
  if (cond.kind === 'sensor') {
    return {
      kind: 'sensor',
      sensor: cond.sensor,
      ...(cond.param !== undefined ? { param: String(cond.param) } : {}),
    };
  }
  if (cond.kind === 'not') {
    return { kind: 'not', operand: normalizeCondForWireCompare(cond.operand) };
  }
  if (cond.kind === 'and' || cond.kind === 'or') {
    return {
      kind: cond.kind,
      left: normalizeCondForWireCompare(cond.left),
      right: normalizeCondForWireCompare(cond.right),
    };
  }
  if (cond.kind === 'cmp') {
    const normalizeSensorToken = (v: unknown): unknown => {
      if (typeof v !== 'string') return v;
      // Wire format canonicalizes $dockCount[A]/$dockCount[0] -> $dockCount[0] and $topValue[STACK_1] -> $topValue[STACK_1]
      return v.replace(/\[(0|A)\]$/i, '[0]');
    };
    return {
      kind: 'cmp',
      op: cond.op === '==' ? '=' : cond.op,
      left: normalizeSensorToken(cond.left),
      right: normalizeSensorToken(cond.right),
    };
  }
  return cond;
}

function normalizeBlockForWireCompare(b: CodeBlock): Record<string, unknown> {
  const out: Record<string, unknown> = { type: b.type };
  if (b.repeatCount !== undefined && b.repeatCount !== 1) {
    out.repeatCount = b.repeatCount;
  }
  if (b.type === 'PLACEHOLDER') {
    out.hintCategory = getPlaceholderHintCategory(b);
    return out;
  }
  if (b.params) {
    const p: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.params)) {
      if (k === 'condition' && v && typeof v === 'object') {
        p.condition = normalizeCondForWireCompare(v as ConditionExpr);
      } else if (
        (b.type === 'TURN_RIGHT' || b.type === 'TURN_LEFT') &&
        k === 'angle' &&
        typeof v === 'number'
      ) {
        // VLE wire format stores integer degrees
        p.angle = Math.round(v);
      } else if (
        (b.type === 'SWITCH_LEFT' || b.type === 'SWITCH_RIGHT') &&
        k === 'junction' &&
        v === 'A'
      ) {
        continue;
      } else {
        p[k] = v;
      }
    }
    if (Object.keys(p).length > 0) {
      out.params = p;
    }
  }
  return out;
}

function runHeadless<TState>(
  workspace: WorkspaceState,
  simEnv: SimulationEnvironment<TState>,
  initialState: TState,
  maxTicks = 4000
): {
  finalState: TState;
  runtimeStatus: SimulationStatus;
  evalStatus: SimulationStatus;
  moveFwdCount: number;
} {
  let runtime = createInitialInterpreterState();
  let simState = initialState;
  let moveFwdCount = 0;

  for (let i = 0; i < maxTicks; i++) {
    const topFrame = runtime.callStack[runtime.callStack.length - 1];
    const activeBlock = topFrame ? workspace[topFrame.scope]?.[topFrame.pc] : undefined;
    if (activeBlock?.type === 'MOVE_FWD') {
      moveFwdCount++;
    }
    const res = tickInterpreter(runtime, workspace, simState, simEnv);
    runtime = res.nextRuntime;
    simState = res.nextGrid;
    if (res.done) break;
  }

  const evalStatus = simEnv.evaluateCompletion(simState);
  return {
    finalState: simState,
    runtimeStatus: runtime.status,
    evalStatus,
    moveFwdCount,
  };
}

// ---------------------------------------------------------------------------
// Forward-Compatible Grid Charge-Pad Adapter for cmp.M1 (`requiredCount: m`)
// ---------------------------------------------------------------------------

interface ChargePadLedgerState extends GridState {
  __padCounts?: Record<string, number>;
}

function createCmpM1ChargePadEnv(): SimulationEnvironment<GridState> {
  const padKey = (x: number, y: number) => `${x},${y}`;

  const getRequiredCount = (sw: unknown): number => {
    const rc = (sw as { requiredCount?: unknown })?.requiredCount;
    return typeof rc === 'number' && rc > 1 ? rc : 1;
  };

  return {
    ...gridSimulationEnvironment,
    executeAction(actionType, state, options) {
      const st = state as ChargePadLedgerState;
      if (actionType === 'USE_DROP' && state.robot.carriedItem?.type === 'crate') {
        const rx = state.robot.x;
        const ry = state.robot.y;
        const padSw = state.floorSwitches?.find(
          (sw) => sw.x === rx && sw.y === ry && getRequiredCount(sw) > 1
        );
        if (padSw) {
          const req = getRequiredCount(padSw);
          const key = padKey(rx, ry);
          const nextCount = (st.__padCounts?.[key] ?? 0) + 1;
          if (nextCount > req) {
            const collided: ChargePadLedgerState = {
              ...state,
              status: 'COLLISION',
            };
            return { nextState: collided, status: 'COLLISION', isCollision: true };
          }
          // Clear previous single crate visual on the multi-cell Charge Pad before delegating drop
          const clearedItems = (state.worldItems ?? []).filter(
            (it) => !(it.type === 'crate' && it.x === rx && it.y === ry)
          );
          const baseRes = gridSimulationEnvironment.executeAction(
            actionType,
            { ...state, worldItems: clearedItems },
            options
          );
          const satisfied = nextCount === req;
          const patchedSwitches = baseRes.nextState.floorSwitches?.map((sw) =>
            sw.id === padSw.id ? { ...sw, active: satisfied } : sw
          );
          const nextState: ChargePadLedgerState = {
            ...baseRes.nextState,
            floorSwitches: patchedSwitches,
            __padCounts: { ...(st.__padCounts ?? {}), [key]: nextCount },
          };
          return { ...baseRes, nextState };
        }
      }

      const res = gridSimulationEnvironment.executeAction(actionType, state, options);
      // Preserve pad counts & strict `nextCount === requiredCount` switch state across moves
      if (st.__padCounts && res.nextState.floorSwitches) {
        const patchedSwitches = res.nextState.floorSwitches.map((sw) => {
          const req = getRequiredCount(sw);
          if (req <= 1) return sw;
          const count = st.__padCounts?.[padKey(sw.x, sw.y)] ?? 0;
          return { ...sw, active: count === req };
        });
        const onGoal = res.nextState.flags.some(
          (f) => f.isGoal && f.x === res.nextState.robot.x && f.y === res.nextState.robot.y
        );
        const allPadsExact = patchedSwitches.every((sw) => !sw.requiredForGoal || sw.active);
        const patchedFlags = res.nextState.flags.map((f) =>
          f.isGoal ? { ...f, collected: onGoal && allPadsExact } : f
        );
        const nextState: ChargePadLedgerState = {
          ...res.nextState,
          floorSwitches: patchedSwitches,
          flags: patchedFlags,
          status:
            res.nextState.status === 'SUCCESS' && !allPadsExact
              ? 'RUNNING'
              : res.nextState.status,
          __padCounts: st.__padCounts,
        };
        return {
          ...res,
          nextState,
          isSuccess: Boolean(res.isSuccess && allPadsExact),
        };
      }
      return res;
    },
    evaluateCompletion(state) {
      const st = state as ChargePadLedgerState;
      if (state.floorSwitches?.some((sw) => getRequiredCount(sw) > 1)) {
        const allExact = state.floorSwitches.every((sw) => {
          if (!sw.requiredForGoal) return true;
          const req = getRequiredCount(sw);
          if (req <= 1) return Boolean(sw.active);
          return (st.__padCounts?.[padKey(sw.x, sw.y)] ?? 0) === req;
        });
        if (!allExact) return state.status === 'COLLISION' ? 'COLLISION' : 'IDLE';
        const onGoal = state.flags.some(
          (f) => f.isGoal && f.x === state.robot.x && f.y === state.robot.y
        );
        const emptyBag = !state.requireEmptyBackpackAtGoal || !state.robot.carriedItem;
        if (onGoal && emptyBag) return 'SUCCESS';
        return 'IDLE';
      }
      return gridSimulationEnvironment.evaluateCompletion(state);
    },
  };
}

// ---------------------------------------------------------------------------
// Phase 3 Switchyard & Numbered Toy-Block Depot VM Harnesses
// (Executes real `tickInterpreter` against CMP_ACTIVITIES specs on `swarm/p3-curr-cmp`)
// ---------------------------------------------------------------------------

interface Phase3SwitchyardSimState {
  queue: Array<{
    id: string;
    color: string;
    icon: string;
    weight: number;
    damaged: boolean;
    seqNum?: number;
  }>;
  switchDir: 'LEFT' | 'RIGHT';
  docks: Array<{
    id: string;
    quota?: number;
    minWeight?: number;
    maxWeight?: number;
    paritySlot?: boolean | string;
    acceptsDamaged?: boolean;
    items: Array<{ weight: number; damaged: boolean; seqNum?: number }>;
  }>;
  scrapped: Array<{ weight: number; damaged: boolean }>;
  def: CurriculumSwitchyardDefinition;
  collided: boolean;
}

function createSwitchyardHarnessState(
  def: CurriculumSwitchyardDefinition
): Phase3SwitchyardSimState {
  const sw0 = def.switches[0];
  return {
    queue: def.incomingStream.map((it) => ({
      id: it.id,
      color: String(it.color),
      icon: String(it.icon),
      weight: it.weight ?? 1,
      damaged: Boolean(it.damaged),
      seqNum: it.seqNum,
    })),
    switchDir: sw0?.initialDirection === 'right' ? 'RIGHT' : 'LEFT',
    docks: def.docks.map((d) => ({
      id: d.id,
      quota: d.quota,
      minWeight: d.minWeight,
      maxWeight: d.maxWeight,
      paritySlot: d.paritySlot,
      acceptsDamaged: d.acceptsDamaged,
      items: [],
    })),
    scrapped: [],
    def,
    collided: false,
  };
}

const phase3SwitchyardTestEnv: SimulationEnvironment<Phase3SwitchyardSimState> = {
  id: 'switchyard',
  name: 'Switchyard Phase 3 Test Harness',
  actions: [],
  createInitialState: () =>
    createSwitchyardHarnessState({ incomingStream: [], switches: [], docks: [] }),
  resetState: (s) => createSwitchyardHarnessState(s.def),
  executeAction(actionType, state) {
    if (state.collided) {
      return { nextState: state, status: 'COLLISION', isCollision: true };
    }
    if (actionType === 'SWITCH_LEFT') {
      return { nextState: { ...state, switchDir: 'LEFT' }, status: 'RUNNING' };
    }
    if (actionType === 'SWITCH_RIGHT') {
      return { nextState: { ...state, switchDir: 'RIGHT' }, status: 'RUNNING' };
    }
    if (actionType === 'SEND_NEXT') {
      if (state.queue.length === 0) {
        return {
          nextState: { ...state, collided: true },
          status: 'COLLISION',
          isCollision: true,
        };
      }
      const [car, ...rest] = state.queue;
      const dockIdx = state.switchDir === 'LEFT' ? 0 : 1;
      const nextDocks = state.docks.map((d, idx) =>
        idx === dockIdx
          ? {
              ...d,
              items: [...d.items, { weight: car.weight, damaged: car.damaged, seqNum: car.seqNum }],
            }
          : d
      );
      return { nextState: { ...state, queue: rest, docks: nextDocks }, status: 'RUNNING' };
    }
    if (actionType === 'SCRAP_ITEM') {
      if (state.queue.length === 0) {
        return {
          nextState: { ...state, collided: true },
          status: 'COLLISION',
          isCollision: true,
        };
      }
      const [car, ...rest] = state.queue;
      const rules = state.def.scrapRules;
      let canScrap = car.damaged;
      if (rules && typeof rules === 'object' && rules.kind === 'damaged_or_overweight') {
        canScrap = car.damaged || car.weight > (rules.maxWeight ?? 20);
      }
      if (!canScrap) {
        return {
          nextState: { ...state, collided: true },
          status: 'COLLISION',
          isCollision: true,
        };
      }
      return {
        nextState: {
          ...state,
          queue: rest,
          scrapped: [...state.scrapped, { weight: car.weight, damaged: car.damaged }],
        },
        status: 'RUNNING',
      };
    }
    return { nextState: state, status: 'RUNNING' };
  },
  evaluateSensor(sensorObj, state) {
    const name = typeof sensorObj === 'string' ? sensorObj : (sensorObj as { sensor?: string })?.sensor;
    if (name === 'hasNextItem') return state.queue.length > 0;
    if (name === 'itemDamaged') return Boolean(state.queue[0]?.damaged);
    return false;
  },
  evaluateCompletion(state) {
    if (state.collided) return 'COLLISION';
    if (state.queue.length > 0) return 'IDLE';

    // Validate docks
    for (const dock of state.docks) {
      if (dock.acceptsDamaged === false && dock.items.some((it) => it.damaged)) {
        return 'IDLE';
      }
      if (dock.minWeight !== undefined && dock.items.some((it) => it.weight < dock.minWeight!)) {
        return 'IDLE';
      }
      if (dock.maxWeight !== undefined && dock.items.some((it) => it.weight > dock.maxWeight!)) {
        return 'IDLE';
      }
      if (dock.quota !== undefined) {
        // Dock A must fill up to min(quota, eligibleIntactAvailable) and never exceed quota
        if (dock.items.length > dock.quota) return 'IDLE';
        const eligibleTotal = state.docks.reduce(
          (acc, d) =>
            acc +
            d.items.filter(
              (it) =>
                !it.damaged &&
                (dock.minWeight === undefined || it.weight >= dock.minWeight) &&
                (dock.maxWeight === undefined || it.weight <= dock.maxWeight)
            ).length,
          0
        );
        const expectedInQuotaDock = Math.min(dock.quota, eligibleTotal);
        if (dock.items.length !== expectedInQuotaDock) return 'IDLE';
      }
      if (dock.paritySlot === 'odd') {
        if (dock.items.some((it) => (it.seqNum ?? 0) % 2 !== 1)) return 'IDLE';
      }
      if (dock.paritySlot === 'even') {
        if (dock.items.some((it) => (it.seqNum ?? 0) % 2 !== 0)) return 'IDLE';
      }
    }

    // Validate parity split completeness when paritySlot is configured
    if (state.docks.some((d) => d.paritySlot !== undefined)) {
      const totalDelivered = state.docks.reduce((acc, d) => acc + d.items.length, 0);
      if (totalDelivered !== state.def.incomingStream.length) return 'IDLE';
    }

    // Validate balance_scale mode
    if (state.def.mode === 'balance_scale') {
      const sumA = state.docks[0].items.reduce((s, it) => s + it.weight, 0);
      const sumB = state.docks[1].items.reduce((s, it) => s + it.weight, 0);
      const tol = state.def.balanceTolerance ?? 0;
      if (Math.abs(sumA - sumB) > tol) return 'IDLE';
    }

    return 'SUCCESS';
  },
  Renderer: (() => null) as unknown as SimulationEnvironment<Phase3SwitchyardSimState>['Renderer'],
};

interface Phase3DepotSimState {
  workerStation: string;
  input: Array<{ value: number; color: string }>;
  stacks: [Array<{ value: number }>, Array<{ value: number }>, Array<{ value: number }>];
  heldItem: { value: number } | null;
  output: number[];
  def: CurriculumDepotDefinition;
  collided: boolean;
}

function createDepotHarnessState(def: CurriculumDepotDefinition): Phase3DepotSimState {
  const rawStackVals = (def as unknown as { stackValues?: [number[], number[], number[]] })
    .stackValues ?? [[], [], []];
  return {
    workerStation: def.workerStation ?? 'INPUT',
    input: (def.input ?? []).map((it) => ({
      value: it.value ?? 0,
      color: String(it.color),
    })),
    stacks: [
      rawStackVals[0].map((v) => ({ value: v })),
      rawStackVals[1].map((v) => ({ value: v })),
      rawStackVals[2].map((v) => ({ value: v })),
    ],
    heldItem: null,
    output: [],
    def,
    collided: false,
  };
}

const phase3DepotTestEnv: SimulationEnvironment<Phase3DepotSimState> = {
  id: 'depot',
  name: 'Depot Toy-Block Phase 3 Test Harness',
  actions: [],
  createInitialState: () =>
    createDepotHarnessState({
      stacks: [[], [], []],
      initialStacks: [[], [], []],
      output: [],
      workerStation: 'INPUT',
      initialWorkerStation: 'INPUT',
      heldCrate: null,
      heldDamaged: false,
      lastFailureReason: null,
      status: 'IDLE',
      stepCount: 0,
      queue: [],
      initialQueue: [],
      scrapCount: 0,
    }),
  resetState: (s) => createDepotHarnessState(s.def),
  executeAction(actionType, state, options) {
    if (state.collided) return { nextState: state, status: 'COLLISION', isCollision: true };
    if (actionType === 'DEPOT_MOVE_TO') {
      const station = String(options?.params?.station ?? 'STACK_1').toUpperCase();
      return { nextState: { ...state, workerStation: station }, status: 'RUNNING' };
    }
    if (actionType === 'DEPOT_GRAB') {
      if (state.heldItem !== null) {
        return { nextState: { ...state, collided: true }, status: 'COLLISION', isCollision: true };
      }
      if (state.workerStation === 'INPUT') {
        if (state.input.length === 0) {
          return { nextState: { ...state, collided: true }, status: 'COLLISION', isCollision: true };
        }
        const [first, ...rest] = state.input;
        return {
          nextState: { ...state, input: rest, heldItem: { value: first.value } },
          status: 'RUNNING',
        };
      }
      const idx =
        state.workerStation === 'STACK_2' ? 1 : state.workerStation === 'STACK_3' ? 2 : 0;
      const st = state.stacks[idx];
      if (st.length === 0) {
        return { nextState: { ...state, collided: true }, status: 'COLLISION', isCollision: true };
      }
      const nextStack = st.slice(0, -1);
      const top = st[st.length - 1];
      const nextStacks: Phase3DepotSimState['stacks'] = [
        idx === 0 ? nextStack : state.stacks[0],
        idx === 1 ? nextStack : state.stacks[1],
        idx === 2 ? nextStack : state.stacks[2],
      ];
      return {
        nextState: { ...state, stacks: nextStacks, heldItem: { value: top.value } },
        status: 'RUNNING',
      };
    }
    if (actionType === 'DEPOT_PLACE') {
      if (state.heldItem === null || state.workerStation === 'INPUT') {
        return { nextState: { ...state, collided: true }, status: 'COLLISION', isCollision: true };
      }
      const idx =
        state.workerStation === 'STACK_2' ? 1 : state.workerStation === 'STACK_3' ? 2 : 0;
      const nextStack = [...state.stacks[idx], { value: state.heldItem.value }];
      const nextStacks: Phase3DepotSimState['stacks'] = [
        idx === 0 ? nextStack : state.stacks[0],
        idx === 1 ? nextStack : state.stacks[1],
        idx === 2 ? nextStack : state.stacks[2],
      ];
      return {
        nextState: { ...state, stacks: nextStacks, heldItem: null },
        status: 'RUNNING',
      };
    }
    if (actionType === 'DEPOT_SEND_OUT') {
      if (state.heldItem === null) {
        return { nextState: { ...state, collided: true }, status: 'COLLISION', isCollision: true };
      }
      return {
        nextState: {
          ...state,
          output: [...state.output, state.heldItem.value],
          heldItem: null,
        },
        status: 'RUNNING',
      };
    }
    return { nextState: state, status: 'RUNNING' };
  },
  evaluateSensor(sensorObj, state, param) {
    const s =
      typeof sensorObj === 'string'
        ? { sensor: sensorObj, param }
        : (sensorObj as { sensor?: string; param?: string });
    if (s.sensor === 'hasItem') return state.heldItem !== null;
    if (s.sensor === 'stationEmpty') {
      const target = String(s.param ?? param ?? state.workerStation).toUpperCase();
      if (target === 'INPUT') return state.input.length === 0;
      if (target === 'STACK_2') return state.stacks[1].length === 0;
      if (target === 'STACK_3') return state.stacks[2].length === 0;
      return state.stacks[0].length === 0;
    }
    return false;
  },
  evaluateCompletion(state) {
    if (state.collided || state.heldItem !== null) return 'COLLISION';
    if (state.input.length > 0) return 'IDLE';
    const meta = state.def as unknown as {
      targetOutputValues?: number[];
      targetStackValues?: [number[], number[], number[]];
    };
    if (meta.targetOutputValues) {
      if (state.output.length !== meta.targetOutputValues.length) return 'IDLE';
      if (state.output.some((v, idx) => v !== meta.targetOutputValues![idx])) return 'IDLE';
    }
    if (meta.targetStackValues) {
      const s2Actual = state.stacks[1].map((x) => x.value);
      const s2Target = meta.targetStackValues[1];
      if (s2Actual.length !== s2Target.length) return 'IDLE';
      if (s2Actual.some((v, idx) => v !== s2Target[idx])) return 'IDLE';
    }
    return 'SUCCESS';
  },
  Renderer: (() => null) as unknown as SimulationEnvironment<Phase3DepotSimState>['Renderer'],
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Module cmp Curriculum (CMP_ACTIVITIES — 18 Activities)', () => {
  it('exports all 18 canonical Module cmp activities in curriculum order with valid Stage 2 metadata', () => {
    expect(CMP_ACTIVITIES.map((a) => a.id)).toEqual([...EXPECTED_CMP_IDS]);
    // Pure UTF-8 check: zero CP1252 mojibake sequences across icons, titles, and coPilotCards
    expect(JSON.stringify(CMP_ACTIVITIES)).not.toMatch(/[\u00c2\u00c3\u00e2\u00f0]/);

    const forbiddenJargon = /\b(OP_VAR_OP|OP_VAR_ASSIGN|ENV_VERSION|uint8|float64|VLE|bitmask)\b/i;

    for (const act of CMP_ACTIVITIES) {
      expect(act.moduleId).toBe('cmp');
      expect(act.version).toBe(1);
      expect(act.palette.allowRecursion).toBe(false);

      if (act.format === 'explanation') {
        expect(['cmp.0', 'cmp.3', 'cmp.6']).toContain(act.id);
        expect(act.coPilotCard).toBeDefined();
        expect(countSentences(act.coPilotCard!)).toBeLessThanOrEqual(2);
        expect(act.coPilotCard).not.toMatch(forbiddenJargon);
        expect(act.demoTabs?.length).toBeGreaterThanOrEqual(2);
        for (const tab of act.demoTabs!) {
          expect(tab.coPilotCard).toBeDefined();
          expect(countSentences(tab.coPilotCard!)).toBeLessThanOrEqual(2);
          expect(tab.coPilotCard).not.toMatch(forbiddenJargon);
        }
      } else {
        // Zero-Reading Rule: puzzles, sandboxes, capstones, and challenges do not mount top explanation banners
        expect(act.coPilotCard).toBeUndefined();
      }

      if (act.format === 'challenge') {
        expect(['cmp.M1', 'cmp.M2', 'cmp.M3']).toContain(act.id);
        for (const sc of SCOPES) {
          expect(act.starterWorkspace?.[sc] ?? []).toHaveLength(0);
        }
        expect(act.partialHelp?.mode).toBe('scaffold');
        expect(act.referenceSolution).toBeDefined();
      }
    }

    expect(getActivity('cmp.A').capstoneType).toBe('puzzle');
    expect(getActivity('cmp.B').capstoneType).toBe('puzzle');
    expect(getActivity('cmp.C').capstoneType).toBe('creative');

    // Repeat badge gates
    expect(getActivity('cmp.5').palette.allowRepeatBadges).toBe(true);
    expect(getActivity('cmp.C').palette.allowRepeatBadges).toBe(true);
    expect(getActivity('cmp.2').palette.allowRepeatBadges).toBe(false);
    expect(getActivity('cmp.M1').palette.allowRepeatBadges).toBe(false);
    expect(getActivity('cmp.M3').palette.allowRepeatBadges).toBe(false);
  });

  it('enforces balanced control structures, strict 3-address VAR_ASSIGN/VAR_OP, slotCaps, and neutral ? PLACEHOLDERs across all workspaces', () => {
    const collectWorkspaces = (
      act: CurriculumActivity
    ): Array<{ label: string; ws: WorkspaceState; checkCap: boolean }> => {
      const list: Array<{ label: string; ws: WorkspaceState; checkCap: boolean }> = [];
      if (act.starterWorkspace) {
        list.push({ label: `${act.id}.starter`, ws: act.starterWorkspace, checkCap: true });
      }
      if (act.partialHelp?.scaffoldWorkspace) {
        list.push({
          label: `${act.id}.scaffold`,
          ws: act.partialHelp.scaffoldWorkspace,
          checkCap: true,
        });
      }
      if (act.referenceSolution) {
        list.push({ label: `${act.id}.reference`, ws: act.referenceSolution, checkCap: true });
      }
      for (const v of act.variations ?? []) {
        list.push({ label: `${act.id}.var(${v.id})`, ws: v.workspace, checkCap: true });
      }
      for (const t of act.demoTabs ?? []) {
        list.push({ label: `${act.id}.demo(${t.id})`, ws: t.workspace, checkCap: false });
      }
      return list;
    };

    for (const act of CMP_ACTIVITIES) {
      for (const { label, ws, checkCap } of collectWorkspaces(act)) {
        let totalBlocks = 0;
        for (const sc of SCOPES) {
          const blocks = ws[sc] ?? [];
          totalBlocks += blocks.length;

          const ctrl = validateControlStructure(blocks);
          expect(ctrl.isValid, `${label}:${sc} unbalanced control structure`).toBe(true);

          if (checkCap && act.slotCap?.perScope?.[sc] !== undefined) {
            expect(blocks.length, `${label}:${sc} exceeds perScope cap`).toBeLessThanOrEqual(
              act.slotCap.perScope[sc]!
            );
          }

          for (const blk of blocks) {
            if (blk.type === 'VAR_ASSIGN') {
              expect(String(blk.params?.a)).toMatch(/^[a-z]$/);
              expect(blk.params?.b).toBeDefined();
            }
            if (blk.type === 'VAR_OP') {
              expect(String(blk.params?.a)).toMatch(/^[a-z]$/);
              expect(['+', '-', '*', '/', '%']).toContain(blk.params?.op);
              expect(blk.params?.b).toBeDefined();
              expect(blk.params?.c).toBeDefined();
            }
            if (blk.type === 'PLACEHOLDER') {
              expect(getPlaceholderHintCategory(blk), `${label} non-neutral placeholder`).toBe(
                'any'
              );
            }
          }
        }

        if (checkCap && act.slotCap?.maxTotal !== undefined) {
          expect(totalBlocks, `${label} exceeds maxTotal`).toBeLessThanOrEqual(
            act.slotCap.maxTotal
          );
        }

        if (label.endsWith('.scaffold')) {
          const phCount = SCOPES.reduce(
            (sum, sc) =>
              sum + (ws[sc] ?? []).filter((b) => b.type === 'PLACEHOLDER').length,
            0
          );
          expect(phCount, `${label} must include >= 1 neutral ? placeholder`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('round-trips every workspace across all 18 activities losslessly through binary writeCodeScopes/readCodeScopes (0x30 CMP)', () => {
    for (const act of CMP_ACTIVITIES) {
      const workspaces: Array<{ envByte: number; ws: WorkspaceState; tag: string }> = [];
      const baseEnv = envByteForSimId(act.simId);

      if (act.starterWorkspace) {
        workspaces.push({ envByte: baseEnv, ws: act.starterWorkspace, tag: `${act.id}.starter` });
      }
      if (act.partialHelp?.scaffoldWorkspace) {
        workspaces.push({
          envByte: baseEnv,
          ws: act.partialHelp.scaffoldWorkspace,
          tag: `${act.id}.scaffold`,
        });
      }
      if (act.referenceSolution) {
        workspaces.push({ envByte: baseEnv, ws: act.referenceSolution, tag: `${act.id}.ref` });
      }
      for (const v of act.variations ?? []) {
        workspaces.push({ envByte: baseEnv, ws: v.workspace, tag: `${act.id}.${v.id}` });
      }
      for (const tab of act.demoTabs ?? []) {
        workspaces.push({
          envByte: envByteForSimId(tab.simId ?? act.simId),
          ws: tab.workspace,
          tag: `${act.id}.${tab.id}`,
        });
      }

      for (const { envByte, ws, tag } of workspaces) {
        const writer = new BinaryWriter();
        writeCodeScopes(writer, ws, envByte);
        const bytes = writer.getBytes();
        const decoded = readCodeScopes(new BinaryReader(bytes), envByte);

        for (const sc of SCOPES) {
          const expected = (ws[sc] ?? []).map(normalizeBlockForWireCompare);
          const actual = (decoded[sc] ?? []).map(normalizeBlockForWireCompare);
          expect(actual, `Binary wire mismatch in ${tag}:${sc}`).toEqual(expected);
        }
      }
    }
  });

  it('verifies Robot Grid puzzles/capstones/challenges (cmp.2, cmp.B, cmp.M1, cmp.M3) in < 500ms each and blocks off-by-one & parity bypasses', () => {
    const cmp2 = getActivity('cmp.2');
    const cmpB = getActivity('cmp.B');
    const cmpM1 = getActivity('cmp.M1');
    const cmpM3 = getActivity('cmp.M3');
    const cmpM1Env = createCmpM1ChargePadEnv();

    for (const { act, simEnv } of [
      { act: cmp2, simEnv: undefined },
      { act: cmpB, simEnv: undefined },
      { act: cmpM1, simEnv: cmpM1Env },
      { act: cmpM3, simEnv: undefined },
    ]) {
      const t0 = performance.now();
      const report = verifyActivityConstraints(act, simEnv ? { simEnv } : undefined);
      const elapsed = performance.now() - t0;
      expect(report.passed, `${act.id} failed solver: ${JSON.stringify(report)}`).toBe(true);
      expect(elapsed, `${act.id} solver exceeded 500ms (${elapsed.toFixed(1)}ms)`).toBeLessThan(
        500
      );
    }

    // cmp.2 counterexample: off-by-one `c <= k` drops cell at k + 1 and fails
    const cmp2OffByOne: WorkspaceState = {
      ...cmp2.referenceSolution!,
      MAIN: cmp2.referenceSolution!.MAIN.map((b, i) =>
        i === 3
          ? {
              ...b,
              params: { condition: { kind: 'cmp', op: '<=', left: 'c', right: 'k' } },
            }
          : b
      ),
    };
    const cmp2OffRes = runHeadless(
      cmp2OffByOne,
      gridSimulationEnvironment,
      createCurriculumGridState(cmp2.gridVariants![0])
    );
    expect(cmp2OffRes.evalStatus).not.toBe('SUCCESS');

    // cmp.B: verify exact tight moveCap (9, 14, 8, 15) on referenceSolution and failure of `t > k` on Maps #2 & #4
    const expectedMoveCaps = [9, 14, 8, 15];
    cmpB.gridVariants!.forEach((gridDef, idx) => {
      const res = runHeadless(
        cmpB.referenceSolution!,
        gridSimulationEnvironment,
        createCurriculumGridState(gridDef)
      );
      expect(res.evalStatus).toBe('SUCCESS');
      expect(res.moveFwdCount).toBe(expectedMoveCaps[idx]);
    });

    const cmpBStrictGt: WorkspaceState = {
      ...cmpB.referenceSolution!,
      MAIN: cmpB.referenceSolution!.MAIN.map((b) =>
        b.type === 'IF' && (b.params?.condition as ConditionExpr | undefined)?.kind === 'cmp' &&
        (b.params?.condition as { op?: string }).op === '>='
          ? {
              ...b,
              params: { condition: { kind: 'cmp', op: '>', left: 't', right: 'k' } },
            }
          : b
      ),
    };
    // Map #2 has exact tie t == k (4 == 4) at x = 1 and x = 5
    const cmpBGtMap2 = runHeadless(
      cmpBStrictGt,
      gridSimulationEnvironment,
      createCurriculumGridState(cmpB.gridVariants![1])
    );
    expect(cmpBGtMap2.evalStatus).not.toBe('SUCCESS');

    // cmp.M1 counterexamples: fixed LOOP [5] fails Map #2 (m=4 -> overcharge COLLISION) and Map #3 (m=6 -> undercharge)
    const cmpM1FixedLoop5: WorkspaceState = {
      ...cmpM1.referenceSolution!,
      MAIN: cmpM1.referenceSolution!.MAIN.map((b) =>
        b.type === 'LOOP_START' ? { ...b, repeatCount: 5 } : b
      ),
    };
    const m1Overcharge = runHeadless(
      cmpM1FixedLoop5,
      cmpM1Env,
      createCurriculumGridState(cmpM1.gridVariants![1]) // D=3, required m=4
    );
    expect(m1Overcharge.runtimeStatus).toBe('COLLISION');

    const m1Undercharge = runHeadless(
      cmpM1FixedLoop5,
      cmpM1Env,
      createCurriculumGridState(cmpM1.gridVariants![2]) // D=5, required m=6
    );
    expect(m1Undercharge.evalStatus).not.toBe('SUCCESS');

    // cmp.M3 counterexample: inverted parity (`p == 1` turns Right on row 0) turns Left into North boundary wall
    const cmpM3WrongParity: WorkspaceState = {
      ...cmpM3.referenceSolution!,
      MAIN: cmpM3.referenceSolution!.MAIN.map((b) =>
        b.type === 'IF' && (b.params?.condition as ConditionExpr | undefined)?.kind === 'cmp'
          ? {
              ...b,
              params: { condition: { kind: 'cmp', op: '==', left: 'p', right: 1 } },
            }
          : b
      ),
    };
    const m3WrongRes = runHeadless(
      cmpM3WrongParity,
      gridSimulationEnvironment,
      createCurriculumGridState(cmpM3.gridVariants![0])
    );
    expect(m3WrongRes.runtimeStatus).toBe('COLLISION');
  });

  it('verifies Turtle LOGO decimal division, >= 160 px / >= 240 px scale mandates, and MATH_ERROR zero-division guards (cmp.3, cmp.5, cmp.C)', () => {
    const computeInkMaxSpan = (state: TurtleState): number => {
      expect(state.paths.length).toBeGreaterThan(0);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const seg of state.paths) {
        minX = Math.min(minX, seg.fromX, seg.toX);
        maxX = Math.max(maxX, seg.fromX, seg.toX);
        minY = Math.min(minY, seg.fromY, seg.toY);
        maxY = Math.max(maxY, seg.fromY, seg.toY);
      }
      const b: TurtleBounds = { minX, maxX, minY, maxY };
      return Math.round(Math.max(b.maxX - b.minX, b.maxY - b.minY));
    };

    // cmp.3 Beat 3: 360 / 7 heptagon closes back to origin and spans >= 160 px
    const cmp3 = getActivity('cmp.3');
    const beat3 = cmp3.demoTabs![2];
    const beat3Res = runHeadless(
      beat3.workspace,
      turtleSimulationEnvironment,
      turtleSimulationEnvironment.createInitialState()
    );
    expect(beat3Res.runtimeStatus).not.toBe('MATH_ERROR');
    expect(computeInkMaxSpan(beat3Res.finalState)).toBeGreaterThanOrEqual(160);
    expect(Math.hypot(beat3Res.finalState.robot.x, beat3Res.finalState.robot.y)).toBeLessThan(0.01);

    // cmp.3 Beat 4: guarded `IF (d != 0)` completes safely, while unguarded `360 / 0` triggers MATH_ERROR
    const beat4 = cmp3.demoTabs![3];
    const guardedZeroRes = runHeadless(
      beat4.workspace,
      turtleSimulationEnvironment,
      turtleSimulationEnvironment.createInitialState()
    );
    expect(guardedZeroRes.runtimeStatus).not.toBe('MATH_ERROR');

    const unguardedDivZero: WorkspaceState = {
      MAIN: [
        { id: 'dz_1', type: 'VAR_ASSIGN', params: { a: 'd', b: 0 } },
        { id: 'dz_2', type: 'VAR_OP', params: { a: 'a', b: 360, op: '/', c: 'd' } },
      ],
      F1: [],
      F2: [],
      F3: [],
    };
    const divZeroRes = runHeadless(
      unguardedDivZero,
      turtleSimulationEnvironment,
      turtleSimulationEnvironment.createInitialState()
    );
    expect(divZeroRes.runtimeStatus).toBe('MATH_ERROR');

    // cmp.5 starter + all 4 variations: inkMaxSpan >= 160 px
    const cmp5 = getActivity('cmp.5');
    for (const ws of [cmp5.starterWorkspace!, ...cmp5.variations!.map((v) => v.workspace)]) {
      const res = runHeadless(
        ws,
        turtleSimulationEnvironment,
        turtleSimulationEnvironment.createInitialState(),
        6000
      );
      expect(res.runtimeStatus).not.toBe('MATH_ERROR');
      expect(computeInkMaxSpan(res.finalState)).toBeGreaterThanOrEqual(160);
    }

    // cmp.C starter + all 4 galaxy variations: inkMaxSpan >= 240 px
    const cmpC = getActivity('cmp.C');
    for (const ws of [cmpC.starterWorkspace!, ...cmpC.variations!.map((v) => v.workspace)]) {
      const res = runHeadless(
        ws,
        turtleSimulationEnvironment,
        turtleSimulationEnvironment.createInitialState(),
        8000
      );
      expect(res.runtimeStatus).not.toBe('MATH_ERROR');
      expect(computeInkMaxSpan(res.finalState)).toBeGreaterThanOrEqual(240);
    }
  });

  it('verifies Beat & Light 2D checkerboard parity (cmp.3 Beat 2 & cmp.5a across all 4 odd/even start rows)', () => {
    const cmp3BeatTab = getActivity('cmp.3').demoTabs![1];
    const demoRes = runHeadless(
      cmp3BeatTab.workspace,
      beatSimulationEnvironment,
      createInitialBeatState(true)
    );
    expect(demoRes.finalState.leds[0].every((hex) => hex !== null)).toBe(true);
    expect(new Set(demoRes.finalState.leds[0]).size).toBe(2);

    const cmp5a = getActivity('cmp.5a');
    expect(CMP_5A_ROW_VARIANTS).toHaveLength(4);

    // Naive 1D `$cursorX % 2` bypass (ignores `$cursorY`, so it inverts even rows 2 & 6!)
    const naive1DXParity: WorkspaceState = {
      ...cmp5a.referenceSolution!,
      F1: [
        { id: 'nx_1', type: 'VAR_OP', params: { a: 'p', b: '$cursorX', op: '%', c: 2 } },
        {
          id: 'nx_2',
          type: 'IF',
          params: { condition: { kind: 'cmp', op: '==', left: 'p', right: 0 } },
        },
        { id: 'nx_3', type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
        { id: 'nx_4', type: 'ELSE' },
        { id: 'nx_5', type: 'SET_LED_COLOR', params: { color: '#06b6d4' } },
        { id: 'nx_6', type: 'END_IF' },
        { id: 'nx_7', type: 'LIGHT_PIXEL', params: { x: '$cursorX', y: '$cursorY' } },
      ],
    };

    let naivePassCount = 0;
    for (const rowVar of CMP_5A_ROW_VARIANTS) {
      const makeRowState = () => {
        const st = createInitialBeatState(true);
        st.cursor = { x: rowVar.startX, y: rowVar.startY, dir: 'EAST', visible: true };
        return st;
      };

      const refRun = runHeadless(cmp5a.referenceSolution!, beatSimulationEnvironment, makeRowState());
      expect(refRun.finalState.leds[rowVar.startY - 1]).toEqual([...rowVar.expectedRowColors]);
      expect(refRun.finalState.edgeBonk).toBe(false);
      expect(refRun.finalState.cursor.x).toBe(8);

      const starterRun = runHeadless(
        cmp5a.starterWorkspace!,
        beatSimulationEnvironment,
        makeRowState()
      );
      expect(starterRun.finalState.leds[rowVar.startY - 1]).not.toEqual([
        ...rowVar.expectedRowColors,
      ]);

      const naiveRun = runHeadless(naive1DXParity, beatSimulationEnvironment, makeRowState());
      const matchesRow =
        JSON.stringify(naiveRun.finalState.leds[rowVar.startY - 1]) ===
        JSON.stringify(rowVar.expectedRowColors);
      if (matchesRow) naivePassCount++;
    }

    // Passes odd rows (1, 5) only, failing even rows (2, 6)!
    expect(naivePassCount).toBe(2);
  });

  it('verifies Switchyard explanations, puzzles, capstones, and Balance-Scale Mastery (cmp.0, cmp.1, cmp.1a, cmp.3 Beat 1, cmp.4, cmp.9, cmp.A, cmp.M2)', () => {
    // Explanation tabs (cmp.0 Tab 1 & 2, cmp.3 Tab 1)
    for (const tab of getActivity('cmp.0').demoTabs!) {
      const res = runHeadless(
        tab.workspace,
        phase3SwitchyardTestEnv,
        createSwitchyardHarnessState(tab.switchyard!)
      );
      expect(res.evalStatus, `cmp.0 ${tab.id} failed`).toBe('SUCCESS');
    }

    const cmp3Tab1 = getActivity('cmp.3').demoTabs![0];
    expect(
      runHeadless(
        cmp3Tab1.workspace,
        phase3SwitchyardTestEnv,
        createSwitchyardHarnessState(cmp3Tab1.switchyard!)
      ).evalStatus
    ).toBe('SUCCESS');

    // Validated Switchyard activities: 4 variants each, reference passes all, starter fails, scaffold fast-path passes
    for (const id of ['cmp.1', 'cmp.1a', 'cmp.4', 'cmp.9', 'cmp.A', 'cmp.M2']) {
      const act = getActivity(id);
      expect(act.switchyardVariants).toHaveLength(4);

      const scafCheck = checkScaffoldWorkspace(act);
      expect(scafCheck.passed, `${id} scaffold check failed: ${scafCheck.reason}`).toBe(true);

      for (const variant of act.switchyardVariants!) {
        const refRes = runHeadless(
          act.referenceSolution!,
          phase3SwitchyardTestEnv,
          createSwitchyardHarnessState(variant)
        );
        expect(refRes.evalStatus, `${id} reference failed on ${variant.label}`).toBe('SUCCESS');
      }

      const starterFailsAtLeastOne = act.switchyardVariants!.some(
        (variant) =>
          runHeadless(
            act.starterWorkspace!,
            phase3SwitchyardTestEnv,
            createSwitchyardHarnessState(variant)
          ).evalStatus !== 'SUCCESS'
      );
      expect(starterFailsAtLeastOne, `${id} starter unexpectedly passed all variants`).toBe(true);
    }

    // cmp.M2 anti-% 2 proof: alternating intact crates by c % 2 leaves 6, 8, 10, and 14 kg imbalances!
    const cmpM2 = getActivity('cmp.M2');
    const naiveModuloBalance: WorkspaceState = {
      MAIN: [
        { id: 'mb_1', type: 'VAR_ASSIGN', params: { a: 'c', b: 0 } },
        { id: 'mb_2', type: 'WHILE', params: { condition: { kind: 'sensor', sensor: 'hasNextItem' } } },
        { id: 'mb_3', type: 'IF', params: { condition: { kind: 'sensor', sensor: 'itemDamaged' } } },
        { id: 'mb_4', type: 'SCRAP_ITEM' },
        { id: 'mb_5', type: 'ELSE' },
        { id: 'mb_6', type: 'VAR_OP', params: { a: 'c', b: 'c', op: '+', c: 1 } },
        { id: 'mb_7', type: 'VAR_OP', params: { a: 'r', b: 'c', op: '%', c: 2 } },
        {
          id: 'mb_8',
          type: 'IF',
          params: { condition: { kind: 'cmp', op: '==', left: 'r', right: 1 } },
        },
        { id: 'mb_9', type: 'SWITCH_LEFT' },
        { id: 'mb_10', type: 'ELSE' },
        { id: 'mb_11', type: 'SWITCH_RIGHT' },
        { id: 'mb_12', type: 'END_IF' },
        { id: 'mb_13', type: 'SEND_NEXT' },
        { id: 'mb_14', type: 'END_IF' },
        { id: 'mb_15', type: 'END_WHILE' },
      ],
      F1: [],
      F2: [],
      F3: [],
    };

    const expectedImbalances = [6, 8, 10, 14];
    cmpM2.switchyardVariants!.forEach((variant, idx) => {
      expect(variant.mode).toBe('balance_scale');
      expect(variant.balanceTolerance).toBe(0);
      const res = runHeadless(
        naiveModuloBalance,
        phase3SwitchyardTestEnv,
        createSwitchyardHarnessState(variant)
      );
      expect(res.evalStatus).not.toBe('SUCCESS');
      const sumA = res.finalState.docks[0].items.reduce((s, it) => s + it.weight, 0);
      const sumB = res.finalState.docks[1].items.reduce((s, it) => s + it.weight, 0);
      expect(Math.abs(sumA - sumB)).toBe(expectedImbalances[idx]);
    });
  });

  it('verifies Toy-Block Depot stack-peek explanations, puzzles, and short-circuit empty-stack guards (cmp.6, cmp.7, cmp.8)', () => {
    const cmp6 = getActivity('cmp.6');
    for (const tab of cmp6.demoTabs!) {
      expect(tab.depot?.enforceHanoiRule).toBe(false);
      expect(tab.depot?.requireEmptyStacks).toBe(false);
      const res = runHeadless(
        tab.workspace,
        phase3DepotTestEnv,
        createDepotHarnessState(tab.depot!)
      );
      expect(res.evalStatus, `cmp.6 ${tab.id} failed`).toBe('SUCCESS');
    }

    // Unguarded `$topValue[STACK_2]` on empty Stack 2 without `stationEmpty[STACK_2] OR ...` triggers TYPE_ERROR
    const unguardedEmptyPeek: WorkspaceState = {
      MAIN: [
        { id: 'up_1', type: 'DEPOT_MOVE_TO', params: { station: 'INPUT' } },
        { id: 'up_2', type: 'DEPOT_GRAB' },
        {
          id: 'up_3',
          type: 'IF',
          params: {
            condition: { kind: 'cmp', op: '>', left: '$heldValue', right: '$topValue[STACK_2]' },
          },
        },
        { id: 'up_4', type: 'DEPOT_SEND_OUT' },
        { id: 'up_5', type: 'END_IF' },
      ],
      F1: [],
      F2: [],
      F3: [],
    };
    const emptyPeekRes = runHeadless(
      unguardedEmptyPeek,
      phase3DepotTestEnv,
      createDepotHarnessState(cmp6.demoTabs![1].depot!)
    );
    expect(emptyPeekRes.runtimeStatus).toBe('TYPE_ERROR');

    // cmp.7 & cmp.8: 4 variants each, Toy-Block flags false, scaffold aligns & completes to SUCCESS, reference passes all, starter fails
    for (const id of ['cmp.7', 'cmp.8']) {
      const act = getActivity(id);
      expect(act.depotVariants).toHaveLength(4);

      const scafWs = act.partialHelp?.scaffoldWorkspace;
      expect(scafWs).toBeDefined();
      const completedFromScaf: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };
      let replacedCount = 0;
      for (const sc of SCOPES) {
        const scafBlocks = scafWs![sc] ?? [];
        const refBlocks = act.referenceSolution![sc] ?? [];
        expect(scafBlocks).toHaveLength(refBlocks.length);
        completedFromScaf[sc] = scafBlocks.map((b, idx) => {
          if (b.type === 'PLACEHOLDER') {
            expect(getPlaceholderHintCategory(b)).toBe('any');
            replacedCount++;
            return refBlocks[idx];
          }
          expect(b.type).toBe(refBlocks[idx].type);
          return b;
        });
      }
      expect(replacedCount).toBeGreaterThan(0);

      for (const variant of act.depotVariants!) {
        expect(variant.enforceHanoiRule).toBe(false);
        expect(variant.requireEmptyStacks).toBe(false);

        const scafCompletedRes = runHeadless(
          completedFromScaf,
          phase3DepotTestEnv,
          createDepotHarnessState(variant)
        );
        expect(scafCompletedRes.evalStatus, `${id} completed scaffold failed`).toBe('SUCCESS');

        const refRes = runHeadless(
          act.referenceSolution!,
          phase3DepotTestEnv,
          createDepotHarnessState(variant)
        );
        expect(refRes.evalStatus, `${id} reference failed`).toBe('SUCCESS');

        const starterRes = runHeadless(
          act.starterWorkspace!,
          phase3DepotTestEnv,
          createDepotHarnessState(variant)
        );
        expect(starterRes.evalStatus).not.toBe('SUCCESS');
      }
    }
  });
});
