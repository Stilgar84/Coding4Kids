import { WorkspaceState, GridState, VariableName, toVariableName, BinaryOp, CodeBlock } from '../../types';
import { TurtleState } from '../../simulations/turtle/types';
import { PlaceholderHintCategory } from '../../data/curriculum/types';
import { BeatState } from '../../simulations/beat/types';

// Format versions
export const FORMAT_VERSION = 1;
export const ENV_VERSION_GRID = 1;
export const ENV_VERSION_TURTLE = 1;
export const ENV_VERSION_BEAT = 1;

// Environment IDs
export const ENV_ID_GENERIC = 0x00;
export const ENV_ID_GRID = 0x01;
export const ENV_ID_TURTLE = 0x02;
export const ENV_ID_BEAT = 0x03;

export type EnvIdName = 'generic' | 'grid' | 'turtle' | 'beat';

// Scope IDs
export const SCOPE_ID_MAIN = 0x00;
export const SCOPE_ID_SUBFUNCTION_BASE = 0x80;
export const SCOPE_ID_F1 = 0x81;
export const SCOPE_ID_F2 = 0x82;
export const SCOPE_ID_F3 = 0x83;

// Universal Control Flow Opcodes (0x00..0x0F)
export const OP_LOOP_START = 0x01;
export const OP_LOOP_END = 0x02;
export const OP_CALL_FN = 0x03;
export const OP_IF = 0x04;
export const OP_ELSE = 0x05;
export const OP_END_IF = 0x06;
export const OP_VAR_ASSIGN = 0x07;
export const OP_VAR_OP = 0x08;
export const OP_PLACEHOLDER = 0x09;

export const PLACEHOLDER_HINT_CATEGORIES: readonly PlaceholderHintCategory[] = [
  'any',         // 0
  'motion',      // 1
  'turn',        // 2
  'item',        // 3
  'loop',        // 4
  'function',    // 5
  'conditional', // 6
  'sensor',      // 7
  'variable',    // 8
  'operator',    // 9
  'socket',      // 10
];

export function placeholderHintCategoryToCode(category?: unknown, rawCode?: unknown): number {
  const safeRaw =
    typeof rawCode === 'number' && Number.isInteger(rawCode) && rawCode >= 0
      ? rawCode
      : undefined;

  if (typeof category === 'string') {
    const idx = PLACEHOLDER_HINT_CATEGORIES.indexOf(category as PlaceholderHintCategory);
    if (idx > 0) {
      return idx;
    }
    if (idx === 0) {
      return safeRaw !== undefined && safeRaw >= PLACEHOLDER_HINT_CATEGORIES.length ? safeRaw : 0;
    }
    return safeRaw ?? 0;
  }

  return safeRaw ?? 0;
}

export function codeToPlaceholderHintCategory(code: number): {
  hintCategory: PlaceholderHintCategory;
  rawHintCategoryCode?: number;
} {
  if (Number.isInteger(code) && code >= 0 && code < PLACEHOLDER_HINT_CATEGORIES.length) {
    return { hintCategory: PLACEHOLDER_HINT_CATEGORIES[code] };
  }
  return {
    hintCategory: 'any',
    rawHintCategoryCode: Math.max(0, Math.trunc(code)),
  };
}

export function getPlaceholderHintCategory(block?: CodeBlock | null): PlaceholderHintCategory {
  if (!block || block.type !== 'PLACEHOLDER') return 'any';
  const cat = block.params?.hintCategory;
  if (typeof cat === 'string' && PLACEHOLDER_HINT_CATEGORIES.includes(cat as PlaceholderHintCategory)) {
    return cat as PlaceholderHintCategory;
  }
  return 'any';
}

// Block Header Bitmasks
export const MASK_HAS_VAR_PARAM = 0x80; // Bit 7 of block header byte
export const MASK_HAS_REP = 0x40;       // Bit 6 of block header byte

// 2-Bit Operand Types for VAR_ASSIGN and VAR_OP
export const OPERAND_TYPE_VAR = 0;     // 00: Variable (1 byte: 0..25)
export const OPERAND_TYPE_POS_INT = 1; // 01: Positive / non-negative integer (VLE)
export const OPERAND_TYPE_NEG_INT = 2; // 10: Negative integer (VLE(abs(n)))
export const OPERAND_TYPE_DOUBLE = 3;  // 11: Double (8 bytes IEEE 754 float64)

export const BINARY_OPS: readonly BinaryOp[] = [
  '+',  // 0x00
  '-',  // 0x01
  '*',  // 0x02
  '/',  // 0x03
  '%',  // 0x04
  '==', // 0x05
  '!=', // 0x06
  '<',  // 0x07
  '<=', // 0x08
  '>',  // 0x09
  '>=', // 0x0A
  '&&', // 0x0B
  '||', // 0x0C
];

export function opToByte(op: BinaryOp): number {
  const idx = BINARY_OPS.indexOf(op);
  return idx >= 0 ? idx : 0;
}

export function byteToOp(byte: number): BinaryOp {
  return BINARY_OPS[byte] ?? '+';
}

export function varNameToIndex(name: VariableName | string): number {
  const ch = name.toLowerCase().charCodeAt(0);
  return Math.max(0, Math.min(25, ch - 97));
}

export function indexToVarName(idx: number): VariableName {
  const safeIdx = Math.max(0, Math.min(25, idx));
  return toVariableName(String.fromCharCode(97 + safeIdx));
}

// Grid World Opcodes (envId = 0x01, envVersion = 1)
export const OP_GRID_MOVE_FWD = 0x10;
export const OP_GRID_MOVE_BACK = 0x11;
export const OP_GRID_TURN_LEFT = 0x12;
export const OP_GRID_TURN_RIGHT = 0x13;

// Turtle World Opcodes (envId = 0x02, envVersion = 1)
export const OP_TURTLE_FORWARD = 0x10;
export const OP_TURTLE_BACKWARD = 0x11;
export const OP_TURTLE_TURN_LEFT = 0x12;
export const OP_TURTLE_TURN_RIGHT = 0x13;
export const OP_TURTLE_ARC_LEFT = 0x14;
export const OP_TURTLE_ARC_RIGHT = 0x15;
export const OP_TURTLE_PEN_UP = 0x16;
export const OP_TURTLE_PEN_DOWN = 0x17;
export const OP_TURTLE_SET_PEN_COLOR = 0x18;
export const OP_TURTLE_SET_PEN_WIDTH = 0x19;
export const OP_TURTLE_FORWARD_LEN = 0x1a;
export const OP_TURTLE_BACKWARD_LEN = 0x1b;

// Turtle Color Palette
export const TURTLE_COLOR_PALETTE: readonly string[] = [
  '#0f172a', // 0: Black
  '#ef4444', // 1: Red
  '#3b82f6', // 2: Blue
  '#10b981', // 3: Green
  '#f59e0b', // 4: Amber
  '#8b5cf6', // 5: Purple
  '#ec4899', // 6: Pink
  '#06b6d4', // 7: Cyan
];

// Beat & Light Matrix Opcodes (envId = 0x03, envVersion = 1)
// Tier 1 (Commit 10)
export const OP_BEAT_DRUM_KICK = 0x10;
export const OP_BEAT_DRUM_SNARE = 0x11;
export const OP_BEAT_DRUM_CLAP = 0x12;
export const OP_BEAT_PLAY_CHIME = 0x13;
export const OP_BEAT_STAMP_PRESET = 0x14;
export const OP_BEAT_WAIT_BEAT = 0x15;
export const OP_BEAT_CLEAR_LEDS = 0x16;
// Tier 2 & Tier 3 reserved opcodes (Commits 13 & 17)
export const OP_BEAT_PLAY_NOTE = 0x17;
export const OP_BEAT_SET_LED_COLOR = 0x18;
export const OP_BEAT_LIGHT_ROW = 0x19;
export const OP_BEAT_LIGHT_COL = 0x1a;
export const OP_BEAT_LIGHT_PIXEL = 0x1b;
export const OP_BEAT_CURSOR_STEP = 0x1c;
export const OP_BEAT_CURSOR_TURN = 0x1d;

export interface ImportResult {
  success: boolean;
  formatVersion?: number;
  envId?: EnvIdName;
  envVersion?: number;
  workspace?: WorkspaceState;
  gridState?: GridState;
  turtleState?: TurtleState;
  beatState?: BeatState;
  error?: string;
}
