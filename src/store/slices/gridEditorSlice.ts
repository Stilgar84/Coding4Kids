import type {
  Direction,
  FloorSwitch,
  LockedGate,
  WorldItem,
} from '../../types';
import {
  cloneLockedGates,
  cloneWorldItems,
  DEFAULT_COLOR_FOR_SHAPE,
  resetGridInteractiveState,
  syncWorldSwitchesAndGates,
} from '../../engine/physics';
import {
  createGridFromPreset,
  PRESET_LEVELS,
} from '../helpers/simStateHelpers';
import type {
  GridEditorSliceActions,
  StoreContext,
  StoreGet,
  StoreSet,
} from '../types';

export function createGridEditorSlice(
  set: StoreSet,
  get: StoreGet,
  ctx: StoreContext
): GridEditorSliceActions {
  return {
    setLevel: (levelId) => {
      if (get().appMode === 'curriculum') {
        get().setAppMode('sandbox');
      }
      get().clearHistory();
      const prevFitToView = get().grid.fitToView ?? false;
      get().reset();
      const preset =
        PRESET_LEVELS.find((p) => p.id === levelId) || PRESET_LEVELS[0];
      set({
        currentLevel: levelId,
        grid: createGridFromPreset(preset, prevFitToView),
      });
      get().runInstantIfActive();
    },

    toggleWall: (edge) => {
      if (get().appMode === 'curriculum') return;
      ctx.recordMutation('Toggle wall');
      set((state) => {
        const exists = state.grid.barriers.some(
          (b) =>
            b.orientation === edge.orientation &&
            b.x === edge.x &&
            b.y === edge.y
        );
        const newBarriers = exists
          ? state.grid.barriers.filter(
              (b) =>
                !(
                  b.orientation === edge.orientation &&
                  b.x === edge.x &&
                  b.y === edge.y
                )
            )
          : [...state.grid.barriers, edge];
        return {
          grid: { ...state.grid, barriers: newBarriers },
        };
      });
      get().runInstantIfActive();
    },

    addWall: (edge) => {
      if (get().appMode === 'curriculum') return;
      const exists = get().grid.barriers.some(
        (b) =>
          b.orientation === edge.orientation &&
          b.x === edge.x &&
          b.y === edge.y
      );
      if (exists) return;
      ctx.recordMutation('Add wall');
      set((state) => {
        return {
          grid: {
            ...state.grid,
            barriers: [...state.grid.barriers, edge],
          },
        };
      });
      get().runInstantIfActive();
    },

    resizeBoard: (direction, delta) => {
      if (get().appMode === 'curriculum') return;
      if (delta === 0) return;
      const { grid } = get();
      const minSize = 3;
      const maxSize = 16;
      const { width, height, robot, flags, barriers } = grid;
      const water = grid.waterCells ?? [];
      const gates = grid.initialLockedGates ?? grid.lockedGates ?? [];
      const switches = grid.floorSwitches ?? [];
      const items = grid.initialWorldItems ?? grid.worldItems ?? [];

      const hasEntityAtOrBeyondX = (limitX: number) =>
        water.some((w) => w.x >= limitX) ||
        gates.some((g) => g.x >= limitX) ||
        switches.some((s) => s.x >= limitX) ||
        items.some((it) => it.x >= limitX) ||
        (grid.worldItems ?? []).some((it) => it.x >= limitX);

      const hasEntityAtOrBeyondY = (limitY: number) =>
        water.some((w) => w.y >= limitY) ||
        gates.some((g) => g.y >= limitY) ||
        switches.some((s) => s.y >= limitY) ||
        items.some((it) => it.y >= limitY) ||
        (grid.worldItems ?? []).some((it) => it.y >= limitY);

      const hasEntityAtXZero = () =>
        water.some((w) => w.x === 0) ||
        gates.some((g) => g.x === 0) ||
        switches.some((s) => s.x === 0) ||
        items.some((it) => it.x === 0) ||
        (grid.worldItems ?? []).some((it) => it.x === 0);

      const hasEntityAtYZero = () =>
        water.some((w) => w.y === 0) ||
        gates.some((g) => g.y === 0) ||
        switches.some((s) => s.y === 0) ||
        items.some((it) => it.y === 0) ||
        (grid.worldItems ?? []).some((it) => it.y === 0);

      if (direction === 'RIGHT') {
        const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
        if (newWidth === width) return;
        if (delta < 0) {
          const hasBlocked =
            robot.x >= newWidth ||
            robot.initialX >= newWidth ||
            flags.some((f) => f.x >= newWidth) ||
            barriers.some((b) => b.x >= newWidth) ||
            hasEntityAtOrBeyondX(newWidth);
          if (hasBlocked) return;
        }
      } else if (direction === 'BOTTOM') {
        const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
        if (newHeight === height) return;
        if (delta < 0) {
          const hasBlocked =
            robot.y >= newHeight ||
            robot.initialY >= newHeight ||
            flags.some((f) => f.y >= newHeight) ||
            barriers.some((b) => b.y >= newHeight) ||
            hasEntityAtOrBeyondY(newHeight);
          if (hasBlocked) return;
        }
      } else if (direction === 'LEFT') {
        const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
        if (newWidth === width) return;
        if (delta < 0) {
          const hasBlocked =
            robot.x === 0 ||
            robot.initialX === 0 ||
            flags.some((f) => f.x === 0) ||
            barriers.some((b) =>
              b.orientation === 'H' ? b.x === 0 : b.x <= 1
            ) ||
            hasEntityAtXZero();
          if (hasBlocked) return;
        }
      } else if (direction === 'TOP') {
        const newHeight = Math.max(minSize, Math.min(maxSize, height + delta));
        if (newHeight === height) return;
        if (delta < 0) {
          const hasBlocked =
            robot.y === 0 ||
            robot.initialY === 0 ||
            flags.some((f) => f.y === 0) ||
            barriers.some((b) =>
              b.orientation === 'V' ? b.y === 0 : b.y <= 1
            ) ||
            hasEntityAtYZero();
          if (hasBlocked) return;
        }
      }

      ctx.recordMutation('Resize board');

      set((state) => {
        const { grid } = state;
        const { width, height, robot, flags, barriers, trace } = grid;

        if (direction === 'RIGHT') {
          const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
          if (newWidth === width) return state;
          return { grid: { ...grid, width: newWidth } };
        }

        if (direction === 'BOTTOM') {
          const newHeight = Math.max(
            minSize,
            Math.min(maxSize, height + delta)
          );
          if (newHeight === height) return state;
          return { grid: { ...grid, height: newHeight } };
        }

        if (direction === 'LEFT') {
          const newWidth = Math.max(minSize, Math.min(maxSize, width + delta));
          if (newWidth === width) return state;

          const shiftX = delta;
          const nextRobot = {
            ...robot,
            x: robot.x + shiftX,
            initialX: robot.initialX + shiftX,
          };
          const nextFlags = flags.map((f) => ({ ...f, x: f.x + shiftX }));
          const nextBarriers = barriers.map((b) => ({ ...b, x: b.x + shiftX }));
          const nextTrace = trace.map((t) => ({ ...t, x: t.x + shiftX }));

          return {
            grid: {
              ...grid,
              width: newWidth,
              robot: nextRobot,
              flags: nextFlags,
              barriers: nextBarriers,
              trace: nextTrace,
              ...(grid.waterCells
                ? {
                    waterCells: grid.waterCells.map((w) => ({
                      ...w,
                      x: w.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.bridgedWaterCells
                ? {
                    bridgedWaterCells: grid.bridgedWaterCells.map((w) => ({
                      ...w,
                      x: w.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.lockedGates
                ? {
                    lockedGates: grid.lockedGates.map((g) => ({
                      ...g,
                      x: g.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.initialLockedGates
                ? {
                    initialLockedGates: grid.initialLockedGates.map((g) => ({
                      ...g,
                      x: g.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.floorSwitches
                ? {
                    floorSwitches: grid.floorSwitches.map((s) => ({
                      ...s,
                      x: s.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.worldItems
                ? {
                    worldItems: grid.worldItems.map((it) => ({
                      ...it,
                      x: it.x + shiftX,
                    })),
                  }
                : {}),
              ...(grid.initialWorldItems
                ? {
                    initialWorldItems: grid.initialWorldItems.map((it) => ({
                      ...it,
                      x: it.x + shiftX,
                    })),
                  }
                : {}),
            },
          };
        }

        if (direction === 'TOP') {
          const newHeight = Math.max(
            minSize,
            Math.min(maxSize, height + delta)
          );
          if (newHeight === height) return state;

          const shiftY = delta;
          const nextRobot = {
            ...robot,
            y: robot.y + shiftY,
            initialY: robot.initialY + shiftY,
          };
          const nextFlags = flags.map((f) => ({ ...f, y: f.y + shiftY }));
          const nextBarriers = barriers.map((b) => ({ ...b, y: b.y + shiftY }));
          const nextTrace = trace.map((t) => ({ ...t, y: t.y + shiftY }));

          return {
            grid: {
              ...grid,
              height: newHeight,
              robot: nextRobot,
              flags: nextFlags,
              barriers: nextBarriers,
              trace: nextTrace,
              ...(grid.waterCells
                ? {
                    waterCells: grid.waterCells.map((w) => ({
                      ...w,
                      y: w.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.bridgedWaterCells
                ? {
                    bridgedWaterCells: grid.bridgedWaterCells.map((w) => ({
                      ...w,
                      y: w.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.lockedGates
                ? {
                    lockedGates: grid.lockedGates.map((g) => ({
                      ...g,
                      y: g.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.initialLockedGates
                ? {
                    initialLockedGates: grid.initialLockedGates.map((g) => ({
                      ...g,
                      y: g.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.floorSwitches
                ? {
                    floorSwitches: grid.floorSwitches.map((s) => ({
                      ...s,
                      y: s.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.worldItems
                ? {
                    worldItems: grid.worldItems.map((it) => ({
                      ...it,
                      y: it.y + shiftY,
                    })),
                  }
                : {}),
              ...(grid.initialWorldItems
                ? {
                    initialWorldItems: grid.initialWorldItems.map((it) => ({
                      ...it,
                      y: it.y + shiftY,
                    })),
                  }
                : {}),
            },
          };
        }

        return state;
      });
      get().runInstantIfActive();
    },

    setCellContent: (x, y) => {
      if (get().appMode === 'curriculum') return;
      const { editorTool, editorKeyGateVariant, grid } = get();
      if (editorTool === 'ROBOT') {
        ctx.recordMutation('Place/rotate robot');
        const nextDir: Direction =
          grid.robot.x === x && grid.robot.y === y
            ? grid.robot.dir === 'NORTH'
              ? 'EAST'
              : grid.robot.dir === 'EAST'
              ? 'SOUTH'
              : grid.robot.dir === 'SOUTH'
              ? 'WEST'
              : 'NORTH'
            : grid.robot.dir;
        const nextWater = grid.waterCells?.filter(
          (w) => !(w.x === x && w.y === y)
        );
        const nextGates = (
          grid.initialLockedGates ?? grid.lockedGates
        )?.filter((g) => !(g.x === x && g.y === y));
        set({
          grid: {
            ...grid,
            robot: {
              ...grid.robot,
              x,
              y,
              dir: nextDir,
              initialX: x,
              initialY: y,
              initialDir: nextDir,
            },
            ...(nextWater !== undefined ? { waterCells: nextWater } : {}),
            ...(nextGates !== undefined
              ? {
                  lockedGates: cloneLockedGates(nextGates, true),
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            trace: [{ x, y }],
          },
        });
      } else if (editorTool === 'FLAG') {
        ctx.recordMutation('Place flag');
        const nextFlags = grid.flags.filter((f) => !(f.x === x && f.y === y));
        const order = nextFlags.filter((f) => !f.isGoal).length + 1;
        nextFlags.push({
          id: `flag_${Date.now()}`,
          x,
          y,
          isGoal: false,
          order,
          collected: false,
        });
        set({ grid: { ...grid, flags: nextFlags } });
      } else if (editorTool === 'GOAL') {
        ctx.recordMutation('Place goal');
        const nextFlags = grid.flags.filter(
          (f) => !f.isGoal && !(f.x === x && f.y === y)
        );
        nextFlags.push({
          id: `goal_${Date.now()}`,
          x,
          y,
          isGoal: true,
          order: 99,
          collected: false,
        });
        set({ grid: { ...grid, flags: nextFlags } });
      } else if (editorTool === 'WATER') {
        const currentWater = grid.waterCells ?? [];
        const exists = currentWater.some((w) => w.x === x && w.y === y);
        if (!exists && grid.robot.initialX === x && grid.robot.initialY === y) {
          return;
        }
        ctx.recordMutation(exists ? 'Remove water' : 'Place water');
        const nextWater = exists
          ? currentWater.filter((w) => !(w.x === x && w.y === y))
          : [...currentWater, { x, y }];
        const baseGates = (
          grid.initialLockedGates ??
          grid.lockedGates ??
          []
        ).filter((g) => exists || !(g.x === x && g.y === y));
        const baseSwitches = (grid.floorSwitches ?? []).filter(
          (s) => exists || !(s.x === x && s.y === y)
        );
        const baseItems = (
          grid.initialWorldItems ??
          grid.worldItems ??
          []
        ).filter((it) => exists || !(it.x === x && it.y === y));
        const synced = syncWorldSwitchesAndGates(
          baseSwitches,
          baseGates,
          baseItems
        );
        set({
          grid: resetGridInteractiveState({
            ...grid,
            waterCells: nextWater,
            bridgedWaterCells: [],
            ...(grid.lockedGates !== undefined || baseGates.length > 0
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(baseGates, true),
                }
              : {}),
            ...(grid.floorSwitches !== undefined || baseSwitches.length > 0
              ? { floorSwitches: synced.floorSwitches ?? [] }
              : {}),
            ...(grid.worldItems !== undefined || baseItems.length > 0
              ? {
                  worldItems: cloneWorldItems(baseItems),
                  initialWorldItems: cloneWorldItems(baseItems),
                }
              : {}),
          }),
        });
      } else if (editorTool === 'GATE') {
        if (grid.robot.initialX === x && grid.robot.initialY === y) {
          return;
        }
        const shape = editorKeyGateVariant;
        const color = DEFAULT_COLOR_FOR_SHAPE[shape];
        const currentGates = cloneLockedGates(
          grid.initialLockedGates ?? grid.lockedGates ?? [],
          true
        );
        const existingAtCell = currentGates.find((g) => g.x === x && g.y === y);
        const isSameVariant =
          existingAtCell &&
          existingAtCell.shape === shape &&
          existingAtCell.color === color;

        ctx.recordMutation(isSameVariant ? 'Remove gate' : 'Place gate');
        const nextGates: LockedGate[] = currentGates.filter(
          (g) => !(g.x === x && g.y === y)
        );
        if (!isSameVariant) {
          nextGates.push({
            id: existingAtCell?.id ?? `gate_${Date.now()}_${x}_${y}`,
            x,
            y,
            shape,
            color,
            unlocked: false,
            unlockedByKey: false,
          });
        }
        const nextWater = (grid.waterCells ?? []).filter(
          (w) => !(w.x === x && w.y === y)
        );
        const nextSwitches = (grid.floorSwitches ?? []).filter(
          (s) => !(s.x === x && s.y === y)
        );
        const nextItems = (
          grid.initialWorldItems ??
          grid.worldItems ??
          []
        ).filter((it) => !(it.x === x && it.y === y));
        const synced = syncWorldSwitchesAndGates(
          nextSwitches,
          nextGates,
          nextItems
        );

        set({
          grid: resetGridInteractiveState({
            ...grid,
            ...(grid.waterCells !== undefined ? { waterCells: nextWater } : {}),
            lockedGates: synced.lockedGates ?? [],
            initialLockedGates: cloneLockedGates(nextGates, true),
            ...(grid.floorSwitches !== undefined
              ? { floorSwitches: synced.floorSwitches ?? [] }
              : {}),
            ...(grid.worldItems !== undefined ||
            grid.initialWorldItems !== undefined
              ? {
                  worldItems: cloneWorldItems(nextItems),
                  initialWorldItems: cloneWorldItems(nextItems),
                }
              : {}),
          }),
        });
      } else if (editorTool === 'SWITCH') {
        const currentSwitches = grid.floorSwitches ?? [];
        const existingSwitch = currentSwitches.find(
          (s) => s.x === x && s.y === y
        );
        ctx.recordMutation(
          existingSwitch ? 'Remove floor switch' : 'Place floor switch'
        );

        const nextSwitches: FloorSwitch[] = existingSwitch
          ? currentSwitches.filter((s) => !(s.x === x && s.y === y))
          : [
              ...currentSwitches,
              {
                id: `switch_${Date.now()}_${x}_${y}`,
                x,
                y,
                requiredForGoal: true,
                active: false,
              },
            ];
        const nextWater = (grid.waterCells ?? []).filter(
          (w) => !(w.x === x && w.y === y)
        );
        const nextGates = cloneLockedGates(
          (grid.initialLockedGates ?? grid.lockedGates ?? []).filter(
            (g) => !(g.x === x && g.y === y)
          ),
          true
        );
        const baseItems = cloneWorldItems(
          grid.initialWorldItems ?? grid.worldItems ?? []
        );
        const synced = syncWorldSwitchesAndGates(
          nextSwitches,
          nextGates,
          baseItems
        );

        set({
          grid: resetGridInteractiveState({
            ...grid,
            ...(grid.waterCells !== undefined ? { waterCells: nextWater } : {}),
            ...(grid.lockedGates !== undefined
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            floorSwitches: synced.floorSwitches ?? [],
          }),
        });
      } else if (
        editorTool === 'KEY' ||
        editorTool === 'PLANK' ||
        editorTool === 'CRATE'
      ) {
        const targetType =
          editorTool === 'KEY'
            ? 'key'
            : editorTool === 'PLANK'
            ? 'plank'
            : 'crate';
        const shape = editorKeyGateVariant;
        const color = DEFAULT_COLOR_FOR_SHAPE[shape];
        const currentItems = cloneWorldItems(
          grid.initialWorldItems ?? grid.worldItems ?? []
        );
        const existingItem = currentItems.find((it) => it.x === x && it.y === y);
        const isSameItem =
          existingItem &&
          existingItem.type === targetType &&
          (targetType !== 'key' ||
            (existingItem.shape === shape && existingItem.color === color));

        ctx.recordMutation(
          isSameItem ? `Remove ${targetType}` : `Place ${targetType}`
        );
        const nextItems: WorldItem[] = currentItems.filter(
          (it) => !(it.x === x && it.y === y)
        );
        if (!isSameItem) {
          nextItems.push({
            id: existingItem?.id ?? `${targetType}_${Date.now()}_${x}_${y}`,
            type: targetType,
            x,
            y,
            ...(targetType === 'key' ? { shape, color } : {}),
          });
        }
        const nextWater = (grid.waterCells ?? []).filter(
          (w) => !(w.x === x && w.y === y)
        );
        const nextGates = cloneLockedGates(
          (grid.initialLockedGates ?? grid.lockedGates ?? []).filter(
            (g) => !(g.x === x && g.y === y)
          ),
          true
        );
        const synced = syncWorldSwitchesAndGates(
          grid.floorSwitches,
          nextGates,
          nextItems
        );

        set({
          grid: resetGridInteractiveState({
            ...grid,
            ...(grid.waterCells !== undefined ? { waterCells: nextWater } : {}),
            ...(grid.lockedGates !== undefined
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            ...(grid.floorSwitches !== undefined
              ? { floorSwitches: synced.floorSwitches ?? [] }
              : {}),
            worldItems: cloneWorldItems(nextItems),
            initialWorldItems: cloneWorldItems(nextItems),
          }),
        });
      } else if (editorTool === 'BEACON') {
        const beacons = grid.beaconTiles ? [...grid.beaconTiles] : [];
        const existingIdx = beacons.findIndex((b) => b.x === x && b.y === y);
        const BEACON_SEQUENCE = [
          { color: 'red' as const, shape: 'circle' as const },
          { color: 'blue' as const, shape: 'triangle' as const },
          { color: 'green' as const, shape: 'square' as const },
          { color: 'yellow' as const, shape: 'diamond' as const },
        ];
        if (existingIdx >= 0) {
          const current = beacons[existingIdx];
          const curSeqIdx = BEACON_SEQUENCE.findIndex(
            (s) => s.color === current.color && s.shape === current.shape
          );
          if (curSeqIdx >= 0 && curSeqIdx < BEACON_SEQUENCE.length - 1) {
            beacons[existingIdx] = { x, y, ...BEACON_SEQUENCE[curSeqIdx + 1] };
            ctx.recordMutation('Update beacon');
          } else {
            beacons.splice(existingIdx, 1);
            ctx.recordMutation('Remove beacon');
          }
        } else {
          beacons.push({ x, y, ...BEACON_SEQUENCE[0] });
          ctx.recordMutation('Place beacon');
        }
        set({
          grid: resetGridInteractiveState({
            ...grid,
            beaconTiles: beacons,
          }),
        });
      } else if (editorTool === 'DIAL') {
        const dials = grid.dialTiles ? [...grid.dialTiles] : [];
        const existingIdx = dials.findIndex((d) => d.x === x && d.y === y);
        if (existingIdx >= 0) {
          const curVal = dials[existingIdx].value;
          if (curVal < 5) {
            dials[existingIdx] = { x, y, value: curVal + 1 };
            ctx.recordMutation('Update dial');
          } else {
            dials.splice(existingIdx, 1);
            ctx.recordMutation('Remove dial');
          }
        } else {
          dials.push({ x, y, value: 1 });
          ctx.recordMutation('Place dial');
        }
        set({
          grid: resetGridInteractiveState({
            ...grid,
            dialTiles: dials,
          }),
        });
      } else if (editorTool === 'STACK_DEPOT') {
        const currentItems = cloneWorldItems(
          grid.initialWorldItems ?? grid.worldItems ?? []
        );
        const existingIdx = currentItems.findIndex(
          (it) => it.x === x && it.y === y
        );
        if (existingIdx >= 0 && (currentItems[existingIdx].count ?? 1) > 1) {
          const curCount = currentItems[existingIdx].count!;
          if (curCount < 5) {
            currentItems[existingIdx].count = curCount + 1;
            ctx.recordMutation('Update stack depot');
          } else {
            currentItems.splice(existingIdx, 1);
            ctx.recordMutation('Remove stack depot');
          }
        } else {
          if (existingIdx >= 0) {
            currentItems.splice(existingIdx, 1);
          }
          currentItems.push({
            id: `stack_depot_${Date.now()}_${x}_${y}`,
            type: 'crate',
            x,
            y,
            count: 3,
          });
          ctx.recordMutation('Place stack depot');
        }
        set({
          grid: resetGridInteractiveState({
            ...grid,
            worldItems: cloneWorldItems(currentItems),
            initialWorldItems: cloneWorldItems(currentItems),
          }),
        });
      } else if (editorTool === 'ERASE') {
        const hasFlag = grid.flags.some((f) => f.x === x && f.y === y);
        const hasWater = Boolean(
          grid.waterCells?.some((w) => w.x === x && w.y === y)
        );
        const baseGates = grid.initialLockedGates ?? grid.lockedGates ?? [];
        const hasGate = baseGates.some((g) => g.x === x && g.y === y);
        const hasSwitch = Boolean(
          grid.floorSwitches?.some((s) => s.x === x && s.y === y)
        );
        const baseItems = grid.initialWorldItems ?? grid.worldItems ?? [];
        const hasItem =
          baseItems.some((it) => it.x === x && it.y === y) ||
          Boolean(grid.worldItems?.some((it) => it.x === x && it.y === y));
        const hasBeacon = Boolean(
          grid.beaconTiles?.some((b) => b.x === x && b.y === y)
        );
        const hasDial = Boolean(
          grid.dialTiles?.some((d) => d.x === x && d.y === y)
        );

        if (
          !hasFlag &&
          !hasWater &&
          !hasGate &&
          !hasSwitch &&
          !hasItem &&
          !hasBeacon &&
          !hasDial
        ) {
          return;
        }

        ctx.recordMutation('Erase cell');
        const nextFlags = grid.flags.filter((f) => !(f.x === x && f.y === y));
        const nextWater = grid.waterCells?.filter(
          (w) => !(w.x === x && w.y === y)
        );
        const nextGates = cloneLockedGates(
          baseGates.filter((g) => !(g.x === x && g.y === y)),
          true
        );
        const nextSwitches = grid.floorSwitches?.filter(
          (s) => !(s.x === x && s.y === y)
        );
        const nextItems = cloneWorldItems(
          baseItems.filter((it) => !(it.x === x && it.y === y))
        );
        const nextBeacons = grid.beaconTiles?.filter(
          (b) => !(b.x === x && b.y === y)
        );
        const nextDials = grid.dialTiles?.filter(
          (d) => !(d.x === x && d.y === y)
        );
        const synced = syncWorldSwitchesAndGates(
          nextSwitches,
          nextGates,
          nextItems
        );

        set({
          grid: resetGridInteractiveState({
            ...grid,
            flags: nextFlags,
            ...(nextWater !== undefined
              ? { waterCells: nextWater, bridgedWaterCells: [] }
              : {}),
            ...(grid.lockedGates !== undefined ||
            grid.initialLockedGates !== undefined
              ? {
                  lockedGates: synced.lockedGates ?? [],
                  initialLockedGates: cloneLockedGates(nextGates, true),
                }
              : {}),
            ...(nextSwitches !== undefined
              ? { floorSwitches: synced.floorSwitches ?? [] }
              : {}),
            ...(grid.worldItems !== undefined ||
            grid.initialWorldItems !== undefined
              ? {
                  worldItems: cloneWorldItems(nextItems),
                  initialWorldItems: cloneWorldItems(nextItems),
                }
              : {}),
            ...(nextBeacons !== undefined ? { beaconTiles: nextBeacons } : {}),
            ...(nextDials !== undefined ? { dialTiles: nextDials } : {}),
          }),
        });
      }
      get().runInstantIfActive();
    },

    toggleTrace: () => {
      set((state) => ({
        grid: { ...state.grid, showTrace: !state.grid.showTrace },
      }));
    },

    toggleFitToView: () => {
      set((state) => ({
        grid: { ...state.grid, fitToView: !state.grid.fitToView },
      }));
    },

    clearGridUserCustoms: () => {
      if (get().appMode === 'curriculum') return;
      ctx.recordMutation('Clear grid customs');
      const prevFitToView = get().grid.fitToView ?? false;
      const preset =
        PRESET_LEVELS.find((p) => p.id === get().currentLevel) ||
        PRESET_LEVELS[0];
      set({ grid: createGridFromPreset(preset, prevFitToView) });
      get().runInstantIfActive();
    },
  };
}
