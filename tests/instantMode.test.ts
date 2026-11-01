import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useAppStore,
  getInitialGridState,
  getInitialTurtleState,
  computeInstantSimulation,
} from '../src/store/useAppStore';
import { MAX_INSTANT_SIMULATION_STEPS } from '../src/engine/simulationRunner';
import { GridState, SimulationSpeed } from '../src/types';

describe('Instant Simulation Mode', () => {
  beforeEach(() => {
    // Reset store to known fresh state before each test
    const store = useAppStore.getState();
    store.reset();
    store.clearWorkspace();
    store.setSpeed(400);
    store.setSimEnvironment('grid');
    store.setLevel(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Speed Cycle and Helpers', () => {
    it('correctly cycles through speeds: 400 -> 200 -> 100 -> 50 -> instant -> 400', () => {
      const cycleNext = (current: SimulationSpeed): SimulationSpeed => {
        if (current === 400) return 200;
        if (current === 200) return 100;
        if (current === 100) return 50;
        if (current === 50) return 'instant';
        return 400;
      };

      let speed: SimulationSpeed = 400;
      speed = cycleNext(speed);
      expect(speed).toBe(200);
      speed = cycleNext(speed);
      expect(speed).toBe(100);
      speed = cycleNext(speed);
      expect(speed).toBe(50);
      speed = cycleNext(speed);
      expect(speed).toBe('instant');
      speed = cycleNext(speed);
      expect(speed).toBe(400);
    });

    it('tolerates 0 as instant in setSpeed', () => {
      useAppStore.getState().setSpeed(0);
      expect(useAppStore.getState().speed).toBe('instant');
    });

    it('getInitialGridState resets robot, flags, and trace while preserving barriers and dimensions', () => {
      const customGrid: GridState = {
        width: 6,
        height: 6,
        robot: {
          x: 4,
          y: 4,
          dir: 'SOUTH',
          initialX: 1,
          initialY: 2,
          initialDir: 'EAST',
        },
        barriers: [{ orientation: 'H', x: 2, y: 3 }],
        flags: [
          { id: 'f1', x: 3, y: 2, isGoal: false, order: 1, collected: true },
          { id: 'g1', x: 4, y: 2, isGoal: true, order: 2, collected: true },
        ],
        trace: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }],
        status: 'SUCCESS',
        showTrace: true,
        fitToView: true,
      };

      const initial = getInitialGridState(customGrid);
      expect(initial.robot.x).toBe(1);
      expect(initial.robot.y).toBe(2);
      expect(initial.robot.dir).toBe('EAST');
      expect(initial.flags.every((f) => !f.collected)).toBe(true);
      expect(initial.trace).toEqual([{ x: 1, y: 2 }]);
      expect(initial.status).toBe('IDLE');
      expect(initial.barriers).toEqual([{ orientation: 'H', x: 2, y: 3 }]);
      expect(initial.width).toBe(6);
      expect(initial.height).toBe(6);
    });

    it('getInitialTurtleState resets robot and paths', () => {
      const turtle = useAppStore.getState().turtleState;
      const modified = {
        ...turtle,
        robot: { x: 150, y: -200, heading: 90 },
        paths: [{ type: 'LINE' as const, fromX: 0, fromY: 0, toX: 150, toY: -200, color: '#000', width: 2 }],
        status: 'SUCCESS' as const,
      };

      const initial = getInitialTurtleState(modified);
      expect(initial.robot).toEqual({ x: 0, y: 0, heading: 0 });
      expect(initial.paths).toEqual([]);
      expect(initial.status).toBe('IDLE');
    });
  });

  describe('2. Automatic Execution on Program Mutations', () => {
    it('automatically executes simulation upon adding blocks in instant mode', () => {
      useAppStore.getState().setSpeed('instant');

      // Initially robot is at level 1 starting position
      const initialX = useAppStore.getState().grid.robot.x;
      const initialY = useAppStore.getState().grid.robot.y;

      // Add MOVE_FWD block
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');

      // Robot should have immediately moved forward without calling play() or step()
      const newRobot = useAppStore.getState().grid.robot;
      expect(newRobot.x).toBe(initialX + 1);
      expect(newRobot.y).toBe(initialY);
      expect(useAppStore.getState().grid.trace.length).toBeGreaterThan(1);
    });

    it('automatically re-evaluates when repeat count is updated', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 1);

      const blockId = useAppStore.getState().workspace.MAIN[0].id;
      const initialX = useAppStore.getState().grid.robot.initialX;

      // Update repeat count to 3
      useAppStore.getState().updateBlockRepeat('MAIN', blockId, 3);

      expect(useAppStore.getState().grid.robot.x).toBe(initialX + 3);
    });

    it('automatically re-evaluates when blocks are reordered', () => {
      useAppStore.getState().setSpeed('instant');
      const startX = useAppStore.getState().grid.robot.initialX;
      const startY = useAppStore.getState().grid.robot.initialY;

      // Add TURN_RIGHT then MOVE_FWD
      useAppStore.getState().addBlock('MAIN', 'TURN_RIGHT');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');

      // Since dir was EAST, turning right faces SOUTH, then move forward goes to (startX, startY + 1)
      expect(useAppStore.getState().grid.robot.x).toBe(startX);
      expect(useAppStore.getState().grid.robot.y).toBe(startY + 1);

      // Reorder so MOVE_FWD comes first, then TURN_RIGHT
      useAppStore.getState().reorderBlocks('MAIN', 1, 0);

      // MOVE_FWD faces EAST -> (startX + 1, startY), then TURN_RIGHT faces SOUTH
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 1);
      expect(useAppStore.getState().grid.robot.y).toBe(startY);
      expect(useAppStore.getState().grid.robot.dir).toBe('SOUTH');
    });

    it('automatically resets robot to initial position when block is removed or workspace cleared', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');
      const startX = useAppStore.getState().grid.robot.initialX;

      expect(useAppStore.getState().grid.robot.x).toBe(startX + 1);

      const blockId = useAppStore.getState().workspace.MAIN[0].id;
      useAppStore.getState().removeBlock('MAIN', blockId);

      expect(useAppStore.getState().grid.robot.x).toBe(startX);
      expect(useAppStore.getState().grid.trace).toEqual([{ x: startX, y: useAppStore.getState().grid.robot.initialY }]);

      // Add block again and test clearWorkspace
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 1);

      useAppStore.getState().clearWorkspace();
      expect(useAppStore.getState().grid.robot.x).toBe(startX);
      expect(useAppStore.getState().grid.status).toBe('IDLE');
    });

    it('halts execution gracefully and keeps robot at start when loop is unclosed', () => {
      useAppStore.getState().setSpeed('instant');
      const startX = useAppStore.getState().grid.robot.initialX;

      // Add unclosed LOOP_START
      useAppStore.getState().addBlock('MAIN', 'LOOP_START', 2);
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');

      // Should not run corrupted loop
      expect(useAppStore.getState().grid.robot.x).toBe(startX);

      // Add matching LOOP_END
      useAppStore.getState().addBlock('MAIN', 'LOOP_END');

      // Now it executes immediately: 2 iterations of MOVE_FWD = startX + 2
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 2);
    });

    it('automatically executes when solution is loaded', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().loadSolution(1);

      // Level 1 solution should result in SUCCESS status immediately
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
    });
  });

  describe('3. Automatic Execution on Map / Grid Mutations', () => {
    it('immediately detects collision when a wall is added in the robot path', () => {
      useAppStore.getState().setSpeed('instant');
      const startX = useAppStore.getState().grid.robot.initialX;
      const startY = useAppStore.getState().grid.robot.initialY;

      // Add MOVE_FWD
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 2);
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 2);
      expect(useAppStore.getState().grid.status).not.toBe('COLLISION');

      // Place a vertical wall between (startX, startY) and (startX + 1, startY)
      useAppStore.getState().addWall({ orientation: 'V', x: startX + 1, y: startY });

      // Immediate collision detection
      expect(useAppStore.getState().grid.status).toBe('COLLISION');
      expect(useAppStore.getState().grid.robot.x).toBe(startX);

      // Toggle wall off
      useAppStore.getState().toggleWall({ orientation: 'V', x: startX + 1, y: startY });
      expect(useAppStore.getState().grid.status).not.toBe('COLLISION');
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 2);
    });

    it('re-evaluates trajectory when robot starting position is changed', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 1);

      // Move robot starting point using editor tool
      useAppStore.getState().setEditorTool('ROBOT');
      useAppStore.getState().setCellContent(2, 2);

      expect(useAppStore.getState().grid.robot.initialX).toBe(2);
      expect(useAppStore.getState().grid.robot.initialY).toBe(2);
      // Robot should move 1 cell east from (2, 2) -> (3, 2)
      expect(useAppStore.getState().grid.robot.x).toBe(3);
      expect(useAppStore.getState().grid.robot.y).toBe(2);
    });

    it('re-evaluates flag collection and goal achievement when flags/goals are modified', () => {
      useAppStore.getState().setSpeed('instant');
      const startX = useAppStore.getState().grid.robot.initialX;
      const startY = useAppStore.getState().grid.robot.initialY;

      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 1);

      // Place a goal right at (startX + 1, startY)
      useAppStore.getState().setEditorTool('GOAL');
      useAppStore.getState().setCellContent(startX + 1, startY);

      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
    });

    it('re-evaluates simulation when level is changed', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 1);

      useAppStore.getState().setLevel(2);
      const l2StartX = useAppStore.getState().grid.robot.initialX;
      // Should have simulated 1 forward step on level 2
      expect(useAppStore.getState().grid.robot.x).toBe(l2StartX + 1);
    });
  });

  describe('4. Infinite Loop & Iteration Capping', () => {
    it('caps execution at MAX_INSTANT_SIMULATION_STEPS (400) without hanging', () => {
      useAppStore.getState().setSpeed('instant');

      // Create a large loop with in-place action (TURN_LEFT) that does not collide
      useAppStore.getState().addBlock('MAIN', 'LOOP_START', 9);
      useAppStore.getState().addBlock('MAIN', 'LOOP_START', 9);
      useAppStore.getState().addBlock('MAIN', 'LOOP_START', 9);
      useAppStore.getState().addBlock('MAIN', 'TURN_LEFT');
      useAppStore.getState().addBlock('MAIN', 'LOOP_END');
      useAppStore.getState().addBlock('MAIN', 'LOOP_END');
      useAppStore.getState().addBlock('MAIN', 'LOOP_END');

      const runtime = useAppStore.getState().runtime;
      expect(runtime).not.toBeNull();
      expect(runtime!.stepCount).toBe(MAX_INSTANT_SIMULATION_STEPS);
    });
  });

  describe('5. Timer and Execution Control', () => {
    it('does not start intervals in instant mode when play() is called', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      useAppStore.getState().setSpeed('instant');

      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD');
      useAppStore.getState().play();

      expect(useAppStore.getState().isPlaying).toBe(false);
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it('step() is a no-op in instant mode', () => {
      useAppStore.getState().setSpeed('instant');
      const startX = useAppStore.getState().grid.robot.initialX;

      useAppStore.getState().step();
      expect(useAppStore.getState().grid.robot.x).toBe(startX);
    });
  });

  describe('6. Switching Modes and Resetting State', () => {
    it('resets grid to initial state when switching from instant mode back to timed speed', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 2);

      const startX = useAppStore.getState().grid.robot.initialX;
      // In instant mode, robot is at startX + 2
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 2);

      // Switch back to 400 (1x)
      useAppStore.getState().setSpeed(400);

      // Robot should now be back at starting position, ready for manual Play/Step
      expect(useAppStore.getState().speed).toBe(400);
      expect(useAppStore.getState().grid.robot.x).toBe(startX);
      expect(useAppStore.getState().grid.status).toBe('IDLE');
    });

    it('calling reset() in instant mode returns robot to starting state', () => {
      useAppStore.getState().setSpeed('instant');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 2);

      const startX = useAppStore.getState().grid.robot.initialX;
      expect(useAppStore.getState().grid.robot.x).toBe(startX + 2);

      useAppStore.getState().reset();
      expect(useAppStore.getState().grid.robot.x).toBe(startX);
      expect(useAppStore.getState().grid.status).toBe('IDLE');
    });
  });

  describe('7. Turtle Mode Instant Simulation', () => {
    it('automatically simulates turtle movements in instant mode', () => {
      useAppStore.getState().setSimEnvironment('turtle');
      useAppStore.getState().setSpeed('instant');

      useAppStore.getState().addBlock('MAIN', 'FORWARD', 1, undefined, { distance: 50 });

      const turtleState = useAppStore.getState().turtleState;
      expect(turtleState.robot.y).toBe(-50);
      expect(turtleState.paths.length).toBe(1);
    });
  });
});
