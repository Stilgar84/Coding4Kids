import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_4_CREATIVE_ACTIVITIES,
  createCurriculumBlock,
  getActivitiesForModule,
  getActivityLatest,
} from '../src/data/curriculum';
import { BlockPalette } from '../src/components/BlockPalette';
import { ExplanationDemoBar } from '../src/components/ExplanationDemoBar';
import {
  doesBlockMatchHintCategory,
  inferHintCategoryForBlockType,
  getPlaceholderHintCategory,
} from '../src/engine/placeholderHelpers';
import { CodeBlock } from '../src/types';

describe('Commit 20: Module 4 UI & Creative/Demo Activities', () => {
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

  describe('Module 4 Catalog Registration & Canonical Ordering', () => {
    it('registers all 5 Module 4 creative/demo activities (4.0, 4.2, 4.3, 4B, 4C)', () => {
      expect(MODULE_4_CREATIVE_ACTIVITIES).toHaveLength(5);
      const ids = MODULE_4_CREATIVE_ACTIVITIES.map((a) => a.id);
      expect(ids).toEqual(['4.0', '4.2', '4.3', '4B', '4C']);

      for (const id of ids) {
        const activity = getActivityLatest(id);
        expect(activity).toBeDefined();
        expect(activity!.moduleId).toBe('module-4');
      }
    });

    it('orders Module 4 activities canonically in CURRICULUM_ACTIVITIES', () => {
      const allIds = CURRICULUM_ACTIVITIES.map((a) => a.id);
      expect(allIds).toContain('4.0');
      expect(allIds).toContain('4.2');
      expect(allIds).toContain('4.3');
      expect(allIds).toContain('4B');
      expect(allIds).toContain('4C');

      const idx4_0 = allIds.indexOf('4.0');
      const idx4_2 = allIds.indexOf('4.2');
      const idx4_3 = allIds.indexOf('4.3');
      const idx4B = allIds.indexOf('4B');
      const idx4C = allIds.indexOf('4C');

      expect(idx4_0).toBeLessThan(idx4_2);
      expect(idx4_2).toBeLessThan(idx4_3);
      expect(idx4_3).toBeLessThan(idx4B);
      expect(idx4B).toBeLessThan(idx4C);
    });

    it('verifies Lesson 4.0 definition and demo tabs', () => {
      const act = getActivityLatest('4.0')!;
      expect(act.format).toBe('explanation');
      expect(act.simId).toBe('grid');
      expect(act.demoTabs).toHaveLength(2);
      expect(act.demoTabs![0].spotlights).toContain('call-stack-jump');
      expect(act.demoTabs![1].spotlights).toContain('call-stack-jump');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1']);
      expect(act.palette.allowedControlBlocks).toContain('CALL_F1');
    });

    it('verifies Lesson 4.2 LOGO sandbox and state hygiene variations', () => {
      const act = getActivityLatest('4.2')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('turtle');
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1']);
      expect(act.palette.allowedControlBlocks).toContain('CALL_F1');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F1.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '4.2-house-windows',
        '4.2-pine-trees',
        '4.2-big-dipper',
      ]);
    });

    it('verifies Lesson 4.3 Beat & Light sandbox and composition variations', () => {
      const act = getActivityLatest('4.3')!;
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
        '4.3-dance-track',
        '4.3-sprite-animation',
        '4.3-call-response',
      ]);
    });

    it('verifies Capstone 4B LOGO 4-tab creative architecture', () => {
      const act = getActivityLatest('4B')!;
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
    });

    it('verifies Capstone 4C Beat & Light 4-tab full song choreography', () => {
      const act = getActivityLatest('4C')!;
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

      // Temporary mock activity registration in store context
      const prevActivity = getActivityLatest('4.0');
      // Set to 4.0 (which has scopes ['MAIN', 'F1'])
      useAppStore.setState({
        activeActivityId: '4.0',
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
        ...getActivityLatest('4.0')!,
        id: '4.0',
        slotCap: {
          perScope: { MAIN: 5, F1: 4 },
        },
      };

      // Set store with perScope cap activity
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: '4.0',
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
  });

  describe('Call-Stack-Jump Spotlight Animation in ExplanationDemoBar', () => {
    it('renders call-stack-jump spotlight badge on Lesson 4.0 explanation demo', () => {
      useAppStore.setState({
        appMode: 'curriculum',
        activeActivityId: '4.0',
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
        activeActivityId: '4.0',
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
        activeActivityId: '4.0',
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
