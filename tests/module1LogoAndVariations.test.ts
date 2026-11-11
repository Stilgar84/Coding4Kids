import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_1_LOGO_ACTIVITIES,
  createCurriculumBlock,
  getActivitiesForModule,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import {
  VariationCardsPanel,
  renderTurtleVariationPreview,
} from '../src/components/VariationCardsPanel';
import { BlockItem } from '../src/components/BlockItem';
import { App } from '../src/App';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import {
  exportToBinary,
  exportToString,
  importFromBinary,
  importFromString,
} from '../src/engine/serialization/codeSerializer';
import {
  ENV_ID_TURTLE,
  OP_TURTLE_FORWARD,
  OP_TURTLE_BACKWARD,
  OP_TURTLE_TURN_LEFT,
  OP_TURTLE_TURN_RIGHT,
  OP_TURTLE_PEN_UP,
  OP_TURTLE_PEN_DOWN,
  OP_TURTLE_FORWARD_LEN,
  OP_TURTLE_BACKWARD_LEN,
} from '../src/engine/serialization/types';
import {
  createInitialTurtleState,
  getEffectiveTurtlePaletteItems,
  turtleSimulationEnvironment,
} from '../src/simulations/turtle/turtleEnvironment';
import { TurtleState } from '../src/simulations/turtle/types';
import { generateTurtleMapThumbnail } from '../src/services/mapThumbnailGenerator';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { useAppStore } from '../src/store/useAppStore';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';

describe('Wave 2 / Commit 9: VariationCardsPanel & Module 1 LOGO Lessons (1.6, 1.7, 1B)', () => {
  beforeEach(() => {
    clearPendingUpdateState();
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

  describe('Module 1 Turtle LOGO Activity Schema, Constraints & SVG Thumbnails', () => {
    it('registers 1.6, 1.7, and 1B in MODULE_1_LOGO_ACTIVITIES and CURRICULUM_ACTIVITIES', () => {
      expect(MODULE_1_LOGO_ACTIVITIES.map((a) => a.id)).toEqual(['1.6', '1.7', '1B']);

      const m1Ids = getActivitiesForModule('module-1').map((a) => a.id);
      expect(m1Ids).toContain('1.6');
      expect(m1Ids).toContain('1.7');
      expect(m1Ids).toContain('1B');

      for (const id of ['1.6', '1.7', '1B']) {
        const act = getActivityLatest(id);
        expect(act).toBeDefined();
        expect(act!.version).toBe(1);
        expect(act!.moduleId).toBe('module-1');
        expect(act!.simId).toBe('turtle');
        expect(isValidatedPuzzleActivity(act!)).toBe(false);
        expect(act!.palette.allowActionParams).toBe(false);
        expect(act!.palette.allowRepeatBadges).toBe(false);
        expect(act!.palette.allowVariables).toBe(false);
        expect(act!.palette.allowedControlBlocks).toEqual([]);
        expect(act!.palette.allowedScopes).toEqual(['MAIN']);
      }
    });

    it('enforces format, palette, starter block budgets, and 3 distinct variations on 1.6, 1.7, and 1B', () => {
      const act16 = getActivityLatest('1.6')!;
      expect(act16.format).toBe('sandbox');
      expect(act16.palette.allowedSimBlocks).not.toContain('PEN_UP');
      expect(act16.palette.allowedSimBlocks).not.toContain('PEN_DOWN');
      expect(act16.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(6);
      expect(act16.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(8);
      expect(act16.variations).toHaveLength(3);
      for (const v of act16.variations!) {
        expect(v.workspace.MAIN.length).toBeGreaterThan(0);
        expect(v.workspace.MAIN.length).toBeLessThanOrEqual(12);
      }

      const act17 = getActivityLatest('1.7')!;
      expect(act17.format).toBe('sandbox');
      expect(act17.palette.allowedSimBlocks).toContain('PEN_UP');
      expect(act17.palette.allowedSimBlocks).toContain('PEN_DOWN');
      expect(act17.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(5);
      expect(act17.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(10);
      expect(act17.variations).toHaveLength(3);
      for (const v of act17.variations!) {
        expect(v.workspace.MAIN.length).toBeGreaterThan(0);
        expect(v.workspace.MAIN.length).toBeLessThanOrEqual(12);
        expect(v.workspace.MAIN.some((b) => b.type === 'PEN_UP')).toBe(true);
        expect(v.workspace.MAIN.some((b) => b.type === 'PEN_DOWN')).toBe(true);
      }

      const act1B = getActivityLatest('1B')!;
      expect(act1B.format).toBe('capstone');
      expect(act1B.capstoneType).toBe('creative');
      expect(act1B.palette.allowedSimBlocks).toContain('PEN_UP');
      expect(act1B.palette.allowedSimBlocks).toContain('PEN_DOWN');
      expect(act1B.starterWorkspace!.MAIN.length).toBeGreaterThanOrEqual(10);
      expect(act1B.starterWorkspace!.MAIN.length).toBeLessThanOrEqual(12);
      expect(act1B.variations).toHaveLength(3);
      for (const v of act1B.variations!) {
        expect(v.workspace.MAIN.length).toBeGreaterThanOrEqual(10);
        expect(v.workspace.MAIN.length).toBeLessThanOrEqual(12);
      }
    });

    it('simulates all starter workspaces and variations headlessly into non-empty, distinct SVG thumbnails', () => {
      for (const activity of MODULE_1_LOGO_ACTIVITIES) {
        const allowedTypes = new Set(activity.palette.allowedSimBlocks);
        const allWorkspaces = [
          { label: `${activity.id}-starter`, ws: activity.starterWorkspace! },
          ...activity.variations!.map((v) => ({ label: v.id, ws: v.workspace })),
        ];

        const pathSignatures = new Set<string>();

        for (const { ws } of allWorkspaces) {
          for (const block of ws.MAIN) {
            expect(allowedTypes.has(block.type)).toBe(true);
            expect(block.params).toBeUndefined();
            expect(block.repeatCount).toBeUndefined();
          }

          const preview = renderTurtleVariationPreview(ws);
          expect(preview.finalState.paths.length).toBeGreaterThanOrEqual(2);
          expect(preview.svgMarkup).toContain('<svg');
          expect(preview.svgMarkup).toContain('<line');
          expect(preview.thumbnailUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
          expect(preview.thumbnailUrl).toBe(generateTurtleMapThumbnail(preview.finalState));

          const sig = JSON.stringify(
            preview.finalState.paths.map((p) => ({
              type: p.type,
              fromX: Math.round(p.fromX),
              fromY: Math.round(p.fromY),
              toX: Math.round(p.toX),
              toY: Math.round(p.toY),
            }))
          );
          pathSignatures.add(sig);
        }

        // Starter + 3 variations produce 4 distinct geometric drawings
        expect(pathSignatures.size).toBe(4);
      }
    });
  });

  describe('Binary Serialization Round-Trips with Standard ENV_ID_TURTLE (0x02) Opcodes', () => {
    it('encodes all Module 1 LOGO starters and variations using parameterless opcodes 0x10..0x17 and round-trips identically', () => {
      const expectedLogoOpcodes = new Set([
        OP_TURTLE_FORWARD,    // 0x10
        OP_TURTLE_BACKWARD,   // 0x11
        OP_TURTLE_TURN_LEFT,  // 0x12
        OP_TURTLE_TURN_RIGHT, // 0x13
        OP_TURTLE_PEN_UP,     // 0x16
        OP_TURTLE_PEN_DOWN,   // 0x17
      ]);

      const observedOpcodes = new Set<number>();

      for (const activity of MODULE_1_LOGO_ACTIVITIES) {
        const workspaces = [
          activity.starterWorkspace!,
          ...activity.variations!.map((v) => v.workspace),
        ];

        for (const ws of workspaces) {
          const turtle = createInitialTurtleState();
          const binary = exportToBinary(ws, 'turtle', turtle);

          // Header bytes:
          // Byte 0: formatVersion (1)
          // Byte 1: envId (ENV_ID_TURTLE = 0x02)
          // Byte 2: envVersion (1)
          // Byte 3: nonEmptyScopes count (1)
          // Byte 4: SCOPE_ID_MAIN (0x00)
          // Byte 5: blockCount (VLE < 128 -> 1 byte)
          expect(binary[0]).toBe(1);
          expect(binary[1]).toBe(ENV_ID_TURTLE);
          expect(binary[2]).toBe(1);
          expect(binary[3]).toBe(1);
          expect(binary[4]).toBe(0x00);
          expect(binary[5]).toBe(ws.MAIN.length);

          // Parse block opcodes directly:
          // OP_TURTLE_FORWARD (0x10), OP_TURTLE_BACKWARD (0x11), OP_TURTLE_PEN_UP (0x16),
          // and OP_TURTLE_PEN_DOWN (0x17) are 1-byte instructions when unparameterized;
          // OP_TURTLE_TURN_LEFT (0x12) and OP_TURTLE_TURN_RIGHT (0x13) carry a 1-byte VLE angle (90).
          let offset = 6;
          for (const _block of ws.MAIN) {
            const headerByte = binary[offset++];
            const opcode = headerByte & 0x3f;
            expect(headerByte & 0xc0).toBe(0); // No var mask or repeat mask
            expect(expectedLogoOpcodes.has(opcode)).toBe(true);
            expect(opcode).not.toBe(OP_TURTLE_FORWARD_LEN);
            expect(opcode).not.toBe(OP_TURTLE_BACKWARD_LEN);
            observedOpcodes.add(opcode);

            if (opcode === OP_TURTLE_TURN_LEFT || opcode === OP_TURTLE_TURN_RIGHT) {
              const angle = binary[offset++];
              expect(angle).toBe(90);
            }
          }
          expect(offset).toBe(binary.length);

          // Round-trip binary & string deserialization and compare final drawings
          const binImported = importFromBinary(binary);
          expect(binImported.success).toBe(true);
          expect(binImported.envId).toBe('turtle');
          expect(binImported.workspace!.MAIN).toHaveLength(ws.MAIN.length);

          const strExport = exportToString(ws, 'turtle', turtle);
          const strImported = importFromString(strExport);
          expect(strImported.success).toBe(true);

          const origPaths = (
            runHeadlessSimulation(ws, 'turtle', createInitialTurtleState()).finalState as TurtleState
          ).paths;
          const importedPaths = (
            runHeadlessSimulation(
              binImported.workspace!,
              'turtle',
              createInitialTurtleState()
            ).finalState as TurtleState
          ).paths;
          expect(importedPaths).toEqual(origPaths);
        }
      }

      // All 6 target opcodes (0x10, 0x11, 0x12, 0x13, 0x16, 0x17) were exercised across 1.6, 1.7, 1B
      expect(observedOpcodes).toEqual(expectedLogoOpcodes);
    });
  });

  describe('Parameterless LOGO Execution & Hidden Parameter Badges (allowActionParams === false)', () => {
    it('executes 50px steps and 90° turns cleanly whether block.params is omitted or present, including MOVE_FWD/MOVE_BACK aliases', () => {
      let state = createInitialTurtleState();

      // Omitted params on FORWARD, TURN_RIGHT, MOVE_FWD, TURN_LEFT, BACKWARD, MOVE_BACK
      state = turtleSimulationEnvironment.executeAction('FORWARD', state).nextState;
      expect(state.robot).toEqual({ x: 0, y: -50, heading: 0 });

      state = turtleSimulationEnvironment.executeAction('TURN_RIGHT', state).nextState;
      expect(state.robot).toEqual({ x: 0, y: -50, heading: 90 });

      state = turtleSimulationEnvironment.executeAction('MOVE_FWD', state).nextState;
      expect(state.robot).toEqual({ x: 50, y: -50, heading: 90 });

      state = turtleSimulationEnvironment.executeAction('TURN_LEFT', state).nextState;
      expect(state.robot).toEqual({ x: 50, y: -50, heading: 0 });

      state = turtleSimulationEnvironment.executeAction('BACKWARD', state).nextState;
      expect(state.robot).toEqual({ x: 50, y: 0, heading: 0 });

      state = turtleSimulationEnvironment.executeAction('MOVE_BACK', state).nextState;
      expect(state.robot).toEqual({ x: 50, y: 50, heading: 0 });

      // Explicit params still work when provided
      state = turtleSimulationEnvironment.executeAction('FORWARD', state, {
        params: { length: 25 },
      }).nextState;
      expect(state.robot).toEqual({ x: 50, y: 25, heading: 0 });

      state = turtleSimulationEnvironment.executeAction('TURN_RIGHT', state, {
        params: { angle: 45 },
      }).nextState;
      expect(state.robot).toEqual({ x: 50, y: 25, heading: 45 });

      // Effective palette items helper strips paramDefs when allowActionParams === false
      const strippedItems = getEffectiveTurtlePaletteItems(false);
      expect(strippedItems.every((item) => item.paramDefs === undefined && item.params === undefined)).toBe(
        true
      );
      const fullItems = getEffectiveTurtlePaletteItems(true);
      expect(fullItems.some((item) => (item.paramDefs?.length ?? 0) > 0)).toBe(true);
    });

    it('omits params on newly added blocks and blocks updateBlockParams in allowActionParams === false lessons', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('1.6');
      store.clearWorkspace();

      store.addBlock('MAIN', 'FORWARD');
      store.addBlock('MAIN', 'TURN_RIGHT');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_BACK');

      const blocks = useAppStore.getState().workspace.MAIN;
      expect(blocks.map((b) => b.type)).toEqual(['FORWARD', 'TURN_RIGHT', 'FORWARD', 'BACKWARD']);
      for (const b of blocks) {
        expect(b.params).toBeUndefined();
      }

      // Attempt to mutate params on TURN_RIGHT while allowActionParams === false: ignored
      store.updateBlockParams('MAIN', blocks[1].id, { angle: 45 });
      expect(useAppStore.getState().workspace.MAIN[1].params).toBeUndefined();

      // Headless execution of the newly added blocks runs clean 50px steps & 90° turns
      const result = runHeadlessSimulation(
        useAppStore.getState().workspace,
        'turtle',
        createInitialTurtleState()
      ).finalState as TurtleState;
      // (0,0) -> FORWARD (0,-50) -> TURN_RIGHT (90°) -> FORWARD (50,-50) -> BACKWARD (0,-50)
      expect(result.robot).toEqual({ x: 0, y: -50, heading: 90 });
    });

    it('hides BlockParamBadge in BlockItem when allowActionParams === false in Curriculum mode, and shows it in Sandbox mode', () => {
      const turnBlock = createCurriculumBlock('TURN_RIGHT', undefined, { angle: 90 }, 'test_turn');
      const fwdBlock = createCurriculumBlock('FORWARD', undefined, { length: 50 }, 'test_fwd');

      // In Curriculum Lesson 1.6 (allowActionParams === false): parameter badges are hidden
      useAppStore.getState().setCurriculumActivity('1.6');
      const curriculumTurnHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: turnBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );
      const curriculumFwdHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: fwdBlock,
          index: 1,
          scope: 'MAIN',
          isActive: false,
        })
      );
      expect(curriculumTurnHtml).not.toContain('block-params-container-');
      expect(curriculumTurnHtml).not.toContain('param-badge-');
      expect(curriculumFwdHtml).not.toContain('block-params-container-');
      expect(curriculumFwdHtml).not.toContain('param-badge-');

      // Switch back to Turtle Sandbox: parameter badges render normally
      useAppStore.getState().setAppMode('sandbox');
      useAppStore.getState().setSimEnvironment('turtle');
      const sandboxTurnHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: turnBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
        })
      );
      const sandboxFwdHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: fwdBlock,
          index: 1,
          scope: 'MAIN',
          isActive: false,
        })
      );
      expect(sandboxTurnHtml).toContain(`block-params-container-${turnBlock.id}`);
      expect(sandboxTurnHtml).toContain('param-badge-angle');
      expect(sandboxFwdHtml).toContain(`block-params-container-${fwdBlock.id}`);
      expect(sandboxFwdHtml).toContain('param-badge-length');
    });
  });

  describe('Grid <-> Turtle Curriculum Switching, VariationCardsPanel & Undo-Protected Load Code', () => {
    it('renders VariationCardsPanel inside pane-simulation for 1.6/1.7/1B and hides it for Robot puzzles or Sandbox', () => {
      // Sandbox mode: hidden
      expect(renderToStaticMarkup(React.createElement(VariationCardsPanel))).toBe('');

      // Robot Grid puzzle 1.1 (no variations): hidden
      useAppStore.getState().setCurriculumActivity('1.1');
      expect(renderToStaticMarkup(React.createElement(VariationCardsPanel))).toBe('');

      // Turtle LOGO 1.6: renders panel, collapse toggle, 3 variation thumbnails, and 3 Load Code buttons
      useAppStore.getState().setCurriculumActivity('1.6');
      const panelHtml = renderToStaticMarkup(React.createElement(VariationCardsPanel));
      expect(panelHtml).toContain('data-testid="variation-cards-panel"');
      expect(panelHtml).toContain('data-testid="btn-toggle-variation-cards"');
      expect(panelHtml).toContain('aria-expanded="true"');
      expect(panelHtml).toContain('aria-controls="variation-cards-list"');

      const act16 = getActivityLatest('1.6')!;
      for (const card of act16.variations!) {
        expect(panelHtml).toContain(`data-testid="variation-card-${card.id}"`);
        expect(panelHtml).toContain(`data-testid="variation-thumbnail-${card.id}"`);
        expect(panelHtml).toContain(`data-testid="btn-load-variation-${card.id}"`);
        expect(panelHtml).toContain('data:image/svg+xml;charset=utf-8,');
      }

      // Full App SSR check confirms pane-simulation mounts variation-cards-panel cleanly
      const appHtml = renderToStaticMarkup(React.createElement(App));
      expect(appHtml).toContain('data-testid="pane-simulation"');
      expect(appHtml).toContain('data-testid="variation-cards-panel"');
    });

    it('switches cleanly between Grid (1.1–1.3) and Turtle (1.6, 1.7, 1B) activities, resetting Turtle state and running Instant preview', () => {
      const store = useAppStore.getState();

      // Enable Instant mode and enter Grid puzzle 1.1
      store.setSpeed('instant');
      store.setCurriculumActivity('1.1');
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().activeSimId).toBe('grid');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Add a custom block in 1.1
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().grid.robot.x).toBe(1);

      // Switch to Turtle LOGO 1.6: switches to turtle, loads starter square, runs instant preview!
      store.setCurriculumActivity('1.6');
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(7);
      expect(useAppStore.getState().turtleState.paths).toHaveLength(4); // 4 sides of starter square!

      // Switch to 1.7: resets previous turtle paths and runs 1.7 starter (= parallel bars, 2 ink lines)
      store.setCurriculumActivity('1.7');
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(8);
      expect(useAppStore.getState().turtleState.paths).toHaveLength(2);

      // Switch to Capstone 1B: runs 1B starter (5 ink segments: 3 arch lines + 2 flagpole segments)
      store.setCurriculumActivity('1B');
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(12);
      expect(useAppStore.getState().turtleState.paths).toHaveLength(5);

      // Switch back to Grid 1.1: restores learner's saved 1.1 workspace and runs Grid instant mode
      store.setCurriculumActivity('1.1');
      expect(useAppStore.getState().activeSimId).toBe('grid');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
      expect(useAppStore.getState().grid.robot.x).toBe(1);
    });

    it('loads a variation workspace with Undo protection, clones fresh block IDs, announces via aria-live, and reverts cleanly on Undo', () => {
      const store = useAppStore.getState();
      store.setSpeed('instant');
      store.setCurriculumActivity('1.6');

      // Customize learner's workspace in 1.6 before clicking Load Code
      store.clearWorkspace();
      store.addBlock('MAIN', 'FORWARD');
      store.addBlock('MAIN', 'TURN_LEFT');
      store.addBlock('MAIN', 'FORWARD');
      const learnerTypesBefore = useAppStore.getState().workspace.MAIN.map((b) => b.type);
      const learnerIdsBefore = useAppStore.getState().workspace.MAIN.map((b) => b.id);
      expect(learnerTypesBefore).toEqual(['FORWARD', 'TURN_LEFT', 'FORWARD']);
      expect(useAppStore.getState().turtleState.paths).toHaveLength(2);

      // Load Variation Card 'Plus Sign' (11 blocks, 8 line segments)
      const plusCard = getActivityLatest('1.6')!.variations!.find((v) => v.id === '1.6-plus')!;
      store.loadVariationWorkspace(plusCard.workspace, plusCard.title);

      const afterLoad = useAppStore.getState();
      expect(afterLoad.canUndo).toBe(true);
      expect(afterLoad.workspace.MAIN).toHaveLength(plusCard.workspace.MAIN.length);
      expect(afterLoad.workspace.MAIN.map((b) => b.type)).toEqual(
        plusCard.workspace.MAIN.map((b) => b.type)
      );
      // Cloned block IDs are fresh (not sharing references with static curriculum card definition)
      const staticIds = new Set(plusCard.workspace.MAIN.map((b) => b.id));
      expect(afterLoad.workspace.MAIN.every((b) => !staticIds.has(b.id))).toBe(true);
      // Curriculum workspace cache updated
      expect(afterLoad.curriculumWorkspaces['1.6'].MAIN).toHaveLength(plusCard.workspace.MAIN.length);
      // Polite status announcement emitted
      expect(afterLoad.statusAnnouncement).toContain('Plus Sign');
      expect(afterLoad.statusAnnouncement).toContain('Undo');
      // Instant preview updated to Plus Sign's 8 drawn segments
      expect(afterLoad.turtleState.paths).toHaveLength(8);

      // Clicking Undo restores the learner's exact prior work and re-runs Instant preview!
      store.undo();
      const afterUndo = useAppStore.getState();
      expect(afterUndo.workspace.MAIN.map((b) => b.type)).toEqual(learnerTypesBefore);
      expect(afterUndo.workspace.MAIN.map((b) => b.id)).toEqual(learnerIdsBefore);
      expect(afterUndo.curriculumWorkspaces['1.6'].MAIN.map((b) => b.type)).toEqual(
        learnerTypesBefore
      );
      expect(afterUndo.turtleState.paths).toHaveLength(2);
    });
  });
});
