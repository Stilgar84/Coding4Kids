# Lesson `anim.5` — Spiral Trail (`🧹 Clear Between Frames: OFF` & `White` Eraser)

> [← Module `anim` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Flipbook Config:** `totalFrames: 14`, `loop: true`, **`clearBetweenFrames: false`** (`🧹 Clear Between Frames` toggled `OFF`!).

Shows when **disabling inter-frame clearing** is the star of the show: each Flipbook frame adds one new outward segment while keeping previous strokes on canvas (bookmarking turtle pose `(x, y, h)` across frames via `$x`, `$y`, `$heading`)!

## Starter

```
// MAIN (9 blocks — clearBetweenFrames: false accumulates segments!)
If ($frame == 1)
  s = 15
Else
  TELEPORT [x, y, h]
End If
FORWARD [s]
TURN_RIGHT [90]
x = $x
y = $y
h = $heading
s = s + 10
```

## Variation Cards

- `[Img 1]` **Skewed `92°` Vortex:** `TURN_RIGHT [92]` creates a twisting optical tunnel across 24 trail frames.
- `[Img 2]` **Growing Nautilus Shell:** Uses `ARC_RIGHT [s, 90]` with growing radius `s`.
- `[Img 3]` **Draw-Then-Unwind (`White` Eraser, `28` frames):** Frames `1..14` draw outward in `Blue`; Frames `15..28` retrace inward with `SET_PEN_COLOR [White]`, selectively erasing every stroke back to a clean canvas!
