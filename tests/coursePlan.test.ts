import { describe, it, expect } from 'vitest';
import { LESSONS, countInstructions } from '../src/data/lessons';
import { createInitialInterpreterState, tickInterpreter } from '../src/engine/interpreter';
import { GridState } from '../src/types';

describe('Course Plan & Lesson Validation Suite', () => {
  it('has at least 15 lessons across multiple concept modules', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(15);
    const modules = new Set(LESSONS.map((l) => l.moduleId));
    expect(modules.size).toBeGreaterThanOrEqual(4);
  });

  LESSONS.forEach((lesson) => {
    describe(`Lesson ${lesson.id}: ${lesson.title} (${lesson.concept})`, () => {
      it('has instruction count < 15 as written', () => {
        const totalInstructions = countInstructions(lesson.solution);
        expect(totalInstructions).toBeLessThan(15);
        expect(lesson.instructionCount).toBe(totalInstructions);
      });

      it('successfully solves the map with the provided solution', () => {
        // Setup initial grid state
        let grid: GridState = {
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

        let runtime = createInitialInterpreterState();
        let ticks = 0;
        const maxTicks = 200;
        let isDone = false;

        while (!isDone && ticks < maxTicks) {
          const res = tickInterpreter(runtime, lesson.solution, grid);
          runtime = res.nextRuntime;
          grid = res.nextGrid;
          isDone = res.done;
          ticks++;

          if (grid.status === 'COLLISION') {
            break;
          }
        }

        // Must succeed without collision
        expect(grid.status, `Lesson ${lesson.id} failed with status ${grid.status} after ${ticks} ticks`).toBe('SUCCESS');

        // All intermediate flags must be collected
        const nonGoalFlags = grid.flags.filter((f) => !f.isGoal);
        const allCollected = nonGoalFlags.every((f) => f.collected);
        expect(allCollected, `Lesson ${lesson.id} did not collect all intermediate flags`).toBe(true);

        // Robot must end on goal cell
        const goalFlag = grid.flags.find((f) => f.isGoal);
        expect(goalFlag).toBeDefined();
        expect(grid.robot.x).toBe(goalFlag!.x);
        expect(grid.robot.y).toBe(goalFlag!.y);
      });
    });
  });
});
