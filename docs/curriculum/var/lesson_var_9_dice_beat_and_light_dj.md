# Lesson `var.9` — Dice Beat & Light DJ

| Field | Value |
| :--- | :--- |
| **ID** | `var.9` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Dice Beat & Light DJ |
| **Format** | `🎵` Creative Beat & Light Matrix Sandbox (`Starter + 3 Playable Variations`) |
| **Environment** | Beat & Light Matrix (`🎵`) |
| **Legacy ID** | `6.7` *(beat)* |
| **Slot Cap** | `30` per tab / `60` total (Starter `10`, Var 1 `9`, Var 2 `19`, Var 3 `24`) |
| **Edit Delta** | Open-ended Generative DJ Sandbox (`Starter` + `3` Variations) |
| **Variables Allowed** | `["c", "m", "p", "r"]` |
| **Sensors / Operators** | `["$randCoin", "$randD4", "$randD6", "$randD8", "$randD20", "$rand01", "$randomColor"]`, `["+", "-", "*"]` |

---

## One-Concept Goal

Use random dice reporters (`$randD8`, `$randD4`, `$randCoin`) and **`$randomColor`** inside `Loop`s and helper functions to improvise living **C Major melodies (`1..8` and `1..16`)**, multi-color LED visuals, and `Loop ×[c]` coin-flip stutter beats.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Zero-Reading Rule:** Keep the learner workspace prose-free! Kids tap Play to watch the DJ light show and tweak die sizes (`D4`, `D6`, `D8`), beat multipliers, or colors.
- **Scale & Contract Fixes vs Legacy Stage 1:**
  - All musical notes strictly use **C Major** (`1..8 = C4..C5` core, extended `1..16 = C4..D6` in `Variation 1` & `Variation 3`) — **zero `"pentatonic"`**.
  - **`cursorReticleVisible: false`** across all tabs since no cursor movement blocks exist.
  - **`Variation 2`** demonstrates **`c = $randCoin` (`0` or `1`) -> `Loop ×[c]`**, relying cleanly on `Loop ×[0]` executing `0` times (`50%` glitch echo drop vs `50%` steady bass beat).

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
  "allowedVariableNames": ["c", "m", "p", "r"],
  "allowedValueSensors": ["$randCoin", "$randD4", "$randD6", "$randD8", "$randD20", "$rand01", "$randomColor"],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": true,
  "cursorReticleVisible": false,
  "noteScale": "C Major (1..8 = C4..C5, extended 1..16 = C4..D6)"
}
```

---

## Starter — Random C Major Pad DJ (`MAIN: 10` Flat Blocks)

```json
{
  "seed": 101,
  "MAIN": [
    { "op": "CLEAR_LIGHTS" },
    { "op": "SET_BEAT_DELAY", "multiplier": 0.5 },
    {
      "op": "LOOP_START",
      "count": 16,
      "body": [
        { "op": "VAR_ASSIGN", "var": "p", "value": "$randD8" },
        { "op": "VAR_ASSIGN", "var": "r", "value": "$randD8" },
        { "op": "VAR_ASSIGN", "var": "c", "value": "$randD8" },
        { "op": "SET_LED_COLOR", "color": "$randomColor" },
        { "op": "LIGHT_PIXEL", "row": "r", "col": "c" },
        { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.5 }
      ]
    }
  ]
}
```

---

## Playable Variation Cards (`3` Inspirations)

### Variation 1 — Two-Octave Starlight Arpeggio (`1..16` C Major, `MAIN: 9` Flat Blocks)

```json
{
  "seed": 202,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    {
      "op": "LOOP_START",
      "count": 16,
      "body": [
        { "op": "VAR_ASSIGN", "var": "p", "value": "$randD8" },
        { "op": "VAR_OP", "target": "m", "operator": "*", "left": "p", "right": 2 },
        { "op": "VAR_ASSIGN", "var": "r", "value": "$randD8" },
        { "op": "SET_LED_COLOR", "color": "$randomColor" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "PLAY_NOTE", "pitch": "m", "beats": 0.5 }
      ]
    }
  ]
}
```

*Behavior: Doubles `$randD8` (`m = p * 2`) into even steps `{2, 4, 6, 8, 10, 12, 14, 16}` spanning the full two-octave C Major `D4..D6` register.*

---

### Variation 2 — Coin-Flip Stutter Drop (`c = $randCoin` + `Loop ×[c]`, `MAIN: 12`, `F1: 7`, Total `19`)

```json
{
  "seed": 303,
  "F1": [
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "VAR_ASSIGN", "var": "r", "value": "$randD8" },
    { "op": "LIGHT_ROW", "row": "r" },
    { "op": "VAR_ASSIGN", "var": "p", "value": "$randD4" },
    { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.25 },
    { "op": "SET_LED_COLOR", "color": "black" },
    { "op": "LIGHT_ROW", "row": "r" }
  ],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    {
      "op": "LOOP_START",
      "count": 16,
      "body": [
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_COL", "col": 1 },
        { "op": "PLAY_NOTE", "pitch": 1, "beats": 0.5 },
        { "op": "VAR_ASSIGN", "var": "c", "value": "$randCoin" },
        {
          "op": "LOOP_START",
          "count": "c",
          "body": [
            { "op": "CALL_FN", "fn": "F1" }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "black" },
        { "op": "LIGHT_COL", "col": 1 }
      ]
    }
  ]
}
```

*Behavior: Fires a steady `C4` bass beat on Column `1`, then flips `$randCoin`: `0` runs `Loop ×[0]` cleanly (`0` glitch hits), `1` triggers `F1`'s colorful flash-and-erase stutter!*

---

### Variation 3 — Twin Strobe Crosshair Jam (`F1` + `F2`, `MAIN: 6`, `F1: 9`, `F2: 9`, Total `24`)

```json
{
  "seed": 404,
  "F1": [
    { "op": "VAR_ASSIGN", "var": "r", "value": "$randD8" },
    { "op": "VAR_ASSIGN", "var": "p", "value": "$randD4" },
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "LIGHT_ROW", "row": "r" },
    { "op": "PLAY_NOTE", "pitch": "p", "beats": 0.5 },
    { "op": "SET_LED_COLOR", "color": "black" },
    { "op": "LIGHT_ROW", "row": "r" },
    { "op": "WAIT_BEAT", "beats": 0.25 },
    { "op": "PLAY_NOTE", "pitch": 1, "beats": 0.25 }
  ],
  "F2": [
    { "op": "VAR_ASSIGN", "var": "c", "value": "$randD8" },
    { "op": "VAR_ASSIGN", "var": "m", "value": "$randD8" },
    { "op": "VAR_OP", "target": "m", "operator": "+", "left": "m", "right": 8 },
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "LIGHT_COL", "col": "c" },
    { "op": "PLAY_NOTE", "pitch": "m", "beats": 0.5 },
    { "op": "SET_LED_COLOR", "color": "black" },
    { "op": "LIGHT_COL", "col": "c" },
    { "op": "WAIT_BEAT", "beats": 0.25 }
  ],
  "MAIN": [
    { "op": "CLEAR_LIGHTS" },
    { "op": "SET_BEAT_DELAY", "multiplier": 0.25 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    }
  ]
}
```

*Behavior: Alternates a low `D4` horizontal bass strobe (`F1`: pitches `1..4`) with a high octave vertical shimmer (`F2`: `m = $randD8 + 8` spanning `9..16`, `D5..D6`).*
