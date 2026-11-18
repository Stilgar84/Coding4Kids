import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceState } from '../src/types';
import {
  BEAT_GRID_SIZE,
  DEFAULT_BEAT_LED_COLOR,
} from '../src/simulations/beat/types';
import {
  BEAT_PRESETS,
  countLitLeds,
  createEmptyLedGrid,
  createPresetLedGrid,
  isBeatLedOffHex as isPresetBeatLedOffHex,
  presetIdToName,
  presetNameToId,
} from '../src/simulations/beat/presets';
import {
  BEAT_DELAY_PARAM_DEF,
  BEAT_PALETTE_ITEMS,
  beatSimulationEnvironment,
  createInitialBeatState,
  isBeatLedOffHex,
  resetBeatState,
} from '../src/simulations/beat/beatEnvironment';
import { BeatCanvas } from '../src/simulations/beat/components/BeatCanvas';
import { BeatSynthEngine, beatSynth } from '../src/simulations/beat/beatSynth';
import {
  ENV_ID_BEAT,
  ENV_ID_GENERIC,
  ENV_ID_GRID,
  ENV_ID_TURTLE,
  ENV_VERSION_BEAT,
  FORMAT_VERSION,
  MASK_HAS_REP,
  OP_BEAT_CLEAR_LEDS,
  OP_BEAT_DRUM_CLAP,
  OP_BEAT_DRUM_KICK,
  OP_BEAT_DRUM_SNARE,
  OP_BEAT_PLAY_CHIME,
  OP_BEAT_STAMP_PRESET,
  OP_BEAT_WAIT_BEAT,
} from '../src/engine/serialization/types';
import {
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  generateBeatMapThumbnail,
  generateSimulationThumbnail,
  renderBeatMapSvg,
} from '../src/services/mapThumbnailGenerator';
import {
  clearAllSavedPrograms,
  getSavedPrograms,
  migrateSavedEntry,
  saveProgram,
} from '../src/services/localSaveService';
import {
  clearPendingUpdateState,
  consumeRestoredStateAfterUpdate,
  saveStateBeforeUpdate,
} from '../src/services/pwaStateRestoreService';
import { createEmptyWorkspace, useAppStore } from '../src/store/useAppStore';

interface MockAudioLog {
  oscillatorsCreated: number;
  oscillatorsStopped: number;
  bufferSourcesCreated: number;
  bufferSourcesStopped: number;
  filtersCreated: number;
  gainsCreated: number;
  resumesCalled: number;
}

function createMockAudioContextFactory(
  initialState: 'running' | 'suspended' = 'running',
  autoResumeOnGesture = true
) {
  const log: MockAudioLog = {
    oscillatorsCreated: 0,
    oscillatorsStopped: 0,
    bufferSourcesCreated: 0,
    bufferSourcesStopped: 0,
    filtersCreated: 0,
    gainsCreated: 0,
    resumesCalled: 0,
  };

  class MockAudioContext {
    state: 'running' | 'suspended' = initialState;
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    private listeners: Array<() => void> = [];

    addEventListener(_event: string, cb: () => void) {
      this.listeners.push(cb);
    }

    resume() {
      log.resumesCalled++;
      if (autoResumeOnGesture) {
        this.state = 'running';
        this.listeners.forEach((cb) => cb());
        return Promise.resolve();
      }
      return Promise.reject(new Error('Autoplay blocked by browser policy'));
    }

    close() {
      return Promise.resolve();
    }

    createGain() {
      log.gainsCreated++;
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    createOscillator() {
      log.oscillatorsCreated++;
      const node: any = {
        type: 'sine',
        onended: null,
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(() => {
          log.oscillatorsStopped++;
        }),
      };
      return node;
    }

    createBiquadFilter() {
      log.filtersCreated++;
      return {
        type: 'highpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    createBuffer(_channels: number, length: number, _sampleRate: number) {
      const channel = new Float32Array(length);
      return {
        getChannelData: () => channel,
      };
    }

    createBufferSource() {
      log.bufferSourcesCreated++;
      const node: any = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(() => {
          log.bufferSourcesStopped++;
        }),
      };
      return node;
    }
  }

  return { MockAudioContext, log };
}

describe('Beat & Light Matrix Environment (Commit 10)', () => {
  const originalAudioContext = (globalThis as any).AudioContext;
  const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;

  beforeEach(() => {
    delete (globalThis as any).AudioContext;
    delete (globalThis as any).webkitAudioContext;
    beatSynth.resetForTests();
    clearAllSavedPrograms();
    clearPendingUpdateState();

    const store = useAppStore.getState();
    store.pause();
    store.setAppMode('sandbox');
    store.setSpeed(400);
    store.setSimEnvironment('grid');
    store.clearWorkspace();
    store.setBeatMuted(false);
    useAppStore.setState({
      savedWorkspaces: {},
      curriculumWorkspaces: {},
      sandboxSnapshot: null,
    });
    store.clearHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalAudioContext !== undefined) {
      (globalThis as any).AudioContext = originalAudioContext;
    } else {
      delete (globalThis as any).AudioContext;
    }
    if (originalWebkitAudioContext !== undefined) {
      (globalThis as any).webkitAudioContext = originalWebkitAudioContext;
    } else {
      delete (globalThis as any).webkitAudioContext;
    }
    beatSynth.resetForTests();
  });

  describe('8x8 RGB LED Matrix State & Tier 1 Block Execution', () => {
    it('creates an clean 8x8 initial BeatState with cursor at (1, 1) facing EAST', () => {
      const initial = createInitialBeatState();
      expect(initial.leds).toHaveLength(BEAT_GRID_SIZE);
      for (const row of initial.leds) {
        expect(row).toHaveLength(BEAT_GRID_SIZE);
        expect(row.every((c) => c === null)).toBe(true);
      }
      expect(countLitLeds(initial.leds)).toBe(0);
      expect(initial.activeColor).toBe(DEFAULT_BEAT_LED_COLOR);
      expect(initial.beatIndex).toBe(0);
      expect(initial.stepCount).toBe(0);
      expect(initial.lastTriggeredEvent).toBeNull();
      expect(initial.cursor).toEqual({
        x: 1,
        y: 1,
        dir: 'EAST',
        visible: false,
      });
      expect(initial.status).toBe('IDLE');
    });

    it('registers all 9 zero-param Tier 1, 6 parameterized Tier 2, and 2 Tier 3 cursor blocks in BEAT_PALETTE_ITEMS', () => {
      const actionTypes = BEAT_PALETTE_ITEMS.map((item) => item.actionType);
      expect(actionTypes.slice(0, 9)).toEqual([
        'DRUM_KICK',
        'DRUM_SNARE',
        'DRUM_CLAP',
        'PLAY_CHIME',
        'STAMP_HEART',
        'STAMP_STAR',
        'STAMP_SMILE',
        'WAIT_BEAT',
        'CLEAR_LEDS',
      ]);
      expect(actionTypes.slice(9, 15)).toEqual([
        'PLAY_NOTE',
        'SET_LED_COLOR',
        'LIGHT_ROW',
        'LIGHT_COL',
        'LIGHT_PIXEL',
        'STAMP_PRESET',
      ]);
      expect(actionTypes.slice(15)).toEqual(['CURSOR_STEP', 'CURSOR_TURN', 'SET_BEAT_DELAY']);

      // Repeatable rhythm/melody/cursor-step blocks vs non-repeatable stamp/clear/LED state/cursor-turn blocks
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'DRUM_KICK')?.supportsRepeat).toBe(true);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'WAIT_BEAT')?.supportsRepeat).toBe(true);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'PLAY_NOTE')?.supportsRepeat).toBe(true);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'CURSOR_STEP')?.supportsRepeat).toBe(true);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'STAMP_HEART')?.supportsRepeat).toBe(false);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'CLEAR_LEDS')?.supportsRepeat).toBe(false);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'SET_LED_COLOR')?.supportsRepeat).toBe(false);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'STAMP_PRESET')?.supportsRepeat).toBe(false);
      expect(BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'CURSOR_TURN')?.supportsRepeat).toBe(false);
    });

    it('executes DRUM_KICK, DRUM_SNARE, DRUM_CLAP, and PLAY_CHIME with distinct BeatTriggerEvents', () => {
      let state = createInitialBeatState();

      for (const [idx, action] of (
        ['DRUM_KICK', 'DRUM_SNARE', 'DRUM_CLAP', 'PLAY_CHIME'] as const
      ).entries()) {
        const res = beatSimulationEnvironment.executeAction(action, state);
        state = res.nextState;
        expect(state.beatIndex).toBe(idx + 1);
        expect(state.stepCount).toBe(idx + 1);
        expect(state.lastTriggeredEvent).toEqual({
          kind: action,
          actionType: action,
          beatIndex: idx + 1,
        });
      }
      // Percussion blocks leave LED grid untouched when unlit
      expect(countLitLeds(state.leds)).toBe(0);
    });

    it('stamps HEART, STAR, and SMILE 8x8 pixel bitmaps, holds via WAIT_BEAT, and clears via CLEAR_LEDS', () => {
      let state = createInitialBeatState();

      // 1. STAMP_HEART
      state = beatSimulationEnvironment.executeAction('STAMP_HEART', state).nextState;
      const heartExpectedCount = countLitLeds(createPresetLedGrid('HEART', BEAT_PRESETS.HEART.defaultColor));
      expect(heartExpectedCount).toBeGreaterThan(20);
      expect(countLitLeds(state.leds)).toBe(heartExpectedCount);
      expect(state.leds[1][1]).toBe(BEAT_PRESETS.HEART.defaultColor);
      expect(state.lastTriggeredEvent?.kind).toBe('STAMP');
      expect(state.lastTriggeredEvent?.preset).toBe('HEART');

      // 2. WAIT_BEAT preserves existing lit LEDs while advancing beatIndex
      const prevBeatIndex = state.beatIndex;
      state = beatSimulationEnvironment.executeAction('WAIT_BEAT', state).nextState;
      expect(state.beatIndex).toBe(prevBeatIndex + 1);
      expect(countLitLeds(state.leds)).toBe(heartExpectedCount);
      expect(state.lastTriggeredEvent?.kind).toBe('WAIT_BEAT');

      // 3. STAMP_STAR replaces matrix with Star bitmap
      state = beatSimulationEnvironment.executeAction('STAMP_STAR', state).nextState;
      const starExpectedCount = countLitLeds(createPresetLedGrid('STAR', BEAT_PRESETS.STAR.defaultColor));
      expect(countLitLeds(state.leds)).toBe(starExpectedCount);
      expect(state.leds[0][3]).toBe(BEAT_PRESETS.STAR.defaultColor);
      expect(state.lastTriggeredEvent?.preset).toBe('STAR');

      // 4. STAMP_SMILE replaces matrix with Smile bitmap
      state = beatSimulationEnvironment.executeAction('STAMP_SMILE', state).nextState;
      const smileExpectedCount = countLitLeds(createPresetLedGrid('SMILE', BEAT_PRESETS.SMILE.defaultColor));
      expect(countLitLeds(state.leds)).toBe(smileExpectedCount);
      expect(state.lastTriggeredEvent?.preset).toBe('SMILE');

      // 5. CLEAR_LEDS turns off all 64 pads
      state = beatSimulationEnvironment.executeAction('CLEAR_LEDS', state).nextState;
      expect(countLitLeds(state.leds)).toBe(0);
      expect(state.lastTriggeredEvent?.kind).toBe('CLEAR_LEDS');
    });

    it('supports STAMP_PRESET parameter execution and respects custom SET_LED_COLOR overrides', () => {
      let state = createInitialBeatState();
      state = beatSimulationEnvironment.executeAction('SET_LED_COLOR', state, {
        params: { color: '#10b981' },
      }).nextState;
      expect(state.activeColor).toBe('#10b981');
      expect(state.isColorCustomized).toBe(true);

      state = beatSimulationEnvironment.executeAction('STAMP_PRESET', state, {
        params: { preset: 'STAR' },
      }).nextState;
      expect(state.leds[0][3]).toBe('#10b981');
      expect(state.lastTriggeredEvent?.preset).toBe('STAR');

      // Reset clears LEDs and custom color flag while preserving mute state
      const mutedState = { ...state, isMuted: true };
      const afterReset = resetBeatState(mutedState);
      expect(afterReset.isMuted).toBe(true);
      expect(afterReset.beatIndex).toBe(0);
      expect(afterReset.isColorCustomized).toBe(false);
      expect(countLitLeds(afterReset.leds)).toBe(0);
    });

    it('executes repeat badges and loops accurately in headless simulation', () => {
      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'DRUM_KICK', repeatCount: 4 },
          { id: 'b2', type: 'LOOP_START', repeatCount: 2 },
          { id: 'b3', type: 'STAMP_HEART' },
          { id: 'b4', type: 'DRUM_CLAP' },
          { id: 'b5', type: 'WAIT_BEAT' },
          { id: 'b6', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const res = runHeadlessSimulation(ws, 'beat', createInitialBeatState());
      // 4 kicks + 2 * (stamp + clap + wait) = 10 musical beat events
      expect(res.finalState.beatIndex).toBe(10);
      expect(res.finalState.lastTriggeredEvent?.kind).toBe('WAIT_BEAT');
      expect(countLitLeds(res.finalState.leds)).toBeGreaterThan(0);
      // Open-ended Beat & Light never fails
      expect(res.status).toBe('IDLE');
    });
  });

  describe('Autoplay-Policy-Safe beatSynth Resilience & Silence Guarantees', () => {
    it('never throws or blocks when AudioContext is completely undefined', () => {
      const engine = new BeatSynthEngine();
      expect(engine.getAudioStatus()).toBe('unavailable');
      expect(engine.needsSoundUnlock()).toBe(false);
      expect(engine.unlockFromGesture()).toBe(false);

      expect(() => {
        engine.playKick();
        engine.playSnare();
        engine.playClap();
        engine.playChime();
        engine.playNote(5, 0.2);
        engine.stopAll();
      }).not.toThrow();
    });

    it('flags needsSoundUnlock when AudioContext is suspended and never blocks interpreter ticks', () => {
      const { MockAudioContext, log } = createMockAudioContextFactory('suspended', false);
      (globalThis as any).AudioContext = MockAudioContext;

      const engine = new BeatSynthEngine();
      expect(engine.getAudioStatus()).toBe('uninitialized');

      // Calling playKick before gesture unlock does NOT instantiate AudioContext or throw
      engine.playKick();
      expect(engine.needsSoundUnlock()).toBe(true);
      expect(log.oscillatorsCreated).toBe(0);

      // Gesture unlock tries resume(); when browser rejects, engine stays non-blocking
      const unlocked = engine.unlockFromGesture();
      expect(unlocked).toBe(false);
      expect(log.resumesCalled).toBe(1);
      expect(engine.getAudioStatus()).toBe('suspended');
      expect(engine.needsSoundUnlock()).toBe(true);

      // Subsequent synth calls return synchronously without scheduling nodes
      engine.playSnare();
      engine.playClap();
      engine.playChime();
      expect(log.oscillatorsCreated).toBe(0);
      expect(log.bufferSourcesCreated).toBe(0);
    });

    it('synthesizes Kick, Snare, Clap, and Chime when unlocked and stops nodes on mute or stopAll', () => {
      const { MockAudioContext, log } = createMockAudioContextFactory('suspended', true);
      (globalThis as any).AudioContext = MockAudioContext;

      const engine = new BeatSynthEngine();
      expect(engine.unlockFromGesture()).toBe(true);
      expect(engine.getAudioStatus()).toBe('running');
      expect(engine.needsSoundUnlock()).toBe(false);

      engine.playKick(); // 2 oscillators (sine drop + click)
      expect(log.oscillatorsCreated).toBe(2);

      engine.playSnare(); // 1 noise bufferSource + 1 triangle body oscillator
      expect(log.bufferSourcesCreated).toBe(1);
      expect(log.oscillatorsCreated).toBe(3);

      engine.playClap(); // 1 bandpass noise bufferSource
      expect(log.bufferSourcesCreated).toBe(2);

      engine.playChime(); // 3 arpeggio oscillators
      expect(log.oscillatorsCreated).toBe(6);

      // Muting stops active nodes and prevents any new audio nodes from spawning
      engine.setMuted(true);
      expect(engine.isMuted()).toBe(true);
      expect(log.oscillatorsStopped).toBeGreaterThan(0);
      expect(log.bufferSourcesStopped).toBeGreaterThan(0);

      const prevOscCount = log.oscillatorsCreated;
      engine.playKick();
      engine.playEvent({ kind: 'DRUM_KICK', actionType: 'DRUM_KICK', beatIndex: 1 }, 400);
      expect(log.oscillatorsCreated).toBe(prevOscCount);
    });

    it('queues and plays the first block sound when AudioContext.resume() resolves asynchronously on first user gesture', async () => {
      let resolveResume!: () => void;
      const base = createMockAudioContextFactory('suspended', false);

      class AsyncResumeAudioContext extends base.MockAudioContext {
        override resume() {
          base.log.resumesCalled++;
          return new Promise<void>((resolve) => {
            resolveResume = () => {
              this.state = 'running';
              resolve();
            };
          });
        }
      }

      (globalThis as any).AudioContext = AsyncResumeAudioContext;
      const engine = new BeatSynthEngine();

      // Simulate first click: unlockFromGesture() + immediate playKick() before resume() settles
      expect(engine.unlockFromGesture()).toBe(false);
      engine.playKick();
      expect(base.log.oscillatorsCreated).toBe(0);

      // Once browser resolves AudioContext.resume(), queued first-block kick plays immediately!
      resolveResume();
      await Promise.resolve();
      expect(engine.getAudioStatus()).toBe('running');
      expect(engine.needsSoundUnlock()).toBe(false);
      expect(base.log.oscillatorsCreated).toBe(2);
    });

    it('does not cut off main playback first block sound when BeatVariationPreviewPlayer stops on mainIsPlaying', async () => {
      const { beatVariationPreviewPlayer } = await import('../src/components/VariationCardsPanel');
      const { MockAudioContext, log } = createMockAudioContextFactory('running', true);
      (globalThis as any).AudioContext = MockAudioContext;

      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.setSpeed(400);
      store.setBeatMuted(false);
      useAppStore.setState({
        workspace: {
          MAIN: [
            { id: 'first_kick', type: 'DRUM_KICK' },
            { id: 'second_snare', type: 'DRUM_SNARE' },
          ],
          F1: [],
          F2: [],
          F3: [],
        },
      });

      store.play();
      expect(log.oscillatorsCreated).toBe(2);
      const stopsAfterStart = log.oscillatorsStopped; // 2 scheduled envelope stop(when) calls
      expect(stopsAfterStart).toBe(2);

      // Simulate VariationCardsPanel useEffect firing when mainIsPlaying becomes true
      beatVariationPreviewPlayer.stop('silent');
      expect(log.oscillatorsStopped).toBe(stopsAfterStart);

      // Explicit user pause DOES stop active main oscillators
      store.pause();
      expect(log.oscillatorsStopped).toBe(stopsAfterStart + 2);
    });

    it('remains 100% silent during runHeadlessSimulation, instant mode, and thumbnail generation', () => {
      const { MockAudioContext, log } = createMockAudioContextFactory('running', true);
      (globalThis as any).AudioContext = MockAudioContext;
      beatSynth.unlockFromGesture();

      const ws: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'DRUM_KICK' },
          { id: '2', type: 'DRUM_SNARE' },
          { id: '3', type: 'DRUM_CLAP' },
          { id: '4', type: 'PLAY_CHIME' },
          { id: '5', type: 'STAMP_HEART' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // 1. Headless simulation
      const headless = runHeadlessSimulation(ws, 'beat', createInitialBeatState());
      expect(headless.finalState.beatIndex).toBe(5);
      expect(log.oscillatorsCreated).toBe(0);
      expect(log.bufferSourcesCreated).toBe(0);

      // 2. Thumbnail generation
      const thumb = generateSimulationThumbnail('beat', headless.finalState);
      expect(thumb.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      expect(log.oscillatorsCreated).toBe(0);

      // 3. Store muted + zero-delay non-sound batching
      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.setBeatMuted(true);
      store.addBlock('MAIN', 'SET_BEAT_DELAY', undefined, undefined, { multiplier: 0 });
      store.addBlock('MAIN', 'STAMP_STAR');
      store.addBlock('MAIN', 'STAMP_HEART');
      store.addBlock('MAIN', 'CLEAR_LEDS');
      store.play();

      expect(useAppStore.getState().beatState.beatIndex).toBe(4);
      expect(log.oscillatorsCreated).toBe(0);
      expect(log.bufferSourcesCreated).toBe(0);
    });
  });

  describe('Binary Serialization & Base64URL Round-Trips (ENV_ID_BEAT = 0x03)', () => {
    it('encodes ENV_ID_BEAT (0x03), ENV_VERSION_BEAT (1), zero map bytes, and opcodes 0x10..0x16', () => {
      expect(presetNameToId('HEART')).toBe(0);
      expect(presetNameToId('STAR')).toBe(1);
      expect(presetNameToId('SMILE')).toBe(2);
      expect(presetIdToName(0)).toBe('HEART');
      expect(presetIdToName(1)).toBe('STAR');
      expect(presetIdToName(2)).toBe('SMILE');

      const ws: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'DRUM_KICK' },
          { id: 'b2', type: 'DRUM_SNARE', repeatCount: 3 },
          { id: 'b3', type: 'DRUM_CLAP' },
          { id: 'b4', type: 'PLAY_CHIME' },
          { id: 'b5', type: 'STAMP_HEART' },
          { id: 'b6', type: 'STAMP_STAR' },
          { id: 'b7', type: 'STAMP_SMILE' },
          { id: 'b8', type: 'WAIT_BEAT', repeatCount: 'b' },
          { id: 'b9', type: 'CLEAR_LEDS' },
        ],
        F1: [
          { id: 'f1', type: 'STAMP_PRESET', params: { preset: 'HEART' } },
          { id: 'f2', type: 'STAMP_PRESET', params: { preset: 'NOTE' } },
          { id: 'f3', type: 'STAMP_PRESET', params: { preset: 'a' } },
        ],
        F2: [],
        F3: [],
      };

      const bytes = exportToBinary(ws, 'beat', createInitialBeatState());
      expect(bytes[0]).toBe(FORMAT_VERSION); // 1
      expect(bytes[1]).toBe(ENV_ID_BEAT); // 0x03
      expect(bytes[2]).toBe(ENV_VERSION_BEAT); // 1
      // Byte 3 is immediately Code Payload (2 non-empty scopes: MAIN & F1) — zero map payload bytes!
      expect(bytes[3]).toBe(2); // scopeCount = 2 (MAIN, F1)
      expect(bytes[4]).toBe(0); // SCOPE_ID_MAIN = 0
      expect(bytes[5]).toBe(9); // 9 blocks in MAIN
      expect(bytes[6]).toBe(OP_BEAT_DRUM_KICK); // 0x10
      expect(bytes[7]).toBe(OP_BEAT_DRUM_SNARE | MASK_HAS_REP); // 0x11 | 0x40
      expect(bytes[8]).toBe(3);
      expect(bytes[9]).toBe(OP_BEAT_DRUM_CLAP); // 0x12
      expect(bytes[10]).toBe(OP_BEAT_PLAY_CHIME); // 0x13
      expect(bytes[11]).toBe(OP_BEAT_STAMP_PRESET); // 0x14
      expect(bytes[12]).toBe(0); // HEART
      expect(bytes[13]).toBe(OP_BEAT_STAMP_PRESET); // 0x14
      expect(bytes[14]).toBe(1); // STAR
      expect(bytes[15]).toBe(OP_BEAT_STAMP_PRESET); // 0x14
      expect(bytes[16]).toBe(2); // SMILE
      // Variable repeat sets MASK_HAS_REP (0x40) | MASK_HAS_VAR_PARAM (0x80) = 0xD5
      expect(bytes[17]).toBe(OP_BEAT_WAIT_BEAT | MASK_HAS_REP | 0x80);
      expect(bytes[18]).toBe(0x01); // paramVarMask bit 0 = repeat is variable
      expect(bytes[19]).toBe(1); // varNameToIndex('b') = 1
      expect(bytes[20]).toBe(OP_BEAT_CLEAR_LEDS); // 0x16

      const encoded = exportToString(ws, 'beat', createInitialBeatState());
      const decoded = importFromString(encoded);

      expect(decoded.success).toBe(true);
      expect(decoded.envId).toBe('beat');
      expect(decoded.beatState).toBeDefined();
      expect(decoded.workspace?.MAIN.map((b) => ({ type: b.type, repeatCount: b.repeatCount }))).toEqual([
        { type: 'DRUM_KICK', repeatCount: undefined },
        { type: 'DRUM_SNARE', repeatCount: 3 },
        { type: 'DRUM_CLAP', repeatCount: undefined },
        { type: 'PLAY_CHIME', repeatCount: undefined },
        { type: 'STAMP_HEART', repeatCount: undefined },
        { type: 'STAMP_STAR', repeatCount: undefined },
        { type: 'STAMP_SMILE', repeatCount: undefined },
        { type: 'WAIT_BEAT', repeatCount: 'b' },
        { type: 'CLEAR_LEDS', repeatCount: undefined },
      ]);

      // Verify STAMP_PRESET blocks also round-trip back to STAMP_PRESET with exact params
      expect(decoded.workspace?.F1.map((b) => ({ type: b.type, params: b.params }))).toEqual([
        { type: 'STAMP_PRESET', params: { preset: 'HEART' } },
        { type: 'STAMP_PRESET', params: { preset: 'NOTE' } },
        { type: 'STAMP_PRESET', params: { preset: 'a' } },
      ]);
    });

    it('preserves 100% backward compatibility with existing v1 Generic, Grid, and Turtle payloads', () => {
      const gridState = useAppStore.getState().grid;
      const gridWs: WorkspaceState = {
        MAIN: [
          { id: 'g1', type: 'MOVE_FWD', repeatCount: 3 },
          { id: 'g2', type: 'TURN_RIGHT' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const turtleWs: WorkspaceState = {
        MAIN: [
          { id: 't1', type: 'FORWARD', params: { length: 60 } },
          { id: 't2', type: 'TURN_LEFT', params: { angle: 90 } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const genericBin = exportToBinary(gridWs, 'generic');
      const gridBin = exportToBinary(gridWs, 'grid', gridState);
      const turtleBin = exportToBinary(turtleWs, 'turtle');

      expect(genericBin[1]).toBe(ENV_ID_GENERIC);
      expect(gridBin[1]).toBe(ENV_ID_GRID);
      expect(turtleBin[1]).toBe(ENV_ID_TURTLE);

      const decGeneric = importFromBinary(genericBin);
      const decGrid = importFromBinary(gridBin);
      const decTurtle = importFromBinary(turtleBin);

      expect(decGeneric.success && decGeneric.envId === 'generic').toBe(true);
      expect(decGrid.success && decGrid.envId === 'grid').toBe(true);
      expect(decGrid.gridState?.width).toBe(gridState.width);
      expect(decTurtle.success && decTurtle.envId === 'turtle').toBe(true);
      expect(decTurtle.workspace?.MAIN[0].params).toEqual({ length: 60 });
    });
  });

  describe('Thumbnails, Local Save, PWA State Restore, & Store Integration', () => {
    it('generates a valid 8x8 RGB LED SVG thumbnail for BeatState', () => {
      const litState = beatSimulationEnvironment.executeAction(
        'STAMP_HEART',
        createInitialBeatState()
      ).nextState;
      const svg = renderBeatMapSvg(litState);
      expect(svg).toContain('<svg');
      expect(svg).toContain(BEAT_PRESETS.HEART.defaultColor);

      const dataUrl = generateBeatMapThumbnail(litState);
      expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      expect(generateSimulationThumbnail('beat', litState)).toBe(dataUrl);
    });

    it('persists and migrates simId: "beat" in localSaveService while keeping legacy defaults', () => {
      const ws: WorkspaceState = {
        MAIN: [{ id: '1', type: 'STAMP_STAR' }, { id: '2', type: 'PLAY_CHIME' }],
        F1: [],
        F2: [],
        F3: [],
      };
      const code = exportToString(ws, 'beat', createInitialBeatState());
      const saved = saveProgram({
        title: 'Starry Chime',
        simId: 'beat',
        code,
        screenshot: generateBeatMapThumbnail(createInitialBeatState()),
        status: 'IDLE',
        stepCount: 2,
      });

      expect(saved.simId).toBe('beat');
      const loadedList = getSavedPrograms();
      expect(loadedList).toHaveLength(1);
      expect(loadedList[0].simId).toBe('beat');

      // Legacy entry without simId defaults to 'grid'
      expect(migrateSavedEntry({ code })?.simId).toBe('grid');
      expect(migrateSavedEntry({ code, simId: 'turtle' })?.simId).toBe('turtle');
      expect(migrateSavedEntry({ code, simId: 'beat' })?.simId).toBe('beat');
    });

    it('round-trips activeSimId: "beat" and BeatState across PWA update snapshots', () => {
      const store = useAppStore.getState();
      const litBeat = beatSimulationEnvironment.executeAction(
        'STAMP_SMILE',
        createInitialBeatState(true)
      ).nextState;

      const ok = saveStateBeforeUpdate({
        appMode: 'sandbox',
        activeSimId: 'beat',
        currentLevel: 1,
        workspace: {
          MAIN: [{ id: 'b1', type: 'STAMP_SMILE' }],
          F1: [],
          F2: [],
          F3: [],
        },
        savedWorkspaces: {},
        grid: store.grid,
        turtleState: store.turtleState,
        beatState: litBeat,
        runtime: null,
        activeScope: 'MAIN',
        selectedBlockId: null,
        speed: 400,
        editorTool: 'NONE',
        isSubpaletteCollapsed: false,
        isMapHidden: false,
        isFunctionBarOpen: false,
        past: [],
        future: [],
      });

      expect(ok).toBe(true);
      const restored = consumeRestoredStateAfterUpdate(store.grid);
      expect(restored).not.toBeNull();
      expect(restored?.activeSimId).toBe('beat');
      expect(restored?.beatState?.isMuted).toBe(true);
      expect(restored?.beatState?.beatIndex).toBe(1);
      expect(countLitLeds(restored!.beatState!.leds)).toBeGreaterThan(0);
    });

    it('switches grid <-> turtle <-> beat cleanly in Sandbox and Curriculum modes with isolated workspaces', () => {
      const { MockAudioContext, log } = createMockAudioContextFactory('running', true);
      (globalThis as any).AudioContext = MockAudioContext;

      // 1. Add blocks in Grid, Turtle, and Beat in Sandbox mode
      useAppStore.getState().setSimEnvironment('grid');
      useAppStore.getState().addBlock('MAIN', 'MOVE_FWD', 2);

      useAppStore.getState().setSimEnvironment('turtle');
      useAppStore.getState().addBlock('MAIN', 'TURN_LEFT');

      useAppStore.getState().setSimEnvironment('beat');
      expect(useAppStore.getState().activeSimId).toBe('beat');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      useAppStore.getState().addBlock('MAIN', 'STAMP_HEART');
      useAppStore.getState().addBlock('MAIN', 'DRUM_KICK');

      // Step interactively in Beat mode -> updates LEDs & triggers Web Audio Kick
      useAppStore.getState().step();
      expect(useAppStore.getState().beatState.beatIndex).toBe(1);
      expect(countLitLeds(useAppStore.getState().beatState.leds)).toBeGreaterThan(0);

      useAppStore.getState().step();
      expect(useAppStore.getState().beatState.beatIndex).toBe(2);
      expect(log.oscillatorsCreated).toBe(2);

      // Switch to Grid and Turtle and back to Beat -> each workspace stays isolated
      useAppStore.getState().setSimEnvironment('grid');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD']);

      useAppStore.getState().setSimEnvironment('turtle');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(['TURN_LEFT']);

      useAppStore.getState().setSimEnvironment('beat');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'STAMP_HEART',
        'DRUM_KICK',
      ]);

      // Export Beat code, switch to Curriculum mode, then return to Sandbox -> Beat session restores
      const exportedBeat = useAppStore.getState().exportCode();
      useAppStore.getState().setAppMode('curriculum');
      expect(useAppStore.getState().appMode).toBe('curriculum');

      useAppStore.getState().setAppMode('sandbox');
      expect(useAppStore.getState().activeSimId).toBe('beat');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'STAMP_HEART',
        'DRUM_KICK',
      ]);

      // Importing a Beat program while in Curriculum mode switches cleanly to Beat in Sandbox
      useAppStore.getState().setAppMode('curriculum');
      const importRes = useAppStore.getState().importCode(exportedBeat);
      expect(importRes.success).toBe(true);
      expect(useAppStore.getState().appMode).toBe('sandbox');
      expect(useAppStore.getState().activeSimId).toBe('beat');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'STAMP_HEART',
        'DRUM_KICK',
      ]);

      // Mute toggling & clearBeatMatrix
      useAppStore.getState().toggleBeatMuted();
      expect(useAppStore.getState().beatState.isMuted).toBe(true);
      expect(beatSynth.isMuted()).toBe(true);

      useAppStore.getState().step();
      useAppStore.getState().clearBeatMatrix();
      expect(useAppStore.getState().beatState.beatIndex).toBe(0);
      expect(countLitLeds(useAppStore.getState().beatState.leds)).toBe(0);
    });

    it('runs timed Play/Pause/Reset intervals cleanly on Beat & Light Matrix', () => {
      vi.useFakeTimers();
      const store = useAppStore.getState();
      store.setSimEnvironment('beat');
      store.setSpeed(100);
      store.clearWorkspace();
      store.addBlock('MAIN', 'DRUM_KICK');
      store.addBlock('MAIN', 'STAMP_STAR');
      store.addBlock('MAIN', 'CLEAR_LEDS');

      useAppStore.getState().play();
      // Immediate first step runs synchronously on play()
      expect(useAppStore.getState().isPlaying).toBe(true);
      expect(useAppStore.getState().beatState.beatIndex).toBe(1);

      vi.advanceTimersByTime(100);
      expect(useAppStore.getState().beatState.beatIndex).toBe(2);
      expect(countLitLeds(useAppStore.getState().beatState.leds)).toBeGreaterThan(0);

      vi.advanceTimersByTime(100);
      expect(useAppStore.getState().beatState.beatIndex).toBe(3);
      expect(countLitLeds(useAppStore.getState().beatState.leds)).toBe(0);

      // Final completion tick pops empty callStack and stops playback
      vi.advanceTimersByTime(100);
      expect(useAppStore.getState().isPlaying).toBe(false);

      // Reset returns beatIndex to 0
      useAppStore.getState().reset();
      expect(useAppStore.getState().beatState.beatIndex).toBe(0);
      expect(createEmptyWorkspace().MAIN).toEqual([]);
    });
  });

  describe('Phase 1: Canonical LED-Off (#0f172a/#000000 -> null), SET_BEAT_DELAY Alias & Zero-Reading BeatCanvas (#304)', () => {
    it('exports isBeatLedOffHex (case-insensitive) and normalizes #0f172a and #000000 to null in presets and paint blocks', () => {
      expect(isBeatLedOffHex).toBe(isPresetBeatLedOffHex);
      expect(isBeatLedOffHex('#0f172a')).toBe(true);
      expect(isBeatLedOffHex('#0F172A')).toBe(true);
      expect(isBeatLedOffHex('#000000')).toBe(true);
      expect(isBeatLedOffHex(' #000000 ')).toBe(true);
      expect(isBeatLedOffHex('#ffffff')).toBe(false);
      expect(isBeatLedOffHex('#06b6d4')).toBe(false);
      expect(isBeatLedOffHex(null)).toBe(false);
      expect(isBeatLedOffHex(undefined)).toBe(false);
      expect(isBeatLedOffHex('')).toBe(false);

      // createPresetLedGrid normalizes LED-off overrides to null (equal to untouched empty grid)
      expect(createPresetLedGrid('HEART', '#0f172a')).toEqual(createEmptyLedGrid());
      expect(createPresetLedGrid('HEART', '#000000')).toEqual(createEmptyLedGrid());
      expect(createPresetLedGrid('STAR', '#0F172A')).toEqual(createEmptyLedGrid());

      // countLitLeds ignores raw #0f172a / #000000 entries
      const rawOffGrid = createEmptyLedGrid();
      rawOffGrid[0][0] = '#0f172a';
      rawOffGrid[1][1] = '#000000';
      rawOffGrid[2][2] = '#ffffff';
      expect(countLitLeds(rawOffGrid)).toBe(1);

      // Erasing lit cells with #0f172a or #000000 leaves leds structurally equal to untouched null cells
      let painted = createInitialBeatState(true);
      painted = beatSimulationEnvironment.executeAction('SET_LED_COLOR', painted, {
        params: { color: '#06b6d4' },
      }).nextState;
      painted = beatSimulationEnvironment.executeAction('LIGHT_ROW', painted, {
        params: { y: 2 },
      }).nextState;
      painted = beatSimulationEnvironment.executeAction('SET_LED_COLOR', painted, {
        params: { color: '#0f172a' },
      }).nextState;
      painted = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', painted, {
        params: { x: 3, y: 2 },
      }).nextState;
      expect(painted.leds[1][2]).toBeNull();

      painted = beatSimulationEnvironment.executeAction('SET_LED_COLOR', painted, {
        params: { color: '#000000' },
      }).nextState;
      painted = beatSimulationEnvironment.executeAction('LIGHT_COL', painted, {
        params: { x: 1 },
      }).nextState;
      expect(painted.leds[1][0]).toBeNull();

      // Stamping a preset while #000000 is active paints null (off)
      painted = beatSimulationEnvironment.executeAction('STAMP_HEART', painted).nextState;
      expect(painted.leds).toEqual(createEmptyLedGrid());

      // Light all of row 2 except cols 1 and 3 from scratch -> matches erased goal grid identically
      let target = createInitialBeatState(true);
      target = beatSimulationEnvironment.executeAction('SET_LED_COLOR', target, {
        params: { color: '#06b6d4' },
      }).nextState;
      for (const x of [2, 4, 5, 6, 7, 8]) {
        target = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', target, {
          params: { x, y: 2 },
        }).nextState;
      }

      let erased = createInitialBeatState(true);
      erased = beatSimulationEnvironment.executeAction('SET_LED_COLOR', erased, {
        params: { color: '#06b6d4' },
      }).nextState;
      erased = beatSimulationEnvironment.executeAction('LIGHT_ROW', erased, {
        params: { y: 2 },
      }).nextState;
      erased = beatSimulationEnvironment.executeAction('SET_LED_COLOR', erased, {
        params: { color: '#0f172a' },
      }).nextState;
      erased = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', erased, {
        params: { x: 1, y: 2 },
      }).nextState;
      erased = beatSimulationEnvironment.executeAction('SET_LED_COLOR', erased, {
        params: { color: '#000000' },
      }).nextState;
      erased = beatSimulationEnvironment.executeAction('LIGHT_PIXEL', erased, {
        params: { x: 3, y: 2 },
      }).nextState;
      expect(erased.leds).toEqual(target.leds);
    });

    it('supports delay and multiplier fallback on SET_BEAT_DELAY while preserving defaultValue 0 and initial 1x speed', () => {
      expect(createInitialBeatState().stepDelayMultiplier).toBe(1);
      expect(BEAT_DELAY_PARAM_DEF.defaultValue).toBe(0);
      expect(beatSimulationEnvironment.ToolsComponent).toBeUndefined();

      const base = createInitialBeatState(true);
      const viaDelay = beatSimulationEnvironment.executeAction('SET_BEAT_DELAY', base, {
        params: { delay: 0.25 },
      }).nextState;
      expect(viaDelay.stepDelayMultiplier).toBe(0.25);

      const viaMultiplier = beatSimulationEnvironment.executeAction('SET_BEAT_DELAY', base, {
        params: { multiplier: 0.5 },
      }).nextState;
      expect(viaMultiplier.stepDelayMultiplier).toBe(0.5);

      const delayZeroBeatsMultiplier = beatSimulationEnvironment.executeAction(
        'SET_BEAT_DELAY',
        base,
        { params: { delay: 0, multiplier: 2 } }
      ).nextState;
      expect(delayZeroBeatsMultiplier.stepDelayMultiplier).toBe(0);

      const defaultFallback = beatSimulationEnvironment.executeAction('SET_BEAT_DELAY', base)
        .nextState;
      expect(defaultFallback.stepDelayMultiplier).toBe(0);
    });

    it('renders zero-reading 🎵 #N counter, gates tool-beat-active-color, shows #304 ⊘ erase swatch, and mounts SimulationTopLeftHud below header', () => {
      const store = useAppStore.getState();

      // 1. Sandbox mode: renders tool-beat-active-color and 🎵 #N counter
      store.setAppMode('sandbox');
      store.setSimEnvironment('beat');
      const stateWithBeats = {
        ...createInitialBeatState(true),
        beatIndex: 4,
        activeColor: '#06b6d4',
      };
      const sandboxHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, { state: stateWithBeats })
      );
      expect(sandboxHtml).toMatch(/<span data-testid="beat-step-counter"[^>]*>🎵 #4<\/span>/);
      expect(sandboxHtml).not.toContain('Step 4');
      expect(sandboxHtml).toContain('data-testid="tool-beat-active-color"');
      expect(sandboxHtml).toContain('data-led-off="false"');
      expect(sandboxHtml).not.toContain('data-testid="beat-active-color-erase-cue"');
      expect(sandboxHtml).not.toContain('data-testid="simulation-top-left-hud"');

      // 2. Curriculum lesson without SET_LED_COLOR (1.8) hides tool-beat-active-color
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.8');
      const hiddenToolHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, { state: stateWithBeats })
      );
      expect(hiddenToolHtml).not.toContain('data-testid="tool-beat-active-color"');

      // 3. Curriculum lesson with SET_LED_COLOR (2.5) shows tool-beat-active-color
      store.setCurriculumActivity('2.5');
      const visibleToolHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, { state: stateWithBeats })
      );
      expect(visibleToolHtml).toContain('data-testid="tool-beat-active-color"');

      // 4. #304 LED-Off (#0f172a and #000000) renders recessed shaded off-pad + ⊘ erase cue, and BeatLedCell treats raw #0f172a/#000000 as unlit
      store.setAppMode('sandbox');
      for (const offHex of ['#0f172a', '#000000']) {
        const leds = createEmptyLedGrid();
        leds[0][0] = offHex;
        leds[0][1] = '#ffffff';
        const offState = {
          ...createInitialBeatState(true),
          activeColor: offHex,
          leds,
        };
        const offHtml = renderToStaticMarkup(
          React.createElement(BeatCanvas, { state: offState })
        );
        expect(offHtml).toContain('data-testid="tool-beat-active-color" data-led-off="true"');
        expect(offHtml).toContain('data-testid="beat-active-color-erase-cue"');
        expect(offHtml).toContain('bg-slate-800/85');
        expect(offHtml).not.toContain(`background-color:${offHex}`);
        expect(offHtml).toContain(
          'data-testid="beat-led-0-0" data-coord="1,1" data-lit="false" data-color=""'
        );
        expect(offHtml).toContain(
          'data-testid="beat-led-1-0" data-coord="2,1" data-lit="true" data-color="#ffffff"'
        );
      }

      // 5. White (#ffffff) stays lit swatch without ⊘ erase cue
      const whiteHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, {
          state: { ...createInitialBeatState(true), activeColor: '#ffffff' },
        })
      );
      expect(whiteHtml).toContain('data-testid="tool-beat-active-color" data-led-off="false"');
      expect(whiteHtml).not.toContain('data-testid="beat-active-color-erase-cue"');

      // 6. runtimeVariables mounts SimulationTopLeftHud inside beat-matrix-stage below beat-canvas-header
      const hudHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, {
          state: stateWithBeats,
          runtimeVariables: { a: 3, b: 7 },
        })
      );
      const headerIdx = hudHtml.indexOf('data-testid="beat-canvas-header"');
      const stageIdx = hudHtml.indexOf('data-testid="beat-matrix-stage"');
      const hudIdx = hudHtml.indexOf('data-testid="simulation-top-left-hud"');
      expect(headerIdx).toBeGreaterThan(-1);
      expect(stageIdx).toBeGreaterThan(headerIdx);
      expect(hudIdx).toBeGreaterThan(stageIdx);
      expect(hudHtml).toContain('top-3 left-3');
      expect(hudHtml).toContain('data-testid="toolbar-variables"');
      expect(hudHtml).toContain('a=3');
      expect(hudHtml).toContain('b=7');
    });

    it('renders tool-random-seed with 🎲, data-seed, and touch targets in BeatCanvas header and rerolls Beat output deterministically', () => {
      const store = useAppStore.getState();
      store.setAppMode('sandbox');
      store.setSimEnvironment('beat');
      store.setRandomSeed(12345);

      const html = renderToStaticMarkup(
        React.createElement(BeatCanvas, { state: useAppStore.getState().beatState })
      );
      const seedMatch = html.match(/<button[^>]*data-testid="tool-random-seed"[^>]*>[\s\S]*?<\/button>/);
      expect(seedMatch).not.toBeNull();
      expect(seedMatch![0]).toContain('🎲');
      expect(seedMatch![0]).toContain('data-seed="12345"');
      expect(seedMatch![0]).toContain('min-h-9 min-w-9 sm:min-h-11 sm:min-w-11');

      const muteMatch = html.match(/<button[^>]*data-testid="tool-beat-mute"[^>]*>/);
      expect(muteMatch).not.toBeNull();
      expect(muteMatch![0]).toContain('min-h-9 min-w-9 sm:min-h-11 sm:min-w-11');

      const loopMatch = html.match(/<button[^>]*data-testid="tool-loop-playback"[^>]*>/);
      expect(loopMatch).not.toBeNull();
      expect(loopMatch![0]).toContain('min-h-9 min-w-9 sm:min-h-11 sm:min-w-11');

      // Empty workspace: updates randomSeed without starting playback
      const randSpy = vi.spyOn(Math, 'random');
      randSpy.mockReturnValueOnce(0.11).mockReturnValueOnce(0.73).mockReturnValueOnce(0.42);
      const emptySeed = store.rerollRandomSeed();
      expect(emptySeed).not.toBe(12345);
      expect(useAppStore.getState().randomSeed).toBe(emptySeed);
      expect(useAppStore.getState().isPlaying).toBe(false);
      expect(countLitLeds(useAppStore.getState().beatState.leds)).toBe(0);

      // Non-empty workspace with SET_BEAT_DELAY=0: rerollRandomSeed renders synchronously and same seed is reproducible
      store.addBlock('MAIN', 'SET_BEAT_DELAY', undefined, undefined, { delay: 0 });
      store.addBlock('MAIN', 'VAR_ASSIGN', undefined, undefined, { a: 'x', b: '$randD8' });
      store.addBlock('MAIN', 'VAR_ASSIGN', undefined, undefined, { a: 'y', b: '$randD8' });
      store.addBlock('MAIN', 'SET_LED_COLOR', undefined, undefined, { color: '$randomColor' });
      store.addBlock('MAIN', 'LIGHT_PIXEL', undefined, undefined, { x: 'x', y: 'y' });

      const seed1 = store.rerollRandomSeed();
      expect(seed1).not.toBe(emptySeed);
      expect(useAppStore.getState().isPlaying).toBe(false);
      const ledsSeed1 = useAppStore.getState().beatState.leds;
      expect(countLitLeds(ledsSeed1)).toBe(1);

      // Same seed reproduces identical Beat LED grid
      store.reset();
      store.play();
      expect(useAppStore.getState().beatState.leds).toEqual(ledsSeed1);

      // Subsequent reroll changes seed and updates Beat LED output
      const seed2 = store.rerollRandomSeed();
      expect(seed2).not.toBe(seed1);
      const ledsSeed2 = useAppStore.getState().beatState.leds;
      expect(countLitLeds(ledsSeed2)).toBe(1);
      expect(ledsSeed2).not.toEqual(ledsSeed1);

      // Timed playback mode (default 1x beat delay): rerollRandomSeed resets and restarts playback
      store.clearWorkspace();
      store.addBlock('MAIN', 'DRUM_KICK');
      store.addBlock('MAIN', 'DRUM_SNARE');
      store.setSpeed(400);
      const seed3 = store.rerollRandomSeed();
      expect(seed3).not.toBe(seed2);
      expect(useAppStore.getState().isPlaying).toBe(true);
      expect(useAppStore.getState().beatState.beatIndex).toBe(1);
      store.pause();
      randSpy.mockRestore();
    });
  });
});
