import { Direction, GridState, WallEdge, CellCoord, FlagObjective } from '../types';

export const DIR_ROTATIONS: Record<Direction, number> = {
  NORTH: 0,
  EAST: 90,
  SOUTH: 180,
  WEST: 270,
};

export const DIR_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  NORTH: { dx: 0, dy: -1 },
  EAST: { dx: 1, dy: 0 },
  SOUTH: { dx: 0, dy: 1 },
  WEST: { dx: -1, dy: 0 },
};

export const TURN_LEFT_MAP: Record<Direction, Direction> = {
  NORTH: 'WEST',
  WEST: 'SOUTH',
  SOUTH: 'EAST',
  EAST: 'NORTH',
};

export const TURN_RIGHT_MAP: Record<Direction, Direction> = {
  NORTH: 'EAST',
  EAST: 'SOUTH',
  SOUTH: 'WEST',
  WEST: 'NORTH',
};

/**
 * Checks if there is a wall barrier preventing movement between (fromX, fromY) and (toX, toY).
 */
export function hasWallBetween(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  barriers: WallEdge[]
): boolean {
  // Moving North: (x, y) -> (x, y-1)
  if (toX === fromX && toY === fromY - 1) {
    return barriers.some((b) => b.orientation === 'H' && b.x === fromX && b.y === fromY);
  }
  // Moving South: (x, y) -> (x, y+1)
  if (toX === fromX && toY === fromY + 1) {
    return barriers.some((b) => b.orientation === 'H' && b.x === fromX && b.y === toY);
  }
  // Moving West: (x, y) -> (x-1, y)
  if (toY === fromY && toX === fromX - 1) {
    return barriers.some((b) => b.orientation === 'V' && b.x === fromX && b.y === fromY);
  }
  // Moving East: (x, y) -> (x+1, y)
  if (toY === fromY && toX === fromX + 1) {
    return barriers.some((b) => b.orientation === 'V' && b.x === toX && b.y === fromY);
  }
  return false;
}

/**
 * Determines whether a given flag or goal objective is currently padlocked
 * (cannot be collected yet because an earlier prerequisite waypoint remains uncollected).
 *
 * Rules:
 * - Already-collected flags (`flag.collected === true`) are never padlocked.
 * - A non-goal numbered flag (`!flag.isGoal`) with `order = k` is padlocked iff
 *   at least one uncollected non-goal flag has `order < k`.
 * - A goal flag (`flag.isGoal === true`) is padlocked iff at least one
 *   non-goal flag remains uncollected.
 */
export function isFlagPadlocked(
  flag: FlagObjective,
  allFlags: readonly FlagObjective[]
): boolean {
  if (flag.collected) {
    return false;
  }

  if (flag.isGoal) {
    return allFlags.some((other) => !other.isGoal && !other.collected);
  }

  return allFlags.some(
    (other) => !other.isGoal && !other.collected && other.order < flag.order
  );
}

/**
 * Returns the smallest `order` among currently uncollected non-goal flags,
 * or `null` if all non-goal waypoints have already been collected.
 */
export function getNextRequiredWaypointOrder(
  allFlags: readonly FlagObjective[]
): number | null {
  let minOrder: number | null = null;
  for (const f of allFlags) {
    if (!f.isGoal && !f.collected) {
      if (minOrder === null || f.order < minOrder) {
        minOrder = f.order;
      }
    }
  }
  return minOrder;
}

/**
 * Returns the set of `flag.id` values for all flags/goals currently padlocked.
 */
export function getPadlockedFlagIds(
  allFlags: readonly FlagObjective[]
): Set<string> {
  const lockedIds = new Set<string>();
  for (const flag of allFlags) {
    if (isFlagPadlocked(flag, allFlags)) {
      lockedIds.add(flag.id);
    }
  }
  return lockedIds;
}

export interface MoveResult {
  valid: boolean;
  newX: number;
  newY: number;
  newDir: Direction;
  flags: FlagObjective[];
  trace: CellCoord[];
  isSuccess: boolean;
  isCollision: boolean;
}

export function executeRobotAction(
  action: 'MOVE_FWD' | 'MOVE_BACK' | 'TURN_LEFT' | 'TURN_RIGHT',
  grid: GridState
): MoveResult {
  const { robot, barriers, width, height, flags, trace } = grid;
  const currentDir = robot.dir;

  if (action === 'TURN_LEFT') {
    return {
      valid: true,
      newX: robot.x,
      newY: robot.y,
      newDir: TURN_LEFT_MAP[currentDir],
      flags,
      trace,
      isSuccess: false,
      isCollision: false,
    };
  }

  if (action === 'TURN_RIGHT') {
    return {
      valid: true,
      newX: robot.x,
      newY: robot.y,
      newDir: TURN_RIGHT_MAP[currentDir],
      flags,
      trace,
      isSuccess: false,
      isCollision: false,
    };
  }

  // Linear movement
  const delta = DIR_DELTAS[currentDir];
  const mult = action === 'MOVE_FWD' ? 1 : -1;
  const targetX = robot.x + delta.dx * mult;
  const targetY = robot.y + delta.dy * mult;

  // Check boundaries
  if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
    return {
      valid: false,
      newX: robot.x,
      newY: robot.y,
      newDir: currentDir,
      flags,
      trace,
      isSuccess: false,
      isCollision: true,
    };
  }

  // Check barrier collisions
  const wallCollision = hasWallBetween(robot.x, robot.y, targetX, targetY, barriers);
  if (wallCollision) {
    return {
      valid: false,
      newX: robot.x,
      newY: robot.y,
      newDir: currentDir,
      flags,
      trace,
      isSuccess: false,
      isCollision: true,
    };
  }

  // Move is valid! Update trace and sequentially-gated flags (1 -> 2 -> ... -> Goal).
  // Stepping onto a locked flag or locked goal is safe (not a collision) and leaves it uncollected.
  const afterNonGoalFlags = flags.map((f) => {
    if (
      !f.isGoal &&
      !f.collected &&
      f.x === targetX &&
      f.y === targetY &&
      !isFlagPadlocked(f, flags)
    ) {
      return { ...f, collected: true };
    }
    return f;
  });

  const allIntermediateCollected = afterNonGoalFlags.every((f) => f.isGoal || f.collected);

  const updatedFlags = afterNonGoalFlags.map((f) => {
    if (
      f.isGoal &&
      !f.collected &&
      f.x === targetX &&
      f.y === targetY &&
      allIntermediateCollected
    ) {
      return { ...f, collected: true };
    }
    return f;
  });

  const updatedTrace = [...trace, { x: targetX, y: targetY }];

  // Check victory condition: all non-goal flags collected AND on a goal flag
  const onGoal = updatedFlags.some((f) => f.isGoal && f.x === targetX && f.y === targetY);
  const isSuccess = onGoal && allIntermediateCollected;

  return {
    valid: true,
    newX: targetX,
    newY: targetY,
    newDir: currentDir,
    flags: updatedFlags,
    trace: updatedTrace,
    isSuccess,
    isCollision: false,
  };
}
