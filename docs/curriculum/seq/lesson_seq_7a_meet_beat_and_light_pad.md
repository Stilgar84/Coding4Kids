# Lesson `seq.7a` — Meet the Beat & Light Pad

> [← Module `seq` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md) · **ID:** `seq.7a` *(New Pre-Sandbox Onboarding)*

**One-Concept Goal:** Introduce the `8×8` Beat & Light LED matrix, beat-synchronized drum/chime playback, visual `beat-ring` rhythm feedback, and foreground-overlay icon stamping (`STAMP_*` + `CLEAR_LEDS` + `WAIT_BEAT`) before open Beat remixing in [`seq.8`](./lesson_seq_8_meet_beat_and_light.md).

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Because Beat & Light is a brand-new simulation environment (`../overview.md` §2.1), this quick 2-tab demo lets kids watch & listen before editing. Notice two subtle behaviors highlighted visually here:
1. Audio blocks (`DRUM_KICK`, `DRUM_SNARE`, `DRUM_CLAP`, `PLAY_CHIME`) and `WAIT_BEAT` each play on a **1-beat clock** (`400ms` base tick, flashing the visual `beat-ring` even when muted `🔇`), whereas `STAMP_*` updates LEDs visually on its step multiplier (`stepDelayMultiplier: 1`, `1×` × `400ms`, before `0ms` batching unlocks in `param`).
2. `STAMP_HEART`, `STAMP_STAR`, and `STAMP_SMILE` light **foreground icon pixels only** without clearing old LEDs underneath—so placing `CLEAR_LEDS` before the next stamp keeps each icon crisp, and `WAIT_BEAT` holds the finished picture visible at the end!

</details>

---

## Palette, Scopes, Flags & UI Spotlights

- **Allowed Blocks (`allowedSimBlocks`):** `["DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME", "STAMP_HEART", "STAMP_STAR", "STAMP_SMILE", "CLEAR_LEDS", "WAIT_BEAT"]` *(Tier-1 9-block Beat subset)*
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false` (`WAIT_BEAT` uses fixed 1-beat `0x15`)
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `null` *(read-only demo tabs)*
- **Environment & HUD Flags (`envs/beat_light.md` §1):**
  - `matrixSize: "8x8"`, `envVersion: 1`, `stepDelayMultiplier: 1` (`1×` × `400ms` base beat tick)
  - **`cursor.visible: false`:** The `(1, 1)` LED cursor reticle remains **hidden** throughout `seq` (unlocked later in `loop.3a`).
  - **`hideActiveColorTool: true`:** `tool-beat-active-color` swatch is hidden in `BeatCanvas`'s Canvas Header Row because `SET_LED_COLOR` is absent.
  - **`beat-ring-pulse`:** Visual beat indicator flashes on every beat (works muted or unmuted).
- **UI Coach Spotlights (`pointer-events-none`):**
  - Coach rings below `btn-play` (`▶`) and `btn-step` (`⏭`) in `<header>`.
  - Tab 1 spotlights `beat-ring` pulsing on drum/chime hits; Tab 2 spotlights `STAMP_HEART` pixels lighting up, `CLEAR_LEDS` erasing before `STAMP_STAR`, and `WAIT_BEAT` pausing cleanly.

---

## Matrix Stamps Reference (`8×8`, Tier-1 Presets)

- `STAMP_HEART` (`0x14`, `presetByte: 0`): Preset Rose/Red 8×8 heart foreground pixels.
- `STAMP_STAR` (`0x14`, `presetByte: 1`): Preset Amber/Yellow 8×8 star foreground pixels.
- `STAMP_SMILE` (`0x14`, `presetByte: 2`): Preset Cyan/Emerald 8×8 smiley foreground pixels.
- *(All stamps leave non-icon pixels untouched—overlay behavior—so `CLEAR_LEDS` clears prior lit cells.)*

---

## Demo Tabs (`demoTabs[]`)

### Tab 1 (`seq.7a-tab-1`): 🥁 1 — Drums, Chime & Beat Ring
- **Workspace (`MAIN`, `4` flat blocks):**
  1. `DRUM_KICK` *(Beat 1: Kick hit + `beat-ring` pulse)*
  2. `DRUM_SNARE` *(Beat 2: Snare hit + `beat-ring` pulse)*
  3. `DRUM_KICK` *(Beat 3: Kick hit + `beat-ring` pulse)*
  4. `PLAY_CHIME` *(Beat 4: Bright C5 chime + `beat-ring` pulse)*

### Tab 2 (`seq.7a-tab-2`): 💡 2 — Stamp, Clear & Hold
- **Workspace (`MAIN`, `7` flat blocks):**
  1. `STAMP_HEART` *(Lights 8×8 Rose Heart on matrix)*
  2. `DRUM_KICK` *(Beat 1 while Heart glows)*
  3. `WAIT_BEAT` *(Beat 2 pause so Heart stays clearly visible)*
  4. `CLEAR_LEDS` *(Wipes Heart pixels clean before stamping Star)*
  5. `STAMP_STAR` *(Lights crisp Amber Star with zero leftover Heart pixels)*
  6. `PLAY_CHIME` *(Beat 3 celebratory chime)*
  7. `WAIT_BEAT` *(Beat 4 hold showing finished Star)*

---

## Initial Starter Workspace (`starterWorkspace`)

Mirrors Tab 2 (`[STAMP_HEART, DRUM_KICK, WAIT_BEAT, CLEAR_LEDS, STAMP_STAR, PLAY_CHIME, WAIT_BEAT]`, `7` blocks) so learners immediately experience full audio-visual choreography.
