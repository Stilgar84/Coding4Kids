# Lesson `func.6` — Double Stack Reversal = Original Order

> [← Module `func` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** Stack 1 holds 4 ordered crates `[🟨, 🟩, 🟦, 🟥]` (`🟥` on top). Move them onto Stack 3 in their **exact original** bottom-to-top order (`[🟨, 🟩, 🟦, 🟥]`) by reversing twice (`Stack 1 → Stack 2` flips, then `Stack 2 → Stack 3` restores the original order) while keeping every tab `≤ 8 blocks`.

## Reference Solution (`6` in `F1`, `7` in `MAIN`)

```
// F1: Reverse Stack 1 onto Stack 2 (6 blocks)
Loop ×4
  DEPOT_MOVE_TO [Stack 1]
  DEPOT_GRAB
  DEPOT_MOVE_TO [Stack 2]
  DEPOT_PLACE
Loop End

// MAIN: Run F1, then reverse Stack 2 onto Stack 3 (7 blocks)
Call F1
Loop ×4
  DEPOT_MOVE_TO [Stack 2]
  DEPOT_GRAB
  DEPOT_MOVE_TO [Stack 3]
  DEPOT_PLACE
Loop End
```
