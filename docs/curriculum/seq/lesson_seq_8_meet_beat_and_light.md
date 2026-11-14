# Lesson `seq.8` — Drum Pads & Icon Stamps

> [← Module `seq` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md) · **ID:** `seq.8` (Legacy Alias: `1.8`)

**One-Concept Goal:** Freely sequence parameterless Tier-1 drum hits (`Kick`, `Snare`, `Clap`), bell chimes (`Chime`), `8×8` preset icon stamps (`Heart`, `Star`, `Smile`), `Clear`, and `Wait` rests in an open-ended audio-visual Beat sandbox.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

In Beat & Light sandboxes, there is no pass/fail puzzle check. Learners can tap Play inside each **Variation Card** (`▶` preview) to hear the rhythm and watch its animated mini `8×8` preview before copying it into the workspace with 1-tap Undo protection. Remember: `STAMP_*` stamps only foreground pixels, so `CLEAR_LEDS` erases prior stamps cleanly and `WAIT_BEAT` pauses 1 beat (`400ms`) so each picture stays readable. The `(1, 1)` cursor reticle and active-color swatch stay hidden in `seq`.

</details>

---

## Palette, Scopes, Caps & Environment Setup

- **Allowed Blocks (`allowedSimBlocks`):** `["DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME", "STAMP_HEART", "STAMP_STAR", "STAMP_SMILE", "CLEAR_LEDS", "WAIT_BEAT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false` (`WAIT_BEAT` fixed 1-beat `0x15`)
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `null` *(Sandbox budget: Starter & Var 1 ≤ 14, Var 2 ≤ 20, Var 3 ≤ 30)*
- **Environment & HUD Flags (`envs/beat_light.md` §1):** `matrixSize: "8x8"`, `envVersion: 1`, `stepDelayMultiplier: 1` (`1×` × `400ms` base beat tick), **`cursor.visible: false`**, **`hideActiveColorTool: true`**, `beat-ring-pulse` active when muted.

---

## Starter Workspace (`starterWorkspace`)

### ❤️ Heart & Star Beat (`8` flat blocks ≤ 14)
- **MAIN (`8` blocks):**
  1. `STAMP_HEART`
  2. `DRUM_KICK`
  3. `DRUM_SNARE`
  4. `CLEAR_LEDS`
  5. `STAMP_STAR`
  6. `DRUM_KICK`
  7. `PLAY_CHIME`
  8. `WAIT_BEAT`
- **Playback Behavior:** Displays Rose Heart across beats 1–2 (`Kick`, `Snare`), clears clean before flashing Amber Star across beats 3–4 (`Kick`, `Chime`, `Wait` hold).

---

## Playable Copyable Variations (`variations[]`)

### Variation 1 (`seq.8-rock-smiley`): 😊 Rock Beat + Blinking Smiley (`9` flat blocks ≤ 14)
- **MAIN (`9` blocks):**
  1. `STAMP_SMILE`
  2. `DRUM_KICK`
  3. `DRUM_SNARE`
  4. `CLEAR_LEDS`
  5. `WAIT_BEAT`
  6. `STAMP_SMILE`
  7. `DRUM_KICK`
  8. `DRUM_CLAP`
  9. `DRUM_SNARE`
- **Playback Behavior:** Classic `Kick–Snare` then `Kick–Clap–Snare` groove while the Cyan Smiley cleanly blinks off (`CLEAR_LEDS` + `WAIT_BEAT`) and back on!

---

### Variation 2 (`seq.8-star-fanfare`): 🌟 3-Chime Star Fanfare (`8` flat blocks ≤ 14)
*(Fixes legacy missing `sparkle` stamp strictly using `STAMP_STAR` & `STAMP_HEART`.)*
- **MAIN (`8` blocks):**
  1. `STAMP_STAR`
  2. `PLAY_CHIME`
  3. `CLEAR_LEDS`
  4. `STAMP_HEART`
  5. `PLAY_CHIME`
  6. `CLEAR_LEDS`
  7. `STAMP_STAR`
  8. `PLAY_CHIME`
- **Playback Behavior:** Alternating `Star → Heart → Star` chime sequence with crisp single-frame transitions.

---

### Variation 3 (`seq.8-clap-stomp`): 👏 Clap-Clap-Stomp Groove (`8` flat blocks ≤ 14)
- **MAIN (`8` blocks):**
  1. `STAMP_SMILE`
  2. `DRUM_CLAP`
  3. `DRUM_CLAP`
  4. `DRUM_KICK`
  5. `CLEAR_LEDS`
  6. `STAMP_STAR`
  7. `DRUM_CLAP`
  8. `DRUM_KICK`
- **Playback Behavior:** Energetic rhythm call-and-response flipping cleanly from Smiley (`Clap–Clap–Kick`) to Star (`Clap–Kick`).
