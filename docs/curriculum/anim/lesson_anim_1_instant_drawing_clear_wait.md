# Lesson `anim.1` — Hardware Display Buffers (`SET_BEAT_DELAY [0]`, `CLEAR_LEDS` & `WAIT_BEAT`)

> [← Module `anim` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

Contrasts LOGO's automatic Flipbook Mode (`anim.0`) with **Beat & Light's explicit hardware display-buffer loop** (`SET_BEAT_DELAY [0]` + `CLEAR_LEDS` + `WAIT_BEAT`).

## Runnable Demos

1. **"Paced Pixels vs. Instant Frame Batching (`SET_BEAT_DELAY [0]`)"** — Compares lighting 4 LED rows one at a time (`SET_BEAT_DELAY [200]`) vs. `SET_BEAT_DELAY [0]` (all 4 rows light up simultaneously in `0ms` as one crisp frame).
2. **"`CLEAR_LEDS` First + `WAIT_BEAT` — Two-Frame Icon Flip"** — Clears at the **start** of each frame pass (`CLEAR_LEDS`), lights Frame 1 (`STAMP_HEART`), holds with `WAIT_BEAT [1]`, clears at the start of Frame 2, and lights `STAMP_STAR` (spotlighting why placing `CLEAR_LEDS` at the top leaves the final frame visible!).
