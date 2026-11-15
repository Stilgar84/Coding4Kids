# Side Module `inter`: Interactive Toys & Live Arcade (`inter.0` – `inter.8`, `inter.A` – `inter.B`)

- **Track Placement:** Side Module (`cmp ==> inter`), unlocking immediately after [`cmp`](../cmp/overview.md) and completely independent of `anim`, `tape`, and `args`.
- **Unlocks:** Completes **`🔥 Mastery Set inter`** and awards the **`🕹️ inter` Badge** upon passing [`inter.A`](./capstone_inter_a_playable_arcade_and_synth.md) and [`inter.B`](./capstone_inter_b_interactive_kaleidoscope_and_arcade.md).
- **Curriculum Guide:** [Master Curriculum Overview](../overview.md)

---

## 1. Module Purpose & Architecture

`inter` bridges algorithmic logic into **real-time event-driven toys, instruments, and arcade mini-games** without introducing multi-threading race hazards or complex callback syntax. Learners discover:

1. **Immediate Pointer Events (`0x40 ON_TAP`):** Reacting to every canvas tap or drag with `0x93 $pointerX`, `0x94 $pointerY`, and `0x95 $pointerDown`.
2. **Spatial Conditioning (`<=`, `>`, `%`, `+`, `-`):** Splitting a matrix or canvas into drum pads, octave keys, 4-corner stamp pads, and mirrored kaleidoscopes using skills unlocked in `cmp`.
3. **Discrete D-Pad & Action Events (`0x41`–`0x46`) vs. Continuous Hold (`0x2E keyHeld`):** Choosing discrete 1-press triggers (`ON_KEY_UP/DOWN/LEFT/RIGHT/A/B`) for menu toggles, color swaps, and grid steps vs. `keyHeld` inside `WHILE` or live frames for smooth arcade movement.
4. **Live Interactive LOGO (`mode: 2`):** Combining real-time drawing, pointer steering, `🧹 Clear Between Frames [ON/OFF]`, and single-letter `OP_VAR_OP` state (`u`, `v`, `l`, `r`, `n`, `s`) in [`turtle_logo.md`](../../envs/turtle_logo.md).

---

## 2. Platform & Environment Specs Covered

### 2.1 Execution Model & Single-Threaded Event Queue (`binary_format.md` §5.1, `platform_requirements.md` §1.4)
- **FIFO Queue (`max 16` events):** Taps and button presses push into a single-threaded queue. `MAIN` yields safely between steps/ticks, and high-frequency pointer moves coalesce into the current atomic pointer snapshot (`$pointerX`, `$pointerY`, `$pointerDown`) so shared single-letter variables (`'a'..'z'`) never suffer race conditions.
- **Zero Cross-Track Dependencies:** Because `cmp ==> inter` runs parallel to `anim`, `tape`, and `args`, all `inter` lessons stay self-contained using `MAIN`/`F1`–`F3`, pointer sensors, D-Pad/action events, and single-letter `OP_VAR_OP` state (no animation-clock variables, sparse tape blocks, or parameterized sockets).

### 2.2 Canonical Event Scope IDs & Input Sensors
| Scope / Sensor | Icon | Binary ID | Meaning & Notes |
|---|---|---|---|
| `MAIN` | `▶️` | `0x00` | Continuous / top-level program loop |
| `F1` – `F3` | `ƒ₁`–`ƒ₃` | `0x81`–`0x83` | Reusable stamp / arena helpers |
| `ON_TAP` | `👆` | `0x40` | Fires on canvas tap / pointer click |
| `ON_KEY_UP` | `⬆️` | `0x41` | Fires on D-Pad Up / `ArrowUp` / `W` press |
| `ON_KEY_DOWN` | `⬇️` | `0x42` | Fires on D-Pad Down / `ArrowDown` / `S` press |
| `ON_KEY_LEFT` | `⬅️` | `0x43` | Fires on D-Pad Left / `ArrowLeft` / `A` press |
| `ON_KEY_RIGHT` | `➡️` | `0x44` | Fires on D-Pad Right / `ArrowRight` / `D` press |
| `ON_KEY_A` | `🅰️` | `0x45` | Fires on `[🅰️]` button / `Space` / `Z` press |
| `ON_KEY_B` | `🅱️` | `0x46` | Fires on `[🅱️]` button / `Enter` / `X` press |
| `keyHeld(dir)` | `🕹️` | `0x2E` | Condition `ConditionExpr`: true while button/key held (`UP`, `DOWN`, `LEFT`, `RIGHT`, `A`, `B`) |
| `$pointerX` | `👆X` | `0x93` | Pointer X coordinate (`1..W` in Beat; `-W/2..W/2` in LOGO) |
| `$pointerY` | `👆Y` | `0x94` | Pointer Y coordinate (`1..H` in Beat; `-H/2..H/2` in LOGO) |
| `$pointerDown` | `👆⬇️` | `0x95` | Boolean: true while pointer/finger is pressed |

### 2.3 Target Environments
1. **`🎵` Beat & Light Matrix ([`beat_light.md`](../../envs/beat_light.md)):**
   - `8×8` Classic Matrix (`inter.0`–`inter.3`, `inter.8`), `16×16` HD Matrix (`inter.4`, `inter.7`, `inter.8`, `inter.A`), and `32×32` Sprite Pad (`inter.4`, `inter.A`).
   - Coordinates are `1..W × 1..H` (bottom-left `1, 1`). Fractional `Math.trunc` and silent out-of-bounds clamping make offsets like `x + 1` safe; `SET_LED_COLOR [Black]` (`0x08`) selectively switches off lit LEDs for eraser tools and moving cursors.
   - `PLAY_NOTE [pitch, duration]` supports C Major `1..8` (and extended `1..16` on `16×16`/`32×32`), with `WAIT_BEAT` durations `[0.125, 0.25, 0.5, 1, 2, 4]`.
2. **`🐢` Turtle LOGO Live Mode ([`turtle_logo.md`](../../envs/turtle_logo.md)):**
   - Uses `ENV_VERSION_TURTLE_V2` (`mode: 2 = live`), conditional `👆 X, Y` pill in the stage header, `🧹 Clear Between Frames [ON/OFF]` toggle, and Bottom-Dock D-Pad + `[🅰️]`/`[🅱️]` overlays.
   - Featured in `inter.5`, `inter.6`, `inter.7` (`[Fix 2]`), and `inter.B`.

### 2.4 UI Contract & Kid-Friendly Guidelines ([`ui_guidelines.md`](../../ui_guidelines.md))
- **Bottom-Dock Overlay:** D-Pad anchors bottom-left and `[🅰️]` / `[🅱️]` anchor bottom-right inside `pane-simulation` only when the lesson uses D-Pad/action blocks; keyboard (`Arrow`, `WASD`, `Space`/`Z`, `Enter`/`X`) mirrors touch identically.
- **`+ ⚡` Event Tab Bar:** Up to `12` tabs visible; guided lessons introduce at most `3` Event Tabs per activity while Sandboxes/Capstones may use the full bar.
- **Two-Layer Reading Policy:** Zero instructional prose on workspace blocks or diagnostics. Kids navigate via Pure-Icon `🎯` Goal Previews, color-coded event pills, and read-aloud `Guided Co-Pilot` prompts (`<= 2` sentences), while `<details><summary>📖 Parent / Teacher Tip</summary>` stays collapsed for grown-ups.
- **Closer-Inclusive Flat Block Counting:** Every documented cap follows `LOOP_START` / `WHILE` = `2 + count(body)`, `IF` = `2 + count(then) + sum(1 + count(elseIf/else))`, and `1` per leaf action/assignment. All arithmetic uses strict 3-address `OP_VAR_OP` (`t = a op b`) with single-letter variables `'a'..'z'`.

---

## 3. Complete Lesson-by-Lesson Syllabus

| # | Type | Env & Mode | Title & Core Mechanics | Flat Block Budget | Link |
|---|---|---|---|---|---|
| `inter.0` | `📖` | `🎵` `8×8` | **Tap to Light & Play:** `+ ⚡ ON_TAP (0x40)`, `$pointerX`, `$pointerY`, immediate tap-to-note feedback | Demos: `2`–`4`; Try-It: `5` (`cap 8`) | [Lesson `inter.0`](./lesson_inter_0_tap_to_light_and_play.md) |
| `inter.1` | `🎨` | `🎵` `8×8` | **Multi-Zone X/Y Synth & Beat Pad:** Spatial `IF/ELSE` zones, 4-corner quadrants, `ON_KEY_B`, 3-address harmony offsets | Starter: `9`; Vars: `14`–`21` (`cap 26`) | [Lesson `inter.1`](./lesson_inter_1_multi_zone_xy_synth.md) |
| `inter.2` | `📖` | `🎵` `8×8` | **Virtual D-Pad & Action Buttons:** `ON_KEY_UP/DOWN/LEFT/RIGHT/A/B` (`0x41`–`0x46`), Bottom-Dock layout, `1..8` wall guards | Demos: `17`, `20`; Try-It: `15` (`cap 16`) | [Lesson `inter.2`](./lesson_inter_2_virtual_dpad_and_action_buttons.md) |
| `inter.3` | `🎨` | `🎵` `8×8` | **D-Pad Etch-a-Sketch & Drum Stepper:** Persistent cursor `(x, y)`, `[🅰️]` Ink/Erase (`Black` `0x08`), `[🅱️]` Reset, parity `m % 2` & brush stamping | Starter: `20`; Vars: `27`–`42` (`cap 44`) | [Lesson `inter.3`](./lesson_inter_3_dpad_etch_a_sketch.md) |
| `inter.4` | `🎨` | `🎵` `16×16` / `32×32` | **Hold & Drag Sparkle Pad:** `$pointerDown` (`0x95`) inside `WHILE`, continuous finger painting, `m % 16` + `🎲 D4` spray on `32×32` | Starter: `10`; Vars: `15`–`27` (`cap 32`) | [Lesson `inter.4`](./lesson_inter_4_hold_and_drag_sparkle_pad.md) |
| `inter.5` | `📖` | `🐢` `♾️ Live` | **Live Interactive Turtle:** `mode: 2`, `$pointerDown` drag stamps (`inter_5_demo1.svg`), `🧹 Clear [ON]` live polygon morpher (`inter_5_demo2.svg`) | Demos: `11`, `15`; Try-It: `15` (`cap 18`) | [Lesson `inter.5`](./lesson_inter_5_live_interactive_turtle.md) |
| `inter.6` | `🎨` | `🐢` `♾️ Live` | **Turtle Finger Brush & D-Pad Sketcher:** `0x2E keyHeld` glide + stamp (`inter_6_starter.svg`), size dial (`inter_6_var1.svg`), 4-way mirror (`inter_6_var2.svg`), live bounce + pointer drop (`inter_6_var3.svg`) | Starter: `20`; Vars: `18`, `18`, `10` (`cap 24`) | [Lesson `inter.6`](./lesson_inter_6_turtle_finger_brush_and_dpad_sketcher.md) |
| `inter.7` | `🔧` | `🎵` & `🐢` | **Fix-It: Broken Interactive Toy:** Broken loop-hijack Beat toy + `[Fix 1]` non-blocking synth, `[Fix 2]` `🧹 Clear` Radar (`inter_7_fix2.svg`), `[Fix 3]` `16×16` Wall-Clamp Rover | Broken: `18`; Fixes: `19`, `9`, `26` (`cap 28`) | [Lesson `inter.7`](./lesson_inter_7_fix_broken_interactive_toy.md) |
| `inter.8` | `🎨` | `🎵` `8×8` / `16×16` | **Whack-a-Star & Mini-Arcade:** Tap-target reaction game, D-Pad catcher, meteor dodge, 1-player LED Pong with pre-computed paddle bounds | Starter: `20`; Vars: `29`–`49` (`cap 54`) | [Lesson `inter.8`](./lesson_inter_8_whack_a_star_and_pong_rally.md) |
| `inter.A` | `🏆` | `🎵` `16×16` / `32×32` | **Capstone A: Playable Arcade & Mega-Synth:** `16×16` Light Chaser + Sound Pad Starter, 8×8 Launchpad, 32×32 Sprite Painter, LED Brick Breaker | Starter: `41`; Vars: `21`–`66` (`cap 70`) | [Capstone `inter.A`](./capstone_inter_a_playable_arcade_and_synth.md) |
| `inter.B` | `🏆` | `🐢` `♾️ Live` | **Capstone B: Interactive Kaleidoscope & Arcade:** Live polygon cursor (`inter_b_starter.svg`), Spirograph composer (`inter_b_var1.svg`), Pong Arena (`inter_b_var2.svg`), Fireworks Painter (`inter_b_var3.svg`) | Starter: `20`; Vars: `23`, `34`, `14` (`cap 38`) | [Capstone `inter.B`](./capstone_inter_b_interactive_kaleidoscope_and_arcade.md) |
