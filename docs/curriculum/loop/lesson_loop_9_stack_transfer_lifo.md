# Lesson `loop.9` — Stack Transfer — LIFO Discovery

> [← Module `loop` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** Move 4 ordered rings/blocks `[🟨, 🟩, 🟦, 🟥]` (bottom-to-top) from Stack 1 to Stack 2 in `6 blocks`—visually discovering that stack transfer reverses order (**"Wait — they flipped!"**).

## Reference Solution (`6 blocks`)

```
// MAIN (6 blocks)
Loop ×4
  DEPOT_MOVE_TO [Stack 1]
  DEPOT_GRAB
  DEPOT_MOVE_TO [Stack 2]
  DEPOT_PLACE
Loop End
```

Stack 2 ends up `[🟥, 🟦, 🟩, 🟨]` — the child visually discovers **LIFO reversal** in 6 blocks.
