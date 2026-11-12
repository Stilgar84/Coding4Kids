import { CodeBlock, SimulationStatus, WorkspaceState } from '../../types';
import {
  compareCurriculumActivityIds,
  getActivityAtVersion,
  getActivityLatest,
} from '../../data/curriculum';
import {
  CURRENT_STORAGE_VERSION,
  DEFAULT_FALLBACK_THUMBNAIL,
} from '../../services/localSaveService';
import type {
  LessonAutosaveEntry,
  LessonCompletionRecord,
  ProfileAvatarId,
  ProfileBackupEnvelopeV1,
  ProfileColorId,
  ProfileCurriculumProgress,
  SandboxAutosaveEntry,
} from '../../services/profileService';
import { BinaryReader, base64URLToUint8Array } from './binaryReader';
import { BinaryWriter, uint8ArrayToBase64URL } from './binaryWriter';
import { exportCodeOnlyToBinary, importCodeOnlyFromBinary } from './codeScopes';
import {
  ENV_ID_BEAT,
  ENV_ID_GENERIC,
  ENV_ID_GRID,
  ENV_ID_LESSON,
  ENV_ID_PROFILE,
  ENV_ID_TURTLE,
  ENV_VERSION_PROFILE,
  FORMAT_VERSION,
} from './types';

const WIRE_BACKUP_MAGIC = 'ROBOTEMU_PROFILE_BACKUP' as const;
const WIRE_BACKUP_VERSION = 1;

const WIRE_AVATAR_IDS: readonly ProfileAvatarId[] = [
  'robot',  // 0
  'frog',   // 1
  'fox',    // 2
  'owl',    // 3
  'cat',    // 4
  'panda',  // 5
  'rocket', // 6
  'turtle', // 7
];

const WIRE_COLORS: ReadonlyArray<{ id: ProfileColorId; accentColor: string }> = [
  { id: 'sky', accentColor: '#0ea5e9' },     // 0
  { id: 'emerald', accentColor: '#10b981' }, // 1
  { id: 'amber', accentColor: '#f59e0b' },   // 2
  { id: 'violet', accentColor: '#8b5cf6' },  // 3
  { id: 'rose', accentColor: '#f43f5e' },    // 4
  { id: 'orange', accentColor: '#f97316' },  // 5
];

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

// Progress section flags (uint8)
const PROGRESS_FLAG_UNLOCK_ALL = 0x01;
const PROGRESS_FLAG_V1_COMPLETIONS = 0x02;
const PROGRESS_FLAG_VERSIONED_COMPLETIONS = 0x04;
const PROGRESS_FLAG_NON_DEFAULT_UNLOCKS = 0x08;
const PROGRESS_FLAG_BADGES = 0x10;
const PROGRESS_FLAG_EARNED_MEDALS = 0x20;
const PROGRESS_FLAGS_RESERVED_MASK = 0xc0;

// Record entry kinds (bits 1..0 of recordHeader)
const ENTRY_KIND_LESSON_AUTOSAVE = 0;
const ENTRY_KIND_SANDBOX_AUTOSAVE = 1;
const ENTRY_KIND_MANUAL_LESSON_SAVE = 2;
const ENTRY_KIND_MANUAL_SANDBOX_SAVE = 3;

// Compact 3-bit simCode table
const SIM_CODE_GRID = 0;
const SIM_CODE_TURTLE = 1;
const SIM_CODE_BEAT = 2;
const SIM_CODE_SWITCHYARD = 3;
const SIM_CODE_CUSTOM_UTF8 = 7;

const BEAT_EXCLUSIVE_BLOCKS = new Set<string>([
  'DRUM_KICK',
  'DRUM_SNARE',
  'DRUM_CLAP',
  'PLAY_CHIME',
  'STAMP_HEART',
  'STAMP_STAR',
  'STAMP_SMILE',
  'STAMP_PRESET',
  'WAIT_BEAT',
  'CLEAR_LEDS',
  'PLAY_NOTE',
  'SET_LED_COLOR',
  'LIGHT_ROW',
  'LIGHT_COL',
  'LIGHT_PIXEL',
  'CURSOR_STEP',
  'CURSOR_TURN',
]);

const TURTLE_EXCLUSIVE_BLOCKS = new Set<string>([
  'FORWARD',
  'BACKWARD',
  'ARC_LEFT',
  'ARC_RIGHT',
  'PEN_UP',
  'PEN_DOWN',
  'SET_PEN_COLOR',
  'SET_PEN_WIDTH',
]);

const GRID_EXCLUSIVE_BLOCKS = new Set<string>([
  'MOVE_FWD',
  'MOVE_BACK',
  'PICK_UP',
  'USE_DROP',
]);

const SWITCHYARD_EXCLUSIVE_BLOCKS = new Set<string>([
  'COUPLE',
  'UNCOUPLE',
  'SWITCH_TRACK',
  'TOGGLE_SWITCH',
  'MOVE_TRAIN',
  'SEND_TRAIN',
  'WAIT_SIGNAL',
]);

/**
 * Checks whether `bytes` starts with the compact binary profile backup header
 * `[FORMAT_VERSION = 1, ENV_ID_PROFILE = 0x06, profileVersion]`.
 */
export function isBinaryProfileBackupBytes(bytes: unknown): bytes is Uint8Array {
  return (
    bytes instanceof Uint8Array &&
    bytes.length >= 3 &&
    bytes[0] === FORMAT_VERSION &&
    bytes[1] === ENV_ID_PROFILE
  );
}

function sliceNameCodepointSafe(raw: string, maxCodeUnits = 24): string {
  const trimmed = raw.trim();
  if (trimmed.length <= maxCodeUnits) return trimmed;
  let sliced = trimmed.slice(0, maxCodeUnits);
  const lastCode = sliced.charCodeAt(sliced.length - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    sliced = sliced.slice(0, -1);
  }
  return sliced;
}

function writeUtf8String(writer: BinaryWriter, str: string): void {
  const bytes = utf8Encoder.encode(str);
  writer.writeVLE(bytes.length);
  writer.writeBytes(bytes);
}

function readUtf8String(reader: BinaryReader, maxBytes = 65536): string {
  const len = reader.readVLE();
  if (len > maxBytes) {
    throw new Error(`String length ${len} exceeds maximum allowed ${maxBytes}`);
  }
  const bytes = reader.readBytes(len);
  return utf8Decoder.decode(bytes);
}

/**
 * Encodes a curriculum lesson / capstone / mastery challenge identifier:
 * - `0x80..0xFD`: 1-byte canonical Modules 1..9 (`1.0`..`9.10`, `1A`..`9C`)
 * - `0xFE`: 2-byte canonical Mastery Challenge (`C1.1`..`C16.16`)
 * - `0x01..0x7F`: short UTF-8 (`1..127` bytes)
 * - `0x00`: long (`>= 128` bytes) or empty UTF-8 escape (`[0x00, len: VLE, ...bytes]`)
 */
export function encodeCompactLessonId(writer: BinaryWriter, lessonId: string): void {
  const numMatch = /^([1-9])\.([0-9]|10)$/.exec(lessonId);
  if (numMatch) {
    const moduleNum = Number(numMatch[1]);
    const subCode = Number(numMatch[2]); // 0..10
    writer.writeUint8(0x80 + (moduleNum - 1) * 14 + subCode);
    return;
  }

  const capMatch = /^([1-9])([A-C])$/.exec(lessonId);
  if (capMatch) {
    const moduleNum = Number(capMatch[1]);
    const subCode = 11 + (capMatch[2].charCodeAt(0) - 65); // 11..13
    writer.writeUint8(0x80 + (moduleNum - 1) * 14 + subCode);
    return;
  }

  const chalMatch = /^C([1-9]|1[0-6])\.([1-9]|1[0-6])$/.exec(lessonId);
  if (chalMatch) {
    const modNum = Number(chalMatch[1]);
    const chalNum = Number(chalMatch[2]);
    writer.writeUint8(0xfe);
    writer.writeUint8(((modNum - 1) << 4) | (chalNum - 1));
    return;
  }

  const bytes = utf8Encoder.encode(lessonId);
  if (bytes.length >= 1 && bytes.length <= 127) {
    writer.writeUint8(bytes.length);
    writer.writeBytes(bytes);
    return;
  }

  writer.writeUint8(0x00);
  writer.writeVLE(bytes.length);
  writer.writeBytes(bytes);
}

/**
 * Decodes a `CompactLessonId` written by `encodeCompactLessonId`.
 */
export function decodeCompactLessonId(reader: BinaryReader): string {
  const tag = reader.readUint8();

  if (tag >= 0x80 && tag <= 0xfd) {
    const idx = tag - 0x80;
    const moduleNum = Math.floor(idx / 14) + 1;
    const subCode = idx % 14;
    if (subCode <= 10) {
      return `${moduleNum}.${subCode}`;
    }
    return `${moduleNum}${String.fromCharCode(65 + (subCode - 11))}`;
  }

  if (tag === 0xfe) {
    const packed = reader.readUint8();
    const modNum = ((packed >> 4) & 0x0f) + 1;
    const chalNum = (packed & 0x0f) + 1;
    return `C${modNum}.${chalNum}`;
  }

  if (tag === 0xff) {
    throw new Error('Unsupported reserved CompactLessonId tag: 0xff');
  }

  if (tag >= 0x01 && tag <= 0x7f) {
    const bytes = reader.readBytes(tag);
    return utf8Decoder.decode(bytes);
  }

  // tag === 0x00: long or empty UTF-8 escape
  const len = reader.readVLE();
  if (len > 4096) {
    throw new Error(`CompactLessonId length ${len} exceeds maximum allowed`);
  }
  const bytes = reader.readBytes(len);
  return utf8Decoder.decode(bytes);
}

function isWorkspaceEmpty(ws?: WorkspaceState | null): boolean {
  if (!ws) return true;
  return (
    (ws.MAIN?.length ?? 0) === 0 &&
    (ws.F1?.length ?? 0) === 0 &&
    (ws.F2?.length ?? 0) === 0 &&
    (ws.F3?.length ?? 0) === 0
  );
}

function createEmptyWorkspace(): WorkspaceState {
  return {
    MAIN: [],
    F1: [],
    F2: [],
    F3: [],
  };
}

function inferSimIdFromWorkspace(
  ws: WorkspaceState
): 'grid' | 'turtle' | 'beat' | 'switchyard' {
  const allBlocks: CodeBlock[] = [
    ...(ws.MAIN ?? []),
    ...(ws.F1 ?? []),
    ...(ws.F2 ?? []),
    ...(ws.F3 ?? []),
  ];

  for (const block of allBlocks) {
    if (!block || typeof block.type !== 'string') continue;
    if (BEAT_EXCLUSIVE_BLOCKS.has(block.type)) {
      return 'beat';
    }
    if (
      SWITCHYARD_EXCLUSIVE_BLOCKS.has(block.type) ||
      block.type.startsWith('TRAIN_') ||
      block.type.startsWith('TRACK_') ||
      block.type.startsWith('SWITCHYARD_')
    ) {
      return 'switchyard';
    }
    if (TURTLE_EXCLUSIVE_BLOCKS.has(block.type)) {
      return 'turtle';
    }
    if (
      (block.type === 'TURN_LEFT' || block.type === 'TURN_RIGHT') &&
      block.params?.angle !== undefined
    ) {
      return 'turtle';
    }
    if (GRID_EXCLUSIVE_BLOCKS.has(block.type)) {
      return 'grid';
    }
  }

  return 'grid';
}

function toCodeOnlySerializerEnv(simId: string): 'generic' | 'turtle' | 'beat' {
  if (simId === 'turtle') return 'turtle';
  if (simId === 'beat') return 'beat';
  return 'generic';
}

function encodeAutosaveWorkspacePayload(
  ws: WorkspaceState,
  preferredSimId?: string
): Uint8Array {
  if (preferredSimId) {
    try {
      return exportCodeOnlyToBinary(ws, toCodeOnlySerializerEnv(preferredSimId));
    } catch {
      // Fall back to workspace block inspection if preferred simId mismatches experimental blocks
    }
  }
  const inferred = inferSimIdFromWorkspace(ws);
  return exportCodeOnlyToBinary(ws, toCodeOnlySerializerEnv(inferred));
}

function simIdToCode(simId: string): number {
  if (simId === 'grid') return SIM_CODE_GRID;
  if (simId === 'turtle') return SIM_CODE_TURTLE;
  if (simId === 'beat') return SIM_CODE_BEAT;
  if (simId === 'switchyard') return SIM_CODE_SWITCHYARD;
  return SIM_CODE_CUSTOM_UTF8;
}

function codeToSimId(simCode: number, reader: BinaryReader): string {
  switch (simCode) {
    case SIM_CODE_GRID:
      return 'grid';
    case SIM_CODE_TURTLE:
      return 'turtle';
    case SIM_CODE_BEAT:
      return 'beat';
    case SIM_CODE_SWITCHYARD:
      return 'switchyard';
    case SIM_CODE_CUSTOM_UTF8:
      return readUtf8String(reader, 256);
    default:
      throw new Error(`Invalid simCode in profile backup: ${simCode}`);
  }
}

function writeExplicitSimId(writer: BinaryWriter, simId: string): void {
  const code = simIdToCode(simId);
  writer.writeUint8(code);
  if (code === SIM_CODE_CUSTOM_UTF8) {
    writeUtf8String(writer, simId);
  }
}

function readExplicitSimId(reader: BinaryReader): string {
  const code = reader.readUint8();
  return codeToSimId(code, reader);
}

function normalizeManualSaveSimId(simId: string): 'grid' | 'turtle' | 'beat' {
  if (simId === 'turtle') return 'turtle';
  if (simId === 'beat') return 'beat';
  return 'grid';
}

function deduceSimIdFromBinaryHeader(bytes: Uint8Array): string | null {
  if (bytes.length < 3 || bytes[0] !== FORMAT_VERSION) return null;
  const envByte = bytes[1];
  if (envByte === ENV_ID_GENERIC || envByte === ENV_ID_GRID) return 'grid';
  if (envByte === ENV_ID_TURTLE) return 'turtle';
  if (envByte === ENV_ID_BEAT) return 'beat';
  if (envByte === 0x05) return 'switchyard';
  if (envByte === ENV_ID_LESSON) {
    const inner = bytes[2];
    if (inner === ENV_ID_GENERIC || inner === ENV_ID_GRID) return 'grid';
    if (inner === ENV_ID_TURTLE) return 'turtle';
    if (inner === ENV_ID_BEAT) return 'beat';
    if (inner === 0x05) return 'switchyard';
  }
  return null;
}

function statusToCode(status: SimulationStatus): number {
  switch (status) {
    case 'SUCCESS':
      return 1;
    case 'COLLISION':
      return 2;
    case 'PAUSED':
      return 3;
    default:
      return 0;
  }
}

function codeToStatus(code: number): SimulationStatus {
  switch (code & 0x03) {
    case 1:
      return 'SUCCESS';
    case 2:
      return 'COLLISION';
    case 3:
      return 'PAUSED';
    default:
      return 'IDLE';
  }
}

function msToSecPositivePreserved(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  if (ms < 1000) return 1;
  return Math.floor(ms / 1000);
}

/**
 * Serializes a `ProfileBackupEnvelopeV1` into the compact `ENV_ID_PROFILE = 0x06` binary format.
 */
export function serializeProfileBackupToBinary(envelope: ProfileBackupEnvelopeV1): Uint8Array {
  const writer = new BinaryWriter(256);

  // 1. Stream Header (3 bytes)
  writer.writeUint8(FORMAT_VERSION);
  writer.writeUint8(ENV_ID_PROFILE);
  writer.writeUint8(ENV_VERSION_PROFILE);

  // 2. Profile Identity
  const avatarIdx = Math.max(
    0,
    WIRE_AVATAR_IDS.indexOf(envelope.profile?.avatarId as ProfileAvatarId)
  );
  const colorIdx = Math.max(
    0,
    WIRE_COLORS.findIndex((c) => c.id === envelope.profile?.colorId)
  );
  writer.writeUint8(((colorIdx & 0x0f) << 4) | (avatarIdx & 0x0f));

  const cleanName =
    typeof envelope.profile?.name === 'string'
      ? sliceNameCodepointSafe(envelope.profile.name, 24)
      : '';
  writeUtf8String(writer, cleanName);

  const exportedAtSec =
    typeof envelope.exportedAt === 'number' && Number.isFinite(envelope.exportedAt)
      ? Math.max(0, Math.floor(envelope.exportedAt / 1000))
      : 0;
  const createdAtSec =
    typeof envelope.profile?.createdAt === 'number' && Number.isFinite(envelope.profile.createdAt)
      ? Math.max(0, Math.floor(envelope.profile.createdAt / 1000))
      : exportedAtSec;

  writer.writeVLE(exportedAtSec);
  writer.writeSignedVLE(createdAtSec - exportedAtSec);

  // 3. Compact Curriculum Progress
  const progress = envelope.progress;
  const unlockAll = Boolean(progress?.unlockAllModules);

  const v1CompletedIds: string[] = [];
  const versionedCompleted: Array<{ id: string; version: number }> = [];

  for (const [rawId, rec] of Object.entries(progress?.completedLessons ?? {})) {
    const cleanId = rawId.trim();
    if (!cleanId || !rec || typeof rec !== 'object') continue;
    const ver =
      typeof rec.version === 'number' && Number.isFinite(rec.version) && rec.version >= 1
        ? Math.floor(rec.version)
        : 1;
    if (ver === 1) {
      v1CompletedIds.push(cleanId);
    } else {
      versionedCompleted.push({ id: cleanId, version: ver });
    }
  }
  v1CompletedIds.sort((a, b) => compareCurriculumActivityIds(a, b));
  versionedCompleted.sort((a, b) => compareCurriculumActivityIds(a.id, b.id));

  const unlockedSet = new Set<string>(['module-1']);
  for (const m of progress?.unlockedModules ?? []) {
    if (typeof m === 'string' && m.trim()) {
      unlockedSet.add(m.trim());
    }
  }
  const unlockedList = Array.from(unlockedSet);
  const isDefaultModuleUnlocks = unlockedList.length === 1 && unlockedList[0] === 'module-1';

  let moduleUnlockMask = 0;
  const extraUnlocked: string[] = [];
  if (!isDefaultModuleUnlocks) {
    for (const m of unlockedList) {
      const match = /^module-([1-9]|[1-4][0-9])$/.exec(m);
      if (match) {
        const k = Number(match[1]);
        moduleUnlockMask += 2 ** (k - 1);
      } else {
        extraUnlocked.push(m);
      }
    }
    extraUnlocked.sort((a, b) => a.localeCompare(b));
  }

  const badgeSet = new Set<string>();
  for (const b of progress?.earnedBadges ?? []) {
    if (typeof b === 'string' && b.trim()) {
      badgeSet.add(b.trim());
    }
  }
  const badgeList = Array.from(badgeSet);
  let moduleBadgeMask = 0;
  const extraBadges: string[] = [];
  if (badgeList.length > 0) {
    for (const b of badgeList) {
      const match = /^badge-module-([1-9]|[1-4][0-9])$/.exec(b);
      if (match) {
        const k = Number(match[1]);
        moduleBadgeMask += 2 ** (k - 1);
      } else {
        extraBadges.push(b);
      }
    }
    extraBadges.sort((a, b) => a.localeCompare(b));
  }

  const medalSet = new Set<string>();
  const rawMedals = (progress as ProfileCurriculumProgress & { earnedMedals?: unknown })
    ?.earnedMedals;
  if (Array.isArray(rawMedals)) {
    for (const m of rawMedals) {
      if (typeof m === 'string' && m.trim()) {
        medalSet.add(m.trim());
      }
    }
  }
  const medalList = Array.from(medalSet).sort((a, b) => a.localeCompare(b));

  let progressFlags = 0;
  if (unlockAll) progressFlags |= PROGRESS_FLAG_UNLOCK_ALL;
  if (v1CompletedIds.length > 0) progressFlags |= PROGRESS_FLAG_V1_COMPLETIONS;
  if (versionedCompleted.length > 0) progressFlags |= PROGRESS_FLAG_VERSIONED_COMPLETIONS;
  if (!isDefaultModuleUnlocks) progressFlags |= PROGRESS_FLAG_NON_DEFAULT_UNLOCKS;
  if (badgeList.length > 0) progressFlags |= PROGRESS_FLAG_BADGES;
  if (medalList.length > 0) progressFlags |= PROGRESS_FLAG_EARNED_MEDALS;

  writer.writeUint8(progressFlags);

  if (v1CompletedIds.length > 0) {
    writer.writeVLE(v1CompletedIds.length);
    for (const id of v1CompletedIds) {
      encodeCompactLessonId(writer, id);
    }
  }

  if (versionedCompleted.length > 0) {
    writer.writeVLE(versionedCompleted.length);
    for (const item of versionedCompleted) {
      encodeCompactLessonId(writer, item.id);
      writer.writeVLE(item.version);
    }
  }

  if (!isDefaultModuleUnlocks) {
    writer.writeVLE(moduleUnlockMask);
    writer.writeVLE(extraUnlocked.length);
    for (const m of extraUnlocked) {
      writeUtf8String(writer, m);
    }
  }

  if (badgeList.length > 0) {
    writer.writeVLE(moduleBadgeMask);
    writer.writeVLE(extraBadges.length);
    for (const b of extraBadges) {
      writeUtf8String(writer, b);
    }
  }

  if (medalList.length > 0) {
    writer.writeVLE(medalList.length);
    for (const m of medalList) {
      writeUtf8String(writer, m);
    }
  }

  // 4. Pre-encode Framed Save Records so per-autosave try/catch never skews saveRecordCount
  const encodedRecords: Uint8Array[] = [];

  // 4a. Lesson Autosaves (sorted canonically)
  const lessonAutosaveEntries = Object.entries(envelope.autosaves?.lessons ?? {}).sort(
    ([idA], [idB]) => compareCurriculumActivityIds(idA, idB)
  );
  for (const [rawLessonId, entry] of lessonAutosaveEntries) {
    const lessonId = rawLessonId.trim();
    if (!lessonId || !entry || typeof entry !== 'object') continue;

    try {
      const recWriter = new BinaryWriter(64);
      const safeLessonVer =
        typeof entry.lessonVersion === 'number' &&
        Number.isFinite(entry.lessonVersion) &&
        entry.lessonVersion >= 1
          ? Math.floor(entry.lessonVersion)
          : 1;
      const updatedAtSec = msToSecPositivePreserved(entry.updatedAt);
      const hasUpdatedAt = updatedAtSec > 0;
      const isEmpty = isWorkspaceEmpty(entry.workspace);

      let payloadBytes: Uint8Array | null = null;
      if (!isEmpty) {
        const catalogAct =
          getActivityAtVersion(lessonId, safeLessonVer) ?? getActivityLatest(lessonId);
        payloadBytes = encodeAutosaveWorkspacePayload(entry.workspace, catalogAct?.simId);
      }

      let recordHeader = ENTRY_KIND_LESSON_AUTOSAVE;
      if (safeLessonVer > 1) recordHeader |= 0x04;
      if (hasUpdatedAt) recordHeader |= 0x08;
      if (isEmpty) recordHeader |= 0x10;

      recWriter.writeUint8(recordHeader);
      encodeCompactLessonId(recWriter, lessonId);
      if (safeLessonVer > 1) {
        recWriter.writeVLE(safeLessonVer);
      }
      if (hasUpdatedAt) {
        recWriter.writeSignedVLE(updatedAtSec - exportedAtSec);
      }
      if (!isEmpty && payloadBytes) {
        recWriter.writeVLE(payloadBytes.length);
        recWriter.writeBytes(payloadBytes);
      }

      encodedRecords.push(recWriter.getBytes());
    } catch {
      // Skip individual unserializable experimental autosave rather than failing full backup
    }
  }

  // 4b. Sandbox Autosaves (sorted by simId)
  const sandboxAutosaveEntries = Object.entries(envelope.autosaves?.sandbox ?? {}).sort(
    ([simA], [simB]) => simA.localeCompare(simB)
  );
  for (const [rawSimId, entry] of sandboxAutosaveEntries) {
    const simId = rawSimId.trim();
    if (!simId || !entry || typeof entry !== 'object') continue;

    try {
      const recWriter = new BinaryWriter(64);
      const simCode = simIdToCode(simId);
      const updatedAtSec = msToSecPositivePreserved(entry.updatedAt);
      const hasUpdatedAt = updatedAtSec > 0;
      const isEmpty = isWorkspaceEmpty(entry.workspace);

      let payloadBytes: Uint8Array | null = null;
      if (!isEmpty) {
        const knownPreferred =
          simCode === SIM_CODE_CUSTOM_UTF8 ? undefined : simId;
        payloadBytes = encodeAutosaveWorkspacePayload(entry.workspace, knownPreferred);
      }

      let recordHeader = ENTRY_KIND_SANDBOX_AUTOSAVE | ((simCode & 0x07) << 2);
      if (hasUpdatedAt) recordHeader |= 0x20;
      if (isEmpty) recordHeader |= 0x40;

      recWriter.writeUint8(recordHeader);
      if (simCode === SIM_CODE_CUSTOM_UTF8) {
        writeUtf8String(recWriter, simId);
      }
      if (hasUpdatedAt) {
        recWriter.writeSignedVLE(updatedAtSec - exportedAtSec);
      }
      if (!isEmpty && payloadBytes) {
        recWriter.writeVLE(payloadBytes.length);
        recWriter.writeBytes(payloadBytes);
      }

      encodedRecords.push(recWriter.getBytes());
    } catch {
      // Skip individual unserializable sandbox autosave rather than failing full backup
    }
  }

  // 4c. Manual Saved Programs (preserving exact original entry.code)
  for (const entry of envelope.savedPrograms ?? []) {
    if (!entry || typeof entry.code !== 'string') continue;
    const trimmedCode = entry.code.trim();
    if (!trimmedCode) continue;

    const cleanSimId = normalizeManualSaveSimId(entry.simId);
    let payloadBytes: Uint8Array;
    let isRawUtf8Code = false;

    try {
      const candidateBytes = base64URLToUint8Array(trimmedCode);
      if (
        candidateBytes.length >= 3 &&
        candidateBytes[0] === FORMAT_VERSION &&
        uint8ArrayToBase64URL(candidateBytes) === trimmedCode
      ) {
        payloadBytes = candidateBytes;
      } else {
        isRawUtf8Code = true;
        payloadBytes = utf8Encoder.encode(trimmedCode);
      }
    } catch {
      isRawUtf8Code = true;
      payloadBytes = utf8Encoder.encode(trimmedCode);
    }

    const deducedSimId = isRawUtf8Code ? null : deduceSimIdFromBinaryHeader(payloadBytes);
    const hasExplicitSimId = isRawUtf8Code || deducedSimId !== cleanSimId;

    const statusCode = statusToCode(entry.status);
    const safeStepCount =
      typeof entry.stepCount === 'number' && Number.isFinite(entry.stepCount)
        ? Math.max(0, Math.floor(entry.stepCount))
        : 0;
    const createdAtSec =
      typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
        ? Math.max(0, Math.floor(entry.createdAt / 1000))
        : exportedAtSec;
    const cleanSlotIndex =
      typeof entry.slotIndex === 'number' &&
      Number.isFinite(entry.slotIndex) &&
      entry.slotIndex >= 1
        ? Math.floor(entry.slotIndex)
        : undefined;
    const hasLevelId =
      typeof entry.levelId === 'number' &&
      Number.isFinite(entry.levelId) &&
      entry.levelId >= 0;
    const safeLevelId = hasLevelId ? Math.floor(entry.levelId!) : 0;

    const cleanLessonId =
      typeof entry.lessonId === 'string' && entry.lessonId.trim()
        ? entry.lessonId.trim()
        : undefined;

    const recWriter = new BinaryWriter(96);

    if (cleanLessonId !== undefined) {
      // Manual Lesson Save (entryKind = 2)
      const safeLessonVer =
        typeof entry.lessonVersion === 'number' &&
        Number.isFinite(entry.lessonVersion) &&
        entry.lessonVersion >= 1
          ? Math.floor(entry.lessonVersion)
          : 1;
      const defaultTitle =
        cleanSlotIndex !== undefined
          ? `Activity ${cleanLessonId} — Slot ${cleanSlotIndex}`
          : `Activity ${cleanLessonId}`;
      const cleanTitle = (entry.title ?? '').trim() || defaultTitle;
      const hasCustomTitle = cleanTitle !== defaultTitle;

      const noSlotIndex = cleanSlotIndex === undefined;
      const slotNotOne = cleanSlotIndex !== 1;

      let extraFlags = 0;
      if (noSlotIndex) extraFlags |= 0x01;
      if (hasLevelId) extraFlags |= 0x02;
      if (hasExplicitSimId) extraFlags |= 0x04;
      if (isRawUtf8Code) extraFlags |= 0x08;
      const hasExtraFlags = extraFlags !== 0;

      let recordHeader = ENTRY_KIND_MANUAL_LESSON_SAVE | ((statusCode & 0x03) << 2);
      if (hasCustomTitle) recordHeader |= 0x10;
      if (safeLessonVer > 1) recordHeader |= 0x20;
      if (slotNotOne) recordHeader |= 0x40;
      if (hasExtraFlags) recordHeader |= 0x80;

      recWriter.writeUint8(recordHeader);
      encodeCompactLessonId(recWriter, cleanLessonId);
      if (hasExtraFlags) {
        recWriter.writeUint8(extraFlags);
      }
      if (slotNotOne && !noSlotIndex) {
        recWriter.writeVLE(cleanSlotIndex!);
      }
      if (safeLessonVer > 1) {
        recWriter.writeVLE(safeLessonVer);
      }
      if (hasCustomTitle) {
        writeUtf8String(recWriter, cleanTitle);
      }
      if (hasLevelId) {
        recWriter.writeVLE(safeLevelId);
      }
      if (hasExplicitSimId) {
        writeExplicitSimId(recWriter, cleanSimId);
      }
      recWriter.writeVLE(safeStepCount);
      recWriter.writeSignedVLE(createdAtSec - exportedAtSec);
      recWriter.writeVLE(payloadBytes.length);
      recWriter.writeBytes(payloadBytes);
    } else {
      // Manual Sandbox Save (entryKind = 3)
      const defaultTitle = 'Untitled Program';
      const cleanTitle = (entry.title ?? '').trim() || defaultTitle;
      const hasCustomTitle = cleanTitle !== defaultTitle;
      const hasSlotIndex = cleanSlotIndex !== undefined;

      let extraFlags = 0;
      if (hasSlotIndex) extraFlags |= 0x01;
      if (hasExplicitSimId) extraFlags |= 0x02;
      if (isRawUtf8Code) extraFlags |= 0x04;
      const hasExtraFlags = extraFlags !== 0;

      let recordHeader = ENTRY_KIND_MANUAL_SANDBOX_SAVE | ((statusCode & 0x03) << 2);
      if (hasCustomTitle) recordHeader |= 0x10;
      if (hasLevelId) recordHeader |= 0x20;
      if (hasExtraFlags) recordHeader |= 0x80;

      recWriter.writeUint8(recordHeader);
      if (hasExtraFlags) {
        recWriter.writeUint8(extraFlags);
      }
      if (hasSlotIndex) {
        recWriter.writeVLE(cleanSlotIndex!);
      }
      if (hasLevelId) {
        recWriter.writeVLE(safeLevelId);
      }
      if (hasCustomTitle) {
        writeUtf8String(recWriter, cleanTitle);
      }
      if (hasExplicitSimId) {
        writeExplicitSimId(recWriter, cleanSimId);
      }
      recWriter.writeVLE(safeStepCount);
      recWriter.writeSignedVLE(createdAtSec - exportedAtSec);
      recWriter.writeVLE(payloadBytes.length);
      recWriter.writeBytes(payloadBytes);
    }

    encodedRecords.push(recWriter.getBytes());
  }

  writer.writeVLE(encodedRecords.length);
  for (const recBytes of encodedRecords) {
    writer.writeBytes(recBytes);
  }

  return writer.getBytes();
}

/**
 * Deserializes a compact `ENV_ID_PROFILE = 0x06` binary payload back into a `ProfileBackupEnvelopeV1`.
 */
export function deserializeProfileBackupFromBinary(bytes: Uint8Array): ProfileBackupEnvelopeV1 {
  if (!bytes || bytes.length < 4) {
    throw new Error('Profile backup payload is too short.');
  }

  const reader = new BinaryReader(bytes);

  // 1. Stream Header
  const formatVersion = reader.readUint8();
  if (formatVersion !== FORMAT_VERSION) {
    throw new Error(`Unsupported format version: ${formatVersion}`);
  }

  const envId = reader.readUint8();
  if (envId !== ENV_ID_PROFILE) {
    throw new Error('Not a valid Robot Emulator profile backup file.');
  }

  const profileVersion = reader.readUint8();
  if (profileVersion < 1 || profileVersion > ENV_VERSION_PROFILE) {
    throw new Error(`Unsupported profile backup version: ${profileVersion}`);
  }

  // 2. Profile Identity
  const avatarColorByte = reader.readUint8();
  const avatarIdx = avatarColorByte & 0x0f;
  const colorIdx = (avatarColorByte >> 4) & 0x0f;
  const avatarId = WIRE_AVATAR_IDS[avatarIdx] ?? WIRE_AVATAR_IDS[0];
  const colorOption = WIRE_COLORS[colorIdx] ?? WIRE_COLORS[0];

  const rawName = readUtf8String(reader, 256);
  const name = sliceNameCodepointSafe(rawName, 24);

  const exportedAtSec = reader.readVLE();
  const createdAtDelta = reader.readSignedVLE();
  const createdAtSec = exportedAtSec + createdAtDelta;
  if (createdAtSec < 0) {
    throw new Error('Corrupt profile backup: negative profile creation timestamp.');
  }

  const exportedAt = exportedAtSec * 1000;
  const createdAt = createdAtSec * 1000;

  // 3. Compact Curriculum Progress
  const progressFlags = reader.readUint8();
  if ((progressFlags & PROGRESS_FLAGS_RESERVED_MASK) !== 0) {
    throw new Error('Unsupported progress flags in profile backup.');
  }

  const unlockAllModules = (progressFlags & PROGRESS_FLAG_UNLOCK_ALL) !== 0;

  const rawCompletions: Array<[string, LessonCompletionRecord]> = [];
  if ((progressFlags & PROGRESS_FLAG_V1_COMPLETIONS) !== 0) {
    const v1Count = reader.readVLE();
    if (v1Count > reader.remaining) {
      throw new Error('Truncated profile backup: completion count exceeds remaining bytes.');
    }
    for (let i = 0; i < v1Count; i++) {
      const lessonId = decodeCompactLessonId(reader).trim();
      if (!lessonId) {
        throw new Error('Invalid empty lessonId in profile completions.');
      }
      rawCompletions.push([lessonId, { completedAt: exportedAt, version: 1 }]);
    }
  }

  if ((progressFlags & PROGRESS_FLAG_VERSIONED_COMPLETIONS) !== 0) {
    const versionedCount = reader.readVLE();
    if (versionedCount > reader.remaining) {
      throw new Error('Truncated profile backup: versioned completion count exceeds remaining bytes.');
    }
    for (let i = 0; i < versionedCount; i++) {
      const lessonId = decodeCompactLessonId(reader).trim();
      const ver = reader.readVLE();
      if (!lessonId || ver < 1) {
        throw new Error('Invalid versioned lesson completion in profile backup.');
      }
      rawCompletions.push([lessonId, { completedAt: exportedAt, version: ver }]);
    }
  }

  rawCompletions.sort(([idA], [idB]) => compareCurriculumActivityIds(idA, idB));
  const completedLessons: Record<string, LessonCompletionRecord> = {};
  for (const [id, rec] of rawCompletions) {
    completedLessons[id] = rec;
  }

  const unlockedSet = new Set<string>(['module-1']);
  if ((progressFlags & PROGRESS_FLAG_NON_DEFAULT_UNLOCKS) !== 0) {
    let remMask = reader.readVLE();
    let bitIdx = 0;
    while (remMask > 0) {
      if (remMask % 2 === 1) {
        unlockedSet.add(`module-${bitIdx + 1}`);
      }
      remMask = Math.floor(remMask / 2);
      bitIdx++;
    }

    const extraUnlockedCount = reader.readVLE();
    if (extraUnlockedCount > reader.remaining) {
      throw new Error('Truncated profile backup: unlocked module count exceeds remaining bytes.');
    }
    for (let i = 0; i < extraUnlockedCount; i++) {
      const modId = readUtf8String(reader, 256).trim();
      if (modId) unlockedSet.add(modId);
    }
  }

  const badgeSet = new Set<string>();
  if ((progressFlags & PROGRESS_FLAG_BADGES) !== 0) {
    let remMask = reader.readVLE();
    let bitIdx = 0;
    while (remMask > 0) {
      if (remMask % 2 === 1) {
        badgeSet.add(`badge-module-${bitIdx + 1}`);
      }
      remMask = Math.floor(remMask / 2);
      bitIdx++;
    }

    const extraBadgeCount = reader.readVLE();
    if (extraBadgeCount > reader.remaining) {
      throw new Error('Truncated profile backup: badge count exceeds remaining bytes.');
    }
    for (let i = 0; i < extraBadgeCount; i++) {
      const badgeId = readUtf8String(reader, 256).trim();
      if (badgeId) badgeSet.add(badgeId);
    }
  }

  const medalSet = new Set<string>();
  if ((progressFlags & PROGRESS_FLAG_EARNED_MEDALS) !== 0) {
    const medalCount = reader.readVLE();
    if (medalCount > reader.remaining) {
      throw new Error('Truncated profile backup: medal count exceeds remaining bytes.');
    }
    for (let i = 0; i < medalCount; i++) {
      const medalId = readUtf8String(reader, 256).trim();
      if (medalId) medalSet.add(medalId);
    }
  }

  const progress: ProfileCurriculumProgress = {
    completedLessons,
    unlockedModules: Array.from(unlockedSet),
    earnedBadges: Array.from(badgeSet),
    unlockAllModules,
    ...(medalSet.size > 0 ? { earnedMedals: Array.from(medalSet) } : {}),
  };

  // 4. Framed Save Records
  const lessonsAutosaves: Record<string, LessonAutosaveEntry> = {};
  const sandboxAutosaves: Record<string, SandboxAutosaveEntry> = {};
  const savedPrograms: ProfileBackupEnvelopeV1['savedPrograms'] = [];

  const saveRecordCount = reader.readVLE();
  if (saveRecordCount > reader.remaining) {
    throw new Error('Truncated profile backup: save record count exceeds remaining bytes.');
  }

  for (let r = 0; r < saveRecordCount; r++) {
    const recordHeader = reader.readUint8();
    const entryKind = recordHeader & 0x03;

    if (entryKind === ENTRY_KIND_LESSON_AUTOSAVE) {
      if ((recordHeader & 0xe0) !== 0) {
        throw new Error('Unsupported lesson autosave flags in profile backup.');
      }
      const hasVerGt1 = (recordHeader & 0x04) !== 0;
      const hasUpdatedAt = (recordHeader & 0x08) !== 0;
      const isEmpty = (recordHeader & 0x10) !== 0;

      const lessonId = decodeCompactLessonId(reader).trim();
      if (!lessonId) {
        throw new Error('Invalid empty lessonId in lesson autosave record.');
      }
      const lessonVersion = hasVerGt1 ? reader.readVLE() : 1;
      if (lessonVersion < 1) {
        throw new Error(`Invalid lessonVersion ${lessonVersion} in lesson autosave.`);
      }

      let updatedAt = 0;
      if (hasUpdatedAt) {
        const delta = reader.readSignedVLE();
        const sec = exportedAtSec + delta;
        if (sec < 0) {
          throw new Error('Corrupt lesson autosave timestamp in profile backup.');
        }
        updatedAt = sec * 1000;
      }

      let workspace: WorkspaceState;
      if (isEmpty) {
        workspace = createEmptyWorkspace();
      } else {
        const payloadLen = reader.readVLE();
        const payloadBytes = reader.readBytes(payloadLen);
        workspace = importCodeOnlyFromBinary(payloadBytes);
      }

      lessonsAutosaves[lessonId] = {
        workspace,
        lessonVersion,
        updatedAt,
      };
    } else if (entryKind === ENTRY_KIND_SANDBOX_AUTOSAVE) {
      if ((recordHeader & 0x80) !== 0) {
        throw new Error('Unsupported sandbox autosave flags in profile backup.');
      }
      const simCode = (recordHeader >> 2) & 0x07;
      const hasUpdatedAt = (recordHeader & 0x20) !== 0;
      const isEmpty = (recordHeader & 0x40) !== 0;

      const simId = codeToSimId(simCode, reader).trim();
      if (!simId) {
        throw new Error('Invalid empty simId in sandbox autosave record.');
      }

      let updatedAt = 0;
      if (hasUpdatedAt) {
        const delta = reader.readSignedVLE();
        const sec = exportedAtSec + delta;
        if (sec < 0) {
          throw new Error('Corrupt sandbox autosave timestamp in profile backup.');
        }
        updatedAt = sec * 1000;
      }

      let workspace: WorkspaceState;
      if (isEmpty) {
        workspace = createEmptyWorkspace();
      } else {
        const payloadLen = reader.readVLE();
        const payloadBytes = reader.readBytes(payloadLen);
        workspace = importCodeOnlyFromBinary(payloadBytes);
      }

      sandboxAutosaves[simId] = {
        workspace,
        updatedAt,
      };
    } else if (entryKind === ENTRY_KIND_MANUAL_LESSON_SAVE) {
      const status = codeToStatus((recordHeader >> 2) & 0x03);
      const hasCustomTitle = (recordHeader & 0x10) !== 0;
      const hasVerGt1 = (recordHeader & 0x20) !== 0;
      const slotNotOne = (recordHeader & 0x40) !== 0;
      const hasExtraFlags = (recordHeader & 0x80) !== 0;

      const lessonId = decodeCompactLessonId(reader).trim();
      if (!lessonId) {
        throw new Error('Invalid empty lessonId in manual lesson save record.');
      }

      const extraFlags = hasExtraFlags ? reader.readUint8() : 0;
      if ((extraFlags & 0xf0) !== 0) {
        throw new Error('Unsupported manual lesson save extra flags in profile backup.');
      }
      const noSlotIndex = (extraFlags & 0x01) !== 0;
      const hasLevelId = (extraFlags & 0x02) !== 0;
      const hasExplicitSimId = (extraFlags & 0x04) !== 0;
      const isRawUtf8Code = (extraFlags & 0x08) !== 0;

      let slotIndex: number | undefined;
      if (noSlotIndex) {
        slotIndex = undefined;
      } else if (slotNotOne) {
        slotIndex = reader.readVLE();
        if (slotIndex < 1) {
          throw new Error(`Invalid slotIndex ${slotIndex} in manual lesson save.`);
        }
      } else {
        slotIndex = 1;
      }

      const lessonVersion = hasVerGt1 ? reader.readVLE() : 1;
      if (lessonVersion < 1) {
        throw new Error(`Invalid lessonVersion ${lessonVersion} in manual lesson save.`);
      }

      const defaultTitle =
        slotIndex !== undefined
          ? `Activity ${lessonId} — Slot ${slotIndex}`
          : `Activity ${lessonId}`;
      const title = hasCustomTitle ? readUtf8String(reader, 512).trim() || defaultTitle : defaultTitle;
      const levelId = hasLevelId ? reader.readVLE() : undefined;
      const explicitSimId = hasExplicitSimId ? readExplicitSimId(reader) : undefined;
      const stepCount = reader.readVLE();
      const createdAtDeltaRec = reader.readSignedVLE();
      const createdAtSecRec = exportedAtSec + createdAtDeltaRec;
      if (createdAtSecRec < 0) {
        throw new Error('Corrupt manual lesson save timestamp in profile backup.');
      }

      const payloadLen = reader.readVLE();
      if (payloadLen === 0) {
        throw new Error('Empty code payload in manual lesson save record.');
      }
      const payloadBytes = reader.readBytes(payloadLen);

      let code: string;
      let resolvedSimIdStr: string;
      if (isRawUtf8Code) {
        code = utf8Decoder.decode(payloadBytes).trim();
        if (!code) {
          throw new Error('Empty raw code string in manual lesson save record.');
        }
        resolvedSimIdStr = explicitSimId ?? 'grid';
      } else {
        const deduced = deduceSimIdFromBinaryHeader(payloadBytes);
        if (payloadBytes.length < 3 || payloadBytes[0] !== FORMAT_VERSION || (!deduced && !explicitSimId)) {
          throw new Error('Invalid binary save payload inside manual lesson save record.');
        }
        code = uint8ArrayToBase64URL(payloadBytes);
        resolvedSimIdStr = explicitSimId ?? deduced ?? 'grid';
      }

      savedPrograms.push({
        version: CURRENT_STORAGE_VERSION,
        title,
        createdAt: createdAtSecRec * 1000,
        simId: normalizeManualSaveSimId(resolvedSimIdStr),
        code,
        screenshot: DEFAULT_FALLBACK_THUMBNAIL,
        status,
        stepCount,
        ...(levelId !== undefined ? { levelId } : {}),
        lessonId,
        lessonVersion,
        ...(slotIndex !== undefined ? { slotIndex } : {}),
      });
    } else {
      // ENTRY_KIND_MANUAL_SANDBOX_SAVE
      if ((recordHeader & 0x40) !== 0) {
        throw new Error('Unsupported manual sandbox save flags in profile backup.');
      }
      const status = codeToStatus((recordHeader >> 2) & 0x03);
      const hasCustomTitle = (recordHeader & 0x10) !== 0;
      const hasLevelId = (recordHeader & 0x20) !== 0;
      const hasExtraFlags = (recordHeader & 0x80) !== 0;

      const extraFlags = hasExtraFlags ? reader.readUint8() : 0;
      if ((extraFlags & 0xf8) !== 0) {
        throw new Error('Unsupported manual sandbox save extra flags in profile backup.');
      }
      const hasSlotIndex = (extraFlags & 0x01) !== 0;
      const hasExplicitSimId = (extraFlags & 0x02) !== 0;
      const isRawUtf8Code = (extraFlags & 0x04) !== 0;

      let slotIndex: number | undefined;
      if (hasSlotIndex) {
        slotIndex = reader.readVLE();
        if (slotIndex < 1) {
          throw new Error(`Invalid slotIndex ${slotIndex} in manual sandbox save.`);
        }
      }

      const levelId = hasLevelId ? reader.readVLE() : undefined;
      const defaultTitle = 'Untitled Program';
      const title = hasCustomTitle ? readUtf8String(reader, 512).trim() || defaultTitle : defaultTitle;
      const explicitSimId = hasExplicitSimId ? readExplicitSimId(reader) : undefined;
      const stepCount = reader.readVLE();
      const createdAtDeltaRec = reader.readSignedVLE();
      const createdAtSecRec = exportedAtSec + createdAtDeltaRec;
      if (createdAtSecRec < 0) {
        throw new Error('Corrupt manual sandbox save timestamp in profile backup.');
      }

      const payloadLen = reader.readVLE();
      if (payloadLen === 0) {
        throw new Error('Empty code payload in manual sandbox save record.');
      }
      const payloadBytes = reader.readBytes(payloadLen);

      let code: string;
      let resolvedSimIdStr: string;
      if (isRawUtf8Code) {
        code = utf8Decoder.decode(payloadBytes).trim();
        if (!code) {
          throw new Error('Empty raw code string in manual sandbox save record.');
        }
        resolvedSimIdStr = explicitSimId ?? 'grid';
      } else {
        const deduced = deduceSimIdFromBinaryHeader(payloadBytes);
        if (payloadBytes.length < 3 || payloadBytes[0] !== FORMAT_VERSION || (!deduced && !explicitSimId)) {
          throw new Error('Invalid binary save payload inside manual sandbox save record.');
        }
        code = uint8ArrayToBase64URL(payloadBytes);
        resolvedSimIdStr = explicitSimId ?? deduced ?? 'grid';
      }

      savedPrograms.push({
        version: CURRENT_STORAGE_VERSION,
        title,
        createdAt: createdAtSecRec * 1000,
        simId: normalizeManualSaveSimId(resolvedSimIdStr),
        code,
        screenshot: DEFAULT_FALLBACK_THUMBNAIL,
        status,
        stepCount,
        ...(levelId !== undefined ? { levelId } : {}),
        ...(slotIndex !== undefined ? { slotIndex } : {}),
      });
    }
  }

  if (reader.hasMore) {
    throw new Error('Corrupt profile backup: unexpected trailing bytes.');
  }

  return {
    type: WIRE_BACKUP_MAGIC,
    version: WIRE_BACKUP_VERSION,
    exportedAt,
    profile: {
      avatarId,
      colorId: colorOption.id,
      accentColor: colorOption.accentColor,
      name,
      createdAt,
    },
    progress,
    autosaves: {
      lessons: lessonsAutosaves,
      sandbox: sandboxAutosaves,
    },
    savedPrograms,
  };
}
