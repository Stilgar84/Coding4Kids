import {
  SimulationEnvironment,
  SimPaletteItem,
  SimActionResult,
  ActionParamDef,
} from '../../engine/simulation/types';
import { registerSimulation } from '../../engine/simulation/registry';
import { TurtleState } from './types';
import {
  moveTurtleForward,
  moveTurtleBackward,
  turnTurtle,
  arcTurtle,
  teleportTurtle,
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
  Palette,
  Hourglass,
  Zap,
  Eraser,
  Crosshair,
} from 'lucide-react';

export const DEFAULT_TURN_ANGLE = 90;

export function normalizeTurtleActionType(actionType: string): string {
  if (actionType === 'MOVE_FWD') return 'FORWARD';
  if (actionType === 'MOVE_BACK') return 'BACKWARD';
  return actionType;
}

export function getEffectiveTurtlePaletteItems(allowActionParams = true): SimPaletteItem[] {
  if (allowActionParams) {
    return TURTLE_PALETTE_ITEMS;
  }
  return TURTLE_PALETTE_ITEMS.map((item) => ({
    ...item,
    paramDefs: undefined,
    params: undefined,
  }));
}

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
    activeAnimation: null,
    instantMode: false,
    showTurtle: true,
  };
}

export const TURTLE_ANGLE_PARAM_DEF: ActionParamDef = {
  id: 'angle',
  label: 'Angle',
  type: 'angle',
  visualVariant: 'rotation',
  defaultValue: 90,
  unit: '°',
  options: [
    { value: 15, label: '15°' },
    { value: 30, label: '30°' },
    { value: 45, label: '45°' },
    { value: 60, label: '60°' },
    { value: 90, label: '90°' },
    { value: 120, label: '120°' },
    { value: 135, label: '135°' },
    { value: 180, label: '180°' },
  ],
};

export const TURTLE_ARC_RADIUS_PARAM_DEF: ActionParamDef = {
  id: 'radius',
  label: 'Radius',
  type: 'radius',
  visualVariant: 'radius',
  defaultValue: 50,
  unit: 'px',
  options: [
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 75, label: '75' },
    { value: 100, label: '100' },
    { value: 150, label: '150' },
  ],
};

export const TURTLE_ARC_ANGLE_PARAM_DEF: ActionParamDef = {
  id: 'angle',
  label: 'Angle',
  type: 'angle',
  visualVariant: 'arcAngle',
  defaultValue: 90,
  unit: '°',
  options: [
    { value: 30, label: '30°' },
    { value: 45, label: '45°' },
    { value: 60, label: '60°' },
    { value: 90, label: '90°' },
    { value: 120, label: '120°' },
    { value: 180, label: '180°' },
    { value: 270, label: '270°' },
    { value: 360, label: '360°' },
  ],
};

export const TURTLE_COLOR_PARAM_DEF: ActionParamDef = {
  id: 'color',
  label: 'Color',
  type: 'color',
  defaultValue: '#0f172a',
  options: [
    { value: '#0f172a', label: 'Black' },
    { value: '#ef4444', label: 'Red' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
  ],
};

export const TURTLE_PEN_WIDTH_PARAM_DEF: ActionParamDef = {
  id: 'width',
  label: 'Line Width',
  type: 'penWidth',
  defaultValue: 6,
  unit: 'px',
  options: [
    { value: 2, label: '2px' },
    { value: 4, label: '4px' },
    { value: 6, label: '6px' },
    { value: 8, label: '8px' },
    { value: 12, label: '12px' },
    { value: 16, label: '16px' },
  ],
};

export const TURTLE_LENGTH_PARAM_DEF: ActionParamDef = {
  id: 'length',
  label: 'Length',
  type: 'length',
  defaultValue: 50,
  unit: 'px',
  options: [
    { value: 10, label: '10' },
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 75, label: '75' },
    { value: 100, label: '100' },
    { value: 150, label: '150' },
    { value: 200, label: '200' },
  ],
};

export const TURTLE_WAIT_DURATION_PARAM_DEF: ActionParamDef = {
  id: 'duration',
  label: 'Wait',
  type: 'wait-duration',
  defaultValue: 1,
  options: [
    { value: 0.25, label: '¼×' },
    { value: 0.5, label: '½×' },
    { value: 1, label: '1×' },
    { value: 2, label: '2×' },
    { value: 4, label: '4×' },
  ],
};

export const TURTLE_INSTANT_MODE_PARAM_DEF: ActionParamDef = {
  id: 'mode',
  label: 'Instant',
  type: 'instant-mode',
  defaultValue: 'ON',
  options: [
    { value: 'ON', label: 'ON' },
    { value: 'OFF', label: 'OFF' },
  ],
};

export const TURTLE_TELEPORT_X_PARAM_DEF: ActionParamDef = {
  id: 'x',
  label: 'X',
  type: 'coord',
  defaultValue: 0,
  unit: 'px',
  options: [
    { value: -150, label: '-150' },
    { value: -100, label: '-100' },
    { value: -50, label: '-50' },
    { value: 0, label: '0' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
    { value: 150, label: '150' },
  ],
};

export const TURTLE_TELEPORT_Y_PARAM_DEF: ActionParamDef = {
  id: 'y',
  label: 'Y',
  type: 'coord',
  defaultValue: 0,
  unit: 'px',
  options: [
    { value: -150, label: '-150' },
    { value: -100, label: '-100' },
    { value: -50, label: '-50' },
    { value: 0, label: '0' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
    { value: 150, label: '150' },
  ],
};

export const TURTLE_TELEPORT_HEADING_PARAM_DEF: ActionParamDef = {
  id: 'heading',
  label: 'Heading',
  type: 'angle',
  defaultValue: 0,
  unit: '°',
  options: [
    { value: 0, label: '0°' },
    { value: 45, label: '45°' },
    { value: 90, label: '90°' },
    { value: 135, label: '135°' },
    { value: 180, label: '180°' },
    { value: 270, label: '270°' },
  ],
};

const TURTLE_PALETTE_ITEMS: SimPaletteItem[] = [
  // Movement
  {
    id: 'turtle-forward',
    actionType: 'FORWARD',
    name: 'Move Forward',
    category: 'motion',
    paramDefs: [TURTLE_LENGTH_PARAM_DEF],
    params: { length: 50 },
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
    paramDefs: [TURTLE_LENGTH_PARAM_DEF],
    params: { length: 50 },
    icon: ({ className, isActive }) => (
      <ArrowDown className={className || `w-7 h-7 ${isActive ? 'text-slate-950 stroke-[3]' : 'text-white stroke-[3]'}`} />
    ),
    bgClass: 'bg-sky-700 hover:bg-sky-600',
    borderClass: 'border-sky-500',
    supportsRepeat: true,
  },

  // Turn Left
  {
    id: 'turtle-turn-left',
    actionType: 'TURN_LEFT',
    name: 'Turn Left',
    category: 'motion',
    paramDefs: [TURTLE_ANGLE_PARAM_DEF],
    params: { angle: 90 },
    icon: ({ isActive }) => (
      <RotateCcw className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: true,
  },

  // Turn Right
  {
    id: 'turtle-turn-right',
    actionType: 'TURN_RIGHT',
    name: 'Turn Right',
    category: 'motion',
    paramDefs: [TURTLE_ANGLE_PARAM_DEF],
    params: { angle: 90 },
    icon: ({ isActive }) => (
      <RotateCw className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-white stroke-[2.5]'}`} />
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
    paramDefs: [TURTLE_ARC_RADIUS_PARAM_DEF, TURTLE_ARC_ANGLE_PARAM_DEF],
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
    paramDefs: [TURTLE_ARC_RADIUS_PARAM_DEF, TURTLE_ARC_ANGLE_PARAM_DEF],
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

  // Pen Color
  {
    id: 'turtle-pen-color',
    actionType: 'SET_PEN_COLOR',
    name: 'Pen Color',
    category: 'pen',
    paramDefs: [TURTLE_COLOR_PARAM_DEF],
    params: { color: '#0f172a' },
    icon: ({ isActive }) => (
      <Palette className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-pink-300 stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-slate-800 hover:bg-slate-700',
    borderClass: 'border-slate-500',
    supportsRepeat: false,
  },

  // Pen Width
  {
    id: 'turtle-pen-width',
    actionType: 'SET_PEN_WIDTH',
    name: 'Pen Width',
    category: 'pen',
    paramDefs: [TURTLE_PEN_WIDTH_PARAM_DEF],
    params: { width: 6 },
    icon: ({ isActive }) => (
      <div className="flex flex-col items-center justify-center gap-1">
        <div className={`w-6 h-1.5 rounded-full ${isActive ? 'bg-slate-950' : 'bg-white'}`} />
        <span className={`text-[9px] font-bold ${isActive ? 'text-slate-950' : 'text-slate-300'}`}>Width</span>
      </div>
    ),
    bgClass: 'bg-slate-800 hover:bg-slate-700',
    borderClass: 'border-slate-500',
    supportsRepeat: false,
  },

  // Teleport
  {
    id: 'turtle-teleport',
    actionType: 'TELEPORT',
    name: 'Teleport',
    category: 'motion',
    paramDefs: [
      TURTLE_TELEPORT_X_PARAM_DEF,
      TURTLE_TELEPORT_Y_PARAM_DEF,
      TURTLE_TELEPORT_HEADING_PARAM_DEF,
    ],
    params: { x: 0, y: 0, heading: 0 },
    icon: ({ isActive }) => (
      <Crosshair className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-cyan-300 stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-cyan-700 hover:bg-cyan-600',
    borderClass: 'border-cyan-400',
    supportsRepeat: false,
  },

  // Wait
  {
    id: 'turtle-wait',
    actionType: 'WAIT',
    name: 'Wait',
    category: 'timing',
    paramDefs: [TURTLE_WAIT_DURATION_PARAM_DEF],
    params: { duration: 1 },
    icon: ({ isActive }) => (
      <Hourglass className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-amber-300 stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-amber-700 hover:bg-amber-600',
    borderClass: 'border-amber-400',
    supportsRepeat: false,
  },

  // Instant Mode
  {
    id: 'turtle-set-instant',
    actionType: 'SET_INSTANT',
    name: 'Instant Mode',
    category: 'timing',
    paramDefs: [TURTLE_INSTANT_MODE_PARAM_DEF],
    params: { mode: 'ON' },
    icon: ({ isActive }) => (
      <Zap className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-yellow-300 stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-yellow-700 hover:bg-yellow-600',
    borderClass: 'border-yellow-400',
    supportsRepeat: false,
  },

  // Clear Picture
  {
    id: 'turtle-clear-canvas',
    actionType: 'CLEAR_CANVAS',
    name: 'Clear Picture',
    category: 'pen',
    icon: ({ isActive }) => (
      <Eraser className={`w-6 h-6 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-rose-200 stroke-[2.5]'}`} />
    ),
    bgClass: 'bg-rose-700 hover:bg-rose-600',
    borderClass: 'border-rose-400',
    supportsRepeat: false,
  },
];

export const turtleSimulationEnvironment: SimulationEnvironment<TurtleState> = {
  id: 'turtle',
  name: 'Turtle LOGO',
  icon: <span className="text-xl">🐢</span>,

  paletteItems: TURTLE_PALETTE_ITEMS,

  sensors: [
    { id: '$x', label: 'X', icon: '📍X' },
    { id: '$y', label: 'Y', icon: '📍Y' },
    { id: '$heading', label: '∠', icon: '🧭∠' },
  ],

  readSensor: (sensorId: string, state: TurtleState): number => {
    switch (sensorId) {
      case '$x':
        return Math.round(state.robot.x);
      case '$y':
        return Math.round(state.robot.y);
      case '$heading':
        return Math.round(state.robot.heading);
      default:
        return 0;
    }
  },

  createInitialState: createInitialTurtleState,

  resetState: (state: TurtleState): TurtleState => ({
    ...createInitialTurtleState(),
    pan: state.pan,
    zoom: state.zoom,
    fitToView: state.fitToView,
    showTurtle: state.showTurtle,
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
        const rawDist = options?.params?.length ?? options?.params?.distance;
        const dist =
          typeof rawDist === 'number' && Number.isFinite(rawDist)
            ? rawDist
            : DEFAULT_STEP_DISTANCE;
        nextState = moveTurtleForward(nextState, dist);
        break;
      }

      case 'BACKWARD':
      case 'MOVE_BACK': {
        const rawDist = options?.params?.length ?? options?.params?.distance;
        const dist =
          typeof rawDist === 'number' && Number.isFinite(rawDist)
            ? rawDist
            : DEFAULT_STEP_DISTANCE;
        nextState = moveTurtleBackward(nextState, dist);
        break;
      }

      case 'TURN_LEFT': {
        const rawAngle = options?.params?.angle;
        const baseAngle =
          typeof rawAngle === 'number' && Number.isFinite(rawAngle)
            ? rawAngle
            : DEFAULT_TURN_ANGLE;
        nextState = turnTurtle(nextState, -baseAngle);
        break;
      }

      case 'TURN_RIGHT': {
        const rawAngle = options?.params?.angle;
        const baseAngle =
          typeof rawAngle === 'number' && Number.isFinite(rawAngle)
            ? rawAngle
            : DEFAULT_TURN_ANGLE;
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

      case 'SET_PEN_WIDTH': {
        const width = options?.params?.width ?? 6;
        nextState = { ...nextState, penWidth: width };
        break;
      }

      case 'TELEPORT': {
        const rawX = options?.params?.x;
        const rawY = options?.params?.y;
        const rawHeading = options?.params?.heading;
        const x = typeof rawX === 'number' && Number.isFinite(rawX) ? rawX : 0;
        const y = typeof rawY === 'number' && Number.isFinite(rawY) ? rawY : 0;
        const heading = typeof rawHeading === 'number' && Number.isFinite(rawHeading) ? rawHeading : 0;
        nextState = teleportTurtle(nextState, x, y, heading);
        break;
      }

      case 'WAIT': {
        // Timing handled by execution loop; state unchanged.
        break;
      }

      case 'SET_INSTANT': {
        const mode = options?.params?.mode ?? 'ON';
        nextState = { ...nextState, instantMode: mode === 'ON' };
        break;
      }

      case 'CLEAR_CANVAS': {
        nextState = {
          ...nextState,
          paths: [],
          computedBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
        };
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

registerSimulation(turtleSimulationEnvironment);
