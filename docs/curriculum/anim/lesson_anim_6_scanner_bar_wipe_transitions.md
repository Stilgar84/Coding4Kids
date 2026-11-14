# Lesson `anim.6` — Scanner Bar & Wipe Transitions

> [← Module `anim` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

Builds on `var.6` (Sweeping Coordinates & Scales), where `r = r + 1`, `r = r - 1`, and helper tabs `F1`/`F2` are available.

## Starter (`defaultLoopPlayback: true`)

A bright emerald scanner bar sweeps smoothly down and back up the 8×8 matrix:

```
// MAIN (6 blocks)
SET_BEAT_DELAY [0]
SET_LED_COLOR [Green]
r = 1
Call F1                      // sweep down rows 1 -> 7
Call F2                      // sweep up rows 8 -> 2
LIGHT_ROW [1]

// F1: Sweep down (6 blocks)
Loop ×7
  CLEAR_LEDS
  LIGHT_ROW [r]
  WAIT_BEAT [0.25]
  r = r + 1
Loop End

// F2: Sweep up (6 blocks)
Loop ×7
  CLEAR_LEDS
  LIGHT_ROW [r]
  WAIT_BEAT [0.25]
  r = r - 1
Loop End
```

## Variation Cards

- `[Preview 1]` **Left-to-Right Color Wipe:** Accumulates columns `1..8` without clearing (`LIGHT_COL [c]`, `WAIT_BEAT [0.25]`, `c = c + 1`), punctuating column 8 with `DRUM_KICK`.
- `[Preview 2]` **Curtain Reveal (Both Edges Inward):** Lights left column `c` and right mirror column `m = 9 - c` simultaneously (`c = 1..4`) so curtains meet in the center!
- `[Preview 3]` **Diagonal Bouncing Pixel:** Sweeps `LIGHT_PIXEL [c, r]` diagonally across the 8×8 pad and bounces back.
- `[Preview 4]` **`Black` Eraser Wipe:** Stamps `STAMP_STAR`, holds `1` beat, then sweeps `SET_LED_COLOR [Black]` + `LIGHT_COL [c]` across `1..8` to wipe the star away column by column!
