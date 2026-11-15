# Lesson `inter.4`: Hold & Drag Sparkle Pad (`🎵` `16×16` HD & `32×32` Sprite Matrix)

- **Type:** `🎨` Creative Sandbox
- **Previous:** [`inter.3` D-Pad Etch-a-Sketch](./lesson_inter_3_dpad_etch_a_sketch.md) | **Next:** [`inter.5` Live Interactive Turtle](./lesson_inter_5_live_interactive_turtle.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix — **`16×16` HD** (Starter, Var 1) & **`32×32` Sprite Pad** (Var 2, Var 3) |
| New Sensor Unlocked | **`0x95 $pointerDown`** (`👆⬇️`) inside `WHILE`, `WAIT_BEAT [0.125]` cooperative yield |
| Extended Math Used | `3`-address `m = $pointerX - 1; r = m % 16; p = r + 1` pitch wrapping, `$randD4` spray jitter, `SET_LED_COLOR [Black]` (`0x08`) trail wipe |
| Flat Block Budget | Starter: `10` \| Var 1: `15` \| Var 2: `20` \| Var 3: `27` (`slotCap: 32`) |

---

## 1. Starter — Hold-and-Drag Neon Brush (`16×16` HD, `10` flat blocks)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Hold and drag your finger anywhere across the **`16×16`** neon pad to paint musical rainbows! Keep **`WAIT_BEAT [0.125]`** inside your loop so every brushstroke glides smoothly.

<details>
<summary>📖 Parent / Teacher Tip</summary>

1. **`$pointerDown` (`0x95`) vs. `ON_TAP` (`0x40`):** `ON_TAP` fires once per discrete tap, whereas polling `IF $pointerDown` inside `WHILE` (with `WAIT_BEAT [0.125]`) traces every pixel along a continuous finger drag!
2. **`16×16` Extended Pitches:** On `16×16` and `32×32` matrices, `PLAY_NOTE` natively maps columns `1..16` across a 2-octave C Major scale. On `32×32`, Var 2 shows how to fold columns `17..32` back into `1..16` with modulo (`%`).

</details>

```text
// MAIN (0x00)
SET_BEAT_DELAY [0]
WHILE a == 0
  IF $pointerDown
    SET_LED_COLOR [$randomColor]
    LIGHT_PIXEL [$pointerX, $pointerY]
    PLAY_NOTE [$pointerX, 0.125]
  END_IF
  WAIT_BEAT [0.125]
END_WHILE

// ON_KEY_B (0x46)
CLEAR_LEDS
```

```json
{
  "env": "beat",
  "sizePreset": 1,
  "grid": "16x16",
  "slotCap": 14,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        {
          "op": "IF",
          "cond": { "op": "SENSOR", "sensor": "$pointerDown" },
          "then": [
            { "op": "SET_LED_COLOR", "color": "$randomColor" },
            { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
            { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.125 }
          ]
        },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```

---

## 2. Variation Cards (`🎨` Pick & Remix!)

### Variation 1 — 4-Corner Symmetry Mirror (`16×16` HD, `15` flat blocks)
**Kid Idea:** Draw in one corner and watch three mirrored twin lasers paint across the `16×16` pad at the same time (`u = 17 - 👆X`, `v = 17 - 👆Y`)!

```json
{
  "env": "beat",
  "sizePreset": 1,
  "grid": "16x16",
  "slotCap": 18,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        {
          "op": "IF",
          "cond": { "op": "SENSOR", "sensor": "$pointerDown" },
          "then": [
            { "op": "VAR_OP", "target": "u", "left": 17, "operator": "-", "right": "$pointerX" },
            { "op": "VAR_OP", "target": "v", "left": 17, "operator": "-", "right": "$pointerY" },
            { "op": "SET_LED_COLOR", "color": "$randomColor" },
            { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
            { "op": "LIGHT_PIXEL", "x": "u", "y": "$pointerY" },
            { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "v" },
            { "op": "LIGHT_PIXEL", "x": "u", "y": "v" },
            { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.125 }
          ]
        },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```

### Variation 2 — `32×32` Airbrush Spray & Modulo Octave (`32×32` Sprite, `20` flat blocks)
**Kid Idea:** Switch up to the ultra-crisp **`32×32`** Sprite Matrix! Use `🎲 D4` (`$randD4`) to scatter sparkling pixel mist around your finger, and wrap `1..32` into `1..16` pitches (`m = 👆X - 1; r = m % 16; p = r + 1`).

```json
{
  "env": "beat",
  "sizePreset": 2,
  "grid": "32x32",
  "slotCap": 24,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        {
          "op": "IF",
          "cond": { "op": "SENSOR", "sensor": "$pointerDown" },
          "then": [
            { "op": "SET_LED_COLOR", "color": "$randomColor" },
            { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
            { "op": "VAR_OP", "target": "x", "left": "$pointerX", "operator": "+", "right": "$randD4" },
            { "op": "VAR_OP", "target": "x", "left": "x", "operator": "-", "right": 2 },
            { "op": "VAR_OP", "target": "y", "left": "$pointerY", "operator": "+", "right": "$randD4" },
            { "op": "VAR_OP", "target": "y", "left": "y", "operator": "-", "right": 2 },
            { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
            { "op": "VAR_OP", "target": "m", "left": "$pointerX", "operator": "-", "right": 1 },
            { "op": "VAR_OP", "target": "r", "left": "m", "operator": "%", "right": 16 },
            { "op": "VAR_OP", "target": "p", "left": "r", "operator": "+", "right": 1 },
            { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.125 }
          ]
        },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_A": [
    { "op": "STAMP_PRESET", "preset": 1 },
    { "op": "PLAY_CHIME" }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```

### Variation 3 — Interactive Gravity Raindrop Painter (`32×32` Sprite, `27` flat blocks)
**Kid Idea:** Tap or drag anywhere to drop a falling neon raindrop `(x, y)` that erases its own trail (`SET_LED_COLOR [black]` `0x08`) until it splashes onto row `1` with a musical note!

```json
{
  "env": "beat",
  "sizePreset": 2,
  "grid": "32x32",
  "slotCap": 32,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        {
          "op": "IF",
          "cond": { "op": "SENSOR", "sensor": "$pointerDown" },
          "then": [
            { "op": "VAR_ASSIGN", "var": "x", "value": "$pointerX" },
            { "op": "VAR_ASSIGN", "var": "y", "value": "$pointerY" },
            { "op": "VAR_ASSIGN", "var": "z", "value": 1 }
          ]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "z", "right": 1 },
          "then": [
            { "op": "SET_LED_COLOR", "color": "black" },
            { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
            { "op": "VAR_OP", "target": "y", "left": "y", "operator": "-", "right": 1 },
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": ">=", "left": "y", "right": 1 },
              "then": [
                { "op": "SET_LED_COLOR", "color": "cyan" },
                { "op": "LIGHT_PIXEL", "x": "x", "y": "y" }
              ],
              "else": [
                { "op": "VAR_ASSIGN", "var": "z", "value": 0 },
                { "op": "VAR_OP", "target": "m", "left": "x", "operator": "-", "right": 1 },
                { "op": "VAR_OP", "target": "r", "left": "m", "operator": "%", "right": 16 },
                { "op": "VAR_OP", "target": "p", "left": "r", "operator": "+", "right": 1 },
                { "op": "DRUM_CLAP" },
                { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.25 }
              ]
            }
          ]
        },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" },
    { "op": "VAR_ASSIGN", "var": "z", "value": 0 }
  ]
}
```
