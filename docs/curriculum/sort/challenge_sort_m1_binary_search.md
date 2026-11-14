# Challenge `sort.M1` — Binary Search (Halving Hunt)

> [← Module `sort` Overview](./overview.md) · **Format:** 🔥 Mastery Challenge (`sort`) · **Environment:** [🏗️ Depot](../../envs/depot.md) / [📼 Sparse Memory Tape](../../platform_requirements.md#12-shared-sparse-memory-tape-subsystem-with-per-worker-heads-in-conc)

**Setup:** Pre-sorted 16-cell (or sparse 64-cell) tape. Target value is stored in cell `1` of Input (`t = $topValue`), sorted array in cells `1..16`. Stop `headPos` on the matching cell in `≤ 5` seeks using converging `[l, h]` bounds and integer-truncated `TAPE_SEEK [(l + h) / 2]`—watching the **`⏱️` Tick Speedometer** crush linear scan!

## Reference Solution

```
// MAIN (6 blocks)
DEPOT_MOVE_TO [Input]
t = $topValue
l = 1
h = $tapeLength
While (l <= h)
  Call F1
End While

// F1 (10 blocks — Mastery allows ≤ 10 blocks/tab)
m = l + h
m = m / 2                    // e.g. (1 + 16) / 2 = 8.5 -> TAPE_SEEK truncates to 8!
TAPE_SEEK [m]
If ($cellValue == t)
  l = h + 1                  // found! exit loop with headPos at m
Else
  If ($cellValue < t)
    l = $headPos + 1
  Else
    h = $headPos - 1
  End If
End If
```

*(Note: Using `$headPos` after `TAPE_SEEK [m]` gives the exact truncated integer midpoint `8` so `l` and `h` remain clean integers `[9..16]` or `[1..7]`!)*
