# Shared Language, Lesson Mechanics & Platform Requirements (High-Level)

This document captures the high-level functional requirements needed across **all simulation environments** to run [the programming curriculum](./curriculum/overview.md): shared language/block extensions, typed variables, random & interactive input sensors, the shared sparse Memory Tape (including per-worker heads for concurrency), animation & event dispatch models, pedagogical mechanics, multi-profile progression, versioned lesson saves, and celebratory rewards. For concrete layout budgets, HUD slots, iconography, and UX rules, see [Kid-Friendly UI Principles & Guidelines (`ui_guidelines.md`)](./ui_guidelines.md); for environment-specific ops and sensors, see [`envs/`](./envs/); for binary encoding, see [`binary_format.md`](./binary_format.md); for non-curriculum future concepts, see [`sandbox_ideas.md`](./sandbox_ideas.md).

---

## 1. Shared Language & Workspace UI Extensions

These language and workspace capabilities apply universally across **[🤖 Robot Grid](./envs/robot_grid.md)**, **[🐢 Turtle LOGO](./envs/turtle_logo.md)**, **[🎵 Beat & Light Matrix](./envs/beat_light.md)**, **[🏗️ Depot](./envs/depot.md)**, and **[🚂 Switchyard](./envs/switchyard.md)**, unlocking progressively across the curriculum (or immediately in Free-Play via **Unlock All / Pro Sandbox**):

- **Explicit Conditional & Loop Blocks (`branch` & `while`+):**
  - `IF [condition] ... END_IF` — Executes inner blocks once if true; otherwise jumps past `END_IF`.
  - `IF [condition] ... ELSE ... END_IF` (and `ELSE IF`) — Runs the matching branch and skips remaining branches (visually spotlighted during step-by-step playback, editable via staged `<ConditionSubpalette>`).
  - `WHILE [condition] ... END_WHILE` — Repeats enclosed blocks while `[condition]` remains true (guarded against infinite loops by the interpreter step cap -> `STEP_LIMIT` `⏳🔁`).
  - **Atomic Pair Insertion & Nesting Guardrails:** Inserting `LOOP_START`, `IF`, or `WHILE` from the palette inserts both opener and matching closer atomically whenever `remainingForScope >= 2` (or rejects cleanly via slot-tray shake when `< 2` slots remain). Function calls inside loops remain unrestricted once functions are unlocked, while direct/indirect self-recursion is gated per activity (`palette.allowRecursion`, enabled in `rec`+ / Sandbox).
  - **Boolean Combinators:** Visual `NOT`, `AND`, and `OR` (short-circuit evaluation) wrappers for sensor and comparison badges (`0x30 CMP`, strict 3-address `OP_VAR_OP`).
- **Scene Input Selector (`🎛️ $input` — `branch`+) & Random Sensors (`🎲` — `var`+ / Sandboxes):**
  - **`🎛️ $input` Dock Widget:** Compact integer (`1..8`) or color-swatch selector pill in creative/interactive lessons that exposes `$input` and **triggers an immediate auto-rerun/redraw on change**—enabling conditional art and jukeboxes before variables or memory exist.
  - **`🎲 $rand` & `🎨🎲 $randomColor`:** Fresh random roll on every evaluation! Visual preset badges include **🪙 Coin (`0..1`)**, **🔺 D4 (`1..4`)**, **🎲 D6 (`1..6`)**, **🔷 D8 (`1..8` — matches Beat notes/grid)**, **🔮 D20 (`1..20`)**, and **🌊 `[0, 1)` continuous float** (composable with float-preserving `*` to generate arbitrary ranges without custom range dialogs), alongside **`$randomColor`** (vibrant palette swatches excluding canvas-erasing `white`/`black`). Seeded or disabled in deterministic puzzles.
- **Visual Memory Watch Tray & Typed Color Values (`var`+, Typed in `tape`+):**
  - Displays live, color-coded boxes only for variables present in the active workspace, updating on every tick and animating values when read from world sensors.
  - Starting in **`tape`** (after numeric comparisons `<`, `>`, `==`, `/`, `%` in **`cmp`**), variables hold either a **number** or a **color swatch** (`TypedValue`; see §1.1).
- **Shared Sparse Memory Tape Subsystem (`tape`+):**
  - Optional 1-indexed memory strip (`cells` + movable read/write head(s), supporting up to `10,000` sparse cells in Sandboxes and Mastery Challenges with a windowed 7–9 cell viewport dock; see §1.2).
- **Wall-Clock Tick Speedometer (`⏱️` — `sort` & `conc`+):**
  - Live non-verbal badge tracking elapsed **wall-clock beats/ticks (`⏱️`)** (where simultaneous lockstep ticks across `K` workers advance wall-clock ticks by `1`), letting learners viscerally observe algorithmic and parallel speedups (`48 ⏱️` → `16 ⏱️`).
- **Shape-Socket Function Parameters & Local Stack Scope (`args` & `rec`+):**
  - Functions `F1`, `F2`, `F3` support up to **3 visual shape sockets (`●`, `▲`, `■`)** instead of text parameter names, with matching plug slots on `Call F1([●], [▲], [■])` and `Fork F1([●], [▲], [■])`.
  - Socket values live privately on each `StackFrame` (isolated from shared globals `a`–`z` and Tape) so recursive calls and concurrent forks never overwrite each other's parameters. *(Future side module `fp` extends sockets to accept helper function badges `[Fn]`.)*
- **Physical Block-Budget Slot Trays & Pre-Scaffolded Starters:**
  - When a puzzle enforces a block cap to prevent brute force, the workspace renders visible slot trays (`[■][■][■][□][□]`) that fill and gently shake when full. Boilerplate setup is pre-populated in Starter Workspaces so learner authoring stays within compact **Edit-Delta** budgets (`≤ 6–8` blocks added/changed).

### 1.1 Typed Variable System (`number` vs `color`)

Single-letter variables (`a`–`z`), message channels, and non-empty tape cells hold either a `number` or a `PaletteColor` from a unified 10-swatch palette. **Crucially, indices `0..7` preserve the exact existing `TURTLE_COLOR_PALETTE` byte order in `src/engine/serialization/types.ts`**, appending only `orange = 8` and `white = 9` at the end (`'yellow'` and `'amber'` alias cleanly at index `4`) so zero existing saved programs break. *(Beat's direct `SET_LED_COLOR` `0x18` retains its `0=Cyan..8=Black, 9=White` hardware index order on the wire via `beatColorToByte` while translating canonical `PaletteColor` swatches identically at runtime; see [`envs/beat_light.md`](./envs/beat_light.md#1-visual--audio-simulation-model)).*

```typescript
// Canonical PaletteColor index order (0..7 match TURTLE_COLOR_PALETTE byte-for-byte!)
export const PALETTE_COLORS = [
  'black',   // 0: #0f172a — dark ink in LOGO; turns OFF ("erases") LEDs on Beat's dark #020617 pad
  'red',     // 1: #ef4444 — maps to Beat Rose #f43f5e
  'blue',    // 2: #3b82f6
  'green',   // 3: #10b981 — maps to Beat Emerald #10b981
  'yellow',  // 4: #f59e0b — Amber (maps to Beat Amber #fbbf24)
  'purple',  // 5: #8b5cf6 — maps to Beat Purple #a855f7
  'pink',    // 6: #ec4899
  'cyan',    // 7: #06b6d4
  'orange',  // 8: #f97316 — NEW appended index 8
  'white',   // 9: #ffffff — NEW appended index 9; bright white LED in Beat, selectively "erases" strokes on LOGO's #ffffff canvas
] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];

export type TypedValue =
  | { type: 'number'; value: number }
  | { type: 'color'; value: PaletteColor };

export interface InterpreterRuntimeState {
  // ...existing fields...
  variables: Record<VariableName, TypedValue>;
}
```

#### Type & Arithmetic Rules

| Expression / Block | Required Operand Types | Behavior / On Type Mismatch or Empty Cell |
| :--- | :--- | :--- |
| `a + b`, `a - b`, `a * b`, `a / b`, `a % b` | Both **number** | Preserves floating-point results on `*` and `/` (so `$rand01 * 360` works smoothly; `TAPE_SEEK` truncates via `Math.trunc`); ⚠️ `TYPE_ERROR` if non-number |
| `a == b`, `a != b` | Both **same type** (`number == number` or `color == color`) | ⚠️ `TYPE_ERROR` on cross-type comparison |
| `a < b`, `a > b`, `a <= b`, `a >= b` | Both **number** | ⚠️ `TYPE_ERROR` |
| `a && b`, `a \|\| b` | Both **number** (truthy `!= 0`) | ⚠️ `TYPE_ERROR` |
| `FORWARD [a]`, `TURN [a]`, `Loop [a]`, `TAPE_SEEK [a]`, `LIGHT_ROW [a]` | **number** | ⚠️ `TYPE_ERROR` |
| `SET_PEN_COLOR [a]`, `SET_LED_COLOR [a]` | **color** | ⚠️ `TYPE_ERROR` |
| `a = $cellValue` | Cell at worker's `headPos` holds **number** | ⚠️ `TYPE_ERROR` if cell holds color or is empty |
| `a = $cellColor` | Cell at worker's `headPos` holds **color** | ⚠️ `TYPE_ERROR` if cell holds number or is empty |
| `a = 5` / `a = Red` | Stores **number** / **color** | Always OK |
| `a = b` / `TAPE_WRITE [a]` / `SEND [ch, a]` | Copies `TypedValue` of `b` / `a` (unset variable defaults to `{ type: 'number', value: 0 }`) | Always OK |

#### Interpreter Type Checking

```typescript
export function resolveOperand(
  op: OperandValue | PaletteColor | string,
  vars: Record<string, TypedValue>,
  simEnv?: SimulationEnvironment<any>,
  simState?: any,
  tape?: TapeState,
  workerId = 'main'
): TypedValue | 'TYPE_ERROR' {
  if (typeof op === 'number') {
    return { type: 'number', value: Number.isFinite(op) ? op : 0 };
  }
  if (isPaletteColor(op)) {
    return { type: 'color', value: op };
  }
  const head = tape?.workerHeads?.[workerId] ?? tape?.headPos ?? 1;
  if (op === '$cellValue') {
    const cell = tape?.cells[head];
    return cell?.type === 'number' ? cell : 'TYPE_ERROR';
  }
  if (op === '$cellColor') {
    const cell = tape?.cells[head];
    return cell?.type === 'color' ? cell : 'TYPE_ERROR';
  }
  if (typeof op === 'string' && isSensorToken(op)) {
    return readTypedSensor(op, simEnv, simState, tape, workerId);
  }
  if (typeof op === 'string' && /^[a-z]$/.test(op)) {
    return vars[op] ?? { type: 'number', value: 0 };
  }
  return { type: 'number', value: 0 };
}
```

#### Zero-Reading Type Error, Math/Runtime Terminators & Watch Tray Visualization

Every failure mode surfaces a distinct, zero-reading Top-Center status pill (`SimulationStatus`) synchronized across single-run and multi-run pips (`MultiRunPipsBar`):
- **`TYPE_ERROR` (`🎨≠#`):** Execution halts on the offending block, the block shakes with an amber/red outline, and in the Watch Tray (`toolbar-variables`) a round color swatch visibly bounces off a square `#` number slot (or vice versa) while pulsing the offending variable.
- **`MATH_ERROR` (`🧮÷0`):** Dividing or modulo-reducing by zero (`/ 0`, `% 0`) halts cleanly instead of returning `0`.
- **`STACK_OVERFLOW` (`📚💥`):** Exceeding `MAX_CALL_STACK_DEPTH = 64` (e.g., runaway recursion in `rec`) halts with stack-overflow feedback.
- **`STEP_LIMIT` (`⏳🔁`):** Exceeding `MAX_TOTAL_STEPS = 10_000` (e.g., an infinite `WHILE` loop) halts cleanly distinct from wall `'COLLISION'` (`💥`).
- **`DEADLOCK` (`🔒💥`):** Circular mutex wait cycles across concurrent `Main` / `Fork` workers (`conc`) freeze and report deadlock immediately.

| Variable State | Watch Box Display (`toolbar-variables`) |
| :--- | :--- |
| **Number** | `[a: 42]` — monospace numeric badge |
| **Color** | `[a: 🔴]` — filled circular swatch (high-contrast ring around `white` and `black`) |
| **Unset** | Hidden until referenced; animates digits or color dot flying in on `VAR_ASSIGN` |

### 1.2 Shared Sparse Memory Tape Subsystem (with Per-Worker Heads in `conc`)

To scale cleanly from 8-cell beginner puzzles to **10,000-cell** sandboxes and Mastery Challenges—and support true lock-free **Parallel Sort** on disjoint sub-arrays in `conc`—the tape stores **only non-empty cells** and tracks **per-worker read/write heads** when multiple workers are active:

```typescript
export const DEFAULT_PUZZLE_TAPE_LENGTH = 8;
export const SANDBOX_MAX_TAPE_LENGTH = 10_000;

export interface TapeState {
  /** Valid index range is 1 .. length (e.g. 8 in guided puzzles; 10,000 in Sandboxes & Mastery) */
  length: number;
  /** Primary 1-based read/write head index (starts at 1) */
  headPos: number;
  /** Per-worker 1-based head positions in concurrent programs (keyed by fiber/worker ID; defaults to 1) */
  workerHeads?: Record<string, number>;
  /** Sparse dictionary of non-empty cells keyed by 1-based index. Empty cells are omitted! */
  cells: Record<number, TypedValue>;
}
```

- **Zero Default-Value Storage:** Unset cells are absent from `cells` (`$cellEmpty` evaluates to `1`). Clearing a cell deletes `cells[index]`.
- **Per-Worker Color-Coded Heads (`▲1`, `▲2` in `conc`):** Each concurrent worker moves and reads through its **own** head position over the shared `cells` array—so Worker 1 sorting `1..4` and Worker 2 sorting `5..8` execute in parallel without hijacking each other's seek position, while simultaneous writes to the *same* cell index still race if unsynchronized!
- **Strict Out-of-Bounds Collision (`status = 'COLLISION'`):**
  - Valid cell positions are strictly `1 .. tape.length`.
  - **`TAPE_SEEK [target]`:** Truncates fractional targets via `Math.trunc(target)`. Errors out immediately (`status = 'COLLISION'`) with an end-bumper shake if `< 1` or `> tape.length`.
  - **`TAPE_STEP [→ / ←]`:** Stepping right from `tape.length` or left from `1` likewise errors out immediately (`status = 'COLLISION'`).

#### Windowed Viewport UI & `shrink-0` Dock

The UI renders a **7-to-9 cell sliding window** centered around the active head (displaying color-coded head markers `▲1`, `▲2` when multiple workers are visible), with a Sandbox Cell Editor Popover (10 Color Swatches, Number Stepper, `∅` Eraser) in creative/free-play modes:

```
  ┌─ 📼 Tape (10,000) ────────────────────────── [Jump #] ──┐
  │ ◀ [1] … ┌─────┬─────┬─────╦═════╦─────┬─────┬─────┐ … ▶ │
  │         │  40 │  60 │  ·  ║ 🔴  ║  25 │  ·  │  90 │     │
  │         ├─────┼─────┼─────╫─────╫─────┼─────┼─────┤     │
  │         │ #47 │ #48 │ #49 ║ #50 ║ #51 │ #52 │ #53 │     │
  │         └─────┴─────┴─────╩══▲══╩─────┴─────┴─────┘     │
  └───────────────────────────── Head ──────────────────────┘
```

#### Shared Tape Blocks (3) & Shared Sensors (5)

| Block | Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `TAPE_SEEK` | Head → `[N]` | Index `N`: literal, variable (`a`–`z`), or socket (`●`, `▲`, `■`) | Truncates `N` via `Math.trunc(N)`. Moves active worker's head to `N` (1 tick). Errors (`COLLISION`) if `< 1` or `> tape.length`. |
| `TAPE_STEP` | Head `→` / `←` | Direction (`RIGHT` / `LEFT`), optional `×N` repeat badge | Steps active worker's head `+1` or `-1` per sub-tick. Errors (`COLLISION`) if `< 1` or `> tape.length`. |
| `TAPE_WRITE` | ✏️ → cell | Value: number, color swatch, variable, socket, or `CLEAR` (`∅`) | Writes `TypedValue` into `cells[head]` (or deletes `cells[head]` when `CLEAR`). |

| Sensor | Badge | Return Type | Meaning |
| :--- | :--- | :---: | :--- |
| `$cellValue` | Head + `#` | `number` | Numeric value at `cells[head]` (`TYPE_ERROR` if color or empty) |
| `$cellColor` | Head + 🎨 | `color` | Color at `cells[head]` (`TYPE_ERROR` if number or empty) |
| `$cellEmpty` | Head + `∅` | `boolean` | `1` if `cells[head]` is unset, `0` otherwise |
| `$headPos` | Head `@#` | `number` | Current 1-based head index (`1..tape.length`) of the calling worker |
| `$tapeLength` | Rail `⇥#` | `number` | Capacity `tape.length` (enables bounds-safe `While ($headPos < $tapeLength)`) |

### 1.3 Animation Models: LOGO Flipbook Mode vs. Beat Explicit Hardware Loops (`anim`)

- **🐢 Turtle LOGO — Explicit Flipbook & Live Modes ([`envs/turtle_logo.md`](./envs/turtle_logo.md#2-explicit-flipbook-animation-mode-anim--live-interactive-mode-inter)):**
  - Rather than manual `SET_INSTANT` + `CLEAR_CANVAS` loops inside LOGO code, enabling **Flipbook Mode** runs `MAIN` once per frame (`$frame = 1..N`, `$time`), automatically resetting turtle pose to `(0, 0, 0°)` and clearing paths between frames (unless `🧹 Clear Between Frames` is toggled `OFF`), while **preserving variables (`a`–`z`) and Sparse Tape** across frames.
  - First pass draws each frame visibly with a short pause (plus **`⏩ Render All Frames`** fast-forward), caching vector frames for smooth **Timeline Scrubber** playback (`Instant` speed skips straight to playback).
- **🎵 Beat & Light — Explicit Hardware Display-Buffer Loops ([`envs/beat_light.md`](./envs/beat_light.md#3-explicit-hardware-frame-loops-anim-vs-concurrency-bands-conc)):**
  - Retains explicit loop-based frame batching (`SET_BEAT_DELAY [0]` → `Loop` → `CLEAR_LEDS` **at the start of the loop, never at the end** → draw LEDs → `WAIT_BEAT`) so learners also understand how real-time hardware frame buffers operate and static thumbnails retain their final frame.

### 1.4 Interactive Sensors & Single-Threaded Queued Events (`inter`)

- **Live Pointer & Virtual Controls:** Exposes `$pointerX`, `$pointerY`, `$pointerDown` (quantized to `1..W, 1..H` LED cells in Beat and canvas `(x, y)` in LOGO) plus cross-device touch/keyboard D-Pad and `A`/`B` buttons.
- **Race-Free Queued Event Dispatch (`On Key` / `On Tap → F1`):** Event triggers run via **single-threaded queued dispatch**—executing to completion when idle, or running cleanly at **frame boundaries** before the next `MAIN` frame in Live Mode—so learners build playable synths and mini-games in `inter` with zero unintended concurrency races.

### 1.5 Concurrency, Synchronization & Message-Passing Extensions (`conc`)

- **Multiple `Main` Tabs (`Main 1`, `Main 2`, …):** Execute in deterministic round-robin lockstep (1 active tick per worker = `1` wall-clock beat `⏱️`).
- **Global Barrier (`🚧 SYNC_BARRIER`):** Pauses an arriving worker (`⏳🚧`) until *all* currently active workers reach a barrier.
- **Value-Copy Message Channels (`📨 SEND [Chan, val]` & Blocking `📬 $recv [Chan]`):** Color-coded channels (`🔴`, `🔵`, `🟢`) transfer a **copy** of a `TypedValue`; `$recv` blocks the reader (`⏳📬`) until a message arrives, providing race-free communication and synchronization.
- **Dynamic Spawning (`🔀 Fork F1(●, ▲, ■)`) & Child Barrier (`🚧 Join`):** Spawns concurrent helper fibers with isolated socket arguments (cloning parent turtle pose in LOGO); `Join` waits until the caller's forked children finish.
- **Mutex Locks (`🔒 Lock [🔴/🔵]` & `🔓 Unlock [🔴/🔵]`):** Mutual-exclusion tokens for protecting shared globals (`a = a + 1`), Depot stations, and overlapping Tape cells; waiting workers display a pulsing `⏳🔒` badge (and freeze visibly on circular-wait deadlocks).

---

## 2. Lesson Pedagogical Mechanics, Reading Policy & Teaching Tools

### Two-Layer Reading Policy & Future Multi-Representation Evolution
- **Code Workspace:** Always **100% zero-reading** across every module.
- **Lesson Explanations:** Early Core modules (`seq`–`while`) require zero reading anywhere. Intermediate/advanced modules (`var`+, `anim`, `inter`, `conc`, `fp`) may include concise **Guided / Co-Pilot Explanation Cards** for older readers or adult co-pilots during `📖 Explanation` demos.
- **Future Evolution:** Alternative readable/textual programming views will layer onto the exact same engines, lessons, and sandboxes for learners transitioning beyond visual blocks (see [`sandbox_ideas.md`](./sandbox_ideas.md)).

### `?` Placeholder Blocks, Pre-Scaffolded Starters & Fix-It Bug Hunts
- **`?` Placeholders:** Show structural skeletons (`Loop`, `If/Else`) in Partial Solutions; execution pauses cleanly on `?` with an amber pulse rather than erroring.
- **Pre-Scaffolded Starters & Fix-It Puzzles:** Lessons pre-populate boilerplate helpers/setup so learner edits stay focused (`≤ 6–8` blocks delta), and regularly feature **Bug-Hunt / Fix-It starters** (off-by-one loops, sequential-`If` state-mutation bugs, fencepost bounds collisions, race conditions, and deadlocks).

### Canvas Ghost-Step Preview & Progressive Visual Solutions (Undo-Protected)
- Short early puzzles use translucent **Ghost-Step Previews** for non-spoiling hints; all constrained puzzles (**🤖 Robot**, **🏗️ Depot**, **🚂 Switchyard**) provide **Partial Help** + **1-tap Full Working Solutions** backed by 1-tap **Undo**.

### Illustrated & Playable Creative Variations (🐢 LOGO & 🎵 Beat & Light)
- Pre-load a compact **working starter** (`≤ 14 blocks/tab`) alongside **2–4 Variation Cards** (LOGO auto-thumbnails; Beat mini animated previews + in-card `▶` Play/Listen; 1-tap Undo-safe Copy/Load), with progressive showcase block allowances on Variation 2 and Variation 3+.

### `📖 Explanation` Lesson Mode & Simultaneous Multi-Map / Multi-Stream Validation
- `📖 Explanation` lessons provide 1–3 runnable demo tabs (`[1] [2] [3]`) with synchronized visual spotlights and 1-tap **Continue (`→`)**.
- Adaptive (`branch`+) and concurrent (`conc`) puzzles validate simultaneously against **3–4 visible variant maps/streams** (`[1 ✓] [2 ·] [3 ·]`).

---

## 3. Curriculum Runner, Slug IDs, Profiles, Saves & Rewards Infrastructure

- **Slug-Based Module & Activity IDs (`<mod>.<item>`) + Side-Track DAG:** Tracks progress across Core Spine modules (`seq`→`param`→`loop`→`func`→`branch`→`while`→`var`→`cmp`→`tape`→`sort`→`args`→`rec`), Side-Track DAG unlocks (`cmp ==> inter`, `tape ==> anim`, `args ==> conc`, `rec ==> fp`), and Optional Mastery Sets (`var.M1`..`conc.M3`) via compact UTF-8 IDs in [`binary_format.md` §2.3.2](./binary_format.md#232-compact-lesson-identifier-compactlessonid), with transparent legacy numeric aliasing (`"1.0"` → `"seq.0"`, `"8.1"` → `"cmp.M1"`, `"C6.1"` → `"var.M1"`).
- **Kid-Friendly Multi-Profile System & Progressive Sandbox Unlocks:** Avatar-first local profiles with isolated progress, badges, per-lesson autosaves, manual save slots, read-only curriculum map locking, historical `version` retention (`LessonVersionMismatchModal`), whole-profile Base64URL/QR export & import, **Unlock All / Pro Sandbox** toggle, and celebratory **Module Badges & Challenge Medals**.

---

## 4. Phased Delivery Roadmap (Synchronized 5-Phase Progressive Ladder)

| Phase | Core Modules & Side Tracks | Platform & Environment Pillars | Standalone Value |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Core `seq` → `param` → `loop` → `func` | Unified `App.tsx` `[Top Dock / Viewport / Bottom Dock]` shell, `BackpackHud` (`🎒`) retired globally onto Robot/Depot claws, `1 ⋯▶ 2` & shuttered `🏁` flags, Grid physics/thumbnail fixes (`order===0`), conditional Beat reticle, LOGO `🐢👁️` & `🏠` teleport, Switchyard runner registration, `SET_BEAT_DELAY` multiplier alignment, DAG & atomic-pair prep | ✅ Rock-solid M1–M3/4 UX baseline across all 5 environments with zero HUD collisions |
| **Phase 2** | Core `branch` → `while` | Clean **Switchyard v2** & **Depot v4** (`SCRAP` & `itemDamaged` `0x1A` retired) replacements, `<ConditionSubpalette>` editor (`IF` / `ELSE_IF` / `WHILE`, `NOT`/`AND`/`OR`), atomic pair insertion, shared `🎛️ $input` Top Dock, `[1 ✓][2 ✗]` pip & `switchyardState` variant focus, Turtle `insideCanvas` (`0x28`) & Beat `cursorAtEdge` (`0x2A`) | ✅ Adaptive multi-map/multi-stream puzzles & reactive `$input` art/music sandboxes |
| **Phase 3** | Core `var` → `cmp` & Side `inter` | `0x30 CMP`, strict 3-address math, distinct `SimulationStatus` (`TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, `DEADLOCK`), `TypedValue` (`number` vs `color` + Watch Tray bounce), `🎲` random presets & `$randomColor`, dynamic sensor subpalette, interactive `$pointer*` / D-Pad / queued events (`0x40..0x46`), Slug IDs + Side-Track DAG (`cmp ==> inter`) | ✅ Generative math art/audio, typed safety & playable interactive games |
| **Phase 4** | Core `tape` → `sort` & Side `anim` | Sparse `10,000`-cell `TapeState`, windowed Top-Dock `TapeDock` (`0x0C..0x0E`), Beat `OP_EXT 0x0F` (`STAMP_FROM_TAPE`) + `16×16`/`32×32` + `ENV_VERSION_BEAT_V2 = 2`, LOGO Flipbook Mode (`ENV_VERSION_TURTLE_V2 = 2`), animated variation cards, `⏱️` Wall-Clock Tick Speedometer | ✅ Custom sprites, binary search/sorting speedups & frame-cached Flipbook studio |
| **Phase 5** | Core `args` → `rec` & Sides `conc`, `fp` | Frame-local shape sockets (`●/▲/■`), `MAX_CALL_STACK_DEPTH = 64` + recursive Hanoi, `OP_EXT 0x0F` concurrency (`Main 1..4` `0x00..0x03`, `SYNC_BARRIER`, `SEND`/`$recv`, `FORK`/`JOIN`, `LOCK`/`UNLOCK`, cycle `DEADLOCK`, per-worker Tape `▲1 ▲2`), `ENV_VERSION_GRID_V4 = 4` team bots, dual-claw Depot, `fp` `[Fn]` sockets (`RETURN`, `CALL_PARAM_FN`) | ✅ Full abstraction ladder: recursion, parallel sorting & higher-order functional code |
