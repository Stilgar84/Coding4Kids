import {
  BeaconColor,
  BeaconShape,
  BeaconTile,
  CellCoord,
  DialTile,
  Direction,
  FlagObjective,
  FloorSwitch,
  GridState,
  KeyGateColor,
  KeyGateShape,
  LockedGate,
  WallEdge,
  WorldItem,
  WorldItemType,
} from '../../../types';
import {
  cloneLockedGates,
  cloneWorldItems,
  hasInteractiveWorldElements,
  isSwitchLinkedToGate,
  resolveKeyGateColor,
  resolveKeyGateShape,
  syncWorldSwitchesAndGates,
} from '../../physics';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import { ENV_VERSION_GRID, ENV_VERSION_GRID_V2, ENV_VERSION_GRID_V3 } from '../types';

const DIR_MAP: Record<Direction, number> = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
};

const REV_DIR_MAP: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

const SHAPE_LIST: readonly KeyGateShape[] = ['circle', 'triangle', 'diamond'];
const COLOR_LIST: readonly KeyGateColor[] = ['amber', 'emerald', 'purple'];
const ITEM_TYPE_LIST: readonly WorldItemType[] = ['key', 'plank', 'crate'];

const BEACON_SHAPE_LIST: readonly BeaconShape[] = ['circle', 'triangle', 'square', 'diamond'];
const BEACON_COLOR_LIST: readonly BeaconColor[] = ['red', 'blue', 'green', 'yellow'];

function beaconShapeToIdx(shape: BeaconShape): number {
  const idx = BEACON_SHAPE_LIST.indexOf(shape);
  return idx >= 0 ? idx : 0;
}

function beaconIdxToShape(idx: number): BeaconShape {
  return BEACON_SHAPE_LIST[idx & 0x03] ?? 'circle';
}

function beaconColorToIdx(color: BeaconColor): number {
  const idx = BEACON_COLOR_LIST.indexOf(color);
  return idx >= 0 ? idx : 0;
}

function beaconIdxToColor(idx: number): BeaconColor {
  return BEACON_COLOR_LIST[idx & 0x03] ?? 'red';
}

export function directionToByte(dir: Direction): number {
  return DIR_MAP[dir] ?? 0;
}

export function byteToDirection(byte: number): Direction {
  return REV_DIR_MAP[byte & 0x03] ?? 'NORTH';
}

function shapeToIdx(shape?: KeyGateShape): number {
  const idx = SHAPE_LIST.indexOf(resolveKeyGateShape(shape));
  return idx >= 0 ? idx : 0;
}

function idxToShape(idx: number): KeyGateShape {
  return SHAPE_LIST[idx & 0x03] ?? 'circle';
}

function colorToIdx(color?: KeyGateColor, shape: KeyGateShape = 'circle'): number {
  const idx = COLOR_LIST.indexOf(resolveKeyGateColor(color, shape));
  return idx >= 0 ? idx : 0;
}

function idxToColor(idx: number, shape: KeyGateShape): KeyGateColor {
  return COLOR_LIST[idx & 0x07] ?? resolveKeyGateColor(undefined, shape);
}

function itemTypeToIdx(type: WorldItemType): number {
  const idx = ITEM_TYPE_LIST.indexOf(type);
  return idx >= 0 ? idx : 0;
}

function idxToItemType(idx: number): WorldItemType {
  return ITEM_TYPE_LIST[idx & 0x03] ?? 'crate';
}

function writeCellCoord(
  writer: BinaryWriter,
  isSmallGrid: boolean,
  x: number,
  y: number
): void {
  if (isSmallGrid) {
    writer.writeUint8(((x & 0x0f) << 4) | (y & 0x0f));
  } else {
    writer.writeVLE(x);
    writer.writeVLE(y);
  }
}

function readCellCoord(reader: BinaryReader, isSmallGrid: boolean): CellCoord {
  if (isSmallGrid) {
    const b = reader.readUint8();
    return {
      x: (b >> 4) & 0x0f,
      y: b & 0x0f,
    };
  }
  return {
    x: reader.readVLE(),
    y: reader.readVLE(),
  };
}

/**
 * Returns `1` for classic Grid maps (no water, gates, switches, or floor items),
 * `2` when Module 2 interactive world elements exist without v3 extensions,
 * or `3` when beacons, dials, stackable depots, or v3 rule flags exist.
 */
export function getGridSerializationVersion(grid?: GridState): number {
  if (!grid) return ENV_VERSION_GRID;
  const hasV3 =
    (grid.beaconTiles && grid.beaconTiles.length > 0) ||
    (grid.dialTiles && grid.dialTiles.length > 0) ||
    Boolean(grid.strictInteractionCollision) ||
    Boolean(grid.requireAllItemsCollected) ||
    Boolean(grid.requireEmptyBackpackAtGoal) ||
    (grid.worldItems && grid.worldItems.some((it) => (it.count ?? 1) > 1)) ||
    (grid.initialWorldItems && grid.initialWorldItems.some((it) => (it.count ?? 1) > 1));
  if (hasV3) {
    return ENV_VERSION_GRID_V3;
  }
  return hasInteractiveWorldElements(grid) ? ENV_VERSION_GRID_V2 : ENV_VERSION_GRID;
}

/**
 * Serializes a GridState into a binary writer.
 * - `envVersion = 1`: classic map layout (byte-for-byte identical to v1 spec).
 * - `envVersion = 2`: writes the exact `envVersion = 1` prefix followed by compact VLE tables
 *   for `waterCells`, `lockedGates`, `floorSwitches`, and `worldItems`.
 */
export function writeGridState(
  writer: BinaryWriter,
  grid: GridState,
  envVersion?: number
): void {
  const resolvedVersion = envVersion ?? getGridSerializationVersion(grid);
  const isSmallGrid = grid.width <= 16 && grid.height <= 16;

  // --- envVersion = 1 Prefix (DO NOT ALTER BYTE LAYOUT) ---
  // 1. Dimensions
  writer.writeVLE(grid.width);
  writer.writeVLE(grid.height);

  // 2. Robot Pose (use initial pose when interactive map was run in Instant mode, or current pose on classic v1)
  const robotX = resolvedVersion >= ENV_VERSION_GRID_V2 ? grid.robot.initialX : grid.robot.x;
  const robotY = resolvedVersion >= ENV_VERSION_GRID_V2 ? grid.robot.initialY : grid.robot.y;
  const robotDir = resolvedVersion >= ENV_VERSION_GRID_V2 ? grid.robot.initialDir : grid.robot.dir;
  const dirByte = directionToByte(robotDir);
  if (isSmallGrid) {
    const poseByte1 = ((robotX & 0x0f) << 4) | (robotY & 0x0f);
    writer.writeUint8(poseByte1);
    writer.writeUint8(dirByte & 0x03);
  } else {
    writer.writeVLE(robotX);
    writer.writeVLE(robotY);
    writer.writeUint8(dirByte & 0x03);
  }

  // 3. Barriers
  const barriers = grid.barriers || [];
  writer.writeVLE(barriers.length);
  for (const b of barriers) {
    const oriBit = b.orientation === 'V' ? 0x80 : 0x00;
    if (isSmallGrid) {
      const byte = oriBit | ((b.x & 0x07) << 4) | (b.y & 0x0f);
      writer.writeUint8(byte);
    } else {
      const byte = oriBit | (b.x & 0x7f);
      writer.writeUint8(byte);
      writer.writeVLE(b.y);
    }
  }

  // 4. Flags & Objectives
  const flags = grid.flags || [];
  writer.writeVLE(flags.length);
  for (const f of flags) {
    const flagByte2 = (f.isGoal ? 0x80 : 0x00) | (f.order & 0x7f);
    if (isSmallGrid) {
      const byte1 = ((f.x & 0x0f) << 4) | (f.y & 0x0f);
      writer.writeUint8(byte1);
      writer.writeUint8(flagByte2);
    } else {
      writer.writeVLE(f.x);
      writer.writeVLE(f.y);
      writer.writeUint8(flagByte2);
    }
  }

  if (resolvedVersion < ENV_VERSION_GRID_V2) {
    return;
  }

  // --- envVersion = 2 Interactive World Extension Block ---
  // 5. Water Cells
  const waterCells = grid.waterCells ?? [];
  writer.writeVLE(waterCells.length);
  for (const w of waterCells) {
    writeCellCoord(writer, isSmallGrid, w.x, w.y);
  }

  // 6. Locked Gates (serialize authored initial gates so runtime key-unlock doesn't alter map definition)
  const gates = grid.initialLockedGates ?? grid.lockedGates ?? [];
  writer.writeVLE(gates.length);
  for (const g of gates) {
    writeCellCoord(writer, isSmallGrid, g.x, g.y);
    const shape = resolveKeyGateShape(g.shape);
    const attrByte = ((colorToIdx(g.color, shape) & 0x07) << 2) | (shapeToIdx(shape) & 0x03);
    writer.writeUint8(attrByte);
  }

  // 7. Floor Switches
  const switches = grid.floorSwitches ?? [];
  writer.writeVLE(switches.length);
  for (const sw of switches) {
    writeCellCoord(writer, isSmallGrid, sw.x, sw.y);
    const linkedGateIdx = gates.findIndex((g) => isSwitchLinkedToGate(sw, g));
    const hasLinkedGate = linkedGateIdx >= 0;
    const hasExplicitReq = typeof sw.requiredForGoal === 'boolean';
    const reqVal = Boolean(sw.requiredForGoal);
    const flagsByte =
      (hasLinkedGate ? 0x01 : 0x00) |
      (hasExplicitReq ? 0x02 : 0x00) |
      (reqVal ? 0x04 : 0x00);
    writer.writeUint8(flagsByte);
    if (hasLinkedGate) {
      writer.writeVLE(linkedGateIdx);
    }
  }

  // 8. World Items (serialize authored initial items so runtime consumption doesn't alter map definition)
  const items = grid.initialWorldItems ?? grid.worldItems ?? [];
  writer.writeVLE(items.length);
  for (const item of items) {
    writeCellCoord(writer, isSmallGrid, item.x, item.y);
    const typeIdx = itemTypeToIdx(item.type) & 0x03;
    const shape = item.type === 'key' ? resolveKeyGateShape(item.shape) : 'circle';
    const shapeBits = item.type === 'key' ? shapeToIdx(shape) & 0x03 : 0;
    const colorBits = item.type === 'key' ? colorToIdx(item.color, shape) & 0x07 : 0;
    const attrByte = (colorBits << 4) | (shapeBits << 2) | typeIdx;
    writer.writeUint8(attrByte);
  }

  if (resolvedVersion < ENV_VERSION_GRID_V3) {
    return;
  }

  // --- envVersion = 3 Grid Sensors, Beacons, Dials, Rules & Stacks ---
  // 9. Grid Rules Mask
  const rulesMask =
    (grid.strictInteractionCollision ? 0x01 : 0x00) |
    (grid.requireAllItemsCollected ? 0x02 : 0x00) |
    (grid.requireEmptyBackpackAtGoal ? 0x04 : 0x00);
  writer.writeUint8(rulesMask);

  // 10. Beacon Tiles
  const beacons = grid.beaconTiles ?? [];
  writer.writeVLE(beacons.length);
  for (const b of beacons) {
    writeCellCoord(writer, isSmallGrid, b.x, b.y);
    const attrByte = ((beaconColorToIdx(b.color) & 0x03) << 2) | (beaconShapeToIdx(b.shape) & 0x03);
    writer.writeUint8(attrByte);
  }

  // 11. Dial Tiles (1..20)
  const dials = grid.dialTiles ?? [];
  writer.writeVLE(dials.length);
  for (const d of dials) {
    writeCellCoord(writer, isSmallGrid, d.x, d.y);
    writer.writeUint8(Math.max(1, Math.min(20, d.value)));
  }

  // 12. Stack Count Overrides on World Items (for items having count > 1)
  const stackOverrides: { index: number; count: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if ((it.count ?? 1) > 1) {
      stackOverrides.push({ index: i, count: it.count! });
    }
  }
  writer.writeVLE(stackOverrides.length);
  for (const s of stackOverrides) {
    writer.writeVLE(s.index);
    writer.writeVLE(s.count);
  }
}

/**
 * Deserializes a GridState from a binary reader.
 * Reads only the v1 block when `envVersion === 1` and reads the v2 extension block when `envVersion >= 2`.
 */
export function readGridState(reader: BinaryReader, envVersion = ENV_VERSION_GRID): GridState {
  if (envVersion < 1) {
    throw new Error(`Unsupported Grid envVersion: ${envVersion}`);
  }

  // 1. Dimensions
  const width = reader.readVLE();
  const height = reader.readVLE();
  const isSmallGrid = width <= 16 && height <= 16;

  // 2. Robot Pose
  let robotX: number;
  let robotY: number;
  let robotDir: Direction;

  if (isSmallGrid) {
    const b1 = reader.readUint8();
    const b2 = reader.readUint8();
    robotX = (b1 >> 4) & 0x0f;
    robotY = b1 & 0x0f;
    robotDir = byteToDirection(b2 & 0x03);
  } else {
    robotX = reader.readVLE();
    robotY = reader.readVLE();
    const b = reader.readUint8();
    robotDir = byteToDirection(b);
  }

  // 3. Barriers
  const barrierCount = reader.readVLE();
  const barriers: WallEdge[] = [];
  for (let i = 0; i < barrierCount; i++) {
    if (isSmallGrid) {
      const b = reader.readUint8();
      const orientation: 'H' | 'V' = b & 0x80 ? 'V' : 'H';
      const x = (b >> 4) & 0x07;
      const y = b & 0x0f;
      barriers.push({ orientation, x, y });
    } else {
      const b = reader.readUint8();
      const orientation: 'H' | 'V' = b & 0x80 ? 'V' : 'H';
      const x = b & 0x7f;
      const y = reader.readVLE();
      barriers.push({ orientation, x, y });
    }
  }

  // 4. Flags & Objectives
  const flagCount = reader.readVLE();
  const flags: FlagObjective[] = [];
  for (let i = 0; i < flagCount; i++) {
    let x: number;
    let y: number;
    let isGoal: boolean;
    let order: number;

    if (isSmallGrid) {
      const b1 = reader.readUint8();
      const b2 = reader.readUint8();
      x = (b1 >> 4) & 0x0f;
      y = b1 & 0x0f;
      isGoal = (b2 & 0x80) !== 0;
      order = b2 & 0x7f;
    } else {
      x = reader.readVLE();
      y = reader.readVLE();
      const b = reader.readUint8();
      isGoal = (b & 0x80) !== 0;
      order = b & 0x7f;
    }

    flags.push({
      id: `flag_${x}_${y}_${order}`,
      x,
      y,
      isGoal,
      order,
      collected: false,
    });
  }

  if (envVersion === ENV_VERSION_GRID) {
    return {
      width,
      height,
      robot: {
        x: robotX,
        y: robotY,
        dir: robotDir,
        initialX: robotX,
        initialY: robotY,
        initialDir: robotDir,
      },
      barriers,
      flags,
      trace: [{ x: robotX, y: robotY }],
      status: 'IDLE',
      showTrace: true,
      fitToView: false,
    };
  }

  // --- envVersion >= 2 Extension Block ---
  // 5. Water Cells
  const waterCount = reader.readVLE();
  const waterCells: CellCoord[] = [];
  for (let i = 0; i < waterCount; i++) {
    waterCells.push(readCellCoord(reader, isSmallGrid));
  }

  // 6. Locked Gates
  const gateCount = reader.readVLE();
  const rawGates: LockedGate[] = [];
  for (let i = 0; i < gateCount; i++) {
    const coord = readCellCoord(reader, isSmallGrid);
    const attrByte = reader.readUint8();
    const shape = idxToShape(attrByte & 0x03);
    const color = idxToColor((attrByte >> 2) & 0x07, shape);
    rawGates.push({
      id: `gate_${coord.x}_${coord.y}_${i}`,
      x: coord.x,
      y: coord.y,
      shape,
      color,
      unlocked: false,
      unlockedByKey: false,
    });
  }

  // 7. Floor Switches
  const switchCount = reader.readVLE();
  const rawSwitches: FloorSwitch[] = [];
  for (let i = 0; i < switchCount; i++) {
    const coord = readCellCoord(reader, isSmallGrid);
    const flagsByte = reader.readUint8();
    const hasLinkedGate = (flagsByte & 0x01) !== 0;
    const hasExplicitReq = (flagsByte & 0x02) !== 0;
    const reqVal = (flagsByte & 0x04) !== 0;

    let linkedGateId: string | undefined;
    if (hasLinkedGate) {
      const gateIdx = reader.readVLE();
      if (gateIdx >= 0 && gateIdx < rawGates.length) {
        linkedGateId = rawGates[gateIdx].id;
        rawGates[gateIdx].linkedSwitchId = `switch_${coord.x}_${coord.y}_${i}`;
      }
    }

    rawSwitches.push({
      id: `switch_${coord.x}_${coord.y}_${i}`,
      x: coord.x,
      y: coord.y,
      ...(linkedGateId ? { linkedGateId } : {}),
      ...(hasExplicitReq ? { requiredForGoal: reqVal } : {}),
      active: false,
    });
  }

  // 8. World Items
  const itemCount = reader.readVLE();
  const rawItems: WorldItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    const coord = readCellCoord(reader, isSmallGrid);
    const attrByte = reader.readUint8();
    const type = idxToItemType(attrByte & 0x03);
    if (type === 'key') {
      const shape = idxToShape((attrByte >> 2) & 0x03);
      const color = idxToColor((attrByte >> 4) & 0x07, shape);
      rawItems.push({
        id: `item_key_${coord.x}_${coord.y}_${i}`,
        type: 'key',
        x: coord.x,
        y: coord.y,
        shape,
        color,
      });
    } else {
      rawItems.push({
        id: `item_${type}_${coord.x}_${coord.y}_${i}`,
        type,
        x: coord.x,
        y: coord.y,
      });
    }
  }

  // --- envVersion >= 3 Grid Extension Block ---
  let strictInteractionCollision: boolean | undefined;
  let requireAllItemsCollected: boolean | undefined;
  let requireEmptyBackpackAtGoal: boolean | undefined;
  const beaconTiles: BeaconTile[] = [];
  const dialTiles: DialTile[] = [];

  if (envVersion >= ENV_VERSION_GRID_V3) {
    const rulesMask = reader.readUint8();
    strictInteractionCollision = (rulesMask & 0x01) !== 0 ? true : undefined;
    requireAllItemsCollected = (rulesMask & 0x02) !== 0 ? true : undefined;
    requireEmptyBackpackAtGoal = (rulesMask & 0x04) !== 0 ? true : undefined;

    const beaconCount = reader.readVLE();
    for (let i = 0; i < beaconCount; i++) {
      const coord = readCellCoord(reader, isSmallGrid);
      const attrByte = reader.readUint8();
      const shape = beaconIdxToShape(attrByte & 0x03);
      const color = beaconIdxToColor((attrByte >> 2) & 0x03);
      beaconTiles.push({
        x: coord.x,
        y: coord.y,
        shape,
        color,
      });
    }

    const dialCount = reader.readVLE();
    for (let i = 0; i < dialCount; i++) {
      const coord = readCellCoord(reader, isSmallGrid);
      const value = reader.readUint8();
      dialTiles.push({
        x: coord.x,
        y: coord.y,
        value: Math.max(1, Math.min(20, value)),
      });
    }

    const stackOverrideCount = reader.readVLE();
    for (let i = 0; i < stackOverrideCount; i++) {
      const itemIdx = reader.readVLE();
      const count = reader.readVLE();
      if (itemIdx >= 0 && itemIdx < rawItems.length) {
        rawItems[itemIdx].count = count;
      }
    }
  }

  const synced = syncWorldSwitchesAndGates(rawSwitches, rawGates, rawItems);

  return {
    width,
    height,
    robot: {
      x: robotX,
      y: robotY,
      dir: robotDir,
      initialX: robotX,
      initialY: robotY,
      initialDir: robotDir,
      carriedItem: null,
      carriedCount: 0,
    },
    barriers,
    flags,
    waterCells,
    bridgedWaterCells: [],
    lockedGates: synced.lockedGates ?? [],
    initialLockedGates: cloneLockedGates(rawGates, true),
    floorSwitches: synced.floorSwitches ?? [],
    worldItems: cloneWorldItems(rawItems),
    initialWorldItems: cloneWorldItems(rawItems),
    ...(beaconTiles.length > 0 ? { beaconTiles } : {}),
    ...(dialTiles.length > 0 ? { dialTiles } : {}),
    ...(strictInteractionCollision !== undefined ? { strictInteractionCollision } : {}),
    ...(requireAllItemsCollected !== undefined ? { requireAllItemsCollected } : {}),
    ...(requireEmptyBackpackAtGoal !== undefined ? { requireEmptyBackpackAtGoal } : {}),
    lastInteractionFeedback: null,
    trace: [{ x: robotX, y: robotY }],
    status: 'IDLE',
    showTrace: true,
    fitToView: false,
  };
}
