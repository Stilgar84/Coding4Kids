# Lesson `inter.8`: Whack-a-Star & Mini-Arcade (`🎵` `8×8` & `16×16` Matrix)

- **Type:** `🎨` Creative Sandbox
- **Previous:** [`inter.7` Fix-It: Broken Interactive Toy](./lesson_inter_7_fix_broken_interactive_toy.md) | **Next:** [`inter.A` Capstone A: Playable Arcade & Mega-Synth](./capstone_inter_a_playable_arcade_and_synth.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix — **`8×8`** (Starter, Var 1) & **`16×16` HD** (Var 2, Var 3) |
| Key Concepts | Coordinate hit-testing (`$pointerX == x` AND `$pointerY == y`), randomized respawn (`$randD8` / `$randD16`), pre-computed paddle span (`l = p - 1; r = p + 1`) |
| Variable Rule | Strictly single-letter `'a'..'z'` ONLY (`x, y` ball, `u, v` velocity, `p, l, r` paddle, `s` score) |
| Flat Block Budget | Starter: `20` \| Var 1: `36` \| Var 2: `29` \| Var 3: `49` (`slotCap: 54`) |

---

## 1. Starter — Whack-a-Star! (`8×8`, `20` flat blocks)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Tap the glowing yellow star at **`(x, y)`** as fast as you can to chime, raise your green score dot, and warp the star somewhere new! Press **`[🅱️]`** anytime to start a fresh game from zero.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Here **`$randD8`** (`1..8`) picks clean integer coordinates inside the `8×8` board, and `ON_TAP` checks **both** `$pointerX == x` and `$pointerY == y` via nested `IF` blocks. Notice how score `s` lights `LIGHT_PIXEL [s, 1]`: at `s = 0`, Beat silently ignores `x = 0` without crashing, and on hits `1..8` it lights a green score meter across the bottom row!

</details>

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 26,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": "$randD8" },
    { "op": "VAR_ASSIGN", "var": "y", "value": "$randD8" },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "yellow" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
        { "op": "SET_LED_COLOR", "color": "green" },
        { "op": "LIGHT_PIXEL", "x": "s", "y": 1 },
        { "op": "WAIT_BEAT", "beats": 0.25 }
      ]
    }
  ],
  "ON_TAP": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "$pointerX", "right": "x" },
      "then": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "$pointerY", "right": "y" },
          "then": [
            { "op": "VAR_OP", "target": "s", "left": "s", "operator": "+", "right": 1 },
            { "op": "PLAY_CHIME" },
            { "op": "VAR_ASSIGN", "var": "x", "value": "$randD8" },
            { "op": "VAR_ASSIGN", "var": "y", "value": "$randD8" }
          ]
        }
      ]
    }
  ],
  "ON_KEY_B": [
    { "op": "VAR_ASSIGN", "var": "s", "value": 0 }
  ]
}
```

---

## 2. Variation Cards (`🎨` Pick & Remix!)

### Variation 1 — D-Pad Star Catcher (`8×8`, `36` flat blocks)
**Kid Idea:** Pilot a cyan rover `(x, y)` with **`⬆️` `⬇️` `⬅️` `➡️`** to grab the glowing star `(u, v)` before pressing `[🅱️]` to reset your score!

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 38,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 4 },
    { "op": "VAR_ASSIGN", "var": "u", "value": "$randD8" },
    { "op": "VAR_ASSIGN", "var": "v", "value": "$randD8" },
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
                { "op": "VAR_ASSIGN", "var": "u", "value": "$randD8" },
                { "op": "VAR_ASSIGN", "var": "v", "value": "$randD8" }
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
        { "op": "LIGHT_PIXEL", "x": "s", "y": 1 },
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
    { "op": "VAR_ASSIGN", "var": "s", "value": 0 }
  ]
}
```

### Variation 2 — Dodge the Falling Meteor (`16×16` HD, `29` flat blocks)
**Kid Idea:** Slide your green ship `x` left and right along row `1` (`⬅️` / `➡️`) while red meteors `(u, v)` plummet from row `16`! Dodging safely plays a chime; colliding kicks the drum and wipes row `1`.

```json
{
  "env": "beat",
  "sizePreset": 1,
  "grid": "16x16",
  "slotCap": 32,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "u", "value": "$randD16" },
    { "op": "VAR_ASSIGN", "var": "v", "value": 16 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "==", "left": "a", "right": 0 },
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "red" },
        { "op": "LIGHT_PIXEL", "x": "u", "y": "v" },
        { "op": "SET_LED_COLOR", "color": "green" },
        { "op": "LIGHT_PIXEL", "x": "x", "y": 1 },
        { "op": "VAR_OP", "target": "v", "left": "v", "operator": "-", "right": 1 },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<", "left": "v", "right": 1 },
          "then": [
            {
              "op": "IF",
              "cond": { "op": "CMP", "operator": "==", "left": "u", "right": "x" },
              "then": [
                { "op": "DRUM_KICK" },
                { "op": "LIGHT_ROW", "row": 1 }
              ],
              "else": [{ "op": "PLAY_CHIME" }]
            },
            { "op": "VAR_ASSIGN", "var": "v", "value": 16 },
            { "op": "VAR_ASSIGN", "var": "u", "value": "$randD16" }
          ]
        },
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
      "cond": { "op": "CMP", "operator": "<", "left": "x", "right": 16 },
      "then": [{ "op": "VAR_OP", "target": "x", "left": "x", "operator": "+", "right": 1 }]
    }
  ]
}
```

### Variation 3 — 1-Player LED Pong Rally (`16×16` HD, `49` flat blocks)
**Kid Idea:** Bounce a yellow ball `(x, y)` moving at speed `(u, v)` off all three walls AND a 3-pixel cyan paddle `(l, p, r)` steered with **`⬅️`** / **`➡️`**! Notice pre-computed 3-address bounds `l = p - 1` and `r = p + 1` before every comparison.

```json
{
  "env": "beat",
  "sizePreset": 1,
  "grid": "16x16",
  "slotCap": 54,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "p", "value": 8 },
    { "op": "VAR_ASSIGN", "var": "x", "value": 6 },
    { "op": "VAR_ASSIGN", "var": "y", "value": 10 },
    { "op": "VAR_ASSIGN", "var": "u", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "v", "value": -1 },
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
                    { "op": "PLAY_CHIME" }
                  ]
                }
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
            { "op": "VAR_ASSIGN", "var": "y", "value": 12 },
            { "op": "VAR_ASSIGN", "var": "v", "value": -1 }
          ]
        },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "LIGHT_PIXEL", "x": "l", "y": 1 },
        { "op": "LIGHT_PIXEL", "x": "p", "y": 1 },
        { "op": "LIGHT_PIXEL", "x": "r", "y": 1 },
        { "op": "SET_LED_COLOR", "color": "yellow" },
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
  ]
}
```
