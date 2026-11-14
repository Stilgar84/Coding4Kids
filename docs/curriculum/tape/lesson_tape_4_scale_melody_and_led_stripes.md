# Lesson `tape.4` — Scale Melody & LED Stripes

> [← Module `tape` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

**Initial Sparse Tape (`1..8`):** `[1, 2, 3, 1, 1, 2, 3, 1]` — *Frère Jacques* in Beat scale degrees (`1..8`)

## Starter

```
// MAIN (7 blocks)
TAPE_SEEK [1]
Loop ×8
  a = $cellValue
  LIGHT_COL [a]              // lights column matching pitch 1..8!
  PLAY_NOTE [a, 0.5]
  TAPE_STEP [RIGHT]
Loop End
```

## Variation Cards

- `[Preview 1]` **Twinkle Twinkle (14 notes in cells `1..14`):** `[1, 1, 5, 5, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1]` — demonstrates scrolling past cell 8 on the sparse tape!
- `[Preview 2]` **Ode to Joy (`1..16`):** `[3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3, 3, 2, 2, 1]`.
- `[Preview 3]` **Selective `Black` LED Mask:** Lights a full colored rainbow, then reads row indices from tape with `SET_LED_COLOR [Black]` + `LIGHT_ROW [a]` to carve rhythmic dark Venetian-blind stripes.
