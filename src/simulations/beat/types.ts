import { Direction, SimulationStatus } from '../../types';

export const BEAT_GRID_SIZE = 8;

export const DEFAULT_BEAT_LED_COLOR = '#06b6d4'; // Cyan

export interface BeatColorSwatch {
  id: number;
  hex: string;
  label: string;
}

export const BEAT_LED_PALETTE: readonly BeatColorSwatch[] = [
  { id: 0, hex: '#06b6d4', label: 'Cyan' },
  { id: 1, hex: '#f43f5e', label: 'Rose' },
  { id: 2, hex: '#fbbf24', label: 'Amber' },
  { id: 3, hex: '#10b981', label: 'Emerald' },
  { id: 4, hex: '#a855f7', label: 'Purple' },
  { id: 5, hex: '#3b82f6', label: 'Blue' },
  { id: 6, hex: '#f97316', label: 'Orange' },
  { id: 7, hex: '#ec4899', label: 'Pink' },
];

export type BeatPresetName =
  | 'HEART'
  | 'STAR'
  | 'SMILE'
  | 'NOTE'
  | 'BOLT'
  | 'DIAMOND'
  | 'CHECK'
  | 'ROBOT';

export type BeatCueKind =
  | 'DRUM_KICK'
  | 'DRUM_SNARE'
  | 'DRUM_CLAP'
  | 'PLAY_CHIME'
  | 'PLAY_NOTE'
  | 'STAMP'
  | 'WAIT_BEAT'
  | 'CLEAR_LEDS'
  | 'LED_CHANGE'
  | 'SET_BEAT_DELAY';

export interface BeatTriggerEvent {
  kind: BeatCueKind;
  actionType: string;
  beatIndex: number;
  preset?: BeatPresetName;
  pitch?: number;
  durationBeats?: number;
  waitBeats?: number;
  delayMultiplier?: number;
  color?: string;
}

export interface BeatCursorState {
  /** 1-indexed column x in 1..8 (1 = leftmost column) */
  x: number;
  /** 1-indexed row y in 1..8 (1 = topmost row) */
  y: number;
  /** Heading direction on the 8x8 pad (defaults to 'EAST') */
  dir: Direction;
  /** Shown on BeatCanvas when cursor blocks are executed (Commit 17) */
  visible: boolean;
}

export interface BeatState {
  /** 8x8 RGB LED grid indexed as leds[row][col] (0..7 each); null = off, hex string = lit */
  leds: (string | null)[][];
  /** Current active LED color (persists across SET_LED_COLOR calls; defaults to Cyan) */
  activeColor: string;
  /** True once SET_LED_COLOR has explicitly set a custom color during the run */
  isColorCustomized: boolean;
  /** Monotonically increasing musical beat / event counter for Beat-Ring synchronization */
  beatIndex: number;
  /** Total simulation action ticks executed since reset */
  stepCount: number;
  /** Most recent triggered event for visual Beat-Ring pulse & Web Audio dispatch */
  lastTriggeredEvent: BeatTriggerEvent | null;
  /** Coordinate-free LED cursor state (starts at (1, 1) facing EAST, ready for Commit 17) */
  cursor: BeatCursorState;
  /** Whether Beat audio synthesis is muted */
  isMuted: boolean;
  /** Delay multiplier for non-sound, non-wait blocks (0 = instant, 1 = 1x global speed) */
  stepDelayMultiplier: number;
  /** Simulation execution status (Beat & Light lessons are open-ended and never fail) */
  status: SimulationStatus;
}
