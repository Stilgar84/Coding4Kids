# Lesson `tape.2` — Rainbow Burst

> [← Module `tape` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Initial Sparse Tape (`1..8`):** `[🔴 Red, 🟠 Orange, 🟡 Yellow, 🟢 Green, 🩵 Cyan, 🔵 Blue, 🟣 Purple, 🩷 Pink]`

## Starter

```
// MAIN (8 blocks)
TAPE_SEEK [1]
Loop ×8
  a = $cellColor             // color variable!
  SET_PEN_COLOR [a]
  FORWARD [75]
  BACKWARD [75]
  TURN_RIGHT [45]
  TAPE_STEP [RIGHT]
Loop End
```

## Variation Cards

- `[Img 1]` **Traffic Light Burst:** Tape `[🔴, 🟡, 🟢, 🔴, 🟡, 🟢, 🔴, 🟡]`.
- `[Img 2]` **Selective `White` Spoke Eraser:** Draws a solid colored asterisk, then runs a second pass where `⚪ White` cells in the tape selectively **erase** every alternate spoke back to the canvas background!
- `[Img 3]` **Ocean Pinwheel:** Tape `[🩵, 🔵, 🟢, 🩵, 🔵, 🟣, 🩵, 🔵]` with `ARC_RIGHT [50, 90]` curved rays.
