# Lesson `anim.10` — Orbiting Moons (Polar Flipbook & Bouncing Physics)

> [← Module `anim` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Flipbook Config:** `totalFrames: 24`, `loop: true`, `clearBetweenFrames: true`.

Teaches polar-to-Cartesian multi-object scene animation in Flipbook Mode using `$frame`, turtle heading, and `$x`/`$y` pose sensors (plus bouncing velocity variations).

## Starter

A bright yellow sun stays anchored at `(0, 0)` while a blue moon orbits smoothly around it across 24 frames (`$frame * 15° = 360°`):

```
// MAIN (3 blocks)
a = $frame * 15
Call F1                      // draw sun at (0, 0)
Call F2                      // position & draw moon at orbit angle a

// F1: Draw 8-ray Sun at origin (7 blocks)
TELEPORT [0, 0, 0]
SET_PEN_COLOR [Yellow]
Loop ×8
  FORWARD [18]
  BACKWARD [18]
  TURN_RIGHT [45]
Loop End

// F2: Polar jump to radius 90 at angle a, read $x/$y, draw Moon (8 blocks)
TELEPORT [0, 0, a]
PEN_UP
FORWARD [90]
x = $x
y = $y
Call F3                      // F3 puts PEN_DOWN, sets Blue, draws 6-step mini-circle at (x, y)
```

## Variation Cards

- `[Img 1]` **Twin Binary Moons:** Draws Moon 1 at angle `a` and Moon 2 opposite at `b = a + 180`.
- `[Img 2]` **Bouncing Comet Box (`x = x + vx`):** Persistent `(x, y, vx, vy)` flips `vx = 0 - vx` when `x > 110` or `x < -110`!
- `[Img 3]` **Spirograph Epicycle Trace (`clearBetweenFrames: false`):** Toggles `🧹 Clear Between Frames` `OFF` so the orbiting moon leaves a geometric flower trail!
