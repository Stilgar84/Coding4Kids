# `loop.C` — Capstone: Looping Lightshow

> **Format**: Creative Capstone (`🎨 🎵`) · **Module**: [`loop`](./overview.md) · **Environment**: [Beat & Light](../../envs/beat_light.md) · **Legacy ID**: `3C` *(Fixed variable leak, clamped `1..8` coords, enforced `0.5|1|2` note durations & canonical colors)*

## One-Concept Goal

Direct a **synchronized multi-pattern audiovisual lightshow** combining **nested loops (`outer × inner`), cursor frame chases, row/column flashes, preset icons, drums, and scale notes**—with zero variables and exact `1..8` boundary safety.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Time for the grand finale! Press **Run** on the **Starter Star Border Concert** to see a Cyan star light up while nested **`Loop ×4` → `Loop ×2`** traces the outer border with kicks, snares, and sparkling notes! Then launch the 3 concert **Variation Cards**: **Neon Crosshair Fireworks** (`Variation 1`), **Laser Perimeter + Robot Drop** (`Variation 2`), and the **8-Bit Boss Battle Loop** (`Variation 3`)!

</details>

## UI & Playground Contract

- **Zero Reading**: Icon-first stage presets and compact variation preview rings; `🎵 #N` counter and gated `tool-beat-active-color` swatch live in `BeatCanvas`'s `shrink-0` **Canvas Header Row** above the LED grid.
- **Cursor Reticle**: Cursor spawns logically at `(1, 1)` facing **East** (`visible: false`), reveals directional `beat-cursor-reticle` cleanly on cursor ops.
- **Strict Platform Bounds**:
  - `1..8` 1-indexed matrix coordinates (`LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL`, cursor stays in `1..8`).
  - `PLAY_NOTE` pitches `1..8`, durations `0.5 | 1 | 2` only (no `0.25` duration leak); `SET_BEAT_DELAY` uses multiplier (`0` = `0 ms`, default `1×` = `400 ms`).
  - Canonical palette colors (`Cyan, Green, Yellow, Amber, Orange, Red, Purple, Pink`, **`Black=8`** as recessed LED Off / `⊘` Erase cue everywhere in Beat, `White=9`).
  - `allowVariables: false`, `allowRecursion: false`, `[MAIN]` only.

## Palette & Capabilities

```json
{
  "allowedSimBlocks": [
    "SET_LED_COLOR",
    "SET_BEAT_DELAY",
    "CURSOR_STEP",
    "CURSOR_TURN",
    "LIGHT_PIXEL",
    "LIGHT_ROW",
    "LIGHT_COL",
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
  "allowedBlockParams": ["color", "multiplier", "direction", "x", "y", "row", "col", "preset", "note", "duration", "beats"],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 30 }
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

## Starter Card — Star Border Concert (`14` flat blocks, `<= 14`)

```json
{
  "id": "starter-star-border-concert",
  "icon": "🌟",
  "flatBlocks": 14,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "STAMP_PRESET", "preset": "STAR" },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "DRUM_KICK" },
        {
          "op": "LOOP_START",
          "count": 2,
          "body": [
            { "op": "CURSOR_STEP", "repeat": 3 },
            { "op": "PLAY_NOTE", "note": 5, "duration": 0.5 }
          ]
        },
        { "op": "CURSOR_STEP", "repeat": 1 },
        { "op": "DRUM_SNARE" },
        { "op": "CURSOR_TURN", "direction": "RIGHT" }
      ]
    },
    { "op": "PLAY_CHIME" }
  ]
}
```

*(Trace check: inside each of 4 sides, `3 + 3 + 1 = 7` cursor steps trace `(2,1)..(8,1)`, `(8,2)..(8,8)`, `(7,8)..(1,8)`, `(1,7)..(1,1)` and end at `(1,1)` East!)*

## Variation Cards

### Variation 1 — Neon Crosshair Fireworks (`13` flat blocks, `<= 14`)

```json
{
  "id": "var1-neon-crosshair-fireworks",
  "icon": "🎆",
  "flatBlocks": 13,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "SET_LED_COLOR", "color": "pink" },
        { "op": "LIGHT_ROW", "row": 4 },
        { "op": "LIGHT_COL", "col": 4 },
        {
          "op": "LOOP_START",
          "count": 2,
          "body": [
            { "op": "DRUM_KICK" },
            { "op": "PLAY_NOTE", "note": 5, "duration": 0.5 }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "STAMP_PRESET", "preset": "STAR" },
        { "op": "PLAY_CHIME" }
      ]
    }
  ]
}
```

### Variation 2 — Laser Perimeter + Robot Drop (`19` flat blocks, `<= 20`)

```json
{
  "id": "var2-laser-perimeter-robot",
  "icon": "🤖",
  "flatBlocks": 19,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "SET_LED_COLOR", "color": "pink" },
        {
          "op": "LOOP_START",
          "count": 2,
          "body": [
            { "op": "CURSOR_STEP", "repeat": 7 },
            { "op": "CURSOR_TURN", "direction": "RIGHT" },
            { "op": "PLAY_NOTE", "note": 6, "duration": 0.5 }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        {
          "op": "LOOP_START",
          "count": 2,
          "body": [
            { "op": "CURSOR_STEP", "repeat": 7 },
            { "op": "CURSOR_TURN", "direction": "RIGHT" },
            { "op": "DRUM_CLAP" }
          ]
        }
      ]
    },
    { "op": "SET_LED_COLOR", "color": "amber" },
    { "op": "STAMP_PRESET", "preset": "ROBOT" },
    { "op": "PLAY_NOTE", "note": 8, "duration": 0.5 },
    { "op": "PLAY_CHIME" }
  ]
}
```

### Variation 3 — 8-Bit Boss Battle Loop (`25` flat blocks, `<= 30`)

```json
{
  "id": "var3-boss-battle-loop",
  "icon": "⚡",
  "flatBlocks": 25,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "STAMP_PRESET", "preset": "HEART" },
        {
          "op": "LOOP_START",
          "count": 4,
          "body": [
            { "op": "DRUM_KICK" },
            { "op": "PLAY_NOTE", "note": 1, "duration": 0.5 },
            { "op": "PLAY_NOTE", "note": 3, "duration": 0.5 },
            { "op": "CURSOR_STEP", "repeat": 7 },
            { "op": "CURSOR_TURN", "direction": "RIGHT" }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "amber" },
        { "op": "STAMP_PRESET", "preset": "BOLT" },
        {
          "op": "LOOP_START",
          "count": 2,
          "body": [
            { "op": "LIGHT_PIXEL", "x": 2, "y": 2 },
            { "op": "LIGHT_PIXEL", "x": 7, "y": 2 },
            { "op": "DRUM_SNARE" },
            { "op": "PLAY_NOTE", "note": 5, "duration": 0.5 },
            { "op": "PLAY_NOTE", "note": 8, "duration": 0.5 }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_ROW", "row": 1 },
        { "op": "LIGHT_ROW", "row": 8 },
        { "op": "PLAY_CHIME" }
      ]
    }
  ]
}
```
