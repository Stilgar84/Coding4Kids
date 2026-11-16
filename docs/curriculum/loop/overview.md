# Module `loop`: Loops & Nested Loops

> **Parent Links**: [Curriculum Overview](../overview.md) · **Environments**: [Robot Grid](../../envs/robot_grid.md) · [Turtle LOGO](../../envs/turtle_logo.md) · [Beat & Light](../../envs/beat_light.md) · [Depot](../../envs/depot.md) · **UI Contract**: [UI Guidelines](../../ui_guidelines.md) · **Platform Spec**: [Platform Requirements](../../platform_requirements.md)

## Module Summary

Module `loop` introduces bounded repetition (`Loop Start [N]` / `Loop End`) across all four Phase 1–2 playgrounds: **Robot Grid**, **Turtle LOGO**, **Beat & Light** (introducing the 8×8 directional LED cursor), and **Depot** (Toy-Crane Workshop LIFO color-ring stack onboarding). By the end of this module, learners understand single-depth counted loops, surrounding setup/cleanup statements, closed polygon/star loop geometry, matrix cursor traversal, object pickup/drop loops, nested outer×inner loops, off-by-one loop debugging, and alternating LIFO stack unpacking.

## Core Pedagogical & Platform Constraints

- **100% Zero Reading in Code & Canvas**: Every lesson and capstone in `loop` enforces zero on-screen text instructions, zero text labels inside blocks or canvas objects, and zero text prompts (`Zero-Reading` tier). Guidance for adults lives exclusively in collapsible `<details><summary>📖 Parent / Teacher Tip</summary>...</details>` sections and the Help overlay `explanationText`.
- **Closer-Inclusive Flat Block Counting**: Every `Loop Start [N]` and `Loop End` delimiter occupies **1 slot each** (`Loop Start` + `Loop End` = `2 + countFlatBlocks(body)`). Atomic control-pair insertion refuses insertion unless `remainingSlots(scope) >= 2`, and `slotCap.maxTotal` budgets reflect exact flat closer-inclusive counts.
- **No Variables (`allowVariables: false`) & No Custom Functions (`allowRecursion: false`, `[MAIN]` only)**: All repeat counts and parameters use direct numeric/icon pickers (`[×1..×12]` / badge counters) and preserved curvature/trajectory SVG badges (`VisualParamBadges.tsx`).
- **Two-Axis Complexity Guardrails**:
  - **Comprehension Demos (`loop.0`, `loop.3a`, `loop.5a`, `loop.8`)**: `<= 14` flat blocks per tab, visual spotlights (`execution-order`, `loop-counter`, `beat-cursor-reticle`, `depot-stack-top`), and interactive side-by-side tabs.
  - **Practice Lessons (`loop.1`, `loop.2`, `loop.5`, `loop.6`, `loop.9`, `loop.10`, `loop.11`)**: Single-concept Edit-Delta `<= 6–8` (`slotCap` tightened to prevent unrolled bypasses).
  - **Creative Sandboxes & Capstones (`loop.3`, `loop.4`, `loop.7`, `loop.B`, `loop.C`)**: Open-ended remixing with preloaded Starter (`<= 14`) and 3 progressive Variation Cards (Var 1 `<= 14`, Var 2 `~20`, Var 3 `~30`).
- **Retired & Migrated Content**:
  - Historical animation mini-demos (`3.2a`, `3.3a`, `3.4a` — `WAIT`, `SET_INSTANT`, `CLEAR_CANVAS`, `TELEPORT`, `hideTurtle`) are **removed from `loop`** and live in the dedicated side module [`anim`](../anim/overview.md). Static Frame-1 Turtle SVG previews appear in `loop.3`, `loop.7`, and `loop.B`.
  - Buggy legacy `3.3-spinning-star` (missing `WAIT` / single-turn hexagram bug), out-of-bounds `3.4-marquee-chase`, unreturned-plank `3.5`, un-ordered `3.6`, off-center `3.7-star-row`, `3B` starter arc offset, `3C` `0.25` duration leak, and Depot `"Crate"` / `SCRAP` references are **fixed and retired**.

## Curriculum Progression (`loop.0` – `loop.C`)

| ID | Type | Env | Lesson File | Concept | Max / Target Flat Blocks | Legacy Mapping |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **`loop.0`** | 📖 Demo | 🤖 Grid | [`lesson_loop_0_how_loops_work.md`](./lesson_loop_0_how_loops_work.md) | Unrolled vs. `Loop Start` / `Loop End` & live counter | Tab 1: `8` · Tab 2: `5` | `3.0` |
| **`loop.1`** | 🧩 Practice | 🤖 Grid | [`lesson_loop_1_simple_multi_block_loops.md`](./lesson_loop_1_simple_multi_block_loops.md) | Multi-block zig-zag body inside `Loop ×3` | `6` (`cap: 6`) | `3.1` (fixed from 5×5 spiral) |
| **`loop.2`** | 🧩 Practice | 🤖 Grid | [`lesson_loop_2_before_inside_after_loop.md`](./lesson_loop_2_before_inside_after_loop.md) | Setup (Before) + `Loop ×3` (Inside) + Cleanup (After) | `7` (`cap: 7`) | `3.2` |
| **`loop.3`** | 🎨 Sandbox | 🐢 LOGO | [`lesson_loop_3_closed_polygons_and_star_loops.md`](./lesson_loop_3_closed_polygons_and_star_loops.md) | Closed stars, hexagrams, compass woven stars & sunbursts | `5` / `7` / `9` / `18` | `3.3` |
| **`loop.3a`** | 📖 Demo | 🎵 Beat | [`lesson_loop_3a_meet_the_led_cursor.md`](./lesson_loop_3a_meet_the_led_cursor.md) | *(New)* Reveal directional `(1,1)` LED cursor, `CURSOR_STEP`/`TURN`, `SET_BEAT_DELAY` | Tab 1: `6` · Tab 2: `7` | *(New — pre-req for `loop.4`)* |
| **`loop.4`** | 🎨 Sandbox | 🎵 Beat | [`lesson_loop_4_rhythm_loops_chasing_border_leds.md`](./lesson_loop_4_rhythm_loops_chasing_border_leds.md) | Chasing perimeter LEDs & staircase beats with `Loop` | `10` / `11` / `13` / `21` | `3.4` (OOB bugs fixed) |
| **`loop.5`** | 🧩 Practice | 🤖 Grid | [`lesson_loop_5_loops_with_object_workflows.md`](./lesson_loop_5_loops_with_object_workflows.md) | Single-plank 3-river leap (`PICK_UP` + `USE_DROP` loop) | `9` (`cap: 9`) | `3.5` (single-plank loop fix) |
| **`loop.5a`** | 📖 Demo | 🤖 Grid | [`lesson_loop_5a_how_nested_loops_work.md`](./lesson_loop_5a_how_nested_loops_work.md) | *(New)* Inner loop completes fully per outer tick (header counters) | Tab 1: `7` · Tab 2: `11` | *(New — pre-req for `loop.6`)* |
| **`loop.6`** | 🧩 Practice | 🤖 Grid | [`lesson_loop_6_nested_loops.md`](./lesson_loop_6_nested_loops.md) | Nested `Loop ×4 × Loop ×4` clockwise 4-pillar clover patrol | `7` (`cap: 7`) | `3.6` (ordered flags added) |
| **`loop.7`** | 🎨 Sandbox | 🐢 LOGO | [`lesson_loop_7_nested_loop_rosettes.md`](./lesson_loop_7_nested_loop_rosettes.md) | Nested rosettes, arc flowers, pinwheels & Ring of 5 Stars | `9` / `9` / `20` / `12` | `3.7` |
| **`loop.8`** | 📖 Demo | 🏗️ Depot | [`lesson_loop_8_meet_the_depot.md`](./lesson_loop_8_meet_the_depot.md) | LIFO glossy color rings, `DEPOT_MOVE_TO`/`GRAB`/`PLACE`/`SEND_OUT` | `7` / `4` / `6` | `3.8` (`v4` ring terminology) |
| **`loop.9`** | 🧩 Practice | 🏗️ Depot | [`lesson_loop_9_stack_transfer_lifo.md`](./lesson_loop_9_stack_transfer_lifo.md) | Reverse a 4-ring stack (`S1 -> S2`) via `Loop ×4` | `6` (`cap: 6`) | `3.9` |
| **`loop.10`** | 🧩 Practice | 🏗️ Depot | [`lesson_loop_10_alternating_stack_unpack.md`](./lesson_loop_10_alternating_stack_unpack.md) | Alternating dual-stack unpack to sky-chute `OUT` (`Loop ×3`) | `8` (`cap: 8`) | `3.10` |
| **`loop.11`** | 🐛 Fix-It | 🤖 Grid | [`lesson_loop_11_fix_off_by_one_bug.md`](./lesson_loop_11_fix_off_by_one_bug.md) | *(Promoted)* Fix `Loop ×4` crash to `Loop ×3` + post-loop `MOVE_FWD` | `7` (`cap: 8`, Δ `2`) | *(Promoted from legacy lesson 11)* |
| **`loop.A`** | 🏆 Capstone | 🤖 Grid | [`capstone_loop_a_automated_greenhouse.md`](./capstone_loop_a_automated_greenhouse.md) | 9×9 Automated Greenhouse (`4 × 2` inner-loop watering + shuttered `🏁 0/8`) | `10` (`cap: 10`) | `3A` |
| **`loop.B`** | 🎨 Capstone | 🐢 LOGO | [`capstone_loop_b_kaleidoscope_medallion.md`](./capstone_loop_b_kaleidoscope_medallion.md) | Multi-layer medallions, snowflakes, Ferris wheel & golden honeycomb | `14` / `14` / `19` / `16` | `3B` |
| **`loop.C`** | 🎨 Capstone | 🎵 Beat | [`capstone_loop_c_looping_lightshow.md`](./capstone_loop_c_looping_lightshow.md) | Synchronized nested-loop lightshow concerts (variable-free) | `14` / `13` / `19` / `25` | `3C` |
