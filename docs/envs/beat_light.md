# 🎵 Beat & Light Matrix Environment Specification

`Beat & Light Matrix` is an **open-ended musical, rhythmic, pixel-art, and interactive sandbox** environment paired alongside [Turtle LOGO](./turtle_logo.md) across Core Modules `seq`–`tape` (including `branch`, `while`, and `cmp`), `args`, and Side Modules `anim`, `inter`, and `conc` of [the curriculum](../curriculum/overview.md). It gives learners an immediate audiovisual canvas while keeping programming **100% zero-reading**.

*(For cross-environment features—including the unified 10-swatch `PALETTE_COLORS` / `TypedValue` system, shared Sparse Memory Tape, `$input` & `🎲` random sensors, queued events, and concurrency primitives—see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for HUD layout, see [UI Guidelines](../ui_guidelines.md).)*

---

## 1. Visual & Audio Simulation Model

- **RGB LED Matrix (`8×8` Core; `16×16` & `32×32` Unlocked in `inter`/`anim` & Pro Sandbox):** High-contrast rounded pixel pad (`x = 1..W`, `y = 1..H`, fixed at `8×8` in core lessons so coordinates `1..8` align 1:1 with the 8 musical scale pitches and keep touch targets large). Non-`8×8` sandbox saves encode dimensions via `BEAT_VERSION = 2`.
- **Beat Pulse & Audio Synth:** Lightweight Web Audio synthesizer (clean pentatonic/major scale notes + crisp percussion hits) synchronized to interpreter beats, paired with a visual beat-ring indicator so lessons work even when muted.
- **LED Cursor (Visible Reticle):** Subtle corner reticle showing current cursor `(x, y)` and heading when cursor-stepping blocks are used.
- **No Pass/Fail Grading & Variation Cards:** Each lesson loads a **working starter example** and offers **2–4 Variation Cards** (with an **animated mini preview + in-card Play/Listen `▶` button** and Undo-safe **Copy / Load Code**; Variation 2 and Variation 3+ enjoy progressive showcase block allowances).
- **Selective Color Erasing (`Black`):** `SET_LED_COLOR [Black]` before `LIGHT_PIXEL`, `LIGHT_ROW`, `LIGHT_COL`, or `CURSOR_STEP` clears those specific LEDs back to unlit (`null`) without wiping the entire pad.
- **Serializer Backward Compatibility (`BEAT_LED_PALETTE`):** `OP_BEAT_SET_LED_COLOR` (`0x18`) preserves `BEAT_LED_PALETTE` indices `0..7` (`0=Cyan, 1=Rose, 2=Amber, 3=Emerald, 4=Purple, 5=Blue, 6=Orange, 7=Pink`) plus `8 = Black` and `9 = White`, while shared variables/Tape use canonical `PALETTE_COLORS` indices `0..9`.

---

## 2. Action Blocks (Staged by Curriculum Module)

### Tier 1: Parameterless Blocks (`seq` Onboarding)

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `DRUM_KICK` | Bass drum icon | Repeat badge (`×N` in `param`+) | Plays a punchy kick drum hit (1 beat). |
| `DRUM_SNARE` | Snare / drumsticks | Repeat badge (`×N` in `param`+) | Plays a crisp snare hit (1 beat). |
| `DRUM_CLAP` | Clapping hands | Repeat badge (`×N` in `param`+) | Plays a handclap accent (1 beat). |
| `PLAY_CHIME` | Bell / sparkle | Repeat badge (`×N` in `param`+) | Plays a bright celebratory chime (1 beat). |
| `STAMP_HEART` / `STAMP_STAR` / `STAMP_SMILE` *(grouped under `STAMP_PRESET` in `param`+)* | Mini 8×8 pixel glyph | Preset icon badge (in `param`+) | Lights a recognizable 8×8 pixel icon on the matrix. |
| `WAIT_BEAT` | Hourglass / rest note | Repeat badge / beat duration (`0.25`, `0.5`, `1`, `2`, `4` or variable) | Holds current LEDs silent for `N` beats to display an assembled LED frame. |
| `CLEAR_LEDS` | Eraser / dark grid | None | Clears all LEDs to off (placed at the **start** of explicit hardware frame loops so the final frame remains visible). |

### Tier 2: Parameterized Sound, Style & Grid Blocks (`param`+)

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `PLAY_NOTE` | Musical note | **Pitch** (`1..8` scale bar or variable), **Duration** (`½`, `1`, `2` beats) | Plays the selected scale note for the chosen beat length. |
| `SET_LED_COLOR` | Palette swatch | **Color** (10 swatches or typed color variable / `$cellColor` / `$randomColor`) | Sets active LED color (`Black` selectively extinguishes target LEDs). |
| `SET_BEAT_DELAY` | ⚡ Gauge / Metronome | **Delay / Rate** (`0` = Instant 0ms frame batching; `50`–`800` ms or variable) | Controls step delay for non-sound blocks and sets tempo/frame pacing. |
| `LIGHT_ROW` / `LIGHT_COL` | Lit bar | **Row `y` / Col `x`** (`1..W` or variable) | Lights an entire row or column using active LED color. |
| `LIGHT_PIXEL` | Single lit dot | **Col `x`**, **Row `y`** (`1..W` or variable) | Lights pixel `(x, y)` using active LED color. |
| `CURSOR_STEP` / `CURSOR_TURN` | Pixel arrow / 90° turn | Repeat badge / Left-Right | Steps or rotates the LED cursor to draw borders and waves before coordinate math. |
| `STAMP_FROM_TAPE` | `📼→🟦` Tape sprite stamp | None *(reads from active `headPos`, unlocked in `tape`+)* | Blits `W × H` cells (`headPos .. headPos + W*H - 1`, row-major `(1,1)..(W,H)`) onto the LED matrix in 1 tick as a **customizable sprite stamp** (`headPos` stays put): **color** cells light pixels (`Black` clears to off), **empty (`∅`)** cells act as **transparent** (preserving underlying LEDs), **number** cells trigger `TYPE_ERROR`, and `headPos + W*H - 1 > $tapeLength` triggers `COLLISION`. |

---

## 3. Explicit Hardware Frame Loops (`anim`) vs. Concurrency Bands (`conc`)

- **Explicit Display-Buffer Frame Loops (`anim`):** While [Turtle LOGO](./turtle_logo.md) uses high-level Flipbook Mode, Beat & Light intentionally retains explicit loop-based frame batching (`SET_BEAT_DELAY [0]` → `Loop` → `CLEAR_LEDS` first → draw pixels → `WAIT_BEAT`) so learners also master how real-time hardware LED matrices refresh!
- **Modulo Sequencers & Checkerboards (`cmp`):** Uses `%` to trigger polyrhythms (`step % 4 == 1` kick, `step % 2 == 0` snare) and 2D parity patterns (`(x + y) % 2 == 0`).
- **Multi-Track Bands & Barriers (`conc`):** Primary onboarding world for Concurrency—`Main 1` (Drums) and `Main 2` (Melody / LED show) play simultaneously on the shared beat clock, using `🚧 Barrier` to align irregular musical phrases with visual drops!

---

## 4. Sensors, Queued Events (`inter`) & Sparse Tape Integration

| Sensor / Trigger | Badge | Introduced | Meaning |
| :--- | :---: | :---: | :--- |
| `$input` | `🎛️` | `branch` | Scene Input Selector value (`1..8` or color swatch) from the dock widget; auto-reruns on change for interactive jukeboxes and mood pads. |
| `cursorAtEdge` | `🧱` | `while` | `true` when the LED cursor sits at the matrix boundary facing outward (enables `While (NOT cursorAtEdge)` border/spiral fills before variables). |
| `🎲 $rand` / `$randomColor` | `🎲` / `🎨🎲` | `var` / Sandbox | Fresh dice roll (`Coin 0..1`, `D4`, `D6`, **`D8 (1..8)`**, `D20`, `[0, 1)` float) or vibrant color swatch on each read. |
| `$pointerX`, `$pointerY`, `$pointerDown` | `👆X`, `👆Y`, `👆●` | `inter` | Quantized `(1..W, 1..H)` coordinates of the hovered or last-tapped LED pad cell + active press boolean. |
| Virtual D-Pad / `On Key` & `On Tap` | `▲▼◀▶ 🅰️🅱️` | `inter` | Cross-device touch/keyboard controls supporting both polling and **single-threaded queued event dispatch** (`On Tap → F1`) for playable synths and mini-games. |

- **Sparse Memory Tape:** `10,000` sparse cells in a `shrink-0` Tape Dock below the Beat header bar, editable & saved sparsely in creative workspaces.
- **Reset Behavior:** Clears all LEDs, resets active color, resets cursor to `(1, 1)` East, and stops active synth voices.
