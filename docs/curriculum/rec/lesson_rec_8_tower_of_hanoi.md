# Lesson `rec.8` — Tower of Hanoi (3 Discs)

> [← Module `rec` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** Stacks `1, 2, 3` enforce disc size-ordering on `DEPOT_PLACE` and hold 3 sized discs on Stack `1`. Move all 3 to Stack `3` using `F1(● = count, ▲ = fromPeg, ■ = toPeg)` and helper `F2(▲, ■)`. Since peg numbers sum to `1 + 2 + 3 = 6`, the spare peg is `6 - ▲ - ■` (recomputed before the second recursive call since `p` is a global variable while sockets `●, ▲, ■` are stack-local).

## Reference Solution

```
// MAIN (1 block)
Call F1(3, 1, 3)

// F2(▲, ■): Move 1 disc from peg ▲ to peg ■ (4 blocks)
DEPOT_MOVE_TO [▲]
DEPOT_GRAB
DEPOT_MOVE_TO [■]
DEPOT_PLACE

// F1(●, ▲, ■): Recursive 3-peg solver (9 blocks)
If (● > 0)
  p = 6 - ▲
  p = p - ■                  // spare peg in {1, 2, 3}
  Call F1(● - 1, ▲, p)
  Call F2(▲, ■)
  p = 6 - ▲
  p = p - ■                  // recompute spare peg after recursive call returns
  Call F1(● - 1, p, ■)
End If
```
