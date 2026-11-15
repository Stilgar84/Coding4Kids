# `anim.6`: Scanner Bar & Wipe Transitions (`🎨` Creative Sandbox)

- **World:** 🎵 Beat & Light Matrix (`8×8`, `BEAT_VERSION = 2`)
- **Card Type:** `🎨` Creative Sandbox (`Starter` + `4` Variation Cards)
- **Prerequisite:** [`anim.5`](./lesson_anim_5_spiral_trail_and_white_eraser.md)
- **Hardware Config:** `matrixSize: 8`, `beatVersion: 2`, `defaultLoopPlayback: true`
- **Block Budget (Closer-Inclusive):** `Starter: 20` (`Slot Cap: 24`; Var 1: `21 / 26`, Var 2: `24 / 28`, Var 3: `26 / 30`, Var 4: `17 / 22`)

> **Guided Co-Pilot Card:**
> Sweep `r` cleanly from Row `1` down to `7` (`F1`) and back up `8` to `2` (`F2`) with **`PLAY_NOTE [r, 0.25]`**—zero double-bounces! Test Color Wipes, Theater Curtains, Diagonal Bounce, and **Black (`⊘`) Eraser Wipes** in the Variation Cards.

<details>
<summary>📖 Parent / Teacher Tip — Eliminating Double-Lit Turnarounds & Selective Black Erase</summary>

- **Zero Double-Lit Bounce:** `MAIN` starts `r = 1`. `F1` sweeps `7` rows (`1..7`, leaving `r = 8`), and `F2` sweeps `7` rows (`8..2`, leaving `r = 1`), so turnaround rows `1` and `8` never stay lit twice in a row! Each step uses `PLAY_NOTE [r, 0.25]` (`BEAT_VERSION = 2` quarter-beat duration) so visuals and rising/falling C-major synth notes stay locked together.
- **Black (`⊘` Off) Erase in Var 4:** Because `CLEAR_LEDS` wipes everything at once, **Var 4** demonstrates `SET_LED_COLOR [Black]` (`⊘` Off) wiping away row-by-row over a lit `STAR` without erasing unvisited rows!

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
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "LIGHT_ROW", "LIGHT_COL", "LIGHT_PIXEL", "STAMP_PRESET",
    "PLAY_NOTE", "WAIT_BEAT", "LOOP_START", "IF", "CALL_FN",
    "VAR_ASSIGN", "VAR_OP"
  ]
}
```

---

## Starter: Musical Row Scanner Sweep (`20` Flat Blocks)

```text
// MAIN (6 flat blocks)
SET_BEAT_DELAY [0]
r = 1
Loop [4]
  Call F1
  Call F2
End Loop

// F1 (7 flat blocks)
SET_LED_COLOR [Red]
Loop [7]
  CLEAR_LEDS
  LIGHT_ROW [r]
  PLAY_NOTE [r, 0.25]
  r = r + 1
End Loop

// F2 (7 flat blocks)
SET_LED_COLOR [Cyan]
Loop [7]
  CLEAR_LEDS
  LIGHT_ROW [r]
  PLAY_NOTE [r, 0.25]
  r = r - 1
End Loop
```

```json
{
  "slotCap": 24,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "r", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    }
  ],
  "F1": [
    { "op": "SET_LED_COLOR", "color": "Red" },
    {
      "op": "LOOP_START",
      "count": 7,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "PLAY_NOTE", "pitch": "r", "duration": 0.25 },
        { "op": "VAR_OP", "target": "r", "operator": "+", "left": "r", "right": 1 }
      ]
    }
  ],
  "F2": [
    { "op": "SET_LED_COLOR", "color": "Cyan" },
    {
      "op": "LOOP_START",
      "count": 7,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "LIGHT_ROW", "row": "r" },
        { "op": "PLAY_NOTE", "pitch": "r", "duration": 0.25 },
        { "op": "VAR_OP", "target": "r", "operator": "-", "left": "r", "right": 1 }
      ]
    }
  ]
}
```

---

## Variation 1: Accumulated Color Wipe (`21` Flat Blocks)

```text
// MAIN (9 flat blocks)
SET_BEAT_DELAY [0]
Loop [2]
  c = 1
  SET_LED_COLOR [Purple]
  Call F1
  c = 8
  SET_LED_COLOR [Cyan]
  Call F2
End Loop

// F1 (6 flat blocks)
Loop [8]
  LIGHT_COL [c]
  PLAY_NOTE [c, 0.25]
  c = c + 1
  WAIT_BEAT [0.25]
End Loop

// F2 (6 flat blocks)
Loop [8]
  LIGHT_COL [c]
  PLAY_NOTE [c, 0.25]
  c = c - 1
  WAIT_BEAT [0.25]
End Loop
```

```json
{
  "slotCap": 26,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "VAR_ASSIGN", "var": "c", "value": 1 },
        { "op": "SET_LED_COLOR", "color": "Purple" },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_ASSIGN", "var": "c", "value": 8 },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        { "op": "CALL_FN", "fn": "F2" }
      ]
    }
  ],
  "F1": [
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "LIGHT_COL", "col": "c" },
        { "op": "PLAY_NOTE", "pitch": "c", "duration": 0.25 },
        { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 },
        { "op": "WAIT_BEAT", "beats": 0.25 }
      ]
    }
  ],
  "F2": [
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "LIGHT_COL", "col": "c" },
        { "op": "PLAY_NOTE", "pitch": "c", "duration": 0.25 },
        { "op": "VAR_OP", "target": "c", "operator": "-", "left": "c", "right": 1 },
        { "op": "WAIT_BEAT", "beats": 0.25 }
      ]
    }
  ]
}
```

---

## Variation 2: Curtain Reveal (`24` Flat Blocks)

```text
// MAIN (15 flat blocks)
SET_BEAT_DELAY [0]
Loop [2]
  SET_LED_COLOR [Orange]
  Call F1
  SET_LED_COLOR [Black]
  a = 4
  b = 5
  Loop [4]
    LIGHT_COL [a]
    LIGHT_COL [b]
    WAIT_BEAT [0.25]
    a = a - 1
    b = b + 1
  End Loop
End Loop

// F1 (9 flat blocks)
a = 1
b = 8
Loop [4]
  LIGHT_COL [a]
  LIGHT_COL [b]
  PLAY_NOTE [a, 0.25]
  a = a + 1
  b = b - 1
End Loop
```

```json
{
  "slotCap": 28,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "SET_LED_COLOR", "color": "Orange" },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "SET_LED_COLOR", "color": "Black" },
        { "op": "VAR_ASSIGN", "var": "a", "value": 4 },
        { "op": "VAR_ASSIGN", "var": "b", "value": 5 },
        {
          "op": "LOOP_START",
          "count": 4,
          "body": [
            { "op": "LIGHT_COL", "col": "a" },
            { "op": "LIGHT_COL", "col": "b" },
            { "op": "WAIT_BEAT", "beats": 0.25 },
            { "op": "VAR_OP", "target": "a", "operator": "-", "left": "a", "right": 1 },
            { "op": "VAR_OP", "target": "b", "operator": "+", "left": "b", "right": 1 }
          ]
        }
      ]
    }
  ],
  "F1": [
    { "op": "VAR_ASSIGN", "var": "a", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "b", "value": 8 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "LIGHT_COL", "col": "a" },
        { "op": "LIGHT_COL", "col": "b" },
        { "op": "PLAY_NOTE", "pitch": "a", "duration": 0.25 },
        { "op": "VAR_OP", "target": "a", "operator": "+", "left": "a", "right": 1 },
        { "op": "VAR_OP", "target": "b", "operator": "-", "left": "b", "right": 1 }
      ]
    }
  ]
}
```

---

## Variation 3: Diagonal Pixel Bounce (`26` Flat Blocks)

```text
// MAIN (26 flat blocks)
SET_BEAT_DELAY [0]
x = 1
y = 3
u = 1
v = 1
SET_LED_COLOR [Green]
Loop [24]
  CLEAR_LEDS
  LIGHT_PIXEL [x, y]
  p = x + y
  PLAY_NOTE [p, 0.25]
  x = x + u
  y = y + v
  If (x >= 8)
    u = -1
  End If
  If (x <= 1)
    u = 1
  End If
  If (y >= 8)
    v = -1
  End If
  If (y <= 1)
    v = 1
  End If
End Loop
```

```json
{
  "slotCap": 30,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 3 },
    { "op": "VAR_ASSIGN", "var": "u", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "v", "value": 1 },
    { "op": "SET_LED_COLOR", "color": "Green" },
    {
      "op": "LOOP_START",
      "count": 24,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "VAR_OP", "target": "p", "operator": "+", "left": "x", "right": "y" },
        { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.25 },
        { "op": "VAR_OP", "target": "x", "operator": "+", "left": "x", "right": "u" },
        { "op": "VAR_OP", "target": "y", "operator": "+", "left": "y", "right": "v" },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">=", "left": "x", "right": 8 },
          "then": [{ "op": "VAR_ASSIGN", "var": "u", "value": -1 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "x", "right": 1 },
          "then": [{ "op": "VAR_ASSIGN", "var": "u", "value": 1 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">=", "left": "y", "right": 8 },
          "then": [{ "op": "VAR_ASSIGN", "var": "v", "value": -1 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "y", "right": 1 },
          "then": [{ "op": "VAR_ASSIGN", "var": "v", "value": 1 }]
        }
      ]
    }
  ]
}
```

---

## Variation 4: Selective `Black` (`⊘`) Eraser Wipe (`17` Flat Blocks)

```text
// MAIN (17 flat blocks)
SET_BEAT_DELAY [0]
Loop [2]
  SET_LED_COLOR [Yellow]
  r = 1
  Loop [8]
    LIGHT_ROW [r]
    PLAY_NOTE [r, 0.25]
    r = r + 1
  End Loop
  SET_LED_COLOR [Black]
  r = 1
  Loop [8]
    LIGHT_ROW [r]
    WAIT_BEAT [0.25]
    r = r + 1
  End Loop
End Loop
```

```json
{
  "slotCap": 22,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "SET_LED_COLOR", "color": "Yellow" },
        { "op": "VAR_ASSIGN", "var": "r", "value": 1 },
        {
          "op": "LOOP_START",
          "count": 8,
          "body": [
            { "op": "LIGHT_ROW", "row": "r" },
            { "op": "PLAY_NOTE", "pitch": "r", "duration": 0.25 },
            { "op": "VAR_OP", "target": "r", "operator": "+", "left": "r", "right": 1 }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "Black" },
        { "op": "VAR_ASSIGN", "var": "r", "value": 1 },
        {
          "op": "LOOP_START",
          "count": 8,
          "body": [
            { "op": "LIGHT_ROW", "row": "r" },
            { "op": "WAIT_BEAT", "beats": 0.25 },
            { "op": "VAR_OP", "target": "r", "operator": "+", "left": "r", "right": 1 }
          ]
        }
      ]
    }
  ]
}
```
