# `anim.3`: LED Rain & Smooth Frame Loops (`🎨` Creative Sandbox)

- **World:** 🎵 Beat & Light Matrix (`8×8`, `BEAT_VERSION = 2`)
- **Card Type:** `🎨` Creative Sandbox (`Starter` + `3` Variation Cards)
- **Prerequisite:** [`anim.2`](./lesson_anim_2_spinning_windmill.md)
- **Hardware Config:** `matrixSize: 8`, `beatVersion: 2`, `defaultLoopPlayback: true`
- **Block Budget (Closer-Inclusive):** `Starter: 8` (`Slot Cap: 12`; Var 1: `15 / 20`, Var 2: `14 / 18`, Var 3: `21 / 24`)

> **Guided Co-Pilot Card:**
> Lock **`SET_BEAT_DELAY [0]`**, clear at the top of `Loop [8]`, drop row `y = y + 1` down column `4`, and hold **`WAIT_BEAT [0.5]`**! Flip to **Variation Cards** for Matrix Rain, Heartbeat Ripple, and 4-Corner Fireworks.

<details>
<summary>📖 Parent / Teacher Tip — Crisp 4/4 Timing & Zero-Variable Loops</summary>

- **Starter (`8` flat blocks):** Uses `WAIT_BEAT [0.5]` across `8` frames (`8 × 0.5 = 4` steady 4/4 beats) so the falling raindrop steps smoothly down rows `1..8` without any awkward pause. (`y` begins at `0` on reset, stepping to `1..8`.)
- **Var 1 (`Matrix Rain`):** Picks a fresh random column `x = $randD8` each cycle, draws a trailing green glow (`p = y - 1`) above a bright white tip `(x, y)`, and triggers `PLAY_NOTE [y, 0.25]`.
- **Var 2 & Var 3 (`Zero-Variable Loop ×4` Patterns):** Demonstrate that expressive frame animations in Beat (`Concentric Heartbeat Ripple` and `4-Corner Firework Burst`) don't even need variables when keyframes alternate inside `Loop [4]`!

</details>

---

## Palette & Capabilities

```json
{
  "env": "beat",
  "matrixSize": 8,
  "beatVersion": 2,
  "defaultLoopPlayback": true,
  "allowVariables": true,
  "varNames": "a..z",
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "LIGHT_PIXEL", "STAMP_PRESET", "DRUM_KICK", "PLAY_CHIME",
    "PLAY_NOTE", "WAIT_BEAT", "LOOP_START", "VAR_ASSIGN", "VAR_OP"
  ],
  "allowedSensors": ["$randD8"]
}
```

---

## Starter: Falling Raindrop (`8` Flat Blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
Loop [8]
  CLEAR_LEDS
  SET_LED_COLOR [Cyan]
  y = y + 1
  LIGHT_PIXEL [4, y]
  WAIT_BEAT [0.5]
End Loop
```

```json
{
  "slotCap": 12,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 8,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        { "op": "VAR_OP", "target": "y", "operator": "+", "left": "y", "right": 1 },
        { "op": "LIGHT_PIXEL", "x": 4, "y": "y" },
        { "op": "WAIT_BEAT", "beats": 0.5 }
      ]
    }
  ]
}
```

---

## Variation 1: Matrix Rain with Random Lanes (`15` Flat Blocks)

```text
// MAIN (15 flat blocks)
SET_BEAT_DELAY [0]
Loop [3]
  x = $randD8
  y = 0
  Loop [8]
    CLEAR_LEDS
    y = y + 1
    p = y - 1
    SET_LED_COLOR [Green]
    LIGHT_PIXEL [x, p]
    SET_LED_COLOR [White]
    LIGHT_PIXEL [x, y]
    PLAY_NOTE [y, 0.25]
  End Loop
End Loop
```

```json
{
  "slotCap": 20,
  "matrixSize": 8,
  "beatVersion": 2,
  "seed": 42,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "VAR_ASSIGN", "var": "x", "value": "$randD8" },
        { "op": "VAR_ASSIGN", "var": "y", "value": 0 },
        {
          "op": "LOOP_START",
          "count": 8,
          "body": [
            { "op": "CLEAR_LEDS" },
            { "op": "VAR_OP", "target": "y", "operator": "+", "left": "y", "right": 1 },
            { "op": "VAR_OP", "target": "p", "operator": "-", "left": "y", "right": 1 },
            { "op": "SET_LED_COLOR", "color": "Green" },
            { "op": "LIGHT_PIXEL", "x": "x", "y": "p" },
            { "op": "SET_LED_COLOR", "color": "White" },
            { "op": "LIGHT_PIXEL", "x": "x", "y": "y" },
            { "op": "PLAY_NOTE", "pitch": "y", "duration": 0.25 }
          ]
        }
      ]
    }
  ]
}
```

---

## Variation 2: Concentric Heartbeat Ripple (`14` Flat Blocks, Zero Variables)

```text
// MAIN (14 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  CLEAR_LEDS
  SET_LED_COLOR [Red]
  LIGHT_PIXEL [4, 4]
  LIGHT_PIXEL [5, 4]
  LIGHT_PIXEL [4, 5]
  LIGHT_PIXEL [5, 5]
  DRUM_KICK
  CLEAR_LEDS
  SET_LED_COLOR [Pink]
  STAMP_PRESET [HEART]
  WAIT_BEAT [0.5]
End Loop
```

```json
{
  "slotCap": 18,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Red" },
        { "op": "LIGHT_PIXEL", "x": 4, "y": 4 },
        { "op": "LIGHT_PIXEL", "x": 5, "y": 4 },
        { "op": "LIGHT_PIXEL", "x": 4, "y": 5 },
        { "op": "LIGHT_PIXEL", "x": 5, "y": 5 },
        { "op": "DRUM_KICK" },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Pink" },
        { "op": "STAMP_PRESET", "preset": "HEART" },
        { "op": "WAIT_BEAT", "beats": 0.5 }
      ]
    }
  ]
}
```

---

## Variation 3: 4-Corner Firework Burst (`21` Flat Blocks, Zero Variables)

```text
// MAIN (21 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  CLEAR_LEDS
  SET_LED_COLOR [Yellow]
  LIGHT_PIXEL [4, 6]
  WAIT_BEAT [0.25]
  CLEAR_LEDS
  LIGHT_PIXEL [4, 3]
  WAIT_BEAT [0.25]
  CLEAR_LEDS
  SET_LED_COLOR [Pink]
  STAMP_PRESET [STAR]
  PLAY_CHIME
  CLEAR_LEDS
  SET_LED_COLOR [Cyan]
  LIGHT_PIXEL [1, 1]
  LIGHT_PIXEL [8, 1]
  LIGHT_PIXEL [1, 8]
  LIGHT_PIXEL [8, 8]
  WAIT_BEAT [0.5]
End Loop
```

```json
{
  "slotCap": 24,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Yellow" },
        { "op": "LIGHT_PIXEL", "x": 4, "y": 6 },
        { "op": "WAIT_BEAT", "beats": 0.25 },
        { "op": "CLEAR_LEDS" },
        { "op": "LIGHT_PIXEL", "x": 4, "y": 3 },
        { "op": "WAIT_BEAT", "beats": 0.25 },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Pink" },
        { "op": "STAMP_PRESET", "preset": "STAR" },
        { "op": "PLAY_CHIME" },
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        { "op": "LIGHT_PIXEL", "x": 1, "y": 1 },
        { "op": "LIGHT_PIXEL", "x": 8, "y": 1 },
        { "op": "LIGHT_PIXEL", "x": 1, "y": 8 },
        { "op": "LIGHT_PIXEL", "x": 8, "y": 8 },
        { "op": "WAIT_BEAT", "beats": 0.5 }
      ]
    }
  ]
}
```
