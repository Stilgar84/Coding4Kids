# Module `param`: Parameters & World Objects

- **Module Slug:** `param` (Legacy Module ID: `module-2`)
- **Target Age & Reading Rule:** Ages 5–7 (`100% Zero-Reading Rule` — zero on-screen prose for learners; all parent/teacher notes live strictly inside collapsible `<details>` tips and teacher metadata)
- **Prerequisite:** [Module `seq`](../seq/overview.md) (sequences, Grid motion/turns, Flags, Step Debug, Turtle `PEN_UP`/`PEN_DOWN`, Beat Tier 1 drums/chime/`CLEAR_LEDS`)
- **Unlocks For:** [Module `loop`](../loop/overview.md) (`loop.3a` -> `loop.4` Beat Cursor, `loop.5` Plank Loops, `loop.A` Crate Switches) and [Module `func`](../func/overview.md)

## Module Cognitive Goal & Guardrails

Module `param` transitions learners from parameterless, one-cell-at-a-time instruction blocks into **parameterized actions** (repeat badges `×2..×9`, distances, trajectory-based turn angles, persistent pen colors/widths + `White` eraser, arc radius + angle curves, musical note pitch + duration, Beat LED row/column/pixel painting + presets, and `SET_BEAT_DELAY` speed control) and **stateful Robot Grid world objects** (**Keys + matching Gates**, **1-cell-ahead retrievable Planks**, and **Current-tile weighted Floor-Switch Crates**).

- **Counting Rule (`blocks.length`):** Every action block in `param` is a flat leaf block (`1 block = 1 tray slot = 1` in `blocks.length`). Zero control blocks (`Loop`, `If`, `While`) or helper scopes (`F1`–`F3`) appear in `param`.
- **Early Puzzle Budgets (`docs/curriculum/overview.md` §3 Row 1):**
  - Standard puzzles (`param.1`, `param.8`, `param.10`): `≤ 8 blocks` (`Edit Delta ≤ 6–8`); `param.9` allows `9` slots with `2` pre-filled starter blocks (`Edit Delta = 7 ≤ 8`).
  - Early Puzzle Capstone (`param.A`): `≤ 10 blocks` (`9` canonical blocks in a `10`-slot tray; `Edit Delta ≤ 6–8` with scaffold or `9 ≤ 10–12` from blank).
  - Straightaway Grid Sizes: `5×5` to `6×5` corridors so `×4` / `×5` repeat badges solve runs that unrolled `seq` code (`13–16` blocks) cannot fit in the tray.
- **Creative Sandbox Budgets:**
  - **Starter & Variation 1:** `≤ 14 blocks/tab`
  - **Variation 2:** `~20 blocks/tab` (`≤ 22`)
  - **Variation 3+:** `≤ 30 blocks/tab`
- **Explicit Boundaries (`param` DOES NOT introduce):**
  - ❌ `TELEPORT` (deferred to `var.5a` per [`docs/envs/turtle_logo.md`](../../envs/turtle_logo.md))
  - ❌ `CURSOR_STEP`, `CURSOR_TURN`, or Beat `(1, 1)` cursor reticle (reticle stays hidden throughout `seq`–`param`; deferred to `loop.3a` -> `loop.4` per [`docs/envs/beat_light.md`](../../envs/beat_light.md))
  - ❌ `BackpackHud` (`🎒` retired; carried items render directly in the robot's upper-right shoulder gripper per [`docs/ui_guidelines.md`](../../ui_guidelines.md))
  - ❌ Variables, Loops, Conditionals, or Subroutines (`F1`–`F3`)

## Canonical Sequence & Lesson Index

| Play Order | ID | Legacy ID | Format | Env | File & Title | Core Single Concept | Budget / Tray |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| 1 | `param.0` | *New* | `📖` Explanation | 🤖 | [lesson_param_0_parameters_intro.md](./lesson_param_0_parameters_intro.md) | Comparing 5 separate blocks vs. `1` block + `[×5]` badge | 2 tabs (`5` vs `1`) |
| 2 | `param.1` | `2.1` | Puzzle | 🤖 | [lesson_param_1_action_repeat_badges.md](./lesson_param_1_action_repeat_badges.md) | Compressing U-corridor runs inside a 5-slot tray (`×2..×9`) | `5 / 5` slots (`Edit Delta 5`) |
| 3 | `param.2` | `2.2` | Sandbox | 🐢 | [lesson_param_2_length_and_turn_angles.md](./lesson_param_2_length_and_turn_angles.md) | Custom lengths + trajectory CCW/CW turn angle badges | Starter `6`; Vars `8–12` |
| 4 | `param.3` | `2.3` | Sandbox | 🐢 | [lesson_param_3_persistent_style_state.md](./lesson_param_3_persistent_style_state.md) | Persistent `SET_PEN_COLOR`/`WIDTH` + `White` selective eraser | Starter `14`; Vars `10–25` |
| 5 | `param.4` | `2.4` | Sandbox | 🐢 | [lesson_param_4_multi_parameter_actions.md](./lesson_param_4_multi_parameter_actions.md) | Two-parameter `ARC_LEFT`/`ARC_RIGHT` (`radius`, `angle`) | Starter `8`; Vars `7–24` |
| 6 | `param.5` | `2.5` | Sandbox | 🎵 | [lesson_param_5_pitch_duration_colored_rows.md](./lesson_param_5_pitch_duration_colored_rows.md) | `PLAY_NOTE` pitch (`1..8`)+duration & colored Row/Col/Pixel/Preset | Starter `10`; Vars `7–18` |
| 7 | `param.6` | `2.5a` | `📖` Explanation | 🎵 | [lesson_param_6_speed_control_beat_delay.md](./lesson_param_6_speed_control_beat_delay.md) | `SET_BEAT_DELAY` multiplier (`[1]`=`1×` 400ms vs `[0]`=`0ms`) + `Black` LED carve | 3 tabs (`6`, `12`, `9`) |
| 8 | `param.C` | *New* | `🎨` Capstone | 🎵 | [capstone_param_c_pixel_and_rhythm_studio.md](./capstone_param_c_pixel_and_rhythm_studio.md) | Pixel art framing (`SET_BEAT_DELAY [0]`, `Black`/`White`, presets) + rhythm | Starter `12`; Vars `11–26` |
| 9 | `param.7` | `2.6` | `📖` Explanation | 🤖 | [lesson_param_7_interactive_world_items.md](./lesson_param_7_interactive_world_items.md) | 3 isolated demos: Key (1-ahead), Plank (1-ahead reuse), Crate (current tile) | 3 tabs (`5`, `5`, `5`) |
| 10 | `param.8` | `2.7` | Puzzle | 🤖 | [lesson_param_8_keys_and_gates.md](./lesson_param_8_keys_and_gates.md) | Fetching & matching a Key to unlock its colored/shaped Gate | `7 / 8` slots (`Edit Delta 7`) |
| 11 | `param.9` | *Split 2/3* | Puzzle | 🤖 | [lesson_param_9_portable_planks.md](./lesson_param_9_portable_planks.md) | Laying a Plank 1-ahead, crossing, U-turning, retrieving & reusing | `9 / 9` slots (`Edit Delta 7`) |
| 12 | `param.10` | *Split 3/3* | Puzzle | 🤖 | [lesson_param_10_crates_and_switches.md](./lesson_param_10_crates_and_switches.md) | Dropping a Crate onto the current tile to weigh down a Floor Switch | `7 / 8` slots (`Edit Delta 7`) |
| 13 | `param.A` | `2A` | `🏆` Capstone | 🤖 | [capstone_param_a_supply_courier.md](./capstone_param_a_supply_courier.md) | Sequential 1-slot shoulder carry: Key->Gate first, then Plank->Water | `9 / 10` slots (`Edit Delta 9`) |
| 14 | `param.B` | `2B` | `🎨` Capstone | 🐢 | [capstone_param_b_emblem_and_emoji_studio.md](./capstone_param_b_emblem_and_emoji_studio.md) | Unrolled colorful LOGO emblems combining angles, colors, widths & arcs | Starter `12`; Vars `13–30` |

## Cross-Environment Technical Contracts

- **Robot Grid (`🤖`):** `(0,0)` = top-left `(col, row)`. All stateful item activities (`param.7`–`param.A`) enforce `strictInteractionCollision: true`, max `1` item/stack per tile, floor switches driven by `isPressed = hasCrateOnTile || hasRobotOnTile`, on-robot upper-right shoulder gripper carry rendering, ordered flags `1 ⋯▶ 2`, and shuttered `🏁` goal barriers.
- **Turtle LOGO (`🐢`):** `(0,0)` canvas center, `0°` North, `penDown: true`, `penColor: '#0f172a'`, `penWidth: 6`. Palette uses `PALETTE_COLORS` indices `0..9` (`0=Black`, `1=Red`, `2=Blue`, `3=Green`, `4=Amber/Yellow`, `5=Purple`, `6=Pink`, `7=Cyan`, `8=Orange`, `9=White`; **no Brown**). `White` (`#ffffff`) displays a crisp slate rim + eraser-tip badge; angle pickers use trajectory rotation/arc badges (`RotationVisual`, `ArcAngleVisual`, `RadiusVisual`) with presets including `72°` and `144°`.
- **Beat & Light (`🎵`):** `8×8` matrix where `(1,1)` = **top-left** (`x=1..8` left-to-right, `y=1..8` top-to-bottom). Hardware color indices `0..9`: `0=Cyan`, `1=Rose`, `2=Amber`, `3=Emerald`, `4=Purple`, `5=Blue`, `6=Orange`, `7=Pink`, `8=Black (#0f172a off LED)`, `9=White (#ffffff)`. `STAMP_PRESET` codes `0..7` = `HEART, STAR, SMILE, NOTE, BOLT, DIAMOND, CHECK, ROBOT`. `SET_BEAT_DELAY` uses step delay multiplier `[0, 0.25, 0.5, 1, 2, 4]` × `400ms` tick (`1` = `1×` 400ms default; `0` = `0ms` instant frame paint). `tool-beat-active-color` enables starting at `param.5`.
