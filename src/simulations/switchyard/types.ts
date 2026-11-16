import { SimulationStatus } from '../../types';

/**
 * Canonical Switchyard car colors.
 * Core Phase 1-2 toy-workshop palette uses RED, BLUE, GREEN, YELLOW (displayed as Amber/Yellow),
 * while extended PALETTE_COLORS (0..9) from conditionSerializer are also supported losslessly.
 */
export type ItemColor =
  | 'RED'
  | 'BLUE'
  | 'GREEN'
  | 'YELLOW'
  | 'PURPLE'
  | 'PINK'
  | 'CYAN'
  | 'ORANGE'
  | 'WHITE'
  | 'BLACK';

export type ItemIcon = 'CRATE' | 'BATTERY' | 'GEAR' | 'CRYSTAL';

export const ITEM_COLORS: readonly ItemColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
export const EXTENDED_ITEM_COLORS: readonly ItemColor[] = [
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
  'PURPLE',
  'PINK',
  'CYAN',
  'ORANGE',
  'WHITE',
  'BLACK',
];
export const ITEM_ICONS: readonly ItemIcon[] = ['CRATE', 'BATTERY', 'GEAR', 'CRYSTAL'];

/** Legacy 0..3 color indexing preserved for v1 binary serialization and backwards compatibility. */
export const ITEM_COLOR_INDEX: Record<'RED' | 'BLUE' | 'GREEN' | 'YELLOW', number> = {
  RED: 0,
  BLUE: 1,
  GREEN: 2,
  YELLOW: 3,
};

export const ITEM_ICON_INDEX: Record<ItemIcon, number> = {
  CRATE: 0,
  BATTERY: 1,
  GEAR: 2,
  CRYSTAL: 3,
};

export const ITEM_COLOR_FROM_INDEX: ('RED' | 'BLUE' | 'GREEN' | 'YELLOW')[] = [
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
];

export const ITEM_ICON_FROM_INDEX: ItemIcon[] = ['CRATE', 'BATTERY', 'GEAR', 'CRYSTAL'];

/** Full 0..9 color mapping aligned with PALETTE_COLORS / PALETTE_COLOR_NAMES in conditionSerializer. */
export const EXTENDED_COLOR_TO_PALETTE_IDX: Record<ItemColor, number> = {
  BLACK: 0,
  RED: 1,
  BLUE: 2,
  GREEN: 3,
  YELLOW: 4,
  PURPLE: 5,
  PINK: 6,
  CYAN: 7,
  ORANGE: 8,
  WHITE: 9,
};

export const ITEM_COLOR_FROM_PALETTE_IDX: readonly ItemColor[] = [
  'BLACK',
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
  'PURPLE',
  'PINK',
  'CYAN',
  'ORANGE',
  'WHITE',
];

export interface SwitchyardItemColorMeta {
  color: ItemColor;
  label: string;
  hex: string;
  stroke: string;
  lightBg: string;
}

export const SWITCHYARD_COLOR_META: Record<ItemColor, SwitchyardItemColorMeta> = {
  RED: { color: 'RED', label: 'Red', hex: '#ef4444', stroke: '#b91c1c', lightBg: '#fee2e2' },
  BLUE: { color: 'BLUE', label: 'Blue', hex: '#3b82f6', stroke: '#1d4ed8', lightBg: '#dbeafe' },
  GREEN: { color: 'GREEN', label: 'Green', hex: '#10b981', stroke: '#047857', lightBg: '#d1fae5' },
  YELLOW: { color: 'YELLOW', label: 'Amber', hex: '#f59e0b', stroke: '#b45309', lightBg: '#fef3c7' },
  PURPLE: { color: 'PURPLE', label: 'Purple', hex: '#8b5cf6', stroke: '#6d28d9', lightBg: '#ede9fe' },
  PINK: { color: 'PINK', label: 'Pink', hex: '#ec4899', stroke: '#be185d', lightBg: '#fce7f3' },
  CYAN: { color: 'CYAN', label: 'Cyan', hex: '#06b6d4', stroke: '#0e7490', lightBg: '#cffafe' },
  ORANGE: { color: 'ORANGE', label: 'Orange', hex: '#f97316', stroke: '#c2410c', lightBg: '#ffedd5' },
  WHITE: { color: 'WHITE', label: 'White', hex: '#f8fafc', stroke: '#64748b', lightBg: '#f1f5f9' },
  BLACK: { color: 'BLACK', label: 'Black', hex: '#334155', stroke: '#0f172a', lightBg: '#e2e8f0' },
};

export interface SwitchyardItem {
  id: string;
  color: ItemColor;
  icon: ItemIcon;
  damaged?: boolean;
  /** Optional Phase 3 weight value (1..99) */
  weight?: number;
  /** Optional Phase 3 arrival sequence tag number (#1, #2, ...) */
  seqNum?: number;
  /** Optional raw string sequence label (e.g. '#1') */
  seqTag?: string;
}

export type DockId = 'DOCK_A' | 'DOCK_B' | 'DOCK_C' | 'SCRAP';

export type SwitchyardParitySlot = 'odd' | 'even';

export interface DockExpectedItemSpec {
  color?: ItemColor;
  icon?: ItemIcon;
  damaged?: boolean;
  weight?: number;
  seqNum?: number;
}

export interface DockSpec {
  dockId: Exclude<DockId, 'SCRAP'>;
  acceptColor?: ItemColor;
  acceptIcon?: ItemIcon;
  rejectDamaged?: boolean;
  /** Optional ordered/accepted car specs at this dock */
  expectedItems?: DockExpectedItemSpec[];
  /** Optional exact or capacity quota at this dock */
  quota?: number;
  /** Optional Phase 3 weight bounds */
  minWeight?: number;
  maxWeight?: number;
  /** Optional Phase 3 sequence parity slot ('odd' = #1,#3,#5; 'even' = #2,#4,#6) */
  paritySlot?: SwitchyardParitySlot;
  /** Optional Phase 5 return bay flag */
  isReturnBay?: boolean;
}

export interface DockState {
  id: Exclude<DockId, 'SCRAP'>;
  spec: DockSpec;
  items: SwitchyardItem[];
  /** Alias of `items` for v2 readers */
  received?: SwitchyardItem[];
  quota?: number;
  minWeight?: number;
  maxWeight?: number;
  paritySlot?: SwitchyardParitySlot;
  isReturnBay?: boolean;
}

export type SwitchDirection = 'LEFT' | 'RIGHT';

export type SwitchJunctionId = 'A' | 'B' | 'C';

export interface SwitchState {
  id: SwitchJunctionId;
  direction: SwitchDirection;
  initialDirection: SwitchDirection;
  /** Optional explicit destination IDs ('DOCK_A' | 'DOCK_B' | 'DOCK_C' | 'SWITCH_B' | 'SWITCH_C' | 'SCRAP') */
  leftTarget?: string;
  rightTarget?: string;
}

export type SwitchyardScrapRule = 'damaged_only' | 'damaged_or_overweight' | 'any' | 'none';

export type SwitchyardMode = 'standard' | 'balance_scale' | 'order_manifest' | 'strategy_filter';

export type SwitchyardFailureReason =
  | 'WRONG_DOCK_COLOR'
  | 'WRONG_DOCK_ICON'
  | 'DAMAGED_IN_GOOD_DOCK'
  | 'GOOD_ITEM_SCRAPPED'
  | 'QUEUE_EMPTY_SEND'
  | 'QUEUE_EMPTY_SCRAP'
  | 'MISSING_SWITCH_B'
  | 'MISSING_SWITCH'
  | 'UNSORTED_ITEMS_REMAIN'
  | 'DOCK_QUOTA_EXCEEDED'
  | 'WEIGHT_LIMIT_VIOLATED'
  | 'PARITY_SLOT_VIOLATED'
  | 'SCALE_IMBALANCED'
  | 'EXPECTED_ITEMS_MISMATCH'
  | 'SCRAP_DISALLOWED';

export interface SwitchyardFailureDetail {
  code:
    | 'STRANDED_CARS'
    | 'WRONG_COLOR'
    | 'WRONG_ICON'
    | 'DAMAGED_REJECTED'
    | 'GOOD_SCRAPPED'
    | 'QUEUE_EMPTY'
    | 'INVALID_SWITCH'
    | 'QUOTA_MISMATCH'
    | 'WEIGHT_MISMATCH'
    | 'PARITY_MISMATCH'
    | 'BALANCE_MISMATCH';
  dockId?: DockId;
  remainingCount?: number;
  expectedColor?: ItemColor;
  expectedColors?: ItemColor[];
  actualColor?: ItemColor;
  expectedIcon?: ItemIcon;
  expectedIcons?: ItemIcon[];
  actualIcon?: ItemIcon;
  expectedDamaged?: boolean;
  actualDamaged?: boolean;
  actualWeight?: number;
  minWeight?: number;
  maxWeight?: number;
  quota?: number;
  actualCount?: number;
  expectedParity?: SwitchyardParitySlot;
  actualSeqNum?: number;
  leftWeightSum?: number;
  rightWeightSum?: number;
  balanceTolerance?: number;
}

export interface SwitchyardAnimEvent {
  stepId: number;
  seq?: number;
  type: 'LOAD_SCANNER' | 'SEND_NEXT' | 'SCRAP_ITEM' | 'SWITCH_LEFT' | 'SWITCH_RIGHT' | 'COLLISION';
  item?: SwitchyardItem;
  dispatchedItem?: SwitchyardItem;
  targetDock?: DockId;
  toDock?: DockId;
  targetSlotIndex?: number;
  junction?: SwitchJunctionId;
  direction?: SwitchDirection;
  switchADir?: SwitchDirection;
  switchBDir?: SwitchDirection;
  switchCDir?: SwitchDirection;
  switchCount?: number;
  switchesTraversed?: SwitchJunctionId[];
}

export interface SwitchyardState {
  queue: SwitchyardItem[];
  initialQueue: SwitchyardItem[];
  docks: DockState[];
  initialDockSpecs: DockSpec[];
  switches: SwitchState[];
  scrapped: SwitchyardItem[];
  /** Alias of `scrapped` for v2 readers */
  scrap?: SwitchyardItem[];
  /** Scrap chute acceptance policy (default: 'damaged_only') */
  scrapRule?: SwitchyardScrapRule;
  /** Maximum non-overweight crate weight when `scrapRule === 'damaged_or_overweight'` (e.g. 20) */
  scrapMaxWeight?: number;
  /** Mirror of curriculum scrapChute.expectedDamagedOnly */
  scrapExpectedDamagedOnly?: boolean;
  /** Phase 3+ Switchyard puzzle mode (e.g. 'balance_scale' for cmp.M2) */
  mode?: SwitchyardMode;
  /** Maximum allowed |ΣLeft - ΣRight| difference in 'balance_scale' mode (default 0) */
  balanceTolerance?: number;
  /** Live weight sum on Left Pan (Dock A) */
  leftWeightSum?: number;
  /** Live weight sum on Right Pan (Dock B) */
  rightWeightSum?: number;
  /** Live Twin-Scale Fulcrum Balance Beam tilt in degrees (-15..+15) */
  beamTiltDeg?: number;
  /** Count of cars dispatched or scrapped so far from initialQueue (0-based) */
  dispatchedCount?: number;
  /** Optional Phase 4+ sparse tape cells when saved in Sandbox */
  tape?: Record<string, number>;
  /** True once the head wagon has left the intake depot and entered the scanner gate */
  scannerLoaded?: boolean;
  status: SimulationStatus;
  stepCount: number;
  lastFailureReason?: string;
  lastFailureDetail?: SwitchyardFailureDetail;
  lastRoutedDock?: DockId;
  lastAnimEvent?: SwitchyardAnimEvent;
  /** @deprecated Legacy test-only property preserved across createInitialSwitchyardState overrides */
  carsOnTrack?: any[];
}
