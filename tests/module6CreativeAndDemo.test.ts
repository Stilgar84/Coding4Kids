import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_6_CREATIVE_ACTIVITIES,
  getCurriculumModule,
  getActivityLatest,
} from '../src/data/curriculum';
import {
  renderTurtleVariationPreview,
  renderBeatVariationPreview,
} from '../src/components/VariationCardsPanel';
import {
  DialReadSpotlight,
  PoseBookmarkSpotlight,
  VariableAndDialSpotlight,
  VariableWatchSpotlight,
} from '../src/components/VariableAndDialSpotlight';
import { ExplanationDemoBar } from '../src/components/ExplanationDemoBar';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';
import { TurtleState } from '../src/simulations/turtle/types';
import { createCurriculumGridState } from '../src/data/curriculum/types';

describe('Commit 28: Module 6 Spotlights & Demo/Creative/Animation Activities', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.pause();
    store.setSpeed(400);
    store.setAppMode('sandbox');
    store.setSimEnvironment('turtle');
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
      isLoopPlayback: false,
    });
    store.clearHistory();
  });

  describe('Module 6 Catalog Registration & Canonical Ordering', () => {
    it('registers all 10 Module 6 creative/demo activities (6.0, 6.1, 6.3, 6.5, 6.5a, 6.5b, 6.5c, 6.6, 6.6a, 6B)', () => {
      expect(MODULE_6_CREATIVE_ACTIVITIES).toHaveLength(10);
      const expectedIds = [
        '6.0',
        '6.1',
        '6.3',
        '6.5',
        '6.5a',
        '6.5b',
        '6.5c',
        '6.6',
        '6.6a',
        '6B',
      ];
      const actualIds = MODULE_6_CREATIVE_ACTIVITIES.map((a) => a.id);
      expect(actualIds).toEqual(expectedIds);

      for (const id of expectedIds) {
        const activity = getActivityLatest(id);
        expect(activity).toBeDefined();
        expect(activity!.moduleId).toBe('module-6');
        expect(activity!.concept).toBeDefined();
        expect(activity!.concept.length).toBeGreaterThan(10);
      }
    });

    it('orders Module 6 activities canonically in CURRICULUM_ACTIVITIES', () => {
      const allIds = CURRICULUM_ACTIVITIES.map((a) => a.id);
      const m6Ids = [
        '6.0',
        '6.1',
        '6.3',
        '6.5',
        '6.5a',
        '6.5b',
        '6.5c',
        '6.6',
        '6.6a',
        '6B',
      ];

      for (const id of m6Ids) {
        expect(allIds).toContain(id);
      }

      for (let i = 0; i < m6Ids.length - 1; i++) {
        const currentIdx = allIds.indexOf(m6Ids[i]);
        const nextIdx = allIds.indexOf(m6Ids[i + 1]);
        expect(currentIdx).toBeLessThan(nextIdx);
      }
    });

    it('verifies module-6 metadata in CURRICULUM_MODULES', () => {
      const mod6 = getCurriculumModule('module-6');
      expect(mod6).toBeDefined();
      expect(mod6!.title).toBe('Variables, Pose Sensors & Stepping Counters');
      expect(mod6!.icon).toBe('📦');
      expect(mod6!.capstoneIds).toContain('6B');
    });
  });

  describe('Activity Definitions, Formats & Demo Tabs', () => {
    it('verifies Lesson 6.0 [📖 🐢/🤖 Demo] with cross-env tabs (Turtle and Robot Grid)', () => {
      const act = getActivityLatest('6.0')!;
      expect(act.format).toBe('explanation');
      expect(act.demoTabs).toHaveLength(2);

      const tab1 = act.demoTabs![0];
      expect(tab1.simId).toBe('turtle');
      expect(tab1.spotlights).toContain('variable-watch');
      expect(tab1.workspace.MAIN.some((b) => b.type === 'VAR_ASSIGN')).toBe(true);

      const tab2 = act.demoTabs![1];
      expect(tab2.simId).toBe('grid');
      expect(tab2.spotlights).toContain('dial-read');
      expect(tab2.gridState?.dialTiles).toHaveLength(1);
      expect(tab2.gridState?.dialTiles?.[0].value).toBe(3);
    });

    it('verifies Lesson 6.1 [🐢 Sandbox] variables as single-point constants with 3 variations', () => {
      const act = getActivityLatest('6.1')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('turtle');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6.1-tiny-giant-house',
        '6.1-scalable-robot-head',
        '6.1-twin-offset-shapes',
      ]);
    });

    it('verifies Lesson 6.3 [📖 🤖 Demo] stepped variable updating (a = a + 1)', () => {
      const act = getActivityLatest('6.3')!;
      expect(act.format).toBe('explanation');
      expect(act.simId).toBe('grid');
      expect(act.demoTabs).toHaveLength(2);
      expect(act.demoTabs![0].spotlights).toContain('variable-watch');
      expect(act.demoTabs![1].spotlights).toContain('variable-watch');
      expect(act.demoTabs![0].workspace.MAIN.some((b) => b.type === 'VAR_OP')).toBe(true);
    });

    it('verifies Lesson 6.5 [🐢 Sandbox] growing and shrinking loops with 3 variations', () => {
      const act = getActivityLatest('6.5')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('turtle');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6.5-skewed-star-spiral',
        '6.5-growing-arc-seashell',
        '6.5-shrinking-tunnel',
      ]);
    });

    it('verifies Lesson 6.5a [📖 🐢 Demo] TELEPORT and pose sensors ($x, $y, $heading)', () => {
      const act = getActivityLatest('6.5a')!;
      expect(act.format).toBe('explanation');
      expect(act.simId).toBe('turtle');
      expect(act.demoTabs).toHaveLength(2);

      const tab1 = act.demoTabs![0];
      expect(tab1.spotlights).toContain('pose-bookmark');
      expect(tab1.workspace.MAIN.some((b) => b.type === 'TELEPORT')).toBe(true);

      const tab2 = act.demoTabs![1];
      expect(tab2.spotlights).toContain('pose-bookmark');
      expect(tab2.workspace.MAIN.some((b) => b.params?.b === '$x')).toBe(true);
      expect(tab2.workspace.MAIN.some((b) => b.params?.b === '$y')).toBe(true);
    });

    it('verifies Lesson 6.5b [🐢 Sandbox] Breathing Star with loop playback and 3 variations', () => {
      const act = getActivityLatest('6.5b')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('turtle');
      expect(act.defaultLoopPlayback).toBe(true);
      expect(act.palette.allowedScopes).toEqual(['MAIN', 'F1', 'F2', 'F3']);
      expect(act.starterWorkspace?.MAIN.length).toBe(4);
      expect(act.starterWorkspace?.F1.length).toBe(6);
      expect(act.starterWorkspace?.F2.length).toBe(6);
      expect(act.starterWorkspace?.F3.length).toBe(4);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6.5b-breathing-hexagon',
        '6.5b-heartbeat-pulse',
        '6.5b-sunburst-rays',
      ]);
    });

    it('verifies Lesson 6.5c [🐢 Sandbox] Spiral Builder paced drawing with 3 variations', () => {
      const act = getActivityLatest('6.5c')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('turtle');
      expect(act.defaultLoopPlayback).toBe(true);
      expect(act.starterWorkspace?.MAIN.length).toBe(8);
      expect(act.starterWorkspace?.MAIN.some((b) => b.type === 'SET_INSTANT' && b.params?.mode === 'OFF')).toBe(true);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6.5c-skewed-vortex',
        '6.5c-nautilus-shell',
        '6.5c-unwind-white-eraser',
      ]);
    });

    it('verifies Lesson 6.6 [🎵 Sandbox] sweeping coordinates with 3 variations', () => {
      const act = getActivityLatest('6.6')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('beat');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6.6-laser-sweep',
        '6.6-equalizer-bars',
        '6.6-siren-scale',
      ]);
    });

    it('verifies Lesson 6.6a [🎵 Sandbox] Scanner Bar with loop playback and 4 playable variations', () => {
      const act = getActivityLatest('6.6a')!;
      expect(act.format).toBe('sandbox');
      expect(act.simId).toBe('beat');
      expect(act.defaultLoopPlayback).toBe(true);
      expect(act.starterWorkspace?.MAIN.length).toBe(6);
      expect(act.starterWorkspace?.F1.length).toBe(6);
      expect(act.starterWorkspace?.F2.length).toBe(6);
      expect(act.variations).toHaveLength(4);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6.6a-color-wipe',
        '6.6a-curtain-reveal',
        '6.6a-diagonal-pixel',
        '6.6a-black-eraser-wipe',
      ]);
    });

    it('verifies Capstone 6B [🎨 🐢 Capstone] Spiral & Wave Studio with 3 variations', () => {
      const act = getActivityLatest('6B')!;
      expect(act.format).toBe('capstone');
      expect(act.capstoneType).toBe('creative');
      expect(act.simId).toBe('turtle');
      expect(act.starterWorkspace?.MAIN.length).toBeGreaterThan(0);
      expect(act.starterWorkspace?.F1.length).toBeGreaterThan(0);
      expect(act.variations).toHaveLength(3);
      expect(act.variations!.map((v) => v.id)).toEqual([
        '6B-double-scroll',
        '6B-shell-horn',
        '6B-pyramid-steps',
      ]);
    });
  });

  describe('Loop Hygiene Verification (CLEAR at Frame Start, Never End)', () => {
    it('verifies 6.5b starter and all variations place CLEAR_CANVAS at start of frame loop', () => {
      const act = getActivityLatest('6.5b')!;
      const checkClearHygiene = (ws: typeof act.starterWorkspace) => {
        // F1 loop: first child after LOOP_START must be CLEAR_CANVAS
        const f1Blocks = ws!.F1;
        const f1LoopStartIdx = f1Blocks.findIndex((b) => b.type === 'LOOP_START');
        expect(f1LoopStartIdx).toBeGreaterThanOrEqual(0);
        expect(f1Blocks[f1LoopStartIdx + 1].type).toBe('CLEAR_CANVAS');
        expect(f1Blocks[f1Blocks.length - 1].type).not.toBe('CLEAR_CANVAS');

        // F2 loop: first child after LOOP_START must be CLEAR_CANVAS
        const f2Blocks = ws!.F2;
        const f2LoopStartIdx = f2Blocks.findIndex((b) => b.type === 'LOOP_START');
        expect(f2LoopStartIdx).toBeGreaterThanOrEqual(0);
        expect(f2Blocks[f2LoopStartIdx + 1].type).toBe('CLEAR_CANVAS');
        expect(f2Blocks[f2Blocks.length - 1].type).not.toBe('CLEAR_CANVAS');
      };

      checkClearHygiene(act.starterWorkspace);
      for (const v of act.variations!) {
        checkClearHygiene(v.workspace);
      }
    });

    it('verifies 6.6a starter places CLEAR_LEDS at start of frame loop', () => {
      const act = getActivityLatest('6.6a')!;
      const starter = act.starterWorkspace!;

      // F1: CLEAR_LEDS must follow LOOP_START
      const f1LoopIdx = starter.F1.findIndex((b) => b.type === 'LOOP_START');
      expect(f1LoopIdx).toBeGreaterThanOrEqual(0);
      expect(starter.F1[f1LoopIdx + 1].type).toBe('CLEAR_LEDS');
      expect(starter.F1[starter.F1.length - 1].type).not.toBe('CLEAR_LEDS');

      // F2: CLEAR_LEDS must follow LOOP_START
      const f2LoopIdx = starter.F2.findIndex((b) => b.type === 'LOOP_START');
      expect(f2LoopIdx).toBeGreaterThanOrEqual(0);
      expect(starter.F2[f2LoopIdx + 1].type).toBe('CLEAR_LEDS');
      expect(starter.F2[starter.F2.length - 1].type).not.toBe('CLEAR_LEDS');
    });
  });

  describe('Non-Blank SVG Thumbnails on all LOGO Starters and Variation Cards', () => {
    it.each(['6.1', '6.5', '6.5b', '6.5c', '6B'])(
      'renders non-blank SVG thumbnail for %s starter and all variations',
      (activityId) => {
        const act = getActivityLatest(activityId)!;
        expect(act.simId).toBe('turtle');

        // Starter preview
        const starterPreview = renderTurtleVariationPreview(act.starterWorkspace!);
        expect(starterPreview.finalState.paths.length).toBeGreaterThan(0);
        expect(starterPreview.svgMarkup).toContain('<svg');
        expect(
          starterPreview.svgMarkup.includes('<line') ||
            starterPreview.svgMarkup.includes('<path')
        ).toBe(true);

        // Variations previews
        expect(act.variations!.length).toBeGreaterThanOrEqual(3);
        for (const card of act.variations!) {
          const cardPreview = renderTurtleVariationPreview(card.workspace);
          expect(
            cardPreview.finalState.paths.length,
            `Variation ${card.id} must have drawn paths at end`
          ).toBeGreaterThan(0);
          expect(cardPreview.svgMarkup).toContain('<svg');
          expect(
            cardPreview.svgMarkup.includes('<line') ||
              cardPreview.svgMarkup.includes('<path'),
            `Variation ${card.id} SVG markup must contain drawn line or path`
          ).toBe(true);
        }
      }
    );

    it.each(['6.6', '6.6a'])(
      'renders non-blank Beat variation previews for %s starter and variations',
      (activityId) => {
        const act = getActivityLatest(activityId)!;
        expect(act.simId).toBe('beat');

        const starterPreview = renderBeatVariationPreview(act.starterWorkspace!);
        expect(starterPreview.frames.length).toBeGreaterThan(0);

        for (const card of act.variations!) {
          const cardPreview = renderBeatVariationPreview(card.workspace);
          expect(cardPreview.frames.length).toBeGreaterThan(0);
        }
      }
    );
  });

  describe('Simulation Behavior: TELEPORT and Pose Sensors ($x, $y, $heading)', () => {
    it('executes 6.5a Tab 1 TELEPORT without connecting lines between jumped positions', () => {
      const act = getActivityLatest('6.5a')!;
      const tab1Ws = act.demoTabs![0].workspace;
      const initialTurtle = createInitialTurtleState();

      const simResult = runHeadlessSimulation(tab1Ws, 'turtle', initialTurtle, 500);
      const finalState = simResult.finalState as TurtleState;

      // Drew two separate squares of 4 sides each = 8 paths
      expect(finalState.paths.length).toBe(8);

      // Verify no path crosses from x < 0 to x > 0 directly
      for (const p of finalState.paths) {
        if (p.type === 'LINE') {
          const spansJump = p.fromX < -20 && p.toX > 20;
          expect(spansJump).toBe(false);
        }
      }
    });

    it('executes 6.5a Tab 2 bookmarking $x and $y into variables and snapping back via TELEPORT', () => {
      const act = getActivityLatest('6.5a')!;
      const tab2Ws = act.demoTabs![1].workspace;
      const initialTurtle = createInitialTurtleState();

      const simResult = runHeadlessSimulation(tab2Ws, 'turtle', initialTurtle, 500);
      const finalState = simResult.finalState as TurtleState;

      // Ended back at the bookmarked home position (-60, -40)
      expect(Math.round(finalState.robot.x)).toBe(-60);
      expect(Math.round(finalState.robot.y)).toBe(-40);
    });
  });

  describe('Cross-Environment Tab Switching on 6.0', () => {
    it('updates activeSimId and environment state when switching tabs on 6.0', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('6.0');

      // Initial active tab is 1 (Turtle)
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().activeDemoTabIndex).toBe(0);

      // Switch to Tab 2 (Robot Grid)
      store.selectExplanationDemoTab(1);
      expect(useAppStore.getState().activeSimId).toBe('grid');
      expect(useAppStore.getState().activeDemoTabIndex).toBe(1);
      expect(useAppStore.getState().grid.dialTiles?.some((d: any) => d.value === 3)).toBe(true);

      // Switch back to Tab 1 (Turtle)
      store.selectExplanationDemoTab(0);
      expect(useAppStore.getState().activeSimId).toBe('turtle');
      expect(useAppStore.getState().activeDemoTabIndex).toBe(0);
    });
  });

  describe('Variable & Dial Spotlight Component Rendering', () => {
    it('renders DialReadSpotlight with floor dial value and target watch box', () => {
      const grid = createCurriculumGridState({
        width: 6,
        height: 4,
        robot: { x: 2, y: 1, dir: 'EAST' },
        barriers: [],
        flags: [],
        dials: [{ x: 2, y: 1, value: 3, label: '3' }],
      } as any);

      const html = renderToStaticMarkup(
        React.createElement(DialReadSpotlight, {
          variables: { a: 3 },
          grid,
          isLowQuality: true,
        })
      );

      expect(html).toContain('data-testid="dial-read-spotlight"');
      expect(html).toContain('🎛️');
      expect(html).toContain('3');
      expect(html).toContain('📦 a ●');
    });

    it('renders PoseBookmarkSpotlight with coordinates and watch boxes a and b', () => {
      const turtle = createInitialTurtleState();
      turtle.robot.x = -60;
      turtle.robot.y = -40;

      const html = renderToStaticMarkup(
        React.createElement(PoseBookmarkSpotlight, {
          variables: { a: -60, b: -40 },
          turtleState: turtle,
          isLowQuality: true,
        })
      );

      expect(html).toContain('data-testid="pose-bookmark-spotlight"');
      expect(html).toContain('📍');
      expect(html).toContain('-60');
      expect(html).toContain('-40');
      expect(html).toContain('📦 a ●');
      expect(html).toContain('📦 b ▲');
    });

    it('renders VariableWatchSpotlight counter step progression (1 -> 2 -> 3 -> 4)', () => {
      const html = renderToStaticMarkup(
        React.createElement(VariableWatchSpotlight, {
          variables: { a: 2 },
          isLowQuality: true,
        })
      );

      expect(html).toContain('data-testid="variable-watch-spotlight"');
      expect(html).toContain('📦 a ●');
      expect(html).toContain('data-testid="counter-step-1"');
      expect(html).toContain('data-testid="counter-step-2"');
      expect(html).toContain('data-testid="counter-step-3"');
      expect(html).toContain('data-testid="counter-step-4"');
    });

    it('renders composite VariableAndDialSpotlight in ExplanationDemoBar for 6.0', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('6.0');
      store.selectExplanationDemoTab(1); // Robot Tab with dial-read

      const html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="variable-and-dial-spotlight"');
      expect(html).toContain('data-testid="dial-read-spotlight"');
    });
  });
});
