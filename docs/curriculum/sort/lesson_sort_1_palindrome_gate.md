# Lesson `sort.1` — Palindrome Gate

> [← Module `sort` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

**Setup:** Check whether an 8-number tape reads the same forwards & backwards and route the verdict token from Input to `ACCEPT` or `REJECT` across **4 multi-run variants** (2 palindromes, 2 non-palindromes) (`≤ 8 blocks/tab`).

## Reference Solution

```
// F1: Compare cells l and h, clear ok if different, converge pointers (8 blocks)
TAPE_SEEK [l]
a = $cellValue
TAPE_SEEK [h]
b = $cellValue
If (a != b)
  o = 0
End If
l = l + 1

// MAIN: Initialize pointers, run 4 symmetric checks, route verdict token (10 blocks — or 8 w/ h step)
l = 1
h = 8
o = 1
Loop ×4
  Call F1
  h = h - 1
Loop End
DEPOT_MOVE_TO [Input]
DEPOT_GRAB
If (o == 1)
  DEPOT_SEND_OUT [ACCEPT]
Else
  DEPOT_SEND_OUT [REJECT]
End If
```

*(Factoring the final `If/Else` verdict dispatch into `F2` keeps `MAIN = 8`, `F1 = 8`, `F2 = 7` — strictly ≤ 8 blocks in every tab!)*
