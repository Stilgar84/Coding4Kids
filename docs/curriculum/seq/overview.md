# Module `seq`: First Steps — Sequences, Orientation & Visual Debugging

> [← Curriculum Overview](../overview.md) · **Stage 2 Implementation Spec**

**Cognitive Goal:** Build foundational computational thinking with **100% zero reading**: top-to-bottom sequential execution order, egocentric robot point-of-view rotation (`Turn Left` / `Turn Right` without stepping), backing out of tight 1-cell alcoves (`Move Back`), tick-by-tick visual step-debugging (`⏭ Step` Bug-Hunt), staged ordered waypoints (`1 ⋯▶ 2 → Goal` with shuttered `🏁`), and parameterless creative sequencing across Turtle LOGO (`Pen Up` / `Pen Down`) and Beat & Light (`8×8` drums & overlay icon stamps).

**Environments:**
- [🤖 Robot Grid](../../envs/robot_grid.md) (`3×3`–`4×4` compact grids)
- [🐢 Turtle LOGO](../../envs/turtle_logo.md) (Fixed `100px` steps, `90°`-locked turns, `#0f172a` ink, `penWidth: 6`)
- [🎵 Beat & Light Matrix](../../envs/beat_light.md) (`8×8` matrix, Tier-1 parameterless drums & stamps; `(1,1)` cursor reticle and active-color tool hidden)

---

## Pedagogical Guardrails & Handoff Contract (`seq → param`)

1. **100% Zero-Reading Rule (`ui_guidelines.md` §1):** All learner-facing views, blocks, spotlights, ghost previews, and sandbox cards in `seq` require **zero reading**. Multi-sentence adult context lives exclusively inside collapsed **`📖 Parent / Teacher Tip`** disclosures (`explanationText`, `aria-expanded="false"`). No text/letter drawing challenges appear in Turtle LOGO.
2. **Two-Axis Guardrails (`../overview.md` §3):**
   - **Guided Puzzles (`seq.1`–`seq.5`):** `3×3`–`4×4` maps, **Edit Delta ≤ 6** blocks (`1–6`), physical slot caps `≤ 7` blocks.
   - **Capstone Puzzle (`seq.A`):** `4×4` map, `slotCap: 10` (`9`-block solution, **Edit Delta = 6**).
   - **Creative Sandboxes (`seq.6`–`seq.8`, `seq.B`–`seq.C`):** **Starter & Variation 1 ≤ 14 blocks**, **Variation 2 ≤ 20 blocks**, **Variation 3 ≤ 30 blocks**; `allowActionParams: false`, `allowRepeatBadges: false`.
3. **Environment & Icon Alignments:**
   - **No `🔒` Padlocks (`ui_guidelines.md` §4):** Ordered flags in `seq.5` and `seq.A` use **dimmed shuttered pennants + dashed sequence chain (`1 ⋯▶ 2`)** and a **shuttered `🏁`** goal barrier; stepping onto a future gated flag is a harmless wiggle no-op (`!= COLLISION`).
   - **Beat Isolation (`envs/beat_light.md` §1):** `(1, 1)` cursor reticle (`visible: false`) and `tool-beat-active-color` remain hidden throughout `seq`. Tier-1 `WAIT_BEAT` uses parameterless 1-beat wait (`0x15`). `STAMP_*` overlays foreground LEDs without clearing background pixels.
   - **Turtle Origin (`envs/turtle_logo.md` §1):** Every LOGO workspace starts at `(0, 0)` facing `0°` North (`-y`), `penDown: true`, `penColor: "#0f172a"`, `penWidth: 6`, using `FORWARD`/`BACKWARD` (never `MOVE_FWD`/`MOVE_BACK` in LOGO palettes).
4. **Guaranteed Competencies Handed Off to Module `param`:**
   - Ordered top-to-bottom execution, `⏭ Step` debugging, `MOVE_FWD`, `MOVE_BACK`, `TURN_LEFT`, `TURN_RIGHT`, ordered waypoints (`1 ⋯▶ 2`), fixed-unit LOGO motion (`100px` / `90°` + `PEN_UP`/`PEN_DOWN`), and Tier-1 Beat drums + `STAMP_*` / `CLEAR_LEDS` / `WAIT_BEAT`.

---

## Lessons & Capstones (`14` Activities)

| ID | Legacy Alias | Format | Env | Title |
| :--- | :---: | :---: | :---: | :--- |
| **`seq.0`** | `1.0` | 📖 | 🤖 | [How Programs Run & Robot Point-of-View](./lesson_seq_0_how_programs_run.md) |
| **`seq.1`** | `1.1` | 🤖 | 🤖 | [Moving Forward & Execution Order](./lesson_seq_1_moving_forward.md) |
| **`seq.2`** | `1.2` | 🤖 | 🤖 | [Turning in Place (First Corner)](./lesson_seq_2_turning_in_place.md) |
| **`seq.2a`** | — | 🤖 | 🤖 | [Egocentric Turns (Facing South & West)](./lesson_seq_2a_egocentric_turns.md) |
| **`seq.3`** | `1.3` | 🤖 | 🤖 | [Stepping Backward](./lesson_seq_3_stepping_backward.md) |
| **`seq.4`** | `1.4` | 🤖 | 🤖 | [Visual Step-Debugging](./lesson_seq_4_visual_step_debugging.md) |
| **`seq.5`** | `1.5` | 🤖 | 🤖 | [Ordered Waypoints (`1 ⋯▶ 2 → Goal`)](./lesson_seq_5_ordered_waypoints.md) |
| **`seq.6`** | `1.6` | 🐢 | 🐢 | [First Continuous Line Drawings](./lesson_seq_6_first_continuous_line_drawings.md) |
| **`seq.7`** | `1.7` | 🐢 | 🐢 | [Lifting & Lowering the Pen (`Pen Up` / `Pen Down`)](./lesson_seq_7_lifting_lowering_pen.md) |
| **`seq.7a`** | — | 📖 | 🎵 | [Meet the Beat & Light Pad](./lesson_seq_7a_meet_beat_and_light_pad.md) |
| **`seq.8`** | `1.8` | 🎵 | 🎵 | [Drum Pads & Icon Stamps](./lesson_seq_8_meet_beat_and_light.md) |
| **`seq.A`** | `1A` | 🏆 | 🤖 | [Capstone `seq.A` — The Compact Labyrinth](./capstone_seq_a_compact_labyrinth.md) |
| **`seq.B`** | `1B` | 🎨 | 🐢 | [Capstone `seq.B` — Postcard Sketch](./capstone_seq_b_postcard_sketch.md) |
| **`seq.C`** | `1C` | 🎨 | 🎵 | [Capstone `seq.C` — Sticker & Beat Intro](./capstone_seq_c_sticker_and_beat_intro.md) |
