import React from 'react';
import {
  ActionParamDef,
  SimActionResult,
  SimPaletteItem,
  SimSensorDef,
  SimulationEnvironment,
} from '../../engine/simulation/types';
import { registerSimulation } from '../../engine/simulation/registry';
import { SwitchyardState } from './types';
import {
  applySwitchyardAction,
  createInitialSwitchyardState,
  evaluateSwitchyardCompletion,
  evaluateSwitchyardSensor,
  readSwitchyardNumericSensor,
  resetSwitchyardState,
} from './physics';
import { SwitchyardCanvas } from './components/SwitchyardCanvas';
import { SwitchyardToolbarTools } from './components/SwitchyardToolbarTools';

export const SWITCHYARD_JUNCTION_PARAM_DEF: ActionParamDef = {
  id: 'junction',
  label: 'Junction',
  type: 'turnDir',
  defaultValue: 'A',
  options: [
    { value: 'A', label: '[A]' },
    { value: 'B', label: '[B]' },
  ],
};

/**
 * Top-to-Bottom track fork icon highlighting the active Left branch (↙).
 */
const SwitchLeftIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'text-slate-950' : 'text-white'}`}
    fill="none"
    aria-hidden="true"
  >
    <path d="M12 2V9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path
      d="M12 9L19 16.5V21"
      stroke="currentColor"
      strokeOpacity="0.28"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 9L5 16.5V21"
      stroke="#38bdf8"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2.6 18.2L5 21.4L7.6 18.2"
      stroke="#38bdf8"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="9" r="2.2" fill="#38bdf8" />
  </svg>
);

/**
 * Top-to-Bottom track fork icon highlighting the active Right branch (↘).
 */
const SwitchRightIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'text-slate-950' : 'text-white'}`}
    fill="none"
    aria-hidden="true"
  >
    <path d="M12 2V9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    <path
      d="M12 9L5 16.5V21"
      stroke="currentColor"
      strokeOpacity="0.28"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 9L19 16.5V21"
      stroke="#fbbf24"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.4 18.2L19 21.4L21.4 18.2"
      stroke="#fbbf24"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="9" r="2.2" fill="#fbbf24" />
  </svg>
);

/**
 * Top-to-Bottom dispatch rail car + downward chevron icon for SEND_NEXT.
 */
const SendNextIcon: React.FC<{ isActive?: boolean }> = ({ isActive }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-6 h-6 md:w-7 md:h-7 ${isActive ? 'text-slate-950' : 'text-white'}`}
    fill="none"
    aria-hidden="true"
  >
    <path d="M8 3V21M16 3V21" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="6" y="4" width="12" height="8" rx="2.5" fill="currentColor" fillOpacity="0.9" />
    <path d="M12 13V20.5" stroke="#fde047" strokeWidth="2.8" strokeLinecap="round" />
    <path
      d="M8.5 17.5L12 21L15.5 17.5"
      stroke="#fde047"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Yellow/black diagonal hazard trapdoor chute + recycling bin silhouette for SCRAP_ITEM.
 */
const ScrapIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 md:w-7 md:h-7" fill="none" aria-hidden="true">
    <path d="M3 5L14 9.5L13 12L2 7.5Z" fill="#facc15" stroke="#1e293b" strokeWidth="1.2" />
    <path d="M6 6.2L5 8.6M10 7.8L9 10.2" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
    <path
      d="M11.5 12H20.5L19.5 21H12.5L11.5 12Z"
      fill="#fef08a"
      stroke="#0f172a"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M10.5 12H21.5" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
    <path
      d="M16 14.2L17.8 17.8H14.2L16 14.2Z"
      stroke="#0f172a"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const SWITCHYARD_PALETTE_ITEMS: SimPaletteItem[] = [
  {
    id: 'switchyard-switch-left',
    actionType: 'SWITCH_LEFT',
    name: 'Switch Left',
    category: 'motion',
    paramDefs: [SWITCHYARD_JUNCTION_PARAM_DEF],
    params: { junction: 'A' },
    icon: ({ isActive }) => <SwitchLeftIcon isActive={isActive} />,
    bgClass: 'bg-indigo-600 hover:bg-indigo-500',
    borderClass: 'border-indigo-400',
    supportsRepeat: false,
  },
  {
    id: 'switchyard-switch-right',
    actionType: 'SWITCH_RIGHT',
    name: 'Switch Right',
    category: 'motion',
    paramDefs: [SWITCHYARD_JUNCTION_PARAM_DEF],
    params: { junction: 'A' },
    icon: ({ isActive }) => <SwitchRightIcon isActive={isActive} />,
    bgClass: 'bg-teal-600 hover:bg-teal-500',
    borderClass: 'border-teal-400',
    supportsRepeat: false,
  },
  {
    id: 'switchyard-send-next',
    actionType: 'SEND_NEXT',
    name: 'Send Next',
    category: 'action',
    icon: ({ isActive }) => <SendNextIcon isActive={isActive} />,
    bgClass: 'bg-emerald-600 hover:bg-emerald-500',
    borderClass: 'border-emerald-400',
    supportsRepeat: true,
  },
  {
    id: 'switchyard-scrap-item',
    actionType: 'SCRAP_ITEM',
    name: 'Scrap Item',
    category: 'action',
    icon: () => <ScrapIcon />,
    bgClass: 'bg-rose-600 hover:bg-rose-500',
    borderClass: 'border-rose-400',
    supportsRepeat: false,
  },
];

export const SWITCHYARD_SENSORS: SimSensorDef[] = [
  { id: 'hasNextItem', label: 'Car Ready?', icon: '🚂', shortLabel: 'Next' },
  { id: 'itemDamaged', label: 'Damaged?', icon: '⚡', shortLabel: 'Dmg' },
  { id: 'itemColor', label: 'Car Color?', icon: '🔴', shortLabel: 'Col' },
  { id: 'itemIcon', label: 'Car Emblem?', icon: '📦', shortLabel: 'Icon' },
];

export const switchyardSimulationEnvironment: SimulationEnvironment<SwitchyardState> = {
  id: 'switchyard',
  name: 'Switchyard',
  icon: <span className="text-xl">🚂</span>,
  paletteItems: SWITCHYARD_PALETTE_ITEMS,
  sensors: SWITCHYARD_SENSORS,

  createInitialState: () => createInitialSwitchyardState(),
  resetState: (state: SwitchyardState): SwitchyardState => resetSwitchyardState(state),

  executeAction: (actionType, state, options): SimActionResult<SwitchyardState> => {
    const nextState = applySwitchyardAction(actionType, state, options);
    return {
      nextState,
      isSuccess: nextState.status === 'SUCCESS',
      isCollision: nextState.status === 'COLLISION',
      status: nextState.status,
    };
  },

  evaluateSensor: (sensor, state, param) => evaluateSwitchyardSensor(sensor, state, param),
  readSensor: (sensor, state) => readSwitchyardNumericSensor(sensor, state),
  evaluateCompletion: (state) => evaluateSwitchyardCompletion(state),

  Renderer: SwitchyardCanvas,
  ToolsComponent: SwitchyardToolbarTools,
};

registerSimulation(switchyardSimulationEnvironment);
