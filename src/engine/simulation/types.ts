import React from 'react';
import { SimulationStatus } from '../../types';

export interface SimPaletteItem {
  id: string; // unique item id in palette, e.g. 'turn-left-30', 'pen-color-red'
  actionType: string; // underlying action type, e.g. 'TURN_LEFT', 'SET_PEN_COLOR'
  name: string;
  category: 'motion' | 'pen' | 'action';
  params?: Record<string, any>; // e.g. { angle: 30 }, { color: '#ef4444' }
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
