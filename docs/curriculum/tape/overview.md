# Module 8: Sparse Memory Tape & Typed Color Data (`tape`)

> **Concept:** Linear & Random-Access Memory (`Tape`), Bounds Checking, and Dynamic Data Types (`number` vs. `color`)  
> **Stage 2 Status:** Verified static SVGs (`16/16` LOGO SVGs), Puzzle Traces (`tape.6`, `tape.7`, `tape.8`, `tape.9`, `tape.A`), Beat/Explanation ASTs, and Unified Closer-Inclusive Flat Block Budgets  
> **Environments:** 🐢 Turtle LOGO · 🎵 Beat & Light · 🏗️ Cargo Depot · 🤖 Robot Grid  
> **Prerequisites:** `cmp` (`seq` → `param` → `loop` → `func` → `branch` → `while` → `var` → `cmp`)  
> **Unlocks:** Core Spine `sort` (`Sorting & Searching`) · Side Module `anim` (`tape ==> anim`, feeding `anim.7`–`anim.9` & `anim.8a`) · `🔥 Mastery Set tape`

---

## DAG Dependencies & Cross-Module Contract

```text
cmp ──► tape ──┬──► sort      (uses dynamic TAPE_SEEK [i], Depot $cellValue, TAPE_STEP [LEFT], $cellEmpty)
               ├──► anim      (tape ==> anim unlocked cleanly after tape.0–tape.4a)
               └──► args*     (reuses $cellEmpty sentinels, TAPE_STEP [LEFT], color == color, TAPE_WRITE [CLEAR])
```

- **Typed Value System Intro (`tape.0`):** `color` (`0..9` swatch palette) is introduced as a first-class `TypedValue` alongside `number`. Extracting a `color` cell via `$cellValue`, extracting a `number`/empty `∅` cell via `$cellColor`, or feeding a `color` variable into a `#` numeric slot triggers a clean **Watch Tray `TYPE_ERROR` bounce** (halting safely). Swatch comparison predicates (`$cellColor == / != [Swatch]`) safely evaluate `false` / `true` on numeric or `∅` cells without crashing sparse scans.
- **Unified Closer-Inclusive Block Counting:** Every block inside `MAIN` and `F1..F3` counts flatly (`blocks.length`), including structural closers (`End Loop` / `End While` / `End If` via Atomic Pair-Insertion `[□][□]`; `Loop`+`End Loop` = `2 + body`; `If`+`End If` = `2 + then + sum(ElseIf: 1 + body) + (Else: 1 + else)`).
- **Reserved Iconography:**
  - `🛡️` **Crystal Shield** marks read-only / immutable Tape cells (`tape.5`–`tape.7`); `🔒` is never used in `tape` (reserved exclusively for `conc`).
  - `🎵 #N` marks the Beat & Light step/beat counter (`⏱️` is reserved for `sort`/`conc`).
  - `Black` is color index `8` (`#0f172a` `⊘` = active dark erase on LED/ink), distinct from `White` (`9`, `#ffffff`) and `∅` (`undefined` empty sparse cell / transparent skip in `STAMP_FROM_TAPE`).

---

## Lesson & Capstone Sequence (`15` Beats: `tape.0`–`tape.9` + `tape.A`–`tape.C`)

| ID | Format | Env | One-Concept Goal & Spec Summary | Flat Block Budget | Link |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **`tape.0`** | 📖 Explanation | 🐢 | Introduce Tape Dock (`1..8` of `10,000`), `TAPE_SEEK`, `TAPE_STEP [RIGHT]`, `$cellValue`, `$cellColor`, and `TYPE_ERROR` | `14 / 10 / 11` (3 tabs) | [lesson_tape_0_meet_memory_tape_and_colors.md](./lesson_tape_0_meet_memory_tape_and_colors.md) |
| **`tape.1`** | 🎨 Sandbox | 🐢 | Draw variable-height city skylines from numeric Tape cells (`0°` North `F1` fix + `TELEPORT` framing) | `9 + 8 = 17` (`slotCap: 24`) | [lesson_tape_1_skyline_generator.md](./lesson_tape_1_skyline_generator.md) |
| **`tape.2`** | 🎨 Sandbox | 🐢 | Paint multi-color radial bursts using `$cellColor` swatches (`White` explicit width cutout + Nautilus + Pinwheel) | `10` (`slotCap: 30`) | [lesson_tape_2_rainbow_burst.md](./lesson_tape_2_rainbow_burst.md) |
| **`tape.3`** | 🎨 Sandbox | 🎵 | Sequenced drum groove from Tape colors via `$cellColor == [Swatch]` and `1`-beat-locked `WAIT_BEAT [1]` rests | `8 + 16 = 24` (`slotCap: 40`) | [lesson_tape_3_color_drum_sequencer.md](./lesson_tape_3_color_drum_sequencer.md) |
| **`tape.4`** | 🎨 Sandbox | 🎵 | Live scale melody + LED piano-roll visualizer (`r = 9 - a`) fixing repeated-note freezes (`0`/`9` range rules) | `13` (`slotCap: 22`) | [lesson_tape_4_scale_melody_and_led_stripes.md](./lesson_tape_4_scale_melody_and_led_stripes.md) |
| **`tape.4a`** | 🎨 Sandbox | 🎵 | Introduce **`STAMP_FROM_TAPE` (`📼→🟦`)**, `8×8 = 64`-cell sprite layout, `∅` transparent skip vs `Black` (`8` `⊘`) erase, `🟦 8×8 Sprite View` popover | `8` (`slotCap: 20`) | [lesson_tape_4a_custom_tape_sprite_stamp.md](./lesson_tape_4a_custom_tape_sprite_stamp.md) |
| **`tape.5`** | 📖 Explanation | 🏗️ | Electronic `TapeDock` (`Top Dock`, `🛡️` immutable cells), `TAPE_SEEK`, safe `$headPos < $tapeLength` search & guarded full scan | `2 / 4 / 10` (3 tabs) | [lesson_tape_5_scanning_and_tape_bounds.md](./lesson_tape_5_scanning_and_tape_bounds.md) |
| **`tape.6`** | 🧩 Puzzle | 🏗️ | Locate first `Green` (`🟢`) cell across **4 variants** (incl. index `1` & boundary `8`) stopping with `targetHeadPos` on `🟢` | `4` (`slotCap: 6`) | [lesson_tape_6_find_green_beacon.md](./lesson_tape_6_find_green_beacon.md) |
| **`tape.7`** | 🧩 Puzzle | 🏗️ | Count all `Red` (`🔴`) cells across **4 variants** (`0` Reds `Loop [0]` no-op & cell `8` boundary) and ship `exactOutputCount` crates | `10 + 6 = 16` (`slotCap: 18`) | [lesson_tape_7_count_the_reds.md](./lesson_tape_7_count_the_reds.md) |
| **`tape.7a`** | 📖 Explanation | 🏗️ | Introduce **`TAPE_WRITE`**, **`TAPE_WRITE [CLEAR]`**, **`$cellEmpty` (`Head + ∅`)**, **`TAPE_STEP [LEFT]`**, and Depot numeric `$cellValue` + `TAPE_SEEK [i]` | `10 / 8 / 10` (3 tabs) | [lesson_tape_7a_writing_and_stepping_on_tape.md](./lesson_tape_7a_writing_and_stepping_on_tape.md) |
| **`tape.8`** | 🧩 Puzzle | 🏗️ | Drain variable-length FIFO `QUEUE` (`4..7` items) into `8`-cell Tape via digital `TAPE_WRITE [$heldColor]` + `DEPOT_SEND_OUT` | `8` (`slotCap: 10`) | [lesson_tape_8_record_queue_to_tape.md](./lesson_tape_8_record_queue_to_tape.md) |
| **`tape.9`** | 🔧 Fix-It | 🤖 | Debug fencepost cell-`9` `COLLISION` and sparse `∅` `TYPE_ERROR` on a beacon-guided Robot patrol (`2`-block delta across 4 variants) | `12` (`slotCap: 14`, starter `10`) | [lesson_tape_9_fix_fencepost_tape_bug.md](./lesson_tape_9_fix_fencepost_tape_bug.md) |
| **`tape.A`** | 🏆 Capstone | 🏗️ | **The Color Histogram:** Survey `8`-cell color manifest (`Red`/`Blue`/`Green`/`Black` skip) and sort `8` neutral crates to Stacks `1..3` | `6 + 12 = 18` (`slotCap: 20`, delta `12`) | [capstone_tape_a_color_histogram.md](./capstone_tape_a_color_histogram.md) |
| **`tape.B`** | 🏆 Capstone | 🐢 | **Tape Art Studio:** Rhombus `(len, angle)` pairs + Mountains (`30°` net-`0°`), Mixed `(Color, Length, Angle)`, Bolt, `🎲` `TAPE_WRITE` Kaleidoscope | `9` (`slotCap: 36`) | [capstone_tape_b_tape_art_studio.md](./capstone_tape_b_tape_art_studio.md) |
| **`tape.C`** | 🏆 Capstone | 🎵 | **Step Sequencer Studio:** Dual-region `1..8` colors + `9..16` pitches (`6`-block `MAIN`, `r = 9 - p` contour, `STAMP_FROM_TAPE` mascot, `1`-beat D&B) | `6 + 10 = 16` (`slotCap: 24`) | [capstone_tape_c_step_sequencer_studio.md](./capstone_tape_c_step_sequencer_studio.md) |

---

## Module Capability Matrix

- **Variables & Math:** Single-letter variables `a`–`z` ONLY; strict 3-address `VAR_OP` (`a = b op c`, zero inline expressions in conditions or action parameters).
- **Tape Commands & Sensors (`sim_core.mjs` / `platform_requirements.md` §1.2):**
  - Actions: `TAPE_SEEK [index/var]`, `TAPE_STEP [RIGHT | LEFT]`, `TAPE_WRITE [val | CLEAR]`, plus Beat-only `STAMP_FROM_TAPE [startIndex]` (`0x1F`).
  - Sensors: `$headPos`, `$tapeLength` (`10,000` in Sandboxes; finite `8` in Puzzles/Explanations), `$cellValue` (numeric read; `TYPE_ERROR` on color/empty), `$cellColor` (color read; `TYPE_ERROR` on number/empty), `$cellEmpty` (`1` when cell is `∅`).
- **Two-Layer Reading Policy:**
  - **Kid Layer:** Pure visual icons (`📼`, `◀`, `▶`, `🎯`, `🖍️`, `🛡️`, `🟦 8×8`), swatch pickers, bold high-contrast Turtle paths (`inkMaxSpan >= 180px`), and `Guided Co-Pilot Card` prompts (`<= 2` sentences).
  - **Parent / Teacher Tip Layer:** Collapsed inside `<details><summary>📖 Parent / Teacher Tip</summary>` explaining type safety, fencepost invariants (`$headPos < $tapeLength` vs `Loop [$tapeLength]`), and curriculum progression into `sort` and `anim`.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Module `tape` bridges fixed variables (`var`, `cmp`) to data structures (`sort`, `args`). Encourage learners to keep the top **Tape Dock** visible during early runs: watching the read/write head step cell by cell (`$headPos`) while a typed variable bounces off an incompatible slot (`TYPE_ERROR`) builds the exact mental model needed for array indexing and bounds checking later.

</details>
