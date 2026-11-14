# Lesson `anim.9` — Polygon Morphing (`3 → 12` Sides) & Tape Flipbook

> [← Module `anim` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Flipbook Config:** `totalFrames: 10`, `loop: true`, `clearBetweenFrames: true`.

Uses division (`a = 360 / n`) alongside `$frame` and Sparse Tape frame lookup so a triangle (`3` sides on Frame 1) smoothly gains one side per frame up to a 12-gon (`12` sides on Frame 10)!

## Starter (6 blocks in `MAIN`)

```
// MAIN (6 blocks — $frame 1..10 -> n = 3..12 sides!)
n = $frame + 2
TELEPORT [-25, -40, 90]
a = 360 / n
Loop [n]
  FORWARD [45]
  TURN_RIGHT [a]
Loop End
```

## Variation Cards

- `[Img 1]` **Tape Shape Flipbook (`(length, angle)` Pairs):** Sparse Tape holds `[75, 120, 75, 90, 60, 72, 50, 60]` (triangle, square, pentagon, hexagon); Frame `$frame` seeks to `($frame * 2) - 1`, reads `(l, a)`, and draws `Loop [360 / a]`—editing the Tape edits the flipbook!
- `[Img 2]` **Constant-Perimeter Morph:** Scales side length `l = 240 / n` so overall diameter stays constant from triangle (`80px`) to 12-gon (`20px`)!
- `[Img 3]` **Star Morph (`720 / n`):** Sweeps odd star polygons (`5, 7, 9, 11` points) using `a = 720 / n`.
