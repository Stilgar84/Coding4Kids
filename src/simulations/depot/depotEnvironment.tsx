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
  resetDepotState,
} from './depotPhysics';
import { DepotCanvas } from './components/DepotCanvas';
import { DepotToolbarTools } from './components/DepotToolbarTools';

export const DEPOT_STATION_PARAM_DEF: ActionParamDef = {
  id: 'station',
  label: 'Stack Bay',
  type: 'depot-station',
  defaultValue: 'STACK_1',
  options: [
    { value: 'STACK_1', label: '1' },
    { value: 'STACK_2', label: '2' },
    { value: 'STACK_3', label: '3' },
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
        <line x1="3" y1="6" x2="21" y2="6" />
        <rect x="8" y="3" width="8" height="6" rx="1.5" />
        <path d="M5 15 L19 15" />
        <polyline points="15 11 19 15 15 19" />
      </svg>
    ),
    bgClass: 'bg-sky-600 hover:bg-sky-500',
    borderClass: 'border-sky-400',
    supportsRepeat: false,
  },
  {
    id: 'depot-grab',
    actionType: 'DEPOT_GRAB',
    name: 'Grab Top Crate',
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
    name: 'Place Crate on Stack',
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
    name: 'Send Crate Out',
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
];

export const DEPOT_SENSORS: SimSensorDef[] = [
  { id: '$stack1', label: 'Stack 1 Height', icon: '1️⃣', shortLabel: 'S1' },
  { id: '$stack2', label: 'Stack 2 Height', icon: '2️⃣', shortLabel: 'S2' },
  { id: '$stack3', label: 'Stack 3 Height', icon: '3️⃣', shortLabel: 'S3' },
  { id: '$out', label: 'Output Count', icon: '✅', shortLabel: 'OUT' },
];

export const depotSimulationEnvironment: SimulationEnvironment<DepotState> = {
  id: 'depot',
  name: 'Crate Depot',
  icon: <span className="text-xl">🏗️</span>,

  paletteItems: DEPOT_PALETTE_ITEMS,
  sensors: DEPOT_SENSORS,

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

  readSensor: (sensorId: string, state: DepotState): number => {
    switch (sensorId) {
      case '$stack1':
        return state.stacks[0]?.length ?? 0;
      case '$stack2':
        return state.stacks[1]?.length ?? 0;
      case '$stack3':
        return state.stacks[2]?.length ?? 0;
      case '$out':
        return state.output?.length ?? 0;
      default:
        return 0;
    }
  },

  evaluateCompletion: (state: DepotState) => evaluateDepotCompletion(state),

  Renderer: DepotCanvas,

  ToolsComponent: DepotToolbarTools,
};

registerSimulation(depotSimulationEnvironment);
