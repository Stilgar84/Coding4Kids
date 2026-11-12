import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
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

/**
 * Converts a hex color string to a 1-byte palette index.
 */
export function colorToByte(color?: string): number {
  if (!color) return 0;
  const lower = color.toLowerCase();
  // Handle alias for green
  if (lower === '#22c55e') return 3;

  const idx = TURTLE_COLOR_PALETTE.findIndex((c) => c.toLowerCase() === lower);
  return idx >= 0 ? idx : 0;
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
      const colorByte = colorToByte(params?.color);
      writer.writeUint8(colorByte);
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
      const colorByte = reader.readUint8();
      return { color: byteToColor(colorByte) };
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
