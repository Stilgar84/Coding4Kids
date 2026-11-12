import { WorkspaceState, GridState } from '../../types';
import { TurtleState } from '../../simulations/turtle/types';
import { BeatState } from '../../simulations/beat/types';
import { createInitialTurtleState } from '../../simulations/turtle/turtleEnvironment';
import { createInitialBeatState } from '../../simulations/beat/beatEnvironment';
import { BinaryReader, base64URLToUint8Array } from './binaryReader';
import { BinaryWriter, uint8ArrayToBase64URL } from './binaryWriter';
import {
  FORMAT_VERSION,
  ENV_VERSION_GRID,
  ENV_VERSION_TURTLE,
  ENV_VERSION_BEAT,
  ENV_ID_GENERIC,
  ENV_ID_GRID,
  ENV_ID_TURTLE,
  ENV_ID_BEAT,
  ENV_ID_LESSON,
  ENV_ID_PROFILE,
  ImportResult,
  EnvIdName,
  InnerLessonEnvIdName,
} from './types';
import {
  getGridSerializationVersion,
  writeGridState,
  readGridState,
} from './env/gridSerializer';
import { writeCodeScopes, readCodeScopes } from './codeScopes';

export { writeCodeScopes, readCodeScopes };

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

/**
 * Exports a workspace and optional environment state to a raw Uint8Array.
 */
export function exportToBinary(
  workspace: WorkspaceState,
  envId: 'grid' | 'turtle' | 'beat' | 'generic',
  envState?: GridState | TurtleState | BeatState
): Uint8Array {
  const writer = new BinaryWriter();

  // 1. File Header (3 Bytes)
  writer.writeUint8(FORMAT_VERSION);

  const envByte =
    envId === 'grid'
      ? ENV_ID_GRID
      : envId === 'turtle'
      ? ENV_ID_TURTLE
      : envId === 'beat'
      ? ENV_ID_BEAT
      : ENV_ID_GENERIC;
  writer.writeUint8(envByte);

  const envVersion =
    envId === 'grid'
      ? envState && 'width' in envState
        ? getGridSerializationVersion(envState as GridState)
        : ENV_VERSION_GRID
      : envId === 'beat'
      ? ENV_VERSION_BEAT
      : ENV_VERSION_TURTLE;
  writer.writeUint8(envVersion);

  // 2. Environment State (if Grid)
  if (envByte === ENV_ID_GRID && envState && 'width' in envState) {
    writeGridState(writer, envState as GridState, envVersion);
  }

  // 3. Code Payload
  writeCodeScopes(writer, workspace, envByte);

  return writer.getBytes();
}

/**
 * Exports a workspace and optional environment state to a Base64URL string.
 */
export function exportToString(
  workspace: WorkspaceState,
  envId: 'grid' | 'turtle' | 'beat' | 'generic',
  envState?: GridState | TurtleState | BeatState
): string {
  return uint8ArrayToBase64URL(exportToBinary(workspace, envId, envState));
}

/**
 * Path A helper: Exports a curriculum lesson attempt as a code-only Base64URL string
 * (`envId = 0x00` for Grid lessons, `0x02` for Turtle, `0x03` for Beat) so read-only map
 * geometry is never duplicated inside `SavedProgramEntry`.
 */
export function exportLessonCodeOnly(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle' | 'beat' | 'generic'
): string {
  const codeOnlyEnvId = simId === 'grid' ? 'generic' : simId;
  return exportToString(workspace, codeOnlyEnvId);
}

/**
 * Path B helper: Exports a self-contained Curriculum Lesson envelope (`ENV_ID_LESSON = 0x04`):
 * `[FORMAT_VERSION = 1, 0x04, innerEnvByte, lessonIdLen:VLE + UTF8 bytes, lessonVersion:VLE, ...codeScopes]`
 */
export function exportLessonToBinary(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle' | 'beat' | 'generic',
  lessonId: string,
  lessonVersion: number = 1
): Uint8Array {
  const cleanLessonId = lessonId?.trim();
  if (!cleanLessonId) {
    throw new Error('Lesson ID is required for ENV_ID_LESSON serialization');
  }
  const safeVersion = Math.max(1, Math.floor(lessonVersion));
  const innerEnvByte =
    simId === 'turtle'
      ? ENV_ID_TURTLE
      : simId === 'beat'
      ? ENV_ID_BEAT
      : ENV_ID_GENERIC;

  const writer = new BinaryWriter();
  writer.writeUint8(FORMAT_VERSION);
  writer.writeUint8(ENV_ID_LESSON);
  writer.writeUint8(innerEnvByte);

  const idBytes = utf8Encoder.encode(cleanLessonId);
  writer.writeVLE(idBytes.length);
  writer.writeBytes(idBytes);
  writer.writeVLE(safeVersion);

  writeCodeScopes(writer, workspace, innerEnvByte);
  return writer.getBytes();
}

/**
 * Path B helper: Exports a self-contained Curriculum Lesson envelope (`ENV_ID_LESSON = 0x04`)
 * as a Base64URL string.
 */
export function exportLessonToString(
  workspace: WorkspaceState,
  simId: 'grid' | 'turtle' | 'beat' | 'generic',
  lessonId: string,
  lessonVersion: number = 1
): string {
  return uint8ArrayToBase64URL(exportLessonToBinary(workspace, simId, lessonId, lessonVersion));
}

/**
 * Imports a raw Uint8Array into an ImportResult.
 */
export function importFromBinary(bytes: Uint8Array): ImportResult {
  if (!bytes || bytes.length === 0) {
    return { success: false, error: 'Empty binary input' };
  }

  try {
    const reader = new BinaryReader(bytes);
    if (reader.remaining < 3) {
      return { success: false, error: 'Input too short: missing header' };
    }

    // 1. File Header
    const formatVersion = reader.readUint8();
    if (formatVersion !== FORMAT_VERSION) {
      return { success: false, error: `Unsupported format version: ${formatVersion}` };
    }

    const envByte = reader.readUint8();
    const thirdHeaderByte = reader.readUint8();

    if (envByte === ENV_ID_PROFILE) {
      return {
        success: false,
        error: 'Player backup code detected. Open it in Player Backup instead.',
      };
    }

    // Path B: Standalone Curriculum Lesson Envelope (ENV_ID_LESSON = 0x04)
    if (envByte === ENV_ID_LESSON) {
      const innerEnvByte = thirdHeaderByte;
      if (
        innerEnvByte !== ENV_ID_GENERIC &&
        innerEnvByte !== ENV_ID_GRID &&
        innerEnvByte !== ENV_ID_TURTLE &&
        innerEnvByte !== ENV_ID_BEAT
      ) {
        return {
          success: false,
          error: `Unsupported lesson inner environment ID: 0x${innerEnvByte.toString(16)}`,
        };
      }

      const lessonIdLen = reader.readVLE();
      if (lessonIdLen === 0) {
        return { success: false, error: 'Empty lessonId in lesson payload' };
      }
      const lessonIdBytes = reader.readBytes(lessonIdLen);
      const lessonId = utf8Decoder.decode(lessonIdBytes).trim();
      if (!lessonId) {
        return { success: false, error: 'Invalid lessonId in lesson payload' };
      }

      const lessonVersion = reader.readVLE();
      if (lessonVersion < 1) {
        return { success: false, error: `Invalid lessonVersion: ${lessonVersion}` };
      }

      const innerEnvId: InnerLessonEnvIdName =
        innerEnvByte === ENV_ID_TURTLE
          ? 'turtle'
          : innerEnvByte === ENV_ID_BEAT
          ? 'beat'
          : innerEnvByte === ENV_ID_GRID
          ? 'grid'
          : 'generic';

      const workspace = readCodeScopes(reader, innerEnvByte);

      return {
        success: true,
        formatVersion,
        envId: 'lesson',
        envVersion: 1,
        innerEnvId,
        lessonId,
        lessonVersion,
        workspace,
        turtleState: innerEnvByte === ENV_ID_TURTLE ? createInitialTurtleState() : undefined,
        beatState: innerEnvByte === ENV_ID_BEAT ? createInitialBeatState() : undefined,
      };
    }

    const envVersion = thirdHeaderByte;

    let envId: EnvIdName = 'generic';
    if (envByte === ENV_ID_GRID) envId = 'grid';
    else if (envByte === ENV_ID_TURTLE) envId = 'turtle';
    else if (envByte === ENV_ID_BEAT) envId = 'beat';
    else if (envByte !== ENV_ID_GENERIC) {
      return { success: false, error: `Unsupported environment ID: 0x${envByte.toString(16)}` };
    }

    // 2. Environment State
    let gridState: GridState | undefined;
    let turtleState: TurtleState | undefined;
    let beatState: BeatState | undefined;

    if (envByte === ENV_ID_GRID) {
      gridState = readGridState(reader, envVersion);
    } else if (envByte === ENV_ID_TURTLE) {
      turtleState = createInitialTurtleState();
    } else if (envByte === ENV_ID_BEAT) {
      beatState = createInitialBeatState();
    }

    // 3. Code Payload
    const workspace = readCodeScopes(reader, envByte);

    return {
      success: true,
      formatVersion,
      envId,
      envVersion,
      workspace,
      gridState,
      turtleState,
      beatState,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to deserialize code',
    };
  }
}

/**
 * Imports a Base64URL string into an ImportResult.
 */
export function importFromString(serialized: string): ImportResult {
  if (!serialized || typeof serialized !== 'string' || !serialized.trim()) {
    return { success: false, error: 'Empty serialized input' };
  }

  try {
    const bytes = base64URLToUint8Array(serialized.trim());
    return importFromBinary(bytes);
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to decode Base64URL string',
    };
  }
}
