import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../src/store/useAppStore';
import {
  CURRICULUM_ACTIVITIES,
  MODULE_5_DEMO_ACTIVITIES,
  getActivityLatest,
  getActivitiesForModule,
} from '../src/data/curriculum';
import {
  LESSON_5_0_GRID_VAR1,
  LESSON_5_0_GRID_VAR2,
  LESSON_5_0_GRID_VAR3,
  LESSON_5_0_DEMO_TABS,
  LESSON_5_2_SWITCHYARD_VAR1,
  LESSON_5_2_DEMO_TABS,
  LESSON_5_4_SWITCHYARD_VAR1,
  LESSON_5_4_DEMO_TABS,
  LESSON_5_7_GRID_SHORT,
  LESSON_5_7_GRID_LONG,
  LESSON_5_7_DEMO_TABS,
  LESSON_5_11_DEPOT_LIFO,
  LESSON_5_11_DEPOT_FIFO,
  LESSON_5_11_DEMO_TABS,
} from '../src/data/curriculum/module5Demos';
import { ExplanationDemoBar } from '../src/components/ExplanationDemoBar';
import { VictoryCelebrationModal } from '../src/components/VictoryCelebrationModal';
import {
  SensorBeamGridOverlay,
  BranchSkipSpotlight,
  FifoVsLifoSpotlight,
  SensorBeamBadge,
  getScannedCellCoord,
} from '../src/simulations/grid/components/SensorAndBranchSpotlight';
import { SwitchyardCanvas } from '../src/simulations/switchyard/components/SwitchyardCanvas';
import { DepotCanvas } from '../src/simulations/depot/components/DepotCanvas';
import { tickInterpreter, createInitialInterpreterState } from '../src/engine/interpreter';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { switchyardSimulationEnvironment } from '../src/simulations/switchyard/switchyardEnvironment';
import { depotSimulationEnvironment } from '../src/simulations/depot/depotEnvironment';
import { createInitialSwitchyardState } from '../src/simulations/switchyard/physics';
import { createCurriculumGridState } from '../src/data/curriculum/types';

describe('Commit 27: Module 5 Interactive Spotlights & Demo Activities (5.0, 5.2, 5.4, 5.7, 5.11)', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.pause();
    store.setSpeed(400);
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
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
      isVictoryModalOpen: false,
      victoryEarnedBadges: [],
    });
    store.clearHistory();
  });

  // =========================================================================
  // 1. Schema & Registration in Curriculum Catalog
  // =========================================================================
  describe('1. Schema & Catalog Registration', () => {
    it('registers all 5 demo activities in MODULE_5_DEMO_ACTIVITIES with correct metadata', () => {
      expect(MODULE_5_DEMO_ACTIVITIES).toHaveLength(5);
      const ids = MODULE_5_DEMO_ACTIVITIES.map((a) => a.id);
      expect(ids).toEqual(['5.0', '5.2', '5.4', '5.7', '5.11']);

      for (const act of MODULE_5_DEMO_ACTIVITIES) {
        expect(act.moduleId).toBe('module-5');
        expect(act.version).toBe(1);
        expect(act.format).toBe('explanation');
        expect(act.icon).toBe('📖');
        expect(act.demoTabs).toBeDefined();
        expect(act.demoTabs!.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('places all 5 demo activities in CURRICULUM_ACTIVITIES and preserves canonical order', () => {
      const allM5 = getActivitiesForModule('module-5').map((a) => a.id);
      expect(allM5).toContain('5.0');
      expect(allM5).toContain('5.2');
      expect(allM5).toContain('5.4');
      expect(allM5).toContain('5.7');
      expect(allM5).toContain('5.11');

      // Canonical numeric order check: 5.0 < 5.2 < 5.4 < 5.7 < 5.11
      const idx5_0 = allM5.indexOf('5.0');
      const idx5_2 = allM5.indexOf('5.2');
      const idx5_4 = allM5.indexOf('5.4');
      const idx5_7 = allM5.indexOf('5.7');
      const idx5_11 = allM5.indexOf('5.11');
      expect(idx5_0).toBeLessThan(idx5_2);
      expect(idx5_2).toBeLessThan(idx5_4);
      expect(idx5_4).toBeLessThan(idx5_7);
      expect(idx5_7).toBeLessThan(idx5_11);
    });

    it('assigns correct simulation environments across the 5 activities', () => {
      expect(getActivityLatest('5.0')?.simId).toBe('grid');
      expect(getActivityLatest('5.2')?.simId).toBe('switchyard');
      expect(getActivityLatest('5.4')?.simId).toBe('switchyard');
      expect(getActivityLatest('5.7')?.simId).toBe('grid');
      expect(getActivityLatest('5.11')?.simId).toBe('depot');
    });
  });

  // =========================================================================
  // 2. Interactive Spotlight Components & Hooks
  // =========================================================================
  describe('2. Interactive Spotlight Components & Canvas Overlays', () => {
    it('computes scanned cell coordinates accurately for egocentric sensor directions', () => {
      const robotNorth = { x: 2, y: 2, dir: 'NORTH' as const };
      expect(getScannedCellCoord(robotNorth, 'pathAhead')).toEqual({ x: 2, y: 1 });
      expect(getScannedCellCoord(robotNorth, 'pathLeft')).toEqual({ x: 1, y: 2 });
      expect(getScannedCellCoord(robotNorth, 'pathRight')).toEqual({ x: 3, y: 2 });
      expect(getScannedCellCoord(robotNorth, 'itemHere')).toEqual({ x: 2, y: 2 });

      const robotEast = { x: 2, y: 2, dir: 'EAST' as const };
      expect(getScannedCellCoord(robotEast, 'pathAhead')).toEqual({ x: 3, y: 2 });
      expect(getScannedCellCoord(robotEast, 'pathLeft')).toEqual({ x: 2, y: 1 });
      expect(getScannedCellCoord(robotEast, 'pathRight')).toEqual({ x: 2, y: 3 });
    });

    it('renders SensorBeamGridOverlay with SVG elements and data-testid', () => {
      const grid = createCurriculumGridState(LESSON_5_0_GRID_VAR1);
      const html = renderToStaticMarkup(
        React.createElement('svg', null,
          React.createElement(SensorBeamGridOverlay, { grid })
        )
      );
      expect(html).toContain('data-testid="sensor-beam-spotlight"');
      expect(html).toContain('sensor-beam-glow');
    });

    it('renders BranchSkipSpotlight with then-path or else-path indicators', () => {
      const html = renderToStaticMarkup(React.createElement(BranchSkipSpotlight));
      expect(html).toContain('data-testid="branch-skip-spotlight"');
      expect(html).toContain('If');
      expect(html).toContain('End');
      expect(html).toContain('data-testid="branch-skip-path-then"');
    });

    it('renders FifoVsLifoSpotlight contrasting Queue vs Stack', () => {
      const html = renderToStaticMarkup(React.createElement(FifoVsLifoSpotlight));
      expect(html).toContain('data-testid="fifo-vs-lifo-spotlight"');
      expect(html).toContain('data-testid="fifo-spotlight-pill"');
      expect(html).toContain('data-testid="lifo-spotlight-pill"');
      expect(html).toContain('FIFO');
      expect(html).toContain('LIFO');
      expect(html).toContain('Front 1st');
      expect(html).toContain('Top 1st');
    });

    it('renders SensorBeamBadge for ExplanationDemoBar', () => {
      const html = renderToStaticMarkup(React.createElement(SensorBeamBadge));
      expect(html).toContain('data-testid="sensor-beam-badge"');
      expect(html).toContain('Scanner Beam');
      expect(html).toContain('✓');
      expect(html).toContain('✗');
    });

    it('renders spotlights dynamically inside ExplanationDemoBar based on active tab', () => {
      const store = useAppStore.getState();

      // 5.0 Tab 2 has branch-skip spotlight
      store.setCurriculumActivity('5.0');
      store.selectExplanationDemoTab(1);
      let barHtml = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(barHtml).toContain('data-testid="branch-skip-spotlight"');

      // 5.11 Tab 1 has fifo-vs-lifo spotlight
      store.setCurriculumActivity('5.11');
      store.selectExplanationDemoTab(0);
      barHtml = renderToStaticMarkup(React.createElement(ExplanationDemoBar));
      expect(barHtml).toContain('data-testid="fifo-vs-lifo-spotlight"');
    });

    it('renders switchyard sensor beam and branch-skip indicators in SwitchyardCanvas', () => {
      const state = createInitialSwitchyardState({
        queue: [{ color: 'RED', icon: 'CRATE', damaged: false }],
      });
      const html = renderToStaticMarkup(
        React.createElement(SwitchyardCanvas, {
          state,
          spotlightsOverride: ['sensor-beam', 'branch-skip'],
        })
      );
      expect(html).toContain('data-testid="switchyard-sensor-beam"');
      expect(html).toContain('data-testid="switchyard-branch-skip"');
    });

    it('renders depot fifo-vs-lifo banner and sensor beam in DepotCanvas', () => {
      const html = renderToStaticMarkup(
        React.createElement(DepotCanvas, {
          state: LESSON_5_11_DEPOT_FIFO,
          spotlightsOverride: ['fifo-vs-lifo', 'sensor-beam'],
        })
      );
      expect(html).toContain('data-testid="depot-fifo-vs-lifo-banner"');
      expect(html).toContain('data-testid="depot-sensor-beam"');
    });
  });

  // =========================================================================
  // 3. Simulation Execution Verification for all 5 Activities
  // =========================================================================
  describe('3. Simulation Execution of Demo Workspaces', () => {
    // --- 5.0 Grid: Sensors, If, and Multi-Map Runs ---
    describe('Activity 5.0 (Grid: If itemHere)', () => {
      it('demonstrates Tab 1 fixed sequence picking up on Var 1 but failing on Var 2', () => {
        const tab1Workspace = LESSON_5_0_DEMO_TABS[0].workspace;

        // Run on Var 1 (item is at x=2, picked up on 3rd step)
        let sim1 = createCurriculumGridState(LESSON_5_0_GRID_VAR1);
        let runtime1 = createInitialInterpreterState();
        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(runtime1, tab1Workspace, sim1, gridSimulationEnvironment);
          runtime1 = res.nextRuntime;
          sim1 = res.nextGrid;
          if (res.done) break;
        }
        expect(sim1.robot.carriedItem).toBeDefined();

        // Run on Var 2 (item is at x=3, fixed pick up at x=2 gets nothing!)
        let sim2 = createCurriculumGridState(LESSON_5_0_GRID_VAR2);
        let runtime2 = createInitialInterpreterState();
        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(runtime2, tab1Workspace, sim2, gridSimulationEnvironment);
          runtime2 = res.nextRuntime;
          sim2 = res.nextGrid;
          if (res.done) break;
        }
        // Robot arrived at goal without collecting the item
        expect(sim2.robot.carriedItem).toBeNull();
        expect(sim2.status).not.toBe('SUCCESS');
      });

      it('demonstrates Tab 2 If (itemHere) picking up successfully on all 3 variants', () => {
        const tab2Workspace = LESSON_5_0_DEMO_TABS[1].workspace;
        const variants = [LESSON_5_0_GRID_VAR1, LESSON_5_0_GRID_VAR2, LESSON_5_0_GRID_VAR3];

        for (const v of variants) {
          let sim = createCurriculumGridState(v);
          let runtime = createInitialInterpreterState();
          for (let t = 0; t < 30; t++) {
            const res = tickInterpreter(runtime, tab2Workspace, sim, gridSimulationEnvironment);
            runtime = res.nextRuntime;
            sim = res.nextGrid;
            if (res.done) break;
          }
          expect(sim.robot.carriedItem).toBeDefined();
          expect(sim.status).toBe('SUCCESS');
        }
      });
    });

    // --- 5.2 Switchyard: Meet the Switchyard (Scanner, Docks & Scrap) ---
    describe('Activity 5.2 (Switchyard: If itemDamaged Scrap)', () => {
      it('demonstrates Tab 1 sending damaged crate directly to dock triggers collision', () => {
        const tab1Workspace = LESSON_5_2_DEMO_TABS[0].workspace;
        const state = createInitialSwitchyardState({
          queue: [{ color: 'RED', icon: 'CRATE', damaged: true }],
          docks: [{ spec: { id: 'DOCK_A', rejectDamaged: true }, items: [], mismatch: false }],
        });

        let sim = state;
        let runtime = createInitialInterpreterState();
        for (let t = 0; t < 10; t++) {
          const res = tickInterpreter(runtime, tab1Workspace, sim, switchyardSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        expect(sim.status).toBe('COLLISION');
        expect(sim.lastFailureReason).toBe('WRONG_DOCK');
      });

      it('demonstrates Tab 2 If (itemDamaged) scrapping broken car and routing intact car', () => {
        const tab2Workspace = LESSON_5_2_DEMO_TABS[1].workspace;
        const state = createInitialSwitchyardState({
          queue: [
            { color: 'BLUE', icon: 'BATTERY', damaged: true },
            { color: 'RED', icon: 'CRATE', damaged: false },
          ],
          docks: [{ spec: { id: 'DOCK_A', rejectDamaged: true }, items: [], mismatch: false }],
        });

        let sim = state;
        let runtime = createInitialInterpreterState();
        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(runtime, tab2Workspace, sim, switchyardSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        expect(sim.scrapped).toHaveLength(1);
        expect(sim.scrapped[0].damaged).toBe(true);
        expect(sim.docks[0].items).toHaveLength(1);
        expect(sim.status).toBe('SUCCESS');
      });
    });

    // --- 5.4 Switchyard: Two-Way Decisions (If / Else) ---
    describe('Activity 5.4 (Switchyard: If / Else Color Sorting)', () => {
      it('demonstrates Tab 1 If / Else taking Left for Red crate and delivering to Dock A', () => {
        const tab1Workspace = LESSON_5_4_DEMO_TABS[0].workspace;
        const state = createInitialSwitchyardState({
          queue: [{ color: 'RED', icon: 'CRATE', damaged: false }],
          docks: [
            { spec: { id: 'DOCK_A', acceptColor: 'RED' }, items: [], mismatch: false },
            { spec: { id: 'DOCK_B', acceptColor: 'BLUE' }, items: [], mismatch: false },
          ],
        });

        let sim = state;
        let runtime = createInitialInterpreterState();
        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(runtime, tab1Workspace, sim, switchyardSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        expect(sim.docks[0].items).toHaveLength(1);
        expect(sim.docks[0].items[0].color).toBe('RED');
        expect(sim.status).toBe('SUCCESS');
      });

      it('demonstrates Tab 2 sorting both Red and Blue crates into matching docks', () => {
        const tab2Workspace = LESSON_5_4_DEMO_TABS[1].workspace;
        const state = createInitialSwitchyardState({
          queue: [
            { color: 'RED', icon: 'CRATE', damaged: false },
            { color: 'BLUE', icon: 'BATTERY', damaged: false },
          ],
          docks: [
            { spec: { id: 'DOCK_A', acceptColor: 'RED' }, items: [], mismatch: false },
            { spec: { id: 'DOCK_B', acceptColor: 'BLUE' }, items: [], mismatch: false },
          ],
        });

        let sim = state;
        let runtime = createInitialInterpreterState();
        for (let t = 0; t < 30; t++) {
          const res = tickInterpreter(runtime, tab2Workspace, sim, switchyardSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        expect(sim.docks[0].items).toHaveLength(1);
        expect(sim.docks[0].items[0].color).toBe('RED');
        expect(sim.docks[1].items).toHaveLength(1);
        expect(sim.docks[1].items[0].color).toBe('BLUE');
        expect(sim.status).toBe('SUCCESS');
      });
    });

    // --- 5.7 Grid: While Loops vs. Fixed Repeat Counts ---
    describe('Activity 5.7 (Grid: While pathAhead vs Fixed Repeats)', () => {
      it('demonstrates Tab 1 Move Fwd ×4 crashing into wall on short 2-tile hallway', () => {
        const tab1Workspace = LESSON_5_7_DEMO_TABS[0].workspace;
        let sim = createCurriculumGridState(LESSON_5_7_GRID_SHORT);
        let runtime = createInitialInterpreterState();

        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(runtime, tab1Workspace, sim, gridSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        expect(sim.status).toBe('COLLISION');
      });

      it('demonstrates Tab 2 While (pathAhead) stopping cleanly at goal on both short and long halls', () => {
        const tab2Workspace = LESSON_5_7_DEMO_TABS[1].workspace;

        // Short hallway: 2 steps to goal
        let simShort = createCurriculumGridState(LESSON_5_7_GRID_SHORT);
        let rtShort = createInitialInterpreterState();
        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(rtShort, tab2Workspace, simShort, gridSimulationEnvironment);
          rtShort = res.nextRuntime;
          simShort = res.nextGrid;
          if (res.done) break;
        }
        expect(simShort.robot.x).toBe(2);
        expect(simShort.status).not.toBe('COLLISION');

        // Long hallway: 7 steps to goal
        let simLong = createCurriculumGridState(LESSON_5_7_GRID_LONG);
        let rtLong = createInitialInterpreterState();
        for (let t = 0; t < 30; t++) {
          const res = tickInterpreter(rtLong, tab2Workspace, simLong, gridSimulationEnvironment);
          rtLong = res.nextRuntime;
          simLong = res.nextGrid;
          if (res.done) break;
        }
        expect(simLong.robot.x).toBe(7);
        expect(simLong.status).toBe('SUCCESS');
      });
    });

    // --- 5.11 Depot: FIFO Conveyor Queue + If / Else ---
    describe('Activity 5.11 (Depot: FIFO Queue vs LIFO Stack)', () => {
      it('demonstrates Tab 1 LIFO Stack top-first crate retrieval', () => {
        const tab1Workspace = LESSON_5_11_DEMO_TABS[0].workspace;
        let sim = { ...LESSON_5_11_DEPOT_LIFO };
        let runtime = createInitialInterpreterState();

        for (let t = 0; t < 20; t++) {
          const res = tickInterpreter(runtime, tab1Workspace, sim, depotSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        // Blue crate (top of stack 1) was placed on stack 2
        expect(sim.stacks[1]).toContain('BLUE');
        expect(sim.status).toBe('SUCCESS');
      });

      it('demonstrates Tab 2 FIFO Queue front-first routing with If / Else', () => {
        const tab2Workspace = LESSON_5_11_DEMO_TABS[1].workspace;
        let sim = { ...LESSON_5_11_DEPOT_FIFO };
        let runtime = createInitialInterpreterState();

        for (let t = 0; t < 50; t++) {
          const res = tickInterpreter(runtime, tab2Workspace, sim, depotSimulationEnvironment);
          runtime = res.nextRuntime;
          sim = res.nextGrid;
          if (res.done) break;
        }
        // Red went to Stack 1, Blue went to Stack 2
        expect(sim.stacks[0]).toEqual(['RED']);
        expect(sim.stacks[1]).toEqual(['BLUE']);
        expect(sim.status).toBe('SUCCESS');
      });
    });
  });

  // =========================================================================
  // 4. VictoryCelebrationModal Silence Guard on Demo Tabs
  // =========================================================================
  describe('4. VictoryCelebrationModal Spam Guard', () => {
    it('keeps VictoryCelebrationModal completely silent on all 5 demo activities even upon SUCCESS', () => {
      const store = useAppStore.getState();
      const demoIds = ['5.0', '5.2', '5.4', '5.7', '5.11'];

      for (const id of demoIds) {
        store.setCurriculumActivity(id);
        expect(useAppStore.getState().activeActivityId).toBe(id);
        expect(useAppStore.getState().isVictoryModalOpen).toBe(false);

        // Advance steps in Tab [2] to reach completion
        const tab = useAppStore.getState().workspace.MAIN;
        for (let s = 0; s < tab.length + 5; s++) {
          useAppStore.getState().step();
        }

        // Modal MUST stay closed on explanation demo activities
        expect(useAppStore.getState().isVictoryModalOpen).toBe(false);
        const modalHtml = renderToStaticMarkup(React.createElement(VictoryCelebrationModal));
        expect(modalHtml).toBe('');
      }
    });
  });
});
