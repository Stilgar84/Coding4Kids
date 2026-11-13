import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  GridState,
  WorkspaceState,
  BeaconTile,
  DialTile,
} from '../src/types';
import {
  evaluateGridSensor,
  readGridSensor,
  BEACON_COLOR_PALETTE_INDEX,
} from '../src/simulations/grid/sensors';
import {
  writeGridState,
  readGridState,
  getGridSerializationVersion,
} from '../src/engine/serialization/env/gridSerializer';
import {
  BinaryWriter,
} from '../src/engine/serialization/binaryWriter';
import {
  BinaryReader,
} from '../src/engine/serialization/binaryReader';
import {
  ENV_VERSION_GRID,
  ENV_VERSION_GRID_V2,
  ENV_VERSION_GRID_V3,
} from '../src/engine/serialization/types';
import {
  executeRobotAction,
  resetGridInteractiveState,
  isFlagPadlocked,
} from '../src/engine/physics';
import { gridSimulationEnvironment } from '../src/simulations/grid/gridEnvironment';
import { BeaconAndDialLayer } from '../src/simulations/grid/components/BeaconAndDialLayer';
import { BackpackHud } from '../src/simulations/grid/components/WorldItemsLayer';
import { GridToolbarTools } from '../src/simulations/grid/components/GridToolbarTools';
import { renderGridMapSvg } from '../src/services/mapThumbnailGenerator';
import { useAppStore } from '../src/store/useAppStore';

function makeBaseGrid(overrides: Partial<GridState> = {}): GridState {
  return {
    width: 5,
    height: 5,
    robot: {
      x: 1,
      y: 1,
      dir: 'EAST',
      initialX: 1,
      initialY: 1,
      initialDir: 'EAST',
    },
    barriers: [],
    flags: [{ id: 'goal', x: 4, y: 1, isGoal: true, order: 1, collected: false }],
    trace: [{ x: 1, y: 1 }],
    status: 'IDLE',
    showTrace: true,
    ...overrides,
  };
}

describe('Commit 22: Grid envVersion=3, Sensors, Dials, Beacons & Stack Depots', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.pause();
    store.setSpeed(400);
    store.setAppMode('sandbox');
    store.setSimEnvironment('grid');
    store.setLevel(1);
    store.setEditorTool('NONE');
    store.clearWorkspace();
    store.clearHistory();
  });

  describe('Grid v3 Serialization & Version Deduction', () => {
    it('deduces version 1 for classic maps', () => {
      const grid = makeBaseGrid();
      expect(getGridSerializationVersion(grid)).toBe(ENV_VERSION_GRID);
    });

    it('deduces version 2 for M2 interactive terrain and items', () => {
      const grid = makeBaseGrid({
        waterCells: [{ x: 2, y: 1 }],
      });
      expect(getGridSerializationVersion(grid)).toBe(ENV_VERSION_GRID_V2);
    });

    it('deduces version 3 when beacons or dials exist', () => {
      const beaconGrid = makeBaseGrid({
        beaconTiles: [{ x: 2, y: 1, color: 'blue', shape: 'triangle' }],
      });
      expect(getGridSerializationVersion(beaconGrid)).toBe(ENV_VERSION_GRID_V3);

      const dialGrid = makeBaseGrid({
        dialTiles: [{ x: 2, y: 1, value: 5 }],
      });
      expect(getGridSerializationVersion(dialGrid)).toBe(ENV_VERSION_GRID_V3);
    });

    it('deduces version 3 when stack depots exist', () => {
      const stackGrid = makeBaseGrid({
        worldItems: [{ id: 'depot_1', type: 'crate', x: 2, y: 1, count: 4 }],
      });
      expect(getGridSerializationVersion(stackGrid)).toBe(ENV_VERSION_GRID_V3);
    });

    it('deduces version 3 when validation rule flags are present', () => {
      const rulesGrid = makeBaseGrid({
        strictInteractionCollision: true,
      });
      expect(getGridSerializationVersion(rulesGrid)).toBe(ENV_VERSION_GRID_V3);
    });

    it('round-trips classic v1 maps byte-for-byte identically', () => {
      const grid = makeBaseGrid({
        barriers: [{ orientation: 'V', x: 2, y: 1 }],
      });
      const writer = new BinaryWriter();
      writeGridState(writer, grid, ENV_VERSION_GRID);
      const bytes = writer.getBytes();

      const reader = new BinaryReader(bytes);
      const decoded = readGridState(reader, ENV_VERSION_GRID);

      expect(decoded.width).toBe(grid.width);
      expect(decoded.height).toBe(grid.height);
      expect(decoded.robot.x).toBe(grid.robot.x);
      expect(decoded.robot.dir).toBe(grid.robot.dir);
      expect(decoded.barriers).toEqual(grid.barriers);
      expect(decoded.flags).toHaveLength(1);
    });

    it('round-trips v2 interactive maps losslessly', () => {
      const grid = makeBaseGrid({
        waterCells: [{ x: 2, y: 2 }],
        lockedGates: [{ id: 'gate_1', x: 3, y: 1, shape: 'triangle', color: 'emerald' }],
        floorSwitches: [{ id: 'sw_1', x: 1, y: 2, requiredForGoal: true }],
        worldItems: [{ id: 'item_1', type: 'crate', x: 1, y: 2 }],
      });

      const writer = new BinaryWriter();
      writeGridState(writer, grid, ENV_VERSION_GRID_V2);
      const bytes = writer.getBytes();

      const reader = new BinaryReader(bytes);
      const decoded = readGridState(reader, ENV_VERSION_GRID_V2);

      expect(decoded.waterCells).toEqual(grid.waterCells);
      expect(decoded.lockedGates).toHaveLength(1);
      expect(decoded.lockedGates![0].shape).toBe('triangle');
      expect(decoded.lockedGates![0].color).toBe('emerald');
      expect(decoded.floorSwitches).toHaveLength(1);
      expect(decoded.worldItems).toHaveLength(1);
      expect(decoded.beaconTiles).toBeUndefined();
    });

    it('round-trips v3 maps with beacons, dials, stackable depots, and rules losslessly', () => {
      const v3Grid = makeBaseGrid({
        waterCells: [{ x: 0, y: 2 }],
        beaconTiles: [
          { x: 1, y: 1, color: 'red', shape: 'circle' },
          { x: 3, y: 1, color: 'yellow', shape: 'diamond' },
        ],
        dialTiles: [
          { x: 2, y: 1, value: 7 },
          { x: 3, y: 3, value: 14 },
        ],
        worldItems: [
          { id: 'key_1', type: 'key', x: 0, y: 1, shape: 'circle', color: 'amber' },
          { id: 'stack_1', type: 'crate', x: 2, y: 2, count: 5 },
        ],
        strictInteractionCollision: true,
        requireAllItemsCollected: true,
        requireEmptyBackpackAtGoal: true,
      });

      const writer = new BinaryWriter();
      writeGridState(writer, v3Grid);
      const bytes = writer.getBytes();

      const reader = new BinaryReader(bytes);
      const decoded = readGridState(reader, ENV_VERSION_GRID_V3);

      expect(decoded.strictInteractionCollision).toBe(true);
      expect(decoded.requireAllItemsCollected).toBe(true);
      expect(decoded.requireEmptyBackpackAtGoal).toBe(true);
      expect(decoded.beaconTiles).toEqual(v3Grid.beaconTiles);
      expect(decoded.dialTiles).toEqual(v3Grid.dialTiles);
      expect(decoded.worldItems).toHaveLength(2);
      expect(decoded.worldItems![0].type).toBe('key');
      expect(decoded.worldItems![1].type).toBe('crate');
      expect(decoded.worldItems![1].count).toBe(5);
    });
  });

  describe('Boolean and Numeric Sensor Evaluation (sensors.ts)', () => {
    it('evaluates pathAhead, pathLeft, and pathRight around walls and borders', () => {
      const grid = makeBaseGrid({
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 1, initialY: 1, initialDir: 'EAST' },
        barriers: [{ orientation: 'V', x: 2, y: 1 }], // vertical wall between (1,1) and (2,1)
      });

      // Ahead is East: blocked by barrier
      expect(evaluateGridSensor({ type: 'pathAhead' }, grid)).toBe(false);

      // Left is North (1,0): in-bounds, no wall
      expect(evaluateGridSensor({ type: 'pathLeft' }, grid)).toBe(true);

      // Right is South (1,2): in-bounds, no wall
      expect(evaluateGridSensor({ type: 'pathRight' }, grid)).toBe(true);
    });

    it('evaluates pathAhead false when facing boundary or unbridged water or locked gate', () => {
      const waterGrid = makeBaseGrid({
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 1, initialY: 1, initialDir: 'EAST' },
        waterCells: [{ x: 2, y: 1 }],
      });
      expect(evaluateGridSensor({ type: 'pathAhead' }, waterGrid)).toBe(false);

      const gateGrid = makeBaseGrid({
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 1, initialY: 1, initialDir: 'EAST' },
        lockedGates: [{ id: 'gate_1', x: 2, y: 1, shape: 'circle', color: 'amber', unlocked: false }],
      });
      expect(evaluateGridSensor({ type: 'pathAhead' }, gateGrid)).toBe(false);

      const borderGrid = makeBaseGrid({
        robot: { x: 4, y: 1, dir: 'EAST', initialX: 4, initialY: 1, initialDir: 'EAST' },
      });
      expect(evaluateGridSensor({ type: 'pathAhead' }, borderGrid)).toBe(false);
    });

    it('evaluates itemHere and carryingItem correctly', () => {
      const emptyGrid = makeBaseGrid();
      expect(evaluateGridSensor({ type: 'itemHere' }, emptyGrid)).toBe(false);
      expect(evaluateGridSensor({ type: 'carryingItem' }, emptyGrid)).toBe(false);

      const itemGrid = makeBaseGrid({
        worldItems: [{ id: 'item_1', type: 'crate', x: 1, y: 1 }],
      });
      expect(evaluateGridSensor({ type: 'itemHere' }, itemGrid)).toBe(true);

      const carriedGrid = makeBaseGrid({
        robot: {
          x: 1,
          y: 1,
          dir: 'EAST',
          initialX: 1,
          initialY: 1,
          initialDir: 'EAST',
          carriedItem: { id: 'carried_1', type: 'plank', x: 0, y: 0 },
        },
      });
      expect(evaluateGridSensor({ type: 'carryingItem' }, carriedGrid)).toBe(true);
    });

    it('evaluates atGoal sensor', () => {
      const grid = makeBaseGrid({
        robot: { x: 4, y: 1, dir: 'EAST', initialX: 4, initialY: 1, initialDir: 'EAST' },
      });
      expect(evaluateGridSensor({ type: 'atGoal' }, grid)).toBe(true);

      const offGoal = makeBaseGrid({
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 1, initialY: 1, initialDir: 'EAST' },
      });
      expect(evaluateGridSensor({ type: 'atGoal' }, offGoal)).toBe(false);
    });

    it('evaluates tileColor matching floor beacon colors', () => {
      const grid = makeBaseGrid({
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 1, initialY: 1, initialDir: 'EAST' },
        beaconTiles: [{ x: 1, y: 1, color: 'blue', shape: 'triangle' }],
      });

      // Red (palette index 1) -> false
      expect(evaluateGridSensor({ type: 'tileColor', colorIdx: 1 }, grid)).toBe(false);
      // Blue (palette index 2) -> true
      expect(evaluateGridSensor({ type: 'tileColor', colorIdx: BEACON_COLOR_PALETTE_INDEX.blue }, grid)).toBe(true);
    });

    it('reads $tileDial numeric sensor (0 if none, 1..20 if present)', () => {
      const noDialGrid = makeBaseGrid();
      expect(readGridSensor('$tileDial', noDialGrid)).toBe(0);

      const dialGrid = makeBaseGrid({
        dialTiles: [{ x: 1, y: 1, value: 12 }],
      });
      expect(readGridSensor('$tileDial', dialGrid)).toBe(12);

      // Environment sensor hook
      expect(gridSimulationEnvironment.readSensor?.('$tileDial', dialGrid)).toBe(12);
      expect(gridSimulationEnvironment.readSensor?.('$x', dialGrid)).toBe(1);
      expect(gridSimulationEnvironment.readSensor?.('$y', dialGrid)).toBe(1);
      expect(gridSimulationEnvironment.readSensor?.('$heading', dialGrid)).toBe(90);
    });
  });

  describe('Physics, Stackable Depots & Strict Validation Rules', () => {
    it('strict mode: blind PICK_UP on empty tile triggers COLLISION', () => {
      const grid = makeBaseGrid({
        strictInteractionCollision: true,
      });
      const res = executeRobotAction('PICK_UP', grid);
      expect(res.isCollision).toBe(true);
      expect(res.valid).toBe(false);
    });

    it('non-strict mode: blind PICK_UP gives soft noop feedback without COLLISION', () => {
      const grid = makeBaseGrid({
        strictInteractionCollision: false,
      });
      const res = executeRobotAction('PICK_UP', grid);
      expect(res.isCollision).toBe(false);
      expect(res.valid).toBe(false);
      expect(res.interactionFeedback?.kind).toBe('noop-empty');
    });

    it('strict mode: invalid USE_DROP triggers COLLISION', () => {
      const grid = makeBaseGrid({
        strictInteractionCollision: true,
      });
      const res = executeRobotAction('USE_DROP', grid);
      expect(res.isCollision).toBe(true);
      expect(res.valid).toBe(false);
    });

    it('picks up from stack depot and increments carriedCount, successive pickup stacks', () => {
      const grid = makeBaseGrid({
        worldItems: [{ id: 'depot_1', type: 'crate', x: 1, y: 1, count: 3 }],
      });

      // 1st pickup: takes 1 from stack
      const res1 = executeRobotAction('PICK_UP', grid);
      expect(res1.valid).toBe(true);
      expect(res1.carriedCount).toBe(1);
      expect(res1.carriedItem?.type).toBe('crate');
      expect(res1.worldItems![0].count).toBe(2);

      // 2nd pickup: takes another from stack
      const stateAfter1: GridState = {
        ...grid,
        robot: { ...grid.robot, carriedItem: res1.carriedItem, carriedCount: res1.carriedCount },
        worldItems: res1.worldItems,
      };
      const res2 = executeRobotAction('PICK_UP', stateAfter1);
      expect(res2.valid).toBe(true);
      expect(res2.carriedCount).toBe(2);
      expect(res2.worldItems![0].count).toBe(1);

      // Drop 1 crate from stack
      const stateAfter2: GridState = {
        ...grid,
        robot: { ...grid.robot, x: 2, y: 1, carriedItem: res2.carriedItem, carriedCount: res2.carriedCount },
        worldItems: res2.worldItems,
      };
      const dropRes = executeRobotAction('USE_DROP', stateAfter2);
      expect(dropRes.valid).toBe(true);
      expect(dropRes.carriedCount).toBe(1);
      expect(dropRes.carriedItem?.type).toBe('crate');
      expect(dropRes.worldItems).toHaveLength(2); // original depot + dropped crate
    });

    it('enforces requireAllItemsCollected at goal', () => {
      const grid = makeBaseGrid({
        robot: { x: 3, y: 1, dir: 'EAST', initialX: 3, initialY: 1, initialDir: 'EAST' },
        worldItems: [{ id: 'item_1', type: 'crate', x: 2, y: 2 }],
        requireAllItemsCollected: true,
      });

      // Step onto goal at (4,1) with item uncollected
      const res = executeRobotAction('MOVE_FWD', grid);
      expect(res.newX).toBe(4);
      expect(res.newY).toBe(1);
      expect(res.isSuccess).toBe(false);
      expect(isFlagPadlocked(grid.flags[0], grid.flags, undefined, undefined, {
        worldItems: res.worldItems,
        requireAllItemsCollected: true,
      })).toBe(true);
    });

    it('enforces requireEmptyBackpackAtGoal at goal', () => {
      const grid = makeBaseGrid({
        robot: {
          x: 3,
          y: 1,
          dir: 'EAST',
          initialX: 3,
          initialY: 1,
          initialDir: 'EAST',
          carriedItem: { id: 'c1', type: 'crate', x: 0, y: 0 },
          carriedCount: 1,
        },
        requireEmptyBackpackAtGoal: true,
      });

      const res = executeRobotAction('MOVE_FWD', grid);
      expect(res.newX).toBe(4);
      expect(res.newY).toBe(1);
      expect(res.isSuccess).toBe(false);
    });
  });

  describe('UI & Overlay Slots Rendering', () => {
    it('renders BeaconAndDialLayer into SVG with beacons, dials, and stack badges', () => {
      const grid = makeBaseGrid({
        beaconTiles: [{ x: 1, y: 1, color: 'blue', shape: 'triangle' }],
        dialTiles: [{ x: 2, y: 1, value: 8 }],
        worldItems: [{ id: 'stack_1', type: 'crate', x: 3, y: 1, count: 4 }],
      });

      const markup = renderToStaticMarkup(React.createElement(BeaconAndDialLayer, { grid }));
      expect(markup).toContain('data-testid="beacon-dial-layer"');
      expect(markup).toContain('data-testid="beacon-tile-1-1"');
      expect(markup).toContain('data-beacon-color="blue"');
      expect(markup).toContain('data-testid="dial-tile-2-1"');
      expect(markup).toContain('data-dial-value="8"');
      expect(markup).toContain('data-testid="stack-badge-3-1"');
      expect(markup).toContain('×4');
    });

    it('renders BackpackHud with carried count multiplier when carriedCount > 1', () => {
      const grid = makeBaseGrid({
        robot: {
          x: 1,
          y: 1,
          dir: 'EAST',
          initialX: 1,
          initialY: 1,
          initialDir: 'EAST',
          carriedItem: { id: 'crate_1', type: 'crate', x: 0, y: 0 },
          carriedCount: 3,
        },
      });

      const markup = renderToStaticMarkup(React.createElement(BackpackHud, { grid }));
      expect(markup).toContain('data-testid="grid-backpack-hud"');
      expect(markup).toContain('data-carried-count="3"');
      expect(markup).toContain('×3');
    });

    it('renders GridToolbarTools with Beacon, Dial, and Stack Depot buttons', () => {
      const markup = renderToStaticMarkup(
        React.createElement(GridToolbarTools, { defaultWorldMenuOpen: true })
      );
      expect(markup).toContain('data-testid="tool-beacon"');
      expect(markup).toContain('data-testid="tool-dial"');
      expect(markup).toContain('data-testid="tool-stack-depot"');
    });

    it('renders map thumbnail SVG with beacons, dials, and stack badges', () => {
      const grid = makeBaseGrid({
        beaconTiles: [{ x: 1, y: 1, color: 'red', shape: 'circle' }],
        dialTiles: [{ x: 2, y: 2, value: 15 }],
        worldItems: [{ id: 'crate_stack', type: 'crate', x: 0, y: 1, count: 5 }],
      });

      const svg = renderGridMapSvg(grid);
      expect(svg).toContain('data-thumb-beacon="1-1"');
      expect(svg).toContain('data-thumb-dial="2-2"');
      expect(svg).toContain('data-thumb-stack="0-1"');
    });
  });
});
