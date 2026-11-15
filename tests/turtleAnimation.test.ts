import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createInitialTurtleState,
  resetTurtleState,
} from '../src/simulations/turtle/turtleEnvironment';
import {
  BASE_LINEAR_SPEED,
  BASE_ANGULAR_SPEED,
  MIN_TURTLE_ZOOM,
  MAX_TURTLE_ZOOM,
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
  getTurtleGridStep,
  getVisibleTurtleWorldBounds,
  combineTurtleBoundsWithPose,
  computeAutoFitOverflowViewport,
} from '../src/simulations/turtle/physics';
import { useAppStore } from '../src/store/useAppStore';
import {
  TurtlePose,
  TurtleState,
  subscribeTurtleCameraPinned,
  notifyTurtleCameraPinned,
} from '../src/simulations/turtle/types';
import {
  TurtleCanvas,
  CompletedAirTrail,
  PenUpMoveSnapshot,
  getPenUpMoveKey,
  reconcilePenUpAirTrailState,
} from '../src/simulations/turtle/components/TurtleCanvas';
import { TurtleToolbarTools } from '../src/simulations/turtle/components/TurtleToolbarTools';

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
      store.addBlock('MAIN', 'FORWARD'); // 100px line, 500ms at 1x

      store.step();

      // Right after step(): activeAnimation must exist
      const state1 = useAppStore.getState().turtleState;
      expect(state1.activeAnimation).toBeDefined();
      expect(state1.activeAnimation?.type).toBe('LINE');
      expect(state1.activeAnimation?.progress).toBe(0);
      expect(state1.activeAnimation?.duration).toBeCloseTo(500);

      // Crucial: paths must NOT contain the incomplete line yet!
      expect(state1.paths).toHaveLength(0);

      // Advance frame halfway (250ms out of 500ms)
      expect(rafCallbacks.length).toBeGreaterThan(0);
      const cb = rafCallbacks.pop()!;
      const startTime = state1.activeAnimation!.startTime;
      cb(startTime + 250);

      const state2 = useAppStore.getState().turtleState;
      expect(state2.activeAnimation).toBeDefined();
      expect(state2.activeAnimation?.progress).toBeCloseTo(0.5);
      expect(state2.activeAnimation?.currentPose.y).toBeCloseTo(-50);
      // Path still not committed to completed paths
      expect(state2.paths).toHaveLength(0);

      // Advance frame to completion (500ms)
      expect(rafCallbacks.length).toBeGreaterThan(0);
      const cb2 = rafCallbacks.pop()!;
      cb2(startTime + 500);

      // Now the step has halted, path committed, activeAnimation cleared
      const state3 = useAppStore.getState().turtleState;
      expect(state3.activeAnimation).toBeNull();
      expect(state3.paths).toHaveLength(1);
      expect(state3.paths[0].type).toBe('LINE');
      expect(state3.robot.y).toBeCloseTo(-100);
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
      store.addBlock('MAIN', 'FORWARD'); // 100px line, 500ms

      store.play();

      const startTime = useAppStore.getState().turtleState.activeAnimation!.startTime;

      // Tick to 40% progress (200ms of 500ms)
      const cb = rafCallbacks.pop()!;
      cb(startTime + 200);

      expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.4);

      // Pause
      store.pause();
      expect(useAppStore.getState().isPlaying).toBe(false);
      // Progress remains preserved at 0.4
      expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.4);

      // Resume
      store.play();
      expect(useAppStore.getState().isPlaying).toBe(true);

      // Tick another 150ms from the resumed time -> should advance from 0.4 without jumping to 0
      const resumedAnim = useAppStore.getState().turtleState.activeAnimation!;
      const cb2 = rafCallbacks.pop()!;
      cb2(resumedAnim.startTime + 350);

      expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.7);
    });

    it('dynamically scales animation duration when speed setting is switched during motion', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'FORWARD'); // 100px line: 500ms at 1x (400)

      store.play();

      const origDuration = useAppStore.getState().turtleState.activeAnimation!.duration;
      expect(origDuration).toBeCloseTo(500);

      // Switch to 4x speed (100)
      store.setSpeed(100);

      const scaledDuration = useAppStore.getState().turtleState.activeAnimation!.duration;
      // Duration should be scaled down by 4x -> 125ms
      expect(scaledDuration).toBeCloseTo(125);
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

    it('renders PEN_UP visual lift and ephemeral dashed air-trail during animated playback without polluting paths', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'PEN_UP');
      store.addBlock('MAIN', 'FORWARD', undefined, undefined, { distance: 100 });

      store.play();
      const midStart = useAppStore.getState().turtleState.activeAnimation!.startTime;
      const midCb = rafCallbacks.pop()!;
      midCb(midStart + 250); // 50% progress of 100px move

      const midState = useAppStore.getState().turtleState;
      expect(midState.penDown).toBe(false);
      expect(midState.paths).toHaveLength(0);
      expect(midState.activeAnimation?.penDown).toBe(false);

      const activeHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: midState })
      );
      expect(activeHtml).toContain('data-pen-down="false"');
      expect(activeHtml).toContain('data-testid="turtle-lift-shadow"');
      expect(activeHtml).toContain('data-testid="turtle-sprite-body" transform="scale(1.12)"');
      expect(activeHtml).toContain('data-testid="turtle-pen-nib" data-pen-state="up"');
      expect(activeHtml).toContain('fill="none"');
      expect(activeHtml).toContain('data-testid="turtle-air-trail"');
      expect(activeHtml).toContain('stroke="#94a3b8"');
      expect(activeHtml).toContain('stroke-dasharray="4 4"');
      expect(activeHtml).not.toContain('data-testid="turtle-active-line"');

      // Complete animation -> paths remains 0 and static canvas stays free of persistent paths or trails
      const endCb = rafCallbacks.pop()!;
      endCb(midStart + 500);
      const finishedState = useAppStore.getState().turtleState;
      expect(finishedState.activeAnimation).toBeNull();
      expect(finishedState.paths).toHaveLength(0);
      expect(finishedState.robot.y).toBeCloseTo(-100);

      const staticHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: finishedState })
      );
      expect(staticHtml).not.toContain('data-testid="turtle-air-trail"');
      expect(staticHtml).toContain('data-pen-down="false"');
      expect(staticHtml).toContain('data-testid="turtle-lift-shadow"');

      // Animated PEN_UP ARC also draws an ephemeral dashed air-trail without polluting paths
      store.clearWorkspace();
      store.addBlock('MAIN', 'PEN_UP');
      store.addBlock('MAIN', 'ARC_RIGHT', undefined, undefined, { radius: 60, angle: 90 });
      store.play();

      const arcActiveBeforeStep = useAppStore.getState().turtleState.activeAnimation!;
      const arcCb = rafCallbacks.pop()!;
      arcCb(arcActiveBeforeStep.startTime + arcActiveBeforeStep.duration * 0.5);

      const arcMidState = useAppStore.getState().turtleState;
      expect(arcMidState.activeAnimation?.type).toBe('ARC');
      expect(arcMidState.activeAnimation?.penDown).toBe(false);
      expect(arcMidState.paths).toHaveLength(0);

      const arcHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: arcMidState })
      );
      expect(arcHtml).toContain('data-testid="turtle-air-trail"');
      expect(arcHtml).toContain('stroke="#94a3b8"');
      expect(arcHtml).toContain('stroke-dasharray="4 4"');
      expect(arcHtml).not.toContain('data-testid="turtle-active-arc"');

      // PEN_DOWN restores unscaled solid nib without drop shadow or air trail
      const downState = { ...finishedState, penDown: true };
      const downHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: downState })
      );
      expect(downHtml).toContain('data-pen-down="true"');
      expect(downHtml).not.toContain('data-testid="turtle-lift-shadow"');
      expect(downHtml).not.toContain('transform="scale(1.12)"');
      expect(downHtml).not.toContain('data-testid="turtle-air-trail"');
      expect(downHtml).toContain('data-testid="turtle-pen-nib" data-pen-state="down"');
    });

    it('enforces 🐢👁️ toggle cue and >=36px mobile / >=44px desktop touch targets on HUD & toolbar controls', () => {
      const store = useAppStore.getState();
      const visibleHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: store.turtleState })
      );
      const toggleVisibleMatch = visibleHtml.match(/<button[^>]*data-testid="tool-toggle-turtle"[^>]*>[\s\S]*?<\/button>/);
      expect(toggleVisibleMatch).not.toBeNull();
      expect(toggleVisibleMatch![0]).toContain('🐢');
      expect(toggleVisibleMatch![0]).toContain('👁️');
      expect(toggleVisibleMatch![0]).toContain('min-h-9');
      expect(toggleVisibleMatch![0]).toContain('min-w-9');
      expect(toggleVisibleMatch![0]).toContain('sm:min-h-11');
      expect(toggleVisibleMatch![0]).toContain('sm:min-w-11');
      expect(toggleVisibleMatch![0]).not.toContain('toggle-turtle-hidden-slash');

      const hiddenHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: { ...store.turtleState, showTurtle: false } })
      );
      expect(hiddenHtml).toContain('data-testid="toggle-turtle-hidden-slash"');
      expect(hiddenHtml).not.toContain('data-testid="turtle-robot"');

      const loopMatch = visibleHtml.match(/<button[^>]*data-testid="tool-loop-playback"[^>]*>/);
      expect(loopMatch).not.toBeNull();
      expect(loopMatch![0]).toContain('min-h-9 min-w-9 sm:min-h-11 sm:min-w-11');

      const toolbarHtml = renderToStaticMarkup(React.createElement(TurtleToolbarTools));
      for (const id of ['tool-zoom-in', 'tool-zoom-out', 'tool-fit-content', 'tool-reset-view']) {
        const btnMatch = toolbarHtml.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`));
        expect(btnMatch).not.toBeNull();
        expect(btnMatch![0]).toContain('min-h-9 min-w-9 sm:min-h-11 sm:min-w-11');
      }
    });

    it('emits exactly 1 completed fading air-trail across cloned RAF activeAnimation objects and clears cleanly on reset/rewind', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'PEN_UP');
      store.addBlock('MAIN', 'FORWARD', undefined, undefined, { distance: 100 });
      store.addBlock('MAIN', 'ARC_RIGHT', undefined, undefined, { radius: 60, angle: 90 });

      store.play();

      let snapshot: PenUpMoveSnapshot | null = null;
      let prevPathsLen = 0;
      const emittedTrails: CompletedAirTrail[] = [];

      const stepTracker = () => {
        const current = useAppStore.getState().turtleState;
        const transition = reconcilePenUpAirTrailState(
          snapshot,
          current.activeAnimation ?? null,
          current,
          prevPathsLen
        );
        snapshot = transition.nextSnapshot;
        prevPathsLen = current.paths.length;
        if (transition.emittedTrail) {
          emittedTrails.push(transition.emittedTrail);
        }
        return transition;
      };

      // Frame 0: FORWARD start
      stepTracker();
      const anim0 = useAppStore.getState().turtleState.activeAnimation!;
      expect(emittedTrails).toHaveLength(0);

      // RAF ticks allocate cloned activeAnimation objects for the same logical move
      const t0 = anim0.startTime;
      rafCallbacks.pop()!(t0 + 100); // 20%
      const anim1 = useAppStore.getState().turtleState.activeAnimation!;
      expect(anim1).not.toBe(anim0);
      expect(getPenUpMoveKey(anim1)).toBe(getPenUpMoveKey(anim0));
      stepTracker();
      expect(emittedTrails).toHaveLength(0);

      rafCallbacks.pop()!(t0 + 250); // 50%
      const anim2 = useAppStore.getState().turtleState.activeAnimation!;
      expect(anim2).not.toBe(anim1);
      expect(getPenUpMoveKey(anim2)).toBe(getPenUpMoveKey(anim0));
      stepTracker();
      expect(emittedTrails).toHaveLength(0);

      // Pause and resume mid-move mutates startTime on a fresh object clone, still same logical move
      store.pause();
      store.play();
      const resumed = useAppStore.getState().turtleState.activeAnimation!;
      expect(resumed).not.toBe(anim2);
      rafCallbacks.pop()!(resumed.startTime + 400); // 80%
      stepTracker();
      expect(emittedTrails).toHaveLength(0);

      // Move 1 completes and Move 2 (ARC_RIGHT) begins -> emits exactly 1 trail with FULL toPose (0, -100)
      rafCallbacks.pop()!(resumed.startTime + 500);
      stepTracker();
      expect(emittedTrails).toHaveLength(1);
      expect(emittedTrails[0]).toMatchObject({
        type: 'LINE',
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: -100,
      });

      // Multi-frame ticks on PEN_UP ARC emit 0 extra trails until ARC completes
      const arcStartAnim = useAppStore.getState().turtleState.activeAnimation!;
      expect(arcStartAnim.type).toBe('ARC');
      rafCallbacks.pop()!(arcStartAnim.startTime + arcStartAnim.duration * 0.4);
      stepTracker();
      expect(emittedTrails).toHaveLength(1);

      rafCallbacks.pop()!(arcStartAnim.startTime + arcStartAnim.duration);
      stepTracker();
      expect(emittedTrails).toHaveLength(2);
      expect(emittedTrails[1].type).toBe('ARC');
      expect(emittedTrails[1].sweepAngle).toBe(90);
      expect(emittedTrails[1].toX).toBeCloseTo(60);
      expect(emittedTrails[1].toY).toBeCloseTo(-160);
      expect(useAppStore.getState().turtleState.paths).toHaveLength(0);

      // Reset / rewind on PEN_UP-only run (paths.length === 0) mid-flight clears snapshot & emits 0 trails
      store.clearWorkspace();
      store.addBlock('MAIN', 'PEN_UP');
      store.addBlock('MAIN', 'FORWARD', undefined, undefined, { distance: 100 });
      store.play();
      const midAnim = useAppStore.getState().turtleState.activeAnimation!;
      rafCallbacks.pop()!(midAnim.startTime + 150); // mid-flight 30%
      stepTracker();
      expect(snapshot).not.toBeNull();

      store.reset();
      const resetTransition = stepTracker();
      expect(resetTransition.clearExistingTrails).toBe(true);
      expect(resetTransition.emittedTrail).toBeNull();
      expect(resetTransition.nextSnapshot).toBeNull();
      expect(emittedTrails).toHaveLength(2);
    });
  });

  describe('4. Practically Infinite Canvas, Adaptive Grid, autoFitOverflow & Zoom-Independent Turtle', () => {
    it('supports widened [0.02, 8] zoom range and smooth adaptive #turtle-grid steps (50 -> 250 -> 1000)', () => {
      expect(MIN_TURTLE_ZOOM).toBe(0.02);
      expect(MAX_TURTLE_ZOOM).toBe(8);

      // Toolbar zoom-out math reaches 0.02 without stalling (vs 2-decimal rounding)
      let z = 0.05;
      for (let i = 0; i < 6; i++) {
        z = Math.max(MIN_TURTLE_ZOOM, Number((z * 0.8).toFixed(4)));
      }
      expect(z).toBe(0.02);

      // Grid steps smoothly at thresholds 0.25 and 0.05
      expect(getTurtleGridStep(1)).toBe(50);
      expect(getTurtleGridStep(0.25)).toBe(50);
      expect(getTurtleGridStep(0.24)).toBe(250);
      expect(getTurtleGridStep(0.05)).toBe(250);
      expect(getTurtleGridStep(0.049)).toBe(1000);
      expect(getTurtleGridStep(0.02)).toBe(1000);

      // Visible world bounds scale with zoom instead of fixed +/-10000 lines
      const visible = getVisibleTurtleWorldBounds(800, 600, 0, 0, 0.02, 80);
      expect(visible.minX).toBeCloseTo(-24000);
      expect(visible.maxX).toBeCloseTo(24000);
      expect(visible.minY).toBeCloseTo(-19000);
      expect(visible.maxY).toBeCloseTo(19000);
    });

    it('autoFitOverflow leaves small drawings at 1x, zooms out for overflow within [0.02, 8], and stabilizes without loops', () => {
      // Fits comfortably inside 85% of 800x600 at 1x -> returns null
      const small = combineTurtleBoundsWithPose(
        { minX: -100, minY: -100, maxX: 100, maxY: 100 },
        { x: 0, y: -100, heading: 0 }
      );
      expect(computeAutoFitOverflowViewport(small, 800, 600, 1, { x: 0, y: 0 })).toBeNull();

      // Overflowing 85% of 800x600 -> zooms out and centers
      const large = combineTurtleBoundsWithPose(
        { minX: -600, minY: -500, maxX: 600, maxY: 500 },
        { x: 900, y: 0, heading: 90 }
      );
      const next = computeAutoFitOverflowViewport(large, 800, 600, 1, { x: 0, y: 0 });
      expect(next).not.toBeNull();
      expect(next!.zoom).toBeLessThan(1);
      expect(next!.zoom).toBeGreaterThanOrEqual(MIN_TURTLE_ZOOM);
      // Re-evaluating at the computed viewport is a no-op (prevents infinite effect loops)
      expect(computeAutoFitOverflowViewport(large, 800, 600, next!.zoom, next!.pan)).toBeNull();

      // Extreme bounds clamp at MIN_TURTLE_ZOOM = 0.02 and also stabilize
      const huge = { minX: -50000, minY: -50000, maxX: 50000, maxY: 50000 };
      const clamped = computeAutoFitOverflowViewport(huge, 800, 600, 1, { x: 0, y: 0 });
      expect(clamped).not.toBeNull();
      expect(clamped!.zoom).toBe(0.02);
      expect(computeAutoFitOverflowViewport(huge, 800, 600, clamped!.zoom, clamped!.pan)).toBeNull();
    });

    it('renders zoom-independent block-sized turtle SVG, adaptive grid, viewport crosshairs, and optional canvasBounds', () => {
      const baseState: TurtleState = {
        ...useAppStore.getState().turtleState,
        robot: { x: 100, y: -200, heading: 90 },
        zoom: 1,
        pan: { x: 0, y: 0 },
        canvasBounds: { halfWidth: 300, halfHeight: 240 },
      };

      const html1x = renderToStaticMarkup(React.createElement(TurtleCanvas, { state: baseState }));
      expect(html1x).toContain('data-grid-step="50"');
      expect(html1x).toContain('patternTransform="translate(300, 300) scale(1)"');
      expect(html1x).toContain('data-testid="turtle-canvas-bounds"');
      expect(html1x).toContain('data-testid="turtle-axis-x"');
      expect(html1x).not.toContain('x1="-10000"');
      // Compact block-sized turtle geometry + inverse zoom scale(1) at 1x
      expect(html1x).toContain('transform="translate(100, -200) rotate(90) scale(1)"');
      expect(html1x).toContain('<circle r="12" fill="#0284c7"');
      expect(html1x).toContain('<circle r="16" fill="#38bdf8"');
      expect(html1x).toContain('<ellipse cx="0" cy="-13" rx="4.2" ry="5.5"');

      // At 0.1x zoom: 250px grid, inverse zoom scale(10) keeps turtle block-sized
      const html01x = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: { ...baseState, zoom: 0.1 } })
      );
      expect(html01x).toContain('data-grid-step="250"');
      expect(html01x).toContain('transform="translate(100, -200) rotate(90) scale(10)"');

      // At 0.02x zoom: 1000px grid, inverse zoom scale(50) keeps turtle block-sized
      const html002x = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: { ...baseState, zoom: 0.02 } })
      );
      expect(html002x).toContain('data-grid-step="1000"');
      expect(html002x).toContain('transform="translate(100, -200) rotate(90) scale(50)"');

      // Camera pin notification pub/sub clears cleanly on unsubscribe
      const events: boolean[] = [];
      const unsub = subscribeTurtleCameraPinned((pinned) => events.push(pinned));
      notifyTurtleCameraPinned(true);
      notifyTurtleCameraPinned(false);
      unsub();
      notifyTurtleCameraPinned(true);
      expect(events).toEqual([true, false]);
    });

    it('renders 600x480 turtle-canvas-bounds frame when active activity allows insideCanvas or sets showCanvasBounds, and supports reset', () => {
      const customBoundsState = createInitialTurtleState({ halfWidth: 200, halfHeight: 150 }, true);
      const customHtml = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: customBoundsState })
      );
      expect(customHtml).toContain('data-testid="turtle-canvas-bounds"');
      expect(customHtml).toContain('x="-200"');
      expect(customHtml).toContain('y="-150"');
      expect(customHtml).toContain('width="400"');
      expect(customHtml).toContain('height="300"');

      const resetState = resetTurtleState({
        ...customBoundsState,
        robot: { ...customBoundsState.robot, x: 50, y: -40, heading: 90 },
      });
      expect(resetState.showCanvasBounds).toBe(true);
      expect(resetState.canvasBounds).toEqual({ halfWidth: 200, halfHeight: 150 });
      expect(resetState.robot.x).toBe(0);
      expect(resetState.robot.y).toBe(0);
      expect(resetState.robot.heading).toBe(0);
    });
  });
});
