# Lesson `tape.4` — Scale Melody & LED Stripes

- **Format:** 🎨 Creative Sandbox
- **Environment:** 🎵 Beat & Light (`BEAT_VERSION = 2`, 2-octave C Major `1..16`, `8×8` LED grid)
- **One-Concept Goal:** Map numeric scale notes (`$cellValue`) onto music pitches (`PLAY_NOTE`) and bouncing LED piano-roll coordinates (`r = 9 - a`) without repeated-note display freezes.

---

## Guided Co-Pilot Card

Numbers `1` through `8` on the Tape play a musical scale **and** light up matching piano-roll bars! Edit notes in the top **Tape Dock** and watch each note leap cleanly—even when the same note plays twice in a row.

---

## Capabilities & Edge-Case Rules

```json
{
  "env": "beat_light",
  "mode": "creative_sandbox",
  "tape": { "length": 10000, "window": "1..8", "editable": true },
  "outOfRangePolicy": {
    "pitch0": "LIGHT_COL [0] safe no-op; PLAY_NOTE rests",
    "pitch9to16": "LIGHT_COL safe no-op (>8); PLAY_NOTE plays 2-octave C Major (e.g. 9 = D5)",
    "emptyCell": "$cellValue triggers TYPE_ERROR bounce"
  },
  "sensors": ["$cellValue", "$cellEmpty", "$headPos"],
  "actions": ["SET_BEAT_DELAY", "TAPE_SEEK", "TAPE_STEP", "CLEAR_LEDS", "SET_LED_COLOR", "LIGHT_COL", "LIGHT_ROW", "LIGHT_PIXEL", "PLAY_NOTE", "WAIT_BEAT", "VAR_ASSIGN", "VAR_OP"],
  "starterBudget": { "MAIN": 13, "slotCap": 22 }
}
```

---

## Starter Workspace — *Frère Jacques* Piano-Roll Bar (`1..8`)

**Initial Tape (`1..8`):** `[1, 2, 3, 1, 1, 2, 3, 1]`

### Canonical Pseudocode (`MAIN` — `13` flat blocks)

```text
// MAIN (13 flat blocks)
SET_BEAT_DELAY [0]
TAPE_SEEK [1]
Loop [8]
  a = $cellValue
  CLEAR_LEDS
  SET_LED_COLOR [cyan]
  LIGHT_COL [$headPos]
  r = 9 - a
  SET_LED_COLOR [white]
  LIGHT_PIXEL [$headPos, r]
  PLAY_NOTE [a, 0.5]
  TAPE_STEP [RIGHT]
End Loop
```

### Canonical JSON AST (`Starter`)

```json
{
  "slotCap": 16,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "a", "value": "$cellValue" },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_COL", "col": "$headPos" },
        { "op": "VAR_OP", "target": "r", "left": 9, "operator": "-", "right": "a" },
        { "op": "SET_LED_COLOR", "color": "white" },
        { "op": "LIGHT_PIXEL", "x": "$headPos", "y": "r" },
        { "op": "PLAY_NOTE", "pitch": "a", "duration": 0.5 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ]
}
```

---

## Variation Cards (`1..3`)

### Variation 1 — *Twinkle, Twinkle* (`1..14` Wrapped Piano-Roll)

**Tape (`1..14`):** `[1, 1, 5, 5, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1]`

```text
// MAIN (14 flat blocks)
SET_BEAT_DELAY [0]
TAPE_SEEK [1]
While (NOT $cellEmpty)
  a = $cellValue
  c = $headPos - 1
  c = c % 8
  c = c + 1
  r = 9 - a
  CLEAR_LEDS
  SET_LED_COLOR [yellow]
  LIGHT_PIXEL [c, r]
  PLAY_NOTE [a, 0.5]
  TAPE_STEP [RIGHT]
End While
```

```json
{
  "slotCap": 18,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "$cellEmpty" } },
      "body": [
        { "op": "VAR_ASSIGN", "var": "a", "value": "$cellValue" },
        { "op": "VAR_OP", "target": "c", "left": "$headPos", "operator": "-", "right": 1 },
        { "op": "VAR_OP", "target": "c", "left": "c", "operator": "%", "right": 8 },
        { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 },
        { "op": "VAR_OP", "target": "r", "left": 9, "operator": "-", "right": "a" },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "yellow" },
        { "op": "LIGHT_PIXEL", "x": "c", "y": "r" },
        { "op": "PLAY_NOTE", "pitch": "a", "duration": 0.5 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ]
}
```

### Variation 2 — *Ode to Joy* + Bass Pulse (`1..16` with Measure Flash `q = $headPos % 4`)

**Tape (`1..16`):** `[3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2, 1]`

```text
// MAIN (19 flat blocks)
SET_BEAT_DELAY [0]
TAPE_SEEK [1]
While (NOT $cellEmpty)
  a = $cellValue
  c = $headPos - 1
  c = c % 8
  c = c + 1
  r = 9 - a
  q = $headPos % 4
  CLEAR_LEDS
  SET_LED_COLOR [green]
  LIGHT_PIXEL [c, r]
  If (q == 1)
    SET_LED_COLOR [purple]
    LIGHT_ROW [8]
  End If
  PLAY_NOTE [a, 0.5]
  TAPE_STEP [RIGHT]
End While
```

```json
{
  "slotCap": 22,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "$cellEmpty" } },
      "body": [
        { "op": "VAR_ASSIGN", "var": "a", "value": "$cellValue" },
        { "op": "VAR_OP", "target": "c", "left": "$headPos", "operator": "-", "right": 1 },
        { "op": "VAR_OP", "target": "c", "left": "c", "operator": "%", "right": 8 },
        { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 },
        { "op": "VAR_OP", "target": "r", "left": 9, "operator": "-", "right": "a" },
        { "op": "VAR_OP", "target": "q", "left": "$headPos", "operator": "%", "right": 4 },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "green" },
        { "op": "LIGHT_PIXEL", "x": "c", "y": "r" },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "q", "right": 1 },
          "then": [
            { "op": "SET_LED_COLOR", "color": "purple" },
            { "op": "LIGHT_ROW", "row": 8 }
          ]
        },
        { "op": "PLAY_NOTE", "pitch": "a", "duration": 0.5 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ]
}
```

### Variation 3 — Venetian-Blind `Black` Mask (`8`-Row Curtain Erase)

**Tape (`1..8`):** `[2, 4, 6, 8, 7, 5, 3, 1]`

```text
// MAIN (16 flat blocks)
SET_BEAT_DELAY [0]
SET_LED_COLOR [cyan]
i = 1
Loop [8]
  LIGHT_ROW [i]
  i = i + 1
End Loop
WAIT_BEAT [0.5]
TAPE_SEEK [1]
SET_LED_COLOR [black]
Loop [8]
  a = $cellValue
  LIGHT_ROW [a]
  PLAY_NOTE [a, 0.5]
  TAPE_STEP [RIGHT]
End Loop
```

```json
{
  "slotCap": 20,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "LIGHT_ROW", "row": "i" },
        { "op": "VAR_OP", "target": "i", "left": "i", "operator": "+", "right": 1 }
      ]
    },
    { "op": "WAIT_BEAT", "beats": 0.5 },
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "SET_LED_COLOR", "color": "black" },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "VAR_ASSIGN", "var": "a", "value": "$cellValue" },
        { "op": "LIGHT_ROW", "row": "a" },
        { "op": "PLAY_NOTE", "pitch": "a", "duration": 0.5 },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ]
}
```

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why `CLEAR_LEDS` + `r = 9 - a`:** Without `CLEAR_LEDS` and moving the X playhead (`$headPos`), repeated notes (`[1, 1, 5, 5]` in *Twinkle*) leave earlier columns lit so the matrix looks frozen. Inverting row index via 3-address `r = 9 - a` puts note `1` at bottom row `8` and note `8` at top row `1`.
- **Safe Boundary Behavior:** Writing `0` or `9` into a melody cell won't crash LED columns (`LIGHT_COL` safely ignores out-of-range indices, while `PLAY_NOTE` supports `1..16`), whereas leaving a cell `∅` triggers `TYPE_ERROR` on `a = $cellValue`.

</details>
