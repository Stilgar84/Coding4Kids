# func.3: Chorus & Verse Composition

- **Header ID:** `func.3` (Legacy `4.3`)
- **Format:** 🎨 Creative
- **Environment:** [🎵 Beat & Light Pad](../../envs/beat_light.md)
- **One-Concept Goal:** Separate a song-and-light performance into named musical sections — `F1` (Verse) and `F2` (Chorus) — and arrange `Main` cleanly using `CALL F1`, `CALL F2`, and `Loop`, keeping every coordinate strictly inside the `8 × 8` matrix (`1..8 × 1..8`) and every pitch in the core `1..8` C Major octave.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Composers break songs into parts like **Verse (`F1`)** and **Chorus (`F2`)** instead of writing every note twice! Setting `SET_BEAT_DELAY` to `⚡0` (`0ms`) before stamping a pixel icon and adding extra `LIGHT_ROW` / `LIGHT_COL` accents paints the whole picture in one clean frame, then restoring `⚡1×` (`400ms`) lets the lights hold while `PLAY_NOTE` plays the melody. Remember `STAMP_PRESET` replaces the entire `8×8` grid, so place any `LIGHT_ROW` / `LIGHT_COL` / `LIGHT_PIXEL` overlays *after* `STAMP_PRESET`!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule; Starter + 3 Variation Cards use mini visual previews + in-card Play/Listen `▶` button).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1", "F2"]` (`F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["PLAY_NOTE", "DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME", "STAMP_PRESET", "SET_LED_COLOR", "SET_BEAT_DELAY", "LIGHT_ROW", "LIGHT_COL", "LIGHT_PIXEL", "WAIT_BEAT", "CLEAR_LEDS"]`
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`targets: ["F1", "F2"]` in `MAIN`; `F1` cannot call `F1`; no cycle `F1 ↔ F2`)
  - `allowedBlockParams`:
    - `PLAY_NOTE`: `pitch: [1, 2, 3, 4, 5, 6, 7, 8]` *(strictly core C4–C5 octave; zero pitches `> 8`)*, `duration: [0.5, 1, 2]`
    - `STAMP_PRESET`: `preset: [0, 1, 2, 3, 4, 5, 6, 7]` (`0=Heart, 1=Star, 2=Smile, 3=Crown, 4=Note, 5=Bolt, 6=Rocket, 7=Robot`) + `color: [0..9]`
    - `SET_LED_COLOR`: canonical `0..9` (`black`/`⊘` Off, `red`, `blue`, `green`, `amber`, `purple`, `pink`, `cyan`, `orange`, `white`)
    - `SET_BEAT_DELAY`: canonical `stepDelayMultiplier: [0, 0.25, 0.5, 1, 2, 4]` (`BeatDelayVisual`: `⚡0`, `¼×`, `½×`, `1×`, `2×`, `4×` × `400ms`)
    - `LIGHT_ROW` / `LIGHT_COL` / `LIGHT_PIXEL`: `1..8` (1-indexed LED grid; zero `0` or `> 8` coordinates)
    - `WAIT_BEAT`: `[0.5, 1, 2]`
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `true`
- **Slot Trays:** Creative sandbox — soft visual caps only (Starter & Var 1 ≤ `14`/tab & `24` total; Var 2 ≤ `20`/tab & `40` total; Var 3 ≤ `30`/tab & `60` total).
- **UI Coach Spotlights (`uiSpotlights`):** `["scope-tabs-f1-f2", "beat-delay-zero-batch", "stamp-before-overlay"]`
- **Environment State:** `ENV_VERSION_BEAT = 1` (`8 × 8` pad, `x = 1..8, y = 1..8`, LED cursor starts at `(1, 1)` East with `visible: false`, global tick `400ms`). `tool-beat-active-color` visible because `SET_LED_COLOR` is in palette.

---

## Starter & Variation Cards

### Starter Card: Chorus–Verse Duet (`4 + 7 + 6 = 17` flat blocks)

- **Concept:** `Main` repeats `[Verse (F1) → Chorus (F2)]` twice using a single `4`-block loop.
- **`MAIN` (`4` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    }
  ]
  ```
- **`F1` — Verse (`7` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 1 }
  ]
  ```
- **`F2` — Chorus (`6` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "STAMP_PRESET", "preset": 0 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 }
  ]
  ```

---

### Variation 1: Arcade Power-Up Beat (`3 + 10 + 7 = 20` flat blocks)

- **Concept:** Combines a crisp `Star` stamp with top/bottom gold border bars (`LIGHT_ROW(1)` and `LIGHT_ROW(8)`) in `F1`, followed by a sparkling `Crown` response in `F2`.
- **`MAIN` (`3` flat blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "CALL_FN", "fn": "F2" },
    { "op": "CALL_FN", "fn": "F1" }
  ]
  ```
- **`F1` — Sparkle Border Sweep (`10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "LIGHT_ROW", "row": 1 },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 }
  ]
  ```
- **`F2` — Crown Echo (`7` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "purple" },
    { "op": "STAMP_PRESET", "preset": 3 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 }
  ]
  ```

---

### Variation 2: Stereo Ping-Pong Jam (`8 + 10 + 10 = 28` flat blocks)

- **Concept:** Alternates left cyan LED columns (`cols 2 & 3`) in `F1` against right pink LED columns (`cols 6 & 7`) in `F2` across a bouncing `1..8` melody (fixes legacy `Stereo Jam` pitch `> 8` out-of-range notes).
- **`MAIN` (`8` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "green" },
    { "op": "STAMP_PRESET", "preset": 2 },
    { "op": "PLAY_CHIME" }
  ]
  ```
- **`F1` — Left Cyan Bounce (`10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_COL", "col": 2 },
    { "op": "LIGHT_COL", "col": 3 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 }
  ]
  ```
- **`F2` — Right Pink Bounce (`10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "LIGHT_COL", "col": 6 },
    { "op": "LIGHT_COL", "col": 7 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 }
  ]
  ```

---

### Variation 3: 🚀 Rocket Countdown & Blastoff (`19 + 9 + 10 = 38` flat blocks)

*(Replaces the removed 4-frame sprite animation card; stays strictly within 1..8 grid coordinates and `0..7` `STAMP_PRESET` shapes.)*

- **Concept:** `F1` flashes the Rocket on the red launchpad (`row 8`) with countdown drum hits; `F2` ignites orange/amber booster rows (`rows 7 & 8`) with rising notes; `Main` blasts off into a dark starry sky with 4 twinkling `LIGHT_PIXEL` stars and a C5 chime!
- **`MAIN` (`19` flat blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "CALL_FN", "fn": "F2" },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "LIGHT_PIXEL", "col": 2, "row": 2 },
    { "op": "LIGHT_PIXEL", "col": 7, "row": 3 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_PIXEL", "col": 3, "row": 6 },
    { "op": "LIGHT_PIXEL", "col": 6, "row": 5 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 1, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 3, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 1 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "PLAY_CHIME" }
  ]
  ```
- **`F1` — Launchpad Countdown (`9` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "blue" },
    { "op": "STAMP_PRESET", "preset": 6 },
    { "op": "SET_LED_COLOR", "color": "red" },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "DRUM_KICK" },
    { "op": "DRUM_KICK" },
    { "op": "DRUM_SNARE" }
  ]
  ```
- **`F2` — Booster Ignition (`10` flat blocks):**
  ```json
  [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "STAMP_PRESET", "preset": 6 },
    { "op": "SET_LED_COLOR", "color": "orange" },
    { "op": "LIGHT_ROW", "row": 7 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.5 },
    { "op": "PLAY_NOTE", "pitch": 8, "duration": 0.5 }
  ]
  ```

---

## Edge Cases & Acceptance Criteria
- **Coordinate Safety:** All `LIGHT_ROW`, `LIGHT_COL`, and `LIGHT_PIXEL` arguments sit strictly inside `1..8` (zero OOB no-ops).
- **Pitch Safety:** All `PLAY_NOTE` pitches sit strictly inside `1..8` (`C4..C5`).
- **Beat Delay Multiplier:** Uses canonical `stepDelayMultiplier` (`0`, `1`) with `BeatDelayVisual` (`⚡0`, `1×`).
- **Stamp Ordering:** Every composite frame runs `STAMP_PRESET` *before* `LIGHT_ROW`/`LIGHT_COL`/`LIGHT_PIXEL` overlays.
- **Ledger Cursor:** Remains hidden (`visible: false`) since no cursor step blocks appear in `func.3`.
