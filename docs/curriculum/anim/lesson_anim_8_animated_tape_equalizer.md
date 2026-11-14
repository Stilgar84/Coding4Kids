# Lesson `anim.8` — Animated Tape Equalizer

> [← Module `anim` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

Paired with [Lesson `tape.4`](../tape/lesson_tape_4_scale_melody_and_led_stripes.md).

**Initial Sparse Tape (`1..11`):** `[2, 5, 7, 4, 6, 3, 8, 2, 5, 7, 4]` — bar heights (`1..8`)

## Starter (`defaultLoopPlayback: true`)

4 animated equalizer frames; each frame shifts the starting tape offset `f` by `1` so the 8 bars ripple across the matrix to a beat!

```
// MAIN (8 blocks)
SET_BEAT_DELAY [0]
f = 1
Loop ×4                      // 4 ripple frames
  CLEAR_LEDS                 // clear at start of frame!
  Call F1                    // draw all 8 columns starting from tape cell f
  DRUM_KICK
  WAIT_BEAT [0.5]
  f = f + 1
Loop End

// F1: Draw 8 columns from tape[f .. f+7] (7 blocks)
TAPE_SEEK [f]
x = 1
Loop ×8
  a = $cellValue
  Call F2                    // draw vertical bar of height a in column x
  TAPE_STEP [RIGHT]
  x = x + 1
Loop End

// F2: Draw column x from bottom (row 8) upward a pixels (7 blocks)
y = 8
Loop [a]
  LIGHT_PIXEL [x, y]
  y = y - 1
Loop End
```

## Variation Cards

- `[Preview 1]` **Tape-Driven Rainbow Stripes:** Tape cells `1..8` hold colors (`a = $cellColor`); `F1` paints all 8 rows instantly (`SET_LED_COLOR [a]`, `LIGHT_ROW [r]`), flashing and shifting colors each beat.
- `[Preview 2]` **Center-Mirrored Bass Visualizer:** Bars grow symmetrically up and down from center rows `4` & `5`.
- `[Preview 3]` **Peak-Hold Meter (with `Black` Decay):** Draws full bar in `Cyan`, then erases lower segments with `Black` leaving floating peak dots!
