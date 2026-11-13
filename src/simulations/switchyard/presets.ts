import { SwitchyardState } from './types';
import { createInitialSwitchyardState } from './physics';

/** Default sandbox preset: 4-item queue, 2 docks, 1 switch. */
export const DEFAULT_SWITCHYARD_STATE: SwitchyardState = createInitialSwitchyardState({
  initialQueue: [
    { color: 'RED',   icon: 'CRATE',   damaged: false },
    { color: 'BLUE',  icon: 'BATTERY', damaged: false },
    { color: 'RED',   icon: 'GEAR',    damaged: false },
    { color: 'BLUE',  icon: 'CRYSTAL', damaged: false },
  ],
  initialDockSpecs: [
    { id: 'DOCK_A' },
    { id: 'DOCK_B' },
  ],
  initialSwitchDirections: ['LEFT'],
} as Partial<SwitchyardState>);

/** Sample preset with damaged items for Lesson 5.3 / 5B style puzzles. */
export const HAZARD_PRESET: SwitchyardState = createInitialSwitchyardState({
  initialQueue: [
    { color: 'RED',  icon: 'CRATE',   damaged: false },
    { color: 'BLUE', icon: 'BATTERY', damaged: true  },
    { color: 'RED',  icon: 'GEAR',    damaged: true  },
    { color: 'BLUE', icon: 'CRYSTAL', damaged: false },
  ],
  initialDockSpecs: [
    { id: 'DOCK_A', rejectDamaged: true },
    { id: 'DOCK_B', rejectDamaged: true },
  ],
  initialSwitchDirections: ['LEFT'],
} as Partial<SwitchyardState>);
