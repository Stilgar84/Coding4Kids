# `loop.3a` — Meet the LED Cursor

> **Format**: Comprehension Demo (`📖 🎵`) · **Module**: [`loop`](./overview.md) · **Environment**: [Beat & Light](../../envs/beat_light.md) · **Promoted Prerequisite**: Required before `loop.4`

## One-Concept Goal

Introduce the **8×8 Beat & Light directional LED cursor** (`CURSOR_STEP` and `CURSOR_TURN`), its gated reticle visibility, **step-then-light** movement semantics, and **`SET_BEAT_DELAY`** tempo control before combining cursor steps with loops in `loop.4`.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Earlier Beat lessons stamped pictures and lit fixed rows without showing a moving cursor. In **Demo Tab 1**, as soon as the first `Cursor Step` block runs, a bright **cursor reticle** appears at `(1, 1)` facing **East** and lights each pixel *it steps onto* (`(2,1) → (5,1)`, then turns Right South and steps `(5,2) → (5,4)`). In **Demo Tab 2**, **`Set Beat Delay [⚡0]`** (`0×` multiplier = `0 ms` instant batching for non-sound cursor moves) switches cursor sweeps to crisp instant chasing while `Loop Start [×4]` traces all 4 walls of the 8×8 frame back to `(1, 1)`!

</details>

## UI & Playground Contract

- **Zero Reading**: No text banners; active tempo displays numerically via `BeatDelayVisual` (`⚡0` / `1×` = `400 ms` global tick) and beat counter displays `🎵 #` inside `BeatCanvas`'s `shrink-0` **Canvas Header Row** above the LED grid (never overlapping `(1,1)`).
- **Gated Cursor Reticle**: Cursor spawns logically at `(x=1, y=1, dir=EAST, visible=false)`. Because `MAIN` includes `CURSOR_STEP` / `CURSOR_TURN` blocks, the directional `beat-cursor-reticle` reveals immediately on the first cursor block (with **step-then-light** painting each destination cell with `activeColor`; `tool-beat-active-color` shows in the header whenever `SET_LED_COLOR` is enabled).
- **Coach Spotlights**:
  - Tab 1: `beat-cursor-reticle` + `execution-order` (step-then-light trail).
  - Tab 2: `beat-cursor-reticle` + `loop-counter` (`1/4`..`4/4` border loop).

## Palette & Capabilities

```json
{
  "allowedSimBlocks": [
    "SET_LED_COLOR",
    "CURSOR_STEP",
    "CURSOR_TURN",
    "SET_BEAT_DELAY",
    "DRUM_KICK",
    "WAIT_BEAT"
  ],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": true,
  "allowActionParams": true,
  "allowedBlockParams": ["color", "direction", "multiplier", "beats"],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 14 }
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

## Demo Tabs (`demoTabs`)

### Tab 1 — Step-Then-Light L-Path (`6` flat blocks)

```json
{
  "id": "tab-cursor-steps",
  "icon": "🔦",
  "spotlights": ["beat-cursor-reticle", "execution-order"],
  "MAIN": [
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "CURSOR_STEP", "repeat": 4 },
    { "op": "CURSOR_TURN", "direction": "RIGHT" },
    { "op": "CURSOR_STEP", "repeat": 3 },
    { "op": "DRUM_KICK" },
    { "op": "WAIT_BEAT", "beats": 1 }
  ]
}
```

**Trace (Tab 1)**:
- `CURSOR_STEP [×4]` (facing East from `(1,1)`): lights **`(2,1), (3,1), (4,1), (5,1)`** (`(1,1)` remains unlit!).
- `CURSOR_TURN [RIGHT]`: rotates in place at `(5,1)` to **South**.
- `CURSOR_STEP [×3]`: lights **`(5,2), (5,3), (5,4)`**; kicks drum and pauses 1 beat.

### Tab 2 — Crisp Border Chase with `SET_BEAT_DELAY [⚡0]` & `Loop ×4` (`7` flat closer-inclusive blocks)

```json
{
  "id": "tab-cursor-loop",
  "icon": "🔁",
  "spotlights": ["beat-cursor-reticle", "loop-counter"],
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "multiplier": 0 },
    { "op": "SET_LED_COLOR", "color": "amber" },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CURSOR_STEP", "repeat": 7 },
        { "op": "CURSOR_TURN", "direction": "RIGHT" },
        { "op": "DRUM_KICK" }
      ]
    }
  ]
}
```

**Trace (Tab 2)**:
- Iter 1 (E): `(2,1)..(8,1)` Amber, turns South, Kick!
- Iter 2 (S): `(8,2)..(8,8)` Amber, turns West, Kick!
- Iter 3 (W): `(7,8)..(1,8)` Amber, turns North, Kick!
- Iter 4 (N): `(1,7)..(1,1)` Amber (completes corner `(1,1)`!), turns East, Kick!
- All `28` perimeter LEDs illuminated in Amber; cursor ends cleanly at `(1,1)` East!
