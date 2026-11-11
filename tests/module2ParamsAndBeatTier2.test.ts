import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_2_BEAT_ALLOWED_BLOCKS,
  MODULE_2_PARAMS_ACTIVITIES,
  getActivitiesForModule,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import {
  BEAT_COLOR_PARAM_DEF,
  BEAT_COL_PARAM_DEF,
  BEAT_DURATION_PARAM_DEF,
  BEAT_PALETTE_ITEMS,
  BEAT_PITCH_PARAM_DEF,
  BEAT_PIXEL_X_PARAM_DEF,
  BEAT_PIXEL_Y_PARAM_DEF,
  BEAT_ROW_PARAM_DEF,
  BEAT_STAMP_PRESET_PARAM_DEF,
  beatSimulationEnvironment,
  createInitialBeatState,
} from '../src/simulations/beat/beatEnvironment';
import {
  BEAT_SCALE_FREQUENCIES,
  BeatSynthEngine,
  beatSynth,
} from '../src/simulations/beat/beatSynth';
import { BEAT_GRID_SIZE, BEAT_LED_PALETTE } from '../src/simulations/beat/types';
import {
  BEAT_STAMP_PRESETS,
  countLitLeds,
  createPresetLedGrid,
} from '../src/simulations/beat/presets';
import { TURTLE_COLOR_PARAM_DEF } from '../src/simulations/turtle/turtleEnvironment';
import {
  BeatDurationVisual,
  ColorVisual,
  GridCoordVisual,
  ParamVisual,
  PitchVisual,
  StampPresetVisual,
} from '../src/components/params/VisualParamBadges';
import { BlockParamBadge } from '../src/components/params/BlockParamBadge';
import { ParamSelectionPopover } from '../src/components/params/ParamSelectionPopover';
import { BlockPalette } from '../src/components/BlockPalette';
import {
  VariationCardsPanel,
  beatVariationPreviewPlayer,
  renderBeatVariationPreview,
  renderTurtleVariationPreview,
} from '../src/components/VariationCardsPanel';
import {
  exportLessonToString,
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_BEAT,
  ENV_VERSION_BEAT,
  FORMAT_VERSION,
  MASK_HAS_REP,
  MASK_HAS_VAR_PARAM,
  OP_BEAT_CLEAR_LEDS,
  OP_BEAT_DRUM_KICK,
  OP_BEAT_LIGHT_COL,
  OP_BEAT_LIGHT_PIXEL,
  OP_BEAT_LIGHT_ROW,
  OP_BEAT_PLAY_NOTE,
  OP_BEAT_SET_LED_COLOR,
  OP_BEAT_STAMP_PRESET,
  OP_BEAT_WAIT_BEAT,
} from '../src/engine/serialization/types';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';
import { WorkspaceState } from '../src/types';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';
import '../src/simulations/beat/beatEnvironment';

interface MockAudioLog {
  oscillatorsCreated: number;
  frequenciesScheduled: number[];
  stopTimesScheduled: number[];
}

function createNoteMockAudioContext(initialState: 'running' | 'suspended' = 'running') {
  const log: MockAudioLog = {
    oscillatorsCreated: 0,
    frequenciesScheduled: [],
    stopTimesScheduled: [],
  };

  class MockAudioContext {
    public state: 'running' | 'suspended' = initialState;
    public currentTime = 10;
    public sampleRate = 44100;
    public destination = {};

    resume() {
      if (initialState === 'running') {
        this.state = 'running';
        return Promise.resolve();
      }
      return Promise.reject(new Error('Autoplay blocked'));
    }

    addEventListener() {}

    createGain() {
      return {
        gain: {
          setValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
        disconnect: () => {},
      };
    }

    createOscillator() {
      log.oscillatorsCreated++;
      return {
        type: 'triangle',
        onended: null as (() => void) | null,
        frequency: {
          setValueAtTime: (hz: number) => {
            log.frequenciesScheduled.push(hz);
          },
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: (when?: number) => {
          if (typeof when === 'number') {
            log.stopTimesScheduled.push(when);
          }
        },
      };
    }
  }

  return { MockAudioContext, log };
}

describe('Wave 4 / Commit 13: Module 2 Action Parameters (2.1-2.4, 2B) & Beat Tier 2 Blocks (2.5)', () => {
  const originalAudioContext = (globalThis as any).AudioContext;

  beforeEach(() => {
    beatVariationPreviewPlayer.stop();
    clearPendingUpdateState();
    beatSynth.stopAll();
    beatSynth.setMuted(false);
    delete (globalThis as any).AudioContext;

    const s = useAppStore.getState();
    s.setAppMode('sandbox');
    s.setSimEnvironment('grid');
    s.setLevel(1);
    s.clearWorkspace();
    s.setSpeed(400);
    s.setEditorTool('NONE');
    useAppStore.setState({
      curriculumWorkspaces: {},
      sandboxSnapshot: null,
      activeActivityId: '1.1',
      activeActivityVersion: 1,
      statusAnnouncement: '',
    });
    useAppStore.getState().clearHistory();
  });

  afterEach(() => {
    beatVariationPreviewPlayer.stop();
    beatSynth.stopAll();
    beatSynth.setMuted(false);
    if (originalAudioContext === undefined) {
      delete (globalThis as any).AudioContext;
    } else {
      (globalThis as any).AudioContext = originalAudioContext;
    }
  });

  describe('1. Beat & Light Tier 2 Blocks, Synth Playback & Binary Serialization', () => {
    it('executes PLAY_NOTE (pitch 1..8, duration 0.5|1|2), SET_LED_COLOR, LIGHT_ROW, LIGHT_COL, LIGHT_PIXEL, and all 8 STAMP_PRESET icons', () => {
      let state = createInitialBeatState();

      // 1. PLAY_NOTE across pitches 1..8 and durations 0.5, 1, 2
      for (const dur of [0.5, 1, 2]) {
        state = beatSimulationEnvironment.executeAction('PLAY_NOTE', state, {
          params: { pitch: 6, duration: dur },
        }).nextState;
        expect(state.lastTriggeredEvent).toMatchObject({
          kind: 'PLAY_NOTE',
          actionType: 'PLAY_NOTE',
          pitch: 6,
          durationBeats: dur,
        });
      }

      // 2. SET_LED_COLOR persists across LIGHT_ROW, LIGHT_COL, LIGHT_PIXEL
      state = beatSimulationEnvironment.executeAction('SET_LED_COLOR', state, {
        params: { color: '#f43f5e' },
      }).nextState;
      expect(state.activeColor).toBe('#f43f5e');
      expect(state.isColorCustomized).toBe(true);

      // Row 3 (0-indexed row 2)
      state = beatSimulationEnvironment.executeAction('LIGHT_ROW', state, {
        params: { y: 3 },
      }).nextState;
      for (let c = 0; c < BEAT_GRID_SIZE; c++) {
        expect(state.leds[2][c]).toBe('#f43f5e');
      }
      expect(countLitLeds(state.leds)).toBe(8);

      // Switch color to Amber (#fbbf24) and light Column 5 (0-indexed col 4)
      state = beatSimulationEnvironment.executeAction('SET_LED_COLOR', state, {
        params: { color: '#fbbf24' },
      }).nextState;
      state = beatSimulationEnvironment.executeAction('LIGHT_COL', state, {
        params: { x: 5 },
      }).nextState;
      for (let r = 0; r < BEAT_GRID_SIZE; r++) {
        expect(state.leds[r][4]).toBe('#fbbf24');
      }
      // 8 in row 3 + 7 additional in col 5 = 15 lit LEDs
      expect(countLitLeds(state.leds)).toBe(15);

      // Light individual pixel (x: 8, y: 8) with numeric variable-resolved color 4 (Emerald #10b981)
      state = beatSimulationEnvironment.executeAction('SET_LED_COLOR', state, {
        params: { color: 4 },
      }).nextState;
      expect(state.activeColor).toBe('#10b981');
      state = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', state, {
        params: { x: 8, y: 8 },
      }).nextState;
      expect(state.leds[7][7]).toBe('#10b981');

      // 3. Verify all 8 STAMP_PRESET bitmaps with default colors and custom SET_LED_COLOR override
      for (const preset of BEAT_STAMP_PRESETS) {
        const defaultStampState = beatSimulationEnvironment.executeAction(
          'STAMP_PRESET',
          createInitialBeatState(),
          { params: { preset: preset.name } }
        ).nextState;
        expect(defaultStampState.lastTriggeredEvent?.preset).toBe(preset.name);
        expect(defaultStampState.leds).toEqual(
          createPresetLedGrid(preset.name, preset.defaultColor)
        );
      }
    });

    it('plays C4..C5 scale pitches with scaled 0.5|1|2 beat durations when unlocked and stays safe when AudioContext is unavailable or suspended', () => {
      // Unavailable AudioContext: never throws
      const headlessSynth = new BeatSynthEngine();
      expect(headlessSynth.getAudioStatus()).toBe('unavailable');
      expect(() => {
        headlessSynth.playEvent(
          {
            kind: 'PLAY_NOTE',
            actionType: 'PLAY_NOTE',
            beatIndex: 1,
            pitch: 8,
            durationBeats: 2,
          },
          400
        );
      }).not.toThrow();

      // Suspended AudioContext: marks needsSoundUnlock without scheduling nodes
      const suspended = createNoteMockAudioContext('suspended');
      (globalThis as any).AudioContext = suspended.MockAudioContext;
      const suspendedSynth = new BeatSynthEngine();
      suspendedSynth.unlockFromGesture();
      suspendedSynth.playEvent(
        {
          kind: 'PLAY_NOTE',
          actionType: 'PLAY_NOTE',
          beatIndex: 1,
          pitch: 3,
          durationBeats: 0.5,
        },
        400
      );
      expect(suspendedSynth.needsSoundUnlock()).toBe(true);
      expect(suspended.log.oscillatorsCreated).toBe(0);

      // Running AudioContext: schedules exact C4..C5 frequencies and scales duration with 0.5 | 1 | 2 beats
      const running = createNoteMockAudioContext('running');
      (globalThis as any).AudioContext = running.MockAudioContext;
      const activeSynth = new BeatSynthEngine();
      expect(activeSynth.unlockFromGesture()).toBe(true);

      activeSynth.playEvent(
        {
          kind: 'PLAY_NOTE',
          actionType: 'PLAY_NOTE',
          beatIndex: 1,
          pitch: 1,
          durationBeats: 0.5,
        },
        400
      );
      activeSynth.playEvent(
        {
          kind: 'PLAY_NOTE',
          actionType: 'PLAY_NOTE',
          beatIndex: 2,
          pitch: 8,
          durationBeats: 2,
        },
        400
      );

      // Each note schedules 1 triangle oscillator with exact scale frequency & duration envelope
      expect(running.log.oscillatorsCreated).toBe(2);
      expect(running.log.frequenciesScheduled[0]).toBeCloseTo(BEAT_SCALE_FREQUENCIES[0], 2); // C4
      expect(running.log.frequenciesScheduled[1]).toBeCloseTo(BEAT_SCALE_FREQUENCIES[7], 2); // C5
      // 2-beat note stops strictly later than 0.5-beat note
      expect(running.log.stopTimesScheduled[1]).toBeGreaterThan(
        running.log.stopTimesScheduled[0] + 0.3
      );
    });

    it('round-trips Tier 2 opcodes (0x17..0x1B, 0x14 STAMP_PRESET), HasRep, and MASK_HAS_VAR_PARAM while keeping Tier 1 saves byte-identical', () => {
      // 1. Verify Tier 1 binary layout remains 100% byte-identical
      const tier1Ws: WorkspaceState = {
        MAIN: [
          { id: 't1', type: 'DRUM_KICK', repeatCount: 2 },
          { id: 't2', type: 'STAMP_HEART' },
          { id: 't3', type: 'WAIT_BEAT' },
          { id: 't4', type: 'CLEAR_LEDS' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const tier1Bytes = Array.from(exportToBinary(tier1Ws, 'beat', createInitialBeatState()));
      expect(tier1Bytes).toEqual([
        FORMAT_VERSION,
        ENV_ID_BEAT,
        ENV_VERSION_BEAT,
        1, // 1 scope
        0, // MAIN
        4, // 4 blocks
        OP_BEAT_DRUM_KICK | MASK_HAS_REP,
        2,
        OP_BEAT_STAMP_PRESET,
        0, // STAMP_HEART
        OP_BEAT_WAIT_BEAT,
        OP_BEAT_CLEAR_LEDS,
      ]);

      // 2. Verify Tier 2 opcodes + repeat counts + variable parameters
      const tier2Ws: WorkspaceState = {
        MAIN: [
          { id: 'n1', type: 'PLAY_NOTE', repeatCount: 3, params: { pitch: 5, duration: 0.5 } },
          { id: 'n2', type: 'PLAY_NOTE', params: { pitch: 8, duration: 2 } },
          { id: 'c1', type: 'SET_LED_COLOR', params: { color: '#a855f7' } },
          { id: 'r1', type: 'LIGHT_ROW', params: { y: 4 } },
          { id: 'col1', type: 'LIGHT_COL', params: { x: 7 } },
          { id: 'px1', type: 'LIGHT_PIXEL', params: { x: 2, y: 6 } },
          { id: 'st1', type: 'STAMP_PRESET', params: { preset: 'ROBOT' } },
          { id: 'st2', type: 'STAMP_PRESET', params: { preset: 'STAR' } },
        ],
        F1: [
          { id: 'vn1', type: 'PLAY_NOTE', repeatCount: 'n', params: { pitch: 'a', duration: 1 } },
          { id: 'vc1', type: 'SET_LED_COLOR', params: { color: 'c' } },
          { id: 'vr1', type: 'LIGHT_ROW', params: { y: 'y' } },
          { id: 'vcol1', type: 'LIGHT_COL', params: { x: 'x' } },
          { id: 'vpx1', type: 'LIGHT_PIXEL', params: { x: 'x', y: 'y' } },
        ],
        F2: [],
        F3: [],
      };

      const bin = exportToBinary(tier2Ws, 'beat', createInitialBeatState());
      expect(bin[6]).toBe(OP_BEAT_PLAY_NOTE | MASK_HAS_REP);
      expect(bin).toContain(OP_BEAT_SET_LED_COLOR);
      expect(bin).toContain(OP_BEAT_LIGHT_ROW);
      expect(bin).toContain(OP_BEAT_LIGHT_COL);
      expect(bin).toContain(OP_BEAT_LIGHT_PIXEL);
      expect(bin).toContain(OP_BEAT_LIGHT_PIXEL | MASK_HAS_VAR_PARAM);

      const decoded = importFromBinary(bin);
      expect(decoded.success).toBe(true);
      expect(decoded.envId).toBe('beat');
      expect(
        decoded.workspace?.MAIN.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      ).toEqual([
        { type: 'PLAY_NOTE', repeatCount: 3, params: { pitch: 5, duration: 0.5 } },
        { type: 'PLAY_NOTE', repeatCount: undefined, params: { pitch: 8, duration: 2 } },
        { type: 'SET_LED_COLOR', repeatCount: undefined, params: { color: '#a855f7' } },
        { type: 'LIGHT_ROW', repeatCount: undefined, params: { y: 4 } },
        { type: 'LIGHT_COL', repeatCount: undefined, params: { x: 7 } },
        { type: 'LIGHT_PIXEL', repeatCount: undefined, params: { x: 2, y: 6 } },
        { type: 'STAMP_PRESET', repeatCount: undefined, params: { preset: 'ROBOT' } },
        { type: 'STAMP_PRESET', repeatCount: undefined, params: { preset: 'STAR' } },
      ]);

      expect(
        decoded.workspace?.F1.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      ).toEqual([
        { type: 'PLAY_NOTE', repeatCount: 'n', params: { pitch: 'a', duration: 1 } },
        { type: 'SET_LED_COLOR', repeatCount: undefined, params: { color: 'c' } },
        { type: 'LIGHT_ROW', repeatCount: undefined, params: { y: 'y' } },
        { type: 'LIGHT_COL', repeatCount: undefined, params: { x: 'x' } },
        { type: 'LIGHT_PIXEL', repeatCount: undefined, params: { x: 'x', y: 'y' } },
      ]);

      // Base64URL string + ENV_ID_LESSON (0x04) wrapper round-trip on Activity 2.5
      const act25 = getActivityLatest('2.5')!;
      const lessonEncoded = exportLessonToString(
        act25.starterWorkspace!,
        'beat',
        act25.id,
        act25.version
      );
      const lessonDecoded = importFromString(lessonEncoded);
      expect(lessonDecoded.success).toBe(true);
      expect(lessonDecoded.envId).toBe('lesson');
      expect(lessonDecoded.innerEnvId).toBe('beat');
      expect(lessonDecoded.lessonId).toBe('2.5');
      expect(lessonDecoded.lessonVersion).toBe(1);
      expect(lessonDecoded.workspace?.MAIN).toHaveLength(act25.starterWorkspace!.MAIN.length);
    });
  });

  describe('2. Visual Parameter Badges, Color-Blind Shape Cues & Accessibility', () => {
    it('renders stepped PitchVisual (1..8), BeatDurationVisual (½|1|2), StampPresetVisual (8x8), and GridCoordVisual (row/col/pixel)', () => {
      const pitch1Html = renderToStaticMarkup(React.createElement(PitchVisual, { pitch: 1 }));
      const pitch8Html = renderToStaticMarkup(React.createElement(PitchVisual, { pitch: 8 }));
      expect(pitch1Html).toContain('data-testid="pitch-visual-1"');
      expect(pitch1Html).toContain('♪1');
      expect(pitch8Html).toContain('data-testid="pitch-visual-8"');
      expect(pitch8Html).toContain('♪8');
      // 8 stepped rect bars in SVG
      expect((pitch8Html.match(/<rect /g) || []).length).toBe(8);

      const durHalfHtml = renderToStaticMarkup(
        React.createElement(BeatDurationVisual, { duration: 0.5 })
      );
      const durOneHtml = renderToStaticMarkup(
        React.createElement(BeatDurationVisual, { duration: 1 })
      );
      const durTwoHtml = renderToStaticMarkup(
        React.createElement(BeatDurationVisual, { duration: 2 })
      );
      expect(durHalfHtml).toContain('½');
      expect(durOneHtml).toContain('>1<');
      expect(durTwoHtml).toContain('>2<');

      const robotStampHtml = renderToStaticMarkup(
        React.createElement(StampPresetVisual, { preset: 'ROBOT' })
      );
      expect(robotStampHtml).toContain('data-testid="stamp-preset-visual-ROBOT"');
      expect((robotStampHtml.match(/<rect /g) || []).length).toBe(64);

      const rowHtml = renderToStaticMarkup(
        React.createElement(ParamVisual, {
          paramDef: BEAT_ROW_PARAM_DEF,
          value: 3,
          actionType: 'LIGHT_ROW',
        })
      );
      const colHtml = renderToStaticMarkup(
        React.createElement(ParamVisual, {
          paramDef: BEAT_COL_PARAM_DEF,
          value: 6,
          actionType: 'LIGHT_COL',
        })
      );
      const pxXHtml = renderToStaticMarkup(
        React.createElement(ParamVisual, {
          paramDef: BEAT_PIXEL_X_PARAM_DEF,
          value: 2,
          actionType: 'LIGHT_PIXEL',
        })
      );
      const pxYHtml = renderToStaticMarkup(
        React.createElement(ParamVisual, {
          paramDef: BEAT_PIXEL_Y_PARAM_DEF,
          value: 7,
          actionType: 'LIGHT_PIXEL',
        })
      );
      expect(rowHtml).toContain('data-testid="grid-coord-visual-row-3"');
      expect(colHtml).toContain('data-testid="grid-coord-visual-col-6"');
      expect(pxXHtml).toContain('>2<');
      expect(pxXHtml).not.toContain('→');
      expect(pxYHtml).toContain('>7<');
      expect(pxYHtml).not.toContain('↓');
      expect(
        renderToStaticMarkup(React.createElement(GridCoordVisual, { coord: 4, variant: 'row' }))
      ).toContain('4');
    });

    it('renders clean symbol-free color swatches on all Beat and Turtle color pickers', () => {
      const forbiddenSymbols = ['●', '▲', '★', '■', '◆', '⬟', '⬢', '✦'];
      for (const swatch of BEAT_LED_PALETTE) {
        const html = renderToStaticMarkup(
          React.createElement(ColorVisual, { color: swatch.hex, size: 24 })
        );
        expect(html).toContain('data-testid="color-swatch-visual"');
        expect(html).not.toContain('data-shape-cue');
        for (const sym of forbiddenSymbols) {
          expect(html).not.toContain(sym);
        }
      }

      for (const opt of TURTLE_COLOR_PARAM_DEF.options) {
        const html = renderToStaticMarkup(
          React.createElement(ColorVisual, { color: String(opt.value), size: 24 })
        );
        expect(html).toContain('data-testid="color-swatch-visual"');
        expect(html).not.toContain('data-shape-cue');
        for (const sym of forbiddenSymbols) {
          expect(html).not.toContain(sym);
        }
      }
    });

    it('enforces >= 36px/44px touch targets, ARIA dialog/pressed attributes, and staged variable gating on BlockParamBadge & ParamSelectionPopover', () => {
      const badgeHtml = renderToStaticMarkup(
        React.createElement(BlockParamBadge, {
          paramDef: BEAT_PITCH_PARAM_DEF,
          value: 4,
          onChange: () => {},
          actionType: 'PLAY_NOTE',
        })
      );
      expect(badgeHtml).toContain('data-testid="block-param-badge-pitch"');
      expect(badgeHtml).toContain('min-w-[36px]');
      expect(badgeHtml).toContain('md:min-w-[44px]');
      expect(badgeHtml).toContain('aria-haspopup="dialog"');

      // In Module 2 (2.5), variables are gated off in ParamSelectionPopover
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('2.5');

      const pitchPopoverM2 = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: BEAT_PITCH_PARAM_DEF,
          currentValue: 5,
          onSelect: () => {},
          onClose: () => {},
          actionType: 'PLAY_NOTE',
        })
      );
      expect(pitchPopoverM2).toContain('role="dialog"');
      expect(pitchPopoverM2).toContain('data-testid="param-option-5"');
      expect(pitchPopoverM2).toContain('aria-pressed="true"');
      expect(pitchPopoverM2).toContain('min-w-[36px]');
      expect(pitchPopoverM2).not.toContain('param-option-var-');

      // In Sandbox mode (where variables are unlocked), pitch and gridCoord expose variable pickers while duration/preset do not
      store.setAppMode('sandbox');
      const pitchPopoverSandbox = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: BEAT_PITCH_PARAM_DEF,
          currentValue: 5,
          onSelect: () => {},
          onClose: () => {},
          actionType: 'PLAY_NOTE',
        })
      );
      expect(pitchPopoverSandbox).toContain('data-testid="param-option-var-a"');

      const durPopoverSandbox = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: BEAT_DURATION_PARAM_DEF,
          currentValue: 1,
          onSelect: () => {},
          onClose: () => {},
          actionType: 'PLAY_NOTE',
        })
      );
      expect(durPopoverSandbox).not.toContain('param-option-var-');

      const presetPopoverSandbox = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: BEAT_STAMP_PRESET_PARAM_DEF,
          currentValue: 'HEART',
          onSelect: () => {},
          onClose: () => {},
          actionType: 'STAMP_PRESET',
        })
      );
      expect(presetPopoverSandbox).toContain('data-testid="param-option-ROBOT"');
      expect(presetPopoverSandbox).not.toContain('param-option-var-');
      expect(BEAT_COLOR_PARAM_DEF.options).toHaveLength(8);
    });
  });

  describe('3. Activity 2.1 Constraint Solver Anti-Bypass Proof (< 200 ms)', () => {
    it('proves 2.1 solves in 5 blocks with ×N badges, has valid ? scaffold, requires >= 9 blocks unrolled, and has 0 bypasses in <= 5 slots without ×N', () => {
      const act21 = getActivityLatest('2.1');
      expect(act21).toBeDefined();
      expect(isValidatedPuzzleActivity(act21!)).toBe(true);
      expect(act21!.grid?.width).toBe(6);
      expect(act21!.grid?.height).toBe(5);
      expect(act21!.slotCap?.maxTotal).toBe(5);
      expect(act21!.palette.allowRepeatBadges).toBe(true);
      expect(act21!.palette.allowActionParams).toBe(false);
      expect(act21!.referenceSolution!.MAIN.length).toBeGreaterThanOrEqual(4);
      expect(act21!.referenceSolution!.MAIN.length).toBeLessThanOrEqual(5);

      const report = verifyActivityConstraints(act21!);
      console.info(
        `[2.1 Solver Proof] elapsedMs=${report.elapsedMs.toFixed(2)}ms, minWinningBlocks(noRepeat)=${report.ruleResults[0]?.minWinningBlocks}, exploredStates=${report.ruleResults[0]?.exploredStates}`
      );
      expect(report.passed).toBe(true);
      expect(report.elapsedMs).toBeLessThan(200);
      expect(report.referenceCheck.passed).toBe(true);
      expect(report.scaffoldCheck.applicable).toBe(true);
      expect(report.scaffoldCheck.passed).toBe(true);
      expect(report.scaffoldCheck.placeholderCount).toBeGreaterThanOrEqual(1);

      expect(report.slotCap).toBe(5);
      expect(report.referenceCheck.slotLimit).toBe(5);
      expect(report.ruleResults).toHaveLength(1);
      const noRepeatRule = report.ruleResults[0];
      expect(noRepeatRule.passed).toBe(true);
      expect(noRepeatRule.counterexampleWorkspace).toBeUndefined();
      expect(noRepeatRule.minWinningBlocks).not.toBeNull();
      expect(noRepeatRule.minWinningBlocks!).toBeGreaterThanOrEqual(9);
    });
  });

  describe('4. Module 2 Creative Lessons (2.2-2.5) & Capstone 2B Execution, Thumbnails & Staged Palettes', () => {
    it('registers 2.1-2.5 and 2B in MODULE_2_PARAMS_ACTIVITIES and CURRICULUM_ACTIVITIES', () => {
      expect(MODULE_2_PARAMS_ACTIVITIES.map((a) => a.id)).toEqual([
        '2.1',
        '2.2',
        '2.3',
        '2.4',
        '2.5',
        '2B',
      ]);
      const m2Ids = getActivitiesForModule('module-2').map((a) => a.id);
      for (const id of ['2.1', '2.2', '2.3', '2.4', '2.5', '2B']) {
        expect(m2Ids).toContain(id);
        expect(CURRICULUM_ACTIVITIES.some((a) => a.id === id)).toBe(true);
      }

      const cap2B = getActivityLatest('2B')!;
      expect(cap2B.format).toBe('capstone');
      expect(cap2B.capstoneType).toBe('creative');
      expect(cap2B.simId).toBe('turtle');
      expect(cap2B.icon).toBe('🎨');
      expect(isValidatedPuzzleActivity(cap2B)).toBe(false);
    });

    it('executes starter and all 3 variations for LOGO lessons 2.2, 2.3, 2.4, and Capstone 2B with distinct SVG thumbnails', () => {
      for (const id of ['2.2', '2.3', '2.4', '2B']) {
        const act = getActivityLatest(id)!;
        expect(act.simId).toBe('turtle');
        expect(act.palette.allowActionParams).toBe(true);
        expect(act.palette.allowRepeatBadges).toBe(true);
        expect(act.palette.allowVariables).toBe(false);
        expect(act.palette.allowedControlBlocks).toEqual([]);

        const maxBudget = id === '2B' ? 24 : 12;
        const minBudget = id === '2B' ? 10 : 4;
        expect(act.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(minBudget);
        expect(act.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(maxBudget);

        const starterPreview = renderTurtleVariationPreview(act.starterWorkspace!);
        expect(starterPreview.finalState.paths.length).toBeGreaterThanOrEqual(3);
        expect(starterPreview.svgMarkup).toContain('<svg');

        expect(act.variations).toHaveLength(3);
        const cardSvgs = new Set<string>();
        for (const card of act.variations!) {
          expect(card.workspace.MAIN.length).toBeGreaterThanOrEqual(minBudget);
          expect(card.workspace.MAIN.length).toBeLessThanOrEqual(maxBudget);
          // Every block in starter/variation uses an allowed sim block
          for (const blk of card.workspace.MAIN) {
            expect(act.palette.allowedSimBlocks).toContain(blk.type);
          }
          const preview = renderTurtleVariationPreview(card.workspace);
          expect(preview.finalState.paths.length).toBeGreaterThanOrEqual(3);
          cardSvgs.add(preview.svgMarkup);
        }
        expect(cardSvgs.size).toBe(3);
      }

      // Verify Capstone 2B Winking Emoji & Bullseye Shield geometry
      const getArcCenter = (arc: {
        fromX: number;
        fromY: number;
        startHeading: number;
        radius: number;
        sweepAngle: number;
      }) => {
        const rad = (arc.startHeading * Math.PI) / 180;
        const sign = arc.sweepAngle >= 0 ? 1 : -1;
        return {
          cx: arc.fromX + sign * arc.radius * Math.cos(rad),
          cy: arc.fromY + sign * arc.radius * Math.sin(rad),
        };
      };

      const cap2B = getActivityLatest('2B')!;
      const emojiCard = cap2B.variations!.find((v) => v.id === '2B-winking-emoji')!;
      const emojiState = renderTurtleVariationPreview(emojiCard.workspace).finalState;
      expect(emojiState.paths).toHaveLength(4);
      const [faceArc, smileArc, winkArc, openEyeLine] = emojiState.paths;
      expect(faceArc.type).toBe('ARC');
      if (faceArc.type === 'ARC') {
        expect(faceArc.radius).toBe(100);
        expect(faceArc.sweepAngle).toBe(360);
        const c = getArcCenter(faceArc);
        expect(c.cx).toBeCloseTo(100, 3);
        expect(c.cy).toBeCloseTo(0, 3);
      }
      expect(smileArc.type).toBe('ARC');
      if (smileArc.type === 'ARC') {
        expect(smileArc.radius).toBe(75);
        expect(smileArc.sweepAngle).toBe(-180);
        const c = getArcCenter(smileArc);
        expect(c.cx).toBeCloseTo(100, 3);
        expect(c.cy).toBeCloseTo(0, 3);
      }
      expect(winkArc.type).toBe('ARC');
      if (winkArc.type === 'ARC') {
        expect(winkArc.radius).toBe(25);
        expect(winkArc.sweepAngle).toBe(-180);
        const c = getArcCenter(winkArc);
        expect(c.cx).toBeCloseTo(150, 3);
        expect(c.cy).toBeCloseTo(-25, 3);
      }
      expect(openEyeLine.type).toBe('LINE');
      if (openEyeLine.type === 'LINE') {
        expect(openEyeLine.fromX).toBeCloseTo(50, 3);
        expect(openEyeLine.toX).toBeCloseTo(50, 3);
        expect(openEyeLine.fromY).toBeCloseTo(-25, 3);
        expect(openEyeLine.toY).toBeCloseTo(-50, 3);
      }

      const shieldCard = cap2B.variations!.find((v) => v.id === '2B-bullseye-shield')!;
      const shieldState = renderTurtleVariationPreview(shieldCard.workspace).finalState;
      expect(shieldState.paths).toHaveLength(3);
      const radii = shieldState.paths.map((p) => (p.type === 'ARC' ? p.radius : 0));
      expect(radii).toEqual([75, 50, 25]);
      for (const ring of shieldState.paths) {
        expect(ring.type).toBe('ARC');
        if (ring.type === 'ARC') {
          const c = getArcCenter(ring);
          expect(c.cx).toBeCloseTo(75, 3);
          expect(c.cy).toBeCloseTo(0, 3);
          expect(ring.sweepAngle).toBe(360);
        }
      }
    });

    it('executes 2.5 Beat & Light starter and all 3 playable variations with lit 8x8 frames and staged Tier 2 palette', () => {
      const act25 = getActivityLatest('2.5')!;
      expect(act25.simId).toBe('beat');
      expect(act25.palette.allowedSimBlocks).toEqual(MODULE_2_BEAT_ALLOWED_BLOCKS);
      expect(act25.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(6);
      expect(act25.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(10);

      const starterBeat = runHeadlessSimulation(
        act25.starterWorkspace!,
        'beat',
        createInitialBeatState(true)
      );
      expect(countLitLeds(starterBeat.finalState.leds)).toBeGreaterThanOrEqual(16);

      expect(act25.variations).toHaveLength(3);
      const cardThumbs = new Set<string>();
      for (const card of act25.variations!) {
        expect(card.workspace.MAIN.length).toBeGreaterThanOrEqual(6);
        expect(card.workspace.MAIN.length).toBeLessThanOrEqual(10);
        for (const blk of card.workspace.MAIN) {
          expect(act25.palette.allowedSimBlocks).toContain(blk.type);
        }
        const preview = renderBeatVariationPreview(card.workspace);
        expect(preview.totalBeats).toBeGreaterThanOrEqual(6);
        expect(countLitLeds(preview.representativeState.leds)).toBeGreaterThan(0);
        cardThumbs.add(preview.svgMarkup);
      }
      expect(cardThumbs.size).toBe(3);

      // Verify staged BlockPalette & VariationCardsPanel render cleanly in Curriculum Mode
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('2.5');
      expect(useAppStore.getState().activeSimId).toBe('beat');

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('Play Note');
      expect(paletteHtml).toContain('Set LED Color');
      expect(paletteHtml).toContain('Light LED Row');
      expect(paletteHtml).toContain('Light LED Column');
      expect(paletteHtml).toContain('Light LED Pixel');
      expect(paletteHtml).toContain('Stamp Icon');
      expect(paletteHtml).toContain('data-testid="palette-number-2"');
      expect(paletteHtml).not.toContain('data-testid="palette-loop-start"');
      expect(paletteHtml).not.toContain('data-testid="palette-var-assign"');

      const cardsHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(cardsHtml).toContain('Doorbell Chime');
      expect(cardsHtml).toContain('Traffic-Light Countdown');
      expect(cardsHtml).toContain('Rising Color Bar &amp; Bassline');
      expect(BEAT_PALETTE_ITEMS.length).toBe(15);
    });
  });
});
