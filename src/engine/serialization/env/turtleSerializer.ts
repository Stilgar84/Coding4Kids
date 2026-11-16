import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  ENV_VERSION_TURTLE,
  OP_TURTLE_TURN_LEFT,
  OP_TURTLE_TURN_RIGHT,
  OP_TURTLE_ARC_LEFT,
  OP_TURTLE_ARC_RIGHT,
  OP_TURTLE_SET_PEN_COLOR,
  OP_TURTLE_SET_PEN_WIDTH,
  OP_TURTLE_FORWARD_LEN,
  OP_TURTLE_BACKWARD_LEN,
  OP_TURTLE_WAIT,
  OP_TURTLE_SET_INSTANT,
  OP_TURTLE_CLEAR_CANVAS,
  OP_TURTLE_TELEPORT,
  TURTLE_COLOR_PALETTE,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
  isSensorRefString,
} from '../types';
import { isVariableName } from '../../../types';
import { TurtleExecutionMode, TurtleState } from '../../../simulations/turtle/types';

export { ENV_VERSION_TURTLE };
export const ENV_VERSION_TURTLE_V2 = 2;

function createBaseTurtleState(): TurtleState {
  return {
    robot: { x: 0, y: 0, heading: 0 },
    penDown: true,
    penColor: '#0f172a',
    penWidth: 6,
    paths: [],
    status: 'IDLE',
    pan: { x: 0, y: 0 },
    zoom: 1,
    fitToView: false,
    computedBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    activeAnimation: null,
    instantMode: false,
    showTurtle: true,
  };
}

function isVarOrSensorVal(val: unknown): boolean {
  return (
    isVariableName(val) ||
    isSensorRefString(val) ||
    (typeof val === 'string' && /^[a-z]$/.test(val.trim()))
  );
}

function writeSignedVLE(writer: BinaryWriter, val: number): void {
  const n = Math.round(val) | 0;
  const zigzag = ((n << 1) ^ (n >> 31)) >>> 0;
  writer.writeVLE(zigzag);
}

function readSignedVLE(reader: BinaryReader): number {
  const zigzag = reader.readVLE();
  return (zigzag >>> 1) ^ -(zigzag & 1);
}

const TURTLE_COLOR_NAME_TO_BYTE: Record<string, number> = {
  black: 0,
  slate: 0,
  red: 1,
  rose: 1,
  blue: 2,
  green: 3,
  emerald: 3,
  amber: 4,
  yellow: 4,
  purple: 5,
  violet: 5,
  pink: 6,
  cyan: 7,
  orange: 8,
  white: 9,
};

/**
 * Converts a hex color string, canonical color name, `0..9` index, or `TypedValue` `color`
 * into a 1-byte palette index (`0..9`).
 */
export function colorToByte(color?: unknown): number {
  if (color === null || color === undefined) return 0;

  if (typeof color === 'object') {
    const obj = color as { type?: unknown; value?: unknown };
    if (obj.type === 'color' && obj.value !== undefined) {
      return colorToByte(obj.value);
    }
    return 0;
  }

  if (typeof color === 'number') {
    if (!Number.isFinite(color)) return 0;
    return Math.max(0, Math.min(TURTLE_COLOR_PALETTE.length - 1, Math.trunc(color)));
  }

  if (typeof color === 'string') {
    const trimmed = color.trim();
    if (!trimmed) return 0;
    const lower = trimmed.toLowerCase();

    // Hex aliases across Stage A / Beat / Turtle palettes
    if (lower === '#22c55e') return 3;
    if (lower === '#f43f5e') return 1;
    if (lower === '#fbbf24') return 4;
    if (lower === '#a855f7') return 5;
    if (lower === '#000000') return 0;

    const hexIdx = TURTLE_COLOR_PALETTE.findIndex((c) => c.toLowerCase() === lower);
    if (hexIdx >= 0) return hexIdx;

    const cleanName = lower.startsWith('color:') ? lower.slice(6).trim() : lower;
    if (cleanName in TURTLE_COLOR_NAME_TO_BYTE) {
      return TURTLE_COLOR_NAME_TO_BYTE[cleanName];
    }
    if (/^-?\d+$/.test(cleanName)) {
      return Math.max(
        0,
        Math.min(TURTLE_COLOR_PALETTE.length - 1, Math.trunc(Number(cleanName)))
      );
    }
  }

  return 0;
}

/**
 * Converts a 1-byte palette index back to a hex color string.
 */
export function byteToColor(byte: number): string {
  return TURTLE_COLOR_PALETTE[byte] ?? TURTLE_COLOR_PALETTE[0];
}

/**
 * Serializes action-specific parameters for Turtle opcodes.
 */
export function writeTurtleParams(
  writer: BinaryWriter,
  opcode: number,
  params?: Record<string, any>,
  paramVarMask: number = 0
): void {
  switch (opcode) {
    case OP_TURTLE_TURN_LEFT:
    case OP_TURTLE_TURN_RIGHT: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.angle ?? 'a')));
      } else {
        const angle = Math.round(params?.angle ?? 90);
        writer.writeVLE(angle);
      }
      break;
    }

    case OP_TURTLE_ARC_LEFT:
    case OP_TURTLE_ARC_RIGHT: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.radius ?? 'a')));
      } else {
        const radius = Math.round(params?.radius ?? 50);
        writer.writeVLE(radius);
      }

      if ((paramVarMask & 0x04) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.angle ?? 'a')));
      } else {
        const angle = Math.round(params?.angle ?? 90);
        writer.writeVLE(angle);
      }
      break;
    }

    case OP_TURTLE_SET_PEN_COLOR: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.color ?? 'a')));
      } else {
        const colorByte = colorToByte(params?.color);
        writer.writeUint8(colorByte);
      }
      break;
    }

    case OP_TURTLE_SET_PEN_WIDTH: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.width ?? 'a')));
      } else {
        const width = Math.round(params?.width ?? 6);
        writer.writeVLE(width);
      }
      break;
    }

    case OP_TURTLE_FORWARD_LEN:
    case OP_TURTLE_BACKWARD_LEN: {
      const lenVal = params?.length ?? params?.distance;
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(lenVal ?? 'a')));
      } else {
        const length = Math.round(Number(lenVal ?? 50));
        writer.writeVLE(length);
      }
      break;
    }

    case OP_TURTLE_WAIT: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.duration ?? 'a')));
      } else {
        const dur = Number(params?.duration ?? 1);
        const scaled = Math.max(0, Math.round((Number.isFinite(dur) ? dur : 1) * 100));
        writer.writeVLE(scaled);
      }
      break;
    }

    case OP_TURTLE_SET_INSTANT: {
      writer.writeUint8(params?.mode === 'OFF' ? 0 : 1);
      break;
    }

    case OP_TURTLE_TELEPORT: {
      const xIsVar = isVarOrSensorVal(params?.x);
      const yIsVar = isVarOrSensorVal(params?.y);
      const hIsVar = isVarOrSensorVal(params?.heading);
      const refMask = (xIsVar ? 1 : 0) | (yIsVar ? 2 : 0) | (hIsVar ? 4 : 0);
      writer.writeUint8(refMask);

      if (xIsVar) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.x)));
      } else {
        writeSignedVLE(writer, Number(params?.x ?? 0));
      }

      if (yIsVar) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.y)));
      } else {
        writeSignedVLE(writer, Number(params?.y ?? 0));
      }

      if (hIsVar) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.heading)));
      } else {
        writeSignedVLE(writer, Number(params?.heading ?? 0));
      }
      break;
    }

    default:
      // No parameters for other opcodes (FORWARD, BACKWARD, PEN_UP, PEN_DOWN)
      break;
  }
}

/**
 * Deserializes action-specific parameters for Turtle opcodes.
 */
export function readTurtleParams(
  reader: BinaryReader,
  opcode: number,
  paramVarMask: number = 0
): Record<string, any> | undefined {
  switch (opcode) {
    case OP_TURTLE_TURN_LEFT:
    case OP_TURTLE_TURN_RIGHT: {
      const angle = (paramVarMask & 0x02) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : reader.readVLE();
      return { angle };
    }

    case OP_TURTLE_ARC_LEFT:
    case OP_TURTLE_ARC_RIGHT: {
      const radius = (paramVarMask & 0x02) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : reader.readVLE();
      const angle = (paramVarMask & 0x04) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : reader.readVLE();
      return { radius, angle };
    }

    case OP_TURTLE_SET_PEN_COLOR: {
      const color = (paramVarMask & 0x02) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : byteToColor(reader.readUint8());
      return { color };
    }

    case OP_TURTLE_SET_PEN_WIDTH: {
      const width = (paramVarMask & 0x02) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : reader.readVLE();
      return { width };
    }

    case OP_TURTLE_FORWARD_LEN:
    case OP_TURTLE_BACKWARD_LEN: {
      const length = (paramVarMask & 0x02) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : reader.readVLE();
      return { length };
    }

    case OP_TURTLE_WAIT: {
      const duration = (paramVarMask & 0x02) !== 0
        ? decodeVarOrSensorIndex(reader.readUint8())
        : reader.readVLE() / 100;
      return { duration };
    }

    case OP_TURTLE_SET_INSTANT: {
      const modeByte = reader.readUint8();
      return { mode: modeByte === 0 ? 'OFF' : 'ON' };
    }

    case OP_TURTLE_CLEAR_CANVAS:
      return undefined;

    case OP_TURTLE_TELEPORT: {
      const refMask = reader.readUint8();
      const x = (refMask & 1) !== 0 ? decodeVarOrSensorIndex(reader.readUint8()) : readSignedVLE(reader);
      const y = (refMask & 2) !== 0 ? decodeVarOrSensorIndex(reader.readUint8()) : readSignedVLE(reader);
      const heading = (refMask & 4) !== 0 ? decodeVarOrSensorIndex(reader.readUint8()) : readSignedVLE(reader);
      return { x, y, heading };
    }

    default:
      return undefined;
  }
}

/**
 * Determines the minimum Turtle environment serialization version (`1` or `2`).
 * Static default states remain version `1` (0-byte payload) for 100% backward compatibility.
 */
export function getTurtleSerializationVersion(state?: Partial<TurtleState> | null): number {
  if (!state) return ENV_VERSION_TURTLE;
  const mode = state.mode ?? 'static';
  if (
    mode !== 'static' ||
    state.clearBetweenFrames !== undefined ||
    state.totalFrames !== undefined ||
    state.fps !== undefined
  ) {
    return ENV_VERSION_TURTLE_V2;
  }
  return ENV_VERSION_TURTLE;
}

/**
 * Writes Turtle environment metadata payload (`v1` = 0 bytes; `v2` = `turtleFlags` + optional `totalFrames`/`fps`).
 */
export function writeTurtleState(
  writer: BinaryWriter,
  state?: Partial<TurtleState> | null,
  envVersion: number = getTurtleSerializationVersion(state)
): void {
  if (envVersion < ENV_VERSION_TURTLE_V2) {
    return;
  }

  const mode: TurtleExecutionMode = state?.mode ?? 'static';
  const modeBits = mode === 'flipbook' ? 1 : mode === 'live' ? 2 : 0;
  const clearBetweenFrames = state?.clearBetweenFrames !== false;
  const defaultFps = mode === 'live' ? 60 : mode === 'flipbook' ? 8 : 0;
  const fpsVal =
    typeof state?.fps === 'number' && Number.isFinite(state.fps) && state.fps > 0
      ? Math.min(255, Math.max(1, Math.round(state.fps)))
      : undefined;
  const hasNonDefaultFps = fpsVal !== undefined && fpsVal !== defaultFps;

  const turtleFlags =
    (modeBits & 0x03) |
    (clearBetweenFrames ? 0x04 : 0) |
    (hasNonDefaultFps ? 0x08 : 0);

  writer.writeUint8(turtleFlags);

  if (modeBits === 1) {
    const frames =
      typeof state?.totalFrames === 'number' && Number.isFinite(state.totalFrames)
        ? Math.max(1, Math.round(state.totalFrames))
        : 8;
    writer.writeVLE(frames);
  }

  if (hasNonDefaultFps && fpsVal !== undefined) {
    writer.writeUint8(fpsVal);
  }
}

/**
 * Reads Turtle environment metadata payload (`v1` = default initial state; `v2` = `turtleFlags` + optional `totalFrames`/`fps`).
 */
export function readTurtleState(
  reader: BinaryReader,
  envVersion: number = ENV_VERSION_TURTLE
): TurtleState {
  const base = createBaseTurtleState();
  if (envVersion < ENV_VERSION_TURTLE_V2) {
    return base;
  }

  const turtleFlags = reader.readUint8();
  const modeBits = turtleFlags & 0x03;
  const mode: TurtleExecutionMode =
    modeBits === 1 ? 'flipbook' : modeBits === 2 ? 'live' : 'static';
  const clearBetweenFrames = (turtleFlags & 0x04) !== 0;
  const hasNonDefaultFps = (turtleFlags & 0x08) !== 0;

  let totalFrames: number | undefined;
  if (modeBits === 1) {
    totalFrames = reader.readVLE();
  }

  let fps: number | undefined;
  if (hasNonDefaultFps) {
    fps = reader.readUint8();
  }

  return {
    ...base,
    mode,
    clearBetweenFrames,
    ...(totalFrames !== undefined ? { totalFrames } : {}),
    ...(fps !== undefined ? { fps } : {}),
    ...(mode === 'live' ? { instantMode: true } : {}),
  };
}
