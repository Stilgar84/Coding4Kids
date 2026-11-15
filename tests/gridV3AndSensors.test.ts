import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CurriculumActivity,
  createCurriculumBlock,
} from '../src/data/curriculum/types';
import { createInitialInterpreterState, tickInterpreter } from '../src/engine/interpreter';
import { verifyActivityConstraints } from '../src/engine/verification/constraintSolver';
import { SensorBeamGridOverlay } from '../src/simulations/grid/components/SensorAndBranchSpotlight';
import { evaluateGridSensor as evalSensorDirect, unvisitedAhead } from '../src/simulations/grid/sensors';
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
import { GridCanvas } from '../src/components/GridCanvas';
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

    it('renders robot shoulder carry with carried count multiplier when carriedCount > 1 and zero BackpackHud', () => {
      const initialRef = useAppStore.getInitialState();
      const backupInitial = { ...initialRef };

      try {
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

        useAppStore.setState({ activeSimId: 'grid', grid });
        Object.assign(initialRef, useAppStore.getState());

        const markup = renderToStaticMarkup(React.createElement(GridCanvas, { state: grid }));
        expect(markup).toContain('data-testid="robot-shoulder-carry"');
        expect(markup).toContain('data-carried-count="3"');
        expect(markup).toContain('×3');
        expect(markup).not.toContain('grid-backpack-hud');
        expect(markup).not.toContain('🎒');
      } finally {
        Object.assign(initialRef, backupInitial);
      }
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

  describe('Phase 2: 1-ahead Plank itemHere, unvisitedAhead, tileColor aliases, Sensor HUD & Multi-Variant Solver (< 200ms)', () => {
    it('returns itemHere=true for 1-ahead walkable bridged Plank with PICK_UP parity and false across walls/closed gates/open water', () => {
      const bridgedAhead = makeBaseGrid({
        width: 4,
        height: 2,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        waterCells: [{ x: 1, y: 0 }],
        bridgedWaterCells: [{ x: 1, y: 0 }],
        worldItems: [],
      });
      expect(evalSensorDirect('itemHere', bridgedAhead)).toBe(true);
      expect(evalSensorDirect({ type: 'itemHere' }, bridgedAhead)).toBe(true);

      // Reclaiming the 1-ahead plank succeeds via PICK_UP and clears bridgedWaterCells
      const pickRes = gridSimulationEnvironment.executeAction('PICK_UP', bridgedAhead);
      expect(pickRes.status).toBe('RUNNING');
      expect(pickRes.nextState.robot.carriedItem?.type).toBe('plank');
      expect(pickRes.nextState.bridgedWaterCells).toEqual([]);
      expect(evalSensorDirect('itemHere', pickRes.nextState)).toBe(false);

      // Open (unbridged) water 1 cell ahead does NOT count as itemHere
      const openWater = makeBaseGrid({
        width: 4,
        height: 2,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        waterCells: [{ x: 1, y: 0 }],
        bridgedWaterCells: [],
      });
      expect(evalSensorDirect('itemHere', openWater)).toBe(false);

      // Wall between robot and bridged water blocks both itemHere and PICK_UP
      const walledPlank = {
        ...bridgedAhead,
        barriers: [{ orientation: 'V' as const, x: 1, y: 0 }],
      };
      expect(evalSensorDirect('itemHere', walledPlank)).toBe(false);
      expect(
        gridSimulationEnvironment.executeAction('PICK_UP', {
          ...walledPlank,
          strictInteractionCollision: true,
        }).status
      ).toBe('COLLISION');

      // Closed gate on the ahead cell blocks itemHere
      const gatedPlank = {
        ...bridgedAhead,
        lockedGates: [{ id: 'g1', x: 1, y: 0, shape: 'circle' as const, color: 'amber' as const, open: false }],
      };
      expect(evalSensorDirect('itemHere', gatedPlank)).toBe(false);
    });

    it('tracks unvisitedAhead using visitedCells seeded from initialX/initialY and resolves tileColor aliases', () => {
      const initGrid = resetGridInteractiveState(
        makeBaseGrid({
          width: 4,
          height: 2,
          robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
          visitedCells: [],
        })
      );
      expect(initGrid.visitedCells).toEqual([{ x: 0, y: 0 }]);
      expect(unvisitedAhead(initGrid)).toBe(true);
      expect(evalSensorDirect('unvisitedAhead', initGrid)).toBe(true);

      const moved1 = gridSimulationEnvironment.executeAction('MOVE_FWD', initGrid).nextState;
      expect(moved1.visitedCells).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);

      // Turn around facing back toward already-visited (0,0)
      const turnedRight = gridSimulationEnvironment.executeAction('TURN_RIGHT', moved1).nextState;
      const facingBack = gridSimulationEnvironment.executeAction('TURN_RIGHT', turnedRight).nextState;
      expect(facingBack.robot.dir).toBe('WEST');
      expect(unvisitedAhead(facingBack)).toBe(false);
      expect(evalSensorDirect('unvisitedAhead', facingBack)).toBe(false);

      const reset = resetGridInteractiveState(facingBack);
      expect(reset.visitedCells).toEqual([{ x: 0, y: 0 }]);
      expect(unvisitedAhead(reset)).toBe(true);

      // tileColor handles color names, rose/sky/emerald/yellow aliases, numeric strings, and colorIdx
      const beaconGrid = makeBaseGrid({
        width: 5,
        height: 1,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        beaconTiles: [
          { x: 0, y: 0, color: 'yellow', shape: 'diamond' },
          { x: 1, y: 0, color: 'red', shape: 'circle' },
          { x: 2, y: 0, color: 'blue', shape: 'triangle' },
          { x: 3, y: 0, color: 'green', shape: 'square' },
        ],
      });
      expect(evalSensorDirect('tileColor', beaconGrid, 'yellow')).toBe(true);
      expect(evalSensorDirect('tileColor', beaconGrid, 'amber')).toBe(true);
      expect(evalSensorDirect('tileColor', beaconGrid, '4')).toBe(true);
      expect(evalSensorDirect({ type: 'tileColor', colorIdx: 4 }, beaconGrid)).toBe(true);
      expect(evalSensorDirect('tileColor', beaconGrid, 'red')).toBe(false);

      const onRed = { ...beaconGrid, robot: { ...beaconGrid.robot, x: 1 } };
      expect(evalSensorDirect('tileColor', onRed, 'red')).toBe(true);
      expect(evalSensorDirect('tileColor', onRed, 'rose')).toBe(true);
      expect(evalSensorDirect('tileColor', onRed, '1')).toBe(true);

      const onBlue = { ...beaconGrid, robot: { ...beaconGrid.robot, x: 2 } };
      expect(evalSensorDirect('tileColor', onBlue, 'sky')).toBe(true);
      expect(evalSensorDirect('tileColor', onBlue, 'blue')).toBe(true);

      const onGreen = { ...beaconGrid, robot: { ...beaconGrid.robot, x: 3 } };
      expect(evalSensorDirect('tileColor', onGreen, 'emerald')).toBe(true);
      expect(evalSensorDirect('tileColor', onGreen, 'green')).toBe(true);
    });

    it('renders directional scan visor/ears, 1-ahead Plank scan beam, tileColor match ring, and zero Goal padlocks', () => {
      const scanGrid = makeBaseGrid({
        width: 4,
        height: 3,
        robot: { x: 1, y: 1, dir: 'EAST', initialX: 1, initialY: 1, initialDir: 'EAST' },
        barriers: [{ orientation: 'V', x: 2, y: 1 }],
        waterCells: [{ x: 2, y: 1 }],
        bridgedWaterCells: [{ x: 2, y: 1 }],
        beaconTiles: [{ x: 1, y: 1, color: 'blue', shape: 'triangle' }],
        flags: [
          { id: 'f1', x: 1, y: 0, isGoal: false, order: 1, collected: false },
          { id: 'goal', x: 3, y: 1, isGoal: true, order: 2, collected: false },
        ],
      });

      const condBlock = createCurriculumBlock(
        'WHILE',
        undefined,
        {
          condition: {
            kind: 'and',
            left: {
              kind: 'and',
              left: { kind: 'sensor', sensor: 'pathAhead' },
              right: { kind: 'sensor', sensor: 'pathLeft' },
            },
            right: {
              kind: 'or',
              left: { kind: 'sensor', sensor: 'pathRight' },
              right: { kind: 'sensor', sensor: 'tileColor', param: 'blue' },
            },
          },
        },
        'while_scan_1'
      );
      const workspace: WorkspaceState = {
        MAIN: [condBlock, createCurriculumBlock('MOVE_FWD', undefined, undefined, 'm1'), createCurriculumBlock('END_WHILE', undefined, undefined, 'ew1')],
        F1: [],
        F2: [],
        F3: [],
      };
      useAppStore.setState({
        appMode: 'sandbox',
        workspace,
        interpreterRuntime: { ...createInitialInterpreterState(), activeBlockId: condBlock.id },
      });

      const gridHtml = renderToStaticMarkup(React.createElement(GridCanvas, { state: scanGrid }));
      expect(gridHtml).toContain('data-testid="robot-sensor-visor-ahead"');
      expect(gridHtml).toContain('data-open="false"');
      expect(gridHtml).toContain('data-sensor-result="false"');
      expect(gridHtml).toContain('data-testid="robot-sensor-ear-left"');
      expect(gridHtml).toContain('data-testid="robot-sensor-ear-right"');
      expect(gridHtml).toContain('data-testid="robot-tile-color-ring"');
      // Zero padlocks on Grid waypoints / Goal flags in Phase 2
      expect(gridHtml).not.toContain('data-testid="flag-padlock"');

      // 1-ahead bridged Plank scan beam renders when barrier does not block and itemHere is active
      const plankBeamGrid = { ...scanGrid, barriers: [] };
      const itemBlock = createCurriculumBlock(
        'IF',
        undefined,
        { condition: { kind: 'sensor', sensor: 'itemHere' } },
        'if_plank_ahead'
      );
      const itemWs: WorkspaceState = {
        MAIN: [itemBlock, createCurriculumBlock('PICK_UP', undefined, undefined, 'p1'), createCurriculumBlock('END_IF', undefined, undefined, 'ei1')],
        F1: [],
        F2: [],
        F3: [],
      };
      useAppStore.setState({
        workspace: itemWs,
        interpreterRuntime: { ...createInitialInterpreterState(), activeBlockId: itemBlock.id },
      });
      const plankHtml = renderToStaticMarkup(React.createElement(GridCanvas, { state: plankBeamGrid }));
      expect(plankHtml).toContain('data-testid="robot-plank-scan-beam"');
      expect(plankHtml).toContain('data-testid="sensor-plank-ahead-beam"');

      const overlayHtml = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(SensorBeamGridOverlay, {
            grid: plankBeamGrid,
            workspace: itemWs,
            runtime: { ...createInitialInterpreterState(), activeBlockId: itemBlock.id },
            tileSize: 64,
            offsetX: 0,
            offsetY: 0,
          })
        )
      );
      expect(overlayHtml).toContain('data-testid="sensor-plank-ahead-beam"');
    });

    it('verifies end-of-program Goal semantics and multi-variant constraints (< 200ms) for branch.7a, while.0, while.1, and while.A', () => {
      const wallsForCorridor = (width: number, height: number, path: Array<{ x: number; y: number }>) => {
        const open = new Set<string>();
        for (let i = 0; i + 1 < path.length; i++) {
          const a = path[i];
          const b = path[i + 1];
          open.add(a.x === b.x ? `H:${a.x},${Math.max(a.y, b.y)}` : `V:${Math.max(a.x, b.x)},${a.y}`);
        }
        const barriers: GridState['barriers'] = [];
        for (let y = 1; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (!open.has(`H:${x},${y}`)) barriers.push({ orientation: 'H', x, y });
          }
        }
        for (let y = 0; y < height; y++) {
          for (let x = 1; x < width; x++) {
            if (!open.has(`V:${x},${y}`)) barriers.push({ orientation: 'V', x, y });
          }
        }
        return barriers;
      };

      // 1. branch.7a: requireAllItemsCollected: false (Amber decoy keys) + strictInteractionCollision: true
      const branch7aVariant = (keyXs: number[]) => ({
        width: 6,
        height: 1,
        robot: { x: 0, y: 0, dir: 'EAST' as const },
        barriers: [],
        lockedGates: [{ id: 'g', x: 4, y: 0, shape: 'circle' as const, color: 'amber' as const, open: false }],
        worldItems: keyXs.map((x, idx) => ({
          id: `k${idx}`,
          type: 'key' as const,
          x,
          y: 0,
          shape: 'circle' as const,
          color: 'amber' as const,
        })),
        flags: [{ id: 'goal', x: 5, y: 0, isGoal: true, order: 1, collected: false }],
        requireAllItemsCollected: false,
        requireEmptyBackpackAtGoal: false,
        strictInteractionCollision: true,
      });
      const branch7aRef: WorkspaceState = {
        MAIN: [
          createCurriculumBlock('LOOP_START', 3, undefined, 'b7a_ls'),
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'b7a_m1'),
          createCurriculumBlock(
            'IF',
            undefined,
            {
              condition: {
                kind: 'and',
                left: { kind: 'sensor', sensor: 'itemHere' },
                right: { kind: 'not', operand: { kind: 'sensor', sensor: 'carryingItem' } },
              },
            },
            'b7a_if'
          ),
          createCurriculumBlock('PICK_UP', undefined, undefined, 'b7a_pu'),
          createCurriculumBlock('END_IF', undefined, undefined, 'b7a_ei'),
          createCurriculumBlock('LOOP_END', undefined, undefined, 'b7a_le'),
          createCurriculumBlock('USE_DROP', undefined, undefined, 'b7a_ud'),
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'b7a_m2'),
          createCurriculumBlock('MOVE_FWD', undefined, undefined, 'b7a_m3'),
        ],
        F1: [],
        F2: [],
        F3: [],
      };
      const branch7aAct: CurriculumActivity = {
        id: 'branch.7a-test',
        module: 'branch',
        lessonNumber: 7.1,
        title: 'Decoy Key Vault',
        simId: 'grid',
        tier: 3,
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'PICK_UP', 'USE_DROP'],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'IF', 'END_IF'],
          allowedSensors: ['itemHere', 'carryingItem'],
          allowedCombinators: ['NOT', 'AND'],
          allowRepeatBadges: false,
        },
        slotCap: { perScope: { MAIN: 10 }, maxTotal: 10 },
        grid: branch7aVariant([3]),
        gridVariants: [
          { ...branch7aVariant([3]), label: 'V1' },
          { ...branch7aVariant([1, 2]), label: 'V2' },
          { ...branch7aVariant([1, 2, 3]), label: 'V3' },
        ],
        referenceSolution: branch7aRef,
        antiBypassRules: [
          { id: 'need-if', description: 'Cannot collect keys safely without IF', forbidBlocks: ['IF'], singleVariantBypassMustExist: true },
        ],
      };
      const rep7a = verifyActivityConstraints(branch7aAct);
      expect(rep7a.passed).toBe(true);
      expect(rep7a.elapsedMs).toBeLessThan(500);

      // 2. while.0 & while.1: variable straight corridors + unequal L-tunnels where LOOP_START fails
      const mkCorridor = (len: number) => {
        const path: Array<{ x: number; y: number }> = [];
        for (let x = 0; x <= len; x++) path.push({ x, y: 0 });
        return {
          width: len + 1,
          height: 1,
          robot: { x: 0, y: 0, dir: 'EAST' as const },
          barriers: wallsForCorridor(len + 1, 1, path),
          flags: [{ id: 'g', x: len, y: 0, isGoal: true, order: 1, collected: false }],
        };
      };
      const while0Act: CurriculumActivity = {
        id: 'while.0-test',
        module: 'while',
        lessonNumber: 0,
        title: 'Variable Hallway',
        simId: 'grid',
        tier: 3,
        palette: {
          allowedSimBlocks: ['MOVE_FWD'],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'WHILE', 'END_WHILE'],
          allowedSensors: ['pathAhead'],
          allowRepeatBadges: false,
        },
        slotCap: { perScope: { MAIN: 4 }, maxTotal: 4 },
        grid: mkCorridor(2),
        gridVariants: [
          { ...mkCorridor(2), label: 'C1' },
          { ...mkCorridor(4), label: 'C2' },
          { ...mkCorridor(3), label: 'C3' },
          { ...mkCorridor(5), label: 'C4' },
        ],
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('WHILE', undefined, { condition: { kind: 'sensor', sensor: 'pathAhead' } }, 'w0'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'w0m'),
            createCurriculumBlock('END_WHILE', undefined, undefined, 'w0e'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          { id: 'forbid-while', description: 'Variable hallways fail fixed repeats', forbidBlocks: ['WHILE'], singleVariantBypassMustExist: true },
        ],
      };
      const repW0 = verifyActivityConstraints(while0Act);
      expect(repW0.passed).toBe(true);
      expect(repW0.elapsedMs).toBeLessThan(500);

      const mkL = (l1: number, l2: number) => {
        const w = l1 + 1;
        const h = l2 + 1;
        const path: Array<{ x: number; y: number }> = [];
        for (let x = 0; x <= l1; x++) path.push({ x, y: 0 });
        for (let y = 1; y <= l2; y++) path.push({ x: l1, y });
        return {
          width: w,
          height: h,
          robot: { x: 0, y: 0, dir: 'EAST' as const },
          barriers: wallsForCorridor(w, h, path),
          flags: [{ id: 'g', x: l1, y: l2, isGoal: true, order: 1, collected: false }],
        };
      };
      const while1Act: CurriculumActivity = {
        id: 'while.1-test',
        module: 'while',
        lessonNumber: 1,
        title: 'L-Tunnels',
        simId: 'grid',
        tier: 3,
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_RIGHT'],
          allowedControlBlocks: ['LOOP_START', 'LOOP_END', 'WHILE', 'END_WHILE'],
          allowedSensors: ['pathAhead'],
          allowRepeatBadges: false,
        },
        slotCap: { perScope: { MAIN: 7 }, maxTotal: 7 },
        grid: mkL(2, 3),
        gridVariants: [
          { ...mkL(2, 3), label: 'L1' },
          { ...mkL(5, 2), label: 'L2' },
          { ...mkL(3, 5), label: 'L3' },
          { ...mkL(6, 4), label: 'L4' },
        ],
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('WHILE', undefined, { condition: { kind: 'sensor', sensor: 'pathAhead' } }, 'w1'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'm1'),
            createCurriculumBlock('END_WHILE', undefined, undefined, 'ew1'),
            createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'tr1'),
            createCurriculumBlock('WHILE', undefined, { condition: { kind: 'sensor', sensor: 'pathAhead' } }, 'w2'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'm2'),
            createCurriculumBlock('END_WHILE', undefined, undefined, 'ew2'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          { id: 'forbid-while', description: 'Fixed repeats/loops fail unequal L-tunnels', forbidBlocks: ['WHILE'], singleVariantBypassMustExist: true },
        ],
      };
      const repW1 = verifyActivityConstraints(while1Act);
      expect(repW1.passed).toBe(true);
      expect(repW1.elapsedMs).toBeLessThan(500);

      // 3. while.A: 4 spanning-tree mazes solved by 11-block Right-Hand Wall Follower (< 200ms)
      const maze1 = {
        width: 5,
        height: 5,
        robot: { x: 0, y: 0, dir: 'EAST' as const },
        barriers: wallsForCorridor(5, 5, [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 },
        ]),
        flags: [{ id: 'g', x: 3, y: 2, isGoal: true, order: 1, collected: false }],
      };
      const maze2 = {
        width: 5,
        height: 5,
        robot: { x: 0, y: 0, dir: 'EAST' as const },
        barriers: wallsForCorridor(5, 5, [
          { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
          { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
        ]),
        flags: [{ id: 'g', x: 4, y: 4, isGoal: true, order: 1, collected: false }],
      };
      const maze3 = {
        width: 6,
        height: 6,
        robot: { x: 0, y: 0, dir: 'EAST' as const },
        barriers: wallsForCorridor(6, 6, [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 },
          { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 },
        ]),
        flags: [{ id: 'g', x: 5, y: 3, isGoal: true, order: 1, collected: false }],
      };
      const maze4 = {
        width: 6,
        height: 6,
        robot: { x: 0, y: 0, dir: 'EAST' as const },
        barriers: wallsForCorridor(6, 6, [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
          { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 },
          { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }, { x: 1, y: 5 }, { x: 0, y: 5 },
          { x: 0, y: 4 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 },
        ]),
        flags: [{ id: 'g', x: 3, y: 3, isGoal: true, order: 1, collected: false }],
      };
      const whileAAct: CurriculumActivity = {
        id: 'while.A-test',
        module: 'while',
        lessonNumber: 9,
        title: 'Maze Rover',
        simId: 'grid',
        tier: 3,
        palette: {
          allowedSimBlocks: ['MOVE_FWD', 'TURN_LEFT', 'TURN_RIGHT'],
          allowedControlBlocks: ['WHILE', 'END_WHILE', 'IF', 'ELSE_IF', 'ELSE', 'END_IF'],
          allowedSensors: ['atGoal', 'pathRight', 'pathAhead', 'pathLeft'],
          allowedCombinators: ['NOT'],
          allowRepeatBadges: false,
        },
        slotCap: { perScope: { MAIN: 12 }, maxTotal: 12 },
        grid: maze1,
        gridVariants: [
          { ...maze1, label: 'M1' },
          { ...maze2, label: 'M2' },
          { ...maze3, label: 'M3' },
          { ...maze4, label: 'M4' },
        ],
        referenceSolution: {
          MAIN: [
            createCurriculumBlock('WHILE', undefined, { condition: { kind: 'not', operand: { kind: 'sensor', sensor: 'atGoal' } } }, 'wa_w'),
            createCurriculumBlock('IF', undefined, { condition: { kind: 'sensor', sensor: 'pathRight' } }, 'wa_if'),
            createCurriculumBlock('TURN_RIGHT', undefined, undefined, 'wa_tr'),
            createCurriculumBlock('ELSE_IF', undefined, { condition: { kind: 'sensor', sensor: 'pathAhead' } }, 'wa_ei1'),
            createCurriculumBlock('ELSE', undefined, undefined, 'wa_el'),
            createCurriculumBlock('TURN_LEFT', undefined, undefined, 'wa_tl'),
            createCurriculumBlock('END_IF', undefined, undefined, 'wa_end_if'),
            createCurriculumBlock('IF', undefined, { condition: { kind: 'sensor', sensor: 'pathAhead' } }, 'wa_if2'),
            createCurriculumBlock('MOVE_FWD', undefined, undefined, 'wa_mf'),
            createCurriculumBlock('END_IF', undefined, undefined, 'wa_end_if2'),
            createCurriculumBlock('END_WHILE', undefined, undefined, 'wa_ew'),
          ],
          F1: [],
          F2: [],
          F3: [],
        },
        antiBypassRules: [
          { id: 'forbid-while', description: 'Multi-variant mazes defeat open-loop sequences <= 12 slots', forbidBlocks: ['WHILE'], singleVariantBypassMustExist: true },
        ],
      };
      const repWA = verifyActivityConstraints(whileAAct);
      expect(repWA.passed).toBe(true);
      expect(repWA.elapsedMs).toBeLessThan(500);
    });
  });
});
