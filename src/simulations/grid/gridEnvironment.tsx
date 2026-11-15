import React from 'react';
import {
  SimulationEnvironment,
  SimulationRendererProps,
  SimPaletteItem,
  SimActionResult,
} from '../../engine/simulation/types';
import { GridState, Direction, FloorSwitch, LockedGate, WorldItem } from '../../types';
import {
  areGoalSwitchesSatisfied,
  cloneLockedGates,
  cloneWorldItems,
  executeRobotAction,
  hasInteractiveWorldElements,
  isFloorSwitchRequiredForGoal,
  isSwitchLinkedToGate,
  resetGridInteractiveState,
  RobotGridActionType,
  syncWorldSwitchesAndGates,
} from '../../engine/physics';
import { GridCanvas } from '../../components/GridCanvas';
import { GridToolbarTools } from './components/GridToolbarTools';
import { evaluateGridSensor, readGridSensor } from './sensors';
import { ArrowUp, ArrowDown, CornerUpLeft, CornerUpRight, Hand } from 'lucide-react';

const PickUpIcon: React.FC<{ className?: string; isActive?: boolean }> = ({
  className,
  isActive,
}) => {
  const strokeCls = isActive ? 'text-slate-950' : 'text-white';
  return (
    <div className="relative flex items-center justify-center">
      <Hand
        className={
          className || `w-6 h-6 md:w-7 md:h-7 ${strokeCls} stroke-[2.5]`
        }
      />
      <ArrowUp
        className={`w-3.5 h-3.5 md:w-4 md:h-4 absolute -top-1 -right-1.5 ${
          isActive ? 'text-slate-950' : 'text-amber-300'
        } stroke-[3]`}
      />
    </div>
  );
};

const UseDropIcon: React.FC<{ className?: string; isActive?: boolean }> = ({
  className,
  isActive,
}) => {
  const mainStroke = isActive ? '#020617' : '#ffffff';
  const accentStroke = isActive ? '#0f172a' : '#fde68a';
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={className || 'w-6 h-6 md:w-7 md:h-7'}
      aria-hidden="true"
    >
      {/* Key / gadget emblem at top-left */}
      <circle cx="9.5" cy="9" r="4" stroke={accentStroke} strokeWidth="2.4" />
      <path
        d="M12.5 11.8L18.5 17.8M16 15.3L14.2 17.1M18 17.3L16.2 19.1"
        stroke={accentStroke}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      {/* Contextual downward place / use arrow */}
      <path
        d="M21 5V14M21 14L17.8 10.8M21 14L24.2 10.8"
        stroke={mainStroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Target floor pad bar */}
      <path
        d="M6 23H22"
        stroke={mainStroke}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

const GRID_PALETTE_ITEMS: SimPaletteItem[] = [
  {
    id: 'move-fwd',
    actionType: 'MOVE_FWD',
    name: 'Move Forward',
    category: 'motion',
    icon: ({ className, isActive }) => (
      <ArrowUp className={className || `w-8 h-8 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-sky-600 hover:bg-sky-500',
    borderClass: 'border-sky-400',
    supportsRepeat: true,
  },
  {
    id: 'move-back',
    actionType: 'MOVE_BACK',
    name: 'Move Backward',
    category: 'motion',
    icon: ({ className, isActive }) => (
      <ArrowDown className={className || `w-8 h-8 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-sky-700 hover:bg-sky-600',
    borderClass: 'border-sky-500',
    supportsRepeat: true,
  },
  {
    id: 'turn-left',
    actionType: 'TURN_LEFT',
    name: 'Turn Left',
    category: 'motion',
    icon: ({ className, isActive }) => (
      <CornerUpLeft className={className || `w-8 h-8 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },
  {
    id: 'turn-right',
    actionType: 'TURN_RIGHT',
    name: 'Turn Right',
    category: 'motion',
    icon: ({ className, isActive }) => (
      <CornerUpRight className={className || `w-8 h-8 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },
  {
    id: 'pick-up',
    actionType: 'PICK_UP',
    name: 'Pick Up',
    category: 'action',
    icon: ({ className, isActive }) => (
      <PickUpIcon className={className} isActive={isActive} />
    ),
    bgClass: 'bg-teal-600 hover:bg-teal-500',
    borderClass: 'border-teal-400',
    supportsRepeat: true,
  },
  {
    id: 'use-drop',
    actionType: 'USE_DROP',
    name: 'Use / Drop',
    category: 'action',
    icon: ({ className, isActive }) => (
      <UseDropIcon className={className} isActive={isActive} />
    ),
    bgClass: 'bg-emerald-600 hover:bg-emerald-500',
    borderClass: 'border-emerald-400',
    supportsRepeat: true,
  },
];

export function createDefaultGridState(): GridState {
  return {
    width: 5,
    height: 5,
    robot: {
      x: 0,
      y: 2,
      dir: 'EAST',
      initialX: 0,
      initialY: 2,
      initialDir: 'EAST',
    },
    barriers: [],
    flags: [{ id: 'goal_default', x: 4, y: 2, isGoal: true, order: 1, collected: false }],
    trace: [{ x: 0, y: 2 }],
    status: 'IDLE',
    showTrace: true,
    fitToView: false,
  };
}

type MultiCountFloorSwitch = FloorSwitch & { requiredCount?: number };

const GRID_TERMINAL_ERROR_STATUSES = new Set<string>([
  'COLLISION',
  'TYPE_ERROR',
  'MATH_ERROR',
  'STACK_OVERFLOW',
  'STEP_LIMIT',
  'DEADLOCK',
]);

function countCratesAt(worldItems: readonly WorldItem[] | undefined, x: number, y: number): number {
  if (!worldItems) return 0;
  return worldItems
    .filter((it) => it.type === 'crate' && it.x === x && it.y === y)
    .reduce((sum, it) => sum + (it.count ?? 1), 0);
}

function syncMultiCountSwitchesAndGates(
  floorSwitches: readonly FloorSwitch[] | undefined,
  lockedGates: readonly LockedGate[] | undefined,
  worldItems: readonly WorldItem[] | undefined,
  robotPos: { x: number; y: number }
): {
  floorSwitches: FloorSwitch[] | undefined;
  lockedGates: LockedGate[] | undefined;
} {
  const base = syncWorldSwitchesAndGates(floorSwitches, lockedGates, worldItems, robotPos);
  if (!base.floorSwitches || !base.floorSwitches.some((sw) => typeof (sw as MultiCountFloorSwitch).requiredCount === 'number')) {
    return base;
  }

  const nextSwitches = base.floorSwitches.map((sw) => {
    const reqCount = (sw as MultiCountFloorSwitch).requiredCount;
    if (typeof reqCount !== 'number') return sw;
    const crateCount = countCratesAt(worldItems, sw.x, sw.y);
    return {
      ...sw,
      active: crateCount === reqCount,
    };
  });

  const nextGates = base.lockedGates
    ? base.lockedGates.map((gate) => {
        if (gate.unlockedByKey) {
          return { ...gate, unlocked: true, unlockedByKey: true };
        }
        const linked = nextSwitches.filter((sw) => isSwitchLinkedToGate(sw, gate));
        if (linked.length > 0) {
          return { ...gate, unlocked: linked.every((sw) => Boolean(sw.active)) };
        }
        return gate;
      })
    : undefined;

  return {
    floorSwitches: nextSwitches,
    lockedGates: nextGates,
  };
}

export const gridSimulationEnvironment: SimulationEnvironment<GridState> = {
  id: 'grid',
  name: 'Grid World',
  icon: <span className="text-xl">🤖</span>,

  paletteItems: GRID_PALETTE_ITEMS,

  createInitialState: createDefaultGridState,

  resetState: (state: GridState): GridState => {
    const reset = resetGridInteractiveState(state);
    if (reset.floorSwitches?.some((sw) => typeof (sw as MultiCountFloorSwitch).requiredCount === 'number')) {
      const synced = syncMultiCountSwitchesAndGates(
        reset.floorSwitches,
        reset.lockedGates,
        reset.worldItems,
        { x: reset.robot.x, y: reset.robot.y }
      );
      return {
        ...reset,
        ...(synced.floorSwitches ? { floorSwitches: synced.floorSwitches } : {}),
        ...(synced.lockedGates ? { lockedGates: synced.lockedGates } : {}),
      };
    }
    return reset;
  },

  executeAction: (
    actionType: string,
    state: GridState
  ): SimActionResult<GridState> => {
    const hasWorld =
      hasInteractiveWorldElements(state) ||
      state.robot.carriedItem !== undefined ||
      actionType === 'PICK_UP' ||
      actionType === 'USE_DROP';

    const capturedInitialItems =
      state.initialWorldItems ??
      (state.worldItems !== undefined ? cloneWorldItems(state.worldItems) : undefined);
    const capturedInitialGates =
      state.initialLockedGates ??
      (state.lockedGates !== undefined ? cloneLockedGates(state.lockedGates, true) : undefined);

    // Multi-crate FloorSwitch (`requiredCount`) stacking support on `USE_DROP`
    const carried = state.robot.carriedItem;
    const carriedCount = state.robot.carriedCount ?? (carried ? carried.count ?? 1 : 0);
    const switchHere = state.floorSwitches?.find(
      (sw) => sw.x === state.robot.x && sw.y === state.robot.y
    ) as MultiCountFloorSwitch | undefined;
    const reqCountHere = switchHere?.requiredCount;

    if (
      actionType === 'USE_DROP' &&
      carried?.type === 'crate' &&
      carriedCount >= 1 &&
      typeof reqCountHere === 'number'
    ) {
      const currentItems = cloneWorldItems(state.worldItems ?? []);
      const existingIdx = currentItems.findIndex(
        (it) => it.type === 'crate' && it.x === state.robot.x && it.y === state.robot.y
      );
      if (existingIdx >= 0) {
        const existingTotal = countCratesAt(currentItems, state.robot.x, state.robot.y);
        const nextFeedbackSeq = (state.lastInteractionFeedback?.seq ?? 0) + 1;
        if (existingTotal + 1 > reqCountHere) {
          const collidedState: GridState = {
            ...state,
            ...(capturedInitialGates !== undefined ? { initialLockedGates: capturedInitialGates } : {}),
            ...(capturedInitialItems !== undefined ? { initialWorldItems: capturedInitialItems } : {}),
            lastInteractionFeedback: {
              kind: 'occupied',
              message: 'Switch crate limit exceeded.',
              seq: nextFeedbackSeq,
            },
            status: 'COLLISION',
          };
          return {
            nextState: collidedState,
            status: 'COLLISION',
            isCollision: true,
            isSuccess: false,
          };
        }

        const nextCarriedCount = carriedCount > 1 ? carriedCount - 1 : 0;
        const nextCarried = nextCarriedCount > 0 ? { ...carried, count: nextCarriedCount } : null;
        currentItems[existingIdx] = {
          ...currentItems[existingIdx],
          count: (currentItems[existingIdx].count ?? 1) + 1,
        };
        const synced = syncMultiCountSwitchesAndGates(
          state.floorSwitches,
          state.lockedGates,
          currentItems,
          { x: state.robot.x, y: state.robot.y }
        );
        const stackedState: GridState = {
          ...state,
          robot: {
            ...state.robot,
            carriedItem: nextCarried,
            carriedCount: nextCarriedCount,
          },
          worldItems: currentItems,
          ...(capturedInitialItems !== undefined ? { initialWorldItems: capturedInitialItems } : {}),
          ...(synced.floorSwitches !== undefined ? { floorSwitches: synced.floorSwitches } : {}),
          ...(synced.lockedGates !== undefined ? { lockedGates: synced.lockedGates } : {}),
          ...(capturedInitialGates !== undefined ? { initialLockedGates: capturedInitialGates } : {}),
          lastInteractionFeedback: null,
          status: 'RUNNING',
        };
        return {
          nextState: stackedState,
          status: 'RUNNING',
          isCollision: false,
          isSuccess: false,
        };
      }
    }

    const res = executeRobotAction(actionType as RobotGridActionType, state);

    const prevVisited = (state as GridState & { visitedCells?: { x: number; y: number }[] })
      .visitedCells;
    let nextVisited: { x: number; y: number }[] | undefined;
    if (prevVisited !== undefined) {
      nextVisited = prevVisited.map((c) => ({ ...c }));
      const seedX = state.robot.initialX;
      const seedY = state.robot.initialY;
      if (!nextVisited.some((c) => c.x === seedX && c.y === seedY)) {
        nextVisited.unshift({ x: seedX, y: seedY });
      }
      if (!res.isCollision && !nextVisited.some((c) => c.x === res.newX && c.y === res.newY)) {
        nextVisited.push({ x: res.newX, y: res.newY });
      }
    }

    const effectiveSwitchesSource = res.floorSwitches ?? state.floorSwitches;
    const effectiveGatesSource = res.lockedGates ?? state.lockedGates;
    const effectiveItemsSource = res.worldItems ?? state.worldItems;
    const multiSynced = effectiveSwitchesSource?.some(
      (sw) => typeof (sw as MultiCountFloorSwitch).requiredCount === 'number'
    )
      ? syncMultiCountSwitchesAndGates(
          effectiveSwitchesSource,
          effectiveGatesSource,
          effectiveItemsSource,
          { x: res.newX, y: res.newY }
        )
      : { floorSwitches: res.floorSwitches, lockedGates: res.lockedGates };

    const nextState: GridState = {
      ...state,
      robot: {
        ...state.robot,
        x: res.newX,
        y: res.newY,
        dir: res.newDir as Direction,
        ...(hasWorld
          ? {
              carriedItem: res.carriedItem ?? null,
              carriedCount: res.carriedCount ?? (res.carriedItem ? res.carriedItem.count ?? 1 : 0),
            }
          : {}),
      },
      flags: res.flags,
      trace: res.trace,
      ...(nextVisited !== undefined ? { visitedCells: nextVisited } : {}),
      ...(res.bridgedWaterCells !== undefined ? { bridgedWaterCells: res.bridgedWaterCells } : {}),
      ...(multiSynced.lockedGates !== undefined ? { lockedGates: multiSynced.lockedGates } : {}),
      ...(capturedInitialGates !== undefined ? { initialLockedGates: capturedInitialGates } : {}),
      ...(multiSynced.floorSwitches !== undefined ? { floorSwitches: multiSynced.floorSwitches } : {}),
      ...(res.worldItems !== undefined ? { worldItems: res.worldItems } : {}),
      ...(capturedInitialItems !== undefined ? { initialWorldItems: capturedInitialItems } : {}),
      ...(hasWorld ? { lastInteractionFeedback: res.interactionFeedback ?? null } : {}),
      // End-of-program Goal evaluation: mid-program Goal pass-through keeps RUNNING so remaining blocks execute.
      status: res.isCollision ? 'COLLISION' : 'RUNNING',
    };

    return {
      nextState,
      status: nextState.status,
      isCollision: res.isCollision,
      isSuccess: false,
    };
  },

  sensors: [
    { id: '$tileDial', label: 'Tile Dial', icon: '🔢', shortLabel: 'dial' },
    { id: '$x', label: 'Robot X', icon: '📍', shortLabel: 'x' },
    { id: '$y', label: 'Robot Y', icon: '📍', shortLabel: 'y' },
    { id: '$heading', label: 'Heading', icon: '🧭', shortLabel: 'dir' },
  ],

  readSensor: (sensorId: string, state: GridState): number => {
    return readGridSensor(sensorId, state);
  },

  evaluateSensor: (sensor: any, state: GridState, param?: string): boolean => {
    return evaluateGridSensor(sensor, state, param);
  },

  evaluateCompletion: (state: GridState) => {
    if (GRID_TERMINAL_ERROR_STATUSES.has(state.status as string)) {
      return 'IDLE';
    }
    const onGoal = state.flags.some(
      (f) => f.isGoal && f.x === state.robot.x && f.y === state.robot.y
    );
    const nonGoalFlags = state.flags.filter((f) => !f.isGoal);
    const allCollected = nonGoalFlags.every((f) => f.collected);
    const synced = syncMultiCountSwitchesAndGates(
      state.floorSwitches,
      state.lockedGates,
      state.worldItems,
      { x: state.robot.x, y: state.robot.y }
    );
    const switchesOk = areGoalSwitchesSatisfied(synced.floorSwitches, synced.lockedGates);
    const multiCountSwitchesOk = (synced.floorSwitches ?? []).every((sw) => {
      const reqCount = (sw as MultiCountFloorSwitch).requiredCount;
      if (typeof reqCount !== 'number') return true;
      if (!isFloorSwitchRequiredForGoal(sw, synced.lockedGates)) return true;
      return countCratesAt(state.worldItems, sw.x, sw.y) === reqCount;
    });
    const allItemsCollectedOk =
      !state.requireAllItemsCollected || (state.worldItems?.length ?? 0) === 0;
    const emptyBackpackOk =
      !state.requireEmptyBackpackAtGoal ||
      (!state.robot.carriedItem && (state.robot.carriedCount ?? 0) === 0);
    return (
      onGoal &&
      allCollected &&
      switchesOk &&
      multiCountSwitchesOk &&
      allItemsCollectedOk &&
      emptyBackpackOk
    )
      ? 'SUCCESS'
      : 'IDLE';
  },

  Renderer: ({
    state,
    runtimeStatus,
    runtimeVariables,
    activeBlockId,
    activeScope,
  }: SimulationRendererProps<GridState>) => (
    <GridCanvas
      state={state}
      runtimeStatus={runtimeStatus}
      runtimeVariables={runtimeVariables}
      activeBlockId={activeBlockId}
      activeScope={activeScope}
    />
  ),

  ToolsComponent: GridToolbarTools,
};
