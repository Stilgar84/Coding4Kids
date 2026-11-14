# Lesson `anim.2` — Spinning Windmill (`$frame` Flipbook)

> [← Module `anim` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Flipbook Config:** `totalFrames: 6`, `loop: true`, `clearBetweenFrames: true`.

Because Flipbook Mode resets turtle pose to `(0, 0, 0°)` before each frame `1..6` and exposes `$frame`, rotating a 4-blade symmetric windmill (`6 × 15° = 90°`) requires **zero** outer frame loop or clear boilerplate—`MAIN` simply turns `($frame - 1) * 15` (or `$frame * 15`) and draws 1 windmill!

## Starter (6 blocks in `MAIN` + `F1`)

```
// MAIN (3 blocks — Flipbook runs MAIN for $frame = 1..6!)
a = $frame * 15
TURN_RIGHT [a]
Loop ×4
  Call F1                    // draw 1 blade & turn 90°
Loop End
```

## Variation Cards

- `[Img 1]` **8-Blade Rainbow Pinwheel (`totalFrames: 6`):** Rotates `7.5°` per frame across 8 colored blades.
- `[Img 2]` **Counter-Spinning Twin Gears:** Draws a clockwise windmill on the left and a counter-clockwise (`TURN_LEFT [a]`) windmill on the right!
- `[Img 3]` **Propeller Speed-Up:** Accelerates rotation using quadratic angle steps.
