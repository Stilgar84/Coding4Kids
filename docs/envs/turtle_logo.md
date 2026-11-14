# 🐢 Turtle LOGO Environment Specification

**Turtle LOGO** is an **open-ended creative drawing, animation, and generative-art sandbox** environment used across Core Modules `seq`–`rec` (except `sort`) and Side Modules `anim`, `inter`, `conc`, and `fp` of [the curriculum](../curriculum/overview.md). Learners guide one or more pen-carrying turtles to draw geometric shapes, data-driven skylines, flipbook animations, interactive sketches, and recursive/concurrent fractals.

*(For cross-environment features—including the unified 10-swatch `PALETTE_COLORS` / `TypedValue` system, shared Sparse Memory Tape, `$input` & `🎲` random sensors, concurrency primitives, and variation card mechanics—see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for core drawing opcodes `FORWARD`, `BACKWARD`, `TURN_LEFT`, `TURN_RIGHT`, `ARC_LEFT`, `ARC_RIGHT`, `PEN_UP`, `PEN_DOWN`, `SET_PEN_COLOR`, `SET_PEN_WIDTH`, and `TELEPORT`, see [Binary Format §7.3](../binary_format.md#73-turtle-world-opcodes-envid--0x02-envversion--1); for HUD slots and layout rules, see [UI Guidelines](../ui_guidelines.md).)*

---

## 1. Visual Simulation & Color Model

- **White Drawing Canvas (`#ffffff`) & Persistent Style State:** `PEN_COLOR` and `PEN_WIDTH` remain active until explicitly changed; angle parameter pickers pair numeric degrees with visual pie/turn wedges.
- **Selective Color Erasing (`White`):** Drawing over an earlier path with `SET_PEN_COLOR [White]` (index `9` in `PALETTE_COLORS`) acts as a precision eraser on the white `#ffffff` canvas.
- **Hide Turtle (`👁️`):** Hides the turtle SVG avatar(s) so animations and mandalas can be admired cleanly (Top-Right `pane-simulation` badge slot).
- **No Pass/Fail Grading:** LOGO lessons pre-load a working starter example and provide illustrated **Variation Cards** (with tiered showcase block allowances for Var 2 and Var 3+) featuring auto-rendered thumbnails and 1-tap **Copy / Load Code** (Undo-protected).

---

## 2. Explicit Flipbook Animation Mode (`anim`) & Live Interactive Mode (`inter`)

Rather than cluttering LOGO workspaces with boilerplate `SET_INSTANT` + `CLEAR_CANVAS` + `WAIT` frame loops (which remain taught at the hardware pixel level in [🎵 Beat & Light](./beat_light.md)), LOGO provides first-class **Environment Animation Modes**:

### 2.1 Flipbook Animation Mode (`anim` & Free-Play Sandbox)
When Flipbook Mode is enabled on a lesson or toggled in Sandbox:
1. **1 Run of `MAIN` = 1 Frame:** The engine invokes `MAIN` once per frame from `$frame = 1` up to `totalFrames` (`N`), with `MAX_TOTAL_STEPS = 10,000` enforced **per frame** rather than across the entire animation.
2. **Automatic Pose Reset + Persistent Memory:** Before each frame `> 1`, the turtle resets to `(0, 0, 0°)` and the canvas clears—*(unless the **`🧹 Clear Between Frames [ON / OFF]`** toggle is set to `OFF` for progressive/accumulating trail animations)*—while **variables (`a`–`z`) and Sparse Memory Tape state persist** across frames!
3. **Two-Phase Inspectable Render → Cached Scrubber Playback:**
   - **First Pass (Draw & Bake):** Draws each frame visibly at the chosen speed, pausing briefly between frames so learners can watch and debug how Frame 1, Frame 2, … are constructed (with a **`⏩ Render All Frames`** button to bake remaining frames immediately; `Instant` speed skips straight to playback).
   - **Playback Mode:** Plays the saved vector frames smoothly with a **Timeline Scrubber (`1 .. N`)**, playback speed multiplier (slow-motion / fast), and Loop mode (`1×` / `∞`).
   - **Rewind (`⏮`):** Resets `$frame = 1`, clears cached frames, and restores variables and Tape to their initial pre-run state.

### 2.2 Live Interactive Mode (`♾️` — `inter` & Free-Play Sandbox)
- Runs `MAIN` continuously (~15–30 fps) without a fixed frame limit, preserving variables and Tape across ticks while reading live `$pointerX`, `$pointerY`, `$pointerDown`, virtual D-Pad/buttons, `$input`, and `🎲` random rolls, and dispatching queued event handlers (`On Key` / `On Tap → F1`) cleanly between frames.

---

## 3. LOGO Sensors & Positioning Blocks

| Block / Sensor | Icon | Introduced | Behavior |
| :--- | :---: | :---: | :--- |
| `TELEPORT` | 🎯 Crosshair | `param` / `func` | Jumps directly to `(x, y, heading)` without drawing a line. |
| `insideCanvas` | 🖼️ Frame check | `while` | `true` while the turtle sits inside the nominal visible canvas bounds (powers boundary-driven `While (insideCanvas)` spirals/starbursts before variables exist). |
| `$x`, `$y`, `$heading` | `📍X`, `📍Y`, `🧭∠` | `var` | Read-only numeric pose sensors (`Math.round` coordinates and degrees). |
| `$frame`, `$time` | `🎞️#`, `⏱️t` | `anim` | Current 1-based frame index (`1..N`) and elapsed animation time in seconds when Flipbook or Live Mode is active. |
| `$input`, `🎲`, `$pointerX/Y` | `🎛️`, `🎲`, `👆` | `branch` / `var` / `inter` | Shared scene selector (`branch`+), dice/float/color random rolls (`var`+/Sandbox), and live canvas pointer coordinates (`inter`+). |

---

## 4. Multi-Turtle Concurrency (`conc`) & Sparse Tape Integration

LOGO supports concurrent drawing in `conc` and Sandbox using the two **shared** concurrency mechanisms—requiring **zero** LOGO-specific clone blocks:
- **Multiple `Main` Tabs (`Main 1`, `Main 2`, … → Separate Scene Elements):** Each `Main` tab owns an independent color-accented turtle starting fresh at `(0, 0, 0°)` with isolated pen up/down, color, and width—ideal for drawing separate scene elements simultaneously.
- **`🔀 Fork F1(●, ▲, ■)` (→ Branching Pose Clone):** Spawning a helper via `Fork` creates a child turtle that **inherits the parent turtle's exact `(x, y, heading, penColor, penWidth, penDown)`** at the moment of the fork—enabling simultaneous branching trees, lightning, and fireworks without backward state-restoration boilerplate.
- **Sparse Memory Tape:** `10,000` sparse cells rendered in the `shrink-0` Tape Dock above the SVG canvas (with per-worker heads in `conc`), editable and saved sparsely in creative workspaces (see [Platform Requirements](../platform_requirements.md)).
