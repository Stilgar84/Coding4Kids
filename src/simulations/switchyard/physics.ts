import {
  DockSpec,
  DockState,
  SwitchDirection,
  SwitchyardItem,
  SwitchyardState,
  ITEM_COLOR_INDEX,
  ITEM_ICON_INDEX,
} from './types';

// ─── Factory helpers ───────────────────────────────────────────────────────

function makeDockState(spec: DockSpec): DockState {
  return { spec, items: [], mismatch: false };
}

export function createInitialSwitchyardState(overrides?: Partial<SwitchyardState>): SwitchyardState {
  const queue = overrides?.initialQueue ?? overrides?.queue ?? [];
  const dockSpecs = overrides?.initialDockSpecs ?? (overrides?.docks?.map((d) => d.spec) ?? [
    { id: 'DOCK_A' },
    { id: 'DOCK_B' },
  ]);
  const switchDirs = overrides?.initialSwitchDirections ??
    (overrides?.switches?.map((s) => s.direction) ?? ['LEFT']);

  return {
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
    ...overrides,
    queue: queue.map((item: SwitchyardItem) => ({ ...item })),
    initialQueue: queue.map((item: SwitchyardItem) => ({ ...item })),
    scrapped: overrides?.scrapped ? [...overrides.scrapped] : [],
    docks: dockSpecs.map((spec) => makeDockState(spec)),
    initialDockSpecs: dockSpecs.map((spec) => ({ ...spec })),
    switches: switchDirs.map((dir, i) => ({
      id: i === 0 ? 'A' : 'B',
      direction: dir,
    })),
    initialSwitchDirections: [...switchDirs],
  };
}

export function resetSwitchyardState(state: SwitchyardState): SwitchyardState {
  return {
    ...state,
    queue: state.initialQueue.map((item) => ({ ...item })),
    scrapped: [],
    docks: state.initialDockSpecs.map((spec) => makeDockState({ ...spec })),
    switches: state.initialSwitchDirections.map((dir, i) => ({
      id: i === 0 ? 'A' : 'B',
      direction: dir,
    })),
    lastFailureReason: null,
    status: 'IDLE',
    stepCount: 0,
  };
}

// ─── Sensor evaluation ────────────────────────────────────────────────────

export function evaluateSwitchyardSensor(
  sensor: { type: string; colorIdx?: number; iconIdx?: number; stationCode?: number } | string,
  state: SwitchyardState,
  param?: string
): boolean {
  const item = state.queue[0] ?? null;
  const sensorType = typeof sensor === 'string' ? sensor : sensor?.type;
  let colorIdx = typeof sensor === 'object' && sensor.colorIdx !== undefined ? sensor.colorIdx : undefined;
  let iconIdx = typeof sensor === 'object' && sensor.iconIdx !== undefined ? sensor.iconIdx : undefined;

  if (param !== undefined && colorIdx === undefined && iconIdx === undefined) {
    const upper = param.toUpperCase();
    if (upper in ITEM_COLOR_INDEX) {
      colorIdx = ITEM_COLOR_INDEX[upper as keyof typeof ITEM_COLOR_INDEX];
    } else if (upper in ITEM_ICON_INDEX) {
      iconIdx = ITEM_ICON_INDEX[upper as keyof typeof ITEM_ICON_INDEX];
    } else {
      const parsed = parseInt(param, 10);
      if (!isNaN(parsed)) colorIdx = parsed;
    }
  }

  switch (sensorType) {
    case 'hasNextItem':
      return state.queue.length > 0;
    case 'itemDamaged':
      return item !== null && item.damaged;
    case 'itemColor':
      return item !== null && ITEM_COLOR_INDEX[item.color] === (colorIdx ?? 0);
    case 'itemIcon':
      return item !== null && ITEM_ICON_INDEX[item.icon] === (iconIdx ?? 0);
    default:
      return false;
  }
}

// ─── Action helpers ───────────────────────────────────────────────────────

function routeCurrentItem(state: SwitchyardState): SwitchyardState {
  const item = state.queue[0];
  if (!item) {
    return { ...state, lastFailureReason: 'NO_ITEM_AT_SCANNER', status: 'COLLISION', stepCount: state.stepCount + 1 };
  }

  // Determine destination dock based on switch chain.
  // Switch A: LEFT → DOCK_A, RIGHT → DOCK_B (or further switch B).
  // Switch B (if present): LEFT → DOCK_B, RIGHT → DOCK_C.
  const switchA = state.switches[0];
  const switchB = state.switches[1] ?? null;

  let dockIndex: number;
  if (!switchB) {
    // 1-switch map: LEFT → dock 0, RIGHT → dock 1
    dockIndex = switchA.direction === 'LEFT' ? 0 : 1;
  } else {
    // 2-switch map
    if (switchA.direction === 'LEFT') {
      dockIndex = 0; // DOCK_A
    } else {
      dockIndex = switchB.direction === 'LEFT' ? 1 : 2; // DOCK_B or DOCK_C
    }
  }

  const dock = state.docks[dockIndex];
  if (!dock) {
    return { ...state, lastFailureReason: 'WRONG_DOCK', status: 'COLLISION', stepCount: state.stepCount + 1 };
  }

  // Check acceptance rules
  const spec = dock.spec;
  let accepted = true;
  if (spec.rejectDamaged && item.damaged) accepted = false;
  if (spec.acceptColor && item.color !== spec.acceptColor) accepted = false;
  if (spec.acceptIcon && item.icon !== spec.acceptIcon) accepted = false;

  if (!accepted) {
    const newDocks = state.docks.map((d, i) =>
      i === dockIndex ? { ...d, mismatch: true } : d
    );
    return {
      ...state,
      queue: state.queue.slice(1),
      docks: newDocks,
      lastFailureReason: 'WRONG_DOCK',
      status: 'COLLISION',
      stepCount: state.stepCount + 1,
    };
  }

  const newDock: DockState = {
    ...dock,
    items: [...dock.items, item],
  };
  return {
    ...state,
    queue: state.queue.slice(1),
    docks: state.docks.map((d, i) => (i === dockIndex ? newDock : d)),
    stepCount: state.stepCount + 1,
  };
}

export function applySwitchyardAction(
  actionType: string,
  state: SwitchyardState,
  options?: { repeatCount?: number; params?: Record<string, any> }
): SwitchyardState {
  const params = options?.params ?? {};
  let next = { ...state };

  switch (actionType) {
    case 'SWITCH_LEFT': {
      const junctionId = params.junction ?? 'A';
      next = {
        ...next,
        switches: next.switches.map((sw) =>
          sw.id === junctionId ? { ...sw, direction: 'LEFT' as SwitchDirection } : sw
        ),
        stepCount: next.stepCount + 1,
      };
      break;
    }
    case 'SWITCH_RIGHT': {
      const junctionId = params.junction ?? 'A';
      next = {
        ...next,
        switches: next.switches.map((sw) =>
          sw.id === junctionId ? { ...sw, direction: 'RIGHT' as SwitchDirection } : sw
        ),
        stepCount: next.stepCount + 1,
      };
      break;
    }
    case 'SEND_NEXT': {
      const count = typeof options?.repeatCount === 'number' && options.repeatCount > 1
        ? options.repeatCount
        : 1;
      for (let i = 0; i < count; i++) {
        next = routeCurrentItem(next);
        if (next.status === 'COLLISION') return next;
      }
      break;
    }
    case 'SCRAP_ITEM': {
      const item = next.queue[0];
      if (!item) {
        return { ...next, lastFailureReason: 'NO_ITEM_AT_SCANNER', status: 'COLLISION', stepCount: next.stepCount + 1 };
      }
      next = {
        ...next,
        queue: next.queue.slice(1),
        scrapped: [...next.scrapped, item],
        stepCount: next.stepCount + 1,
      };
      break;
    }
    default:
      break;
  }

  return next;
}

/** Called when the program finishes running (call stack empty). */
export function evaluateSwitchyardCompletion(state: SwitchyardState): import('../../types').SimulationStatus {
  if (state.status === 'COLLISION') return 'COLLISION';
  // Fail if unsorted items remain in queue
  if (state.queue.length > 0) return 'COLLISION';
  // Fail if any dock has a mismatch indicator
  if (state.docks.some((d) => d.mismatch)) return 'COLLISION';
  return 'SUCCESS';
}
