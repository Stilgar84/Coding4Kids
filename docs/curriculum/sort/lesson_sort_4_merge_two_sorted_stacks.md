# Lesson `sort.4` — Merge Two Sorted Stacks

> [← Module `sort` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** Stack 1 (`[2, 5, 8]`, `2` on top) and Stack 2 (`[3, 6, 9]`, `3` on top) hold pre-sorted ascending rings/blocks. `F1` merges the smaller top into Output in one linear pass using parameterized `stationEmpty [Stack 1]` / `[Stack 2]`, visibly beating repeated selection passes on the **`⏱️` Wall-Clock Tick Speedometer**.

## Reference Solution (`≤ 8 blocks/tab`)

```
// MAIN (5 blocks)
While (NOT stationEmpty [Stack 1] OR NOT stationEmpty [Stack 2])
  If (stationEmpty [Stack 1])
    Call F2                  // take from Stack 2
  Else
    Call F1                  // compare or take from Stack 1
  End If
End While

// F1 (8 blocks): Stack 1 is non-empty; check if Stack 2 is empty or >= Stack 1
If (stationEmpty [Stack 2])
  DEPOT_MOVE_TO [Stack 1]
  DEPOT_GRAB
  DEPOT_SEND_OUT
Else
  Call F3                    // both non-empty: compare tops
End If

// F2 (3 blocks): Send top of Stack 2
DEPOT_MOVE_TO [Stack 2]
DEPOT_GRAB
DEPOT_SEND_OUT

// F3 (8 blocks): Compare Stack 1 top vs Stack 2 top
DEPOT_MOVE_TO [Stack 1]
a = $topValue
DEPOT_MOVE_TO [Stack 2]
If (a <= $topValue)
  DEPOT_MOVE_TO [Stack 1]
End If
DEPOT_GRAB
DEPOT_SEND_OUT
```

Every single tab is `≤ 8 blocks` (`MAIN: 6`, `F1: 7`, `F2: 3`, `F3: 8`).
