# Lesson `var.7` — Sweeping Coordinates & Scales

| Field | Value |
| :--- | :--- |
| **ID** | `var.7` *(renumbered from legacy `var.6`)* |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Sweeping Coordinates & Scales |
| **Format** | `🎵` Creative Beat & Light Matrix Sandbox (`Starter + 4 Playable Variations`) |
| **Environment** | Beat & Light Matrix (`🎵`) |
| **Legacy ID** | `6.6` *(plus `6.6a` Diagonal Sweep merged & fixed)* |
| **Slot Cap** | `30` per tab / `60` total (Starter `12`, Var 1 `14`, Var 2 `14`, Var 3 `25`, Var 4 `10`) |
| **Edit Delta** | Open-ended Beat Matrix Sandbox (`Starter` + `4` Variations) |
| **Variables Allowed** | `["c", "p", "r", "x", "y"]` *(every variable declared explicitly in palette)* |
| **Sensors / Operators** | `["+", "-", "*"]` ONLY (`🎲` and `$randomColor` unlock next in `var.8`) |

---

## One-Concept Goal

Use updating variables (`r = r + 1`, `r = r - 1`, `c = c + 1`, `p = p + 1`) inside `Loop`s and helper functions (`F1` / `F2`) to sweep pixels, rows, columns, and **C Major musical scales** (`1..8` `C4..C5` and extended `1..12` `C4..G5`) smoothly across the `8×8` matrix.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Zero-Reading Rule:** Zero learner prose in the UI — kids learn by pressing Play on the Starter ascending scale and clicking through the `4` visual Variation Cards (`X-Sweep`, `Equalizer`, `Up/Down Siren`, `Overdrive Scale`).
- **Beat Matrix Contracts (`docs/envs/beat_light.md`):**
  - `PLAY_NOTE` uses **C Major ONLY** (`1..8 = C4..C5`, `var`+ extended range `1..16 = C4..D6`) — never `"pentatonic"`.
  - **`cursorReticleVisible: false`:** No `CURSOR_*` blocks are in palette, so the `(1,1)` focus reticle stays hidden cleanly.
  - **`SET_LED_COLOR [Black]`** acts as `⊘` **Erase / Off**, letting `Variation 3` sweep clean non-smearing bars across rows `1..8`.
  - **Out-of-bounds `LIGHT_*` `< 1` or `> 8` cleanly no-ops** (`Variation 4` lets `c` climb `1..12` safely without crashing while notes climb `9..12`).
- **Downstream `anim.6` Contract:** **`Variation 3` (`Up-and-Down Police Siren`)** explicitly pairs `F1` (`r = r + 1`, `p = p + 1`) and `F2` (`r = r - 1`, `p = p - 1`) across the full `1 -> 8 -> 1` sweep so later `anim` choreography lessons can build directly on this `var.7` pattern.

</details>

---

## Palette & Capabilities

```json
{
  "allowedSimBlocks": [
    "LIGHT_PIXEL",
    "LIGHT_ROW",
    "LIGHT_COL",
    "SET_LED_COLOR",
    "CLEAR_LIGHTS",
    "PLAY_NOTE",
    "SET_BEAT_DELAY",
    "WAIT_BEAT"
  ],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "CALL_FN", "VAR_ASSIGN", "VAR_OP"],
  "allowedFunctions": ["F1", "F2"],
  "allowedVariableNames": ["c", "p", "r", "x", "y"],
  "allowedValueSensors": [],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": true,
  "cursorReticleVisible": false,
  "noteScale": "C Major (1..8 = C4..C5, extended 1..16 = C4..D6)",
  "outOfBoundsLightBehavior": "silent_noop"
}
```

---

## Starter — Ascending Rainbow Scale (`MAIN: 12` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.5 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "r", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_PIXEL", "row": "r", "col": "c" },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.5 },
        { "op": "VAR_OP", "target": "p", "operator": "+", "left": "p", "right": 1 },
        { "op": "VAR_OP", "target": "r", "operator": "-", "left": "r", "right": 1 },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 }
      ]
    }
  ]
}
```

*Trace: Walks bottom-left `(8,1)` diagonally to top-right `(1,8)` while ascending C Major `C4 (1)` through `C5 (8)`.*

---

## Playable Variation Cards (`4` Inspirations)

### Variation 1 — Diagonal X-Crosshair Sweep (`Preview 1`, `MAIN: 14` Flat Blocks)

> *Note: Fixes legacy `6.6a` undeclared variable bug by explicitly exposing `["x", "y", "p"]`.*

```json
{
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "SET_LED_COLOR", "color": "purple" },
        { "op": "LIGHT_PIXEL", "row": "x", "col": "x" },
        { "op": "SET_LED_COLOR", "color": "amber" },
        { "op": "LIGHT_PIXEL", "row": "y", "col": "x" },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.5 },
        { "op": "VAR_OP", "target": "x", "operator": "+", "left": "x", "right": 1 },
        { "op": "VAR_OP", "target": "y", "operator": "-", "left": "y", "right": 1 },
        { "op": "VAR_OP", "target": "p", "operator": "+", "left": "p", "right": 1 }
      ]
    }
  ]
}
```

*Trace: Simultaneously draws a Purple main diagonal `(1,1)->(8,8)` and Amber counter-diagonal `(8,1)->(1,8)` synced with `1..8` C Major notes.*

---

### Variation 2 — Nested Variable Equalizer Bars (`Preview 2`, `MAIN: 14` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "r", "value": 8 },
        { "op": "SET_LED_COLOR", "color": "green" },
        {
          "op": "LOOP_START",
          "count": "c",
          "body": [
            { "op": "LIGHT_PIXEL", "row": "r", "col": "c" },
            { "op": "VAR_OP", "target": "r", "operator": "-", "left": "r", "right": 1 }
          ]
        },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.5 },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "VAR_OP", "target": "p", "operator": "+", "left": "p", "right": 1 }
      ]
    }
  ]
}
```

*Trace: Uses `Loop ×[c]` inside `Loop ×8` to build bottom-up Green audio equalizer columns of height `1..8` while playing C Major `C4..C5`.*

---

### Variation 3 — `F1`/`F2` Up-and-Down Police Siren (`Preview 3`, `MAIN: 7`, `F1: 9`, `F2: 9`, Total `25`)

```json
{
  "F1": [
    {
      "op": "LOOP_START",
      "count": 7,
      "body": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.25 },
        { "op": "SET_LED_COLOR", "color": "black" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "VAR_OP", "target": "r", "operator": "+", "left": "r", "right": 1 },
        { "op": "VAR_OP", "target": "p", "operator": "+", "left": "p", "right": 1 }
      ]
    }
  ],
  "F2": [
    {
      "op": "LOOP_START",
      "count": 7,
      "body": [
        { "op": "SET_LED_COLOR", "color": "blue" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.25 },
        { "op": "SET_LED_COLOR", "color": "black" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "VAR_OP", "target": "r", "operator": "-", "left": "r", "right": 1 },
        { "op": "VAR_OP", "target": "p", "operator": "-", "left": "p", "right": 1 }
      ]
    }
  ],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    { "op": "VAR_ASSIGN", "var": "r", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    }
  ]
}
```

*Trace: `F1` sweeps Red rows `1 -> 7` (`C4..B4`), ending at `(r=8, p=8)`; `F2` sweeps Blue rows `8 -> 2` (`C5..D4`), returning cleanly to `(r=1, p=1)` for `3` seamless siren cycles (resolving legacy `6.6` `F2` early-stop).*

---

### Variation 4 — Two-Octave Overdrive Column Sweep (`Preview 4`, `MAIN: 10` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 12,
      "body": [
        { "op": "SET_LED_COLOR", "color": "amber" },
        { "op": "LIGHT_COL", "col": "c" },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.5 },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "VAR_OP", "target": "p", "operator": "+", "left": "p", "right": 1 }
      ]
    }
  ]
}
```

*Trace: Columns `1..8` illuminate Amber alongside `C4..C5`; columns `9..12` safely out-of-bounds no-op LEDs while pitches `9..12` (`D5..G5`) complete the extended C Major fanfare.*
