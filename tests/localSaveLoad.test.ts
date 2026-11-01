import { describe, it, expect, beforeEach } from 'vitest';
import { runHeadlessSimulation, MAX_SAVE_SIMULATION_STEPS } from '../src/engine/simulationRunner';
import {
  generateGridMapThumbnail,
  generateTurtleMapThumbnail,
  generateSimulationThumbnail,
} from '../src/services/mapThumbnailGenerator';
import {
  saveProgram,
  getSavedPrograms,
  deleteProgram,
  getProgramById,
  clearAllSavedPrograms,
  migrateSavedEntry,
  CURRENT_STORAGE_VERSION,
} from '../src/services/localSaveService';
import { exportToString, importFromString } from '../src/engine/serialization/codeSerializer';
import { GridState, WorkspaceState } from '../src/types';
import { TurtleState } from '../src/simulations/turtle/types';
import { createDefaultGridState } from '../src/simulations/grid/gridEnvironment';
import { createInitialTurtleState } from '../src/simulations/turtle/turtleEnvironment';

describe('Local Save and Load Feature Tests', () => {
  beforeEach(() => {
    clearAllSavedPrograms();
  });

  describe('1. Headless Simulation Runner', () => {
    it('runs simulation to SUCCESS when program reaches goal flag', () => {
      // Setup a simple grid: robot at (0, 0) facing EAST, goal at (2, 0)
      const gridState: GridState = {
        width: 3,
        height: 3,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        barriers: [],
        flags: [{ id: 'goal', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 0, y: 0 }],
        status: 'IDLE',
      };

      const workspace: WorkspaceState = {
        MAIN: [
          { id: '1', type: 'MOVE_FWD', repeatCount: 1 },
          { id: '2', type: 'MOVE_FWD', repeatCount: 1 },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const result = runHeadlessSimulation(workspace, 'grid', gridState);
      expect(result.status).toBe('SUCCESS');
      expect(result.stepCount).toBe(2);
      expect(result.finalState.robot.x).toBe(2);
      expect(result.finalState.robot.y).toBe(0);
      expect(result.finalState.trace.length).toBe(3);
    });

    it('detects COLLISION when robot walks into boundary or barrier', () => {
      // Robot at (0, 0) facing NORTH, moving forward hits top boundary
      const gridState: GridState = {
        width: 3,
        height: 3,
        robot: { x: 0, y: 0, dir: 'NORTH', initialX: 0, initialY: 0, initialDir: 'NORTH' },
        barriers: [],
        flags: [{ id: 'goal', x: 2, y: 2, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 0, y: 0 }],
        status: 'IDLE',
      };

      const workspace: WorkspaceState = {
        MAIN: [{ id: '1', type: 'MOVE_FWD', repeatCount: 1 }],
        F1: [],
        F2: [],
        F3: [],
      };

      const result = runHeadlessSimulation(workspace, 'grid', gridState);
      expect(result.status).toBe('COLLISION');
      expect(result.stepCount).toBe(1);
    });

    it('enforces MAX_SAVE_SIMULATION_STEPS (1000 limit) on infinite or long loops', () => {
      // Loop forever: TURN_LEFT repeatedly
      const gridState = createDefaultGridState();
      const workspace: WorkspaceState = {
        MAIN: [
          { id: 'loop1', type: 'LOOP_START', repeatCount: 999 },
          { id: 'turn1', type: 'TURN_LEFT', repeatCount: 1 },
          { id: 'loop2', type: 'LOOP_END' },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const result = runHeadlessSimulation(workspace, 'grid', gridState, MAX_SAVE_SIMULATION_STEPS);
      expect(result.stepCount).toBe(MAX_SAVE_SIMULATION_STEPS);
      expect(result.stepCount).toBe(1000);
      // Status should remain IDLE (runner limit reached before interpreter safety guard)
      expect(result.status).toBe('IDLE');
    });

    it('handles loop validation errors safely without throwing', () => {
      const gridState = createDefaultGridState();
      // Unclosed loop
      const workspace: WorkspaceState = {
        MAIN: [
          { id: 'loop1', type: 'LOOP_START', repeatCount: 3 },
          { id: 'turn1', type: 'TURN_LEFT', repeatCount: 1 },
        ],
        F1: [],
        F2: [],
        F3: [],
      };

      const result = runHeadlessSimulation(workspace, 'grid', gridState);
      expect(result.stepCount).toBe(0);
      expect(result.status).toBe('IDLE');
    });

    it('handles empty workspace safely', () => {
      const gridState = createDefaultGridState();
      const workspace: WorkspaceState = { MAIN: [], F1: [], F2: [], F3: [] };
      const result = runHeadlessSimulation(workspace, 'grid', gridState);
      expect(result.stepCount).toBe(0);
      expect(result.status).toBe('IDLE');
    });
  });

  describe('2. Map Thumbnail Generator', () => {
    it('generates a valid SVG data URI with white background for Grid World', () => {
      const gridState: GridState = {
        width: 4,
        height: 4,
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        barriers: [{ orientation: 'H', x: 1, y: 1 }],
        flags: [
          { id: 'f1', x: 2, y: 1, isGoal: false, order: 1, collected: true },
          { id: 'goal', x: 3, y: 1, isGoal: true, order: 2, collected: false },
        ],
        trace: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        status: 'IDLE',
      };

      const dataUri = generateGridMapThumbnail(gridState);
      expect(dataUri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

      const decodedSvg = decodeURIComponent(dataUri.replace('data:image/svg+xml;charset=utf-8,', ''));
      // Must contain white background
      expect(decodedSvg).toContain('fill="#ffffff"');
      // Must contain grid lines / checkerboard
      expect(decodedSvg).toContain('#e2e8f0');
      // Must contain trace path
      expect(decodedSvg).toContain('stroke="#0284c7"');
      // Must contain barrier
      expect(decodedSvg).toContain('fill="#ef4444"');
      // Must contain goal flag
      expect(decodedSvg).toContain('🏁');
      // Must contain robot
      expect(decodedSvg).toContain('polygon');
    });

    it('generates a valid SVG data URI with white background for Turtle World', () => {
      const turtleState: TurtleState = {
        ...createInitialTurtleState(),
        robot: { x: 50, y: -50, heading: 45 },
        paths: [
          { type: 'LINE', fromX: 0, fromY: 0, toX: 50, toY: -50, color: '#0f172a', width: 4 },
        ],
      };

      const dataUri = generateTurtleMapThumbnail(turtleState);
      expect(dataUri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);

      const decodedSvg = decodeURIComponent(dataUri.replace('data:image/svg+xml;charset=utf-8,', ''));
      expect(decodedSvg).toContain('fill="#ffffff"');
      expect(decodedSvg).toContain('<line');
      expect(decodedSvg).toContain('stroke="#0f172a"');
    });

    it('dispatches properly through generateSimulationThumbnail', () => {
      const gridState = createDefaultGridState();
      const turtleState = createInitialTurtleState();

      const gridThumb = generateSimulationThumbnail('grid', gridState);
      const turtleThumb = generateSimulationThumbnail('turtle', turtleState);

      expect(gridThumb).toMatch(/^data:image\/svg\+xml;/);
      expect(turtleThumb).toMatch(/^data:image\/svg\+xml;/);
      expect(gridThumb).not.toBe(turtleThumb);
    });
  });

  describe('3. Local Save Service & Migrations', () => {
    it('saves, retrieves, and deletes program entries', () => {
      const saved = saveProgram({
        title: 'My Custom Maze',
        simId: 'grid',
        code: 'TEST_BASE64_CODE',
        screenshot: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E',
        status: 'SUCCESS',
        stepCount: 15,
        levelId: 2,
      });

      expect(saved.id).toBeDefined();
      expect(saved.version).toBe(CURRENT_STORAGE_VERSION);
      expect(saved.title).toBe('My Custom Maze');
      expect(saved.createdAt).toBeGreaterThan(0);

      const list = getSavedPrograms();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(saved.id);
      expect(list[0].status).toBe('SUCCESS');

      const found = getProgramById(saved.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('My Custom Maze');

      const deleted = deleteProgram(saved.id);
      expect(deleted).toBe(true);
      expect(getSavedPrograms().length).toBe(0);
    });

    it('handles backward compatibility for unversioned and legacy entries', () => {
      const legacyEntry = {
        id: 'legacy_1',
        title: 'Old Program',
        code: 'VALID_CODE',
        // version is missing
        // simId is missing
        // status is missing
        // stepCount is missing
      };

      const migrated = migrateSavedEntry(legacyEntry);
      expect(migrated).not.toBeNull();
      expect(migrated?.version).toBe(CURRENT_STORAGE_VERSION);
      expect(migrated?.simId).toBe('grid'); // Default fallback
      expect(migrated?.status).toBe('IDLE'); // Default fallback
      expect(migrated?.stepCount).toBe(0); // Default fallback
      expect(migrated?.screenshot).toMatch(/^data:image\/svg\+xml/); // Fallback screenshot
    });

    it('safely rejects completely invalid entries', () => {
      expect(migrateSavedEntry(null)).toBeNull();
      expect(migrateSavedEntry('string')).toBeNull();
      expect(migrateSavedEntry({})).toBeNull(); // Missing code
      expect(migrateSavedEntry({ code: '   ' })).toBeNull(); // Empty code
    });
  });

  describe('4. Binary Serialization Round-Trip', () => {
    it('saves compact binary code that imports back cleanly', () => {
      const gridState: GridState = {
        width: 6,
        height: 6,
        robot: { x: 2, y: 3, dir: 'WEST', initialX: 2, initialY: 3, initialDir: 'WEST' },
        barriers: [{ orientation: 'V', x: 2, y: 3 }],
        flags: [{ id: 'flag_goal', x: 5, y: 5, isGoal: true, order: 1, collected: false }],
        trace: [{ x: 2, y: 3 }],
        status: 'IDLE',
      };

      const workspace: WorkspaceState = {
        MAIN: [
          { id: 'b1', type: 'MOVE_FWD', repeatCount: 3 },
          { id: 'b2', type: 'TURN_LEFT', repeatCount: 1 },
          { id: 'b3', type: 'CALL_F1', repeatCount: 1 },
        ],
        F1: [{ id: 'b4', type: 'MOVE_BACK', repeatCount: 2 }],
        F2: [],
        F3: [],
      };

      // Export using binary_format.md serializer
      const binaryString = exportToString(workspace, 'grid', gridState);
      expect(binaryString.length).toBeGreaterThan(10);

      // Save via localSaveService
      const saved = saveProgram({
        title: 'Round Trip Test',
        simId: 'grid',
        code: binaryString,
        screenshot: generateGridMapThumbnail(gridState),
        status: 'IDLE',
        stepCount: 6,
      });

      // Retrieve and deserialize
      const fetched = getProgramById(saved.id);
      expect(fetched).not.toBeNull();

      const importResult = importFromString(fetched!.code);
      expect(importResult.success).toBe(true);
      expect(importResult.envId).toBe('grid');

      // Check workspace blocks match
      expect(importResult.workspace?.MAIN.length).toBe(3);
      expect(importResult.workspace?.MAIN[0].type).toBe('MOVE_FWD');
      expect(importResult.workspace?.MAIN[0].repeatCount).toBe(3);
      expect(importResult.workspace?.MAIN[1].type).toBe('TURN_LEFT');
      expect(importResult.workspace?.MAIN[2].type).toBe('CALL_F1');
      expect(importResult.workspace?.F1.length).toBe(1);
      expect(importResult.workspace?.F1[0].type).toBe('MOVE_BACK');

      // Check grid environment match
      expect(importResult.gridState?.width).toBe(6);
      expect(importResult.gridState?.height).toBe(6);
      expect(importResult.gridState?.robot.x).toBe(2);
      expect(importResult.gridState?.robot.y).toBe(3);
      expect(importResult.gridState?.robot.dir).toBe('WEST');
      expect(importResult.gridState?.barriers.length).toBe(1);
    });
  });
});
