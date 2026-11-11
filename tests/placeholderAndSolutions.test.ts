import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportToBinary,
  importFromBinary,
  exportToString,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  FORMAT_VERSION,
  ENV_ID_GENERIC,
  SCOPE_ID_MAIN,
  SCOPE_ID_F1,
  OP_PLACEHOLDER,
  PLACEHOLDER_HINT_CATEGORIES,
  placeholderHintCategoryToCode,
  getPlaceholderHintCategory,
} from '../src/engine/serialization/types';
import { BinaryWriter } from '../src/engine/serialization/binaryWriter';
import {
  createInitialInterpreterState,
  tickInterpreter,
  validateLoopStructure,
} from '../src/engine/interpreter';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  computeGhostPreviewSteps,
  doesBlockMatchHintCategory,
  buildFallbackScaffoldFromSolution,
  resolveActivityScaffoldWorkspace,
} from '../src/engine/placeholderHelpers';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  PlaceholderHintCategory,
  createCurriculumGridState,
  getActivityLatest,
} from '../src/data/curriculum';
import { GridOverlayLayer, GRID_CELL_SIZE } from '../src/simulations/grid/components/GridOverlayLayer';
import { GhostStepOverlay } from '../src/simulations/grid/components/GhostStepOverlay';
import { BlockItem } from '../src/components/BlockItem';
import { BlockPalette } from '../src/components/BlockPalette';
import { SolutionModal } from '../src/components/SolutionModal';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';
import { WorkspaceState } from '../src/types';

// Ensure simulation environments are registered
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';

describe('Wave 2 / Commit 7: OP_PLACEHOLDER Blocks, Ghost Preview & Two-Tier Solution System', () => {
  beforeEach(() => {
    clearPendingUpdateState();
    const s = useAppStore.getState();
    s.pause();
    s.stopGhostPreview();
    s.setAppMode('sandbox');
    s.setSimEnvironment('grid');
    s.setLevel(1);
    s.clearWorkspace();
    s.setSpeed(400);
    s.setEditorTool('NONE');
    s.setSolutionOpen(false);
    useAppStore.setState({
      curriculumWorkspaces: {},
      sandboxSnapshot: null,
      activeActivityId: '1.1',
      activeActivityVersion: 1,
      statusAnnouncement: '',
      ghostPreview: null,
    });
    useAppStore.getState().clearHistory();
  });

  describe('1. Binary Serialization & Deserialization (OP_PLACEHOLDER = 0x09)', () => {
    it('encodes and decodes OP_PLACEHOLDER = 0x09 across all hintCategory codes (0..10)', () => {
      expect(OP_PLACEHOLDER).toBe(0x09);
      expect(PLACEHOLDER_HINT_CATEGORIES).toEqual([
        'any',
        'motion',
        'turn',
        'item',
        'loop',
        'function',
        'conditional',
        'sensor',
        'variable',
        'operator',
        'socket',
      ]);

      PLACEHOLDER_HINT_CATEGORIES.forEach((category, expectedCode) => {
        expect(placeholderHintCategoryToCode(category)).toBe(expectedCode);

        const ws: WorkspaceState = {
          MAIN: [{ id: `ph_${expectedCode}`, type: 'PLACEHOLDER', params: { hintCategory: category } }],
          F1: [],
          F2: [],
          F3: [],
        };

        const bytes = exportToBinary(ws, 'generic');
        // Exact v1 generic layout: [version=1, env=0(generic), envVer=1, scopeCount=1, scopeId=0x00(MAIN), blockCount=1, opcode=0x09, hintCode]
        expect(Array.from(bytes)).toEqual([
          FORMAT_VERSION,
          ENV_ID_GENERIC,
          1,
          1,
          SCOPE_ID_MAIN,
          1,
          OP_PLACEHOLDER,
          expectedCode,
        ]);

        const decoded = importFromBinary(bytes);
        expect(decoded.workspace.MAIN).toHaveLength(1);
        expect(decoded.workspace.MAIN[0].type).toBe('PLACEHOLDER');
        expect(getPlaceholderHintCategory(decoded.workspace.MAIN[0])).toBe(category);
      });
    });

    it('defaults missing hintCategory params to "any" (code 0) and round-trips across grid, turtle, and generic strings', () => {
      const sampleGrid = createCurriculumGridState(CURRICULUM_ACTIVITIES[0].grid!);
      const wsGridOrGeneric: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'MOVE_FWD', repeatCount: 2 },
          { id: 'b2', type: 'PLACEHOLDER' },
          { id: 'b3', type: 'PLACEHOLDER', params: { hintCategory: 'turn' } },
          { id: 'b4', type: 'CALL_F1' },
        ],
        F1: [{ id: 'f1_ph', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } }],
        F2: [],
        F3: [],
      };

      // Generic (code-only)
      const genericStr = exportToString(wsGridOrGeneric, 'generic');
      const importedGeneric = importFromString(genericStr);
      expect(importedGeneric.envId).toBe('generic');
      expect(importedGeneric.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'PLACEHOLDER',
        'PLACEHOLDER',
        'CALL_F1',
      ]);
      expect(getPlaceholderHintCategory(importedGeneric.workspace.MAIN[1])).toBe('any');
      expect(getPlaceholderHintCategory(importedGeneric.workspace.MAIN[2])).toBe('turn');
      expect(getPlaceholderHintCategory(importedGeneric.workspace.F1[0])).toBe('motion');

      // Grid (with grid map payload)
      const gridStr = exportToString(wsGridOrGeneric, 'grid', sampleGrid);
      const importedGrid = importFromString(gridStr);
      expect(importedGrid.envId).toBe('grid');
      expect(importedGrid.workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'PLACEHOLDER',
        'PLACEHOLDER',
        'CALL_F1',
      ]);
      expect(getPlaceholderHintCategory(importedGrid.workspace.MAIN[1])).toBe('any');
      expect(getPlaceholderHintCategory(importedGrid.workspace.MAIN[2])).toBe('turn');
      expect(getPlaceholderHintCategory(importedGrid.workspace.F1[0])).toBe('motion');

      // Turtle
      const wsTurtle: WorkspaceState = {
        MAIN: [
          { id: 't1', type: 'FORWARD', params: { length: 50 } },
          { id: 't2', type: 'PLACEHOLDER', params: { hintCategory: 'loop' } },
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const turtleStr = exportToString(wsTurtle, 'turtle');
      const importedTurtle = importFromString(turtleStr);
      expect(importedTurtle.envId).toBe('turtle');
      expect(importedTurtle.workspace.MAIN.map((b) => b.type)).toEqual(['FORWARD', 'PLACEHOLDER']);
      expect(getPlaceholderHintCategory(importedTurtle.workspace.MAIN[1])).toBe('loop');
    });

    it('gracefully preserves/clamps unknown future VLE hintCategory codes (>= 11) without crashing or corrupting stream alignment', () => {
      for (const futureCode of [15, 200]) {
        const writer = new BinaryWriter();
        writer.writeUint8(FORMAT_VERSION);
        writer.writeUint8(ENV_ID_GENERIC);
        writer.writeUint8(1); // envVersion
        writer.writeVLE(1); // 1 scope
        writer.writeUint8(SCOPE_ID_MAIN);
        writer.writeVLE(2); // 2 blocks
        writer.writeUint8(OP_PLACEHOLDER);
        writer.writeVLE(futureCode);
        writer.writeUint8(0x10); // MOVE_FWD (repeat 1)
        const syntheticStream = writer.getBytes();

        const decoded = importFromBinary(syntheticStream);
        expect(decoded.workspace.MAIN).toHaveLength(2);
        expect(decoded.workspace.MAIN[0].type).toBe('PLACEHOLDER');
        // Clamped safely to 'any' for UI/hinting while preserving rawHintCategoryCode
        expect(getPlaceholderHintCategory(decoded.workspace.MAIN[0])).toBe('any');
        expect(decoded.workspace.MAIN[0].params?.rawHintCategoryCode).toBe(futureCode);
        // Subsequent block in stream decoded intact
        expect(decoded.workspace.MAIN[1].type).toBe('MOVE_FWD');

        // Re-exporting preserves the exact future VLE code byte-for-byte
        const reEncoded = exportToBinary(decoded.workspace, 'generic');
        expect(Array.from(reEncoded)).toEqual(Array.from(syntheticStream));
      }
    });

    it('leaves existing v1 non-placeholder opcodes byte-for-byte identical', () => {
      const legacyGridWs: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'LOOP_START', repeatCount: 3 },
          { id: '2', type: 'MOVE_FWD', repeatCount: 1 },
          { id: '3', type: 'TURN_RIGHT', repeatCount: 1 },
          { id: '4', type: 'LOOP_END' },
          { id: '5', type: 'CALL_F1' },
        ],
        F1: [{ id: '6', type: 'MOVE_BACK', repeatCount: 2 }],
        F2: [],
        F3: [],
      };

      const genericBytes = exportToBinary(legacyGridWs, 'generic');
      expect(Array.from(genericBytes)).toEqual([
        0x01, // FORMAT_VERSION = 1
        0x00, // env = generic
        0x01, // envVersion = 1
        0x02, // 2 non-empty scopes (MAIN, F1)
        SCOPE_ID_MAIN, // 0x00
        0x05, // 5 blocks in MAIN
        0x41, 0x03, // LOOP_START(3) = 0x01 | MASK_HAS_REP(0x40), VLE(3)
        0x10, // MOVE_FWD(1)
        0x13, // TURN_RIGHT(1)
        0x02, // LOOP_END
        0x03, 0x01, // CALL_FN(1) = 0x03, fnIndex=1
        SCOPE_ID_F1, // 0x81
        0x01, // 1 block in F1
        0x51, 0x02, // MOVE_BACK(2) = 0x11 | 0x40, VLE(2)
      ]);
    });
  });

  describe('2. Interpreter & Headless Runner Pausing on PLACEHOLDER', () => {
    it('pauses cleanly (status: PAUSED, activeBlockId set, PC unadvanced) in tickInterpreter and runHeadlessSimulation', () => {
      const act11 = getActivityLatest('1.1')!;
      const initialGrid = createCurriculumGridState(act11.grid!);

      const ws: WorkspaceState = {
        MAIN: [
          { id: 'm1', type: 'MOVE_FWD' },
          { id: 'ph_1', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
          { id: 'm3', type: 'MOVE_FWD' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      // Step 1: executes MOVE_FWD -> robot moves from (0,1) to (1,1)
      const rt0 = createInitialInterpreterState();
      const step1 = tickInterpreter(rt0, ws, initialGrid, gridSimulationEnvironment);
      expect(step1.done).toBe(false);
      expect(step1.nextGrid.robot.x).toBe(1);
      expect(step1.nextRuntime.status).toBe('RUNNING');

      // Step 2: reaches PLACEHOLDER -> pauses cleanly without moving robot or advancing PC past index 1
      const step2 = tickInterpreter(
        step1.nextRuntime,
        ws,
        step1.nextGrid,
        gridSimulationEnvironment
      );
      expect(step2.done).toBe(true);
      expect(step2.nextRuntime.status).toBe('PAUSED');
      expect(step2.nextGrid.status).toBe('PAUSED');
      expect(step2.nextRuntime.activeBlockId).toBe('ph_1');
      expect(step2.nextRuntime.callStack[0].pc).toBe(1);
      expect(step2.nextGrid.robot.x).toBe(1);

      // Headless simulation also terminates immediately with PAUSED (never infinite-loops)
      const headless = runHeadlessSimulation(ws, 'grid', initialGrid, 500);
      expect(headless.status).toBe('PAUSED');
      expect(headless.stepCount).toBe(2);
      expect(headless.finalRuntime.stepCount).toBe(1);
      expect(headless.finalRuntime.activeBlockId).toBe('ph_1');
      expect((headless.finalState as typeof initialGrid).robot.x).toBe(1);
    });

    it('pauses store step(), play(), and instant mode cleanly with aria-live statusAnnouncement, and resumes after replacement', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('1.1');

      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'motion' });
      store.addBlock('MAIN', 'MOVE_FWD');

      const placeholderId = useAppStore.getState().workspace.MAIN[1].id;
      store.setSelectedBlockId(null);

      // Step 1 executes MOVE_FWD
      store.step();
      expect(useAppStore.getState().grid.robot.x).toBe(1);
      expect(useAppStore.getState().runtime?.status).toBe('RUNNING');

      // Step 2 reaches PLACEHOLDER -> PAUSED, isPlaying=false, selects placeholder, announces pause
      store.step();
      const pausedState = useAppStore.getState();
      expect(pausedState.runtime?.status).toBe('PAUSED');
      expect(pausedState.isPlaying).toBe(false);
      expect(pausedState.runtime?.activeBlockId).toBe(placeholderId);
      expect(pausedState.selectedBlockId).toBe(placeholderId);
      expect(pausedState.statusAnnouncement).toContain('paused on ? placeholder block');
      expect(pausedState.statusAnnouncement).toContain('movement hint');

      // Replace PLACEHOLDER with MOVE_FWD in place and continue stepping to reach the goal!
      expect(store.replacePlaceholderBlock('MAIN', placeholderId, 'MOVE_FWD')).toBe(true);
      store.step(); // executes the newly placed MOVE_FWD at index 1 -> x=2
      expect(useAppStore.getState().grid.robot.x).toBe(2);
      store.step(); // executes MOVE_FWD at index 2 -> x=3
      store.step(); // pops empty stack -> evaluates completion -> SUCCESS
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');

      // Also verify instant mode pausing on PLACEHOLDER
      store.reset();
      store.clearWorkspace();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'turn' });
      const instantPhId = useAppStore.getState().workspace.MAIN[1].id;
      store.setSpeed('instant');

      const instantState = useAppStore.getState();
      expect(instantState.grid.status).toBe('PAUSED');
      expect(instantState.runtime?.status).toBe('PAUSED');
      expect(instantState.runtime?.activeBlockId).toBe(instantPhId);
      expect(instantState.statusAnnouncement).toContain('turn hint');
    });
  });

  describe('3. In-Place Placeholder Replacement, Undo/Redo & Palette Hint Highlighting', () => {
    it('replaces a selected PLACEHOLDER block in place and restores "?" on 1-tap undo()', () => {
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'turn' });
      store.addBlock('MAIN', 'MOVE_FWD');

      const blocksBefore = useAppStore.getState().workspace.MAIN;
      expect(blocksBefore.map((b) => b.type)).toEqual(['MOVE_FWD', 'PLACEHOLDER', 'MOVE_FWD']);
      const placeholderId = blocksBefore[1].id;

      // Replace in place with TURN_RIGHT
      const replaced = store.replacePlaceholderBlock('MAIN', placeholderId, 'TURN_RIGHT');
      expect(replaced).toBe(true);

      const blocksAfter = useAppStore.getState().workspace.MAIN;
      expect(blocksAfter.map((b) => b.type)).toEqual(['MOVE_FWD', 'TURN_RIGHT', 'MOVE_FWD']);
      expect(blocksAfter[0].id).toBe(blocksBefore[0].id);
      expect(blocksAfter[2].id).toBe(blocksBefore[2].id);
      expect(useAppStore.getState().selectedBlockId).toBe(blocksAfter[1].id);
      expect(useAppStore.getState().canUndo).toBe(true);

      // 1-tap Undo restores the PLACEHOLDER block with its original hintCategory!
      store.undo();
      const blocksRestored = useAppStore.getState().workspace.MAIN;
      expect(blocksRestored.map((b) => b.type)).toEqual(['MOVE_FWD', 'PLACEHOLDER', 'MOVE_FWD']);
      expect(blocksRestored[1].id).toBe(placeholderId);
      expect(getPlaceholderHintCategory(blocksRestored[1])).toBe('turn');

      // 1-tap Redo re-applies TURN_RIGHT
      store.redo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'TURN_RIGHT',
        'MOVE_FWD',
      ]);
    });

    it('handles replacing PLACEHOLDER with LOOP_START cleanly for both open and pre-closed scaffolds', () => {
      const store = useAppStore.getState();

      // Case A: Scaffold already has matching LOOP_END -> inserts single LOOP_START
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'loop' });
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'LOOP_END');
      const phA = useAppStore.getState().workspace.MAIN[0].id;

      store.replacePlaceholderBlock('MAIN', phA, 'LOOP_START');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'LOOP_START',
        'MOVE_FWD',
        'LOOP_END',
      ]);
      expect(validateLoopStructure(useAppStore.getState().workspace.MAIN).hasError).toBe(false);

      // Case B: No matching LOOP_END -> inserts balanced LOOP_START + LOOP_END pair and 1-tap undo restores ?
      store.clearWorkspace();
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'loop' });
      const phB = useAppStore.getState().workspace.MAIN[1].id;

      store.replacePlaceholderBlock('MAIN', phB, 'LOOP_START');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'LOOP_START',
        'LOOP_END',
      ]);
      expect(validateLoopStructure(useAppStore.getState().workspace.MAIN).hasError).toBe(false);

      store.undo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'PLACEHOLDER',
      ]);
    });

    it('matches hint categories accurately and highlights matching buttons in BlockPalette when PLACEHOLDER is selected', () => {
      const checkMatch = (
        type: string,
        cat: string | undefined,
        hint: PlaceholderHintCategory
      ) => doesBlockMatchHintCategory(type, cat, hint);

      expect(checkMatch('MOVE_FWD', 'motion', 'motion')).toBe(true);
      expect(checkMatch('TURN_LEFT', 'motion', 'motion')).toBe(false);
      expect(checkMatch('TURN_LEFT', 'motion', 'turn')).toBe(true);
      expect(checkMatch('TURN_RIGHT', 'motion', 'turn')).toBe(true);
      expect(checkMatch('LOOP_START', undefined, 'loop')).toBe(true);
      expect(checkMatch('CALL_F1', undefined, 'function')).toBe(true);
      expect(checkMatch('MOVE_FWD', 'motion', 'any')).toBe(true);
      expect(checkMatch('LOOP_START', undefined, 'any')).toBe(true);

      // Select a 'turn' PLACEHOLDER block in the store and render BlockPalette + BlockItem
      const store = useAppStore.getState();
      store.addBlock('MAIN', 'PLACEHOLDER', undefined, undefined, { hintCategory: 'turn' });
      const phBlock = useAppStore.getState().workspace.MAIN[0];
      store.setSelectedBlockId(phBlock.id);

      const blockMarkup = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: phBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
          isSelected: true,
        })
      );
      expect(blockMarkup).toContain('data-placeholder-hint="turn"');
      expect(blockMarkup).toContain('tabindex="0"');
      expect(blockMarkup).toContain('border-dashed');

      const paletteMarkup = renderToStaticMarkup(React.createElement(BlockPalette));
      // Turn buttons should have data-hint-highlighted="true", while move-fwd should not
      expect(paletteMarkup).toMatch(
        /data-testid="palette-turn-left"[^>]*data-hint-highlighted="true"/
      );
      expect(paletteMarkup).toMatch(
        /data-testid="palette-turn-right"[^>]*data-hint-highlighted="true"/
      );
      expect(paletteMarkup).not.toMatch(
        /data-testid="palette-move-fwd"[^>]*data-hint-highlighted="true"/
      );
    });
  });

  describe('4. Tier 1 Ghost-Step Preview, Tier 1 ? Scaffold & Two-Tier Help Modal', () => {
    it('computes ghost-step trajectories on 1.1–1.3 and triggers Ghost Preview without modifying workspace blocks or Undo history', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');

      for (const actId of ['1.1', '1.2', '1.3']) {
        store.setCurriculumActivity(actId);
        store.addBlock('MAIN', 'TURN_LEFT');
        const blocksSnapshotBefore = JSON.stringify(useAppStore.getState().workspace);
        const pastLengthBefore = useAppStore.getState().past.length;

        store.setSolutionOpen(true);
        expect(useAppStore.getState().isSolutionOpen).toBe(true);

        // Trigger Tier 1 Ghost Preview
        expect(store.triggerGhostPreview()).toBe(true);

        const afterGhost = useAppStore.getState();
        // Modal closed automatically
        expect(afterGhost.isSolutionOpen).toBe(false);
        // Ghost preview active with expected step poses (initial pose + maxSteps)
        const act = getActivityLatest(actId)!;
        const expectedPoses = computeGhostPreviewSteps(
          afterGhost.grid,
          act.partialHelp!.ghostPreview!
        );
        expect(afterGhost.ghostPreview?.active).toBe(true);
        expect(afterGhost.ghostPreview?.activityId).toBe(actId);
        expect(afterGhost.ghostPreview?.poses).toEqual(expectedPoses);
        expect(expectedPoses.length).toBeGreaterThan(1);
        // Polite announcement emitted
        expect(afterGhost.statusAnnouncement).toContain('Ghost-step preview');
        // Learner's workspace blocks and Undo history are 100% untouched!
        expect(JSON.stringify(afterGhost.workspace)).toBe(blocksSnapshotBefore);
        expect(afterGhost.past.length).toBe(pastLengthBefore);

        // Advance ghost step and render GhostStepOverlay inside GridOverlayLayer
        store.advanceGhostPreviewStep();
        expect(useAppStore.getState().ghostPreview?.currentStepIndex).toBe(1);

        const svgMarkup = renderToStaticMarkup(
          React.createElement(
            'svg',
            null,
            React.createElement(GridOverlayLayer, {
              grid: afterGhost.grid,
              cellSize: GRID_CELL_SIZE,
              isInstant: false,
              isReadOnly: true,
              layer: 'over-robot',
              ghostStepSlot: React.createElement(GhostStepOverlay, { cellSize: GRID_CELL_SIZE }),
            })
          )
        );
        expect(svgMarkup).toContain('data-testid="ghost-step-overlay"');
        expect(svgMarkup).toContain('data-testid="ghost-trail"');
        expect(svgMarkup).toContain('data-testid="ghost-robot"');
      }
    });

    it('loads Tier 1 ? Starter Scaffold and Tier 2 Full Solution with 1-tap Undo protection', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.2');

      // Learner places custom blocks first
      store.addBlock('MAIN', 'MOVE_BACK');
      store.addBlock('MAIN', 'TURN_RIGHT');
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_BACK',
        'TURN_RIGHT',
      ]);

      // Load Tier 1 ? Starter Scaffold (synthesized from 1.2's referenceSolution with PLACEHOLDER blocks)
      expect(store.loadPartialScaffold()).toBe(true);
      const afterScaffold = useAppStore.getState();
      expect(afterScaffold.isSolutionOpen).toBe(false);
      expect(afterScaffold.workspace.MAIN.some((b) => b.type === 'PLACEHOLDER')).toBe(true);
      // First PLACEHOLDER block is auto-selected so hinted palette glows immediately
      const firstPh = afterScaffold.workspace.MAIN.find((b) => b.type === 'PLACEHOLDER')!;
      expect(afterScaffold.selectedBlockId).toBe(firstPh.id);

      // 1-tap Undo restores the learner's exact prior blocks!
      store.undo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_BACK',
        'TURN_RIGHT',
      ]);

      // Load Tier 2 Full Solution -> Undo also restores learner's prior blocks in 1 tap!
      store.loadSolution();
      const expected12Types = getActivityLatest('1.2')!.referenceSolution!.MAIN.map((b) => b.type);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual(expected12Types);
      store.undo();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_BACK',
        'TURN_RIGHT',
      ]);

      // Verify explicit scaffoldWorkspace resolution as well
      const explicitScaffoldActivity: CurriculumActivity = {
        ...CURRICULUM_ACTIVITIES[0],
        id: '1.4-mock',
        partialHelp: {
          mode: 'scaffold',
          scaffoldWorkspace: {
            MAIN: [
              { id: 's1', type: 'MOVE_FWD' },
              { id: 's2', type: 'PLACEHOLDER', params: { hintCategory: 'motion' } },
              { id: 's3', type: 'MOVE_FWD' },
            ],
            F1: [],
            F2: [],
            F3: [],
          },
        },
      };
      const resolved = resolveActivityScaffoldWorkspace(explicitScaffoldActivity);
      expect(resolved?.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'PLACEHOLDER', 'MOVE_FWD']);

      const fallback = buildFallbackScaffoldFromSolution(CURRICULUM_ACTIVITIES[1].referenceSolution!);
      expect(fallback.MAIN.some((b) => b.type === 'PLACEHOLDER')).toBe(true);
    });

    it('renders Two-Tier Help Modal in Curriculum mode while preserving Sandbox SolutionModal layout', () => {
      const store = useAppStore.getState();

      // Curriculum mode on 1.1: Tier 1 Ghost card visible, Tier 2 Full Solution collapsed behind disclosure
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.1');
      store.setSolutionOpen(true);

      const curriculumModalHtml = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(curriculumModalHtml).toContain('data-testid="solution-modal"');
      expect(curriculumModalHtml).toContain('data-testid="tier1-ghost-card"');
      expect(curriculumModalHtml).toContain('data-testid="btn-trigger-ghost-preview"');
      expect(curriculumModalHtml).toContain('data-testid="tier2-full-solution-section"');
      expect(curriculumModalHtml).toContain('data-testid="btn-reveal-full-solution"');
      expect(curriculumModalHtml).toContain('aria-expanded="false"');
      // Full solution load button is hidden until learner reveals Tier 2
      expect(curriculumModalHtml).not.toContain('data-testid="btn-load-solution"');

      // Sandbox mode: immediately displays Recommended Solution and btn-load-solution as before
      store.setAppMode('sandbox');
      store.setSolutionOpen(true);
      const sandboxModalHtml = renderToStaticMarkup(React.createElement(SolutionModal));
      expect(sandboxModalHtml).toContain('Recommended Solution');
      expect(sandboxModalHtml).toContain('data-testid="btn-load-solution"');
      expect(sandboxModalHtml).not.toContain('data-testid="tier1-ghost-card"');
    });
  });
});
