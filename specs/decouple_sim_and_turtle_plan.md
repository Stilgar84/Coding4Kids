# Architecture & Implementation Plan: Decoupling Simulation & Adding Turtle/LOGO Environment

## Goal Description
The objective is to cleanly decouple the block-coding and lockstep interpreter engine from any specific simulation environment, enabling support for multiple simulation worlds. In addition to preserving the existing 2D Grid robot simulation, we will implement a new **Turtle / LOGO** simulation environment featuring:
- A robot controllable in floating-point coordinates $(x, y, \theta)$ on an unbounded plane (not size limited).
- Robot starting at $(0, 0)$.
- Pen controls (Pen Up / Pen Down) to toggle drawing.
- Pen Color controls (Black, Red, Blue, Green) via parameterized `SET_PEN_COLOR` action blocks.
- Movement actions: Forward, Backward, and parameterized Turns (`TURN_LEFT` and `TURN_RIGHT` with 30° and 45° variants), plus smooth **Circular Arcs** (Arc Left, Arc Right).
- Dynamic bounding-box auto-sizing and interactive pan/zoom viewport rendering for the unbounded plane (no map editing tools; pan/zoom instead).
- Map editing tools encapsulated as simulation-specific features (Grid has wall/flag/goal editing; Turtle has pan/zoom).

```
+----------------------------------------------------------------------------------+
|                              BLOCK-CODING LAYER                                   |
|   Workspace State (MAIN, F1, F2, F3)  |  Number Multipliers  |  Touch Drag-and-Drop |
+----------------------------------------------------------------------------------+
                                         │
                                         ▼
+----------------------------------------------------------------------------------+
|                           LOCKSTEP INTERPRETER CORE                              |
|   Call Stack (F1..F3)  |  Loop Stack (Loop Start/End)  |  Active Block Highlighting  |
+----------------------------------------------------------------------------------+
                                         │
                 delegates domain actions│ to active sim environment
                                         ▼
+----------------------------------------------------------------------------------+
|                     SIMULATION ENVIRONMENT ABSTRACTION LAYER                     |
|            SimulationEnvironment<TState, TActionConfig, TSensors>                |
+----------------------------------------------------------------------------------+
              │                                                     │
              ▼                                                     ▼
+-----------------------------+                       +-----------------------------+
|    GRID SIM ENVIRONMENT     |                       |    TURTLE SIM ENVIRONMENT   |
| - Discrete (x, y) cells     |                       | - Floating-point (x, y, θ)  |
| - 4 cardinal directions     |                       | - Unbounded canvas plane    |
| - Walls, flags & goals      |                       | - Lines & Circular Arcs     |
| - GridCanvas SVG Renderer   |                       | - Pen Up / Down + 4 Colors  |
| - Grid map editing tools    |                       | - 30° & 45° turn variants   |
|   (Wall, Robot, Flag, Goal) |                       | - Interactive Pan/Zoom view |
+-----------------------------+                       +-----------------------------+
```

---

## User Review & Specific Requirements

> [!IMPORTANT]
> **Map Editing Tools Belong to Simulation**:
> - Grid simulation defines map edit tools: `WALL`, `ROBOT`, `FLAG`, `GOAL`, `ERASE`, and board boundary resize.
> - Turtle simulation has **no map edit tools**; instead it defines interactive **Pan & Zoom** controls (+, -, Reset View, Fit to Content, and drag-to-pan).

> [!IMPORTANT]
> **Parameterized Turn Blocks (30° and 45°)**:
> - Turn actions use single underlying action types: `TURN_LEFT` and `TURN_RIGHT`.
> - The palette provides two preset block variants for each direction: **30°** (`params: { angle: 30 }`) and **45°** (`params: { angle: 45 }`).
> - Number multipliers badge (2..9) cleanly multiply the base angle (e.g. $30^\circ \times 3 = 90^\circ$, or $45^\circ \times 2 = 90^\circ$).

> [!IMPORTANT]
> **Pen Color Blocks (Black, Red, Blue, Green)**:
> - Single underlying action: `SET_PEN_COLOR`.
> - Palette provides 4 color variant blocks:
>   - **Black**: `#0f172a`
>   - **Red**: `#ef4444`
>   - **Blue**: `#3b82f6`
>   - **Green**: `#22c55e`
> - When executed, the current pen stroke color updates and all subsequent lines/arcs use the selected color.

---

## Architecture Design

### 1. The `SimulationEnvironment` Interface

Each simulation environment provides:
1. **Palette Blocks (`paletteItems`)**: Action definitions, parameterized variants (e.g. 30° vs 45° turn, color variants), icons, and styling.
2. **Simulation Engine**: Initial state factory, action execution step (`executeAction`), state reset, and optional sensor evaluation hook (`getSensorInfo`).
3. **Display & Map Viewport Controls**: Component renderer, bounding box / viewport computation, and simulation-specific toolbar controls (e.g. Grid map edit buttons vs Turtle pan/zoom controls).

```typescript
export interface SimPaletteItem {
  id: string; // unique item id in palette, e.g. 'turn-left-30', 'pen-color-red'
  actionType: string; // underlying action type, e.g. 'TURN_LEFT', 'SET_PEN_COLOR'
  name: string;
  category: 'motion' | 'pen' | 'action';
  params?: Record<string, any>; // e.g. { angle: 30 }, { color: '#ef4444' }
  icon: (props: { className?: string }) => React.ReactNode;
  bgClass: string;
  borderClass: string;
  supportsRepeat?: boolean;
}

export interface SimActionResult<TState> {
  nextState: TState;
  status: SimulationStatus; // 'IDLE' | 'RUNNING' | 'SUCCESS' | 'COLLISION'
  isCollision?: boolean;
  isSuccess?: boolean;
}

export interface SimulationEnvironment<TState = any> {
  id: string;
  name: string;
  icon: React.ReactNode;
  
  // 1. Palette items (actions and parameterized variants)
  paletteItems: SimPaletteItem[];
  
  // 2. Simulation State & Execution
  createInitialState: () => TState;
  resetState: (state: TState) => TState;
  executeAction: (
    actionType: string,
    state: TState,
    options?: { repeatCount?: number; params?: Record<string, any> }
  ) => SimActionResult<TState>;
  
  // Hook for sensor queries (future-proof)
  getSensorInfo?: (state: TState, sensorId: string) => any;
  
  // Victory / Completion evaluation when call stack finishes
  evaluateCompletion?: (state: TState) => SimulationStatus;

  // 3. Display & Environment-Specific Tools
  Renderer: React.FC<{ state: TState; runtimeStatus?: SimulationStatus }>;
  
  // Map Tools: Grid defines wall/robot/flag tools; Turtle defines Pan/Zoom controls!
  ToolsComponent?: React.FC<{ state: TState }>;
}
```

---

## Proposed Changes

### Component 1: Core Simulation Abstraction Layer
Create unified simulation types and environment registry.

#### [NEW] `src/engine/simulation/types.ts`
- Define `SimPaletteItem`, `SimActionResult`, `SimulationEnvironment`, and sensor query interface.

#### [NEW] `src/engine/simulation/registry.ts`
- Maintain registered environments (`grid`, `turtle`).
- Provide helper methods `getSimEnvironment(id)` and `getAllSimEnvironments()`.

---

### Component 2: Interpreter Decoupling
Refactor `interpreter.ts` to be completely agnostic of simulation details.

#### [MODIFY] `src/engine/interpreter.ts`
- Remove direct imports of `GridState` and `executeRobotAction`.
- Make `tickInterpreter` accept generic `TState` and `SimulationEnvironment<TState>`:
```typescript
export function tickInterpreter<TState>(
  runtime: InterpreterRuntimeState,
  workspace: WorkspaceState,
  simState: TState,
  simEnv: SimulationEnvironment<TState>
): TickResult<TState>
```
- Core loop handles:
  1. `CALL_F1` / `F2` / `F3` (stack frame management).
  2. `LOOP_START` / `LOOP_END` (loop frame tracking & unrolling).
  3. Action blocks: handles sub-tick multipliers and passes `currentBlock.params` and `repeatCount` to `simEnv.executeAction(currentBlock.type, simState, { repeatCount, params: currentBlock.params })`.
  4. Program termination: queries `simEnv.evaluateCompletion?.(simState)` to decide final status.
- Add backward-compatible default for existing tests.

---

### Component 3: Grid Simulation Environment
Encapsulate the existing grid physics, state, barriers, and renderer into the environment structure.

#### [NEW] `src/simulations/grid/gridEnvironment.ts`
- Export `gridSimulationEnvironment: SimulationEnvironment<GridState>`.
- Actions: `MOVE_FWD`, `MOVE_BACK`, `TURN_LEFT`, `TURN_RIGHT`.
- Wrapper around existing `executeRobotAction`.
- Completion condition: on goal & collected all numbered flags.
- **ToolsComponent**: encapsulates the Grid map editing buttons (`WALL`, `ROBOT`, `FLAG`, `GOAL`, `ERASE`, clear custom walls).

#### [MODIFY] `src/components/GridCanvas.tsx`
- Preserves existing SVG grid rendering and interactive barrier drawing.

---

### Component 4: Turtle / LOGO Simulation Environment
A complete vector graphics simulation on an unbounded plane.

#### [NEW] `src/simulations/turtle/types.ts`
```typescript
export interface TurtlePose {
  x: number;      // floating-point X
  y: number;      // floating-point Y
  heading: number; // degrees (0 = North, 90 = East, 180 = South, 270 = West)
}

export interface TurtleLine {
  type: 'LINE';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  width: number;
}

export interface TurtleArc {
  type: 'ARC';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius: number;
  startHeading: number;
  sweepAngle: number; // positive = right/clockwise, negative = left/counter-clockwise
  color: string;
  width: number;
}

export type TurtlePathItem = TurtleLine | TurtleArc;

export interface TurtleState {
  robot: TurtlePose;
  penDown: boolean;
  penColor: string; // '#0f172a' | '#ef4444' | '#3b82f6' | '#22c55e'
  penWidth: number;
  paths: TurtlePathItem[];
  status: SimulationStatus;
  // Viewport & Pan/Zoom state
  pan: { x: number; y: number };
  zoom: number;
  fitToView: boolean;
  computedBounds: { minX: number; minY: number; maxX: number; maxY: number };
}
```

#### [NEW] `src/simulations/turtle/physics.ts`
Kinematic functions for floating-point lines and arcs:
- `moveTurtleForward(state, distance)`:
  $\Delta x = d \cdot \sin(\theta \cdot \pi / 180)$, $\Delta y = d \cdot \cos(\theta \cdot \pi / 180)$.
  If `penDown`, append `TurtleLine` with current `penColor`.
- `moveTurtleBackward(state, distance)`:
  Moves backward along heading vector.
- `turnTurtle(state, deltaDegrees)`:
  $\theta' = (\theta + \Delta\theta) \pmod{360}$.
- `arcTurtle(state, radius, angle, direction: 'LEFT' | 'RIGHT')`:
  Computes arc geometry:
  - Center of rotation $C$ at distance $R$ orthogonal to heading.
  - End position $(x', y')$ and end heading $\theta' = \theta \pm \text{angle}$.
  - If `penDown`, append `TurtleArc` with current `penColor`.
- `updateBoundingBox(paths, robot)`:
  Calculates dynamic `[minX, minY, maxX, maxY]` including all paths and current robot position.

#### [NEW] `src/simulations/turtle/turtleEnvironment.ts`
Defines `turtleSimulationEnvironment: SimulationEnvironment<TurtleState>`:
- **Palette Items**:
  1. `FORWARD` (Move Forward $50$, repeatable)
  2. `BACKWARD` (Move Backward $50$, repeatable)
  3. `TURN_LEFT_30` (Action: `TURN_LEFT`, `params: { angle: 30 }`, repeatable)
  4. `TURN_LEFT_45` (Action: `TURN_LEFT`, `params: { angle: 45 }`, repeatable)
  5. `TURN_RIGHT_30` (Action: `TURN_RIGHT`, `params: { angle: 30 }`, repeatable)
  6. `TURN_RIGHT_45` (Action: `TURN_RIGHT`, `params: { angle: 45 }`, repeatable)
  7. `ARC_LEFT` (Arc Left, $R=50$, $\Delta\theta=90^\circ$, repeatable)
  8. `ARC_RIGHT` (Arc Right, $R=50$, $\Delta\theta=90^\circ$, repeatable)
  9. `PEN_UP` (Raise pen)
  10. `PEN_DOWN` (Lower pen)
  11. `PEN_COLOR_BLACK` (Action: `SET_PEN_COLOR`, `params: { color: '#0f172a' }`)
  12. `PEN_COLOR_RED` (Action: `SET_PEN_COLOR`, `params: { color: '#ef4444' }`)
  13. `PEN_COLOR_BLUE` (Action: `SET_PEN_COLOR`, `params: { color: '#3b82f6' }`)
  14. `PEN_COLOR_GREEN` (Action: `SET_PEN_COLOR`, `params: { color: '#22c55e' }`)

#### [NEW] `src/simulations/turtle/components/TurtleCanvas.tsx`
- SVG rendering engine on unbounded plane.
- Computes dynamic `viewBox` from `computedBounds` and applies `zoom` / `pan`.
- Renders:
  - Coordinate axes crosshair at $(0, 0)$ & subtle background coordinate grid.
  - SVG `<line>` elements for linear strokes.
  - SVG `<path d="M ... A ...">` elements for smooth circular arcs with assigned colors.
  - Robot avatar: SVG turtle/robot rotated to current heading with a pen tip showing active color and down/up state.
  - Interactive background drag for panning.

#### [NEW] `src/simulations/turtle/components/TurtleToolbarTools.tsx`
The simulation-specific tool controls for Turtle:
- Zoom In (`+`), Zoom Out (`-`)
- Reset View (center to $(0, 0)$ at 1.0x)
- Fit to Content toggle
- Clear Canvas button (resets drawing paths and returns robot to $(0, 0)$)
- Active Pen Status indicator (shows current color swatch and Up/Down status)

---

### Component 5: Application Store & UI Integration

#### [MODIFY] `src/types/index.ts`
- Extend `CodeBlock` to support `params?: Record<string, any>`:
```typescript
export interface CodeBlock {
  id: string;
  type: string;
  repeatCount?: number;
  params?: Record<string, any>;
}
```

#### [MODIFY] `src/store/useAppStore.ts`
- Add `activeSimId: 'grid' | 'turtle'`.
- Add `turtleState: TurtleState`.
- Add action `setSimEnvironment(simId: 'grid' | 'turtle')`.
- Generic execution step: delegating `step()` and `play()` to the active simulation environment through `tickInterpreter`.
- Maintain all existing level presets and actions for Grid mode so no existing functionality breaks.

#### [MODIFY] `src/components/BlockPalette.tsx`
- Read action buttons dynamically from `currentSimEnv.paletteItems`.
- When adding a block, copy both `actionType` and `params` onto the new `CodeBlock`.
- Render sim actions alongside core control blocks (`LOOP_START`, `LOOP_END`, `CALL_F1`..`F3`).
- Number multipliers apply to any block configured with `supportsRepeat: true`.

#### [MODIFY] `src/components/BlockItem.tsx`
- Render icons and colors from environment action definition (with parameter-specific badges/subscripts, e.g. "30°", "45°", and color dot for pen color).
- Display active step highlight and repetition progress badge.

#### [MODIFY] `src/components/Toolbar.tsx`
- Add an Environment Switcher pill/tabs (`Grid 🤖` | `Turtle 🐢`).
- When `grid` is active: render Grid level picker and Grid map editing tools (`WALL`, `ROBOT`, `FLAG`, `GOAL`, `ERASE`).
- When `turtle` is active: render Turtle Pan/Zoom controls and Clear Canvas tool.

#### [MODIFY] `src/App.tsx`
- Split-pane layout: Left is Visual Block Programmer, Right displays the active environment renderer:
  `<ActiveSimRenderer />` renders `GridCanvas` when in grid mode, `TurtleCanvas` when in turtle mode.

---

## Verification Plan

### Automated Tests
1. **Unit Tests (Vitest)**:
   - `tests/interpreter.test.ts`:
     - Decoupled interpreter executes generic simulation environments.
     - Parameterized action blocks execute correctly with `params` (e.g. angle and color).
     - Backward compatibility with existing Grid simulation tests (all 10 existing tests pass).
   - `tests/turtlePhysics.test.ts` (NEW):
     - Test forward and backward floating-point kinematics.
     - Test 30° and 45° turn angle normalizations with repeats (e.g. $30^\circ \times 3 = 90^\circ$).
     - Test circular arc math (start position, end position, end heading).
     - Test pen up (no path added) vs pen down (path recorded with current color).
     - Test pen color changes (black, red, blue, green).
     - Test dynamic bounding box expansion across negative and positive quadrants.
   - Run: `npm run test:unit`

2. **TypeScript Compilation & Build Verification**:
   - `npm run build`

### Manual Verification
1. **Grid Environment (Regression check)**:
   - Verify Grid level selection, map editing tools (Wall, Flag, Goal, Erase), step, play, victory.
2. **Turtle Environment**:
   - Switch to Turtle sim.
   - Verify empty canvas at $(0, 0)$ with robot facing North and pen down in black.
   - Test 30° and 45° turn blocks with repeat badges.
   - Test changing pen colors (Red, Blue, Green, Black) and drawing lines/arcs.
   - Test Pan & Zoom controls (+, -, Reset View, Fit to Content, background drag).
   - Test Clear Canvas.
