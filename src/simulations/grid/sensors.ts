/**
 * Grid v3 Sensor Evaluation (Commit 22)
 *
 * Implements:
 * - `evaluateGridSensor(sensor, state)` — boolean sensors for Module 5+ conditionals
 *   (pathAhead, pathLeft, pathRight, itemHere, carryingItem, atGoal, tileColor)
 * - `readGridSensor(sensorId, state)` — numeric sensor for Module 6 $tileDial (0 if no dial, 1..20 otherwise)
 */

import { GridState, BeaconColor } from '../../types';
import {
  DIR_DELTAS,
  TURN_LEFT_MAP,
  TURN_RIGHT_MAP,
  hasWallBetween,
  isUnbridgedWater,
} from '../../engine/physics';

// ─── Beacon Color Palette ──────────────────────────────────────────────────────
/** Map from BeaconColor to PALETTE_COLORS index (matches tileColor conditionExpr colorIdx 0..9) */
export const BEACON_COLOR_PALETTE_INDEX: Record<BeaconColor, number> = {
  red: 1,    // matches PALETTE_COLORS[1] = Red
  blue: 2,   // matches PALETTE_COLORS[2] = Blue
  green: 3,  // matches PALETTE_COLORS[3] = Green
  yellow: 4, // matches PALETTE_COLORS[4] = Amber/Yellow
};

export const BEACON_PALETTE_COLORS: readonly string[] = [
  '#0f172a', // 0: Black (not used for beacons)
  '#ef4444', // 1: Red
  '#3b82f6', // 2: Blue
  '#10b981', // 3: Green
  '#f59e0b', // 4: Yellow/Amber
];

/** Returns BeaconColor for a given colorIdx (inverse of BEACON_COLOR_PALETTE_INDEX) */
export function paletteIndexToBeaconColor(idx: number): BeaconColor | null {
  for (const [color, colorIdx] of Object.entries(BEACON_COLOR_PALETTE_INDEX) as [BeaconColor, number][]) {
    if (colorIdx === idx) return color;
  }
  return null;
}

// ─── Boolean Sensors ──────────────────────────────────────────────────────────

/**
 * Checks whether the cell directly ahead of the robot (in its facing direction) is
 * walkable: in-bounds, no wall barrier, no unbridged water, no closed locked gate.
 */
function isCellWalkable(
  x: number,
  y: number,
  grid: GridState,
): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return false;
  if (hasWallBetween(grid.robot.x, grid.robot.y, x, y, grid.barriers)) return false;
  if (isUnbridgedWater(x, y, grid.waterCells, grid.bridgedWaterCells)) return false;
  const gates = grid.lockedGates ?? [];
  if (gates.some((g) => g.x === x && g.y === y && !g.unlocked)) return false;
  return true;
}

function cellAhead(grid: GridState): { x: number; y: number } {
  const delta = DIR_DELTAS[grid.robot.dir];
  return { x: grid.robot.x + delta.dx, y: grid.robot.y + delta.dy };
}

function cellLeft(grid: GridState): { x: number; y: number } {
  const leftDir = TURN_LEFT_MAP[grid.robot.dir];
  const delta = DIR_DELTAS[leftDir];
  return { x: grid.robot.x + delta.dx, y: grid.robot.y + delta.dy };
}

function cellRight(grid: GridState): { x: number; y: number } {
  const rightDir = TURN_RIGHT_MAP[grid.robot.dir];
  const delta = DIR_DELTAS[rightDir];
  return { x: grid.robot.x + delta.dx, y: grid.robot.y + delta.dy };
}

/**
 * Evaluates a boolean grid sensor.
 *
 * Supported sensor IDs (matching ConditionExpr grid sensor bytes 0x01..0x07):
 * - `'pathAhead'`      (0x01): cell immediately ahead is walkable
 * - `'pathLeft'`       (0x02): cell immediately left is walkable
 * - `'pathRight'`      (0x03): cell immediately right is walkable
 * - `'itemHere'`       (0x04): a world item sits on the robot's current cell
 * - `'carryingItem'`   (0x05): robot's backpack contains an item
 * - `'atGoal'`         (0x06): robot is on the goal cell
 * - `'tileColor'`      (0x07): current cell has a beacon with the given colorIdx
 *
 * @param sensor  - Deserialized ConditionExpr node (plain object with `type` and optional `colorIdx`)
 * @param state   - Current GridState
 * @returns boolean result
 */
export function evaluateGridSensor(
  sensor: { type: string; colorIdx?: number } | string,
  state: GridState,
  param?: string
): boolean {
  const { robot } = state;
  const sensorType = typeof sensor === 'string' ? sensor : sensor?.type;
  switch (sensorType) {
    case 'pathAhead': {
      const ahead = cellAhead(state);
      return isCellWalkable(ahead.x, ahead.y, state);
    }
    case 'pathLeft': {
      const left = cellLeft(state);
      return isCellWalkable(left.x, left.y, state);
    }
    case 'pathRight': {
      const right = cellRight(state);
      return isCellWalkable(right.x, right.y, state);
    }
    case 'itemHere': {
      const items = state.worldItems ?? [];
      return items.some((it) => it.x === robot.x && it.y === robot.y);
    }
    case 'carryingItem':
      return Boolean(robot.carriedItem);
    case 'atGoal':
      return state.flags.some(
        (f) => f.isGoal && f.x === robot.x && f.y === robot.y
      );
    case 'tileColor': {
      const colorIdx =
        typeof sensor === 'object' && sensor.colorIdx !== undefined
          ? sensor.colorIdx
          : param
          ? parseInt(param, 10)
          : 0;
      const beacons = state.beaconTiles ?? [];
      const beacon = beacons.find((b) => b.x === robot.x && b.y === robot.y);
      if (!beacon) return false;
      return BEACON_COLOR_PALETTE_INDEX[beacon.color] === colorIdx;
    }
    // M11 reserved: 'unvisitedAhead' (0x08)
    default:
      return false;
  }
}

// ─── Numeric Sensor ───────────────────────────────────────────────────────────

/**
 * Reads a numeric sensor value from the current grid state.
 *
 * - `'$tileDial'`: returns the dial value (1..20) of the dial tile at the robot's current
 *   position, or 0 if no dial is present. This is the Module 6 floor-dial sensor.
 * - `'$x'`       : robot's x coordinate (0-based)
 * - `'$y'`       : robot's y coordinate (0-based)
 * - `'$heading'` : robot's heading in degrees (0=N, 90=E, 180=S, 270=W)
 */
export function readGridSensor(sensorId: string, state: GridState): number {
  switch (sensorId) {
    case '$tileDial': {
      const dials = state.dialTiles ?? [];
      const dial = dials.find((d) => d.x === state.robot.x && d.y === state.robot.y);
      return dial ? Math.max(1, Math.min(20, dial.value)) : 0;
    }
    case '$x':
      return state.robot.x;
    case '$y':
      return state.robot.y;
    case '$heading': {
      const headingMap: Record<string, number> = {
        NORTH: 0,
        EAST: 90,
        SOUTH: 180,
        WEST: 270,
      };
      return headingMap[state.robot.dir] ?? 0;
    }
    default:
      return 0;
  }
}
