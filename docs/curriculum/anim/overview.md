# Side Module `anim`: 🎬 Animation Studio — Flipbooks, Pacing & Physics

> [← Curriculum Overview](../overview.md)

**Cognitive Goal:** Master **Turtle LOGO Flipbook Animation Mode** (`MAIN` called once per frame with `$frame` & `$time`, persistent variables/Tape, inspectable first-pass drawing with `⏩ Render All Frames`, cached Timeline Scrubber, and `🧹 Clear Between Frames` trail mode) contrasted with **Beat & Light explicit hardware frame loops** (`SET_BEAT_DELAY [0]` → `CLEAR_LEDS` first → `WAIT_BEAT` and `STAMP_FROM_TAPE` sprite sheets), cyclic modulo motion, and bouncing physics. *(Unlocks after [`cmp`](../cmp/overview.md).)*

**Environments:**
- [🐢 Turtle LOGO (Flipbook Mode)](../../envs/turtle_logo.md)
- [🎵 Beat & Light Matrix (Explicit Frame Loops & Tape Sprites)](../../envs/beat_light.md)
- [Sparse Memory Tape (Platform Requirements)](../../platform_requirements.md#12-shared-sparse-memory-tape-subsystem-with-per-worker-heads-in-conc)

---

## Lessons & Capstones

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`anim.0`** *(Idea)* | 📖 | 🐢 | *Meet LOGO Flipbook Mode (`$frame`, `$time`, `⏩ Render All`, Scrubber & `🧹 Clear Between Frames`)* |
| **`anim.1`** | 📖 | 🎵 | [Hardware Display Buffers (`SET_BEAT_DELAY [0]`, `CLEAR_LEDS` & `WAIT_BEAT`)](./lesson_anim_1_instant_drawing_clear_wait.md) |
| **`anim.2`** | 🐢 | 🐢 | [Spinning Windmill (`$frame` Flipbook)](./lesson_anim_2_spinning_windmill.md) |
| **`anim.3`** | 🎵 | 🎵 | [LED Rain & Smooth Frame Loops](./lesson_anim_3_led_rain_smooth_frame_loops.md) |
| **`anim.4`** | 🐢 | 🐢 | [Breathing Star (Stateful Flipbook Variables)](./lesson_anim_4_breathing_star.md) |
| **`anim.5`** | 🐢 | 🐢 | [Spiral Trail (`🧹 Clear Between Frames: OFF` & `White` Eraser)](./lesson_anim_5_spiral_builder_paced_drawing.md) |
| **`anim.6`** | 🎵 | 🎵 | [Scanner Bar & Wipe Transitions](./lesson_anim_6_scanner_bar_wipe_transitions.md) |
| **`anim.7`** | 🐢 | 🐢 | [Animated Skyline — Day to Night (Tape + Flipbook)](./lesson_anim_7_animated_skyline_day_to_night.md) |
| **`anim.8`** | 🎵 | 🎵 | [Animated Tape Equalizer](./lesson_anim_8_animated_tape_equalizer.md) |
| **`anim.8a`** *(Idea)* | 🎵 | 🎵 | *Multi-Frame Custom Sprite Sheet (`STAMP_FROM_TAPE` `📼→🟦` stepping `headPos` across `1, 65, 129`)* |
| **`anim.9`** | 🐢 | 🐢 | [Polygon Morphing (`3 → 12` Sides) & Tape Flipbook](./lesson_anim_9_polygon_morphing_and_tape_flipbook.md) |
| **`anim.10`** | 🐢 | 🐢 | [Orbiting Moons (Polar Flipbook & Bouncing Physics)](./lesson_anim_10_orbiting_moons.md) |
| **`anim.A`** *(Idea)* | 🎨 | 🐢 | *Capstone `anim.A` — Flipbook Story & Physics Showcase* |
| **`anim.B`** *(Idea)* | 🎨 | 🎵 | *Capstone `anim.B` — Sprite-Sheet & Beat Choreographer* |
