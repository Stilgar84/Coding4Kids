# 🎵 Beat & Light Matrix Environment Specification (High-Level)

`Beat & Light Matrix` is an **open-ended creative sandbox** environment paired alongside Turtle LOGO in [the curriculum](./curriculum.md) (Modules 1–4 and 6). It gives learners a rhythmic, musical, and pixel-art canvas—ideal for newcomers who resonate strongly with sound, animation, and pattern play—while adhering strictly to `robotemu`'s **zero-reading** design.

---

## 1. Visual & Audio Simulation Model

- **8×8 RGB LED Pad:** High-contrast rounded pixel matrix (`x = 1..8`, `y = 1..8`) with smooth glow transitions.
- **Beat Pulse & Audio Synth:** Lightweight Web Audio synthesizer (clean pentatonic/major scale notes + crisp percussion hits) synchronized to interpreter ticks, accompanied by a visual beat-ring indicator so the environment works even when muted.
- **LED Cursor (Optional Visible Marker):** A subtle corner reticle showing the current cursor `(x, y)` and heading when cursor-stepping blocks are used in Module 3 loops.
- **No Pass/Fail Grading:** Lessons in Beat & Light never fail. Each lesson loads a **working starter example** in the workspace and offers **2–3 Variation Cards**.

### Zero-Reading Variation Card UX
- Because static thumbnails cannot convey melody or animation, each Beat & Light variation card features:
  1. An **animated mini 8×8 preview** + **in-card Play/Listen button** (`▶`) so learners can watch and hear the target variation before touching their workspace.
  2. A **Copy / Load Code** button that loads that variation's exact block program into the workspace (integrated with 1-tap **Undo** so existing work is safe).

---

## 2. Action Blocks (Staged by Curriculum Module)

To prevent cognitive overload, the palette exposes simple **parameterless blocks in Module 1** and unlocks **parameterized / coordinate blocks in Module 2+**.

### Tier 1: Parameterless Blocks (Module 1 Onboarding)

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `DRUM_KICK` | Bass drum icon | Repeat badge (`×N` in M2+) | Plays a punchy kick drum hit (1 beat). |
| `DRUM_SNARE` | Snare / drumsticks | Repeat badge (`×N` in M2+) | Plays a crisp snare hit (1 beat). |
| `DRUM_CLAP` | Clapping hands | Repeat badge (`×N` in M2+) | Plays a handclap accent (1 beat). |
| `PLAY_CHIME` | Bell / sparkle | Repeat badge (`×N` in M2+) | Plays a bright celebratory chime (1 beat). |
| `STAMP_HEART` / `STAMP_STAR` / `STAMP_SMILE` *(grouped under `STAMP_PRESET` in M2+)* | Mini 8×8 pixel glyph | Preset icon badge (in M2+) | Lights a recognizable 8×8 pixel icon on the matrix. |
| `WAIT_BEAT` | Hourglass / rest note | Repeat badge (`×N` in M2+) | Holds current LEDs silent for 1 beat. |
| `CLEAR_LEDS` | Eraser / dark grid | None | Clears all 64 LEDs to off. |

### Tier 2: Parameterized Sound, Style & Grid Blocks (Modules 2–6)

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `PLAY_NOTE` | Musical note | **Pitch** (`1..8` visual scale bar / variable `a..z`), **Duration** (`½`, `1`, `2` beats) | Plays the selected scale note for the chosen beat length. |
| `SET_LED_COLOR` | Palette swatch | **Color** (8 high-contrast swatches, or color index `1..8` via variable in M6+) | Sets the active LED color (persists until changed, mirroring LOGO `Pen Color`). |
| `LIGHT_ROW` | Horizontal lit bar | **Row `y`** (`1..8` or variable `a..z`) | Lights all 8 pixels in row `y` using the active LED color. |
| `LIGHT_COL` | Vertical lit bar | **Col `x`** (`1..8` or variable `a..z`) | Lights all 8 pixels in column `x` using the active LED color. |
| `LIGHT_PIXEL` | Single lit dot | **Col `x`** (`1..8` or var), **Row `y`** (`1..8` or var) | Lights pixel `(x, y)` using the active LED color. |
| `CURSOR_STEP` | Pixel arrow forward | Repeat badge (`×N` or var) | Advances the LED cursor 1 pixel in its current direction and lights that pixel (wraps or clamps cleanly at edges)—enables Module 3 border/wave loops before `x, y` math is taught. |
| `CURSOR_TURN` | 90° turn arrow | Left / Right (`90°`) | Rotates the LED cursor direction on the 8×8 grid. |

---

## 3. Sensors & State

- **Sensors:** None required. As an open creative sandbox, Beat & Light relies on loops, helper functions (`F1`–`F3` for `Intro / Verse / Chorus`), and variables (`p = p + 1` pitch sweeps, `x = x + 1` laser/equalizer animations) without needing conditional sensor blocks.
- **Reset Behavior:** Pressing Reset clears all 64 LEDs, resets active LED color to default cyan/amber, resets cursor to `(1, 1)` facing East, and stops active synth notes.
