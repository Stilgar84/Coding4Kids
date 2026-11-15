import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRICULUM_ACTIVITIES,
  CurriculumActivity,
  createCurriculumBlock,
  createCurriculumGridState,
  getCurriculumModules,
  getCurriculumModule,
  getActivitiesForModule,
  getActivityLatest,
  getActivityAtVersion,
  getActivityVariants,
  isValidatedPuzzleActivity,
  resolveActivityIdAlias,
  resolveModuleIdAlias,
} from '../src/data/curriculum';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { exportToString } from '../src/engine/serialization/codeSerializer';
import { clearPendingUpdateState } from '../src/services/pwaStateRestoreService';
import { GridOverlayLayer, GRID_CELL_SIZE } from '../src/simulations/grid/components/GridOverlayLayer';
import { createInitialDepotState } from '../src/simulations/depot/depotPhysics';
import { useAppStore } from '../src/store/useAppStore';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';
import '../src/simulations/turtle/turtleEnvironment';

const INITIAL_BOOT_STATE = {
  appMode: useAppStore.getState().appMode,
  activeActivityId: useAppStore.getState().activeActivityId,
  editorTool: useAppStore.getState().editorTool,
};

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
      activeActivityId: 'seq.1',
      activeActivityVersion: 1,
    });
    useAppStore.getState().clearHistory();
  });

  describe('Curriculum Module & Activity Schema', () => {
    it('declares static badgeId and capstoneIds for registered modules (seq..while) and resolves legacy aliases', () => {
      const modules = getCurriculumModules();
      expect(modules).toHaveLength(6);
      expect(modules.map((m) => m.id)).toEqual(['seq', 'param', 'loop', 'func', 'branch', 'while']);

      const seq = getCurriculumModule('seq')!;
      expect(seq.badgeId).toBe('badge-seq');
      expect(seq.capstoneIds).toEqual(['seq.A', 'seq.B', 'seq.C']);

      const param = getCurriculumModule('param')!;
      expect(param.badgeId).toBe('badge-param');
      expect(param.capstoneIds).toEqual(['param.C', 'param.A', 'param.B']);

      const loop = getCurriculumModule('loop')!;
      expect(loop.badgeId).toBe('badge-loop');
      expect(loop.capstoneIds).toEqual(['loop.A', 'loop.B', 'loop.C']);

      const func = getCurriculumModule('func')!;
      expect(func.badgeId).toBe('badge-func');
      expect(func.capstoneIds).toEqual(['func.A', 'func.B', 'func.C']);

      const branch = getCurriculumModule('branch')!;
      expect(branch.badgeId).toBe('badge-branch');
      expect(branch.capstoneIds).toEqual(['branch.A', 'branch.B', 'branch.C']);

      const whileMod = getCurriculumModule('while')!;
      expect(whileMod.badgeId).toBe('badge-while');
      expect(whileMod.capstoneIds).toEqual(['while.A', 'while.B', 'while.C']);

      // Backward-compatibility alias lookup
      expect(resolveModuleIdAlias('module-1')).toBe('seq');
      expect(resolveModuleIdAlias('module-4')).toBe('func');
      expect(resolveModuleIdAlias('module-5')).toBe('branch');
      expect(resolveActivityIdAlias('1.0')).toBe('seq.0');
      expect(resolveActivityIdAlias('2.5a')).toBe('param.6');
      expect(resolveActivityIdAlias('3.8')).toBe('loop.8');
      expect(resolveActivityIdAlias('4C')).toBe('func.C');
      expect(resolveActivityIdAlias('5.5a')).toBe('branch.5a');
      expect(resolveActivityIdAlias('5B')).toBe('branch.B');
      expect(getCurriculumModule('module-2')?.id).toBe('param');
      expect(getActivityLatest('2.5a')?.id).toBe('param.6');
    });

    it('seeds validated puzzles whose referenceSolutions solve their maps/variants within slotCap', () => {
      const seqRobotPuzzles = getActivitiesForModule('seq').filter(isValidatedPuzzleActivity);
      expect(seqRobotPuzzles.map((a) => a.id)).toEqual(
        expect.arrayContaining(['seq.1', 'seq.2', 'seq.2a', 'seq.3'])
      );

      for (const activity of CURRICULUM_ACTIVITIES.filter(isValidatedPuzzleActivity)) {
        expect(isValidatedPuzzleActivity(activity)).toBe(true);
        expect(activity.version).toBeGreaterThanOrEqual(1);
        expect(activity.referenceSolution).toBeDefined();
        expect(activity.antiBypassRules?.length).toBeGreaterThan(0);

        const sol = activity.referenceSolution!;
        const totalBlocks =
          sol.MAIN.length + sol.F1.length + sol.F2.length + sol.F3.length;
        if (activity.slotCap?.maxTotal !== undefined) {
          expect(totalBlocks).toBeLessThanOrEqual(activity.slotCap.maxTotal);
        }
        if (activity.slotCap?.perScope) {
          for (const scope of ['MAIN', 'F1', 'F2', 'F3'] as const) {
            const cap = activity.slotCap.perScope[scope];
            if (cap !== undefined) {
              expect(sol[scope].length).toBeLessThanOrEqual(cap);
            }
          }
        }

        const variants = getActivityVariants(activity, activity.simId);
        expect(variants.length).toBeGreaterThan(0);

        for (const variant of variants) {
          if (variant.kind === 'depot' && variant.depot) {
            const initialDepot = createInitialDepotState(variant.depot);
            const simResult = runHeadlessSimulation(sol, 'depot', initialDepot);
            expect(simResult.status, `${activity.id} (${variant.label})`).toBe('SUCCESS');
          } else if (variant.kind === 'grid' && variant.grid) {
            const initialGrid = createCurriculumGridState(variant.grid);
            const simResult = runHeadlessSimulation(sol, 'grid', initialGrid);
            expect(simResult.status, `${activity.id} (${variant.label})`).toBe('SUCCESS');
          }
        }
      }
    });

    it('resolves latest and historical activity versions via getActivityLatest & getActivityAtVersion', () => {
      const latestSeq1 = getActivityLatest('seq.1');
      expect(latestSeq1).toBeDefined();
      expect(latestSeq1?.version).toBe(1);
      expect(getActivityAtVersion('seq.1', 1)).toEqual(latestSeq1);
      expect(getActivityAtVersion('seq.1', 99)).toBeUndefined();
      expect(getActivityAtVersion('non-existent', 1)).toBeUndefined();

      const syntheticCatalog: CurriculumActivity[] = [
        {
          id: 'param.1',
          moduleId: 'param',
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

      const v2 = getActivityAtVersion('param.1', 2, syntheticCatalog);
      expect(v2?.version).toBe(2);
      expect(v2?.grid?.width).toBe(5);
      expect(v2?.slotCap?.maxTotal).toBe(2);

      const v1 = getActivityAtVersion('param.1', 1, syntheticCatalog);
      expect(v1?.version).toBe(1);
      expect(v1?.grid?.width).toBe(4);
      expect(v1?.slotCap?.maxTotal).toBe(1);
      expect(v1?.description).toBe('Updated description');
    });
  });

  describe('Mode Switching, Read-Only Enforcement & Open Copy in Sandbox', () => {
    it('boots in Learn mode (curriculum) on the initial activity with map editing disabled', () => {
      expect(INITIAL_BOOT_STATE.appMode).toBe('curriculum');
      expect(INITIAL_BOOT_STATE.activeActivityId).toBe('seq.0');
      expect(INITIAL_BOOT_STATE.editorTool).toBe('NONE');
    });

    it('preserves Sandbox map/workspace across Sandbox ↔ Learn mode switches and per-activity workspaces across seq.1–seq.3', () => {
      const store = useAppStore.getState();

      // Customize Sandbox state first
      store.setLevel(3);
      store.resizeBoard('RIGHT', 2);
      store.toggleWall({ orientation: 'V', x: 2, y: 0 });
      store.addBlock('MAIN', 'MOVE_FWD', 2);
      const sandboxWidthBefore = useAppStore.getState().grid.width;
      const sandboxBarriersBefore = useAppStore.getState().grid.barriers.length;

      // Switch to Curriculum (Learn) mode -> loads seq.1 (4x4)
      store.setAppMode('curriculum');
      expect(useAppStore.getState().appMode).toBe('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('seq.1');
      expect(useAppStore.getState().grid.width).toBe(4);
      expect(useAppStore.getState().grid.height).toBe(4);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      // Place blocks in seq.1
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

      // Switch to seq.2a -> loads 3x3 South-facing map with empty workspace
      store.setCurriculumActivity('seq.2a');
      expect(useAppStore.getState().activeActivityId).toBe('seq.2a');
      expect(useAppStore.getState().grid.width).toBe(3);
      expect(useAppStore.getState().grid.height).toBe(3);
      expect(useAppStore.getState().grid.robot.dir).toBe('SOUTH');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(0);

      store.addBlock('MAIN', 'TURN_LEFT');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);

      // Switch back to seq.1 -> preserves seq.1's 2 blocks
      store.setCurriculumActivity('seq.1');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);

      // Switch back to Sandbox -> restores custom Sandbox level 3 map & workspace
      store.setAppMode('sandbox');
      expect(useAppStore.getState().appMode).toBe('sandbox');
      expect(useAppStore.getState().currentLevel).toBe(3);
      expect(useAppStore.getState().grid.width).toBe(sandboxWidthBefore);
      expect(useAppStore.getState().grid.barriers.length).toBe(sandboxBarriersBefore);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(1);
      expect(useAppStore.getState().workspace.MAIN[0].repeatCount).toBe(2);

      // Re-enter Learn mode -> seq.1 still has its 2 blocks
      store.setAppMode('curriculum');
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    });

    it('strictly blocks all Grid map mutations and editor tools when appMode === "curriculum"', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('seq.3');

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
      store.setCurriculumActivity('seq.2a');
      store.addBlock('MAIN', 'MOVE_FWD');
      store.addBlock('MAIN', 'TURN_LEFT');

      const curriculumBlockIds = useAppStore.getState().workspace.MAIN.map((b) => b.id);
      const curriculumBarrierCount = useAppStore.getState().grid.barriers.length;

      store.openCopyInSandbox();

      const afterCopy = useAppStore.getState();
      expect(afterCopy.appMode).toBe('sandbox');
      expect(afterCopy.grid.width).toBe(3);
      expect(afterCopy.grid.height).toBe(3);
      expect(afterCopy.grid.robot.dir).toBe('SOUTH');
      expect(afterCopy.grid.barriers.length).toBe(curriculumBarrierCount);
      expect(afterCopy.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'TURN_LEFT']);
      // Fresh block IDs prevent aliasing with curriculum workspace
      expect(afterCopy.workspace.MAIN[0].id).not.toBe(curriculumBlockIds[0]);

      // Map is now freely editable in Sandbox mode!
      store.resizeBoard('RIGHT', 1);
      store.toggleWall({ orientation: 'H', x: 0, y: 1 });
      store.addBlock('MAIN', 'MOVE_FWD');
      expect(useAppStore.getState().grid.width).toBe(4);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(3);

      // Returning to Learn mode seq.2a keeps original read-only 3x3 map and 2 curriculum blocks intact
      store.setAppMode('curriculum');
      expect(useAppStore.getState().activeActivityId).toBe('seq.2a');
      expect(useAppStore.getState().grid.width).toBe(3);
      expect(useAppStore.getState().grid.barriers.length).toBe(curriculumBarrierCount);
      expect(useAppStore.getState().workspace.MAIN).toHaveLength(2);
    });

    it('loads curriculum referenceSolution in Learn mode and handles code imports safely', () => {
      const store = useAppStore.getState();
      store.setCurriculumActivity('seq.1');
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
      store.setCurriculumActivity('seq.3');
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
      expect(restored.activeActivityId).toBe('seq.3');
      expect(restored.activeActivityVersion).toBe(1);
      expect(restored.editorTool).toBe('NONE');
      expect(restored.workspace.MAIN.map((b) => b.type)).toEqual(['MOVE_FWD', 'MOVE_BACK']);
      expect(restored.curriculumWorkspaces['seq.3']?.MAIN.map((b) => b.type)).toEqual([
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
            beaconAndDialSlot: React.createElement('rect', { id: 'mock-beacon', width: 20, height: 20 }),
            worldItemsSlot: React.createElement('circle', { id: 'mock-world-item', r: 5 }),
            flagPadlockSlot: React.createElement('rect', { id: 'mock-padlock', width: 8, height: 8 }),
            ghostStepSlot: React.createElement('circle', { id: 'mock-ghost', r: 10 }),
            demoSpotlightSlot: React.createElement('circle', { id: 'mock-spotlight', r: 12 }),
          })
        )
      );

      expect(allMarkup).toContain('data-testid="grid-overlay-layer"');
      expect(allMarkup).toContain('data-testid="grid-slot-beacon-dial"');
      expect(allMarkup).toContain('data-testid="grid-slot-world-items"');
      expect(allMarkup).toContain('data-testid="grid-slot-flag-padlocks"');
      expect(allMarkup).toContain('data-testid="grid-slot-ghost-preview"');
      expect(allMarkup).toContain('data-testid="grid-slot-demo-spotlights"');
      expect(allMarkup).toContain('id="mock-beacon"');
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
      expect(underOnlyMarkup).toContain('data-testid="grid-slot-beacon-dial"');
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
      expect(overOnlyMarkup).not.toContain('data-testid="grid-slot-beacon-dial"');
      expect(overOnlyMarkup).not.toContain('data-testid="grid-slot-world-items"');
      expect(overOnlyMarkup).toContain('data-testid="grid-slot-flag-padlocks"');
      expect(overOnlyMarkup).toContain('data-testid="grid-slot-ghost-preview"');
      expect(overOnlyMarkup).toContain('data-testid="grid-slot-demo-spotlights"');
    });
  });
});
