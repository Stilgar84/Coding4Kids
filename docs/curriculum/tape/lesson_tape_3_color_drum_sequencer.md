# Lesson `tape.3` — Color Drum Sequencer

- **Format:** 🎨 Creative Sandbox
- **Environment:** 🎵 Beat & Light (`BEAT_VERSION = 2`, HUD Counter `🎵 #`, `Black` = index `8` `#0f172a` `⊘`)
- **One-Concept Goal:** Turn color swatches on the Tape into a live drum sequencer by testing `$cellColor == [Swatch]` and locking every hit and rest to an exact `1.0` beat.

---

## Guided Co-Pilot Card

Each color swatch is a drum sound: **Red = Kick 🥁**, **Orange = Snare 🪘**, **Purple = Clap 👏**, and **Black (`⊘`) = Silent Rest**! Change the Tape pattern in the top dock to compose your own groove.

---

## Capabilities & Timing Contract

```json
{
  "env": "beat_light",
  "mode": "creative_sandbox",
  "hudCounter": "🎵 #",
  "tape": { "length": 10000, "window": "1..8", "editable": true },
  "timingContract": "SET_BEAT_DELAY [0]; DRUM_* = 1 beat; PLAY_CHIME (0 beats) + WAIT_BEAT [1] = 1 beat; Else rest = WAIT_BEAT [1] = 1 beat",
  "sensors": ["$cellColor", "$headPos"],
  "actions": ["SET_BEAT_DELAY", "TAPE_SEEK", "TAPE_STEP", "CLEAR_LEDS", "SET_LED_COLOR", "LIGHT_COL", "LIGHT_PIXEL", "DRUM_KICK", "DRUM_SNARE", "DRUM_CLAP", "PLAY_CHIME", "WAIT_BEAT", "CALL_FN", "VAR_OP"],
  "starterBudget": { "MAIN": 8, "F1": 16, "total": 24, "slotCap": 40 }
}
```

---

## Starter Workspace — 4-Bar Electro Drum Loop

**Initial Tape (`1..8`):** `["red", "black", "orange", "black", "red", "purple", "orange", "black"]` (`4 bars × 8 beats = 🎵 #32`)

### Canonical Pseudocode (`MAIN` `8` + `F1` `16` = `24` flat blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  TAPE_SEEK [1]
  Loop [8]
    Call F1
    TAPE_STEP [RIGHT]
  End Loop
End Loop

// F1 (16 flat blocks)
CLEAR_LEDS
If ($cellColor == red)
  SET_LED_COLOR [red]
  LIGHT_COL [$headPos]
  DRUM_KICK
Else If ($cellColor == orange)
  SET_LED_COLOR [orange]
  LIGHT_COL [$headPos]
  DRUM_SNARE
Else If ($cellColor == purple)
  SET_LED_COLOR [purple]
  LIGHT_COL [$headPos]
  DRUM_CLAP
Else
  WAIT_BEAT [1]
End If
```

### Canonical JSON AST (`Starter`)

```json
{
  "slotCap": 26,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP",
      "count": 4,
      "body": [
        { "op": "TAPE_SEEK", "index": 1 },
        {
          "op": "LOOP",
          "count": 8,
          "body": [
            { "op": "CALL_FN", "fn": "F1" },
            { "op": "TAPE_STEP", "direction": "RIGHT" }
          ]
        }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
      "then": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_COL", "col": "$headPos" },
        { "op": "DRUM_KICK" }
      ],
      "elseIfs": [
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "orange" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "orange" },
            { "op": "LIGHT_COL", "col": "$headPos" },
            { "op": "DRUM_SNARE" }
          ]
        },
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "purple" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "purple" },
            { "op": "LIGHT_COL", "col": "$headPos" },
            { "op": "DRUM_CLAP" }
          ]
        }
      ],
      "else": [{ "op": "WAIT_BEAT", "beats": 1 }]
    }
  ]
}
```

---

## Variation Cards (`1..3`)

### Variation 1 — 4-Sound Electro Bar Meter (Adds `Cyan` Hi-Hat `PLAY_CHIME`)

**Tape (`1..8`):** `["red", "cyan", "orange", "cyan", "red", "purple", "orange", "cyan"]`

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  TAPE_SEEK [1]
  Loop [8]
    Call F1
    TAPE_STEP [RIGHT]
  End Loop
End Loop

// F1 (21 flat blocks)
CLEAR_LEDS
If ($cellColor == red)
  SET_LED_COLOR [red]
  LIGHT_COL [$headPos]
  DRUM_KICK
Else If ($cellColor == orange)
  SET_LED_COLOR [orange]
  LIGHT_COL [$headPos]
  DRUM_SNARE
Else If ($cellColor == purple)
  SET_LED_COLOR [purple]
  LIGHT_COL [$headPos]
  DRUM_CLAP
Else If ($cellColor == cyan)
  SET_LED_COLOR [cyan]
  LIGHT_COL [$headPos]
  PLAY_CHIME
  WAIT_BEAT [1]
Else
  WAIT_BEAT [1]
End If
```

```json
{
  "slotCap": 32,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP",
      "count": 4,
      "body": [
        { "op": "TAPE_SEEK", "index": 1 },
        {
          "op": "LOOP",
          "count": 8,
          "body": [
            { "op": "CALL_FN", "fn": "F1" },
            { "op": "TAPE_STEP", "direction": "RIGHT" }
          ]
        }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
      "then": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_COL", "col": "$headPos" },
        { "op": "DRUM_KICK" }
      ],
      "elseIfs": [
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "orange" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "orange" },
            { "op": "LIGHT_COL", "col": "$headPos" },
            { "op": "DRUM_SNARE" }
          ]
        },
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "purple" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "purple" },
            { "op": "LIGHT_COL", "col": "$headPos" },
            { "op": "DRUM_CLAP" }
          ]
        },
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "cyan" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "cyan" },
            { "op": "LIGHT_COL", "col": "$headPos" },
            { "op": "PLAY_CHIME" },
            { "op": "WAIT_BEAT", "beats": 1 }
          ]
        }
      ],
      "else": [{ "op": "WAIT_BEAT", "beats": 1 }]
    }
  ]
}
```

### Variation 2 — 16-Step Breakbeat (`1..16` with LED Playhead Progress Bar)

**Tape (`1..16`):** `["red", "black", "red", "orange", "black", "purple", "orange", "black", "red", "black", "orange", "red", "orange", "purple", "orange", "purple"]`

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [2]
  TAPE_SEEK [1]
  Loop [16]
    Call F1
    TAPE_STEP [RIGHT]
  End Loop
End Loop

// F1 (21 flat blocks)
CLEAR_LEDS
c = $headPos - 1
c = c % 8
c = c + 1
SET_LED_COLOR [white]
LIGHT_PIXEL [c, 5]
If ($cellColor == red)
  SET_LED_COLOR [red]
  LIGHT_PIXEL [c, 4]
  DRUM_KICK
Else If ($cellColor == orange)
  SET_LED_COLOR [orange]
  LIGHT_PIXEL [c, 4]
  DRUM_SNARE
Else If ($cellColor == purple)
  SET_LED_COLOR [purple]
  LIGHT_PIXEL [c, 4]
  DRUM_CLAP
Else
  WAIT_BEAT [1]
End If
```

```json
{
  "slotCap": 32,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP",
      "count": 2,
      "body": [
        { "op": "TAPE_SEEK", "index": 1 },
        {
          "op": "LOOP",
          "count": 16,
          "body": [
            { "op": "CALL_FN", "fn": "F1" },
            { "op": "TAPE_STEP", "direction": "RIGHT" }
          ]
        }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    { "op": "VAR_OP", "target": "c", "left": "$headPos", "operator": "-", "right": 1 },
    { "op": "VAR_OP", "target": "c", "left": "c", "operator": "%", "right": 8 },
    { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 },
    { "op": "SET_LED_COLOR", "color": "white" },
    { "op": "LIGHT_PIXEL", "x": "c", "y": 5 },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
      "then": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_PIXEL", "x": "c", "y": 4 },
        { "op": "DRUM_KICK" }
      ],
      "elseIfs": [
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "orange" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "orange" },
            { "op": "LIGHT_PIXEL", "x": "c", "y": 4 },
            { "op": "DRUM_SNARE" }
          ]
        },
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "purple" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "purple" },
            { "op": "LIGHT_PIXEL", "x": "c", "y": 4 },
            { "op": "DRUM_CLAP" }
          ]
        }
      ],
      "else": [{ "op": "WAIT_BEAT", "beats": 1 }]
    }
  ]
}
```

### Variation 3 — Festival Fill & Downbeat Strobe (`1..16` Groove + `17..24` Fill, `r = $headPos % 4`)

**Tape (`1..24`):** Cells `1..16` groove (`["red", "black", "orange", "black", ...]`) + cells `17..24` snare/clap fill (`["orange", "purple", "orange", "purple", "orange", "orange", "purple", "purple"]`).

```text
// MAIN (13 flat blocks)
SET_BEAT_DELAY [0]
Loop [2]
  TAPE_SEEK [1]
  Loop [16]
    Call F1
    TAPE_STEP [RIGHT]
  End Loop
End Loop
TAPE_SEEK [17]
Loop [8]
  Call F1
  TAPE_STEP [RIGHT]
End Loop

// F1 (25 flat blocks)
CLEAR_LEDS
c = $headPos - 1
c = c % 8
c = c + 1
r = $headPos % 4
If (r == 1)
  SET_LED_COLOR [yellow]
  LIGHT_PIXEL [1, 1]
  LIGHT_PIXEL [8, 1]
End If
If ($cellColor == red)
  SET_LED_COLOR [red]
  LIGHT_COL [c]
  DRUM_KICK
Else If ($cellColor == orange)
  SET_LED_COLOR [orange]
  LIGHT_COL [c]
  DRUM_SNARE
Else If ($cellColor == purple)
  SET_LED_COLOR [purple]
  LIGHT_COL [c]
  DRUM_CLAP
Else
  WAIT_BEAT [1]
End If
```

```json
{
  "slotCap": 40,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP",
      "count": 2,
      "body": [
        { "op": "TAPE_SEEK", "index": 1 },
        {
          "op": "LOOP",
          "count": 16,
          "body": [
            { "op": "CALL_FN", "fn": "F1" },
            { "op": "TAPE_STEP", "direction": "RIGHT" }
          ]
        }
      ]
    },
    { "op": "TAPE_SEEK", "index": 17 },
    {
      "op": "LOOP",
      "count": 8,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ],
  "F1": [
    { "op": "CLEAR_LEDS" },
    { "op": "VAR_OP", "target": "c", "left": "$headPos", "operator": "-", "right": 1 },
    { "op": "VAR_OP", "target": "c", "left": "c", "operator": "%", "right": 8 },
    { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 },
    { "op": "VAR_OP", "target": "r", "left": "$headPos", "operator": "%", "right": 4 },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
      "then": [
        { "op": "SET_LED_COLOR", "color": "yellow" },
        { "op": "LIGHT_PIXEL", "x": 1, "y": 1 },
        { "op": "LIGHT_PIXEL", "x": 8, "y": 1 }
      ]
    },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
      "then": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_COL", "col": "c" },
        { "op": "DRUM_KICK" }
      ],
      "elseIfs": [
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "orange" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "orange" },
            { "op": "LIGHT_COL", "col": "c" },
            { "op": "DRUM_SNARE" }
          ]
        },
        {
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "purple" },
          "body": [
            { "op": "SET_LED_COLOR", "color": "purple" },
            { "op": "LIGHT_COL", "col": "c" },
            { "op": "DRUM_CLAP" }
          ]
        }
      ],
      "else": [{ "op": "WAIT_BEAT", "beats": 1 }]
    }
  ]
}
```

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Preventing `1.5`-Beat Drum Drift:** Because `DRUM_KICK`, `DRUM_SNARE`, and `DRUM_CLAP` already take `1.0` beat, calling `WAIT_BEAT [1]` unconditionally inside `F1` would stretch hits to `2.0` beats while rests stay `1.0`! Putting `SET_BEAT_DELAY [0]` at the top and placing `WAIT_BEAT [1]` strictly inside `Else` (and after `PLAY_CHIME`, which is `0`-beat instant) keeps every single step rock-steady.
- **First Color Comparison:** `tape.3` extends `cmp`'s `==` operator to the `color` type (`$cellColor == red`). Notice `3`-address `VAR_OP` (`r = $headPos % 4`) precedes `If (r == 1)` because inline math inside condition slots is disallowed.

</details>
