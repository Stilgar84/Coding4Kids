import React from 'react';
import { SimulationStatus } from '../../types';

export type ActionParamType = 'angle' | 'color' | 'penWidth' | 'radius' | 'number';

export interface ActionParamOption<T = any> {
  value: T;
  label?: string;
  description?: string;
}

export interface ActionParamDef {
  id: string; // e.g. 'angle' | 'color' | 'width' | 'radius'
  label: string;
  type: ActionParamType;
  defaultValue: any;
  unit?: string;
  options: ActionParamOption[];
  visualVariant?: 'rotation' | 'arcAngle' | 'radius';
}

export function getDefaultParams(paramDefs?: ActionParamDef[]): Record<string, any> | undefined {
  if (!paramDefs || paramDefs.length === 0) return undefined;
  const params: Record<string, any> = {};
  for (const def of paramDefs) {
    params[def.id] = def.defaultValue;
  }
  return params;
}

export interface SimPaletteItem {
  id: string; // unique item id in palette, e.g. 'turtle-turn-left', 'turtle-pen-color'
  actionType: string; // underlying action type, e.g. 'TURN_LEFT', 'SET_PEN_COLOR'
  name: string;
  category: 'motion' | 'pen' | 'action';
  params?: Record<string, any>; // default / template params
  paramDefs?: ActionParamDef[]; // Parameter definitions (options, defaults, labels)
  icon: (props: { className?: string; isActive?: boolean }) => React.ReactNode;
  bgClass: string;
  borderClass: string;
  supportsRepeat?: boolean;
}

export interface SimActionResult<TState> {
  nextState: TState;
  status: SimulationStatus;
  isCollision?: boolean;
  isSuccess?: boolean;
}

export interface SimulationEnvironment<TState = any> {
  id: string;
  name: string;
  icon: React.ReactNode;

  // 1. Palette items (actions and parameterized variants)
  paletteItems: SimPaletteItem[];

  // 2. Simulation State & Execution
  createInitialState: () => TState;
  resetState: (state: TState) => TState;
  executeAction: (
    actionType: string,
    state: TState,
    options?: { repeatCount?: number; params?: Record<string, any> }
  ) => SimActionResult<TState>;

  // Hook for sensor queries (future-proof)
  getSensorInfo?: (state: TState, sensorId: string) => any;

  // Victory / Completion evaluation when call stack finishes
  evaluateCompletion?: (state: TState) => SimulationStatus;

  // 3. Display & Environment-Specific Tools
  Renderer: React.FC<{ state: TState; runtimeStatus?: SimulationStatus }>;

  // Map Tools: Grid defines wall/robot/flag tools; Turtle defines Pan/Zoom controls!
  ToolsComponent?: React.FC<{ state: TState }>;
}
