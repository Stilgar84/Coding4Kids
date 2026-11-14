# `param.C`: Pixel & Rhythm Studio (`🎨 🎵`)

- **Activity ID:** `param.C` *(Stage 2 addition — restores 3-environment `.A/.B/.C` Capstone symmetry and lets kids apply `param.6` instant framing + `Black` LED carving immediately)*
- **Format:** `capstone` (`capstoneType: creative`)
- **Simulation:** `beat` ([Beat & Light Matrix](../../envs/beat_light.md))
- **Icon:** `🎨 🎵`
- **Concept:** Synthesizing `SET_BEAT_DELAY [0]`, `STAMP_PRESET [0..7]`, `Black`/`White` LED Carving & Multi-Voice Groove

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

In this Beat & Light capstone studio, kids combine everything they unlocked in `param.5` and `param.6`: instant **`SET_BEAT_DELAY [0]`** frame stacking, all eight pixel stamps (`HEART, STAR, SMILE, NOTE, BOLT, DIAMOND, CHECK, ROBOT`), side-column equalizers (`LIGHT_COL`), bottom groove bars (`LIGHT_ROW`), **`Black` (`#0f172a`)** LED cutouts to punch eyes or visors into sprites, **`White` (`#ffffff`)** sparkles, and pitched `PLAY_NOTE` + drum grooves—all cleanly **without loops or a visible cursor reticle**.

</details>

## Palette, SlotCap & Environment Flags

- **Palette (`PaletteConfig`):**
  ```json
  {
    "allowedSimBlocks": [
      "DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME",
      "WAIT_BEAT", "CLEAR_LEDS",
      "PLAY_NOTE", "SET_LED_COLOR",
      "LIGHT_ROW", "LIGHT_COL", "LIGHT_PIXEL", "STAMP_PRESET",
      "SET_BEAT_DELAY"
    ],
    "allowedControlBlocks": [],
    "allowedScopes": ["MAIN"],
    "allowRepeatBadges": true,
    "allowActionParams": true,
    "allowedBlockParams": {
      "delay": [0, 0.25, 0.5, 1, 2, 4],
      "pitch": [1, 2, 3, 4, 5, 6, 7, 8],
      "duration": [0.25, 0.5, 1, 2],
      "color": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      "row": [1, 2, 3, 4, 5, 6, 7, 8],
      "col": [1, 2, 3, 4, 5, 6, 7, 8],
      "x": [1, 2, 3, 4, 5, 6, 7, 8],
      "y": [1, 2, 3, 4, 5, 6, 7, 8],
      "preset": ["HEART", "STAR", "SMILE", "NOTE", "BOLT", "DIAMOND", "CHECK", "ROBOT"]
    },
    "allowVariables": false,
    "allowRecursion": false
  }
  ```
- **SlotCap (`SlotCapConfig`):** `null` (Sandbox guardrails: Starter & Var 1 `≤ 14`, Var 2 `≤ 20`, Var 3 `≤ 30`)
- **Env & UI Flags:** `showCursorReticle: false`, `tool-beat-active-color: true`

---

## Starter Workspace (`starterWorkspace`): `🤖 Pixel Robot & Groove` (`12` blocks `≤ 14`)

*(Stamps a Cyan `ROBOT`, punches `Black` LED eye cutouts at `(3, 3)` and `(6, 3)`, lights an Amber antenna at `(4, 1)`, and plays a 4-hit beat groove.)*

- **MAIN (`blocks.length = 12`):**
  1. `SET_BEAT_DELAY {"delay": 0}` *(instant frame paint)*
  2. `SET_LED_COLOR {"color": "#06b6d4"}` *(0=Cyan)*
  3. `STAMP_PRESET {"preset": "ROBOT"}` *(7=ROBOT)*
  4. `SET_LED_COLOR {"color": "#0f172a"}` *(8=Black eye carving)*
  5. `LIGHT_PIXEL {"x": 3, "y": 3}`
  6. `LIGHT_PIXEL {"x": 6, "y": 3}`
  7. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber antenna dot)*
  8. `LIGHT_PIXEL {"x": 4, "y": 1}`
  9. `DRUM_KICK`
  10. `PLAY_NOTE {"pitch": 5, "duration": 0.5}`
  11. `DRUM_SNARE`
  12. `PLAY_NOTE {"pitch": 8, "duration": 1}`

---

## Creative Variation Cards (`variations[]`)

### Variation 1 (`param-c-var1-bolt-alert`): `⚡ Neon Bolt Alert` (`11` blocks `≤ 14`)
*(Amber Lightning Bolt stamped inside flashing Pink left/right side borders with a crisp two-note chime.)*

- **MAIN (`blocks.length = 11`):**
  1. `SET_BEAT_DELAY {"delay": 0}`
  2. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber)*
  3. `STAMP_PRESET {"preset": "BOLT"}` *(4=BOLT)*
  4. `SET_LED_COLOR {"color": "#ec4899"}` *(7=Pink)*
  5. `LIGHT_COL {"x": 1}`
  6. `LIGHT_COL {"x": 8}`
  7. `PLAY_NOTE {"pitch": 6, "duration": 0.5}`
  8. `PLAY_NOTE {"pitch": 8, "duration": 0.5}`
  9. `WAIT_BEAT {"duration": 1}`
  10. `CLEAR_LEDS`
  11. `PLAY_CHIME`

### Variation 2 (`param-c-var2-rocket-blastoff`): `🚀 3-2-1 Rocket Blastoff` (`19` blocks `≤ 20`)
*(Counts down bottom-up `y = 7 -> 4 -> 1` in Rose -> Amber -> Emerald, then blasts a `White` `STAR` above an `Orange` thruster floor bar!)*

- **MAIN (`blocks.length = 19`):**
  1. `SET_BEAT_DELAY {"delay": 0}`
  2. `SET_LED_COLOR {"color": "#f43f5e"}` *(1=Rose)*
  3. `LIGHT_ROW {"y": 7}`
  4. `PLAY_NOTE {"pitch": 2, "duration": 1}`
  5. `CLEAR_LEDS`
  6. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber)*
  7. `LIGHT_ROW {"y": 4}`
  8. `PLAY_NOTE {"pitch": 4, "duration": 1}`
  9. `CLEAR_LEDS`
  10. `SET_LED_COLOR {"color": "#10b981"}` *(3=Emerald)*
  11. `LIGHT_ROW {"y": 1}`
  12. `PLAY_NOTE {"pitch": 6, "duration": 1}`
  13. `CLEAR_LEDS`
  14. `SET_LED_COLOR {"color": "#ffffff"}` *(9=White)*
  15. `STAMP_PRESET {"preset": "STAR"}` *(1=STAR)*
  16. `SET_LED_COLOR {"color": "#f97316"}` *(6=Orange thruster exhaust)*
  17. `LIGHT_ROW {"y": 8}`
  18. `DRUM_CLAP`
  19. `PLAY_NOTE {"pitch": 8, "duration": 2}`

### Variation 3 (`param-c-var3-dj-emoji`): `🎧 Beatbox DJ Emoji` (`26` blocks `≤ 30`)
*(Two-frame visual DJ loop without `Loop`: Frame 1 stamps an Amber `SMILE` with Cyan/Purple equalizer side columns; Frame 2 flips into a winking DJ with a `Black` left-eye cutout, glowing `Pink` cheek pixels, and an Emerald floor bar.)*

- **MAIN (`blocks.length = 26`):**
  1. `SET_BEAT_DELAY {"delay": 0}`
  2. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber)*
  3. `STAMP_PRESET {"preset": "SMILE"}` *(2=SMILE)*
  4. `SET_LED_COLOR {"color": "#06b6d4"}` *(0=Cyan EQ left)*
  5. `LIGHT_COL {"x": 1}`
  6. `SET_LED_COLOR {"color": "#a855f7"}` *(4=Purple EQ right)*
  7. `LIGHT_COL {"x": 8}`
  8. `DRUM_KICK`
  9. `PLAY_NOTE {"pitch": 5, "duration": 0.5}`
  10. `DRUM_SNARE`
  11. `WAIT_BEAT {"duration": 0.5}`
  12. `CLEAR_LEDS`
  13. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber)*
  14. `STAMP_PRESET {"preset": "SMILE"}` *(2=SMILE)*
  15. `SET_LED_COLOR {"color": "#0f172a"}` *(8=Black wink eye cutout)*
  16. `LIGHT_PIXEL {"x": 3, "y": 3}`
  17. `SET_LED_COLOR {"color": "#ec4899"}` *(7=Pink glowing cheeks)*
  18. `LIGHT_PIXEL {"x": 2, "y": 5}`
  19. `LIGHT_PIXEL {"x": 7, "y": 5}`
  20. `SET_LED_COLOR {"color": "#10b981"}` *(3=Emerald floor wave)*
  21. `LIGHT_ROW {"y": 8}`
  22. `DRUM_KICK`
  23. `DRUM_CLAP`
  24. `PLAY_NOTE {"pitch": 8, "duration": 1}`
  25. `PLAY_CHIME`
  26. `WAIT_BEAT {"duration": 1}`

## Verification Checklist
- [x] Starter (`12`), Var 1 (`11`), Var 2 (`19`), Var 3 (`26`) satisfy `≤ 14 / ≤ 20 / ≤ 30` unrolled sandbox guardrails cleanly.
- [x] Uses zero loops, zero variables, zero `CURSOR_STEP`/`CURSOR_TURN`, and keeps Beat's `(1, 1)` cursor reticle hidden.
- [x] Exercises `SET_BEAT_DELAY [0]`, `Black` (`#0f172a`) carving, `White` (`#ffffff`) stars, `STAMP_PRESET` (`ROBOT, BOLT, STAR, SMILE`), `LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL`, and rhythmic `PLAY_NOTE` + drums.
