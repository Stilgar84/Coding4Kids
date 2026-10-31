import { Direction, GridState, WallEdge, FlagObjective } from '../../../types';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';

const DIR_MAP: Record<Direction, number> = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
};

const REV_DIR_MAP: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

export function directionToByte(dir: Direction): number {
  return DIR_MAP[dir] ?? 0;
}

export function byteToDirection(byte: number): Direction {
  return REV_DIR_MAP[byte & 0x03] ?? 'NORTH';
}

/**
 * Serializes a GridState into a binary writer.
 */
export function writeGridState(writer: BinaryWriter, grid: GridState): void {
  const isSmallGrid = grid.width <= 16 && grid.height <= 16;

  // 1. Dimensions
  writer.writeVLE(grid.width);
  writer.writeVLE(grid.height);

  // 2. Robot Pose
  const dirByte = directionToByte(grid.robot.dir);
  if (isSmallGrid) {
    const poseByte1 = ((grid.robot.x & 0x0f) << 4) | (grid.robot.y & 0x0f);
    writer.writeUint8(poseByte1);
    writer.writeUint8(dirByte & 0x03);
  } else {
    writer.writeVLE(grid.robot.x);
    writer.writeVLE(grid.robot.y);
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
}

/**
 * Deserializes a GridState from a binary reader.
 */
export function readGridState(reader: BinaryReader): GridState {
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
      const orientation: 'H' | 'V' = (b & 0x80) ? 'V' : 'H';
      const x = (b >> 4) & 0x07;
      const y = b & 0x0f;
      barriers.push({ orientation, x, y });
    } else {
      const b = reader.readUint8();
      const orientation: 'H' | 'V' = (b & 0x80) ? 'V' : 'H';
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
