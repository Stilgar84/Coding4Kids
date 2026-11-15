import { SimulationStatus } from '../../types';

// ---- Station IDs (M3: stacks, M5: + QUEUE, v4 Phase 2+: + INPUT, TAPE) ----
export type DepotStationId = 'STACK_1' | 'STACK_2' | 'STACK_3' | 'QUEUE' | 'INPUT' | 'TAPE';

export type LegacyCrateColor = 'RED' | 'BLUE' | 'GREEN' | 'AMBER';

/** Full 10-color Workshop palette aligned with PALETTE_COLORS (YELLOW aliases AMBER). */
export type CrateColor =
  | 'BLACK'
  | 'RED'
  | 'BLUE'
  | 'GREEN'
  | 'AMBER'
  | 'PURPLE'
  | 'PINK'
  | 'CYAN'
  | 'ORANGE'
  | 'WHITE';

export type DepotStacks = [CrateColor[], CrateColor[], CrateColor[]];

/** Parallel optional numeric values ([1]..[99]) aligned with stack/output crate slots. */
export type DepotStackValues = [
  Array<number | undefined>,
  Array<number | undefined>,
  Array<number | undefined>,
];

/** A single ring/crate item in QUEUE or INPUT (Phase 3 prep: optional numeric value). */
export interface DepotQueueItem {
  color: CrateColor;
  value?: number;
  /** Optional Phase 3 flag for number-only/verdict tokens without color identity. */
  colorless?: boolean;
  /** Legacy M5 field preserved strictly for v3 binary decode compatibility. */
  damaged?: boolean;
}

export type DepotFailureReason =
  | 'CLAW_FULL'
  | 'CLAW_EMPTY'
  | 'EMPTY_STACK'
  | 'STACK_FULL'
  | 'WRONG_OUTPUT_ORDER'
  | 'INPUT_READ_ONLY'     // v4: dropping into one-way INPUT dispenser → COLLISION
  | 'INVALID_STATION'
  | 'HANOI_VIOLATION'     // Phase 3: enforceHanoiRule=true and heldValue > topValue → COLLISION
  | 'DAMAGED_TO_STACK'    // Legacy M5: damaged crate placed on a target stack → COLLISION
  | 'INTACT_TO_SCRAP';    // Legacy M5: intact crate sent to SCRAP gate → COLLISION

/** Gate parameter for DEPOT_SEND_GATE (0x14). `OUT` is the default [OUT] dock (`SCRAP` is legacy decode only). */
export type DepotSendGate = 'OUT' | 'SCRAP' | 'ACCEPT' | 'REJECT';

export const DEPOT_STATIONS: readonly DepotStationId[] = ['STACK_1', 'STACK_2', 'STACK_3', 'QUEUE', 'INPUT'];
export const DEPOT_STACK_STATIONS: readonly DepotStationId[] = ['STACK_1', 'STACK_2', 'STACK_3'];

/** Bitmask constants matching docs/binary_format.md §4.5 + OUT dock visibility bit (0x40). */
export const DEPOT_STATION_BITS = {
  STACK_1: 0x01,
  STACK_2: 0x02,
  STACK_3: 0x04,
  QUEUE: 0x08,
  INPUT: 0x10,
  PHYSICAL_TAPE: 0x20,
  OUT: 0x40,
} as const;

export const DEPOT_DEFAULT_STACK_MASK =
  DEPOT_STATION_BITS.STACK_1 | DEPOT_STATION_BITS.STACK_2 | DEPOT_STATION_BITS.STACK_3;

export const DEPOT_MAX_STACK_HEIGHT = 6;
export const DEPOT_MAX_QUEUE_LENGTH = 8;
export const DEPOT_MAX_INPUT_LENGTH = 8;

export interface DepotCrateColorMeta {
  id: CrateColor;
  /** Legacy M3/M5 crate index (0..3 for RED..AMBER, 4..9 for extended). */
  code: number;
  /** Canonical PALETTE_COLORS index matching COLOR_LITERAL_PALETTE (0=BLACK..9=WHITE). */
  paletteIndex: number;
  hex: string;
  darkHex: string;
  borderHex: string;
  label: string;
  symbol: string;
}

const ALL_RING_COLOR_METAS: Record<CrateColor, DepotCrateColorMeta> = {
  BLACK: {
    id: 'BLACK',
    code: 4,
    paletteIndex: 0,
    hex: '#0f172a',
    darkHex: '#020617',
    borderHex: '#64748b',
    label: 'Black Ring',
    symbol: '⬢',
  },
  RED: {
    id: 'RED',
    code: 0,
    paletteIndex: 1,
    hex: '#ef4444',
    darkHex: '#991b1b',
    borderHex: '#fca5a5',
    label: 'Red Ring',
    symbol: '▲',
  },
  BLUE: {
    id: 'BLUE',
    code: 1,
    paletteIndex: 2,
    hex: '#3b82f6',
    darkHex: '#1e40af',
    borderHex: '#93c5fd',
    label: 'Blue Ring',
    symbol: '■',
  },
  GREEN: {
    id: 'GREEN',
    code: 2,
    paletteIndex: 3,
    hex: '#10b981',
    darkHex: '#065f46',
    borderHex: '#6ee7b7',
    label: 'Green Ring',
    symbol: '●',
  },
  AMBER: {
    id: 'AMBER',
    code: 3,
    paletteIndex: 4,
    hex: '#f59e0b',
    darkHex: '#92400e',
    borderHex: '#fde68a',
    label: 'Amber Ring',
    symbol: '◆',
  },
  PURPLE: {
    id: 'PURPLE',
    code: 5,
    paletteIndex: 5,
    hex: '#8b5cf6',
    darkHex: '#5b21b6',
    borderHex: '#c4b5fd',
    label: 'Purple Ring',
    symbol: '★',
  },
  PINK: {
    id: 'PINK',
    code: 6,
    paletteIndex: 6,
    hex: '#ec4899',
    darkHex: '#9d174d',
    borderHex: '#f9a8d4',
    label: 'Pink Ring',
    symbol: '♥',
  },
  CYAN: {
    id: 'CYAN',
    code: 7,
    paletteIndex: 7,
    hex: '#06b6d4',
    darkHex: '#155e75',
    borderHex: '#67e8f9',
    label: 'Cyan Ring',
    symbol: '◈',
  },
  ORANGE: {
    id: 'ORANGE',
    code: 8,
    paletteIndex: 8,
    hex: '#f97316',
    darkHex: '#9a3412',
    borderHex: '#fdba74',
    label: 'Orange Ring',
    symbol: '◉',
  },
  WHITE: {
    id: 'WHITE',
    code: 9,
    paletteIndex: 9,
    hex: '#ffffff',
    darkHex: '#cbd5e1',
    borderHex: '#94a3b8',
    label: 'White Ring',
    symbol: '○',
  },
};

/** Legacy M3/M5 4-crate palette preserved strictly at indices 0..3 for v2/v3 compatibility. */
export const DEPOT_CRATE_PALETTE: readonly DepotCrateColorMeta[] = [
  ALL_RING_COLOR_METAS.RED,
  ALL_RING_COLOR_METAS.BLUE,
  ALL_RING_COLOR_METAS.GREEN,
  ALL_RING_COLOR_METAS.AMBER,
];

/** Canonical 10-color Toy-Crane ring palette indexed 0..9 in COLOR_LITERAL_PALETTE order. */
export const DEPOT_RING_PALETTE: readonly DepotCrateColorMeta[] = [
  ALL_RING_COLOR_METAS.BLACK,
  ALL_RING_COLOR_METAS.RED,
  ALL_RING_COLOR_METAS.BLUE,
  ALL_RING_COLOR_METAS.GREEN,
  ALL_RING_COLOR_METAS.AMBER,
  ALL_RING_COLOR_METAS.PURPLE,
  ALL_RING_COLOR_METAS.PINK,
  ALL_RING_COLOR_METAS.CYAN,
  ALL_RING_COLOR_METAS.ORANGE,
  ALL_RING_COLOR_METAS.WHITE,
];

export const DEPOT_CRATE_COLORS: Record<CrateColor, DepotCrateColorMeta> = ALL_RING_COLOR_METAS;

export interface DepotActionTransition {
  stepId: number;
  type: 'MOVE' | 'GRAB' | 'PLACE' | 'SEND_OUT' | 'COLLISION';
  fromStation: DepotStationId;
  toStation: DepotStationId;
  gate?: DepotSendGate;
  color?: CrateColor;
  value?: number;
  damaged?: boolean;
  stackIndex?: number;
  stackSlotIndex?: number;
  queueIndex?: number;
  inputIndex?: number;
  outputSlotIndex?: number;
  attemptedStationIndex?: number;
  failureReason?: DepotFailureReason;
}

export interface DepotState {
  /** Current rings/crates in Stack 1, 2, 3 (index 0 = bottom, last index = top accessible item) */
  stacks: DepotStacks;
  /** Snapshot used by resetState */
  initialStacks: DepotStacks;
  /** Optional parallel numeric values ([1]..[99]) for Stack 1, 2, 3 items (Phase 3 numbered blocks). */
  stackValues?: DepotStackValues;
  /** Initial stackValues snapshot used by resetState. */
  initialStackValues?: DepotStackValues;
  /** Items delivered to the OUTPUT bay in delivery order */
  output: CrateColor[];
  /** Optional parallel numeric values ([1]..[99]) for OUTPUT bay items. */
  outputValues?: Array<number | undefined>;
  /** Optional ghost outline target stacks required to win */
  targetStacks?: DepotStacks;
  /** Optional target stack numeric values required to win (Phase 3). */
  targetStackValues?: DepotStackValues;
  /** Optional ghost outline target output sequence required to win */
  targetOutput?: CrateColor[];
  /** Optional target output numeric values required to win (Phase 3). */
  targetOutputValues?: Array<number | undefined>;
  /** Current station above which the worker crane is positioned */
  workerStation: DepotStationId;
  /** Starting station restored on resetState */
  initialWorkerStation: DepotStationId;
  /** Item currently gripped in the single-item claw (null if empty) */
  heldCrate: CrateColor | null;
  /** Whether the held crate is damaged (legacy M5 decode compat). */
  heldDamaged: boolean;
  /** Optional numeric payload of the held ring/block (Phase 3). */
  heldValue?: number;
  /** Optional flag indicating held item is a number-only token without color sensor identity. */
  heldColorless?: boolean;
  /** Failure tag set when an invalid LIFO / claw / INPUT / output action triggers COLLISION */
  lastFailureReason: DepotFailureReason | null;
  status: SimulationStatus;
  stepCount: number;

  // ---- M5 FIFO Queue fields ----
  /** Items in the FIFO conveyor queue (front = index 0, back = last). */
  queue: DepotQueueItem[];
  /** Initial queue snapshot used by resetState. */
  initialQueue: DepotQueueItem[];
  /** Crate count in legacy SCRAP dock (retained strictly for v3 decode compat). */
  scrapCount: number;

  // ---- v4 Phase 2+ INPUT Dispenser & Curriculum Rule fields ----
  /** Items in the one-way INPUT supply dispenser (front = index 0, popped on GRAB). */
  input?: DepotQueueItem[];
  /** Initial INPUT snapshot used by resetState. */
  initialInput?: DepotQueueItem[];
  /** Optional curriculum mode tag (e.g. 'while_sort', 'hanoi'). */
  mode?: string;
  /** Phase 3 prep: enforce Hanoi ordering when placing onto stacks. */
  enforceHanoiRule?: boolean;
  /** Require all stacks to be empty to complete the puzzle. */
  requireEmptyStacks?: boolean;
  /** Allow completion even when INPUT still has remaining items (default false when INPUT has items). */
  allowNonEmptyInput?: boolean;
  /** Require output.length === exactOutputCount when set. */
  exactOutputCount?: number;

  /** Bitmask of active/visible stations (DEPOT_STATION_BITS). Inferred when omitted. */
  activeStationsMask?: number;
  /** Transient last-step choreography metadata (never serialized to binary URLs). */
  lastAction?: DepotActionTransition;
}
