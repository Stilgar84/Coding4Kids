# Lesson `tape.3` — Color Drum Sequencer

> [← Module `tape` Overview](./overview.md) · **Format:** 🎵 Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

**Initial Sparse Tape (`1..8`):** `[🔴 Red, ⚫ Black, 🟠 Orange, ⚫ Black, 🔴 Red, 🟣 Purple, 🟠 Orange, ⚫ Black]`

*(Uses color equality `==` — and colors match the actual drum block palette: Rose/Red Kick, Orange Snare, Purple/Fuchsia Clap, Black Rest!)*

## Starter

```
// MAIN (6 blocks)
Loop ×4
  TAPE_SEEK [1]
  Loop ×8
    Call F1
  Loop End
Loop End

// F1: Trigger drum matching tape swatch, hold 0.5 beat, advance (8 blocks — split Kick/Snare + Clap in F2)
If ($cellColor == Red)
  DRUM_KICK
End If
If ($cellColor == Orange)
  DRUM_SNARE
End If
Call F2                      // F2 checks Purple -> DRUM_CLAP, lights step pixel, WAIT_BEAT [0.5], TAPE_STEP [RIGHT]
```

## Variation Cards

- `[Preview 1]` **Four-on-the-Floor:** `[🔴, ⚫, 🟠, ⚫, 🔴, ⚫, 🟠, ⚫]` — classic dance pulse.
- `[Preview 2]` **Syncopated Breakbeat:** `[🔴, ⚫, ⚫, 🔴, 🟠, ⚫, 🟣, ⚫]` — off-beat kick groove.
- `[Preview 3]` **16-Step Festival Fill:** Uses cells `1..16` on the sparse tape with a rapid snare/clap turnaround in cells `13..16`.
