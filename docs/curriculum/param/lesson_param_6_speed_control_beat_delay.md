# `param.6`: Speed Control & Instant Light Frames (`📖 🎵`)

- **Activity ID:** `param.6` *(Legacy Alias: `2.5a` — cleanly renumbered after `param.5`)*
- **Format:** `explanation` (`demoTabs`)
- **Simulation:** `beat` ([Beat & Light Matrix](../../envs/beat_light.md))
- **Icon:** `📖 🎵`
- **Concept:** Using `SET_BEAT_DELAY` Step Multiplier (`[1]` = `1×` 400ms vs `[0]` = `0ms` Instant) + `WAIT_BEAT` + `Black` (`#0f172a`) LED Carving

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

Step through the three demo tabs to discover two visual superpowers:
1. **`SET_BEAT_DELAY` Multiplier:** Each block normally pauses `1×` (`400ms` global beat tick, turtle icon). Setting **`SET_BEAT_DELAY [0]`** (`0× = 0ms`, lightning icon `⚡0`) makes LED paint blocks flash **simultaneously** as one complete multi-color frame, then `WAIT_BEAT [1]` holds the whole picture for 1 beat before `CLEAR_LEDS` swaps to the next picture.
2. **`Black` (`index 8`, `#0f172a`) LED Eraser & `White` (`index 9`, `#ffffff`) Sparkle:** Painting `Black` on top of a stamped `HEART` turns off individual LEDs to punch crisp pixel eyes or windows! *(Unlike `anim.1` flipbook loops, this is a single-shot parameterized light sequence; Beat's `(1, 1)` cursor reticle remains hidden.)*

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
- **SlotCap (`SlotCapConfig`):** `null`
- **Env & UI Flags:**
  - `showCursorReticle: false` (reticle stays hidden across all 3 tabs!)
  - `tool-beat-active-color: true`
  - **Swatch Affordances:** `Black` (`8`, `#0f172a`) renders as an unlit/off LED cell cue; `White` (`9`, `#ffffff`) renders with crisp slate rim + bright glow badge.
  - **`SET_BEAT_DELAY` UI (`BeatDelayVisual`):** Displays `⚡0, ¼×, ½×, 1×, 2×, 4×` (multiplier of `400ms` global base tick per [`docs/envs/beat_light.md`](../../envs/beat_light.md) and [`docs/binary_format.md`](../../binary_format.md) §7.4 `OP_BEAT_SET_BEAT_DELAY` `0x1E`).

---

## Demo Tabs (`demoTabs`)

### Tab 1 (`param-6-tab-1`): `🐢 1 — Normal 1× Beat-by-Beat Paint` (`6` blocks)
*(Default `Starter` workspace — lights rows 2, 4, 6 one beat at a time at `1× = 400ms`.)*
- **Spotlights:** `["execution-order"]`
- **MAIN (`blocks.length = 6`):**
  1. `SET_BEAT_DELAY {"delay": 1}` *(1× = 400ms per LED op)*
  2. `SET_LED_COLOR {"color": "#06b6d4"}` *(0=Cyan)*
  3. `LIGHT_ROW {"y": 2}`
  4. `LIGHT_ROW {"y": 4}`
  5. `LIGHT_ROW {"y": 6}`
  6. `PLAY_CHIME`

### Tab 2 (`param-6-tab-2`): `⚡ 2 — Instant Frame + Wait Flip` (`12` blocks)
*(Sets `SET_BEAT_DELAY [0]` so `STAMP_PRESET [STAR]` + `White` row 8 flash together in 0ms, holds `1` beat, clears, then flashes `Cyan` `DIAMOND`.)*
- **Spotlights:** `["execution-order"]`
- **MAIN (`blocks.length = 12`):**
  1. `SET_BEAT_DELAY {"delay": 0}` *(0× = 0ms instant paint)*
  2. `SET_LED_COLOR {"color": "#fbbf24"}` *(2=Amber)*
  3. `STAMP_PRESET {"preset": "STAR"}` *(1=STAR)*
  4. `SET_LED_COLOR {"color": "#ffffff"}` *(9=White)*
  5. `LIGHT_ROW {"y": 8}`
  6. `DRUM_KICK`
  7. `WAIT_BEAT {"duration": 1}`
  8. `CLEAR_LEDS`
  9. `SET_LED_COLOR {"color": "#06b6d4"}` *(0=Cyan)*
  10. `STAMP_PRESET {"preset": "DIAMOND"}` *(5=DIAMOND)*
  11. `PLAY_CHIME`
  12. `WAIT_BEAT {"duration": 1}`

### Tab 3 (`param-6-tab-3`): `🕳️ 3 — Black Cutout + White Sparkle` (`9` blocks)
*(Paints a Rose Heart instantly, carves two Black off-LED eyes at `(4, 4)` and `(5, 4)`, and adds a White corner glint at `(3, 2)`.)*
- **Spotlights:** `["execution-order"]`
- **MAIN (`blocks.length = 9`):**
  1. `SET_BEAT_DELAY {"delay": 0}` *(0× = 0ms)*
  2. `SET_LED_COLOR {"color": "#f43f5e"}` *(1=Rose)*
  3. `STAMP_PRESET {"preset": "HEART"}` *(0=HEART)*
  4. `SET_LED_COLOR {"color": "#0f172a"}` *(8=Black LED off)*
  5. `LIGHT_PIXEL {"x": 4, "y": 4}`
  6. `LIGHT_PIXEL {"x": 5, "y": 4}`
  7. `SET_LED_COLOR {"color": "#ffffff"}` *(9=White)*
  8. `LIGHT_PIXEL {"x": 3, "y": 2}`
  9. `WAIT_BEAT {"duration": 1}`

## Verification Checklist
- [x] Syncs `SET_BEAT_DELAY` to canonical step multiplier `[0, 0.25, 0.5, 1, 2, 4]` (`[1]` = `400ms`, `[0]` = `0ms`), matching `BeatDelayVisual` and `binary_format.md` §7.4 `0x1E`.
- [x] Unlocks `8=Black` (`#0f172a`) and `9=White` (`#ffffff`) cleanly; keeps `(1, 1)` cursor reticle hidden.
- [x] Directly sets up [`param.C`](./capstone_param_c_pixel_and_rhythm_studio.md) (`🎨 🎵` Pixel & Rhythm Studio).
