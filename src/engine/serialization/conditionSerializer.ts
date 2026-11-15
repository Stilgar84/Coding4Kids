/**
 * conditionSerializer.ts
 *
 * Encodes and decodes `ConditionExpr` trees using a compact prefix-tree binary format,
 * as specified in §3.1.2 and §7.1.2 of `docs/binary_format.md`.
 *
 * Tag byte layout (single uint8):
 *   0x01..0x08  Grid Boolean Sensors
 *   0x10..0x13  Switchyard Boolean Sensors
 *   0x18..0x1C  Depot Boolean & Color-Match Sensors
 *   0x20..0x22  Boolean Combinators (NOT, AND, OR)
 *   0x30        Reserved for Module 7–8 typed comparisons
 *
 * Grid sensors with param (tileColor 0x07: colorIdx uint8)
 * Switchyard sensors with param (itemColor 0x12: colorIdx; itemIcon 0x13: iconIdx)
 * Depot sensors with param (stationEmpty 0x18: stationCode; heldColor 0x1B: colorIdx; topColor 0x1C: colorIdx)
 */

import type { ConditionCompareOp, ConditionExpr, ConditionSensorType } from '../../data/curriculum/types';
import { isTypedValue, isVariableName, SimulationStatus, TypedValue, VariableRuntimeValue } from '../../types';
import type { BinaryReader } from './binaryReader';
import type { BinaryWriter } from './binaryWriter';
import {
  COLOR_LITERAL_FLAG,
  ENV_ID_DEPOT,
  OPERAND_TYPE_DOUBLE,
  OPERAND_TYPE_NEG_INT,
  OPERAND_TYPE_POS_INT,
  OPERAND_TYPE_VAR,
  colorLiteralNameToIdx,
  decodeVarOrSensorIndex,
  encodeVarOrSensorIndex,
  isColorLiteralString,
  isSensorRefString,
  parseSensorRef,
} from './types';

// ---------------------------------------------------------------------------
// Tag constants
// ---------------------------------------------------------------------------

// Grid sensors
export const COND_TAG_PATH_AHEAD       = 0x01; // pathAhead
export const COND_TAG_PATH_LEFT        = 0x02; // pathLeft
export const COND_TAG_PATH_RIGHT       = 0x03; // pathRight
export const COND_TAG_ITEM_HERE        = 0x04; // itemHere
export const COND_TAG_CARRYING_ITEM    = 0x05; // carryingItem
export const COND_TAG_AT_GOAL          = 0x06; // atGoal
export const COND_TAG_TILE_COLOR       = 0x07; // tileColor + colorIdx:uint8
export const COND_TAG_UNVISITED_AHEAD  = 0x08; // unvisitedAhead (reserved M11)

// Switchyard sensors
export const COND_TAG_HAS_NEXT_ITEM    = 0x10; // hasNextItem
export const COND_TAG_ITEM_DAMAGED_SY  = 0x11; // itemDamaged (Switchyard)
export const COND_TAG_ITEM_COLOR       = 0x12; // itemColor + colorIdx:uint8
export const COND_TAG_ITEM_ICON        = 0x13; // itemIcon + iconIdx:uint8

// Depot sensors
export const COND_TAG_STATION_EMPTY    = 0x18; // stationEmpty + stationCode:uint8
export const COND_TAG_HAS_ITEM         = 0x19; // hasItem
export const COND_TAG_ITEM_DAMAGED_D   = 0x1a; // itemDamaged (Depot)
export const COND_TAG_HELD_COLOR       = 0x1b; // heldColor + colorIdx:uint8
export const COND_TAG_TOP_COLOR        = 0x1c; // topColor + colorIdx:uint8

// Boolean combinators
export const COND_TAG_NOT              = 0x20; // NOT(inner)
export const COND_TAG_AND              = 0x21; // AND(left, right)
export const COND_TAG_OR               = 0x22; // OR(left, right)

// Turtle, Beat & Interactive sensors
export const COND_TAG_INSIDE_CANVAS    = 0x28; // insideCanvas (Turtle)
export const COND_TAG_CURSOR_AT_EDGE   = 0x2a; // cursorAtEdge (Beat)
export const COND_TAG_KEY_HELD         = 0x2e; // keyHeld + keyCode:uint8 (0=UP, 1=DOWN, 2=LEFT, 3=RIGHT, 4=A, 5=B)

export const KEY_HELD_CODES: Record<string, number> = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
  A: 4,
  B: 5,
};

export const KEY_HELD_CODE_NAMES = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B'] as const;

// Typed comparison expression
export const COND_TAG_CMP              = 0x30; // cmpHeader:uint8 + left operand + right operand
export const COND_TAG_CMP_RESERVED     = COND_TAG_CMP;

// ---------------------------------------------------------------------------
// Sensor name → tag mapping
// ---------------------------------------------------------------------------

/**
 * Returns the COND_TAG for a given sensor name and optional param.
 * The caller is responsible for which COND_TAG is used in context
 * (e.g. `itemDamaged` resolves to Switchyard vs Depot tag based on surrounding logic,
 *  but we need to store both since the tag alone disambiguates).
 *
 * To disambiguate sensors that appear in multiple environments (like `itemDamaged`),
 * we rely on the PaletteConfig / simId context when building the ConditionExpr at edit time.
 * During binary serialization the tag byte alone is fully self-describing.
 */
export const GRID_SENSOR_TAGS: Record<string, number> = {
  pathAhead:     COND_TAG_PATH_AHEAD,
  pathLeft:      COND_TAG_PATH_LEFT,
  pathRight:     COND_TAG_PATH_RIGHT,
  itemHere:      COND_TAG_ITEM_HERE,
  carryingItem:  COND_TAG_CARRYING_ITEM,
  atGoal:        COND_TAG_AT_GOAL,
  tileColor:     COND_TAG_TILE_COLOR,       // + colorIdx param
  unvisitedAhead:COND_TAG_UNVISITED_AHEAD,
};

export const SWITCHYARD_SENSOR_TAGS: Record<string, number> = {
  hasNextItem:   COND_TAG_HAS_NEXT_ITEM,
  itemDamagedSY: COND_TAG_ITEM_DAMAGED_SY,  // disambiguation key
  itemColor:     COND_TAG_ITEM_COLOR,        // + colorIdx param
  itemIcon:      COND_TAG_ITEM_ICON,         // + iconIdx param
};

export const DEPOT_SENSOR_TAGS: Record<string, number> = {
  stationEmpty:  COND_TAG_STATION_EMPTY,     // + stationCode param
  hasItem:       COND_TAG_HAS_ITEM,
  itemDamagedD:  COND_TAG_ITEM_DAMAGED_D,    // disambiguation key (Depot v1-v3 legacy)
  heldColor:     COND_TAG_HELD_COLOR,        // + colorIdx param
  topColor:      COND_TAG_TOP_COLOR,         // + colorIdx param
};

export const TURTLE_SENSOR_TAGS: Record<string, number> = {
  insideCanvas:  COND_TAG_INSIDE_CANVAS,
};

export const BEAT_SENSOR_TAGS: Record<string, number> = {
  cursorAtEdge:  COND_TAG_CURSOR_AT_EDGE,
};

/**
 * Station codes for stationEmpty:
 *   0 = CURRENT, 1 = STACK_1, 2 = STACK_2, 3 = STACK_3, 4 = QUEUE, 5 = INPUT, 6 = PHYSICAL_TAPE (alias TAPE)
 */
export const STATION_CODES: Record<string, number> = {
  CURRENT: 0,
  STACK_1: 1,
  STACK_2: 2,
  STACK_3: 3,
  QUEUE:   4,
  INPUT:   5,
  PHYSICAL_TAPE: 6,
  TAPE:    6,
};
export const STATION_CODE_NAMES: string[] = [
  'CURRENT',
  'STACK_1',
  'STACK_2',
  'STACK_3',
  'QUEUE',
  'INPUT',
  'PHYSICAL_TAPE',
];

/**
 * Icon codes for itemIcon:
 *   0 = crate, 1 = battery, 2 = gear, 3 = crystal
 */
export const ICON_CODES: Record<string, number> = {
  crate:   0,
  battery: 1,
  gear:    2,
  crystal: 3,
};
export const ICON_CODE_NAMES: string[] = ['crate', 'battery', 'gear', 'crystal'];

// ---------------------------------------------------------------------------
// PALETTE_COLORS (0..9) — same as TURTLE_COLOR_PALETTE indices
// ---------------------------------------------------------------------------
export const PALETTE_COLOR_NAMES: string[] = [
  'black',   // 0
  'red',     // 1
  'blue',    // 2
  'green',   // 3
  'amber',   // 4
  'purple',  // 5
  'pink',    // 6
  'cyan',    // 7
  'orange',  // 8
  'white',   // 9
];

export function colorNameToIdx(name: string): number {
  const literalIdx = colorLiteralNameToIdx(name);
  if (literalIdx >= 0) return literalIdx;
  const raw = name.trim().toLowerCase();
  const mapped = raw === 'yellow' ? 'amber' : raw;
  const idx = PALETTE_COLOR_NAMES.indexOf(mapped);
  return idx >= 0 ? idx : 0;
}
function colorIdxToName(idx: number): string {
  return PALETTE_COLOR_NAMES[idx] ?? 'red';
}

export interface ConditionCodecContext {
  envByte?: number;
  envVersion?: number;
}

const CMP_OP_TO_CODE: Record<string, number> = {
  '=': 0,
  '==': 0,
  '!=': 1,
  '<': 2,
  '<=': 3,
  '>': 4,
  '>=': 5,
};

const CMP_CODE_TO_OP: ConditionCompareOp[] = ['=', '!=', '<', '<=', '>', '>='];

function encodeStationParamCode(param?: string): number {
  if (!param) return 0xff;
  const up = param.trim().toUpperCase().replace(/\s+/g, '_');
  if (STATION_CODES[up] !== undefined) return STATION_CODES[up];
  const n = Number(up);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return 0;
}

function decodeStationParamCode(code: number): string | undefined {
  if (code === 0xff) return undefined;
  return STATION_CODE_NAMES[code] ?? 'CURRENT';
}

function encodeDockParamCode(param?: string): number {
  if (!param) return 0xff;
  const up = param.trim().toUpperCase();
  if (up === 'A' || up === 'DOCK_A') return 0x10;
  if (up === 'B' || up === 'DOCK_B') return 0x11;
  if (up === 'C' || up === 'DOCK_C') return 0x12;
  const n = Number(up);
  if (Number.isInteger(n) && n >= 0 && n <= 2) return n;
  return 0;
}

function decodeDockParamCode(code: number): string | undefined {
  if (code === 0xff) return undefined;
  if (code === 0x10) return 'A';
  if (code === 0x11) return 'B';
  if (code === 0x12) return 'C';
  return String(code & 0x03);
}

export function isVarOrSensorVal(val: unknown): boolean {
  if (isTypedValue(val)) return val.type === 'color';
  return (
    isVariableName(val) ||
    isSensorRefString(val) ||
    isColorLiteralString(val) ||
    (typeof val === 'string' && /^\$?[a-z]$/.test(val))
  );
}

export function getOperandType(val: any): number {
  if (val === undefined || val === null) return OPERAND_TYPE_POS_INT;
  if (isTypedValue(val)) {
    if (val.type === 'color') return OPERAND_TYPE_VAR;
    return getOperandType(val.value);
  }
  if (isVarOrSensorVal(val)) {
    return OPERAND_TYPE_VAR;
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return OPERAND_TYPE_POS_INT;
  if (Number.isInteger(num)) {
    return num >= 0 ? OPERAND_TYPE_POS_INT : OPERAND_TYPE_NEG_INT;
  }
  return OPERAND_TYPE_DOUBLE;
}

export function writeOperandData(writer: BinaryWriter, type: number, val: any): void {
  if (type === OPERAND_TYPE_VAR) {
    if (isTypedValue(val) && val.type === 'color') {
      const idx = Math.max(0, colorLiteralNameToIdx(val.value));
      writer.writeUint8(COLOR_LITERAL_FLAG | idx);
      return;
    }
    const strVal = String(val);
    const parsed = parseSensorRef(strVal);
    if (parsed && parsed.param) {
      if (parsed.base === '$topValue') {
        writer.writeUint8(0xa5);
        writer.writeUint8(encodeStationParamCode(parsed.param));
        return;
      }
      if (parsed.base === '$topColor') {
        writer.writeUint8(0xa6);
        writer.writeUint8(encodeStationParamCode(parsed.param));
        return;
      }
    }
    const firstByte = encodeVarOrSensorIndex(strVal);
    writer.writeUint8(firstByte);
    if (firstByte === 0xa4) {
      writer.writeUint8(encodeStationParamCode(parsed?.param));
    } else if (firstByte === 0xaa || firstByte === 0xab) {
      writer.writeUint8(encodeDockParamCode(parsed?.param));
    } else if (firstByte === 0x96) {
      const ch = parsed?.param !== undefined ? Math.max(0, Math.min(2, Number(parsed.param) || 0)) : 0xff;
      writer.writeUint8(ch);
    }
  } else if (type === OPERAND_TYPE_POS_INT) {
    const raw = isTypedValue(val) && val.type === 'number' ? val.value : val;
    const num = typeof raw === 'number' ? raw : Number(raw);
    writer.writeVLE(Math.max(0, Math.round(num)));
  } else if (type === OPERAND_TYPE_NEG_INT) {
    const raw = isTypedValue(val) && val.type === 'number' ? val.value : val;
    const num = typeof raw === 'number' ? raw : Number(raw);
    writer.writeVLE(Math.abs(Math.round(num)));
  } else {
    const raw = isTypedValue(val) && val.type === 'number' ? val.value : val;
    const num = typeof raw === 'number' ? raw : Number(raw);
    writer.writeFloat64(num);
  }
}

export function readOperandData(reader: BinaryReader, type: number): any {
  if (type === OPERAND_TYPE_VAR) {
    const firstByte = reader.readUint8();
    if (firstByte === 0xa5) {
      const code = reader.hasMore ? reader.readUint8() : 0xff;
      const st = decodeStationParamCode(code);
      return st ? `$topValue[${st}]` : '$topValue';
    }
    if (firstByte === 0xa6) {
      const code = reader.hasMore ? reader.readUint8() : 0xff;
      const st = decodeStationParamCode(code);
      return st ? `$topColor[${st}]` : '$topColor';
    }
    if (firstByte === 0xa4) {
      const code = reader.hasMore ? reader.readUint8() : 0xff;
      const st = decodeStationParamCode(code);
      return st ? `$stationLen[${st}]` : '$stationLen';
    }
    if (firstByte === 0xaa) {
      const code = reader.hasMore ? reader.readUint8() : 0xff;
      const d = decodeDockParamCode(code);
      return d ? `$dockQuota[${d}]` : '$dockQuota';
    }
    if (firstByte === 0xab) {
      const code = reader.hasMore ? reader.readUint8() : 0xff;
      const d = decodeDockParamCode(code);
      return d ? `$dockCount[${d}]` : '$dockCount';
    }
    if (firstByte === 0x96) {
      const code = reader.hasMore ? reader.readUint8() : 0xff;
      return code === 0xff ? '$recv' : `$recv[${code & 0x03}]`;
    }
    return decodeVarOrSensorIndex(firstByte);
  } else if (type === OPERAND_TYPE_POS_INT) {
    return reader.readVLE();
  } else if (type === OPERAND_TYPE_NEG_INT) {
    return -reader.readVLE();
  } else {
    return reader.readFloat64();
  }
}

// ---------------------------------------------------------------------------
// writeConditionExpr
// ---------------------------------------------------------------------------

/**
 * Serializes a `ConditionExpr` tree into `writer` using the prefix-tree tag encoding.
 * Called immediately after writing OP_IF (0x04) or OP_WHILE (0x0A) header bytes,
 * and after writing the ELSE_IF header byte (0x25).
 */
export function writeConditionExpr(
  writer: BinaryWriter,
  expr: ConditionExpr,
  ctx?: ConditionCodecContext
): void {
  if (expr.kind === 'not') {
    writer.writeUint8(COND_TAG_NOT);
    writeConditionExpr(writer, expr.operand, ctx);
    return;
  }
  if (expr.kind === 'and') {
    writer.writeUint8(COND_TAG_AND);
    writeConditionExpr(writer, expr.left, ctx);
    writeConditionExpr(writer, expr.right, ctx);
    return;
  }
  if (expr.kind === 'or') {
    writer.writeUint8(COND_TAG_OR);
    writeConditionExpr(writer, expr.left, ctx);
    writeConditionExpr(writer, expr.right, ctx);
    return;
  }
  if (expr.kind === 'keyHeld') {
    writer.writeUint8(COND_TAG_KEY_HELD);
    const keyCode =
      typeof expr.key === 'number'
        ? Math.max(0, Math.min(5, Math.round(expr.key)))
        : (KEY_HELD_CODES[String(expr.key).toUpperCase()] ?? 0);
    writer.writeUint8(keyCode);
    return;
  }
  if (expr.kind === 'cmp') {
    const opCode = CMP_OP_TO_CODE[expr.op] ?? 0;
    const leftType = getOperandType(expr.left);
    const rightType = getOperandType(expr.right);
    const cmpHeader = ((rightType & 3) << 5) | ((leftType & 3) << 3) | (opCode & 7);
    writer.writeUint8(COND_TAG_CMP);
    writer.writeUint8(cmpHeader);
    writeOperandData(writer, leftType, expr.left);
    writeOperandData(writer, rightType, expr.right);
    return;
  }
  // kind === 'sensor'
  writeSensorExpr(writer, expr.sensor, expr.param, ctx);
}

function writeSensorExpr(
  writer: BinaryWriter,
  sensor: ConditionSensorType,
  param?: string,
  ctx?: ConditionCodecContext
): void {
  switch (sensor) {
    // Grid sensors
    case 'pathAhead':
      writer.writeUint8(COND_TAG_PATH_AHEAD);
      break;
    case 'pathLeft':
      writer.writeUint8(COND_TAG_PATH_LEFT);
      break;
    case 'pathRight':
      writer.writeUint8(COND_TAG_PATH_RIGHT);
      break;
    case 'itemHere':
      writer.writeUint8(COND_TAG_ITEM_HERE);
      break;
    case 'carryingItem':
      writer.writeUint8(COND_TAG_CARRYING_ITEM);
      break;
    case 'atGoal':
      writer.writeUint8(COND_TAG_AT_GOAL);
      break;
    case 'tileColor': {
      writer.writeUint8(COND_TAG_TILE_COLOR);
      const colorIdx = param ? colorNameToIdx(param) : 0;
      writer.writeUint8(colorIdx);
      break;
    }
    case 'unvisitedAhead':
      writer.writeUint8(COND_TAG_UNVISITED_AHEAD);
      break;
    // Switchyard sensors
    case 'hasNextItem':
      writer.writeUint8(COND_TAG_HAS_NEXT_ITEM);
      break;
    case 'itemDamaged': {
      // Disambiguate: `itemDamaged` appears in Switchyard (0x11) and legacy Depot v1-v3 (0x1a).
      // Use 0x1a only when explicitly serializing in Depot <= v3 context; otherwise 0x11.
      if (ctx?.envByte === ENV_ID_DEPOT && (ctx.envVersion === undefined || ctx.envVersion <= 3)) {
        writer.writeUint8(COND_TAG_ITEM_DAMAGED_D);
      } else {
        writer.writeUint8(COND_TAG_ITEM_DAMAGED_SY);
      }
      break;
    }
    case 'itemColor': {
      writer.writeUint8(COND_TAG_ITEM_COLOR);
      const colorIdx = param ? colorNameToIdx(param) : 0;
      writer.writeUint8(colorIdx);
      break;
    }
    case 'itemIcon': {
      writer.writeUint8(COND_TAG_ITEM_ICON);
      const iconIdx = param ? (ICON_CODES[param] ?? 0) : 0;
      writer.writeUint8(iconIdx);
      break;
    }
    // Depot sensors
    case 'stationEmpty': {
      writer.writeUint8(COND_TAG_STATION_EMPTY);
      const stationCode = param ? (STATION_CODES[param] ?? 0) : 0;
      writer.writeUint8(stationCode);
      break;
    }
    case 'hasItem':
      writer.writeUint8(COND_TAG_HAS_ITEM);
      break;
    case 'heldColor': {
      writer.writeUint8(COND_TAG_HELD_COLOR);
      const colorIdx = param ? colorNameToIdx(param) : 0;
      writer.writeUint8(colorIdx);
      break;
    }
    case 'topColor': {
      writer.writeUint8(COND_TAG_TOP_COLOR);
      const colorIdx = param ? colorNameToIdx(param) : 0;
      writer.writeUint8(colorIdx);
      break;
    }
    // Turtle & Beat sensors
    case 'insideCanvas':
      writer.writeUint8(COND_TAG_INSIDE_CANVAS);
      break;
    case 'cursorAtEdge':
      writer.writeUint8(COND_TAG_CURSOR_AT_EDGE);
      break;
    default:
      // Unknown sensor — write pathAhead as safe fallback
      writer.writeUint8(COND_TAG_PATH_AHEAD);
      break;
  }
}

// ---------------------------------------------------------------------------
// readConditionExpr
// ---------------------------------------------------------------------------

/**
 * Deserializes a `ConditionExpr` tree from `reader`.
 */
export function readConditionExpr(reader: BinaryReader, ctx?: ConditionCodecContext): ConditionExpr {
  const tag = reader.readUint8();
  return decodeConditionExprByTag(reader, tag, ctx);
}

function decodeConditionExprByTag(
  reader: BinaryReader,
  tag: number,
  ctx?: ConditionCodecContext
): ConditionExpr {
  switch (tag) {
    // Boolean combinators
    case COND_TAG_NOT: {
      const operand = readConditionExpr(reader, ctx);
      return { kind: 'not', operand };
    }
    case COND_TAG_AND: {
      const left = readConditionExpr(reader, ctx);
      const right = readConditionExpr(reader, ctx);
      return { kind: 'and', left, right };
    }
    case COND_TAG_OR: {
      const left = readConditionExpr(reader, ctx);
      const right = readConditionExpr(reader, ctx);
      return { kind: 'or', left, right };
    }
    // Grid sensors
    case COND_TAG_PATH_AHEAD:
      return { kind: 'sensor', sensor: 'pathAhead' };
    case COND_TAG_PATH_LEFT:
      return { kind: 'sensor', sensor: 'pathLeft' };
    case COND_TAG_PATH_RIGHT:
      return { kind: 'sensor', sensor: 'pathRight' };
    case COND_TAG_ITEM_HERE:
      return { kind: 'sensor', sensor: 'itemHere' };
    case COND_TAG_CARRYING_ITEM:
      return { kind: 'sensor', sensor: 'carryingItem' };
    case COND_TAG_AT_GOAL:
      return { kind: 'sensor', sensor: 'atGoal' };
    case COND_TAG_TILE_COLOR: {
      const colorIdx = reader.readUint8();
      return { kind: 'sensor', sensor: 'tileColor', param: colorIdxToName(colorIdx) };
    }
    case COND_TAG_UNVISITED_AHEAD:
      return { kind: 'sensor', sensor: 'unvisitedAhead' };
    // Switchyard sensors
    case COND_TAG_HAS_NEXT_ITEM:
      return { kind: 'sensor', sensor: 'hasNextItem' };
    case COND_TAG_ITEM_DAMAGED_SY:
      return { kind: 'sensor', sensor: 'itemDamaged' };
    case COND_TAG_ITEM_COLOR: {
      const colorIdx = reader.readUint8();
      return { kind: 'sensor', sensor: 'itemColor', param: colorIdxToName(colorIdx) };
    }
    case COND_TAG_ITEM_ICON: {
      const iconIdx = reader.readUint8();
      return { kind: 'sensor', sensor: 'itemIcon', param: ICON_CODE_NAMES[iconIdx] ?? 'crate' };
    }
    // Depot sensors
    case COND_TAG_STATION_EMPTY: {
      const stationCode = reader.readUint8();
      return {
        kind: 'sensor',
        sensor: 'stationEmpty',
        param: STATION_CODE_NAMES[stationCode] ?? 'CURRENT',
      };
    }
    case COND_TAG_HAS_ITEM:
      return { kind: 'sensor', sensor: 'hasItem' };
    case COND_TAG_ITEM_DAMAGED_D:
      // Depot itemDamaged — same sensor name as Switchyard but different tag
      return { kind: 'sensor', sensor: 'itemDamaged' };
    case COND_TAG_HELD_COLOR: {
      const colorIdx = reader.readUint8();
      return { kind: 'sensor', sensor: 'heldColor', param: colorIdxToName(colorIdx) };
    }
    case COND_TAG_TOP_COLOR: {
      const colorIdx = reader.readUint8();
      return { kind: 'sensor', sensor: 'topColor', param: colorIdxToName(colorIdx) };
    }
    // Turtle & Beat sensors
    case COND_TAG_INSIDE_CANVAS:
      return { kind: 'sensor', sensor: 'insideCanvas' };
    case COND_TAG_CURSOR_AT_EDGE:
      return { kind: 'sensor', sensor: 'cursorAtEdge' };
    case COND_TAG_KEY_HELD: {
      const code = reader.readUint8();
      return { kind: 'keyHeld', key: KEY_HELD_CODE_NAMES[code] ?? 'UP' };
    }
    // Typed comparison expression
    case COND_TAG_CMP: {
      const cmpHeader = reader.readUint8();
      const opCode = cmpHeader & 0x07;
      const leftType = (cmpHeader >> 3) & 0x03;
      const rightType = (cmpHeader >> 5) & 0x03;
      const op = CMP_CODE_TO_OP[opCode] ?? '=';
      const left = readOperandData(reader, leftType);
      const right = readOperandData(reader, rightType);
      return { kind: 'cmp', op, left, right };
    }
    default:
      // Unknown tag — safe fallback to pathAhead
      return { kind: 'sensor', sensor: 'pathAhead' };
  }
}

// ---------------------------------------------------------------------------
// evaluateConditionExpr — runtime boolean evaluation
// ---------------------------------------------------------------------------

export interface ConditionEvalContext<TState = any> {
  variables?: Record<string, VariableRuntimeValue>;
  sceneInput?: number | string | TypedValue;
  readValueSensor?: (sensor: string, state: TState) => number | string | TypedValue | undefined;
  heldKeys?: ReadonlySet<string | number> | readonly (string | number)[];
  isKeyHeld?: (key: string | number) => boolean;
  onRuntimeError?: (status: SimulationStatus) => void;
}

type ResolvedCmpOperand =
  | { kind: 'color'; colorIdx: number }
  | { kind: 'number'; num: number }
  | { kind: 'error' };

function resolveCmpOperand<TState>(
  val: string | number | TypedValue,
  simState: TState,
  context?: ConditionEvalContext<TState>
): ResolvedCmpOperand {
  if (isTypedValue(val)) {
    const tv = val as TypedValue;
    if (tv.type === 'color') {
      return { kind: 'color', colorIdx: Math.max(0, colorLiteralNameToIdx(String(tv.value))) };
    }
    const num = Number(tv.value);
    return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
  }
  if (isColorLiteralString(val)) {
    return { kind: 'color', colorIdx: colorLiteralNameToIdx(val) };
  }
  if (val === '$input') {
    const raw =
      context?.sceneInput !== undefined
        ? context.sceneInput
        : context?.readValueSensor?.('$input', simState);
    if (raw === undefined || raw === null || (typeof raw === 'number' && Number.isNaN(raw))) {
      context?.onRuntimeError?.('TYPE_ERROR');
      return { kind: 'error' };
    }
    if (isTypedValue(raw)) {
      const tv = raw as TypedValue;
      if (tv.type === 'color') {
        return { kind: 'color', colorIdx: Math.max(0, colorLiteralNameToIdx(String(tv.value))) };
      }
      const num = Number(tv.value);
      return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
    }
    if (typeof raw === 'string' && isColorLiteralString(raw)) {
      return { kind: 'color', colorIdx: colorLiteralNameToIdx(raw) };
    }
    const num = typeof raw === 'number' ? raw : Number(raw ?? 0);
    return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
  }
  if (isSensorRefString(val)) {
    const raw = context?.readValueSensor
      ? context.readValueSensor(val, simState)
      : (context?.variables?.[val] as any);
    if (raw === undefined || raw === null || (typeof raw === 'number' && Number.isNaN(raw))) {
      context?.onRuntimeError?.('TYPE_ERROR');
      return { kind: 'error' };
    }
    if (isTypedValue(raw)) {
      const tv = raw as TypedValue;
      if (tv.type === 'color') {
        return { kind: 'color', colorIdx: Math.max(0, colorLiteralNameToIdx(String(tv.value))) };
      }
      const num = Number(tv.value);
      return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
    }
    if (typeof raw === 'string' && isColorLiteralString(raw)) {
      return { kind: 'color', colorIdx: colorLiteralNameToIdx(raw) };
    }
    const num = typeof raw === 'number' ? raw : Number(raw ?? 0);
    return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
  }
  if (typeof val === 'string' && /^\$?[a-z]$/.test(val)) {
    const varKey = val.startsWith('$') ? val.slice(1) : val;
    const raw = context?.variables?.[varKey] ?? 0;
    if (isTypedValue(raw)) {
      const tv = raw as TypedValue;
      if (tv.type === 'color') {
        return { kind: 'color', colorIdx: Math.max(0, colorLiteralNameToIdx(String(tv.value))) };
      }
      const num = Number(tv.value);
      return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
    }
    if (typeof raw === 'string' && isColorLiteralString(raw)) {
      return { kind: 'color', colorIdx: colorLiteralNameToIdx(raw) };
    }
    const num = typeof raw === 'number' ? raw : Number(raw);
    return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
  }
  const num = typeof val === 'number' ? val : Number(val);
  return { kind: 'number', num: Number.isFinite(num) ? num : 0 };
}

function applyCmpOp(a: number, b: number, op: ConditionCompareOp): boolean {
  switch (op) {
    case '=':
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      return false;
  }
}

/**
 * Evaluates a `ConditionExpr` at runtime against the current simulation state.
 * Delegates atomic sensor reads to `evaluateSensor` from the simulation environment,
 * and resolves variables, `$input`, and color literals for `cmp` nodes via optional `context`.
 *
 * Returns `true` if the condition holds, `false` otherwise.
 */
export function evaluateConditionExpr<TState>(
  expr: ConditionExpr,
  simState: TState,
  evaluateSensor: (sensor: string, state: TState, param?: string) => boolean,
  context?: ConditionEvalContext<TState>
): boolean {
  switch (expr.kind) {
    case 'not':
      return !evaluateConditionExpr(expr.operand, simState, evaluateSensor, context);
    case 'and':
      return (
        evaluateConditionExpr(expr.left, simState, evaluateSensor, context) &&
        evaluateConditionExpr(expr.right, simState, evaluateSensor, context)
      );
    case 'or':
      return (
        evaluateConditionExpr(expr.left, simState, evaluateSensor, context) ||
        evaluateConditionExpr(expr.right, simState, evaluateSensor, context)
      );
    case 'cmp': {
      const left = resolveCmpOperand(expr.left, simState, context);
      const right = resolveCmpOperand(expr.right, simState, context);
      if (left.kind === 'error' || right.kind === 'error') {
        return false;
      }
      if (left.kind === 'color' && right.kind === 'color') {
        if (expr.op !== '=' && expr.op !== '==' && expr.op !== '!=') {
          context?.onRuntimeError?.('TYPE_ERROR');
          return false;
        }
        return applyCmpOp(left.colorIdx, right.colorIdx, expr.op);
      }
      if (left.kind === 'number' && right.kind === 'number') {
        return applyCmpOp(left.num, right.num, expr.op);
      }
      // Cross-type comparison (color vs number or number vs color)
      context?.onRuntimeError?.('TYPE_ERROR');
      return expr.op === '!=';
    }
    case 'keyHeld': {
      if (context?.isKeyHeld) {
        return context.isKeyHeld(expr.key);
      }
      if (context?.heldKeys) {
        return Array.isArray(context.heldKeys)
          ? context.heldKeys.includes(expr.key) || context.heldKeys.includes(String(expr.key))
          : (context.heldKeys as ReadonlySet<string | number>).has(expr.key);
      }
      return false;
    }
    case 'sensor':
      return evaluateSensor(expr.sensor, simState, expr.param);
    default:
      return false;
  }
}
