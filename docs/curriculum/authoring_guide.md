# Curriculum Authoring, Pseudocode & Tooling Guide

This guide defines the canonical document structure, pseudocode syntax, JSON AST mapping, environment authoring rules, and automated CLI scripts used across `docs/curriculum/`. All scripts live under [`scripts/curriculum/`](../../scripts/curriculum/) and run with Node ESM (`"type": "module"`) with zero external dependencies.

See also:
- [Curriculum Architecture & Roadmap](./overview.md)
- [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md)
- [Kid-Friendly UI Principles & Guidelines](../ui_guidelines.md)
- Environments: [Turtle LOGO](../envs/turtle_logo.md) · [Robot Grid](../envs/robot_grid.md) · [Beat & Light](../envs/beat_light.md) · [Rail Switchyard](../envs/switchyard.md) · [Cargo Depot](../envs/depot.md)

---

## 1. CLI Tooling Quick Reference

| NPM Script | Underlying Script | Purpose |
| :--- | :--- | :--- |
| `npm run curriculum:logo` | `node scripts/curriculum/render_logo_svg.mjs` | Render deterministic static Frame-1 `.svg` files from Turtle LOGO JSON AST or pseudocode specs, check ink bounds (`>= 160px`), or convert AST ↔ pseudocode. |
| `npm run curriculum:verify` | `node scripts/curriculum/verify_puzzle_trace.mjs` | Execute multi-variant puzzle traces (`grid`, `depot`, `switchyard`), verify `slotCap` & `partialHelp` behavior, and render `+---+---+` Robot Grid ASCII diagrams. |
| `npm run curriculum:audit` | `node scripts/curriculum/audit_curriculum_docs.mjs` | Audit `docs/curriculum/` for broken links, orphan SVGs, `<animate*>` tags, tiny LOGO SVGs (`< 160px`), Stage-1 `[Img N]` placeholders, malformed JSON blocks, and `slotCap` mismatches. |

> **Windows Sandbox Note:** All `curriculum:*` scripts run completely offline and belong inside the standard sandbox (`BypassSandbox: false`). Pass `--` before flags when invoking via `npm run` (e.g., `npm run curriculum:audit -- seq param --strict-stage2`).

### 1.1 `render_logo_svg.mjs` Commands

```powershell
# Render single JSON or pseudocode file -> SVG (prints inkBounds & scaleWarning metrics)
npm run curriculum:logo -- path/to/spec.json docs/curriculum/seq/svg/seq_1_target.svg

# Dry-run bounds check without writing output
npm run curriculum:logo -- path/to/spec.pseudo out.svg --check

# Batch render via manifest JSON
npm run curriculum:logo -- --batch path/to/manifest.json
# or directly:
node scripts/curriculum/render_logo_svg.mjs --batch path/to/manifest.json [--check]

# Bidirectional AST <-> Pseudocode conversion
node scripts/curriculum/render_logo_svg.mjs --print-pseudo path/to/spec.json
node scripts/curriculum/render_logo_svg.mjs --print-ast path/to/spec.pseudo
```

**Batch Manifest Format (`--batch <manifest.json>`):**
Accepts either an array of render entries or `{ "items": [ ... ] }`:

```json
{
  "items": [
    {
      "out": "docs/curriculum/loop/svg/loop_1_target.svg",
      "startPose": { "x": -100, "y": -100, "heading": 90 },
      "MAIN": [
        { "op": "LOOP_START", "count": 4, "body": [
          { "op": "FORWARD", "length": 200 },
          { "op": "TURN_RIGHT", "angle": 90 }
        ]}
      ]
    }
  ]
}
```

Wait conditions & runtime behavior:
- Any item (or CLI `.json`) can provide `scopes` (`{ MAIN, F1, ... }`), top-level `MAIN` / `MAIN_1..4` / `F1..F3`, or `program` (string pseudocode or scope object).
- Optional fields: `signatures`, `startPose`, `initialVars`, `tape`, `canvasBounds` (`{ halfWidth, halfHeight }`, defaults to `300x240`), `showCanvasBounds`, `hideTurtle`, `previewInput` (default `1`), `previewFrame` (default `1`), `fps` (default `10`), `seed` (default `42`), `pointer`.
- Exits non-zero if runtime `status !== "OK"` (e.g., `TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, `DEADLOCK`).

### 1.2 `verify_puzzle_trace.mjs` Commands

```powershell
# Verify all variants, slotCap, and partialHelp for a grid/depot/switchyard puzzle JSON
npm run curriculum:verify -- path/to/puzzle.json

# Also print standardized +---+---+ ASCII maps for each Robot Grid variant
npm run curriculum:verify -- path/to/puzzle.json --ascii
```

Puzzle verifier JSON shape:
- `env`: `"grid"` | `"depot"` | `"switchyard"`
- `slotCap`: integer or `{ "maxTotal": N, "perScope": { "MAIN": N } }`
- `referenceSolution`: pseudocode string, scope object, or `{ "scopes": ..., "signatures": ... }`
- `partialHelp` (optional): starter/scaffold solution checked against `variants[0]`
- `variants`: array of world/goal configs (defaults to `[spec.world]`)

### 1.3 `audit_curriculum_docs.mjs` Commands

```powershell
# Audit all modules under docs/curriculum/ (informational report)
npm run curriculum:audit

# Strict Stage-2 gate for finished modules (exits 1 on any issue)
npm run curriculum:audit -- seq param loop func branch while var cmp --strict-stage2

# Machine-readable JSON output
npm run curriculum:audit -- seq param --strict-stage2 --json
```

Checked failure classes under `--strict-stage2`:
1. `missingModules`: Requested module directory does not exist.
2. `brokenLinks`: Relative `[text](path)` or `<img src="...">` links resolving to missing files (fenced/inline code is excluded).
3. `orphanSvgs`: `.svg` files under the module folder not referenced by any `.md` file in that module or `docs/curriculum/overview.md`.
4. `animatedSvgs`: Any `.svg` containing `<animate`, `<animateTransform`, or `<animateMotion`.
5. `tinySvgs`: Non-empty `.svg` where arc-sampled ink max span (`max(inkWidth, inkHeight)`, ignoring backdrop rects, `#cbd5e1`/`#e2e8f0`/`#f1f5f9` grid/axis strokes, and turtle marker `<polygon>` triangles) is `< 160px`.
6. `stage1Placeholders`: Lingering `[Img N]` placeholders in prose.
7. `jsonErrors`: Malformed ```` ```json ```` blocks (strict JSON is checked first; `//` / `/* */` JSONC comments are stripped cleanly as `jsoncBlocks`; snippets with literal `...` ellipsis placeholders are counted separately as `ellipsisSnippets`).
8. `slotCapMismatches`: JSON specs declaring `slotCap` whose reference solution exceeds `slotCap` by closer-inclusive counting.

---

## 2. Directory, File & Naming Conventions

Each module lives in its own folder under `docs/curriculum/<mod>/`:

```text
docs/curriculum/<mod>/
├── overview.md                 # Module overview, learning objectives, beat table, progression map
├── lesson_<id>.md              # Lesson / exploration / guided puzzle / creative sandbox spec
├── challenge_<mod>_m<n>.md     # Optional mastery / capstone challenge spec (m1, m2, ...)
└── svg/
    ├── <mod>_<step>_target.svg # Static Frame-1 target SVG (e.g., seq_2_target.svg)
    └── <mod>_<step>_starter.svg # Additional initial/variant SVGs when distinct
```

- **Activity IDs**: Lowercase `<mod>.<index>` (e.g., `seq.0`, `param.2`, `cmp.5a`, `var.m1`) and corresponding snake_case filenames (`lesson_seq_0.md`, `lesson_cmp_5a.md`, `challenge_var_m1.md`).
- **Canvas Links**: Embed SVGs with standard relative Markdown image syntax `![Caption](svg/file.svg)` and cross-link neighboring lessons or env docs with relative links (no absolute filesystem paths in committed Markdown).

---

## 3. Document Structure & Pedagogical Rules

### 3.1 Two-Layer Reading Policy
Follow [Kid-Friendly UI Principles](../ui_guidelines.md) strictly:
- **In-App Kid-Facing Copy (Ages 5–7)**: Visual cards, icons, short ≤3-word labels, or short concrete audio/speech-bubble prompts. Never rely on dense paragraphs or technical jargon (`iteration`, `predicate`, `boolean`, `recursion`) inside kid-facing UI fields (`title`, `prompt`, `hint`).
- **Author & Implementation Notes**: Full engineering rationale, edge cases, exact runtime tolerances, and implementation guidance go in Markdown prose sections clearly separated for curriculum/engine authors.

### 3.2 Recommended Stage-2 File Templates

**Module `overview.md`:**
1. Title, spine position & prerequisite modules
2. Pedagogical focus & introduced concepts/blocks (table mapping `Block -> Introduced In -> Visual Metaphor`)
3. Full Beat / Activity Sequence Table (`ID`, `Format` (`📖` Story / `🤖` `🚂` `🏗️` Puzzle / `🐢` `🎵` Creative / `🔥` Mastery), `Env`, `Title`, `Introduced`, `Slot Cap / Budget`)
4. Two-Axis Progression Verification & Sandbox Variant Summary

**Individual Activity (`lesson_<id>.md` / `challenge_<mod>_m<n>.md`):**
1. Metadata header table (`ID`, `Module`, `Env`, `Format`, `Target Block Cap`, `Palette`)
2. Kid-facing Goal / Visual Cue & World Setup (`startPose`, `+---+---+` ASCII grid for Grid puzzles, Beat `8×8` target pattern, Depot/Switchyard variant configs, or Target `.svg` for LOGO)
3. **Initial / Starter Workspace** (both `pseudocode` and/or `json` AST, especially for Debugging `🔧` / Scaffolding lessons)
4. **Reference Solution** (canonical pseudocode + optional JSON AST + verified flat block count per scope & total)
5. Multi-Variant Acceptance Criteria (`variants` if randomized/multi-seed) & Hint / Partial-Help Escalation

### 3.3 Two-Axis Guardrails & Closer-Inclusive Counting

Per [`overview.md`](./overview.md):
- **Axis 1 (Per-Level Concept Delta):** Introduce at most **1 new concept** (or 1–2 tightly coupled literals) per activity.
- **Axis 2 (Code Size & Flat Block Caps):**
  - Consecutive levels differ by **at most 6–8 flat blocks**.
  - Early Modules (`seq`–`func`): **≤ 8 flat blocks** per activity (typical 3–7).
  - Core & Side Spine (`branch`–`rec`, `anim`, `inter`, `conc`, `fp`): **≤ 14 flat blocks per tab** (typical 6–12 per scope).
  - Mastery Challenges (`*m1..*m6`): **≤ 20 flat blocks per tab**, **≤ 50 total** across all tabs.
  - Open Creative Sandboxes: **Starter/Var1 ≤ 14/tab (≤ 24 total)**, **Var2 ~20/tab (~40 total)**, **Var3+ ~30/tab (~60–80 total)**.

**Closer-Inclusive Counting Formula (`countFlatBlocks` in [`sim_core.mjs`](../../scripts/curriculum/lib/sim_core.mjs)):**
Each container opener AND closer consumes a slot in the flat tape workspace:
- `FORWARD`, `TURN_RIGHT`, `CALL_FN`, `PLACEHOLDER`, `VAR_ASSIGN`, `RETURN`, `SEND`, `LOCK`, `UNLOCK`, `FORK`, `JOIN`, `SYNC_BARRIER`, etc. = **`1`** flat block.
- `LOOP_START` / `LOOP` (opener + `End Loop`) = **`2 + count(body)`**.
- `WHILE` (opener + `End While`) = **`2 + count(body)`**.
- `IF` (opener + `End If`) = **`2 + count(then)`**, plus **`1 + count(body)`** per `Else If`, plus **`1 + count(else)`** if `ELSE` is present.
- `ON_EVENT` with inline `body` array (when expanded inline rather than delegating `On Tap -> F1`) = **`2 + count(body)`** (delegate header `On Tap -> F1` counts as **`1`**).

---

## 4. Environment-Specific Authoring Rules

### 4.1 Robot Grid (`grid`)
- **ASCII Map Standard (`renderGridAscii`)**: Walls sit on cell boundaries:
  - `H(x, y)` is a horizontal barrier **along the top edge** of cell `(x, y)` (so row 0's top border is always drawn, and interior `H(x, y)` separates `(x, y-1)` from `(x, y)`).
  - `V(x, y)` is a vertical barrier **along the left edge** of cell `(x, y)`.
  - Standard cell tokens inside `+---+---+`: `RN `/`RE `/`RS `/`RW ` (start pose + facing), ` G ` (goal flag), `F1 `..`Fn ` (ordered flags), ` # ` (blocked tile when `sharedWalkable` excludes cell), ` ~ ` (water hazard), `D<n>` (numeric dial), ` K ` (key), ` P ` (plank), ` * ` (relic), ` C ` (crate/cargo), ` S ` (switch), ` . ` (walkable floor).
- **Variant Coverage**: Conditional (`branch`), loop-until (`while`), dial/variable (`var`), and comparator (`cmp`) grid puzzles MUST define at least 2–3 `variants` with randomized/varying corridor lengths or wall openings so hardcoded `FORWARD` paths cannot accidentally pass.

### 4.2 Turtle LOGO (`logo`)
- **Scale & Default Parameters (`sim_core.mjs` & `render_logo_svg.mjs`)**:
  - `DEFAULT_STEP_DISTANCE = 100` (`FORWARD`/`BACKWARD` when no length parameter is unlocked yet).
  - `DEFAULT_ARC_RADIUS = 50`, `DEFAULT_ARC_ANGLE = 90`.
  - Default stage reference bounds: `DEFAULT_CANVAS_BOUNDS = { halfWidth: 300, halfHeight: 240 }` (`600×480` viewport framing; sandbox stages auto-expand).
  - **Minimum Visibility Rule:** All rendered SVGs MUST have arc-sampled `inkMaxSpan >= 160px` (`scaleWarning: false`). Drawings smaller than `160px` disappear behind the turtle cursor on kid screens.
- **Static Frame-1 SVG Rule:** Course docs NEVER embed animated `<animate*>` tags inside `.svg` files. Animated or interactive lessons (`anim`, `inter`) MUST render deterministic static **Frame 1** snapshots (`previewFrame: 1`, `previewInput: 1`), and explain motion/interactivity in accompanying text/frames.
- **Multi-Worker & Sparse Tape in LOGO (`render_logo_svg.mjs`)**:
  - Scopes `MAIN_1..MAIN_4` render onto a shared canvas with distinct turtle marker colors (`#10b981`, `#3b82f6`, `#8b5cf6`, `#f97316`).
  - `FORK` clones the caller's turtle pose & pen state at spawn time.
  - Sparse Tape instructions (`TAPE_SEEK`, `TAPE_STEP`, `TAPE_WRITE`) and `$cellValue`/`$cellEmpty` work directly inside LOGO traces (e.g., data-driven skylines in `tape`/`sort`).

### 4.3 Beat & Light (`beat`)
- **Grid & Pitch Space:** `8×8` LED matrix (`x: 0..7`, `y: 0..7`, top-left `(0,0)` to bottom-right `(7,7)`). Musical pitches are **1-indexed `1..8`** (`C4`..`C5`, mapped consistently to `PALETTE_COLORS` swatches or Beat pitch indices).
- **Simultaneous Columns / Chords:** `SET_BEAT_DELAY [0]` advances zero ticks between pixels/notes so multiple notes or an entire LED shape draw in the same visual beat (essential in `seq`/`loop` LED pattern painting), restoring delay `>= 1` afterward for tempo.
- **Color Palette Mapping:** Platform docs standardize swatch indices `0=black, 1=red, 2=blue, 3=green, 4=yellow, 5=purple, 6=pink, 7=cyan, 8=orange, 9=white` (`PALETTE_COLORS`). When documenting Beat, always note clearly if an example uses logical swatch names (`red`, `cyan`, etc.) vs legacy hardware matrix indices (`0=Cyan..8=Black, 9=White`).

### 4.4 Rail Switchyard (`switchyard`)
- Define track **topology** (`switchCount` `0`–`2` yielding 1–3 docks `A`/`B`/`C`, `initialSwitches` `{ A: "LEFT", B: "LEFT" }` defaulting `LEFT`), input **train car streams** (`stream` items `{ weight, icon, color, damaged }` or integer weights), per-junction `SWITCH_LEFT [A]` / `SWITCH_RIGHT [A]` + `SEND_NEXT` / `SCRAP_ITEM`, and expected dock outputs (`expectedDocks`, `expectedLeft`/`expectedRight`, or `dockRules`).
- Specify multiple `variants` (shuffled car orderings) for any lesson using `If (itemColor == ...)`, `If (itemDamaged)`, or `While (hasNextItem)`. Sensors supported in `verify_puzzle_trace.mjs`: `hasNextItem`, `itemDamaged`, `itemColor`, `itemIcon`, `$itemWeight`, `$dockCount[A..C]`, `$dockQuota[A..C]`.

### 4.5 Cargo Depot (`depot`)
- **Stations (`v4`)**: Named crane targets such as `STACK_1`, `STACK_2`, `STACK_3`, `QUEUE`, `INPUT`, `OUTPUT` (`WORKBENCH` / `DOCK` / `ACCEPT` / `REJECT` in v2/gate lessons).
- **Empty-Station Guard Rule:** Reading `$topValue` or `$topColor` at an empty station causes a runtime `TYPE_ERROR` (`🎨≠#`). Any `While` or `If` inspecting `$topValue` on a possibly empty stack MUST short-circuit with `NOT stationEmpty [STACK_1] AND ...` or exit first on `stationEmpty [STACK_1]`.
- **Dock Acceptance (`verify_puzzle_trace.mjs`)**: Specify initial `stacks`/`queue`/`inputQueue` and verify against `targetStacks`, `targetOutput`, `expectedVerdict` (`ACCEPT`/`REJECT`), or `targetTapeCells` across 2+ `variants` with varying stack heights/contents.

### 4.6 Sparse Tape (`tape`)
- **1-Based Tape Addressing:** Tape indices run `1..tape.length` (default lessons `6..16`, sandbox up to `10,000`). Reading or writing out of bounds (`< 1` or `> length`) halts or triggers clamping depending on lesson spec (see [`platform_requirements.md`](../platform_requirements.md)); document expected `tape` initial contents and post-run assertions explicitly. Tool specs accept either `{ "length": 8, "cells": { "1": 120, "2": 180 } }` or a 1-based array shorthand `[120, 180]`.

---

## 5. Canonical Pseudocode Format & 1:1 JSON AST Reference

Both `sim_core.mjs` (`parsePseudocode` / `formatPseudocode`), `render_logo_svg.mjs`, and `verify_puzzle_trace.mjs` share a single bidirectional grammar between human-readable **pseudocode** and **JSON AST**.

### 5.1 Scope Headers & Signatures
Start each workspace tab with a scope header (`MAIN`, `MAIN_1..MAIN_4`, `F1..F3`). Optional trailing slot counts or em-dash descriptions are stripped cleanly; parameter lists inside `(...)` become `signatures`:

```text
// MAIN
// MAIN_1
// MAIN_2
// F1(●, ▲) — Draw polygon of ▲ sides of length ●
```

Normalized parameter tokens:
- `●` ↔ `$p0`
- `▲` ↔ `$p1`
- `■` ↔ `$p2`
- `[Fn]` or `fn` ↔ `$fn`

Single-line comments (`// ...`) and optional numbered step prefixes (`1. FORWARD [100]`) are stripped automatically by `parsePseudocode`.

### 5.2 Control Flow, Placeholders & Function Calls

| Feature | Canonical Pseudocode | JSON AST Equivalent |
| :--- | :--- | :--- |
| Counted Loop | `Loop [×4]` … `End Loop` | `{ "op": "LOOP_START", "count": 4, "body": [...] }` |
| While Loop | `While (pathAhead)` … `End While` | `{ "op": "WHILE", "cond": { "op": "SENSOR", "sensor": "pathAhead" }, "body": [...] }` |
| Branching | `If (cond)` … `Else If (cond2)` … `ELSE` … `End If` | `{ "op": "IF", "cond": ..., "then": [...], "elseIfs": [{ "cond": ..., "body": [...] }], "else": [...] }` |
| Function Call | `Call F1` or `Call F1(●, 60)` or `Call [Fn](●)` | `{ "op": "CALL_FN", "fn": "F1", "args": ["$p0", 60] }` (`fn: "$fn"`) |
| Starter Gap | `?` or `PLACEHOLDER` or `PLACEHOLDER [turn]` | `{ "op": "PLACEHOLDER" }` / `{ "op": "PLACEHOLDER", "hintCategory": "turn" }` |
| Return | `Return` or `Return [a]` | `{ "op": "RETURN" }` / `{ "op": "RETURN", "value": "a" }` |

### 5.3 Variables, Arithmetic & Typed Sensors
Single-letter local/register variables (`a`–`z`, normalized lowercase) and built-in read-only `$` system registers:

| Construct | Canonical Pseudocode | JSON AST Equivalent |
| :--- | :--- | :--- |
| Assign | `a = 50` or `a = $tileDial` | `{ "op": "VAR_ASSIGN", "var": "a", "value": 50 }` |
| Arithmetic (`+ - * / %`) | `a = a + 20` or `c = ● * 2` | `{ "op": "VAR_OP", "target": "c", "operator": "*", "left": "$p0", "right": 2 }` |
| Indexed Tape Read | `a = $tape[i]` | `value: "$tape[i]"` |
| Compare Condition | `a < 100`, `c == red`, `$cellValue != CLEAR` | `{ "op": "CMP", "operator": "<", "left": "a", "right": 100 }` (`CLEAR` ↔ `∅`) |
| Logical Combinators | `cond1 AND cond2`, `cond1 OR cond2`, `NOT (cond)` | `{ "op": "AND" \| "OR", "left": ..., "right": ... }` / `{ "op": "NOT", "expr": ... }` |
| Boolean Sensor | `insideCanvas`, `pathAhead`, `atGoal`, `$cellEmpty`, `$pointerDown` | `{ "op": "SENSOR", "sensor": "pathAhead" }` |
| Parameterized Sensor | `stationEmpty [STACK_1]`, `hasItem [key]`, `keyHeld [LEFT]` | `{ "op": "SENSOR", "sensor": "stationEmpty", "station": "STACK_1" }` (`key` for `keyHeld`) |

### 5.4 Events & Concurrency (`inter`, `conc`)

| Feature | Canonical Pseudocode | JSON AST Equivalent |
| :--- | :--- | :--- |
| Tap / Key Listener | `On Tap -> F1` / `On Key [LEFT] -> F2` | `{ "op": "ON_EVENT", "event": "TAP" \| "KEY", "key": "LEFT", "fn": "F1" }` |
| Spawn Worker | `Fork F1` or `Fork F1(50)` | `{ "op": "FORK", "fn": "F1", "args": [50] }` |
| Await Children | `Join` | `{ "op": "JOIN" }` |
| Rendezvous Barrier | `Barrier` | `{ "op": "SYNC_BARRIER" }` |
| Mutex Lock / Unlock | `Lock [red]` / `Unlock [red]` | `{ "op": "LOCK" \| "UNLOCK", "lock": "red" }` |
| Message Send / Recv | `Send [red, a]` / `b = $recv [red]` | `{ "op": "SEND", "channel": "red", "value": "a" }` / `{ "op": "VAR_ASSIGN", "var": "b", "value": { "op": "$recv", "channel": "red" } }` |

### 5.5 Action Opcodes (`OP [args] [×N]`)
All environment actions follow `OPCODE [arg1, arg2, ...]` with optional compact repeat badge `[×N]` (`block.repeat`, e.g., `MOVE_FWD [×3]`):

- **Turtle LOGO:** `FORWARD [length]` (`MOVE_FWD`), `BACKWARD [length]` (`MOVE_BACK`), `TURN_LEFT [angle]`, `TURN_RIGHT [angle]`, `ARC_LEFT [radius, angle]`, `ARC_RIGHT [radius, angle]`, `PEN_UP`, `PEN_DOWN`, `SET_PEN_COLOR [color]`, `SET_PEN_WIDTH [width]`, `TELEPORT [x, y, heading]`, `HIDE_TURTLE`, `SHOW_TURTLE`, `CLEAR_CANVAS`.
- **Robot Grid:** `MOVE_FWD` (`FORWARD`), `MOVE_BACK` (`BACKWARD`), `TURN_LEFT`, `TURN_RIGHT`, `PICK_UP`, `PLACE`, `TOGGLE_SWITCH`.
- **Beat & Light:** `PLAY_NOTE [pitch, duration]`, `SET_LED_COLOR [color]`, `SET_BEAT_DELAY [multiplier]`, `WAIT_BEAT [beats]` (`WAIT`), `STAMP_PRESET [preset]`, `LIGHT_ROW [row]`, `LIGHT_COL [col]`, `LIGHT_PIXEL [x, y]`, `CLEAR_SCREEN`.
- **Rail Switchyard:** `SWITCH_LEFT [switchId]`, `SWITCH_RIGHT [switchId]`, `SEND_NEXT`, `SCRAP_ITEM`, `CURSOR_STEP`, `CURSOR_TURN [LEFT|RIGHT]`, `WAIT_BEAT [beats]`.
- **Cargo Depot:** `DEPOT_MOVE_TO [station]`, `DEPOT_GRAB [station?]` (`PICK_UP`), `DEPOT_PLACE [station?]` (`PLACE`), `DEPOT_SEND_OUT [gate]` (`DEPOT_SEND_GATE`), `SCRAP_ITEM`.
- **Sparse Tape:** `TAPE_SEEK [index]`, `TAPE_STEP [LEFT|RIGHT]`, `TAPE_WRITE [value]`.

### 5.6 Complete Round-Trip Example

**Canonical Pseudocode:**
```text
// MAIN
Loop [×4]
  Call F1(100, blue)
  TURN_RIGHT [90]
End Loop

// F1(●, ▲)
SET_PEN_COLOR [▲]
FORWARD [●]
```

**Equivalent JSON AST (`render_logo_svg.mjs --print-ast`):**
```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "LOOP_START",
        "count": 4,
        "body": [
          { "op": "CALL_FN", "fn": "F1", "args": [100, "blue"] },
          { "op": "TURN_RIGHT", "angle": 90 }
        ]
      }
    ],
    "F1": [
      { "op": "SET_PEN_COLOR", "color": "$p1" },
      { "op": "FORWARD", "length": "$p0" }
    ]
  },
  "signatures": {
    "F1": ["$p0", "$p1"]
  }
}
```
