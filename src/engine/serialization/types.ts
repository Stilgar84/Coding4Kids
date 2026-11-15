import { WorkspaceState, GridState, VariableName, toVariableName, BinaryOp, CodeBlock } from '../../types';
import { TurtleState } from '../../simulations/turtle/types';
import { PlaceholderHintCategory } from '../../data/curriculum/types';
import { BeatState } from '../../simulations/beat/types';
import { DepotState } from '../../simulations/depot/types';
import { SwitchyardState } from '../../simulations/switchyard/types';

// Format versions
export const FORMAT_VERSION = 1;
export const ENV_VERSION_GRID = 1;
export const ENV_VERSION_GRID_V2 = 2;
export const ENV_VERSION_GRID_V3 = 3;
export const ENV_VERSION_TURTLE = 1;
export const ENV_VERSION_BEAT = 1;
export const ENV_VERSION_DEPOT = 1;
export const ENV_VERSION_DEPOT_STATE = 2;
export const ENV_VERSION_DEPOT_QUEUE = 3;
export const ENV_VERSION_DEPOT_V4 = 4;
export const ENV_VERSION_SWITCHYARD = 1;
export const ENV_VERSION_SWITCHYARD_V2 = 2;
export const ENV_VERSION_PROFILE = 1;

// Environment IDs
export const ENV_ID_GENERIC = 0x00;
export const ENV_ID_GRID = 0x01;
export const ENV_ID_TURTLE = 0x02;
export const ENV_ID_BEAT = 0x03;
export const ENV_ID_LESSON = 0x04;
export const ENV_ID_SWITCHYARD = 0x05;
export const ENV_ID_PROFILE = 0x06;
export const ENV_ID_DEPOT = 0x07;

export type InnerLessonEnvIdName = 'generic' | 'grid' | 'turtle' | 'beat' | 'depot' | 'switchyard';
export type EnvIdName = InnerLessonEnvIdName | 'lesson';

// Scope IDs
export const SCOPE_ID_MAIN = 0x00;
export const SCOPE_ID_ON_TAP = 0x40;
export const SCOPE_ID_ON_KEY_UP = 0x41;
export const SCOPE_ID_ON_KEY_DOWN = 0x42;
export const SCOPE_ID_ON_KEY_LEFT = 0x43;
export const SCOPE_ID_ON_KEY_RIGHT = 0x44;
export const SCOPE_ID_ON_KEY_A = 0x45;
export const SCOPE_ID_ON_KEY_B = 0x46;
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
export const OP_WHILE = 0x0a;
export const OP_END_WHILE = 0x0b;
// 0x0C..0x0E reserved for future Tape/Universal opcodes

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
export const MASK_ELSE_HAS_COND = 0x20; // Bit 5 of block header byte (ELSE IF condition)

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

export const SENSOR_REF_FLAG = 0x80;
export const COLOR_LITERAL_FLAG = 0x40;
export const COLOR_LITERAL_PALETTE = [
  'black',   // 0 (0x40)
  'red',     // 1 (0x41)
  'blue',    // 2 (0x42)
  'green',   // 3 (0x43)
  'amber',   // 4 (0x44) — 'yellow' aliases here
  'purple',  // 5 (0x45)
  'pink',    // 6 (0x46)
  'cyan',    // 7 (0x47)
  'orange',  // 8 (0x48)
  'white',   // 9 (0x49)
] as const;

export const SERIALIZED_SENSOR_IDS = [
  '$x',
  '$y',
  '$heading',
  '$tileDial',
  '$input',
  '$randCoin',
  '$randD4',
  '$randD6',
  '$randD8',
  '$randD20',
  '$rand01',
  '$randomColor',
  '$cellValue',
  '$cellColor',
  '$cellEmpty',
  '$headPos',
  '$tapeLength',
  '$frame',
  '$time',
  '$pointerX',
  '$pointerY',
  '$pointerDown',
  '$recv',
  '$heldValue',
  '$topValue',
  '$heldColor',
  '$topColor',
  '$stationLen',
  '$itemWeight',
  '$itemColor',
  '$dockQuota',
  '$dockCount',
  '$cursorX',
  '$cursorY',
  '$beatIndex',
] as const;

export const SERIALIZED_SENSOR_BYTE_MAP: Record<string, number> = {
  $x: 0x80,
  $y: 0x81,
  $heading: 0x82,
  $tileDial: 0x83,
  $input: 0x84,
  $randCoin: 0x85,
  $randD4: 0x86,
  $randD6: 0x87,
  $randD8: 0x88,
  $randD20: 0x89,
  $rand01: 0x8a,
  $randomColor: 0x8b,
  $cellValue: 0x8c,
  $cellColor: 0x8d,
  $cellEmpty: 0x8e,
  $headPos: 0x8f,
  $tapeLength: 0x90,
  $frame: 0x91,
  $time: 0x92,
  $pointerX: 0x93,
  $pointerY: 0x94,
  $pointerDown: 0x95,
  $recv: 0x96,
  $heldValue: 0xa0,
  $topValue: 0xa1,
  $heldColor: 0xa2,
  $topColor: 0xa3,
  $stationLen: 0xa4,
  $itemWeight: 0xa8,
  $itemColor: 0xa9,
  $dockQuota: 0xaa,
  $dockCount: 0xab,
  $cursorX: 0xb0,
  $cursorY: 0xb1,
  $beatIndex: 0xb2,
};

export const SENSOR_BYTE_TO_ID: Record<number, string> = {
  0x80: '$x',
  0x81: '$y',
  0x82: '$heading',
  0x83: '$tileDial',
  0x84: '$input',
  0x85: '$randCoin',
  0x86: '$randD4',
  0x87: '$randD6',
  0x88: '$randD8',
  0x89: '$randD20',
  0x8a: '$rand01',
  0x8b: '$randomColor',
  0x8c: '$cellValue',
  0x8d: '$cellColor',
  0x8e: '$cellEmpty',
  0x8f: '$headPos',
  0x90: '$tapeLength',
  0x91: '$frame',
  0x92: '$time',
  0x93: '$pointerX',
  0x94: '$pointerY',
  0x95: '$pointerDown',
  0x96: '$recv',
  0xa0: '$heldValue',
  0xa1: '$topValue',
  0xa2: '$heldColor',
  0xa3: '$topColor',
  0xa4: '$stationLen',
  0xa8: '$itemWeight',
  0xa9: '$itemColor',
  0xaa: '$dockQuota',
  0xab: '$dockCount',
  0xb0: '$cursorX',
  0xb1: '$cursorY',
  0xb2: '$beatIndex',
};

export const ID_TO_SENSOR_BYTE = SERIALIZED_SENSOR_BYTE_MAP;

export function parseSensorRef(val: unknown): { base: string; param?: string } | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  const match = /^(\$[a-zA-Z0-9_]+)(?:\s*\[([^\]]+)\]|:([a-zA-Z0-9_]+))?$/.exec(trimmed);
  if (!match) return null;
  const base = match[1];
  if (!(SERIALIZED_SENSOR_IDS as readonly string[]).includes(base)) return null;
  const param = (match[2] ?? match[3])?.trim();
  return param ? { base, param } : { base };
}

export function sensorNameToByte(name: string): number {
  const parsed = parseSensorRef(name);
  const base = parsed ? parsed.base : name;
  return SERIALIZED_SENSOR_BYTE_MAP[base] ?? 0x80;
}

export function byteToSensorName(byte: number): string {
  return SENSOR_BYTE_TO_ID[byte] ?? SENSOR_BYTE_TO_ID[byte | 0x80] ?? '$x';
}

export function isSensorRefString(val: unknown): val is `$${string}` {
  return parseSensorRef(val) !== null;
}

/**
 * Resolves `'color:red'`, `'red'`, `'yellow'` (-> index 4 `'amber'`), etc. to a palette index 0..9,
 * or `-1` if not a recognized color literal.
 */
export function colorLiteralNameToIdx(val: unknown): number {
  if (typeof val !== 'string') return -1;
  const trimmed = val.trim().toLowerCase();
  const normalized = (trimmed.startsWith('color:') ? trimmed.slice(6) : trimmed) === 'yellow'
    ? 'amber'
    : (trimmed.startsWith('color:') ? trimmed.slice(6) : trimmed);
  return COLOR_LITERAL_PALETTE.indexOf(normalized as (typeof COLOR_LITERAL_PALETTE)[number]);
}

export function isColorLiteralString(val: unknown): boolean {
  return colorLiteralNameToIdx(val) >= 0;
}

export function encodeVarOrSensorIndex(name: string): number {
  const parsed = parseSensorRef(name);
  if (parsed) {
    return SERIALIZED_SENSOR_BYTE_MAP[parsed.base] ?? 0x80;
  }
  const colorIdx = colorLiteralNameToIdx(name);
  if (colorIdx >= 0) {
    return COLOR_LITERAL_FLAG | colorIdx;
  }
  const normalizedVar = name.length === 2 && name.startsWith('$') ? name.slice(1) : name;
  return varNameToIndex(normalizedVar);
}

export function decodeVarOrSensorIndex(byte: number): string {
  if ((byte & SENSOR_REF_FLAG) !== 0) {
    return byteToSensorName(byte);
  }
  if ((byte & COLOR_LITERAL_FLAG) !== 0) {
    const idx = byte & 0x3f;
    return `color:${COLOR_LITERAL_PALETTE[idx] ?? 'black'}`;
  }
  return indexToVarName(byte);
}

// Grid World Opcodes (envId = 0x01, envVersion = 1..2)
export const OP_GRID_MOVE_FWD = 0x10;
export const OP_GRID_MOVE_BACK = 0x11;
export const OP_GRID_TURN_LEFT = 0x12;
export const OP_GRID_TURN_RIGHT = 0x13;
export const OP_GRID_PICK_UP = 0x14;
export const OP_GRID_USE_DROP = 0x15;

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
export const OP_TURTLE_WAIT = 0x1c;
export const OP_TURTLE_SET_INSTANT = 0x1d;
export const OP_TURTLE_CLEAR_CANVAS = 0x1e;
export const OP_TURTLE_TELEPORT = 0x1f;

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
  '#f97316', // 8: Orange
  '#ffffff', // 9: White
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
export const OP_BEAT_SET_DELAY = 0x1e;
export const OP_BEAT_WAIT_DURATION = 0x1f;

// Crate Depot Opcodes (envId = 0x07, envVersion = 1..3)
export const OP_DEPOT_MOVE_TO = 0x10;
export const OP_DEPOT_GRAB = 0x11;
export const OP_DEPOT_PLACE = 0x12;
export const OP_DEPOT_SEND_OUT = 0x13;
export const OP_DEPOT_SEND_GATE = 0x14;

// Switchyard Opcodes (envId = 0x05, envVersion = 1)
export const OP_SWITCHYARD_SWITCH_LEFT = 0x10;
export const OP_SWITCHYARD_SWITCH_RIGHT = 0x11;
export const OP_SWITCHYARD_SEND_NEXT = 0x12;
export const OP_SWITCHYARD_SCRAP_ITEM = 0x13;

export interface ImportResult {
  success: boolean;
  formatVersion?: number;
  envId?: EnvIdName;
  envVersion?: number;
  innerEnvId?: InnerLessonEnvIdName;
  lessonId?: string;
  lessonVersion?: number;
  workspace?: WorkspaceState;
  gridState?: GridState;
  turtleState?: TurtleState;
  beatState?: BeatState;
  depotState?: DepotState;
  switchyardState?: SwitchyardState;
  error?: string;
}
