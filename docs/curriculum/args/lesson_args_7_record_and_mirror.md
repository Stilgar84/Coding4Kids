# Lesson `args.7` — Record & Mirror (Serialization)

> [← Module `args` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Concept:** Phase 1 draws a path while **recording** every segment length onto the sparse tape (`TAPE_WRITE`); Phase 2 steps backwards down the tape to draw a symmetric mirror!

## Starter

```
// F1(●): Move forward ● and record ● onto tape (4 blocks)
FORWARD [●]
TAPE_WRITE [●]
TAPE_STEP [RIGHT]
TURN_RIGHT [45]

// MAIN (8 blocks): Record 4 moves, then replay mirrored!
TAPE_SEEK [1]
Call F1(60)
Call F1(40)
Call F1(75)
Call F1(30)
Call F2                      // F2 steps tape left ×4, reading $cellValue & turning LEFT 45°!
```

## Variation Cards

- `[Img 1]` **Butterfly Wing Mirror:** Records a 6-segment curved wing, then replays mirrored across the Y-axis.
- `[Img 2]` **Twin Mountain Reflection:** Draws skyline above `y = 0`, replays inverted below `y = 0` like a lake reflection.
- `[Img 3]` **Self-Erasing Ghost Trail (`White` Replay):** Records an intricate path in `Blue`, pauses (`WAIT [1]`), then switches to `SET_PEN_COLOR [White]` and replays the tape backwards to erase its own trail segment by segment!
