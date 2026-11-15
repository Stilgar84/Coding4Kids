import {
  ActionParamDef,
  SimActionResult,
  SimPaletteItem,
  SimSensorDef,
  SimulationEnvironment,
} from '../../engine/simulation/types';
import { registerSimulation } from '../../engine/simulation/registry';
import { DepotState } from './types';
import {
  applyDepotAction,
  createInitialDepotState,
  evaluateDepotCompletion,
  evaluateDepotSensor,
  readDepotNumericSensor,
  readDepotTypedSensor,
  resetDepotState,
} from './depotPhysics';
import { DepotCanvas } from './components/DepotCanvas';
import { DepotToolbarTools } from './components/DepotToolbarTools';

export const DEPOT_STATION_PARAM_DEF: ActionParamDef = {
  id: 'station',
  label: 'Station',
  type: 'depot-station',
  defaultValue: 'STACK_1',
  options: [
    { value: 'STACK_1', label: '1' },
    { value: 'STACK_2', label: '2' },
    { value: 'STACK_3', label: '3' },
    { value: 'QUEUE',   label: 'Q' },
    { value: 'INPUT',   label: 'IN' },
  ],
};

export const DEPOT_GATE_PARAM_DEF: ActionParamDef = {
  id: 'gate',
  label: 'Gate',
  type: 'depot-gate',
  defaultValue: 'OUT',
  options: [
    { value: 'OUT',    label: 'OUT'    },
    { value: 'ACCEPT', label: 'ACCEPT' },
    { value: 'REJECT', label: 'REJECT' },
  ],
};

export const DEPOT_PALETTE_ITEMS: SimPaletteItem[] = [
  {
    id: 'depot-move-to',
    actionType: 'DEPOT_MOVE_TO',
    name: 'Move Crane',
    category: 'motion',
    paramDefs: [DEPOT_STATION_PARAM_DEF],
    params: { station: 'STACK_1' },
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6 L21 6" />
        <line x1="12" y1="6" x2="12" y2="11" />
        <path d="M4 15 L20 15" />
        <polyline points="8 11 4 15 8 19" />
        <polyline points="16 11 20 15 16 19" />
      </svg>
    ),
    bgClass: 'bg-sky-600 hover:bg-sky-500',
    borderClass: 'border-sky-400',
    supportsRepeat: false,
  },
  {
    id: 'depot-grab',
    actionType: 'DEPOT_GRAB',
    name: 'Grab Top',
    category: 'action',
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 V14" />
        <polyline points="8 7 12 3 16 7" />
        <rect x="6" y="14" width="12" height="7" rx="1.5" />
      </svg>
    ),
    bgClass: 'bg-amber-600 hover:bg-amber-500',
    borderClass: 'border-amber-400',
    supportsRepeat: false,
  },
  {
    id: 'depot-place',
    actionType: 'DEPOT_PLACE',
    name: 'Place on Stack',
    category: 'action',
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 V12" />
        <polyline points="8 9 12 13 16 9" />
        <rect x="5" y="15" width="14" height="6" rx="1.5" />
      </svg>
    ),
    bgClass: 'bg-emerald-600 hover:bg-emerald-500',
    borderClass: 'border-emerald-400',
    supportsRepeat: false,
  },
  {
    id: 'depot-send-out',
    actionType: 'DEPOT_SEND_OUT',
    name: 'Send Out [OUT]',
    category: 'action',
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="8" width="9" height="8" rx="1.5" />
        <path d="M13 12 H21" />
        <polyline points="17 8 21 12 17 16" />
      </svg>
    ),
    bgClass: 'bg-violet-600 hover:bg-violet-500',
    borderClass: 'border-violet-400',
    supportsRepeat: false,
  },
  {
    id: 'depot-send-gate',
    actionType: 'DEPOT_SEND_GATE',
    name: 'Send to Gate',
    category: 'action',
    paramDefs: [DEPOT_GATE_PARAM_DEF],
    params: { gate: 'OUT' },
    icon: ({ isActive }) => (
      <svg
        className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'stroke-slate-950' : 'stroke-white'}`}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Ring */}
        <circle cx="7" cy="12" r="4" />
        {/* Arrow into outgoing gate arch */}
        <path d="M12 12 H18" />
        <polyline points="15 9 18 12 15 15" />
        <path d="M21 7 V17" />
      </svg>
    ),
    bgClass: 'bg-indigo-600 hover:bg-indigo-500',
    borderClass: 'border-indigo-400',
    supportsRepeat: false,
  },
];

export const DEPOT_SENSORS: SimSensorDef[] = [
  { id: '$stack1', label: 'Stack 1 Height', icon: '1️⃣', shortLabel: 'S1' },
  { id: '$stack2', label: 'Stack 2 Height', icon: '2️⃣', shortLabel: 'S2' },
  { id: '$stack3', label: 'Stack 3 Height', icon: '3️⃣', shortLabel: 'S3' },
  { id: '$out', label: 'Output Count', icon: '✅', shortLabel: 'OUT' },
  // Depot v4 boolean sensors (ConditionExpr 0x18..0x1C, active Phase 2 set)
  { id: 'stationEmpty', label: 'Station Empty?', icon: '📭', shortLabel: 'Empty' },
  { id: 'hasItem', label: 'Holding Item?', icon: '🤏', shortLabel: 'Hold' },
  { id: '$heldColor', label: 'Held Color', icon: '🎨', shortLabel: 'HCol' },
  { id: '$topColor', label: 'Top/Front Color', icon: '🔝', shortLabel: 'TCol' },
];

export const DEPOT_PHASE3_VALUE_SENSORS: SimSensorDef[] = [
  { id: '$heldValue', label: 'Held Value', icon: '#️⃣', shortLabel: 'HVal' },
  { id: '$topValue', label: 'Top/Front Value', icon: '🔢', shortLabel: 'TVal' },
  { id: '$stationLen', label: 'Station Length', icon: '📏', shortLabel: 'Len' },
];

export const depotSimulationEnvironment: SimulationEnvironment<DepotState> = {
  id: 'depot',
  name: 'Depot',
  icon: <span className="text-xl">🏗️</span>,

  paletteItems: DEPOT_PALETTE_ITEMS,
  sensors: [...DEPOT_SENSORS, ...DEPOT_PHASE3_VALUE_SENSORS],

  createInitialState: () => createInitialDepotState(),

  resetState: (state: DepotState): DepotState => resetDepotState(state),

  executeAction: (
    actionType: string,
    state: DepotState,
    options?: { repeatCount?: number; params?: Record<string, any> }
  ): SimActionResult<DepotState> => {
    const res = applyDepotAction(actionType, state, options?.params);
    return {
      nextState: res.nextState,
      status: res.nextState.status,
      isCollision: res.isCollision,
      isSuccess: res.isSuccess,
    };
  },

  readTypedSensor: (sensorId: string, state: DepotState) =>
    readDepotTypedSensor(sensorId, state),

  readSensor: (sensorId: string, state: DepotState): number =>
    readDepotNumericSensor(sensorId, state),

  /**
   * Depot boolean sensor evaluation for IF/ELSE_IF/WHILE conditions.
   * sensorCode: 0x18=stationEmpty, 0x19=hasItem, 0x1A=itemDamaged (legacy shim),
   *             0x1B=heldColor==, 0x1C=topColor==
   */
  evaluateSensor: (
    sensorCode: number | string | any,
    state: DepotState,
    params?: any
  ): boolean => {
    let code: number;
    let resolvedParams =
      typeof params === 'object' && params !== null ? { ...params } : undefined;

    if (typeof sensorCode === 'string') {
      const cleanSensor = sensorCode.startsWith('$')
        ? sensorCode.slice(1)
        : sensorCode;
      if (cleanSensor === 'stationEmpty') {
        code = 0x18;
        if (typeof params === 'string') {
          resolvedParams = { station: params };
        } else if (typeof params === 'number') {
          resolvedParams = { stationParam: params };
        }
      } else if (cleanSensor === 'hasItem') {
        code = 0x19;
      } else if (cleanSensor === 'itemDamaged') {
        code = 0x1a;
      } else if (cleanSensor === 'heldColor') {
        code = 0x1b;
        if (typeof params === 'string') {
          resolvedParams = { color: params };
        } else if (typeof params === 'number') {
          resolvedParams = { colorIdx: params };
        }
      } else if (cleanSensor === 'topColor') {
        code = 0x1c;
        if (typeof params === 'string') {
          resolvedParams = { color: params };
        } else if (typeof params === 'number') {
          resolvedParams = { colorIdx: params };
        }
      } else {
        code = 0;
      }
    } else {
      code = sensorCode;
    }
    return evaluateDepotSensor(code, state, resolvedParams);
  },

  evaluateCompletion: (state: DepotState) => evaluateDepotCompletion(state),

  Renderer: DepotCanvas,

  ToolsComponent: DepotToolbarTools,
};

registerSimulation(depotSimulationEnvironment);
