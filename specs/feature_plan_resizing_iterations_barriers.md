# Implementation Plan: Board Resizing, Auto-Reset on Play, Runtime Iteration Label, and Barrier Dragging

## 1. Auto-Reset on Play after Program End or Failure
- **Goal**: When the program finishes (success or completion) or fails (collision), clicking the play button resets the grid and interpreter state first before running again.
- **Location**: `src/store/useAppStore.ts`
- **Implementation**:
  - In `play()`, check if `grid.status === 'SUCCESS' || grid.status === 'COLLISION' || (runtime !== null && runtime.callStack.length === 0)`.
  - If true, call `get().reset()` before initiating steps.

## 2. Resizing the Playing Board (Drag Boundary in Each Direction)
- **Goal**: Allow dragging boundary handles in each direction (TOP, BOTTOM, LEFT, RIGHT) to extend or shrink the playing grid.
- **Location**: `src/types/index.ts`, `src/store/useAppStore.ts`, `src/components/GridCanvas.tsx`
- **Implementation**:
  - Add `resizeBoard(direction: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT', delta: number)` to Zustand store.
  - Direction adjustments:
    - `RIGHT`: modifies `grid.width`.
    - `BOTTOM`: modifies `grid.height`.
    - `LEFT`: modifies `grid.width`, shifts all x-coordinates (`robot.x`, `robot.initialX`, `flags[i].x`, `barriers[i].x`, `trace[i].x`) by `delta`.
    - `TOP`: modifies `grid.height`, shifts all y-coordinates (`robot.y`, `robot.initialY`, `flags[i].y`, `barriers[i].y`, `trace[i].y`) by `delta`.
  - Add boundary drag bars (Top, Bottom, Left, Right) to `GridCanvas.tsx` with pointer capture and drag handling.

## 3. Runtime Iteration Label `<current>/<total>` (Different Color for Current)
- **Goal**: When in a loop (or executing a basic block multiple times due to a multiplier badge label), show `<current>/<total>` in the label badge at runtime, using a distinct color for `<current>`.
- **Location**: `src/types/index.ts`, `src/engine/interpreter.ts`, `src/components/BlockItem.tsx`, `src/components/WorkspaceCanvas.tsx`
- **Implementation**:
  - Extend `InterpreterRuntimeState` with `activeRepeatProgress?: { blockId: string; current: number; total: number } | null`.
  - In `tickInterpreter`:
    - For basic blocks with `repeatCount > 1`, set `activeRepeatProgress` with `{ blockId, current, total }`.
    - For loops, track `currentIteration` and `totalIterations` in `loopStack`.
  - In `BlockItem.tsx`:
    - Determine if this block is currently running an active repeat or is the `LOOP_START` for an active loop.
    - If so, render `<current>/<total>` with distinct styling (e.g. amber `<current>`, slate `/`, white `<total>`).

## 4. Drag Mouse to Draw Multiple Barriers in Barrier Mode
- **Goal**: When in barrier mode (`editorTool === 'WALL'`), allow dragging the mouse to draw multiple barriers continuously.
- **Location**: `src/store/useAppStore.ts`, `src/components/GridCanvas.tsx`
- **Implementation**:
  - Add `addWall(edge: WallEdge)` to `useAppStore.ts` to ensure idempotency.
  - In `GridCanvas.tsx`:
    - Track pointer/mouse down in barrier mode.
    - Dragging over horizontal or vertical edge hitboxes calls `addWall(edge)`.
    - Moving between adjacent cells also computes and creates the wall barrier between them.
    - Single click without dragging still toggles the wall edge.

## 5. Tests
- Unit tests in `tests/interpreter.test.ts`.
- E2E tests in `e2e/app.spec.ts`.
