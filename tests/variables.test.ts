import { describe, it, expect } from 'vitest';
import {
  toVariableName,
  isVariableName,
  ALL_VARIABLE_NAMES,
  VariableName,
  WorkspaceState,
  GridState,
} from '../src/types';
import {
  evaluateValue,
  evaluateBinaryOp,
  createInitialInterpreterState,
  tickInterpreter,
} from '../src/engine/interpreter';
import {
  exportToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { turtleSimulationEnvironment } from '../src/simulations/turtle/turtleEnvironment';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import { TurtleState } from '../src/simulations/turtle/types';

function createMockGrid(): GridState {
  return {
    width: 5,
    height: 5,
    robot: {
      x: 0,
      y: 0,
      dir: 'EAST',
      initialX: 0,
      initialY: 0,
      initialDir: 'EAST',
    },
    barriers: [],
    flags: [{ id: 'goal', x: 4, y: 0, isGoal: true, order: 1, collected: false }],
    trace: [{ x: 0, y: 0 }],
    status: 'IDLE',
    showTrace: true,
  };
}

describe('Variable Concept & Evaluation', () => {
  describe('Newtype typing & helpers', () => {
    it('toVariableName accepts single lowercase letters and trims/lowercases them', () => {
      expect(toVariableName('a')).toBe('a');
      expect(toVariableName('Z ')).toBe('z');
      expect(toVariableName(' m ')).toBe('m');
    });

    it('toVariableName rejects invalid or multi-char strings', () => {
      expect(() => toVariableName('')).toThrow(/Invalid variable name/);
      expect(() => toVariableName('1')).toThrow(/Invalid variable name/);
      expect(() => toVariableName('ab')).toThrow(/Invalid variable name/);
      expect(() => toVariableName('!')).toThrow(/Invalid variable name/);
    });

    it('isVariableName narrows types correctly', () => {
      expect(isVariableName('a')).toBe(true);
      expect(isVariableName('z')).toBe(true);
      expect(isVariableName('A')).toBe(false);
      expect(isVariableName('aa')).toBe(false);
      expect(isVariableName(42)).toBe(false);
      expect(isVariableName(null)).toBe(false);
      expect(isVariableName(undefined)).toBe(false);
    });

    it('ALL_VARIABLE_NAMES contains all 26 lowercase alphabet letters', () => {
      expect(ALL_VARIABLE_NAMES).toHaveLength(26);
      expect(ALL_VARIABLE_NAMES[0]).toBe('a');
      expect(ALL_VARIABLE_NAMES[25]).toBe('z');
    });
  });

  describe('evaluateValue and evaluateBinaryOp', () => {
    it('evaluates constant numbers and unassigned variables', () => {
      const vars: Record<string, number> = { a: 10, b: 3.14 };
      expect(evaluateValue(42, vars)).toBe(42);
      expect(evaluateValue('a', vars)).toBe(10);
      expect(evaluateValue('b', vars)).toBe(3.14);
      expect(evaluateValue('c', vars)).toBe(0); // Unassigned defaults to 0
      expect(evaluateValue(undefined, vars, 5)).toBe(5);
    });

    it('evaluates arithmetic binary operations', () => {
      expect(evaluateBinaryOp(10, '+', 5)).toBe(15);
      expect(evaluateBinaryOp(10, '-', 5)).toBe(5);
      expect(evaluateBinaryOp(10, '*', 5)).toBe(50);
      expect(evaluateBinaryOp(10, '/', 2)).toBe(5);
      expect(evaluateBinaryOp(10, '/', 0)).toBe(0); // Safe division by zero
      expect(evaluateBinaryOp(10, '%', 3)).toBe(1);
      expect(evaluateBinaryOp(10, '%', 0)).toBe(0);
    });

    it('evaluates comparison operators to 1.0 or 0.0', () => {
      expect(evaluateBinaryOp(10, '==', 10)).toBe(1);
      expect(evaluateBinaryOp(10, '==', 5)).toBe(0);
      expect(evaluateBinaryOp(10, '!=', 5)).toBe(1);
      expect(evaluateBinaryOp(10, '!=', 10)).toBe(0);
      expect(evaluateBinaryOp(5, '<', 10)).toBe(1);
      expect(evaluateBinaryOp(10, '<', 5)).toBe(0);
      expect(evaluateBinaryOp(10, '<=', 10)).toBe(1);
      expect(evaluateBinaryOp(10, '>', 5)).toBe(1);
      expect(evaluateBinaryOp(5, '>', 10)).toBe(0);
      expect(evaluateBinaryOp(10, '>=', 10)).toBe(1);
    });

    it('evaluates logical operators && and ||', () => {
      expect(evaluateBinaryOp(1, '&&', 1)).toBe(1);
      expect(evaluateBinaryOp(1, '&&', 0)).toBe(0);
      expect(evaluateBinaryOp(0, '&&', 0)).toBe(0);
      expect(evaluateBinaryOp(0, '||', 1)).toBe(1);
      expect(evaluateBinaryOp(0, '||', 0)).toBe(0);
      expect(evaluateBinaryOp(4.5, '&&', -2)).toBe(1); // Non-zero is truthy
    });
  });

  describe('Interpreter Execution of VAR_ASSIGN and VAR_OP', () => {
    it('executes VAR_ASSIGN with numbers and variables', () => {
      let grid = createMockGrid();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'a', b: 5.5 } },
          { id: '2', type: 'VAR_ASSIGN', params: { a: 'b', b: 'a' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // Tick 1: a = 5.5
      const res1 = tickInterpreter(runtime, workspace, grid);
      expect(res1.nextRuntime.variables['a' as VariableName]).toBe(5.5);
      expect(res1.nextRuntime.callStack[0].pc).toBe(1);

      // Tick 2: b = a
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid);
      expect(res2.nextRuntime.variables['b' as VariableName]).toBe(5.5);
      expect(res2.nextRuntime.callStack[0].pc).toBe(2);
    });

    it('executes VAR_OP and updates runtime variables', () => {
      let grid = createMockGrid();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'a', b: 10 } },
          { id: '2', type: 'VAR_OP', params: { a: 'c', b: 'a', op: '+', c: 5 } },
          { id: '3', type: 'VAR_OP', params: { a: 'd', b: 'c', op: '==', c: 15 } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const res1 = tickInterpreter(runtime, workspace, grid);
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid);
      expect(res2.nextRuntime.variables['c' as VariableName]).toBe(15);

      const res3 = tickInterpreter(res2.nextRuntime, workspace, res2.nextGrid);
      expect(res3.nextRuntime.variables['d' as VariableName]).toBe(1); // 1.0 (true)
    });
  });

  describe('Conditional & Loop Skip Semantics (repeatCount <= 0)', () => {
    it('LOOP_START jumps past LOOP_END when repeatCount is <= 0', () => {
      let grid = createMockGrid();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'c', b: 0 } },
          { id: '2', type: 'LOOP_START', repeatCount: 'c' as VariableName },
          { id: '3', type: 'MOVE_FWD' },
          { id: '4', type: 'LOOP_END' },
          { id: '5', type: 'MOVE_FWD' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // Step 1: Assign c = 0
      const res1 = tickInterpreter(runtime, workspace, grid);
      expect(res1.nextRuntime.variables['c' as VariableName]).toBe(0);
      expect(res1.nextRuntime.callStack[0].pc).toBe(1);

      // Step 2: LOOP_START (c = 0) -> Should jump directly to PC 4 (index 4 is block 5 'MOVE_FWD')
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid);
      expect(res2.nextRuntime.callStack[0].pc).toBe(4);
      expect(res2.nextGrid.robot.x).toBe(0); // Has not moved

      // Step 3: MOVE_FWD (block 5)
      const res3 = tickInterpreter(res2.nextRuntime, workspace, res2.nextGrid);
      expect(res3.nextGrid.robot.x).toBe(1);
    });

    it('LOOP_START executes exactly once when repeatCount is 1 (if-conditional behavior)', () => {
      let grid = createMockGrid();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'a', b: 1 } },
          { id: '2', type: 'LOOP_START', repeatCount: 'a' as VariableName },
          { id: '3', type: 'MOVE_FWD' },
          { id: '4', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const res1 = tickInterpreter(runtime, workspace, grid);
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid); // enter loop (iteration 1 of 1)
      expect(res2.nextRuntime.loopStack).toHaveLength(1);
      expect(res2.nextRuntime.loopStack[0].totalIterations).toBe(1);

      const res3 = tickInterpreter(res2.nextRuntime, workspace, res2.nextGrid); // execute MOVE_FWD
      expect(res3.nextGrid.robot.x).toBe(1);

      const res4 = tickInterpreter(res3.nextRuntime, workspace, res3.nextGrid); // LOOP_END pops loop
      expect(res4.nextRuntime.loopStack).toHaveLength(0);
      expect(res4.nextRuntime.callStack[0].pc).toBe(4);
    });

    it('Domain action blocks skip in 0 ticks when repeatCount <= 0', () => {
      let grid = createMockGrid();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'c', b: 0 } },
          { id: '2', type: 'MOVE_FWD', repeatCount: 'c' as VariableName },
          { id: '3', type: 'MOVE_FWD' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const res1 = tickInterpreter(runtime, workspace, grid); // c = 0
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid); // MOVE_FWD skipped!
      expect(res2.nextGrid.robot.x).toBe(0);
      expect(res2.nextRuntime.callStack[0].pc).toBe(2);

      const res3 = tickInterpreter(res2.nextRuntime, workspace, res2.nextGrid); // MOVE_FWD executed
      expect(res3.nextGrid.robot.x).toBe(1);
    });
  });

  describe('Numerical Action Parameters with Variables', () => {
    it('Turtle turn resolves angle parameter from variable', () => {
      const turtleState = createInitialTurtleState();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'a', b: 45 } },
          { id: '2', type: 'TURN_RIGHT', params: { angle: 'a' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const res1 = tickInterpreter(runtime, workspace, turtleState, turtleSimulationEnvironment);
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid, turtleSimulationEnvironment);
      const finalTurtle = res2.nextGrid as TurtleState;
      expect(finalTurtle.robot.heading).toBe(45);
    });

    it('Turtle arc resolves radius and angle from variables', () => {
      const turtleState = createInitialTurtleState();
      let runtime = createInitialInterpreterState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'r', b: 60 } },
          { id: '2', type: 'VAR_ASSIGN', params: { a: 'a', b: 90 } },
          { id: '3', type: 'ARC_RIGHT', params: { radius: 'r', angle: 'a' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const res1 = tickInterpreter(runtime, workspace, turtleState, turtleSimulationEnvironment);
      const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid, turtleSimulationEnvironment);
      const res3 = tickInterpreter(res2.nextRuntime, workspace, res2.nextGrid, turtleSimulationEnvironment);
      const finalTurtle = res3.nextGrid as TurtleState;
      expect(finalTurtle.robot.heading).toBe(90);
    });
  });

  describe('Binary Serialization with 2-Bits-Per-Param Mask', () => {
    it('roundtrips VAR_ASSIGN with variable, +int, -int, and double operands', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_ASSIGN', params: { a: 'a', b: 'b' } },       // Var
          { id: '2', type: 'VAR_ASSIGN', params: { a: 'x', b: 120 } },       // +Int
          { id: '3', type: 'VAR_ASSIGN', params: { a: 'y', b: -45 } },       // -Int
          { id: '4', type: 'VAR_ASSIGN', params: { a: 'z', b: 3.141592 } },  // Double
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const decoded = importFromString(encoded);

      expect(decoded.success).toBe(true);
      const mainBlocks = decoded.workspace!.MAIN;
      expect(mainBlocks).toHaveLength(4);

      expect(mainBlocks[0].type).toBe('VAR_ASSIGN');
      expect(mainBlocks[0].params).toEqual({ a: 'a', b: 'b' });

      expect(mainBlocks[1].type).toBe('VAR_ASSIGN');
      expect(mainBlocks[1].params).toEqual({ a: 'x', b: 120 });

      expect(mainBlocks[2].type).toBe('VAR_ASSIGN');
      expect(mainBlocks[2].params).toEqual({ a: 'y', b: -45 });

      expect(mainBlocks[3].type).toBe('VAR_ASSIGN');
      expect(mainBlocks[3].params?.a).toBe('z');
      expect(mainBlocks[3].params?.b).toBeCloseTo(3.141592, 5);
    });

    it('roundtrips VAR_OP across mixed operand types and operators', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'VAR_OP', params: { a: 'a', b: 'b', op: '+', c: 10 } },
          { id: '2', type: 'VAR_OP', params: { a: 'x', b: -5, op: '==', c: -5 } },
          { id: '3', type: 'VAR_OP', params: { a: 'y', b: 1.5, op: '*', c: 2.5 } },
          { id: '4', type: 'VAR_OP', params: { a: 'z', b: 'x', op: '&&', c: 'y' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'generic');
      const decoded = importFromString(encoded);

      expect(decoded.success).toBe(true);
      const mainBlocks = decoded.workspace!.MAIN;
      expect(mainBlocks).toHaveLength(4);

      expect(mainBlocks[0].params).toEqual({ a: 'a', b: 'b', op: '+', c: 10 });
      expect(mainBlocks[1].params).toEqual({ a: 'x', b: -5, op: '==', c: -5 });
      expect(mainBlocks[2].params?.a).toBe('y');
      expect(mainBlocks[2].params?.op).toBe('*');
      expect(mainBlocks[2].params?.b).toBeCloseTo(1.5, 5);
      expect(mainBlocks[2].params?.c).toBeCloseTo(2.5, 5);
      expect(mainBlocks[3].params).toEqual({ a: 'z', b: 'x', op: '&&', c: 'y' });
    });

    it('roundtrips standard blocks with bit 7 set and paramVarMask', () => {
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'FORWARD', repeatCount: 'n' as VariableName },
          { id: '2', type: 'TURN_LEFT', params: { angle: 'a' } },
          { id: '3', type: 'ARC_RIGHT', params: { radius: 'r', angle: 90 } },
          { id: '4', type: 'SET_PEN_WIDTH', params: { width: 'w' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'turtle');
      const decoded = importFromString(encoded);

      expect(decoded.success).toBe(true);
      const mainBlocks = decoded.workspace!.MAIN;
      expect(mainBlocks).toHaveLength(4);

      expect(mainBlocks[0].type).toBe('FORWARD');
      expect(mainBlocks[0].repeatCount).toBe('n');

      expect(mainBlocks[1].type).toBe('TURN_LEFT');
      expect(mainBlocks[1].params?.angle).toBe('a');

      expect(mainBlocks[2].type).toBe('ARC_RIGHT');
      expect(mainBlocks[2].params?.radius).toBe('r');
      expect(mainBlocks[2].params?.angle).toBe(90);

      expect(mainBlocks[3].type).toBe('SET_PEN_WIDTH');
      expect(mainBlocks[3].params?.width).toBe('w');
    });

    it('continues to decode legacy serialized programs without variables', () => {
      // Legacy code with FORWARD (rep=3), TURN_LEFT (angle=90), LOOP_START (rep=2)
      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'FORWARD', repeatCount: 3 },
          { id: '2', type: 'TURN_LEFT', params: { angle: 90 } },
          { id: '3', type: 'LOOP_START', repeatCount: 2 },
          { id: '4', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const encoded = exportToString(workspace, 'turtle');
      const decoded = importFromString(encoded);

      expect(decoded.success).toBe(true);
      const mainBlocks = decoded.workspace!.MAIN;
      expect(mainBlocks).toHaveLength(4);
      expect(mainBlocks[0].repeatCount).toBe(3);
      expect(mainBlocks[1].params?.angle).toBe(90);
      expect(mainBlocks[2].repeatCount).toBe(2);
    });
  });
});
