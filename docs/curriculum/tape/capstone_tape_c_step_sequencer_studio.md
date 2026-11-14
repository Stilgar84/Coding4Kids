# Capstone `tape.C` — Step Sequencer Studio

> [← Module `tape` Overview](./overview.md) · **Format:** 🎨 Capstone Sandbox · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md)

**Initial Sparse Tape (`1..16`):**
- Cells `1..8`: LED row colors `[🩵, 🩷, 🟡, 🟢, 🔵, 🟣, 🟠, ⚫]` (`Black` = off pixel!)
- Cells `9..16`: Bass/lead scale pitches `[1, 5, 3, 5, 2, 6, 4, 5]`

## Starter

```
// MAIN (7 blocks)
SET_BEAT_DELAY [0]
x = 1
Loop ×8
  Call F1                    // draw pixel from color region (x) & play note from pitch region (x + 8)
  x = x + 1
Loop End

// F1 (8 blocks)
TAPE_SEEK [x]
c = $cellColor
SET_LED_COLOR [c]
LIGHT_PIXEL [x, 4]
n = x + 8
TAPE_SEEK [n]
p = $cellValue
PLAY_NOTE [p, 0.5]
```

## Variation Cards

- `[Preview 1]` **Chiptune Arpeggio + Color Bar:** Sweeps full `LIGHT_COL [x]` in color `c` with fast `0.5`-beat synth notes.
- `[Preview 2]` **Custom Tape Sprite Stamp (`1..64` via `STAMP_FROM_TAPE` `📼→🟦`):** Stores a custom 8×8 pixel-art icon in sparse cells `1..64` (empty `∅` cells stay transparent; `Black` clears pixels) and stamps it onto the LED pad in 1 tick alongside synth beats!
- `[Preview 3]` **Dual-Track Drum + Bass:** Cells `1..8` drive drum colors while cells `9..16` drive bassline pitches.
