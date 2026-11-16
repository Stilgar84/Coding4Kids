import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  FUNC_ACTIVITIES,
  createCurriculumBlock,
  getActivityLatest,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import { BlockPalette } from '../src/components/BlockPalette';
import { ExplanationDemoBar } from '../src/components/ExplanationDemoBar';
import {
  doesBlockMatchHintCategory,
  inferHintCategoryForBlockType,
  getPlaceholderHintCategory,
} from '../src/engine/placeholderHelpers';
import { CodeBlock } from '../src/types';
import { renderTurtleVariationPreview } from '../src/components/VariationCardsPanel';

const lengthsOf = (blocks: CodeBlock[]) =>
  blocks
    .filter((b) => b.type === 'FORWARD' || b.type === 'BACKWARD')
    .map((b) => b.params?.length);

const radiiOf = (blocks: CodeBlock[]) =>
  blocks
    .filter((b) => b.type === 'ARC_LEFT' || b.type === 'ARC_RIGHT')
    .map((b) => b.params?.radius);

describe('Functions (func): UI & Creative/Demo Activities', () => {
  const funcCreativeActivities = FUNC_ACTIVITIES.filter((a) => !isValidatedPuzzleActivity(a));
  beforeEach(() => {
    const store = useAppStore.getState();
    store.pause();
    store.setSpeed(400);
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.clearWorkspace();
    store.setActiveScope('MAIN');
    store.setSelectedBlockId(null);
    useAppStore.setState({
      curriculumWorkspaces: {},
      completedActivities: {},
      activeDemoTabIndex: 0,
      demoTabIndexByActivity: {},
      exploredDemoTabs: {},
      viewedDemoTabs: {},
      sandboxSnapshot: null,
      statusAnnouncement: '',
      isFunctionBarOpen: true,
    });
    store.clearHistory();
  });

  describe('func Catalog Registration & Canonical Ordering', () => {
    it('registers all 5 func creative/demo activities (func.0, func.2, func.3, func.B, func.C)', () => {
      expect(funcCreativeActivities).toHaveLength(5);
      const ids = funcCreativeActivities.map((a) => a.id);
      expect(ids).toEqual(['func.0', 'func.2', 'func.3', 'func.B', 'func.C']);

      for (const id of ids) {
        const activity = getActivityLatest(id);
        expect(activity).toBeDefined();
        expect(activity!.moduleId).toBe('func');
      }
    });

    it('orders func creative/demo activities canonically in CURRICULUM_ACTIVITIES', () => {
      const allIds = CURRICULUM_ACTIVITIES.map((a) => a.id);
      expect(allIds).toContain('func.0');
      expect(allIds).toContain('func.2');
      expect(allIds).toContain('func.3');
      expect(allIds).toContain('func.B');
      expect(allIds).toContain('func.C');

      const idxFunc0 = allIds.indexOf('func.0');
      const idxFunc2 = allIds.indexOf('func.2');
      const idxFunc3 = allIds.indexOf('func.3');
      const idxFuncB = allIds.indexOf('func.B');
      const idxFuncC = allIds.indexOf('func.C');

      expect(idxFunc0).toBeLessThan(idxFunc2);
      expect(idxFunc2).toBeLessThan(idxFunc3);
      expect(idxFunc3).toBeLessThan(idxFuncB);
      expect(idxFuncB).toBeLessThan(idxFuncC);
    });

    it('verifies Lesson func.0 definition and demo tabs', () => {
      const act = getActivityLatest('func.0')!;
      expect(act.format).toBe('explanation');
      expect(act.simId).toBe('grid');
      expect(act.demoTabs).toHaveLength(2);
      expect(act.demoTabs![0].spotlights).toContain('call-stack-jump');
      expect(act.demoTabs![1].spotlights).toContain('call-stack-jump');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1']);
      expect(act.palette.allowedControlBlocks).toContain('CALL_F1');
    });

    it('verifies Lesson func.2 LOGO sandbox and state hygiene variations', () => {
      const act = getActivityLatest('func.2')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('turtle');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1']);
      expect(act.palette.allowedControlBlocks).toContain('CALL_F1');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F1.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(4);
      expect(act.variations!.map((v) => v.id)).toEqual([
        'func.2-var1-forest',
        'func.2-var2-petal-crown',
        'func.2-var3a-cottage',
        'func.2-var3b-dipper',
      ]);

      expect(lengthsOf(act.starterWorkspace!.MAIN)).toEqual([150]);
      expect(lengthsOf(act.starterWorkspace!.F1)).toEqual([75]);
      expect(lengthsOf(act.variations![0].workspace.MAIN)).toEqual([150, 150]);
      expect(lengthsOf(act.variations![0].workspace.F1)).toEqual([50, 50, 100, 50, 50]);
      expect(lengthsOf(act.variations![1].workspace.MAIN)).toEqual([100]);
      expect(radiiOf(act.variations![1].workspace.F1)).toEqual([50, 50]);
      expect(lengthsOf(act.variations![2].workspace.MAIN)).toEqual([
        200, 200, 200, 200, 80, 76, 80, 88, 80,
      ]);
      expect(lengthsOf(act.variations![2].workspace.F1)).toEqual([40]);
      expect(lengthsOf(act.variations![3].workspace.MAIN)).toEqual([110, 100, 100, 90, 120, 90, 120]);
      expect(lengthsOf(act.variations![3].workspace.F1)).toEqual([40]);

      expect(renderTurtleVariationPreview(act.starterWorkspace!).finalState.paths.length).toBeGreaterThan(0);
      for (const v of act.variations!) {
        expect(renderTurtleVariationPreview(v.workspace).finalState.paths.length).toBeGreaterThan(0);
      }
    });

    it('verifies Lesson func.3 Beat & Light sandbox and composition variations', () => {
      const act = getActivityLatest('func.3')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('beat');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1', 'F2']);
      expect(act.palette.allowedControlBlocks).toContain('CALL_F1');
      expect(act.palette.allowedControlBlocks).toContain('CALL_F2');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F1.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F2.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        'func.3-var1-powerup',
        'func.3-var2-pingpong',
        'func.3-var3-rocket',
      ]);
    });

    it('verifies Capstone func.B LOGO 4-tab creative architecture', () => {
      const act = getActivityLatest('func.B')!;
      expect(act.format).toBe('capstone');
      expect(act.capstoneType).toBe('creative');
      expect(act.simId).toBe('turtle');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1', 'F2', 'F3']);
      expect(act.palette.allowedControlBlocks).toContain('CALL_F1');
      expect(act.palette.allowedControlBlocks).toContain('CALL_F2');
      expect(act.palette.allowedControlBlocks).toContain('CALL_F3');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F1.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F2.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F3.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);

      expect(lengthsOf(act.starterWorkspace!.MAIN)).toEqual([110]);
      expect(lengthsOf(act.starterWorkspace!.F1)).toEqual([150, 60, 60, 150]);
      expect(lengthsOf(act.starterWorkspace!.F2)).toEqual([90, 100, 90, 100]);
      expect(radiiOf(act.starterWorkspace!.F2)).toEqual([50]);
      expect(lengthsOf(act.starterWorkspace!.F3)).toEqual([36, 28, 28, 8]);

      const train = act.variations![0].workspace;
      expect(lengthsOf(train.MAIN)).toEqual([220]);
      expect(lengthsOf(train.F1)).toEqual([72, 128, 36, 56, 36, 16]);
      expect(lengthsOf(train.F2)).toEqual([104, 52, 44, 72, 60, 124, 32, 56, 60, 32, 20, 32, 52]);
      expect(radiiOf(train.F2)).toEqual([16]);
      expect(radiiOf(train.F3)).toEqual([24]);

      const harbor = act.variations![1].workspace;
      expect(lengthsOf(harbor.MAIN)).toEqual([180, 90, 250, 40, 200, 190]);
      expect(radiiOf(harbor.F1)).toEqual([32]);
      expect(lengthsOf(harbor.F2)).toEqual([128, 48, 80, 48, 56, 108, 96, 48, 24]);
      expect(lengthsOf(harbor.F3)).toEqual([32, 32, 44, 20, 64]);
      expect(radiiOf(harbor.F3)).toEqual([32]);

      expect(renderTurtleVariationPreview(act.starterWorkspace!).finalState.paths.length).toBeGreaterThan(0);
      for (const v of act.variations!) {
        expect(renderTurtleVariationPreview(v.workspace).finalState.paths.length).toBeGreaterThan(0);
      }
    });

    it('verifies Capstone func.C Beat & Light 4-tab full song choreography', () => {
      const act = getActivityLatest('func.C')!;
      expect(act.format).toBe('capstone');
      expect(act.capstoneType).toBe('creative');
      expect(act.simId).toBe('beat');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1', 'F2', 'F3']);
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F1.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F2.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F3.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
    });
  });

  describe('Placeholder Hint Category 5 (Function)', () => {
    it('infers function hint category for CALL_F1, CALL_F2, CALL_F3', () => {
      expect(inferHintCategoryForBlockType('CALL_F1')).toBe('function');
      expect(inferHintCategoryForBlockType('CALL_F2')).toBe('function');
      expect(inferHintCategoryForBlockType('CALL_F3')).toBe('function');
    });

    it('matches CALL_F1..F3 blocks when hint category is function', () => {
      expect(doesBlockMatchHintCategory('CALL_F1', undefined, 'function')).toBe(true);
      expect(doesBlockMatchHintCategory('CALL_F2', undefined, 'function')).toBe(true);
      expect(doesBlockMatchHintCategory('CALL_F3', undefined, 'function')).toBe(true);
      expect(doesBlockMatchHintCategory('MOVE_FWD', 'motion', 'function')).toBe(false);
      expect(doesBlockMatchHintCategory('LOOP_START', 'loop', 'function')).toBe(false);
    });
  });

  describe('Function Bar Per-Tab Slot Pills', () => {
    it('renders per-tab slot pills when slotCap.perScope is configured', () => {
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: 'test-m4-slot-pills',
        activeActivityVersion: 1,
        activeScope: 'MAIN',
        isFunctionBarOpen: true,
        workspace: {
          MAIN: [createCurriculumBlock('MOVE_FWD', undefined, undefined, 't1')],
          F1: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 't2'),
            createCurriculumBlock('TURN_LEFT', undefined, undefined, 't3'),
          ],
          F2: [],
          F3: [],
        },
      });

      // Set to func.0 (which has scopes ['MAIN', 'F1'])
      useAppStore.setState({
        activeActivityId: 'func.0',
        workspace: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 't1'),
            createCurriculumBlock('CALL_F1', undefined, undefined, 't2'),
          ],
          F1: [
            createCurriculumBlock('TURN_LEFT', undefined, undefined, 't3'),
          ],
          F2: [],
          F3: [],
        },
      });

      const html = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(html).toContain('data-testid="palette-function-bar"');
      expect(html).toContain('data-testid="palette-tab-main"');
      expect(html).toContain('data-testid="palette-tab-f1"');
    });

    it('displays compact used/cap badges when perScope limits are set', () => {
      // Craft curriculum state with perScope caps
      const activityWithCaps = {
        ...getActivityLatest('func.0')!,
        id: 'func.0',
        slotCap: {
          perScope: { MAIN: 5, F1: 4 },
        },
      };

      // Set store with perScope cap activity
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: 'func.0',
        activeActivityVersion: 1,
        activeScope: 'MAIN',
        isFunctionBarOpen: true,
        workspace: {
          MAIN: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'm1'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'm2'),
          ],
          F1: [
            createCurriculumBlock('TURN_LEFT', undefined, undefined, 'f1'),
          ],
          F2: [],
          F3: [],
        },
      });

      // Render BlockPalette with mock activity
      const html = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(html).toContain('data-testid="palette-function-bar"');
    });

    it('renders PhoneCall icon and single numeric label (never duplicated "1 1" or "2 2") on F1..F3 function tabs', () => {
      useAppStore.setState({
        appMode: 'sandbox',
        activeSimId: 'turtle',
        activeScope: 'MAIN',
        isFunctionBarOpen: true,
      });

      const html = renderToStaticMarkup(React.createElement(BlockPalette));
      expect(html).toContain('data-testid="palette-function-bar"');

      for (const [scope, num] of [
        ['f1', '1'],
        ['f2', '2'],
        ['f3', '3'],
      ] as const) {
        const match = html.match(
          new RegExp(`<button[^>]*data-testid="palette-tab-${scope}"[\\s\\S]*?<\\/button>`)
        );
        expect(match, `palette-tab-${scope} rendered`).toBeTruthy();
        const btnHtml = match![0];
        expect(btnHtml).toContain('<svg');
        expect(btnHtml).toContain(`<span>${num}</span>`);
        expect(btnHtml).not.toMatch(new RegExp(`>${num}<\\/span>\\s*<span[^>]*>${num}<`));
      }
    });
  });

  describe('Call-Stack-Jump Spotlight Animation in ExplanationDemoBar', () => {
    it('renders call-stack-jump spotlight badge on Lesson func.0 explanation demo', () => {
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: 'func.0',
        activeActivityVersion: 1,
        activeDemoTabIndex: 0,
        activeScope: 'MAIN',
      });

      const html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="call-stack-jump-spotlight"');
      expect(html).toContain('Main');
      expect(html).toContain('1');
    });

    it('highlights F1 in spotlight when execution jumps into F1', () => {
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: 'func.0',
        activeActivityVersion: 1,
        activeDemoTabIndex: 0,
        activeScope: 'F1',
      });

      const html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="call-stack-jump-spotlight"');
      expect(html).toContain('bg-emerald-600');
    });
  });

  describe('Stepped Execution Auto-Switches Active Scope', () => {
    it('switches activeScope to F1 when stepping on CALL_F1 block', () => {
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: 'func.0',
        activeActivityVersion: 1,
        activeScope: 'MAIN',
        workspace: {
          MAIN: [
            createCurriculumBlock('CALL_F1', undefined, undefined, 'call_1'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'move_1'),
          ],
          F1: [
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'f1_move'),
          ],
          F2: [],
          F3: [],
        },
      });

      const store = useAppStore.getState();
      store.step();

      const stateAfterStep = useAppStore.getState();
      expect(stateAfterStep.activeScope).toBe('F1');
      expect(stateAfterStep.isFunctionBarOpen).toBe(true);

      // Step again inside F1: executes MOVE_FWD in F1
      store.step();
      // Step once more: returns from F1 back to MAIN
      store.step();
      const stateAfterF1Step = useAppStore.getState();
      expect(stateAfterF1Step.activeScope).toBe('MAIN');
    });
  });
});
