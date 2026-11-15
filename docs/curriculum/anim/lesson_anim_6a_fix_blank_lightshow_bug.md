# `anim.6a`: Fix the Blank Lightshow Bug! (`🔧` Fix-It)

- **World:** 🎵 Beat & Light Matrix (`8×8`, `BEAT_VERSION = 2`)
- **Card Type:** `🔧` Isolated Hardware-Loop Debugging (`Starter` → `Partial Help` → `Reference Solution`)
- **Prerequisite:** [`anim.6`](./lesson_anim_6_scanner_bar_wipe_transitions.md)
- **Edit Delta:** `2` surgical fixes (`SET_BEAT_DELAY [1]` → `[0]`, move `CLEAR_LEDS` from loop bottom to loop top)
- **Block Budget (Closer-Inclusive):** `7` flat blocks (`Slot Cap: 10`)

> **Guided Co-Pilot Card:**
> This pulsing heart ends completely **blank** and flashes too slowly! Fix **`SET_BEAT_DELAY [0]`** and drag **`CLEAR_LEDS`** to the **top** of `Loop [4]` so Frame 4 stays lit.

<details>
<summary>📖 Parent / Teacher Tip — Isolating Timing & Buffer Bugs from Creative Sandboxes</summary>

Per the Two-Axis Guardrail, creative sandboxes stay pure while `anim.6a` isolates two classic Beat hardware-frame-loop mistakes:
1. **`SET_BEAT_DELAY [1]`**: Non-sound step actions wait `1×` global delay instead of batching instantaneously (`0 ms`).
2. **`CLEAR_LEDS` at Loop Bottom**: Placing `CLEAR_LEDS` after `WAIT_BEAT [1]` clears the heart on the very last instruction, leaving an empty pad!
- **Bonus Mini-Cases:** Also included below for parent/teacher discussion (no grading penalty): Bonus A shows missing `WAIT_BEAT` (`0 ms` flicker), and Bonus B shows an inner-loop `CLEAR_LEDS` wiping columns one-by-one.

</details>

---

## Palette & Capabilities

```json
{
  "env": "beat",
  "matrixSize": 8,
  "beatVersion": 2,
  "defaultLoopPlayback": false,
  "allowVariables": false,
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "STAMP_PRESET", "PLAY_CHIME", "WAIT_BEAT", "LOOP_START"
  ]
}
```

---

## Broken `Starter` (`7` Flat Blocks)

```text
// MAIN (7 flat blocks)
SET_BEAT_DELAY [1]
Loop [4]
  SET_LED_COLOR [Pink]
  STAMP_PRESET [HEART]
  WAIT_BEAT [1]
  CLEAR_LEDS
End Loop
```

```json
{
  "slotCap": 10,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "SET_LED_COLOR", "color": "Pink" },
        { "op": "STAMP_PRESET", "preset": "HEART" },
        { "op": "WAIT_BEAT", "beats": 1 },
        { "op": "CLEAR_LEDS" }
      ]
    }
  ]
}
```

---

## `Partial Help` (`7` Flat Blocks — Delay Fixed, `CLEAR_LEDS` Still Misplaced)

```text
// MAIN (7 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  SET_LED_COLOR [Pink]
  STAMP_PRESET [HEART]
  WAIT_BEAT [1]
  CLEAR_LEDS
End Loop
```

```json
{
  "slotCap": 10,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "SET_LED_COLOR", "color": "Pink" },
        { "op": "STAMP_PRESET", "preset": "HEART" },
        { "op": "WAIT_BEAT", "beats": 1 },
        { "op": "CLEAR_LEDS" }
      ]
    }
  ]
}
```

---

## `Reference Solution` (`7` Flat Blocks)

```text
// MAIN (7 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  CLEAR_LEDS
  SET_LED_COLOR [Pink]
  STAMP_PRESET [HEART]
  WAIT_BEAT [1]
End Loop
```

```json
{
  "slotCap": 10,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Pink" },
        { "op": "STAMP_PRESET", "preset": "HEART" },
        { "op": "WAIT_BEAT", "beats": 1 }
      ]
    }
  ]
}
```

---

## Bonus Debug Cases (Optional Discussion)

- **Bonus A (Missing `WAIT_BEAT` Flicker):** `SET_BEAT_DELAY [0] → Loop [4] { CLEAR_LEDS, SET_LED_COLOR [Yellow], STAMP_PRESET [STAR] }` runs all `4` flashes in `0 ms` with zero hold time—insert `WAIT_BEAT [0.5]` at loop bottom.
- **Bonus B (Inner-Loop `CLEAR_LEDS` Bug):** Putting `CLEAR_LEDS` inside a `col` drawing loop erases columns `1..7` before Column `8` draws—lift `CLEAR_LEDS` into the outer frame loop!
