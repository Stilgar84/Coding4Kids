# Lesson `var.5a` — `TELEPORT` & Pose Sensors (`$x`, `$y`, `$heading`)

> [← Module `var` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

Placed after `var.5` (Growing & Shrinking Loops), where `VAR_ASSIGN` (`a = $x`) is already familiar.

## Runnable Demos

1. **"`TELEPORT` — Jump Without Drawing"** — Turtle draws a star at `(-75, 0, 0)`, then `TELEPORT [75, 0, 0]` shrinks/reappears at `(75, 0)` and draws a second star — spotlighting that no line connects them even though the pen stayed down!
2. **"Pose Sensors — Bookmarking Home"** — Saves the turtle's starting coordinates into Watch Boxes (`a = $x`, `b = $y`), wanders along an off-center spiral, and runs `TELEPORT [a, b, 0]` to jump straight back to its bookmarked home:
   ```
   TELEPORT [-60, -40, 0]
   a = $x                     // ← spotlight: -60 flies into Watch Box [a]
   b = $y                     // ← spotlight: -40 flies into Watch Box [b]
   Loop ×6
     FORWARD [50]
     TURN_RIGHT [75]
   Loop End
   TELEPORT [a, b, 0]         // ← spotlight: snaps right back to (-60, -40)!
   ```
