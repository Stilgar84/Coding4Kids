import { createInitialSwitchyardState } from './physics';
import { SwitchyardState } from './types';

export const DEFAULT_SWITCHYARD_STATE: SwitchyardState = createInitialSwitchyardState({
  queue: [
    { id: 'c1', color: 'RED', icon: 'CRATE', damaged: false },
    { id: 'c2', color: 'BLUE', icon: 'CRATE', damaged: false },
    { id: 'c3', color: 'RED', icon: 'GEAR', damaged: false },
    { id: 'c4', color: 'BLUE', icon: 'BATTERY', damaged: false },
  ],
  docks: [
    { id: 'DOCK_A', spec: { dockId: 'DOCK_A', acceptColor: 'RED', rejectDamaged: true }, items: [] },
    { id: 'DOCK_B', spec: { dockId: 'DOCK_B', acceptColor: 'BLUE', rejectDamaged: true }, items: [] },
  ],
  switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
});

export const HAZARD_PRESET: SwitchyardState = createInitialSwitchyardState({
  queue: [
    { id: 'h1', color: 'RED', icon: 'CRATE', damaged: true },
    { id: 'h2', color: 'RED', icon: 'BATTERY', damaged: false },
    { id: 'h3', color: 'BLUE', icon: 'GEAR', damaged: true },
    { id: 'h4', color: 'BLUE', icon: 'CRYSTAL', damaged: false },
  ],
  docks: [
    { id: 'DOCK_A', spec: { dockId: 'DOCK_A', acceptColor: 'RED', rejectDamaged: true }, items: [] },
    { id: 'DOCK_B', spec: { dockId: 'DOCK_B', acceptColor: 'BLUE', rejectDamaged: true }, items: [] },
  ],
  switches: [{ id: 'A', direction: 'LEFT', initialDirection: 'LEFT' }],
});

export const TWO_SWITCH_PRESET: SwitchyardState = createInitialSwitchyardState({
  queue: [
    { id: 't1', color: 'RED', icon: 'CRATE', damaged: false },
    { id: 't2', color: 'BLUE', icon: 'GEAR', damaged: false },
    { id: 't3', color: 'GREEN', icon: 'BATTERY', damaged: false },
    { id: 't4', color: 'BLUE', icon: 'CRATE', damaged: true },
  ],
  docks: [
    { id: 'DOCK_A', spec: { dockId: 'DOCK_A', acceptColor: 'RED', rejectDamaged: true }, items: [] },
    { id: 'DOCK_B', spec: { dockId: 'DOCK_B', acceptColor: 'BLUE', rejectDamaged: true }, items: [] },
    { id: 'DOCK_C', spec: { dockId: 'DOCK_C', acceptColor: 'GREEN', rejectDamaged: true }, items: [] },
  ],
  switches: [
    { id: 'A', direction: 'LEFT', initialDirection: 'LEFT', leftTarget: 'DOCK_A', rightTarget: 'SWITCH_B' },
    { id: 'B', direction: 'LEFT', initialDirection: 'LEFT', leftTarget: 'DOCK_B', rightTarget: 'DOCK_C' },
  ],
});
