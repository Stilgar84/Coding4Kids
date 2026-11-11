import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import { getSimEnvironment } from '../src/engine/simulation/registry';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
} from '../src/data/curriculum';
import {
  computeSlotBudget,
  computeStagedPalettePolicy,
  getAllowedParamDefs,
  resolveActiveCurriculumActivity,
} from '../src/utils/curriculumStagePolicy';
import { BlockPalette } from '../src/components/BlockPalette';
import { BlockSubpalette } from '../src/components/BlockSubpalette';
import { WorkspaceCanvas } from '../src/components/WorkspaceCanvas';
import { BlockItem } from '../src/components/BlockItem';
import { ParamSelectionPopover } from '../src/components/params/ParamSelectionPopover';
import { Toolbar } from '../src/components/Toolbar';

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) ?? []).length;
}

describe('Commit 2: Staged Palette Filtering & Physical Block-Budget Slot Trays', () => {
  const initialActivityCount = CURRICULUM_ACTIVITIES.length;

  const registerTestActivity = (activity: CurriculumActivity) => {
    CURRICULUM_ACTIVITIES.push(activity);
  };

  beforeEach(() => {
    CURRICULUM_ACTIVITIES.length = initialActivityCount;
    const store = useAppStore.getState();
    store.pause();
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.clearWorkspace();
    store.setActiveScope('MAIN');
    store.setSelectedBlockId(null);
    store.setSubpaletteCollapsed(false);
    store.setFunctionBarOpen(false);
    useAppStore.setState({
      curriculumWorkspaces: {},
      sandboxSnapshot: null,
      statusAnnouncement: '',
      slotCapRejectionCount: 0,
      lastSlotCapRejectedAt: null,
    });
    store.clearHistory();
  });

  afterEach(() => {
    CURRICULUM_ACTIVITIES.length = initialActivityCount;
  });

  describe('Sandbox Mode Unrestricted Behavior (Zero Regressions)', () => {
    it('shows all simulation blocks, control blocks, repeat badges, variables, and scope tabs in Sandbox mode', () => {
      const store = useAppStore.getState();
      store.setFunctionBarOpen(true);

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));

      // All 4 grid simulation blocks
      expect(paletteHtml).toContain('data-testid="palette-move-fwd"');
      expect(paletteHtml).toContain('data-testid="palette-move-back"');
      expect(paletteHtml).toContain('data-testid="palette-turn-left"');
      expect(paletteHtml).toContain('data-testid="palette-turn-right"');

      // All 7 universal control blocks
      expect(paletteHtml).toContain('data-testid="palette-loop-start"');
      expect(paletteHtml).toContain('data-testid="palette-loop-end"');
      expect(paletteHtml).toContain('data-testid="palette-var-assign"');
      expect(paletteHtml).toContain('data-testid="palette-var-op"');
      expect(paletteHtml).toContain('data-testid="palette-call-f1"');
      expect(paletteHtml).toContain('data-testid="palette-call-f2"');
      expect(paletteHtml).toContain('data-testid="palette-call-f3"');

      // Repeat badges 2..9 and variable repeat badges a, b, c, n
      for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) {
        expect(paletteHtml).toContain(`data-testid="palette-number-${n}"`);
      }
      for (const v of ['a', 'b', 'c', 'n']) {
        expect(paletteHtml).toContain(`data-testid="palette-number-var-${v}"`);
      }

      // Action param toggle & Function bar with all 4 scopes
      expect(paletteHtml).toContain('data-testid="palette-param-toggle-btn"');
      expect(paletteHtml).toContain('data-testid="btn-toggle-function-bar"');
      expect(paletteHtml).toContain('data-testid="palette-function-bar"');
      expect(paletteHtml).toContain('data-testid="palette-tab-main"');
      expect(paletteHtml).toContain('data-testid="palette-tab-f1"');
      expect(paletteHtml).toContain('data-testid="palette-tab-f2"');
      expect(paletteHtml).toContain('data-testid="palette-tab-f3"');

      // WorkspaceCanvas in Sandbox has all 4 desktop scope tabs and NO slot cap tray
      const canvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(canvasHtml).toContain('data-testid="tab-main"');
      expect(canvasHtml).toContain('data-testid="tab-f1"');
      expect(canvasHtml).toContain('data-testid="tab-f2"');
      expect(canvasHtml).toContain('data-testid="tab-f3"');
      expect(canvasHtml).toContain('data-slot-capped="false"');
      expect(canvasHtml).not.toContain('data-testid="workspace-slot-counter"');
      expect(canvasHtml).not.toContain('data-testid="workspace-empty-slot"');
    });

    it('renders all turtle action param badges, subpalette options, and popover variables in Sandbox mode', () => {
      const store = useAppStore.getState();
      store.setSimEnvironment('turtle');
      store.addBlock('MAIN', 'ARC_LEFT');

      const placedBlock = useAppStore.getState().workspace.MAIN[0];
      const blockHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: placedBlock,
          index: 0,
          scope: 'MAIN',
          isActive: false,
          isSelected: true,
        })
      );
      expect(blockHtml).toContain(`data-testid="block-params-container-${placedBlock.id}"`);
      expect(blockHtml).toContain('data-testid="block-param-badge-radius"');
      expect(blockHtml).toContain('data-testid="block-param-badge-angle"');

      const subpaletteHtml = renderToStaticMarkup(React.createElement(BlockSubpalette));
      expect(subpaletteHtml).toContain('data-testid="block-subpalette"');
      expect(subpaletteHtml).toContain('data-testid="subpalette-param-radius-50"');
      expect(subpaletteHtml).toContain('data-testid="subpalette-param-angle-90"');

      const turtleEnv = getSimEnvironment('turtle')!;
      const forwardDef = turtleEnv.paletteItems.find((p) => p.actionType === 'FORWARD')!.paramDefs![0];
      const popoverHtml = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: forwardDef,
          currentValue: 50,
          onSelect: () => {},
          onClose: () => {},
          actionType: 'FORWARD',
        })
      );
      expect(popoverHtml).toContain('data-testid="param-option-var-a"');
      expect(popoverHtml).toContain('data-testid="param-option-var-z"');
    });
  });

  describe('Curriculum Staged Palette Filtering (PaletteConfig)', () => {
    it('filters Activity 1.1 down to MOVE_FWD only, hiding turns, loops, repeats, variables, params, and function tabs', () => {
      const store = useAppStore.getState();
      store.setFunctionBarOpen(true);
      store.setCurriculumActivity('1.1');
      store.setAppMode('curriculum');

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('data-testid="palette-move-fwd"');
      expect(paletteHtml).not.toContain('data-testid="palette-move-back"');
      expect(paletteHtml).not.toContain('data-testid="palette-turn-left"');
      expect(paletteHtml).not.toContain('data-testid="palette-turn-right"');

      // Universal control blocks default to [] when omitted or empty in Curriculum mode
      expect(paletteHtml).not.toContain('data-testid="palette-loop-start"');
      expect(paletteHtml).not.toContain('data-testid="palette-loop-end"');
      expect(paletteHtml).not.toContain('data-testid="palette-var-assign"');
      expect(paletteHtml).not.toContain('data-testid="palette-var-op"');
      expect(paletteHtml).not.toContain('data-testid="palette-call-f1"');

      // Repeat & variable badges hidden
      expect(paletteHtml).not.toContain('data-testid="palette-number-row"');
      expect(paletteHtml).not.toContain('data-testid="palette-number-2"');
      expect(paletteHtml).not.toContain('data-testid="palette-number-var-a"');

      // Action params & Function bar hidden when only MAIN is allowed
      expect(paletteHtml).not.toContain('data-testid="palette-param-toggle-btn"');
      expect(paletteHtml).not.toContain('data-testid="btn-toggle-function-bar"');
      expect(paletteHtml).not.toContain('data-testid="palette-function-bar"');

      // Desktop scope tabs hidden in WorkspaceCanvas when only MAIN is allowed; 1.1 has maxTotal: 4
      const canvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(canvasHtml).not.toContain('data-testid="tab-main"');
      expect(canvasHtml).not.toContain('data-testid="tab-f1"');
      expect(canvasHtml).toContain('data-slot-capped="true"');
      expect(countMatches(canvasHtml, /data-testid="workspace-empty-slot"/g)).toBe(4);
    });

    it('progressively reveals turns in 1.2 and MOVE_BACK in 1.3 while keeping repeat badges locked', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.2');

      const palette12 = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(palette12).toContain('data-testid="palette-move-fwd"');
      expect(palette12).toContain('data-testid="palette-turn-left"');
      expect(palette12).toContain('data-testid="palette-turn-right"');
      expect(palette12).not.toContain('data-testid="palette-move-back"');
      expect(palette12).not.toContain('data-testid="palette-number-2"');

      store.setCurriculumActivity('1.3');
      const palette13 = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(palette13).toContain('data-testid="palette-move-fwd"');
      expect(palette13).toContain('data-testid="palette-move-back"');
      expect(palette13).toContain('data-testid="palette-turn-left"');
      expect(palette13).toContain('data-testid="palette-turn-right"');
      expect(palette13).not.toContain('data-testid="palette-number-2"');
    });

    it('shows all registered sim blocks when allowedSimBlocks is omitted, leaves uncapped curriculum activities without empty slots, and filters allowedControlBlocks & allowRepeatBadges', () => {
      registerTestActivity({
        id: 'test-loops',
        moduleId: 'module-3',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🔁',
        title: 'Loop Test',
        concept: 'Loops & Repeat Badges',
        description: 'Test activity with omitted allowedSimBlocks, omitted slotCap, and loop controls.',
        grid: {
          width: 4,
          height: 4,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: [],
          flags: [{ id: 'g1', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
        },
        palette: {
          // allowedSimBlocks omitted -> all grid sim blocks visible
          allowedControlBlocks: ['LOOP_START', 'LOOP_END'],
          allowRepeatBadges: true,
          allowVariables: false,
          allowActionParams: false,
        },
      });

      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('test-loops');

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('data-testid="palette-move-fwd"');
      expect(paletteHtml).toContain('data-testid="palette-move-back"');
      expect(paletteHtml).toContain('data-testid="palette-turn-left"');
      expect(paletteHtml).toContain('data-testid="palette-turn-right"');

      expect(paletteHtml).toContain('data-testid="palette-loop-start"');
      expect(paletteHtml).toContain('data-testid="palette-loop-end"');
      expect(paletteHtml).not.toContain('data-testid="palette-call-f1"');
      expect(paletteHtml).not.toContain('data-testid="palette-var-assign"');

      // Repeat badges 2..9 unlocked, variable repeat badges still locked
      expect(paletteHtml).toContain('data-testid="palette-number-2"');
      expect(paletteHtml).toContain('data-testid="palette-number-9"');
      expect(paletteHtml).not.toContain('data-testid="palette-number-var-a"');

      // Uncapped curriculum activity renders standard workspace without slot tray
      const canvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(canvasHtml).toContain('data-slot-capped="false"');
      expect(canvasHtml).not.toContain('data-testid="workspace-empty-slot"');
      expect(canvasHtml).not.toContain('data-testid="workspace-slot-counter"');
    });

    it('filters variable badges, subpalette variable selectors, and param popover variables by allowVariables & allowedVariableNames', () => {
      registerTestActivity({
        id: 'test-vars',
        moduleId: 'module-3',
        version: 1,
        format: 'puzzle',
        simId: 'turtle',
        icon: '📐',
        title: 'Scoped Variables Test',
        concept: 'Variables',
        description: 'Only n and x variables allowed.',
        palette: {
          allowedSimBlocks: ['FORWARD', 'TURN_RIGHT'],
          allowedControlBlocks: ['VAR_ASSIGN', 'VAR_OP'],
          allowRepeatBadges: true,
          allowVariables: true,
          allowedVariableNames: ['n', 'x'],
          allowActionParams: true,
        },
      });

      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('test-vars');
      store.addBlock('MAIN', 'VAR_ASSIGN', undefined, undefined, { a: 'n', b: 1 });

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('data-testid="palette-number-var-n"');
      expect(paletteHtml).toContain('data-testid="palette-number-var-x"');
      expect(paletteHtml).not.toContain('data-testid="palette-number-var-a"');
      expect(paletteHtml).not.toContain('data-testid="palette-number-var-b"');

      // Subpalette for VAR_ASSIGN only shows n and x
      expect(paletteHtml).toContain('data-testid="subpalette-assign-a-n"');
      expect(paletteHtml).toContain('data-testid="subpalette-assign-a-x"');
      expect(paletteHtml).not.toContain('data-testid="subpalette-assign-a-a"');
      expect(paletteHtml).toContain('data-testid="subpalette-assign-b-var-n"');
      expect(paletteHtml).not.toContain('data-testid="subpalette-assign-b-var-a"');

      // ParamSelectionPopover only shows n and x in Variables section
      const turtleEnv = getSimEnvironment('turtle')!;
      const forwardDef = turtleEnv.paletteItems.find((p) => p.actionType === 'FORWARD')!.paramDefs![0];
      const popoverWithVars = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: forwardDef,
          currentValue: 50,
          onSelect: () => {},
          onClose: () => {},
          actionType: 'FORWARD',
        })
      );
      expect(popoverWithVars).toContain('data-testid="param-option-var-n"');
      expect(popoverWithVars).toContain('data-testid="param-option-var-x"');
      expect(popoverWithVars).not.toContain('data-testid="param-option-var-a"');

      // When allowVariables is false, ParamSelectionPopover hides the Variables section completely
      registerTestActivity({
        id: 'test-no-vars-popover',
        moduleId: 'module-2',
        version: 1,
        format: 'puzzle',
        simId: 'turtle',
        icon: '🐢',
        title: 'No Variables Popover Test',
        concept: 'Action Params Only',
        description: 'Action params enabled, variables disabled.',
        palette: {
          allowedSimBlocks: ['FORWARD'],
          allowVariables: false,
          allowActionParams: true,
        },
      });
      store.setCurriculumActivity('test-no-vars-popover');
      const popoverWithoutVars = renderToStaticMarkup(
        React.createElement(ParamSelectionPopover, {
          paramDef: forwardDef,
          currentValue: 50,
          onSelect: () => {},
          onClose: () => {},
          actionType: 'FORWARD',
        })
      );
      expect(popoverWithoutVars).toContain('data-testid="param-option-50"');
      expect(popoverWithoutVars).not.toContain('param-option-var-');
    });

    it('filters action parameters via allowActionParams and allowedBlockParams in BlockItem and BlockSubpalette', () => {
      registerTestActivity({
        id: 'test-turtle-no-params',
        moduleId: 'module-1',
        version: 1,
        format: 'puzzle',
        simId: 'turtle',
        icon: '🐢',
        title: 'Turtle Fixed Step',
        concept: 'Fixed Turtle',
        description: 'Turtle blocks without parameter badges.',
        palette: {
          allowedSimBlocks: ['FORWARD', 'ARC_LEFT'],
          allowActionParams: false,
        },
      });

      registerTestActivity({
        id: 'test-turtle-partial-params',
        moduleId: 'module-2',
        version: 1,
        format: 'puzzle',
        simId: 'turtle',
        icon: '🎯',
        title: 'Turtle Angle Only',
        concept: 'Selective Params',
        description: 'ARC_LEFT exposes angle only, hiding radius.',
        palette: {
          allowedSimBlocks: ['FORWARD', 'ARC_LEFT'],
          allowActionParams: true,
          allowedBlockParams: {
            ARC_LEFT: ['angle'],
          },
        },
      });

      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('test-turtle-no-params');
      store.addBlock('MAIN', 'ARC_LEFT');

      const blockNoParams = useAppStore.getState().workspace.MAIN[0];
      const blockNoParamsHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: blockNoParams,
          index: 0,
          scope: 'MAIN',
          isActive: false,
          isSelected: true,
        })
      );
      expect(blockNoParamsHtml).not.toContain(`block-params-container-${blockNoParams.id}`);
      expect(renderToStaticMarkup(React.createElement(BlockSubpalette))).toBe('');

      // Switch to activity with allowedBlockParams: { ARC_LEFT: ['angle'] }
      store.setCurriculumActivity('test-turtle-partial-params');
      store.addBlock('MAIN', 'ARC_LEFT');
      const blockPartial = useAppStore.getState().workspace.MAIN[0];
      const blockPartialHtml = renderToStaticMarkup(
        React.createElement(BlockItem, {
          block: blockPartial,
          index: 0,
          scope: 'MAIN',
          isActive: false,
          isSelected: true,
        })
      );
      expect(blockPartialHtml).toContain(`data-testid="block-params-container-${blockPartial.id}"`);
      expect(blockPartialHtml).toContain('data-testid="block-param-badge-angle"');
      expect(blockPartialHtml).not.toContain('data-testid="block-param-badge-radius"');

      const subpalettePartialHtml = renderToStaticMarkup(React.createElement(BlockSubpalette));
      expect(subpalettePartialHtml).toContain('data-testid="subpalette-param-angle-90"');
      expect(subpalettePartialHtml).not.toContain('subpalette-param-radius-');
    });

    it('filters allowedScopes in UI and enforces allowedScopes in setActiveScope and addBlock', () => {
      registerTestActivity({
        id: 'test-scopes',
        moduleId: 'module-3',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '📞',
        title: 'Main and F1 Only',
        concept: 'Functions Intro',
        description: 'Only MAIN and F1 scopes are unlocked.',
        grid: {
          width: 4,
          height: 4,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: [],
          flags: [{ id: 'g1', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
        },
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['CALL_F1'],
          allowedScopes: ['MAIN', 'F1'],
        },
      });

      const store = useAppStore.getState();
      store.setFunctionBarOpen(true);
      store.setAppMode('curriculum');
      store.setCurriculumActivity('test-scopes');

      const paletteHtml = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteHtml).toContain('data-testid="btn-toggle-function-bar"');
      expect(paletteHtml).toContain('data-testid="palette-tab-main"');
      expect(paletteHtml).toContain('data-testid="palette-tab-f1"');
      expect(paletteHtml).not.toContain('data-testid="palette-tab-f2"');
      expect(paletteHtml).not.toContain('data-testid="palette-tab-f3"');

      const canvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(canvasHtml).toContain('data-testid="tab-main"');
      expect(canvasHtml).toContain('data-testid="tab-f1"');
      expect(canvasHtml).not.toContain('data-testid="tab-f2"');
      expect(canvasHtml).not.toContain('data-testid="tab-f3"');

      // Store enforces allowedScopes
      store.setActiveScope('F1');
      expect(useAppStore.getState().activeScope).toBe('F1');

      store.setActiveScope('F2');
      expect(useAppStore.getState().activeScope).toBe('F1');

      store.addBlock('F2', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.F2).toHaveLength(0);

      store.addBlock('F1', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.F1).toHaveLength(1);
    });

    it('resolves historical activity version before falling back to latest activity', () => {
      registerTestActivity({
        id: 'test-versioned',
        moduleId: 'module-1',
        version: 2,
        format: 'puzzle',
        simId: 'grid',
        icon: '🕰️',
        title: 'Versioned Activity',
        concept: 'Versioning',
        description: 'v2 allows turns; historical v1 allowed MOVE_FWD only with slotCap 3.',
        grid: {
          width: 4,
          height: 4,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: [],
          flags: [{ id: 'g1', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
        },
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
        },
        slotCap: { maxTotal: 5 },
        historicalVersions: {
          1: {
            version: 1,
            grid: {
              width: 4,
              height: 4,
              robot: { x: 0, y: 0, dir: 'EAST' },
              barriers: [],
              flags: [{ id: 'g1', x: 3, y: 0, isGoal: true, order: 1, collected: false }],
            },
            palette: {
              allowedSimBlocks: ['MOVE_FWD'],
            },
            slotCap: { maxTotal: 3 },
          },
        },
      });

      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('test-versioned', 1);

      expect(
        resolveActiveCurriculumActivity('curriculum', 'test-versioned', 1)?.version
      ).toBe(1);

      const paletteV1 = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(paletteV1).toContain('data-testid="palette-move-fwd"');
      expect(paletteV1).not.toContain('data-testid="palette-turn-left"');

      const canvasV1 = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(countMatches(canvasV1, /data-testid="workspace-empty-slot"/g)).toBe(3);
      expect(canvasV1).toContain('>0 / 3<');
    });
  });

  describe('Physical Block-Budget Slot Trays & slotCap Enforcement', () => {
    it('renders physical empty slots [□], updates visual pip counter, rejects overflow with shake + aria-live announcement, and preserves Undo stack', () => {
      const store = useAppStore.getState();
      // Activity 1.1 has slotCap: { maxTotal: 4 }
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.1');
      store.clearHistory();

      // 0 / 4 slots used -> 4 empty slots [□][□][□][□]
      const html0 = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(html0).toContain('data-slot-capped="true"');
      expect(html0).toContain('data-testid="workspace-slot-counter"');
      expect(html0).toContain('data-slot-full="false"');
      expect(html0).toContain('>0 / 4<');
      expect(countMatches(html0, /data-testid="workspace-empty-slot"/g)).toBe(4);
      expect(countMatches(html0, /data-slot-pip="filled"/g)).toBe(0);
      expect(countMatches(html0, /data-slot-pip="empty"/g)).toBe(4);

      // Place 3 blocks -> [■][■][■][□] (3 / 4)
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');

      const html3 = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(html3).toContain('>3 / 4<');
      expect(html3).toContain('data-slot-full="false"');
      expect(countMatches(html3, /data-testid="block-/g)).toBe(3);
      expect(countMatches(html3, /data-testid="workspace-empty-slot"/g)).toBe(1);
      expect(countMatches(html3, /data-slot-pip="filled"/g)).toBe(3);
      expect(countMatches(html3, /data-slot-pip="empty"/g)).toBe(1);

      // Place 4th block -> [■][■][■][■] (4 / 4, full)
      store.addBlock('MAIN', 'MOVE_FWD');
      const historyLengthAtCap = useAppStore.getState().past.length;
      expect(historyLengthAtCap).toBe(4);

      const html4 = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(html4).toContain('>4 / 4<');
      expect(html4).toContain('data-slot-full="true"');
      expect(html4).toContain('data-slot-rejected="false"');
      expect(countMatches(html4, /data-testid="block-/g)).toBe(4);
      expect(countMatches(html4, /data-testid="workspace-empty-slot"/g)).toBe(0);

      // Attempt 5th block -> REJECTED!
      store.addBlock('MAIN', 'MOVE_FWD');
      const rejectedState = useAppStore.getState();
      expect(rejectedState.workspace.MAIN).toHaveLength(4);
      expect(rejectedState.past).toHaveLength(historyLengthAtCap);
      expect(rejectedState.slotCapRejectionCount).toBe(1);
      expect(rejectedState.lastSlotCapRejectedAt).not.toBeNull();
      expect(rejectedState.statusAnnouncement).toBe(
        'Block tray full (4 of 4 slots used). Remove a block to add another.'
      );

      // WorkspaceCanvas renders gentle CSS shake + amber highlight
      const htmlRejected = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(htmlRejected).toContain('data-slot-rejected="true"');
      expect(htmlRejected).toContain('animate-slot-tray-shake');

      // Toolbar hosts the aria-live="polite" status announcer bound to statusAnnouncement
      const toolbarHtml = renderToStaticMarkup(React.createElement(Toolbar));
      expect(toolbarHtml).toContain('data-testid="mode-status-announcer"');
      expect(toolbarHtml).toContain('aria-live="polite"');

      // Repeating a rejected addBlock toggles announcement whitespace so screen readers re-announce
      const firstAnnouncement = rejectedState.statusAnnouncement;
      store.addBlock('MAIN', 'MOVE_FWD');
      const secondRejectedState = useAppStore.getState();
      expect(secondRejectedState.slotCapRejectionCount).toBe(2);
      expect(secondRejectedState.statusAnnouncement.trim()).toBe(firstAnnouncement.trim());
      expect(secondRejectedState.statusAnnouncement).not.toBe(firstAnnouncement);

      // Reordering existing blocks while tray is full still works cleanly
      const firstBlockIdBeforeReorder = secondRejectedState.workspace.MAIN[0].id;
      store.reorderBlocks('MAIN', 0, 3);
      expect(useAppStore.getState().workspace.MAIN[3].id).toBe(firstBlockIdBeforeReorder);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(4);

      // Removing 1 block clears rejection highlight and restores 1 physical empty slot
      const blockToRemove = useAppStore.getState().workspace.MAIN[0].id;
      store.removeBlock('MAIN', blockToRemove);
      expect(useAppStore.getState().lastSlotCapRejectedAt).toBeNull();
      const htmlAfterRemove = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(htmlAfterRemove).toContain('>3 / 4<');
      expect(htmlAfterRemove).toContain('data-slot-rejected="false"');
      expect(countMatches(htmlAfterRemove, /data-testid="workspace-empty-slot"/g)).toBe(1);
    });

    it('enforces perScope caps alongside maxTotal across MAIN and F1 scopes', () => {
      registerTestActivity({
        id: 'test-perscope-cap',
        moduleId: 'module-3',
        version: 1,
        format: 'puzzle',
        simId: 'grid',
        icon: '🧩',
        title: 'Per-Scope & Total Budget',
        concept: 'Functions with Slot Caps',
        description: 'MAIN max 2, F1 max 3, global maxTotal 4.',
        grid: {
          width: 5,
          height: 5,
          robot: { x: 0, y: 0, dir: 'EAST' },
          barriers: [],
          flags: [{ id: 'g1', x: 4, y: 0, isGoal: true, order: 1, collected: false }],
        },
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_RIGHT'],
          allowedControlBlocks: ['CALL_F1'],
          allowedScopes: ['MAIN', 'F1'],
        },
        slotCap: {
          maxTotal: 4,
          perScope: {
            MAIN: 2,
            F1: 3,
          },
        },
      });

      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('test-perscope-cap');

      // MAIN starts with 0 / 2 (2 empty slots)
      const mainEmptyHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(mainEmptyHtml).toContain('>0 / 2<');
      expect(countMatches(mainEmptyHtml, /data-testid="workspace-empty-slot"/g)).toBe(2);

      // Fill MAIN to 2 / 2
      store.addBlock('MAIN', 'CALL_F1');
      store.addBlock('MAIN', 'CALL_F1');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

      // 3rd block in MAIN is rejected by perScope.MAIN === 2 (even though maxTotal is 4)
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
      expect(useAppStore.getState().statusAnnouncement).toContain(
        'Block tray full in Main (2 of 2 slots used)'
      );

      // Switch to F1: perScope.F1 is 3, but global remaining is 4 - 2 = 2!
      store.setActiveScope('F1');
      const f1InitialHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(f1InitialHtml).toContain('>0 / 2<');
      expect(countMatches(f1InitialHtml, /data-testid="workspace-empty-slot"/g)).toBe(2);

      // Place 2 blocks in F1 -> hits global maxTotal: 4
      store.addBlock('F1', 'MOVE_FWD');
      store.addBlock('F1', 'TURN_RIGHT');
      expect(useAppStore.getState().workspace.F1).toHaveLength(2);

      // 3rd block in F1 is rejected because global maxTotal (4) is reached
      store.addBlock('F1', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.F1).toHaveLength(2);
      expect(useAppStore.getState().statusAnnouncement).toContain(
        'Block tray full (4 of 4 slots used)'
      );
    });

    it('lifts slotCap restrictions cleanly when cloning activity via Open Copy in Sandbox', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.1'); // maxTotal: 4

      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD'); // rejected
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(4);
      expect(useAppStore.getState().slotCapRejectionCount).toBe(1);

      store.openCopyInSandbox();
      expect(useAppStore.getState().appMode).toBe('sandbox');
      expect(useAppStore.getState().slotCapRejectionCount).toBe(0);

      // Now unrestricted in Sandbox: 5th block succeeds and slot counter disappears
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(5);
      const sandboxCanvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(sandboxCanvasHtml).toContain('data-slot-capped="false"');
      expect(sandboxCanvasHtml).not.toContain('data-testid="workspace-slot-counter"');
    });

    it('exposes clean keyboard focusability and ARIA labels on placed blocks and empty slots', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('1.2'); // maxTotal: 6
      store.addBlock('MAIN', 'MOVE_FWD');

      const canvasHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(canvasHtml).toContain('tabindex="0"');
      expect(canvasHtml).toContain('aria-label="Move Forward, slot 1"');
      expect(canvasHtml).toContain('aria-label="Empty block slot 2 of 6"');
      expect(canvasHtml).toContain('aria-label="Block slots: 1 of 6 used"');
    });

    it('computes pure helper edge cases accurately in curriculumStagePolicy', () => {
      const ws = { MAIN: [], F1: [], F2: [], F3: [] };
      expect(computeSlotBudget(ws, 'MAIN', 'curriculum', {}).isCapped).toBe(false);
      expect(computeSlotBudget(ws, 'MAIN', 'sandbox', { maxTotal: 3 }).isCapped).toBe(false);
      expect(getAllowedParamDefs('FORWARD', undefined, 'curriculum')).toEqual([]);
      expect(computeStagedPalettePolicy('curriculum', undefined, []).isCurriculum).toBe(false);
    });
  });
});
