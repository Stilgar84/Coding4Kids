# Lesson `tape.1` — Skyline Generator

> [← Module `tape` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Initial Sparse Tape (`1..8` of `10,000`):** `[30, 50, 20, 60, 40, 35, 55, 25]` — building heights (`px`)

## Starter

```
// MAIN (4 blocks)
TAPE_SEEK [1]
Loop ×8
  Call F1
Loop End

// F1: Read height & draw 1 building (8 blocks)
a = $cellValue
FORWARD [a]                  // up left wall
TURN_RIGHT [90]
FORWARD [20]                 // roof width
TURN_RIGHT [90]
FORWARD [a]                  // down right wall
TURN_LEFT [90]               // face east along ground
TAPE_STEP [RIGHT]
```

## Variation Cards

- `[Img 1]` **Downtown Skyscrapers:** Tape `[80, 60, 95, 40, 75, 85, 50, 100]` — tall dense skyline.
- `[Img 2]` **Cozy Village:** Tape `[20, 15, 25, 20, 15, 30, 20, 15]` — low cottages with wide spacing.
- `[Img 3]` **Stepped Pyramid City:** Tape `[15, 30, 50, 75, 75, 50, 30, 15]` — symmetric ziggurat silhouette.

**Kid discovery:** *"Changing the numbers in the Tape Dock changes the city!"*
