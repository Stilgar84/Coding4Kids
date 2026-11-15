# `anim.B`: Sprite Sheet & Beat Choreographer (`🏆` Capstone)

- **World:** 🎵 Beat & Light Matrix (`8×8` Starter–Var 2, **`16×16` Var 3** + Sparse Memory Tape, `BEAT_VERSION = 2`)
- **Card Type:** `🏆` Capstone Showcase (`Starter` + `3` Variation Cards)
- **Prerequisite:** [`anim.A`](./capstone_anim_a_flipbook_story_and_physics_showcase.md)
- **Hardware Config:** `matrixSize: 8` (Starter, Var 1–2) / `matrixSize: 16` (Var 3), `beatVersion: 2`, `defaultLoopPlayback: true`
- **Block Budget (Closer-Inclusive):** `Starter: 22` (`Slot Cap: 26`; Var 1: `27 / 32`, Var 2: `23 / 26`, Var 3: `25 / 30`)

> **Guided Co-Pilot Card:**
> Choreograph a **Dancing Robot music video**! Cycle **`STAMP_FROM_TAPE`** across frames `1, 65, 129, 193`, fetch melody notes from cells `257..264`, and lock every move to **Kick & Snare**—or expand to a **`16×16` Kaleidoscope** in **Var 3**!

<details>
<summary>📖 Parent / Teacher Tip — Multi-Track Tape Indexing & `16×16` Procedural Kaleidoscope</summary>

- **Dual-Region Sparse Tape (`$tapeLength = 264`):** Cells `1..256` hold the `4`-frame Dancing Bot sprite sheet (`64`-cell stride), while cells `257..264` hold an `8`-beat synth melody! Wrapping `If (i > 193) { i = 1 }` loops the dance infinitely over the `8`-note groove.
- **`16×16` Mode in Var 3 (`BEAT_VERSION = 2`):** Stepping diagonal ring coordinate `k = 1..8` mirrors across horizontal `u = 17 - k` and vertical `v = 17 - k` in 3-address `VAR_OP`, lighting all `4` symmetric kaleidoscope corners around the `16×16` matrix alongside ascending synth arpeggios!

</details>

---

## Palette & Capabilities

```json
{
  "env": "beat",
  "matrixSize": 8,
  "supportedMatrixSizes": [8, 16],
  "beatVersion": 2,
  "defaultLoopPlayback": true,
  "allowVariables": true,
  "varNames": "a..z",
  "allowFunctions": ["F1", "F2"],
  "allowTape": true,
  "tapeMinLength": 264,
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "LIGHT_PIXEL", "STAMP_PRESET", "STAMP_FROM_TAPE",
    "DRUM_KICK", "DRUM_SNARE", "PLAY_CHIME", "PLAY_NOTE", "WAIT_BEAT",
    "LOOP_START", "IF", "CALL_FN", "VAR_ASSIGN", "VAR_OP",
    "TAPE_SEEK", "TAPE_STEP"
  ],
  "allowedSensors": ["$cellValue", "$cellColor"]
}
```

---

## Starter: Dancing Bot Music Video (`22` Flat Blocks)

```text
// MAIN (22 flat blocks)
SET_BEAT_DELAY [0]
i = 1
m = 257
Loop [8]
  CLEAR_LEDS
  TAPE_SEEK [i]
  STAMP_FROM_TAPE
  TAPE_SEEK [m]
  n = $cellValue
  PLAY_NOTE [n, 0.5]
  r = m % 2
  If (r == 1)
    DRUM_KICK
  Else
    DRUM_SNARE
  End If
  i = i + 64
  If (i > 193)
    i = 1
  End If
  m = m + 1
End Loop
```

```json
{
  "slotCap": 26,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": {
    "length": 264,
    "cells": {
      "12": "cyan", "13": "cyan",
      "19": "white", "20": "blue", "21": "blue", "22": "white",
      "27": "cyan", "28": "purple", "29": "purple", "30": "cyan",
      "34": "orange", "35": "cyan", "36": "yellow", "37": "cyan", "38": "orange",
      "43": "blue", "44": "blue", "45": "blue", "46": "blue",
      "51": "cyan", "54": "cyan", "59": "white", "62": "white",

      "66": "orange", "76": "cyan", "77": "cyan",
      "74": "orange", "83": "white", "84": "blue", "85": "blue", "86": "white",
      "91": "cyan", "92": "purple", "93": "purple", "94": "cyan",
      "99": "cyan", "100": "yellow", "101": "cyan", "102": "orange",
      "107": "blue", "108": "blue", "109": "blue", "110": "blue",
      "115": "cyan", "118": "cyan", "123": "white", "126": "white",

      "130": "orange", "135": "orange", "139": "white", "140": "cyan", "141": "cyan", "142": "white",
      "147": "cyan", "148": "blue", "149": "blue", "150": "cyan",
      "155": "cyan", "156": "yellow", "157": "cyan",
      "163": "blue", "164": "blue", "165": "blue", "166": "blue",
      "171": "cyan", "174": "cyan", "178": "white", "183": "white",

      "199": "orange", "204": "cyan", "205": "cyan",
      "207": "orange", "211": "white", "212": "blue", "213": "blue", "214": "white",
      "219": "cyan", "220": "purple", "221": "purple", "222": "cyan",
      "226": "orange", "227": "cyan", "228": "yellow", "229": "cyan",
      "235": "blue", "236": "blue", "237": "blue", "238": "blue",
      "243": "cyan", "246": "cyan", "251": "white", "254": "white",

      "257": 1, "258": 3, "259": 5, "260": 8,
      "261": 6, "262": 5, "263": 3, "264": 1
    }
  },
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "m", "value": 257 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "STAMP_FROM_TAPE" },
        { "op": "TAPE_SEEK", "index": "m" },
        { "op": "VAR_ASSIGN", "var": "n", "value": "$cellValue" },
        { "op": "PLAY_NOTE", "pitch": "n", "duration": 0.5 },
        { "op": "VAR_OP", "target": "r", "operator": "%", "left": "m", "right": 2 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
          "then": [{ "op": "DRUM_KICK" }],
          "else": [{ "op": "DRUM_SNARE" }]
        },
        { "op": "VAR_OP", "target": "i", "operator": "+", "left": "i", "right": 64 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">", "left": "i", "right": 193 },
          "then": [{ "op": "VAR_ASSIGN", "var": "i", "value": 1 }]
        },
        { "op": "VAR_OP", "target": "m", "operator": "+", "left": "m", "right": 1 }
      ]
    }
  ]
}
```

---

## Variation 1: Equalizer + Falling Rain Dual-Layer Concert (`27` Flat Blocks)

```text
// MAIN (14 flat blocks)
SET_BEAT_DELAY [0]
r = 0
Loop [8]
  CLEAR_LEDS
  r = r + 1
  TAPE_SEEK [1]
  Call F1
  SET_LED_COLOR [White]
  LIGHT_PIXEL [r, r]
  SET_LED_COLOR [Cyan]
  d = 9 - r
  LIGHT_PIXEL [d, r]
  PLAY_NOTE [r, 0.25]
End Loop

// F1 (7 flat blocks)
c = 1
Loop [8]
  h = $cellValue
  Call F2
  c = c + 1
  TAPE_STEP [RIGHT]
End Loop

// F2 (6 flat blocks)
y = 8
SET_LED_COLOR [Blue]
Loop [h]
  LIGHT_PIXEL [c, y]
  y = y - 1
End Loop
```

```json
{
  "slotCap": 32,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": [3, 5, 4, 6, 2, 5, 4, 3],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "r", "value": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "VAR_OP", "target": "r", "operator": "+", "left": "r", "right": 1 },
        { "op": "TAPE_SEEK", "index": 1 },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "SET_LED_COLOR", "color": "White" },
        { "op": "LIGHT_PIXEL", "x": "r", "y": "r" },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        { "op": "VAR_OP", "target": "d", "operator": "-", "left": 9, "right": "r" },
        { "op": "LIGHT_PIXEL", "x": "d", "y": "r" },
        { "op": "PLAY_NOTE", "pitch": "r", "duration": 0.25 }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "h", "value": "$cellValue" },
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ],
  "F2": [
    { "op": "VAR_ASSIGN", "var": "y", "value": 8 },
    { "op": "SET_LED_COLOR", "color": "Blue" },
    {
      "op": "LOOP_START",
      "count": "h",
      "body": [
        { "op": "LIGHT_PIXEL", "x": "c", "y": "y" },
        { "op": "VAR_OP", "target": "y", "operator": "-", "left": "y", "right": 1 }
      ]
    }
  ]
}
```

---

## Variation 2: Countdown `3-2-1-GO!` + Fireworks (`23` Flat Blocks)

```text
// MAIN (23 flat blocks)
SET_BEAT_DELAY [0]
i = 1
n = 4
Loop [3]
  CLEAR_LEDS
  TAPE_SEEK [i]
  STAMP_FROM_TAPE
  n = n - 1
  PLAY_NOTE [n, 1]
  i = i + 64
End Loop
CLEAR_LEDS
SET_LED_COLOR [Yellow]
STAMP_PRESET [STAR]
PLAY_CHIME
WAIT_BEAT [0.5]
CLEAR_LEDS
SET_LED_COLOR [Pink]
LIGHT_PIXEL [1, 1]
LIGHT_PIXEL [8, 1]
LIGHT_PIXEL [1, 8]
LIGHT_PIXEL [8, 8]
WAIT_BEAT [1]
```

```json
{
  "slotCap": 26,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": {
    "length": 192,
    "cells": {
      "11": "red", "12": "red", "13": "red", "14": "red",
      "22": "red",
      "28": "red", "29": "red", "30": "red",
      "38": "red",
      "43": "red", "44": "red", "45": "red", "46": "red",

      "75": "orange", "76": "orange", "77": "orange", "78": "orange",
      "86": "orange",
      "92": "orange", "93": "orange", "94": "orange",
      "99": "orange",
      "107": "orange", "108": "orange", "109": "orange", "110": "orange",

      "140": "green", "141": "green",
      "149": "green",
      "157": "green",
      "165": "green",
      "172": "green", "173": "green", "174": "green"
    }
  },
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "n", "value": 4 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "STAMP_FROM_TAPE" },
        { "op": "VAR_OP", "target": "n", "operator": "-", "left": "n", "right": 1 },
        { "op": "PLAY_NOTE", "pitch": "n", "duration": 1 },
        { "op": "VAR_OP", "target": "i", "operator": "+", "left": "i", "right": 64 }
      ]
    },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "Yellow" },
    { "op": "STAMP_PRESET", "preset": "STAR" },
    { "op": "PLAY_CHIME" },
    { "op": "WAIT_BEAT", "beats": 0.5 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "Pink" },
    { "op": "LIGHT_PIXEL", "x": 1, "y": 1 },
    { "op": "LIGHT_PIXEL", "x": 8, "y": 1 },
    { "op": "LIGHT_PIXEL", "x": 1, "y": 8 },
    { "op": "LIGHT_PIXEL", "x": 8, "y": 8 },
    { "op": "WAIT_BEAT", "beats": 1 }
  ]
}
```

---

## Variation 3: `16×16` Procedural Pixel Kaleidoscope (`25` Flat Blocks, `matrixSize: 16`)

```text
// MAIN (18 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  CLEAR_LEDS
  k = 1
  SET_LED_COLOR [Cyan]
  Loop [8]
    Call F1
    PLAY_NOTE [k, 0.25]
    k = k + 1
  End Loop
  SET_LED_COLOR [Pink]
  k = 8
  Loop [8]
    Call F1
    PLAY_NOTE [k, 0.25]
    k = k - 1
  End Loop
End Loop

// F1 (7 flat blocks)
u = 17 - k
v = 9 - k
w = 17 - v
LIGHT_PIXEL [k, v]
LIGHT_PIXEL [u, v]
LIGHT_PIXEL [k, w]
LIGHT_PIXEL [u, w]
```

```json
{
  "slotCap": 30,
  "matrixSize": 16,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "VAR_ASSIGN", "var": "k", "value": 1 },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        {
          "op": "LOOP_START",
          "count": 8,
          "body": [
            { "op": "CALL_FN", "fn": "F1" },
            { "op": "PLAY_NOTE", "pitch": "k", "duration": 0.25 },
            { "op": "VAR_OP", "target": "k", "operator": "+", "left": "k", "right": 1 }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "Pink" },
        { "op": "VAR_ASSIGN", "var": "k", "value": 8 },
        {
          "op": "LOOP_START",
          "count": 8,
          "body": [
            { "op": "CALL_FN", "fn": "F1" },
            { "op": "PLAY_NOTE", "pitch": "k", "duration": 0.25 },
            { "op": "VAR_OP", "target": "k", "operator": "-", "left": "k", "right": 1 }
          ]
        }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_OP", "target": "u", "operator": "-", "left": 17, "right": "k" },
    { "op": "VAR_OP", "target": "v", "operator": "-", "left": 9, "right": "k" },
    { "op": "VAR_OP", "target": "w", "operator": "-", "left": 17, "right": "v" },
    { "op": "LIGHT_PIXEL", "x": "k", "y": "v" },
    { "op": "LIGHT_PIXEL", "x": "u", "y": "v" },
    { "op": "LIGHT_PIXEL", "x": "k", "y": "w" },
    { "op": "LIGHT_PIXEL", "x": "u", "y": "w" }
  ]
}
```
