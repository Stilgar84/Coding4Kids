# Lesson `inter.1`: Multi-Zone X/Y Synth & Beat Pad (`🎵` Beat & Light Matrix `8×8`)

- **Type:** `🎨` Creative Sandbox
- **Previous:** [`inter.0` Tap to Light & Play](./lesson_inter_0_tap_to_light_and_play.md) | **Next:** [`inter.2` Virtual D-Pad & Action Buttons](./lesson_inter_2_virtual_dpad_and_action_buttons.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix (`8×8` Grid, `1..8 × 1..8`) |
| Key Concepts | Splitting `$pointerX` / `$pointerY` with `IF / ELSE`, nested 4-corner pads, `0x46 ON_KEY_B` reset, 3-address `OP_VAR_OP` chord offsets |
| Visible Event Tabs | `MAIN` (`▶️`), `ON_TAP` (`👆`), `ON_KEY_B` (`🅱️` unlocked in Var 3) |
| Flat Block Budget | Starter: `9` \| Var 1: `14` \| Var 2: `21` \| Var 3: `21` (`slotCap: 26`) |

---

## 1. Starter — Drum vs. Piano Split (`9` flat blocks)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Tap the **bottom half** of the grid for a punchy orange drum, or tap the **top half** for cyan piano notes! Drag the middle border number (`4`) up or down to resize your instruments.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Wait zero loops! Everything runs directly inside **`ON_TAP` (`0x40`)**. Because `cmp` already taught comparison gates (`<=`), kids immediately see how comparing **`$pointerY <= 4`** slices an `8×8` matrix into a bottom 4-row drum pad (`y = 1..4`) and a top 4-row piano keyboard (`y = 5..8`). Keep `Edit Delta <= 4` when tweaking colors, pitches, or drum types.

</details>

```text
// ON_TAP (0x40)
CLEAR_LEDS
IF $pointerY <= 4
  SET_LED_COLOR [orange]
  DRUM_KICK
ELSE
  SET_LED_COLOR [cyan]
  PLAY_NOTE [$pointerX, 0.5]
END_IF
LIGHT_PIXEL [$pointerX, $pointerY]
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 14,
  "MAIN": [],
  "ON_TAP": [
    { "op": "CLEAR_LEDS" },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<=", "left": "$pointerY", "right": 4 },
      "then": [
        { "op": "SET_LED_COLOR", "color": "orange" },
        { "op": "DRUM_KICK" }
      ],
      "else": [
        { "op": "SET_LED_COLOR", "color": "cyan" },
        { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.5 }
      ]
    },
    { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" }
  ]
}
```

---

## 2. Variation Cards (`🎨` Pick & Remix!)

### Variation 1 — 4-Corner Toy ("Quad Drum & Chime", `14` flat blocks)
**Kid Idea:** Split left/right (`$pointerX <= 4`) AND top/bottom (`$pointerY <= 4`) so every corner plays its own sound!

```text
// ON_TAP (0x40)
IF $pointerX <= 4
  IF $pointerY <= 4
    DRUM_KICK
  ELSE
    DRUM_SNARE
  END_IF
ELSE
  IF $pointerY <= 4
    PLAY_CHIME
  ELSE
    DRUM_CLAP
  END_IF
END_IF
LIGHT_PIXEL [$pointerX, $pointerY]
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 14,
  "MAIN": [],
  "ON_TAP": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<=", "left": "$pointerX", "right": 4 },
      "then": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "$pointerY", "right": 4 },
          "then": [{ "op": "DRUM_KICK" }],
          "else": [{ "op": "DRUM_SNARE" }]
        }
      ],
      "else": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "$pointerY", "right": 4 },
          "then": [{ "op": "PLAY_CHIME" }],
          "else": [{ "op": "DRUM_CLAP" }]
        }
      ]
    },
    { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" }
  ]
}
```

### Variation 2 — Colorful Preset Pad (`21` flat blocks)
**Kid Idea:** Turn each quadrant into a sticker button (`❤️` Heart, `⭐` Star, `😊` Smile, or glowing beam)! Presets `0=Heart`, `1=Star`, `2=Smile` stamp brightly without clearing previous colors.

```text
// ON_TAP (0x40)
IF $pointerX <= 4
  IF $pointerY <= 4
    SET_LED_COLOR [red]
    STAMP_PRESET [0]
    DRUM_KICK
  ELSE
    SET_LED_COLOR [cyan]
    STAMP_PRESET [2]
    PLAY_NOTE [$pointerX, 0.5]
  END_IF
ELSE
  IF $pointerY <= 4
    SET_LED_COLOR [yellow]
    STAMP_PRESET [1]
    PLAY_CHIME
  ELSE
    SET_LED_COLOR [magenta]
    LIGHT_ROW [$pointerY]
    DRUM_CLAP
  END_IF
END_IF
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 22,
  "MAIN": [],
  "ON_TAP": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "<=", "left": "$pointerX", "right": 4 },
      "then": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "$pointerY", "right": 4 },
          "then": [
            { "op": "SET_LED_COLOR", "color": "red" },
            { "op": "STAMP_PRESET", "preset": 0 },
            { "op": "DRUM_KICK" }
          ],
          "else": [
            { "op": "SET_LED_COLOR", "color": "cyan" },
            { "op": "STAMP_PRESET", "preset": 2 },
            { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.5 }
          ]
        }
      ],
      "else": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "$pointerY", "right": 4 },
          "then": [
            { "op": "SET_LED_COLOR", "color": "yellow" },
            { "op": "STAMP_PRESET", "preset": 1 },
            { "op": "PLAY_CHIME" }
          ],
          "else": [
            { "op": "SET_LED_COLOR", "color": "magenta" },
            { "op": "LIGHT_ROW", "row": "$pointerY" },
            { "op": "DRUM_CLAP" }
          ]
        }
      ]
    }
  ]
}
```

### Variation 3 — Chord DJ & `[🅱️]` Wipe (`21` flat blocks: `ON_TAP: 20`, `ON_KEY_B: 1`)
**Kid Idea:** Tap the top half to play a 3-note triad chord computed with **`c = 👆X + 2`** and **`d = 👆X + 4`**, tap the bottom half for a drum-and-chime groove, and press **`[🅱️]`** to clear the board!

```text
// ON_TAP (0x40)
SET_LED_COLOR [$randomColor]
LIGHT_PIXEL [$pointerX, $pointerY]
IF $pointerY > 4
  c = $pointerX + 2
  d = $pointerX + 4
  LIGHT_COL [$pointerX]
  PLAY_NOTE [$pointerX, 0.25]
  PLAY_NOTE [c, 0.25]
  PLAY_NOTE [d, 0.5]
ELSE
  IF $pointerX <= 4
    DRUM_KICK
    WAIT_BEAT [0.25]
    DRUM_SNARE
  ELSE
    DRUM_CLAP
    WAIT_BEAT [0.25]
    PLAY_CHIME
  END_IF
END_IF

// ON_KEY_B (0x46)
CLEAR_LEDS
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 26,
  "MAIN": [],
  "ON_TAP": [
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": ">", "left": "$pointerY", "right": 4 },
      "then": [
        { "op": "VAR_OP", "target": "c", "left": "$pointerX", "operator": "+", "right": 2 },
        { "op": "VAR_OP", "target": "d", "left": "$pointerX", "operator": "+", "right": 4 },
        { "op": "LIGHT_COL", "col": "$pointerX" },
        { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.25 },
        { "op": "PLAY_NOTE", "pitch": "c", "duration": 0.25 },
        { "op": "PLAY_NOTE", "pitch": "d", "duration": 0.5 }
      ],
      "else": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<=", "left": "$pointerX", "right": 4 },
          "then": [
            { "op": "DRUM_KICK" },
            { "op": "WAIT_BEAT", "beats": 0.25 },
            { "op": "DRUM_SNARE" }
          ],
          "else": [
            { "op": "DRUM_CLAP" },
            { "op": "WAIT_BEAT", "beats": 0.25 },
            { "op": "PLAY_CHIME" }
          ]
        }
      ]
    }
  ],
  "ON_KEY_B": [
    { "op": "CLEAR_LEDS" }
  ]
}
```
