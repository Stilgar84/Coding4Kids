# Lesson `rec.9` — Fractal Tree Depth Explorer (`$input`)

> [← Module `rec` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

Placed in **`rec`** where branching recursion (`Call F1(● - 1)`) is taught. Uses the **`🎛️ $input` Scene Selector (`1..5`)** from `branch` so tapping any depth `1 → 5` redraws the canopy instantly without frame-loop boilerplate *(and optionally plays as a 5-frame animation if Flipbook Mode from [`anim`](../anim/overview.md) is enabled)*.

## Starter

Watch a single sprout blossom into a 32-branch canopy across recursion depths `1 .. 5`:

```
// MAIN (2 blocks — tapping 🎛️ $input 1..5 redraws immediately!)
TELEPORT [0, -110, 0]
Call F1($input)

// F1(●): Recursive binary tree branch (10 blocks)
If (● == 0)
  FORWARD [10]
  BACKWARD [10]
Else
  FORWARD [35]
  TURN_LEFT [30]
  Call F1(● - 1)             // private socket - 1 preserves caller state!
  TURN_RIGHT [60]
  Call F1(● - 1)
  TURN_LEFT [30]
  BACKWARD [35]
End If
```

## Variation Cards

- `[Img 1]` **Green Leaf Tips:** Base case `● == 0` switches `SET_PEN_COLOR [Green]` for leaves and restores `Black` bark on unwind!
- `[Img 2]` **Wind-Swept Bonsai:** Asymmetric angles (`TURN_LEFT [20]`, `TURN_RIGHT [65]`, restore `TURN_LEFT [45]`).
- `[Img 3]` **Snowflake Crystal Explorer (`1..4`):** Calls `F1($input)` 3 times around a `120°` triangle to morph an equilateral triangle into a full Koch Snowflake!
