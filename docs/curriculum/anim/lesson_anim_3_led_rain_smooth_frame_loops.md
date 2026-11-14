# Lesson `anim.3` — LED Rain & Smooth Frame Loops

> [← Module `anim` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

Builds on `loop.4` (Rhythm Loops & Chasing Border LEDs). Uses `SET_BEAT_DELAY [0]`, `Loop`, `CURSOR_STEP`, `CURSOR_TURN`, and `SET_LED_COLOR` (**zero variables**).

## Starter (`defaultLoopPlayback: true`, 8 blocks in `MAIN`)

An animated 4-edge neon marquee where each entire 7-LED edge flashes instantly in sync with a snare groove:

```
// MAIN (8 blocks)
SET_BEAT_DELAY [0]
Loop ×4
  CLEAR_LEDS                 // clear at start of frame!
  CURSOR_STEP ×7             // lights 7 cursor cells instantly
  CURSOR_TURN [RIGHT]
  DRUM_SNARE
  WAIT_BEAT [0.5]
Loop End
```

## Variation Cards

- `[Preview 1]` **Matrix Rain Columns:** Turns cursor `SOUTH` (`CURSOR_TURN [RIGHT]`), steps streaks down columns with `SET_LED_COLOR [Green]` and `WAIT_BEAT [0.25]`.
- `[Preview 2]` **Blinking Carved Heart (`Black` Cutout):** Alternates Frame 1 (`STAMP_HEART` + `WAIT_BEAT [0.5]`) with Frame 2 (`STAMP_HEART` + `SET_LED_COLOR [Black]` + `LIGHT_ROW [3]` + `WAIT_BEAT [0.5]`) for a winking/shutter heart effect!
- `[Preview 3]` **Star & Smile Flipbook:** Alternates `CLEAR_LEDS → STAMP_STAR → DRUM_KICK → WAIT_BEAT [0.5]` with `CLEAR_LEDS → STAMP_SMILE → DRUM_CLAP → WAIT_BEAT [0.5]`.
