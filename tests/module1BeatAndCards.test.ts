import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_1_BEAT_ACTIVITIES,
  getActivitiesForModule,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import { MODULE_1_BEAT_ALLOWED_BLOCKS } from '../src/data/curriculum/module1Beat';
import {
  BEAT_VARIATION_PREVIEW_TICK_MS,
  VariationCardsPanel,
  beatVariationPreviewPlayer,
  handleButtonKeyboardActivation,
  renderBeatVariationPreview,
} from '../src/components/VariationCardsPanel';
import { App } from '../src/App';
import { BlockPalette } from '../src/components/BlockPalette';
import { BeatCanvas } from '../src/simulations/beat/components/BeatCanvas';
import { BEAT_GRID_SIZE, BeatState } from '../src/simulations/beat/types';
import { BEAT_PRESETS, countLitLeds } from '../src/simulations/beat/presets';
import {
  beatSimulationEnvironment,
  createInitialBeatState,
} from '../src/simulations/beat/beatEnvironment';
import { beatSynth } from '../src/simulations/beat/beatSynth';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_BEAT,
  ENV_VERSION_BEAT,
  FORMAT_VERSION,
  OP_BEAT_CLEAR_LEDS,
  OP_BEAT_DRUM_CLAP,
  OP_BEAT_DRUM_KICK,
  OP_BEAT_DRUM_SNARE,
  OP_BEAT_PLAY_CHIME,
  OP_BEAT_STAMP_PRESET,
  OP_BEAT_WAIT_BEAT,
} from '../src/engine/serialization/types';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';
import '../src/simulations/beat/beatEnvironment';

function createMockAudioContextFactory(
  initialState: 'running' | 'suspended' = 'running',
  autoResumeOnGesture = true
) {
  const log = {
    oscillatorsCreated: 0,
    oscillatorsStopped: 0,
    bufferSourcesCreated: 0,
    bufferSourcesStopped: 0,
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
      return {
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
    }

    createBiquadFilter() {
      return {
        type: 'highpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }

    createBuffer(_channels: number, length: number) {
      const channel = new Float32Array(length);
      return {
        getChannelData: () => channel,
      };
    }

    createBufferSource() {
      log.bufferSourcesCreated++;
      return {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(() => {
          log.bufferSourcesStopped++;
        }),
      };
    }
  }

  return { MockAudioContext, log };
}

describe('Wave 3 / Commit 11: Playable Animated 8x8 Variation Cards & Module 1 Beat Lessons (1.8, 1C)', () => {
  const originalAudioContext = (globalThis as any).AudioContext;
  const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;

  beforeEach(() => {
    delete (globalThis as any).AudioContext;
    delete (globalThis as any).webkitAudioContext;
    beatVariationPreviewPlayer.resetForTests();
    beatSynth.resetForTests();
    clearPendingUpdateState();

    const store = useAppStore.getState();
    store.pause();
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.clearWorkspace();
    store.setSpeed(400);
    store.setEditorTool('NONE');
    store.setBeatMuted(false);
    useAppStore.setState({
      curriculumWorkspaces: {},
      sandboxSnapshot: null,
      activeActivityId: '1.1',
      activeActivityVersion: 1,
      statusAnnouncement: '',
    });
    store.clearHistory();
  });

  afterEach(() => {
    beatVariationPreviewPlayer.resetForTests();
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

  describe('1. Module 1 Beat & Light Activity Schema, Palette Staging & Block Guardrails (1.8 & 1C)', () => {
    it('registers 1.8 and 1C in MODULE_1_BEAT_ACTIVITIES and CURRICULUM_ACTIVITIES with strict Tier 1 palette rules', () => {
      expect(MODULE_1_BEAT_ACTIVITIES.map((a) => a.id)).toEqual(['1.8', '1C']);
      expect(CURRICULUM_ACTIVITIES.map((a) => a.id)).toContain('1.8');
      expect(CURRICULUM_ACTIVITIES.map((a) => a.id)).toContain('1C');

      const m1Ids = getActivitiesForModule('module-1').map((a) => a.id);
      expect(m1Ids).toContain('1.8');
      expect(m1Ids).toContain('1C');

      const act18 = getActivityLatest('1.8')!;
      expect(act18).toBeDefined();
      expect(act18.moduleId).toBe('module-1');
      expect(act18.version).toBe(1);
      expect(act18.format).toBe('sandbox');
      expect(act18.simId).toBe('beat');
      expect(act18.icon).toBe('🎵');
      expect(act18.title).toContain('Drum Pads & Icon Stamps');
      expect(isValidatedPuzzleActivity(act18)).toBe(false);

      const act1C = getActivityLatest('1C')!;
      expect(act1C).toBeDefined();
      expect(act1C.moduleId).toBe('module-1');
      expect(act1C.version).toBe(1);
      expect(act1C.format).toBe('capstone');
      expect(act1C.capstoneType).toBe('creative');
      expect(act1C.simId).toBe('beat');
      expect(act1C.icon).toBe('🎨');
      expect(act1C.title).toBe('Sticker & Beat Intro');
      expect(isValidatedPuzzleActivity(act1C)).toBe(false);

      for (const act of MODULE_1_BEAT_ACTIVITIES) {
        expect(act.palette.allowedSimBlocks).toEqual(MODULE_1_BEAT_ALLOWED_BLOCKS);
        expect(act.palette.allowedControlBlocks).toEqual([]);
        expect(act.palette.allowedScopes).toEqual(['MAIN']);
        expect(act.palette.allowRepeatBadges).toBe(false);
        expect(act.palette.allowActionParams).toBe(false);
        expect(act.palette.allowVariables).toBe(false);
      }

      // Verify BlockPalette in Curriculum mode on 1.8 shows only Tier 1 Beat blocks (no loops/vars/repeat badges)
      useAppStore.getState().setCurriculumActivity('1.8');
      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('data-testid="palette-beat-drum-kick"');
      expect(paletteHtml).toContain('data-testid="palette-beat-stamp-heart"');
      expect(paletteHtml).toContain('data-testid="palette-beat-clear-leds"');
      expect(paletteHtml).not.toContain('data-testid="palette-loop-start"');
      expect(paletteHtml).not.toContain('data-testid="palette-number-2"');
      expect(paletteHtml).not.toContain('data-testid="palette-var-assign"');
    });

    it('enforces block-count budgets and executes starters and all 6 variations cleanly in beatSimulationEnvironment', () => {
      const act18 = getActivityLatest('1.8')!;
      expect(act18.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(6);
      expect(act18.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(8);
      expect(act18.variations).toHaveLength(3);
      for (const v of act18.variations!) {
        expect(v.workspace.MAIN.length).toBeGreaterThanOrEqual(4);
        expect(v.workspace.MAIN.length).toBeLessThanOrEqual(12);
      }

      const act1C = getActivityLatest('1C')!;
      expect(act1C.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(8);
      expect(act1C.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(12);
      expect(act1C.variations).toHaveLength(3);
      for (const v of act1C.variations!) {
        expect(v.workspace.MAIN.length).toBeGreaterThanOrEqual(8);
        expect(v.workspace.MAIN.length).toBeLessThanOrEqual(12);
      }

      const allowedSet = new Set(MODULE_1_BEAT_ALLOWED_BLOCKS);

      for (const act of MODULE_1_BEAT_ACTIVITIES) {
        const allWorkspaces = [
          { label: `${act.id}-starter`, ws: act.starterWorkspace! },
          ...act.variations!.map((v) => ({ label: v.id, ws: v.workspace })),
        ];

        const sequenceSignatures = new Set<string>();
        const variationThumbnailUrls = new Set<string>();

        for (const { label, ws } of allWorkspaces) {
          expect(ws.F1).toEqual([]);
          expect(ws.F2).toEqual([]);
          expect(ws.F3).toEqual([]);

          for (const block of ws.MAIN) {
            expect(allowedSet.has(block.type)).toBe(true);
            expect(block.repeatCount).toBeUndefined();
            expect(block.params).toBeUndefined();
          }

          // Headless simulation executes every block cleanly with 1 beat per Tier 1 block
          const simRes = runHeadlessSimulation(ws, 'beat', createInitialBeatState(true));
          expect(simRes.status).toBe('IDLE');
          const finalBeat = simRes.finalState as BeatState;
          expect(finalBeat.beatIndex).toBe(ws.MAIN.length);

          // Beat preview helper extracts every beat frame and a lit representative 8x8 thumbnail
          const preview = renderBeatVariationPreview(ws);
          expect(preview.totalBeats).toBe(ws.MAIN.length);
          expect(preview.frames).toHaveLength(ws.MAIN.length);
          expect(countLitLeds(preview.representativeState.leds)).toBeGreaterThan(0);
          expect(preview.svgMarkup).toContain('<svg');
          expect(preview.thumbnailUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);

          sequenceSignatures.add(ws.MAIN.map((b) => b.type).join('->'));
          if (!label.endsWith('-starter')) {
            variationThumbnailUrls.add(preview.thumbnailUrl);
          }
        }

        // Starter + 3 variations are all distinct programs, and the 3 cards have distinct static 8x8 thumbnails
        expect(sequenceSignatures.size).toBe(4);
        expect(variationThumbnailUrls.size).toBe(3);
      }
    });
  });

  describe('2. Binary Serialization Round-Trips with ENV_ID_BEAT = 0x03', () => {
    it('serializes and deserializes 1.8 & 1C starters and all 6 variations losslessly via ENV_ID_BEAT = 0x03', () => {
      const expectedTier1Opcodes = new Set([
        OP_BEAT_DRUM_KICK,    // 0x10
        OP_BEAT_DRUM_SNARE,   // 0x11
        OP_BEAT_DRUM_CLAP,    // 0x12
        OP_BEAT_PLAY_CHIME,   // 0x13
        OP_BEAT_STAMP_PRESET, // 0x14
        OP_BEAT_WAIT_BEAT,    // 0x15
        OP_BEAT_CLEAR_LEDS,   // 0x16
      ]);
      const observedOpcodes = new Set<number>();
      const observedStampPresetBytes = new Set<number>();

      for (const act of MODULE_1_BEAT_ACTIVITIES) {
        const workspaces = [
          act.starterWorkspace!,
          ...act.variations!.map((v) => v.workspace),
        ];

        for (const ws of workspaces) {
          const binary = exportToBinary(ws, 'beat', createInitialBeatState());

          // Header layout: [FORMAT_VERSION=1, ENV_ID_BEAT=0x03, ENV_VERSION_BEAT=1, scopeCount=1, SCOPE_MAIN=0, blockCount]
          expect(binary[0]).toBe(FORMAT_VERSION);
          expect(binary[1]).toBe(ENV_ID_BEAT);
          expect(binary[2]).toBe(ENV_VERSION_BEAT);
          expect(binary[3]).toBe(1);
          expect(binary[4]).toBe(0x00);
          expect(binary[5]).toBe(ws.MAIN.length);

          let offset = 6;
          for (const _block of ws.MAIN) {
            const headerByte = binary[offset++];
            expect(headerByte & 0xc0).toBe(0); // No MASK_HAS_REP or MASK_HAS_VAR_PARAM in Module 1
            const opcode = headerByte & 0x3f;
            expect(expectedTier1Opcodes.has(opcode)).toBe(true);
            observedOpcodes.add(opcode);

            if (opcode === OP_BEAT_STAMP_PRESET) {
              const presetByte = binary[offset++];
              expect([0, 1, 2]).toContain(presetByte);
              observedStampPresetBytes.add(presetByte);
            }
          }
          expect(offset).toBe(binary.length);

          // Binary round-trip
          const decodedBin = importFromBinary(binary);
          expect(decodedBin.success).toBe(true);
          expect(decodedBin.envId).toBe('beat');
          expect(decodedBin.workspace!.MAIN.map((b) => b.type)).toEqual(
            ws.MAIN.map((b) => b.type)
          );

          // Base64URL string round-trip
          const encodedStr = exportToString(ws, 'beat', createInitialBeatState());
          const decodedStr = importFromString(encodedStr);
          expect(decodedStr.success).toBe(true);
          expect(decodedStr.envId).toBe('beat');
          expect(decodedStr.workspace!.MAIN.map((b) => b.type)).toEqual(
            ws.MAIN.map((b) => b.type)
          );

          // Identical headless Beat execution frames before and after serialization
          const beforeFrames = renderBeatVariationPreview(ws).frames.map((f) => ({
            leds: f.leds,
            event: f.lastTriggeredEvent,
          }));
          const afterFrames = renderBeatVariationPreview(decodedStr.workspace!).frames.map((f) => ({
            leds: f.leds,
            event: f.lastTriggeredEvent,
          }));
          expect(afterFrames).toEqual(beforeFrames);
        }
      }

      // All 7 Tier 1 opcodes (0x10..0x16) and all 3 preset stamps (HEART=0, STAR=1, SMILE=2) are exercised
      expect(observedOpcodes).toEqual(expectedTier1Opcodes);
      expect(observedStampPresetBytes).toEqual(new Set([0, 1, 2]));
    });
  });

  describe('3. VariationCardsPanel Mini 8x8 Previews, Play/Stop Frame Playback, Audio Resilience & Accessibility', () => {
    it('renders 64-LED mini 8x8 previews & Play buttons on Beat cards while preserving static SVG thumbnails on Turtle cards', () => {
      // Beat Lesson 1.8: renders 3 playable 8x8 cards
      useAppStore.getState().setCurriculumActivity('1.8');
      const beatPanelHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(beatPanelHtml).toContain('data-testid="variation-cards-panel"');
      expect(beatPanelHtml).toContain('data-testid="variation-preview-live-status"');
      expect(beatPanelHtml).toContain('aria-live="polite"');

      const act18 = getActivityLatest('1.8')!;
      for (const card of act18.variations!) {
        expect(beatPanelHtml).toContain(`data-testid="variation-card-${card.id}"`);
        expect(beatPanelHtml).toContain(`data-testid="variation-beat-preview-${card.id}"`);
        expect(beatPanelHtml).toContain(`data-testid="variation-beat-grid-${card.id}"`);
        expect(beatPanelHtml).toContain(`data-testid="variation-beat-led-${card.id}-0-0"`);
        expect(beatPanelHtml).toContain(`data-testid="variation-beat-led-${card.id}-7-7"`);
        expect(beatPanelHtml).toContain(`data-testid="btn-preview-variation-${card.id}"`);
        expect(beatPanelHtml).toContain(`aria-label="Play preview for ${card.title}"`);
        expect(beatPanelHtml).toContain('aria-pressed="false"');
        expect(beatPanelHtml).toContain(`data-testid="btn-load-variation-${card.id}"`);
        expect(beatPanelHtml).not.toContain(`data-testid="variation-thumbnail-${card.id}"`);
      }

      // Idle Card 1 ('1.8-rock-smiley') statically displays Cyan SMILE pixels (e.g. row 0, col 2)
      expect(beatPanelHtml).toContain(
        `data-testid="variation-beat-led-1.8-rock-smiley-2-0" data-lit="true" data-color="${BEAT_PRESETS.SMILE.defaultColor}"`
      );

      // Store switches activeSimId to 'beat', and BeatCanvas + App mount cleanly
      expect(useAppStore.getState().activeSimId).toBe('beat');
      const beatCanvasHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, { state: useAppStore.getState().beatState })
      );
      expect(beatCanvasHtml).toContain('data-testid="beat-canvas"');

      const appHtml = renderToStaticMarkup(React.createElement(App));
      expect(appHtml).toContain('data-testid="pane-simulation"');
      expect(appHtml).toContain('data-testid="variation-cards-panel"');

      // Fallback check: if a Beat variation ends on CLEAR_LEDS, representativeState still uses the last lit frame
      const endsWithClearPreview = renderBeatVariationPreview({
        MAIN: [
          { id: 'c1', type: 'STAMP_HEART' },
          { id: 'c2', type: 'DRUM_KICK' },
          { id: 'c3', type: 'CLEAR_LEDS' },
        ],
        F1: [],
        F2: [],
        F3: [],
      });
      expect(countLitLeds(endsWithClearPreview.finalState.leds)).toBe(0);
      expect(countLitLeds(endsWithClearPreview.representativeState.leds)).toBeGreaterThan(0);
      expect(endsWithClearPreview.representativeState.leds[1][1]).toBe(
        BEAT_PRESETS.HEART.defaultColor
      );

      // Turtle Lesson 1.6: still renders static SVG <img> thumbnails and NO Beat preview toggle button
      useAppStore.getState().setCurriculumActivity('1.6');
      const turtlePanelHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(turtlePanelHtml).toContain('data-testid="variation-thumbnail-1.6-stairs"');
      expect(turtlePanelHtml).toContain('data:image/svg+xml;charset=utf-8,');
      expect(turtlePanelHtml).not.toContain('data-testid="btn-preview-variation-1.6-stairs"');
    });

    it('steps frame-by-frame through LED states & beat-ring pulses on ▶/⏹ without modifying main workspace or simulation state', () => {
      vi.useFakeTimers();
      const { MockAudioContext, log } = createMockAudioContextFactory('running', true);
      (globalThis as any).AudioContext = MockAudioContext;

      const store = useAppStore.getState();
      store.setCurriculumActivity('1.8');

      // Customize learner's main workspace & step main Beat pad once so main state is non-trivial
      store.clearWorkspace();
      store.addBlock('MAIN', 'STAMP_STAR');
      store.addBlock('MAIN', 'DRUM_CLAP');
      store.step();

      const mainWorkspaceBefore = JSON.stringify(useAppStore.getState().workspace);
      const mainBeatBefore = JSON.stringify(useAppStore.getState().beatState);
      const mainRuntimeBefore = JSON.stringify(useAppStore.getState().runtime);
      const historyDepthBefore = useAppStore.getState().past.length;
      const noiseCountBefore = log.bufferSourcesCreated;
      const oscCountBefore = log.oscillatorsCreated;

      const rockCard = getActivityLatest('1.8')!.variations!.find(
        (v) => v.id === '1.8-rock-smiley'
      )!;
      // Sequence: 1:STAMP_SMILE, 2:DRUM_KICK, 3:DRUM_SNARE, 4:CLEAR_LEDS, 5:WAIT_BEAT, 6:STAMP_SMILE, 7:DRUM_KICK, 8:DRUM_SNARE

      // 1. Toggle ▶ ON -> immediately executes Beat #1 (STAMP_SMILE)
      const toggleRes = beatVariationPreviewPlayer.toggle(rockCard, { activityId: '1.8' });
      expect(toggleRes).toBe('playing');

      let snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.isPlaying).toBe(true);
      expect(snap.activeCardId).toBe('1.8-rock-smiley');
      expect(snap.tickCount).toBe(1);
      expect(snap.totalBeats).toBe(8);
      expect(snap.currentState?.lastTriggeredEvent?.kind).toBe('STAMP');
      expect(countLitLeds(snap.currentState!.leds)).toBe(
        countLitLeds(renderBeatVariationPreview(rockCard.workspace).representativeState.leds)
      );
      expect(snap.liveAnnouncement).toContain('Previewing variation: Blinking Smiley Rock');

      // Rendered VariationCardsPanel shows Stop (⏹), aria-pressed="true", beat-ring pulse, and #1/8
      const playingHtmlBeat1 = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(playingHtmlBeat1).toContain(
        `data-testid="btn-preview-variation-1.8-rock-smiley" data-preview-state="playing" aria-pressed="true" aria-label="Stop preview for Blinking Smiley Rock"`
      );
      expect(playingHtmlBeat1).toContain('data-testid="variation-beat-ring-pulse-1.8-rock-smiley"');
      expect(playingHtmlBeat1).toContain('data-cue="STAMP"');
      expect(playingHtmlBeat1).toContain('#1/8');

      // 2. Advance 1 tick -> Beat #2 (DRUM_KICK triggers kick oscillators!)
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS);
      snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.tickCount).toBe(2);
      expect(snap.currentState?.lastTriggeredEvent?.kind).toBe('DRUM_KICK');
      expect(log.oscillatorsCreated).toBeGreaterThan(oscCountBefore);

      // 3. Advance 1 tick -> Beat #3 (DRUM_SNARE triggers snare noise + body!)
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS);
      snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.tickCount).toBe(3);
      expect(snap.currentState?.lastTriggeredEvent?.kind).toBe('DRUM_SNARE');
      expect(log.bufferSourcesCreated).toBeGreaterThan(noiseCountBefore);

      // 4. Advance 1 tick -> Beat #4 (CLEAR_LEDS turns all 64 mini LEDs off during the blink!)
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS);
      snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.tickCount).toBe(4);
      expect(snap.currentState?.lastTriggeredEvent?.kind).toBe('CLEAR_LEDS');
      expect(countLitLeds(snap.currentState!.leds)).toBe(0);

      const playingHtmlBeat4 = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(playingHtmlBeat4).not.toContain(
        `data-testid="variation-beat-led-1.8-rock-smiley-2-0" data-lit="true"`
      );

      // 5. Advance 2 ticks -> Beat #6 (STAMP_SMILE blinks back ON!)
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS * 2);
      snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.tickCount).toBe(6);
      expect(countLitLeds(snap.currentState!.leds)).toBeGreaterThan(0);

      // 6. Advance remaining beats -> Beat #7, Beat #8, then completion tick resets cleanly to idle!
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS * 2);
      expect(beatVariationPreviewPlayer.getSnapshot().tickCount).toBe(8);
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);

      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS);
      snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.isPlaying).toBe(false);
      expect(snap.activeCardId).toBeNull();
      expect(snap.liveAnnouncement).toContain('Finished preview for Blinking Smiley Rock');

      // Main store workspace, main BeatState, runtime, isPlaying, and Undo stack stayed 100% untouched!
      expect(JSON.stringify(useAppStore.getState().workspace)).toBe(mainWorkspaceBefore);
      expect(JSON.stringify(useAppStore.getState().beatState)).toBe(mainBeatBefore);
      expect(JSON.stringify(useAppStore.getState().runtime)).toBe(mainRuntimeBefore);
      expect(useAppStore.getState().isPlaying).toBe(false);
      expect(useAppStore.getState().past.length).toBe(historyDepthBefore);
    });

    it('switches cleanly from Card A to Card B, toggles manual Stop (⏹), respects global mute, and never blocks when AudioContext is suspended', () => {
      vi.useFakeTimers();

      // Part A: Permanently suspended AudioContext (browser autoplay block) never blocks preview ticks
      const { MockAudioContext: BlockedAudioCtx, log: blockedLog } = createMockAudioContextFactory(
        'suspended',
        false
      );
      (globalThis as any).AudioContext = BlockedAudioCtx;

      useAppStore.getState().setCurriculumActivity('1C');
      const [cardA, cardB] = getActivityLatest('1C')!.variations!;

      beatVariationPreviewPlayer.toggle(cardA, { activityId: '1C' });
      expect(beatVariationPreviewPlayer.getSnapshot().activeCardId).toBe(cardA.id);
      expect(beatVariationPreviewPlayer.getSnapshot().tickCount).toBe(1);
      expect(blockedLog.resumesCalled).toBe(1);
      expect(blockedLog.oscillatorsCreated).toBe(0);

      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS * 2);
      expect(beatVariationPreviewPlayer.getSnapshot().tickCount).toBe(3);

      // Starting ▶ on Card B automatically stops Card A and starts Card B at beat #1
      beatVariationPreviewPlayer.toggle(cardB, { activityId: '1C' });
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);
      expect(beatVariationPreviewPlayer.getSnapshot().activeCardId).toBe(cardB.id);
      expect(beatVariationPreviewPlayer.getSnapshot().tickCount).toBe(1);

      const switchedHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(switchedHtml).toContain(
        `data-testid="variation-card-${cardA.id}" data-preview-active="false"`
      );
      expect(switchedHtml).toContain(
        `data-testid="variation-card-${cardB.id}" data-preview-active="true"`
      );

      // Pressing ⏹ on Card B stops playback manually and announces via aria-live
      const stopRes = beatVariationPreviewPlayer.toggle(cardB, { activityId: '1C' });
      expect(stopRes).toBe('stopped');
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(false);
      expect(beatVariationPreviewPlayer.getSnapshot().liveAnnouncement).toContain(
        `Stopped preview for ${cardB.title}`
      );

      // Part B: Respects global mute state (produces zero oscillator/noise nodes while animating LEDs)
      const { MockAudioContext: RunningAudioCtx, log: mutedLog } = createMockAudioContextFactory(
        'running',
        true
      );
      (globalThis as any).AudioContext = RunningAudioCtx;
      beatSynth.resetForTests();
      useAppStore.getState().setBeatMuted(true);

      beatVariationPreviewPlayer.toggle(cardA, { activityId: '1C' });
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);
      expect(beatVariationPreviewPlayer.getSnapshot().liveAnnouncement).toContain('(muted)');
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS * 4);
      expect(beatVariationPreviewPlayer.getSnapshot().tickCount).toBe(5);
      expect(mutedLog.oscillatorsCreated).toBe(0);
      expect(mutedLog.bufferSourcesCreated).toBe(0);
    });

    it('supports Enter & Space keyboard activation without key-repeat oscillation, and loads code with Undo protection while stopping active preview', () => {
      vi.useFakeTimers();
      const store = useAppStore.getState();
      store.setSpeed('instant');
      store.setCurriculumActivity('1C');

      // Place custom learner blocks on 1C first
      store.clearWorkspace();
      store.addBlock('MAIN', 'STAMP_HEART');
      store.addBlock('MAIN', 'PLAY_CHIME');
      const learnerBlocksBefore = useAppStore.getState().workspace.MAIN.map((b) => b.type);
      expect(learnerBlocksBefore).toEqual(['STAMP_HEART', 'PLAY_CHIME']);

      const countdownCard = getActivityLatest('1C')!.variations!.find(
        (v) => v.id === '1C-countdown-drop'
      )!;

      // Keyboard activation via Enter starts preview; held repeat is ignored; Space stops preview
      let preventedCount = 0;
      const preventDefault = () => {
        preventedCount++;
      };

      expect(
        handleButtonKeyboardActivation({ key: 'Tab', preventDefault }, () => {
          beatVariationPreviewPlayer.toggle(countdownCard, { activityId: '1C' });
        })
      ).toBe(false);
      expect(preventedCount).toBe(0);
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(false);

      expect(
        handleButtonKeyboardActivation({ key: 'Enter', preventDefault }, () => {
          beatVariationPreviewPlayer.toggle(countdownCard, { activityId: '1C' });
        })
      ).toBe(true);
      expect(preventedCount).toBe(1);
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);
      expect(beatVariationPreviewPlayer.getSnapshot().activeCardId).toBe('1C-countdown-drop');

      // Held key auto-repeat does NOT stop the running preview
      handleButtonKeyboardActivation({ key: 'Enter', repeat: true, preventDefault }, () => {
        beatVariationPreviewPlayer.toggle(countdownCard, { activityId: '1C' });
      });
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);

      // Space toggles preview off
      handleButtonKeyboardActivation({ key: ' ', preventDefault }, () => {
        beatVariationPreviewPlayer.toggle(countdownCard, { activityId: '1C' });
      });
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(false);

      // Start preview again, then Load Code -> preview stops cleanly and workspace loads with Undo protection
      beatVariationPreviewPlayer.start(countdownCard, { activityId: '1C' });
      vi.advanceTimersByTime(BEAT_VARIATION_PREVIEW_TICK_MS * 2);
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);

      beatVariationPreviewPlayer.stop('silent');
      store.loadVariationWorkspace(countdownCard.workspace, countdownCard.title);

      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(false);
      const afterLoad = useAppStore.getState();
      expect(afterLoad.canUndo).toBe(true);
      expect(afterLoad.workspace.MAIN.map((b) => b.type)).toEqual(
        countdownCard.workspace.MAIN.map((b) => b.type)
      );
      expect(afterLoad.statusAnnouncement).toContain('Countdown Drop');
      expect(afterLoad.statusAnnouncement).toContain('Undo');

      // Instant mode rendered the loaded card's final Heart LED stamp onto main BeatState
      expect(afterLoad.beatState.leds[1][1]).toBe(BEAT_PRESETS.HEART.defaultColor);

      // Undo restores learner's prior 2-block workspace cleanly
      store.undo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(
        learnerBlocksBefore
      );
      expect(useAppStore.getState().beatState.leds).toHaveLength(BEAT_GRID_SIZE);
    });
  });
});
