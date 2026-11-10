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
  TURTLE_COLOR_PALETTE,
  varNameToIndex,
  indexToVarName,
} from '../types';

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
        writer.writeUint8(varNameToIndex(params?.angle));
      } else {
        const angle = Math.round(params?.angle ?? 90);
        writer.writeVLE(angle);
      }
      break;
    }

    case OP_TURTLE_ARC_LEFT:
    case OP_TURTLE_ARC_RIGHT: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(varNameToIndex(params?.radius));
      } else {
        const radius = Math.round(params?.radius ?? 50);
        writer.writeVLE(radius);
      }

      if ((paramVarMask & 0x04) !== 0) {
        writer.writeUint8(varNameToIndex(params?.angle));
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
        writer.writeUint8(varNameToIndex(params?.width));
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
        writer.writeUint8(varNameToIndex(lenVal));
      } else {
        const length = Math.round(Number(lenVal ?? 50));
        writer.writeVLE(length);
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
        ? indexToVarName(reader.readUint8())
        : reader.readVLE();
      return { angle };
    }

    case OP_TURTLE_ARC_LEFT:
    case OP_TURTLE_ARC_RIGHT: {
      const radius = (paramVarMask & 0x02) !== 0
        ? indexToVarName(reader.readUint8())
        : reader.readVLE();
      const angle = (paramVarMask & 0x04) !== 0
        ? indexToVarName(reader.readUint8())
        : reader.readVLE();
      return { radius, angle };
    }

    case OP_TURTLE_SET_PEN_COLOR: {
      const colorByte = reader.readUint8();
      return { color: byteToColor(colorByte) };
    }

    case OP_TURTLE_SET_PEN_WIDTH: {
      const width = (paramVarMask & 0x02) !== 0
        ? indexToVarName(reader.readUint8())
        : reader.readVLE();
      return { width };
    }

    case OP_TURTLE_FORWARD_LEN:
    case OP_TURTLE_BACKWARD_LEN: {
      const length = (paramVarMask & 0x02) !== 0
        ? indexToVarName(reader.readUint8())
        : reader.readVLE();
      return { length };
    }

    default:
      return undefined;
  }
}
