# Capstone `tape.C` — Step Sequencer Studio

- **Format:** 🏆 Capstone Creative Sandbox
- **Environment:** 🎵 Beat & Light (`BEAT_VERSION = 2`, dual-region Tape `[colors]` + `[pitches]`, `STAMP_FROM_TAPE` mascot sprites, `defaultLoopPlayback: true`)
- **One-Concept Goal:** Store parallel data tracks on one Memory Tape—light colors in `1..8` and note pitches in `9..16` (or `1..128` 2-frame sprites + `129..136` bassline)—indexed via explicit 3-address offsets (`o = x + 8`, `r = 9 - p`, `r = x % 2`).

---

## Guided Co-Pilot Card

One Memory Tape can hold **two songs at once**: colors in cells `1..8` and musical notes in `9..16`! Remix notes or switch to the dancing pixel mascot and `1`-beat-locked Drum & Bass cards!

---

## Capabilities & Budget

```json
{
  "env": "beat_light",
  "mode": "creative_capstone_sandbox",
  "defaultLoopPlayback": true,
  "tape": { "length": 10000, "window": "1..8", "editable": true },
  "sensors": ["$cellColor", "$cellValue"],
  "actions": ["SET_BEAT_DELAY", "CLEAR_LEDS", "TAPE_SEEK", "SET_LED_COLOR", "LIGHT_PIXEL", "LIGHT_COL", "STAMP_FROM_TAPE", "PLAY_NOTE", "DRUM_KICK", "DRUM_SNARE", "CALL_FN", "VAR_ASSIGN", "VAR_OP"],
  "starterBudget": { "MAIN": 6, "F1": 10, "total": 16, "slotCap": 24 }
}
```

---

## Starter Workspace — Dual-Region Contour Sequencer (`MAIN` `6` + `F1` `10`)

**Initial Tape (`1..16`):**
- **Cells `1..8` (Colors):** `["cyan", "pink", "yellow", "green", "blue", "purple", "orange", "white"]` (step 8 upgraded from `black` to `white` so step 8 illuminates cleanly!)
- **Cells `9..16` (Pitches):** `[1, 5, 3, 5, 2, 6, 4, 5]`

### Canonical Pseudocode (`MAIN` `6` + `F1` `10` = `16` flat blocks)

```text
// MAIN (6 flat blocks)
SET_BEAT_DELAY [0]
x = 1
Loop [8]
  Call F1
  x = x + 1
End Loop

// F1 (10 flat blocks)
CLEAR_LEDS
TAPE_SEEK [x]
c = $cellColor
SET_LED_COLOR [c]
o = x + 8
TAPE_SEEK [o]
p = $cellValue
r = 9 - p
LIGHT_PIXEL [x, r]
PLAY_NOTE [p, 0.5]
```

### Canonical JSON AST (`Starter`)

```json
{
  "slotCap": 20,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 1 },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    { "op": "TAPE_SEEK", "index": "x" },
    { "op": "VAR_ASSIGN", "var": "c", "value": "$cellColor" },
    { "op": "SET_LED_COLOR", "color": "c" },
    { "op": "VAR_OP", "target": "o", "left": "x", "operator": "+", "right": 8 },
    { "op": "TAPE_SEEK", "index": "o" },
    { "op": "VAR_ASSIGN", "var": "p", "value": "$cellValue" },
    { "op": "VAR_OP", "target": "r", "left": 9, "operator": "-", "right": "p" },
    { "op": "LIGHT_PIXEL", "x": "x", "y": "r" },
    { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.5 }
  ]
}
```

---

## Variation Cards (`1..3`)

### Variation 1 — Chiptune Triad Arpeggiator (`1..8` Palette + `9..24` 16-Step Arpeggio)

**Tape (`1..24`):** `1..8` = `["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"]` · `9..24` = `[1, 3, 5, 8, 5, 3, 1, 5, 2, 4, 6, 9, 6, 4, 2, 6]`.

```text
// MAIN (6 flat blocks)
SET_BEAT_DELAY [0]
x = 1
Loop [16]
  Call F1
  x = x + 1
End Loop

// F1 (12 flat blocks)
CLEAR_LEDS
k = x - 1
k = k % 8
k = k + 1
TAPE_SEEK [k]
c = $cellColor
SET_LED_COLOR [c]
LIGHT_COL [k]
o = x + 8
TAPE_SEEK [o]
p = $cellValue
PLAY_NOTE [p, 0.25]
```

```json
{
  "slotCap": 22,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 1 },
    {
      "op": "LOOP",
      "count": 16,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    { "op": "VAR_OP", "target": "k", "left": "x", "operator": "-", "right": 1 },
    { "op": "VAR_OP", "target": "k", "left": "k", "operator": "%", "right": 8 },
    { "op": "VAR_OP", "target": "k", "left": "k", "operator": "+", "right": 1 },
    { "op": "TAPE_SEEK", "index": "k" },
    { "op": "VAR_ASSIGN", "var": "c", "value": "$cellColor" },
    { "op": "SET_LED_COLOR", "color": "c" },
    { "op": "LIGHT_COL", "col": "k" },
    { "op": "VAR_OP", "target": "o", "left": "x", "operator": "+", "right": 8 },
    { "op": "TAPE_SEEK", "index": "o" },
    { "op": "VAR_ASSIGN", "var": "p", "value": "$cellValue" },
    { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.25 }
  ]
}
```

### Variation 2 — Dancing Pixel Mascot + Bassline (`STAMP_FROM_TAPE` + `r = x % 2`)

**Tape (`1..136`):** `1..64` = Mascot Pose A, `65..128` = Mascot Pose B, `129..136` = Bassline `[1, 1, 3, 5, 4, 3, 2, 1]`.

```text
// MAIN (6 flat blocks)
SET_BEAT_DELAY [0]
x = 1
Loop [8]
  Call F1
  x = x + 1
End Loop

// F1 (11 flat blocks)
CLEAR_LEDS
r = x % 2
If (r == 1)
  STAMP_FROM_TAPE [1]
Else
  STAMP_FROM_TAPE [65]
End If
o = x + 128
TAPE_SEEK [o]
p = $cellValue
PLAY_NOTE [p, 0.5]
```

```json
{
  "slotCap": 22,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 1 },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    { "op": "VAR_OP", "target": "r", "left": "x", "operator": "%", "right": 2 },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
      "then": [{ "op": "STAMP_FROM_TAPE", "value": 1 }],
      "else": [{ "op": "STAMP_FROM_TAPE", "value": 65 }]
    },
    { "op": "VAR_OP", "target": "o", "left": "x", "operator": "+", "right": 128 },
    { "op": "TAPE_SEEK", "index": "o" },
    { "op": "VAR_ASSIGN", "var": "p", "value": "$cellValue" },
    { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.5 }
  ]
}
```

### Variation 3 — `1`-Beat-Locked Drum & Bass Groove (`If Red → Kick [1]`, `Else If Orange → Snare [1]`, `Else → Note [1]`)

**Tape (`1..16`):** `1..8` = `["red", "cyan", "orange", "cyan", "red", "cyan", "orange", "cyan"]` · `9..16` = `[1, 5, 1, 3, 1, 6, 1, 5]`.

```text
// MAIN (6 flat blocks)
SET_BEAT_DELAY [0]
x = 1
Loop [8]
  Call F1
  x = x + 1
End Loop

// F1 (15 flat blocks)
CLEAR_LEDS
TAPE_SEEK [x]
c = $cellColor
SET_LED_COLOR [c]
LIGHT_COL [x]
o = x + 8
TAPE_SEEK [o]
p = $cellValue
If (c == red)
  DRUM_KICK
Else If (c == orange)
  DRUM_SNARE
Else
  PLAY_NOTE [p, 1]
End If
```

```json
{
  "slotCap": 24,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 1 },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    { "op": "TAPE_SEEK", "index": "x" },
    { "op": "VAR_ASSIGN", "var": "c", "value": "$cellColor" },
    { "op": "SET_LED_COLOR", "color": "c" },
    { "op": "LIGHT_COL", "col": "x" },
    { "op": "VAR_OP", "target": "o", "left": "x", "operator": "+", "right": 8 },
    { "op": "TAPE_SEEK", "index": "o" },
    { "op": "VAR_ASSIGN", "var": "p", "value": "$cellValue" },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "c", "right": "red" },
      "then": [{ "op": "DRUM_KICK" }],
      "elseIfs": [
        {
          "cond": { "op": "CMP", "operator": "==", "left": "c", "right": "orange" },
          "body": [{ "op": "DRUM_SNARE" }]
        }
      ],
      "else": [{ "op": "PLAY_NOTE", "pitch": "p", "duration": 1 }]
    }
  ]
}
```

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Exact `6`-Block `MAIN` & Strict 3-Address Offsets:** All 4 presets share the clean `6`-flat-block `MAIN` loop (`SET_BEAT_DELAY [0]`, `x = 1`, `Loop [...]`, `Call F1`, `x = x + 1`, `End Loop`) while computing `o = x + 8` / `o = x + 128`, `r = 9 - p`, and `r = x % 2` via 3-address `VAR_OP`.
- **Sync Lock in Variation 3:** Because `DRUM_KICK`, `DRUM_SNARE`, and `PLAY_NOTE [p, 1]` each consume exactly `1.0` beat inside mutually exclusive `If / Else If / Else` branches, the Drum & Bass groove stays locked without `1.5`-beat timing drift.

</details>
