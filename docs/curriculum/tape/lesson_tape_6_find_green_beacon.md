# Lesson `tape.6` — Find the Green Beacon

> [← Module `tape` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** 8-cell Depot tape has one 🟢 cell (guaranteed present at randomized index `1..8` across 4 variants). Linear-search the 4 randomized 8-cell tapes to stop `headPos` on 🟢 (`4 blocks`).

## Reference Solution (`4 blocks`)

```
// MAIN (4 blocks)
TAPE_SEEK [1]
While (NOT $cellColor == Green)
  TAPE_STEP [RIGHT]
End While
```
