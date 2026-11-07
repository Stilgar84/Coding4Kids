import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BASE_LINEAR_SPEED,
  BASE_ANGULAR_SPEED,
  getSpeedMultiplier,
  calculateLinearDuration,
  calculateArcDuration,
  calculateAngularDuration,
  getArcCenter,
  getArcProgressPose,
  getLineProgressPose,
  getTurnProgressPose,
  createTurtleAnimation,
  interpolateAnimationPose,
  isTurtleMotionAction,
} from '../src/simulations/turtle/physics';
import { useAppStore } from '../src/store/useAppStore';
import { TurtlePose } from '../src/simulations/turtle/types';

describe('Constant-Speed Turtle Drawing Animation', () => {
  describe('1. Speed & Duration Physics', () => {
    it('calculates speed multipliers for standard speeds', () => {
      expect(getSpeedMultiplier(400)).toBe(1); // 1x
      expect(getSpeedMultiplier(100)).toBe(4); // 4x
      expect(getSpeedMultiplier(25)).toBe(16); // 16x
      expect(getSpeedMultiplier('instant')).toBe(Infinity);
      expect(getSpeedMultiplier(0)).toBe(Infinity);
    });

    it('calculates linear duration with constant linear speed V = 200 px/s at 1x', () => {
      // 50px line at 1x (400ms speed setting): takes 250ms
      expect(calculateLinearDuration(50, 400)).toBeCloseTo(250);

      // 100px line takes exactly twice as long as 50px line
      expect(calculateLinearDuration(100, 400)).toBeCloseTo(500);
      expect(calculateLinearDuration(100, 400)).toBe(calculateLinearDuration(50, 400) * 2);

      // Speeds scale proportionally:
      // 4x speed (100): 4x faster -> 62.5ms for 50px
      expect(calculateLinearDuration(50, 100)).toBeCloseTo(62.5);

      // 16x speed (25): 16x faster -> 15.625ms for 50px
      expect(calculateLinearDuration(50, 25)).toBeCloseTo(15.625);

      // Instant mode is 0ms
      expect(calculateLinearDuration(50, 'instant')).toBe(0);
      expect(calculateLinearDuration(0, 400)).toBe(0);
    });

    it('calculates angular duration with constant angular speed Omega = 360 deg/s at 1x', () => {
      // 90° turn at 1x: takes 250ms
      expect(calculateAngularDuration(90, 400)).toBeCloseTo(250);

      // 180° turn takes exactly twice as long as 90° turn
      expect(calculateAngularDuration(180, 400)).toBeCloseTo(500);
      expect(calculateAngularDuration(180, 400)).toBe(calculateAngularDuration(90, 400) * 2);

      // 4x speed (100): 4x faster -> 62.5ms for 90°
      expect(calculateAngularDuration(90, 100)).toBeCloseTo(62.5);

      // 16x speed (25): 16x faster -> 15.625ms for 90°
      expect(calculateAngularDuration(90, 25)).toBeCloseTo(15.625);

      // Instant mode is 0ms
      expect(calculateAngularDuration(90, 'instant')).toBe(0);
      expect(calculateAngularDuration(0, 400)).toBe(0);
    });

    it('calculates circular arc duration along perimeter with constant linear speed', () => {
      // L = R * theta_rad
      // For R=50, sweep=90°: L = 50 * (pi / 2) = 78.5398 px
      // At 1x (200 px/s): duration = (78.5398 / 200) * 1000 = 392.699 ms
      const d1 = calculateArcDuration(50, 90, 400);
      expect(d1).toBeCloseTo(392.7, 1);

      // An arc of length 150px takes twice as long as an arc of length 75px
      // Since L = R * sweep, doubling radius doubles perimeter
      const d2 = calculateArcDuration(100, 90, 400);
      expect(d2).toBeCloseTo(d1 * 2, 4);

      // Doubling sweep angle also doubles perimeter
      const d3 = calculateArcDuration(50, 180, 400);
      expect(d3).toBeCloseTo(d1 * 2, 4);

      // Instant mode is 0ms
      expect(calculateArcDuration(50, 90, 'instant')).toBe(0);
    });
  });

  describe('2. Geometry & Interpolation Helpers', () => {
    it('computes exact arc center for right and left arcs', () => {
      // Facing North (0) at (0, 0):
      // Turning right: center is to the East at (50, 0)
      const centerRight = getArcCenter(0, 0, 0, 50, true);
      expect(centerRight.cx).toBeCloseTo(50);
      expect(centerRight.cy).toBeCloseTo(0);

      // Turning left: center is to the West at (-50, 0)
      const centerLeft = getArcCenter(0, 0, 0, 50, false);
      expect(centerLeft.cx).toBeCloseTo(-50);
      expect(centerLeft.cy).toBeCloseTo(0);
    });

    it('interpolates line traversal smoothly at progress p in [0, 1]', () => {
      const fromPose: TurtlePose = { x: 0, y: 0, heading: 0 };
      const toPose: TurtlePose = { x: 0, y: -100, heading: 0 };

      // At start (p = 0)
      const p0 = getLineProgressPose(fromPose, toPose, 0);
      expect(p0.x).toBeCloseTo(0);
      expect(p0.y).toBeCloseTo(0);
      expect(p0.heading).toBe(0);

      // At midpoint (p = 0.5)
      const pMid = getLineProgressPose(fromPose, toPose, 0.5);
      expect(pMid.x).toBeCloseTo(0);
      expect(pMid.y).toBeCloseTo(-50);
      expect(pMid.heading).toBe(0);

      // At end (p = 1)
      const p1 = getLineProgressPose(fromPose, toPose, 1);
      expect(p1.x).toBeCloseTo(0);
      expect(p1.y).toBeCloseTo(-100);
      expect(p1.heading).toBe(0);
    });

    it('interpolates arc traversal smoothly and maintains tangential heading', () => {
      const fromPose: TurtlePose = { x: 0, y: 0, heading: 0 };
      const radius = 50;
      const sweepAngle = 90; // Right 90 deg arc

      // At start (p = 0)
      const p0 = getArcProgressPose(fromPose, radius, sweepAngle, 0);
      expect(p0.x).toBeCloseTo(0);
      expect(p0.y).toBeCloseTo(0);
      expect(p0.heading).toBe(0);
      expect(p0.currentSweep).toBe(0);

      // At midpoint (p = 0.5)
      const pMid = getArcProgressPose(fromPose, radius, sweepAngle, 0.5);
      expect(pMid.heading).toBe(45);
      expect(pMid.currentSweep).toBe(45);
      // Distance from center (50, 0) to (pMid.x, pMid.y) should be exactly radius 50
      const distToCenter = Math.hypot(pMid.x - 50, pMid.y - 0);
      expect(distToCenter).toBeCloseTo(50, 2);

      // At end (p = 1)
      const p1 = getArcProgressPose(fromPose, radius, sweepAngle, 1);
      expect(p1.x).toBeCloseTo(50);
      expect(p1.y).toBeCloseTo(-50);
      expect(p1.heading).toBe(90);
      expect(p1.currentSweep).toBe(90);
    });

    it('interpolates in-place rotation with proper direction', () => {
      const fromPose: TurtlePose = { x: 10, y: 20, heading: 0 };

      // Turn left 90° (-90°)
      const pLeftHalf = getTurnProgressPose(fromPose, -90, 0.5);
      expect(pLeftHalf.heading).toBe(315); // -45 normalized
      expect(pLeftHalf.x).toBe(10);
      expect(pLeftHalf.y).toBe(20);

      const pLeftFull = getTurnProgressPose(fromPose, -90, 1);
      expect(pLeftFull.heading).toBe(270);

      // Turn right 90° (+90°)
      const pRightFull = getTurnProgressPose(fromPose, 90, 1);
      expect(pRightFull.heading).toBe(90);
    });

    it('identifies motion actions correctly', () => {
      expect(isTurtleMotionAction('FORWARD')).toBe(true);
      expect(isTurtleMotionAction('MOVE_FWD')).toBe(true);
      expect(isTurtleMotionAction('BACKWARD')).toBe(true);
      expect(isTurtleMotionAction('MOVE_BACK')).toBe(true);
      expect(isTurtleMotionAction('TURN_LEFT')).toBe(true);
      expect(isTurtleMotionAction('TURN_RIGHT')).toBe(true);
      expect(isTurtleMotionAction('ARC_LEFT')).toBe(true);
      expect(isTurtleMotionAction('ARC_RIGHT')).toBe(true);

      // Non-motion
      expect(isTurtleMotionAction('PEN_UP')).toBe(false);
      expect(isTurtleMotionAction('PEN_DOWN')).toBe(false);
      expect(isTurtleMotionAction('SET_PEN_COLOR')).toBe(false);
      expect(isTurtleMotionAction('SET_PEN_WIDTH')).toBe(false);
      expect(isTurtleMotionAction('LOOP_START')).toBe(false);
      expect(isTurtleMotionAction('LOOP_END')).toBe(false);
      expect(isTurtleMotionAction('VAR_ASSIGN')).toBe(false);
    });
  });

  describe('3. Animation Execution & Store Interaction', () => {
    let originalRAF: any;
    let originalCAF: any;
    let rafCallbacks: ((timestamp: number) => void)[] = [];

    beforeEach(() => {
      const store = useAppStore.getState();
      store.reset();
      store.clearWorkspace();
      store.setSimEnvironment('turtle');
      store.setSpeed(400);

      rafCallbacks = [];
      originalRAF = (globalThis as any).requestAnimationFrame;
      originalCAF = (globalThis as any).cancelAnimationFrame;

      (globalThis as any).requestAnimationFrame = vi.fn((cb: (t: number) => void) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

      (globalThis as any).cancelAnimationFrame = vi.fn((id: number) => {
        rafCallbacks = [];
      });
    });

    afterEach(() => {
      (globalThis as any).requestAnimationFrame = originalRAF;
      (globalThis as any).cancelAnimationFrame = originalCAF;
      vi.restoreAllMocks();
    });

    it('steps a forward motion with active animation and does not pre-draw the path', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'FORWARD'); // 50px line, 250ms at 1x

      store.step();

      // Right after step(): activeAnimation must exist
      const state1 = useAppStore.getState().turtleState;
      expect(state1.activeAnimation).toBeDefined();
      expect(state1.activeAnimation?.type).toBe('LINE');
      expect(state1.activeAnimation?.progress).toBe(0);
      expect(state1.activeAnimation?.duration).toBeCloseTo(250);

      // Crucial: paths must NOT contain the incomplete line yet!
      expect(state1.paths).toHaveLength(0);

      // Advance frame halfway (125ms out of 250ms)
      expect(rafCallbacks.length).toBeGreaterThan(0);
      const cb = rafCallbacks.pop()!;
      const startTime = state1.activeAnimation!.startTime;
      cb(startTime + 125);

      const state2 = useAppStore.getState().turtleState;
      expect(state2.activeAnimation).toBeDefined();
      expect(state2.activeAnimation?.progress).toBeCloseTo(0.5);
      expect(state2.activeAnimation?.currentPose.y).toBeCloseTo(-25);
      // Path still not committed to completed paths
      expect(state2.paths).toHaveLength(0);

      // Advance frame to completion (250ms)
      expect(rafCallbacks.length).toBeGreaterThan(0);
      const cb2 = rafCallbacks.pop()!;
      cb2(startTime + 250);

      // Now the step has halted, path committed, activeAnimation cleared
      const state3 = useAppStore.getState().turtleState;
      expect(state3.activeAnimation).toBeNull();
      expect(state3.paths).toHaveLength(1);
      expect(state3.paths[0].type).toBe('LINE');
      expect(state3.robot.y).toBeCloseTo(-50);
      expect(useAppStore.getState().isPlaying).toBe(false);
    });

    it('executes consecutive non-motion blocks instantaneously before motion block', () => {
      const store = useAppStore.getState();
      // Add non-motion blocks followed by a motion block
      store.addBlock('MAIN', 'SET_PEN_COLOR', undefined, undefined, { color: '#ef4444' });
      store.addBlock('MAIN', 'SET_PEN_WIDTH', undefined, undefined, { width: 12 });
      store.addBlock('MAIN', 'PEN_UP');
      store.addBlock('MAIN', 'PEN_DOWN');
      store.addBlock('MAIN', 'FORWARD');

      store.step();

      // All 4 non-motion blocks must have executed instantaneously in 0ms,
      // and FORWARD is the active motion block
      const state = useAppStore.getState().turtleState;
      expect(state.penColor).toBe('#ef4444');
      expect(state.penWidth).toBe(12);
      expect(state.penDown).toBe(true);
      expect(state.activeAnimation).toBeDefined();
      expect(state.activeAnimation?.type).toBe('LINE');
    });

    it('supports pause and resume mid-animation without position jumping', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'FORWARD'); // 50px line, 250ms

      store.play();

      const startTime = useAppStore.getState().turtleState.activeAnimation!.startTime;

      // Tick to 40% progress (100ms)
      const cb = rafCallbacks.pop()!;
      cb(startTime + 100);

      expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.4);

      // Pause
      store.pause();
      expect(useAppStore.getState().isPlaying).toBe(false);
      // Progress remains preserved at 0.4
      expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.4);

      // Resume
      store.play();
      expect(useAppStore.getState().isPlaying).toBe(true);

      // Tick another 75ms from the resumed time -> should advance from 0.4 without jumping to 0
      const resumedAnim = useAppStore.getState().turtleState.activeAnimation!;
      const cb2 = rafCallbacks.pop()!;
      cb2(resumedAnim.startTime + 175);

      expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.7);
    });

    it('dynamically scales animation duration when speed setting is switched during motion', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'FORWARD'); // 50px line: 250ms at 1x (400)

      store.play();

      const origDuration = useAppStore.getState().turtleState.activeAnimation!.duration;
      expect(origDuration).toBeCloseTo(250);

      // Switch to 4x speed (100)
      store.setSpeed(100);

      const scaledDuration = useAppStore.getState().turtleState.activeAnimation!.duration;
      // Duration should be scaled down by 4x -> 62.5ms
      expect(scaledDuration).toBeCloseTo(62.5);
    });

    it('instant mode executes immediately without creating active animation', () => {
      const store = useAppStore.getState();
      store.setSpeed('instant');

      store.addBlock('MAIN', 'FORWARD');
      store.addBlock('MAIN', 'TURN_RIGHT');
      store.addBlock('MAIN', 'FORWARD');

      // In instant mode, runInstantIfActive immediately evaluates
      const state = useAppStore.getState().turtleState;
      expect(state.activeAnimation).toBeNull();
      expect(state.paths.length).toBe(2);
      expect(useAppStore.getState().isPlaying).toBe(false);
    });
  });
});
