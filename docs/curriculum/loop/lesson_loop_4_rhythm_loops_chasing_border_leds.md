# `loop.4` — Rhythm Loops & Chasing Border LEDs

> **Format**: Creative Sandbox (`🎨 🎵`) · **Module**: [`loop`](./overview.md) · **Environment**: [Beat & Light](../../envs/beat_light.md) · **Prerequisite**: [`loop.3a`](./lesson_loop_3a_meet_the_led_cursor.md) · **Legacy ID**: `3.4` *(Fixed OOB coordinates; removed legacy animation variant)*

## One-Concept Goal

Build musical drum & note grooves synchronized with chasing cursor trails on the 8×8 LED matrix using `Loop Start [N]` / `Loop End` and `SET_BEAT_DELAY [⚡0]` (`0` multiplier = `0 ms` instant pixel stepping).

<details>
<summary>📖 Parent / Teacher Tip</summary>

Press **Run** to see the LED cursor chase all 4 sides of the 8×8 grid in **Cyan** while playing a steady Kick–Snare–Kick–Clap drum beat! Each side takes **`Cursor Step [×7]`** plus one **`Cursor Turn [Right]`**, so repeating `4` times brings the cursor safely back to `(1, 1)`. Try **Variation 1 (Clap-Snap Staircase)**, **Variation 2 (Candy-Cane Border)**, or **Variation 3 (Neon Frame + Finale)**!

</details>

## UI & Playground Contract

- **Zero Reading**: Variations display compact animated preview cards (`VariationCardsPanel` cursor keeps a compact white ring border only) and icons; `🎵 #N` beat counter and gated `tool-beat-active-color` swatch live in `BeatCanvas`'s `shrink-0` **Canvas Header Row** above the LED matrix.
- **Cursor Reticle**: Cursor spawns logically at `(1, 1)` facing **East** (`visible: false`) and reveals directional `beat-cursor-reticle` on first `CURSOR_STEP`/`CURSOR_TURN` (`step-then-light`).
- **Color Palette (`0..9`)**: Supports canonical swatches (`Cyan, Green, Yellow, Amber, Orange, Red, Purple, Pink`, **`Black (8)`** = recessed LED Off / `⊘` Erase cue everywhere in Beat, `White (9)` = bright white).
- **Note Bounds & Tempo Multiplier**: Scale degrees `1..8`, durations `0.5 | 1 | 2` beats; `SET_BEAT_DELAY` multiplier options `0, 0.25, 0.5, 1, 2, 4` (`1× = 400 ms`, `BeatDelayVisual` badge).

## Palette & Capabilities

```json
{
  "allowedSimBlocks": [
    "SET_LED_COLOR",
    "SET_BEAT_DELAY",
    "CURSOR_STEP",
    "CURSOR_TURN",
    "STAMP_PRESET",
    "DRUM_KICK",
    "DRUM_SNARE",
    "DRUM_CLAP",
    "PLAY_NOTE",
    "PLAY_CHIME",
    "WAIT_BEAT",
    "CLEAR_LEDS"
  ],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": true,
  "allowActionParams": true,
  "allowedBlockParams": ["color", "multiplier", "direction", "preset", "note", "duration", "beats"],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 28 },
  "antiBypassRules": [
    {
      "id": "single-depth-loop-only",
      "description": "Single-depth loop only (before loop.5a nested loops)",
      "maxLoopNestingDepth": 0
    }
  ]
}
```

## Matrix Initial State (`8 × 8`, 1-Indexed `(1..8, 1..8)`)

```json
{
  "matrixWidth": 8,
  "matrixHeight": 8,
  "stepDelayMultiplier": 1,
  "cursor": { "x": 1, "y": 1, "dir": "EAST", "visible": false },
  "activeColor": "cyan"
}
```

## Starter Card — Chasing Cyan Border Beat (`10` flat blocks, `<= 14`)

```json
{
  "id": "starter-chasing-border",
  "icon": "🥁",
  "flatBlocks": 10,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CURSOR_STEP", "repeat": 7 },
        { "op": "CURSOR_TURN", "direction": "RIGHT" },
        { "op": "DRUM_KICK" },
        { "op": "DRUM_SNARE" },
        { "op": "DRUM_KICK" },
        { "op": "DRUM_CLAP" }
      ]
    }
  ]
}
```

**Trace (Starter)**: Traces `(2,1)..(8,1)` E → `(8,2)..(8,8)` S → `(7,8)..(1,8)` W → `(1,7)..(1,1)` N; 4-beat groove on every corner; ends `(1,1)` East.

## Variation Cards

### Variation 1 — Clap-Snap Staircase Groove (`11` flat blocks, `<= 14`)

*(Staircase step count `×3` stops cleanly at `(7, 7)`, fixing the legacy 4-rep `(9,7)` / `(8,9)` OOB bug.)*

```json
{
  "id": "var1-staircase-groove",
  "icon": "🪜",
  "flatBlocks": 11,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "pink" },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "DRUM_KICK" },
        { "op": "CURSOR_STEP", "repeat": 2 },
        { "op": "CURSOR_TURN", "direction": "RIGHT" },
        { "op": "DRUM_CLAP", "repeat": 2 },
        { "op": "CURSOR_STEP", "repeat": 2 },
        { "op": "CURSOR_TURN", "direction": "LEFT" },
        { "op": "PLAY_NOTE", "note": 5, "duration": 1 }
      ]
    }
  ]
}
```

**Trace**: `(1,1)E` → Iter 1 `(3,1)→(3,3)E`; Iter 2 `(5,3)→(5,5)E`; Iter 3 `(7,5)→(7,7)E` (100% inside `1..8`).

### Variation 2 — Candy-Cane Perimeter Chase (`13` flat blocks, `<= 20`)

*(Alternates Red horizontal & Green vertical border sweeps across `2` rounds.)*

```json
{
  "id": "var2-candy-cane-border",
  "icon": "🍬",
  "flatBlocks": 13,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "PLAY_NOTE", "note": 5, "duration": 0.5 },
        { "op": "CURSOR_STEP", "repeat": 7 },
        { "op": "CURSOR_TURN", "direction": "RIGHT" },
        { "op": "DRUM_SNARE" },
        { "op": "SET_LED_COLOR", "color": "green" },
        { "op": "PLAY_NOTE", "note": 8, "duration": 0.5 },
        { "op": "CURSOR_STEP", "repeat": 7 },
        { "op": "CURSOR_TURN", "direction": "RIGHT" },
        { "op": "DRUM_CLAP" }
      ]
    }
  ]
}
```

### Variation 3 — Neon Frame + Star Finale (`21` flat blocks, `<= 30`, zero nesting)

```json
{
  "id": "var3-neon-frame-finale",
  "icon": "🌟",
  "flatBlocks": 21,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CURSOR_STEP", "repeat": 7 },
        { "op": "CURSOR_TURN", "direction": "RIGHT" },
        { "op": "DRUM_KICK" },
        { "op": "PLAY_NOTE", "note": 1, "duration": 0.5 },
        { "op": "DRUM_SNARE" },
        { "op": "PLAY_NOTE", "note": 5, "duration": 0.5 }
      ]
    },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "STAMP_PRESET", "preset": "HEART" },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "DRUM_CLAP" },
        { "op": "PLAY_NOTE", "note": 3, "duration": 0.5 },
        { "op": "PLAY_NOTE", "note": 5, "duration": 0.5 },
        { "op": "PLAY_NOTE", "note": 8, "duration": 0.5 }
      ]
    },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "STAMP_PRESET", "preset": "STAR" },
    { "op": "PLAY_CHIME" }
  ]
}
```
