import { SimulationStatus } from '../../types';

export type DepotStationId = 'STACK_1' | 'STACK_2' | 'STACK_3';

export type CrateColor = 'RED' | 'BLUE' | 'GREEN' | 'AMBER';

export type DepotStacks = [CrateColor[], CrateColor[], CrateColor[]];

export type DepotFailureReason =
  | 'CLAW_FULL'
  | 'CLAW_EMPTY'
  | 'EMPTY_STACK'
  | 'STACK_FULL'
  | 'WRONG_OUTPUT_ORDER';

export const DEPOT_STATIONS: readonly DepotStationId[] = ['STACK_1', 'STACK_2', 'STACK_3'];

export const DEPOT_MAX_STACK_HEIGHT = 6;

export interface DepotCrateColorMeta {
  id: CrateColor;
  code: number;
  hex: string;
  darkHex: string;
  borderHex: string;
  label: string;
  symbol: string;
}

export const DEPOT_CRATE_PALETTE: readonly DepotCrateColorMeta[] = [
  {
    id: 'RED',
    code: 0,
    hex: '#ef4444',
    darkHex: '#991b1b',
    borderHex: '#fca5a5',
    label: 'Red Crate',
    symbol: '▲',
  },
  {
    id: 'BLUE',
    code: 1,
    hex: '#3b82f6',
    darkHex: '#1e40af',
    borderHex: '#93c5fd',
    label: 'Blue Crate',
    symbol: '■',
  },
  {
    id: 'GREEN',
    code: 2,
    hex: '#10b981',
    darkHex: '#065f46',
    borderHex: '#6ee7b7',
    label: 'Green Crate',
    symbol: '●',
  },
  {
    id: 'AMBER',
    code: 3,
    hex: '#f59e0b',
    darkHex: '#92400e',
    borderHex: '#fde68a',
    label: 'Amber Crate',
    symbol: '◆',
  },
];

export const DEPOT_CRATE_COLORS: Record<CrateColor, DepotCrateColorMeta> = {
  RED: DEPOT_CRATE_PALETTE[0],
  BLUE: DEPOT_CRATE_PALETTE[1],
  GREEN: DEPOT_CRATE_PALETTE[2],
  AMBER: DEPOT_CRATE_PALETTE[3],
};

export interface DepotState {
  /** Current crates in Stack 1, 2, 3 (index 0 = bottom, last index = top accessible crate) */
  stacks: DepotStacks;
  /** Snapshot used by resetState */
  initialStacks: DepotStacks;
  /** Crates delivered to the OUTPUT bay in delivery order */
  output: CrateColor[];
  /** Optional ghost outline target stacks required to win */
  targetStacks?: DepotStacks;
  /** Optional ghost outline target output sequence required to win */
  targetOutput?: CrateColor[];
  /** Current station above which the worker crane is positioned */
  workerStation: DepotStationId;
  /** Starting station restored on resetState */
  initialWorkerStation: DepotStationId;
  /** Crate currently gripped in the single-item claw (null if empty) */
  heldCrate: CrateColor | null;
  /** Failure tag set when an invalid LIFO / claw / output action triggers COLLISION */
  lastFailureReason: DepotFailureReason | null;
  status: SimulationStatus;
  stepCount: number;
}
