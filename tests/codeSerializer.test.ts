import { describe, it, expect } from 'vitest';
import { BinaryWriter, uint8ArrayToBase64URL } from '../src/engine/serialization/binaryWriter';
import { BinaryReader, base64URLToUint8Array } from '../src/engine/serialization/binaryReader';
import {
  exportToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  FORMAT_VERSION,
  ENV_ID_GRID,
  ENV_ID_TURTLE,
  ENV_ID_GENERIC,
  TURTLE_COLOR_PALETTE,
} from '../src/engine/serialization/types';
import { GridState, WorkspaceState, Direction, WallEdge, FlagObjective } from '../src/types';
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
      expect(main).toHaveLength(10);

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
});
