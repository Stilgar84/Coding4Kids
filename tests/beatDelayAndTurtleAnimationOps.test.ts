import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore, createEmptyWorkspace } from '../src/store/useAppStore';
import { exportToString, importFromString } from '../src/engine/serialization/codeSerializer';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import { TurtleCanvas } from '../src/simulations/turtle/components/TurtleCanvas';
import { calculateTeleportDuration, calculateWaitDuration } from '../src/simulations/turtle/physics';
import { BEAT_SOUND_BASE_DURATIONS_MS, getBeatEventSoundDurationMs } from '../src/simulations/beat/beatSynth';

describe('Beat Delay/Wait/Loop & Turtle Animation/Teleport/Sensors/Instant/Loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const store = useAppStore.getState();
    store.pause();
    store.setLoopPlayback(false);
    store.setAppMode('sandbox');
    store.setSpeed(400);
    store.clearWorkspace('MAIN');
    store.clearWorkspace('F1');
    store.clearWorkspace('F2');
    store.clearWorkspace('F3');
    store.reset();
  });

  afterEach(() => {
    useAppStore.getState().pause();
    useAppStore.getState().setLoopPlayback(false);
    vi.useRealTimers();
  });

  describe('Beat Delay, Sound Duration, Parameterized Wait, No Instant Speed & Loop', () => {
    it('normalizes global instant speed to 1x (400ms) in Beat environment', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.setSpeed('instant');
      expect(useAppStore.getState().speed).toBe(400);

      // Switching from turtle instant into beat also normalizes to 400
      store.setSimEnvironment('turtle');
      store.setSpeed('instant');
      expect(useAppStore.getState().speed).toBe('instant');
      store.setSimEnvironment('beat');
      expect(useAppStore.getState().speed).toBe(400);
    });

    it('batches non-sound/non-wait blocks at 0ms when SET_BEAT_DELAY is 0, while pausing for exact sound & wait durations', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.setSpeed(400); // 1x

      store.addBlock('MAIN', 'SET_BEAT_DELAY', undefined, undefined, { multiplier: 0 });
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 1, y: 1 });
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 2, y: 2 });
      store.addBlock('MAIN', 'DRUM_KICK');
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 3, y: 3 });
      store.addBlock('MAIN', 'WAIT_BEAT', undefined, undefined, { duration: 2 });
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 4, y: 4 });

      store.play();

      // Immediately after play(): SET_BEAT_DELAY(0), 2 LIGHT_PIXELs, and DRUM_KICK executed synchronously!
      // Now paused waiting for DRUM_KICK exact sound duration (BEAT_SOUND_BASE_DURATIONS_MS.DRUM_KICK = 220ms at 1x)
      let state = useAppStore.getState();
      expect(state.beatState.stepDelayMultiplier).toBe(0);
      expect(state.beatState.leds[0][0]).not.toBeNull();
      expect(state.beatState.leds[1][1]).not.toBeNull();
      expect(state.beatState.leds[2][2]).toBeNull();
      expect(state.isPlaying).toBe(true);

      // Advance 219ms -> still waiting for DRUM_KICK
      vi.advanceTimersByTime(BEAT_SOUND_BASE_DURATIONS_MS.DRUM_KICK - 1);
      expect(useAppStore.getState().beatState.leds[2][2]).toBeNull();

      // Advance 1ms -> DRUM_KICK completes, LIGHT_PIXEL(3,3) and WAIT_BEAT(2) run synchronously,
      // now waiting 2 * 400ms = 800ms for WAIT_BEAT(2) (unaffected by SET_BEAT_DELAY(0))
      vi.advanceTimersByTime(1);
      state = useAppStore.getState();
      expect(state.beatState.leds[2][2]).not.toBeNull();
      expect(state.beatState.leds[3][3]).toBeNull();

      vi.advanceTimersByTime(799);
      expect(useAppStore.getState().beatState.leds[3][3]).toBeNull();
      vi.advanceTimersByTime(1);

      state = useAppStore.getState();
      expect(state.beatState.leds[3][3]).not.toBeNull();
      expect(state.isPlaying).toBe(false);
    });

    it('scales sound duration and WAIT_BEAT duration with global speed (4x = 100ms)', () => {
      const dur1x = getBeatEventSoundDurationMs({ kind: 'PLAY_NOTE', pitch: 1, durationBeats: 2 }, 400);
      const dur4x = getBeatEventSoundDurationMs({ kind: 'PLAY_NOTE', pitch: 1, durationBeats: 2 }, 100);
      expect(dur1x).toBe(730);
      expect(dur4x).toBe(190);
    });

    it('steps manually one block at a time even when SET_BEAT_DELAY is 0', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.addBlock('MAIN', 'SET_BEAT_DELAY', undefined, undefined, { multiplier: 0 });
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 1, y: 1 });
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 2, y: 2 });

      store.step();
      expect(useAppStore.getState().beatState.stepDelayMultiplier).toBe(0);
      expect(useAppStore.getState().beatState.leds[0][0]).toBeNull();

      store.step();
      expect(useAppStore.getState().beatState.leds[0][0]).not.toBeNull();
      expect(useAppStore.getState().beatState.leds[1][1]).toBeNull();

      store.step();
      expect(useAppStore.getState().beatState.leds[1][1]).not.toBeNull();
    });

    it('loops Beat playback when isLoopPlayback is enabled', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.setLoopPlayback(true);
      store.setSpeed(400);
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 1, y: 1 });
      store.addBlock('MAIN', 'CLEAR_LEDS');

      store.play();
      expect(useAppStore.getState().beatState.leds[0][0]).not.toBeNull();
      expect(useAppStore.getState().isPlaying).toBe(true);

      // After 400ms -> CLEAR_LEDS runs, then waits 400ms before restarting loop
      vi.advanceTimersByTime(400);
      expect(useAppStore.getState().beatState.leds[0][0]).toBeNull();
      expect(useAppStore.getState().isPlaying).toBe(true);

      vi.advanceTimersByTime(400);
      expect(useAppStore.getState().beatState.leds[0][0]).not.toBeNull();
      expect(useAppStore.getState().isPlaying).toBe(true);
    });
  });

  describe('Turtle Wait, Instant Mode, Clear Canvas, Teleport, Sensors, Hide Turtle & Loop', () => {
    it('calculates teleport and wait durations scaled by speed', () => {
      expect(calculateTeleportDuration(400)).toBe(320);
      expect(calculateTeleportDuration(100)).toBe(80);
      expect(calculateTeleportDuration('instant')).toBe(0);
      expect(calculateWaitDuration(0.5, 400)).toBe(200);
      expect(calculateWaitDuration(2, 100)).toBe(200);
      expect(calculateWaitDuration(2, 'instant')).toBe(0);
    });

    it('TELEPORT moves turtle without drawing even when penDown is true', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      store.setSpeed('instant');
      store.addBlock('MAIN', 'PEN_DOWN');
      store.addBlock('MAIN', 'TELEPORT', undefined, undefined, { x: 80, y: -40, heading: 90 });
      store.play();

      const t = useAppStore.getState().turtleState;
      expect(t.robot.x).toBe(80);
      expect(t.robot.y).toBe(-40);
      expect(t.robot.heading).toBe(90);
      expect(t.penDown).toBe(true);
      expect(t.paths).toHaveLength(0);
    });

    it('SET_INSTANT(ON) runs fast headless loop without RAF until WAIT or SET_INSTANT(OFF)', () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      try {
        const store = useAppStore.getState();
        store.setSimEnvironment('turtle');
        store.setSpeed(400); // normal 1x speed

        store.addBlock('MAIN', 'SET_INSTANT', undefined, undefined, { mode: 'ON' });
        store.addBlock('MAIN', 'FORWARD', undefined, undefined, { length: 50 });
        store.addBlock('MAIN', 'TURN_RIGHT', undefined, undefined, { angle: 90 });
        store.addBlock('MAIN', 'FORWARD', undefined, undefined, { length: 50 });
        store.addBlock('MAIN', 'WAIT', undefined, undefined, { duration: 1 });
        store.addBlock('MAIN', 'CLEAR_CANVAS');

        store.play();

        // Both FORWARDs & TURN_RIGHT ran immediately in pure JS without RAF!
        // Now paused on WAIT animation (400ms), 1 RAF queued for WAIT
        let t = useAppStore.getState().turtleState;
        expect(t.instantMode).toBe(true);
        expect(t.paths).toHaveLength(2);
        expect(t.robot.x).toBeCloseTo(50);
        expect(t.robot.y).toBeCloseTo(-50);
        expect(t.activeAnimation?.type).toBe('WAIT');
        expect(t.activeAnimation?.duration).toBe(400);
        expect(rafCallbacks).toHaveLength(1);

        // Step manual still goes 1 block at a time in instantMode
        store.pause();
        store.reset();
        store.step(); // SET_INSTANT(ON) -> FORWARD(50) (1 animated block)
        expect(useAppStore.getState().turtleState.paths).toHaveLength(0); // animation pending
        expect(useAppStore.getState().turtleState.activeAnimation?.type).toBe('LINE');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('CLEAR_CANVAS clears paths while preserving pose, pen state, instantMode, and showTurtle', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      store.setSpeed('instant');
      store.toggleTurtleVisible(); // hide turtle (showTurtle = false)

      store.addBlock('MAIN', 'SET_PEN_COLOR', undefined, undefined, { color: '#ef4444' });
      store.addBlock('MAIN', 'SET_INSTANT', undefined, undefined, { mode: 'ON' });
      store.addBlock('MAIN', 'FORWARD', undefined, undefined, { length: 60 });
      store.addBlock('MAIN', 'CLEAR_CANVAS');
      store.play();

      const t = useAppStore.getState().turtleState;
      expect(t.paths).toHaveLength(0);
      expect(t.robot.y).toBeCloseTo(-60);
      expect(t.penColor).toBe('#ef4444');
      expect(t.instantMode).toBe(true);
      expect(t.showTurtle).toBe(false);

      // reset() preserves showTurtle
      store.reset();
      expect(useAppStore.getState().turtleState.showTurtle).toBe(false);
    });

    it('reads $x, $y, $heading sensors into variables and expressions', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      store.setSpeed('instant');

      store.addBlock('MAIN', 'TELEPORT', undefined, undefined, { x: 40, y: -30, heading: 135 });
      store.addBlock('MAIN', 'VAR_ASSIGN', undefined, undefined, { a: 'a', b: '$x' });
      store.addBlock('MAIN', 'VAR_ASSIGN', undefined, undefined, { a: 'b', b: '$y' });
      store.addBlock('MAIN', 'VAR_OP', undefined, undefined, { a: 'c', b: '$heading', op: '+', c: 45 });
      store.play();

      const vars = useAppStore.getState().runtime?.variables;
      expect(vars?.a).toBe(40);
      expect(vars?.b).toBe(-30);
      expect(vars?.c).toBe(180);
    });

    it('preserves zoom, pan, fitToView, and showTurtle changed mid-animation across play(), loop restarts, step(), and instant speed switch', () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      try {
        const store = useAppStore.getState();
        store.setSimEnvironment('turtle');
        store.setSpeed(400);
        store.setLoopPlayback(true);
        store.updateTurtleViewport({ pan: { x: 0, y: 0 }, zoom: 1, fitToView: false });
        if (!useAppStore.getState().turtleState.showTurtle) {
          store.toggleTurtleVisible();
        }

        store.addBlock('MAIN', 'FORWARD', undefined, undefined, { length: 50 });
        store.addBlock('MAIN', 'FORWARD', undefined, undefined, { length: 50 });
        store.play();

        const anim1 = useAppStore.getState().turtleState.activeAnimation!;
        expect(anim1.type).toBe('LINE');
        expect(rafCallbacks).toHaveLength(1);

        // Advance first FORWARD to 50% progress
        rafCallbacks.shift()!(anim1.startTime + anim1.duration * 0.5);
        expect(useAppStore.getState().turtleState.activeAnimation?.progress).toBeCloseTo(0.5);

        // User zooms, pans, and hides turtle while drawing is happening
        store.updateTurtleViewport({ zoom: 2.25, pan: { x: 40, y: -30 }, fitToView: false });
        store.toggleTurtleVisible();
        expect(useAppStore.getState().turtleState.zoom).toBe(2.25);
        expect(useAppStore.getState().turtleState.pan).toEqual({ x: 40, y: -30 });
        expect(useAppStore.getState().turtleState.showTurtle).toBe(false);

        // Complete first FORWARD -> second FORWARD starts; viewport and visibility must NOT reset
        rafCallbacks.shift()!(anim1.startTime + anim1.duration + 1);
        let stateAfterFirst = useAppStore.getState().turtleState;
        expect(stateAfterFirst.paths).toHaveLength(1);
        expect(stateAfterFirst.zoom).toBe(2.25);
        expect(stateAfterFirst.pan).toEqual({ x: 40, y: -30 });
        expect(stateAfterFirst.fitToView).toBe(false);
        expect(stateAfterFirst.showTurtle).toBe(false);
        expect(stateAfterFirst.activeAnimation?.type).toBe('LINE');

        // Complete second FORWARD -> loop restarts pass 2; viewport and visibility remain intact
        const anim2 = stateAfterFirst.activeAnimation!;
        rafCallbacks.shift()!(anim2.startTime + anim2.duration + 1);
        const stateAfterLoopRestart = useAppStore.getState().turtleState;
        expect(stateAfterLoopRestart.paths).toHaveLength(0);
        expect(stateAfterLoopRestart.zoom).toBe(2.25);
        expect(stateAfterLoopRestart.pan).toEqual({ x: 40, y: -30 });
        expect(stateAfterLoopRestart.fitToView).toBe(false);
        expect(stateAfterLoopRestart.showTurtle).toBe(false);
        expect(useAppStore.getState().isPlaying).toBe(true);

        // Mid-animation snap-commit via step() preserves changes made during animation
        store.updateTurtleViewport({ zoom: 1.5, pan: { x: -12, y: 18 }, fitToView: true });
        store.toggleTurtleVisible(); // now true
        store.step();
        const stateAfterStepCommit = useAppStore.getState().turtleState;
        expect(stateAfterStepCommit.zoom).toBe(1.5);
        expect(stateAfterStepCommit.pan).toEqual({ x: -12, y: 18 });
        expect(stateAfterStepCommit.fitToView).toBe(true);
        expect(stateAfterStepCommit.showTurtle).toBe(true);

        // Mid-animation snap-commit via setSpeed('instant') preserves changes made during animation
        store.pause();
        store.setLoopPlayback(false);
        store.reset();
        store.play();
        store.updateTurtleViewport({ zoom: 3.1, pan: { x: 5, y: 9 }, fitToView: false });
        store.toggleTurtleVisible(); // now false
        store.setSpeed('instant');
        const stateAfterInstant = useAppStore.getState().turtleState;
        expect(stateAfterInstant.zoom).toBe(3.1);
        expect(stateAfterInstant.pan).toEqual({ x: 5, y: 9 });
        expect(stateAfterInstant.fitToView).toBe(false);
        expect(stateAfterInstant.showTurtle).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('renders high-contrast solid active states for TurtleCanvas visibility and loop HUD buttons', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      store.setLoopPlayback(true);
      if (useAppStore.getState().turtleState.showTurtle) {
        store.toggleTurtleVisible();
      }

      const html = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: useAppStore.getState().turtleState })
      );

      const toggleTurtleMatch = html.match(/data-testid="tool-toggle-turtle"[^>]*>/);
      expect(toggleTurtleMatch).not.toBeNull();
      expect(toggleTurtleMatch![0]).toContain('bg-sky-600');
      expect(toggleTurtleMatch![0]).toContain('text-white');
      expect(toggleTurtleMatch![0]).not.toContain('bg-sky-500/20');

      const loopPlaybackMatch = html.match(/data-testid="tool-loop-playback"[^>]*>/);
      expect(loopPlaybackMatch).not.toBeNull();
      expect(loopPlaybackMatch![0]).toContain('bg-amber-500');
      expect(loopPlaybackMatch![0]).toContain('text-slate-950');
      expect(loopPlaybackMatch![0]).not.toContain('bg-amber-500/25');
    });
  });

  describe('Binary Serialization Round-Trips', () => {
    it('round-trips Beat SET_BEAT_DELAY and parameterized WAIT_BEAT', () => {
      const ws = createEmptyWorkspace();
      ws.MAIN = [
        { id: 'b1', type: 'SET_BEAT_DELAY', params: { multiplier: 0.25 } },
        { id: 'b2', type: 'WAIT_BEAT', params: { duration: 1 } },
        { id: 'b3', type: 'WAIT_BEAT', params: { duration: 2 } },
      ];
      const encoded = exportToString(ws, 'beat');
      const decoded = importFromString(encoded);
      expect(decoded.success).toBe(true);
      expect(decoded.workspace?.MAIN[0].type).toBe('SET_BEAT_DELAY');
      expect(decoded.workspace?.MAIN[0].params?.multiplier).toBe(0.25);
      expect(decoded.workspace?.MAIN[1].type).toBe('WAIT_BEAT');
      expect(decoded.workspace?.MAIN[2].type).toBe('WAIT_BEAT');
      expect(decoded.workspace?.MAIN[2].params?.duration).toBe(2);
    });

    it('round-trips Turtle WAIT, SET_INSTANT, CLEAR_CANVAS, TELEPORT (negative + sensor), and sensor VAR_ASSIGN', () => {
      const ws = createEmptyWorkspace();
      ws.MAIN = [
        { id: 't1', type: 'SET_INSTANT', params: { mode: 'ON' } },
        { id: 't2', type: 'TELEPORT', params: { x: -120, y: '$y', heading: 270 } },
        { id: 't3', type: 'WAIT', params: { duration: 0.5 } },
        { id: 't4', type: 'CLEAR_CANVAS' },
        { id: 't5', type: 'VAR_ASSIGN', params: { a: 'a', b: '$heading' } },
      ];
      const encoded = exportToString(ws, 'turtle', createInitialTurtleState());
      const decoded = importFromString(encoded);
      expect(decoded.success).toBe(true);
      expect(decoded.workspace?.MAIN[0]).toMatchObject({ type: 'SET_INSTANT', params: { mode: 'ON' } });
      expect(decoded.workspace?.MAIN[1]).toMatchObject({
        type: 'TELEPORT',
        params: { x: -120, y: '$y', heading: 270 },
      });
      expect(decoded.workspace?.MAIN[2]).toMatchObject({ type: 'WAIT', params: { duration: 0.5 } });
      expect(decoded.workspace?.MAIN[3]).toMatchObject({ type: 'CLEAR_CANVAS' });
      expect(decoded.workspace?.MAIN[4]).toMatchObject({
        type: 'VAR_ASSIGN',
        params: { a: 'a', b: '$heading' },
      });
    });
  });
});
