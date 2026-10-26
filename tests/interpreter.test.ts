import { describe, it, expect } from 'vitest';
import {
  createInitialInterpreterState,
  tickInterpreter,
  findMatchingLoopEnd,
  validateLoopStructure,
} from '../src/engine/interpreter';
import { GridState, WorkspaceState, CodeBlock } from '../src/types';
import { useAppStore } from '../src/store/useAppStore';

function createMockGrid(overrides?: Partial<GridState>): GridState {
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
    flags: [{ id: 'goal', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
    trace: [{ x: 0, y: 0 }],
    status: 'IDLE',
    showTrace: true,
    ...overrides,
  };
}

describe('Lockstep Interpreter & Physics Engine', () => {
  it('correctly matches loop start and end', () => {
    const blocks = [
      { id: '1', type: 'MOVE_FWD' as const },
      { id: '2', type: 'LOOP_START' as const },
      { id: '3', type: 'MOVE_FWD' as const },
      { id: '4', type: 'LOOP_END' as const },
    ];
    expect(findMatchingLoopEnd(blocks, 1)).toBe(3);
  });

  it('validates balanced and unclosed loop structures', () => {
    const validBlocks: CodeBlock[] = [
      { id: 'l1', type: 'LOOP_START' },
      { id: 'm1', type: 'MOVE_FWD' },
      { id: 'l2', type: 'LOOP_END' },
    ];
    const validResult = validateLoopStructure(validBlocks);
    expect(validResult.isValid).toBe(true);
    expect(validResult.hasError).toBe(false);
    expect(validResult.unclosedLoopStartIds).toHaveLength(0);
    expect(validResult.orphanLoopEndIds).toHaveLength(0);

    const unclosedStart: CodeBlock[] = [
      { id: 'l1', type: 'LOOP_START' },
      { id: 'm1', type: 'MOVE_FWD' },
    ];
    const unclosedResult = validateLoopStructure(unclosedStart);
    expect(unclosedResult.isValid).toBe(false);
    expect(unclosedResult.hasError).toBe(true);
    expect(unclosedResult.unclosedLoopStartIds).toEqual(['l1']);
    expect(unclosedResult.orphanLoopEndIds).toHaveLength(0);

    const orphanEnd: CodeBlock[] = [
      { id: 'm1', type: 'MOVE_FWD' },
      { id: 'l2', type: 'LOOP_END' },
    ];
    const orphanResult = validateLoopStructure(orphanEnd);
    expect(orphanResult.isValid).toBe(false);
    expect(orphanResult.hasError).toBe(true);
    expect(orphanResult.orphanLoopEndIds).toEqual(['l2']);
  });

  it('executes a single step forward and updates robot position', () => {
    let grid = createMockGrid();
    let runtime = createInitialInterpreterState();
    const workspace: WorkspaceState = {
      MAIN: [{ id: 'b1', type: 'MOVE_FWD' }],
      F1: [],
      F2: [],
      F3: [],
    };

    const res = tickInterpreter(runtime, workspace, grid);
    expect(res.nextGrid.robot.x).toBe(1);
    expect(res.nextGrid.robot.y).toBe(0);
    expect(res.nextRuntime.activeBlockId).toBe('b1');
  });

  it('handles number multiplier badges step-by-step and tracks activeRepeatProgress', () => {
    let grid = createMockGrid();
    let runtime = createInitialInterpreterState();
    const workspace: WorkspaceState = {
      MAIN: [{ id: 'b1', type: 'MOVE_FWD', repeatCount: 2 }],
      F1: [],
      F2: [],
      F3: [],
    };

    // Tick 1
    const res1 = tickInterpreter(runtime, workspace, grid);
    expect(res1.nextGrid.robot.x).toBe(1);
    expect(res1.nextRuntime.callStack[0].pc).toBe(0); // Still on block b1
    expect(res1.nextRuntime.activeRepeatProgress).toEqual({
      blockId: 'b1',
      current: 1,
      total: 2,
    });

    // Tick 2 (reaches goal at x: 2)
    const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid);
    expect(res2.nextGrid.robot.x).toBe(2);
    expect(res2.nextGrid.status).toBe('SUCCESS');
    expect(res2.nextRuntime.activeRepeatProgress).toEqual({
      blockId: 'b1',
      current: 2,
      total: 2,
    });
  });

  it('stops with COLLISION when hitting a wall barrier', () => {
    // Barrier between (0, 0) and (1, 0): Vertical wall at x: 1, y: 0
    let grid = createMockGrid({
      barriers: [{ orientation: 'V', x: 1, y: 0 }],
    });
    let runtime = createInitialInterpreterState();
    const workspace: WorkspaceState = {
      MAIN: [{ id: 'b1', type: 'MOVE_FWD' }],
      F1: [],
      F2: [],
      F3: [],
    };

    const res = tickInterpreter(runtime, workspace, grid);
    expect(res.nextGrid.status).toBe('COLLISION');
    expect(res.nextRuntime.status).toBe('COLLISION');
    expect(res.nextGrid.robot.x).toBe(0); // Did not pass barrier
  });

  it('executes loops accurately tracking loopStack iterations', () => {
    let grid = createMockGrid({
      robot: { x: 0, y: 0, dir: 'SOUTH', initialX: 0, initialY: 0, initialDir: 'SOUTH' },
    });
    let runtime = createInitialInterpreterState();
    const workspace: WorkspaceState = {
      MAIN: [
        { id: 'l1', type: 'LOOP_START', repeatCount: 3 },
        { id: 'm1', type: 'MOVE_FWD' },
        { id: 'l2', type: 'LOOP_END' },
      ],
      F1: [],
      F2: [],
      F3: [],
    };

    // First tick enters LOOP_START: loopStack pushed with currentIteration 1, totalIterations 3
    const res1 = tickInterpreter(runtime, workspace, grid);
    expect(res1.nextRuntime.loopStack).toHaveLength(1);
    expect(res1.nextRuntime.loopStack[0].currentIteration).toBe(1);
    expect(res1.nextRuntime.loopStack[0].totalIterations).toBe(3);

    runtime = res1.nextRuntime;
    grid = res1.nextGrid;

    // Run until completion or max 15 steps
    let steps = 0;
    while (!runtime.status || (runtime.status === 'RUNNING' && steps < 15)) {
      const res = tickInterpreter(runtime, workspace, grid);
      runtime = res.nextRuntime;
      grid = res.nextGrid;
      steps++;
      if (res.done) break;
    }

    // Moved forward 3 times southwards: y should be 3
    expect(grid.robot.y).toBe(3);
  });

  it('calls Function 1 and resumes Main execution on return', () => {
    let grid = createMockGrid();
    let runtime = createInitialInterpreterState();
    const workspace: WorkspaceState = {
      MAIN: [
        { id: 'c1', type: 'CALL_F1' },
        { id: 'm_turn', type: 'TURN_RIGHT' },
      ],
      F1: [{ id: 'f1_move', type: 'MOVE_FWD' }],
      F2: [],
      F3: [],
    };

    // Step 1: Call F1
    const res1 = tickInterpreter(runtime, workspace, grid);
    expect(res1.nextRuntime.activeScope).toBe('F1');

    // Step 2: In F1, move fwd
    const res2 = tickInterpreter(res1.nextRuntime, workspace, res1.nextGrid);
    expect(res2.nextGrid.robot.x).toBe(1);

    // Step 3: F1 finished, pops frame, executes TURN_RIGHT in MAIN
    const res3 = tickInterpreter(res2.nextRuntime, workspace, res2.nextGrid);
    expect(res3.nextGrid.robot.dir).toBe('SOUTH');
  });

  it('resizes board in all 4 directions with correct coordinate shifting', () => {
    const store = useAppStore.getState();
    store.setLevel(1); // 5x5 board, robot at (0, 2)

    // Resize RIGHT (+1)
    store.resizeBoard('RIGHT', 1);
    expect(useAppStore.getState().grid.width).toBe(6);
    expect(useAppStore.getState().grid.robot.x).toBe(0);

    // Resize BOTTOM (+1)
    store.resizeBoard('BOTTOM', 1);
    expect(useAppStore.getState().grid.height).toBe(6);
    expect(useAppStore.getState().grid.robot.y).toBe(2);

    // Resize LEFT (+1) -> shifts robot x by +1
    store.resizeBoard('LEFT', 1);
    expect(useAppStore.getState().grid.width).toBe(7);
    expect(useAppStore.getState().grid.robot.x).toBe(1);

    // Resize TOP (+1) -> shifts robot y by +1
    store.resizeBoard('TOP', 1);
    expect(useAppStore.getState().grid.height).toBe(7);
    expect(useAppStore.getState().grid.robot.y).toBe(3);
  });

  it('adds barriers idempotently with addWall', () => {
    const store = useAppStore.getState();
    store.clearGridUserCustoms();

    store.addWall({ orientation: 'H', x: 1, y: 1 });
    const count1 = useAppStore.getState().grid.barriers.length;

    // Adding same wall again should not duplicate
    store.addWall({ orientation: 'H', x: 1, y: 1 });
    const count2 = useAppStore.getState().grid.barriers.length;
    expect(count2).toBe(count1);
  });

  it('auto-resets when play is called after program ended with success or collision', () => {
    const store = useAppStore.getState();
    store.setLevel(1);

    // Simulate collision state
    useAppStore.setState({
      grid: {
        ...useAppStore.getState().grid,
        status: 'COLLISION',
        robot: { ...useAppStore.getState().grid.robot, x: 4, y: 4 },
      },
    });

    // Calling play should reset before stepping
    store.play();
    store.pause(); // immediately pause

    // Robot should not be at (4, 4), it should have been reset to initial (0, 2) and stepped
    expect(useAppStore.getState().grid.robot.initialX).toBe(0);
    expect(useAppStore.getState().grid.robot.initialY).toBe(2);
  });

  it('executes parameterized turtle actions via decoupled interpreter', () => {
    const store = useAppStore.getState();
    store.setSimEnvironment('turtle');
    store.clearWorkspace();

    // Add FORWARD, TURN_RIGHT (30° with multiplier 3 -> 90°), and SET_PEN_COLOR (red)
    store.addBlock('MAIN', 'FORWARD');
    store.addBlock('MAIN', 'TURN_RIGHT', 3, undefined, { angle: 30 });
    store.addBlock('MAIN', 'SET_PEN_COLOR', undefined, undefined, { color: '#ef4444' });

    // Step 1: Forward
    store.step();
    expect(useAppStore.getState().turtleState.robot.y).toBeCloseTo(-50);
    expect(useAppStore.getState().turtleState.paths).toHaveLength(1);

    // Step 2, 3, 4: Turn right 30° three times (total 90°)
    store.step();
    expect(useAppStore.getState().turtleState.robot.heading).toBe(30);
    store.step();
    expect(useAppStore.getState().turtleState.robot.heading).toBe(60);
    store.step();
    expect(useAppStore.getState().turtleState.robot.heading).toBe(90);

    // Step 5: Set pen color to Red
    store.step();
    expect(useAppStore.getState().turtleState.penColor).toBe('#ef4444');
  });
});
