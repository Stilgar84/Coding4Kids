import { SimulationEnvironment, SimPaletteItem, SimActionResult } from '../../engine/simulation/types';
import { GridState, Direction } from '../../types';
import { executeRobotAction } from '../../engine/physics';
import { GridCanvas } from '../../components/GridCanvas';
import { GridToolbarTools } from './components/GridToolbarTools';
import { ArrowUp, ArrowDown, CornerUpLeft, CornerUpRight } from 'lucide-react';

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

  resetState: (state: GridState): GridState => ({
    ...state,
    robot: {
      ...state.robot,
      x: state.robot.initialX,
      y: state.robot.initialY,
      dir: state.robot.initialDir,
    },
    flags: state.flags.map((f) => ({ ...f, collected: false })),
    trace: [{ x: state.robot.initialX, y: state.robot.initialY }],
    status: 'IDLE',
  }),

  executeAction: (
    actionType: string,
    state: GridState
  ): SimActionResult<GridState> => {
    const res = executeRobotAction(
      actionType as 'MOVE_FWD' | 'MOVE_BACK' | 'TURN_LEFT' | 'TURN_RIGHT',
      state
    );

    const nextState: GridState = {
      ...state,
      robot: {
        ...state.robot,
        x: res.newX,
        y: res.newY,
        dir: res.newDir as Direction,
      },
      flags: res.flags,
      trace: res.trace,
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
    const onGoal = state.flags.some((f) => f.isGoal && f.x === state.robot.x && f.y === state.robot.y);
    const nonGoalFlags = state.flags.filter((f) => !f.isGoal);
    const allCollected = nonGoalFlags.every((f) => f.collected);
    return onGoal && allCollected ? 'SUCCESS' : 'IDLE';
  },

  Renderer: GridCanvas,

  ToolsComponent: GridToolbarTools,
};
