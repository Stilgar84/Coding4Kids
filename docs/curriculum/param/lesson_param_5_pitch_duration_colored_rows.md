# `param.5`: Pitch, Duration & Colored LED Lines (`🎵`)

- **Activity ID:** `param.5` *(Legacy Alias: `2.5`)*
- **Format:** `sandbox`
- **Simulation:** `beat` ([Beat & Light Matrix](../../envs/beat_light.md))
- **Icon:** `🎵`
- **Concept:** Dual-Parameter `PLAY_NOTE` (`pitch 1..8`, `duration ½ | 1 | 2`), `SET_LED_COLOR` (`0..7`), `LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL` & `STAMP_PRESET`

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

In Beat & Light, row **`y = 1` is at the TOP** and **`y = 8` is at the BOTTOM** (`(1, 1)` is top-left). Notice how the Starter lights row `7` (near the bottom) on the low note (`pitch 1`), steps up to row `4` (`pitch 5`), and reaches row `1` at the very top (`pitch 8`)! Every `LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL`, and `STAMP_PRESET` block paints using the currently active `SET_LED_COLOR` swatch shown in the toolbar. *(Note: Beat's directional `(1, 1)` cursor reticle stays hidden until Module `loop`.)*

</details>

## Palette, SlotCap & Environment Flags

- **Palette (`PaletteConfig`):**
  ```json
  {
    "allowedSimBlocks": [
      "DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME",
      "WAIT_BEAT", "CLEAR_LEDS",
      "PLAY_NOTE", "SET_LED_COLOR",
      "LIGHT_ROW", "LIGHT_COL", "LIGHT_PIXEL", "STAMP_PRESET"
    ],
    "allowedControlBlocks": [],
    "allowedScopes": ["MAIN"],
    "allowRepeatBadges": true,
    "allowActionParams": true,
    "allowedBlockParams": {
      "pitch": [1, 2, 3, 4, 5, 6, 7, 8],
      "duration": [0.25, 0.5, 1, 2],
      "color": [0, 1, 2, 3, 4, 5, 6, 7],
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
- **SlotCap (`SlotCapConfig`):** `null` (Sandbox: Starter & Var 1 `≤ 14`, Var 2 `≤ 20`, Var 3+ `≤ 30`)
- **Env & UI Flags:**
  - `showCursorReticle: false` (cursor reticle stays hidden throughout `seq` and `param`)
  - `tool-beat-active-color: true` (unlocks active LED color swatch toolbar badge in `param.5`)
  - LED Color Index Map (`0..7`): `0=Cyan (#06b6d4)`, `1=Rose (#f43f5e)`, `2=Amber (#fbbf24)`, `3=Emerald (#10b981)`, `4=Purple (#a855f7)`, `5=Blue (#3b82f6)`, `6=Orange (#f97316)`, `7=Pink (#ec4899)` *(Black `8` & White `9` unlock in `param.6`)*
  - `PLAY_NOTE` Pickers: stair-step visual pitch bars (`1..8`) + rhythmic note duration icons (`½, 1, 2`).

---

## Starter Workspace (`starterWorkspace`): `4-Note Ascending Color Row Melody` (`10` blocks `≤ 14`)

- **MAIN (`blocks.length = 10`):**
  1. `SET_LED_COLOR {"color": "#06b6d4"}` *(0=Cyan)*
  2. `LIGHT_ROW {"y": 7}` *(bottom-low LED bar)*
  3. `PLAY_NOTE {"pitch": 1, "duration": 0.5}`
  4. `PLAY_NOTE {"pitch": 3, "duration": 0.5}`
  5. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber)*
  6. `LIGHT_ROW {"y": 4}` *(mid LED bar)*
  7. `PLAY_NOTE {"pitch": 5, "duration": 1}`
  8. `SET_LED_COLOR {"color": "#f43f5e"}` *(1=Rose)*
  9. `LIGHT_ROW {"y": 1}` *(top-high LED bar)*
  10. `PLAY_NOTE {"pitch": 8, "duration": 2}`

---

## Creative Variation Cards (`variations[]`)

### Variation 1 (`param-5-var1-doorbell-chime`): `🔔 Doorbell Chime` (`7` blocks `≤ 14`)
- **MAIN (`blocks.length = 7`):**
  1. `SET_LED_COLOR {"color": "#fbbf24"}` *(Amber)*
  2. `STAMP_PRESET {"preset": "NOTE"}` *(3=NOTE)*
  3. `PLAY_NOTE {"pitch": 5, "duration": 1}`
  4. `SET_LED_COLOR {"color": "#06b6d4"}` *(Cyan)*
  5. `LIGHT_ROW {"y": 1}`
  6. `LIGHT_ROW {"y": 8}`
  7. `PLAY_NOTE {"pitch": 3, "duration": 2}`

### Variation 2 (`param-5-var2-traffic-countdown`): `🚦 Traffic-Light Countdown` (`9` blocks `≤ 20`)
- **MAIN (`blocks.length = 9`):**
  1. `SET_LED_COLOR {"color": "#f43f5e"}` *(Rose/Red top)*
  2. `LIGHT_ROW {"y": 2}`
  3. `PLAY_NOTE {"pitch": 2, "duration": 1}`
  4. `SET_LED_COLOR {"color": "#fbbf24"}` *(Amber middle)*
  5. `LIGHT_ROW {"y": 5}`
  6. `PLAY_NOTE {"pitch": 4, "duration": 1}`
  7. `SET_LED_COLOR {"color": "#10b981"}` *(Emerald bottom go)*
  8. `LIGHT_ROW {"y": 8}`
  9. `PLAY_NOTE {"pitch": 8, "duration": 2}`

### Variation 3 (`param-5-var3-rising-bassline`): `📊 Rising Color Columns & Bassline` (`10` blocks `≤ 30`)
*(Uses `LIGHT_COL` left-to-right `x = 2 -> 5 -> 8` synced with ascending pitch `1 -> 5 -> 8` over a `DRUM_KICK ×2` groove.)*
- **MAIN (`blocks.length = 10`):**
  1. `DRUM_KICK` (`repeat: 2`)
  2. `SET_LED_COLOR {"color": "#3b82f6"}` *(Blue)*
  3. `LIGHT_COL {"x": 2}`
  4. `PLAY_NOTE {"pitch": 1, "duration": 0.5}`
  5. `SET_LED_COLOR {"color": "#a855f7"}` *(Purple)*
  6. `LIGHT_COL {"x": 5}`
  7. `PLAY_NOTE {"pitch": 5, "duration": 0.5}`
  8. `SET_LED_COLOR {"color": "#ec4899"}` *(Pink)*
  9. `LIGHT_COL {"x": 8}`
  10. `PLAY_NOTE {"pitch": 8, "duration": 2}`

### Variation 4 (`param-5-var4-pixel-staircase`): `🪜 Bottom-to-Top Pixel & Row Staircase` (`16` blocks `≤ 30`)
*(Exercises `LIGHT_PIXEL (x, y)` stepping bottom-up `y = 8 -> 1` in `(1, 1)` top-left coordinates while climbing a major arpeggio.)*
- **MAIN (`blocks.length = 16`):**
  1. `SET_LED_COLOR {"color": "#06b6d4"}` *(Cyan)*
  2. `LIGHT_PIXEL {"x": 2, "y": 8}`
  3. `LIGHT_PIXEL {"x": 3, "y": 7}`
  4. `PLAY_NOTE {"pitch": 1, "duration": 0.5}`
  5. `SET_LED_COLOR {"color": "#10b981"}` *(Emerald)*
  6. `LIGHT_PIXEL {"x": 4, "y": 6}`
  7. `LIGHT_PIXEL {"x": 5, "y": 5}`
  8. `PLAY_NOTE {"pitch": 3, "duration": 0.5}`
  9. `SET_LED_COLOR {"color": "#fbbf24"}` *(Amber)*
  10. `LIGHT_PIXEL {"x": 6, "y": 4}`
  11. `LIGHT_PIXEL {"x": 7, "y": 3}`
  12. `PLAY_NOTE {"pitch": 5, "duration": 0.5}`
  13. `SET_LED_COLOR {"color": "#f43f5e"}` *(Rose)*
  14. `LIGHT_ROW {"y": 1}`
  15. `DRUM_CLAP`
  16. `PLAY_NOTE {"pitch": 8, "duration": 1}`

## Verification Checklist
- [x] `(1, 1)` = top-left orientation respected in Starter (`y=7 -> 4 -> 1`) and Var 4 (`y=8 -> 1`).
- [x] Introduces all non-cursor Beat Tier 2 blocks (`PLAY_NOTE`, `SET_LED_COLOR`, `LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL`, `STAMP_PRESET`) while keeping `CURSOR_STEP`/`CURSOR_TURN` and reticle hidden.
- [x] Enables `tool-beat-active-color` toolbar swatch indicator.
