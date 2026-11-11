import {
  Direction,
  GridState,
  WallEdge,
  CellCoord,
  FlagObjective,
  FloorSwitch,
  KeyGateColor,
  KeyGateShape,
  LockedGate,
  WorldInteractionFeedback,
  WorldItem,
} from '../types';

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

export const DEFAULT_COLOR_FOR_SHAPE: Record<KeyGateShape, KeyGateColor> = {
  circle: 'amber',
  triangle: 'emerald',
  diamond: 'purple',
};

export const SHAPE_SYMBOLS: Record<KeyGateShape, string> = {
  circle: '●',
  triangle: '▲',
  diamond: '◆',
};

export function resolveKeyGateShape(shape?: KeyGateShape): KeyGateShape {
  if (shape === 'circle' || shape === 'triangle' || shape === 'diamond') {
    return shape;
  }
  return 'circle';
}

export function resolveKeyGateColor(
  color?: KeyGateColor,
  shape: KeyGateShape = 'circle'
): KeyGateColor {
  if (color === 'amber' || color === 'emerald' || color === 'purple') {
    return color;
  }
  return DEFAULT_COLOR_FOR_SHAPE[shape];
}

export function keysMatchGate(item: WorldItem, gate: LockedGate): boolean {
  if (item.type !== 'key') return false;
  const kShape = resolveKeyGateShape(item.shape);
  const gShape = resolveKeyGateShape(gate.shape);
  const kColor = resolveKeyGateColor(item.color, kShape);
  const gColor = resolveKeyGateColor(gate.color, gShape);
  return kShape === gShape && kColor === gColor;
}

export function cloneWorldItems(items?: readonly WorldItem[]): WorldItem[] {
  if (!items) return [];
  return items.map((it) => ({ ...it }));
}

export function cloneLockedGates(
  gates?: readonly LockedGate[],
  resetUnlocked = false
): LockedGate[] {
  if (!gates) return [];
  return gates.map((g) => ({
    ...g,
    ...(resetUnlocked ? { unlocked: false, unlockedByKey: false } : {}),
  }));
}

export function cloneFloorSwitches(switches?: readonly FloorSwitch[]): FloorSwitch[] {
  if (!switches) return [];
  return switches.map((sw) => ({ ...sw }));
}

export function hasInteractiveWorldElements(grid?: Partial<GridState> | null): boolean {
  if (!grid) return false;
  const waterLen = grid.waterCells?.length ?? 0;
  const gatesLen = (grid.initialLockedGates ?? grid.lockedGates)?.length ?? 0;
  const switchesLen = grid.floorSwitches?.length ?? 0;
  const itemsLen = (grid.initialWorldItems ?? grid.worldItems)?.length ?? 0;
  return waterLen > 0 || gatesLen > 0 || switchesLen > 0 || itemsLen > 0;
}

export function isWaterCell(x: number, y: number, waterCells?: readonly CellCoord[]): boolean {
  return Boolean(waterCells?.some((w) => w.x === x && w.y === y));
}

export function isWaterBridged(
  x: number,
  y: number,
  bridgedWaterCells?: readonly CellCoord[]
): boolean {
  return Boolean(bridgedWaterCells?.some((b) => b.x === x && b.y === y));
}

export function isUnbridgedWater(
  x: number,
  y: number,
  waterCells?: readonly CellCoord[],
  bridgedWaterCells?: readonly CellCoord[]
): boolean {
  return isWaterCell(x, y, waterCells) && !isWaterBridged(x, y, bridgedWaterCells);
}

export function isSwitchLinkedToGate(sw: FloorSwitch, gate: LockedGate): boolean {
  return (
    (Boolean(sw.linkedGateId) && sw.linkedGateId === gate.id) ||
    (Boolean(gate.linkedSwitchId) && gate.linkedSwitchId === sw.id)
  );
}

export function hasAnyLinkedGate(
  sw: FloorSwitch,
  lockedGates?: readonly LockedGate[]
): boolean {
  if (sw.linkedGateId) return true;
  return Boolean(lockedGates?.some((g) => g.linkedSwitchId === sw.id));
}

export function isFloorSwitchRequiredForGoal(
  sw: FloorSwitch,
  lockedGates?: readonly LockedGate[]
): boolean {
  if (typeof sw.requiredForGoal === 'boolean') {
    return sw.requiredForGoal;
  }
  return !hasAnyLinkedGate(sw, lockedGates);
}

/**
 * Recomputes FloorSwitch.active states from crates currently on the floor
 * and updates any switch-linked LockedGate.unlocked states accordingly.
 */
export function syncWorldSwitchesAndGates(
  floorSwitches?: readonly FloorSwitch[],
  lockedGates?: readonly LockedGate[],
  worldItems?: readonly WorldItem[]
): {
  floorSwitches: FloorSwitch[] | undefined;
  lockedGates: LockedGate[] | undefined;
} {
  const nextSwitches = floorSwitches
    ? floorSwitches.map((sw) => {
        const hasCrate = Boolean(
          worldItems?.some((it) => it.type === 'crate' && it.x === sw.x && it.y === sw.y)
        );
        return {
          ...sw,
          active: hasCrate,
        };
      })
    : undefined;

  const nextGates = lockedGates
    ? lockedGates.map((gate) => {
        if (gate.unlockedByKey) {
          return { ...gate, unlocked: true, unlockedByKey: true };
        }
        const linked = (nextSwitches ?? []).filter((sw) => isSwitchLinkedToGate(sw, gate));
        if (linked.length > 0) {
          const allActive = linked.every((sw) => Boolean(sw.active));
          return { ...gate, unlocked: allActive };
        }
        return { ...gate, unlocked: Boolean(gate.unlocked) };
      })
    : undefined;

  return {
    floorSwitches: nextSwitches,
    lockedGates: nextGates,
  };
}

export function areGoalSwitchesSatisfied(
  floorSwitches?: readonly FloorSwitch[],
  lockedGates?: readonly LockedGate[]
): boolean {
  if (!floorSwitches || floorSwitches.length === 0) return true;
  return floorSwitches.every(
    (sw) => !isFloorSwitchRequiredForGoal(sw, lockedGates) || Boolean(sw.active)
  );
}

/**
 * Restores a GridState back to its initial robot pose, flags, unbridged water,
 * locked gates, initial floor items, recomputed floor switches, and empty 1-slot backpack.
 */
export function resetGridInteractiveState(grid: GridState): GridState {
  const hasWorld =
    hasInteractiveWorldElements(grid) ||
    grid.robot.carriedItem !== undefined ||
    grid.bridgedWaterCells !== undefined ||
    grid.lastInteractionFeedback !== undefined;

  if (!hasWorld) {
    return {
      ...grid,
      robot: {
        ...grid.robot,
        x: grid.robot.initialX,
        y: grid.robot.initialY,
        dir: grid.robot.initialDir,
      },
      flags: grid.flags.map((f) => ({ ...f, collected: false })),
      trace: [{ x: grid.robot.initialX, y: grid.robot.initialY }],
      status: 'IDLE',
    };
  }

  const baseItems = cloneWorldItems(grid.initialWorldItems ?? grid.worldItems);
  const baseGates = cloneLockedGates(grid.initialLockedGates ?? grid.lockedGates, true);
  const synced = syncWorldSwitchesAndGates(grid.floorSwitches, baseGates, baseItems);

  return {
    ...grid,
    robot: {
      ...grid.robot,
      x: grid.robot.initialX,
      y: grid.robot.initialY,
      dir: grid.robot.initialDir,
      carriedItem: null,
    },
    flags: grid.flags.map((f) => ({ ...f, collected: false })),
    ...(grid.waterCells !== undefined
      ? {
          waterCells: grid.waterCells.map((w) => ({ ...w })),
          bridgedWaterCells: [],
        }
      : grid.bridgedWaterCells !== undefined
      ? { bridgedWaterCells: [] }
      : {}),
    ...(baseGates.length > 0 || grid.lockedGates !== undefined
      ? {
          lockedGates: synced.lockedGates ?? [],
          initialLockedGates: cloneLockedGates(baseGates, true),
        }
      : {}),
    ...(grid.floorSwitches !== undefined
      ? {
          floorSwitches: synced.floorSwitches ?? [],
        }
      : {}),
    ...(baseItems.length > 0 || grid.worldItems !== undefined
      ? {
          worldItems: baseItems,
          initialWorldItems: cloneWorldItems(baseItems),
        }
      : {}),
    lastInteractionFeedback: null,
    trace: [{ x: grid.robot.initialX, y: grid.robot.initialY }],
    status: 'IDLE',
  };
}

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
 * (cannot be collected yet because an earlier prerequisite waypoint or required floor switch remains unsatisfied).
 *
 * Rules:
 * - Already-collected flags (`flag.collected === true`) are never padlocked.
 * - A non-goal numbered flag (`!flag.isGoal`) with `order = k` is padlocked iff
 *   at least one uncollected non-goal flag has `order < k`.
 * - A goal flag (`flag.isGoal === true`) is padlocked iff at least one
 *   non-goal flag remains uncollected OR at least one goal-required FloorSwitch is inactive.
 */
export function isFlagPadlocked(
  flag: FlagObjective,
  allFlags: readonly FlagObjective[],
  floorSwitches?: readonly FloorSwitch[],
  lockedGates?: readonly LockedGate[]
): boolean {
  if (flag.collected) {
    return false;
  }

  if (flag.isGoal) {
    const hasUncollectedWaypoint = allFlags.some((other) => !other.isGoal && !other.collected);
    const hasInactiveGoalSwitch = !areGoalSwitchesSatisfied(floorSwitches, lockedGates);
    return hasUncollectedWaypoint || hasInactiveGoalSwitch;
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
  allFlags: readonly FlagObjective[],
  floorSwitches?: readonly FloorSwitch[],
  lockedGates?: readonly LockedGate[]
): Set<string> {
  const lockedIds = new Set<string>();
  for (const flag of allFlags) {
    if (isFlagPadlocked(flag, allFlags, floorSwitches, lockedGates)) {
      lockedIds.add(flag.id);
    }
  }
  return lockedIds;
}

export type RobotGridActionType =
  | 'MOVE_FWD'
  | 'MOVE_BACK'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'PICK_UP'
  | 'USE_DROP';

export interface MoveResult {
  valid: boolean;
  newX: number;
  newY: number;
  newDir: Direction;
  flags: FlagObjective[];
  trace: CellCoord[];
  isSuccess: boolean;
  isCollision: boolean;
  bridgedWaterCells?: CellCoord[];
  lockedGates?: LockedGate[];
  floorSwitches?: FloorSwitch[];
  worldItems?: WorldItem[];
  carriedItem?: WorldItem | null;
  interactionFeedback?: WorldInteractionFeedback | null;
}

function evaluateGoalCollection(
  robotX: number,
  robotY: number,
  flags: FlagObjective[],
  floorSwitches?: readonly FloorSwitch[],
  lockedGates?: readonly LockedGate[]
): { updatedFlags: FlagObjective[]; isSuccess: boolean } {
  const afterNonGoalFlags = flags.map((f) => {
    if (
      !f.isGoal &&
      !f.collected &&
      f.x === robotX &&
      f.y === robotY &&
      !isFlagPadlocked(f, flags, floorSwitches, lockedGates)
    ) {
      return { ...f, collected: true };
    }
    return f;
  });

  const allIntermediateCollected = afterNonGoalFlags.every((f) => f.isGoal || f.collected);
  const switchesSatisfied = areGoalSwitchesSatisfied(floorSwitches, lockedGates);
  const canCollectGoal = allIntermediateCollected && switchesSatisfied;

  const updatedFlags = afterNonGoalFlags.map((f) => {
    if (f.isGoal && !f.collected && f.x === robotX && f.y === robotY && canCollectGoal) {
      return { ...f, collected: true };
    }
    return f;
  });

  const onGoal = updatedFlags.some((f) => f.isGoal && f.x === robotX && f.y === robotY);
  const isSuccess = onGoal && canCollectGoal;

  return { updatedFlags, isSuccess };
}

export function executeRobotAction(
  action: RobotGridActionType,
  grid: GridState
): MoveResult {
  const { robot, barriers, width, height, flags, trace } = grid;
  const currentDir = robot.dir;
  const nextFeedbackSeq = (grid.lastInteractionFeedback?.seq ?? 0) + 1;

  // Sync floor switches and gates against current floor items so raw GridState literals work seamlessly
  const syncedInitial = syncWorldSwitchesAndGates(
    grid.floorSwitches,
    grid.lockedGates,
    grid.worldItems
  );
  const currentSwitches = syncedInitial.floorSwitches;
  const currentGates = syncedInitial.lockedGates;
  const currentItems = grid.worldItems ? cloneWorldItems(grid.worldItems) : undefined;
  const currentBridged = grid.bridgedWaterCells
    ? grid.bridgedWaterCells.map((c) => ({ ...c }))
    : grid.waterCells
    ? []
    : undefined;
  const currentCarried = robot.carriedItem ?? null;

  const baseInteractiveFields = {
    bridgedWaterCells: currentBridged,
    lockedGates: currentGates,
    floorSwitches: currentSwitches,
    worldItems: currentItems,
    carriedItem: currentCarried,
    interactionFeedback: null as WorldInteractionFeedback | null,
  };

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
      ...baseInteractiveFields,
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
      ...baseInteractiveFields,
    };
  }

  if (action === 'PICK_UP') {
    if (currentCarried) {
      return {
        valid: false,
        newX: robot.x,
        newY: robot.y,
        newDir: currentDir,
        flags,
        trace,
        isSuccess: false,
        isCollision: false,
        ...baseInteractiveFields,
        interactionFeedback: {
          kind: 'noop-full',
          message: 'Backpack is full.',
          seq: nextFeedbackSeq,
        },
      };
    }

    const itemsList = currentItems ?? [];
    const foundIdx = itemsList.findIndex((it) => it.x === robot.x && it.y === robot.y);
    if (foundIdx === -1) {
      return {
        valid: false,
        newX: robot.x,
        newY: robot.y,
        newDir: currentDir,
        flags,
        trace,
        isSuccess: false,
        isCollision: false,
        ...baseInteractiveFields,
        interactionFeedback: {
          kind: 'noop-empty',
          message: 'Nothing to pick up here.',
          seq: nextFeedbackSeq,
        },
      };
    }

    const pickedItem = { ...itemsList[foundIdx] };
    const remainingItems = itemsList.filter((_, idx) => idx !== foundIdx);
    const syncedAfterPick = syncWorldSwitchesAndGates(
      currentSwitches,
      currentGates,
      remainingItems
    );

    return {
      valid: true,
      newX: robot.x,
      newY: robot.y,
      newDir: currentDir,
      flags,
      trace,
      isSuccess: false,
      isCollision: false,
      bridgedWaterCells: currentBridged,
      lockedGates: syncedAfterPick.lockedGates,
      floorSwitches: syncedAfterPick.floorSwitches,
      worldItems: remainingItems,
      carriedItem: pickedItem,
      interactionFeedback: null,
    };
  }

  if (action === 'USE_DROP') {
    if (!currentCarried) {
      return {
        valid: false,
        newX: robot.x,
        newY: robot.y,
        newDir: currentDir,
        flags,
        trace,
        isSuccess: false,
        isCollision: false,
        ...baseInteractiveFields,
        interactionFeedback: {
          kind: 'noop-empty',
          message: 'Backpack is empty.',
          seq: nextFeedbackSeq,
        },
      };
    }

    const delta = DIR_DELTAS[currentDir];
    const aheadX = robot.x + delta.dx;
    const aheadY = robot.y + delta.dy;
    const aheadInBounds = aheadX >= 0 && aheadX < width && aheadY >= 0 && aheadY < height;
    const aheadBlockedByWall =
      aheadInBounds && hasWallBetween(robot.x, robot.y, aheadX, aheadY, barriers);

    if (currentCarried.type === 'key') {
      if (aheadInBounds && !aheadBlockedByWall && currentGates) {
        const gateIdx = currentGates.findIndex(
          (g) => g.x === aheadX && g.y === aheadY && !g.unlocked
        );
        if (gateIdx !== -1) {
          const targetGate = currentGates[gateIdx];
          if (keysMatchGate(currentCarried, targetGate)) {
            const updatedGates = currentGates.map((g, idx) =>
              idx === gateIdx ? { ...g, unlocked: true, unlockedByKey: true } : g
            );
            const syncedAfterUnlock = syncWorldSwitchesAndGates(
              currentSwitches,
              updatedGates,
              currentItems
            );
            const goalEval = evaluateGoalCollection(
              robot.x,
              robot.y,
              flags,
              syncedAfterUnlock.floorSwitches,
              syncedAfterUnlock.lockedGates
            );

            return {
              valid: true,
              newX: robot.x,
              newY: robot.y,
              newDir: currentDir,
              flags: goalEval.updatedFlags,
              trace,
              isSuccess: goalEval.isSuccess,
              isCollision: false,
              bridgedWaterCells: currentBridged,
              lockedGates: syncedAfterUnlock.lockedGates,
              floorSwitches: syncedAfterUnlock.floorSwitches,
              worldItems: currentItems,
              carriedItem: null,
              interactionFeedback: null,
            };
          }

          return {
            valid: false,
            newX: robot.x,
            newY: robot.y,
            newDir: currentDir,
            flags,
            trace,
            isSuccess: false,
            isCollision: false,
            ...baseInteractiveFields,
            interactionFeedback: {
              kind: 'wrong-key',
              message: `Key does not match ${targetGate.color} ${targetGate.shape} gate.`,
              seq: nextFeedbackSeq,
            },
          };
        }
      }

      return {
        valid: false,
        newX: robot.x,
        newY: robot.y,
        newDir: currentDir,
        flags,
        trace,
        isSuccess: false,
        isCollision: false,
        ...baseInteractiveFields,
        interactionFeedback: {
          kind: 'invalid-use',
          message: 'Face a matching locked gate to use key.',
          seq: nextFeedbackSeq,
        },
      };
    }

    if (currentCarried.type === 'plank') {
      const closedGateAhead = Boolean(
        currentGates?.some((g) => g.x === aheadX && g.y === aheadY && !g.unlocked)
      );
      if (
        aheadInBounds &&
        !aheadBlockedByWall &&
        !closedGateAhead &&
        isUnbridgedWater(aheadX, aheadY, grid.waterCells, currentBridged)
      ) {
        const nextBridged = [...(currentBridged ?? []), { x: aheadX, y: aheadY }];
        return {
          valid: true,
          newX: robot.x,
          newY: robot.y,
          newDir: currentDir,
          flags,
          trace,
          isSuccess: false,
          isCollision: false,
          bridgedWaterCells: nextBridged,
          lockedGates: currentGates,
          floorSwitches: currentSwitches,
          worldItems: currentItems,
          carriedItem: null,
          interactionFeedback: null,
        };
      }

      return {
        valid: false,
        newX: robot.x,
        newY: robot.y,
        newDir: currentDir,
        flags,
        trace,
        isSuccess: false,
        isCollision: false,
        ...baseInteractiveFields,
        interactionFeedback: {
          kind: 'invalid-use',
          message: 'Face unbridged water ahead to place plank.',
          seq: nextFeedbackSeq,
        },
      };
    }

    if (currentCarried.type === 'crate') {
      const itemsList = currentItems ?? [];
      const alreadyOccupied = itemsList.some((it) => it.x === robot.x && it.y === robot.y);
      if (alreadyOccupied) {
        return {
          valid: false,
          newX: robot.x,
          newY: robot.y,
          newDir: currentDir,
          flags,
          trace,
          isSuccess: false,
          isCollision: false,
          ...baseInteractiveFields,
          interactionFeedback: {
            kind: 'occupied',
            message: 'Current tile already holds an item.',
            seq: nextFeedbackSeq,
          },
        };
      }

      const droppedCrate: WorldItem = {
        ...currentCarried,
        x: robot.x,
        y: robot.y,
      };
      const updatedItems = [...itemsList, droppedCrate];
      const syncedAfterDrop = syncWorldSwitchesAndGates(
        currentSwitches,
        currentGates,
        updatedItems
      );
      const goalEval = evaluateGoalCollection(
        robot.x,
        robot.y,
        flags,
        syncedAfterDrop.floorSwitches,
        syncedAfterDrop.lockedGates
      );

      return {
        valid: true,
        newX: robot.x,
        newY: robot.y,
        newDir: currentDir,
        flags: goalEval.updatedFlags,
        trace,
        isSuccess: goalEval.isSuccess,
        isCollision: false,
        bridgedWaterCells: currentBridged,
        lockedGates: syncedAfterDrop.lockedGates,
        floorSwitches: syncedAfterDrop.floorSwitches,
        worldItems: updatedItems,
        carriedItem: null,
        interactionFeedback: null,
      };
    }
  }

  // Linear movement (MOVE_FWD | MOVE_BACK)
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
      ...baseInteractiveFields,
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
      ...baseInteractiveFields,
    };
  }

  // Check closed locked gate collision
  const closedGateCollision = Boolean(
    currentGates?.some((g) => g.x === targetX && g.y === targetY && !g.unlocked)
  );
  if (closedGateCollision) {
    return {
      valid: false,
      newX: robot.x,
      newY: robot.y,
      newDir: currentDir,
      flags,
      trace,
      isSuccess: false,
      isCollision: true,
      ...baseInteractiveFields,
    };
  }

  // Check unbridged water collision
  if (isUnbridgedWater(targetX, targetY, grid.waterCells, currentBridged)) {
    return {
      valid: false,
      newX: robot.x,
      newY: robot.y,
      newDir: currentDir,
      flags,
      trace,
      isSuccess: false,
      isCollision: true,
      ...baseInteractiveFields,
    };
  }

  // Move is valid! Update trace and sequentially-gated flags (1 -> 2 -> ... -> Goal).
  // Stepping onto a locked flag or locked goal is safe (not a collision) and leaves it uncollected.
  const goalEval = evaluateGoalCollection(
    targetX,
    targetY,
    flags,
    currentSwitches,
    currentGates
  );

  const updatedTrace = [...trace, { x: targetX, y: targetY }];

  return {
    valid: true,
    newX: targetX,
    newY: targetY,
    newDir: currentDir,
    flags: goalEval.updatedFlags,
    trace: updatedTrace,
    isSuccess: goalEval.isSuccess,
    isCollision: false,
    ...baseInteractiveFields,
  };
}
