import React from 'react';
import {
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
  resetSwitchyardState,
} from './physics';
import { DEFAULT_SWITCHYARD_STATE } from './presets';
import { SwitchyardCanvas } from './components/SwitchyardCanvas';
import { SwitchyardToolbarTools } from './components/SwitchyardToolbarTools';

// ─── Palette items ─────────────────────────────────────────────────────────

function SwitchIcon({ isActive }: { isActive?: boolean }) {
  const stroke = isActive ? '#0f172a' : '#fff';
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      className={`w-6 h-6 md:w-7 md:h-7`} stroke={stroke}>
      <path d="M4 12 L10 6 L20 6" />
      <path d="M10 18 L20 18" />
      <circle cx={20} cy={6} r={2} />
      <circle cx={20} cy={18} r={2} />
    </svg>
  );
}

function SendNextIcon({ isActive }: { isActive?: boolean }) {
  const stroke = isActive ? '#0f172a' : '#fff';
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      className={`w-6 h-6 md:w-7 md:h-7`} stroke={stroke}>
      <rect x={2} y={8} width={12} height={8} rx={2} />
      <polyline points="14,10 20,12 14,14" />
    </svg>
  );
}

function ScrapIcon({ isActive }: { isActive?: boolean }) {
  const stroke = isActive ? '#0f172a' : '#fff';
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
      className={`w-6 h-6 md:w-7 md:h-7`} stroke={stroke}>
      {/* CornerDownLeft per ui_guidelines §4 for structural/routing closers */}
      <polyline points="9,10 4,15 9,20" />
      <path d="M20 4h-7a4 4 0 0 0-4 4v7" />
      {/* Trash indicator */}
      <line x1="18" y1="6" x2="18" y2="6.01" strokeWidth={3} />
    </svg>
  );
}

export const SWITCHYARD_PALETTE_ITEMS: SimPaletteItem[] = [
  {
    id: 'switch-left',
    actionType: 'SWITCH_LEFT',
    name: 'Switch Left',
    category: 'motion',
    params: { junction: 'A' },
    icon: SwitchIcon,
    bgClass: 'bg-blue-700 hover:bg-blue-600',
    borderClass: 'border-blue-400',
    supportsRepeat: false,
  },
  {
    id: 'switch-right',
    actionType: 'SWITCH_RIGHT',
    name: 'Switch Right',
    category: 'motion',
    params: { junction: 'A' },
    icon: SwitchIcon,
    bgClass: 'bg-violet-700 hover:bg-violet-600',
    borderClass: 'border-violet-400',
    supportsRepeat: false,
  },
  {
    id: 'send-next',
    actionType: 'SEND_NEXT',
    name: 'Send Next',
    category: 'action',
    icon: SendNextIcon,
    bgClass: 'bg-emerald-700 hover:bg-emerald-600',
    borderClass: 'border-emerald-400',
    supportsRepeat: true,
  },
  {
    id: 'scrap-item',
    actionType: 'SCRAP_ITEM',
    name: 'Scrap Item',
    category: 'action',
    icon: ScrapIcon,
    bgClass: 'bg-rose-700 hover:bg-rose-600',
    borderClass: 'border-rose-400',
    supportsRepeat: false,
  },
];

// ─── Sensor definitions ────────────────────────────────────────────────────

export const SWITCHYARD_SENSORS: SimSensorDef[] = [
  { id: 'hasNextItem', label: 'Has Next Item', icon: '🚂', shortLabel: 'Next?' },
  { id: 'itemDamaged', label: 'Item Damaged',  icon: '⚡', shortLabel: 'Damaged?' },
  { id: 'itemColor',   label: 'Item Color',    icon: '🎨', shortLabel: 'Color?' },
  { id: 'itemIcon',    label: 'Item Type',     icon: '📦', shortLabel: 'Type?' },
];

// ─── SimulationEnvironment registration ───────────────────────────────────

export const switchyardSimulationEnvironment: SimulationEnvironment<SwitchyardState> = {
  id: 'switchyard',
  name: '🚂 Switchyard',
  icon: React.createElement('span', { 'aria-hidden': true }, '🚂'),

  paletteItems: SWITCHYARD_PALETTE_ITEMS,
  sensors: SWITCHYARD_SENSORS,

  createInitialState: () => createInitialSwitchyardState(DEFAULT_SWITCHYARD_STATE),
  resetState: (state) => resetSwitchyardState(state),

  executeAction(actionType, state, options): SimActionResult<SwitchyardState> {
    if (state.status === 'COLLISION') {
      return { nextState: state, status: 'COLLISION', isCollision: true };
    }
    const nextState = applySwitchyardAction(actionType, state, options);
    const isCollision = nextState.status === 'COLLISION';
    return {
      nextState,
      status: isCollision ? 'COLLISION' : 'IDLE',
      isCollision,
    };
  },

  evaluateCompletion: (state) => evaluateSwitchyardCompletion(state),

  evaluateSensor: (sensor, state) => evaluateSwitchyardSensor(sensor, state),

  Renderer: SwitchyardCanvas,
  ToolsComponent: SwitchyardToolbarTools,
};

// Auto-register
registerSimulation(switchyardSimulationEnvironment);
