# func.C: Full Song Choreography

- **Header ID:** `func.C` (Legacy `4C`)
- **Format:** 🎨 Capstone
- **Environment:** [🎵 Beat & Light Pad](../../envs/beat_light.md)
- **One-Concept Goal:** Unlock all 4 tabs (`Main`, `F1`, `F2`, `F3`) to arrange complete concert tracks — pairing `F1` (Intro / Build), `F2` (Verse / Beat Groove), and `F3` (Chorus / Drop) cleanly from `Main` using canonical `1..8` pitches, `⚡0` / `1×` beat-delay batching, `0..7` `STAMP_PRESET` icons, and strictly `1..8 × 1..8` pixel coordinates.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

All three musical helper tabs (`F1`, `F2`, `F3`) are yours to conduct! Give `F1` an opening fanfare or siren, teach `F2` a steady dance groove or rocket launch, build your big bright Chorus drop in `F3`, and then arrange the full concert inside `Main` (`Intro → Verse → Chorus → Verse → Chorus → Finale`). Just like in `func.3`, keep `STAMP_PRESET` *before* `LIGHT_ROW` / `LIGHT_COL` / `LIGHT_PIXEL` accents inside `⚡0` (`0ms`) blocks so every frame lights up together on beat!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule; Starter + 3 Variation Cards display animated previews + in-card Play `▶` button).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1", "F2", "F3"]` (all 4 tabs active).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["PLAY_NOTE", "DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME", "STAMP_PRESET", "SET_LED_COLOR", "SET_BEAT_DELAY", "LIGHT_ROW", "LIGHT_COL", "LIGHT_PIXEL", "WAIT_BEAT", "CLEAR_LEDS"]`
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`targets: ["F1", "F2", "F3"]` from `MAIN`; acyclic lower-tier helper calls permitted)
  - `allowedBlockParams`:
    - `PLAY_NOTE`: `pitch: [1, 2, 3, 4, 5, 6, 7, 8]`, `duration: [0.5, 1, 2]`
    - `STAMP_PRESET`: `preset: [0..7]` (`0=Heart, 1=Star, 2=Smile, 3=Crown, 4=Note, 5=Bolt, 6=Rocket, 7=Robot`)
    - `SET_LED_COLOR`: canonical `0..9` (`black`/`⊘` Off, `red`, `blue`, `green`, `amber`, `purple`, `pink`, `cyan`, `orange`, `white`)
    - `SET_BEAT_DELAY`: canonical `stepDelayMultiplier: [0, 0.25, 0.5, 1, 2, 4]` (`⚡0`, `¼×`–`4×`)
    - `LIGHT_ROW` / `LIGHT_COL` / `LIGHT_PIXEL`: `1..8` (strictly `1..8 × 1..8`)
    - `WAIT_BEAT`: `[0.5, 1, 2]`
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `true`
- **Slot Trays:** Creative Capstone — soft visual guidance (`Starter` keeps every tab `≤ 14` flat blocks).
- **UI Coach Spotlights (`uiSpotlights`):** `["all-4-tabs-concert-form", "preset-0-to-7-showcase", "zero-delay-composite-frames"]`
- **Environment State:** `ENV_VERSION_BEAT = 1` (`8 × 8` matrix, `x = 1..8, y = 1..8`, `tool-beat-active-color` visible, cursor reticle hidden `visible: false`).

---

## Starter & Variation Cards

### Starter Card: Intro–Verse–Chorus Concert (`7 + 9 + 10 + 11 = 37` flat blocks)

- **Concept:** Classic pop arrangement in `Main` (`Intro F1 → [Verse F2 → Chorus F3] × 2 → Crown Finale + Chime`), keeping every scope `≤ 10` blocks.
- **`MAIN` (`7` flat blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "CALL_FN", "fn": "F3" }
      ]
    },
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "PLAY_CHIME" }
  ]
  ```
- **`F1` — Intro Curtain (`Crown` `3`, `9` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 3 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_ROW", "row": 1 },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 1 }
  ]
  ```
- **`F2` — Groove Verse (`Note` `4`, `10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "purple" },
    { "op": "STAMP_PRESET", "preset": 4 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_KICK" },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "DRUM_SNARE" },
    { "op": "PLAY_NOTE", "pitch": 4, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "DRUM_CLAP" }
  ]
  ```
- **`F3` — Star Chorus (`Star` `1` + `Heart` `0`, `11` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "STAMP_PRESET", "preset": 0 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 }
  ]
  ```

---

### Variation 1: Arcade Boss Battle (`7 + 10 + 14 + 10 = 41` flat blocks)

- **Concept:** `F1` flashes a red/amber `Bolt` alert siren (`preset 5`), `F2` sweeps cyan & orange laser columns with heavy boss drums, and `F3` unlocks the purple `Crown` victory fanfare!
- **`MAIN` (`7` flat blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [{ "op": "CALL_FN", "fn": "F2" }]
    },
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "CALL_FN", "fn": "F3" },
    { "op": "PLAY_CHIME" }
  ]
  ```
- **`F1` — Alert Siren (`Bolt` `5`, `10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "red" },
    { "op": "STAMP_PRESET", "preset": 5 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "LIGHT_ROW", "row": 1 },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 2, "duration": 0.5 },
    { "op": "DRUM_CLAP" }
  ]
  ```
- **`F2` — Laser Sweep (`14` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_COL", "col": 2 },
    { "op": "LIGHT_COL", "col": 7 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_KICK" },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "orange" },
    { "op": "LIGHT_ROW", "row": 4 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_SNARE" },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 }
  ]
  ```
- **`F3` — Victory Crown (`Crown` `3`, `10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 3 },
    { "op": "SET_LED_COLOR", "color": "green" },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 }
  ]
  ```

---

### Variation 2: Fireworks Finale (`7 + 12 + 16 + 9 = 44` flat blocks)

- **Concept:** Three firework rockets launch in sequence! `F1` launches an orange `Rocket` (`6`) trail; `F2` explodes a cyan & pink cross + 4-corner sparkle burst (`1..8` pixels strictly in bounds); `F3` sprinkles a shimmering gold `Star` (`1`) with ascending arpeggios!
- **`MAIN` (`7` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "CALL_FN", "fn": "F3" }
      ]
    },
    { "op": "CALL_FN", "fn": "F3" },
    { "op": "PLAY_CHIME" }
  ]
  ```
- **`F1` — Rocket Trail (`Rocket` `6`, `12` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "orange" },
    { "op": "STAMP_PRESET", "preset": 6 },
    { "op": "SET_LED_COLOR", "color": "red" },
    { "op": "LIGHT_PIXEL", "col": 4, "row": 7 },
    { "op": "LIGHT_PIXEL", "col": 5, "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "DRUM_SNARE" },
    { "op": "WAIT_BEAT", "duration": 0.5 }
  ]
  ```
- **`F2` — Sky Cross Burst (`16` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_ROW", "row": 4 },
    { "op": "LIGHT_COL", "col": 4 },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "LIGHT_PIXEL", "col": 2, "row": 2 },
    { "op": "LIGHT_PIXEL", "col": 7, "row": 2 },
    { "op": "LIGHT_PIXEL", "col": 2, "row": 7 },
    { "op": "LIGHT_PIXEL", "col": 7, "row": 7 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_CLAP" },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 7, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 }
  ]
  ```
- **`F3` — Gold Sparkle (`Star` `1`, `9` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 },
    { "op": "DRUM_KICK" },
    { "op": "PLAY_CHIME" }
  ]
  ```

---

### Variation 3: 🤖 Robot Boogie (`10 + 13 + 13 + 15 = 51` flat blocks)

*(Showcases `STAMP_PRESET 7='Robot'` alongside `Smile` `2` and `Note` `4` in a lively LED dance party!)*

- **Concept:** `F1` steps the Cyan `Robot` (`7`) left with top-corner disco lights; `F2` steps the Pink `Robot` (`7`) right over a glowing amber dancefloor (`row 8`); `F3` drops the `Note` (`4`) → `Smile` (`2`) disco finale! `Main` kicks off with `F3`, loops `[F1 → F2]` twice, and closes with `F3`!
- **`MAIN` (`10` flat blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F3" },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    },
    { "op": "CALL_FN", "fn": "F3" },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "green" },
    { "op": "STAMP_PRESET", "preset": 2 },
    { "op": "PLAY_CHIME" }
  ]
  ```
- **`F1` — Cyan Robot Left Groove (`13` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "STAMP_PRESET", "preset": 7 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "LIGHT_PIXEL", "col": 1, "row": 1 },
    { "op": "LIGHT_PIXEL", "col": 8, "row": 1 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_KICK" },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "DRUM_SNARE" },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "DRUM_CLAP" },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 }
  ]
  ```
- **`F2` — Pink Robot Dancefloor (`13` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "STAMP_PRESET", "preset": 7 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_KICK" },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "DRUM_SNARE" },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "DRUM_CLAP" },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 },
    { "op": "DRUM_KICK" }
  ]
  ```
- **`F3` — Disco Beat Drop (`15` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "purple" },
    { "op": "STAMP_PRESET", "preset": 4 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_COL", "col": 1 },
    { "op": "LIGHT_COL", "col": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "DRUM_CLAP" }
  ]
  ```

---

## Edge Cases & Acceptance Criteria
- **Coordinate Safety:** All `LIGHT_ROW`, `LIGHT_COL`, and `LIGHT_PIXEL` indices sit strictly in `1..8`.
- **Pitch Safety:** All `PLAY_NOTE` pitches sit strictly in `1..8` (`C4..C5`).
- **All 8 `STAMP_PRESET` Shapes Covered:** Across `func.3` and `func.C`, learners see `0=Heart, 1=Star, 2=Smile, 3=Crown, 4=Note, 5=Bolt, 6=Rocket, 7=Robot`.
- **No Recursion:** `allowRecursion: false`.
