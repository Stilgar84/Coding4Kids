# `anim.8`: Animated Tape Equalizer (`🎨` Creative Sandbox)

- **World:** 🎵 Beat & Light Matrix (`8×8` + Sparse Memory Tape, `BEAT_VERSION = 2`)
- **Card Type:** `🎨` Creative Sandbox (`Starter` + `4` Variation Cards)
- **Prerequisite:** [`anim.7`](./lesson_anim_7_animated_skyline_day_to_night.md)
- **Hardware Config:** `matrixSize: 8`, `beatVersion: 2`, `defaultLoopPlayback: true`
- **Block Budget (Closer-Inclusive):** `Starter: 23` (`Slot Cap: 28`; Var 1: `28 / 32`, Var 2: `25 / 30`, Var 3: `26 / 30`, Var 4: `29 / 34`)

> **Guided Co-Pilot Card:**
> Seek Tape cell `1` every frame, read the `8` bar heights into `h`, pulse every beat with **`r = f % 2`**, and stack each column upward from row `8` (`y = y - 1`)! Load **Var 1–4** for Kick/Snare Groove, Rainbow Bars, Center Bass, or **`Black` (`⊘`) Peak Decay**.

<details>
<summary>📖 Parent / Teacher Tip — Bottom-Up Equalizer Bars & Musical Groove Sync</summary>

- **Closer-Inclusive Counts (`Starter: 23`):** `MAIN` (`8`) + `F1` (`9`) + `F2` (`6`) = `23` flat blocks (`Slot Cap: 28`). Strict 3-address `OP_VAR_OP` computes `r = f % 2` then `h = h + r` so odd beats bounce bars `+1` row cleanly.
- **Coordinate Direction:** Row `8` sits at the **bottom** of Beat's `8×8` pad, so `F2` starts at `y = 8` and decrements `y = y - 1` `h` times to grow upward!
- **Var 4 (`Black` `⊘` Peak-Hold Decay):** Demonstrates extinguishing just the floating top peak pixel (`SET_LED_COLOR [Black]`) on even beats without erasing the whole column below.

</details>

---

## Palette & Capabilities

```json
{
  "env": "beat",
  "matrixSize": 8,
  "beatVersion": 2,
  "defaultLoopPlayback": true,
  "allowVariables": true,
  "varNames": "a..z",
  "allowFunctions": ["F1", "F2"],
  "allowTape": true,
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "LIGHT_PIXEL", "DRUM_KICK", "DRUM_SNARE", "WAIT_BEAT",
    "LOOP_START", "IF", "CALL_FN",
    "VAR_ASSIGN", "VAR_OP", "TAPE_SEEK", "TAPE_STEP"
  ],
  "allowedSensors": ["$cellValue", "$cellColor"]
}
```

---

## Starter: Bouncing 8-Column Tape Equalizer (`23` Flat Blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [8]
  f = f + 1
  CLEAR_LEDS
  TAPE_SEEK [1]
  Call F1
  WAIT_BEAT [0.5]
End Loop

// F1 (9 flat blocks)
r = f % 2
c = 1
Loop [8]
  h = $cellValue
  h = h + r
  Call F2
  c = c + 1
  TAPE_STEP [RIGHT]
End Loop

// F2 (6 flat blocks)
y = 8
SET_LED_COLOR [Green]
Loop [h]
  LIGHT_PIXEL [c, y]
  y = y - 1
End Loop
```

```json
{
  "slotCap": 28,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": [3, 5, 2, 7, 6, 4, 7, 3],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_OP", "target": "f", "operator": "+", "left": "f", "right": 1 },
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": 1 },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "WAIT_BEAT", "beats": 0.5 }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_OP", "target": "r", "operator": "%", "left": "f", "right": 2 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "h", "value": "$cellValue" },
        { "op": "VAR_OP", "target": "h", "operator": "+", "left": "h", "right": "r" },
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ],
  "F2": [
    { "op": "VAR_ASSIGN", "var": "y", "value": 8 },
    { "op": "SET_LED_COLOR", "color": "Green" },
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

## Variation 1: Kick / Snare Musical Groove Equalizer (`28` Flat Blocks)

```text
// MAIN (13 flat blocks)
SET_BEAT_DELAY [0]
Loop [8]
  f = f + 1
  r = f % 2
  CLEAR_LEDS
  TAPE_SEEK [1]
  Call F1
  If (r == 1)
    DRUM_KICK
  Else
    DRUM_SNARE
  End If
End Loop

// F1 (9 flat blocks)
r = f % 2
c = 1
Loop [8]
  h = $cellValue
  h = h + r
  Call F2
  c = c + 1
  TAPE_STEP [RIGHT]
End Loop

// F2 (6 flat blocks)
y = 8
SET_LED_COLOR [Orange]
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
  "tape": [4, 6, 3, 7, 5, 7, 4, 2],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_OP", "target": "f", "operator": "+", "left": "f", "right": 1 },
        { "op": "VAR_OP", "target": "r", "operator": "%", "left": "f", "right": 2 },
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": 1 },
        { "op": "CALL_FN", "fn": "F1" },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
          "then": [{ "op": "DRUM_KICK" }],
          "else": [{ "op": "DRUM_SNARE" }]
        }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_OP", "target": "r", "operator": "%", "left": "f", "right": 2 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "h", "value": "$cellValue" },
        { "op": "VAR_OP", "target": "h", "operator": "+", "left": "h", "right": "r" },
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ],
  "F2": [
    { "op": "VAR_ASSIGN", "var": "y", "value": 8 },
    { "op": "SET_LED_COLOR", "color": "Orange" },
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

## Variation 2: Rainbow Stripes Equalizer (`25` Flat Blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [8]
  f = f + 1
  CLEAR_LEDS
  TAPE_SEEK [1]
  Call F1
  WAIT_BEAT [0.5]
End Loop

// F1 (12 flat blocks)
r = f % 2
c = 1
Loop [8]
  h = $cellValue
  h = h + r
  TAPE_STEP [RIGHT]
  g = $cellColor
  SET_LED_COLOR [g]
  Call F2
  c = c + 1
  TAPE_STEP [RIGHT]
End Loop

// F2 (5 flat blocks)
y = 8
Loop [h]
  LIGHT_PIXEL [c, y]
  y = y - 1
End Loop
```

```json
{
  "slotCap": 30,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": [3, "red", 6, "orange", 4, "yellow", 7, "green", 5, "cyan", 7, "blue", 4, "purple", 6, "pink"],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_OP", "target": "f", "operator": "+", "left": "f", "right": 1 },
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": 1 },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "WAIT_BEAT", "beats": 0.5 }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_OP", "target": "r", "operator": "%", "left": "f", "right": 2 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "h", "value": "$cellValue" },
        { "op": "VAR_OP", "target": "h", "operator": "+", "left": "h", "right": "r" },
        { "op": "TAPE_STEP", "direction": "RIGHT" },
        { "op": "VAR_ASSIGN", "var": "g", "value": "$cellColor" },
        { "op": "SET_LED_COLOR", "color": "g" },
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ],
  "F2": [
    { "op": "VAR_ASSIGN", "var": "y", "value": 8 },
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

## Variation 3: Center-Mirrored Bass Wave (`26` Flat Blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [8]
  f = f + 1
  CLEAR_LEDS
  TAPE_SEEK [1]
  Call F1
  WAIT_BEAT [0.5]
End Loop

// F1 (9 flat blocks)
r = f % 2
c = 1
Loop [8]
  h = $cellValue
  h = h + r
  Call F2
  c = c + 1
  TAPE_STEP [RIGHT]
End Loop

// F2 (9 flat blocks)
a = 4
b = 5
SET_LED_COLOR [Cyan]
Loop [h]
  LIGHT_PIXEL [c, a]
  LIGHT_PIXEL [c, b]
  a = a - 1
  b = b + 1
End Loop
```

```json
{
  "slotCap": 30,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": [1, 3, 2, 3, 3, 2, 3, 1],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_OP", "target": "f", "operator": "+", "left": "f", "right": 1 },
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": 1 },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "WAIT_BEAT", "beats": 0.5 }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_OP", "target": "r", "operator": "%", "left": "f", "right": 2 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "h", "value": "$cellValue" },
        { "op": "VAR_OP", "target": "h", "operator": "+", "left": "h", "right": "r" },
        { "op": "CALL_FN", "fn": "F2" },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ],
  "F2": [
    { "op": "VAR_ASSIGN", "var": "a", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "b", "value": 5 },
    { "op": "SET_LED_COLOR", "color": "Cyan" },
    {
      "op": "LOOP_START",
      "count": "h",
      "body": [
        { "op": "LIGHT_PIXEL", "x": "c", "y": "a" },
        { "op": "LIGHT_PIXEL", "x": "c", "y": "b" },
        { "op": "VAR_OP", "target": "a", "operator": "-", "left": "a", "right": 1 },
        { "op": "VAR_OP", "target": "b", "operator": "+", "left": "b", "right": 1 }
      ]
    }
  ]
}
```

---

## Variation 4: Peak-Hold with `Black` (`⊘`) Decay (`29` Flat Blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [8]
  f = f + 1
  CLEAR_LEDS
  TAPE_SEEK [1]
  Call F1
  DRUM_KICK
End Loop

// F1 (8 flat blocks)
r = f % 2
c = 1
Loop [8]
  h = $cellValue
  Call F2
  c = c + 1
  TAPE_STEP [RIGHT]
End Loop

// F2 (13 flat blocks)
y = 8
SET_LED_COLOR [Blue]
Loop [h]
  LIGHT_PIXEL [c, y]
  y = y - 1
End Loop
m = 8 - h
If (r == 1)
  SET_LED_COLOR [Red]
Else
  SET_LED_COLOR [Black]
End If
LIGHT_PIXEL [c, m]
```

```json
{
  "slotCap": 34,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": [3, 5, 2, 6, 5, 4, 6, 3],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "VAR_OP", "target": "f", "operator": "+", "left": "f", "right": 1 },
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": 1 },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "DRUM_KICK" }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_OP", "target": "r", "operator": "%", "left": "f", "right": 2 },
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
    },
    { "op": "VAR_OP", "target": "m", "operator": "-", "left": 8, "right": "h" },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
      "then": [{ "op": "SET_LED_COLOR", "color": "Red" }],
      "else": [{ "op": "SET_LED_COLOR", "color": "Black" }]
    },
    { "op": "LIGHT_PIXEL", "x": "c", "y": "m" }
  ]
}
```
