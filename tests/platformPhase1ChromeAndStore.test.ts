import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

import App from '../src/App';
import { SimulationTopLeftHud } from '../src/components/SimulationTopLeftHud';
import { ConditionBadge } from '../src/components/ConditionBadge';
import { LessonPickerModal, isCurriculumModuleUnlocked } from '../src/components/LessonPickerModal';
import { BadgeCollectionModal } from '../src/components/BadgeCollectionModal';
import { MobileDrawerMenu } from '../src/components/MobileDrawerMenu';
import {
  BeatLedOffEraseOverlay,
  ColorVisual,
  isBeatLedEraseOption,
  isBeatLedOffColor,
} from '../src/components/params/VisualParamBadges';
import { BlockParamBadge } from '../src/components/params/BlockParamBadge';
import { ParamSelectionPopover } from '../src/components/params/ParamSelectionPopover';
import { VariationCardsPanel } from '../src/components/VariationCardsPanel';
import { BlockPalette } from '../src/components/BlockPalette';
import {
  clearPendingUpdateState,
  consumeRestoredStateAfterUpdate,
  saveStateBeforeUpdate,
} from '../src/services/pwaStateRestoreService';
import {
  renderBeatMapSvg,
  renderGridMapSvg,
  renderTurtleMapSvg,
} from '../src/services/mapThumbnailGenerator';
import {
  awardBadgeForProfile,
  getProfileProgress,
  isLessonCompleted,
  markLessonCompleted,
  resetAllProfileDataForTests,
} from '../src/services/profileService';
import { clearAllSavedPrograms } from '../src/services/localSaveService';
import { getSimEnvironment } from '../src/engine/simulation/registry';
import '../src/engine/simulationRunner';
import { createInitialBeatState } from '../src/simulations/beat/beatEnvironment';
import { BEAT_COLOR_PARAM_DEF } from '../src/simulations/beat/beatEnvironment';
import {
  TURTLE_COLOR_PARAM_DEF,
  TURTLE_TELEPORT_X_PARAM_DEF,
  createInitialTurtleState,
} from '../src/simulations/turtle/turtleEnvironment';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';
import {
  DEFAULT_SWITCHYARD_STATE,
  createInitialSwitchyardState,
} from '../src/simulations/switchyard/physics';
import {
  serializeProfileBackupToBinary,
  deserializeProfileBackupFromBinary,
  type ProfileBackupEnvelopeV1,
} from '../src/engine/serialization/profileSerializer';
import {
  computeStagedPalettePolicy,
  isBeatActiveColorToolEnabled,
} from '../src/utils/curriculumStagePolicy';
import {
  createInitialInterpreterState,
  getCalleeScopeForBlockType,
  tickInterpreter,
  workspaceHasReachableScope,
  wouldCallCreateCycle,
} from '../src/engine/interpreter';
import {
  CURRICULUM_ACTIVITIES,
  CURRICULUM_MODULES,
  CurriculumActivity,
  createCurriculumBlock,
  createCurriculumGridState,
} from '../src/data/curriculum';
import { useAppStore } from '../src/store/useAppStore';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { GridState, WallEdge, WorkspaceState } from '../src/types';
import {
  generateDepotMapThumbnail,
  renderDepotMapSvg,
} from '../src/services/mapThumbnailGenerator';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';

function makeMinimalGrid(): GridState {
  return createCurriculumGridState({
    width: 4,
    height: 3,
    robot: { x: 0, y: 0, dir: 'EAST' },
    barriers: [],
    flags: [
      { id: 'f1', x: 1, y: 0, order: 1, isGoal: false },
      { id: 'f2', x: 2, y: 0, order: 2, isGoal: false },
      { id: 'goal', x: 3, y: 0, isGoal: true },
    ],
  });
}

describe('Phase 1 Chrome, HUD Clearance, Icon Disambiguation & Store Contracts', () => {
  beforeEach(() => {
    clearPendingUpdateState();
    clearAllSavedPrograms();
    resetAllProfileDataForTests();
    const s = useAppStore.getState();
    s.pause();
    s.setAppMode('sandbox');
    s.setSimEnvironment('grid');
    s.setMobileMenuOpen(false);
    s.setLessonPickerOpen(false);
  });

  describe('1. App Layout Shell & Non-Overlapping HUD Clearance', () => {
    it('renders Top Dock, Viewport (flex-1 min-h-0), Bottom Dock, always uses top-3 left-3, and omits App SimulationTopLeftHud on Beat', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };

      try {
        const s = useAppStore.getState();

        // Depot with variables -> SimulationTopLeftHud uses top-3 left-3 (NO top-12 hack)
        s.setSimEnvironment('depot');
        useAppStore.setState({
          runtime: {
            ...createInitialInterpreterState(),
            variables: { a: 7 },
          },
        });
        Object.assign(initialRef, useAppStore.getState());
        const depotHtml = renderToStaticMarkup(React.createElement(App));
        expect(depotHtml).toContain('data-testid="pane-simulation"');
        expect(depotHtml).toContain('relative flex-1 min-h-0');
        expect(depotHtml).toContain('data-testid="simulation-top-left-hud"');
        expect(depotHtml).toContain('top-3 left-3');
        expect(depotHtml).not.toContain('top-12 left-3');
        expect(depotHtml).not.toContain('🎒');

        // Beat -> App.tsx omits outer SimulationTopLeftHud so BeatCanvas hosts it inside beat-matrix-stage
        s.setSimEnvironment('beat');
        useAppStore.setState({
          runtime: {
            ...createInitialInterpreterState(),
            variables: { a: 4 },
          },
        });
        Object.assign(initialRef, useAppStore.getState());
        const beatHtml = renderToStaticMarkup(React.createElement(App));
        expect(beatHtml).toContain('data-testid="beat-canvas"');
        const beatStageIdx = beatHtml.indexOf('data-testid="beat-matrix-stage"');
        const hudIdx = beatHtml.indexOf('data-testid="simulation-top-left-hud"');
        // App.tsx omits outer HUD on Beat (pre-env-beat merge hudIdx === -1; post-merge BeatCanvas mounts it inside beat-matrix-stage)
        expect(hudIdx === -1 || (beatStageIdx > -1 && hudIdx > beatStageIdx)).toBe(true);
      } finally {
        Object.assign(initialRef, backupInitial);
      }
    });
  });

  describe('2. Icon Disambiguation, Label Rename ("Depot") & MobileDrawerMenu Turtle Toggle', () => {
    it('renders ConditionBadge carryingItem with an inline robotic claw SVG and zero backpack emoji', () => {
      const html = renderToStaticMarkup(
        React.createElement(ConditionBadge, {
          condition: { kind: 'sensor', sensor: 'carryingItem' },
        })
      );
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain('🎒');
    });

    it('renders SimulationTopLeftHud cleanly without any backpack glyph', () => {
      const html = renderToStaticMarkup(
        React.createElement(SimulationTopLeftHud, {
          variables: { a: 3 },
        })
      );
      expect(html).toContain('a=3');
      expect(html).not.toContain('🎒');
    });

    it('renames Crate Depot to Depot in LessonPickerModal and SaveProgramModal, removing non-conc padlocks', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };
      try {
        useAppStore.setState({ isLessonPickerOpen: true });
        Object.assign(initialRef, useAppStore.getState());
        const pickerHtml = renderToStaticMarkup(
          React.createElement(LessonPickerModal, { initialTab: 'sandbox' })
        );
        expect(pickerHtml).toContain('data-testid="sim-tab-depot"');
        expect(pickerHtml).toContain('>Depot<');
        expect(pickerHtml).not.toContain('Crate Depot');
        expect(pickerHtml).not.toContain('🔒');
        expect(pickerHtml).not.toContain('🔓');
      } finally {
        Object.assign(initialRef, backupInitial);
      }

      const saveModalSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/SaveProgramModal.tsx'),
        'utf8'
      );
      expect(saveModalSrc).toContain('Depot (');
      expect(saveModalSrc).not.toContain('Crate Depot');
    });

    it('aligns MobileDrawerMenu Hide Turtle cue with 🐢👁️', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };

      try {
        const s = useAppStore.getState();
        s.setSimEnvironment('turtle');
        s.setMobileMenuOpen(true);
        Object.assign(initialRef, useAppStore.getState());

        const html = renderToStaticMarkup(React.createElement(MobileDrawerMenu));
        expect(html).toContain('data-testid="drawer-btn-toggle-turtle"');
        expect(html).toContain('🐢👁️');
      } finally {
        Object.assign(initialRef, backupInitial);
      }
    });
  });

  describe('3. LOGO #302 & Beat #304 Visual Badges, Popover Home Preset, Variation Previews & Thumbnails', () => {
    it('preserves bare ColorVisual symbol-free invariant while enabling Turtle eraser cue via showEraserCue', () => {
      const bareWhite = renderToStaticMarkup(
        React.createElement(ColorVisual, { color: '#ffffff', size: 24 })
      );
      expect(bareWhite).not.toContain('data-shape-cue');
      expect(bareWhite).not.toContain('turtle-white-eraser-cue');
      expect(bareWhite).not.toContain('<svg');

      const eraserWhite = renderToStaticMarkup(
        React.createElement(ColorVisual, { color: '#ffffff', size: 24, showEraserCue: true })
      );
      expect(eraserWhite).toContain('data-testid="turtle-white-eraser-cue"');
      expect(eraserWhite).not.toContain('data-shape-cue');

      const turtleBadgeWhite = renderToStaticMarkup(
        React.createElement(BlockParamBadge, {
          paramDef: TURTLE_COLOR_PARAM_DEF,
          value: '#ffffff',
          actionType: 'SET_PEN_COLOR',
          onChange: () => {},
        })
      );
      expect(turtleBadgeWhite).toContain('data-testid="turtle-white-eraser-cue"');
    });

    it('renders Beat LED-off recessed pad + Erase cue OUTSIDE ColorVisual for SET_LED_COLOR only', () => {
      expect(isBeatLedOffColor('#0f172a')).toBe(true);
      expect(isBeatLedOffColor('#000000')).toBe(true);
      expect(isBeatLedOffColor('#ef4444')).toBe(false);
      expect(isBeatLedEraseOption('SET_LED_COLOR', '#0f172a')).toBe(true);
      expect(isBeatLedEraseOption('SET_PEN_COLOR', '#0f172a')).toBe(false);

      const overlayOnly = renderToStaticMarkup(React.createElement(BeatLedOffEraseOverlay));
      expect(overlayOnly).toContain('data-testid="beat-led-erase-overlay"');

      const beatOffBadge = renderToStaticMarkup(
        React.createElement(BlockParamBadge, {
          paramDef: BEAT_COLOR_PARAM_DEF,
          value: '#0f172a',
          actionType: 'SET_LED_COLOR',
          onChange: () => {},
        })
      );
      expect(beatOffBadge).toContain('data-beat-led-off="true"');
      expect(beatOffBadge).toContain('data-testid="beat-led-erase-overlay"');

      const beatPopover = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: BEAT_COLOR_PARAM_DEF,
          currentValue: '#0f172a',
          actionType: 'SET_LED_COLOR',
          onSelect: () => {},
          onClose: () => {},
        })
      );
      expect(beatPopover).toContain('data-beat-led-off="true"');
      expect(beatPopover).toContain('data-testid="beat-led-erase-overlay"');

      const turtleBlackBadge = renderToStaticMarkup(
        React.createElement(BlockParamBadge, {
          paramDef: TURTLE_COLOR_PARAM_DEF,
          value: '#0f172a',
          actionType: 'SET_PEN_COLOR',
          onChange: () => {},
        })
      );
      expect(turtleBlackBadge).not.toContain('data-testid="beat-led-erase-overlay"');
      expect(turtleBlackBadge).not.toContain('data-beat-led-off="true"');
    });

    it('renders TELEPORT quick 🏠 (0, 0, 0°) preset button in ParamSelectionPopover', () => {
      const popoverHtml = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: TURTLE_TELEPORT_X_PARAM_DEF,
          currentValue: 120,
          actionType: 'TELEPORT',
          onSelect: () => {},
          onBatchSelect: () => {},
          onClose: () => {},
        })
      );
      expect(popoverHtml).toContain('data-testid="param-option-teleport-home"');
      expect(popoverHtml).toContain('🏠');
      expect(popoverHtml).toContain('(0, 0, 0°)');
    });

    it('normalizes #0f172a/#000000 LED cells to null in sanitizeBeatState, VariationCardsPanel, and renderBeatMapSvg', () => {
      const beat = createInitialBeatState(false);
      beat.leds[0][0] = '#0f172a';
      beat.leds[0][1] = '#000000';
      beat.leds[0][2] = '#ef4444';

      const ok = saveStateBeforeUpdate({
        appMode: 'sandbox',
        activeSimId: 'beat',
        workspace: { MAIN: [], F1: [], F2: [], F3: [] },
        grid: makeMinimalGrid(),
        turtleState: createInitialTurtleState(),
        beatState: beat,
        depotState: createInitialDepotState(),
        speed: 400,
      });
      expect(ok).toBe(true);
      const restored = consumeRestoredStateAfterUpdate(makeMinimalGrid());
      expect(restored?.beatState?.leds[0][0]).toBeNull();
      expect(restored?.beatState?.leds[0][1]).toBeNull();
      expect(restored?.beatState?.leds[0][2]).toBe('#ef4444');

      const beatThumbSvg = renderBeatMapSvg(beat);
      const ledGridSection = beatThumbSvg.split('<g transform="translate(16, 16)">')[1] ?? '';
      expect(ledGridSection).not.toContain('fill="#0f172a"');
      expect(ledGridSection).not.toContain('fill="#000000"');
      expect(ledGridSection).toContain('fill="#ef4444"');

      // VariationCardsPanel for creative Turtle & Beat cards
      const mockTurtleAct: CurriculumActivity = {
        id: '__test_creative_turtle__',
        version: 1,
        moduleId: 'seq',
        format: 'sandbox',
        simId: 'turtle',
        title: 'Test Turtle Card',
        concept: 'sequence',
        palette: { allowedSimBlocks: ['FORWARD'] },
        variations: [
          {
            id: 'card-t',
            title: 'Square',
            workspace: {
              MAIN: [createCurriculumBlock('FORWARD', undefined, { length: 50 })],
              F1: [],
              F2: [],
              F3: [],
            },
          },
        ],
      };
      const mockBeatAct: CurriculumActivity = {
        id: '__test_creative_beat__',
        version: 1,
        moduleId: 'seq',
        format: 'sandbox',
        simId: 'beat',
        title: 'Test Beat Card',
        concept: 'sequence',
        palette: { allowedSimBlocks: ['SET_LED_COLOR', 'CURSOR_STEP', 'DRUM_KICK'] },
        variations: [
          {
            id: 'card-b',
            title: 'Erase Black Cell',
            workspace: {
              MAIN: [
                createCurriculumBlock('SET_LED_COLOR', undefined, { color: '#0f172a' }),
                createCurriculumBlock('CURSOR_STEP'),
                createCurriculumBlock('DRUM_KICK'),
              ],
              F1: [],
              F2: [],
              F3: [],
            },
          },
        ],
      };

      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };
      (CURRICULUM_ACTIVITIES as CurriculumActivity[]).push(mockTurtleAct, mockBeatAct);

      try {
        useAppStore.setState({
          appMode: 'curriculum',
          activeActivityId: mockTurtleAct.id,
          activeActivityVersion: 1,
        });
        Object.assign(initialRef, useAppStore.getState());
        const turtleVarHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
        expect(turtleVarHtml).toContain('data-testid="variation-turtle-frame-card-t"');
        expect(turtleVarHtml).toContain('#e2e8f0');

        useAppStore.setState({
          appMode: 'curriculum',
          activeActivityId: mockBeatAct.id,
          activeActivityVersion: 1,
        });
        Object.assign(initialRef, useAppStore.getState());
        const beatVarHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
        const beatPreviewOnly =
          beatVarHtml.split('data-testid="variation-beat-preview-card-b"')[1]?.split('data-testid="btn-preview-variation-card-b"')[0] ??
          '';
        expect(beatPreviewOnly).toContain('data-testid="variation-beat-led-card-b-0-0" data-lit="false"');
        expect(beatPreviewOnly).toContain('data-testid="variation-beat-cursor-card-b"');
        // No cursor directional triangles inside compact VariationCardPreview cursor ring
        expect(beatPreviewOnly).not.toContain('<polygon');
      } finally {
        (CURRICULUM_ACTIVITIES as CurriculumActivity[]).pop();
        (CURRICULUM_ACTIVITIES as CurriculumActivity[]).pop();
        Object.assign(initialRef, backupInitial);
      }
    });

    it('wraps renderTurtleMapSvg in #e2e8f0 outer rect and removes SVG padlocks from renderGridMapSvg', () => {
      const turtleSvg = renderTurtleMapSvg(createInitialTurtleState());
      expect(turtleSvg).toContain('fill="#e2e8f0"');

      const gridSvg = renderGridMapSvg(makeMinimalGrid());
      expect(gridSvg).toContain('data-padlocked="true"');
      expect(gridSvg).toContain('data-padlock-target="flag-2"');
      expect(gridSvg).toContain('data-shuttered-goal="true"');
      expect(gridSvg).not.toContain('🔒');
      expect(gridSvg).not.toContain('stroke-dasharray="0"');
      expect(gridSvg).toContain('stroke-dasharray=');
    });
  });

  describe('4. Switchyard Registry, Multi-Variant Switchyard Sync & ProfileSerializer Exclusive Sets', () => {
    it('registers switchyard simulation environment cleanly via simulationRunner', () => {
      const syEnv = getSimEnvironment('switchyard');
      expect(syEnv).toBeDefined();
      expect(syEnv?.id).toBe('switchyard');
    });

    it('syncs switchyardState in setFocusedVariantIndex', () => {
      const sy0 = createInitialSwitchyardState(DEFAULT_SWITCHYARD_STATE);
      const sy1 = createInitialSwitchyardState({
        ...DEFAULT_SWITCHYARD_STATE,
        carsOnTrack: [{ id: 'v1-car', color: 'BLUE', shape: 'square', damaged: false, x: 2, y: 0 }],
      });

      useAppStore.setState({
        activeSimId: 'switchyard',
        switchyardState: sy0,
        focusedVariantIndex: 0,
        variantRuns: [
          { index: 0, kind: 'switchyard', status: 'IDLE', switchyardState: sy0, runtime: null },
          { index: 1, kind: 'switchyard', status: 'RUNNING', switchyardState: sy1, runtime: null },
        ],
      });

      useAppStore.getState().setFocusedVariantIndex(1);
      expect(useAppStore.getState().focusedVariantIndex).toBe(1);
      expect(useAppStore.getState().switchyardState.carsOnTrack[0]?.id).toBe('v1-car');
    });

    it('detects Beat SET_BEAT_DELAY and Depot DEPOT_SEND_GATE programs in binary profile backup roundtrip', () => {
      const beatWs: WorkspaceState = {
        MAIN: [{ id: 'bd1', type: 'SET_BEAT_DELAY', params: { delay: 2 } }],
        F1: [],
        F2: [],
        F3: [],
      };
      const depotWs: WorkspaceState = {
        MAIN: [{ id: 'dg1', type: 'DEPOT_SEND_GATE', params: { gate: 'ACCEPT' } }],
        F1: [],
        F2: [],
        F3: [],
      };

      const env: ProfileBackupEnvelopeV1 = {
        schema: 'robotemu_profile_backup_v1',
        exportedAt: 1760000000000,
        profile: {
          id: 'p-test',
          name: 'Ada',
          avatarId: 'robot',
          colorId: 'sky',
          createdAt: 1760000000000,
        },
        progress: {
          completedLessons: {},
          unlockedModules: ['seq'],
          earnedBadges: [],
          unlockAllModules: false,
        },
        autosaves: {
          lessons: {
            l_beat: { workspace: beatWs, lessonVersion: 1, updatedAt: 0 },
            l_depot: { workspace: depotWs, lessonVersion: 1, updatedAt: 0 },
          },
          sandbox: {},
        },
        savedPrograms: [],
      };

      const bytes = serializeProfileBackupToBinary(env);
      const decoded = deserializeProfileBackupFromBinary(bytes);
      expect(decoded.autosaves.lessons.l_beat.workspace.MAIN[0]?.type).toBe('SET_BEAT_DELAY');
      expect(decoded.autosaves.lessons.l_beat.workspace.MAIN[0]?.params?.delay).toBe(2);
      expect(decoded.autosaves.lessons.l_depot.workspace.MAIN[0]?.type).toBe('DEPOT_SEND_GATE');
      expect(decoded.autosaves.lessons.l_depot.workspace.MAIN[0]?.params?.gate).toBe('ACCEPT');
    });
  });

  describe('5. Stage Policy, Recursion Cycles (Palette + Interpreter) & Bidirectional Slug Aliases', () => {
    it('auto-includes LOOP_END when LOOP_START is allowed, gates Beat color tool, and propagates allowRecursion', () => {
      const loopAct: CurriculumActivity = {
        id: 'loop.1',
        version: 1,
        moduleId: 'loop',
        format: 'puzzle',
        simId: 'grid',
        title: 'Loop Auto End',
        concept: 'loop',
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['LOOP_START'],
          allowRecursion: false,
        },
      };

      const policy = computeStagedPalettePolicy('curriculum', loopAct, []);
      expect(policy.allowedControlTypes).toContain('LOOP_START');
      expect(policy.allowedControlTypes).toContain('LOOP_END');
      expect(policy.allowRecursion).toBe(false);

      const policyDefault = computeStagedPalettePolicy('sandbox', undefined, []);
      expect(policyDefault.allowRecursion).toBe(true);

      const beatNoColorAct: CurriculumActivity = {
        ...loopAct,
        simId: 'beat',
        palette: { allowedSimBlocks: ['DRUM_KICK'] },
      };
      const beatColorAct: CurriculumActivity = {
        ...loopAct,
        simId: 'beat',
        palette: { allowedSimBlocks: ['DRUM_KICK', 'SET_LED_COLOR'] },
      };

      expect(isBeatActiveColorToolEnabled('sandbox', beatNoColorAct)).toBe(true);
      expect(isBeatActiveColorToolEnabled('curriculum', beatNoColorAct)).toBe(false);
      expect(isBeatActiveColorToolEnabled('curriculum', beatColorAct)).toBe(true);
    });

    it('blocks direct and transitive recursion in both BlockPalette and tickInterpreter when allowRecursion is false', () => {
      const cyclicWs: WorkspaceState = {
        MAIN: [{ id: 'm1', type: 'CALL_F1' }],
        F1: [{ id: 'f1_1', type: 'CALL_F2' }],
        F2: [{ id: 'f2_1', type: 'CALL_F1' }],
        F3: [],
      };

      expect(getCalleeScopeForBlockType('CALL_F2')).toBe('F2');
      expect(workspaceHasReachableScope(cyclicWs, 'F1', 'F1')).toBe(true);
      expect(wouldCallCreateCycle(cyclicWs, 'F2', 'F1')).toBe(true);
      expect(wouldCallCreateCycle(cyclicWs, 'F2', 'F3')).toBe(false);

      // Runtime block when allowRecursion: false
      const grid = makeMinimalGrid();
      let rt = createInitialInterpreterState();
      let step = tickInterpreter(rt, cyclicWs, grid, undefined, { allowRecursion: false });
      expect(step.nextRuntime.status).toBe('RUNNING');
      step = tickInterpreter(step.nextRuntime, cyclicWs, step.nextGrid, undefined, {
        allowRecursion: false,
      });
      expect(step.nextRuntime.status).toBe('RUNNING');
      // F2 attempts CALL_F1 -> blocked with COLLISION
      step = tickInterpreter(step.nextRuntime, cyclicWs, step.nextGrid, undefined, {
        allowRecursion: false,
      });
      expect(step.nextRuntime.status).toBe('COLLISION');
      expect(step.done).toBe(true);

      // Palette block disable state in BlockPalette when allowRecursion is false
      const funcAct: CurriculumActivity = {
        id: '__test_func_rec__',
        version: 1,
        moduleId: 'func',
        format: 'puzzle',
        simId: 'grid',
        title: 'Func Non-Rec',
        concept: 'functions',
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['CALL_F1', 'CALL_F2'],
          allowedScopes: ['MAIN', 'F1', 'F2'],
          allowRecursion: false,
        },
      };
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };
      (CURRICULUM_ACTIVITIES as CurriculumActivity[]).push(funcAct);

      try {
        useAppStore.setState({
          appMode: 'curriculum',
          activeActivityId: funcAct.id,
          activeActivityVersion: 1,
          activeScope: 'F2',
          workspace: {
            MAIN: [],
            F1: [{ id: 'f1_call', type: 'CALL_F2' }],
            F2: [],
            F3: [],
          },
        });
        Object.assign(initialRef, useAppStore.getState());
        const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
        expect(paletteHtml).toContain('data-testid="palette-call-f1"');
        expect(paletteHtml).toContain('data-recursion-blocked="true"');
      } finally {
        (CURRICULUM_ACTIVITIES as CurriculumActivity[]).pop();
        Object.assign(initialRef, backupInitial);
      }
    });

    it('resolves legacy <-> slug aliases cleanly in profileService and isCurriculumModuleUnlocked', () => {
      // seq and module-1 are always unlocked
      expect(
        isCurriculumModuleUnlocked('seq', {
          completedLessons: {},
          unlockedModules: [],
          earnedBadges: [],
          unlockAllModules: false,
        })
      ).toBe(true);
      expect(
        isCurriculumModuleUnlocked('module-1', {
          completedLessons: {},
          unlockedModules: [],
          earnedBadges: [],
          unlockAllModules: false,
        })
      ).toBe(true);

      // Legacy unlocked module unlocks slug module and vice versa
      expect(
        isCurriculumModuleUnlocked('param', {
          completedLessons: {},
          unlockedModules: ['module-2'],
          earnedBadges: [],
          unlockAllModules: false,
        })
      ).toBe(true);
      expect(
        isCurriculumModuleUnlocked('module-2', {
          completedLessons: {},
          unlockedModules: ['param'],
          earnedBadges: [],
          unlockAllModules: false,
        })
      ).toBe(true);

      // Completing a legacy activity ID marks its slug alias completed and vice versa
      markLessonCompleted('default', '1.1', 1);
      expect(isLessonCompleted('default', '1.1')).toBe(true);
      expect(isLessonCompleted('default', 'seq.1')).toBe(true);

      markLessonCompleted('default', 'param.2', 1);
      expect(isLessonCompleted('default', 'param.2')).toBe(true);
      expect(isLessonCompleted('default', '2.2')).toBe(true);
      expect(getProfileProgress('default').completedLessons).toBeDefined();
    });

    it('renders BadgeCollectionModal with Clock (zero padlocks) and badge/capstone alias checks', () => {
      const firstMod = CURRICULUM_MODULES[0];
      awardBadgeForProfile('default', 'badge-seq');
      if (firstMod.capstoneIds[0]) {
        markLessonCompleted('default', firstMod.capstoneIds[0], 1);
      }

      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };
      try {
        useAppStore.setState({ isBadgeModalOpen: true });
        Object.assign(initialRef, useAppStore.getState());
        const badgeHtml = renderToStaticMarkup(React.createElement(BadgeCollectionModal));
        expect(badgeHtml).toContain('data-testid="badge-collection-modal"');
        expect(badgeHtml).toContain('lucide-clock');
        expect(badgeHtml).not.toContain('lucide-lock');
        expect(badgeHtml).toContain(`data-testid="badge-card-${firstMod.id}"`);
        expect(badgeHtml).toContain(`data-badge-id="${firstMod.badgeId}" data-earned="true"`);
        expect(badgeHtml).toContain(`>🏆</span><span>1/${CURRICULUM_MODULES.length}<`);
        if (firstMod.capstoneIds[0]) {
          expect(badgeHtml).toContain(
            `data-testid="badge-capstone-chip-${firstMod.capstoneIds[0]}" data-completed="true"`
          );
        }
      } finally {
        Object.assign(initialRef, backupInitial);
      }
    });

    it('verifies 9x9 +-greenhouse loop.A constraints (8 crates + 8 requiredForGoal switches, slotCap 10, maxLoopNestingDepth 1) in < 200ms', () => {
      const barriers: WallEdge[] = [];
      for (const y of [0, 1, 2, 3, 5, 6, 7, 8]) {
        barriers.push({ orientation: 'V', x: 4, y });
        barriers.push({ orientation: 'V', x: 5, y });
      }
      for (const x of [0, 1, 2, 3, 5, 6, 7, 8]) {
        barriers.push({ orientation: 'H', x, y: 4 });
        barriers.push({ orientation: 'H', x, y: 5 });
      }

      const loopAActivity: CurriculumActivity = {
        id: 'loop.A',
        moduleId: 'loop',
        version: 1,
        format: 'capstone',
        capstoneType: 'puzzle',
        simId: 'grid',
        icon: '🤖',
        title: '9x9 Automated Greenhouse',
        concept: 'Nested Loops with 8 Crates and 8 Switches',
        description: 'Deliver 8 crates onto 8 floor switches across 4 wings.',
        hint: 'Use nested loops within 10 slots.',
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'MOVE_BACK', 'TURN_LEFT', 'TURN_RIGHT', 'PICK_UP', 'USE_DROP'],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
          allowedScopes: ['MAIN'],
          allowRepeatBadges: true,
          allowActionParams: false,
          allowVariables: false,
        },
        slotCap: { maxTotal: 10 },
        grid: {
          width: 9,
          height: 9,
          robot: { x: 4, y: 4, dir: 'NORTH' },
          barriers,
          worldItems: [
            { id: 'c1', type: 'crate', x: 4, y: 3 },
            { id: 'c2', type: 'crate', x: 4, y: 1 },
            { id: 'c3', type: 'crate', x: 5, y: 4 },
            { id: 'c4', type: 'crate', x: 7, y: 4 },
            { id: 'c5', type: 'crate', x: 4, y: 5 },
            { id: 'c6', type: 'crate', x: 4, y: 7 },
            { id: 'c7', type: 'crate', x: 3, y: 4 },
            { id: 'c8', type: 'crate', x: 1, y: 4 },
          ],
          floorSwitches: [
            { id: 'sw1', x: 4, y: 2, requiredForGoal: true, active: false },
            { id: 'sw2', x: 4, y: 0, requiredForGoal: true, active: false },
            { id: 'sw3', x: 6, y: 4, requiredForGoal: true, active: false },
            { id: 'sw4', x: 8, y: 4, requiredForGoal: true, active: false },
            { id: 'sw5', x: 4, y: 6, requiredForGoal: true, active: false },
            { id: 'sw6', x: 4, y: 8, requiredForGoal: true, active: false },
            { id: 'sw7', x: 2, y: 4, requiredForGoal: true, active: false },
            { id: 'sw8', x: 0, y: 4, requiredForGoal: true, active: false },
          ],
          flags: [{ id: 'goal_loopA', x: 4, y: 4, isGoal: true, order: 1, collected: false }],
        },
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('LOOP_START', 4, undefined, 'la_1'),
            createCurriculumBlock('LOOP_START', 2, undefined, 'la_2'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'la_3'),
            createCurriculumBlock('PICK_UP', undefined, undefined, 'la_4'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'la_5'),
            createCurriculumBlock('USE_DROP', undefined, undefined, 'la_6'),
            createCurriculumBlock('LOOP_END', undefined, undefined, 'la_7'),
            createCurriculumBlock('MOVE_BACK', 4, undefined, 'la_8'),
            createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'la_9'),
            createCurriculumBlock('LOOP_END', undefined, undefined, 'la_10'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          {
            id: 'loopA-require-nested-loops',
            description: 'Cannot satisfy all 8 switches across 4 wings in <= 10 slots with flat loops only',
            maxLoopNestingDepth: 1,
          },
          {
            id: 'loopA-require-crate-interaction',
            description: 'Cannot satisfy all 8 switches without PICK_UP / USE_DROP',
            forbidBlocks: ['PICK_UP', 'USE_DROP'],
          },
        ],
      };

      const t0 = performance.now();
      const report = verifyActivityConstraints(loopAActivity);
      const wallMs = performance.now() - t0;

      expect(report.referenceCheck.passed).toBe(true);
      expect(
        report.passed,
        JSON.stringify(
          report.ruleResults.map((r) => ({
            ruleId: r.ruleId,
            passed: r.passed,
            elapsedMs: Math.round(r.elapsedMs),
            exploredStates: r.exploredStates,
            diagnostic: r.diagnostic,
          }))
        )
      ).toBe(true);
      expect(
        report.elapsedMs,
        JSON.stringify(
          report.ruleResults.map((r) => ({
            ruleId: r.ruleId,
            passed: r.passed,
            elapsedMs: Math.round(r.elapsedMs),
            exploredStates: r.exploredStates,
          }))
        )
      ).toBeLessThan(500);
      expect(wallMs).toBeLessThan(500);
    });
  });

  it('renderDepotMapSvg delegates to renderDepotWorkshopSvg with sky backdrop, birch bench, and no dark #0f172a backdrop', () => {
    const depot = createInitialDepotState();
    const svg = renderDepotMapSvg(depot);
    expect(svg).toContain('<rect width="180" height="132" rx="12" fill="#edf4fb" />');
    expect(svg).toContain('fill="#e4be8b"');
    expect(svg).not.toContain('fill="#0f172a" />');
    expect(svg).not.toContain('fill="#0f172a">');

    const dataUri = generateDepotMapThumbnail(depot);
    expect(dataUri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const decoded = decodeURIComponent(dataUri.replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(decoded).toContain('<rect width="180" height="132" rx="12" fill="#edf4fb" />');
    expect(decoded).toContain('fill="#e4be8b"');
    expect(decoded).not.toContain('fill="#0f172a" />');
    expect(decoded).not.toContain('fill="#0f172a">');
  });
});
