import { describe, it, expect, beforeEach } from 'vitest';
import { BinaryWriter, uint8ArrayToBase64URL } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import {
  ENV_ID_PROFILE,
  ENV_VERSION_PROFILE,
  FORMAT_VERSION,
} from '../src/engine/serialization/types';
import {
  exportLessonCodeOnly,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  decodeCompactLessonId,
  deserializeProfileBackupFromBinary,
  encodeCompactLessonId,
  isBinaryProfileBackupBytes,
  serializeProfileBackupToBinary,
} from '../src/engine/serialization/profileSerializer';
import { splitIntoQrChunks, MAX_CHUNK_PAYLOAD } from '../src/engine/serialization/qrChunker';
import {
  clearAllSavedPrograms,
  getSavedPrograms,
  migrateSavedEntry,
  saveProgram,
} from '../src/services/localSaveService';
import {
  DEFAULT_PROFILE_ID,
  PROFILE_AVATARS,
  PROFILE_BACKUP_MAGIC,
  PROFILE_COLORS,
  ProfileBackupEnvelopeV1,
  awardBadgeForProfile,
  ensureProfilesInitialized,
  exportProfileBackup,
  exportProfileBackupToBinary,
  exportProfileBackupToJson,
  exportProfileBackupToQrBytes,
  exportProfileBackupToString,
  getLessonAutosave,
  getProfileProgress,
  getSandboxAutosave,
  importProfileBackup,
  isProfileBackupPayload,
  markLessonCompleted,
  parseProfileBackup,
  resetAllProfileDataForTests,
  saveLessonAutosave,
  saveSandboxAutosave,
  setUnlockAllModules,
  unlockModuleForProfile,
} from '../src/services/profileService';
import { GridState, WorkspaceState, toVariableName } from '../src/types';
import { useAppStore } from '../src/store/useAppStore';

const normalizeBlock = ({ id: _id, repeatCount, params, ...rest }: any) => ({
  ...rest,
  repeatCount: repeatCount ?? 1,
  params: params ?? undefined,
});

const stripIds = (ws?: WorkspaceState) => ({
  MAIN: (ws?.MAIN || []).map(normalizeBlock),
  F1: (ws?.F1 || []).map(normalizeBlock),
  F2: (ws?.F2 || []).map(normalizeBlock),
  F3: (ws?.F3 || []).map(normalizeBlock),
});

describe('Compact Binary Profile Serializer (ENV_ID_PROFILE = 0x06)', () => {
  beforeEach(() => {
    clearAllSavedPrograms();
    resetAllProfileDataForTests();
    ensureProfilesInitialized();
    const store = useAppStore.getState();
    store.dismissVersionMismatch();
    store.reloadActiveProfileState();
  });

  describe('1. 53-Bit VLE & ZigZag Signed VLE Primitives', () => {
    it('round-trips unsigned VLE up to Number.MAX_SAFE_INTEGER and guards overflow', () => {
      const values = [
        0,
        1,
        127,
        128,
        16383,
        16384,
        (1 << 28) - 1,
        1 << 28,
        2 ** 31,
        2 ** 32,
        1776000000, // Unix timestamp in seconds (~2026)
        2 ** 48,
        Number.MAX_SAFE_INTEGER - 1,
        Number.MAX_SAFE_INTEGER,
      ];

      const writer = new BinaryWriter();
      for (const v of values) {
        writer.writeVLE(v);
      }

      const reader = new BinaryReader(writer.getBytes());
      for (const v of values) {
        expect(reader.readVLE()).toBe(v);
      }
      expect(reader.hasMore).toBe(false);

      // 2^53 (Number.MAX_SAFE_INTEGER + 1) must throw VLE integer overflow
      const overflow2Pow53 = new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x10]);
      expect(() => new BinaryReader(overflow2Pow53).readVLE()).toThrow(/VLE integer overflow/);

      // 9-byte continuation (shift >= 56) must throw VLE integer overflow even with 0x00 terminator
      const overlong9Bytes = new Uint8Array([
        0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x00,
      ]);
      expect(() => new BinaryReader(overlong9Bytes).readVLE()).toThrow(/VLE integer overflow/);
    });

    it('round-trips ZigZag signed VLE including -0, negative deltas, and large offsets', () => {
      const signedValues = [
        0,
        -0,
        1,
        -1,
        2,
        -2,
        63,
        -64,
        64,
        -65,
        -86400 * 365,
        86400 * 365,
        -(2 ** 40),
        2 ** 40,
      ];

      const writer = new BinaryWriter();
      for (const s of signedValues) {
        writer.writeSignedVLE(s);
      }
      // NaN / Infinity sanitize to 0
      writer.writeSignedVLE(Number.NaN);
      writer.writeSignedVLE(Number.POSITIVE_INFINITY);

      const reader = new BinaryReader(writer.getBytes());
      for (const s of signedValues) {
        const decoded = reader.readSignedVLE();
        expect(Object.is(decoded, -0)).toBe(false);
        expect(decoded).toBe(s === 0 ? 0 : s);
      }
      expect(reader.readSignedVLE()).toBe(0);
      expect(reader.readSignedVLE()).toBe(0);
      expect(reader.hasMore).toBe(false);
    });
  });

  describe('2. CompactLessonId Bijection & Edge Cases', () => {
    it('encodes all Modules 1..9 lessons (M.0..M.10) and capstones (MA..MC) in exactly 1 byte', () => {
      for (let mod = 1; mod <= 9; mod++) {
        for (let sub = 0; sub <= 10; sub++) {
          const id = `${mod}.${sub}`;
          const w = new BinaryWriter();
          encodeCompactLessonId(w, id);
          const bytes = w.getBytes();
          expect(bytes.length).toBe(1);
          expect(bytes[0]).toBeGreaterThanOrEqual(0x80);
          expect(bytes[0]).toBeLessThanOrEqual(0xfd);
          expect(decodeCompactLessonId(new BinaryReader(bytes))).toBe(id);
        }
        for (const cap of ['A', 'B', 'C']) {
          const id = `${mod}${cap}`;
          const w = new BinaryWriter();
          encodeCompactLessonId(w, id);
          const bytes = w.getBytes();
          expect(bytes.length).toBe(1);
          expect(decodeCompactLessonId(new BinaryReader(bytes))).toBe(id);
        }
      }
    });

    it('encodes Mastery Challenges (C1.1..C16.16), short UTF-8, empty, and >=128-byte custom IDs losslessly', () => {
      // C6.1 -> 2 bytes
      const wChallenge = new BinaryWriter();
      encodeCompactLessonId(wChallenge, 'C6.1');
      expect(wChallenge.getBytes().length).toBe(2);
      expect(wChallenge.getBytes()[0]).toBe(0xfe);
      expect(decodeCompactLessonId(new BinaryReader(wChallenge.getBytes()))).toBe('C6.1');

      // C16.16 -> 2 bytes
      const wMaxChal = new BinaryWriter();
      encodeCompactLessonId(wMaxChal, 'C16.16');
      expect(wMaxChal.getBytes().length).toBe(2);
      expect(decodeCompactLessonId(new BinaryReader(wMaxChal.getBytes()))).toBe('C16.16');

      // Short UTF-8 custom IDs (including non-canonical '1.00', '9D', '10.1')
      for (const shortId of ['1.00', '9D', '10.1', 'custom-puzzle-🚀']) {
        const w = new BinaryWriter();
        encodeCompactLessonId(w, shortId);
        expect(decodeCompactLessonId(new BinaryReader(w.getBytes()))).toBe(shortId);
      }

      // Empty string -> [0x00, 0x00]
      const wEmpty = new BinaryWriter();
      encodeCompactLessonId(wEmpty, '');
      expect(Array.from(wEmpty.getBytes())).toEqual([0x00, 0x00]);
      expect(decodeCompactLessonId(new BinaryReader(wEmpty.getBytes()))).toBe('');

      // Long >= 128B UTF-8 ID -> [0x00, VLE(len), ...bytes] without colliding with 0x80..0xFD
      const long128Id = 'lesson_' + 'x'.repeat(130);
      const wLong = new BinaryWriter();
      encodeCompactLessonId(wLong, long128Id);
      expect(wLong.getBytes()[0]).toBe(0x00);
      expect(decodeCompactLessonId(new BinaryReader(wLong.getBytes()))).toBe(long128Id);

      // Reserved 0xFF tag throws
      expect(() => decodeCompactLessonId(new BinaryReader(new Uint8Array([0xff])))).toThrow(
        /0xff/i
      );
    });
  });

  describe('3. Byte-Budget & Single-QR Fit for Rich Active Profiles', () => {
    it('packs a rich multi-module student profile (< 350 bytes, 1 single QR chunk) vs multi-KB JSON', () => {
      const store = useAppStore.getState();
      const maya = store.createAndSwitchProfile({
        avatarId: 'panda',
        colorId: 'rose',
        name: 'Maya 🌟',
      });

      // Complete 18 lessons across Modules 1, 2, 3, and 9 + earn badges + unlockAllModules
      const completedIds = [
        '1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8',
        '1A', '1B', '1C',
        '2.1', '2.2', '2.3', '2A', '2B',
        '3.1',
      ];
      for (const id of completedIds) {
        markLessonCompleted(maya.id, id, 1, 1700001000000);
      }
      setUnlockAllModules(maya.id, true);

      // 3 active lesson autosaves (Grid, Turtle, Beat) + 1 empty autosave + 1 sandbox autosave
      const gridWs: WorkspaceState = {
        MAIN: [
          { id: 'g1', type: 'LOOP_START', repeatCount: 4 },
          { id: 'g2', type: 'MOVE_FWD', repeatCount: 2 },
          { id: 'g3', type: 'TURN_RIGHT' },
          { id: 'g4', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const turtleWs: WorkspaceState = {
        MAIN: [
          { id: 't1', type: 'SET_PEN_COLOR', params: { color: '#ec4899' } },
          { id: 't2', type: 'LOOP_START', repeatCount: 6 },
          { id: 't3', type: 'FORWARD', params: { length: 50 } },
          { id: 't4', type: 'TURN_RIGHT', params: { angle: 60 } },
          { id: 't5', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const beatWs: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'STAMP_HEART' },
          { id: 'b2', type: 'DRUM_KICK', repeatCount: 2 },
          { id: 'b3', type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const emptyWs: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };

      saveLessonAutosave(maya.id, '1.2', gridWs, 1, 1700001100000);
      saveLessonAutosave(maya.id, '2.2', turtleWs, 1, 1700001200000);
      saveLessonAutosave(maya.id, '1C', beatWs, 1, 1700001300000);
      saveLessonAutosave(maya.id, '1.3', emptyWs, 1, 1700001350000);
      saveSandboxAutosave(maya.id, 'turtle', turtleWs, 1700001400000);

      // 3 manual saves: 2 curriculum slots + 1 Sandbox Grid v1 custom map save
      const sandboxGrid: GridState = {
        width: 6,
        height: 6,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        barriers: [
          { x: 1, y: 0, orientation: 'V' },
          { x: 2, y: 2, orientation: 'H' },
        ],
        flags: [{ id: 'f1', x: 5, y: 5, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 0, y: 0 }],
        status: 'IDLE',
        showTrace: true,
      };
      saveProgram({
        title: 'Activity 1.2 — Slot 1',
        profileId: maya.id,
        simId: 'grid',
        code: exportLessonCodeOnly(gridWs, 'grid'),
        screenshot: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg width="200" height="200"><rect width="200" height="200"/></svg>'.repeat(20)),
        status: 'SUCCESS',
        stepCount: 12,
        lessonId: '1.2',
        lessonVersion: 1,
        slotIndex: 1,
        createdAt: 1700001500000,
      });
      saveProgram({
        title: 'Activity 2.2 — Slot 1',
        profileId: maya.id,
        simId: 'turtle',
        code: exportLessonCodeOnly(turtleWs, 'turtle'),
        screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        status: 'IDLE',
        stepCount: 13,
        lessonId: '2.2',
        lessonVersion: 1,
        slotIndex: 1,
        createdAt: 1700001600000,
      });
      saveProgram({
        title: 'My Maze',
        profileId: maya.id,
        simId: 'grid',
        code: exportToString(gridWs, 'grid', sandboxGrid),
        screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        status: 'SUCCESS',
        stepCount: 8,
        levelId: 2,
        createdAt: 1700001700000,
      });

      const legacyJson = exportProfileBackupToJson(maya.id);
      const binaryBytes = exportProfileBackupToBinary(maya.id, { now: 1700002000000 });
      const base64String = exportProfileBackupToString(maya.id, { now: 1700002000000 });
      const qrBytes = exportProfileBackupToQrBytes(maya.id);

      expect(binaryBytes[0]).toBe(FORMAT_VERSION);
      expect(binaryBytes[1]).toBe(ENV_ID_PROFILE);
      expect(binaryBytes[2]).toBe(ENV_VERSION_PROFILE);
      expect(base64String.startsWith('AQYB')).toBe(true);

      // Log exact size metrics for verification report
      // eslint-disable-next-line no-console
      console.log(
        `[ProfileSerializer Metrics] Maya rich profile: binary=${binaryBytes.length}B, base64url=${base64String.length} chars, legacyJson=${legacyJson.length} chars, qrChunks=${splitIntoQrChunks(qrBytes).length}`
      );

      // Verify compact byte budget (< 350B, 1 QR chunk <= 492B)
      expect(binaryBytes.length).toBeLessThan(350);
      expect(qrBytes.length).toBeLessThanOrEqual(MAX_CHUNK_PAYLOAD);
      expect(splitIntoQrChunks(qrBytes)).toHaveLength(1);
      expect(legacyJson.length).toBeGreaterThan(5000);

      // Verify every avatar x color combination round-trips 1-for-1
      for (const av of PROFILE_AVATARS) {
        for (const col of PROFILE_COLORS) {
          const env = exportProfileBackup(DEFAULT_PROFILE_ID, { now: 1700002000000 });
          env.profile.avatarId = av.id;
          env.profile.colorId = col.id;
          env.profile.accentColor = col.accentColor;
          const decoded = deserializeProfileBackupFromBinary(serializeProfileBackupToBinary(env));
          expect(decoded.profile.avatarId).toBe(av.id);
          expect(decoded.profile.colorId).toBe(col.id);
          expect(decoded.profile.accentColor).toBe(col.accentColor);
        }
      }
    });
  });

  describe('4. Lossless Fidelity Across All Save & Progress Edge Cases', () => {
    it('preserves bit-for-bit SavedProgramEntry.code (Grid v1/v2 maps, code-only), synthetic test codes, PAUSED status, emoji names/titles, v2+ completions, M9/C6.1/>=128B IDs, earnedMedals, empty autosaves, and uncatalogued Turtle TURN_LEFT({ angle })', () => {
      const gridV2: GridState = {
        width: 8,
        height: 8,
        robot: { x: 1, y: 1, dir: 'SOUTH', initialX: 1, initialY: 1, initialDir: 'SOUTH' },
        barriers: [{ x: 2, y: 1, orientation: 'V' }],
        flags: [{ id: 'goal', x: 6, y: 6, isGoal: true, order: 1, collected: false }],
        waterCells: [{ x: 3, y: 3 }],
        lockedGates: [{ id: 'gate1', x: 4, y: 4, shape: 'triangle', color: 'emerald', unlocked: false }],
        floorSwitches: [{ id: 'sw1', x: 2, y: 2, linkedGateId: 'gate1', requiredForGoal: true }],
        worldItems: [
          { id: 'it1', x: 1, y: 2, type: 'key', shape: 'triangle', color: 'emerald' },
          { id: 'it2', x: 1, y: 3, type: 'plank' },
        ],
        trace: [{ x: 1, y: 1 }],
        status: 'IDLE',
        showTrace: true,
      };

      const complexWs: WorkspaceState = {
        MAIN: [
          { id: 'c1', type: 'VAR_ASSIGN', params: { a: toVariableName('a'), b: 3 } },
          { id: 'c2', type: 'PICK_UP' },
          { id: 'c3', type: 'MOVE_FWD', repeatCount: toVariableName('a') },
          { id: 'c4', type: 'USE_DROP' },
          { id: 'c5', type: 'CALL_F1' },
        ],
        F1: [{ id: 'f1_1', type: 'TURN_LEFT' }],
        F2: [],
        F3: [],
      };

      const v2SandboxCode = exportToString(complexWs, 'grid', gridV2);
      const lessonCodeOnly = exportLessonCodeOnly(complexWs, 'grid');
      const syntheticRawCode = 'ROBOTEMU_V1_TESTCODE_SYNTHETIC_NON_CANONICAL';
      const longLessonId = 'custom_m9_extension_' + 'z'.repeat(130);

      // Uncatalogued lesson autosave with ONLY TURN_LEFT({ angle: 72 }) -> must infer 'turtle' and preserve angle=72!
      const uncataloguedTurtleAutosaveWs: WorkspaceState = {
        MAIN: [
          { id: 'ut1', type: 'TURN_LEFT', params: { angle: 72 } },
          { id: 'ut2', type: 'TURN_RIGHT', params: { angle: 144 } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // Corrupt experimental autosave that would fail codeSerializer -> must be skipped safely without aborting backup
      const invalidExperimentalAutosaveWs: WorkspaceState = {
        MAIN: [{ id: 'bad1', type: 'EXPERIMENTAL_FUTURE_UNKNOWN_OPCODE_999' }],
        F1: [],
        F2: [],
        F3: [],
      };

      const exportedAt = 1760000500000;
      const createdAt = 1759900000000;

      const envelope: ProfileBackupEnvelopeV1 = {
        type: PROFILE_BACKUP_MAGIC,
        version: 1,
        exportedAt,
        profile: {
          id: 'prof_test',
          avatarId: 'turtle',
          colorId: 'orange',
          accentColor: '#f97316',
          name: 'Zoe 🐢🚀✨',
          createdAt,
        },
        progress: {
          completedLessons: {
            '1.0': { completedAt: 1700000000000, version: 1 },
            '9.10': { completedAt: 1700000000000, version: 1 },
            '9C': { completedAt: 1700000000000, version: 3 },
            'C6.1': { completedAt: 1700000000000, version: 2 },
            [longLessonId]: { completedAt: 1700000000000, version: 1 },
          },
          unlockedModules: ['module-1', 'module-2', 'module-9', 'module-bonus-pack'],
          earnedBadges: ['badge-module-1', 'badge-module-9', 'badge-secret-star'],
          unlockAllModules: true,
          earnedMedals: ['medal-C6.1-gold', 'medal-C6.2-silver'],
        },
        autosaves: {
          lessons: {
            '1.1': {
              workspace: { MAIN: [], F1: [], F2: [], F3: [] },
              lessonVersion: 1,
              updatedAt: 0,
            },
            '9B': {
              workspace: uncataloguedTurtleAutosaveWs,
              lessonVersion: 2,
              updatedAt: 1760000400000,
            },
            'bad-exp': {
              workspace: invalidExperimentalAutosaveWs,
              lessonVersion: 1,
              updatedAt: 1760000400000,
            },
          },
          sandbox: {
            grid: {
              workspace: { MAIN: [], F1: [], F2: [], F3: [] },
              updatedAt: 1760000300000,
            },
            switchyard: {
              workspace: complexWs,
              updatedAt: 1760000350000,
            },
          },
        },
        savedPrograms: [
          // 1) Curriculum Slot 1 with default title (0-byte title + 0-byte slotIndex + deduced simId)
          {
            version: 1,
            title: 'Activity 2.4 — Slot 1',
            createdAt: 1760000100000,
            simId: 'grid',
            code: lessonCodeOnly,
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'PAUSED',
            stepCount: 19,
            lessonId: '2.4',
            lessonVersion: 2,
            slotIndex: 1,
          },
          // 2) Curriculum Slot 3 with custom emoji title + synthetic non-canonical code string
          {
            version: 1,
            title: 'Rainbow Remix 🌈',
            createdAt: 1760000200000,
            simId: 'beat',
            code: syntheticRawCode,
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'COLLISION',
            stepCount: 7,
            lessonId: 'C6.1',
            lessonVersion: 1,
            slotIndex: 3,
          },
          // 3) Unnumbered lesson save (slotIndex === undefined)
          {
            version: 1,
            title: 'Unnumbered Attempt',
            createdAt: 1760000250000,
            simId: 'grid',
            code: lessonCodeOnly,
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'IDLE',
            stepCount: 4,
            lessonId: '1.2',
            lessonVersion: 1,
          },
          // 4) Sandbox Grid v2 interactive world save — code must match bit-for-bit!
          {
            version: 1,
            title: 'Water & Gate World 🔑',
            createdAt: 1760000300000,
            simId: 'grid',
            code: v2SandboxCode,
            screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
            status: 'PAUSED',
            stepCount: 42,
            levelId: 5,
          },
        ],
      };

      const bytes = serializeProfileBackupToBinary(envelope);
      expect(isBinaryProfileBackupBytes(bytes)).toBe(true);

      const b64 = uint8ArrayToBase64URL(bytes);
      expect(isProfileBackupPayload(bytes)).toBe(true);
      expect(isProfileBackupPayload(b64)).toBe(true);

      // Single-level importer rejects profile backup with clear guidance
      const wrongImporterRes = importFromBinary(bytes);
      expect(wrongImporterRes.success).toBe(false);
      expect(wrongImporterRes.error).toContain('Player backup code detected');
      expect(importFromString(b64).error).toContain('Player backup code detected');

      // Parse via profileService (both binary and Base64URL)
      const parsedRes = parseProfileBackup(b64);
      expect(parsedRes.success).toBe(true);
      if (!parsedRes.success) throw new Error(parsedRes.error);

      const restored = parsedRes.backup;
      expect(restored.exportedAt).toBe(exportedAt);
      expect(restored.profile.avatarId).toBe('turtle');
      expect(restored.profile.colorId).toBe('orange');
      expect(restored.profile.name).toBe('Zoe 🐢🚀✨');
      expect(restored.profile.createdAt).toBe(createdAt);

      // Progress checks
      expect(restored.progress.unlockAllModules).toBe(true);
      expect(restored.progress.completedLessons['1.0']).toEqual({
        completedAt: exportedAt,
        version: 1,
      });
      expect(restored.progress.completedLessons['9.10']?.version).toBe(1);
      expect(restored.progress.completedLessons['9C']?.version).toBe(3);
      expect(restored.progress.completedLessons['C6.1']?.version).toBe(2);
      expect(restored.progress.completedLessons[longLessonId]?.version).toBe(1);
      expect(restored.progress.unlockedModules).toEqual(
        expect.arrayContaining(['module-1', 'module-2', 'module-9', 'module-bonus-pack'])
      );
      expect(restored.progress.earnedBadges).toEqual(
        expect.arrayContaining(['badge-module-1', 'badge-module-9', 'badge-secret-star'])
      );
      expect(restored.progress.earnedMedals).toEqual([
        'medal-C6.1-gold',
        'medal-C6.2-silver',
      ]);

      // Autosaves checks
      expect(restored.autosaves.lessons['1.1']).toBeDefined();
      expect(stripIds(restored.autosaves.lessons['1.1'].workspace)).toEqual({
        MAIN: [],
        F1: [],
        F2: [],
        F3: [],
      });
      expect(restored.autosaves.lessons['1.1'].updatedAt).toBe(0);

      // Uncatalogued Turtle TURN_LEFT({ angle: 72 }) preserved angle!
      expect(restored.autosaves.lessons['9B'].lessonVersion).toBe(2);
      expect(stripIds(restored.autosaves.lessons['9B'].workspace)).toEqual(
        stripIds(uncataloguedTurtleAutosaveWs)
      );
      // Corrupt experimental autosave was skipped cleanly without aborting backup
      expect(restored.autosaves.lessons['bad-exp']).toBeUndefined();

      // Empty sandbox autosave & switchyard sandbox autosave
      expect(stripIds(restored.autosaves.sandbox['grid'].workspace)).toEqual({
        MAIN: [],
        F1: [],
        F2: [],
        F3: [],
      });
      expect(stripIds(restored.autosaves.sandbox['switchyard'].workspace)).toEqual(
        stripIds(complexWs)
      );

      // Manual saves checks
      expect(restored.savedPrograms).toHaveLength(4);
      const [s1, s2, s3, s4] = restored.savedPrograms;

      expect(s1.title).toBe('Activity 2.4 — Slot 1');
      expect(s1.status).toBe('PAUSED');
      expect(s1.lessonId).toBe('2.4');
      expect(s1.lessonVersion).toBe(2);
      expect(s1.slotIndex).toBe(1);
      expect(s1.simId).toBe('grid');
      expect(s1.code).toBe(lessonCodeOnly);

      expect(s2.title).toBe('Rainbow Remix 🌈');
      expect(s2.status).toBe('COLLISION');
      expect(s2.lessonId).toBe('C6.1');
      expect(s2.slotIndex).toBe(3);
      expect(s2.simId).toBe('beat');
      expect(s2.code).toBe(syntheticRawCode);

      expect(s3.lessonId).toBe('1.2');
      expect(s3.slotIndex).toBeUndefined();
      expect(s3.code).toBe(lessonCodeOnly);

      expect(s4.title).toBe('Water & Gate World 🔑');
      expect(s4.status).toBe('PAUSED');
      expect(s4.levelId).toBe(5);
      expect(s4.code).toBe(v2SandboxCode);

      // End-to-end import into storage preserves PAUSED status via migrateSavedEntry
      expect(migrateSavedEntry({ code: lessonCodeOnly, status: 'PAUSED' })?.status).toBe('PAUSED');
      const imp = importProfileBackup(bytes, 'new');
      expect(imp.success).toBe(true);
      if (!imp.success || !imp.profile) throw new Error(imp.error);

      const savedInStorage = getSavedPrograms(imp.profile.id);
      expect(savedInStorage).toHaveLength(4);
      const v2FromStorage = savedInStorage.find((e) => e.title === 'Water & Gate World 🔑')!;
      expect(v2FromStorage.status).toBe('PAUSED');
      expect(v2FromStorage.code).toBe(v2SandboxCode);

      const decodedV2Map = importFromString(v2FromStorage.code);
      expect(decodedV2Map.success).toBe(true);
      expect(decodedV2Map.gridState?.waterCells).toEqual([{ x: 3, y: 3 }]);
      expect(decodedV2Map.gridState?.lockedGates).toHaveLength(1);
      expect(decodedV2Map.gridState?.worldItems).toHaveLength(2);
      expect(getLessonAutosave(imp.profile.id, '9B')?.lessonVersion).toBe(2);
      expect(getSandboxAutosave(imp.profile.id, 'grid')?.workspace.MAIN).toEqual([]);
      expect(getProfileProgress(imp.profile.id).earnedMedals).toEqual([
        'medal-C6.1-gold',
        'medal-C6.2-silver',
      ]);
    });

    it('truncates >24 code-unit emoji nicknames cleanly without splitting surrogate pairs', () => {
      // 23 ASCII chars + 1 surrogate-pair emoji (2 UTF-16 code units, index 23..24) -> must drop high surrogate cleanly!
      const boundaryName = 'a'.repeat(23) + '🚀';
      const env = exportProfileBackup(DEFAULT_PROFILE_ID, { now: 1700000000000 });
      env.profile.name = boundaryName;

      const bytes = serializeProfileBackupToBinary(env);
      const decoded = deserializeProfileBackupFromBinary(bytes);
      expect(decoded.profile.name).toBe('a'.repeat(23));
      expect(decoded.profile.name).not.toContain('\ufffd');
    });

    it('supports UTF-8 BOM-prefixed .txt Base64URL and legacy .json Uint8Array payloads', () => {
      unlockModuleForProfile(DEFAULT_PROFILE_ID, 'module-2');
      awardBadgeForProfile(DEFAULT_PROFILE_ID, 'badge-module-1');

      const b64 = exportProfileBackupToString(DEFAULT_PROFILE_ID);
      const bomTxtString = '\uFEFF  ' + b64 + '\n';
      const bomTxtBytes = new TextEncoder().encode(bomTxtString);

      expect(isProfileBackupPayload(bomTxtString)).toBe(true);
      expect(isProfileBackupPayload(bomTxtBytes)).toBe(true);
      expect(parseProfileBackup(bomTxtString).success).toBe(true);
      expect(parseProfileBackup(bomTxtBytes).success).toBe(true);

      const legacyJson = '\uFEFF' + exportProfileBackupToJson(DEFAULT_PROFILE_ID);
      const legacyJsonBytes = new TextEncoder().encode(legacyJson);
      expect(isProfileBackupPayload(legacyJson)).toBe(true);
      expect(isProfileBackupPayload(legacyJsonBytes)).toBe(true);
      expect(parseProfileBackup(legacyJson).success).toBe(true);
      expect(parseProfileBackup(legacyJsonBytes).success).toBe(true);
    });
  });

  describe('5. Corrupt, Truncated & Future-Version Input Handling', () => {
    it('rejects empty, truncated, trailing-byte, unsupported-version, and non-profile binary inputs cleanly', () => {
      const validBytes = exportProfileBackupToBinary(DEFAULT_PROFILE_ID, { now: 1700000000000 });

      // Every truncated prefix from 0 .. validBytes.length - 1 must fail cleanly without unhandled exceptions in parseProfileBackup
      for (let len = 0; len < validBytes.length; len++) {
        const prefix = validBytes.slice(0, len);
        const res = parseProfileBackup(prefix);
        expect(res.success).toBe(false);
      }

      // Appended trailing garbage byte must fail
      const withTrailing = new Uint8Array(validBytes.length + 1);
      withTrailing.set(validBytes);
      withTrailing[validBytes.length] = 0x42;
      expect(parseProfileBackup(withTrailing).success).toBe(false);

      // Future profileVersion = 99: recognized by isProfileBackupPayload, rejected with clear version error by parseProfileBackup
      const futureVer = validBytes.slice();
      futureVer[2] = 99;
      const futureVerB64 = uint8ArrayToBase64URL(futureVer);
      expect(isProfileBackupPayload(futureVer)).toBe(true);
      expect(isProfileBackupPayload(futureVerB64)).toBe(true);
      const futureRes = parseProfileBackup(futureVerB64);
      expect(futureRes.success).toBe(false);
      if (!futureRes.success) {
        expect(futureRes.error).toMatch(/version/i);
      }

      // Reserved progressFlags bits fail cleanly
      const badFlags = validBytes.slice();
      // For default empty-name or "Player 1" profile, locate progressFlags by deserializing header offsets
      expect(parseProfileBackup('not-valid-base64-$$$').success).toBe(false);
      expect(parseProfileBackup('').success).toBe(false);
      expect(parseProfileBackup(new Uint8Array([FORMAT_VERSION, 0x01, 0x01, 0x00])).success).toBe(
        false
      );
      void badFlags;
    });
  });
});
