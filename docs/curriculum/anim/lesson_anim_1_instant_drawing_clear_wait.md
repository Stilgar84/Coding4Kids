# `anim.1`: Instant LED Buffers & Clear-Wait (`📖` Discovery)

- **World:** 🎵 Beat & Light Matrix (`8×8`, `BEAT_VERSION = 2`)
- **Card Type:** `📖` Guided Discovery Deck (`3` Interactive `Loop ×4` Tabs)
- **Prerequisite:** [`anim.0`](./lesson_anim_0_meet_logo_flipbook_mode.md)
- **Hardware Config:** `matrixSize: 8`, `defaultLoopPlayback: false`
- **Block Budget (Closer-Inclusive):** `7–12` flat blocks per tab (`Slot Cap: 16`)

> **Guided Co-Pilot Card:**
> Compare the three **🎵 Loop ×4** tabs! **`SET_BEAT_DELAY [0]`** draws an entire frame in `0 ms`, and putting **`CLEAR_LEDS` at the top** of the loop keeps the final smiley lit instead of blanking out.

<details>
<summary>📖 Parent / Teacher Tip — Hardware Frame Batching in Beat</summary>

Unlike Turtle LOGO's built-in Flipbook runner, Beat teaches explicit hardware frame loops inside `Main`:
1. **Tab 1 (`SET_BEAT_DELAY [1]`):** Non-sound blocks wait `1×` beat between rows/pixels, so the frame looks like slow painting instead of an instant picture.
2. **Tab 2 (`SET_BEAT_DELAY [0]` + Loop-Top `CLEAR_LEDS`):** `0` batches all LED draws into `0 ms` before `WAIT_BEAT [1]` holds the finished frame cleanly—and ends lit on Frame 4!
3. **Tab 3 (Oops! Loop-Bottom `CLEAR_LEDS` Bug):** Placing `CLEAR_LEDS` **after** `WAIT_BEAT [1]` flashes each frame nicely during playback, then erases everything on exit, leaving a dark pad—motivating the fix-it challenge in [`anim.6a`](./lesson_anim_6a_fix_blank_lightshow_bug.md).

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
  "readOnlyDiscovery": true,
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "LIGHT_ROW", "LIGHT_PIXEL", "STAMP_PRESET",
    "WAIT_BEAT", "LOOP_START"
  ]
}
```

---

## Tab 1: Slow Paint (`SET_BEAT_DELAY [1]`)

```text
// MAIN (12 flat blocks)
SET_BEAT_DELAY [1]
Loop [4]
  CLEAR_LEDS
  SET_LED_COLOR [Cyan]
  LIGHT_ROW [2]
  LIGHT_ROW [4]
  LIGHT_ROW [6]
  SET_LED_COLOR [Yellow]
  LIGHT_PIXEL [3, 3]
  LIGHT_PIXEL [6, 3]
  WAIT_BEAT [1]
End Loop
```

```json
{
  "slotCap": 16,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 1 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        { "op": "LIGHT_ROW", "row": 2 },
        { "op": "LIGHT_ROW", "row": 4 },
        { "op": "LIGHT_ROW", "row": 6 },
        { "op": "SET_LED_COLOR", "color": "Yellow" },
        { "op": "LIGHT_PIXEL", "x": 3, "y": 3 },
        { "op": "LIGHT_PIXEL", "x": 6, "y": 3 },
        { "op": "WAIT_BEAT", "beats": 1 }
      ]
    }
  ]
}
```

---

## Tab 2: Instant Buffer (`SET_BEAT_DELAY [0]` + Loop-Top `CLEAR_LEDS`)

```text
// MAIN (12 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  CLEAR_LEDS
  SET_LED_COLOR [Cyan]
  LIGHT_ROW [2]
  LIGHT_ROW [4]
  LIGHT_ROW [6]
  SET_LED_COLOR [Yellow]
  LIGHT_PIXEL [3, 3]
  LIGHT_PIXEL [6, 3]
  WAIT_BEAT [1]
End Loop
```

```json
{
  "slotCap": 16,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Cyan" },
        { "op": "LIGHT_ROW", "row": 2 },
        { "op": "LIGHT_ROW", "row": 4 },
        { "op": "LIGHT_ROW", "row": 6 },
        { "op": "SET_LED_COLOR", "color": "Yellow" },
        { "op": "LIGHT_PIXEL", "x": 3, "y": 3 },
        { "op": "LIGHT_PIXEL", "x": 6, "y": 3 },
        { "op": "WAIT_BEAT", "beats": 1 }
      ]
    }
  ]
}
```

---

## Tab 3: Oops! Loop-Bottom `CLEAR_LEDS` (Blank Final Frame)

```text
// MAIN (7 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  SET_LED_COLOR [Green]
  STAMP_PRESET [SMILE]
  WAIT_BEAT [1]
  CLEAR_LEDS
End Loop
```

```json
{
  "slotCap": 16,
  "matrixSize": 8,
  "beatVersion": 2,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "SET_LED_COLOR", "color": "Green" },
        { "op": "STAMP_PRESET", "preset": "SMILE" },
        { "op": "WAIT_BEAT", "beats": 1 },
        { "op": "CLEAR_LEDS" }
      ]
    }
  ]
}
```
