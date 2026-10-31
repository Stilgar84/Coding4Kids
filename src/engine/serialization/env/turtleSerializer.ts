import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  OP_TURTLE_TURN_LEFT,
  OP_TURTLE_TURN_RIGHT,
  OP_TURTLE_ARC_LEFT,
  OP_TURTLE_ARC_RIGHT,
  OP_TURTLE_SET_PEN_COLOR,
  TURTLE_COLOR_PALETTE,
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
  params?: Record<string, any>
): void {
  switch (opcode) {
    case OP_TURTLE_TURN_LEFT:
    case OP_TURTLE_TURN_RIGHT: {
      const angle = Math.round(params?.angle ?? 90);
      writer.writeVLE(angle);
      break;
    }

    case OP_TURTLE_ARC_LEFT:
    case OP_TURTLE_ARC_RIGHT: {
      const radius = Math.round(params?.radius ?? 50);
      const angle = Math.round(params?.angle ?? 90);
      writer.writeVLE(radius);
      writer.writeVLE(angle);
      break;
    }

    case OP_TURTLE_SET_PEN_COLOR: {
      const colorByte = colorToByte(params?.color);
      writer.writeUint8(colorByte);
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
  opcode: number
): Record<string, any> | undefined {
  switch (opcode) {
    case OP_TURTLE_TURN_LEFT:
    case OP_TURTLE_TURN_RIGHT: {
      const angle = reader.readVLE();
      return { angle };
    }

    case OP_TURTLE_ARC_LEFT:
    case OP_TURTLE_ARC_RIGHT: {
      const radius = reader.readVLE();
      const angle = reader.readVLE();
      return { radius, angle };
    }

    case OP_TURTLE_SET_PEN_COLOR: {
      const colorByte = reader.readUint8();
      return { color: byteToColor(colorByte) };
    }

    default:
      return undefined;
  }
}
