# Challenge `sort.M2` — Substring Pattern Scanner (with Backtracking)

> [← Module `sort` Overview](./overview.md) · **Format:** 🔥 Mastery Challenge (`sort`) · **Environment:** [🏗️ Depot](../../envs/depot.md) / [📼 Sparse Memory Tape](../../platform_requirements.md#12-shared-sparse-memory-tape-subsystem-with-per-worker-heads-in-conc)

**Setup:** 12-cell color tape. Find the first index `p` where the 3-color target sequence `🔴, 🔵, 🟢` appears consecutively using bounds-safe (`p <= $tapeLength - 2`) backtracking seeks (without ever stepping past cell `12`!).

## Reference Solution

```
// MAIN (8 blocks)
p = 1
f = 0
e = $tapeLength - 2          // last valid 3-cell start position (10)
While (f == 0 AND p <= e)
  TAPE_SEEK [p]
  Call F1
  p = p + 1
End While
// Seek back to winning start index (p - 1) via helper or stop inside F1

// F1 (10 blocks): Check 3 consecutive cells starting at p
m = 0
If ($cellColor == Red)
  m = m + 1
End If
TAPE_STEP [RIGHT]
If ($cellColor == Blue)
  m = m + 1
End If
TAPE_STEP [RIGHT]
If ($cellColor == Green)
  m = m + 1
End If
```

Because `p <= $tapeLength - 2`, `TAPE_STEP [RIGHT]` twice from `p = 10` reaches at most cell `12`, **never** triggering an out-of-bounds error, while cleanly teaching backtracking (`TAPE_SEEK [p]` rewinds after partial matches).
