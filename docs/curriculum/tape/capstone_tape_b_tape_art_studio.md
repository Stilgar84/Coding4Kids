# Capstone `tape.B` — Tape Art Studio

> [← Module `tape` Overview](./overview.md) · **Format:** 🎨 Capstone Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Initial Sparse Tape (`1..8`):** `[80, 60, 80, 120, 80, 60, 80, 120]` — alternating `(length, angle)` recipe pairs (draws a diamond/rhombus)

## Starter

```
// MAIN (8 blocks)
TAPE_SEEK [1]
Loop ×4
  a = $cellValue             // segment length
  TAPE_STEP [RIGHT]
  b = $cellValue             // exterior turn angle
  TAPE_STEP [RIGHT]
  FORWARD [a]
  TURN_RIGHT [b]
Loop End
```

## Variation Cards

- `[Img 1]` **Mountain Range:** Tape `[40, 60, 80, 90, 85, 70, 55, 30]` — `F1` draws `60°`/`120°` peaks of height `$cellValue` in `Green` ink.
- `[Img 2]` **Barcode Ribbon (with `White` Gap Erasers):** Tape alternates bar widths and `Black` / `White` colors across 16 sparse tape cells.
- `[Img 3]` **Lightning Zigzag:** Tape `[50, 60, 50, 300, 50, 60, 50, 300]` — sharp sawtooth bolt.

**Kid discovery:** *"The tape is a shape recipe — pairs of cells control length and angle!"*
