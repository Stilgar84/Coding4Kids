import { PaletteColor, SimulationStatus, TypedValue } from '../../types';
import {
  CrateColor,
  DEPOT_CRATE_COLORS,
  DEPOT_DEFAULT_STACK_MASK,
  DEPOT_MAX_QUEUE_LENGTH,
  DEPOT_MAX_STACK_HEIGHT,
  DEPOT_RING_PALETTE,
  DEPOT_STATION_BITS,
  DepotActionTransition,
  DepotFailureReason,
  DepotQueueItem,
  DepotSendGate,
  DepotStacks,
  DepotStackValues,
  DepotState,
  DepotStationId,
} from './types';

const EXTENDED_COLOR_SET = new Set<CrateColor>([
  'BLACK',
  'PURPLE',
  'PINK',
  'CYAN',
  'ORANGE',
  'WHITE',
]);

/** Attempts to parse a Workshop color token (handles all 10 PALETTE_COLORS, 'color:*' literals, and 'YELLOW' <-> 'AMBER'). */
export function tryNormalizeCrateColor(raw: unknown): CrateColor | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const idx = Math.trunc(raw);
    return DEPOT_RING_PALETTE[idx]?.id ?? null;
  }
  const s = String(raw ?? '')
    .replace(/^color:/i, '')
    .trim()
    .toUpperCase();
  if (!s) return null;
  if (s === 'YELLOW' || s === 'AMBER') return 'AMBER';
  if (
    s === 'BLACK' ||
    s === 'RED' ||
    s === 'BLUE' ||
    s === 'GREEN' ||
    s === 'PURPLE' ||
    s === 'PINK' ||
    s === 'CYAN' ||
    s === 'ORANGE' ||
    s === 'WHITE'
  ) {
    return s;
  }
  return null;
}

export function normalizeCrateColor(raw: unknown): CrateColor {
  return tryNormalizeCrateColor(raw) ?? 'RED';
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

export function cloneQueue(q?: readonly DepotQueueItem[]): DepotQueueItem[] {
  return (q ?? []).map((item) => ({
    ...item,
    color: normalizeCrateColor(item.color),
    ...(item.value !== undefined ? { value: item.value } : {}),
    ...(item.colorless ? { colorless: true } : {}),
  }));
}

function cloneValueList(list?: ReadonlyArray<number | undefined>): Array<number | undefined> {
  return (list ?? []).map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined));
}

export function cloneStackValues(sv?: DepotStackValues): DepotStackValues {
  return [cloneValueList(sv?.[0]), cloneValueList(sv?.[1]), cloneValueList(sv?.[2])];
}

function hasAnyDefinedValue(list?: ReadonlyArray<number | undefined>): boolean {
  return Boolean(list && list.some((v) => typeof v === 'number' && Number.isFinite(v)));
}

function padStackValues(sv: DepotStackValues | undefined, stacks: DepotStacks): DepotStackValues {
  return [0, 1, 2].map((i) => {
    const len = stacks[i]?.length ?? 0;
    const src = sv?.[i] ?? [];
    const out: Array<number | undefined> = [];
    for (let j = 0; j < len; j++) {
      const v = src[j];
      out.push(typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    }
    return out;
  }) as DepotStackValues;
}

/**
 * Resolves a DEPOT_MOVE_TO station target.
 * Literal station tokens ('STACK_1'..'STACK_3', 'QUEUE', 'INPUT', 'TAPE') always resolve cleanly.
 * Variable/numeric targets follow strict 1-based `1..3` bounds; `< 1` or `> 3` or unknown tokens trigger COLLISION.
 */
export function resolveDepotMoveTarget(raw: unknown): {
  station: DepotStationId;
  isOutOfBounds: boolean;
  attemptedIndex?: number;
} {
  if (raw === undefined || raw === null || raw === '') {
    return { station: 'STACK_1', isOutOfBounds: false };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 1 || raw > 3) {
      return { station: 'STACK_1', isOutOfBounds: true, attemptedIndex: raw };
    }
    return { station: indexToStation(raw - 1), isOutOfBounds: false };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const up = trimmed.toUpperCase();
    if (up === 'STACK_1' || up === 'S1' || up === '1') {
      return { station: 'STACK_1', isOutOfBounds: false };
    }
    if (up === 'STACK_2' || up === 'S2' || up === '2') {
      return { station: 'STACK_2', isOutOfBounds: false };
    }
    if (up === 'STACK_3' || up === 'S3' || up === '3') {
      return { station: 'STACK_3', isOutOfBounds: false };
    }
    if (up === 'QUEUE' || up === 'Q') {
      return { station: 'QUEUE', isOutOfBounds: false };
    }
    if (up === 'INPUT' || up === 'IN') {
      return { station: 'INPUT', isOutOfBounds: false };
    }
    if (up === 'TAPE' || up === 'PHYSICAL_TAPE') {
      return { station: 'TAPE', isOutOfBounds: false };
    }
    const parsedNum = Number(trimmed);
    if (trimmed.length > 0 && Number.isFinite(parsedNum)) {
      return { station: 'STACK_1', isOutOfBounds: true, attemptedIndex: parsedNum };
    }
    return { station: 'STACK_1', isOutOfBounds: true };
  }
  return { station: 'STACK_1', isOutOfBounds: true };
}

export function normalizeDepotStation(raw: unknown): DepotStationId {
  if (typeof raw === 'string') {
    const up = raw.trim().toUpperCase();
    if (up === 'STACK_2' || up === 'S2' || up === '2') return 'STACK_2';
    if (up === 'STACK_3' || up === 'S3' || up === '3') return 'STACK_3';
    if (up === 'QUEUE' || up === 'Q' || up === '4') return 'QUEUE';
    if (up === 'INPUT' || up === 'IN' || up === '5') return 'INPUT';
    if (up === 'TAPE' || up === 'PHYSICAL_TAPE' || up === '6') return 'TAPE';
    return 'STACK_1';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    if (n === 2) return 'STACK_2';
    if (n === 3) return 'STACK_3';
    if (n === 4) return 'QUEUE';
    if (n === 5) return 'INPUT';
    if (n === 6) return 'TAPE';
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
  if (idx === 4) return 'INPUT';
  if (idx === 5) return 'TAPE';
  return 'STACK_1';
}

/**
 * Station opcode byte encoding for DEPOT_MOVE_TO (0x10) per docs/binary_format.md §7.6:
 * 0=STACK_1, 1=STACK_2, 2=STACK_3, 3=QUEUE, 4=PHYSICAL_TAPE, 5=INPUT.
 */
export function stationToCode(station: DepotStationId): number {
  switch (station) {
    case 'STACK_1': return 0;
    case 'STACK_2': return 1;
    case 'STACK_3': return 2;
    case 'QUEUE':   return 3;
    case 'TAPE':    return 4;
    case 'INPUT':   return 5;
  }
}

export function codeToStation(code: number): DepotStationId {
  switch (code) {
    case 1: return 'STACK_2';
    case 2: return 'STACK_3';
    case 3: return 'QUEUE';
    case 4: return 'TAPE';
    case 5: return 'INPUT';
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

function hasExtendedDepotColorsOrValues(state: DepotState): boolean {
  const lists: Array<readonly CrateColor[] | undefined> = [
    state.stacks[0],
    state.stacks[1],
    state.stacks[2],
    state.initialStacks[0],
    state.initialStacks[1],
    state.initialStacks[2],
    state.targetStacks?.[0],
    state.targetStacks?.[1],
    state.targetStacks?.[2],
    state.output,
    state.targetOutput,
  ];
  for (const list of lists) {
    if (!list) continue;
    for (const c of list) {
      if (EXTENDED_COLOR_SET.has(normalizeCrateColor(c))) return true;
    }
  }
  if (state.heldCrate && EXTENDED_COLOR_SET.has(normalizeCrateColor(state.heldCrate))) {
    return true;
  }
  for (const item of [
    ...state.queue,
    ...state.initialQueue,
    ...(state.input ?? []),
    ...(state.initialInput ?? []),
  ]) {
    if (EXTENDED_COLOR_SET.has(normalizeCrateColor(item.color)) || item.value !== undefined) {
      return true;
    }
  }
  const valueLists: Array<ReadonlyArray<number | undefined> | undefined> = [
    state.stackValues?.[0],
    state.stackValues?.[1],
    state.stackValues?.[2],
    state.initialStackValues?.[0],
    state.initialStackValues?.[1],
    state.initialStackValues?.[2],
    state.targetStackValues?.[0],
    state.targetStackValues?.[1],
    state.targetStackValues?.[2],
    state.outputValues,
    state.targetOutputValues,
  ];
  for (const list of valueLists) {
    if (hasAnyDefinedValue(list)) return true;
  }
  return false;
}

/** Returns true when state uses ENV_VERSION_DEPOT_V4 features (INPUT, 10-color rings, v4/Phase 3 rules). */
export function depotStateNeedsV4Version(state: DepotState): boolean {
  const mask = state.activeStationsMask ?? 0;
  return (
    (state.input?.length ?? 0) > 0 ||
    (state.initialInput?.length ?? 0) > 0 ||
    state.workerStation === 'INPUT' ||
    state.initialWorkerStation === 'INPUT' ||
    state.workerStation === 'TAPE' ||
    state.initialWorkerStation === 'TAPE' ||
    (mask & (DEPOT_STATION_BITS.INPUT | DEPOT_STATION_BITS.PHYSICAL_TAPE)) !== 0 ||
    state.mode !== undefined ||
    state.enforceHanoiRule !== undefined ||
    state.requireEmptyStacks !== undefined ||
    state.allowNonEmptyInput !== undefined ||
    state.exactOutputCount !== undefined ||
    state.heldValue !== undefined ||
    hasExtendedDepotColorsOrValues(state)
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
    | 'input'
    | 'initialInput'
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

  const hasInput =
    (state.input?.length ?? 0) > 0 ||
    (state.initialInput?.length ?? 0) > 0 ||
    state.workerStation === 'INPUT' ||
    state.initialWorkerStation === 'INPUT';
  if (hasInput) mask |= DEPOT_STATION_BITS.INPUT;

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

/** Returns runtime active station bits, automatically keeping QUEUE/INPUT/OUT visible if items arrive there. */
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
  if (
    (state.input?.length ?? 0) > 0 ||
    (state.initialInput?.length ?? 0) > 0 ||
    state.workerStation === 'INPUT'
  ) {
    mask |= DEPOT_STATION_BITS.INPUT;
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
  if ((mask & DEPOT_STATION_BITS.INPUT) !== 0) out.push('INPUT');
  return out.length > 0 ? out : ['STACK_1', 'STACK_2', 'STACK_3'];
}

export function createInitialDepotState(
  overrides?: Omit<
    Partial<
      Pick<
        DepotState,
        | 'stacks'
        | 'initialStacks'
        | 'stackValues'
        | 'initialStackValues'
        | 'targetStacks'
        | 'targetStackValues'
        | 'targetOutput'
        | 'targetOutputValues'
        | 'workerStation'
        | 'initialWorkerStation'
        | 'queue'
        | 'initialQueue'
        | 'input'
        | 'initialInput'
        | 'scrapCount'
        | 'mode'
        | 'enforceHanoiRule'
        | 'requireEmptyStacks'
        | 'allowNonEmptyInput'
        | 'exactOutputCount'
      >
    >,
    never
  > & { activeStationsMask?: number | readonly string[] }
): DepotState {
  const startStacks = cloneStacks(
    overrides?.initialStacks ?? overrides?.stacks ?? DEFAULT_SANDBOX_DEPOT_STACKS
  );
  const rawInitialStackValues = overrides?.initialStackValues ?? overrides?.stackValues;
  const startStackValues = rawInitialStackValues
    ? padStackValues(rawInitialStackValues, startStacks)
    : undefined;
  const startStation = normalizeDepotStation(
    overrides?.initialWorkerStation ?? overrides?.workerStation ?? 'STACK_1'
  );
  const startQueue = cloneQueue(overrides?.initialQueue ?? overrides?.queue ?? []);
  const hasExplicitInput =
    overrides?.initialInput !== undefined || overrides?.input !== undefined;
  const startInput = cloneQueue(overrides?.initialInput ?? overrides?.input ?? []);
  const stacks = cloneStacks(overrides?.stacks ?? startStacks);
  const stackValues =
    overrides?.stackValues !== undefined
      ? padStackValues(overrides.stackValues, stacks)
      : startStackValues
      ? cloneStackValues(startStackValues)
      : undefined;
  const targetStacks = overrides?.targetStacks ? cloneStacks(overrides.targetStacks) : undefined;
  const targetStackValues =
    overrides?.targetStackValues !== undefined
      ? targetStacks
        ? padStackValues(overrides.targetStackValues, targetStacks)
        : cloneStackValues(overrides.targetStackValues)
      : undefined;
  const targetOutput = overrides?.targetOutput ? cloneColorList(overrides.targetOutput) : undefined;
  const targetOutputValues =
    overrides?.targetOutputValues !== undefined
      ? cloneValueList(overrides.targetOutputValues)
      : undefined;
  const queue = cloneQueue(overrides?.queue ?? startQueue);
  const input = cloneQueue(overrides?.input ?? startInput);
  const scrapCount = overrides?.scrapCount ?? 0;

  const activeStationsMask =
    overrides === undefined
      ? DEPOT_SANDBOX_DEFAULT_MASK
      : normalizeActiveStationsMask(overrides.activeStationsMask, {
          targetOutput,
          queue,
          initialQueue: startQueue,
          input,
          initialInput: startInput,
          workerStation: startStation,
          initialWorkerStation: startStation,
          scrapCount,
        });

  const keepInputArrays =
    hasExplicitInput || (activeStationsMask & DEPOT_STATION_BITS.INPUT) !== 0;

  return {
    stacks,
    initialStacks: startStacks,
    ...(stackValues !== undefined ? { stackValues } : {}),
    ...(startStackValues !== undefined ? { initialStackValues: startStackValues } : {}),
    output: [],
    targetStacks,
    ...(targetStackValues !== undefined ? { targetStackValues } : {}),
    targetOutput,
    ...(targetOutputValues !== undefined ? { targetOutputValues } : {}),
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
    ...(keepInputArrays ? { input, initialInput: startInput } : {}),
    ...(overrides?.mode !== undefined ? { mode: overrides.mode } : {}),
    ...(overrides?.enforceHanoiRule !== undefined ? { enforceHanoiRule: overrides.enforceHanoiRule } : {}),
    ...(overrides?.requireEmptyStacks !== undefined ? { requireEmptyStacks: overrides.requireEmptyStacks } : {}),
    ...(overrides?.allowNonEmptyInput !== undefined ? { allowNonEmptyInput: overrides.allowNonEmptyInput } : {}),
    ...(overrides?.exactOutputCount !== undefined ? { exactOutputCount: overrides.exactOutputCount } : {}),
    activeStationsMask,
  };
}

export function resetDepotState(state?: DepotState): DepotState {
  if (!state) return createInitialDepotState();
  const baseStacks = cloneStacks(state.initialStacks ?? DEFAULT_SANDBOX_DEPOT_STACKS);
  const baseStackValues = state.initialStackValues
    ? padStackValues(state.initialStackValues, baseStacks)
    : undefined;
  const baseStation = normalizeDepotStation(state.initialWorkerStation ?? 'STACK_1');
  const baseQueue = cloneQueue(state.initialQueue ?? []);
  const hasInput =
    state.initialInput !== undefined ||
    state.input !== undefined ||
    ((state.activeStationsMask ?? 0) & DEPOT_STATION_BITS.INPUT) !== 0;
  const baseInput = cloneQueue(state.initialInput ?? []);
  return {
    stacks: cloneStacks(baseStacks),
    initialStacks: baseStacks,
    ...(baseStackValues !== undefined
      ? {
          stackValues: cloneStackValues(baseStackValues),
          initialStackValues: baseStackValues,
        }
      : {}),
    output: [],
    targetStacks: state.targetStacks ? cloneStacks(state.targetStacks) : undefined,
    ...(state.targetStackValues !== undefined
      ? { targetStackValues: cloneStackValues(state.targetStackValues) }
      : {}),
    targetOutput: state.targetOutput ? cloneColorList(state.targetOutput) : undefined,
    ...(state.targetOutputValues !== undefined
      ? { targetOutputValues: cloneValueList(state.targetOutputValues) }
      : {}),
    workerStation: baseStation,
    initialWorkerStation: baseStation,
    heldCrate: null,
    heldDamaged: false,
    heldValue: undefined,
    heldColorless: undefined,
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
    queue: cloneQueue(baseQueue),
    initialQueue: baseQueue,
    scrapCount: 0,
    ...(hasInput ? { input: cloneQueue(baseInput), initialInput: baseInput } : {}),
    ...(state.mode !== undefined ? { mode: state.mode } : {}),
    ...(state.enforceHanoiRule !== undefined ? { enforceHanoiRule: state.enforceHanoiRule } : {}),
    ...(state.requireEmptyStacks !== undefined ? { requireEmptyStacks: state.requireEmptyStacks } : {}),
    ...(state.allowNonEmptyInput !== undefined ? { allowNonEmptyInput: state.allowNonEmptyInput } : {}),
    ...(state.exactOutputCount !== undefined ? { exactOutputCount: state.exactOutputCount } : {}),
    activeStationsMask: state.activeStationsMask,
    lastAction: undefined,
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

function stackValuesEqual(
  actual: DepotStackValues | undefined,
  target: DepotStackValues,
  targetStacks?: DepotStacks
): boolean {
  for (let i = 0; i < 3; i++) {
    const len = targetStacks ? targetStacks[i].length : target[i].length;
    if (!targetStacks && (actual?.[i]?.length ?? 0) !== len) return false;
    for (let j = 0; j < len; j++) {
      const expected = target[i]?.[j];
      if (expected !== undefined && actual?.[i]?.[j] !== expected) {
        return false;
      }
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

function outputValuesEqual(
  actual: ReadonlyArray<number | undefined> | undefined,
  target: ReadonlyArray<number | undefined>,
  hasTargetOutputColors: boolean
): boolean {
  if (!hasTargetOutputColors && (actual?.length ?? 0) !== target.length) return false;
  if ((actual?.length ?? 0) < target.length) return false;
  for (let i = 0; i < target.length; i++) {
    if (target[i] !== undefined && actual?.[i] !== target[i]) return false;
  }
  return true;
}

export function evaluateDepotCompletion(state: DepotState): SimulationStatus {
  if (state.status === 'COLLISION') return 'COLLISION';

  const hasStackGoal = state.targetStacks !== undefined;
  const hasStackValueGoal = state.targetStackValues !== undefined;
  const hasOutputGoal = state.targetOutput !== undefined && state.targetOutput.length > 0;
  const hasOutputValueGoal =
    state.targetOutputValues !== undefined && state.targetOutputValues.length > 0;
  const hasRuleGoal = state.requireEmptyStacks === true || state.exactOutputCount !== undefined;
  if (!hasStackGoal && !hasStackValueGoal && !hasOutputGoal && !hasOutputValueGoal && !hasRuleGoal) {
    return 'IDLE';
  }

  const stacksOk = !hasStackGoal || stacksEqual(state.stacks, state.targetStacks!);
  const stackValuesOk =
    !hasStackValueGoal ||
    stackValuesEqual(state.stackValues, state.targetStackValues!, state.targetStacks);
  const outputOk = !hasOutputGoal || arraysEqual(state.output, state.targetOutput!);
  const outputValuesOk =
    !hasOutputValueGoal ||
    outputValuesEqual(state.outputValues, state.targetOutputValues!, hasOutputGoal);
  const emptyStacksOk =
    !state.requireEmptyStacks ||
    (state.stacks[0].length === 0 && state.stacks[1].length === 0 && state.stacks[2].length === 0);
  const exactOutOk =
    state.exactOutputCount === undefined || state.output.length === state.exactOutputCount;
  const inputOk =
    state.allowNonEmptyInput === true ||
    (state.initialInput?.length ?? 0) === 0 ||
    (state.input?.length ?? 0) === 0;

  // Must also not still be holding an unplaced required item if goal matches
  return stacksOk &&
    stackValuesOk &&
    outputOk &&
    outputValuesOk &&
    emptyStacksOk &&
    exactOutOk &&
    inputOk &&
    state.heldCrate === null
    ? 'SUCCESS'
    : 'IDLE';
}

export interface DepotStepOutcome {
  nextState: DepotState;
  isCollision: boolean;
  isSuccess: boolean;
}

function failStep(
  state: DepotState,
  reason: DepotFailureReason,
  extra?: Partial<
    Omit<DepotActionTransition, 'stepId' | 'type' | 'fromStation' | 'toStation' | 'failureReason'>
  >
): DepotStepOutcome {
  const nextStepCount = (state.stepCount || 0) + 1;
  return {
    nextState: {
      ...state,
      lastFailureReason: reason,
      status: 'COLLISION',
      stepCount: nextStepCount,
      lastAction: {
        stepId: nextStepCount,
        type: 'COLLISION',
        fromStation: state.workerStation,
        toStation: state.workerStation,
        failureReason: reason,
        ...extra,
      },
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

export interface DepotSensorQueryParams {
  stationParam?: number;
  station?: string;
  colorIdx?: number;
  color?: string;
  canonicalColorIdx?: number;
}

function resolveSensorStation(state: DepotState, params?: DepotSensorQueryParams): DepotStationId {
  if (params?.station !== undefined) {
    const up = String(params.station).trim().toUpperCase();
    if (!up || up === 'CURRENT') return state.workerStation;
    return normalizeDepotStation(up);
  }
  // STATION_CODES order from docs/binary_format.md §7.1.2:
  // 0=CURRENT, 1=STACK_1, 2=STACK_2, 3=STACK_3, 4=QUEUE, 5=INPUT, 6=PHYSICAL_TAPE
  const sp = params?.stationParam ?? 0;
  switch (sp) {
    case 0: return state.workerStation;
    case 1: return 'STACK_1';
    case 2: return 'STACK_2';
    case 3: return 'STACK_3';
    case 4: return 'QUEUE';
    case 5: return 'INPUT';
    case 6: return 'TAPE';
    default: return 'STACK_1';
  }
}

function matchesSensorColor(actual: CrateColor, params?: DepotSensorQueryParams): boolean {
  const normActual = normalizeCrateColor(actual);
  if (params?.color !== undefined) {
    const target = tryNormalizeCrateColor(params.color);
    return target !== null && normActual === target;
  }
  const meta = DEPOT_CRATE_COLORS[normActual];
  if (params?.canonicalColorIdx !== undefined) {
    return meta.paletteIndex === params.canonicalColorIdx;
  }
  return meta.code === (params?.colorIdx ?? 0);
}

/**
 * Evaluate a Depot boolean sensor for use in IF/WHILE conditions.
 * Returns `true` / `false`. Unknown sensors return `false`.
 *
 * sensorCode mapping (ConditionExpr §7.1.2 Depot boolean sensors 0x18..0x1C):
 *   0x18 = stationEmpty  (stationParam: 0=CURRENT, 1=STACK_1, 2=STACK_2, 3=STACK_3, 4=QUEUE, 5=INPUT, 6=TAPE)
 *   0x19 = hasItem
 *   0x1A = itemDamaged   (legacy M5 decode/test compat)
 *   0x1B = heldColor     (color name string OR legacy colorIdx 0..3 / canonicalColorIdx 0..9)
 *   0x1C = topColor      (non-destructive peek at worker's station: stack top, QUEUE[0], or INPUT[0])
 */
export function evaluateDepotSensor(
  sensorCode: number,
  state: DepotState,
  params?: DepotSensorQueryParams
): boolean {
  switch (sensorCode) {
    case 0x18: { // stationEmpty(stationParam | station)
      const station = resolveSensorStation(state, params);
      return depotStationIsEmpty(state, station);
    }
    case 0x19: // hasItem
      return state.heldCrate !== null;
    case 0x1a: // itemDamaged (legacy M5 compat)
      return state.heldCrate !== null && state.heldDamaged;
    case 0x1b: { // heldColor
      if (state.heldCrate === null || state.heldColorless) return false;
      return matchesSensorColor(state.heldCrate, params);
    }
    case 0x1c: { // topColor (non-destructive peek at worker's station)
      const topColor = getTopColorAtStation(state, state.workerStation);
      if (topColor === null) return false;
      return matchesSensorColor(topColor, params);
    }
    default:
      return false;
  }
}

/** Returns true when the given station has no items. */
function depotStationIsEmpty(state: DepotState, station: DepotStationId): boolean {
  if (station === 'QUEUE') return state.queue.length === 0;
  if (station === 'INPUT') return (state.input?.length ?? 0) === 0;
  if (station === 'TAPE') return true;
  const idx = stationToIndex(station);
  return state.stacks[idx].length === 0;
}

/** Non-destructive peek: returns top/front color at station, or null if empty or colorless. */
function getTopColorAtStation(state: DepotState, station: DepotStationId): CrateColor | null {
  if (station === 'QUEUE') {
    if (state.queue.length === 0 || state.queue[0].colorless) return null;
    return state.queue[0].color;
  }
  if (station === 'INPUT') {
    const curInput = state.input ?? [];
    if (curInput.length === 0 || curInput[0].colorless) return null;
    return curInput[0].color;
  }
  if (station === 'TAPE') {
    return null;
  }
  const idx = stationToIndex(station);
  const stack = state.stacks[idx];
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/** Non-destructive peek: returns top/front numeric value at station, or undefined if empty/color-only. */
export function getTopValueAtStation(state: DepotState, station: DepotStationId): number | undefined {
  if (station === 'QUEUE') {
    const v = state.queue[0]?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  }
  if (station === 'INPUT') {
    const v = state.input?.[0]?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  }
  if (station === 'TAPE') {
    return undefined;
  }
  const idx = stationToIndex(station);
  const len = state.stacks[idx]?.length ?? 0;
  if (len === 0) return undefined;
  const v = state.stackValues?.[idx]?.[len - 1];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function parseDepotSensorRef(sensorId: string): { base: string; param?: string } {
  const trimmed = sensorId.trim();
  const bracket = trimmed.indexOf('[');
  if (bracket !== -1 && trimmed.endsWith(']')) {
    return {
      base: trimmed.slice(0, bracket).trim(),
      param: trimmed.slice(bracket + 1, -1).trim(),
    };
  }
  return { base: trimmed };
}

function resolveOptionalDepotStationArg(
  state: DepotState,
  param?: string
): DepotStationId | 'OUT' | null {
  if (!param) return state.workerStation;
  const up = param.trim().toUpperCase();
  if (!up || up === 'CURRENT' || up === '0') return state.workerStation;
  if (up === 'OUT' || up === 'OUTPUT') return 'OUT';
  if (up === 'STACK_1' || up === 'S1' || up === '1' || up === 'STACK 1') return 'STACK_1';
  if (up === 'STACK_2' || up === 'S2' || up === '2' || up === 'STACK 2') return 'STACK_2';
  if (up === 'STACK_3' || up === 'S3' || up === '3' || up === 'STACK 3') return 'STACK_3';
  if (up === 'QUEUE' || up === 'Q' || up === '4') return 'QUEUE';
  if (up === 'INPUT' || up === 'IN' || up === '5') return 'INPUT';
  if (up === 'TAPE' || up === 'PHYSICAL_TAPE' || up === '6') return 'TAPE';
  return null;
}

/**
 * Typed sensor reader for Depot (`$heldValue`, `$topValue`, `$heldColor`, `$topColor`,
 * `$stationLen`, `$stack1..3`, `$out`). Returns `undefined` when a bay is empty, nothing is held,
 * or item lacks the requested numeric/color payload so Wave 3A interpreter fires `TYPE_ERROR`.
 */
export function readDepotTypedSensor(
  sensorId: string,
  state: DepotState
): number | TypedValue | undefined {
  const { base, param } = parseDepotSensorRef(sensorId);
  switch (base) {
    case '$stack1':
      return state.stacks[0]?.length ?? 0;
    case '$stack2':
      return state.stacks[1]?.length ?? 0;
    case '$stack3':
      return state.stacks[2]?.length ?? 0;
    case '$out':
      return state.output?.length ?? 0;
    case '$stationLen': {
      const target = resolveOptionalDepotStationArg(state, param);
      if (target === null) return undefined;
      if (target === 'OUT') return state.output?.length ?? 0;
      if (target === 'QUEUE') return state.queue.length;
      if (target === 'INPUT') return state.input?.length ?? 0;
      if (target === 'TAPE') return 0;
      return state.stacks[stationToIndex(target)]?.length ?? 0;
    }
    case '$heldValue': {
      if (state.heldCrate === null && state.heldValue === undefined) return undefined;
      return typeof state.heldValue === 'number' && Number.isFinite(state.heldValue)
        ? state.heldValue
        : undefined;
    }
    case '$topValue': {
      const target = resolveOptionalDepotStationArg(state, param);
      if (target === null || target === 'OUT') return undefined;
      return getTopValueAtStation(state, target);
    }
    case '$heldColor': {
      if (state.heldCrate === null || state.heldColorless) return undefined;
      return {
        type: 'color',
        value: normalizeCrateColor(state.heldCrate).toLowerCase() as PaletteColor,
      };
    }
    case '$topColor': {
      const target = resolveOptionalDepotStationArg(state, param);
      if (target === null || target === 'OUT') return undefined;
      const top = getTopColorAtStation(state, target);
      if (top === null) return undefined;
      return {
        type: 'color',
        value: normalizeCrateColor(top).toLowerCase() as PaletteColor,
      };
    }
    default:
      return undefined;
  }
}

/**
 * Numeric sensor reader for `SimulationEnvironment.readSensor`.
 * Returns `NaN` for missing/non-numeric typed sensors so `resolveSimulationSensor` falls through
 * cleanly as `undefined` (`TYPE_ERROR`) instead of coercing empty bays to `0`.
 */
export function readDepotNumericSensor(sensorId: string, state: DepotState): number {
  const typed = readDepotTypedSensor(sensorId, state);
  return typeof typed === 'number' ? typed : Number.NaN;
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
      const resolved = resolveDepotMoveTarget(params?.station);
      if (resolved.isOutOfBounds) {
        return failStep(state, 'INVALID_STATION', {
          ...(resolved.attemptedIndex !== undefined
            ? { attemptedStationIndex: resolved.attemptedIndex }
            : {}),
        });
      }
      const targetStation = resolved.station;
      const numericStationIdx =
        typeof params?.station === 'number' && Number.isInteger(params.station)
          ? params.station
          : undefined;
      const lastAction: DepotActionTransition = {
        stepId: nextStepCount,
        type: 'MOVE',
        fromStation: state.workerStation,
        toStation: targetStation,
        ...(numericStationIdx !== undefined
          ? { attemptedStationIndex: numericStationIdx }
          : {}),
      };
      const candidate: DepotState = {
        ...state,
        workerStation: targetStation,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
        lastAction,
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
        return failStep(state, 'CLAW_FULL', {
          color: state.heldCrate,
          value: state.heldValue,
          damaged: state.heldDamaged,
        });
      }

      if (state.workerStation === 'QUEUE') {
        // FIFO: dequeue from front
        if (state.queue.length === 0) {
          return failStep(state, 'EMPTY_STACK');
        }
        const newQueue = [...state.queue];
        const front = newQueue.shift()!;
        const damaged = front.damaged ?? false;
        const candidate: DepotState = {
          ...state,
          queue: newQueue,
          heldCrate: front.color,
          heldDamaged: damaged,
          heldValue: front.value,
          ...(front.colorless ? { heldColorless: true } : { heldColorless: undefined }),
          lastFailureReason: null,
          stepCount: nextStepCount,
          status: 'RUNNING',
          lastAction: {
            stepId: nextStepCount,
            type: 'GRAB',
            fromStation: 'QUEUE',
            toStation: 'QUEUE',
            color: front.color,
            ...(front.value !== undefined ? { value: front.value } : {}),
            damaged,
            queueIndex: 0,
          },
        };
        return {
          nextState: candidate,
          isCollision: false,
          isSuccess: false,
        };
      }

      if (state.workerStation === 'INPUT') {
        // One-way supply dispenser: dequeue from front of input[]
        const curInput = state.input ?? [];
        if (curInput.length === 0) {
          return failStep(state, 'EMPTY_STACK');
        }
        const newInput = [...curInput];
        const front = newInput.shift()!;
        const damaged = front.damaged ?? false;
        const candidate: DepotState = {
          ...state,
          input: newInput,
          heldCrate: front.color,
          heldDamaged: damaged,
          heldValue: front.value,
          ...(front.colorless ? { heldColorless: true } : { heldColorless: undefined }),
          lastFailureReason: null,
          stepCount: nextStepCount,
          status: 'RUNNING',
          lastAction: {
            stepId: nextStepCount,
            type: 'GRAB',
            fromStation: 'INPUT',
            toStation: 'INPUT',
            color: front.color,
            ...(front.value !== undefined ? { value: front.value } : {}),
            damaged,
            inputIndex: 0,
          },
        };
        return {
          nextState: candidate,
          isCollision: false,
          isSuccess: false,
        };
      }

      if (state.workerStation === 'TAPE') {
        return failStep(state, 'INVALID_STATION');
      }

      // LIFO stack
      const stackIdx = stationToIndex(state.workerStation);
      const stack = state.stacks[stackIdx];
      if (stack.length === 0) {
        return failStep(state, 'EMPTY_STACK', { stackIndex: stackIdx });
      }
      const nextStacks = cloneStacks(state.stacks);
      const grabbed = nextStacks[stackIdx].pop()!;
      const grabbedSlotIdx = nextStacks[stackIdx].length;
      const nextStackValues = state.stackValues
        ? padStackValues(state.stackValues, state.stacks)
        : undefined;
      const grabbedValue = nextStackValues ? nextStackValues[stackIdx].pop() : undefined;
      const candidate: DepotState = {
        ...state,
        stacks: nextStacks,
        ...(nextStackValues !== undefined ? { stackValues: nextStackValues } : {}),
        heldCrate: grabbed,
        heldDamaged: false,
        heldValue: grabbedValue,
        heldColorless: undefined,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
        lastAction: {
          stepId: nextStepCount,
          type: 'GRAB',
          fromStation: state.workerStation,
          toStation: state.workerStation,
          color: grabbed,
          ...(grabbedValue !== undefined ? { value: grabbedValue } : {}),
          damaged: false,
          stackIndex: stackIdx,
          stackSlotIndex: grabbedSlotIdx,
        },
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

      if (state.workerStation === 'INPUT') {
        // One-way guard: never drop rings back into INPUT dispenser
        return failStep(state, 'INPUT_READ_ONLY', {
          color: state.heldCrate,
          value: state.heldValue,
          damaged: state.heldDamaged,
        });
      }

      if (state.workerStation === 'TAPE') {
        return failStep(state, 'INVALID_STATION', {
          color: state.heldCrate,
          value: state.heldValue,
          damaged: state.heldDamaged,
        });
      }

      if (state.workerStation === 'QUEUE') {
        // Enqueue at back
        if (state.queue.length >= DEPOT_MAX_QUEUE_LENGTH) {
          return failStep(state, 'STACK_FULL', {
            color: state.heldCrate,
            value: state.heldValue,
            damaged: state.heldDamaged,
          });
        }
        const placedColor = state.heldCrate;
        const placedDamaged = state.heldDamaged;
        const placedValue = state.heldValue;
        const placedColorless = state.heldColorless;
        const newQueue: DepotQueueItem[] = [
          ...state.queue,
          {
            color: placedColor,
            ...(placedValue !== undefined ? { value: placedValue } : {}),
            ...(placedColorless ? { colorless: true } : {}),
            ...(placedDamaged ? { damaged: true } : {}),
          },
        ];
        const candidate: DepotState = {
          ...state,
          queue: newQueue,
          heldCrate: null,
          heldDamaged: false,
          heldValue: undefined,
          heldColorless: undefined,
          lastFailureReason: null,
          stepCount: nextStepCount,
          status: 'RUNNING',
          lastAction: {
            stepId: nextStepCount,
            type: 'PLACE',
            fromStation: 'QUEUE',
            toStation: 'QUEUE',
            color: placedColor,
            ...(placedValue !== undefined ? { value: placedValue } : {}),
            damaged: placedDamaged,
            queueIndex: newQueue.length - 1,
          },
        };
        const evalStatus = evaluateDepotCompletion(candidate);
        const isSuccess = evalStatus === 'SUCCESS';
        return {
          nextState: { ...candidate, status: isSuccess ? 'SUCCESS' : 'RUNNING' },
          isCollision: false,
          isSuccess,
        };
      }

      // LIFO stack: legacy damaged crate → COLLISION
      const stackIdx = stationToIndex(state.workerStation);
      if (state.heldDamaged) {
        return failStep(state, 'DAMAGED_TO_STACK', {
          color: state.heldCrate,
          value: state.heldValue,
          damaged: true,
          stackIndex: stackIdx,
        });
      }

      if (state.stacks[stackIdx].length >= DEPOT_MAX_STACK_HEIGHT) {
        return failStep(state, 'STACK_FULL', {
          color: state.heldCrate,
          value: state.heldValue,
          damaged: false,
          stackIndex: stackIdx,
        });
      }

      // Strict Hanoi guard when enforceHanoiRule === true (no larger block atop smaller block)
      if (state.enforceHanoiRule === true && state.stacks[stackIdx].length > 0) {
        const topVal = getTopValueAtStation(state, state.workerStation);
        if (
          state.heldValue !== undefined &&
          topVal !== undefined &&
          state.heldValue > topVal
        ) {
          return failStep(state, 'HANOI_VIOLATION', {
            color: state.heldCrate,
            value: state.heldValue,
            damaged: false,
            stackIndex: stackIdx,
          });
        }
      }

      const placedColor = state.heldCrate;
      const placedValue = state.heldValue;
      const nextStacks = cloneStacks(state.stacks);
      nextStacks[stackIdx].push(placedColor);
      const placedSlotIdx = nextStacks[stackIdx].length - 1;
      let nextStackValues = state.stackValues
        ? padStackValues(state.stackValues, state.stacks)
        : placedValue !== undefined
        ? padStackValues(undefined, state.stacks)
        : undefined;
      if (nextStackValues) {
        nextStackValues[stackIdx].push(placedValue);
      }
      const candidate: DepotState = {
        ...state,
        stacks: nextStacks,
        ...(nextStackValues !== undefined ? { stackValues: nextStackValues } : {}),
        heldCrate: null,
        heldDamaged: false,
        heldValue: undefined,
        heldColorless: undefined,
        lastFailureReason: null,
        stepCount: nextStepCount,
        status: 'RUNNING',
        lastAction: {
          stepId: nextStepCount,
          type: 'PLACE',
          fromStation: state.workerStation,
          toStation: state.workerStation,
          color: placedColor,
          ...(placedValue !== undefined ? { value: placedValue } : {}),
          damaged: false,
          stackIndex: stackIdx,
          stackSlotIndex: placedSlotIdx,
        },
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
          lastAction: undefined,
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
    return failStep(state, 'CLAW_EMPTY', { gate });
  }

  const sentColor = state.heldCrate;
  const sentDamaged = state.heldDamaged;
  const sentValue = state.heldValue;

  if (gate === 'SCRAP') {
    // Sending intact crate to SCRAP → COLLISION
    if (!sentDamaged) {
      return failStep(state, 'INTACT_TO_SCRAP', {
        gate,
        color: sentColor,
        ...(sentValue !== undefined ? { value: sentValue } : {}),
        damaged: false,
      });
    }
    // Send damaged crate to scrap (legacy M5)
    const candidate: DepotState = {
      ...state,
      scrapCount: state.scrapCount + 1,
      heldCrate: null,
      heldDamaged: false,
      heldValue: undefined,
      heldColorless: undefined,
      lastFailureReason: null,
      stepCount: nextStepCount,
      status: 'RUNNING',
      lastAction: {
        stepId: nextStepCount,
        type: 'SEND_OUT',
        fromStation: state.workerStation,
        toStation: state.workerStation,
        gate: 'SCRAP',
        color: sentColor,
        ...(sentValue !== undefined ? { value: sentValue } : {}),
        damaged: true,
      },
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
  const nextOutput = [...state.output, sentColor];
  const outputSlotIndex = nextOutput.length - 1;
  let nextOutputValues: Array<number | undefined> | undefined =
    state.outputValues !== undefined || sentValue !== undefined
      ? [...(state.outputValues ?? Array(state.output.length).fill(undefined)), sentValue]
      : undefined;
  const colorMismatch =
    state.targetOutput &&
    state.targetOutput.length > 0 &&
    (outputSlotIndex >= state.targetOutput.length ||
      nextOutput[outputSlotIndex] !== state.targetOutput[outputSlotIndex]);
  const valueMismatch =
    state.targetOutputValues &&
    state.targetOutputValues.length > 0 &&
    (outputSlotIndex >= state.targetOutputValues.length ||
      (state.targetOutputValues[outputSlotIndex] !== undefined &&
        sentValue !== state.targetOutputValues[outputSlotIndex]));
  if (colorMismatch || valueMismatch) {
    return failStep(
      {
        ...state,
        output: nextOutput,
        ...(nextOutputValues !== undefined ? { outputValues: nextOutputValues } : {}),
        heldCrate: null,
        heldDamaged: false,
        heldValue: undefined,
        heldColorless: undefined,
      },
      'WRONG_OUTPUT_ORDER',
      {
        gate,
        color: sentColor,
        ...(sentValue !== undefined ? { value: sentValue } : {}),
        damaged: sentDamaged,
        outputSlotIndex,
      }
    );
  }
  const candidate: DepotState = {
    ...state,
    output: nextOutput,
    ...(nextOutputValues !== undefined ? { outputValues: nextOutputValues } : {}),
    heldCrate: null,
    heldDamaged: false,
    heldValue: undefined,
    heldColorless: undefined,
    lastFailureReason: null,
    stepCount: nextStepCount,
    status: 'RUNNING',
    lastAction: {
      stepId: nextStepCount,
      type: 'SEND_OUT',
      fromStation: state.workerStation,
      toStation: state.workerStation,
      gate,
      color: sentColor,
      ...(sentValue !== undefined ? { value: sentValue } : {}),
      damaged: sentDamaged,
      outputSlotIndex,
    },
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
