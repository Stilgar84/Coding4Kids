import {
  CurriculumSwitchyardDefinition,
  SwitchyardDockDef,
  SwitchyardItemDef,
  SwitchyardSwitchDef,
} from '../../data/curriculum/types';
import { PaletteColor, SimulationStatus, TypedValue } from '../../types';
import {
  DockExpectedItemSpec,
  DockId,
  DockSpec,
  DockState,
  EXTENDED_COLOR_TO_PALETTE_IDX,
  EXTENDED_ITEM_COLORS,
  ITEM_COLOR_FROM_INDEX,
  ITEM_ICON_FROM_INDEX,
  ItemColor,
  ItemIcon,
  SwitchDirection,
  SwitchJunctionId,
  SwitchState,
  SwitchyardFailureDetail,
  SwitchyardItem,
  SwitchyardMode,
  SwitchyardParitySlot,
  SwitchyardScrapRule,
  SwitchyardState,
} from './types';

/**
 * Normalizes lowercase, semantic, and uppercase color strings to canonical ItemColor.
 * Maps 'yellow' / 'amber' / 'gold' -> 'YELLOW' so curriculum ('amber'), conditionSerializer ('amber'),
 * and legacy tests ('YELLOW') share a single canonical color token.
 */
export function normalizeSwitchyardColor(raw?: string | null): ItemColor | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const key = raw.trim().toLowerCase();
  switch (key) {
    case 'red':
    case 'rose':
    case 'crimson':
      return 'RED';
    case 'blue':
    case 'sky':
    case 'navy':
      return 'BLUE';
    case 'green':
    case 'emerald':
      return 'GREEN';
    case 'yellow':
    case 'amber':
    case 'gold':
      return 'YELLOW';
    case 'purple':
    case 'violet':
      return 'PURPLE';
    case 'pink':
    case 'magenta':
      return 'PINK';
    case 'cyan':
    case 'teal':
      return 'CYAN';
    case 'orange':
      return 'ORANGE';
    case 'white':
      return 'WHITE';
    case 'black':
      return 'BLACK';
    default: {
      const upper = raw.trim().toUpperCase() as ItemColor;
      return EXTENDED_ITEM_COLORS.includes(upper) ? upper : undefined;
    }
  }
}

/**
 * Maps canonical Switchyard ItemColor to canonical Phase 3 PaletteColor ('amber' for YELLOW).
 */
export function itemColorToPaletteColor(color: ItemColor): PaletteColor {
  switch (color) {
    case 'RED':
      return 'red';
    case 'BLUE':
      return 'blue';
    case 'GREEN':
      return 'green';
    case 'YELLOW':
      return 'amber';
    case 'PURPLE':
      return 'purple';
    case 'PINK':
      return 'pink';
    case 'CYAN':
      return 'cyan';
    case 'ORANGE':
      return 'orange';
    case 'WHITE':
      return 'white';
    case 'BLACK':
      return 'black';
  }
}

/**
 * Normalizes lowercase, semantic, and uppercase icon strings to canonical ItemIcon.
 * Supports aliases such as 'gem'/'diamond' -> 'CRYSTAL' and 'box' -> 'CRATE'.
 */
export function normalizeSwitchyardIcon(raw?: string | null): ItemIcon | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const key = raw.trim().toLowerCase();
  switch (key) {
    case 'crate':
    case 'box':
      return 'CRATE';
    case 'battery':
    case 'power':
    case 'charge':
      return 'BATTERY';
    case 'gear':
    case 'cog':
      return 'GEAR';
    case 'crystal':
    case 'gem':
    case 'diamond':
      return 'CRYSTAL';
    default:
      return undefined;
  }
}

export function normalizeParitySlot(raw: unknown): SwitchyardParitySlot | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') {
    if (raw === 1) return 'odd';
    if (raw === 0 || raw === 2) return 'even';
    return undefined;
  }
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (k === 'odd' || k === '1') return 'odd';
    if (k === 'even' || k === '0' || k === '2') return 'even';
  }
  return undefined;
}

export function normalizeDockId(raw?: string | null): Exclude<DockId, 'SCRAP'> {
  const upper = String(raw ?? 'A').trim().toUpperCase();
  if (upper === 'B' || upper === 'DOCK_B' || upper === 'DOCK-B' || upper === '1') return 'DOCK_B';
  if (upper === 'C' || upper === 'DOCK_C' || upper === 'DOCK-C' || upper === '2') return 'DOCK_C';
  return 'DOCK_A';
}

export function normalizeSwitchTarget(
  raw?: string | null,
  preferSwitchB = false,
  preferSwitchC = false
): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const upper = raw.trim().toUpperCase();
  if (upper === 'SWITCH_B' || upper === 'SW_B' || upper === 'SWITCH-B') return 'SWITCH_B';
  if (upper === 'SWITCH_C' || upper === 'SW_C' || upper === 'SWITCH-C') return 'SWITCH_C';
  if (preferSwitchB && upper === 'B') return 'SWITCH_B';
  if (preferSwitchC && upper === 'C') return 'SWITCH_C';
  if (upper === 'SCRAP' || upper === 'SCRAP_CHUTE') return 'SCRAP';
  if (upper === 'A' || upper === 'DOCK_A' || upper === 'DOCK-A') return 'DOCK_A';
  if (upper === 'B' || upper === 'DOCK_B' || upper === 'DOCK-B') return 'DOCK_B';
  if (upper === 'C' || upper === 'DOCK_C' || upper === 'DOCK-C') return 'DOCK_C';
  return upper;
}

const DEFAULT_QUEUE: SwitchyardItem[] = [
  { id: 'c1', color: 'RED', icon: 'CRATE', damaged: false },
  { id: 'c2', color: 'BLUE', icon: 'CRATE', damaged: false },
  { id: 'c3', color: 'RED', icon: 'GEAR', damaged: false },
  { id: 'c4', color: 'BLUE', icon: 'BATTERY', damaged: false },
];

function getDefaultDockSpecsForSwitchCount(
  switchCount: number,
  withDefaultColors: boolean
): DockSpec[] {
  if (switchCount <= 0) {
    return [{ dockId: 'DOCK_A', rejectDamaged: true }];
  }
  if (switchCount === 1) {
    return [
      {
        dockId: 'DOCK_A',
        ...(withDefaultColors ? { acceptColor: 'RED' } : {}),
        rejectDamaged: true,
      },
      {
        dockId: 'DOCK_B',
        ...(withDefaultColors ? { acceptColor: 'BLUE' } : {}),
        rejectDamaged: true,
      },
    ];
  }
  return [
    {
      dockId: 'DOCK_A',
      ...(withDefaultColors ? { acceptColor: 'RED' } : {}),
      rejectDamaged: true,
    },
    {
      dockId: 'DOCK_B',
      ...(withDefaultColors ? { acceptColor: 'BLUE' } : {}),
      rejectDamaged: true,
    },
    {
      dockId: 'DOCK_C',
      ...(withDefaultColors ? { acceptColor: 'GREEN' } : {}),
      rejectDamaged: true,
    },
  ];
}

function parseSeqNum(raw: any): number | undefined {
  if (typeof raw?.seqNum === 'number' && Number.isFinite(raw.seqNum)) {
    return Math.round(raw.seqNum);
  }
  if (typeof raw?.seq === 'number' && Number.isFinite(raw.seq)) {
    return Math.round(raw.seq);
  }
  if (typeof raw?.seqTag === 'string') {
    const m = /^#?(\d+)$/.exec(raw.seqTag.trim());
    if (m) return Number(m[1]);
  }
  return undefined;
}

function normalizeQueueItem(raw: SwitchyardItem | SwitchyardItemDef | any, idx: number): SwitchyardItem {
  const color = normalizeSwitchyardColor(raw?.color) ?? 'RED';
  const icon = normalizeSwitchyardIcon(raw?.icon) ?? 'CRATE';
  const seqNum = parseSeqNum(raw);
  return {
    id: typeof raw?.id === 'string' && raw.id.length > 0 ? raw.id : `item_${idx + 1}`,
    color,
    icon,
    damaged: Boolean(raw?.damaged),
    ...(typeof raw?.weight === 'number' && Number.isFinite(raw.weight) ? { weight: raw.weight } : {}),
    ...(seqNum !== undefined ? { seqNum } : {}),
    ...(typeof raw?.seqTag === 'string' ? { seqTag: raw.seqTag } : {}),
  };
}

function normalizeExpectedItem(raw: any): DockExpectedItemSpec {
  const seqNum = parseSeqNum(raw);
  return {
    ...(raw?.color ? { color: normalizeSwitchyardColor(raw.color) } : {}),
    ...(raw?.icon ? { icon: normalizeSwitchyardIcon(raw.icon) } : {}),
    ...(raw?.damaged !== undefined ? { damaged: Boolean(raw.damaged) } : {}),
    ...(typeof raw?.weight === 'number' && Number.isFinite(raw.weight) ? { weight: raw.weight } : {}),
    ...(seqNum !== undefined ? { seqNum } : {}),
  };
}

function normalizeDockSpec(
  raw: Partial<DockSpec> & Partial<SwitchyardDockDef> & { spec?: Partial<DockSpec> },
  isCurriculumInput: boolean
): DockSpec {
  const src = raw.spec ? { ...raw.spec, id: raw.id ?? raw.spec.dockId } : raw;
  const dockId = normalizeDockId((src as any).dockId ?? (src as any).id);
  const acceptColor = normalizeSwitchyardColor((src as any).acceptColor ?? (src as any).expectedColor);
  const acceptIcon = normalizeSwitchyardIcon((src as any).acceptIcon ?? (src as any).expectedIcon);
  const acceptsDamaged = (src as any).acceptsDamaged as boolean | undefined;
  const rawReject = (src as any).rejectDamaged as boolean | undefined;
  const rejectDamaged =
    rawReject !== undefined
      ? Boolean(rawReject)
      : acceptsDamaged !== undefined
      ? !acceptsDamaged
      : isCurriculumInput;

  const expectedItemsRaw = (src as any).expectedItems as any[] | undefined;
  const expectedItems =
    Array.isArray(expectedItemsRaw) && expectedItemsRaw.length > 0
      ? expectedItemsRaw.map(normalizeExpectedItem)
      : undefined;

  const quota =
    typeof (src as any).quota === 'number' && Number.isFinite((src as any).quota)
      ? (src as any).quota
      : undefined;
  const minWeight =
    typeof (src as any).minWeight === 'number' && Number.isFinite((src as any).minWeight)
      ? (src as any).minWeight
      : undefined;
  const maxWeight =
    typeof (src as any).maxWeight === 'number' && Number.isFinite((src as any).maxWeight)
      ? (src as any).maxWeight
      : undefined;
  const paritySlot = normalizeParitySlot((src as any).paritySlot ?? (src as any).parity);
  const isReturnBayRaw = (src as any).isReturnBay ?? (src as any).returnBay;
  const isReturnBay = isReturnBayRaw !== undefined ? Boolean(isReturnBayRaw) : undefined;

  return {
    dockId,
    ...(acceptColor ? { acceptColor } : {}),
    ...(acceptIcon ? { acceptIcon } : {}),
    rejectDamaged,
    ...(expectedItems ? { expectedItems } : {}),
    ...(quota !== undefined ? { quota } : {}),
    ...(minWeight !== undefined ? { minWeight } : {}),
    ...(maxWeight !== undefined ? { maxWeight } : {}),
    ...(paritySlot !== undefined ? { paritySlot } : {}),
    ...(isReturnBay !== undefined ? { isReturnBay } : {}),
  };
}

function normalizeSwitchState(
  raw: SwitchState | SwitchyardSwitchDef | any,
  idx: number,
  hasSwitchB = false,
  hasSwitchC = false
): SwitchState {
  const defaultId: SwitchJunctionId = idx === 2 ? 'C' : idx === 1 ? 'B' : 'A';
  const rawId = String(raw?.id ?? defaultId).trim().toUpperCase();
  const id: SwitchJunctionId = rawId === 'C' ? 'C' : rawId === 'B' ? 'B' : 'A';
  const initDir: SwitchDirection =
    String(raw?.initialDirection ?? raw?.direction ?? 'LEFT').trim().toUpperCase() === 'RIGHT'
      ? 'RIGHT'
      : 'LEFT';
  const dir: SwitchDirection =
    String(raw?.direction ?? initDir).trim().toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
  const preferSwitchB = id === 'A' && hasSwitchB;
  const preferSwitchC = (id === 'A' || id === 'B') && hasSwitchC;
  const leftTarget = normalizeSwitchTarget(raw?.leftTarget, preferSwitchB, preferSwitchC);
  const rightTarget = normalizeSwitchTarget(raw?.rightTarget, preferSwitchB, preferSwitchC);
  return {
    id,
    direction: dir,
    initialDirection: initDir,
    ...(leftTarget ? { leftTarget } : {}),
    ...(rightTarget ? { rightTarget } : {}),
  };
}

function cloneQueue(items: readonly SwitchyardItem[]): SwitchyardItem[] {
  return items.map((i) => ({ ...i }));
}

function cloneDockSpecs(specs: readonly DockSpec[]): DockSpec[] {
  return specs.map((s) => ({
    ...s,
    ...(s.expectedItems ? { expectedItems: s.expectedItems.map((e) => ({ ...e })) } : {}),
  }));
}

function makeDockState(spec: DockSpec, items: SwitchyardItem[] = []): DockState {
  return {
    id: spec.dockId,
    spec: cloneDockSpecs([spec])[0],
    items,
    received: items,
    ...(spec.quota !== undefined ? { quota: spec.quota } : {}),
    ...(spec.minWeight !== undefined ? { minWeight: spec.minWeight } : {}),
    ...(spec.maxWeight !== undefined ? { maxWeight: spec.maxWeight } : {}),
    ...(spec.paritySlot !== undefined ? { paritySlot: spec.paritySlot } : {}),
    ...(spec.isReturnBay !== undefined ? { isReturnBay: spec.isReturnBay } : {}),
  };
}

/**
 * Computes live Twin-Scale Fulcrum Balance Beam metrics from Dock A (left pan) & Dock B (right pan).
 */
export function computeSwitchyardScaleMetrics(docks: readonly DockState[]): {
  leftWeightSum: number;
  rightWeightSum: number;
  beamTiltDeg: number;
} {
  const leftDock = docks.find((d) => d.id === 'DOCK_A') ?? docks[0];
  const rightDock = docks.find((d) => d.id === 'DOCK_B') ?? docks[1];
  const leftWeightSum = (leftDock?.items ?? []).reduce((sum, it) => sum + (it.weight ?? 1), 0);
  const rightWeightSum = (rightDock?.items ?? []).reduce((sum, it) => sum + (it.weight ?? 1), 0);
  const delta = rightWeightSum - leftWeightSum;
  const beamTiltDeg = Math.max(-15, Math.min(15, Number((delta * 1.5).toFixed(2))));
  return { leftWeightSum, rightWeightSum, beamTiltDeg };
}

/**
 * Normalizes either a full/partial CurriculumSwitchyardDefinition, a legacy Partial<SwitchyardState>,
 * or variant overrides ({ initialQueue, initialDockSpecs, initialSwitchDirections }) into a canonical SwitchyardState.
 */
export function normalizeSwitchyardDefinition(
  input?:
    | Partial<SwitchyardState>
    | CurriculumSwitchyardDefinition
    | (Record<string, any> & {
        initialSwitchDirections?: SwitchDirection[];
      })
): SwitchyardState {
  if (!input || typeof input !== 'object') {
    const initialQueue = cloneQueue(DEFAULT_QUEUE);
    const initialDockSpecs = getDefaultDockSpecsForSwitchCount(1, true);
    return {
      queue: cloneQueue(initialQueue),
      initialQueue,
      docks: initialDockSpecs.map((spec) => makeDockState(spec)),
      initialDockSpecs,
      switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
      scrapped: [],
      scrap: [],
      scrapRule: 'damaged_only',
      scrapExpectedDamagedOnly: true,
      dispatchedCount: 0,
      status: 'IDLE',
      stepCount: 0,
    };
  }

  const raw = input as Record<string, any>;
  const isCurriculumInput = Boolean(
    raw.incomingStream !== undefined ||
      raw.scrapChute !== undefined ||
      raw.scrapRules !== undefined ||
      (Array.isArray(raw.docks) &&
        raw.docks.some(
          (d: any) =>
            d &&
            ('expectedColor' in d ||
              'expectedIcon' in d ||
              'acceptsDamaged' in d ||
              'expectedItems' in d ||
              d.id === 'A' ||
              d.id === 'B' ||
              d.id === 'C')
        ))
  );

  // 1. Switches (supports 0, 1, 2, or 3 switches)
  let switches: SwitchState[];
  if (Array.isArray(raw.switches)) {
    const sliced = raw.switches.slice(0, 3);
    const hasSwitchB = sliced.some(
      (sw: any, idx: number) => String(sw?.id ?? (idx === 1 ? 'B' : 'A')).trim().toUpperCase() === 'B'
    );
    const hasSwitchC = sliced.some(
      (sw: any, idx: number) => String(sw?.id ?? (idx === 2 ? 'C' : 'A')).trim().toUpperCase() === 'C'
    );
    switches = sliced.map((sw: any, idx: number) =>
      normalizeSwitchState(sw, idx, hasSwitchB, hasSwitchC)
    );
  } else if (Array.isArray(raw.initialSwitchDirections)) {
    switches = raw.initialSwitchDirections.slice(0, 3).map((dir: SwitchDirection, idx: number) => ({
      id: idx === 2 ? 'C' : idx === 1 ? 'B' : 'A',
      direction: dir === 'RIGHT' ? 'RIGHT' : 'LEFT',
      initialDirection: dir === 'RIGHT' ? 'RIGHT' : 'LEFT',
    }));
  } else {
    switches = [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }];
  }

  // 2. Incoming Stream / Queue
  const hasCustomQueue =
    Array.isArray(raw.incomingStream) ||
    Array.isArray(raw.initialQueue) ||
    Array.isArray(raw.queue);
  const sourceInitial = Array.isArray(raw.incomingStream)
    ? raw.incomingStream
    : Array.isArray(raw.initialQueue)
    ? raw.initialQueue
    : Array.isArray(raw.queue)
    ? raw.queue
    : DEFAULT_QUEUE;

  const initialQueue = sourceInitial.map(normalizeQueueItem);
  const queue = Array.isArray(raw.queue)
    ? raw.queue.map(normalizeQueueItem)
    : cloneQueue(initialQueue);

  // 3. Docks & Specs
  let initialDockSpecs: DockSpec[];
  let docks: DockState[];

  if (Array.isArray(raw.docks) && raw.docks.length > 0) {
    const rawSpecsSource = Array.isArray(raw.initialDockSpecs) ? raw.initialDockSpecs : raw.docks;
    initialDockSpecs = rawSpecsSource.map((d: any) => normalizeDockSpec(d, isCurriculumInput));
    docks = raw.docks.map((d: any, idx: number) => {
      const spec = initialDockSpecs[idx] ?? normalizeDockSpec(d, isCurriculumInput);
      const rawItems = Array.isArray(d?.items) ? d.items : Array.isArray(d?.received) ? d.received : [];
      const items = rawItems.map(normalizeQueueItem);
      return makeDockState(spec, items);
    });
  } else if (Array.isArray(raw.initialDockSpecs) && raw.initialDockSpecs.length > 0) {
    initialDockSpecs = raw.initialDockSpecs.map((d: any) => normalizeDockSpec(d, isCurriculumInput));
    docks = initialDockSpecs.map((spec) => makeDockState(spec));
  } else {
    initialDockSpecs = getDefaultDockSpecsForSwitchCount(switches.length, !hasCustomQueue);
    docks = initialDockSpecs.map((spec) => makeDockState(spec));
  }

  // 4. Scrap Rules & Pile
  const rawScrapSource = raw.scrapRules ?? raw.scrapRule ?? raw.scrapChute?.rule;
  const rawScrapToken = Array.isArray(rawScrapSource)
    ? rawScrapSource[0]
    : typeof rawScrapSource === 'object' && rawScrapSource !== null
    ? rawScrapSource.kind ?? rawScrapSource.mode ?? rawScrapSource.rule
    : rawScrapSource;
  const normalizedScrapToken =
    typeof rawScrapToken === 'string' ? rawScrapToken.trim().toLowerCase() : undefined;

  const explicitScrapMaxWeight =
    typeof raw.scrapMaxWeight === 'number' && Number.isFinite(raw.scrapMaxWeight)
      ? raw.scrapMaxWeight
      : typeof rawScrapSource === 'object' &&
        rawScrapSource !== null &&
        typeof rawScrapSource.maxWeight === 'number' &&
        Number.isFinite(rawScrapSource.maxWeight)
      ? rawScrapSource.maxWeight
      : typeof raw.scrapChute?.maxWeight === 'number' && Number.isFinite(raw.scrapChute.maxWeight)
      ? raw.scrapChute.maxWeight
      : undefined;

  let scrapRule: SwitchyardScrapRule = 'damaged_only';
  if (
    normalizedScrapToken === 'damaged_or_overweight' ||
    raw.scrapChute?.acceptOverweight === true ||
    explicitScrapMaxWeight !== undefined
  ) {
    scrapRule = 'damaged_or_overweight';
  } else if (
    normalizedScrapToken === 'any' ||
    normalizedScrapToken === 'none' ||
    normalizedScrapToken === 'damaged_only'
  ) {
    scrapRule = normalizedScrapToken;
  } else if (normalizedScrapToken === 'never') {
    scrapRule = 'none';
  } else if (raw.scrapChute?.expectedDamagedOnly === false) {
    scrapRule = 'any';
  }

  const scrapMaxWeight =
    scrapRule === 'damaged_or_overweight' ? explicitScrapMaxWeight ?? 20 : undefined;

  const scrapExpectedDamagedOnly =
    raw.scrapChute?.expectedDamagedOnly !== undefined
      ? Boolean(raw.scrapChute.expectedDamagedOnly)
      : raw.scrapExpectedDamagedOnly !== undefined
      ? Boolean(raw.scrapExpectedDamagedOnly)
      : scrapRule === 'damaged_only';

  const rawScrapped = Array.isArray(raw.scrapped)
    ? raw.scrapped
    : Array.isArray(raw.scrap)
    ? raw.scrap
    : [];
  const scrapped = rawScrapped.map(normalizeQueueItem);

  // 5. Mode & Balance Scale
  let mode: SwitchyardMode | undefined;
  const rawMode = typeof raw.mode === 'string' ? raw.mode.trim().toLowerCase() : undefined;
  if (
    rawMode === 'balance_scale' ||
    raw.balanceScale === true ||
    raw.balanceMode === true
  ) {
    mode = 'balance_scale';
  } else if (
    rawMode === 'order_manifest' ||
    rawMode === 'strategy_filter' ||
    rawMode === 'standard'
  ) {
    mode = rawMode;
  }

  const balanceTolerance =
    typeof raw.balanceTolerance === 'number' && Number.isFinite(raw.balanceTolerance)
      ? raw.balanceTolerance
      : typeof raw.scaleTolerance === 'number' && Number.isFinite(raw.scaleTolerance)
      ? raw.scaleTolerance
      : mode === 'balance_scale'
      ? 0
      : undefined;

  const scaleMetrics =
    mode === 'balance_scale' ? computeSwitchyardScaleMetrics(docks) : undefined;

  const validStatuses: SimulationStatus[] = [
    'IDLE',
    'RUNNING',
    'PAUSED',
    'SUCCESS',
    'COLLISION',
    'STEP_LIMIT',
    'STACK_OVERFLOW',
    'MATH_ERROR',
    'TYPE_ERROR',
    'DEADLOCK',
  ];
  const status: SimulationStatus = validStatuses.includes(raw.status) ? raw.status : 'IDLE';

  const defaultDispatched =
    typeof raw.dispatchedCount === 'number' && Number.isFinite(raw.dispatchedCount)
      ? raw.dispatchedCount
      : Math.max(0, initialQueue.length - queue.length);

  const KNOWN_INPUT_KEYS = new Set([
    'queue',
    'initialQueue',
    'incomingStream',
    'docks',
    'initialDockSpecs',
    'switches',
    'initialSwitchDirections',
    'scrapped',
    'scrap',
    'scrapRule',
    'scrapRules',
    'scrapMaxWeight',
    'scrapExpectedDamagedOnly',
    'scrapChute',
    'mode',
    'balanceScale',
    'balanceMode',
    'balanceTolerance',
    'scaleTolerance',
    'leftWeightSum',
    'rightWeightSum',
    'beamTiltDeg',
    'dispatchedCount',
    'tape',
    'status',
    'stepCount',
    'lastFailureReason',
    'lastFailureDetail',
    'lastRoutedDock',
    'lastAnimEvent',
  ]);
  const legacyExtra: Record<string, any> = {};
  if (!isCurriculumInput) {
    for (const [key, val] of Object.entries(raw)) {
      if (!KNOWN_INPUT_KEYS.has(key) && val !== undefined) {
        legacyExtra[key] = val;
      }
    }
  }

  return {
    ...legacyExtra,
    queue,
    initialQueue,
    docks,
    initialDockSpecs: cloneDockSpecs(initialDockSpecs),
    switches,
    scrapped,
    scrap: scrapped,
    scrapRule,
    ...(scrapMaxWeight !== undefined ? { scrapMaxWeight } : {}),
    scrapExpectedDamagedOnly,
    ...(mode !== undefined ? { mode } : {}),
    ...(balanceTolerance !== undefined ? { balanceTolerance } : {}),
    ...(scaleMetrics ? scaleMetrics : {}),
    dispatchedCount: defaultDispatched,
    ...(raw.tape && typeof raw.tape === 'object' ? { tape: { ...raw.tape } } : {}),
    status,
    stepCount: typeof raw.stepCount === 'number' && Number.isFinite(raw.stepCount) ? raw.stepCount : 0,
    ...(raw.lastFailureReason ? { lastFailureReason: raw.lastFailureReason } : {}),
    ...(raw.lastFailureDetail ? { lastFailureDetail: raw.lastFailureDetail } : {}),
    ...(raw.lastRoutedDock ? { lastRoutedDock: raw.lastRoutedDock } : {}),
    ...(raw.lastAnimEvent ? { lastAnimEvent: raw.lastAnimEvent } : {}),
  };
}

export function createInitialSwitchyardState(
  overrides?: Partial<SwitchyardState> | CurriculumSwitchyardDefinition | Record<string, any>
): SwitchyardState {
  return normalizeSwitchyardDefinition(overrides);
}

export function resetSwitchyardState(state: SwitchyardState): SwitchyardState {
  const initialQueue = cloneQueue(state.initialQueue?.length ? state.initialQueue : DEFAULT_QUEUE);
  const baseSpecs = state.initialDockSpecs?.length
    ? cloneDockSpecs(state.initialDockSpecs)
    : getDefaultDockSpecsForSwitchCount(state.switches?.length ?? 1, false);
  const docks = baseSpecs.map((spec) => makeDockState(spec));
  const scaleMetrics =
    state.mode === 'balance_scale' ? computeSwitchyardScaleMetrics(docks) : undefined;

  return {
    queue: cloneQueue(initialQueue),
    initialQueue,
    docks,
    initialDockSpecs: baseSpecs,
    switches: (state.switches ?? []).map((s) => ({
      ...s,
      direction: s.initialDirection,
    })),
    scrapped: [],
    scrap: [],
    scrapRule: state.scrapRule ?? 'damaged_only',
    ...(state.scrapMaxWeight !== undefined ? { scrapMaxWeight: state.scrapMaxWeight } : {}),
    scrapExpectedDamagedOnly:
      state.scrapExpectedDamagedOnly ?? (state.scrapRule ?? 'damaged_only') === 'damaged_only',
    ...(state.mode !== undefined ? { mode: state.mode } : {}),
    ...(state.balanceTolerance !== undefined ? { balanceTolerance: state.balanceTolerance } : {}),
    ...(scaleMetrics ? scaleMetrics : {}),
    dispatchedCount: 0,
    ...(state.tape ? { tape: { ...state.tape } } : {}),
    status: 'IDLE',
    stepCount: 0,
    lastFailureReason: undefined,
    lastFailureDetail: undefined,
    lastRoutedDock: undefined,
    lastAnimEvent: undefined,
  };
}

/**
 * Resolves which dock/chute a car would route to given current switch settings,
 * supporting 0, 1, 2, or 3 switch topologies and explicit leftTarget/rightTarget overrides.
 */
export function resolveSwitchyardRoute(
  switches: readonly SwitchState[],
  docks: readonly DockState[]
): { targetDock: DockId; switchesTraversed: SwitchJunctionId[] } {
  if (switches.length === 0) {
    return {
      targetDock: docks[0]?.id ?? 'DOCK_A',
      switchesTraversed: [],
    };
  }

  const swA = switches.find((s) => s.id === 'A') ?? switches[0];
  const swB = switches.length >= 2 ? switches.find((s) => s.id === 'B') ?? switches[1] : undefined;
  const swC = switches.length >= 3 ? switches.find((s) => s.id === 'C') ?? switches[2] : undefined;

  const explicitA =
    swA.direction === 'LEFT'
      ? normalizeSwitchTarget(swA.leftTarget, Boolean(swB), Boolean(swC))
      : normalizeSwitchTarget(swA.rightTarget, Boolean(swB), Boolean(swC));

  const defaultA = swA.direction === 'LEFT' ? 'DOCK_A' : swB ? 'SWITCH_B' : 'DOCK_B';
  const firstHop = explicitA ?? defaultA;

  if (firstHop === 'SWITCH_B') {
    if (swB) {
      const explicitB =
        swB.direction === 'LEFT'
          ? normalizeSwitchTarget(swB.leftTarget, false, Boolean(swC))
          : normalizeSwitchTarget(swB.rightTarget, false, Boolean(swC));
      const defaultB = swB.direction === 'LEFT' ? 'DOCK_B' : swC ? 'SWITCH_C' : 'DOCK_C';
      const secondHop = explicitB ?? defaultB;
      if (secondHop === 'SWITCH_C' && swC) {
        const explicitC =
          swC.direction === 'LEFT'
            ? normalizeSwitchTarget(swC.leftTarget)
            : normalizeSwitchTarget(swC.rightTarget);
        const defaultC = swC.direction === 'LEFT' ? 'DOCK_B' : 'DOCK_C';
        return {
          targetDock: (explicitC ?? defaultC) as DockId,
          switchesTraversed: ['A', 'B', 'C'],
        };
      }
      return {
        targetDock: secondHop as DockId,
        switchesTraversed: ['A', 'B'],
      };
    }
    return { targetDock: 'DOCK_B', switchesTraversed: ['A'] };
  }

  if (firstHop === 'SWITCH_C' && swC) {
    const explicitC =
      swC.direction === 'LEFT'
        ? normalizeSwitchTarget(swC.leftTarget)
        : normalizeSwitchTarget(swC.rightTarget);
    const defaultC = swC.direction === 'LEFT' ? 'DOCK_B' : 'DOCK_C';
    return {
      targetDock: (explicitC ?? defaultC) as DockId,
      switchesTraversed: ['A', 'C'],
    };
  }

  return {
    targetDock: firstHop as DockId,
    switchesTraversed: ['A'],
  };
}

/**
 * Evaluates Switchyard boolean sensors cleanly across both string ConditionExpr tokens
 * (e.g. 'red', 'amber', 'crystal', 'gem', 'BLUE') and legacy object sensor tokens.
 */
export function evaluateSwitchyardSensor(
  sensor:
    | {
        type: string;
        colorIdx?: number;
        iconIdx?: number;
        stationCode?: number;
        param?: string;
        color?: string;
        icon?: string;
      }
    | string,
  state: SwitchyardState,
  param?:
    | string
    | number
    | { param?: string; color?: string; icon?: string; colorIdx?: number; iconIdx?: number }
): boolean {
  const type = typeof sensor === 'string' ? sensor : sensor.type;
  const paramObj = typeof param === 'object' && param !== null ? param : undefined;
  const effectiveParam =
    typeof param === 'string' || typeof param === 'number'
      ? String(param)
      : paramObj?.param ??
        paramObj?.color ??
        paramObj?.icon ??
        (typeof sensor === 'object' ? sensor.param ?? sensor.color ?? sensor.icon : undefined);
  const head = state.queue[0];

  switch (type) {
    case 'hasNextItem':
      return state.queue.length > 0;
    case 'itemDamaged':
      return Boolean(head && head.damaged);
    case 'itemColor': {
      if (!head) return false;
      if (effectiveParam !== undefined && effectiveParam !== null && effectiveParam !== '') {
        const expectedColor = normalizeSwitchyardColor(String(effectiveParam));
        return expectedColor ? head.color === expectedColor : false;
      }
      const colorIdx =
        paramObj?.colorIdx ?? (typeof sensor === 'object' ? sensor.colorIdx : undefined);
      if (colorIdx !== undefined) {
        const expected = ITEM_COLOR_FROM_INDEX[colorIdx];
        return expected ? head.color === expected : false;
      }
      return false;
    }
    case 'itemIcon': {
      if (!head) return false;
      if (effectiveParam !== undefined && effectiveParam !== null && effectiveParam !== '') {
        const expectedIcon = normalizeSwitchyardIcon(String(effectiveParam));
        return expectedIcon ? head.icon === expectedIcon : false;
      }
      const iconIdx =
        paramObj?.iconIdx ?? (typeof sensor === 'object' ? sensor.iconIdx : undefined);
      if (iconIdx !== undefined) {
        const expected = ITEM_ICON_FROM_INDEX[iconIdx];
        return expected ? head.icon === expected : false;
      }
      return false;
    }
    default:
      return false;
  }
}

export function resolveSwitchyardDockByToken(
  docks: readonly DockState[],
  token?: string
): DockState | undefined {
  if (!token || token.trim() === '' || token.trim() === '0') {
    return docks.find((d) => d.id === 'DOCK_A') ?? docks[0];
  }
  const upper = token.trim().toUpperCase();
  if (upper === 'A' || upper === 'DOCK_A' || upper === 'DOCK-A') {
    return docks.find((d) => d.id === 'DOCK_A') ?? docks[0];
  }
  if (upper === '1' || upper === 'B' || upper === 'DOCK_B' || upper === 'DOCK-B') {
    return docks.find((d) => d.id === 'DOCK_B') ?? docks[1];
  }
  if (upper === '2' || upper === 'C' || upper === 'DOCK_C' || upper === 'DOCK-C') {
    return docks.find((d) => d.id === 'DOCK_C') ?? docks[2];
  }
  const parsed = Number(upper);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return docks[parsed];
  }
  return undefined;
}

/**
 * Evaluates typed Switchyard value sensors ($itemWeight 0xA8, $itemColor 0xA9,
 * $dockQuota[i] 0xAA, $dockCount[i] 0xAB) aligned with interpreter.ts.
 * Returns `undefined` when `$itemWeight` or `$itemColor` is read on an empty queue
 * so unguarded reads trigger runtime TYPE_ERROR cleanly.
 */
export function readSwitchyardTypedSensor(
  sensor: string,
  state: SwitchyardState
): TypedValue | number | undefined {
  const head = state.queue[0];

  if (sensor === '$itemWeight' || sensor === 'itemWeight') {
    if (!head) return undefined;
    return head.weight ?? 1;
  }

  if (sensor === '$itemColor') {
    if (!head) return undefined;
    return { type: 'color', value: itemColorToPaletteColor(head.color) };
  }

  const quotaMatch = /^\$?dockQuota(?:\[([^\]]+)\])?$/.exec(sensor);
  if (quotaMatch) {
    const dock = resolveSwitchyardDockByToken(state.docks, quotaMatch[1]);
    return dock?.spec?.quota ?? dock?.quota ?? 0;
  }
  if (sensor === 'dockAQuota') {
    return resolveSwitchyardDockByToken(state.docks, 'A')?.spec?.quota ?? 0;
  }
  if (sensor === 'dockBQuota') {
    return resolveSwitchyardDockByToken(state.docks, 'B')?.spec?.quota ?? 0;
  }
  if (sensor === 'dockCQuota') {
    return resolveSwitchyardDockByToken(state.docks, 'C')?.spec?.quota ?? 0;
  }

  const countMatch = /^\$?dockCount(?:\[([^\]]+)\])?$/.exec(sensor);
  if (countMatch) {
    const dock = resolveSwitchyardDockByToken(state.docks, countMatch[1]);
    // Strictly delivered car count (never overloaded as weight sum)
    return dock?.items?.length ?? 0;
  }
  if (sensor === 'dockACount') {
    return resolveSwitchyardDockByToken(state.docks, 'A')?.items?.length ?? 0;
  }
  if (sensor === 'dockBCount') {
    return resolveSwitchyardDockByToken(state.docks, 'B')?.items?.length ?? 0;
  }
  if (sensor === 'dockCCount') {
    return resolveSwitchyardDockByToken(state.docks, 'C')?.items?.length ?? 0;
  }

  if (sensor === 'queueCount' || sensor === 'remainingCount' || sensor === '$queueCount') {
    return state.queue.length;
  }
  if (sensor === 'scrapCount' || sensor === '$scrapCount') {
    return state.scrapped.length;
  }

  return undefined;
}

export function readSwitchyardNumericSensor(sensor: string, state: SwitchyardState): number {
  const head = state.queue[0];
  if (sensor === '$itemColor') {
    return head ? (EXTENDED_COLOR_TO_PALETTE_IDX[head.color] ?? 0) : 0;
  }
  if (sensor === 'leftWeightSum' || sensor === '$leftWeightSum') {
    return computeSwitchyardScaleMetrics(state.docks).leftWeightSum;
  }
  if (sensor === 'rightWeightSum' || sensor === '$rightWeightSum') {
    return computeSwitchyardScaleMetrics(state.docks).rightWeightSum;
  }
  const typed = readSwitchyardTypedSensor(sensor, state);
  if (typeof typed === 'number') return typed;
  if (typed && typeof typed === 'object' && typed.type === 'number') return typed.value;
  return 0;
}

/**
 * Checks whether an item satisfies a dock's intrinsic acceptance criteria (ignoring capacity quota).
 */
function validateItemIntrinsicForDock(
  item: SwitchyardItem,
  effectiveSeq: number,
  dock: DockState,
  state: SwitchyardState
): { reason: string; detail: SwitchyardFailureDetail } | null {
  const spec = dock.spec;
  const dockId = dock.id;

  if (spec.expectedItems && spec.expectedItems.length > 0) {
    const matchesAnyExpected = spec.expectedItems.some(
      (exp) =>
        (exp.damaged === undefined || Boolean(item.damaged) === Boolean(exp.damaged)) &&
        (!exp.color || item.color === exp.color) &&
        (!exp.icon || item.icon === exp.icon) &&
        (exp.weight === undefined || (item.weight ?? 1) === exp.weight) &&
        (exp.seqNum === undefined || effectiveSeq === exp.seqNum)
    );
    if (!matchesAnyExpected) {
      const firstExp = spec.expectedItems[0];
      const hasDamagedMismatch =
        firstExp.damaged !== undefined && Boolean(item.damaged) !== Boolean(firstExp.damaged);
      const hasColorMismatch = Boolean(firstExp.color && item.color !== firstExp.color);
      const hasIconMismatch = Boolean(firstExp.icon && item.icon !== firstExp.icon);
      const hasWeightMismatch =
        firstExp.weight !== undefined && (item.weight ?? 1) !== firstExp.weight;
      return {
        reason: hasWeightMismatch ? 'WEIGHT_LIMIT_VIOLATED' : 'WRONG_DOCK',
        detail: {
          code: hasDamagedMismatch
            ? 'DAMAGED_REJECTED'
            : hasColorMismatch
            ? 'WRONG_COLOR'
            : hasIconMismatch
            ? 'WRONG_ICON'
            : hasWeightMismatch
            ? 'WEIGHT_MISMATCH'
            : 'PARITY_MISMATCH',
          dockId,
          ...(firstExp.color ? { expectedColor: firstExp.color, actualColor: item.color } : {}),
          ...(firstExp.icon ? { expectedIcon: firstExp.icon, actualIcon: item.icon } : {}),
          ...(firstExp.damaged !== undefined
            ? { expectedDamaged: Boolean(firstExp.damaged), actualDamaged: Boolean(item.damaged) }
            : {}),
          ...(firstExp.weight !== undefined
            ? { actualWeight: item.weight ?? 1, maxWeight: firstExp.weight }
            : {}),
        },
      };
    }
  }

  if (spec.rejectDamaged && item.damaged) {
    return {
      reason: 'WRONG_DOCK',
      detail: {
        code: 'DAMAGED_REJECTED',
        dockId,
        expectedDamaged: false,
        actualDamaged: true,
      },
    };
  }

  if (spec.acceptColor && item.color !== spec.acceptColor) {
    return {
      reason: 'WRONG_DOCK',
      detail: {
        code: 'WRONG_COLOR',
        dockId,
        expectedColor: spec.acceptColor,
        actualColor: item.color,
      },
    };
  }

  if (spec.acceptIcon && item.icon !== spec.acceptIcon) {
    return {
      reason: 'WRONG_DOCK',
      detail: {
        code: 'WRONG_ICON',
        dockId,
        expectedIcon: spec.acceptIcon,
        actualIcon: item.icon,
      },
    };
  }

  const weight = item.weight ?? 1;
  if (
    (spec.minWeight !== undefined && weight < spec.minWeight) ||
    (spec.maxWeight !== undefined && weight > spec.maxWeight)
  ) {
    return {
      reason: 'WEIGHT_LIMIT_VIOLATED',
      detail: {
        code: 'WEIGHT_MISMATCH',
        dockId,
        actualWeight: weight,
        ...(spec.minWeight !== undefined ? { minWeight: spec.minWeight } : {}),
        ...(spec.maxWeight !== undefined ? { maxWeight: spec.maxWeight } : {}),
      },
    };
  }

  // When scrapRule === 'damaged_or_overweight', overweight items (> scrapMaxWeight) must be scrapped
  // rather than parked in normal docks unless a dock explicitly accepts heavy items via minWeight/maxWeight.
  if (state.scrapRule === 'damaged_or_overweight') {
    const scrapMax = state.scrapMaxWeight ?? 20;
    const dockExplicitlyAllowsOverweight =
      (spec.maxWeight !== undefined && spec.maxWeight > scrapMax) ||
      (spec.minWeight !== undefined && spec.minWeight > scrapMax);
    if (!dockExplicitlyAllowsOverweight && weight > scrapMax) {
      return {
        reason: 'WEIGHT_LIMIT_VIOLATED',
        detail: {
          code: 'WEIGHT_MISMATCH',
          dockId,
          actualWeight: weight,
          maxWeight: scrapMax,
        },
      };
    }
  }

  if (spec.paritySlot !== undefined) {
    const expectedOdd = spec.paritySlot === 'odd';
    const actualOdd = Math.abs(effectiveSeq) % 2 === 1;
    if (expectedOdd !== actualOdd) {
      return {
        reason: 'PARITY_SLOT_VIOLATED',
        detail: {
          code: 'PARITY_MISMATCH',
          dockId,
          expectedParity: spec.paritySlot,
          actualSeqNum: effectiveSeq,
        },
      };
    }
  }

  return null;
}

function validateItemForDock(
  item: SwitchyardItem,
  dock: DockState,
  state: SwitchyardState,
  effectiveSeq: number
): { reason: string; detail: SwitchyardFailureDetail } | null {
  const spec = dock.spec;
  const dockId = dock.id;

  // Check capacity quota gate (`✓ FULL`) after basic damaged/color/icon checks or immediately on full bay
  const intrinsic = validateItemIntrinsicForDock(item, effectiveSeq, dock, state);
  if (
    intrinsic &&
    (intrinsic.detail.code === 'DAMAGED_REJECTED' ||
      intrinsic.detail.code === 'WRONG_COLOR' ||
      intrinsic.detail.code === 'WRONG_ICON')
  ) {
    return intrinsic;
  }

  if (spec.quota !== undefined && dock.items.length + 1 > spec.quota) {
    return {
      reason: 'DOCK_QUOTA_EXCEEDED',
      detail: {
        code: 'QUOTA_MISMATCH',
        dockId,
        quota: spec.quota,
        actualCount: dock.items.length + 1,
      },
    };
  }

  return intrinsic;
}

/**
 * Computes the expected target count for a dock with `spec.quota`:
 * normally `spec.quota`, or `Math.min(spec.quota, eligibleCountInInitialStream)` when a stream
 * contains fewer eligible items than the dock's quota capacity (e.g. cmp.9 Variant #3).
 */
function getRequiredQuotaCountForDock(dock: DockState, state?: SwitchyardState): number | undefined {
  const quota = dock.spec.quota;
  if (quota === undefined) return undefined;
  if (quota <= 0 || !state) return Math.max(0, quota);

  const sourceItems =
    state.initialQueue && state.initialQueue.length > 0
      ? state.initialQueue
      : [...state.docks.flatMap((d) => d.items), ...state.scrapped];

  if (sourceItems.length === 0) return quota;

  let eligibleCount = 0;
  for (let i = 0; i < sourceItems.length; i++) {
    const it = sourceItems[i];
    const seq = it.seqNum ?? i + 1;
    if (validateItemIntrinsicForDock(it, seq, dock, state) === null) {
      eligibleCount++;
    }
  }

  return Math.min(quota, eligibleCount);
}

function findUnsatisfiedQuotaDock(
  docks: readonly DockState[],
  state?: SwitchyardState
): { dock: DockState; required: number } | null {
  for (const d of docks) {
    if (d.spec.quota === undefined) continue;
    if (d.items.length > d.spec.quota) {
      return { dock: d, required: d.spec.quota };
    }
    const req = getRequiredQuotaCountForDock(d, state) ?? d.spec.quota;
    if (d.items.length !== req) {
      return { dock: d, required: req };
    }
  }
  return null;
}

function areAllDocksSatisfied(docks: readonly DockState[], state?: SwitchyardState): boolean {
  return findUnsatisfiedQuotaDock(docks, state) === null;
}

function evaluateScaleBalanceFailure(
  docks: readonly DockState[],
  state: SwitchyardState
): { reason: string; detail: SwitchyardFailureDetail } | null {
  if (state.mode !== 'balance_scale') return null;
  const { leftWeightSum, rightWeightSum } = computeSwitchyardScaleMetrics(docks);
  const tolerance = state.balanceTolerance ?? 0;
  if (Math.abs(leftWeightSum - rightWeightSum) > tolerance) {
    return {
      reason: 'SCALE_IMBALANCED',
      detail: {
        code: 'BALANCE_MISMATCH',
        leftWeightSum,
        rightWeightSum,
        balanceTolerance: tolerance,
      },
    };
  }
  return null;
}

function getSwitchSnapshot(switches: readonly SwitchState[]): {
  switchCount: number;
  switchADir?: SwitchDirection;
  switchBDir?: SwitchDirection;
  switchCDir?: SwitchDirection;
} {
  const switchCount = switches.length;
  const swA = switches.find((s) => s.id === 'A') ?? switches[0];
  const swB = switchCount >= 2 ? switches.find((s) => s.id === 'B') ?? switches[1] : undefined;
  const swC = switchCount >= 3 ? switches.find((s) => s.id === 'C') ?? switches[2] : undefined;
  return {
    switchCount,
    ...(swA ? { switchADir: swA.direction } : {}),
    ...(swB ? { switchBDir: swB.direction } : {}),
    ...(swC ? { switchCDir: swC.direction } : {}),
  };
}

function nextAnimSeq(state: SwitchyardState, nextStep: number): number {
  return Math.max(nextStep, (state.lastAnimEvent?.seq ?? 0) + 1);
}

function executeScrapSingleItem(state: SwitchyardState): SwitchyardState {
  const nextStep = state.stepCount + 1;
  const nextSeq = nextAnimSeq(state, nextStep);
  const swSnap = getSwitchSnapshot(state.switches);
  const activeStatus: SimulationStatus = state.status === 'IDLE' ? 'IDLE' : 'RUNNING';

  if (state.queue.length === 0) {
    return {
      ...state,
      status: 'COLLISION',
      stepCount: nextStep,
      lastFailureReason: 'NO_ITEM_AT_SCANNER',
      lastFailureDetail: { code: 'QUEUE_EMPTY', dockId: 'SCRAP' },
      lastRoutedDock: 'SCRAP',
      lastAnimEvent: {
        stepId: nextStep,
        seq: nextSeq,
        type: 'COLLISION',
        targetDock: 'SCRAP',
        toDock: 'SCRAP',
        ...swSnap,
      },
    };
  }

  const rule = state.scrapRule ?? 'damaged_only';
  const [item, ...remainingQueue] = state.queue;

  if (rule === 'none') {
    return {
      ...state,
      status: 'COLLISION',
      stepCount: nextStep,
      lastFailureReason: 'SCRAP_DISALLOWED',
      lastFailureDetail: { code: 'GOOD_SCRAPPED', dockId: 'SCRAP', actualDamaged: Boolean(item.damaged) },
      lastRoutedDock: 'SCRAP',
      lastAnimEvent: {
        stepId: nextStep,
        seq: nextSeq,
        type: 'COLLISION',
        item,
        dispatchedItem: item,
        targetDock: 'SCRAP',
        toDock: 'SCRAP',
        ...swSnap,
      },
    };
  }

  if (rule === 'damaged_only' && !item.damaged) {
    return {
      ...state,
      status: 'COLLISION',
      stepCount: nextStep,
      lastFailureReason: 'GOOD_ITEM_SCRAPPED',
      lastFailureDetail: {
        code: 'GOOD_SCRAPPED',
        dockId: 'SCRAP',
        expectedDamaged: true,
        actualDamaged: false,
      },
      lastRoutedDock: 'SCRAP',
      lastAnimEvent: {
        stepId: nextStep,
        seq: nextSeq,
        type: 'COLLISION',
        item,
        dispatchedItem: item,
        targetDock: 'SCRAP',
        toDock: 'SCRAP',
        ...swSnap,
      },
    };
  }

  if (rule === 'damaged_or_overweight') {
    const maxWeight = state.scrapMaxWeight ?? 20;
    const weight = item.weight ?? 1;
    if (!item.damaged && weight <= maxWeight) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'GOOD_ITEM_SCRAPPED',
        lastFailureDetail: {
          code: 'GOOD_SCRAPPED',
          dockId: 'SCRAP',
          expectedDamaged: true,
          actualDamaged: false,
          actualWeight: weight,
          maxWeight,
        },
        lastRoutedDock: 'SCRAP',
        lastAnimEvent: {
          stepId: nextStep,
          seq: nextSeq,
          type: 'COLLISION',
          item,
          dispatchedItem: item,
          targetDock: 'SCRAP',
          toDock: 'SCRAP',
          ...swSnap,
        },
      };
    }
  }

  const nextScrap = [...state.scrapped, item];
  const nextDispatched = (state.dispatchedCount ?? 0) + 1;
  const queueDone = remainingQueue.length === 0;
  const quotaFailure = queueDone ? findUnsatisfiedQuotaDock(state.docks, state) : null;
  const balanceFailure =
    queueDone && !quotaFailure ? evaluateScaleBalanceFailure(state.docks, state) : null;
  const allOk = !quotaFailure && !balanceFailure;

  return {
    ...state,
    queue: remainingQueue,
    scrapped: nextScrap,
    scrap: nextScrap,
    dispatchedCount: nextDispatched,
    status: queueDone ? (allOk ? 'SUCCESS' : 'COLLISION') : activeStatus,
    stepCount: nextStep,
    lastRoutedDock: 'SCRAP',
    lastFailureReason: quotaFailure
      ? 'DOCK_QUOTA_EXCEEDED'
      : balanceFailure
      ? balanceFailure.reason
      : undefined,
    lastFailureDetail: quotaFailure
      ? {
          code: 'QUOTA_MISMATCH',
          dockId: quotaFailure.dock.id,
          quota: quotaFailure.required,
          actualCount: quotaFailure.dock.items.length,
        }
      : balanceFailure
      ? balanceFailure.detail
      : undefined,
    lastAnimEvent: {
      stepId: nextStep,
      seq: nextSeq,
      type: 'SCRAP_ITEM',
      item,
      dispatchedItem: item,
      targetDock: 'SCRAP',
      toDock: 'SCRAP',
      targetSlotIndex: nextScrap.length - 1,
      ...swSnap,
    },
  };
}

/**
 * Applies a single atomic Switchyard instruction tick.
 * `tickInterpreter` calls this once per repeat sub-tick, so `SEND_NEXT` and
 * `SCRAP_ITEM` route strictly ONE item per call (fixing the legacy repeatCount double-consume bug).
 */
export function applySwitchyardAction(
  actionType: string,
  state: SwitchyardState,
  options?: { repeatCount?: number; params?: Record<string, any> }
): SwitchyardState {
  if (
    state.status === 'COLLISION' ||
    state.status === 'STEP_LIMIT' ||
    state.status === 'STACK_OVERFLOW' ||
    state.status === 'MATH_ERROR' ||
    state.status === 'TYPE_ERROR' ||
    state.status === 'DEADLOCK'
  ) {
    return state;
  }

  const nextStep = state.stepCount + 1;
  const nextSeq = nextAnimSeq(state, nextStep);
  const activeStatus: SimulationStatus = state.status === 'IDLE' ? 'IDLE' : 'RUNNING';

  if (actionType === 'SWITCH_LEFT' || actionType === 'SWITCH_RIGHT') {
    const rawJunction = String(options?.params?.junction ?? options?.params?.switchId ?? 'A')
      .trim()
      .toUpperCase();
    const junction: SwitchJunctionId =
      rawJunction === 'C' ? 'C' : rawJunction === 'B' ? 'B' : 'A';
    const dir: SwitchDirection = actionType === 'SWITCH_LEFT' ? 'LEFT' : 'RIGHT';

    if (state.switches.length === 0) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'MISSING_SWITCH',
        lastFailureDetail: { code: 'INVALID_SWITCH' },
        lastAnimEvent: {
          stepId: nextStep,
          seq: nextSeq,
          type: 'COLLISION',
          junction,
          ...getSwitchSnapshot(state.switches),
        },
      };
    }

    const switchExists = state.switches.some((s) => s.id === junction);
    if (!switchExists) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: junction === 'B' ? 'MISSING_SWITCH_B' : 'MISSING_SWITCH',
        lastFailureDetail: { code: 'INVALID_SWITCH' },
        lastAnimEvent: {
          stepId: nextStep,
          seq: nextSeq,
          type: 'COLLISION',
          junction,
          ...getSwitchSnapshot(state.switches),
        },
      };
    }

    const nextSwitches = state.switches.map((s) =>
      s.id === junction ? { ...s, direction: dir } : s
    );

    return {
      ...state,
      switches: nextSwitches,
      status: activeStatus,
      stepCount: nextStep,
      lastFailureReason: undefined,
      lastFailureDetail: undefined,
      lastAnimEvent: {
        stepId: nextStep,
        seq: nextSeq,
        type: actionType,
        junction,
        direction: dir,
        ...getSwitchSnapshot(nextSwitches),
      },
    };
  }

  if (actionType === 'SCRAP_ITEM') {
    return executeScrapSingleItem(state);
  }

  if (actionType === 'SEND_NEXT') {
    const swSnap = getSwitchSnapshot(state.switches);

    if (state.queue.length === 0) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'NO_ITEM_AT_SCANNER',
        lastFailureDetail: { code: 'QUEUE_EMPTY' },
        lastAnimEvent: { stepId: nextStep, seq: nextSeq, type: 'COLLISION', ...swSnap },
      };
    }

    const { targetDock, switchesTraversed } = resolveSwitchyardRoute(state.switches, state.docks);

    if (targetDock === 'SCRAP') {
      return executeScrapSingleItem(state);
    }

    const dockObj = state.docks.find((d) => d.id === targetDock);
    if (!dockObj) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'WRONG_DOCK',
        lastFailureDetail: { code: 'INVALID_SWITCH', dockId: targetDock },
        lastRoutedDock: targetDock,
        lastAnimEvent: {
          stepId: nextStep,
          seq: nextSeq,
          type: 'COLLISION',
          targetDock,
          toDock: targetDock,
          switchesTraversed,
          ...swSnap,
        },
      };
    }

    const [item, ...remainingQueue] = state.queue;
    const effectiveSeq = item.seqNum ?? (state.dispatchedCount ?? 0) + 1;
    const mismatch = validateItemForDock(item, dockObj, state, effectiveSeq);
    if (mismatch) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: mismatch.reason,
        lastFailureDetail: mismatch.detail,
        lastRoutedDock: targetDock,
        lastAnimEvent: {
          stepId: nextStep,
          seq: nextSeq,
          type: 'COLLISION',
          item,
          dispatchedItem: item,
          targetDock,
          toDock: targetDock,
          switchesTraversed,
          ...swSnap,
        },
      };
    }

    const landedSlotIndex = dockObj.items.length;
    const nextDocks = state.docks.map((d) => {
      if (d.id !== targetDock) return d;
      const updated = [...d.items, item];
      return { ...d, items: updated, received: updated };
    });
    const nextDispatched = (state.dispatchedCount ?? 0) + 1;
    const scaleMetrics =
      state.mode === 'balance_scale' ? computeSwitchyardScaleMetrics(nextDocks) : undefined;
    const queueDone = remainingQueue.length === 0;
    const quotaFailure = queueDone ? findUnsatisfiedQuotaDock(nextDocks, state) : null;
    const balanceFailure =
      queueDone && !quotaFailure ? evaluateScaleBalanceFailure(nextDocks, state) : null;
    const allOk = !quotaFailure && !balanceFailure;

    return {
      ...state,
      queue: remainingQueue,
      docks: nextDocks,
      dispatchedCount: nextDispatched,
      ...(scaleMetrics ? scaleMetrics : {}),
      status: queueDone ? (allOk ? 'SUCCESS' : 'COLLISION') : activeStatus,
      stepCount: nextStep,
      lastRoutedDock: targetDock,
      lastFailureReason: quotaFailure
        ? 'DOCK_QUOTA_EXCEEDED'
        : balanceFailure
        ? balanceFailure.reason
        : undefined,
      lastFailureDetail: quotaFailure
        ? {
            code: 'QUOTA_MISMATCH',
            dockId: quotaFailure.dock.id,
            quota: quotaFailure.required,
            actualCount: quotaFailure.dock.items.length,
          }
        : balanceFailure
        ? balanceFailure.detail
        : undefined,
      lastAnimEvent: {
        stepId: nextStep,
        seq: nextSeq,
        type: 'SEND_NEXT',
        item,
        dispatchedItem: item,
        targetDock,
        toDock: targetDock,
        targetSlotIndex: landedSlotIndex,
        switchesTraversed,
        ...swSnap,
      },
    };
  }

  return state;
}

/**
 * Computes structured failure reason & detail for a collided or incomplete Switchyard state,
 * falling back cleanly to STRANDED_CARS, QUOTA_MISMATCH, or BALANCE_MISMATCH.
 */
export function deriveSwitchyardFailureDiagnostic(
  state: SwitchyardState
): { reason?: string; detail?: SwitchyardFailureDetail } {
  if (state.lastFailureReason || state.lastFailureDetail) {
    return {
      reason: state.lastFailureReason,
      detail: state.lastFailureDetail,
    };
  }
  if (state.queue.length > 0) {
    return {
      reason: 'UNSORTED_ITEMS_REMAIN',
      detail: {
        code: 'STRANDED_CARS',
        remainingCount: state.queue.length,
      },
    };
  }
  const quotaFailure = findUnsatisfiedQuotaDock(state.docks, state);
  if (quotaFailure) {
    return {
      reason: 'DOCK_QUOTA_EXCEEDED',
      detail: {
        code: 'QUOTA_MISMATCH',
        dockId: quotaFailure.dock.id,
        quota: quotaFailure.required,
        actualCount: quotaFailure.dock.items.length,
      },
    };
  }
  const balanceFailure = evaluateScaleBalanceFailure(state.docks, state);
  if (balanceFailure) {
    return balanceFailure;
  }
  return {};
}

export function evaluateSwitchyardCompletion(state: SwitchyardState): SimulationStatus {
  if (
    state.status === 'COLLISION' ||
    state.status === 'STEP_LIMIT' ||
    state.status === 'STACK_OVERFLOW' ||
    state.status === 'MATH_ERROR' ||
    state.status === 'TYPE_ERROR' ||
    state.status === 'DEADLOCK'
  ) {
    if (state.status === 'COLLISION' && !state.lastFailureReason && !Object.isFrozen(state)) {
      const diag = deriveSwitchyardFailureDiagnostic(state);
      if (diag.reason) state.lastFailureReason = diag.reason;
      if (diag.detail) state.lastFailureDetail = diag.detail;
    }
    return state.status;
  }

  const docksOk = areAllDocksSatisfied(state.docks, state);
  const balanceFailure = docksOk ? evaluateScaleBalanceFailure(state.docks, state) : null;

  if (state.queue.length === 0 && docksOk && !balanceFailure) {
    return 'SUCCESS';
  }

  if (!Object.isFrozen(state)) {
    if (state.queue.length > 0) {
      state.lastFailureReason = 'UNSORTED_ITEMS_REMAIN';
      state.lastFailureDetail = {
        code: 'STRANDED_CARS',
        remainingCount: state.queue.length,
      };
    } else if (!state.lastFailureReason) {
      const quotaFailure = findUnsatisfiedQuotaDock(state.docks, state);
      if (quotaFailure) {
        state.lastFailureReason = 'DOCK_QUOTA_EXCEEDED';
        state.lastFailureDetail = {
          code: 'QUOTA_MISMATCH',
          dockId: quotaFailure.dock.id,
          quota: quotaFailure.required,
          actualCount: quotaFailure.dock.items.length,
        };
      } else if (balanceFailure) {
        state.lastFailureReason = balanceFailure.reason;
        state.lastFailureDetail = balanceFailure.detail;
      }
    }
  }

  return 'COLLISION';
}
