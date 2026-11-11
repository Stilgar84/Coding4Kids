import { describe, it, expect } from 'vitest';
import { BinaryWriter, uint8ArrayToBase64URL } from '../src/engine/serialization/binaryWriter';
import { BinaryReader, base64URLToUint8Array } from '../src/engine/serialization/binaryReader';
import {
  exportToString,
  importFromString,
  exportLessonCodeOnly,
  exportLessonToBinary,
  exportLessonToString,
} from '../src/engine/serialization/codeSerializer';
import {
  FORMAT_VERSION,
  ENV_ID_GRID,
  ENV_ID_TURTLE,
  ENV_ID_BEAT,
  ENV_ID_LESSON,
  ENV_ID_GENERIC,
  ENV_VERSION_GRID,
  ENV_VERSION_GRID_V2,
  OP_GRID_PICK_UP,
  OP_GRID_USE_DROP,
  MASK_HAS_REP,
  MASK_HAS_VAR_PARAM,
  TURTLE_COLOR_PALETTE,
} from '../src/engine/serialization/types';
import {
  saveProgram,
  getProgramById,
  clearAllSavedPrograms,
} from '../src/services/localSaveService';
import {
  GridState,
  WorkspaceState,
  Direction,
  WallEdge,
  FlagObjective,
  toVariableName,
} from '../src/types';
import { useAppStore } from '../src/store/useAppStore';

describe('Binary Serialization', () => {
  describe('BinaryWriter and BinaryReader primitives', () => {
    it('handles uint8 reading and writing', () => {
      const writer = new BinaryWriter();
      writer.writeUint8(0);
      writer.writeUint8(42);
      writer.writeUint8(255);

      const reader = new BinaryReader(writer.getBytes());
      expect(reader.readUint8()).toBe(0);
      expect(reader.readUint8()).toBe(42);
      expect(reader.readUint8()).toBe(255);
      expect(reader.hasMore).toBe(false);
    });

    it('handles VLE boundary cases correctly', () => {
      const testValues = [0, 1, 63, 127, 128, 129, 255, 256, 16383, 16384, 65535, 1000000];
      const writer = new BinaryWriter();

      for (const val of testValues) {
        writer.writeVLE(val);
      }

      const reader = new BinaryReader(writer.getBytes());
      for (const val of testValues) {
        expect(reader.readVLE()).toBe(val);
      }
      expect(reader.hasMore).toBe(false);
    });

    it('verifies VLE byte consumption for < 128 vs >= 128', () => {
      const w1 = new BinaryWriter();
      w1.writeVLE(127);
      expect(w1.getBytes().length).toBe(1);

      const w2 = new BinaryWriter();
      w2.writeVLE(128);
      expect(w2.getBytes().length).toBe(2);

      const w3 = new BinaryWriter();
      w3.writeVLE(16384);
      expect(w3.getBytes().length).toBe(3);
    });

    it('handles Base64URL encoding and decoding without padding', () => {
      const original = new Uint8Array([1, 2, 3, 250, 251, 252, 253, 254, 255]);
      const b64 = uint8ArrayToBase64URL(original);

      expect(b64).not.toContain('=');
      expect(b64).not.toContain('+');
      expect(b64).not.toContain('/');

      const decoded = base64URLToUint8Array(b64);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it('tolerates whitespace and padding when decoding Base64URL', () => {
      const original = new Uint8Array([10, 20, 30, 40]);
      const standardB64WithPadding = uint8ArrayToBase64URL(original) + '==';
      const decoded = base64URLToUint8Array(`  ${standardB64WithPadding} \n`);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it('throws error when reading past buffer end or invalid Base64', () => {
      const reader = new BinaryReader(new Uint8Array([1]));
      expect(reader.readUint8()).toBe(1);
      expect(() => reader.readUint8()).toThrow(/Unexpected end of data/);

      expect(() => base64URLToUint8Array('?invalid!*')).toThrow(/Invalid Base64URL character/);
      expect(() => base64URLToUint8Array('A')).toThrow(/length % 4 cannot be 1/);
    });
  });

  describe('Grid World Serialization & Deserialization', () => {
    it('roundtrips small grid map and code faithfully', () => {
      const gridState: GridState = {
        width: 6,
        height: 5,
        robot: {
          x: 1,
          y: 2,
          dir: 'EAST',
          initialX: 1,
          initialY: 2,
          initialDir: 'EAST',
        },
        barriers: [
          { orientation: 'H', x: 2, y: 3 },
          { orientation: 'V', x: 4, y: 1 },
        ],
        flags: [
          { id: 'f1', x: 3, y: 3, isGoal: false, order: 1, collected: false },
          { id: 'goal', x: 5, y: 2, isGoal: true, order: 2, collected: false },
        ],
        trace: [{ x: 1, y: 2 }],
        status: 'IDLE',
        showTrace: true,
        fitToView: false,
      };

      const workspace: WorkspaceState = {
        MAIN: [
          { id: 'm1', type: 'MOVE_FWD', repeatCount: 3 },
          { id: 'm2', type: 'CALL_F1' },
          { id: 'm3', type: 'TURN_RIGHT' },
        ],
        F1: [
          { id: 'f1_1', type: 'TURN_LEFT' },
          { id: 'f1_2', type: 'MOVE_FWD', repeatCount: 2 },
        ],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'grid', gridState);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      const imported = importFromString(encoded);
      expect(imported.success).toBe(true);
      expect(imported.envId).toBe('grid');
      expect(imported.formatVersion).toBe(FORMAT_VERSION);

      // Verify grid state restoration
      expect(imported.gridState).toBeDefined();
      expect(imported.gridState?.width).toBe(6);
      expect(imported.gridState?.height).toBe(5);
      expect(imported.gridState?.robot.x).toBe(1);
      expect(imported.gridState?.robot.y).toBe(2);
      expect(imported.gridState?.robot.dir).toBe('EAST');
      expect(imported.gridState?.robot.initialX).toBe(1);
      expect(imported.gridState?.robot.initialY).toBe(2);
      expect(imported.gridState?.robot.initialDir).toBe('EAST');

      // Verify barriers
      expect(imported.gridState?.barriers).toHaveLength(2);
      expect(imported.gridState?.barriers[0]).toEqual({ orientation: 'H', x: 2, y: 3 });
      expect(imported.gridState?.barriers[1]).toEqual({ orientation: 'V', x: 4, y: 1 });

      // Verify flags
      expect(imported.gridState?.flags).toHaveLength(2);
      expect(imported.gridState?.flags[0].isGoal).toBe(false);
      expect(imported.gridState?.flags[0].order).toBe(1);
      expect(imported.gridState?.flags[0].x).toBe(3);
      expect(imported.gridState?.flags[0].y).toBe(3);

      expect(imported.gridState?.flags[1].isGoal).toBe(true);
      expect(imported.gridState?.flags[1].order).toBe(2);
      expect(imported.gridState?.flags[1].x).toBe(5);
      expect(imported.gridState?.flags[1].y).toBe(2);

      // Verify workspace restoration
      expect(imported.workspace?.MAIN).toHaveLength(3);
      expect(imported.workspace?.MAIN[0].type).toBe('MOVE_FWD');
      expect(imported.workspace?.MAIN[0].repeatCount).toBe(3);
      expect(imported.workspace?.MAIN[1].type).toBe('CALL_F1');
      expect(imported.workspace?.MAIN[2].type).toBe('TURN_RIGHT');

      expect(imported.workspace?.F1).toHaveLength(2);
      expect(imported.workspace?.F1[0].type).toBe('TURN_LEFT');
      expect(imported.workspace?.F1[1].type).toBe('MOVE_FWD');
      expect(imported.workspace?.F1[1].repeatCount).toBe(2);

      expect(imported.workspace?.F2).toHaveLength(0);
      expect(imported.workspace?.F3).toHaveLength(0);
    });

    it('matches the walkthrough example layout: exactly 21 bytes, 28 Base64URL chars', () => {
      // 5x5 Grid with Robot at (0, 2, EAST), 1 Goal at (4, 2)
      // MAIN: MOVE_FWD(3), CALL_FN(F1)
      // F1: TURN_LEFT
      const gridState: GridState = {
        width: 5,
        height: 5,
        robot: {
          x: 0,
          y: 2,
          dir: 'EAST',
          initialX: 0,
          initialY: 2,
          initialDir: 'EAST',
        },
        barriers: [],
        flags: [{ id: 'goal', x: 4, y: 2, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 0, y: 2 }],
        status: 'IDLE',
        showTrace: true,
      };

      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'MOVE_FWD', repeatCount: 3 },
          { id: '2', type: 'CALL_F1' },
        ],
        F1: [{ id: '3', type: 'TURN_LEFT' }],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'grid', gridState);
      const rawBytes = base64URLToUint8Array(encoded);

      // Total: 3 (header) + 8 (grid: 2 dims + 2 robot + 1 barrier + 3 flag) + 10 (code: 1 scopeCount + 6 MAIN + 3 F1) = 21 bytes
      expect(rawBytes.length).toBe(21);
      expect(encoded.length).toBe(28);

      // Verify specific byte contents from spec section 3
      // Header: [0x01, 0x01, 0x01]
      expect(rawBytes[0]).toBe(0x01);
      expect(rawBytes[1]).toBe(0x01);
      expect(rawBytes[2]).toBe(0x01);

      // Grid: dims [0x05, 0x05], robot [(0<<4)|2 = 0x02, dir 0x01]
      expect(rawBytes[3]).toBe(0x05);
      expect(rawBytes[4]).toBe(0x05);
      expect(rawBytes[5]).toBe(0x02);
      expect(rawBytes[6]).toBe(0x01);

      // Barriers count [0x00]
      expect(rawBytes[7]).toBe(0x00);

      // Flags count [0x01], coords [(4<<4)|2 = 0x42], [isGoal|order = 0x80|1 = 0x81]
      expect(rawBytes[8]).toBe(0x01);
      expect(rawBytes[9]).toBe(0x42);
      expect(rawBytes[10]).toBe(0x81);

      // Code: scopeCount [0x02]
      expect(rawBytes[11]).toBe(0x02);
      // Scope 1 (MAIN): id [0x00], count [0x02], Block 1 [0x50, 0x03], Block 2 [0x03, 0x01]
      expect(rawBytes[12]).toBe(0x00);
      expect(rawBytes[13]).toBe(0x02);
      expect(rawBytes[14]).toBe(0x50);
      expect(rawBytes[15]).toBe(0x03);
      expect(rawBytes[16]).toBe(0x03);
      expect(rawBytes[17]).toBe(0x01);
      // Scope 2 (F1): id [0x81], count [0x01], Block 1 [0x12]
      expect(rawBytes[18]).toBe(0x81);
      expect(rawBytes[19]).toBe(0x01);
      expect(rawBytes[20]).toBe(0x12);
    });

    it('roundtrips large grid (>16x16) coordinates and barriers', () => {
      const largeGrid: GridState = {
        width: 25,
        height: 30,
        robot: {
          x: 20,
          y: 22,
          dir: 'SOUTH',
          initialX: 20,
          initialY: 22,
          initialDir: 'SOUTH',
        },
        barriers: [{ orientation: 'V', x: 19, y: 22 }],
        flags: [{ id: 'flag', x: 24, y: 28, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 20, y: 22 }],
        status: 'IDLE',
        showTrace: true,
      };

      const workspace: WorkspaceState = {
        MAIN: [{ id: '1', type: 'MOVE_BACK', repeatCount: 4 }],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'grid', largeGrid);
      const res = importFromString(encoded);
      expect(res.success).toBe(true);
      expect(res.gridState?.width).toBe(25);
      expect(res.gridState?.height).toBe(30);
      expect(res.gridState?.robot.x).toBe(20);
      expect(res.gridState?.robot.y).toBe(22);
      expect(res.gridState?.robot.dir).toBe('SOUTH');
      expect(res.gridState?.barriers[0]).toEqual({ orientation: 'V', x: 19, y: 22 });
      expect(res.gridState?.flags[0].x).toBe(24);
      expect(res.gridState?.flags[0].y).toBe(28);
    });
  });

  describe('Turtle LOGO Serialization & Deserialization', () => {
    it('roundtrips all turtle movement, turns, arcs, pen, and colors', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: 't1', type: 'FORWARD', repeatCount: 4 },
          { id: 't2', type: 'BACKWARD' },
          { id: 't3', type: 'TURN_LEFT', params: { angle: 45 } },
          { id: 't4', type: 'TURN_RIGHT', params: { angle: 120 } },
          { id: 't5', type: 'ARC_LEFT', params: { radius: 75, angle: 90 } },
          { id: 't6', type: 'ARC_RIGHT', params: { radius: 100, angle: 60 } },
          { id: 't7', type: 'PEN_UP' },
          { id: 't8', type: 'PEN_DOWN' },
          { id: 't9', type: 'SET_PEN_COLOR', params: { color: '#ef4444' } }, // Red (index 1)
          { id: 't10', type: 'SET_PEN_COLOR', params: { color: '#8b5cf6' } }, // Purple (index 5)
          { id: 't11', type: 'SET_PEN_WIDTH', params: { width: 12 } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'turtle');
      const res = importFromString(encoded);

      expect(res.success).toBe(true);
      expect(res.envId).toBe('turtle');
      expect(res.turtleState).toBeDefined();

      const main = res.workspace?.MAIN || [];
      expect(main).toHaveLength(11);

      expect(main[0].type).toBe('FORWARD');
      expect(main[0].repeatCount).toBe(4);

      expect(main[1].type).toBe('BACKWARD');

      expect(main[2].type).toBe('TURN_LEFT');
      expect(main[2].params?.angle).toBe(45);

      expect(main[3].type).toBe('TURN_RIGHT');
      expect(main[3].params?.angle).toBe(120);

      expect(main[4].type).toBe('ARC_LEFT');
      expect(main[4].params?.radius).toBe(75);
      expect(main[4].params?.angle).toBe(90);

      expect(main[5].type).toBe('ARC_RIGHT');
      expect(main[5].params?.radius).toBe(100);
      expect(main[5].params?.angle).toBe(60);

      expect(main[6].type).toBe('PEN_UP');
      expect(main[7].type).toBe('PEN_DOWN');

      expect(main[8].type).toBe('SET_PEN_COLOR');
      expect(main[8].params?.color).toBe('#ef4444');

      expect(main[9].type).toBe('SET_PEN_COLOR');
      expect(main[9].params?.color).toBe('#8b5cf6');

      expect(main[10].type).toBe('SET_PEN_WIDTH');
      expect(main[10].params?.width).toBe(12);
    });

    it('roundtrips all 6 palette colors', () => {
      for (const color of TURTLE_COLOR_PALETTE) {
        const workspace: WorkspaceState = {
          MAIN: [{ id: '1', type: 'SET_PEN_COLOR', params: { color } }],
          F1: [],
          F2: [],
          F3: [],
        };
        const encoded = exportToString(workspace, 'turtle');
        const res = importFromString(encoded);
        expect(res.success).toBe(true);
        expect(res.workspace?.MAIN[0].params?.color).toBe(color);
      }
    });

    it('roundtrips parameterized FORWARD/BACKWARD with explicit length', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: 'f1', type: 'FORWARD', params: { length: 100 } },
          { id: 'f2', type: 'BACKWARD', params: { length: 25 }, repeatCount: 3 },
          { id: 'f3', type: 'FORWARD' },  // no length param => legacy opcode
          { id: 'f4', type: 'FORWARD', params: { length: 200 } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'turtle');
      const res = importFromString(encoded);

      expect(res.success).toBe(true);
      const main = res.workspace?.MAIN || [];
      expect(main).toHaveLength(4);

      expect(main[0].type).toBe('FORWARD');
      expect(main[0].params?.length).toBe(100);

      expect(main[1].type).toBe('BACKWARD');
      expect(main[1].params?.length).toBe(25);
      expect(main[1].repeatCount).toBe(3);

      // Legacy FORWARD without length param - no params on deserialization
      expect(main[2].type).toBe('FORWARD');
      expect(main[2].params).toBeUndefined();

      expect(main[3].type).toBe('FORWARD');
      expect(main[3].params?.length).toBe(200);
    });

    it('legacy unparameterized FORWARD is backwards compatible with new parameterized one', () => {
      // Encode a FORWARD without length (legacy opcode 0x10)
      const legacyWorkspace: WorkspaceState = {
        MAIN: [
          { id: 'l1', type: 'FORWARD', repeatCount: 2 },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const legacyEncoded = exportToString(legacyWorkspace, 'turtle');
      const legacyRes = importFromString(legacyEncoded);
      expect(legacyRes.success).toBe(true);
      expect(legacyRes.workspace?.MAIN[0].type).toBe('FORWARD');
      expect(legacyRes.workspace?.MAIN[0].repeatCount).toBe(2);
      // Legacy blocks have no length param
      expect(legacyRes.workspace?.MAIN[0].params).toBeUndefined();

      // Encode a FORWARD with length (new opcode 0x1A)
      const newWorkspace: WorkspaceState = {
        MAIN: [
          { id: 'n1', type: 'FORWARD', params: { length: 75 }, repeatCount: 2 },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const newEncoded = exportToString(newWorkspace, 'turtle');
      const newRes = importFromString(newEncoded);
      expect(newRes.success).toBe(true);
      expect(newRes.workspace?.MAIN[0].type).toBe('FORWARD');
      expect(newRes.workspace?.MAIN[0].params?.length).toBe(75);
      expect(newRes.workspace?.MAIN[0].repeatCount).toBe(2);

      // The two encodings should be different (different opcodes) and keep envVersion = 1
      expect(legacyEncoded).not.toBe(newEncoded);
      expect(newRes.envVersion).toBe(1);
      const newBytes = base64URLToUint8Array(newEncoded);
      // Header (3B) + scopeCount (1B) + scopeId (1B) + blockCount (1B) + blockHeader (HasRep 0x40 | 0x1A = 0x5A)
      expect(newBytes[2]).toBe(1);
      expect(newBytes[6] & 0x1f).toBe(0x1a);
    });

    it('roundtrips variable length on FORWARD and BACKWARD blocks', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: 'v1', type: 'FORWARD', params: { length: 'x' } },
          { id: 'v2', type: 'BACKWARD', params: { length: 'd' }, repeatCount: 2 },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const encoded = exportToString(workspace, 'turtle');
      const rawBytes = base64URLToUint8Array(encoded);
      expect(rawBytes[6] & 0x1f).toBe(0x1a);

      const res = importFromString(encoded);
      expect(res.success).toBe(true);
      expect(res.envVersion).toBe(1);
      expect(res.workspace?.MAIN[0].type).toBe('FORWARD');
      expect(res.workspace?.MAIN[0].params?.length).toBe('x');
      expect(res.workspace?.MAIN[1].type).toBe('BACKWARD');
      expect(res.workspace?.MAIN[1].params?.length).toBe('d');
      expect(res.workspace?.MAIN[1].repeatCount).toBe(2);
    });

    it('decodes existing real-world v1 turtle strings from TODO.md containing legacy FORWARD/BACKWARD opcodes', () => {
      const legacy1 = importFromString('AQIBAQALUAIUZI4CUAIWEBJaERdQAxSWAY4CUAM');
      expect(legacy1.success).toBe(true);
      expect(legacy1.envId).toBe('turtle');
      expect(legacy1.envVersion).toBe(1);
      expect(legacy1.workspace?.MAIN.some((b) => b.type === 'FORWARD')).toBe(true);
      expect(legacy1.workspace?.MAIN.some((b) => b.type === 'BACKWARD')).toBe(true);

      const legacy2 = importFromString(
        'AQIBAQATAUEGVAQyWhIeAgIYA0EEQQYWUAMXVAQyWhZRAxIPAgIX'
      );
      expect(legacy2.success).toBe(true);
      expect(legacy2.envId).toBe('turtle');
      expect(legacy2.envVersion).toBe(1);
      expect((legacy2.workspace?.MAIN.length ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('Universal Control Flow & Scopes', () => {
    it('roundtrips parameterized CALL_FN for F1, F2, and F3', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'CALL_F1' },
          { id: '2', type: 'CALL_F2' },
          { id: '3', type: 'CALL_F3' },
        ],
        F1: [{ id: '4', type: 'MOVE_FWD' }],
        F2: [{ id: '5', type: 'TURN_LEFT' }],
        F3: [{ id: '6', type: 'TURN_RIGHT' }],
      };

      const encoded = exportToString(workspace, 'generic');
      const res = importFromString(encoded);

      expect(res.success).toBe(true);
      expect(res.workspace?.MAIN[0].type).toBe('CALL_F1');
      expect(res.workspace?.MAIN[1].type).toBe('CALL_F2');
      expect(res.workspace?.MAIN[2].type).toBe('CALL_F3');

      expect(res.workspace?.F1[0].type).toBe('MOVE_FWD');
      expect(res.workspace?.F2[0].type).toBe('TURN_LEFT');
      expect(res.workspace?.F3[0].type).toBe('TURN_RIGHT');
    });

    it('roundtrips LOOP_START and LOOP_END blocks with iteration count', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'LOOP_START', repeatCount: 4 },
          { id: '2', type: 'MOVE_FWD', repeatCount: 2 },
          { id: '3', type: 'TURN_RIGHT' },
          { id: '4', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const res = importFromString(encoded);

      expect(res.success).toBe(true);
      const blocks = res.workspace?.MAIN || [];
      expect(blocks).toHaveLength(4);
      expect(blocks[0].type).toBe('LOOP_START');
      expect(blocks[0].repeatCount).toBe(4);
      expect(blocks[1].type).toBe('MOVE_FWD');
      expect(blocks[1].repeatCount).toBe(2);
      expect(blocks[2].type).toBe('TURN_RIGHT');
      expect(blocks[3].type).toBe('LOOP_END');
    });

    it('generates unique block IDs upon import', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'MOVE_FWD' },
          { id: '2', type: 'MOVE_FWD' },
          { id: '3', type: 'MOVE_FWD' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const res = importFromString(encoded);
      expect(res.success).toBe(true);

      const ids = res.workspace?.MAIN.map((b) => b.id) || [];
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(id).toMatch(/^MOVE_FWD_\d+_\d+_[a-z0-9]+$/);
      }
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects empty or whitespace string', () => {
      expect(importFromString('').success).toBe(false);
      expect(importFromString('   ').success).toBe(false);
    });

    it('rejects invalid Base64 input', () => {
      const res = importFromString('@@@@');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid Base64URL/);
    });

    it('rejects truncated header (< 3 bytes)', () => {
      // 1 or 2 bytes in base64: 'AQ' is 1 byte
      const res = importFromString('AQ');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/too short/);
    });

    it('rejects unsupported format version', () => {
      // Header with formatVersion = 99
      const w = new BinaryWriter();
      w.writeUint8(99); // formatVersion
      w.writeUint8(1);  // envId
      w.writeUint8(1);  // envVersion
      const res = importFromString(w.toBase64URL());
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Unsupported format version: 99/);
    });

    it('gracefully handles truncated code stream', () => {
      // Valid header, but scope says 5 blocks and gives 0
      const w = new BinaryWriter();
      w.writeUint8(FORMAT_VERSION);
      w.writeUint8(ENV_ID_GENERIC);
      w.writeUint8(1);
      w.writeVLE(1); // 1 scope
      w.writeUint8(0); // MAIN
      w.writeVLE(5); // 5 blocks promised, but stream ends!

      const res = importFromString(w.toBase64URL());
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Unexpected end of data/);
    });
  });

  describe('Store Integration (exportCode & importCode)', () => {
    it('exports and imports code via useAppStore', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('grid');
      store.clearWorkspace();

      store.addBlock('MAIN', 'MOVE_FWD', 2);
      store.addBlock('MAIN', 'TURN_LEFT');
      store.addBlock('MAIN', 'CALL_F1');
      store.addBlock('F1', 'MOVE_FWD', 4);

      // Export
      const exported = store.exportCode(true);
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);

      // Clear workspace and change activeSim
      store.clearWorkspace();
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Import back
      const res = store.importCode(exported);
      expect(res.success).toBe(true);

      const stateAfter = useAppStore.getState();
      expect(stateAfter.activeSimId).toBe('grid');
      expect(stateAfter.workspace.MAIN).toHaveLength(3);
      expect(stateAfter.workspace.MAIN[0].type).toBe('MOVE_FWD');
      expect(stateAfter.workspace.MAIN[0].repeatCount).toBe(2);
      expect(stateAfter.workspace.MAIN[1].type).toBe('TURN_LEFT');
      expect(stateAfter.workspace.MAIN[2].type).toBe('CALL_F1');
      expect(stateAfter.workspace.F1).toHaveLength(1);
      expect(stateAfter.workspace.F1[0].type).toBe('MOVE_FWD');
      expect(stateAfter.workspace.F1[0].repeatCount).toBe(4);
    });

    it('switches environment to turtle when importing a turtle program', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      store.clearWorkspace();

      store.addBlock('MAIN', 'FORWARD', 3);
      store.addBlock('MAIN', 'TURN_RIGHT', undefined, undefined, { angle: 45 });
      store.addBlock('MAIN', 'SET_PEN_COLOR', undefined, undefined, { color: '#ef4444' });

      const exported = store.exportCode();

      // Switch to grid
      store.setSimEnvironment('grid');
      expect(useAppStore.getState().activeSimId).toBe('grid');

      // Import turtle program
      const res = store.importCode(exported);
      expect(res.success).toBe(true);
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(3);
      expect(useAppStore.getState().workspace.MAIN[1].params?.angle).toBe(45);
      expect(useAppStore.getState().workspace.MAIN[2].params?.color).toBe('#ef4444');
    });
  });

  describe('Dual-Path Curriculum Lesson Serialization (Path A vs Path B, ENV_ID_LESSON = 0x04)', () => {
    const stripWorkspaceIds = (ws?: WorkspaceState) => ({
      MAIN: (ws?.MAIN || []).map(({ id: _id, ...rest }) => rest),
      F1: (ws?.F1 || []).map(({ id: _id, ...rest }) => rest),
      F2: (ws?.F2 || []).map(({ id: _id, ...rest }) => rest),
      F3: (ws?.F3 || []).map(({ id: _id, ...rest }) => rest),
    });

    it('encodes ENV_ID_LESSON = 0x04 header bytes [1, 0x04, innerEnvByte, lessonIdLen, ...utf8, lessonVersion] without map geometry', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'LOOP_START', repeatCount: 3 },
          { id: '2', type: 'MOVE_FWD', repeatCount: 2 },
          { id: '3', type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
          { id: '4', type: 'LOOP_END' },
        ],
        F1: [{ id: '5', type: 'TURN_RIGHT' }],
        F2: [],
        F3: [],
      };

      const bytes = exportLessonToBinary(workspace, 'grid', '1.4', 2);
      expect(bytes[0]).toBe(FORMAT_VERSION);
      expect(bytes[1]).toBe(ENV_ID_LESSON);
      expect(bytes[2]).toBe(ENV_ID_GENERIC); // Grid lessons serialize code-only (0x00)
      expect(bytes[3]).toBe(3); // '1.4'.length
      expect(new TextDecoder().decode(bytes.slice(4, 7))).toBe('1.4');
      expect(bytes[7]).toBe(2); // lessonVersion = 2

      const res = importFromString(uint8ArrayToBase64URL(bytes));
      expect(res.success).toBe(true);
      expect(res.envId).toBe('lesson');
      expect(res.innerEnvId).toBe('generic');
      expect(res.lessonId).toBe('1.4');
      expect(res.lessonVersion).toBe(2);
      expect(res.gridState).toBeUndefined();
      expect(stripWorkspaceIds(res.workspace)).toEqual(stripWorkspaceIds(workspace));
    });

    it('roundtrips ENV_ID_LESSON = 0x04 for Turtle (0x02) and Beat (0x03) lessons', () => {
      const turtleWs: WorkspaceState = {
        MAIN: [
          { id: 't1', type: 'FORWARD', params: { length: 80 } },
          { id: 't2', type: 'TURN_LEFT', params: { angle: 90 } },
          { id: 't3', type: 'SET_PEN_COLOR', params: { color: TURTLE_COLOR_PALETTE[2] } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const turtleBytes = exportLessonToBinary(turtleWs, 'turtle', '1.9', 1);
      expect(turtleBytes[1]).toBe(ENV_ID_LESSON);
      expect(turtleBytes[2]).toBe(ENV_ID_TURTLE);
      const decodedTurtle = importFromString(uint8ArrayToBase64URL(turtleBytes));
      expect(decodedTurtle.success).toBe(true);
      expect(decodedTurtle.envId).toBe('lesson');
      expect(decodedTurtle.innerEnvId).toBe('turtle');
      expect(decodedTurtle.lessonId).toBe('1.9');
      expect(decodedTurtle.lessonVersion).toBe(1);
      expect(decodedTurtle.workspace?.MAIN[0].params?.length).toBe(80);
      expect(decodedTurtle.workspace?.MAIN[1].params?.angle).toBe(90);

      const beatWs: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'DRUM_KICK', repeatCount: 2 },
          { id: 'b2', type: 'STAMP_PRESET', params: { preset: 'HEART' } },
          { id: 'b3', type: 'WAIT_BEAT' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const beatBytes = exportLessonToBinary(beatWs, 'beat', '1.11', 3);
      expect(beatBytes[1]).toBe(ENV_ID_LESSON);
      expect(beatBytes[2]).toBe(ENV_ID_BEAT);
      const decodedBeat = importFromString(uint8ArrayToBase64URL(beatBytes));
      expect(decodedBeat.success).toBe(true);
      expect(decodedBeat.envId).toBe('lesson');
      expect(decodedBeat.innerEnvId).toBe('beat');
      expect(decodedBeat.lessonId).toBe('1.11');
      expect(decodedBeat.lessonVersion).toBe(3);
      expect(decodedBeat.workspace?.MAIN).toHaveLength(3);
      expect(decodedBeat.workspace?.MAIN[1].params?.preset).toBe('HEART');
    });

    it('produces identical (lessonId, lessonVersion, workspace) across Path A (SavedProgramEntry) and Path B (ENV_ID_LESSON = 0x04)', () => {
      clearAllSavedPrograms();

      const attemptWorkspace: WorkspaceState = {
        MAIN: [
          { id: 'a1', type: 'VAR_ASSIGN', params: { a: 'x', b: 3 } },
          { id: 'a2', type: 'LOOP_START', repeatCount: 'x' },
          { id: 'a3', type: 'CALL_F1' },
          { id: 'a4', type: 'LOOP_END' },
        ],
        F1: [
          { id: 'f1', type: 'MOVE_FWD', repeatCount: 2 },
          { id: 'f2', type: 'TURN_LEFT' },
          { id: 'f3', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
        ],
        F2: [],
        F3: [],
      };

      // Path A: Local Storage manual slot (`SavedProgramEntry` JSON + code-only payload)
      const pathACode = exportLessonCodeOnly(attemptWorkspace, 'grid');
      const savedSlot = saveProgram({
        title: 'Activity 1.3 — Slot 1',
        profileId: 'default',
        simId: 'grid',
        code: pathACode,
        screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        status: 'SUCCESS',
        stepCount: 9,
        lessonId: '1.3',
        lessonVersion: 2,
        slotIndex: 1,
      });
      const loadedSlot = getProgramById(savedSlot.id)!;
      const decodedPathA = importFromString(loadedSlot.code);

      // Path B: Self-contained share string (`ENV_ID_LESSON = 0x04`)
      const pathBString = exportLessonToString(attemptWorkspace, 'grid', '1.3', 2);
      const decodedPathB = importFromString(pathBString);

      expect(decodedPathA.success).toBe(true);
      expect(decodedPathB.success).toBe(true);
      expect(decodedPathA.gridState).toBeUndefined();
      expect(decodedPathB.gridState).toBeUndefined();

      expect(loadedSlot.lessonId).toBe(decodedPathB.lessonId);
      expect(loadedSlot.lessonVersion).toBe(decodedPathB.lessonVersion);
      expect(stripWorkspaceIds(decodedPathA.workspace)).toEqual(
        stripWorkspaceIds(decodedPathB.workspace)
      );
      expect(stripWorkspaceIds(decodedPathA.workspace)).toEqual(
        stripWorkspaceIds(attemptWorkspace)
      );
    });

    it('rejects malformed ENV_ID_LESSON = 0x04 payloads cleanly without throwing', () => {
      // Bad inner envId (0x99)
      const wBadEnv = new BinaryWriter();
      wBadEnv.writeUint8(FORMAT_VERSION);
      wBadEnv.writeUint8(ENV_ID_LESSON);
      wBadEnv.writeUint8(0x99);
      wBadEnv.writeVLE(3);
      wBadEnv.writeBytes(new TextEncoder().encode('1.1'));
      wBadEnv.writeVLE(1);
      wBadEnv.writeVLE(0);
      const badEnvRes = importFromString(wBadEnv.toBase64URL());
      expect(badEnvRes.success).toBe(false);
      expect(badEnvRes.error).toMatch(/Unsupported lesson inner environment ID/);

      // Empty lessonId (len = 0)
      const wEmptyId = new BinaryWriter();
      wEmptyId.writeUint8(FORMAT_VERSION);
      wEmptyId.writeUint8(ENV_ID_LESSON);
      wEmptyId.writeUint8(ENV_ID_GENERIC);
      wEmptyId.writeVLE(0);
      wEmptyId.writeVLE(1);
      wEmptyId.writeVLE(0);
      const emptyIdRes = importFromString(wEmptyId.toBase64URL());
      expect(emptyIdRes.success).toBe(false);
      expect(emptyIdRes.error).toMatch(/Empty lessonId/);

      // Zero lessonVersion
      const wZeroVer = new BinaryWriter();
      wZeroVer.writeUint8(FORMAT_VERSION);
      wZeroVer.writeUint8(ENV_ID_LESSON);
      wZeroVer.writeUint8(ENV_ID_GENERIC);
      wZeroVer.writeVLE(3);
      wZeroVer.writeBytes(new TextEncoder().encode('1.1'));
      wZeroVer.writeVLE(0);
      wZeroVer.writeVLE(0);
      const zeroVerRes = importFromString(wZeroVer.toBase64URL());
      expect(zeroVerRes.success).toBe(false);
      expect(zeroVerRes.error).toMatch(/Invalid lessonVersion/);
    });
  });

  describe('Grid envVersion=1 Backward Compatibility & envVersion=2 World Items (C14)', () => {
    it('preserves TODO.md share strings and classic envVersion=1 maps byte-for-byte', () => {
      const todoExamples = [
        'AQIBAQALUAIUZI4CUAIWEBJaERdQAxSWAY4CUAM',
        'AQIBAQATAUEGVAQyWhIeAgIYA0EEQQYWUAMXVAQyWhZRAxIPAgIX',
      ];

      for (const shareStr of todoExamples) {
        const imported = importFromString(shareStr);
        expect(imported.success).toBe(true);
        expect(imported.workspace).toBeDefined();

        const reExported = exportToString(
          imported.workspace!,
          imported.envId! as any,
          imported.envId === 'grid'
            ? imported.gridState
            : imported.envId === 'turtle'
            ? imported.turtleState
            : undefined
        );
        expect(reExported).toBe(shareStr);
      }

      // Classic grid with empty interactive arrays must still emit envVersion=1 byte-for-byte
      const classicBase: GridState = {
        width: 5,
        height: 5,
        robot: { x: 0, y: 2, dir: 'EAST', initialX: 0, initialY: 2, initialDir: 'EAST' },
        barriers: [{ orientation: 'V', x: 2, y: 2 }],
        flags: [{ id: 'goal', x: 4, y: 2, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 0, y: 2 }],
        status: 'IDLE',
        showTrace: true,
      };
      const classicWithEmptyArrays: GridState = {
        ...classicBase,
        waterCells: [],
        bridgedWaterCells: [],
        lockedGates: [],
        initialLockedGates: [],
        floorSwitches: [],
        worldItems: [],
        initialWorldItems: [],
      };
      const ws: WorkspaceState = {
        MAIN: [{ id: '1', type: 'MOVE_FWD', repeatCount: 4 }],
        F1: [],
        F2: [],
        F3: [],
      };

      const encodedBase = exportToString(ws, 'grid', classicBase);
      const encodedEmpty = exportToString(ws, 'grid', classicWithEmptyArrays);
      expect(encodedEmpty).toBe(encodedBase);

      const bytes = base64URLToUint8Array(encodedEmpty);
      expect(bytes[1]).toBe(ENV_ID_GRID);
      expect(bytes[2]).toBe(ENV_VERSION_GRID);
    });

    it('encodes PICK_UP (0x14) and USE_DROP (0x15) with single, numeric repeat, and variable repeat', () => {
      const ws: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'PICK_UP' },
          { id: '2', type: 'USE_DROP' },
          { id: '3', type: 'PICK_UP', repeatCount: 3 },
          { id: '4', type: 'USE_DROP', repeatCount: toVariableName('n') },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(ws, 'generic');
      const raw = base64URLToUint8Array(encoded);
      // Header (3) + scopeCount(1) + scopeId(1) + blockCount(1) = offset 6
      expect(raw[6]).toBe(OP_GRID_PICK_UP);
      expect(raw[7]).toBe(OP_GRID_USE_DROP);
      expect(raw[8]).toBe(OP_GRID_PICK_UP | MASK_HAS_REP);
      expect(raw[9]).toBe(3);
      expect(raw[10]).toBe(OP_GRID_USE_DROP | MASK_HAS_REP | MASK_HAS_VAR_PARAM);

      const decoded = importFromString(encoded);
      expect(decoded.success).toBe(true);
      const main = decoded.workspace!.MAIN;
      expect(main).toHaveLength(4);
      expect(main[0].type).toBe('PICK_UP');
      expect(main[0].repeatCount).toBeUndefined();
      expect(main[1].type).toBe('USE_DROP');
      expect(main[1].repeatCount).toBeUndefined();
      expect(main[2].type).toBe('PICK_UP');
      expect(main[2].repeatCount).toBe(3);
      expect(main[3].type).toBe('USE_DROP');
      expect(main[3].repeatCount).toBe('n');
    });

    it('roundtrips envVersion=2 Grid maps with water, gates, linked switches, and world items (small & >16x16)', () => {
      const v2Grid: GridState = {
        width: 6,
        height: 5,
        robot: {
          x: 4, // moved at runtime
          y: 2,
          dir: 'SOUTH',
          initialX: 0,
          initialY: 2,
          initialDir: 'EAST',
          carriedItem: { id: 'k-temp', type: 'plank', x: 1, y: 2 },
        },
        barriers: [{ orientation: 'H', x: 2, y: 1 }],
        flags: [{ id: 'goal', x: 5, y: 2, isGoal: true, order: 1, collected: true }],
        waterCells: [
          { x: 2, y: 2 },
          { x: 2, y: 3 },
        ],
        bridgedWaterCells: [{ x: 2, y: 2 }], // runtime bridge should not pollute authored water
        lockedGates: [
          {
            id: 'gate_a',
            x: 3,
            y: 2,
            shape: 'triangle',
            color: 'emerald',
            unlocked: true,
            unlockedByKey: true,
          },
          {
            id: 'gate_b',
            x: 4,
            y: 2,
            shape: 'diamond',
            color: 'purple',
            unlocked: true,
            linkedSwitchId: 'sw_1',
          },
        ],
        initialLockedGates: [
          { id: 'gate_a', x: 3, y: 2, shape: 'triangle', color: 'emerald', unlocked: false },
          {
            id: 'gate_b',
            x: 4,
            y: 2,
            shape: 'diamond',
            color: 'purple',
            unlocked: false,
            linkedSwitchId: 'sw_1',
          },
        ],
        floorSwitches: [
          { id: 'sw_1', x: 1, y: 4, linkedGateId: 'gate_b', requiredForGoal: false, active: true },
          { id: 'sw_goal', x: 3, y: 4, requiredForGoal: true, active: false },
        ],
        worldItems: [], // consumed at runtime!
        initialWorldItems: [
          { id: 'item_k', type: 'key', x: 1, y: 1, shape: 'triangle', color: 'emerald' },
          { id: 'item_p', type: 'plank', x: 1, y: 2 },
          { id: 'item_c', type: 'crate', x: 1, y: 3 },
        ],
        trace: [
          { x: 0, y: 2 },
          { x: 4, y: 2 },
        ],
        status: 'SUCCESS',
        showTrace: true,
      };

      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'PICK_UP' },
          { id: 'b2', type: 'MOVE_FWD' },
          { id: 'b3', type: 'USE_DROP' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(ws, 'grid', v2Grid);
      const rawBytes = base64URLToUint8Array(encoded);
      expect(rawBytes[1]).toBe(ENV_ID_GRID);
      expect(rawBytes[2]).toBe(ENV_VERSION_GRID_V2);

      const imported = importFromString(encoded);
      expect(imported.success).toBe(true);
      expect(imported.envVersion).toBe(ENV_VERSION_GRID_V2);

      const g = imported.gridState!;
      // Restored to clean initial authored pose & unconsumed items
      expect(g.robot.x).toBe(0);
      expect(g.robot.y).toBe(2);
      expect(g.robot.dir).toBe('EAST');
      expect(g.robot.carriedItem).toBeNull();
      expect(g.waterCells).toEqual([
        { x: 2, y: 2 },
        { x: 2, y: 3 },
      ]);
      expect(g.bridgedWaterCells).toEqual([]);
      expect(g.lockedGates).toHaveLength(2);
      expect(g.lockedGates![0]).toMatchObject({
        x: 3,
        y: 2,
        shape: 'triangle',
        color: 'emerald',
        unlocked: false,
      });
      expect(g.lockedGates![1]).toMatchObject({
        x: 4,
        y: 2,
        shape: 'diamond',
        color: 'purple',
        unlocked: false,
      });
      expect(g.floorSwitches).toHaveLength(2);
      expect(g.floorSwitches![0].linkedGateId).toBe(g.lockedGates![1].id);
      expect(g.floorSwitches![0].requiredForGoal).toBe(false);
      expect(g.floorSwitches![1].requiredForGoal).toBe(true);
      expect(g.worldItems).toHaveLength(3);
      expect(g.worldItems![0]).toMatchObject({
        type: 'key',
        x: 1,
        y: 1,
        shape: 'triangle',
        color: 'emerald',
      });
      expect(g.worldItems![1]).toMatchObject({ type: 'plank', x: 1, y: 2 });
      expect(g.worldItems![2]).toMatchObject({ type: 'crate', x: 1, y: 3 });

      // Large (>16x16) v2 grid roundtrip
      const largeV2: GridState = {
        width: 22,
        height: 20,
        robot: { x: 2, y: 18, dir: 'NORTH', initialX: 2, initialY: 18, initialDir: 'NORTH' },
        barriers: [],
        flags: [{ id: 'goal', x: 20, y: 19, isGoal: true, order: 1, collected: false }],
        waterCells: [{ x: 18, y: 19 }],
        lockedGates: [{ id: 'lg', x: 19, y: 19, shape: 'circle', color: 'amber', unlocked: false }],
        floorSwitches: [{ id: 'ls', x: 17, y: 18, requiredForGoal: true }],
        worldItems: [{ id: 'lk', type: 'key', x: 16, y: 18, shape: 'circle', color: 'amber' }],
        trace: [{ x: 2, y: 18 }],
        status: 'IDLE',
        showTrace: true,
      };
      const largeEncoded = exportToString(ws, 'grid', largeV2);
      const largeImported = importFromString(largeEncoded);
      expect(largeImported.success).toBe(true);
      expect(largeImported.gridState?.waterCells).toEqual([{ x: 18, y: 19 }]);
      expect(largeImported.gridState?.lockedGates?.[0]).toMatchObject({
        x: 19,
        y: 19,
        shape: 'circle',
        color: 'amber',
      });
      expect(largeImported.gridState?.floorSwitches?.[0]).toMatchObject({
        x: 17,
        y: 18,
        requiredForGoal: true,
      });
      expect(largeImported.gridState?.worldItems?.[0]).toMatchObject({
        type: 'key',
        x: 16,
        y: 18,
        shape: 'circle',
        color: 'amber',
      });
    });
  });
});
