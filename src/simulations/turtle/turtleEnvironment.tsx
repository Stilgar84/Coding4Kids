import { SimulationEnvironment, SimPaletteItem, SimActionResult } from '../../engine/simulation/types';
import { TurtleState } from './types';
import {
  moveTurtleForward,
  moveTurtleBackward,
  turnTurtle,
  arcTurtle,
  DEFAULT_STEP_DISTANCE,
} from './physics';
import { TurtleCanvas } from './components/TurtleCanvas';
import { TurtleToolbarTools } from './components/TurtleToolbarTools';
import {
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RotateCw,
  PenTool,
  Slash,
} from 'lucide-react';

export function createInitialTurtleState(): TurtleState {
  return {
    robot: {
      x: 0,
      y: 0,
      heading: 0, // 0 = North
    },
    penDown: true,
    penColor: '#0f172a', // Black default
    penWidth: 6, // Twice as wide default pen
    paths: [],
    status: 'IDLE',
    pan: { x: 0, y: 0 },
    zoom: 1,
    fitToView: false,
    computedBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
  };
}

const TURTLE_PALETTE_ITEMS: SimPaletteItem[] = [
  // Movement
  {
    id: 'turtle-forward',
    actionType: 'FORWARD',
    name: 'Move Forward',
    category: 'motion',
    icon: ({ className, isActive }) => (
      <ArrowUp className={className || `w-7 h-7 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-sky-600 hover:bg-sky-500',
    borderClass: 'border-sky-400',
    supportsRepeat: true,
  },
  {
    id: 'turtle-backward',
    actionType: 'BACKWARD',
    name: 'Move Backward',
    category: 'motion',
    icon: ({ className, isActive }) => (
      <ArrowDown className={className || `w-7 h-7 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-sky-700 hover:bg-sky-600',
    borderClass: 'border-sky-500',
    supportsRepeat: true,
  },

  // Turn Left 30°
  {
    id: 'turtle-turn-left-30',
    actionType: 'TURN_LEFT',
    name: 'Turn Left 30°',
    category: 'motion',
    params: { angle: 30 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center leading-none">
        <RotateCcw className={`w-5 h-5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
        <span className={`text-[10px] font-black mt-0.5 ${isActive ? 'text-slate-950' : 'text-amber-200'}`}>30°</span>
      </div>
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },

  // Turn Left 45°
  {
    id: 'turtle-turn-left-45',
    actionType: 'TURN_LEFT',
    name: 'Turn Left 45°',
    category: 'motion',
    params: { angle: 45 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center leading-none">
        <RotateCcw className={`w-5 h-5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
        <span className={`text-[10px] font-black mt-0.5 ${isActive ? 'text-slate-950' : 'text-amber-200'}`}>45°</span>
      </div>
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },

  // Turn Right 30°
  {
    id: 'turtle-turn-right-30',
    actionType: 'TURN_RIGHT',
    name: 'Turn Right 30°',
    category: 'motion',
    params: { angle: 30 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center leading-none">
        <RotateCw className={`w-5 h-5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
        <span className={`text-[10px] font-black mt-0.5 ${isActive ? 'text-slate-950' : 'text-amber-200'}`}>30°</span>
      </div>
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },

  // Turn Right 45°
  {
    id: 'turtle-turn-right-45',
    actionType: 'TURN_RIGHT',
    name: 'Turn Right 45°',
    category: 'motion',
    params: { angle: 45 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center leading-none">
        <RotateCw className={`w-5 h-5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
        <span className={`text-[10px] font-black mt-0.5 ${isActive ? 'text-slate-950' : 'text-amber-200'}`}>45°</span>
      </div>
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },

  // Arc Left
  {
    id: 'turtle-arc-left',
    actionType: 'ARC_LEFT',
    name: 'Arc Left',
    category: 'motion',
    params: { radius: 50, angle: 90 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center leading-none">
        <svg className={`w-6 h-6 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`} viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
          <path d="M 19 20 A 15 15 0 0 0 4 5" />
          <polyline points="4 10 4 5 9 5" />
        </svg>
        <span className={`text-[9px] font-black ${isActive ? 'text-slate-950' : 'text-indigo-200'}`}>Arc L</span>
      </div>
    ),
    bgClass: 'bg-indigo-600 hover:bg-indigo-500',
    borderClass: 'border-indigo-400',
    supportsRepeat: true,
  },

  // Arc Right
  {
    id: 'turtle-arc-right',
    actionType: 'ARC_RIGHT',
    name: 'Arc Right',
    category: 'motion',
    params: { radius: 50, angle: 90 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center leading-none">
        <svg className={`w-6 h-6 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`} viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
          <path d="M 5 20 A 15 15 0 0 1 20 5" />
          <polyline points="20 10 20 5 15 5" />
        </svg>
        <span className={`text-[9px] font-black ${isActive ? 'text-slate-950' : 'text-indigo-200'}`}>Arc R</span>
      </div>
    ),
    bgClass: 'bg-indigo-600 hover:bg-indigo-500',
    borderClass: 'border-indigo-400',
    supportsRepeat: true,
  },

  // Pen Up
  {
    id: 'turtle-pen-up',
    actionType: 'PEN_UP',
    name: 'Pen Up',
    category: 'pen',
    icon: ({ isActive }) => (
      <div className="relative flex items-center justify-center">
        <PenTool className={`w-6 h-6 ${isActive ? 'text-slate-950' : 'text-teal-200'}`} />
        <Slash className="w-7 h-7 text-red-400 stroke-[2.5] absolute -top-0.5 -left-0.5" />
      </div>
    ),
    bgClass: 'bg-teal-700 hover:bg-teal-600',
    borderClass: 'border-teal-400',
    supportsRepeat: false,
  },

  // Pen Down
  {
    id: 'turtle-pen-down',
    actionType: 'PEN_DOWN',
    name: 'Pen Down',
    category: 'pen',
    icon: ({ isActive }) => (
      <PenTool className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-teal-100 stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-teal-600 hover:bg-teal-500',
    borderClass: 'border-teal-300',
    supportsRepeat: false,
  },

  // Pen Color: Black
  {
    id: 'turtle-pen-color-black',
    actionType: 'SET_PEN_COLOR',
    name: 'Black Pen',
    category: 'pen',
    params: { color: '#0f172a' },
    icon: () => (
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="w-5 h-5 rounded-full bg-slate-950 border-2 border-white shadow-sm" />
        <span className="text-[9px] font-bold text-slate-200 uppercase">Black</span>
      </div>
    ),
    bgClass: 'bg-slate-800 hover:bg-slate-700',
    borderClass: 'border-slate-500',
    supportsRepeat: false,
  },

  // Pen Color: Red
  {
    id: 'turtle-pen-color-red',
    actionType: 'SET_PEN_COLOR',
    name: 'Red Pen',
    category: 'pen',
    params: { color: '#ef4444' },
    icon: () => (
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-sm" />
        <span className="text-[9px] font-bold text-red-200 uppercase">Red</span>
      </div>
    ),
    bgClass: 'bg-red-800 hover:bg-red-700',
    borderClass: 'border-red-500',
    supportsRepeat: false,
  },

  // Pen Color: Blue
  {
    id: 'turtle-pen-color-blue',
    actionType: 'SET_PEN_COLOR',
    name: 'Blue Pen',
    category: 'pen',
    params: { color: '#3b82f6' },
    icon: () => (
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
        <span className="text-[9px] font-bold text-blue-200 uppercase">Blue</span>
      </div>
    ),
    bgClass: 'bg-blue-800 hover:bg-blue-700',
    borderClass: 'border-blue-500',
    supportsRepeat: false,
  },

  // Pen Color: Green
  {
    id: 'turtle-pen-color-green',
    actionType: 'SET_PEN_COLOR',
    name: 'Green Pen',
    category: 'pen',
    params: { color: '#22c55e' },
    icon: () => (
      <div className="flex flex-col items-center justify-center gap-1">
        <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow-sm" />
        <span className="text-[9px] font-bold text-green-200 uppercase">Green</span>
      </div>
    ),
    bgClass: 'bg-emerald-800 hover:bg-emerald-700',
    borderClass: 'border-emerald-500',
    supportsRepeat: false,
  },
];

export const turtleSimulationEnvironment: SimulationEnvironment<TurtleState> = {
  id: 'turtle',
  name: 'Turtle LOGO',
  icon: <span className="text-xl">🐢</span>,

  paletteItems: TURTLE_PALETTE_ITEMS,

  createInitialState: createInitialTurtleState,

  resetState: (state: TurtleState): TurtleState => ({
    ...createInitialTurtleState(),
    pan: state.pan,
    zoom: state.zoom,
    fitToView: state.fitToView,
  }),

  executeAction: (
    actionType: string,
    state: TurtleState,
    options?: { repeatCount?: number; params?: Record<string, any> }
  ): SimActionResult<TurtleState> => {
    let nextState = state;

    switch (actionType) {
      case 'FORWARD':
      case 'MOVE_FWD': {
        const dist = options?.params?.distance ?? DEFAULT_STEP_DISTANCE;
        nextState = moveTurtleForward(nextState, dist);
        break;
      }

      case 'BACKWARD':
      case 'MOVE_BACK': {
        const dist = options?.params?.distance ?? DEFAULT_STEP_DISTANCE;
        nextState = moveTurtleBackward(nextState, dist);
        break;
      }

      case 'TURN_LEFT': {
        const baseAngle = options?.params?.angle ?? 90;
        nextState = turnTurtle(nextState, -baseAngle);
        break;
      }

      case 'TURN_RIGHT': {
        const baseAngle = options?.params?.angle ?? 90;
        nextState = turnTurtle(nextState, baseAngle);
        break;
      }

      case 'ARC_LEFT': {
        const radius = options?.params?.radius ?? 50;
        const angle = options?.params?.angle ?? 90;
        nextState = arcTurtle(nextState, radius, angle, 'LEFT');
        break;
      }

      case 'ARC_RIGHT': {
        const radius = options?.params?.radius ?? 50;
        const angle = options?.params?.angle ?? 90;
        nextState = arcTurtle(nextState, radius, angle, 'RIGHT');
        break;
      }

      case 'PEN_UP': {
        nextState = { ...nextState, penDown: false };
        break;
      }

      case 'PEN_DOWN': {
        nextState = { ...nextState, penDown: true };
        break;
      }

      case 'SET_PEN_COLOR': {
        const color = options?.params?.color ?? '#0f172a';
        nextState = { ...nextState, penColor: color };
        break;
      }

      default:
        break;
    }

    return {
      nextState: { ...nextState, status: 'RUNNING' },
      status: 'RUNNING',
    };
  },

  evaluateCompletion: () => 'IDLE',

  Renderer: TurtleCanvas,

  ToolsComponent: TurtleToolbarTools,
};
