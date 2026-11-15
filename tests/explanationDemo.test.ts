import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  SEQ_0_DEMO_TABS,
  SEQ_ACTIVITIES,
  createCurriculumBlock,
  getActivitiesForModule,
  getActivityLatest,
} from '../src/data/curriculum';
import {
  ExplanationDemoBar,
  computeNextDemoTabIndex,
} from '../src/components/ExplanationDemoBar';
import {
  DemoSpotlightOverlay,
  getDirectionRotationDeg,
  getEgocentricSideDirections,
} from '../src/simulations/grid/components/DemoSpotlightOverlay';
import { GridOverlayLayer } from '../src/simulations/grid/components/GridOverlayLayer';
import { GridCanvas } from '../src/components/GridCanvas';
import { WorkspaceCanvas } from '../src/components/WorkspaceCanvas';
import { Toolbar } from '../src/components/Toolbar';
import { getProfileProgress } from '../src/services/profileService';

describe('Commit 8a: 📖 Explanation Interactive Demo Runner, Spotlights & Lesson 1.0', () => {
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
    });
    store.clearHistory();
  });

  describe('Lesson seq.0 Schema & seq Catalog Registration', () => {
    it('registers seq.0 at the very start of CURRICULUM_ACTIVITIES before seq.1', () => {
      const lessonSeq0 = SEQ_ACTIVITIES[0];
      expect(lessonSeq0.id).toBe('seq.0');
      expect(lessonSeq0.moduleId).toBe('seq');
      expect(lessonSeq0.version).toBe(1);
      expect(lessonSeq0.format).toBe('explanation');
      expect(lessonSeq0.simId).toBe('grid');
      expect(lessonSeq0.icon).toBe('🧭');
      expect(lessonSeq0.title).toBe('How Programs Run');

      expect(CURRICULUM_ACTIVITIES[0].id).toBe('seq.0');
      expect(CURRICULUM_ACTIVITIES[1].id).toBe('seq.1');

      const seqIds = getActivitiesForModule('seq').map((a) => a.id);
      expect(seqIds[0]).toBe('seq.0');
      expect(seqIds[1]).toBe('seq.1');
      expect(getActivityLatest('seq.0')).toBeDefined();
    });

    it('defines 3 compact 3×3 visual demo tabs with execution-order and egocentric-pov spotlights', () => {
      const lessonSeq0 = getActivityLatest('seq.0')!;
      expect(lessonSeq0.demoTabs).toBeDefined();
      expect(lessonSeq0.demoTabs).toHaveLength(3);
      expect(SEQ_0_DEMO_TABS).toHaveLength(3);

      const [tab1, tab2, tab3] = lessonSeq0.demoTabs!;

      // Tab [1]: Sequential execution order on 3x3 grid
      expect(tab1.label).toBe('1');
      expect(tab1.gridState?.width).toBe(3);
      expect(tab1.gridState?.height).toBe(3);
      expect(tab1.workspace.MAIN.length).toBeGreaterThanOrEqual(2);
      expect(tab1.workspace.MAIN.length).toBeLessThanOrEqual(4);
      expect(tab1.spotlights).toContain('execution-order');

      // Tab [2]: Turn rotates in place (Facing North)
      expect(tab2.label).toBe('2');
      expect(tab2.gridState?.width).toBe(3);
      expect(tab2.gridState?.height).toBe(3);
      expect(tab2.gridState?.robot.dir).toBe('NORTH');
      expect(tab2.spotlights).toContain('egocentric-pov');
      expect(tab2.spotlights).toContain('rotation-in-place');

      // Tab [3]: Egocentric Robot Point-of-View on 3x3 grid starting facing SOUTH
      expect(tab3.label).toBe('3');
      expect(tab3.gridState?.width).toBe(3);
      expect(tab3.gridState?.height).toBe(3);
      expect(tab3.gridState?.robot.dir).toBe('SOUTH');
      expect(tab3.spotlights).toContain('egocentric-pov');
      expect(tab3.spotlights).toContain('south-pov-turn');
    });

    it('steps cleanly through Tab [1] and Tab [3] pre-loaded workspaces to reach Goal (SUCCESS)', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('seq.0');

      // Tab [1]: Step straight North to Goal
      expect(useAppStore.getState().activeDemoTabIndex).toBe(0);
      expect(useAppStore.getState().grid.robot).toMatchObject({
        x: 1,
        y: 2,
        dir: 'NORTH',
      });

      const tab1BlockCount = useAppStore.getState().workspace.MAIN.length;
      for (let i = 0; i < tab1BlockCount; i++) {
        useAppStore.getState().step();
      }
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().grid.robot).toMatchObject({
        x: 1,
        y: 0,
        dir: 'NORTH',
      });

      // Switch to Tab [3]: Starts facing SOUTH; Move Forward, Turn Right -> WEST (screen left!), Move Forward -> Goal!
      useAppStore.getState().selectExplanationDemoTab(2);
      expect(useAppStore.getState().activeDemoTabIndex).toBe(2);
      expect(useAppStore.getState().grid.robot).toMatchObject({
        x: 2,
        y: 0,
        dir: 'SOUTH',
      });

      // Step 1: MOVE_FWD -> (2, 1) facing SOUTH
      useAppStore.getState().step();
      expect(useAppStore.getState().grid.robot).toMatchObject({
        x: 2,
        y: 1,
        dir: 'SOUTH',
      });

      // Step 2: TURN_RIGHT from SOUTH -> faces WEST (screen left!)
      useAppStore.getState().step();
      expect(useAppStore.getState().grid.robot).toMatchObject({
        x: 2,
        y: 1,
        dir: 'WEST',
      });

      // Step 3: MOVE_FWD -> (1, 1) Goal Flag!
      useAppStore.getState().step();
      expect(useAppStore.getState().grid.status).toBe('SUCCESS');
      expect(useAppStore.getState().grid.robot).toMatchObject({
        x: 1,
        y: 1,
        dir: 'WEST',
      });
    });
  });

  describe('ExplanationDemoBar Tab Switching, Explored Checkmarks & 1-Tap Continue (→)', () => {
    it('renders ExplanationDemoBar only on curriculum explanation activities without duplicating Play/Step controls', () => {
      // Hidden in sandbox mode
      expect(renderToStaticMarkup(React.createElement(ExplanationDemoBar))).toBe('');

      // Hidden on puzzle activities (seq.1)
      useAppStore.getState().setCurriculumActivity('seq.1');
      expect(renderToStaticMarkup(React.createElement(ExplanationDemoBar))).toBe('');

      // Visible on explanation activity (seq.0)
      useAppStore.getState().setCurriculumActivity('seq.0');
      const html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="explanation-demo-bar"');
      expect(html).toContain('data-testid="demo-tab-1"');
      expect(html).toContain('data-testid="demo-tab-2"');
      expect(html).toContain('data-testid="demo-tab-3"');
      expect(html).toContain('data-testid="btn-explanation-continue"');
      expect(html).toContain('[1]');
      expect(html).toContain('[2]');
      expect(html).toContain('[3]');
      // Main toolbar already provides Play/Step/Reset — no duplicate play/step buttons in demo bar
      expect(html).not.toContain('data-testid="btn-play"');
      expect(html).not.toContain('data-testid="btn-step"');
    });

    it('tracks explored tabs with ✓ checkmarks, highlights Continue (→), and marks seq.0 completed while advancing to seq.1', () => {
      useAppStore.getState().setCurriculumActivity('seq.0');

      let html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).not.toContain('data-testid="demo-tab-explored-1"');
      expect(html).not.toContain('data-testid="demo-tab-explored-2"');
      expect(html).not.toContain('data-testid="demo-tab-explored-3"');
      expect(html).toContain('data-all-explored="false"');

      // Step on Tab [1] -> marks Tab [1] explored (✓)
      useAppStore.getState().step();
      html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="demo-tab-explored-1"');
      expect(html).not.toContain('data-testid="demo-tab-explored-2"');
      expect(html).toContain('data-all-explored="false"');

      // Switch to Tab [2] -> Tab [1] retains ✓, Tab [2] selected
      useAppStore.getState().selectExplanationDemoTab(1);
      html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="demo-tab-explored-1"');
      expect(html).toContain('id="demo-tab-btn-seq.0-tab-2"');
      expect(html).toContain('aria-selected="true"');

      // Step on Tab [2] & Tab [3] -> all 3 explored!
      useAppStore.getState().step();
      useAppStore.getState().selectExplanationDemoTab(2);
      useAppStore.getState().step();
      html = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(html).toContain('data-testid="demo-tab-explored-1"');
      expect(html).toContain('data-testid="demo-tab-explored-2"');
      expect(html).toContain('data-testid="demo-tab-explored-3"');
      expect(html).toContain('data-all-explored="true"');
      expect(useAppStore.getState().statusAnnouncement).toContain(
        'All 3 examples explored'
      );

      // Click Continue (→) -> marks seq.0 completed in profile progress and advances to seq.1
      const activeProfileId = useAppStore.getState().activeProfileId;
      const nextId = useAppStore.getState().completeExplanationAndContinue();
      expect(nextId).toBe('seq.1');
      expect(useAppStore.getState().activeActivityId).toBe('seq.1');
      expect(useAppStore.getState().completedActivities['seq.0']).toBe(true);

      const persistedProgress = getProfileProgress(activeProfileId);
      expect(persistedProgress.completedLessons['seq.0']).toBeDefined();
      expect(persistedProgress.completedLessons['seq.0'].version).toBe(1);
    });

    it('supports Undo-safe Reset to Starter on secondary demo tabs (Tab [2])', () => {
      useAppStore.getState().setCurriculumActivity('seq.0');
      useAppStore.getState().selectExplanationDemoTab(1);
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'TURN_RIGHT',
        'MOVE_FWD',
        'MOVE_FWD',
      ]);

      // Learner experiments by adding an extra block on Tab [2]
      useAppStore.getState().addBlock('MAIN', 'TURN_LEFT');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(4);

      // Reset to Starter restores Tab [2]'s 3-block workspace and can be undone
      useAppStore.getState().resetActivityToStarter();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'TURN_RIGHT',
        'MOVE_FWD',
        'MOVE_FWD',
      ]);

      useAppStore.getState().undo();
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(4);
    });
  });

  describe('DemoSpotlightOverlay & <GridOverlayLayer /> Spotlights', () => {
    it('renders execution-order spotlight & workspace step badges without polluting block-* testids', () => {
      useAppStore.getState().setCurriculumActivity('seq.0');
      useAppStore.getState().selectExplanationDemoTab(0);

      const gridHtmlInitial = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(gridHtmlInitial).toContain('data-testid="grid-slot-demo-spotlights"');
      expect(gridHtmlInitial).toContain('data-testid="demo-spotlight-overlay"');
      expect(gridHtmlInitial).toContain('data-testid="spotlight-execution-order"');
      expect(gridHtmlInitial).toContain('data-step-number="1"');
      expect(gridHtmlInitial).toContain('data-testid="spotlight-motion-target"');
      expect(gridHtmlInitial).not.toContain('data-testid="spotlight-egocentric-pov"');

      // Step once -> block #1 active, step badge updates cleanly
      useAppStore.getState().step();
      const wsHtml = renderToStaticMarkup(React.createElement(WorkspaceCanvas));
      expect(wsHtml).toContain('data-testid="demo-step-badge-1"');
      expect(wsHtml).toContain('data-testid="demo-step-badge-2"');
      expect(wsHtml).toContain('data-testid="demo-active-block-pointer"');

      const placedBlockMatches = wsHtml.match(/data-testid="block-(?!params-container-)/g) ?? [];
      expect(placedBlockMatches).toHaveLength(2);
    });

    it('rotates egocentric-pov heading cone & color-blind safe L/R wings accurately between SOUTH (180°) and NORTH (0°)', () => {
      // Pure orientation mapping verification across all 4 headings
      expect(getDirectionRotationDeg('NORTH')).toBe(0);
      expect(getDirectionRotationDeg('EAST')).toBe(90);
      expect(getDirectionRotationDeg('SOUTH')).toBe(180);
      expect(getDirectionRotationDeg('WEST')).toBe(270);

      expect(getEgocentricSideDirections('SOUTH')).toEqual({
        leftDir: 'EAST',
        rightDir: 'WEST',
      });
      expect(getEgocentricSideDirections('NORTH')).toEqual({
        leftDir: 'WEST',
        rightDir: 'EAST',
      });

      // Render Tab [3] inside GridCanvas and step once so TURN_RIGHT is pending while facing SOUTH
      useAppStore.getState().setCurriculumActivity('seq.0');
      useAppStore.getState().selectExplanationDemoTab(2);
      useAppStore.getState().step(); // MOVE_FWD -> (2, 1) facing SOUTH; next block is TURN_RIGHT

      const southHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(southHtml).toContain('data-testid="spotlight-egocentric-pov"');
      expect(southHtml).toContain('data-robot-dir="SOUTH"');
      expect(southHtml).toContain('data-rotation-deg="180"');
      expect(southHtml).toContain('data-left-world-dir="EAST"');
      expect(southHtml).toContain('data-right-world-dir="WEST"');
      expect(southHtml).toContain('data-testid="pov-heading-cone"');
      // Color-blind safe redundant shape + stroke pattern on Left vs Right wings
      expect(southHtml).toContain('data-testid="pov-left-wing"');
      expect(southHtml).toContain('data-marker-shape="circle"');
      expect(southHtml).toContain('data-stroke-style="solid"');
      expect(southHtml).toContain('data-testid="pov-right-wing"');
      expect(southHtml).toContain('data-marker-shape="diamond"');
      expect(southHtml).toContain('data-stroke-style="dashed"');
      expect(southHtml).toContain('data-emphasized="true"');

      // Switch to Tab [2] facing NORTH -> verify spotlight rotates to 0° (Left=WEST, Right=EAST)
      useAppStore.getState().selectExplanationDemoTab(1);

      const northHtml = renderToStaticMarkup(React.createElement(GridCanvas));
      expect(northHtml).toContain('data-robot-dir="NORTH"');
      expect(northHtml).toContain('data-rotation-deg="0"');
      expect(northHtml).toContain('data-left-world-dir="WEST"');
      expect(northHtml).toContain('data-right-world-dir="EAST"');
    });

    it('supports forward-compatible world-item, backpack, and loop-counter spotlights inside GridOverlayLayer', () => {
      const baseGrid = {
        ...useAppStore.getState().grid,
        items: [{ id: 'k1', type: 'key', x: 1, y: 1 }],
        robot: {
          ...useAppStore.getState().grid.robot,
          carriedItem: { type: 'key' },
        },
      } as any;

      const loopWorkspace = {
        MAIN: [
          createCurriculumBlock('LOOP_START', 4, undefined, 'lp_s'),
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'lp_m'),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'lp_e'),
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const loopRuntime = {
        callStack: [{ scope: 'MAIN' as const, pc: 1, subTickLeft: 0 }],
        loopStack: [
          {
            scope: 'MAIN' as const,
            loopStartPc: 0,
            loopEndPc: 2,
            currentIteration: 2,
            totalIterations: 4,
          },
        ],
        activeBlockId: 'lp_m',
        activeScope: 'MAIN' as const,
        status: 'RUNNING' as const,
        stepCount: 2,
        variables: {} as any,
        activeRepeatProgress: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid: baseGrid,
            cellSize: 72,
            isInstant: false,
            isReadOnly: true,
            layer: 'over-robot',
            demoSpotlightSlot: React.createElement(DemoSpotlightOverlay, {
              grid: baseGrid,
              cellSize: 72,
              spotlightsOverride: ['world-item', 'backpack', 'loop-counter'],
              workspaceOverride: loopWorkspace,
              runtimeOverride: loopRuntime,
            }),
          })
        )
      );

      expect(html).toContain('data-testid="spotlight-world-item"');
      expect(html).toContain('data-item-count="1"');
      expect(html).toContain('data-testid="spotlight-backpack"');
      expect(html).toContain('data-carried-item="key"');
      expect(html).toContain('data-testid="spotlight-loop-counter"');
      expect(html).toContain('data-iteration="2"');
      expect(html).toContain('data-total="4"');
      expect(html).toContain('↻2/4');
    });
  });

  describe('Keyboard Navigation & Screen-Reader Accessibility', () => {
    it('exposes WAI-ARIA tablist, roving tabindex, aria-selected, and polite live announcements', () => {
      useAppStore.getState().setCurriculumActivity('seq.0');
      const htmlTab1 = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(htmlTab1).toContain('role="tablist"');
      expect(htmlTab1).toContain('role="tab"');
      expect(htmlTab1).toContain('aria-live="polite"');
      expect(htmlTab1).toContain('data-testid="explanation-demo-live-region"');
      expect(htmlTab1).toMatch(
        /data-testid="demo-tab-1"[^>]*aria-selected="true"[^>]*tabindex="0"/
      );
      expect(htmlTab1).toMatch(
        /data-testid="demo-tab-2"[^>]*aria-selected="false"[^>]*tabindex="-1"/
      );

      // Switch to Tab [2] -> roving tabindex shifts cleanly to Tab [2]
      useAppStore.getState().selectExplanationDemoTab(1);
      const htmlTab2 = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(htmlTab2).toMatch(
        /data-testid="demo-tab-1"[^>]*aria-selected="false"[^>]*tabindex="-1"/
      );
      expect(htmlTab2).toMatch(
        /data-testid="demo-tab-2"[^>]*aria-selected="true"[^>]*tabindex="0"/
      );
      expect(htmlTab2).toContain('Example 2 of 3: Turn Rotates in Place (Facing North)');
    });

    it('computes roving tablist keyboard transitions for ArrowLeft/Right/Up/Down, Home, End, Enter & Space', () => {
      expect(computeNextDemoTabIndex('ArrowRight', 0, 2)).toBe(1);
      expect(computeNextDemoTabIndex('ArrowRight', 1, 2)).toBe(0);
      expect(computeNextDemoTabIndex('ArrowDown', 0, 3)).toBe(1);
      expect(computeNextDemoTabIndex('ArrowLeft', 0, 2)).toBe(1);
      expect(computeNextDemoTabIndex('ArrowUp', 2, 3)).toBe(1);
      expect(computeNextDemoTabIndex('Home', 2, 3)).toBe(0);
      expect(computeNextDemoTabIndex('End', 0, 3)).toBe(2);
      expect(computeNextDemoTabIndex('Enter', 1, 3)).toBe(1);
      expect(computeNextDemoTabIndex(' ', 0, 3)).toBe(0);
      expect(computeNextDemoTabIndex('Escape', 0, 2)).toBeNull();
    });
  });

  describe('Viewed-Steps Next Gate & Instant Mode Disabled on Explanation Lessons', () => {
    it('moves Next through every unviewed demo tab before advancing to next lesson (seq.0 & param.7)', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('seq.0');

      // Initially only Tab [1] is viewed -> Next button targets [2] with data-next-action="next-step"
      let barHtml = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(barHtml).toContain('data-next-action="next-step"');
      expect(barHtml).toContain('data-all-viewed="false"');
      expect(barHtml).toContain('>Next<');

      // First Next advances to Tab [2], second to Tab [3] instead of skipping to seq.1
      const firstResult = useAppStore.getState().completeExplanationAndContinue();
      expect(firstResult).toBe('seq.0');
      expect(useAppStore.getState().activeActivityId).toBe('seq.0');
      expect(useAppStore.getState().activeDemoTabIndex).toBe(1);

      const secondStepResult = useAppStore.getState().completeExplanationAndContinue();
      expect(secondStepResult).toBe('seq.0');
      expect(useAppStore.getState().activeDemoTabIndex).toBe(2);

      barHtml = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(barHtml).toContain('data-next-action="next-lesson"');
      expect(barHtml).toContain('data-all-viewed="true"');

      // Third Next advances to seq.1
      const thirdResult = useAppStore.getState().completeExplanationAndContinue();
      expect(thirdResult).toBe('seq.1');
      expect(useAppStore.getState().activeActivityId).toBe('seq.1');

      // 3-tab lesson param.7: jump Tab [1] -> Tab [3], Next wraps back to unviewed Tab [2], then advances to param.8
      useAppStore.getState().setCurriculumActivity('param.7');
      useAppStore.getState().selectExplanationDemoTab(2);
      expect(useAppStore.getState().activeDemoTabIndex).toBe(2);

      useAppStore.getState().completeExplanationAndContinue();
      expect(useAppStore.getState().activeActivityId).toBe('param.7');
      expect(useAppStore.getState().activeDemoTabIndex).toBe(1);

      const finalResult = useAppStore.getState().completeExplanationAndContinue();
      expect(finalResult).toBe('param.8');
      expect(useAppStore.getState().activeActivityId).toBe('param.8');
    });

    it('disables Instant mode on explanation lessons when entering from Instant mode or calling setSpeed', () => {
      const store = useAppStore.getState();
      store.setAppMode('curriculum');
      store.setCurriculumActivity('seq.1');
      store.setSpeed('instant');
      expect(useAppStore.getState().speed).toBe('instant');

      // Entering seq.0 resets speed from 'instant' to 400 and does NOT auto-run demo to SUCCESS
      useAppStore.getState().setCurriculumActivity('seq.0');
      expect(useAppStore.getState().speed).toBe(400);
      expect(useAppStore.getState().grid.status).toBe('IDLE');

      // Trying setSpeed('instant') or setSpeed(0) while on an explanation lesson coerces to 400
      useAppStore.getState().setSpeed('instant');
      expect(useAppStore.getState().speed).toBe(400);
      useAppStore.getState().setSpeed(0);
      expect(useAppStore.getState().speed).toBe(400);

      // Step button remains enabled in Toolbar
      const toolbarHtml = renderToStaticMarkup(React.createElement(Toolbar));
      expect(toolbarHtml).not.toContain('Step disabled in Instant mode');
    });
  });
});
