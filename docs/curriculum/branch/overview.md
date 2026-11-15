# Module `branch` — Conditional Logic (`If / Else / Else-If / $input`)

> **Stage 2 Status:** Complete Curriculum Specification (`overview.md` + `21` activity specs + `11` deterministic static LOGO SVGs under [`./svg/`](./svg/)).
> **Workspace Rule (Seq–While):** **100% Zero-Reading** in learner-facing UI (`0` words of body prose; icons, color badges, arrows, counters, and `[1 ✓] [2 ✗]` map pips only). Every pedagogical rationale in these docs uses collapsed `<details><summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>` blocks.

---

## 1. Module Goals & Core Concepts

Module `branch` introduces **runtime decision-making**: checking live environment sensors (`itemHere`, `tileColor`, `pathLeft`, `pathRight`, `pathAhead`, `carryingItem`, `itemColor`, `itemIcon`, `itemDamaged`, and reactive `$input`) so one fixed program handles multiple maps, conveyor streams, and interactive moods.

1. **One-Concept-Per-Lesson (`If` → Switchyard → `Else` → Directional Sensors → Boolean Combinators → Fix-It Bug Hunt → `Else-If` → `$input`)**:
   - **No `While` / No `hasNextItem` yet:** Every Switchyard stream and Robot Grid corridor in `branch` has a **fixed, equal length `N`** across all variants so learners use familiar `Loop ×N` (`hasNextItem` and open-ended `While` wait for Module [`while`](../while/overview.md)).
   - **Switchyard Track Switching & `SCRAP_ITEM`:** Learners first master **1-switch Y-forks** (`[A]` badge omitted; `↙` Left / `↘` Right docks) with **`SWITCH_LEFT` / `SWITCH_RIGHT`** + **`SEND_NEXT`** (zero double-consume bugs) in `branch.2–3`, then unlock **`ELSE` + `itemDamaged` + `SCRAP_ITEM`** in `branch.4` Tab 2 and `branch.5a`, before graduating to **2-switch, 3-dock trees** (`[A]`/`[B]` badges → Docks `A`/`B`/`C`) in `branch.8a`, `branch.8`, and `branch.A`.
   - **1-Slot Shoulder Gripper (`carryingItem`):** Robot Grid uses the physical `1`-slot shoulder gripper icon (no `BackpackHud` / `🎒` badge, no `🔒` lock emoji on `🏁 k/N` goals).
   - **Boolean Combinators & Sequential-If Fix-It:** `branch.7` teaches `NOT` / `AND` / `OR`; **`branch.9` (`🔧`)** hunts down the classic sequential-`IF` state-mutation bug; `branch.7a` & `branch.7b` drill `AND`/`NOT` and `OR` independently.
   - **Reactive `$input` Sandbox:** `branch.10a`, `branch.10`, `branch.B`, and consolidated **`branch.C`** (`🎨 🎵` Interactive `$input` Jukebox, folding in `branch.11` *(Idea)*) turn `$input` into live multi-scene studios with 100% crisp SVG/Beat feedback (`scaleWarning: false`, `inkMaxSpan >= 160`, Beat pitches `1..8` & coords `1..8`).

---

## 2. Legacy M5 Alias & Cross-Module Architecture

| Legacy ID | Stage 2 Slug | Action / Notes |
|---|---|---|
| `5.0` | `branch.0` | Unused turn blocks removed from palette; pure `[MOVE_FWD, PICK_UP]` + `IF (itemHere)`. |
| `5.1` | `branch.1` | Multi-map corridor; 3 star positions beat hardcoded steps. |
| `5.2` | `branch.2` | 1-switch Track Switching (`SWITCH_LEFT`/`SWITCH_RIGHT` + `SEND_NEXT`), zero `SCRAP_ITEM`. |
| `5.3` | `branch.3` | Renamed `hazard_filtering` → `emblem_routing` (`itemIcon` sorting, zero `SCRAP_ITEM`). |
| `5.4` | `branch.4` | Dual-tab `📖`: Tab 1 Grid `IF/ELSE` (`"RED"` uppercase fix), Tab 2 Switchyard `SCRAP_ITEM` debut. |
| `5.5` | `branch.5` | Binary icon sorting (`Battery` vs others) using `IF/ELSE`. |
| *(new)* | `branch.5a` | Dedicated **Hazard Filtering** (`itemDamaged` + `SCRAP_ITEM`, `1`-switch `N = 5`). |
| `5.6` | `branch.6` | `📖` Spatial Directional Sensors (`pathLeft` / `pathRight`). |
| *(new)* | `branch.6a` | **Floor Beacon Forks** (`5×5` 3-branch tree using `tileColor`). |
| *(new)* | `branch.6b` | **Side Corridor Forks** (`5×5` 3-branch tree using `pathLeft`/`pathRight`, incl. `SOUTH` start). |
| `5.7` | `branch.7` | `📖` Boolean Combinators (`NOT`, `AND`, `OR`) Dual-Env Demo. |
| *(new)* | `branch.9` | `🔧` **Fix-It Bug Hunt** (Order 12 — sequential `IF` heading-mutation bug → `IF/ELSE`). |
| *(new)* | `branch.7a` | **Compound Safety (`AND` & `NOT`)** — Key + Amber Gate vault (`requireAllItemsCollected: false`). |
| *(new)* | `branch.7b` | **Multi-Match (`OR`)** — Dual-emblem bin consolidation (`Battery OR Crystal`). |
| *(new)* | `branch.8a` | `📖` **Meet `ELSE IF` + Two Switches (`[A]` & `[B]`)** (`3`-Dock Y-tree). |
| `5.8` | `branch.8` | Chained `IF / ELSE IF / ELSE` 3-Dock Color & Icon Router (`N = 6`). |
| *(new)* | `branch.10a` | `🎛️` **Meet `$input`** (`2`-Tab LOGO selector demo, `[MAIN]` only). |
| `5.10` | `branch.10` | `🎨` **Mood Mandala (`$input`)** (`4` scopes `[MAIN, F1, F2, F3]`, Starter + `3` Variations). |
| `5A` | `branch.A` | `🏆` **Hazard & Priority Router** (`switchyard`, `[MAIN, F1]`, `N = 8`, 2 switches + `SCRAP_ITEM`). |
| *(new)* | `branch.B` | `🏆 🎨` **Interactive Scene Studio (`$input`)** (`turtle`, `[MAIN, F1, F2, F3]`, Starter + `3` Variations). |
| `5.11 *(Idea)*` + `5C` | `branch.C` | Consolidated **`🏆 🎨 🎵` Interactive `$input` Jukebox** (`beat`, `[MAIN, F1, F2, F3]`, `8×8` Grid + `C4–C5`). |

---

## 3. Sequence & Scope / Budget Curve

| Order | Slug | Type | Env | Scopes Allowed | Core Concept | Slot Cap (Max/Tab) | Edit Delta | File |
|---|---|---|---|---|---|---|---|---|
| 1 | `branch.0` | `📖` Demo | Grid | `[MAIN]` | Multi-Map `IF (itemHere)` | `7` | `0` (Read-Only) | [lesson_branch_0_sensors_if_multi_map.md](./lesson_branch_0_sensors_if_multi_map.md) |
| 2 | `branch.1` | Lesson | Grid | `[MAIN]` | Sensing & Simple `IF (itemHere)` | `7` | `3` | [lesson_branch_1_sensing_and_simple_if.md](./lesson_branch_1_sensing_and_simple_if.md) |
| 3 | `branch.2` | `📖` Demo | Switchyard | `[MAIN]` | Meet Switchyard (`SWITCH_*` + `SEND_NEXT`) | `8` | `0` (Read-Only) | [lesson_branch_2_meet_the_switchyard.md](./lesson_branch_2_meet_the_switchyard.md) |
| 4 | `branch.3` | Lesson | Switchyard | `[MAIN]` | Emblem Routing (`itemIcon`, `1` Switch) | `8` | `3` | [lesson_branch_3_switchyard_warmup_emblem_routing.md](./lesson_branch_3_switchyard_warmup_emblem_routing.md) |
| 5 | `branch.4` | `📖` Demo | Grid / Switchyard | `[MAIN]` | Meet `ELSE` & `SCRAP_ITEM` (`💥`) | `9` | `0` (Read-Only) | [lesson_branch_4_two_way_decisions_if_else.md](./lesson_branch_4_two_way_decisions_if_else.md) |
| 6 | `branch.5` | Lesson | Switchyard | `[MAIN]` | Binary `IF / ELSE` Icon Sorting | `8` | `4` | [lesson_branch_5_binary_if_else_sorting.md](./lesson_branch_5_binary_if_else_sorting.md) |
| 7 | `branch.5a` | Lesson | Switchyard | `[MAIN]` | Hazard Filtering (`itemDamaged` + `SCRAP_ITEM`) | `12` | `4` | [lesson_branch_5a_hazard_filtering.md](./lesson_branch_5a_hazard_filtering.md) |
| 8 | `branch.6` | `📖` Demo | Grid | `[MAIN]` | Spatial Directional Sensors (`pathLeft`/`Right`) | `8` | `0` (Read-Only) | [lesson_branch_6_spatial_if_else_directional_sensors.md](./lesson_branch_6_spatial_if_else_directional_sensors.md) |
| 9 | `branch.6a` | Lesson | Grid | `[MAIN]` | Floor Beacon Forks (`tileColor`) | `9` | `5` | [lesson_branch_6a_floor_beacon_forks.md](./lesson_branch_6a_floor_beacon_forks.md) |
| 10 | `branch.6b` | Lesson | Grid | `[MAIN]` | Side Corridor Forks (`pathLeft`/`pathRight`) | `9` | `5` | [lesson_branch_6b_side_corridor_forks.md](./lesson_branch_6b_side_corridor_forks.md) |
| 11 | `branch.7` | `📖` Demo | Grid / Switchyard | `[MAIN]` | Boolean Combinators (`NOT`, `AND`, `OR`) | `10` | `0` (Read-Only) | [lesson_branch_7_boolean_combinators.md](./lesson_branch_7_boolean_combinators.md) |
| 12 | `branch.9` | `🔧` Fix-It | Grid | `[MAIN]` | Fix Sequential-`IF` Bug Hunt (`IF/ELSE`) | `9` | `2` | [lesson_branch_9_fix_sequential_if_bug_hunt.md](./lesson_branch_9_fix_sequential_if_bug_hunt.md) |
| 13 | `branch.7a` | Lesson | Grid | `[MAIN]` | Compound Safety (`AND` & `NOT`, Amber Key) | `9` | `4` | [lesson_branch_7a_compound_safety_and_not.md](./lesson_branch_7a_compound_safety_and_not.md) |
| 14 | `branch.7b` | Lesson | Switchyard | `[MAIN]` | Multi-Match (`OR` Emblem Consolidation) | `9` | `5` | [lesson_branch_7b_multi_match_or.md](./lesson_branch_7b_multi_match_or.md) |
| 15 | `branch.8a` | `📖` Demo | Switchyard | `[MAIN]` | Meet `ELSE IF` + Two Switches (`[A]`/`[B]`) | `13` | `0` (Read-Only) | [lesson_branch_8a_meet_else_if_two_switches.md](./lesson_branch_8a_meet_else_if_two_switches.md) |
| 16 | `branch.8` | Lesson | Switchyard | `[MAIN]` | Chained 3-Dock Router (`IF / ELSE IF / ELSE`) | `13` | `6` | [lesson_branch_8_chained_multi_way_routing.md](./lesson_branch_8_chained_multi_way_routing.md) |
| 17 | `branch.10a` | `📖` Demo | Turtle | `[MAIN]` | Meet Scene Selector (`$input`) | `20` | `0` (Read-Only) | [lesson_branch_10a_meet_scene_selector_input.md](./lesson_branch_10a_meet_scene_selector_input.md) |
| 18 | `branch.10` | `🎨` Sandbox | Turtle | `[MAIN, F1..F3]` | Mood Mandala (`$input` + Variation Cards) | `22/tab` | Free (`1`+ edit) | [lesson_branch_10_mood_mandala_input.md](./lesson_branch_10_mood_mandala_input.md) |
| 19 | `branch.A` | `🏆` Capstone | Switchyard | `[MAIN, F1]` | Hazard & Priority 3-Dock Router | `10/tab` | `10` | [capstone_branch_a_hazard_priority_router.md](./capstone_branch_a_hazard_priority_router.md) |
| 20 | `branch.B` | `🏆 🎨` Capstone | Turtle | `[MAIN, F1..F3]` | Interactive Scene Studio (`$input`) | `22/tab` | Free | [capstone_branch_b_interactive_scene_studio.md](./capstone_branch_b_interactive_scene_studio.md) |
| 21 | `branch.C` | `🏆 🎨 🎵` Capstone | Beat | `[MAIN, F1..F3]` | Interactive `$input` Jukebox (Consolidated) | `22/tab` | Free | [capstone_branch_c_interactive_input_jukebox.md](./capstone_branch_c_interactive_input_jukebox.md) |

---

## 4. Verified Static LOGO SVG Gallery (`docs/curriculum/branch/svg/`)

Every Turtle LOGO visual preview in `branch.10a`, `branch.10`, and `branch.B` is rendered deterministically at crisp scale (`inkMaxSpan >= 180`, zero `scaleWarning`, zero `<animate>` tags):

| SVG File | Activity / State | Preview `$input` | `inkMaxSpan` | Flat Blocks |
|---|---|---|---|---|
| [`branch_10a_tab1_input1.svg`](./svg/branch_10a_tab1_input1.svg) | `branch.10a` Tab 1 | `1` | `180px` | `MAIN: 9` |
| [`branch_10a_tab2_input2.svg`](./svg/branch_10a_tab2_input2.svg) | `branch.10a` Tab 2 (Cyan Hex) | `2` | `200px` | `MAIN: 19` |
| [`branch_10a_tab2_input3.svg`](./svg/branch_10a_tab2_input3.svg) | `branch.10a` Tab 2 (Purple Star) | `3` | `190px` | `MAIN: 19` |
| [`branch_10_starter.svg`](./svg/branch_10_starter.svg) | `branch.10` Starter | `1` | `200px` | `MAIN: 13, F1: 6, F2: 7, F3: 8` |
| [`branch_10_var1_stickers.svg`](./svg/branch_10_var1_stickers.svg) | `branch.10` Var 1 (Stickers) | `3` | `247px` | `MAIN: 14, F1: 6, F2: 10, F3: 13` |
| [`branch_10_var2_shared_frame.svg`](./svg/branch_10_var2_shared_frame.svg) | `branch.10` Var 2 (Shared Frame) | `2` | `385px` | `MAIN: 20, F1: 13, F2: 5, F3: 10` |
| [`branch_10_var3_swatch_kaleidoscope.svg`](./svg/branch_10_var3_swatch_kaleidoscope.svg) | `branch.10` Var 3 (Color Swatches) | `1` (Red) | `340px` | `MAIN: 13, F1: 12, F2: 6, F3: 9` |
| [`branch_b_starter.svg`](./svg/branch_b_starter.svg) | `branch.B` Starter | `1` | `300px` | `MAIN: 13, F1: 12, F2: 5, F3: 8` |
| [`branch_b_var1_kaleidoscope.svg`](./svg/branch_b_var1_kaleidoscope.svg) | `branch.B` Var 1 (Kaleidoscope) | `2` | `400px` | `MAIN: 8, F1: 9, F2: 7, F3: 7` |
| [`branch_b_var2_mood_dial.svg`](./svg/branch_b_var2_mood_dial.svg) | `branch.B` Var 2 (6-Mood Dial) | `5` | `360px` | `MAIN: 16, F1: 13, F2: 6, F3: 6` |
| [`branch_b_var3_origami_mandala.svg`](./svg/branch_b_var3_origami_mandala.svg) | `branch.B` Var 3 (Stencil Mandala) | `3` | `350px` | `MAIN: 7, F1: 13, F2: 13, F3: 6` |
