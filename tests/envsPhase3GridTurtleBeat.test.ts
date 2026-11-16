import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../src/store/useAppStore';
import { createInitialInterpreterState, evaluateTypedValue, tickInterpreter } from '../src/engine/interpreter';
import type { TypedValue } from '../src/types';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import { BinaryReader } from '../src/engine/serialization/binaryReader';
import { exportToBinary, importFromBinary } from '../src/engine/serialization/codeSerializer';
import {
  ENV_VERSION_GRID_V3,
  OP_TURTLE_SET_PEN_COLOR,
  OP_BEAT_PLAY_NOTE,
  OP_BEAT_SET_LED_COLOR,
} from '../src/engine/serialization/types';

// Grid imports
import {
  createDefaultGridState,
  gridSimulationEnvironment,
} from '../src/simulations/grid/gridEnvironment';
import { readGridSensor } from '../src/simulations/grid/sensors';
import {
  BeaconAndDialLayer,
  resolveActiveDialReadTarget,
} from '../src/simulations/grid/components/BeaconAndDialLayer';
import { GridToolbarTools } from '../src/simulations/grid/components/GridToolbarTools';
import {
  applySandboxDialCell,
  applySandboxStackCell,
  resetGridEditorPrefs,
  setEditorDialValue,
  setEditorStackCount,
} from '../src/simulations/grid/editorToolPrefs';
import { GridCanvas } from '../src/components/GridCanvas';
import {
  writeGridState,
  readGridState,
} from '../src/engine/serialization/env/gridSerializer';

// Turtle imports
import {
  DEFAULT_STEP_DISTANCE,
  DEFAULT_TURTLE_CANVAS_BOUNDS,
  isTurtleInsideCanvas,
} from '../src/simulations/turtle/physics';
import {
  createInitialTurtleState,
  resetTurtleState,
  resolveTurtlePenColor,
  turtleSimulationEnvironment,
} from '../src/simulations/turtle/turtleEnvironment';
import {
  TurtleCanvas,
  screenToTurtleWorld,
  workspaceUsesTurtlePointerOrTap,
} from '../src/simulations/turtle/components/TurtleCanvas';
import {
  ENV_VERSION_TURTLE,
  ENV_VERSION_TURTLE_V2,
  colorToByte,
  writeTurtleParams,
  readTurtleParams,
  getTurtleSerializationVersion,
  writeTurtleState,
  readTurtleState,
} from '../src/engine/serialization/env/turtleSerializer';

// Beat imports
import {
  BEAT_SCALE_FREQUENCIES,
  BeatSynthEngine,
  getBeatEventSoundDurationMs,
} from '../src/simulations/beat/beatSynth';
import {
  BEAT_DURATION_PARAM_DEF,
  BEAT_PITCH_PARAM_DEF,
  beatSimulationEnvironment,
  createInitialBeatState,
  readBeatSensor,
  resolveLedColor,
} from '../src/simulations/beat/beatEnvironment';
import {
  BeatCanvas,
  quantizeBeatPointerCell,
} from '../src/simulations/beat/components/BeatCanvas';
import {
  ENV_VERSION_BEAT,
  ENV_VERSION_BEAT_V2,
  beatColorToByte,
  getBeatParamVarFlags,
  writeBeatParams,
  readBeatBlock,
  getBeatSerializationVersion,
  writeBeatState,
  readBeatState,
} from '../src/engine/serialization/env/beatSerializer';
import { FloorSwitch, WorkspaceState } from '../src/types';

class Phase3MockAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running';
  currentTime = 0.2;
  sampleRate = 44100;
  destination = { kind: 'destination' };
  oscillators: Array<{ freq: number; connectedTo: unknown; started: boolean }> = [];
  compressors: Array<{ connectedTo: unknown; thresholdVal: number }> = [];

  resume = () => Promise.resolve();
  close = () => {
    this.state = 'closed';
    return Promise.resolve();
  };
  addEventListener = () => {};

  createDynamicsCompressor() {
    const comp = {
      connectedTo: null as unknown,
      thresholdVal: 0,
      threshold: {
        setValueAtTime: (v: number) => {
          comp.thresholdVal = v;
        },
      },
      knee: { setValueAtTime: () => {} },
      ratio: { setValueAtTime: () => {} },
      attack: { setValueAtTime: () => {} },
      release: { setValueAtTime: () => {} },
      connect: (target: unknown) => {
        comp.connectedTo = target;
      },
    };
    this.compressors.push(comp);
    return comp;
  }

  createOscillator() {
    const osc = {
      type: 'triangle',
      freq: 0,
      connectedTo: null as unknown,
      started: false,
      onended: null as (() => void) | null,
      frequency: {
        setValueAtTime: (v: number) => {
          osc.freq = v;
        },
        exponentialRampToValueAtTime: () => {},
      },
      connect: (target: unknown) => {
        osc.connectedTo = target;
      },
      start: () => {
        osc.started = true;
      },
      stop: () => {},
      disconnect: () => {},
    };
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const g = {
      connectedTo: null as unknown,
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: (target: unknown) => {
        g.connectedTo = target;
      },
      disconnect: () => {},
    };
    return g;
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    const arr = new Float32Array(length);
    return {
      length,
      sampleRate,
      getChannelData: () => arr,
    };
  }

  createBufferSource() {
    return {
      buffer: null as unknown,
      onended: null as (() => void) | null,
      connect: () => {},
      start: () => {},
      stop: () => {},
      disconnect: () => {},
    };
  }
}

describe('Wave 3B Phase 3 — Grid, Turtle & Beat Environments', () => {
  beforeEach(() => {
    resetGridEditorPrefs();
    useAppStore.getState().setAppMode('sandbox');
    useAppStore.getState().setEditorTool('NONE');
  });

  afterEach(() => {
    resetGridEditorPrefs();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. GRID / ROBOT PHASE 3
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Grid / Robot Phase 3', () => {
    it('reads rotary $tileDial (1..20) on dial tiles and 0 on empty tiles, and round-trips v3 dials & stacks', () => {
      const grid = {
        ...createDefaultGridState(),
        dialTiles: [
          { x: 0, y: 2, value: 19 },
          { x: 2, y: 2, value: 7 },
        ],
        worldItems: [
          { id: 's1', type: 'crate' as const, x: 1, y: 1, count: 8 },
        ],
        initialWorldItems: [
          { id: 's1', type: 'crate' as const, x: 1, y: 1, count: 8 },
        ],
      };

      expect(readGridSensor('$tileDial', grid)).toBe(19);
      expect(gridSimulationEnvironment.readSensor?.('$tileDial', grid)).toBe(19);

      const movedOffDial = {
        ...grid,
        robot: { ...grid.robot, x: 1, y: 2 },
      };
      expect(readGridSensor('$tileDial', movedOffDial)).toBe(0);

      const writer = new BinaryWriter();
      writeGridState(writer, grid, ENV_VERSION_GRID_V3);
      const decoded = readGridState(new BinaryReader(writer.getBytes()), ENV_VERSION_GRID_V3);
      expect(decoded.dialTiles).toEqual([
        { x: 0, y: 2, value: 19 },
        { x: 2, y: 2, value: 7 },
      ]);
      expect(decoded.worldItems?.[0]?.count).toBe(8);
    });

    it('renders BeaconAndDialLayer pulse rings, curved numeral fly arc, and muted 0 ring on empty tiles', () => {
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b-var', type: 'VAR_ASSIGN', params: { a: 'x', b: '$tileDial' } },
          { id: 'b-var-op', type: 'VAR_OP', params: { a: 'x', op: '+', b: 'x', c: '$tileDial' } },
          {
            id: 'b-cmp',
            type: 'IF',
            params: { condition: { kind: 'cmp', op: '>', left: '$tileDial', right: 10 } },
          },
          { id: 'b-param', type: 'MOVE_FWD', repeatCount: '$tileDial' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      expect(resolveActiveDialReadTarget(null, ws, 'b-var', 'MAIN')).toBe('vars');
      expect(resolveActiveDialReadTarget(null, ws, 'b-var-op', 'MAIN')).toBe('vars');
      expect(resolveActiveDialReadTarget(null, ws, 'b-cmp', 'MAIN')).toBe('cmp');
      expect(resolveActiveDialReadTarget(null, ws, 'b-param', 'MAIN')).toBe('param');

      const onDialGrid = {
        ...createDefaultGridState(),
        dialTiles: [{ x: 0, y: 2, value: 16 }],
      };
      const onDialHtml = renderToStaticMarkup(
        React.createElement(BeaconAndDialLayer, {
          grid: onDialGrid,
          dialReadTarget: 'vars',
        })
      );
      expect(onDialHtml).toContain('data-testid="dial-tile-0-2"');
      expect(onDialHtml).toContain('data-dial-value="16"');
      expect(onDialHtml).toContain('data-testid="dial-pulse-ring-0-2"');
      expect(onDialHtml).toContain('data-testid="dial-fly-arc"');
      expect(onDialHtml).toContain('data-dial-read-value="16"');
      expect(onDialHtml).not.toContain('data-testid="dial-empty-zero-ring"');

      const offDialGrid = {
        ...createDefaultGridState(),
        dialTiles: [{ x: 3, y: 2, value: 12 }],
      };
      const offDialHtml = renderToStaticMarkup(
        React.createElement(BeaconAndDialLayer, {
          grid: offDialGrid,
          dialReadTarget: 'vars',
        })
      );
      expect(offDialHtml).toContain('data-testid="dial-empty-zero-ring"');
      expect(offDialHtml).toContain('data-dial-read-value="0"');
    });

    it('exposes Sandbox GridToolbarTools dial 1..20 & stack ×2..×10 pickers and applies Undo-safe edits', () => {
      useAppStore.getState().setAppMode('sandbox');
      useAppStore.getState().setSimEnvironment('grid');
      useAppStore.getState().setEditorTool('DIAL');
      setEditorDialValue(17);

      const dialMenuHtml = renderToStaticMarkup(
        React.createElement(GridToolbarTools, { defaultWorldMenuOpen: true })
      );
      expect(dialMenuHtml).toContain('data-testid="dial-value-picker"');
      expect(dialMenuHtml).toContain('data-testid="dial-value-option-17"');
      expect(dialMenuHtml).toContain('data-testid="dial-value-option-20"');
      expect(dialMenuHtml).toContain('data-testid="tool-dial-active-badge"');

      applySandboxDialCell(2, 1);
      expect(useAppStore.getState().grid.dialTiles).toContainEqual({ x: 2, y: 1, value: 17 });

      useAppStore.getState().undo();
      expect(
        useAppStore.getState().grid.dialTiles?.some((d) => d.x === 2 && d.y === 1) ?? false
      ).toBe(false);

      useAppStore.getState().setEditorTool('STACK_DEPOT');
      setEditorStackCount(8);
      const stackMenuHtml = renderToStaticMarkup(
        React.createElement(GridToolbarTools, { defaultWorldMenuOpen: true })
      );
      expect(stackMenuHtml).toContain('data-testid="stack-count-picker"');
      expect(stackMenuHtml).toContain('data-testid="stack-count-option-8"');
      expect(stackMenuHtml).toContain('data-testid="tool-stack-active-badge"');

      applySandboxStackCell(1, 3);
      const placedStack = useAppStore
        .getState()
        .grid.worldItems?.find((it) => it.x === 1 && it.y === 3);
      expect(placedStack?.count).toBe(8);
    });

    it('renders GridCanvas zero-reading terminal status cues and passes runtimeVariables to SimulationTopLeftHud', () => {
      useAppStore.getState().setAppMode('sandbox');
      const terminalCases = [
        { status: 'TYPE_ERROR' as const, testId: 'status-type-error', glyph: '🎨≠#' },
        { status: 'MATH_ERROR' as const, testId: 'status-math-error', glyph: '🧮÷0' },
        { status: 'STACK_OVERFLOW' as const, testId: 'status-stack-overflow', glyph: '📚💥' },
        { status: 'STEP_LIMIT' as const, testId: 'status-step-limit', glyph: '⏳🔁' },
        { status: 'DEADLOCK' as const, testId: 'status-deadlock', glyph: '🔒💥' },
      ];

      for (const tc of terminalCases) {
        const stateAtGoal = {
          ...createDefaultGridState(),
          robot: {
            x: 4,
            y: 2,
            dir: 'EAST' as const,
            initialX: 0,
            initialY: 2,
            initialDir: 'EAST' as const,
          },
          status: tc.status,
        };
        expect(gridSimulationEnvironment.evaluateCompletion(stateAtGoal)).toBe('IDLE');

        const html = renderToStaticMarkup(
          React.createElement(GridCanvas, {
            state: createDefaultGridState(),
            runtimeStatus: tc.status,
            runtimeVariables: { a: 42 },
          })
        );
        expect(html).toContain(`data-testid="${tc.testId}"`);
        expect(html).toContain(tc.glyph);
        expect(html).toContain('42');
      }
    });

    it('supports multi-crate FloorSwitch requiredCount stacking on USE_DROP (satisfied iff count === requiredCount)', () => {
      const multiSwitch = {
        id: 'sw_vault',
        x: 1,
        y: 2,
        requiredForGoal: true,
        requiredCount: 3,
      } as FloorSwitch & { requiredCount: number };

      let state = {
        ...createDefaultGridState(),
        robot: {
          x: 1,
          y: 2,
          dir: 'EAST' as const,
          initialX: 0,
          initialY: 2,
          initialDir: 'EAST' as const,
          carriedItem: { id: 'c_supply', type: 'crate' as const, x: 0, y: 0, count: 4 },
          carriedCount: 4,
        },
        flags: [{ id: 'g1', x: 1, y: 2, isGoal: true, order: 1, collected: false }],
        floorSwitches: [multiSwitch],
        worldItems: [],
      };

      // Drop 1st crate -> count 1 (< 3): switch not yet satisfied
      state = gridSimulationEnvironment.executeAction('USE_DROP', state).nextState;
      expect(gridSimulationEnvironment.evaluateCompletion(state)).toBe('IDLE');

      // Drop 2nd crate -> count 2 (< 3): switch still not satisfied
      state = gridSimulationEnvironment.executeAction('USE_DROP', state).nextState;
      expect(gridSimulationEnvironment.evaluateCompletion(state)).toBe('IDLE');

      // Drop 3rd crate -> count 3 (=== 3): switch satisfied!
      state = gridSimulationEnvironment.executeAction('USE_DROP', state).nextState;
      expect(state.worldItems?.[0]?.count).toBe(3);
      expect(gridSimulationEnvironment.evaluateCompletion(state)).toBe('SUCCESS');

      // Drop 4th crate -> count 4 (> 3): over-delivery collides!
      const overDrop = gridSimulationEnvironment.executeAction('USE_DROP', state);
      expect(overDrop.isCollision).toBe(true);
      expect(overDrop.status).toBe('COLLISION');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TURTLE / LOGO PHASE 3
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Turtle / LOGO Phase 3', () => {
    it('preserves DEFAULT_STEP_DISTANCE = 100 and nominal paper bounds', () => {
      expect(DEFAULT_STEP_DISTANCE).toBe(100);
      expect(DEFAULT_TURTLE_CANVAS_BOUNDS).toEqual({ halfWidth: 300, halfHeight: 240 });

      const base = createInitialTurtleState({ halfWidth: 200, halfHeight: 200 }, true);
      expect(isTurtleInsideCanvas(base)).toBe(true);
      const stepped = turtleSimulationEnvironment.executeAction('FORWARD', base).nextState;
      expect(stepped.robot.y).toBe(-100);
      expect(isTurtleInsideCanvas(stepped)).toBe(true);
    });

    it('resolves SET_PEN_COLOR TypedValue color, 0..9 indices, color names, and $randomColor via interpreter + serializer', () => {
      expect(resolveTurtlePenColor({ type: 'color', value: 'amber' })).toBe('#f59e0b');
      expect(resolveTurtlePenColor({ type: 'color', value: 5 })).toBe('#8b5cf6');
      expect(resolveTurtlePenColor(7)).toBe('#06b6d4');
      expect(resolveTurtlePenColor('color:pink')).toBe('#ec4899');

      let tState = createInitialTurtleState();
      tState = turtleSimulationEnvironment.executeAction('SET_PEN_COLOR', tState, {
        params: { color: { type: 'color', value: 'cyan' } },
      }).nextState;
      expect(tState.penColor).toBe('#06b6d4');

      // Execute $randomColor via tickInterpreter
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'c1', type: 'SET_PEN_COLOR', params: { color: '$randomColor' } },
          { id: 'f1', type: 'FORWARD' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      let rt = createInitialInterpreterState(12345);
      let sim = createInitialTurtleState();
      const step1 = tickInterpreter(rt, ws, sim, turtleSimulationEnvironment);
      rt = step1.nextRuntime;
      sim = step1.nextGrid;
      const step2 = tickInterpreter(rt, ws, sim, turtleSimulationEnvironment);
      sim = step2.nextGrid;
      expect(sim.paths).toHaveLength(1);
      expect(sim.paths[0].color).toMatch(/^#[0-9a-f]{6}$/i);

      // Binary round-trip for SET_PEN_COLOR with $randomColor (paramVarMask & 0x02) and TypedValue color
      const bin = exportToBinary(ws, 'turtle', sim);
      const imported = importFromBinary(bin);
      expect(imported.workspace.MAIN[0].params?.color).toBe('$randomColor');

      expect(colorToByte({ type: 'color', value: 'purple' })).toBe(5);
      expect(colorToByte(8)).toBe(8);
      const paramWriter = new BinaryWriter();
      writeTurtleParams(paramWriter, OP_TURTLE_SET_PEN_COLOR, { color: '$randomColor' }, 0x02);
      const decodedParam = readTurtleParams(
        new BinaryReader(paramWriter.getBytes()),
        OP_TURTLE_SET_PEN_COLOR,
        0x02
      );
      expect(decodedParam).toEqual({ color: '$randomColor' });
    });

    it('$randomColor only selects vibrant swatches 1..8 and never returns white or black in LOGO', () => {
      const vibrantNames = new Set([
        'red',
        'blue',
        'green',
        'amber',
        'purple',
        'pink',
        'cyan',
        'orange',
      ]);
      const vibrantHexes = new Set([
        '#ef4444',
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#ec4899',
        '#06b6d4',
        '#f97316',
      ]);

      const seenNames = new Set<string>();
      let seed = 1;
      for (let i = 0; i < 240; i++) {
        const res = evaluateTypedValue('$randomColor', {}, 0, { seed });
        seed = res.nextSeed ?? seed + 1;
        const tv = res.value as TypedValue;
        expect(tv.type).toBe('color');
        expect(tv.value).not.toBe('white');
        expect(tv.value).not.toBe('black');
        expect(vibrantNames.has(tv.value)).toBe(true);
        seenNames.add(tv.value);
      }
      expect(seenNames).toEqual(vibrantNames);

      // Verify tickInterpreter SET_PEN_COLOR with $randomColor across 240 LOGO steps
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'loop', type: 'LOOP_START', repeatCount: 240 },
          { id: 'c1', type: 'SET_PEN_COLOR', params: { color: '$randomColor' } },
          { id: 'f1', type: 'FORWARD', params: { length: 10 } },
          { id: 'end', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      let rt = createInitialInterpreterState(12345);
      let sim = createInitialTurtleState();
      while (!rt.status || rt.status === 'IDLE' || rt.status === 'RUNNING') {
        const step = tickInterpreter(rt, ws, sim, turtleSimulationEnvironment);
        rt = step.nextRuntime;
        sim = step.nextGrid;
        if (step.done) break;
      }
      expect(sim.paths).toHaveLength(240);
      const seenHexes = new Set(sim.paths.map((p) => p.color.toLowerCase()));
      expect(seenHexes.has('#ffffff')).toBe(false);
      expect(seenHexes.has('#0f172a')).toBe(false);
      for (const hex of seenHexes) {
        expect(vibrantHexes.has(hex)).toBe(true);
      }
      expect(seenHexes).toEqual(vibrantHexes);
    });

    it('serializes ENV_VERSION_TURTLE_V2 = 2 live/flipbook state while keeping static v1 at 0 bytes', () => {
      expect(ENV_VERSION_TURTLE).toBe(1);
      expect(ENV_VERSION_TURTLE_V2).toBe(2);

      const staticState = createInitialTurtleState();
      expect(getTurtleSerializationVersion(staticState)).toBe(1);

      const liveState = {
        ...staticState,
        mode: 'live' as const,
        clearBetweenFrames: false,
        fps: 30,
      };
      expect(getTurtleSerializationVersion(liveState)).toBe(2);

      const w = new BinaryWriter();
      writeTurtleState(w, liveState, ENV_VERSION_TURTLE_V2);
      const roundTripped = readTurtleState(
        new BinaryReader(w.getBytes()),
        ENV_VERSION_TURTLE_V2
      );
      expect(roundTripped.mode).toBe('live');
      expect(roundTripped.clearBetweenFrames).toBe(false);
      expect(roundTripped.fps).toBe(30);
      expect(roundTripped.instantMode).toBe(true);

      // resetTurtleState retains accumulated strokes across RUNNING live frames when clearBetweenFrames === false
      const runningLiveWithPath = {
        ...roundTripped,
        status: 'RUNNING' as const,
        paths: [
          {
            type: 'LINE' as const,
            fromX: 0,
            fromY: 0,
            toX: 0,
            toY: -100,
            color: '#ef4444',
            width: 6,
          },
        ],
      };
      expect(resetTurtleState(runningLiveWithPath).paths).toHaveLength(1);
      expect(resetTurtleState({ ...runningLiveWithPath, status: 'IDLE' }).paths).toHaveLength(0);
    });

    it('renders TELEPORT departure flash + landing ring, Live ♾️ toggle, and pointer world-coordinate conversion', () => {
      useAppStore.getState().setAppMode('sandbox');
      useAppStore.getState().setSimEnvironment('turtle');
      useAppStore.getState().setPointerState({ x: 85, y: -40, isDown: true });

      const teleportingState = {
        ...createInitialTurtleState(),
        mode: 'live' as const,
        activeAnimation: {
          type: 'TELEPORT' as const,
          fromPose: { x: 0, y: 0, heading: 0 },
          toPose: { x: 120, y: -80, heading: 90 },
          currentPose: { x: 120, y: -80, heading: 90 },
          progress: 0.6,
          duration: 320,
          startTime: 0,
          penDown: false,
          penColor: '#0f172a',
          penWidth: 6,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(TurtleCanvas, { state: teleportingState })
      );
      expect(html).toContain('data-testid="turtle-teleport-departure-flash"');
      expect(html).toContain('data-testid="turtle-teleport-landing-ring"');
      expect(html).toContain('data-testid="tool-loop-playback"');
      expect(html).toContain('data-testid="tool-turtle-live"');
      expect(html).toContain('data-testid="tool-turtle-live-clear"');
      expect(html).toContain('data-testid="turtle-pointer-reticle"');
      expect(html).toContain('data-testid="turtle-pointer-readout"');

      expect(
        screenToTurtleWorld(450, 200, { left: 100, top: 50, width: 600, height: 400 }, 0, 0, 1)
      ).toEqual({ x: 50, y: -50 });
      expect(
        screenToTurtleWorld(500, 250, { left: 100, top: 50, width: 600, height: 400 }, 50, -20, 2)
      ).toEqual({ x: 25, y: 10 });

      expect(
        workspaceUsesTurtlePointerOrTap({
          MAIN: [{ id: 't1', type: 'TELEPORT', params: { x: '$pointerX', y: '$pointerY', heading: 0 } }],
          F1: [],
          F2: [],
          F3: [],
        })
      ).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. BEAT & LIGHT PHASE 3
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Beat & Light Phase 3', () => {
    it('supports 1..16 C Major frequencies, DynamicsCompressorNode routing, Math.trunc pitch, and silent OOB rests', () => {
      expect(BEAT_SCALE_FREQUENCIES).toHaveLength(16);
      expect(BEAT_SCALE_FREQUENCIES[0]).toBeCloseTo(261.63, 2); // 1: C4
      expect(BEAT_SCALE_FREQUENCIES[7]).toBeCloseTo(523.25, 2); // 8: C5
      expect(BEAT_SCALE_FREQUENCIES[8]).toBeCloseTo(587.33, 2); // 9: D5
      expect(BEAT_SCALE_FREQUENCIES[15]).toBeCloseTo(1174.66, 2); // 16: D6
      expect(BEAT_PITCH_PARAM_DEF.options).toHaveLength(16);
      expect(BEAT_DURATION_PARAM_DEF.options?.map((o) => o.value)).toEqual([
        0.125, 0.25, 0.5, 1, 2, 4,
      ]);

      const prevAudioCtx = (globalThis as Record<string, unknown>).AudioContext;
      const createdContexts: Phase3MockAudioContext[] = [];
      (globalThis as Record<string, unknown>).AudioContext = function MockCtor() {
        const inst = new Phase3MockAudioContext();
        createdContexts.push(inst);
        return inst;
      };

      try {
        const synth = new BeatSynthEngine();
        synth.setSampleCacheEnabled(false);
        expect(synth.unlockFromGesture()).toBe(true);
        const ctx = createdContexts[0];

        // Fractional pitch 9.8 -> Math.trunc -> 9 (D5 = 587.33 Hz), routed via DynamicsCompressorNode
        synth.playNote(9.8, 0.25);
        expect(ctx.compressors).toHaveLength(1);
        expect(ctx.compressors[0].connectedTo).toBe(ctx.destination);
        expect(ctx.oscillators).toHaveLength(1);
        expect(ctx.oscillators[0].freq).toBeCloseTo(587.33, 2);

        // Pitch 16 -> D6 (1174.66 Hz)
        synth.playNote(16, 0.25);
        expect(ctx.oscillators).toHaveLength(2);
        expect(ctx.oscillators[1].freq).toBeCloseTo(1174.66, 2);

        // Out-of-range pitches (0, -3, 0.9, 17, 99) -> silent musical rests (zero new oscillators!)
        synth.playNote(0, 0.25);
        synth.playNote(-3, 0.25);
        synth.playNote(0.9, 0.25);
        synth.playNote(17, 0.25);
        synth.playNote(99, 0.25);
        expect(ctx.oscillators).toHaveLength(2);

        // Rest events still preserve rhythmic timing duration
        expect(
          getBeatEventSoundDurationMs(
            { kind: 'PLAY_NOTE', actionType: 'PLAY_NOTE', beatIndex: 1, pitch: 0, durationBeats: 1 },
            400
          )
        ).toBeGreaterThan(300);

        synth.resetForTests();
      } finally {
        (globalThis as Record<string, unknown>).AudioContext = prevAudioCtx;
      }
    });

    it('truncates pixel/row/col coords and performs silent no-ops for <0 / >7 0-based indices without edge clamping', () => {
      let state = createInitialBeatState();

      // Fractional 3.9 -> Math.trunc(3.9) - 1 = index 2 (1-based cell 3,3)
      state = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', state, {
        params: { x: 3.9, y: 2.7 },
      }).nextState;
      expect(state.leds[1][2]).toBe(state.activeColor);

      const snapshotBeforeOob = JSON.stringify(state.leds);

      // Out-of-bounds 1-based coords: 0 (-> -1), -4 (-> -5), 9 (-> 8), 0.4 (-> -1) must NOT clamp to 0 or 7!
      state = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', state, {
        params: { x: 0, y: 4 },
      }).nextState;
      state = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', state, {
        params: { x: 9, y: 4 },
      }).nextState;
      state = beatSimulationEnvironment.executeAction('LIGHT_ROW', state, {
        params: { y: 0 },
      }).nextState;
      state = beatSimulationEnvironment.executeAction('LIGHT_ROW', state, {
        params: { y: 12 },
      }).nextState;
      state = beatSimulationEnvironment.executeAction('LIGHT_COL', state, {
        params: { x: -2 },
      }).nextState;
      state = beatSimulationEnvironment.executeAction('LIGHT_COL', state, {
        params: { x: 9 },
      }).nextState;

      expect(JSON.stringify(state.leds)).toBe(snapshotBeforeOob);
    });

    it('supports SET_LED_COLOR TypedValue color / 0..9, $cursorX/$cursorY/$beatIndex sensors, and PLAY_NOTE variable pitch & fractional/var durations', () => {
      expect(resolveLedColor({ type: 'color', value: 'red' }, '#06b6d4')).toBe('#f43f5e');
      expect(resolveLedColor({ type: 'color', value: 'amber' }, '#06b6d4')).toBe('#fbbf24');
      expect(resolveLedColor({ type: 'color', value: 0 }, '#06b6d4')).toBe('#0f172a');
      expect(resolveLedColor('#8b5cf6', '#06b6d4')).toBe('#a855f7');
      expect(resolveLedColor(4, '#06b6d4')).toBe('#10b981');

      let state = createInitialBeatState();
      state = beatSimulationEnvironment.executeAction('CURSOR_STEP', state).nextState; // cursor (2, 1), beatIndex 1
      state = beatSimulationEnvironment.executeAction('CURSOR_TURN', state, {
        params: { direction: 'RIGHT' },
      }).nextState; // facing SOUTH, beatIndex 2
      state = beatSimulationEnvironment.executeAction('CURSOR_STEP', state).nextState; // cursor (2, 2), beatIndex 3

      expect(readBeatSensor('$cursorX', state)).toBe(2);
      expect(readBeatSensor(0xb0, state)).toBe(2);
      expect(readBeatSensor('$cursorY', state)).toBe(2);
      expect(readBeatSensor(0xb1, state)).toBe(2);
      expect(readBeatSensor('$beatIndex', state)).toBe(3);
      expect(readBeatSensor(0xb2, state)).toBe(3);

      // Run interpreter program reading $cursorX, $beatIndex, variable pitch 14, and fractional duration 0.125
      const ws: WorkspaceState = {
        MAIN: [
          { id: 's1', type: 'CURSOR_STEP' },
          { id: 'v1', type: 'VAR_ASSIGN', params: { a: 'p', b: 14 } },
          { id: 'v2', type: 'VAR_ASSIGN', params: { a: 'd', b: 2 } },
          { id: 'v3', type: 'VAR_ASSIGN', params: { a: 'x', b: '$cursorX' } },
          { id: 'n1', type: 'PLAY_NOTE', params: { pitch: 'p', duration: 'd' } },
          { id: 'n2', type: 'PLAY_NOTE', params: { pitch: 0, duration: 0.125 } },
          { id: 'v4', type: 'VAR_ASSIGN', params: { a: 'b', b: '$beatIndex' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      let rt = createInitialInterpreterState();
      let bState = createInitialBeatState();
      const noteEvents: Array<{ pitch?: number; durationBeats?: number }> = [];
      let lastSeenBeatIdx = -1;
      for (let guard = 0; guard < 20 && rt.callStack.length > 0; guard++) {
        const res = tickInterpreter(rt, ws, bState, beatSimulationEnvironment);
        rt = res.nextRuntime;
        bState = res.nextGrid;
        if (
          bState.lastTriggeredEvent?.kind === 'PLAY_NOTE' &&
          bState.lastTriggeredEvent.beatIndex !== lastSeenBeatIdx
        ) {
          lastSeenBeatIdx = bState.lastTriggeredEvent.beatIndex;
          noteEvents.push({
            pitch: bState.lastTriggeredEvent.pitch,
            durationBeats: bState.lastTriggeredEvent.durationBeats,
          });
        }
      }

      expect(rt.variables.x).toBe(2);
      expect(rt.variables.b).toBe(3);
      expect(noteEvents).toHaveLength(2);
      expect(noteEvents[0]).toEqual({ pitch: 14, durationBeats: 2 });
      expect(noteEvents[1]).toEqual({ pitch: 0, durationBeats: 0.125 });
    });

    it('round-trips Beat Phase 3 binary serialization (variable & fractional PLAY_NOTE duration, TypedValue color, ENV_VERSION_BEAT_V2)', () => {
      expect(ENV_VERSION_BEAT).toBe(1);
      expect(ENV_VERSION_BEAT_V2).toBe(2);
      expect(beatColorToByte({ type: 'color', value: 'purple' })).toBe(6);
      expect(beatColorToByte({ type: 'color', value: 'black' })).toBe(9);

      expect(getBeatParamVarFlags(OP_BEAT_PLAY_NOTE, { pitch: 'p', duration: 'd' })).toEqual({
        param0IsVar: true,
        param1IsVar: true,
      });

      // Extended fractional literal duration (0.125) + variable duration ('d') round-trip
      const wFrac = new BinaryWriter();
      writeBeatParams(wFrac, OP_BEAT_PLAY_NOTE, 'PLAY_NOTE', { pitch: 15, duration: 0.125 }, 0);
      expect(readBeatBlock(new BinaryReader(wFrac.getBytes()), OP_BEAT_PLAY_NOTE, 0)).toEqual({
        type: 'PLAY_NOTE',
        params: { pitch: 15, duration: 0.125 },
      });

      const wVar = new BinaryWriter();
      writeBeatParams(
        wVar,
        OP_BEAT_PLAY_NOTE,
        'PLAY_NOTE',
        { pitch: 'p', duration: 'd' },
        0x02 | 0x04
      );
      expect(
        readBeatBlock(new BinaryReader(wVar.getBytes()), OP_BEAT_PLAY_NOTE, 0x02 | 0x04)
      ).toEqual({
        type: 'PLAY_NOTE',
        params: { pitch: 'p', duration: 'd' },
      });

      const wColor = new BinaryWriter();
      writeBeatParams(
        wColor,
        OP_BEAT_SET_LED_COLOR,
        'SET_LED_COLOR',
        { color: { type: 'color', value: 'amber' } },
        0
      );
      expect(readBeatBlock(new BinaryReader(wColor.getBytes()), OP_BEAT_SET_LED_COLOR, 0)).toEqual(
        {
          type: 'SET_LED_COLOR',
          params: { color: '#fbbf24' },
        }
      );

      // Full codeSerializer round-trip keeping default Tier 1/2 workspace on ENV_VERSION_BEAT (1)
      const tier2Ws: WorkspaceState = {
        MAIN: [{ id: 'n_std', type: 'PLAY_NOTE', params: { pitch: 5, duration: 1 } }],
        F1: [],
        F2: [],
        F3: [],
      };
      const tier2Bytes = exportToBinary(tier2Ws, 'beat', createInitialBeatState());
      expect(tier2Bytes[2]).toBe(ENV_VERSION_BEAT);

      // BeatState v2 metadata round-trip
      const customBeat = {
        ...createInitialBeatState(true),
        width: 8,
        height: 8,
        stepDelayMultiplier: 0.25,
      };
      expect(getBeatSerializationVersion(customBeat)).toBe(ENV_VERSION_BEAT_V2);
      const stateWriter = new BinaryWriter();
      writeBeatState(stateWriter, customBeat, ENV_VERSION_BEAT_V2);
      const restoredBeat = readBeatState(
        new BinaryReader(stateWriter.getBytes()),
        ENV_VERSION_BEAT_V2
      );
      expect(restoredBeat.isMuted).toBe(true);
      expect(restoredBeat.stepDelayMultiplier).toBe(0.25);
    });

    it('quantizes BeatCanvas pointer pads to 0..7 and preserves exact SSR LED cell attribute markup', () => {
      const rect = { left: 100, top: 200, width: 320, height: 320 };
      expect(quantizeBeatPointerCell(102, 205, rect)).toEqual({ x: 0, y: 0 });
      expect(quantizeBeatPointerCell(419, 519, rect)).toEqual({ x: 7, y: 7 });
      expect(quantizeBeatPointerCell(265, 325, rect)).toEqual({ x: 4, y: 3 });
      // Clamps out-of-box drags cleanly into 0..7
      expect(quantizeBeatPointerCell(20, 900, rect)).toEqual({ x: 0, y: 7 });

      const ssrHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, {
          state: createInitialBeatState(),
          runtimeStatus: 'TYPE_ERROR',
        })
      );
      expect(ssrHtml).toContain(
        'data-testid="beat-led-0-0" data-coord="1,1" data-lit="false" data-color=""'
      );
      expect(ssrHtml).toContain('data-testid="beat-terminal-status"');
      expect(ssrHtml).toContain('🎨≠#');
    });
  });

  describe('UTF-8 Cleanliness Guard', () => {
    it('keeps all owned Phase 3 Grid, Turtle, Beat & serializer files free of UTF-8 mojibake', () => {
      const ownedPaths = [
        'src/simulations/grid/editorToolPrefs.ts',
        'src/simulations/grid/components/GridToolbarTools.tsx',
        'src/simulations/grid/components/BeaconAndDialLayer.tsx',
        'src/simulations/grid/gridEnvironment.tsx',
        'src/components/GridCanvas.tsx',
        'src/simulations/turtle/types.ts',
        'src/simulations/turtle/turtleEnvironment.tsx',
        'src/simulations/turtle/components/TurtleCanvas.tsx',
        'src/engine/serialization/env/turtleSerializer.ts',
        'src/simulations/beat/beatSynth.ts',
        'src/simulations/beat/beatEnvironment.tsx',
        'src/simulations/beat/components/BeatCanvas.tsx',
        'src/engine/serialization/env/beatSerializer.ts',
        'tests/envsPhase3GridTurtleBeat.test.ts',
      ];
      // Check against replacement char U+FFFD and classic CP1252-decoded UTF-8 sequences
      const mojibakePattern = new RegExp(
        '\\uFFFD|\\u00C3[\\u0080-\\u00BF]|\\u00E2\\u20AC|\\u00F0\\u0178'
      );
      for (const rel of ownedPaths) {
        const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
        expect(mojibakePattern.test(content), `Mojibake detected in ${rel}`).toBe(false);
      }
    });
  });
});
