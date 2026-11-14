# Lesson `while.3` — Binary Queue Color Sort

> [← Module `while` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** Conveyor Queue holds randomized 🔴 and 🔵 rings/blocks across 4 multi-run streams. Drain them from the Queue onto Stack 1 and Stack 2 (`9 blocks`, multi-run validated).

## Reference Solution (`9 blocks`)

```
// MAIN (9 blocks)
While (NOT stationEmpty [Queue])
  DEPOT_MOVE_TO [Queue]
  DEPOT_GRAB
  If ($heldColor == Red)
    DEPOT_MOVE_TO [Stack 1]
  Else
    DEPOT_MOVE_TO [Stack 2]
  End If
  DEPOT_PLACE
End While
```
