import { SimulationStatus } from '../../types';

// ─── Color / Cargo Palettes ────────────────────────────────────────────────

export type ItemColor = 'RED' | 'BLUE' | 'GREEN' | 'YELLOW';
export type ItemIcon = 'CRATE' | 'BATTERY' | 'GEAR' | 'CRYSTAL';

export const ITEM_COLORS: readonly { id: ItemColor; hex: string; label: string; symbol: string }[] =
  [
    { id: 'RED',    hex: '#ef4444', label: 'Red',    symbol: '▲' },
    { id: 'BLUE',   hex: '#3b82f6', label: 'Blue',   symbol: '■' },
    { id: 'GREEN',  hex: '#10b981', label: 'Green',  symbol: '●' },
    { id: 'YELLOW', hex: '#f59e0b', label: 'Yellow', symbol: '◆' },
  ];

export const ITEM_ICONS: readonly { id: ItemIcon; label: string; emoji: string }[] = [
  { id: 'CRATE',   label: 'Crate',   emoji: '📦' },
  { id: 'BATTERY', label: 'Battery', emoji: '🔋' },
  { id: 'GEAR',    label: 'Gear',    emoji: '⚙️' },
  { id: 'CRYSTAL', label: 'Crystal', emoji: '💎' },
];

export const ITEM_COLOR_INDEX: Record<ItemColor, number> = {
  RED: 0, BLUE: 1, GREEN: 2, YELLOW: 3,
};
export const ITEM_ICON_INDEX: Record<ItemIcon, number> = {
  CRATE: 0, BATTERY: 1, GEAR: 2, CRYSTAL: 3,
};

export const ITEM_COLOR_FROM_INDEX: ItemColor[] = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
export const ITEM_ICON_FROM_INDEX: ItemIcon[] = ['CRATE', 'BATTERY', 'GEAR', 'CRYSTAL'];

// ─── Track Items ───────────────────────────────────────────────────────────

export interface SwitchyardItem {
  color: ItemColor;
  icon: ItemIcon;
  damaged: boolean;
  /** Reserved for M8: weight/value (1..99). Defaults to 1. */
  weight?: number;
}

// ─── Docks & Switches ─────────────────────────────────────────────────────

export type DockId = 'DOCK_A' | 'DOCK_B' | 'DOCK_C' | 'SCRAP';

/** A receiving dock's acceptance constraints (painted on the dock floor). */
export interface DockSpec {
  id: DockId;
  /** If set, dock only accepts items of this color. */
  acceptColor?: ItemColor;
  /** If set, dock only accepts items with this icon. */
  acceptIcon?: ItemIcon;
  /** If set, only intact (!damaged) items are accepted. */
  rejectDamaged?: boolean;
  /** Optional quota (Max items to accept, e.g. for M8). */
  quota?: number;
}

/** Current runtime state of a receiving dock. */
export interface DockState {
  spec: DockSpec;
  items: SwitchyardItem[];
  /** True if a wrong/unacceptable item was routed here (collision indicator). */
  mismatch: boolean;
}

export type SwitchDirection = 'LEFT' | 'RIGHT';

/** A track junction switch (up to 2: A and B). */
export interface SwitchState {
  /** 'A' | 'B' */
  id: string;
  direction: SwitchDirection;
}

// ─── Full Environment State ────────────────────────────────────────────────

export type SwitchyardFailureReason =
  | 'WRONG_DOCK'
  | 'DAMAGED_ITEM_TO_DOCK'
  | 'UNSORTED_ITEMS_REMAIN'
  | 'NO_ITEM_AT_SCANNER';

export interface SwitchyardState {
  /** All items yet to be processed, index 0 = next at scanner. */
  queue: SwitchyardItem[];
  /** Snapshot of original queue for resetState. */
  initialQueue: SwitchyardItem[];
  /** Items diverted to the SCRAP chute. */
  scrapped: SwitchyardItem[];
  /** Runtime state of each receiving dock. */
  docks: DockState[];
  /** Initial dock specs (restored on resetState). */
  initialDockSpecs: DockSpec[];
  /** Track switches (1 or 2 switches). */
  switches: SwitchState[];
  /** Initial switch directions (restored on resetState). */
  initialSwitchDirections: SwitchDirection[];
  /** Failure reason for collision display. */
  lastFailureReason: SwitchyardFailureReason | null;
  status: SimulationStatus;
  stepCount: number;
}
