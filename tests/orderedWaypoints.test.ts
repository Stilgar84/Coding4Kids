import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  executeRobotAction,
  isFlagPadlocked,
  getPadlockedFlagIds,
  getNextRequiredWaypointOrder,
} from '../src/engine/physics';
import {
  FlagPadlockOverlay,
  detectPadlockTransition,
} from '../src/simulations/grid/components/FlagPadlockOverlay';
import {
  GridOverlayLayer,
  GRID_CELL_SIZE,
} from '../src/simulations/grid/components/GridOverlayLayer';
import {
  renderGridMapSvg,
  generateGridMapThumbnail,
} from '../src/services/mapThumbnailGenerator';
import { runHeadlessSimulation } from '../src/engine/simulationRunner';
import { createInitialInterpreterState, tickInterpreter } from '../src/engine/interpreter';
import { LESSONS } from '../src/data/lessons';
import { FlagObjective, GridState, WorkspaceState } from '../src/types';

// Ensure simulation environments are registered
import '../src/simulations/grid/gridEnvironment';

function makeOrderedCorridorGrid(): GridState {
  // 1x5 horizontal corridor:
  // (0,0): Robot facing EAST
  // (1,0): Flag 2 (order 2)
  // (2,0): Goal (isGoal: true, order 3)
  // (3,0): Flag 1 (order 1)
  return {
    width: 5,
    height: 2,
    robot: {
      x: 0,
      y: 0,
      dir: 'EAST',
      initialX: 0,
      initialY: 0,
      initialDir: 'EAST',
    },
    barriers: [],
    flags: [
      { id: 'flag_2', x: 1, y: 0, isGoal: false, order: 2, collected: false },
      { id: 'goal_main', x: 2, y: 0, isGoal: true, order: 3, collected: false },
      { id: 'flag_1', x: 3, y: 0, isGoal: false, order: 1, collected: false },
    ],
    trace: [{ x: 0, y: 0 }],
    status: 'IDLE',
    showTrace: true,
  };
}

function makeWorkspace(blockTypes: Array<{ type: string; repeatCount?: number }>): WorkspaceState {
  return {
    MAIN: blockTypes.map((b, idx) => ({
      id: `blk_${idx}_${b.type}`,
      type: b.type,
      ...(b.repeatCount !== undefined ? { repeatCount: b.repeatCount } : {}),
    })),
    F1: [],
    F2: [],
    F3: [],
  };
}

describe('Commit 6: Padlock-Gated Ordered Waypoints (1 -> 2 -> Goal)', () => {
  describe('1. Lock-state helpers & single-goal maps', () => {
    it('leaves Goal unlocked from the start on single-goal maps (no numbered waypoints)', () => {
      const singleGoalFlags: FlagObjective[] = [
        { id: 'goal_only', x: 3, y: 1, isGoal: true, order: 1, collected: false },
      ];

      expect(isFlagPadlocked(singleGoalFlags[0], singleGoalFlags)).toBe(false);
      expect(getPadlockedFlagIds(singleGoalFlags).size).toBe(0);
      expect(getNextRequiredWaypointOrder(singleGoalFlags)).toBeNull();

      const grid: GridState = {
        width: 4,
        height: 3,
        robot: { x: 2, y: 1, dir: 'EAST', initialX: 0, initialY: 1, initialDir: 'EAST' },
        barriers: [],
        flags: singleGoalFlags,
        trace: [{ x: 2, y: 1 }],
        status: 'RUNNING',
      };

      const moveRes = executeRobotAction('MOVE_FWD', grid);
      expect(moveRes.valid).toBe(true);
      expect(moveRes.isCollision).toBe(false);
      expect(moveRes.isSuccess).toBe(true);
      expect(moveRes.flags[0].collected).toBe(true);
    });

    it('supports arbitrary ascending order numbers and tied order numbers cleanly', () => {
      const flags: FlagObjective[] = [
        { id: 'f_a', x: 1, y: 0, isGoal: false, order: 5, collected: false },
        { id: 'f_b', x: 2, y: 0, isGoal: false, order: 5, collected: false },
        { id: 'f_c', x: 3, y: 0, isGoal: false, order: 12, collected: false },
        { id: 'goal', x: 4, y: 0, isGoal: true, order: 99, collected: false },
      ];

      // Both order-5 flags are unlocked initially; order-12 and goal are locked
      expect([...getPadlockedFlagIds(flags)]).toEqual(['f_c', 'goal']);
      expect(getNextRequiredWaypointOrder(flags)).toBe(5);

      // Collecting only one of the two order-5 flags keeps order-12 locked!
      const afterOneOrder5 = flags.map((f) =>
        f.id === 'f_a' ? { ...f, collected: true } : f
      );
      expect(isFlagPadlocked(afterOneOrder5[1], afterOneOrder5)).toBe(false);
      expect(isFlagPadlocked(afterOneOrder5[2], afterOneOrder5)).toBe(true);
      expect(isFlagPadlocked(afterOneOrder5[3], afterOneOrder5)).toBe(true);

      // Once both order-5 flags are collected, order-12 unlocks while goal stays locked
      const afterBothOrder5 = afterOneOrder5.map((f) =>
        f.id === 'f_b' ? { ...f, collected: true } : f
      );
      expect(isFlagPadlocked(afterBothOrder5[2], afterBothOrder5)).toBe(false);
      expect(isFlagPadlocked(afterBothOrder5[3], afterBothOrder5)).toBe(true);
      expect(getNextRequiredWaypointOrder(afterBothOrder5)).toBe(12);

      // Once order-12 is collected, goal unlocks
      const afterOrder12 = afterBothOrder5.map((f) =>
        f.id === 'f_c' ? { ...f, collected: true } : f
      );
      expect(isFlagPadlocked(afterOrder12[3], afterOrder12)).toBe(false);
      expect(getPadlockedFlagIds(afterOrder12).size).toBe(0);
      expect(getNextRequiredWaypointOrder(afterOrder12)).toBeNull();
    });
  });

  describe('2. Sequential waypoint physics (1 -> 2 -> Goal)', () => {
    it('stepping over Flag 2 and Goal before Flag 1 is safe (not COLLISION, not SUCCESS) and leaves both uncollected', () => {
      const initialGrid = makeOrderedCorridorGrid();

      // Step 1: Move East onto (1,0) = Flag 2 while Flag 1 at (3,0) is still uncollected
      let runtime = createInitialInterpreterState();
      const ws = makeWorkspace([{ type: 'MOVE_FWD' }, { type: 'MOVE_FWD' }]);

      const tick1 = tickInterpreter(runtime, ws, initialGrid);
      expect(tick1.nextGrid.robot.x).toBe(1);
      expect(tick1.nextGrid.robot.y).toBe(0);
      expect(tick1.nextGrid.status).toBe('RUNNING');
      expect(tick1.done).toBe(false);
      expect(tick1.nextGrid.flags.find((f: FlagObjective) => f.id === 'flag_2')?.collected).toBe(false);

      // Step 2: Move East onto (2,0) = Goal while Flag 1 and Flag 2 are uncollected
      const tick2 = tickInterpreter(tick1.nextRuntime, ws, tick1.nextGrid);
      expect(tick2.nextGrid.robot.x).toBe(2);
      expect(tick2.nextGrid.robot.y).toBe(0);
      expect(tick2.nextGrid.status).toBe('RUNNING');
      expect(tick2.done).toBe(false);
      expect(tick2.nextGrid.flags.find((f: FlagObjective) => f.id === 'goal_main')?.collected).toBe(false);

      // Tick 3: End of program while standing on locked Goal -> finishes IDLE (not SUCCESS, not COLLISION)
      const tick3 = tickInterpreter(tick2.nextRuntime, ws, tick2.nextGrid);
      expect(tick3.done).toBe(true);
      expect(tick3.nextGrid.status).toBe('IDLE');
      expect(tick3.nextGrid.flags.every((f: FlagObjective) => !f.collected)).toBe(true);
    });

    it('collecting 1 -> 2 -> Goal in order unlocks each stage and reaches SUCCESS', () => {
      // Layout: (0,0) start -> (1,0) Flag 1 -> (2,0) Flag 2 -> (3,0) Goal
      const grid: GridState = {
        width: 4,
        height: 2,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        barriers: [],
        flags: [
          { id: 'f1', x: 1, y: 0, isGoal: false, order: 1, collected: false },
          { id: 'f2', x: 2, y: 0, isGoal: false, order: 2, collected: false },
          { id: 'goal', x: 3, y: 0, isGoal: true, order: 3, collected: false },
        ],
        trace: [{ x: 0, y: 0 }],
        status: 'IDLE',
      };

      expect([...getPadlockedFlagIds(grid.flags)]).toEqual(['f2', 'goal']);

      // Step 1 -> collects Flag 1, unlocks Flag 2 (Goal still locked)
      const step1 = executeRobotAction('MOVE_FWD', grid);
      expect(step1.valid).toBe(true);
      expect(step1.isCollision).toBe(false);
      expect(step1.isSuccess).toBe(false);
      expect(step1.flags.find((f) => f.id === 'f1')?.collected).toBe(true);
      expect([...getPadlockedFlagIds(step1.flags)]).toEqual(['goal']);

      // Step 2 -> collects Flag 2, unlocks Goal
      const gridAfter1: GridState = {
        ...grid,
        robot: { ...grid.robot, x: step1.newX, y: step1.newY, dir: step1.newDir },
        flags: step1.flags,
        trace: step1.trace,
        status: 'RUNNING',
      };
      const step2 = executeRobotAction('MOVE_FWD', gridAfter1);
      expect(step2.valid).toBe(true);
      expect(step2.isCollision).toBe(false);
      expect(step2.isSuccess).toBe(false);
      expect(step2.flags.find((f) => f.id === 'f2')?.collected).toBe(true);
      expect(getPadlockedFlagIds(step2.flags).size).toBe(0);

      // Step 3 -> steps onto unlocked Goal -> collects Goal and triggers SUCCESS!
      const gridAfter2: GridState = {
        ...gridAfter1,
        robot: { ...grid.robot, x: step2.newX, y: step2.newY, dir: step2.newDir },
        flags: step2.flags,
        trace: step2.trace,
        status: 'RUNNING',
      };
      const step3 = executeRobotAction('MOVE_FWD', gridAfter2);
      expect(step3.valid).toBe(true);
      expect(step3.isCollision).toBe(false);
      expect(step3.isSuccess).toBe(true);
      expect(step3.flags.every((f) => f.collected)).toBe(true);
    });

    it('visiting 2 -> 1 -> Goal leaves 2 uncollected so Goal does NOT trigger SUCCESS until 2 is revisited after 1', () => {
      // Corridor: (0,0) Robot EAST, (1,0) Flag 2, (2,0) Flag 1, (3,0) Goal
      const grid: GridState = {
        width: 4,
        height: 2,
        robot: { x: 0, y: 0, dir: 'EAST', initialX: 0, initialY: 0, initialDir: 'EAST' },
        barriers: [],
        flags: [
          { id: 'f2', x: 1, y: 0, isGoal: false, order: 2, collected: false },
          { id: 'f1', x: 2, y: 0, isGoal: false, order: 1, collected: false },
          { id: 'goal', x: 3, y: 0, isGoal: true, order: 3, collected: false },
        ],
        trace: [{ x: 0, y: 0 }],
        status: 'IDLE',
      };

      // Attempt A: Walk straight East (0,0) -> (1,0)[Flag 2 locked] -> (2,0)[Flag 1 collected] -> (3,0)[Goal locked]
      const bypassAttempt = makeWorkspace([{ type: 'MOVE_FWD', repeatCount: 3 }]);
      const resBypass = runHeadlessSimulation(bypassAttempt, 'grid', grid);
      expect(resBypass.status).toBe('IDLE');
      expect(resBypass.finalState.robot.x).toBe(3);
      expect(resBypass.finalState.flags.find((f: FlagObjective) => f.id === 'f1')?.collected).toBe(true);
      expect(resBypass.finalState.flags.find((f: FlagObjective) => f.id === 'f2')?.collected).toBe(false);
      expect(resBypass.finalState.flags.find((f: FlagObjective) => f.id === 'goal')?.collected).toBe(false);

      // Attempt B: Walk East 2 to Flag 1 (2,0), Move Back 1 to revisit unlocked Flag 2 (1,0), then Forward 2 to Goal (3,0)
      const validOrderWorkspace = makeWorkspace([
        { type: 'MOVE_FWD', repeatCount: 2 },
        { type: 'MOVE_BACK' },
        { type: 'MOVE_FWD', repeatCount: 2 },
      ]);
      const resValid = runHeadlessSimulation(validOrderWorkspace, 'grid', grid);
      expect(resValid.status).toBe('SUCCESS');
      expect(resValid.finalState.flags.every((f: FlagObjective) => f.collected)).toBe(true);
    });
  });

  describe('3. FlagPadlockOverlay SVG rendering, unlock pop & polite announcements', () => {
    it('renders padlock rings & lock badges inside GridOverlayLayer for locked flags and omits them when unlocked', () => {
      const grid = makeOrderedCorridorGrid();

      const lockedMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(GridOverlayLayer, {
            grid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
            isReadOnly: true,
            layer: 'over-robot',
            flagPadlockSlot: React.createElement(FlagPadlockOverlay, {
              grid,
              cellSize: GRID_CELL_SIZE,
              isInstant: false,
            }),
          })
        )
      );

      expect(lockedMarkup).toContain('data-testid="grid-slot-flag-padlocks"');
      expect(lockedMarkup).toContain('data-testid="flag-padlock-overlay"');
      // Flag 2 and Goal are padlocked; Flag 1 is unlocked!
      expect(lockedMarkup).toContain('data-testid="padlock-flag-2"');
      expect(lockedMarkup).toContain('data-testid="padlock-goal-2-0"');
      expect(lockedMarkup).not.toContain('data-testid="padlock-flag-1"');

      // When Flag 1 becomes collected, Flag 2 unlocks (with unlock pop animation) while Goal stays locked
      const afterFlag1Grid: GridState = {
        ...grid,
        flags: grid.flags.map((f) => (f.id === 'flag_1' ? { ...f, collected: true } : f)),
      };
      const unlockingMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(FlagPadlockOverlay, {
            grid: afterFlag1Grid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
            unlockedFlagIds: new Set(['flag_2']),
          })
        )
      );

      expect(unlockingMarkup).not.toContain('data-testid="padlock-flag-2"');
      expect(unlockingMarkup).toContain('data-testid="padlock-unlock-flag-2"');
      expect(unlockingMarkup).toContain('padlock-unlock-ring');
      expect(unlockingMarkup).toContain('padlock-unlock-pop');
      expect(unlockingMarkup).toContain('data-testid="padlock-goal-2-0"');

      // Single-goal map renders zero padlock overlays
      const singleGoalGrid: GridState = {
        ...grid,
        flags: [{ id: 'g', x: 2, y: 0, isGoal: true, order: 1, collected: false }],
      };
      const emptyMarkup = renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(FlagPadlockOverlay, {
            grid: singleGoalGrid,
            cellSize: GRID_CELL_SIZE,
            isInstant: false,
          })
        )
      );
      expect(emptyMarkup).not.toContain('data-testid="flag-padlock-overlay"');
    });

    it('emits concise polite announcements on padlock unlock and locked-tile step while ignoring resets and map switches', () => {
      const grid0 = makeOrderedCorridorGrid();

      // Step onto locked Flag 2 at (1,0)
      const stepLocked2 = executeRobotAction('MOVE_FWD', grid0);
      const grid1: GridState = {
        ...grid0,
        robot: { ...grid0.robot, x: stepLocked2.newX, y: stepLocked2.newY },
        flags: stepLocked2.flags,
        trace: stepLocked2.trace,
        status: 'RUNNING',
      };
      const transLocked2 = detectPadlockTransition(grid0, grid1);
      expect(transLocked2.steppedLockedFlag?.id).toBe('flag_2');
      expect(transLocked2.newlyUnlockedFlags).toHaveLength(0);
      expect(transLocked2.announcement).toBe('Flag 2 is padlocked. Collect flag 1 first.');

      // Step onto locked Goal at (2,0)
      const stepLockedGoal = executeRobotAction('MOVE_FWD', grid1);
      const grid2: GridState = {
        ...grid1,
        robot: { ...grid1.robot, x: stepLockedGoal.newX, y: stepLockedGoal.newY },
        flags: stepLockedGoal.flags,
        trace: stepLockedGoal.trace,
        status: 'RUNNING',
      };
      const transLockedGoal = detectPadlockTransition(grid1, grid2);
      expect(transLockedGoal.steppedLockedFlag?.id).toBe('goal_main');
      expect(transLockedGoal.announcement).toBe('Goal is padlocked. Collect flag 1 first.');

      // Step onto Flag 1 at (3,0) -> collects Flag 1 and unlocks Flag 2!
      const stepFlag1 = executeRobotAction('MOVE_FWD', grid2);
      const grid3: GridState = {
        ...grid2,
        robot: { ...grid2.robot, x: stepFlag1.newX, y: stepFlag1.newY },
        flags: stepFlag1.flags,
        trace: stepFlag1.trace,
        status: 'RUNNING',
      };
      const transUnlock2 = detectPadlockTransition(grid2, grid3);
      expect(transUnlock2.newlyUnlockedFlags.map((f) => f.id)).toEqual(['flag_2']);
      expect(transUnlock2.steppedLockedFlag).toBeNull();
      expect(transUnlock2.announcement).toBe('Flag 2 unlocked.');

      // Reset back to initial state does NOT emit spurious announcements
      expect(detectPadlockTransition(grid3, grid0).announcement).toBeNull();

      // Switching to a completely different map does NOT emit spurious announcements
      const differentMap: GridState = {
        ...grid0,
        width: 6,
        flags: [{ id: 'goal_other', x: 5, y: 0, isGoal: true, order: 1, collected: false }],
      };
      expect(detectPadlockTransition(grid0, differentMap).announcement).toBeNull();
    });
  });

  describe('4. Map Thumbnail Generator padlock indicators', () => {
    it('renders padlock rings & lock badges on locked ordered flags in SVG thumbnails and clears them when unlocked', () => {
      const grid = makeOrderedCorridorGrid();
      const svgInitial = renderGridMapSvg(grid);

      expect(svgInitial).toContain('data-padlock-target="flag-2"');
      expect(svgInitial).toContain('data-padlock-target="goal-2-0"');
      expect(svgInitial).not.toContain('data-padlock-target="flag-1"');

      // Data URI encodes the padlock indicators cleanly
      const thumbUri = generateGridMapThumbnail(grid);
      const decoded = decodeURIComponent(thumbUri.replace('data:image/svg+xml;charset=utf-8,', ''));
      expect(decoded).toContain('data-padlocked="true"');

      // After collecting Flag 1, Flag 2's thumbnail padlock disappears while Goal stays padlocked
      const gridAfter1: GridState = {
        ...grid,
        flags: grid.flags.map((f) => (f.id === 'flag_1' ? { ...f, collected: true } : f)),
      };
      const svgAfter1 = renderGridMapSvg(gridAfter1);
      expect(svgAfter1).not.toContain('data-padlock-target="flag-2"');
      expect(svgAfter1).toContain('data-padlock-target="goal-2-0"');

      // Single-goal map thumbnail has no padlock overlays
      const singleGoalSvg = renderGridMapSvg({
        ...grid,
        flags: [{ id: 'goal_1', x: 4, y: 0, isGoal: true, order: 1, collected: false }],
      });
      expect(singleGoalSvg).not.toContain('data-padlocked="true"');
    });
  });

  describe('5. Backward compatibility across all classic LESSONS', () => {
    it('solves every classic lesson cleanly under strict sequential waypoint gating', () => {
      for (const lesson of LESSONS) {
        const initialGrid: GridState = {
          width: lesson.grid.width,
          height: lesson.grid.height,
          robot: {
            ...lesson.grid.robot,
            initialX: lesson.grid.robot.x,
            initialY: lesson.grid.robot.y,
            initialDir: lesson.grid.robot.dir,
          },
          barriers: [...lesson.grid.barriers],
          flags: lesson.grid.flags.map((f) => ({ ...f, collected: false })),
          trace: [{ x: lesson.grid.robot.x, y: lesson.grid.robot.y }],
          status: 'IDLE',
          showTrace: true,
        };

        const result = runHeadlessSimulation(lesson.solution, 'grid', initialGrid, 250);
        expect(result.status, `Classic Lesson ${lesson.id} (${lesson.title}) failed`).toBe('SUCCESS');
        expect(result.finalState.flags.every((f: FlagObjective) => f.collected)).toBe(true);
      }
    });
  });
});
