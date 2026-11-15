# Capstone `inter.A`: Playable Arcade & Mega-Synth (`🎵` `16×16` HD & `32×32` Sprite)

- **Type:** `🏆` Capstone Challenge (Part 1 of 2 for `🔥 Mastery Set inter` / `🕹️ inter` Badge)
- **Previous:** [`inter.8` Whack-a-Star & Mini-Arcade](./lesson_inter_8_whack_a_star_and_pong_rally.md) | **Next:** [`inter.B` Capstone B: Interactive Kaleidoscope & Arcade](./capstone_inter_b_interactive_kaleidoscope_and_arcade.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix — `8×8`, `16×16` HD, and `32×32` Sprite |
| Skills Combined | Pointer Events (`ON_TAP`, `$pointerDown`), Full D-Pad + `[🅰️]`/`[🅱️]`, 3-Address `OP_VAR_OP`, Modulo Modes (`m % 2`, `m % 3`, `m % 16`), Game State |
| Flat Block Budget | Starter: `41` \| Var 1: `21` \| Var 2: `28` \| Var 3: `66` (`slotCap: 70`) |

---

## 1. Starter — `16×16` Light Chaser & Tap Sound Pad (`41` flat blocks)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Steer your cyan ship with **`⬆️` `⬇️` `⬅️` `➡️`** to catch yellow stars for points on row `16`, OR tap anywhere (`👆`) to summon a brand-new star with a rising note chord! Press **`[🅰️]`** to sparkle random ship paint and **`[🅱️]`** to reset.

<details>
<summary>📖 Parent / Teacher Tip</summary>

This capstone starter blends **dual inputs**: D-Pad steering moves player `(x, y)` inside `1..15` (reserving row `16` as the green score meter `1..s`), while `ON_TAP` drops the collectible star `(u, v)` at your finger and chimes `(u, q = u + 2)`. Encourage `Edit Delta <= 10` when students swap notes, change score win limits (`s >= 12`), or customize colors.

</details>

```json
{
  "env": "beat",
  "sizePreset": 1,
  "grid": "16x16",
  "slotCap": 44,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "u", "value": "$randD16" },
    { "op": "VAR_ASSIGN", "var": "v", "value": 10 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "x", "right": "u" },
          "then": [
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": "==", "left": "y", "right": "v" },
              "then": [
                { "op": "VAR_OP", "target": "s", "left": "s", "operator": "+", "right": 1 },
                { "op": "PLAY_CHIME" },
                { "op": "VAR_ASSIGN", "var": "u", "value": "$randD16" },
                { "op": "VAR_ASSIGN", "var": "v", "value": 12 }
              ]
            }
          ]
        },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "yellow" },
        { "op": "LIGHT_PIXEL", "x": "u", "y": "v" },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "SET_LED_COLOR", "color": "green" },
        { "op": "LIGHT_PIXEL", "x": "s", "y": 16 },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_TAP": [
    { "op": "VAR_ASSIGN", "var": "u", "value": "$pointerX" },
    { "op": "VAR_ASSIGN", "var": "v", "value": "$pointerY" },
    { "op": "VAR_OP", "target": "q", "left": "u", "operator": "+", "right": 2 },
    { "op": "PLAY_NOTE", "pitch": "u", "duration": 0.25 },
    { "op": "PLAY_NOTE", "pitch": "q", "duration": 0.25 }
  ],
  "ON_KEY_UP": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<", "left": "y", "right": 15 },
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
      "cond": { "op": "CMP", "operator": "<", "left": "x", "right": 16 },
      "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }]
    }
  ],
  "ON_KEY_B": [
    { "op": "VAR_ASSIGN", "var": "s", "value": 0 }
  ]
}
```

---

## 2. Variation Cards (`🎨` Pick & Remix!)

### Variation 1 — `8×8` Dual-Mode Synth & Drum Launchpad (`21` flat blocks)
**Kid Idea:** Press **`[🅰️]`** to toggle Bank A (`k = m % 2 == 0`: Cyan Harmonic Chords) vs. Bank B (`k == 1`: 4-Corner Drum & Heart/Star Stamp Machine), and **`[🅱️]`** to wipe the stage!

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 32,
  "MAIN": [],
  "ON_TAP": [
    { "op": "VAR_OP", "target": "k", "left": "m", "operator": "%", "right": 2 },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "k", "right": 0 },
      "then": [
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_COL", "col": "$pointerX" },
        { "op": "VAR_OP", "target": "c", "left": "$pointerX", "operator": "+", "right": 2 },
        { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.25 },
        { "op": "PLAY_NOTE", "pitch": "c", "duration": 0.25 }
      ],
      "else": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "$pointerY", "right": 4 },
          "then": [
            { "op": "SET_LED_COLOR", "color": "red" },
            { "op": "STAMP_PRESET", "preset": 0 },
            { "op": "DRUM_KICK" }
          ],
          "else": [
            { "op": "SET_LED_COLOR", "color": "yellow" },
            { "op": "STAMP_PRESET", "preset": 1 },
            { "op": "DRUM_CLAP" }
          ]
        }
      ]
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

### Variation 2 — `32×32` Interactive Stamp & Symmetry Sprite Studio (`28` flat blocks)
**Kid Idea:** Paint on the **`32×32`** Sprite Matrix by dragging `$pointerDown`! Press **`[🅰️]`** to cycle 3 brushes (`b = m % 3`: `0` = single pixel, `1` = 4-way kaleidoscope `(33 - X, 33 - Y)`, `2` = `$randD4` sparkle mist), and wrap musical pitches modulo `16`!

```json
{
  "env": "beat",
  "sizePreset": 2,
  "grid": "32x32",
  "slotCap": 42,
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
            { "op": "VAR_OP", "target": "b", "left": "m", "operator": "%", "right": 3 },
            { "op": "SET_LED_COLOR", "color": "$randomColor" },
            { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": "==", "left": "b", "right": 1 },
              "then": [
                { "op": "VAR_OP", "target": "u", "left": 33, "operator": "-", "right": "$pointerX" },
                { "op": "VAR_OP", "target": "v", "left": 33, "operator": "-", "right": "$pointerY" },
                { "op": "LIGHT_PIXEL", "x": "u", "y": "$pointerY" },
                { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "v" },
                { "op": "LIGHT_PIXEL", "x": "u", "y": "v" }
              ]
            },
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": "==", "left": "b", "right": 2 },
              "then": [
                { "op": "VAR_OP", "target": "x", "left": "$pointerX", "operator": "+", "right": "$randD4" },
                { "op": "VAR_OP", "target": "y", "left": "$pointerY", "operator": "+", "right": "$randD4" },
                { "op": "LIGHT_PIXEL", "x": "x", "y": "y" }
              ]
            },
            { "op": "VAR_OP", "target": "k", "left": "$pointerX", "operator": "-", "right": 1 },
            { "op": "VAR_OP", "target": "r", "left": "k", "operator": "%", "right": 16 },
            { "op": "VAR_OP", "target": "p", "left": "r", "operator": "+", "right": 1 },
            { "op": "PLAY_NOTE", "pitch": "p", "duration": 0.125 }
          ]
        },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
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

### Variation 3 — `16×16` Arcade Brick Breaker (`66` flat blocks)
**Kid Idea:** Bounce ball `(x, y)` off walls AND your 3-pixel paddle `(l, p, r)` steered by **`⬅️`** / **`➡️`** to hit random glowing target brick `(b, c)`! Smash 5 bricks (`s >= 5`) to stamp a victory star and trigger `PLAY_CHIME`!

```json
{
  "env": "beat",
  "sizePreset": 1,
  "grid": "16x16",
  "slotCap": 70,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "u", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "v", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "b", "value": "$randD16" },
    { "op": "VAR_ASSIGN", "var": "c", "value": 13 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": "u" },
        { "op": "VAR_OP", "target": "y", "left": "y", "operator": "+", "right": "v" },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "x", "right": 1 },
          "then": [{ "op": "VAR_ASSIGN", "var": "u", "value": 1 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">=", "left": "x", "right": 16 },
          "then": [{ "op": "VAR_ASSIGN", "var": "u", "value": -1 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">=", "left": "y", "right": 16 },
          "then": [{ "op": "VAR_ASSIGN", "var": "v", "value": -1 }]
        },
        { "op": "VAR_OP", "target": "l", "left": "p", "operator": "-", "right": 1 },
        { "op": "VAR_OP", "target": "r", "left": "p", "operator": "+", "right": 1 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "y", "right": 2 },
          "then": [
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": ">=", "left": "x", "right": "l" },
              "then": [
                {
                  "op": "IF",
                  "cond": { "op": "CMP", "operator": "<=", "left": "x", "right": "r" },
                  "then": [
                    { "op": "VAR_ASSIGN", "var": "v", "value": 1 },
                    { "op": "DRUM_CLAP" }
                  ]
                }
              ]
            }
          ]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "x", "right": "b" },
          "then": [
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": "==", "left": "y", "right": "c" },
              "then": [
                { "op": "VAR_OP", "target": "s", "left": "s", "operator": "+", "right": 1 },
                { "op": "VAR_OP", "target": "v", "left": 0, "operator": "-", "right": "v" },
                { "op": "PLAY_CHIME" },
                { "op": "VAR_ASSIGN", "var": "b", "value": "$randD16" }
              ]
            }
          ]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<", "left": "y", "right": 1 },
          "then": [
            { "op": "DRUM_KICK" },
            { "op": "VAR_ASSIGN", "var": "x", "value": 8 },
            { "op": "VAR_ASSIGN", "var": "y", "value": 6 },
            { "op": "VAR_ASSIGN", "var": "v", "value": 1 }
          ]
        },
        { "op": "CLEAR_LEDS" },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": ">=", "left": "s", "right": 5 },
          "then": [
            { "op": "SET_LED_COLOR", "color": "yellow" },
            { "op": "STAMP_PRESET", "preset": 1 }
          ]
        },
        { "op": "SET_LED_COLOR", "color": "orange" },
        { "op": "LIGHT_PIXEL", "x": "b", "y": "c" },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_PIXEL", "x": "l", "y": 1 },
        { "op": "LIGHT_PIXEL", "x": "p", "y": 1 },
        { "op": "LIGHT_PIXEL", "x": "r", "y": 1 },
        { "op": "SET_LED_COLOR", "color": "white" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "WAIT_BEAT", "beats": 0.125 }
      ]
    }
  ],
  "ON_KEY_LEFT": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": ">", "left": "p", "right": 2 },
      "then": [{ "op": "VAR_OP", "target": "p", "left": "p", "operator": "-", "right": 1 }]
    }
  ],
  "ON_KEY_RIGHT": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<", "left": "p", "right": 15 },
      "then": [{ "op": "VAR_OP", "target": "p", "left": "p", "operator": "+", "right": 1 }]
    }
  ],
  "ON_KEY_B": [
    { "op": "VAR_ASSIGN", "var": "s", "value": 0 }
  ]
}
```
