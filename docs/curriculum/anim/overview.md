# Side Module `anim`: Flipbook Animations & Sprite Shows (`anim.0` – `anim.11`, `anim.A` – `anim.B`)

- **Track:** Side Track — **Unlocks After:** [`tape` (Memory Tape)](../tape/overview.md) (`tape ==> anim`)
- **Unlocks:** `🔥 Mastery Set anim` (`80` Stars)
- **Environments:** [🐢 Turtle LOGO (Flipbook Mode)](../../envs/turtle_logo.md) + [🎵 Beat & Light Matrix (`ENV_VERSION_BEAT = 2`)](../../envs/beat_light.md)
- **Theme:** Frame-by-frame motion, persistent animation physics, white-eraser negative space, dynamic Sparse Tape skylines/equalizers, `8×8` / `16×16` sprite sheets (`STAMP_FROM_TAPE`), and phased storytelling (`$time`).

<details>
<summary>📖 Parent / Teacher Tip — Why `anim` Unlocks After `tape`</summary>

Side Module `anim` unlocks directly after **Core Module `tape`** (`tape ==> anim`, while `cmp` unlocks [`inter`](../inter/overview.md)). Placing `anim` after `tape` guarantees learners already understand variables (`'a'..'z'`), strict 3-address arithmetic (`OP_VAR_OP`), `While`/`If` gates, Sparse Memory Tape (`10,000` cells), and `STAMP_FROM_TAPE` before animating skylines (`anim.7`), tape equalizers (`anim.8`), `8×8` sprite flipbooks (`anim.8a`), polygon tables (`anim.9`), physics (`anim.11`), and capstones (`anim.A`–`anim.B`).

</details>

---

## 1. Two Worlds of Animation: Flipbook Mode vs. Hardware Frame Loops

| Feature | 🐢 Turtle LOGO Flipbook Mode | 🎵 Beat & Light Hardware Frame Loop |
| :--- | :--- | :--- |
| **Execution Model** | **1 Run of `MAIN` = 1 Frame** (`$frame = 1 .. N`, `MAX_STEPS = 10,000` per frame). | Single program runs continuously (`SET_BEAT_DELAY [0]` → `Loop` → `CLEAR_LEDS` → Draw → `WAIT_BEAT`). |
| **Clock Sensors** | `$frame` (`🎞️ #`) and `$time` (`🕒 Xs` where `$time = ($frame - 1) / fps`). | `$beatIndex` (`🎵 #N`) increments on sound / `WAIT_BEAT` pacing (`1..16` synth notes, `0.125..4` beats). |
| **Canvas Reset** | Auto-resets pose to `(0, 0, 0°)` & clears strokes when `🧹 Clear Between Frames` is `ON`; keeps strokes on `OFF`. | Explicit **`CLEAR_LEDS` at loop top** wipes the previous LED buffer without losing the final frame on completion. |
| **Persistent State** | All variables `'a'..'z'` and Sparse Memory Tape persist across frames until Rewind (`⏮`). | All variables `'a'..'z'` and Sparse Memory Tape persist across loop iterations until Reset. |
| **Selective Erase** | `SET_PEN_COLOR [white]` (`#ffffff`, index `9`) knocks out strokes cleanly over white paper (`SET_PEN_WIDTH [w + 2]` when extra margin helps). | `SET_LED_COLOR [black]` (`⊘` Off, index `8` in `BEAT_LED_PALETTE` / `#0f172a`) selectively extinguishes pixels without clearing the matrix. |
| **Controls / UI** | Bottom-Dock Timeline Scrubber (`1..N`), `⏩ Render All`, speed `0.5× / 1× / 2×`, `🎞️ N` (`2..60`), `🧹 Clear`, `Loop 1×/∞`. | Canvas Header Row (`🎵 #N`, active color pill with `Black ⊘` cue, `Loop ∞`, `🔊/🔇`), plus `🟦 8×8 Sprite View` popover for `tape` sprites. |

---

## 2. Two-Axis Guardrails & Language Contracts

1. **Zero Hidden Math:** All variables are strictly **single-letter `'a'..'z'`** (e.g., `u, v` for velocity in `anim.11` / `anim.A` — never multi-letter identifiers). Every calculation uses standalone 3-address `VAR_OP` (`a = b op c`); **zero** inline arithmetic expressions inside `If`, `Loop`, `TELEPORT`, or action arguments.
2. **One-Concept-Per-Lesson & Isolated Fix-It:** Every `🎨` sandbox introduces one primary concept (flipbook angle -> persistent growth -> trail accumulation -> scanner sweep -> Tape skyline -> equalizer -> `STAMP_FROM_TAPE` sprite sheets -> polygon morph -> polar orbits -> Cartesian velocity/gravity). Debugging is cleanly isolated inside `anim.6a` (`🔧`).
3. **Zero-Reading Guided Co-Pilot:** No prose instructions are shown directly on workspaces. Each lesson provides a concise **<= 2-sentence Guided Co-Pilot Card**, illustrated **Variation Cards** (`1`-tap Load Code), and collapsed `<details>📖 Parent / Teacher Tip</details>` notes.
4. **Closer-Inclusive Flat Block Counting:** Every `Loop`/`End Loop`, `While`/`End While`, and `If`/`End If` counts **2 flat blocks** (opener + closer), and `Else` adds **+1 flat block**.

---

## 3. Curriculum Scope & Lesson Sequence (`16` Items)

| # | Type | World | Title | Core Concept & Key Opcodes | Budget (`Starter / Cap`) | Link |
| :---: | :---: | :---: | :--- | :--- | :---: | :--- |
| **`anim.0`** | 📖 | 🐢 Flipbook | **Meet LOGO Flipbook Mode** | 3 pre-built tabs: `$frame` stateless rotation, persistent `s = s + 20`, `🧹 Clear: OFF` trails + Scrubber/`🕒 Xs` | `7–11 / 14` | [lesson_anim_0](./lesson_anim_0_meet_logo_flipbook_mode.md) |
| **`anim.1`** | 📖 | 🎵 Beat | **Instant LED Buffers & Clear-Wait** | 3 `Loop ×4` tabs: `SET_BEAT_DELAY [0]` batching + `CLEAR_LEDS` top (good) vs bottom (blank-end bug) | `7–12 / 16` | [lesson_anim_1](./lesson_anim_1_instant_drawing_clear_wait.md) |
| **`anim.2`** | 🎨 | 🐢 Flipbook | **Spinning Windmill** | `$frame` stateless angle math (`a = $frame * 15`), helper pinwheel, Tape rainbow blades | `11 / 14` *(Var 1–3: `18–20`)* | [lesson_anim_2](./lesson_anim_2_spinning_windmill.md) |
| **`anim.3`** | 🎨 | 🎵 Beat | **LED Rain & Smooth Frame Loops** | Explicit hardware frame loop (`WAIT_BEAT [0.5]`), falling drop, Matrix rain, zero-var Heartbeat & Fireworks | `8 / 12` *(Var 1–3: `14–21`)* | [lesson_anim_3](./lesson_anim_3_led_rain_smooth_frame_loops.md) |
| **`anim.4`** | 🎨 | 🐢 Flipbook | **Breathing Star** | Frame-phased `If ($frame <= 6)` persistent growth/shrink, upright centered polygons | `20 / 24` | [lesson_anim_4](./lesson_anim_4_breathing_star.md) |
| **`anim.5`** | 🎨 | 🐢 Flipbook | **Spiral Trail & White Eraser** | `clearBetweenFrames: false`, pose capture (`TELEPORT [x, y, h]`), `White` unwind erase (`SET_PEN_WIDTH [8]`) | `11 / 14` *(Var 2: `28`)* | [lesson_anim_5](./lesson_anim_5_spiral_trail_and_white_eraser.md) |
| **`anim.6`** | 🎨 | 🎵 Beat | **Scanner Bar & Wipe Transitions** | Reversible row/col scan `1→8→2` (no double-lit bounce) + `PLAY_NOTE [r, 0.25]`, Wipes & `Black ⊘` erase | `20 / 24` *(Var: `17–26`)* | [lesson_anim_6](./lesson_anim_6_scanner_bar_wipe_transitions.md) |
| **`anim.6a`** | 🔧 | 🎵 Beat | **Fix the Blank Lightshow Bug** | Debug loop-bottom `CLEAR_LEDS` (blank end) & slow `SET_BEAT_DELAY [1]` (`Edit Delta: 2`) | `7 / 10` | [lesson_anim_6a](./lesson_anim_6a_fix_blank_lightshow_bug.md) |
| **`anim.7`** | 🎨 | 🐢 + 📼 | **Animated Skyline Day to Night** | `F1` building helper returning cleanly to `0°`, Tape Day/Night sky palette & heights | `18 / 22` *(Var 3: `26`)* | [lesson_anim_7](./lesson_anim_7_animated_skyline_day_to_night.md) |
| **`anim.8`** | 🎨 | 🎵 + 📼 | **Animated Tape Equalizer** | 8-column Tape bar reader + `r = f % 2` bounce, snare/bass groove, `Black ⊘` peak decay | `23 / 28` *(Var: `25–29`)* | [lesson_anim_8](./lesson_anim_8_animated_tape_equalizer.md) |
| **`anim.8a`** | 🎨 | 🎵 + 📼 | **Multi-Frame Sprite Sheet** | `STAMP_FROM_TAPE` (`1, 65, 129, 193`, `$tapeLength >= 256`), `🟦 8×8 Sprite View`, transparent `∅` | `9 / 14` *(Var: `10–14`)* | [lesson_anim_8a](./lesson_anim_8a_multi_frame_sprite_sheet.md) |
| **`anim.9`** | 🎨 | 🐢 + 📼 | **Polygon Morphing & Tape Flipbook** | `3..12`-gon morph (`a = 360 / n`) + Tape `(side, angle)` lookup flipbook & rotating stars | `7 / 12` *(Var 1: `16`)* | [lesson_anim_9](./lesson_anim_9_polygon_morphing_and_tape_flipbook.md) |
| **`anim.10`** | 🎨 | 🐢 Flipbook | **Orbiting Moons** | Polar orbit transform (`TELEPORT [0, 0, a]` + `PEN_UP FORWARD`), epicycles & Spirograph trails | `20 / 24` *(Var 2: `34`)* | [lesson_anim_10](./lesson_anim_10_orbiting_moons.md) |
| **`anim.11`** | 🎨 | 🐢 Flipbook | **Bouncing Ball & Gravity Physics** | Cartesian state physics in `400×300` arena (`x, y, u, v`), SVG `+Y` downward gravity `v = v + 4` | `38 / 44` *(Var 3: `48`)* | [lesson_anim_11](./lesson_anim_11_bouncing_ball_and_gravity_physics.md) |
| **`anim.A`** | 🏆 | 🐢 + 📼 | **Flipbook Story & Physics Showcase** | Multi-phase `$time < 2` (`🕒 Xs`) Rocket → Starburst, Brick-Breaker, 4-Season Tree, 3-Planet Orrery | `33 / 40` *(Var 1: `60`)* | [capstone_anim_a](./capstone_anim_a_flipbook_story_and_physics_showcase.md) |
| **`anim.B`** | 🏆 | 🎵 + 📼 | **Sprite Sheet & Beat Choreographer** | Dancing Bot (`1, 65, 129, 193`) + Tape melody groove, Rain+EQ, 3-2-1 Countdown, `16×16` Kaleidoscope | `22 / 26` *(Var: `23–27`)* | [capstone_anim_b](./capstone_anim_b_sprite_sheet_and_beat_choreographer.md) |

---

## 4. Shared Capability Matrix

| Lesson(s) | Environment & Version | Variables (`'a'..'z'`) | Sparse Tape (`📼`) | Sprites / Physics / Clock |
| :--- | :--- | :--- | :--- | :--- |
| `anim.0`, `anim.2`, `anim.4`, `anim.5`, `anim.10` | 🐢 LOGO Flipbook (`ENV_VERSION_TURTLE_V2`) | Persistent `'a'..'z'`, 3-addr `VAR_OP` | Optional (`anim.2` Var 1, `anim.5` Var 3) | `$frame`, `$time` (`🕒 Xs`), `🧹 Clear` |
| `anim.7`, `anim.9`, `anim.A` | 🐢 LOGO Flipbook + 📼 Tape | Persistent `'a'..'z'`, `If/Else` | `$cellColor`, `$cellValue`, `TAPE_SEEK/STEP` | Phased `$time < 2` (`anim.A`), `400×300` arena |
| `anim.11` | 🐢 LOGO Flipbook (`ENV_VERSION_TURTLE_V2`) | Strictly `x, y, u, v` (+ `c` in Var 3) | No (`Var 3` uses `$randomColor`) | Screen gravity (`+Y` down), trail mode |
| `anim.1`, `anim.3`, `anim.6`, `anim.6a` | 🎵 Beat (`BEAT_VERSION = 2`) | Zero-var tabs (`anim.1`, `3` V2/V3) to `r, x, y` | No | `SET_BEAT_DELAY [0]`, `PLAY_NOTE` `0.25`, `Black ⊘` |
| `anim.8`, `anim.8a`, `anim.B` | 🎵 Beat (`BEAT_VERSION = 2`) + 📼 Tape | `c, f, h, i, r, x, y` | `$tapeLength >= 256` (`STAMP_FROM_TAPE`) | `8×8` / `16×16` grids, `∅` transparency |
