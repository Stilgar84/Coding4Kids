# Lesson `inter.3`: D-Pad Etch-a-Sketch & Drum Stepper (`🎵` Beat & Light Matrix `8×8`)

- **Type:** `🎨` Creative Sandbox
- **Previous:** [`inter.2` Virtual D-Pad & Action Buttons](./lesson_inter_2_virtual_dpad_and_action_buttons.md) | **Next:** [`inter.4` Hold & Drag Sparkle Pad](./lesson_inter_4_hold_and_drag_sparkle_pad.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix (`8×8` Grid) + Bottom-Dock D-Pad |
| Key Concepts | Persistent pixel trail, **`SET_LED_COLOR [Black]` (`0x08`)** selective erase, `m % 2` Ink/Erase toggle on `[🅰️]`, `[🅱️]` Wipe, programmable beat marker |
| Visible Event Tabs | Full Sandbox Event Tabs (`ON_TAP`, `ON_KEY_UP/DOWN/LEFT/RIGHT`, `ON_KEY_A`, `ON_KEY_B`) |
| Flat Block Budget | Starter: `20` \| Var 1: `29` \| Var 2: `27` \| Var 3: `42` (`slotCap: 44`) |

---

## 1. Starter — Classic D-Pad Etch-a-Sketch (`20` flat blocks)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Steer with **`⬆️` `⬇️` `⬅️` `➡️`** to leave a bright pixel trail like an Etch-a-Sketch! Press **`[🅱️]`** whenever you want a fresh black screen.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Notice the big contrast with `inter.2`: here `MAIN` omits `CLEAR_LEDS`, so every step draws onto the persistent LED buffer. Clearing moves strictly into `ON_KEY_B` (`0x46`). Each directional tab clamps `x` and `y` inside `1..8`.

</details>

```text
// MAIN (0x00)
SET_BEAT_DELAY [0]
x = 4
y = 4
WHILE a == 0
  LIGHT_PIXEL [x, y]
  WAIT_BEAT [0.125]
END_WHILE

// ON_KEY_UP (0x41): IF y < 8 THEN y = y + 1 END_IF
// ON_KEY_DOWN (0x42): IF y > 1 THEN y = y - 1 END_IF
// ON_KEY_LEFT (0x43): IF x > 1 THEN x = x - 1 END_IF
// ON_KEY_RIGHT (0x44): IF x < 8 THEN x = x + 1 END_IF
// ON_KEY_B (0x46): CLEAR_LEDS
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 22,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
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
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```

---

## 2. Variation Cards (`🎨` Pick & Remix!)

### Variation 1 — Ink / Erase Switch via `[🅰️]` (`29` flat blocks)
**Kid Idea:** Press **`[🅰️]`** to toggle between Cyan Ink (`r = m % 2 == 1`) and Black Eraser (`SET_LED_COLOR [black]` `0x08`) so you can fix mistakes!

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 32,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "m", "value": 1 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "VAR_OP", "target": "r", "left": "m", "operator": "%", "right": 2 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
          "then": [{ "op": "SET_LED_COLOR", "color": "cyan" }],
          "else": [{ "op": "SET_LED_COLOR", "color": "black" }]
        },
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
  ],
  "ON_KEY_A": [
    { "op": "VAR_OP", "target": "m", "left": "m", "operator": "+", "right": 1 },
    { "op": "PLAY_CHIME" }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```

### Variation 2 — Fat 2-Wide Brush + Tap Teleporter (`27` flat blocks)
**Kid Idea:** Tap anywhere on the grid (`ON_TAP`) to jump your cursor straight there! Compute `r = x + 1` safely — Beat silently clips out-of-bounds pixels on column `8`.

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 30,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "VAR_OP", "target": "r", "left": "x", "operator": "+", "right": 1 },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "LIGHT_PIXEL", "x": "r", "y": "y" },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_TAP": [
    { "op": "VAR_ASSIGN", "var": "x", "value": "$pointerX" },
    { "op": "VAR_ASSIGN", "var": "y", "value": "$pointerY" },
    { "op": "PLAY_CHIME" }
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
  ],
  "ON_KEY_A": [
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "PLAY_NOTE", "pitch": "x", "duration": 0.25 }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```

### Variation 3 — Live Beat Sequencer & Dual-Cursor Groove (`42` flat blocks)
**Kid Idea:** Move the Cyan melody note `(x, y)` with the D-Pad, tap a column (`ON_TAP`) to drop an Orange Kick marker (`u`), and press `[🅰️]` for a live `DRUM_CLAP` fill while playhead `k` sweeps `1..8`!

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 44,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 3 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 6 },
    { "op": "VAR_ASSIGN", "var": "u", "value": 1 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "VAR_OP", "target": "k", "left": "k", "operator": "+", "right": 1 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">", "left": "k", "right": 8 },
          "then": [{ "op": "VAR_ASSIGN", "var": "k", "value": 1 }]
        },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "orange" },
        { "op": "LIGHT_COL", "col": "k" },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_PIXEL", "x": "u", "y": 1 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "k", "right": "x" },
          "then": [{ "op": "PLAY_NOTE", "pitch": "y", "duration": 0.25 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "k", "right": "u" },
          "then": [{ "op": "DRUM_KICK" }]
        },
        { "op": "WAIT_BEAT", "beats": 0.25 }
      ]
    }
  ],
  "ON_TAP": [
    { "op": "VAR_ASSIGN", "var": "u", "value": "$pointerX" },
    { "op": "DRUM_SNARE" }
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
  ],
  "ON_KEY_A": [
    { "op": "DRUM_CLAP" }
  ],
  "ON_KEY_B": [
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "u", "value": 1 }
  ]
}
```
