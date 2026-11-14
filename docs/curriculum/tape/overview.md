# Module `tape`: 📼 The Sparse Memory Tape & Typed Color Data

> [← Curriculum Overview](../overview.md)

**Cognitive Goal:** Master 1-indexed random-access memory cells (`TAPE_SEEK`, `TAPE_STEP`, `TAPE_WRITE`) with strict out-of-bounds checks (`1..$tapeLength`, scaling to `10,000` sparse cells in Sandboxes), bounds-safe `While ($headPos < $tapeLength)` scans (plus fencepost Fix-It debugging), distinguishing `color` vs. `number` runtime types (`TYPE_ERROR` visual bounces and `White`/`Black` selective erasing), and data-driven art, music, and linear search. *(Following [`cmp`](../cmp/overview.md), learners already have `<`, `>`, and `==` ready for dynamic Tape scans and numeric searches!)*

**Environments & Shared Subsystems:**
- [🐢 Turtle LOGO](../../envs/turtle_logo.md)
- [🎵 Beat & Light Matrix](../../envs/beat_light.md)
- [🏗️ Depot](../../envs/depot.md)
- [🤖 Robot Grid](../../envs/robot_grid.md)
- [Sparse Memory Tape & Typed Variables (Platform Requirements)](../../platform_requirements.md#11-typed-variable-system-number-vs-color)

---

## Lessons & Capstones

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`tape.0`** | 📖 | 🐢 | [Meet the Memory Tape & Color Variables](./lesson_tape_0_meet_memory_tape_and_colors.md) |
| **`tape.1`** | 🐢 | 🐢 | [Skyline Generator](./lesson_tape_1_skyline_generator.md) |
| **`tape.2`** | 🐢 | 🐢 | [Rainbow Burst](./lesson_tape_2_rainbow_burst.md) |
| **`tape.3`** | 🎵 | 🎵 | [Color Drum Sequencer](./lesson_tape_3_color_drum_sequencer.md) |
| **`tape.4`** | 🎵 | 🎵 | [Scale Melody & LED Stripes](./lesson_tape_4_scale_melody_and_led_stripes.md) |
| **`tape.4a`** *(Idea)* | 🎵 | 🎵 | *Custom Tape Sprite Stamp (`STAMP_FROM_TAPE` `📼→🟦`): Paint sparse color cells starting at `headPos` and stamp custom 8×8 icons/masks onto the LED matrix* |
| **`tape.5`** | 📖 | 🏗️ | [Scanning & Tape Bounds](./lesson_tape_5_scanning_and_tape_bounds.md) |
| **`tape.6`** | 🏗️ | 🏗️ | [Find the Green Beacon](./lesson_tape_6_find_green_beacon.md) |
| **`tape.7`** | 🏗️ | 🏗️ | [Count the Reds](./lesson_tape_7_count_the_reds.md) |
| **`tape.8`** | 🏗️ | 🏗️ | [Record Queue to Tape](./lesson_tape_8_record_queue_to_tape.md) |
| **`tape.9`** *(Idea)* | 🏗️ / 🤖 | 🏗️ / 🤖 | *Fix-It Bug Hunt: Fix a fencepost `TAPE_STEP` out-of-bounds `COLLISION` or `TYPE_ERROR` mismatch on a pre-filled workspace* |
| **`tape.A`** | 🏆 | 🏗️ | [Capstone `tape.A` — The Color Histogram](./capstone_tape_a_color_histogram.md) |
| **`tape.B`** | 🎨 | 🐢 | [Capstone `tape.B` — Tape Art Studio](./capstone_tape_b_tape_art_studio.md) |
| **`tape.C`** | 🎨 | 🎵 | [Capstone `tape.C` — Step Sequencer Studio](./capstone_tape_c_step_sequencer_studio.md) |
