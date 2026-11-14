# 🎵 Beat & Light Matrix Environment Specification

`Beat & Light Matrix` is an **open-ended musical, rhythmic, pixel-art, and interactive sandbox** environment paired alongside [Turtle LOGO](./turtle_logo.md) across Core Modules `seq`–`tape` (including `branch`, `while`, and `cmp`), `args`, and Side Modules `anim`, `inter`, and `conc` of [the curriculum](../curriculum/overview.md). It gives learners an immediate audiovisual canvas while keeping programming **100% zero-reading**.

*(For cross-environment features—including the unified 10-swatch `PALETTE_COLORS` / `TypedValue` system, shared Sparse Memory Tape, `$input` & `🎲` random sensors, queued events, and concurrency primitives—see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for HUD layout, see [UI Guidelines](../ui_guidelines.md).)*

---

## 1. Visual & Audio Simulation Model

- **RGB LED Matrix (`8×8` Core; `16×16` & `32×32` Unlocked in `inter`/`anim` & Pro Sandbox):** High-contrast rounded pixel pad (`x = 1..W`, `y = 1..H`, fixed at `8×8` in core lessons so coordinates `1..8` align 1:1 with the core musical octave and keep touch targets large). Non-`8×8` sandbox saves or extended v2 capabilities encode via `ENV_VERSION_BEAT = 2` (`BEAT_VERSION = 2`; classic `8×8` programs preserve `ENV_VERSION_BEAT = 1` with zero state header).
- **Beat Pulse, 2-Octave Synth & Polyphonic Limiter:** Lightweight Web Audio synthesizer (`1..8` C Major `C4..C5` core, extended to `1..16` `C4..D6` in `var`+/sandbox) plus crisp percussion hits synchronized to interpreter beats, routed through a master `DynamicsCompressorNode` limiter so concurrent `conc` bands never clip, and paired with a visual beat-ring indicator (`beat-ring` / `beat-ring-pulse`) so lessons work even when muted. Out-of-range pitches (`< 1` or `> 16`) play as a silent rest, and fractional values truncate via `Math.trunc`.
- **LED Cursor (`(1, 1)` Conditional Reticle & Canvas Header Clearance):** Resets cleanly to `(1, 1)` facing East with `visible: false` so `seq`/`param` learners never see a stray corner bracket before cursor blocks exist. Once `CURSOR_STEP` or `CURSOR_TURN` executes, `beat-cursor-reticle` reveals a high-contrast ring + directional triangle arrow on cell `(x, y)` (compact mini `VariationCardsPanel` previews intentionally keep a white ring border only). Top-bar indicators (`beat-cue-indicator` with `🎵 #N` beat counter, gated `tool-beat-active-color` shown only when `SET_LED_COLOR` is in the lesson palette, `Loop ∞`, `🔊`/`🔇` mute) live in `BeatCanvas`'s dedicated `shrink-0` **Canvas Header Row** above the LED grid, keeping `SimulationTopLeftHud` (`VARS`, `CallStack`, `conc` waits) clear of header pills and pad cells.
- **No Pass/Fail Grading & Variation Cards:** Each lesson loads a **working starter example** and offers **2–4 Variation Cards** (with an **animated mini preview + in-card Play/Listen `▶` button** and Undo-safe **Copy / Load Code**; Variation 2 and Variation 3+ enjoy progressive showcase block allowances).
- **Selective Color Erasing (`Black` / Off):** `SET_LED_COLOR [Black]` renders visibly as **LED Off / Erase** everywhere in Beat (`BeatCanvas` `tool-beat-active-color`, workspace `SET_LED_COLOR` block badge, and the color picker show a recessed shaded off-pad with a `⊘` erase cue — never unshaded black), and `LIGHT_PIXEL`, `LIGHT_ROW`, `LIGHT_COL`, `CURSOR_STEP`, or `STAMP_*` clear targeted LEDs to unlit (`null` recessed off-pad; never flat black `#0f172a`) without wiping the entire pad.
- **Serializer Backward Compatibility (`BEAT_LED_PALETTE`):** `OP_BEAT_SET_LED_COLOR` (`0x18`) preserves `BEAT_LED_PALETTE` wire indices `0..7` (`0=Cyan, 1=Rose, 2=Amber, 3=Emerald, 4=Purple, 5=Blue, 6=Orange, 7=Pink`) plus `8 = Black` and `9 = White`, while shared variables/Tape map canonical `PALETTE_COLORS` (`0..9`) cleanly through Beat's `TypedValue` color adapter.

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
| `PLAY_NOTE` | Musical note | **Pitch** (`1..8` C4–C5 core scale bar, `1..16` C4–D6 in `var`+/sandbox or variable; fractional values truncate via `Math.trunc`; out-of-range plays a silent rest), **Duration** (`½`, `1`, `2` beats in v1; `⅛`, `¼`, `½`, `1`, `2`, `4` or variable in `ENV_VERSION_BEAT = 2`) | Plays the selected scale note for the chosen beat length (or silent rest if `< 1` or `> 16`). |
| `SET_LED_COLOR` | Palette swatch (`⊘` for `Black`/Off) | **Color** (`0..9` swatches or typed color variable / `$cellColor` / `$randomColor`) | Sets active LED color (`Black` renders visibly turned Off with `⊘` Erase cue on main view/picker and selectively extinguishes target LEDs). |
| `SET_BEAT_DELAY` | ⚡ Gauge | **Step Delay Multiplier** (`0` = 0ms synchronous batching for non-sound blocks; `0.25×`, `0.5×`, `1×`, `2×`, `4×` × global tick `400ms`; optional `0.125×` in `anim`/v2 or numeric variable in `var`+) | Controls step delay between non-sound LED actions (sound & `WAIT_BEAT` blocks keep full beat timing). Preserves `BeatDelayVisual` (`⚡0`, `¼×`–`4×`). |
| `LIGHT_ROW` / `LIGHT_COL` | Lit bar | **Row `y` / Col `x`** (`1..H` / `1..W` or variable, truncated via `Math.trunc`) | Lights an entire row or column using active LED color; out-of-bounds indices execute cleanly as silent no-ops. |
| `LIGHT_PIXEL` | Single lit dot | **Col `x`**, **Row `y`** (`1..W`, `1..H` or variable, truncated via `Math.trunc`) | Lights pixel `(x, y)` using active LED color; out-of-bounds coordinates execute cleanly as silent no-ops. |
| `CURSOR_STEP` / `CURSOR_TURN` | Pixel arrow / 90° turn | Repeat badge / Left-Right | Steps or rotates the LED cursor (starting `(1, 1)` East, revealed on first cursor step/turn) to draw borders and waves before coordinate math. Soft edge-clamps on boundaries with an `edgeBonk` cue (`while`+) so `While (NOT cursorAtEdge)` terminates cleanly. |
| `STAMP_FROM_TAPE` | `📼→🟦` Tape sprite stamp | None *(reads from active `headPos`, unlocked in `tape`+; encoded via `OP_EXT 0x0F`, `extOpcode = 0x20`)* | Blits `W × H` cells (`headPos .. headPos + W*H - 1`, row-major `(1,1)..(W,H)`) onto the LED matrix in 1 tick as a **customizable sprite stamp** (`headPos` stays put): **color** cells light pixels (`Black` clears to off), **empty (`∅`)** cells act as **transparent** (preserving underlying LEDs), **number** cells trigger `TYPE_ERROR`, and `headPos + width * height - 1 > $tapeLength` triggers `COLLISION`. |

---

## 3. Explicit Hardware Frame Loops (`anim`) vs. Concurrency Bands (`conc`)

- **Explicit Display-Buffer Frame Loops (`anim`):** While [Turtle LOGO](./turtle_logo.md) uses high-level Flipbook Mode, Beat & Light intentionally retains explicit loop-based frame batching (`SET_BEAT_DELAY [0]` → `Loop` → `CLEAR_LEDS` first → draw pixels → `WAIT_BEAT`) so learners also master how real-time hardware LED matrices refresh!
- **Modulo Sequencers & Checkerboards (`cmp`):** Uses `%` to trigger polyrhythms (`$beatIndex % 4 == 1` kick, `$beatIndex % 2 == 0` snare) and 2D parity patterns (`(x + y) % 2 == 0`).
- **Multi-Track Bands, Fork/Join & Barriers (`conc`):** Primary onboarding world for Concurrency—`Main 1..4` (`Drums`, `Melody`, `LED Show`), `FORK`/`JOIN`, `LOCK`/`UNLOCK`, `SEND`/`$recv`, and `🚧 Sync Barrier` advance together against the shared beat clock and `BeatState`, while polyphonic synth voices route cleanly through a Master `DynamicsCompressorNode`.

---

## 4. Sensors, Queued Events (`inter`) & Sparse Tape Integration

| Sensor / Trigger | Badge | Introduced | Meaning |
| :--- | :---: | :---: | :--- |
| `$input` | `🎛️` | `branch` | Scene Input Selector value (`1..8` or color swatch) from the Top Dock widget; auto-reruns on change for interactive jukeboxes and mood pads. |
| `cursorAtEdge` | `🧱` | `while` | `true` when the LED cursor sits at matrix boundary facing outward (`COND_TAG = 0x2A`; enables `While (NOT cursorAtEdge)` border/spiral fills before variables). |
| `$cursorX`, `$cursorY`, `$beatIndex` | `📍X`, `📍Y`, `🎵#` | `var` / `cmp` | Read-only Beat cursor `(1..W, 1..H)` coordinates (`0xB0`/`0xB1`) and global beat counter (`0xB2`). |
| `🎲 $rand` / `$randomColor` | `🎲` / `🎨🎲` | `var` / Sandbox | Fresh dice roll (`Coin 0..1`, `D4`, `D6`, **`D8 (1..8)`**, `D20`, `[0, 1)` float) or vibrant color swatch on each read. |
| `$pointerX`, `$pointerY`, `$pointerDown` | `👆X`, `👆Y`, `👆●` | `inter` | Quantized `(1..W, 1..H)` coordinates of the hovered or last-tapped LED pad cell + active press boolean. |
| Virtual D-Pad / `keyHeld` / `On Key` & `On Tap` | `▲▼◀▶ 🅰️🅱️` | `inter` | Cross-device touch/keyboard controls supporting `keyHeld` (`0x2E`) polling and **single-threaded queued event dispatch** (`ON_TAP 0x40`, `ON_KEY_* 0x41..0x46 → F1`) for playable synths and mini-games. |

- **Sparse Memory Tape:** `10,000` sparse cells in the `shrink-0` Top Dock `TapeDock` above Beat's Canvas Header Row, editable & saved sparsely (`ENV_VERSION_BEAT = 2`) in creative workspaces.
- **Reset Behavior:** Clears all LEDs (`null`), resets active color & `isColorCustomized = false`, resets cursor to `(1, 1)` East (`visible: false`), resets `stepDelayMultiplier = 1`, and stops active synth voices.
