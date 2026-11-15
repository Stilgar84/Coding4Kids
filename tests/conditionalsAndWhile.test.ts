import { describe, it, expect } from 'vitest';
import {
  writeConditionExpr,
  readConditionExpr,
  evaluateConditionExpr,
  COND_TAG_PATH_AHEAD,
  COND_TAG_TILE_COLOR,
  COND_TAG_ITEM_HERE,
  COND_TAG_NOT,
  COND_TAG_AND,
  COND_TAG_OR,
  COND_TAG_HELD_COLOR,
  COND_TAG_STATION_EMPTY,
} from '../src/engine/serialization/conditionSerializer';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import {
  exportToBinary,
  importFromBinary,
  exportToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateControlStructure,
  validateLoopStructure,
  findMatchingWhileEnd,
  findIfStructure,
} from '../src/engine/interpreter';
import {
  OP_IF,
  OP_ELSE,
  OP_END_IF,
  OP_WHILE,
  OP_END_WHILE,
  MASK_ELSE_HAS_COND,
} from '../src/engine/serialization/types';
import type { CodeBlock, WorkspaceState } from '../src/types';
import type { ConditionExpr } from '../src/data/curriculum/types';
import type { SimulationEnvironment, SimActionResult } from '../src/engine/simulation/types';

describe('Commit 21: Conditionals (IF, ELSE, ELSE_IF, WHILE) & Compound Booleans', () => {
  // =========================================================================
  // 1. ConditionExpr Binary Serialization & Deserialization
  // =========================================================================
  describe('ConditionExpr Prefix-Tree Encoding', () => {
    it('serializes and deserializes atomic sensors without parameters', () => {
      const expr: ConditionExpr = { kind: 'sensor', sensor: 'pathAhead' };
      const writer = new BinaryWriter();
      writeConditionExpr(writer, expr);
      const bytes = writer.getBytes();

      expect(bytes.length).toBe(1);
      expect(bytes[0]).toBe(COND_TAG_PATH_AHEAD);

      const reader = new BinaryReader(bytes);
      const decoded = readConditionExpr(reader);
      expect(decoded).toEqual({ kind: 'sensor', sensor: 'pathAhead' });
    });

    it('serializes and deserializes atomic sensors with color parameter (tileColor)', () => {
      const expr: ConditionExpr = { kind: 'sensor', sensor: 'tileColor', param: 'amber' };
      const writer = new BinaryWriter();
      writeConditionExpr(writer, expr);
      const bytes = writer.getBytes();

      expect(bytes.length).toBe(2);
      expect(bytes[0]).toBe(COND_TAG_TILE_COLOR);
      expect(bytes[1]).toBe(4); // 'amber' index = 4 in PALETTE_COLOR_NAMES

      const reader = new BinaryReader(bytes);
      const decoded = readConditionExpr(reader);
      expect(decoded).toEqual({ kind: 'sensor', sensor: 'tileColor', param: 'amber' });
    });

    it('serializes and deserializes Depot sensors with parameter (heldColor, stationEmpty)', () => {
      const expr: ConditionExpr = { kind: 'sensor', sensor: 'heldColor', param: 'blue' };
      const writer = new BinaryWriter();
      writeConditionExpr(writer, expr);
      const bytes = writer.getBytes();

      expect(bytes[0]).toBe(COND_TAG_HELD_COLOR);
      expect(bytes[1]).toBe(2); // 'blue' index = 2

      const reader = new BinaryReader(bytes);
      const decoded = readConditionExpr(reader);
      expect(decoded).toEqual({ kind: 'sensor', sensor: 'heldColor', param: 'blue' });

      // stationEmpty with QUEUE
      const qExpr: ConditionExpr = { kind: 'sensor', sensor: 'stationEmpty', param: 'QUEUE' };
      const qWriter = new BinaryWriter();
      writeConditionExpr(qWriter, qExpr);
      const qBytes = qWriter.getBytes();

      expect(qBytes[0]).toBe(COND_TAG_STATION_EMPTY);
      expect(qBytes[1]).toBe(4); // QUEUE = 4

      const qDecoded = readConditionExpr(new BinaryReader(qBytes));
      expect(qDecoded).toEqual({ kind: 'sensor', sensor: 'stationEmpty', param: 'QUEUE' });
    });

    it('serializes and deserializes compound booleans (NOT, AND, OR)', () => {
      // NOT (pathAhead)
      const notExpr: ConditionExpr = {
        kind: 'not',
        operand: { kind: 'sensor', sensor: 'pathAhead' },
      };
      const w1 = new BinaryWriter();
      writeConditionExpr(w1, notExpr);
      const b1 = w1.getBytes();
      expect(b1.length).toBe(2);
      expect(b1[0]).toBe(COND_TAG_NOT);
      expect(b1[1]).toBe(COND_TAG_PATH_AHEAD);
      expect(readConditionExpr(new BinaryReader(b1))).toEqual(notExpr);

      // (itemHere AND NOT carryingItem)
      const andExpr: ConditionExpr = {
        kind: 'and',
        left: { kind: 'sensor', sensor: 'itemHere' },
        right: {
          kind: 'not',
          operand: { kind: 'sensor', sensor: 'carryingItem' },
        },
      };
      const w2 = new BinaryWriter();
      writeConditionExpr(w2, andExpr);
      const b2 = w2.getBytes();
      expect(readConditionExpr(new BinaryReader(b2))).toEqual(andExpr);

      // (pathLeft OR pathRight)
      const orExpr: ConditionExpr = {
        kind: 'or',
        left: { kind: 'sensor', sensor: 'pathLeft' },
        right: { kind: 'sensor', sensor: 'pathRight' },
      };
      const w3 = new BinaryWriter();
      writeConditionExpr(w3, orExpr);
      const b3 = w3.getBytes();
      expect(readConditionExpr(new BinaryReader(b3))).toEqual(orExpr);
    });

    it('evaluates boolean expressions at runtime with evaluateConditionExpr', () => {
      const mockSensors: Record<string, boolean> = {
        pathAhead: true,
        itemHere: false,
        carryingItem: true,
      };
      const evalFn = (sensor: string, _state: any, _param?: string) => mockSensors[sensor] ?? false;

      // Simple
      expect(evaluateConditionExpr({ kind: 'sensor', sensor: 'pathAhead' }, null, evalFn)).toBe(true);
      expect(evaluateConditionExpr({ kind: 'sensor', sensor: 'itemHere' }, null, evalFn)).toBe(false);

      // NOT
      expect(evaluateConditionExpr({
        kind: 'not',
        operand: { kind: 'sensor', sensor: 'itemHere' },
      }, null, evalFn)).toBe(true);

      // AND
      expect(evaluateConditionExpr({
        kind: 'and',
        left: { kind: 'sensor', sensor: 'pathAhead' },
        right: { kind: 'sensor', sensor: 'carryingItem' },
      }, null, evalFn)).toBe(true);

      expect(evaluateConditionExpr({
        kind: 'and',
        left: { kind: 'sensor', sensor: 'pathAhead' },
        right: { kind: 'sensor', sensor: 'itemHere' },
      }, null, evalFn)).toBe(false);

      // OR
      expect(evaluateConditionExpr({
        kind: 'or',
        left: { kind: 'sensor', sensor: 'itemHere' },
        right: { kind: 'sensor', sensor: 'pathAhead' },
      }, null, evalFn)).toBe(true);
    });
  });

  // =========================================================================
  // 2. Strict Spec Byte-Budget Verification (§3.1.2)
  // =========================================================================
  describe('Binary Spec Byte-Budget Compliance', () => {
    it('verifies exact byte counts for IF, ELSE, ELSE_IF, WHILE, END_IF, END_WHILE', () => {
      // Plain ELSE = 1 byte (0x05)
      expect(OP_ELSE).toBe(0x05);

      // ELSE_IF = 1 byte header with MASK_ELSE_HAS_COND = 0x20 (0x25)
      expect(OP_ELSE | MASK_ELSE_HAS_COND).toBe(0x25);

      // END_IF = 1 byte (0x06)
      expect(OP_END_IF).toBe(0x06);

      // OP_WHILE = 0x0A
      expect(OP_WHILE).toBe(0x0a);

      // OP_END_WHILE = 0x0B
      expect(OP_END_WHILE).toBe(0x0b);

      // Spec §3.1.2: "IF (itemHere) = 2 bytes ([0x04, 0x04])"
      const ifItemHere: WorkspaceState = {
        MAIN: [
          {
            id: 'b1',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'itemHere' } },
          },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const ifBytes = exportToBinary(ifItemHere, 'generic');
      // [formatVersion=1, envId=0, envVersion=1, scopeCount=1, scopeId=0, blockCount=1, OP_IF=0x04, tag=0x04]
      // Block bytes alone:
      const blockBytes = ifBytes.slice(6);
      expect(blockBytes).toEqual(new Uint8Array([OP_IF, COND_TAG_ITEM_HERE]));
      expect(blockBytes.length).toBe(2);

      // Spec §3.1.2: "ELSE_IF ($heldColor == Blue) = 3 bytes ([0x25, 0x1B, 0x02])"
      const elseIfHeldBlue: WorkspaceState = {
        MAIN: [
          {
            id: 'b2',
            type: 'ELSE_IF',
            params: { condition: { kind: 'sensor', sensor: 'heldColor', param: 'blue' } },
          },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const elseIfBytes = exportToBinary(elseIfHeldBlue, 'generic').slice(6);
      expect(elseIfBytes).toEqual(new Uint8Array([0x25, COND_TAG_HELD_COLOR, 0x02]));
      expect(elseIfBytes.length).toBe(3);

      // Spec §3.1.2: "WHILE (NOT stationEmpty[Queue]) = 4 bytes ([0x0A, 0x20, 0x18, 0x04])"
      const whileNotQueue: WorkspaceState = {
        MAIN: [
          {
            id: 'b3',
            type: 'WHILE',
            params: {
              condition: {
                kind: 'not',
                operand: { kind: 'sensor', sensor: 'stationEmpty', param: 'QUEUE' },
              },
            },
          },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const whileBytes = exportToBinary(whileNotQueue, 'generic').slice(6);
      expect(whileBytes).toEqual(new Uint8Array([OP_WHILE, COND_TAG_NOT, COND_TAG_STATION_EMPTY, 0x04]));
      expect(whileBytes.length).toBe(4);
    });
  });

  // =========================================================================
  // 3. Round-Trip Binary Serialization (Workspace with Nested Controls)
  // =========================================================================
  describe('Round-Trip Binary Code Serialization', () => {
    it('round-trips IF / ELSE / END_IF structure losslessly', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_1',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'pathAhead' } },
          },
          { id: 'fwd_1', type: 'MOVE_FWD' },
          { id: 'else_1', type: 'ELSE' },
          { id: 'left_1', type: 'TURN_LEFT' },
          { id: 'endif_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const result = importFromString(encoded);

      expect(result.success).toBe(true);
      expect(result.workspace).toBeDefined();

      const mainBlocks = result.workspace!.MAIN;
      expect(mainBlocks.length).toBe(5);
      expect(mainBlocks[0].type).toBe('IF');
      expect(mainBlocks[0].params?.condition).toEqual({ kind: 'sensor', sensor: 'pathAhead' });
      expect(mainBlocks[1].type).toBe('MOVE_FWD');
      expect(mainBlocks[2].type).toBe('ELSE');
      expect(mainBlocks[3].type).toBe('TURN_LEFT');
      expect(mainBlocks[4].type).toBe('END_IF');
    });

    it('round-trips IF / ELSE_IF / ELSE / END_IF with compound conditions', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_1',
            type: 'IF',
            params: {
              condition: {
                kind: 'and',
                left: { kind: 'sensor', sensor: 'itemHere' },
                right: { kind: 'not', operand: { kind: 'sensor', sensor: 'carryingItem' } },
              },
            },
          },
          { id: 'pick_1', type: 'PICK_UP' },
          {
            id: 'elseif_1',
            type: 'ELSE_IF',
            params: {
              condition: { kind: 'sensor', sensor: 'tileColor', param: 'amber' },
            },
          },
          { id: 'turn_1', type: 'TURN_RIGHT' },
          { id: 'else_1', type: 'ELSE' },
          { id: 'back_1', type: 'MOVE_BACK' },
          { id: 'endif_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const result = importFromString(encoded);

      expect(result.success).toBe(true);
      const blocks = result.workspace!.MAIN;
      expect(blocks.length).toBe(7);

      expect(blocks[0].type).toBe('IF');
      expect(blocks[0].params?.condition).toEqual({
        kind: 'and',
        left: { kind: 'sensor', sensor: 'itemHere' },
        right: { kind: 'not', operand: { kind: 'sensor', sensor: 'carryingItem' } },
      });

      expect(blocks[2].type).toBe('ELSE_IF');
      expect(blocks[2].params?.condition).toEqual({
        kind: 'sensor',
        sensor: 'tileColor',
        param: 'amber',
      });

      expect(blocks[4].type).toBe('ELSE');
      expect(blocks[6].type).toBe('END_IF');
    });

    it('round-trips WHILE / END_WHILE and nested WHILE inside IF', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'while_1',
            type: 'WHILE',
            params: { condition: { kind: 'sensor', sensor: 'pathAhead' } },
          },
          {
            id: 'if_1',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'itemHere' } },
          },
          { id: 'pick_1', type: 'PICK_UP' },
          { id: 'endif_1', type: 'END_IF' },
          { id: 'fwd_1', type: 'MOVE_FWD' },
          { id: 'endwhile_1', type: 'END_WHILE' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const result = importFromString(encoded);

      expect(result.success).toBe(true);
      const blocks = result.workspace!.MAIN;
      expect(blocks.length).toBe(6);
      expect(blocks[0].type).toBe('WHILE');
      expect(blocks[1].type).toBe('IF');
      expect(blocks[2].type).toBe('PICK_UP');
      expect(blocks[3].type).toBe('END_IF');
      expect(blocks[4].type).toBe('MOVE_FWD');
      expect(blocks[5].type).toBe('END_WHILE');
    });

    it('round-trips nested IF within IF within ELSE', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_outer',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'pathAhead' } },
          },
          { id: 'a1', type: 'MOVE_FWD' },
          { id: 'else_outer', type: 'ELSE' },
          {
            id: 'if_inner',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'pathLeft' } },
          },
          { id: 'a2', type: 'TURN_LEFT' },
          { id: 'endif_inner', type: 'END_IF' },
          { id: 'endif_outer', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const result = importFromString(encoded);
      expect(result.success).toBe(true);
      expect(result.workspace!.MAIN.map((b) => b.type)).toEqual([
        'IF',
        'MOVE_FWD',
        'ELSE',
        'IF',
        'TURN_LEFT',
        'END_IF',
        'END_IF',
      ]);
    });
  });

  // =========================================================================
  // 4. Structural Validation (validateControlStructure / validateLoopStructure)
  // =========================================================================
  describe('Structural Validation', () => {
    it('validates correct nested IF / ELSE / WHILE structures', () => {
      const blocks: CodeBlock[] = [
        { id: '1', type: 'IF' },
        { id: '2', type: 'MOVE_FWD' },
        { id: '3', type: 'ELSE' },
        { id: '4', type: 'WHILE' },
        { id: '5', type: 'MOVE_FWD' },
        { id: '6', type: 'END_WHILE' },
        { id: '7', type: 'END_IF' },
      ];
      const res = validateControlStructure(blocks);
      expect(res.isValid).toBe(true);
      expect(res.hasError).toBe(false);
    });

    it('detects unclosed IF and orphan END_IF', () => {
      const unclosed: CodeBlock[] = [
        { id: 'if1', type: 'IF' },
        { id: 'm1', type: 'MOVE_FWD' },
      ];
      const res1 = validateControlStructure(unclosed);
      expect(res1.isValid).toBe(false);
      expect(res1.unclosedIfIds).toContain('if1');

      const orphan: CodeBlock[] = [
        { id: 'e1', type: 'END_IF' },
      ];
      const res2 = validateControlStructure(orphan);
      expect(res2.isValid).toBe(false);
      expect(res2.orphanEndIfIds).toContain('e1');
    });

    it('detects orphan ELSE and duplicate ELSE in same IF', () => {
      const orphanElse: CodeBlock[] = [
        { id: 'else1', type: 'ELSE' },
      ];
      expect(validateControlStructure(orphanElse).orphanElseIds).toContain('else1');

      const doubleElse: CodeBlock[] = [
        { id: 'if1', type: 'IF' },
        { id: 'else1', type: 'ELSE' },
        { id: 'else2', type: 'ELSE' },
        { id: 'endif1', type: 'END_IF' },
      ];
      const res = validateControlStructure(doubleElse);
      expect(res.isValid).toBe(false);
      expect(res.orphanElseIds).toContain('else2');
    });

    it('detects unclosed WHILE and orphan END_WHILE', () => {
      const unclosed: CodeBlock[] = [
        { id: 'w1', type: 'WHILE' },
        { id: 'm1', type: 'MOVE_FWD' },
      ];
      const res1 = validateControlStructure(unclosed);
      expect(res1.isValid).toBe(false);
      expect(res1.unclosedWhileIds).toContain('w1');

      const orphan: CodeBlock[] = [
        { id: 'ew1', type: 'END_WHILE' },
      ];
      const res2 = validateControlStructure(orphan);
      expect(res2.isValid).toBe(false);
      expect(res2.orphanEndWhileIds).toContain('ew1');
    });

    it('validateLoopStructure aliases validateControlStructure seamlessly', () => {
      const badWhile: CodeBlock[] = [{ id: 'w1', type: 'WHILE' }];
      expect(validateLoopStructure(badWhile).hasError).toBe(true);
    });
  });

  // =========================================================================
  // 5. Interpreter Execution
  // =========================================================================
  describe('Interpreter Execution (Lockstep Simulation)', () => {
    // Mock simulation environment tracking action calls
    interface MockState {
      x: number;
      actions: string[];
      sensors: Record<string, boolean>;
    }

    function createMockSimEnv(): SimulationEnvironment<MockState> {
      return {
        id: 'mock',
        name: 'Mock Simulation',
        icon: null,
        paletteItems: [],
        createInitialState: () => ({ x: 0, actions: [], sensors: {} }),
        resetState: (s) => ({ ...s, actions: [] }),
        executeAction: (type, state) => {
          return {
            nextState: { ...state, x: state.x + 1, actions: [...state.actions, type] },
            status: 'RUNNING',
            isSuccess: false,
            isCollision: false,
          };
        },
        evaluateSensor: (sensor, state) => {
          return state.sensors[sensor] ?? false;
        },
        Renderer: () => null,
      };
    }

    it('executes IF body when condition is true, skips when false', () => {
      const simEnv = createMockSimEnv();

      // Case 1: condition is TRUE
      const stateTrue: MockState = { x: 0, actions: [], sensors: { pathAhead: true } };
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_1',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'pathAhead' } },
          },
          { id: 'a1', type: 'MOVE_FWD' },
          { id: 'endif_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      let runtime = createInitialInterpreterState();
      let sim = stateTrue;
      let ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual(['MOVE_FWD']);

      // Case 2: condition is FALSE
      const stateFalse: MockState = { x: 0, actions: [], sensors: { pathAhead: false } };
      runtime = createInitialInterpreterState();
      sim = stateFalse;
      ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual([]); // Body skipped!
    });

    it('executes IF / ELSE branches correctly based on condition', () => {
      const simEnv = createMockSimEnv();
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_1',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'itemHere' } },
          },
          { id: 'a1', type: 'PICK_UP' },
          { id: 'else_1', type: 'ELSE' },
          { id: 'a2', type: 'MOVE_FWD' },
          { id: 'endif_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // Case 1: itemHere = true -> takes IF branch (PICK_UP)
      let sim: MockState = { x: 0, actions: [], sensors: { itemHere: true } };
      let runtime = createInitialInterpreterState();
      let ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual(['PICK_UP']);

      // Case 2: itemHere = false -> takes ELSE branch (MOVE_FWD)
      sim = { x: 0, actions: [], sensors: { itemHere: false } };
      runtime = createInitialInterpreterState();
      ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual(['MOVE_FWD']);
    });

    it('executes chained IF / ELSE_IF / ELSE correctly', () => {
      const simEnv = createMockSimEnv();
      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'if_1',
            type: 'IF',
            params: { condition: { kind: 'sensor', sensor: 'condA' } },
          },
          { id: 'a1', type: 'ACTION_A' },
          {
            id: 'elseif_1',
            type: 'ELSE_IF',
            params: { condition: { kind: 'sensor', sensor: 'condB' } },
          },
          { id: 'a2', type: 'ACTION_B' },
          { id: 'else_1', type: 'ELSE' },
          { id: 'a3', type: 'ACTION_DEFAULT' },
          { id: 'endif_1', type: 'END_IF' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // condA = false, condB = true -> takes ACTION_B
      let sim: MockState = { x: 0, actions: [], sensors: { condA: false, condB: true } };
      let runtime = createInitialInterpreterState();
      let ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual(['ACTION_B']);

      // condA = false, condB = false -> takes ACTION_DEFAULT
      sim = { x: 0, actions: [], sensors: { condA: false, condB: false } };
      runtime = createInitialInterpreterState();
      ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual(['ACTION_DEFAULT']);

      // condA = true, condB = true -> takes ACTION_A ONLY (short-circuits remaining)
      sim = { x: 0, actions: [], sensors: { condA: true, condB: true } };
      runtime = createInitialInterpreterState();
      ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }
      expect(sim.actions).toEqual(['ACTION_A']);
    });

    it('executes WHILE loops repeatedly while condition holds', () => {
      // Env where each step decrements remainingSteps until 0
      interface WhileState {
        remaining: number;
        actions: string[];
      }
      const simEnv: SimulationEnvironment<WhileState> = {
        id: 'while-sim',
        name: 'While Sim',
        icon: null,
        paletteItems: [],
        createInitialState: () => ({ remaining: 3, actions: [] }),
        resetState: (s) => ({ ...s, actions: [] }),
        executeAction: (type, state) => {
          return {
            nextState: { remaining: state.remaining - 1, actions: [...state.actions, type] },
            status: 'RUNNING',
          };
        },
        evaluateSensor: (_sensor, state) => state.remaining > 0,
        Renderer: () => null,
      };

      const workspace: WorkspaceState = {
        MAIN: [
          {
            id: 'while_1',
            type: 'WHILE',
            params: { condition: { kind: 'sensor', sensor: 'hasRemaining' } },
          },
          { id: 'fwd_1', type: 'MOVE_FWD' },
          { id: 'endwhile_1', type: 'END_WHILE' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      let sim: WhileState = { remaining: 3, actions: [] };
      let runtime = createInitialInterpreterState();
      let ticks = 0;
      while (!runtime.status || (runtime.status !== 'SUCCESS' && runtime.status !== 'COLLISION' && runtime.status !== 'IDLE')) {
        const res = tickInterpreter(runtime, workspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        ticks++;
        if (res.done || ticks > 50) break;
      }

      // Should have executed MOVE_FWD exactly 3 times!
      expect(sim.actions).toEqual(['MOVE_FWD', 'MOVE_FWD', 'MOVE_FWD']);
      expect(sim.remaining).toBe(0);
    });

    it('prevents infinite WHILE loops via MAX_TOTAL_STEPS = 10000', () => {
      const simEnv = createMockSimEnv();
      const infiniteWorkspace: WorkspaceState = {
        MAIN: [
          {
            id: 'while_inf',
            type: 'WHILE',
            params: { condition: { kind: 'sensor', sensor: 'alwaysTrue' } },
          },
          { id: 'step_1', type: 'STEP' },
          { id: 'endwhile_inf', type: 'END_WHILE' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      let sim: MockState = { x: 0, actions: [], sensors: { alwaysTrue: true } };
      let runtime = createInitialInterpreterState();
      let steps = 0;
      while (steps < 10005) {
        const res = tickInterpreter(runtime, infiniteWorkspace, sim, simEnv);
        runtime = res.nextRuntime;
        sim = res.nextGrid;
        steps++;
        if (res.done) break;
      }

      expect(runtime.status).toBe('STEP_LIMIT');
      expect(runtime.stepCount).toBeGreaterThanOrEqual(10000);
    });
  });
});
