# Capstone `seq.C` — Sticker & Beat Intro

> [← Module `seq` Overview](./overview.md) · **Format:** 🎨 Capstone Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md) · **ID:** `seq.C` (Legacy Alias: `1C`)

**One-Concept Goal:** Compose a playful multi-frame sticker-and-drum showcase strictly with Module `seq`'s 9 parameterless Tier-1 Beat & Light blocks—combining `Heart`, `Star`, and `Smile` icon stamps, clean `CLEAR_LEDS` transitions, drum grooves, chimes, and `WAIT_BEAT` holds.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

This finale awards Module `seq`'s **Beat & Light Badge**. Every starter and variation card is crafted cleanly inside Tier-1 parameterless blocks (no `PLAY_NOTE` pitches, no `SET_LED_COLOR` cutouts, and no digits—which unlock in Module `param`), proving how expressive pure sequence + `CLEAR_LEDS` + `WAIT_BEAT` choreography can be! The `(1, 1)` cursor reticle and `tool-beat-active-color` swatch stay hidden.

</details>

---

## Palette, Scopes, Caps & Environment Setup

- **Allowed Blocks (`allowedSimBlocks`):** `["DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME", "STAMP_HEART", "STAMP_STAR", "STAMP_SMILE", "CLEAR_LEDS", "WAIT_BEAT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false` (`WAIT_BEAT` fixed 1-beat `0x15`)
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `null` *(Sandbox guidelines: Starter & Var 1 ≤ 14, Var 2 ≤ 20, Var 3 ≤ 30)*
- **Environment & HUD Flags (`envs/beat_light.md` §1):** `matrixSize: "8x8"`, `envVersion: 1`, `stepDelayMultiplier: 1` (`1×` × `400ms` base beat tick), **`cursor.visible: false`**, **`hideActiveColorTool: true`**, `beat-ring-pulse` active when muted.

---

## Starter Workspace (`starterWorkspace`)

### 🎉 3-Sticker Dance Party (`12` flat blocks ≤ 14)
- **MAIN (`12` blocks):**
  1. `STAMP_HEART`
  2. `DRUM_KICK`
  3. `DRUM_SNARE`
  4. `CLEAR_LEDS`
  5. `STAMP_STAR`
  6. `DRUM_CLAP`
  7. `DRUM_KICK`
  8. `CLEAR_LEDS`
  9. `STAMP_SMILE`
  10. `DRUM_SNARE`
  11. `PLAY_CHIME`
  12. `WAIT_BEAT`
- **Playback Behavior:** Cycles crisply through all 3 glowing `8×8` stickers (`Heart → Star → Smile`) paired with Kick/Snare/Clap rhythms and a celebratory Chime + Wait finale!

---

## Playable Copyable Variations (`variations[]`)

### Variation 1 (`seq.C-heart-star-march`): 🥁 Heart-Star March (`11` flat blocks ≤ 14)
- **MAIN (`11` blocks):**
  1. `STAMP_HEART`
  2. `DRUM_KICK`
  3. `DRUM_CLAP`
  4. `CLEAR_LEDS`
  5. `STAMP_STAR`
  6. `DRUM_KICK`
  7. `DRUM_CLAP`
  8. `CLEAR_LEDS`
  9. `STAMP_HEART`
  10. `PLAY_CHIME`
  11. `WAIT_BEAT`
- **Playback Behavior:** Steady two-step marching cadence (`Kick–Clap`) alternating cleanly between Heart and Star stickers before a Chime hold.

---

### Variation 2 (`seq.C-blinking-smile`): 😄 Blinking Smile Pulse (`13` flat blocks ≤ 20)
- **MAIN (`13` blocks):**
  1. `STAMP_SMILE`
  2. `DRUM_KICK`
  3. `CLEAR_LEDS`
  4. `WAIT_BEAT`
  5. `STAMP_SMILE`
  6. `DRUM_SNARE`
  7. `CLEAR_LEDS`
  8. `WAIT_BEAT`
  9. `STAMP_SMILE`
  10. `DRUM_CLAP`
  11. `CLEAR_LEDS`
  12. `STAMP_HEART`
  13. `PLAY_CHIME`
- **Playback Behavior:** Rhythmic blink-off (`CLEAR_LEDS` + `WAIT_BEAT`) + blink-on smiley groove ending in a surprise Heart Chime pop!

---

### Variation 3 (`seq.C-chime-finale`): 🌟 Chime Fanfare Finale (`15` flat blocks ≤ 30 Showcase)
- **MAIN (`15` blocks):**
  1. `STAMP_STAR`
  2. `DRUM_KICK`
  3. `DRUM_CLAP`
  4. `DRUM_SNARE`
  5. `CLEAR_LEDS`
  6. `STAMP_HEART`
  7. `DRUM_KICK`
  8. `DRUM_CLAP`
  9. `DRUM_SNARE`
  10. `CLEAR_LEDS`
  11. `STAMP_SMILE`
  12. `PLAY_CHIME`
  13. `PLAY_CHIME`
  14. `PLAY_CHIME`
  15. `WAIT_BEAT`
- **Playback Behavior:** Builds an upbeat 3-beat `Kick–Clap–Snare` drumroll across Star and Heart before bursting into a triple-Chime Smile showcase held cleanly by `WAIT_BEAT`!
