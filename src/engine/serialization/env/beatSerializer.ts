import { CodeBlock, WorkspaceState, isVariableName } from '../../../types';
import {
  BEAT_GRID_SIZE,
  BEAT_LED_PALETTE,
  BeatState,
  DEFAULT_BEAT_LED_COLOR,
} from '../../../simulations/beat/types';
import {
  createEmptyLedGrid,
  presetIdToName,
  presetNameToId,
} from '../../../simulations/beat/presets';
import { BinaryReader } from '../binaryReader';
import { BinaryWriter } from '../binaryWriter';
import {
  ENV_VERSION_BEAT,
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
  OP_BEAT_SET_DELAY,
  OP_BEAT_WAIT_DURATION,
  encodeVarOrSensorIndex,
  decodeVarOrSensorIndex,
  isSensorRefString,
} from '../types';

export { ENV_VERSION_BEAT };
export const ENV_VERSION_BEAT_V2 = 2;

function isVarVal(val: unknown): boolean {
  return (
    isVariableName(val) ||
    isSensorRefString(val) ||
    (typeof val === 'string' && /^[a-z]$/.test(val.trim()))
  );
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
    writer.writeUint8(encodeVarOrSensorIndex(String(val)));
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
    return decodeVarOrSensorIndex(reader.readUint8());
  }
  return reader.readVLE();
}

// Maps canonical color names / TypedValue names to BEAT_LED_PALETTE index (0..9):
// 0=Rose(#f43f5e), 1=Orange(#f97316), 2=Yellow(#fbbf24), 3=Emerald(#10b981), 4=Cyan(#06b6d4),
// 5=Blue(#3b82f6), 6=Violet(#a855f7), 7=Pink(#ec4899), 8=White(#ffffff), 9=Off/Black(#0f172a)
const BEAT_COLOR_NAME_TO_BYTE: Record<string, number> = {
  red: 0,
  rose: 0,
  orange: 1,
  amber: 2,
  yellow: 2,
  green: 3,
  emerald: 3,
  cyan: 4,
  blue: 5,
  purple: 6,
  violet: 6,
  pink: 7,
  white: 8,
  black: 9,
  off: 9,
  slate: 9,
};

const CANONICAL_INDEX_TO_BEAT_BYTE: readonly number[] = [
  9, // 0: black -> #0f172a
  0, // 1: red -> #f43f5e
  5, // 2: blue -> #3b82f6
  3, // 3: green -> #10b981
  2, // 4: amber -> #fbbf24
  6, // 5: purple -> #a855f7
  7, // 6: pink -> #ec4899
  4, // 7: cyan -> #06b6d4
  1, // 8: orange -> #f97316
  8, // 9: white -> #ffffff
];

export function beatColorToByte(color?: unknown): number {
  if (color === null || color === undefined) return 0;

  if (typeof color === 'object') {
    const obj = color as { type?: unknown; value?: unknown };
    if (obj.type === 'color' && obj.value !== undefined) {
      if (typeof obj.value === 'number' && Number.isFinite(obj.value)) {
        const idx = Math.max(
          0,
          Math.min(CANONICAL_INDEX_TO_BEAT_BYTE.length - 1, Math.trunc(obj.value))
        );
        return CANONICAL_INDEX_TO_BEAT_BYTE[idx];
      }
      return beatColorToByte(obj.value);
    }
    return 0;
  }

  if (typeof color === 'number') {
    if (!Number.isFinite(color)) return 0;
    return Math.max(0, Math.min(BEAT_LED_PALETTE.length - 1, Math.trunc(color)));
  }

  if (typeof color === 'string') {
    const trimmed = color.trim();
    if (!trimmed) return 0;
    const lower = trimmed.toLowerCase();

    if (lower === '#ef4444') return 0;
    if (lower === '#f59e0b') return 2;
    if (lower === '#22c55e') return 3;
    if (lower === '#8b5cf6') return 6;
    if (lower === '#000000') return 9;

    const hexIdx = BEAT_LED_PALETTE.findIndex((s) => s.hex.toLowerCase() === lower);
    if (hexIdx >= 0) return hexIdx;

    const cleanName = lower.startsWith('color:') ? lower.slice(6).trim() : lower;
    if (cleanName in BEAT_COLOR_NAME_TO_BYTE) {
      return BEAT_COLOR_NAME_TO_BYTE[cleanName];
    }
    if (/^-?\d+$/.test(cleanName)) {
      const n = Math.trunc(Number(cleanName));
      if (lower.startsWith('color:')) {
        return CANONICAL_INDEX_TO_BEAT_BYTE[
          Math.max(0, Math.min(CANONICAL_INDEX_TO_BEAT_BYTE.length - 1, n))
        ];
      }
      return Math.max(0, Math.min(BEAT_LED_PALETTE.length - 1, n));
    }
  }

  return 0;
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
    case 'WAIT_BEAT': {
      const dur = block.params?.duration;
      if ((dur !== undefined && dur !== 1) || isVarVal(dur)) {
        return OP_BEAT_WAIT_DURATION;
      }
      return OP_BEAT_WAIT_BEAT;
    }
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
    case 'SET_BEAT_DELAY':
      return OP_BEAT_SET_DELAY;
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
      return { param0IsVar: isVarVal(params.pitch), param1IsVar: isVarVal(params.duration) };
    case OP_BEAT_SET_LED_COLOR:
      return { param0IsVar: isVarVal(params.color), param1IsVar: false };
    case OP_BEAT_LIGHT_ROW:
      return { param0IsVar: isVarVal(params.y), param1IsVar: false };
    case OP_BEAT_LIGHT_COL:
      return { param0IsVar: isVarVal(params.x), param1IsVar: false };
    case OP_BEAT_LIGHT_PIXEL:
      return { param0IsVar: isVarVal(params.x), param1IsVar: isVarVal(params.y) };
    case OP_BEAT_SET_DELAY:
      return {
        param0IsVar: isVarVal(params.delay ?? params.multiplier),
        param1IsVar: false,
      };
    case OP_BEAT_WAIT_DURATION:
      return { param0IsVar: isVarVal(params.duration), param1IsVar: false };
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
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.preset ?? params?.presetId ?? 'a')));
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

    // Tier 2 (Module 2+), Tier 3 (Module 3+ Cursor) & Phase 3 Beat & Light opcodes
    case OP_BEAT_PLAY_NOTE: {
      writeBeatVarOrVLE(writer, params?.pitch, 1, (paramVarMask & 0x02) !== 0);
      if ((paramVarMask & 0x04) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.duration ?? 'a')));
      } else {
        const rawDur = Number(params?.duration ?? 1);
        const dur = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : 1;
        if (Math.abs(dur - 0.5) < 1e-6) {
          writer.writeUint8(0);
        } else if (Math.abs(dur - 1) < 1e-6) {
          writer.writeUint8(1);
        } else if (Math.abs(dur - 2) < 1e-6) {
          writer.writeUint8(2);
        } else {
          // Extended Phase 3 literal duration (e.g. 0.125, 0.25, 4, 1.5): escape code 3 + milli-beats VLE
          writer.writeUint8(3);
          writer.writeVLE(Math.max(1, Math.round(dur * 1000)));
        }
      }
      break;
    }

    case OP_BEAT_SET_LED_COLOR: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.color ?? 'a')));
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
      const rawDir = params?.direction ?? params?.dir;
      const dirByte =
        rawDir === 0 || String(rawDir ?? 'RIGHT').trim().toUpperCase() === 'LEFT' ? 0 : 1;
      writer.writeUint8(dirByte);
      break;
    }

    case OP_BEAT_SET_DELAY: {
      const delayVal = params?.delay ?? params?.multiplier;
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(delayVal ?? 'a')));
      } else {
        const mult = Number(delayVal ?? 0);
        const scaled = Math.max(0, Math.round((Number.isFinite(mult) ? mult : 0) * 100));
        writer.writeVLE(scaled);
      }
      break;
    }

    case OP_BEAT_WAIT_DURATION: {
      if ((paramVarMask & 0x02) !== 0) {
        writer.writeUint8(encodeVarOrSensorIndex(String(params?.duration ?? 'a')));
      } else {
        const dur = Number(params?.duration ?? 1);
        const scaled = Math.max(0, Math.round((Number.isFinite(dur) ? dur : 1) * 100));
        writer.writeVLE(scaled);
      }
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
        return { type: 'STAMP_PRESET', params: { preset: decodeVarOrSensorIndex(rawByte) } };
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
      let duration: number | string;
      if ((paramVarMask & 0x04) !== 0) {
        duration = decodeVarOrSensorIndex(reader.readUint8());
      } else {
        const durCode = reader.readUint8();
        if (durCode === 3) {
          duration = reader.readVLE() / 1000;
        } else {
          duration = durCode === 0 ? 0.5 : durCode === 2 ? 2 : 1;
        }
      }
      return { type: 'PLAY_NOTE', params: { pitch, duration } };
    }
    case OP_BEAT_SET_LED_COLOR: {
      const color =
        (paramVarMask & 0x02) !== 0
          ? decodeVarOrSensorIndex(reader.readUint8())
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
    case OP_BEAT_SET_DELAY: {
      const delay =
        (paramVarMask & 0x02) !== 0
          ? decodeVarOrSensorIndex(reader.readUint8())
          : reader.readVLE() / 100;
      return { type: 'SET_BEAT_DELAY', params: { delay } };
    }
    case OP_BEAT_WAIT_DURATION: {
      const duration =
        (paramVarMask & 0x02) !== 0
          ? decodeVarOrSensorIndex(reader.readUint8())
          : reader.readVLE() / 100;
      return { type: 'WAIT_BEAT', params: { duration } };
    }
    default:
      throw new Error(`Unknown Beat opcode: 0x${opcode.toString(16)}`);
  }
}

function workspaceUsesPhase3BeatNoteEncoding(workspace?: WorkspaceState | null): boolean {
  if (!workspace) return false;
  for (const blocks of Object.values(workspace)) {
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (b.type === 'PLAY_NOTE') {
        const dur = b.params?.duration;
        if (isVarVal(dur)) return true;
        if (dur !== undefined) {
          const num = Number(dur);
          if (
            Number.isFinite(num) &&
            Math.abs(num - 0.5) >= 1e-6 &&
            Math.abs(num - 1) >= 1e-6 &&
            Math.abs(num - 2) >= 1e-6
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Determines the minimum Beat environment serialization version (`1` or `2`).
 * Default `8x8` states with standard `stepDelayMultiplier === 1` and Tier 1/2 durations remain version `1`.
 */
export function getBeatSerializationVersion(
  state?: Partial<BeatState> | null,
  workspace?: WorkspaceState | null
): number {
  const hasCustomDims =
    (typeof state?.width === 'number' && state.width !== BEAT_GRID_SIZE) ||
    (typeof state?.height === 'number' && state.height !== BEAT_GRID_SIZE);
  const hasCustomDelay =
    typeof state?.stepDelayMultiplier === 'number' &&
    Number.isFinite(state.stepDelayMultiplier) &&
    Math.abs(state.stepDelayMultiplier - 1) > 1e-6;
  if (hasCustomDims || hasCustomDelay || workspaceUsesPhase3BeatNoteEncoding(workspace)) {
    return ENV_VERSION_BEAT_V2;
  }
  return ENV_VERSION_BEAT;
}

/**
 * Writes Beat environment metadata payload (`v1` = 0 bytes; `v2` = `beatFlags` + optional `width`/`height`/`stepDelayMultiplier`).
 */
export function writeBeatState(
  writer: BinaryWriter,
  state?: Partial<BeatState> | null,
  envVersion: number = getBeatSerializationVersion(state)
): void {
  if (envVersion < ENV_VERSION_BEAT_V2) {
    return;
  }

  const width =
    typeof state?.width === 'number' && state.width > 0 ? Math.round(state.width) : BEAT_GRID_SIZE;
  const height =
    typeof state?.height === 'number' && state.height > 0
      ? Math.round(state.height)
      : BEAT_GRID_SIZE;
  const hasCustomDims = width !== BEAT_GRID_SIZE || height !== BEAT_GRID_SIZE;
  const delayMult =
    typeof state?.stepDelayMultiplier === 'number' && Number.isFinite(state.stepDelayMultiplier)
      ? state.stepDelayMultiplier
      : 1;
  const hasCustomDelay = Math.abs(delayMult - 1) > 1e-6;

  const beatFlags =
    (hasCustomDims ? 0x01 : 0) |
    (hasCustomDelay ? 0x02 : 0) |
    (state?.isMuted ? 0x04 : 0);

  writer.writeUint8(beatFlags);

  if (hasCustomDims) {
    writer.writeUint8(Math.min(255, Math.max(1, width)));
    writer.writeUint8(Math.min(255, Math.max(1, height)));
  }

  if (hasCustomDelay) {
    writer.writeVLE(Math.max(0, Math.round(delayMult * 100)));
  }
}

function createBaseBeatState(isMuted: boolean = false): BeatState {
  return {
    leds: createEmptyLedGrid(),
    activeColor: DEFAULT_BEAT_LED_COLOR,
    isColorCustomized: false,
    beatIndex: 0,
    stepCount: 0,
    lastTriggeredEvent: null,
    cursor: { x: 1, y: 1, dir: 'EAST', visible: false },
    edgeBonk: false,
    edgeBonkPulse: 0,
    isMuted,
    stepDelayMultiplier: 1,
    status: 'IDLE',
  };
}

/**
 * Reads Beat environment metadata payload (`v1` = default initial state; `v2` = `beatFlags` + optional `width`/`height`/`stepDelayMultiplier`).
 */
export function readBeatState(
  reader: BinaryReader,
  envVersion: number = ENV_VERSION_BEAT
): BeatState {
  if (envVersion < ENV_VERSION_BEAT_V2) {
    return createBaseBeatState(false);
  }

  const beatFlags = reader.readUint8();
  const hasCustomDims = (beatFlags & 0x01) !== 0;
  const hasCustomDelay = (beatFlags & 0x02) !== 0;
  const isMuted = (beatFlags & 0x04) !== 0;

  const base = createBaseBeatState(isMuted);

  let width: number | undefined;
  let height: number | undefined;
  if (hasCustomDims) {
    width = reader.readUint8();
    height = reader.readUint8();
  }

  let stepDelayMultiplier = base.stepDelayMultiplier;
  if (hasCustomDelay) {
    stepDelayMultiplier = reader.readVLE() / 100;
  }

  return {
    ...base,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    stepDelayMultiplier,
  };
}
