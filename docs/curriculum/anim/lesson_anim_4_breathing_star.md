# Lesson `anim.4` — Breathing Star (Stateful Flipbook Variables)

> [← Module `anim` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Flipbook Config:** `totalFrames: 12`, `loop: true`, `clearBetweenFrames: true`.

Demonstrates **persistent variables across Flipbook frames**: while turtle pose resets to `(0, 0, 0°)` and the canvas clears each frame, `s` and `d` persist across frames so a 5-pointed star smoothly expands (`frames 1..6`) and contracts (`frames 7..12`)!

## Starter

```
// MAIN (8 blocks)
If ($frame == 1)
  s = 25
Else
  If ($frame <= 6)
    s = s + 15
  Else
    s = s - 15
  End If
End If
Call F1

// F1: Draw 5-pointed star of side s (4 blocks)
Loop ×5
  FORWARD [s]
  TURN_RIGHT [144]
Loop End
```

## Variation Cards

- `[Img 1]` **Breathing Hexagon:** `F1` uses `Loop ×6 { FORWARD [s], TURN_RIGHT [60] }`.
- `[Img 2]` **Heartbeat Pulse (Asymmetric Expansion):** Rapid 3-frame expansion (`+30`) followed by gentle 9-frame relaxation (`-10`) in thick `Red` ink (`SET_PEN_WIDTH [8]`).
- `[Img 3]` **Expanding Sunburst Rays:** `F1` draws 8 radiating spokes (`FORWARD [s]`, `BACKWARD [s]`, `TURN_RIGHT [45]`).
