# Lesson `args.8` — Tape Arpeggiator

> [← Module `args` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

**Initial Sparse Tape (`1..4`):** `[1, 4, 5, 1]` — I–IV–V–I chord roots

## Starter

```
// MAIN (6 blocks)
TAPE_SEEK [1]
Loop ×4
  a = $cellValue
  Call F1(a)
  TAPE_STEP [RIGHT]
Loop End

// F1(●): Play root, third (●+2), fifth (●+4) & light matching rows (7 blocks)
LIGHT_ROW [●]
PLAY_NOTE [●, 0.5]
b = ● + 2
LIGHT_ROW [b]
PLAY_NOTE [b, 0.5]
b = ● + 4
PLAY_NOTE [b, 0.5]
```

## Variation Cards

- `[Preview 1]` **Rising Triad Cascade:** Plays `●`, `● + 2`, `● + 4` across 8 chord changes in cells `1..8`.
- `[Preview 2]` **Up-Down Harp Roll:** Plays `●`, `● + 2`, `● + 4`, `● + 2` with `SET_BEAT_DELAY [0]` column flashes.
- `[Preview 3]` **Kick-Anchored Synth Pad:** Adds `DRUM_KICK` on the root `●` of each chord bar.
