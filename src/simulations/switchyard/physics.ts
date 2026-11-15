import {
  CurriculumSwitchyardDefinition,
  SwitchyardDockDef,
  SwitchyardItemDef,
  SwitchyardSwitchDef,
} from '../../data/curriculum/types';
import { SimulationStatus } from '../../types';
import {
  DockExpectedItemSpec,
  DockId,
  DockSpec,
  DockState,
  EXTENDED_ITEM_COLORS,
  ITEM_COLOR_FROM_INDEX,
  ITEM_ICON_FROM_INDEX,
  ItemColor,
  ItemIcon,
  SwitchDirection,
  SwitchState,
  SwitchyardFailureDetail,
  SwitchyardItem,
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

export function normalizeDockId(raw?: string | null): Exclude<DockId, 'SCRAP'> {
  const upper = String(raw ?? 'A').trim().toUpperCase();
  if (upper === 'B' || upper === 'DOCK_B' || upper === 'DOCK-B') return 'DOCK_B';
  if (upper === 'C' || upper === 'DOCK_C' || upper === 'DOCK-C') return 'DOCK_C';
  return 'DOCK_A';
}

export function normalizeSwitchTarget(
  raw?: string | null,
  preferSwitchB = false
): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const upper = raw.trim().toUpperCase();
  if (upper === 'SWITCH_B' || upper === 'SW_B' || upper === 'SWITCH-B') return 'SWITCH_B';
  if (preferSwitchB && upper === 'B') return 'SWITCH_B';
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

function normalizeQueueItem(raw: SwitchyardItem | SwitchyardItemDef | any, idx: number): SwitchyardItem {
  const color = normalizeSwitchyardColor(raw?.color) ?? 'RED';
  const icon = normalizeSwitchyardIcon(raw?.icon) ?? 'CRATE';
  return {
    id: typeof raw?.id === 'string' && raw.id.length > 0 ? raw.id : `item_${idx + 1}`,
    color,
    icon,
    damaged: Boolean(raw?.damaged),
    ...(typeof raw?.weight === 'number' ? { weight: raw.weight } : {}),
  };
}

function normalizeExpectedItem(raw: any): DockExpectedItemSpec {
  return {
    ...(raw?.color ? { color: normalizeSwitchyardColor(raw.color) } : {}),
    ...(raw?.icon ? { icon: normalizeSwitchyardIcon(raw.icon) } : {}),
    ...(raw?.damaged !== undefined ? { damaged: Boolean(raw.damaged) } : {}),
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

  const quota = typeof (src as any).quota === 'number' ? (src as any).quota : undefined;
  const minWeight = typeof (src as any).minWeight === 'number' ? (src as any).minWeight : undefined;
  const maxWeight = typeof (src as any).maxWeight === 'number' ? (src as any).maxWeight : undefined;

  return {
    dockId,
    ...(acceptColor ? { acceptColor } : {}),
    ...(acceptIcon ? { acceptIcon } : {}),
    rejectDamaged,
    ...(expectedItems ? { expectedItems } : {}),
    ...(quota !== undefined ? { quota } : {}),
    ...(minWeight !== undefined ? { minWeight } : {}),
    ...(maxWeight !== undefined ? { maxWeight } : {}),
  };
}

function normalizeSwitchState(
  raw: SwitchState | SwitchyardSwitchDef | any,
  idx: number,
  hasSwitchB = false
): SwitchState {
  const id: 'A' | 'B' =
    String(raw?.id ?? (idx === 1 ? 'B' : 'A')).trim().toUpperCase() === 'B' ? 'B' : 'A';
  const initDir: SwitchDirection =
    String(raw?.initialDirection ?? raw?.direction ?? 'LEFT').trim().toUpperCase() === 'RIGHT'
      ? 'RIGHT'
      : 'LEFT';
  const dir: SwitchDirection =
    String(raw?.direction ?? initDir).trim().toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
  const preferSwitchB = id === 'A' && hasSwitchB;
  const leftTarget = normalizeSwitchTarget(raw?.leftTarget, preferSwitchB);
  const rightTarget = normalizeSwitchTarget(raw?.rightTarget, preferSwitchB);
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
  };
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

  // 1. Switches (supports 0, 1, or 2 switches)
  let switches: SwitchState[];
  if (Array.isArray(raw.switches)) {
    const sliced = raw.switches.slice(0, 2);
    const hasSwitchB = sliced.some(
      (sw: any, idx: number) => String(sw?.id ?? (idx === 1 ? 'B' : 'A')).trim().toUpperCase() === 'B'
    );
    switches = sliced.map((sw: any, idx: number) => normalizeSwitchState(sw, idx, hasSwitchB));
  } else if (Array.isArray(raw.initialSwitchDirections)) {
    switches = raw.initialSwitchDirections.slice(0, 2).map((dir: SwitchDirection, idx: number) => ({
      id: idx === 0 ? 'A' : 'B',
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
  const rawScrapSource = raw.scrapRules ?? raw.scrapRule;
  const rawScrapToken = Array.isArray(rawScrapSource)
    ? rawScrapSource[0]
    : typeof rawScrapSource === 'object' && rawScrapSource !== null
    ? rawScrapSource.kind ?? rawScrapSource.mode
    : rawScrapSource;
  const normalizedScrapToken =
    typeof rawScrapToken === 'string' ? rawScrapToken.trim().toLowerCase() : undefined;

  let scrapRule: SwitchyardScrapRule = 'damaged_only';
  if (
    normalizedScrapToken === 'any' ||
    normalizedScrapToken === 'none' ||
    normalizedScrapToken === 'damaged_only'
  ) {
    scrapRule = normalizedScrapToken;
  } else if (raw.scrapChute?.expectedDamagedOnly === false) {
    scrapRule = 'any';
  }

  const scrapExpectedDamagedOnly =
    raw.scrapChute?.expectedDamagedOnly !== undefined
      ? Boolean(raw.scrapChute.expectedDamagedOnly)
      : raw.scrapExpectedDamagedOnly !== undefined
      ? Boolean(raw.scrapExpectedDamagedOnly)
      : scrapRule !== 'any';

  const rawScrapped = Array.isArray(raw.scrapped)
    ? raw.scrapped
    : Array.isArray(raw.scrap)
    ? raw.scrap
    : [];
  const scrapped = rawScrapped.map(normalizeQueueItem);

  const validStatuses: SimulationStatus[] = [
    'IDLE',
    'RUNNING',
    'PAUSED',
    'SUCCESS',
    'COLLISION',
    'STEP_LIMIT',
  ];
  const status: SimulationStatus = validStatuses.includes(raw.status) ? raw.status : 'IDLE';

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
    'scrapExpectedDamagedOnly',
    'scrapChute',
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
    scrapExpectedDamagedOnly,
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

  return {
    queue: cloneQueue(initialQueue),
    initialQueue,
    docks: baseSpecs.map((spec) => makeDockState(spec)),
    initialDockSpecs: baseSpecs,
    switches: (state.switches ?? []).map((s) => ({
      ...s,
      direction: s.initialDirection,
    })),
    scrapped: [],
    scrap: [],
    scrapRule: state.scrapRule ?? 'damaged_only',
    scrapExpectedDamagedOnly: state.scrapExpectedDamagedOnly ?? state.scrapRule !== 'any',
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
 * supporting 0, 1, or 2 switch topologies and explicit leftTarget/rightTarget overrides.
 */
export function resolveSwitchyardRoute(
  switches: readonly SwitchState[],
  docks: readonly DockState[]
): { targetDock: DockId; switchesTraversed: Array<'A' | 'B'> } {
  if (switches.length === 0) {
    return {
      targetDock: docks[0]?.id ?? 'DOCK_A',
      switchesTraversed: [],
    };
  }

  const swA = switches.find((s) => s.id === 'A') ?? switches[0];
  const swB = switches.length >= 2 ? switches.find((s) => s.id === 'B') ?? switches[1] : undefined;

  const explicitA =
    swA.direction === 'LEFT'
      ? normalizeSwitchTarget(swA.leftTarget, Boolean(swB))
      : normalizeSwitchTarget(swA.rightTarget, Boolean(swB));

  const defaultA = swA.direction === 'LEFT' ? 'DOCK_A' : swB ? 'SWITCH_B' : 'DOCK_B';
  const firstHop = explicitA ?? defaultA;

  if (firstHop === 'SWITCH_B') {
    if (swB) {
      const explicitB =
        swB.direction === 'LEFT'
          ? normalizeSwitchTarget(swB.leftTarget)
          : normalizeSwitchTarget(swB.rightTarget);
      const defaultB = swB.direction === 'LEFT' ? 'DOCK_B' : 'DOCK_C';
      return {
        targetDock: (explicitB ?? defaultB) as DockId,
        switchesTraversed: ['A', 'B'],
      };
    }
    return { targetDock: 'DOCK_B', switchesTraversed: ['A'] };
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

export function readSwitchyardNumericSensor(sensor: string, state: SwitchyardState): number {
  const head = state.queue[0];
  switch (sensor) {
    case 'itemWeight':
    case '$itemWeight':
      return head ? (head.weight ?? 1) : 0;
    case 'queueCount':
    case 'remainingCount':
    case '$queueCount':
      return state.queue.length;
    case 'dockACount':
      return state.docks.find((d) => d.id === 'DOCK_A')?.items.length ?? 0;
    case 'dockBCount':
      return state.docks.find((d) => d.id === 'DOCK_B')?.items.length ?? 0;
    case 'dockCCount':
      return state.docks.find((d) => d.id === 'DOCK_C')?.items.length ?? 0;
    case 'scrapCount':
      return state.scrapped.length;
    default:
      return 0;
  }
}

function validateItemForDock(
  item: SwitchyardItem,
  dock: DockState
): { reason: string; detail: SwitchyardFailureDetail } | null {
  const spec = dock.spec;
  const dockId = dock.id;

  if (spec.expectedItems && spec.expectedItems.length > 0) {
    const matchesAnyExpected = spec.expectedItems.some(
      (exp) =>
        (exp.damaged === undefined || Boolean(item.damaged) === Boolean(exp.damaged)) &&
        (!exp.color || item.color === exp.color) &&
        (!exp.icon || item.icon === exp.icon)
    );
    if (!matchesAnyExpected) {
      const firstExp = spec.expectedItems[0];
      const hasDamagedMismatch =
        firstExp.damaged !== undefined && Boolean(item.damaged) !== Boolean(firstExp.damaged);
      const hasColorMismatch = Boolean(firstExp.color && item.color !== firstExp.color);
      return {
        reason: 'WRONG_DOCK',
        detail: {
          code: hasDamagedMismatch
            ? 'DAMAGED_REJECTED'
            : hasColorMismatch
            ? 'WRONG_COLOR'
            : 'WRONG_ICON',
          dockId,
          ...(firstExp.color ? { expectedColor: firstExp.color, actualColor: item.color } : {}),
          ...(firstExp.icon ? { expectedIcon: firstExp.icon, actualIcon: item.icon } : {}),
          ...(firstExp.damaged !== undefined
            ? { expectedDamaged: Boolean(firstExp.damaged), actualDamaged: Boolean(item.damaged) }
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

  if (spec.quota !== undefined && dock.items.length + 1 > spec.quota) {
    return {
      reason: 'DOCK_QUOTA_EXCEEDED',
      detail: { code: 'QUOTA_MISMATCH', dockId },
    };
  }

  const weight = item.weight ?? 1;
  if (
    (spec.minWeight !== undefined && weight < spec.minWeight) ||
    (spec.maxWeight !== undefined && weight > spec.maxWeight)
  ) {
    return {
      reason: 'WEIGHT_LIMIT_VIOLATED',
      detail: { code: 'WEIGHT_MISMATCH', dockId },
    };
  }

  return null;
}

function areAllDocksSatisfied(docks: readonly DockState[]): boolean {
  return docks.every((d) => {
    if (d.spec.quota !== undefined && d.items.length !== d.spec.quota) return false;
    return true;
  });
}

function executeScrapSingleItem(state: SwitchyardState): SwitchyardState {
  const nextStep = state.stepCount + 1;
  const activeStatus: SimulationStatus = state.status === 'IDLE' ? 'IDLE' : 'RUNNING';

  if (state.queue.length === 0) {
    return {
      ...state,
      status: 'COLLISION',
      stepCount: nextStep,
      lastFailureReason: 'NO_ITEM_AT_SCANNER',
      lastFailureDetail: { code: 'QUEUE_EMPTY', dockId: 'SCRAP' },
      lastRoutedDock: 'SCRAP',
      lastAnimEvent: { stepId: nextStep, type: 'COLLISION', targetDock: 'SCRAP' },
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
      lastAnimEvent: { stepId: nextStep, type: 'COLLISION', item, targetDock: 'SCRAP' },
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
      lastAnimEvent: { stepId: nextStep, type: 'COLLISION', item, targetDock: 'SCRAP' },
    };
  }

  const nextScrap = [...state.scrapped, item];
  const queueDone = remainingQueue.length === 0;
  const docksOk = !queueDone || areAllDocksSatisfied(state.docks);

  return {
    ...state,
    queue: remainingQueue,
    scrapped: nextScrap,
    scrap: nextScrap,
    status: queueDone ? (docksOk ? 'SUCCESS' : 'COLLISION') : activeStatus,
    stepCount: nextStep,
    lastRoutedDock: 'SCRAP',
    lastFailureReason: queueDone && !docksOk ? 'DOCK_QUOTA_EXCEEDED' : undefined,
    lastFailureDetail: queueDone && !docksOk ? { code: 'QUOTA_MISMATCH' } : undefined,
    lastAnimEvent: {
      stepId: nextStep,
      type: 'SCRAP_ITEM',
      item,
      targetDock: 'SCRAP',
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
  if (state.status === 'COLLISION' || state.status === 'SUCCESS' || state.status === 'STEP_LIMIT') {
    return state;
  }

  const nextStep = state.stepCount + 1;
  const activeStatus: SimulationStatus = state.status === 'IDLE' ? 'IDLE' : 'RUNNING';

  if (actionType === 'SWITCH_LEFT' || actionType === 'SWITCH_RIGHT') {
    const rawJunction = options?.params?.junction ?? options?.params?.switchId ?? 'A';
    const junction: 'A' | 'B' = String(rawJunction).trim().toUpperCase() === 'B' ? 'B' : 'A';
    const dir: SwitchDirection = actionType === 'SWITCH_LEFT' ? 'LEFT' : 'RIGHT';

    if (state.switches.length === 0) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'MISSING_SWITCH',
        lastFailureDetail: { code: 'INVALID_SWITCH' },
        lastAnimEvent: { stepId: nextStep, type: 'COLLISION', junction },
      };
    }

    const switchExists = state.switches.some((s) => s.id === junction);
    if (!switchExists) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'MISSING_SWITCH_B',
        lastFailureDetail: { code: 'INVALID_SWITCH' },
        lastAnimEvent: { stepId: nextStep, type: 'COLLISION', junction },
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
        type: actionType,
        junction,
        direction: dir,
      },
    };
  }

  if (actionType === 'SCRAP_ITEM') {
    return executeScrapSingleItem(state);
  }

  if (actionType === 'SEND_NEXT') {
    if (state.queue.length === 0) {
      return {
        ...state,
        status: 'COLLISION',
        stepCount: nextStep,
        lastFailureReason: 'NO_ITEM_AT_SCANNER',
        lastFailureDetail: { code: 'QUEUE_EMPTY' },
        lastAnimEvent: { stepId: nextStep, type: 'COLLISION' },
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
        lastAnimEvent: { stepId: nextStep, type: 'COLLISION', targetDock, switchesTraversed },
      };
    }

    const [item, ...remainingQueue] = state.queue;
    const mismatch = validateItemForDock(item, dockObj);
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
          type: 'COLLISION',
          item,
          targetDock,
          switchesTraversed,
        },
      };
    }

    const nextDocks = state.docks.map((d) => {
      if (d.id !== targetDock) return d;
      const updated = [...d.items, item];
      return { ...d, items: updated, received: updated };
    });
    const queueDone = remainingQueue.length === 0;
    const docksOk = !queueDone || areAllDocksSatisfied(nextDocks);

    return {
      ...state,
      queue: remainingQueue,
      docks: nextDocks,
      status: queueDone ? (docksOk ? 'SUCCESS' : 'COLLISION') : activeStatus,
      stepCount: nextStep,
      lastRoutedDock: targetDock,
      lastFailureReason: queueDone && !docksOk ? 'DOCK_QUOTA_EXCEEDED' : undefined,
      lastFailureDetail: queueDone && !docksOk ? { code: 'QUOTA_MISMATCH' } : undefined,
      lastAnimEvent: {
        stepId: nextStep,
        type: 'SEND_NEXT',
        item,
        targetDock,
        switchesTraversed,
      },
    };
  }

  return state;
}

/**
 * Computes structured failure reason & detail for a collided or incomplete Switchyard state,
 * falling back cleanly to STRANDED_CARS when the program ended with unsorted items remaining.
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
  if (!areAllDocksSatisfied(state.docks)) {
    return {
      reason: 'DOCK_QUOTA_EXCEEDED',
      detail: { code: 'QUOTA_MISMATCH' },
    };
  }
  return {};
}

export function evaluateSwitchyardCompletion(state: SwitchyardState): SimulationStatus {
  if (state.status === 'COLLISION' || state.status === 'STEP_LIMIT') {
    if (state.status === 'COLLISION' && !state.lastFailureReason && !Object.isFrozen(state)) {
      const diag = deriveSwitchyardFailureDiagnostic(state);
      if (diag.reason) state.lastFailureReason = diag.reason;
      if (diag.detail) state.lastFailureDetail = diag.detail;
    }
    return state.status;
  }

  if (state.queue.length === 0 && areAllDocksSatisfied(state.docks)) {
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
      state.lastFailureReason = 'DOCK_QUOTA_EXCEEDED';
      state.lastFailureDetail = { code: 'QUOTA_MISMATCH' };
    }
  }

  return 'COLLISION';
}
