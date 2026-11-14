# Lesson `rec.10` — Koch L-System Depth Explorer (`$input`)

> [← Module `rec` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

Explores L-system rule rewriting (`F → F + F − F`) across depths `1..4` via the **`🎛️ $input` Scene Selector**, passing both depth and scaled segment length `F1(●, ▲)` so the curve fits the viewport at every generation!

## Starter

```
// MAIN (3 blocks — tapping 🎛️ $input 1..4 redraws immediately!)
d = $input - 1               // $input 1..4 -> depths 0..3
TELEPORT [-90, -30, 90]
Call F1(d, 180)

// F1(●, ▲): Recursive Koch rule F -> F +60° F -120° F +60° F (11 blocks)
If (● == 0)
  FORWARD [▲]
Else
  s = ▲ / 3                  // each Koch generation triples segment count -> 1/3 length!
  Call F1(● - 1, s)
  TURN_LEFT [60]
  Call F1(● - 1, s)
  TURN_RIGHT [120]
  Call F1(● - 1, s)
  TURN_LEFT [60]
  Call F1(● - 1, s)
End If
```

## Variation Cards

- `[Img 1]` **Quadratic Box Fractal (`90°` turns):** Square wave rule `F → F - F + F + F - F` (`s = ▲ / 3`).
- `[Img 2]` **Sierpinski Triangle Explorer (`1..5`):** Halves `s = ▲ / 2` at each recursive level, carving nested inner triangles.
- `[Img 3]` **Rainbow Depth Highlighting:** Sets pen color from sparse tape cell `● + 1` at each recursion depth!
