import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  createCurriculumBlock,
  getActivitiesForModule,
  getActivityLatest,
} from '../src/data/curriculum';
import {
  BEAT_CURSOR_TURN_PARAM_DEF,
  BEAT_PALETTE_ITEMS,
  beatSimulationEnvironment,
  createInitialBeatState,
  resetBeatState,
} from '../src/simulations/beat/beatEnvironment';
import { BeatCanvas } from '../src/simulations/beat/components/BeatCanvas';
import { BEAT_GRID_SIZE, BeatState, DEFAULT_BEAT_LED_COLOR } from '../src/simulations/beat/types';
import { countLitLeds } from '../src/simulations/beat/presets';
import {
  CursorTurnVisual,
  ParamVisual,
} from '../src/components/params/VisualParamBadges';
import { ParamSelectionPopover } from '../src/components/params/ParamSelectionPopover';
import { BlockPalette } from '../src/components/BlockPalette';
import {
  VariationCardsPanel,
  beatVariationPreviewPlayer,
  renderBeatVariationPreview,
} from '../src/components/VariationCardsPanel';
import { renderBeatMapSvg } from '../src/services/mapThumbnailGenerator';
import {
  exportLessonCodeOnly,
  exportLessonToBinary,
  exportLessonToString,
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_BEAT,
  ENV_ID_LESSON,
  ENV_VERSION_BEAT,
  FORMAT_VERSION,
  MASK_HAS_REP,
  MASK_HAS_VAR_PARAM,
  OP_BEAT_CURSOR_STEP,
  OP_BEAT_CURSOR_TURN,
  OP_BEAT_DRUM_KICK,
  OP_BEAT_PLAY_CHIME,
  OP_BEAT_SET_LED_COLOR,
  SCOPE_ID_MAIN,
} from '../src/engine/serialization/types';
import { validateLoopStructure, createInitialInterpreterState, tickInterpreter } from '../src/engine/interpreter';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { doesBlockMatchHintCategory } from '../src/engine/placeholderHelpers';
import { clearAllSavedPrograms, saveProgram } from '../src/services/localSaveService';
import { useAppStore } from '../src/store/useAppStore';
import { Direction, WorkspaceState } from '../src/types';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';
import '../src/simulations/beat/beatEnvironment';

function makeBeatWorkspace(blocks: ReturnType<typeof createCurriculumBlock>[]): WorkspaceState {
  return {
    MAIN: blocks,
    F1: [],
    F2: [],
    F3: [],
  };
}

describe('Loops (loop): Beat LED Cursor Blocks (CURSOR_STEP, CURSOR_TURN) & Lesson loop.4', () => {
  beforeEach(() => {
    beatVariationPreviewPlayer.stop();
    clearAllSavedPrograms();
    const store = useAppStore.getState();
    store.pause();
    store.setAppMode('sandbox');
    store.setSimEnvironment('beat');
  });

  afterEach(() => {
    beatVariationPreviewPlayer.stop();
    vi.useRealTimers();
  });

  describe('1. CURSOR_STEP & CURSOR_TURN Simulation Semantics & Reset', () => {
    it('initializes cursor at (1, 1) facing EAST with visible=false and resets cleanly after execution', () => {
      const initial = createInitialBeatState(true);
      expect(initial.cursor).toEqual({
        x: 1,
        y: 1,
        dir: 'EAST',
        visible: false,
      });

      const stepped = beatSimulationEnvironment.executeAction('CURSOR_STEP', initial).nextState;
      expect(stepped.cursor).toEqual({
        x: 2,
        y: 1,
        dir: 'EAST',
        visible: true,
      });
      expect(countLitLeds(stepped.leds)).toBe(1);
      expect(stepped.leds[0][1]).toBe(DEFAULT_BEAT_LED_COLOR);
      expect(stepped.leds[0][0]).toBeNull();
      expect(stepped.lastTriggeredEvent).toEqual({
        kind: 'LED_CHANGE',
        actionType: 'CURSOR_STEP',
        beatIndex: 1,
        color: DEFAULT_BEAT_LED_COLOR,
      });

      const afterReset = resetBeatState(stepped);
      expect(afterReset.cursor).toEqual({
        x: 1,
        y: 1,
        dir: 'EAST',
        visible: false,
      });
      expect(countLitLeds(afterReset.leds)).toBe(0);
      expect(afterReset.isMuted).toBe(true);
      expect(afterReset.beatIndex).toBe(0);
    });

    it('wraps cleanly across all 4 edges (EAST, WEST, SOUTH, NORTH) on the 1..8 x 1..8 LED matrix', () => {
      // EAST wrap: (8, 3) -> (1, 3)
      const eastEdge: BeatState = {
        ...createInitialBeatState(true),
        activeColor: '#f43f5e',
        cursor: { x: 8, y: 3, dir: 'EAST', visible: true },
      };
      const wrappedEast = beatSimulationEnvironment.executeAction('CURSOR_STEP', eastEdge).nextState;
      expect(wrappedEast.cursor).toEqual({ x: 1, y: 3, dir: 'EAST', visible: true });
      expect(wrappedEast.leds[2][0]).toBe('#f43f5e');

      // WEST wrap: (1, 5) -> (8, 5)
      const westEdge: BeatState = {
        ...createInitialBeatState(true),
        activeColor: '#fbbf24',
        cursor: { x: 1, y: 5, dir: 'WEST', visible: true },
      };
      const wrappedWest = beatSimulationEnvironment.executeAction('CURSOR_STEP', westEdge).nextState;
      expect(wrappedWest.cursor).toEqual({ x: 8, y: 5, dir: 'WEST', visible: true });
      expect(wrappedWest.leds[4][7]).toBe('#fbbf24');

      // SOUTH wrap: (4, 8) -> (4, 1)
      const southEdge: BeatState = {
        ...createInitialBeatState(true),
        activeColor: '#10b981',
        cursor: { x: 4, y: 8, dir: 'SOUTH', visible: true },
      };
      const wrappedSouth = beatSimulationEnvironment.executeAction('CURSOR_STEP', southEdge).nextState;
      expect(wrappedSouth.cursor).toEqual({ x: 4, y: 1, dir: 'SOUTH', visible: true });
      expect(wrappedSouth.leds[0][3]).toBe('#10b981');

      // NORTH wrap: (6, 1) -> (6, 8)
      const northEdge: BeatState = {
        ...createInitialBeatState(true),
        activeColor: '#a855f7',
        cursor: { x: 6, y: 1, dir: 'NORTH', visible: true },
      };
      const wrappedNorth = beatSimulationEnvironment.executeAction('CURSOR_STEP', northEdge).nextState;
      expect(wrappedNorth.cursor).toEqual({ x: 6, y: 8, dir: 'NORTH', visible: true });
      expect(wrappedNorth.leds[7][5]).toBe('#a855f7');
    });

    it('rotates CURSOR_TURN 90 degrees RIGHT and LEFT across all 4 cardinal directions without lighting LEDs', () => {
      let state = createInitialBeatState(true);
      const expectedRight: Direction[] = ['SOUTH', 'WEST', 'NORTH', 'EAST'];
      for (const expectedDir of expectedRight) {
        state = beatSimulationEnvironment.executeAction('CURSOR_TURN', state, {
          params: { direction: 'RIGHT' },
        }).nextState;
        expect(state.cursor).toEqual({
          x: 1,
          y: 1,
          dir: expectedDir,
          visible: true,
        });
      }
      expect(countLitLeds(state.leds)).toBe(0);

      const expectedLeft: Direction[] = ['NORTH', 'WEST', 'SOUTH', 'EAST'];
      for (const expectedDir of expectedLeft) {
        state = beatSimulationEnvironment.executeAction('CURSOR_TURN', state, {
          params: { direction: 'LEFT' },
        }).nextState;
        expect(state.cursor).toEqual({
          x: 1,
          y: 1,
          dir: expectedDir,
          visible: true,
        });
      }
      expect(countLitLeds(state.leds)).toBe(0);
      expect(state.lastTriggeredEvent?.kind).toBe('LED_CHANGE');
      expect(state.lastTriggeredEvent?.actionType).toBe('CURSOR_TURN');
    });

    it('executes CURSOR_STEP with repeatCount x7 sub-tick by sub-tick via interpreter and lights each stepped LED with activeColor', () => {
      const ws = makeBeatWorkspace([
        createCurriculumBlock('SET_LED_COLOR', undefined, { color: '#ec4899' }, 'b1'),
        createCurriculumBlock('CURSOR_STEP', 7, undefined, 'b2'),
      ]);

      let runtime = createInitialInterpreterState();
      let beat = createInitialBeatState(true);
      const visitedX: number[] = [];

      while (true) {
        const prevBeat = beat.beatIndex;
        const res = tickInterpreter(runtime, ws, beat, beatSimulationEnvironment);
        runtime = res.nextRuntime;
        beat = res.nextGrid;
        if (beat.beatIndex !== prevBeat && beat.lastTriggeredEvent?.actionType === 'CURSOR_STEP') {
          visitedX.push(beat.cursor.x);
        }
        if (res.done) break;
      }

      expect(visitedX).toEqual([2, 3, 4, 5, 6, 7, 8]);
      expect(beat.cursor).toEqual({ x: 8, y: 1, dir: 'EAST', visible: true });
      expect(countLitLeds(beat.leds)).toBe(7);
      for (let col = 1; col < BEAT_GRID_SIZE; col++) {
        expect(beat.leds[0][col]).toBe('#ec4899');
      }
      expect(beat.leds[0][0]).toBeNull();
    });

    it('maps CURSOR_STEP to motion placeholder hint and CURSOR_TURN to turn placeholder hint', () => {
      const stepItem = BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'CURSOR_STEP')!;
      const turnItem = BEAT_PALETTE_ITEMS.find((p) => p.actionType === 'CURSOR_TURN')!;
      expect(doesBlockMatchHintCategory('CURSOR_STEP', stepItem.category, 'motion')).toBe(true);
      expect(doesBlockMatchHintCategory('CURSOR_STEP', stepItem.category, 'turn')).toBe(false);
      expect(doesBlockMatchHintCategory('CURSOR_TURN', turnItem.category, 'turn')).toBe(true);
      expect(doesBlockMatchHintCategory('CURSOR_TURN', turnItem.category, 'motion')).toBe(false);
    });
  });

  describe('2. BeatCanvas Directional Reticle, SVG Thumbnail & Kid-Friendly Turn Badge SSR', () => {
    it('hides beat-cursor-reticle when cursor.visible is false and renders accessible directional reticle when true', () => {
      const hiddenState = createInitialBeatState(true);
      const hiddenHtml = renderToStaticMarkup(
        React.createElement(BeatCanvas, { state: hiddenState })
      );
      expect(hiddenHtml).not.toContain('data-testid="beat-cursor-reticle"');

      const dirRotations: Array<{ dir: Direction; deg: number }> = [
        { dir: 'NORTH', deg: 0 },
        { dir: 'EAST', deg: 90 },
        { dir: 'SOUTH', deg: 180 },
        { dir: 'WEST', deg: 270 },
      ];

      for (const { dir, deg } of dirRotations) {
        const visibleState: BeatState = {
          ...createInitialBeatState(true),
          cursor: { x: 4, y: 2, dir, visible: true },
        };
        const html = renderToStaticMarkup(
          React.createElement(BeatCanvas, { state: visibleState })
        );
        expect(html).toContain('data-testid="beat-cursor-reticle"');
        expect(html).toContain('data-cursor-x="4"');
        expect(html).toContain('data-cursor-y="2"');
        expect(html).toContain(`data-cursor-dir="${dir}"`);
        expect(html).toContain(
          `aria-label="LED Cursor at column 4, row 2, facing ${dir.toLowerCase()}"`
        );
        expect(html).toContain(`rotate(${deg}deg)`);
      }
    });

    it('renders cursor reticle in renderBeatMapSvg only when cursor.visible is true', () => {
      const idleSvg = renderBeatMapSvg(createInitialBeatState(true));
      expect(idleSvg).not.toContain('<polygon');

      const activeSvg = renderBeatMapSvg({
        ...createInitialBeatState(true),
        cursor: { x: 3, y: 5, dir: 'SOUTH', visible: true },
      });
      expect(activeSvg).toContain('<polygon');
      expect(activeSvg).toContain('rotate(180)');
    });

    it('renders zero-reading CursorTurnVisual badges and 2-column ParamSelectionPopover without variables', () => {
      const leftHtml = renderToStaticMarkup(
        React.createElement(CursorTurnVisual, { turnDir: 'LEFT', compact: true })
      );
      const rightHtml = renderToStaticMarkup(
        React.createElement(ParamVisual, {
          paramDef: BEAT_CURSOR_TURN_PARAM_DEF,
          value: 'RIGHT',
          compact: false,
          actionType: 'CURSOR_TURN',
        })
      );
      expect(leftHtml).toContain('data-testid="cursor-turn-visual-left"');
      expect(rightHtml).toContain('data-testid="cursor-turn-visual-right"');
      expect(rightHtml).toContain('90°');

      const popoverHtml = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: BEAT_CURSOR_TURN_PARAM_DEF,
          currentValue: 'RIGHT',
          onSelect: () => {},
          onClose: () => {},
          actionType: 'CURSOR_TURN',
        })
      );
      expect(popoverHtml).toContain('grid-cols-2');
      expect(popoverHtml).toContain('data-testid="param-option-LEFT"');
      expect(popoverHtml).toContain('data-testid="param-option-RIGHT"');
      expect(popoverHtml).not.toContain('Variables');
    });
  });

  describe('3. Binary Serialization (0x1C CURSOR_STEP, 0x1D CURSOR_TURN) & Backward Compatibility', () => {
    it('encodes exact opcodes 0x1C (with MASK_HAS_REP) and 0x1D (LEFT=0, RIGHT=1) and round-trips standalone Beat binary', () => {
      const ws = makeBeatWorkspace([
        createCurriculumBlock('CURSOR_STEP', undefined, undefined, 'c1'),
        createCurriculumBlock('CURSOR_STEP', 7, undefined, 'c2'),
        createCurriculumBlock('CURSOR_TURN', undefined, { direction: 'LEFT' }, 'c3'),
        createCurriculumBlock('CURSOR_TURN', undefined, { direction: 'RIGHT' }, 'c4'),
        createCurriculumBlock('CURSOR_STEP', 'a' as any, undefined, 'c5'),
      ]);

      const bytes = exportToBinary(ws, 'beat');
      expect(Array.from(bytes)).toEqual([
        FORMAT_VERSION,
        ENV_ID_BEAT,
        ENV_VERSION_BEAT,
        1, // 1 non-empty scope
        SCOPE_ID_MAIN,
        5, // 5 blocks
        OP_BEAT_CURSOR_STEP, // 0x1c
        OP_BEAT_CURSOR_STEP | MASK_HAS_REP, // 0x5c
        7, // repeatCount = 7
        OP_BEAT_CURSOR_TURN, // 0x1d
        0, // LEFT = 0
        OP_BEAT_CURSOR_TURN, // 0x1d
        1, // RIGHT = 1
        OP_BEAT_CURSOR_STEP | MASK_HAS_REP | MASK_HAS_VAR_PARAM, // 0xdc
        0x01, // paramVarMask bit 0 = repeatCount is variable
        0, // variable 'a' -> index 0
      ]);

      const decoded = importFromBinary(bytes);
      expect(decoded.success).toBe(true);
      expect(decoded.envId).toBe('beat');
      expect(
        decoded.workspace?.MAIN.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      ).toEqual([
        { type: 'CURSOR_STEP', repeatCount: undefined, params: undefined },
        { type: 'CURSOR_STEP', repeatCount: 7, params: undefined },
        { type: 'CURSOR_TURN', repeatCount: undefined, params: { direction: 'LEFT' } },
        { type: 'CURSOR_TURN', repeatCount: undefined, params: { direction: 'RIGHT' } },
        { type: 'CURSOR_STEP', repeatCount: 'a', params: undefined },
      ]);
    });

    it('round-trips Lesson loop.4 workspaces across Path A (SavedProgramEntry / exportLessonCodeOnly) and Path B (ENV_ID_LESSON = 0x04)', () => {
      const lessonLoop4 = getActivityLatest('loop.4')!;
      expect(lessonLoop4).toBeDefined();

      // Path A: exportLessonCodeOnly + SavedProgramEntry store round-trip
      const codeOnlyStr = exportLessonCodeOnly(lessonLoop4.starterWorkspace, 'beat');
      const codeOnlyImported = importFromString(codeOnlyStr);
      expect(codeOnlyImported.success).toBe(true);
      expect(codeOnlyImported.envId).toBe('beat');
      expect(
        codeOnlyImported.workspace?.MAIN.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      ).toEqual(
        lessonLoop4.starterWorkspace.MAIN.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      );

      // Path B: ENV_ID_LESSON = 0x04 envelope
      const lessonBytes = exportLessonToBinary(lessonLoop4.starterWorkspace, 'beat', 'loop.4', 1);
      expect(lessonBytes[0]).toBe(FORMAT_VERSION);
      expect(lessonBytes[1]).toBe(ENV_ID_LESSON);
      expect(lessonBytes[2]).toBe(ENV_ID_BEAT);

      const lessonStr = exportLessonToString(lessonLoop4.starterWorkspace, 'beat', 'loop.4', 1);
      const lessonImported = importFromString(lessonStr);
      expect(lessonImported.success).toBe(true);
      expect(lessonImported.envId).toBe('lesson');
      expect(lessonImported.innerEnvId).toBe('beat');
      expect(lessonImported.lessonId).toBe('loop.4');
      expect(lessonImported.lessonVersion).toBe(1);
      expect(
        lessonImported.workspace?.MAIN.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      ).toEqual(
        lessonLoop4.starterWorkspace.MAIN.map((b) => ({
          type: b.type,
          repeatCount: b.repeatCount,
          params: b.params,
        }))
      );

      // Store Path A (SavedProgramEntry) + Path B (exportCode/importCode) in Lesson loop.4
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('loop.4');

      const savedEntry = saveProgram({
        title: 'Border Chase Save',
        simId: 'beat',
        code: codeOnlyStr,
        screenshot: renderBeatVariationPreview(lessonLoop4.starterWorkspace).thumbnailUrl,
        status: 'IDLE',
        stepCount: 0,
        lessonId: 'loop.4',
        lessonVersion: lessonLoop4.version,
      });
      expect(savedEntry.lessonId).toBe('loop.4');
      expect(savedEntry.simId).toBe('beat');

      store.setAppMode('sandbox');
      const loadedRes = useAppStore.getState().loadSavedProgram(savedEntry);
      expect(loadedRes.success).toBe(true);
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('loop.4');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(
        lessonLoop4.starterWorkspace.MAIN.map((b) => b.type)
      );
    });

    it('preserves byte-for-byte backward compatibility for existing Tier 1 (seq.8) and Tier 2 (param.5) Beat saves', () => {
      const lessonSeq8 = getActivityLatest('seq.8')!;
      const lessonParam5 = getActivityLatest('param.5')!;

      const tier1Str = exportToString(lessonSeq8.starterWorkspace, 'beat');
      const tier1Decoded = importFromString(tier1Str);
      expect(tier1Decoded.success).toBe(true);
      expect(tier1Decoded.workspace?.MAIN.map((b) => b.type)).toEqual(
        lessonSeq8.starterWorkspace.MAIN.map((b) => b.type)
      );

      const tier2Str = exportToString(lessonParam5.starterWorkspace, 'beat');
      const tier2Decoded = importFromString(tier2Str);
      expect(tier2Decoded.success).toBe(true);
      expect(
        tier2Decoded.workspace?.MAIN.map((b) => ({
          type: b.type,
          params: b.params,
        }))
      ).toEqual(
        lessonParam5.starterWorkspace.MAIN.map((b) => ({
          type: b.type,
          params: b.params,
        }))
      );

      // Verify single Tier 1 & Tier 2 opcode bytes remain exact
      const legacyCheckWs = makeBeatWorkspace([
        createCurriculumBlock('DRUM_KICK', undefined, undefined, 'k1'),
        createCurriculumBlock('SET_LED_COLOR', undefined, { color: '#f43f5e' }, 'k2'),
        createCurriculumBlock('PLAY_CHIME', undefined, undefined, 'k3'),
      ]);
      expect(Array.from(exportToBinary(legacyCheckWs, 'beat'))).toEqual([
        FORMAT_VERSION,
        ENV_ID_BEAT,
        ENV_VERSION_BEAT,
        1,
        SCOPE_ID_MAIN,
        3,
        OP_BEAT_DRUM_KICK,
        OP_BEAT_SET_LED_COLOR,
        1, // Rose = swatch 1
        OP_BEAT_PLAY_CHIME,
      ]);
    });
  });

  describe('4. Curriculum Lesson loop.4 Schema, Staged Palette, Perimeter Starter & 3 Playable Variations', () => {
    it('registers Lesson loop.3a and loop.4 in CURRICULUM_ACTIVITIES with staged Beat + Loop + Cursor palette', () => {
      const loopIds = getActivitiesForModule('loop').map((a) => a.id);
      expect(loopIds).toContain('loop.3a');
      expect(loopIds).toContain('loop.4');
      expect(CURRICULUM_ACTIVITIES.some((a) => a.id === 'loop.4')).toBe(true);

      const lessonLoop4 = getActivityLatest('loop.4')!;
      expect(lessonLoop4.moduleId).toBe('loop');
      expect(lessonLoop4.version).toBe(1);
      expect(lessonLoop4.format).toBe('sandbox');
      expect(lessonLoop4.simId).toBe('beat');
      expect(lessonLoop4.title).toBe('Rhythm & Border Chase Loops');

      expect(lessonLoop4.palette.allowedSimBlocks).toContain('SET_BEAT_DELAY');
      expect(lessonLoop4.palette.allowedSimBlocks).toContain('CURSOR_STEP');
      expect(lessonLoop4.palette.allowedSimBlocks).toContain('CURSOR_TURN');
      expect(lessonLoop4.palette.allowedControlBlocks).toEqual(['LOOP_START', 'LOOP_END']);
      expect(lessonLoop4.palette.allowedScopes).toEqual(['MAIN']);
      expect(lessonLoop4.palette.allowRepeatBadges).toBe(true);
      expect(lessonLoop4.palette.allowActionParams).toBe(true);
      expect(lessonLoop4.palette.allowVariables).toBe(false);

      // Starter has 6..10 blocks and valid loop structure
      expect(lessonLoop4.starterWorkspace.MAIN.length).toBeGreaterThanOrEqual(6);
      expect(lessonLoop4.starterWorkspace.MAIN.length).toBeLessThanOrEqual(10);
      expect(validateLoopStructure(lessonLoop4.starterWorkspace.MAIN).hasError).toBe(false);
    });

    it('executes Lesson loop.4 starter workspace headlessly to light all 28 border LEDs around the 8x8 perimeter', () => {
      const lessonLoop4 = getActivityLatest('loop.4')!;
      const simRes = runHeadlessSimulation(
        lessonLoop4.starterWorkspace,
        'beat',
        createInitialBeatState(true)
      );
      const finalBeat = simRes.finalState as BeatState;

      // Perimeter of 8x8 grid has 8 + 7 + 7 + 6 = 28 cells; interior 6x6 has 36 cells
      expect(countLitLeds(finalBeat.leds)).toBe(28);
      for (let r = 0; r < BEAT_GRID_SIZE; r++) {
        for (let c = 0; c < BEAT_GRID_SIZE; c++) {
          const isBorder =
            r === 0 || r === BEAT_GRID_SIZE - 1 || c === 0 || c === BEAT_GRID_SIZE - 1;
          if (isBorder) {
            expect(finalBeat.leds[r][c]).toBe('#06b6d4');
          } else {
            expect(finalBeat.leds[r][c]).toBeNull();
          }
        }
      }
      expect(finalBeat.cursor).toEqual({
        x: 1,
        y: 1,
        dir: 'EAST',
        visible: true,
      });
    });

    it('renders staged BlockPalette and VariationCardsPanel for Lesson loop.4 and animates cursor in card preview playback', () => {
      vi.useFakeTimers();
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('loop.4');
      expect(useAppStore.getState().activeSimId).toBe('beat');

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('Step LED Cursor');
      expect(paletteHtml).toContain('Turn LED Cursor');
      expect(paletteHtml).toContain('data-testid="palette-loop-start"');
      expect(paletteHtml).toContain('data-testid="palette-loop-end"');
      expect(paletteHtml).toContain('data-testid="palette-number-2"');
      expect(paletteHtml).not.toContain('data-testid="palette-var-assign"');
      expect(paletteHtml).not.toContain('data-testid="palette-call-f1"');

      const lessonLoop4 = getActivityLatest('loop.4')!;
      expect(lessonLoop4.variations?.length).toBe(3);

      const thumbnails = new Set<string>();
      for (const card of lessonLoop4.variations!) {
        expect(card.workspace.MAIN.length).toBeGreaterThanOrEqual(4);
        expect(card.workspace.MAIN.length).toBeLessThanOrEqual(24);
        expect(validateLoopStructure(card.workspace.MAIN).hasError).toBe(false);

        const types = card.workspace.MAIN.map((b) => b.type);
        expect(types).toContain('LOOP_START');
        expect(types).toContain('CURSOR_STEP');
        expect(types).toContain('CURSOR_TURN');

        const preview = renderBeatVariationPreview(card.workspace);
        expect(preview.totalBeats).toBeGreaterThan(0);
        expect(countLitLeds(preview.representativeState.leds)).toBeGreaterThan(0);
        expect(preview.representativeState.cursor.visible).toBe(true);
        thumbnails.add(preview.thumbnailUrl);
      }
      // All 3 variation cards produce distinct 8x8 visual thumbnails
      expect(thumbnails.size).toBe(3);

      // SSR check on VariationCardsPanel
      const cardsHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(cardsHtml).toContain('Clap-Snap Staircase Groove');
      expect(cardsHtml).toContain('Candy-Cane Perimeter Chase');
      expect(cardsHtml).toContain('Neon Frame + Star Finale');
      expect(cardsHtml).toContain('data-testid="variation-beat-cursor-var1-staircase-groove"');

      // Live in-card preview playback advances cursor without mutating main BeatState
      const thirdCard = lessonLoop4.variations![2];
      beatVariationPreviewPlayer.toggle(thirdCard, {
        activityId: 'loop.4',
        tickMs: 50,
        getIsMuted: () => true,
      });
      expect(beatVariationPreviewPlayer.getSnapshot().isPlaying).toBe(true);

      vi.advanceTimersByTime(150);
      const snap = beatVariationPreviewPlayer.getSnapshot();
      expect(snap.tickCount).toBeGreaterThanOrEqual(2);
      expect(snap.currentState?.cursor.visible).toBe(true);
      expect(useAppStore.getState().beatState.beatIndex).toBe(0);
      expect(useAppStore.getState().beatState.cursor.visible).toBe(false);

      beatVariationPreviewPlayer.stop();
    });
  });
});
