# Module `while`: Conditional `While` Loops & FIFO Queues

> **Curriculum Track:** Core Spine (`seq -> param -> loop -> func -> branch -> while -> var`)
> **Age / Tier:** Ages 5–7 (`100%` Zero-Reading Core Finale)
> **Activities:** `12` (`2` 📖 Demos, `4` Core Puzzles, `1` 🔧 Fix-It Bug Hunt, `2` 🎨 Creative Sandboxes, `3` Capstones: `while.A` 🏆, `while.B` 🎨, `while.C` 🎨)
> **Prerequisites:** `branch` (`If / Else If / Else`, `NOT / AND / OR`, `🎛️ $input`, Robot sensors `pathAhead` / `pathLeft` / `pathRight` / `atGoal`, Switchyard `itemDamaged` / `itemColor` / `SCRAP_ITEM` / `SWITCH_LEFT/RIGHT` / `SEND_NEXT`) & `func` (`F1–F3`, LIFO Depot Stacks `1–3`)
> **Unlocks Next:** `var` (`a–z` named registers, counters, & `TELEPORT` coordinates — note `while` introduces **zero** variables and **zero** `TELEPORT`)

---

## 1. Pedagogical Goal

Module `while` concludes the **100% Zero-Reading Early Core (`seq`–`while`)** with three tightly sequenced breakthroughs:

1. **Indefinite Conditional Repetition (`While [condition]`):** Learners transition from hardcoded repeat counts (`Loop ×N`) to condition-driven loops validated across **4 unequal variant maps, queues, or train streams simultaneously**—never knowing exact lengths ahead of time.
2. **FIFO Queue vs. LIFO Stack Intuition (🏗️ Depot `V4`):** Learners discover Depot's animated **First-In, First-Out Queue** (items enter via the **Right-hand Back Entry Funnel**, ride animated belt chevrons, and exit **Left-hand Front Pickup Cradle** in exact arrival order) and contrast it against LIFO **Stacks `1–3`**.
3. **Adaptive Creative Exploration (🐢 LOGO & 🎵 Beat):** Learners unlock `insideCanvas` (`0x28`) and `cursorAtEdge` (`0x2A`) to draw edge-bounce laser webs, ocean waves, border chasers, and boustrophedon snake sweeps before variables or `TELEPORT` exist.

---

## 2. Module Progression (`while.0` – `while.C`)

| ID | Type & Env | Title | One-Concept Focus | Key Blocks & Sensors | Slot Cap / Edit Delta | Link |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **`while.0`** | 📖 🤖 | `While` Loops vs. Fixed Repeat Counts | Scan before stepping (`While (pathAhead)` & `While (NOT atGoal)`) vs. short/crashing `Loop ×N` | `While`, `MOVE_FWD`, `pathAhead`, `NOT`, `atGoal` | Demo (`3` blocks/tab) | [lesson_while_0](./lesson_while_0_while_loops_vs_fixed_repeat.md) |
| **`while.1`** | 🤖 | Conditional Loops (`While`) | Chain two `While` loops across `4` variable-length L-tunnels; resume after `End While` | `While`, `MOVE_FWD`, `TURN_RIGHT`, `pathAhead`, `NOT atGoal` | `7` slots / Delta `4` | [lesson_while_1](./lesson_while_1_conditional_loops_while.md) |
| **`while.2`** | 📖 🏗️ | FIFO Conveyor Queue + `If / Else` | Tab 1: FIFO `Queue → OUT` vs. LIFO `Stack` reversal; Tab 2: `heldColor == [Swatch]` routing | `While`, `stationEmpty [Queue]`, `heldColor == [Swatch]`, `topColor == [Swatch]`, `DEPOT_SEND_OUT` | Demo (`5` & `10` blocks) | [lesson_while_2](./lesson_while_2_fifo_queue_if_else.md) |
| **`while.3`** | 🏗️ | Binary Queue Color Sort | Drain `4` variable-length Red/Blue queues cleanly into `Stack 1` & `Stack 2` | `While (NOT stationEmpty [Queue])`, `DEPOT_GRAB`, `If (heldColor == [Red])`, `Else`, `DEPOT_PLACE` | `10` slots / Delta `5` | [lesson_while_3](./lesson_while_3_binary_queue_color_sort.md) |
| **`while.4`** | 🏗️ | 3-Way Queue & Express Sort | Extend binary sort with `Else If (heldColor == [Blue])` + FIFO `DEPOT_SEND_OUT [OUT]` express lane | `Else If (heldColor == [Blue])`, `DEPOT_SEND_OUT [OUT]` | `13` slots / Delta `5` | [lesson_while_4](./lesson_while_4_3_way_cargo_sort.md) |
| **`while.5`** | 🚂 | Stream Filter & Route | `Main` (`While (hasNextItem) { Call F1 }`) + `F1` (`If (itemDamaged)` + `Else If` color switch) across `4` streams | `While (hasNextItem)`, `Call F1`, `SCRAP_ITEM`, `itemDamaged`, `itemColor == [Red]` | `3 + 9 = 12` / Delta `5` | [lesson_while_5](./lesson_while_5_filter_and_route.md) |
| **`while.6`** | 🎨 🐢 | Adaptive Canvas Bounds | Variable-free edge-bounce chords, zig-zags, & waves stopping at the dashed `600×480` border | `While (insideCanvas)`, `FORWARD`, `BACKWARD`, `ARC_LEFT/RIGHT`, `Call F1` | `14/tab` / `20` total | [lesson_while_6](./lesson_while_6_adaptive_canvas_bounds.md) |
| **`while.7`** | 🎨 🎵 | Edge-Runner Light Trails | Trace `8×8` edges & guarded snake sweeps cleanly with soft edge-clamping & C Major notes | `While (NOT cursorAtEdge)`, `If (NOT cursorAtEdge)`, `CURSOR_STEP`, `CURSOR_TURN`, `$input` | Sandbox (`8–22/tab`) | [lesson_while_7](./lesson_while_7_edge_runner_light_trails.md) |
| **`while.8`** | 🔧 🚂 | Fix-It: Premature `While` Exit | Replace narrow `While (itemColor == [Red])` guard leaving stranded cars (`🚂 ×N left!`) with `hasNextItem` | `While (hasNextItem)`, `itemColor == [Red]`, multi-stream `[1 ✓] [2 ✗]` replay | `9` slots / Delta `1` | [lesson_while_8](./lesson_while_8_fix_premature_while_exit.md) |
| **`while.A`** | 🏆 🤖 | Capstone: Autonomous Maze Rover | Solve `4` distinct spanning-tree mazes (`5×5`–`6×6`) using a `10`-block Right- or Left-Hand wall follower | `While (NOT atGoal)`, `If / Else If / Else`, `pathRight` / `pathLeft`, `pathAhead` | `12` slots / Delta `8` | [capstone_while_a](./capstone_while_a_autonomous_maze_rover.md) |
| **`while.B`** | 🎨 🐢 | Capstone: Laser Frame & Wave Gallery | Combine edge-bounce chords, `While (NOT insideCanvas)` wave returns, & `🎛️ $input` gallery studio | `While (insideCanvas)`, `While (NOT insideCanvas)`, `ARC_*`, `Call F1–F3`, `$input` | `14–26/tab` | [capstone_while_b](./capstone_while_b_laser_frame_wave_gallery.md) |
| **`while.C`** | 🎨 🎵 | Capstone: Edge-Runner Light & Beat Show | Pair border/snake sweeps, `Black (8)` Erase (`⊘`), drums, & `🎛️ $input` multi-mode pad switching | `While (NOT cursorAtEdge)`, `If (NOT cursorAtEdge)`, `Black (8)` Erase, `DRUM_*`, `$input` | `14–26/tab` | [capstone_while_c](./capstone_while_c_edge_runner_light_beat_show.md) |

---

## 3. Unified Platform & Environment Contracts (`while`)

- **100% Zero-Reading Rule (`docs/ui_guidelines.md` §1):** All learner-facing UI—`📖` Demos, Fix-Its, Sandboxes, Condition pills, and Badges—displays **zero prose words**. Adults get concise explanations strictly inside collapsed `<details><summary>📖 Parent / Teacher Tip</summary>` notes.
- **Unified Flat `blocks.length` Counting (`docs/binary_format.md` §2.2):** Every structural block (`While`, `End While`, `If`, `Else If`, `Else`, `End If`, `Loop`, `End Loop`) counts `1` toward `slotCap`. Inserting a `While` or `If` card is **Atomic Pair-Insertion** (`remainingForScope >= 2`). Starters pre-scaffold frames so **Core Puzzle Edit Delta `<= 6–8`** and **Capstone `while.A` Edit Delta `<= 10–12`**.
- **Anti-Bypass Guardrails (`allowRepeatBadges: false` on Puzzles):** Action repeat pills (`×N`) and `Loop ×N` are locked off or beaten by `4` unequal-length simultaneous variants (`[1 ✓] [2 ✗] ...`) so fixed step counts always fail at least one run.
- **Step-Limit Loop Protection (`⏳🔁` `'STEP_LIMIT'`):** When any `While` loop fails to advance state and exceeds `MAX_TOTAL_STEPS`, the Top-Center Pill renders an amber `⏳🔁` loop-clock pill and pulses the looping `While` header amber—visually distinct from wall `💥 COLLISION`.
- **Environment Sync:**
  - **🤖 Robot Grid (`while.0`, `while.1`, `while.A`):** **End-of-Program Goal Evaluation** (`'SUCCESS'` checked upon clean exit standing on satisfied `Goal`); all `while.A` mazes are strict `1`-tile-wide spanning trees solved cleanly by both Right-Hand and Left-Hand `10`-block rules.
  - **🏗️ Depot (`ENV_VERSION_DEPOT_V4`, `while.2–4`):** Uniform `0..9` **Color Rings** only (zero crates, zero `SCRAP`/`itemDamaged`, zero `BackpackHud`, zero `🔒`); Queue shows Right-hand Back Entry Funnel → animated chevrons → Left-hand Front Pickup Cradle; zero-reading swatch predicates `heldColor == [Swatch]` (`0x1B`) & `topColor == [Swatch]` (`0x1C`).
  - **🚂 Switchyard (`while.5`, `while.8`):** `1` Switch (`↙` / `↘`), `4` unequal streams (`2..6` cars), `🚂 ×N left!` amber pulse on premature `While` exit, clickable `[1 ✓] [2 ✗]` stream tabs auto-focusing the first failing stream for `⏮ → ⏭` stepping.
  - **🐢 LOGO (`while.6`, `while.B`):** Nominal `insideCanvas` bounds `[-300..+300] × [-240..+240]` (`600×480px`) with subtle dashed safe frame (`showCanvasBounds: true`), inclusive `1e-6` epsilon, **no `TELEPORT`**, **no variables**.
  - **🎵 Beat & Light (`while.7`, `while.C`):** `(1,1)` East start (`cursorAtEdge == false`), directional reticle visible, **soft edge-clamp + `edgeBonk`** (zero hard `COLLISION`), `Black (8)` = Erase (`⊘`), C Major `1..8`, `PLAY_NOTE` durations `[0.5, 1, 2]`, `SET_BEAT_DELAY` canonical multipliers `[0, 0.25, 0.5, 1, 2, 4]`.
