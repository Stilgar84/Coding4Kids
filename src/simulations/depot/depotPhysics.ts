import { SimulationStatus } from '../../types';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_DEFAULT_STACK_MASK,
  DEPOT_MAX_QUEUE_LENGTH,
  DEPOT_MAX_STACK_HEIGHT,
  DEPOT_STATION_BITS,
  DepotFailureReason,
  DepotQueueItem,
  DepotSendGate,
  DepotStacks,
  DepotState,
  DepotStationId,
} from './types';

export function normalizeCrateColor(raw: unknown): CrateColor {
  if (raw === 'RED' || raw === 'BLUE' || raw === 'GREEN' || raw === 'AMBER') {
    return raw;
  }
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'BLUE') return 'BLUE';
  if (s === 'GREEN') return 'GREEN';
  if (s === 'AMBER' || s === 'YELLOW') return 'AMBER';
  return 'RED';
}

function cloneColorList(list?: readonly CrateColor[]): CrateColor[] {
  return (list ?? []).map((c) => normalizeCrateColor(c));
}

export function cloneStacks(stacks?: DepotStacks): DepotStacks {
  return [
    cloneColorList(stacks?.[0]),
    cloneColorList(stacks?.[1]),
    cloneColorList(stacks?.[2]),
  ];
}

export function cloneQueue(q?: DepotQueueItem[]): DepotQueueItem[] {
  return (q ?? []).map((item) => ({
    ...item,
    color: normalizeCrateColor(item.color),
  }));
}

export function normalizeDepotStation(raw: unknown): DepotStationId {
  if (typeof raw === 'string') {
    const up = raw.trim().toUpperCase();
    if (up === 'STACK_2' || up === '2') return 'STACK_2';
    if (up === 'STACK_3' || up === '3') return 'STACK_3';
    if (up === 'QUEUE' || up === 'Q') return 'QUEUE';
    return 'STACK_1';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n === 2) return 'STACK_2';
    if (n === 3) return 'STACK_3';
    if (n === 4) return 'QUEUE';
    return 'STACK_1';
  }
  return 'STACK_1';
}

export function stationToIndex(station: DepotStationId | unknown): 0 | 1 | 2 {
  const norm = normalizeDepotStation(station);
  if (norm === 'STACK_2') return 1;
  if (norm === 'STACK_3') return 2;
  return 0;
}

export function indexToStation(idx: number): DepotStationId {
  if (idx === 1) return 'STACK_2';
  if (idx === 2) return 'STACK_3';
  if (idx === 3) return 'QUEUE';
  return 'STACK_1';
}

export function stationToCode(station: DepotStationId): number {
  switch (station) {
    case 'STACK_1': return 0;
    case 'STACK_2': return 1;
    case 'STACK_3': return 2;
    case 'QUEUE':   return 3;
  }
}

export function codeToStation(code: number): DepotStationId {
  switch (code) {
    case 1: return 'STACK_2';
    case 2: return 'STACK_3';
    case 3: return 'QUEUE';
    default: return 'STACK_1';
  }
}

/** Returns true when any of the M5 QUEUE fields are non-trivial. */
export function depotStateNeedsQueueVersion(state: DepotState): boolean {
  return (
    state.queue.length > 0 ||
    state.initialQueue.length > 0 ||
    state.scrapCount > 0 ||
    state.heldDamaged
  );
}

export const DEFAULT_SANDBOX_DEPOT_STACKS: DepotStacks = [
  ['RED', 'BLUE'],
  ['GREEN'],
  [],
];

export const DEPOT_SANDBOX_DEFAULT_MASK =
  DEPOT_DEFAULT_STACK_MASK | DEPOT_STATION_BITS.QUEUE | DEPOT_STATION_BITS.OUT;

type DepotMaskInferenceInput = Partial<
  Pick<
    DepotState,
    | 'targetOutput'
    | 'output'
    | 'queue'
    | 'initialQueue'
    | 'workerStation'
    | 'initialWorkerStation'
    | 'scrapCount'
  >
>;

/** Infers active station visibility bits from state payloads when activeStationsMask is omitted. */
export function inferActiveStationsMask(state?: DepotMaskInferenceInput): number {
  let mask = DEPOT_DEFAULT_STACK_MASK;
  if (!state) return DEPOT_SANDBOX_DEFAULT_MASK;

  const hasQueue =
    (state.queue?.length ?? 0) > 0 ||
    (state.initialQueue?.length ?? 0) > 0 ||
    state.workerStation === 'QUEUE' ||
    state.initialWorkerStation === 'QUEUE' ||
    (state.scrapCount ?? 0) > 0;
  if (hasQueue) mask |= DEPOT_STATION_BITS.QUEUE;

  const hasOut = (state.targetOutput?.length ?? 0) > 0 || (state.output?.length ?? 0) > 0;
  if (hasOut) mask |= DEPOT_STATION_BITS.OUT;

  return mask;
}

/** Normalizes either a numeric bitmask or a station name list (e.g. ["STACK_1", "OUT"]) into DEPOT_STATION_BITS. */
export function normalizeActiveStationsMask(
  raw: unknown,
  fallbackState?: DepotMaskInferenceInput
): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const clean = Math.trunc(raw) & 0x7f;
    return clean > 0 ? clean : DEPOT_DEFAULT_STACK_MASK;
  }
  if (Array.isArray(raw)) {
    let mask = 0;
    for (const entry of raw) {
      const s = String(entry ?? '').trim().toUpperCase();
      if (s === 'STACK_1' || s === 'S1' || s === '1') mask |= DEPOT_STATION_BITS.STACK_1;
      else if (s === 'STACK_2' || s === 'S2' || s === '2') mask |= DEPOT_STATION_BITS.STACK_2;
      else if (s === 'STACK_3' || s === 'S3' || s === '3') mask |= DEPOT_STATION_BITS.STACK_3;
      else if (s === 'QUEUE' || s === 'Q') mask |= DEPOT_STATION_BITS.QUEUE;
      else if (s === 'INPUT' || s === 'IN') mask |= DEPOT_STATION_BITS.INPUT;
      else if (s === 'TAPE' || s === 'PHYSICAL_TAPE') mask |= DEPOT_STATION_BITS.PHYSICAL_TAPE;
      else if (s === 'OUT' || s === 'OUTPUT') mask |= DEPOT_STATION_BITS.OUT;
    }
    if (mask > 0) return mask;
  }
  return inferActiveStationsMask(fallbackState);
}

/** Returns runtime active station bits, automatically keeping QUEUE/OUT visible if items arrive there. */
export function getEffectiveActiveStationsMask(state: DepotState): number {
  let mask =
    state.activeStationsMask !== undefined
      ? normalizeActiveStationsMask(state.activeStationsMask, state)
      : inferActiveStationsMask(state);

  if (state.output.length > 0 || (state.targetOutput?.length ?? 0) > 0) {
    mask |= DEPOT_STATION_BITS.OUT;
  }
  if (
    state.queue.length > 0 ||
    state.initialQueue.length > 0 ||
    state.workerStation === 'QUEUE' ||
    state.scrapCount > 0
  ) {
    mask |= DEPOT_STATION_BITS.QUEUE;
  }
  return mask;
}

/** Returns ordered DepotStationId values permitted by an active-stations mask or state. */
export function getActiveDepotStations(maskOrState?: number | DepotState): DepotStationId[] {
  const mask =
    typeof maskOrState === 'number'
      ? normalizeActiveStationsMask(maskOrState)
      : maskOrState
        ? getEffectiveActiveStationsMask(maskOrState)
        : DEPOT_SANDBOX_DEFAULT_MASK;

  const out: DepotStationId[] = [];
  if ((mask & DEPOT_STATION_BITS.STACK_1) !== 0) out.push('STACK_1');
  if ((mask & DEPOT_STATION_BITS.STACK_2) !== 0) out.push('STACK_2');
  if ((mask & DEPOT_STATION_BITS.STACK_3) !== 0) out.push('STACK_3');
  if ((mask & DEPOT_STATION_BITS.QUEUE) !== 0) out.push('QUEUE');
  return out.length > 0 ? out : ['STACK_1', 'STACK_2', 'STACK_3'];
}

export function createInitialDepotState(
  overrides?: Omit<
    Partial<
      Pick<
        DepotState,
        | 'stacks'
        | 'initialStacks'
        | 'targetStacks'
        | 'targetOutput'
        | 'workerStation'
        | 'initialWorkerStation'
        | 'queue'
        | 'initialQueue'
        | 'scrapCount'
      >
    >,
    never
  > & { activeStationsMask?: number | readonly string[] }
): DepotState {
  const startStacks = cloneStacks(
    overrides?.initialStacks ?? overrides?.stacks ?? DEFAULT_SANDBOX_DEPOT_STACKS
  );
  const startStation = normalizeDepotStation(
    overrides?.initialWorkerStation ?? overrides?.workerStation ?? 'STACK_1'
  );
  const startQueue = cloneQueue(overrides?.initialQueue ?? overrides?.queue ?? []);
  const stacks = cloneStacks(overrides?.stacks ?? startStacks);
  const targetStacks = overrides?.targetStacks ? cloneStacks(overrides.targetStacks) : undefined;
  const targetOutput = overrides?.targetOutput ? cloneColorList(overrides.targetOutput) : undefined;
  const queue = cloneQueue(overrides?.queue ?? startQueue);
  const scrapCount = overrides?.scrapCount ?? 0;

  const activeStationsMask =
    overrides === undefined
      ? DEPOT_SANDBOX_DEFAULT_MASK
      : normalizeActiveStationsMask(overrides.activeStationsMask, {
          targetOutput,
          queue,
          initialQueue: startQueue,
          workerStation: startStation,
          initialWorkerStation: startStation,
          scrapCount,
        });

  return {
    stacks,
    initialStacks: startStacks,
    output: [],
    targetStacks,
    targetOutput,
    workerStation: startStation,
    initialWorkerStation: startStation,
    heldCrate: null,
    heldDamaged: false,
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
    queue,
    initialQueue: startQueue,
    scrapCount,
    activeStationsMask,
  };
}

export function resetDepotState(state?: DepotState): DepotState {
  if (!state) return createInitialDepotState();
  const baseStacks = cloneStacks(state.initialStacks ?? DEFAULT_SANDBOX_DEPOT_STACKS);
  const baseStation = normalizeDepotStation(state.initialWorkerStation ?? 'STACK_1');
  const baseQueue = cloneQueue(state.initialQueue ?? []);
  return {
    stacks: cloneStacks(baseStacks),
    initialStacks: baseStacks,
    output: [],
    targetStacks: state.targetStacks ? cloneStacks(state.targetStacks) : undefined,
    targetOutput: state.targetOutput ? cloneColorList(state.targetOutput) : undefined,
    workerStation: baseStation,
    initialWorkerStation: baseStation,
    heldCrate: null,
    heldDamaged: false,
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
    queue: cloneQueue(baseQueue),
    initialQueue: baseQueue,
    scrapCount: 0,
    activeStationsMask: state.activeStationsMask,
  };
}

function stacksEqual(a: DepotStacks, b: DepotStacks): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i].length !== b[i].length) return false;
    for (let j = 0; j < a[i].length; j++) {
      if (a[i][j] !== b[i][j]) return false;
    }
  }
  return true;
}

function arraysEqual(a: readonly CrateColor[], b: readonly CrateColor[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function evaluateDepotCompletion(state: DepotState): SimulationStatus {
  if (state.status === 'COLLISION') return 'COLLISION';

  const hasStackGoal = state.targetStacks !== undefined;
  const hasOutputGoal = state.targetOutput !== undefined && state.targetOutput.length > 0;
  if (!hasStackGoal && !hasOutputGoal) {
    return 'IDLE';
  }

  const stacksOk = !hasStackGoal || stacksEqual(state.stacks, state.targetStacks!);
  const outputOk = !hasOutputGoal || arraysEqual(state.output, state.targetOutput!);
  // Must also not still be holding an unplaced required crate if goal matches
  return stacksOk && outputOk && state.heldCrate === null ? 'SUCCESS' : 'IDLE';
}

export interface DepotStepOutcome {
  nextState: DepotState;
  isCollision: boolean;
  isSuccess: boolean;
}

function failStep(
  state: DepotState,
  reason: DepotFailureReason
): DepotStepOutcome {
  return {
    nextState: {
      ...state,
      lastFailureReason: reason,
      status: 'COLLISION',
      stepCount: (state.stepCount || 0) + 1,
    },
    isCollision: true,
    isSuccess: false,
  };
}

function normalizeGate(raw: unknown): DepotSendGate {
  if (typeof raw === 'string') {
    const up = raw.trim().toUpperCase();
    if (up === 'SCRAP') return 'SCRAP';
    if (up === 'ACCEPT') return 'ACCEPT';
    if (up === 'REJECT') return 'REJECT';
  }
  return 'OUT';
}

/**
 * Evaluate a Depot boolean sensor for use in IF/WHILE conditions (M5).
 * Returns `true` / `false`. Unknown sensors return `false`.
 *
 * sensorCode mapping (ConditionExpr §3.1 Depot boolean sensors 0x18..0x1C):
 *   0x18 = stationEmpty  (stationParam: 0=CURRENT, 1=STACK_1, 2=STACK_2, 3=STACK_3, 4=QUEUE, 5=INPUT)
 *   0x19 = hasItem
 *   0x1A = itemDamaged
 *   0x1B = heldColor     (colorIdx param)
 *   0x1C = topColor      (colorIdx param)
 */
export function evaluateDepotSensor(
  sensorCode: number,
  state: DepotState,
  params?: { stationParam?: number; colorIdx?: number }
): boolean {
  switch (sensorCode) {
    case 0x18: { // stationEmpty(stationParam)
      const sp = params?.stationParam ?? 0; // 0=CURRENT
      let station: DepotStationId;
      if (sp === 0) {
        station = state.workerStation;
      } else {
        station = codeToStation(sp - 1);
      }
      return depotStationIsEmpty(state, station);
    }
    case 0x19: // hasItem
      return state.heldCrate !== null;
    case 0x1a: // itemDamaged
      return state.heldCrate !== null && state.heldDamaged;
    case 0x1b: { // heldColor == colorIdx
      if (state.heldCrate === null) return false;
      const meta = DEPOT_CRATE_COLORS[state.heldCrate];
      return meta.code === (params?.colorIdx ?? 0);
    }
    case 0x1c: { // topColor == colorIdx (non-destructive peek at worker's station)
      const topColor = getTopColorAtStation(state, state.workerStation);
      if (topColor === null) return false;
      const meta = DEPOT_CRATE_COLORS[topColor];
      return meta.code === (params?.colorIdx ?? 0);
    }
    default:
      return false;
  }
}

/** Returns true when the given station has no items. */
function depotStationIsEmpty(state: DepotState, station: DepotStationId): boolean {
  if (station === 'QUEUE') return state.queue.length === 0;
  const idx = stationToIndex(station);
  return state.stacks[idx].length === 0;
}

/** Non-destructive peek: returns top/front color at station, or null if empty. */
function getTopColorAtStation(state: DepotState, station: DepotStationId): CrateColor | null {
  if (station === 'QUEUE') {
    return state.queue.length > 0 ? state.queue[0].color : null;
  }
  const idx = stationToIndex(station);
  const stack = state.stacks[idx];
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

export function applyDepotAction(
  actionType: string,
  state: DepotState,
  params?: Record<string, any>
): DepotStepOutcome {
  if (state.status === 'COLLISION') {
    return {
      nextState: state,
      isCollision: true,
      isSuccess: false,
    };
  }

  const nextStepCount = (state.stepCount || 0) + 1;

  switch (actionType) {
    case 'DEPOT_MOVE_TO': {
      const targetStation = normalizeDepotStation(
        params?.station ?? 'STACK_1'
      );
      const candidate: DepotState = {
        ...state,
        workerStation: targetStation,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      const evalStatus = evaluateDepotCompletion(candidate);
      const isSuccess = evalStatus === 'SUCCESS';
      return {
        nextState: {
          ...candidate,
          status: isSuccess ? 'SUCCESS' : 'RUNNING',
        },
        isCollision: false,
        isSuccess,
      };
    }

    case 'DEPOT_GRAB': {
      if (state.heldCrate !== null) {
        return failStep(state, 'CLAW_FULL');
      }

      if (state.workerStation === 'QUEUE') {
        // FIFO: dequeue from front
        if (state.queue.length === 0) {
          return failStep(state, 'EMPTY_STACK');
        }
        const newQueue = [...state.queue];
        const front = newQueue.shift()!;
        const candidate: DepotState = {
          ...state,
          queue: newQueue,
          heldCrate: front.color,
          heldDamaged: front.damaged ?? false,
          lastFailureReason: null,
          stepCount: nextStepCount,
          status: 'RUNNING',
        };
        return {
          nextState: candidate,
          isCollision: false,
          isSuccess: false,
        };
      }

      // LIFO stack
      const stackIdx = stationToIndex(state.workerStation);
      const stack = state.stacks[stackIdx];
      if (stack.length === 0) {
        return failStep(state, 'EMPTY_STACK');
      }
      const nextStacks = cloneStacks(state.stacks);
      const grabbed = nextStacks[stackIdx].pop()!;
      const candidate: DepotState = {
        ...state,
        stacks: nextStacks,
        heldCrate: grabbed,
        heldDamaged: false,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      return {
        nextState: candidate,
        isCollision: false,
        isSuccess: false,
      };
    }

    case 'DEPOT_PLACE': {
      if (state.heldCrate === null) {
        return failStep(state, 'CLAW_EMPTY');
      }

      if (state.workerStation === 'QUEUE') {
        // Enqueue at back
        if (state.queue.length >= DEPOT_MAX_QUEUE_LENGTH) {
          return failStep(state, 'STACK_FULL');
        }
        const newQueue: DepotQueueItem[] = [
          ...state.queue,
          { color: state.heldCrate, damaged: state.heldDamaged || undefined },
        ];
        const candidate: DepotState = {
          ...state,
          queue: newQueue,
          heldCrate: null,
          heldDamaged: false,
          lastFailureReason: null,
          stepCount: nextStepCount,
          status: 'RUNNING',
        };
        const evalStatus = evaluateDepotCompletion(candidate);
        const isSuccess = evalStatus === 'SUCCESS';
        return {
          nextState: { ...candidate, status: isSuccess ? 'SUCCESS' : 'RUNNING' },
          isCollision: false,
          isSuccess,
        };
      }

      // LIFO stack: damaged crate → COLLISION
      if (state.heldDamaged) {
        return failStep(state, 'DAMAGED_TO_STACK');
      }

      const stackIdx = stationToIndex(state.workerStation);
      if (state.stacks[stackIdx].length >= DEPOT_MAX_STACK_HEIGHT) {
        return failStep(state, 'STACK_FULL');
      }
      const nextStacks = cloneStacks(state.stacks);
      nextStacks[stackIdx].push(state.heldCrate);
      const candidate: DepotState = {
        ...state,
        stacks: nextStacks,
        heldCrate: null,
        heldDamaged: false,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
      };
      const evalStatus = evaluateDepotCompletion(candidate);
      const isSuccess = evalStatus === 'SUCCESS';
      return {
        nextState: {
          ...candidate,
          status: isSuccess ? 'SUCCESS' : 'RUNNING',
        },
        isCollision: false,
        isSuccess,
      };
    }

    case 'DEPOT_SEND_OUT': {
      // Default [OUT] gate — same as before
      return applyDepotSendGate(state, 'OUT', nextStepCount);
    }

    case 'DEPOT_SEND_GATE': {
      // M5 explicit gate: OUT / SCRAP / ACCEPT / REJECT
      const gate = normalizeGate(params?.gate);
      return applyDepotSendGate(state, gate, nextStepCount);
    }

    default: {
      return {
        nextState: {
          ...state,
          stepCount: nextStepCount,
          status: 'RUNNING',
        },
        isCollision: false,
        isSuccess: false,
      };
    }
  }
}

function applyDepotSendGate(
  state: DepotState,
  gate: DepotSendGate,
  nextStepCount: number
): DepotStepOutcome {
  if (state.heldCrate === null) {
    return {
      nextState: {
        ...state,
        lastFailureReason: 'CLAW_EMPTY',
        status: 'COLLISION',
        stepCount: nextStepCount,
      },
      isCollision: true,
      isSuccess: false,
    };
  }

  if (gate === 'SCRAP') {
    // Sending intact crate to SCRAP → COLLISION
    if (!state.heldDamaged) {
      return {
        nextState: {
          ...state,
          lastFailureReason: 'INTACT_TO_SCRAP',
          status: 'COLLISION',
          stepCount: nextStepCount,
        },
        isCollision: true,
        isSuccess: false,
      };
    }
    // Send damaged crate to scrap
    const candidate: DepotState = {
      ...state,
      scrapCount: state.scrapCount + 1,
      heldCrate: null,
      heldDamaged: false,
      lastFailureReason: null,
      stepCount: nextStepCount,
      status: 'RUNNING',
    };
    const evalStatus = evaluateDepotCompletion(candidate);
    const isSuccess = evalStatus === 'SUCCESS';
    return {
      nextState: { ...candidate, status: isSuccess ? 'SUCCESS' : 'RUNNING' },
      isCollision: false,
      isSuccess,
    };
  }

  // OUT, ACCEPT, REJECT — send to output bay
  const nextOutput = [...state.output, state.heldCrate];
  if (state.targetOutput && state.targetOutput.length > 0) {
    const idx = nextOutput.length - 1;
    if (idx >= state.targetOutput.length || nextOutput[idx] !== state.targetOutput[idx]) {
      return {
        nextState: {
          ...state,
          output: nextOutput,
          heldCrate: null,
          heldDamaged: false,
          lastFailureReason: 'WRONG_OUTPUT_ORDER',
          status: 'COLLISION',
          stepCount: nextStepCount,
        },
        isCollision: true,
        isSuccess: false,
      };
    }
  }
  const candidate: DepotState = {
    ...state,
    output: nextOutput,
    heldCrate: null,
    heldDamaged: false,
    lastFailureReason: null,
    stepCount: nextStepCount,
    status: 'RUNNING',
  };
  const evalStatus = evaluateDepotCompletion(candidate);
  const isSuccess = evalStatus === 'SUCCESS';
  return {
    nextState: {
      ...candidate,
      status: isSuccess ? 'SUCCESS' : 'RUNNING',
    },
    isCollision: false,
    isSuccess,
  };
}
