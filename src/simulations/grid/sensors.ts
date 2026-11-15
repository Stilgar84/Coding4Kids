/**
 * Grid v3 Sensor Evaluation (Commit 22)
 *
 * Implements:
 * - `evaluateGridSensor(sensor, state)` — boolean sensors for Module 5+ conditionals
 *   (pathAhead, pathLeft, pathRight, itemHere, carryingItem, atGoal, tileColor)
 * - `readGridSensor(sensorId, state)` — numeric sensor for Module 6 $tileDial (0 if no dial, 1..20 otherwise)
 */

import { BeaconColor, CellCoord, GridState } from '../../types';
import {
  DIR_DELTAS,
  TURN_LEFT_MAP,
  TURN_RIGHT_MAP,
  hasWallBetween,
  isUnbridgedWater,
  isWaterBridged,
  isWaterCell,
} from '../../engine/physics';
import { colorNameToIdx } from '../../engine/serialization/conditionSerializer';

export type GridStateWithVisited = GridState & {
  /** Optional visited-cells ledger for `unvisitedAhead` (0x08), seeded from `(initialX, initialY)` */
  visitedCells?: CellCoord[];
};

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

const BEACON_COLOR_ALIASES: Record<string, string> = {
  yellow: 'amber',
  rose: 'red',
  sky: 'blue',
  emerald: 'green',
};

function normalizeBeaconColorToken(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const stripped = lower.startsWith('color:') ? lower.slice(6).trim() : lower;
  return BEACON_COLOR_ALIASES[stripped] ?? stripped;
}

/** Resolves a tileColor target index (1..9), mapping `'yellow'` <-> `'amber'` (4), `'rose'` -> `'red'` (1), `'sky'` -> `'blue'` (2), and `'emerald'` -> `'green'` (3). */
export function resolveTileColorIdx(
  sensor: { type?: string; sensor?: string; colorIdx?: number; param?: string } | string,
  param?: string
): number {
  if (typeof sensor === 'object' && sensor !== null && typeof sensor.colorIdx === 'number') {
    return Number.isFinite(sensor.colorIdx) ? sensor.colorIdx : 0;
  }
  const raw =
    param ??
    (typeof sensor === 'object' && sensor !== null ? sensor.param : undefined);
  if (raw === undefined || raw === null) return 0;
  const trimmed = String(raw).trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  return colorNameToIdx(normalizeBeaconColorToken(trimmed));
}

/** Resolves a display hex color for a beacon color name or palette index. */
export function resolveBeaconColorHex(colorOrIdx?: string | number): string | null {
  if (colorOrIdx === undefined || colorOrIdx === null) return null;
  const idx =
    typeof colorOrIdx === 'number'
      ? colorOrIdx
      : resolveTileColorIdx('tileColor', colorOrIdx);
  return idx > 0 && idx < BEACON_PALETTE_COLORS.length
    ? BEACON_PALETTE_COLORS[idx]
    : null;
}

// ─── Boolean Sensors ──────────────────────────────────────────────────────────

/**
 * Checks whether cell `(x, y)` is walkable from `grid.robot`'s current position:
 * in-bounds, no wall barrier, no unbridged water, no closed locked gate.
 */
export function isCellWalkable(
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

export function cellAhead(grid: GridState): { x: number; y: number } {
  const delta = DIR_DELTAS[grid.robot.dir];
  return { x: grid.robot.x + delta.dx, y: grid.robot.y + delta.dy };
}

export function cellLeft(grid: GridState): { x: number; y: number } {
  const leftDir = TURN_LEFT_MAP[grid.robot.dir];
  const delta = DIR_DELTAS[leftDir];
  return { x: grid.robot.x + delta.dx, y: grid.robot.y + delta.dy };
}

export function cellRight(grid: GridState): { x: number; y: number } {
  const rightDir = TURN_RIGHT_MAP[grid.robot.dir];
  const delta = DIR_DELTAS[rightDir];
  return { x: grid.robot.x + delta.dx, y: grid.robot.y + delta.dy };
}

/**
 * Returns true iff a retrievable bridged wooden Plank sits 1 cell directly ahead
 * in `robot.dir` with no wall or closed gate blocking retrieval (matches `PICK_UP` in `physics.ts`).
 */
export function hasAheadBridgedPlank(state: GridState): boolean {
  const ahead = cellAhead(state);
  if (ahead.x < 0 || ahead.x >= state.width || ahead.y < 0 || ahead.y >= state.height) {
    return false;
  }
  if (hasWallBetween(state.robot.x, state.robot.y, ahead.x, ahead.y, state.barriers)) {
    return false;
  }
  if ((state.lockedGates ?? []).some((g) => g.x === ahead.x && g.y === ahead.y && !g.unlocked)) {
    return false;
  }
  return (
    isWaterCell(ahead.x, ahead.y, state.waterCells) &&
    isWaterBridged(ahead.x, ahead.y, state.bridgedWaterCells)
  );
}

/**
 * Checks whether `(x, y)` has already been visited using `grid.visitedCells` seeded
 * from `(robot.initialX, robot.initialY)` when tracked, or `grid.trace` otherwise.
 */
export function isCellVisited(
  x: number,
  y: number,
  state: GridStateWithVisited
): boolean {
  if (x === state.robot.initialX && y === state.robot.initialY) {
    return true;
  }
  if (Array.isArray(state.visitedCells)) {
    return state.visitedCells.some((c) => c.x === x && c.y === y);
  }
  return (state.trace ?? []).some((c) => c.x === x && c.y === y);
}

/**
 * Evaluates `unvisitedAhead` (0x08): true iff the cell 1 step ahead is walkable
 * and has not been visited yet.
 */
export function unvisitedAhead(state: GridStateWithVisited): boolean {
  const ahead = cellAhead(state);
  if (!isCellWalkable(ahead.x, ahead.y, state)) {
    return false;
  }
  return !isCellVisited(ahead.x, ahead.y, state);
}

/**
 * Evaluates a boolean grid sensor.
 *
 * Supported sensor IDs (matching ConditionExpr grid sensor bytes 0x01..0x08):
 * - `'pathAhead'`      (0x01): cell immediately ahead is walkable
 * - `'pathLeft'`       (0x02): cell immediately left is walkable
 * - `'pathRight'`      (0x03): cell immediately right is walkable
 * - `'itemHere'`       (0x04): a world item sits on the robot's current cell OR a retrievable bridged Plank sits 1 cell ahead
 * - `'carryingItem'`   (0x05): robot's backpack contains an item
 * - `'atGoal'`         (0x06): robot is on the goal cell
 * - `'tileColor'`      (0x07): current cell has a beacon matching `colorIdx` or `param` (`yellow` <-> `amber` index 4)
 * - `'unvisitedAhead'` (0x08): cell immediately ahead is walkable and not yet in visitedCells (seeded from initialX/Y)
 *
 * @param sensor  - Deserialized ConditionExpr node or sensor name string
 * @param state   - Current GridState
 * @param param   - Optional parameter string (e.g. beacon color name `'amber'` / `'yellow'` / `'red'` / `'blue'` / `'green'`)
 * @returns boolean result
 */
export function evaluateGridSensor(
  sensor: { type?: string; sensor?: string; colorIdx?: number; param?: string } | string,
  state: GridState,
  param?: string
): boolean {
  const { robot } = state;
  const rawSensorType =
    typeof sensor === 'string'
      ? sensor
      : sensor?.type ?? sensor?.sensor ?? '';
  const sensorType = rawSensorType.startsWith('$') ? rawSensorType.slice(1) : rawSensorType;

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
      if (items.some((it) => it.x === robot.x && it.y === robot.y)) {
        return true;
      }
      return hasAheadBridgedPlank(state);
    }
    case 'carryingItem':
      return Boolean(robot.carriedItem);
    case 'atGoal':
      return state.flags.some(
        (f) => f.isGoal && f.x === robot.x && f.y === robot.y
      );
    case 'tileColor': {
      const colorIdx = resolveTileColorIdx(sensor, param);
      if (colorIdx <= 0) return false;
      const beacons = state.beaconTiles ?? [];
      const beacon = beacons.find((b) => b.x === robot.x && b.y === robot.y);
      if (!beacon) return false;
      const beaconColorIdx =
        BEACON_COLOR_PALETTE_INDEX[beacon.color] ??
        colorNameToIdx(normalizeBeaconColorToken(String(beacon.color)));
      return beaconColorIdx === colorIdx;
    }
    case 'unvisitedAhead':
      return unvisitedAhead(state as GridStateWithVisited);
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
