import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRICULUM_MODULES,
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  createCurriculumBlock,
  createCurriculumGridState,
  getCurriculumModules,
  getCurriculumModule,
  getActivitiesForModule,
  getActivityLatest,
  getActivityAtVersion,
  isValidatedPuzzleActivity,
} from '../src/data/curriculum';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { exportToString } from '../src/engine/serialization/codeSerializer';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { GridOverlayLayer, GRID_CELL_SIZE } from '../src/simulations/grid/components/GridOverlayLayer';
import { useAppStore } from '../src/store/useAppStore';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';

describe('Wave 1 / Commit 1: Curriculum Foundation, Read-Only Maps & GridOverlayLayer', () => {
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
    });
    useAppStore.getState().clearHistory();
  });

  describe('Curriculum Module & Activity Schema', () => {
    it('declares static badgeId and capstoneIds for Modules 1–3', () => {
      const modules = getCurriculumModules();
      expect(modules).toHaveLength(3);
      expect(modules.map((m) => m.id)).toEqual(['module-1', 'module-2', 'module-3']);

      const m1 = getCurriculumModule('module-1')!;
      expect(m1.badgeId).toBe('badge-module-1');
      expect(m1.capstoneIds).toEqual(['1A', '1B', '1C']);

      const m2 = getCurriculumModule('module-2')!;
      expect(m2.badgeId).toBe('badge-module-2');
      expect(m2.capstoneIds).toEqual(['2A', '2B']);

      const m3 = getCurriculumModule('module-3')!;
      expect(m3.badgeId).toBe('badge-module-3');
      expect(m3.capstoneIds).toEqual(['3A', '3B', '3C']);
    });

    it('seeds Module 1 Robot puzzles whose referenceSolutions solve their maps within slotCap', () => {
      const m1RobotPuzzles = getActivitiesForModule('module-1').filter(isValidatedPuzzleActivity);
      expect(m1RobotPuzzles.map((a) => a.id)).toEqual(
        expect.arrayContaining(['1.1', '1.2', '1.3'])
      );

      for (const activity of CURRICULUM_ACTIVITIES.filter(isValidatedPuzzleActivity)) {
        expect(isValidatedPuzzleActivity(activity)).toBe(true);
        expect(activity.version).toBeGreaterThanOrEqual(1);
        expect(activity.grid).toBeDefined();
        expect(activity.referenceSolution).toBeDefined();
        expect(activity.slotCap?.maxTotal).toBeDefined();
        expect(activity.antiBypassRules?.length).toBeGreaterThan(0);

        const initialGrid = createCurriculumGridState(activity.grid!);
        const blockCount = activity.referenceSolution!.MAIN.length;
        expect(blockCount).toBeLessThanOrEqual(activity.slotCap!.maxTotal!);

        const simResult = runHeadlessSimulation(
          activity.referenceSolution!,
          'grid',
          initialGrid,
          200
        );
        expect(simResult.status).toBe('SUCCESS');
      }
    });

    it('resolves latest and historical activity versions via getActivityLatest & getActivityAtVersion', () => {
      const latest11 = getActivityLatest('1.1');
      expect(latest11).toBeDefined();
      expect(latest11?.version).toBe(1);
      expect(getActivityAtVersion('1.1', 1)).toEqual(latest11);
      expect(getActivityAtVersion('1.1', 99)).toBeUndefined();
      expect(getActivityAtVersion('non-existent', 1)).toBeUndefined();

      const syntheticCatalog: CurriculumActivity[] = [
        {
          id: '2.1',
          moduleId: 'module-2',
          version: 2,
          format: 'puzzle',
          simId: 'grid',
          icon: '🤖',
          title: 'Synthetic Versioned Puzzle',
          concept: 'Repeat Badges',
          description: 'Updated description',
          palette: {
            allowedSimBlocks: ['MOVE_FWD'],
            allowRepeatBadges: true,
          },
          slotCap: { maxTotal: 2 },
          grid: {
            width: 5,
            height: 3,
            robot: { x: 0, y: 1, dir: 'EAST' },
            barriers: [],
            flags: [{ id: 'goal_v2', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
          },
          referenceSolution: {
            MAIN: [createCurriculumBlock('MOVE_FWD', 4)],
            F1: [],
            F2: [],
            F3: [],
          },
          historicalVersions: {
            1: {
              version: 1,
              archivedNote: 'Original 4-cell width before v2 lengthening',
              palette: {
                allowedSimBlocks: ['MOVE_FWD'],
                allowRepeatBadges: true,
              },
              slotCap: { maxTotal: 1 },
              grid: {
                width: 4,
                height: 3,
                robot: { x: 0, y: 1, dir: 'EAST' },
                barriers: [],
                flags: [{ id: 'goal_v1', x: 3, y: 1, isGoal: true, order: 1, collected: false }],
              },
              referenceSolution: {
                MAIN: [createCurriculumBlock('MOVE_FWD', 3)],
                F1: [],
                F2: [],
                F3: [],
              },
            },
          },
        },
      ];

      const v2 = getActivityAtVersion('2.1', 2, syntheticCatalog);
      expect(v2?.version).toBe(2);
      expect(v2?.grid?.width).toBe(5);
      expect(v2?.slotCap?.maxTotal).toBe(2);

      const v1 = getActivityAtVersion('2.1', 1, syntheticCatalog);
      expect(v1?.version).toBe(1);
      expect(v1?.grid?.width).toBe(4);
      expect(v1?.slotCap?.maxTotal).toBe(1);
      expect(v1?.description).toBe('Updated description');
    });
  });

  describe('Mode Switching, Read-Only Enforcement & Open Copy in Sandbox', () => {
    it('preserves Sandbox map/workspace across Sandbox ↔ Learn mode switches and per-activity workspaces across 1.1–1.3', () => {
      const store = useAppStore.getState();

      // Customize Sandbox state first
      store.setLevel(3);
      store.resizeBoard('RIGHT', 2);
      store.toggleWall({ orientation: 'V', x: 2, y: 0 });
      store.addBlock('MAIN', 'MOVE_FWD', 2);
      const sandboxWidthBefore = useAppStore.getState().grid.width;
      const sandboxBarriersBefore = useAppStore.getState().grid.barriers.length;

      // Switch to Curriculum (Learn) mode -> loads 1.1 (4x3)
      store.setAppMode('curriculum');
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('1.1');
      expect(useAppStore.getState().grid.width).toBe(4);
      expect(useAppStore.getState().grid.height).toBe(3);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Place blocks in 1.1
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

      // Switch to 1.2 -> loads 4x4 South-facing map with empty workspace
      store.setCurriculumActivity('1.2');
      expect(useAppStore.getState().activeActivityId).toBe('1.2');
      expect(useAppStore.getState().grid.width).toBe(4);
      expect(useAppStore.getState().grid.height).toBe(4);
      expect(useAppStore.getState().grid.robot.dir).toBe('SOUTH');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      store.addBlock('MAIN', 'TURN_LEFT');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);

      // Switch back to 1.1 -> preserves 1.1's 2 blocks
      store.setCurriculumActivity('1.1');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

      // Switch back to Sandbox -> restores custom Sandbox level 3 map & workspace
      store.setAppMode('sandbox');
      expect(useAppStore.getState().appMode).toBe('sandbox');
      expect(useAppStore.getState().currentLevel).toBe(3);
      expect(useAppStore.getState().grid.width).toBe(sandboxWidthBefore);
      expect(useAppStore.getState().grid.barriers.length).toBe(sandboxBarriersBefore);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
      expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(2);

      // Re-enter Learn mode -> 1.1 still has its 2 blocks
      store.setAppMode('curriculum');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    });

    it('strictly blocks all Grid map mutations and editor tools when appMode === "curriculum"', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('1.3');

      const initialGridSnapshot = JSON.stringify(useAppStore.getState().grid);
      expect(useAppStore.getState().canUndo).toBe(false);

      // Attempt every map-editing store action
      store.setEditorTool('WALL');
      expect(useAppStore.getState().editorTool).toBe('NONE');

      store.setEditorTool('ROBOT');
      expect(useAppStore.getState().editorTool).toBe('NONE');

      store.toggleWall({ orientation: 'V', x: 1, y: 0 });
      store.addWall({ orientation: 'H', x: 0, y: 1 });
      store.resizeBoard('RIGHT', 2);
      store.resizeBoard('BOTTOM', 2);
      store.resizeBoard('LEFT', 1);
      store.resizeBoard('TOP', 1);
      store.setCellContent(0, 0);
      store.clearGridUserCustoms();

      // Grid map and undo history must be 100% untouched
      expect(JSON.stringify(useAppStore.getState().grid)).toBe(initialGridSnapshot);
      expect(useAppStore.getState().canUndo).toBe(false);

      // Display toggles (Trace & Fit-to-View) remain usable in Curriculum mode
      store.toggleTrace();
      expect(useAppStore.getState().grid.showTrace).toBe(false);
      store.toggleFitToView();
      expect(useAppStore.getState().grid.fitToView).toBe(true);
    });

    it('clones active map and blocks into editable Sandbox mode via openCopyInSandbox()', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('1.2');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');

      const curriculumBlockIds = useAppStore.getState().workspace.MAIN.map((b) => b.id);
      const curriculumBarrierCount = useAppStore.getState().grid.barriers.length;

      store.openCopyInSandbox();

      const afterCopy = useAppStore.getState();
      expect(afterCopy.appMode).toBe('sandbox');
      expect(afterCopy.grid.width).toBe(4);
      expect(afterCopy.grid.height).toBe(4);
      expect(afterCopy.grid.robot.dir).toBe('SOUTH');
      expect(afterCopy.grid.barriers.length).toBe(curriculumBarrierCount);
      expect(afterCopy.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'TURN_LEFT']);
      // Fresh block IDs prevent aliasing with curriculum workspace
      expect(afterCopy.workspace.MAIN[0].id).not.toBe(curriculumBlockIds[0]);

      // Map is now freely editable in Sandbox mode!
      store.resizeBoard('RIGHT', 1);
      store.toggleWall({ orientation: 'H', x: 0, y: 1 });
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().grid.width).toBe(5);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(3);

      // Returning to Learn mode 1.2 keeps original read-only 4x4 map and 2 curriculum blocks intact
      store.setAppMode('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('1.2');
      expect(useAppStore.getState().grid.width).toBe(4);
      expect(useAppStore.getState().grid.barriers.length).toBe(curriculumBarrierCount);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    });

    it('loads curriculum referenceSolution in Learn mode and handles code imports safely', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('1.1');
      store.loadSolution();
      expect(useAppStore.getState().workspace.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'MOVE_FWD',
        'MOVE_FWD',
      ]);

      // Generic code-only import stays in curriculum mode
      const genericCode = exportToString(
        {
          MAIN: [createCurriculumBlock('MOVE_FWD')],
          F1: [],
          F2: [],
          F3: [],
        },
        'generic'
      );
      store.importCode(genericCode);
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);

      // Full Grid map snapshot import switches cleanly to Sandbox so curriculum map is not overwritten
      const customGrid = createCurriculumGridState({
        width: 6,
        height: 5,
        robot: { x: 0, y: 0, dir: 'EAST' },
        barriers: [],
        flags: [{ id: 'g', x: 5, y: 4, isGoal: true, order: 1, collected: false }],
      });
      const fullGridSave = exportToString(
        {
          MAIN: [createCurriculumBlock('MOVE_FWD', 5)],
          F1: [],
          F2: [],
          F3: [],
        },
        'grid',
        customGrid
      );
      store.importCode(fullGridSave);
      expect(useAppStore.getState().appMode).toBe('sandbox');
      expect(useAppStore.getState().grid.width).toBe(6);
      expect(useAppStore.getState().grid.height).toBe(5);
    });

    it('round-trips Curriculum mode state across PWA update snapshot & restore', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('1.3');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_BACK');

      expect(store.prepareStateForUpdate()).toBe(true);

      // Reset store to Sandbox defaults as if reloading the page
      store.setAppMode('sandbox');
      store.setLevel(1);
      store.clearWorkspace();
      expect(useAppStore.getState().appMode).toBe('sandbox');

      expect(useAppStore.getState().hydrateFromUpdateIfPresent()).toBe(true);

      const restored = useAppStore.getState();
      expect(restored.appMode).toBe('curriculum');
      expect(restored.activeActivityId).toBe('1.3');
      expect(restored.activeActivityVersion).toBe(1);
      expect(restored.editorTool).toBe('NONE');
      expect(restored.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'MOVE_BACK']);
      expect(restored.curriculumWorkspaces['1.3']?.MAIN.map((b) => b.type)).toEqual([
        'MOVE_FWD',
        'MOVE_BACK',
      ]);
    });
  });

  describe('GridOverlayLayer Pluggable Mount Points', () => {
    it('renders isolated SVG <g> mount slots for C6, C7, C8a, and C14 without overlap conflicts', () => {
      const sampleGrid = createCurriculumGridState(CURRICULUM_ACTIVITIES[0].grid!);

      const allMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid: sampleGrid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
            isReadOnly: true,
            layer: 'all',
            worldItemsSlot: React.createElement('circle', { id: 'mock-world-item', r: 5 }),
            flagPadlockSlot: React.createElement('rect', { id: 'mock-padlock', width: 8, height: 8 }),
            ghostStepSlot: React.createElement('circle', { id: 'mock-ghost', r: 10 }),
            demoSpotlightSlot: React.createElement('circle', { id: 'mock-spotlight', r: 12 }),
          })
        )
      );

      expect(allMarkup).toContain('data-testid="grid-overlay-layer"');
      expect(allMarkup).toContain('data-testid="grid-slot-world-items"');
      expect(allMarkup).toContain('data-testid="grid-slot-flag-padlocks"');
      expect(allMarkup).toContain('data-testid="grid-slot-ghost-preview"');
      expect(allMarkup).toContain('data-testid="grid-slot-demo-spotlights"');
      expect(allMarkup).toContain('id="mock-world-item"');
      expect(allMarkup).toContain('id="mock-padlock"');
      expect(allMarkup).toContain('id="mock-ghost"');
      expect(allMarkup).toContain('id="mock-spotlight"');

      const underOnlyMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid: sampleGrid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
            isReadOnly: true,
            layer: 'under-robot',
          })
        )
      );
      expect(underOnlyMarkup).toContain('data-testid="grid-slot-world-items"');
      expect(underOnlyMarkup).not.toContain('data-testid="grid-slot-flag-padlocks"');

      const overOnlyMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid: sampleGrid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
            isReadOnly: true,
            layer: 'over-robot',
          })
        )
      );
      expect(overOnlyMarkup).not.toContain('data-testid="grid-slot-world-items"');
      expect(overOnlyMarkup).toContain('data-testid="grid-slot-flag-padlocks"');
      expect(overOnlyMarkup).toContain('data-testid="grid-slot-ghost-preview"');
      expect(overOnlyMarkup).toContain('data-testid="grid-slot-demo-spotlights"');
    });
  });
});
