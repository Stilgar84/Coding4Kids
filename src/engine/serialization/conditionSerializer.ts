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

import type { ConditionExpr, ConditionSensorType } from '../../data/curriculum/types';
import type { BinaryReader } from './binaryReader';
import type { BinaryWriter } from './binaryWriter';

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

// Reserved for M7–M8 typed comparison
export const COND_TAG_CMP_RESERVED     = 0x30;

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
  itemDamagedD:  COND_TAG_ITEM_DAMAGED_D,    // disambiguation key
  heldColor:     COND_TAG_HELD_COLOR,        // + colorIdx param
  topColor:      COND_TAG_TOP_COLOR,         // + colorIdx param
};

/**
 * Station codes for stationEmpty:
 *   0 = CURRENT, 1 = STACK_1, 2 = STACK_2, 3 = STACK_3, 4 = QUEUE, 5 = INPUT
 */
export const STATION_CODES: Record<string, number> = {
  CURRENT: 0,
  STACK_1: 1,
  STACK_2: 2,
  STACK_3: 3,
  QUEUE:   4,
  INPUT:   5,
};
export const STATION_CODE_NAMES: string[] = ['CURRENT', 'STACK_1', 'STACK_2', 'STACK_3', 'QUEUE', 'INPUT'];

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

function colorNameToIdx(name: string): number {
  const idx = PALETTE_COLOR_NAMES.indexOf(name.toLowerCase());
  return idx >= 0 ? idx : 0;
}
function colorIdxToName(idx: number): string {
  return PALETTE_COLOR_NAMES[idx] ?? 'red';
}

// ---------------------------------------------------------------------------
// writeConditionExpr
// ---------------------------------------------------------------------------

/**
 * Serializes a `ConditionExpr` tree into `writer` using the prefix-tree tag encoding.
 * Called immediately after writing OP_IF (0x04) or OP_WHILE (0x0A) header bytes,
 * and after writing the ELSE_IF header byte (0x25).
 */
export function writeConditionExpr(writer: BinaryWriter, expr: ConditionExpr): void {
  if (expr.kind === 'not') {
    writer.writeUint8(COND_TAG_NOT);
    writeConditionExpr(writer, expr.operand);
    return;
  }
  if (expr.kind === 'and') {
    writer.writeUint8(COND_TAG_AND);
    writeConditionExpr(writer, expr.left);
    writeConditionExpr(writer, expr.right);
    return;
  }
  if (expr.kind === 'or') {
    writer.writeUint8(COND_TAG_OR);
    writeConditionExpr(writer, expr.left);
    writeConditionExpr(writer, expr.right);
    return;
  }
  if (expr.kind === 'cmp') {
    // Reserved tag 0x30 for M7–M8: write tag + placeholder
    // We don't have a full encoding for cmp yet — write 0x30 and skip gracefully.
    writer.writeUint8(COND_TAG_CMP_RESERVED);
    return;
  }
  // kind === 'sensor'
  writeSensorExpr(writer, expr.sensor, expr.param);
}

function writeSensorExpr(writer: BinaryWriter, sensor: ConditionSensorType, param?: string): void {
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
      // Disambiguate: the sensor 'itemDamaged' exists in both Switchyard and Depot.
      // We use COND_TAG_ITEM_DAMAGED_SY (0x11) as the default for Switchyard context,
      // and COND_TAG_ITEM_DAMAGED_D (0x1a) for Depot context.
      // The caller encodes it properly by using the right ConditionSensorType variant.
      // Here we default to Switchyard tag since 'itemDamaged' as string is shared.
      // For Depot, callers should use the separate encoding path (see readConditionExpr).
      writer.writeUint8(COND_TAG_ITEM_DAMAGED_SY);
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
export function readConditionExpr(reader: BinaryReader): ConditionExpr {
  const tag = reader.readUint8();
  return decodeConditionExprByTag(reader, tag);
}

function decodeConditionExprByTag(reader: BinaryReader, tag: number): ConditionExpr {
  switch (tag) {
    // Boolean combinators
    case COND_TAG_NOT: {
      const operand = readConditionExpr(reader);
      return { kind: 'not', operand };
    }
    case COND_TAG_AND: {
      const left = readConditionExpr(reader);
      const right = readConditionExpr(reader);
      return { kind: 'and', left, right };
    }
    case COND_TAG_OR: {
      const left = readConditionExpr(reader);
      const right = readConditionExpr(reader);
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
    // Reserved M7–M8 comparison tag
    case COND_TAG_CMP_RESERVED:
      // Return a minimal safe passthrough (not usable at runtime yet)
      return { kind: 'sensor', sensor: 'pathAhead' };
    default:
      // Unknown tag — safe fallback to pathAhead
      return { kind: 'sensor', sensor: 'pathAhead' };
  }
}

// ---------------------------------------------------------------------------
// evaluateConditionExpr — runtime boolean evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates a `ConditionExpr` at runtime against the current simulation state.
 * Delegates atomic sensor reads to `evaluateSensor` from the simulation environment.
 *
 * Returns `true` if the condition holds, `false` otherwise.
 */
export function evaluateConditionExpr<TState>(
  expr: ConditionExpr,
  simState: TState,
  evaluateSensor: (sensor: string, state: TState, param?: string) => boolean
): boolean {
  switch (expr.kind) {
    case 'not':
      return !evaluateConditionExpr(expr.operand, simState, evaluateSensor);
    case 'and':
      return (
        evaluateConditionExpr(expr.left, simState, evaluateSensor) &&
        evaluateConditionExpr(expr.right, simState, evaluateSensor)
      );
    case 'or':
      return (
        evaluateConditionExpr(expr.left, simState, evaluateSensor) ||
        evaluateConditionExpr(expr.right, simState, evaluateSensor)
      );
    case 'cmp':
      // Reserved for M7–M8: always false for now
      return false;
    case 'sensor':
      return evaluateSensor(expr.sensor, simState, expr.param);
    default:
      return false;
  }
}
