# Lesson `param.5a` — Speed Control & `SET_BEAT_DELAY`

> [← Module `param` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

Placed immediately after `param.5` (Pitch, Duration & Colored LED Rows). Uses **action parameters only — zero loops and zero variables**.

## Runnable Demos

1. **"Slow vs. Instant LEDs"** — Side-by-side comparison of lighting 3 colored LED rows:
   - *Tab 1a (Default `SET_BEAT_DELAY [1]`):* Rows light up one after another visibly.
   - *Tab 1b (`SET_BEAT_DELAY [0]`):* All 3 rows flash onto the 8×8 pad simultaneously, held by `WAIT_BEAT [1]`:
     ```
     SET_BEAT_DELAY [0]       // ← spotlight: instant batching!
     SET_LED_COLOR [Red]
     LIGHT_ROW [2]
     SET_LED_COLOR [Yellow]
     LIGHT_ROW [4]
     SET_LED_COLOR [Blue]
     LIGHT_ROW [6]
     WAIT_BEAT [1]            // ← spotlight: hold to admire the frame!
     ```

2. **"Building & Carving a Frame"** — Shows assembling two frames sequentially (`CLEAR_LEDS` before frame 2) and using `Black` to carve selective dark cutouts inside a stamp:
   ```
   SET_BEAT_DELAY [0]
   STAMP_HEART                // Frame 1: full pink heart
   WAIT_BEAT [1]
   CLEAR_LEDS                 // ← spotlight: clear at start of Frame 2!
   STAMP_HEART
   SET_LED_COLOR [Black]      // ← spotlight: Black turns off selected LEDs!
   LIGHT_ROW [4]              // carves a dark stripe across the heart
   WAIT_BEAT [1]
   ```
