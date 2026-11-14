# Lesson `args.6` — Multi-Shape Stamp Row

> [← Module `args` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Initial Sparse Tape (`1..6`):** `[3, 4, 5, 6, 8, 10]` — polygon side counts

## Starter

```
// MAIN (8 blocks)
TELEPORT [-140, 0, 0]
TAPE_SEEK [1]
Loop ×6
  a = $cellValue
  Call F1(a)
  TAPE_STEP [RIGHT]
Loop End

// F1(●): Draw regular ●-gon and advance right (8 blocks)
b = 360 / ●
Loop [●]
  FORWARD [25]
  TURN_RIGHT [b]
Loop End
PEN_UP
TELEPORT [$x + 0, 0, 90]     // or TURN_RIGHT [90], FORWARD [55], TURN_LEFT [90], PEN_DOWN via F2
```

*(Clean `F2` step-right helper (`5 blocks`): `PEN_UP, TURN_RIGHT [90], FORWARD [55], TURN_LEFT [90], PEN_DOWN`; `F1(●)` is `7 blocks`.)*

## Variation Cards

- `[Img 1]` **Polygon Parade (`3 → 10` sides):** Shows shapes getting rounder from triangle to decagon.
- `[Img 2]` **Concentric Nest:** Draws all tape polygons centered at `(0, 0)` without stepping sideways.
- `[Img 3]` **Totem Stack:** Stacks shapes vertically (`y` stepping upward) with alternating tape colors.
