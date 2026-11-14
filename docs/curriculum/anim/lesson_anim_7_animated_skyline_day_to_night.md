# Lesson `anim.7` — Animated Skyline — Day to Night (Tape + Flipbook)

> [← Module `anim` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Flipbook Config:** `totalFrames: 2` (`4`+ in variations), `loop: true`, `clearBetweenFrames: true`.

**Initial Sparse Tape (`1..10`):**
- Cells `1..2`: Theme colors `[🔵 Blue, 🟡 Yellow]` (Day blueprint vs. Night lit towers)
- Cells `3..10`: 8 building heights `[30, 55, 25, 70, 45, 35, 60, 30]`

## Starter

```
// MAIN (7 blocks — $frame = 1 selects Day cell 1; $frame = 2 selects Night cell 2!)
TAPE_SEEK [$frame]
c = $cellColor
SET_PEN_COLOR [c]
TELEPORT [-140, -40, 0]
TAPE_SEEK [3]
Loop ×8
  Call F1                    // draw 1 building of height $cellValue & step tape
Loop End

// F1 (8 blocks)
a = $cellValue
FORWARD [a]
TURN_RIGHT [90]
FORWARD [30]
TURN_RIGHT [90]
FORWARD [a]
TURN_LEFT [90]
TAPE_STEP [RIGHT]
```

## Variation Cards

- `[Img 1]` **4-Phase Dawn → Noon → Sunset → Midnight (`totalFrames: 4`):** Cells `1..4` hold `[🩷 Pink, 🩵 Cyan, 🟠 Orange, 🟣 Purple]`.
- `[Img 2]` **Rising Construction Time-Lapse (`totalFrames: 8`):** Frame `$frame` draws `Loop [$frame]` buildings appearing left to right!
- `[Img 3]` **Equalizer Towers:** Building heights pulse taller and shorter across frames using `$frame % 2`.
