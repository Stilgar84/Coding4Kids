# Lesson `inter.2`: Virtual D-Pad & Action Buttons (`🎵` Beat & Light Matrix `8×8`)

- **Type:** `📖` Explanation & Guided Demo
- **Previous:** [`inter.1` Multi-Zone X/Y Synth](./lesson_inter_1_multi_zone_xy_synth.md) | **Next:** [`inter.3` D-Pad Etch-a-Sketch](./lesson_inter_3_dpad_etch_a_sketch.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix (`8×8` Grid) + Bottom-Dock D-Pad |
| New Blocks Unlocked | `0x41 ON_KEY_UP` (`⬆️`), `0x42 ON_KEY_DOWN` (`⬇️`), `0x43 ON_KEY_LEFT` (`⬅️`), `0x44 ON_KEY_RIGHT` (`➡️`), `0x45 ON_KEY_A` (`🅰️`), `0x46 ON_KEY_B` (`🅱️`) |
| UI Surface | Touch Bottom-Dock D-Pad (bottom-left) + `[🅰️][🅱️]` (bottom-right); Keyboard (`Arrows`/`WASD` + `Space`/`Z` + `Enter`/`X`) |
| Flat Block Budget | Demo 1: `17` \| Demo 2: `20` \| Guided Try-It: `15` (`slotCap: 16`) |

---

## 1. Visual Concept Card (`🕹️` On-Press Events vs. `▶️` Loop)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Tap the **`⬅️`**, **`➡️`**, **`⬆️`**, **`⬇️`**, or **`🅰️`** buttons at the bottom of your screen to steer a glowing pixel! Add an **`IF`** fence (`x > 1`, `x < 8`) so your light never slips off the board.

<details>
<summary>📖 Parent / Teacher Tip</summary>

1. **Always initialize matrix cursors (`x = 4`, `y = 4`):** Fresh variables default to `0`, which sits outside the `1..8` Beat grid (causes a silent out-of-bounds no-op).
2. **Event Tabs (`0x41`–`0x46`) vs. `keyHeld` (`0x2E`):** Event tabs fire **once per button tap**, making them ideal for single-cell grid stepping, color swaps, and clears. `keyHeld` (covered in `inter.6`) checks whether a key stays pressed during a continuous frame loop.
3. **3-Tab Rule:** Guided Demo 1 and Try-It show at most `3` Event Tabs (`⬅️`, `➡️`, `🅰️`); Demo 2 unlocks all `4` directional tabs in Sandbox preview.

</details>

---

## 2. Walkthrough Demos (`📖` Two Step-by-Step Examples)

### Demo 1 — 2-Button Rail Slider + `[🅰️]` Spark (`17` flat blocks)

`MAIN` keeps a `1/8`-beat redraw loop (`CLEAR_LEDS` + `LIGHT_PIXEL [x, 4]`), while **`ON_KEY_LEFT`** and **`ON_KEY_RIGHT`** clamp `x` inside `1..8` and **`ON_KEY_A`** cycles random colors.

```text
// MAIN (0x00)
SET_BEAT_DELAY [0]
x = 4
WHILE a == 0
  CLEAR_LEDS
  LIGHT_PIXEL [x, 4]
  WAIT_BEAT [0.125]
END_WHILE

// ON_KEY_LEFT (0x43)
IF x > 1
  x = x - 1
END_IF
DRUM_KICK

// ON_KEY_RIGHT (0x44)
IF x < 8
  x = x + 1
END_IF
DRUM_SNARE

// ON_KEY_A (0x45)
SET_LED_COLOR [$randomColor]
PLAY_CHIME
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 18,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": 4 },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_LEFT": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": ">", "left": "x", "right": 1 },
      "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "-", "right": 1 }]
    },
    { "op": "DRUM_KICK" }
  ],
  "ON_KEY_RIGHT": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<", "left": "x", "right": 8 },
      "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }]
    },
    { "op": "DRUM_SNARE" }
  ],
  "ON_KEY_A": [
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "PLAY_CHIME" }
  ]
}
```

### Demo 2 — 4-Way D-Pad Cursor (`20` flat blocks)

Expanding horizontally and vertically uses all four directional Event Tabs (`0x41`–`0x44`) with identical `1..8` boundary clamps.

```text
// MAIN (0x00)
SET_BEAT_DELAY [0]
x = 4
y = 4
WHILE a == 0
  CLEAR_LEDS
  LIGHT_PIXEL [x, y]
  WAIT_BEAT [0.125]
END_WHILE

// ON_KEY_UP (0x41): IF y < 8 THEN y = y + 1 END_IF
// ON_KEY_DOWN (0x42): IF y > 1 THEN y = y - 1 END_IF
// ON_KEY_LEFT (0x43): IF x > 1 THEN x = x - 1 END_IF
// ON_KEY_RIGHT (0x44): IF x < 8 THEN x = x + 1 END_IF
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 20,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_UP": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<", "left": "y", "right": 8 },
      "then": [{ "op": "VAR_OP", "target": "y", "left": "y", "operator": "+", "right": 1 }]
    }
  ],
  "ON_KEY_DOWN": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": ">", "left": "y", "right": 1 },
      "then": [{ "op": "VAR_OP", "target": "y", "left": "y", "operator": "-", "right": 1 }]
    }
  ],
  "ON_KEY_LEFT": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": ">", "left": "x", "right": 1 },
      "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "-", "right": 1 }]
    }
  ],
  "ON_KEY_RIGHT": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<", "left": "x", "right": 8 },
      "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }]
    }
  ]
}
```

---

## 3. Guided Hands-On Try-It (`🎯` Add `[🅰️]` Rainbow Flipper)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Slide your pixel left and right with **`⬅️`** and **`➡️`** — now open the **`🅰️`** tab and drop in **`🎨 Random`** + **`🔔 Chime`** so **`[🅰️]`** sparks a new color!

### Challenge & Palette Spec (`Edit Delta: 2` — add `SET_LED_COLOR [$randomColor]` + `PLAY_CHIME` in `ON_KEY_A`)

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "allowedTabs": ["MAIN", "ON_KEY_LEFT", "ON_KEY_RIGHT", "ON_KEY_A"],
  "allowedSimBlocks": [
    "SET_BEAT_DELAY",
    "VAR_ASSIGN",
    "VAR_OP",
    "WHILE",
    "IF",
    "CMP",
    "CLEAR_LEDS",
    "SET_LED_COLOR",
    "LIGHT_PIXEL",
    "PLAY_NOTE",
    "PLAY_CHIME",
    "WAIT_BEAT"
  ],
  "slotCap": 16,
  "initial": {
    "MAIN": [
      { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
      { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
      {
        "op": "WHILE",
        "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
        "body": [
          { "op": "CLEAR_LEDS" },
          { "op": "LIGHT_PIXEL", "x": "x", "y": 4 },
          { "op": "WAIT_BEAT", "beats": 0.125 }
        ]
      }
    ],
    "ON_KEY_LEFT": [
      {
        "op": "IF",
        "cond": { "op": "CMP", "operator": ">", "left": "x", "right": 1 },
        "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "-", "right": 1 }]
      }
    ],
    "ON_KEY_RIGHT": [
      {
        "op": "IF",
        "cond": { "op": "CMP", "operator": "<", "left": "x", "right": 8 },
        "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }]
      }
    ],
    "ON_KEY_A": []
  },
  "solution": {
    "MAIN": [
      { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
      { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
      {
        "op": "WHILE",
        "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
        "body": [
          { "op": "CLEAR_LEDS" },
          { "op": "LIGHT_PIXEL", "x": "x", "y": 4 },
          { "op": "WAIT_BEAT", "beats": 0.125 }
        ]
      }
    ],
    "ON_KEY_LEFT": [
      {
        "op": "IF",
        "cond": { "op": "CMP", "operator": ">", "left": "x", "right": 1 },
        "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "-", "right": 1 }]
      }
    ],
    "ON_KEY_RIGHT": [
      {
        "op": "IF",
        "cond": { "op": "CMP", "operator": "<", "left": "x", "right": 8 },
        "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }]
      }
    ],
    "ON_KEY_A": [
      { "op": "SET_LED_COLOR", "color": "$randomColor" },
      { "op": "PLAY_CHIME" }
    ]
  }
}
```

### Verification Checklist
- [ ] **Cursor Starts at `(4, 4)`:** Even before pressing any D-Pad button, LED `(4, 4)` blinks smoothly.
- [ ] **Clamped Ends:** Holding or tapping `⬅️` stops at `x = 1`; tapping `➡️` stops at `x = 8` without silent freeze or out-of-range disappearance.
- [ ] **`[🅰️]` Action:** Pressing `[🅰️]` (or `Space`/`Z`) plays `PLAY_CHIME` and shifts the moving pixel to a fresh random LED color (`MAIN = 7`, `LEFT = 3`, `RIGHT = 3`, `A = 2` -> `15` flat blocks `<= slotCap 16`).
