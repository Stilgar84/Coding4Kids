import { CodeBlock, isVariableName } from '../../../types';
import { BEAT_LED_PALETTE } from '../../../simulations/beat/types';
import { presetIdToName, presetNameToId } from '../../../simulations/beat/presets';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  OP_BEAT_DRUM_KICK,
  OP_BEAT_DRUM_SNARE,
  OP_BEAT_DRUM_CLAP,
  OP_BEAT_PLAY_CHIME,
  OP_BEAT_STAMP_PRESET,
  OP_BEAT_WAIT_BEAT,
  OP_BEAT_CLEAR_LEDS,
  OP_BEAT_PLAY_NOTE,
  OP_BEAT_SET_LED_COLOR,
  OP_BEAT_LIGHT_ROW,
  OP_BEAT_LIGHT_COL,
  OP_BEAT_LIGHT_PIXEL,
  OP_BEAT_CURSOR_STEP,
  OP_BEAT_CURSOR_TURN,
  varNameToIndex,
  indexToVarName,
} from '../types';

function isVarVal(val: unknown): boolean {
  return isVariableName(val) || (typeof val === 'string' && /^[a-z]$/.test(val.trim()));
}

/**
 * Helper to write a numeric or variable parameter in Beat & Light opcodes.
 * Uses `paramVarMask` bit (`0x02` for param0, `0x04` for param1) ready for MASK_HAS_VAR_PARAM (0x80).
 */
export function writeBeatVarOrVLE(
  writer: BinaryWriter,
  val: unknown,
  defaultVal: number,
  isVarFlag: boolean
): void {
  if (isVarFlag) {
    writer.writeUint8(varNameToIndex(String(val)));
  } else {
    const num = Math.max(0, Math.round(Number(val ?? defaultVal)));
    writer.writeVLE(Number.isFinite(num) ? num : defaultVal);
  }
}

/**
 * Helper to read a numeric or variable parameter in Beat & Light opcodes.
 */
export function readBeatVarOrVLE(reader: BinaryReader, isVarFlag: boolean): number | string {
  if (isVarFlag) {
    return indexToVarName(reader.readUint8());
  }
  return reader.readVLE();
}

export function beatColorToByte(color?: string | number): number {
  if (typeof color === 'number') {
    return Math.max(0, Math.min(BEAT_LED_PALETTE.length - 1, Math.round(color)));
  }
  if (!color) return 0;
  const lower = color.toLowerCase();
  const idx = BEAT_LED_PALETTE.findIndex((s) => s.hex.toLowerCase() === lower);
  return idx >= 0 ? idx : 0;
}

export function byteToBeatColor(byte: number): string {
  return BEAT_LED_PALETTE[byte]?.hex ?? BEAT_LED_PALETTE[0].hex;
}

/**
 * Maps a Beat & Light CodeBlock to its 5-bit environment opcode (0x10..0x1D).
 */
export function getBeatOpcodeForBlock(block: CodeBlock): number {
  switch (block.type) {
    case 'DRUM_KICK':
      return OP_BEAT_DRUM_KICK;
    case 'DRUM_SNARE':
      return OP_BEAT_DRUM_SNARE;
    case 'DRUM_CLAP':
      return OP_BEAT_DRUM_CLAP;
    case 'PLAY_CHIME':
      return OP_BEAT_PLAY_CHIME;
    case 'STAMP_HEART':
    case 'STAMP_STAR':
    case 'STAMP_SMILE':
    case 'STAMP_PRESET':
      return OP_BEAT_STAMP_PRESET;
    case 'WAIT_BEAT':
      return OP_BEAT_WAIT_BEAT;
    case 'CLEAR_LEDS':
      return OP_BEAT_CLEAR_LEDS;
    case 'PLAY_NOTE':
      return OP_BEAT_PLAY_NOTE;
    case 'SET_LED_COLOR':
      return OP_BEAT_SET_LED_COLOR;
    case 'LIGHT_ROW':
      return OP_BEAT_LIGHT_ROW;
    case 'LIGHT_COL':
      return OP_BEAT_LIGHT_COL;
    case 'LIGHT_PIXEL':
      return OP_BEAT_LIGHT_PIXEL;
    case 'CURSOR_STEP':
      return OP_BEAT_CURSOR_STEP;
    case 'CURSOR_TURN':
      return OP_BEAT_CURSOR_TURN;
    default:
      throw new Error(`Unsupported Beat block type: ${block.type}`);
  }
}

/**
 * Inspects Beat block parameters for variable names so `codeSerializer` can set MASK_HAS_VAR_PARAM (0x80)
 * and `paramVarMask` (`0x02` = param0 is variable, `0x04` = param1 is variable).
 */
export function getBeatParamVarFlags(
  opcode: number,
  params?: Record<string, any>
): { param0IsVar: boolean; param1IsVar: boolean } {
  if (!params) return { param0IsVar: false, param1IsVar: false };

  switch (opcode) {
    case OP_BEAT_STAMP_PRESET:
      return { param0IsVar: isVarVal(params.preset ?? params.presetId), param1IsVar: false };
    case OP_BEAT_PLAY_NOTE:
      return { param0IsVar: isVarVal(params.pitch), param1IsVar: false };
    case OP_BEAT_SET_LED_COLOR:
      return { param0IsVar: isVarVal(params.color), param1IsVar: false };
    case OP_BEAT_LIGHT_ROW:
      return { param0IsVar: isVarVal(params.y), param1IsVar: false };
    case OP_BEAT_LIGHT_COL:
      return { param0IsVar: isVarVal(params.x), param1IsVar: false };
    case OP_BEAT_LIGHT_PIXEL:
      return { param0IsVar: isVarVal(params.x), param1IsVar: isVarVal(params.y) };
    default:
      return { param0IsVar: false, param1IsVar: false };
  }
}

/**
 * Serializes action-specific parameters for Beat & Light opcodes (0x10..0x1D).
 */
export function writeBeatParams(
  writer: BinaryWriter,
  opcode: number,
  blockType: string,
  params?: Record<string, any>,
  paramVarMask: number = 0
): void {
  switch (opcode) {
    case OP_BEAT_STAMP_PRESET: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(varNameToIndex(String(params?.preset ?? params?.presetId ?? 'a')));
      } else if (blockType === 'STAMP_HEART') {
        writer.writeUint8(0);
      } else if (blockType === 'STAMP_STAR') {
        writer.writeUint8(1);
      } else if (blockType === 'STAMP_SMILE') {
        writer.writeUint8(2);
      } else {
        // Explicit STAMP_PRESET block:
        // Preset IDs 0..2 set bit 7 (0x80 | id) so explicit STAMP_PRESET round-trips as STAMP_PRESET,
        // while preset IDs >= 3 write their ID directly (and decoding accepts both!).
        const id = presetNameToId(params?.preset ?? params?.presetId ?? 'HEART') & 0x7f;
        writer.writeUint8(id <= 2 ? (0x80 | id) : id);
      }
      break;
    }

    // Forward-compatible hooks for Commit 13 (Tier 2) & Commit 17 (Tier 3)
    case OP_BEAT_PLAY_NOTE: {
      writeBeatVarOrVLE(writer, params?.pitch, 1, (paramVarMask & 0x02) !== 0);
      const dur = Number(params?.duration ?? 1);
      const durCode = dur <= 0.5 ? 0 : dur >= 2 ? 2 : 1;
      writer.writeUint8(durCode);
      break;
    }

    case OP_BEAT_SET_LED_COLOR: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(varNameToIndex(params?.color));
      } else {
        writer.writeUint8(beatColorToByte(params?.color));
      }
      break;
    }

    case OP_BEAT_LIGHT_ROW: {
      writeBeatVarOrVLE(writer, params?.y, 1, (paramVarMask & 0x02) !== 0);
      break;
    }

    case OP_BEAT_LIGHT_COL: {
      writeBeatVarOrVLE(writer, params?.x, 1, (paramVarMask & 0x02) !== 0);
      break;
    }

    case OP_BEAT_LIGHT_PIXEL: {
      writeBeatVarOrVLE(writer, params?.x, 1, (paramVarMask & 0x02) !== 0);
      writeBeatVarOrVLE(writer, params?.y, 1, (paramVarMask & 0x04) !== 0);
      break;
    }

    case OP_BEAT_CURSOR_TURN: {
      const dirByte = params?.direction === 'LEFT' || params?.dir === 'LEFT' ? 0 : 1;
      writer.writeUint8(dirByte);
      break;
    }

    default:
      // No parameters for DRUM_KICK, DRUM_SNARE, DRUM_CLAP, PLAY_CHIME, WAIT_BEAT, CLEAR_LEDS, CURSOR_STEP
      break;
  }
}

/**
 * Deserializes a Beat & Light opcode + parameter bytes into `{ type, params }`.
 */
export function readBeatBlock(
  reader: BinaryReader,
  opcode: number,
  paramVarMask: number = 0
): { type: string; params?: Record<string, any> } {
  switch (opcode) {
    case OP_BEAT_DRUM_KICK:
      return { type: 'DRUM_KICK' };
    case OP_BEAT_DRUM_SNARE:
      return { type: 'DRUM_SNARE' };
    case OP_BEAT_DRUM_CLAP:
      return { type: 'DRUM_CLAP' };
    case OP_BEAT_PLAY_CHIME:
      return { type: 'PLAY_CHIME' };
    case OP_BEAT_STAMP_PRESET: {
      const rawByte = reader.readUint8();
      if ((paramVarMask & 0x02) !== 0) {
        return { type: 'STAMP_PRESET', params: { preset: indexToVarName(rawByte) } };
      }
      if (rawByte === 0) return { type: 'STAMP_HEART' };
      if (rawByte === 1) return { type: 'STAMP_STAR' };
      if (rawByte === 2) return { type: 'STAMP_SMILE' };
      const preset = presetIdToName(rawByte & 0x7f);
      return { type: 'STAMP_PRESET', params: { preset } };
    }
    case OP_BEAT_WAIT_BEAT:
      return { type: 'WAIT_BEAT' };
    case OP_BEAT_CLEAR_LEDS:
      return { type: 'CLEAR_LEDS' };

    // Forward-compatible decoding for Commit 13 & Commit 17 opcodes
    case OP_BEAT_PLAY_NOTE: {
      const pitch = readBeatVarOrVLE(reader, (paramVarMask & 0x02) !== 0);
      const durCode = reader.readUint8();
      const duration = durCode === 0 ? 0.5 : durCode === 2 ? 2 : 1;
      return { type: 'PLAY_NOTE', params: { pitch, duration } };
    }
    case OP_BEAT_SET_LED_COLOR: {
      const color =
        (paramVarMask & 0x02) !== 0
          ? indexToVarName(reader.readUint8())
          : byteToBeatColor(reader.readUint8());
      return { type: 'SET_LED_COLOR', params: { color } };
    }
    case OP_BEAT_LIGHT_ROW: {
      const y = readBeatVarOrVLE(reader, (paramVarMask & 0x02) !== 0);
      return { type: 'LIGHT_ROW', params: { y } };
    }
    case OP_BEAT_LIGHT_COL: {
      const x = readBeatVarOrVLE(reader, (paramVarMask & 0x02) !== 0);
      return { type: 'LIGHT_COL', params: { x } };
    }
    case OP_BEAT_LIGHT_PIXEL: {
      const x = readBeatVarOrVLE(reader, (paramVarMask & 0x02) !== 0);
      const y = readBeatVarOrVLE(reader, (paramVarMask & 0x04) !== 0);
      return { type: 'LIGHT_PIXEL', params: { x, y } };
    }
    case OP_BEAT_CURSOR_STEP:
      return { type: 'CURSOR_STEP' };
    case OP_BEAT_CURSOR_TURN: {
      const dirByte = reader.readUint8();
      return { type: 'CURSOR_TURN', params: { direction: dirByte === 0 ? 'LEFT' : 'RIGHT' } };
    }
    default:
      throw new Error(`Unknown Beat opcode: 0x${opcode.toString(16)}`);
  }
}
