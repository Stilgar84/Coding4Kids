# Module `var`: Variables, Sensors & Arithmetic — Stage 2 Specification

> **Position in Curriculum DAG:** Follows `while` (`seq` → `param` → `loop` → `func` → `branch` → `while` → **`var`**). Completing **`var`** unlocks **`cmp`** (Comparisons, Division `/` & Modulo `%`), and **`var` → `cmp` → `inter`** (Interactive Input / Arcade). Downstream **`tape` → `anim`** builds directly on **`var.6`** (`TELEPORT` & `$x/$y/$heading`) and **`var.7`** (`F1`/`F2` parameter sweeps on the Beat Matrix).
> **Environments:** Turtle LOGO (`🐢`), Robot Grid (`🤖`), Beat & Light Matrix (`🎵`).
> **Format Contract:** All Stage 2 lesson, capstone, and mastery markdown files in [`docs/curriculum/var/`](./overview.md) are **self-contained specifications**. Unlisted capabilities, sensors, or operators are disabled (`false`).

---

## 1. Syllabus & Legacy ID Mapping (`17` Activities)

| ID | Title | Spec File | Env / Format | Core Concept & Unlock | Flat Cap / Edit Delta | Legacy ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`var.0`** | Variable Memory Boxes | [lesson_var_0_variable_memory_boxes.md](./lesson_var_0_variable_memory_boxes.md) | `🐢` + `🤖` (`📖`) | Unlocks `VAR_ASSIGN` (`a = 100`) & `$tileDial` preview (`2` guided tabs) | `12` / `3` (read-only) | `6.0` |
| **`var.1`** | Variables as Single-Point Constants | [lesson_var_1_variables_single_point_constants.md](./lesson_var_1_variables_single_point_constants.md) | `🐢` (`Creative`) | One-variable edits resize complete shapes (`Starter + 3 Vars`, no `VAR_OP`) | `<= 14–30/tab` (`12–30` total) | `6.1` |
| **`var.2`** | Reading & Recalling a Dial Value | [lesson_var_2_reading_recalling_dial_value.md](./lesson_var_2_reading_recalling_dial_value.md) | `🤖` (`Puzzle`) | Store `d = $tileDial` once; recall `d` across two `×d` corridors (`3` maps) | `8` / Delta `3` | `6.2` *(new)* |
| **`var.3`** | Updating & Combining Variables | [lesson_var_3_updating_a_variable.md](./lesson_var_3_updating_a_variable.md) | `🤖` (`📖`) | Unlocks `VAR_OP` (`+`, `-`, `*`): Tab 1 `a=a+1`, Tab 2 `a=a-1`, Tab 3 `c=a+b, d=b*2` | `8` / `6` / `10` (read-only) | `6.3` |
| **`var.4`** | Stepping Counters & Arithmetic Spirals | [lesson_var_4_stepping_counters_staircases.md](./lesson_var_4_stepping_counters_staircases.md) | `🤖` (`Puzzle`) | Combine `s = $tileDial` with `Loop ×3` & `s = s + 1` expanding coil (`3` maps) | `9` / Delta `3` | `6.4` *(new)* |
| **`var.4a`** | Corridor Beacon Counters | [lesson_var_4a_corridor_beacon_counters.md](./lesson_var_4a_corridor_beacon_counters.md) | `🤖` (`Puzzle`) | `While [pathClearAhead]` + `If [tileColor == Red]` + `c = c + 1` -> `MOVE_FWD [×c]` (`4` maps) | `12` / Delta `3` | `6.4a` *(new)* |
| **`var.5`** | Growing & Shrinking Loops — Spirals | [lesson_var_5_growing_shrinking_loops_spirals.md](./lesson_var_5_growing_shrinking_loops_spirals.md) | `🐢` (`Creative`) | Iterative `a = a + k` & `a = a - k` square, skewed, arc & 2-color spirals (`Starter + 4 Vars`) | `<= 8–13/tab` (`7–13` total) | `6.5` |
| **`var.6`** | `TELEPORT` & Pose Sensors | [lesson_var_6_teleport_and_pose_sensors.md](./lesson_var_6_teleport_and_pose_sensors.md) | `🐢` (`📖`) | Unlocks `TELEPORT [x,y,h]` + `$x`, `$y`, `$heading` bookmark & restore (`2` tabs) | `6–15/tab` (`12–15` total) | `5a` / `6.5a` |
| **`var.7`** | Sweeping Coordinates & Scales | [lesson_var_7_sweeping_coordinates_scales.md](./lesson_var_7_sweeping_coordinates_scales.md) | `🎵` (`Creative`) | Sweeping `(r, c, p)` across `8×8` LED matrix & `1..12` C Major notes (`Starter + 4 Vars`, `F1`/`F2` Siren) | `<= 10–15/tab` (`10–25` total) | `6.6` |
| **`var.8`** | Random Dice (`🎲`) & `$randomColor` | [lesson_var_8_random_dice_and_color.md](./lesson_var_8_random_dice_and_color.md) | `🎵` + `🐢` (`📖`) | Unlocks `🎲` (`$randCoin, D4, D6, D8, D20, rand01`) & `$randomColor` (`2` seeded tabs) | `8–12/tab` (`8–18` total) | `6.6b` *(new)* |
| **`var.9`** | Dice Beat & Light DJ | [lesson_var_9_dice_beat_and_light_dj.md](./lesson_var_9_dice_beat_and_light_dj.md) | `🎵` (`Creative`) | Generative `1..8`/`1..16` C Major DJ melodies, `🎲 Coin` `Loop ×[c]` & `$randomColor` (`Starter + 3 Vars`) | `<= 9–12/tab` (`9–24` total) | `6.7` *(beat)* |
| **`var.10`** | Confetti, Fireworks & Walkers | [lesson_var_10_confetti_fireworks_and_walkers.md](./lesson_var_10_confetti_fireworks_and_walkers.md) | `🐢` (`Creative`) | `TELEPORT` + `🎲` + `$randomColor` generative confetti, walkers, fireworks & mirrors (`Starter + 3 Vars`) | `<= 10–20/tab` (`10–26` total) | `6.7a` *(turtle)* |
| **`var.A`** | Inventory Quartermaster | [capstone_var_a_inventory_quartermaster.md](./capstone_var_a_inventory_quartermaster.md) | `🤖` (`🏆`) | `While` beacon count `c` -> 1-slot `PICK_UP` Energy Cell -> `MOVE_FWD [×c]` -> `USE_DROP` onto Switch (`4` maps) | `15` / Delta `8` | `6A` |
| **`var.B`** | Spiral, Wave & Telemetry Studio | [capstone_var_b_spiral_and_wave_studio.md](./capstone_var_b_spiral_and_wave_studio.md) | `🐢` (`🎨`) | Combine `TELEPORT`, `$x/$y`, `a = a ± k`, `ARC_*`, & `F1..F3` (`Starter + 3 Vars`) | `<= 8–18/tab` (`14–37` total) | `6B` |
| **`var.M1`** | Multi-Dial Vault Combination | [challenge_var_m1_multi_dial_vault.md](./challenge_var_m1_multi_dial_vault.md) | `🤖` (`🔥`) | 0-starter Mastery: read 3 dials `a, b, c`, compute `d = a + b` & `e = b * 2`, 1-slot Switch unlock + `×c` Goal (`4` maps) | `20` / Delta `14` (`14` total) | `C6.1` |
| **`var.M2`** | Counter-Rotating Opposing Spirals | [challenge_var_m2_opposing_spirals.md](./challenge_var_m2_opposing_spirals.md) | `🐢` (`🔥`) | Simultaneous/sequential growing CW vs shrinking CCW spirals + `$x/$y/$heading` bookmarks (`Starter + 3 Targets`) | `<= 18/tab` (`18–33` total) | `C6.2` |

*(Count: **16 child items** = `12` core/bridge lessons `var.0..var.10` + `2` Capstones `var.A, var.B` + `2` Mastery Challenges `var.M1, var.M2`, plus this `overview.md` = `17` files.)*

---

## 2. Cross-Module Design Contracts & Hard Guardrails

1. **Strict Arithmetic Boundary (`+`, `-`, `*` ONLY):**
   - `var.0`–`var.2` unlock **`VAR_ASSIGN`** (`0x07`) ONLY (`VAR_OP` is locked).
   - `var.3`–`var.M2` unlock **`VAR_OP`** (`0x08`) restricted strictly to **`+`**, **`-`**, **`*`**.
   - **Strictly forbidden in `var`:** division (`/`), modulo (`%`), numeric comparisons (`<`, `<=`, `>`, `>=`, `==`, `!=`), and input events (`inter`). Those unlock starting in **`cmp.0`** (`var` → `cmp` → `inter`).
2. **No Inline Expressions (Strict 3-Address Form):**
   - Action blocks, repeat badges, `Loop ×[...]`, and `TELEPORT [x, y, h]` accept **literals (`100`) or single-letter variables (`a..z`)** ONLY — never inline math like `FORWARD [s + 40]` or `TELEPORT [x - 10, 0, 0]`. Always compute into a variable via `VAR_OP` first, then pass that variable to the action slot.
3. **Variable Naming & Typing:**
   - Variables are restricted to single lowercase letters `'a'..'z'` (`allowedVariableNames` listed explicitly per activity so beginners aren't flooded with 26 choices).
   - No color variables (`c = Red`) or string variables exist in `var` (typed/color values start in **`tape.0`**). **`$randomColor`** plugs directly into **`SET_PEN_COLOR [$randomColor]`** (`🐢`) and **`SET_LED_COLOR [$randomColor]`** (`🎵`).
4. **Two-Layer Reading Policy (Guided Co-Pilot Cards Begin Here):**
   - The **`📖` Explanation lessons** (`var.0`, `var.3`, `var.6`, `var.8`) introduce compact **Guided Co-Pilot Cards** (`<= 2` concise child-friendly sentences per tab) in the collapsible banner above the workspace, paired with a collapsed **`<details><summary>📖 Parent / Teacher Tip</summary>`** block.
   - All other puzzles (`var.2`, `var.4`, `var.4a`, `var.A`, `var.M1`) and creative sandboxes (`var.1`, `var.5`, `var.7`, `var.9`, `var.10`, `var.B`, `var.M2`) obey the **Zero-Reading Rule** (`0` learner prose in UI).
5. **Unified Workspace Density (`blocks.length` Flat Block Accounting):**
   - Every control delimiter (`LOOP_START` + `LOOP_END`, `IF` + `END_IF`, `WHILE` + `END_WHILE`, `ELSE` = `+1`) counts toward `slotCap`.
   - **Edit-Delta Guardrail:** Puzzles (`var.2`, `var.4`, `var.4a`) keep `Edit Delta <= 8` (`slotCap <= 12`). Capstone `var.A` keeps `Edit Delta = 8` (`<= 12`). Mastery Challenges (`var.M1`, `var.M2`) stay `<= 20/tab` (`<= 50` total) and supply **both** optional Partial `?` Help (`partialHelp`) and Full `referenceSolution`.
   - **Sandboxes (`var.1..var.10`, `var.B`):** Starter & Var 1 `<= 14/tab` (`<= 24` total), Var 2 `<= 20/tab` (`<= 40` total), Var 3 `<= 30/tab` (`<= 60` total).
6. **Environment & Cross-Module Guarantees:**
   - **🐢 Turtle LOGO (`docs/envs/turtle_logo.md`):** Heading `0°` = North (`dy < 0`); `$y` = `Math.round(state.robot.y)`; **every LOGO SVG has `inkMaxSpan >= 160px` (`scaleWarning: false`)** per `specs/v2/logo_canvas_and_drawing_scale_plan.md` (far larger than the `40×45px` turtle); `TELEPORT` arrives with pen state preserved (wrap with `PEN_UP`/`PEN_DOWN` when jumping cleanly).
   - **🤖 Robot Grid (`docs/envs/robot_grid.md`):** Strict **1-slot shoulder gripper** (`BackpackHud` retired); circular rotary `tileDial` (`1..20`, `0` if none); floor beacons `tileColor == [Red|Blue|Green|Yellow]`; Floor Switches (`isPressed = hasCrateOnTile || hasRobotOnTile`) controlling **shuttered `🏁 k/N` goals (zero `🔒` padlock gates)**; zero `itemDamaged`; `strictInteractionCollision: true` and `requireEmptyBackpackAtGoal: true` on carry missions (`var.A`, `var.M1`).
   - **🎵 Beat Matrix (`docs/envs/beat_light.md`):** `8×8` LED pad (`1..8`); out-of-bounds `LIGHT_*` (`<1`/`>8`) cleanly no-op (`var.7` Var 4); `PLAY_NOTE` uses **C Major** (`1..8` `C4..C5`, **`1..16` `C4..D6` in `var`+**, zero `"pentatonic"`); `SET_LED_COLOR [Black]` = `⊘` Erase/Off; **Beat cursor reticle hidden (`visible: false`)** across all `var` Beat lessons since cursor blocks are absent; **`var.7` Variation 3 (`Siren`) explicitly uses `F1` (`+1`) & `F2` (`-1`) across `1 -> 8 -> 1`**, honoring `anim.6`'s prerequisite contract; **`Loop ×[0]`** (e.g. `c = $randCoin`) safely runs `0` times (`var.9`).
