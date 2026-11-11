import React from 'react';
import { SimulationEnvironment, SimPaletteItem, SimActionResult } from '../../engine/simulation/types';
import { GridState, Direction } from '../../types';
import {
  areGoalSwitchesSatisfied,
  cloneLockedGates,
  cloneWorldItems,
  executeRobotAction,
  hasInteractiveWorldElements,
  resetGridInteractiveState,
  RobotGridActionType,
  syncWorldSwitchesAndGates,
} from '../../engine/physics';
import { GridCanvas } from '../../components/GridCanvas';
import { GridToolbarTools } from './components/GridToolbarTools';
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

export const gridSimulationEnvironment: SimulationEnvironment<GridState> = {
  id: 'grid',
  name: 'Grid World',
  icon: <span className="text-xl">🤖</span>,

  paletteItems: GRID_PALETTE_ITEMS,

  createInitialState: createDefaultGridState,

  resetState: (state: GridState): GridState => resetGridInteractiveState(state),

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

    const res = executeRobotAction(actionType as RobotGridActionType, state);

    const nextState: GridState = {
      ...state,
      robot: {
        ...state.robot,
        x: res.newX,
        y: res.newY,
        dir: res.newDir as Direction,
        ...(hasWorld ? { carriedItem: res.carriedItem ?? null } : {}),
      },
      flags: res.flags,
      trace: res.trace,
      ...(res.bridgedWaterCells !== undefined ? { bridgedWaterCells: res.bridgedWaterCells } : {}),
      ...(res.lockedGates !== undefined ? { lockedGates: res.lockedGates } : {}),
      ...(capturedInitialGates !== undefined ? { initialLockedGates: capturedInitialGates } : {}),
      ...(res.floorSwitches !== undefined ? { floorSwitches: res.floorSwitches } : {}),
      ...(res.worldItems !== undefined ? { worldItems: res.worldItems } : {}),
      ...(capturedInitialItems !== undefined ? { initialWorldItems: capturedInitialItems } : {}),
      ...(hasWorld ? { lastInteractionFeedback: res.interactionFeedback ?? null } : {}),
      status: res.isCollision ? 'COLLISION' : res.isSuccess ? 'SUCCESS' : 'RUNNING',
    };

    return {
      nextState,
      status: nextState.status,
      isCollision: res.isCollision,
      isSuccess: res.isSuccess,
    };
  },

  evaluateCompletion: (state: GridState) => {
    const onGoal = state.flags.some(
      (f) => f.isGoal && f.x === state.robot.x && f.y === state.robot.y
    );
    const nonGoalFlags = state.flags.filter((f) => !f.isGoal);
    const allCollected = nonGoalFlags.every((f) => f.collected);
    const synced = syncWorldSwitchesAndGates(
      state.floorSwitches,
      state.lockedGates,
      state.worldItems
    );
    const switchesOk = areGoalSwitchesSatisfied(synced.floorSwitches, synced.lockedGates);
    return onGoal && allCollected && switchesOk ? 'SUCCESS' : 'IDLE';
  },

  Renderer: GridCanvas,

  ToolsComponent: GridToolbarTools,
};
