# Lesson `cmp.2` — Variable Laser-Drop Threshold (`c < k`) *(Redesigned)*

> [← `cmp.1a`](./lesson_cmp_1a_exact_dock_quota.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🤖 Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **Next:** [`cmp.3` →](./lesson_cmp_3_division_and_remainder_math.md)

---

## 1. One-Concept Goal

Read the target step threshold **`k = $tileDial`** at the start bay, carry **1 Energy Cell** forward while counter **`c < k`** inside `While`, drop it onto the charging pad at distance `k`, and continue to **`🏁`**.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `robot_grid` (`L × 1` open test hall) | Strictly 1-slot carry (`PICK_UP` -> `USE_DROP`); charging pad at `(k, 0)` unshutters `🏁` at `(L-1, 0)` |
| **Palette (`Control`)** | `WHILE` | `LOOP_START` disabled (`antiBypassRules`) |
| **Palette (`Actions`)** | `MOVE_FWD`, `PICK_UP`, `USE_DROP` | 1-cell transport; no `BackpackHud` |
| **Palette (`Vars & Sensors`)** | `VAR_ASSIGN`, `VAR_OP (+)`, `$tileDial`, `atGoal`, `<`, `==`, `0`, `1` | Strict 3-address `c = c + 1` |
| **Block Budget** | `slotCap: 13`, `par: 11`, `Starter: 6`, `Edit Delta: 5` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN`, `6` flat blocks — always drops at fixed step `1`, failing `k >= 2`)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "PICK_UP" },
      { "op": "MOVE_FWD" },
      { "op": "USE_DROP" },
      {
        "op": "WHILE",
        "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
        "body": [{ "op": "MOVE_FWD" }]
      }
    ]
  }
}
```

### Reference Solution (`MAIN`, `11` flat blocks — `Edit Delta: 5`)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "k", "value": "$tileDial" },
      { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
      { "op": "PICK_UP" },
      {
        "op": "WHILE",
        "cond": { "op": "CMP", "operator": "<", "left": "c", "right": "k" },
        "body": [
          { "op": "MOVE_FWD" },
          { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 }
        ]
      },
      { "op": "USE_DROP" },
      {
        "op": "WHILE",
        "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
        "body": [{ "op": "MOVE_FWD" }]
      }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Save the starting **`$tileDial`** as **`k`**, then count steps **`c`** forward while **`c < k`**. Drop the single energy cell right at **`(k, 0)`** to unshutter **`🏁`**!

---

## 4. Multi-Map Suite (`4` Variants) & Anti-Bypass Rules

| Map | Track Width `L` | Start `(0, 0)` (`cell` + `$tileDial`) | Pad Position `(k, 0)` | Goal `🏁` Position |
| :---: | :---: | :--- | :---: | :---: |
| **#1** | `6` (`0..5 × 0`) | `k = 3`, `1` Energy Cell | `(3, 0)` | `(5, 0)` |
| **#2** | `7` (`0..6 × 0`) | `k = 5`, `1` Energy Cell | `(5, 0)` | `(6, 0)` |
| **#3** | `5` (`0..4 × 0`) | `k = 2`, `1` Energy Cell | `(2, 0)` | `(4, 0)` |
| **#4** | `7` (`0..6 × 0`) | `k = 4`, `1` Energy Cell | `(4, 0)` | `(6, 0)` |

- **`antiBypassRules`:**
  1. **Zero Plank/Stack Inventory:** Redesign eliminates old multi-plank `stock` inventory; robot carries strictly `1` Energy Cell via shoulder gripper (`PICK_UP` at `(0,0)` -> `USE_DROP` at `(k,0)`).
  2. **No Hardcoded Moves & No `Loop [k]` Bypass:** Target pad `(k,0)` carries no `$tileDial` or stop wall, and `LOOP_START` is omitted from the palette so **`c < k`** with `WHILE` is mandatory across `k ∈ {3, 5, 2, 4}`.
  3. **Exact `c < k` vs `<= k`:** Using `c <= k` overshoots `(k, 0)` to `(k + 1, 0)` and leaves `🏁` shuttered.

---

## 5. Step-by-Step Execution Trace (Map #1, `k = 3`, `L = 6`)

| Step | Action / Condition | Pos | Carrying | `k` | `c` | Goal `🏁` |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| `1` | `k = $tileDial`, `c = 0`, `PICK_UP` | `(0, 0)` | `true` | `3` | `0` | Shuttered |
| `2` | `c < k` (`0 < 3`) -> `MOVE_FWD`, `c = 1` | `(1, 0)` | `true` | `3` | `1` | Shuttered |
| `3` | `c < k` (`1 < 3`) -> `MOVE_FWD`, `c = 2` | `(2, 0)` | `true` | `3` | `2` | Shuttered |
| `4` | `c < k` (`2 < 3`) -> `MOVE_FWD`, `c = 3` | `(3, 0)` | `true` | `3` | `3` | Shuttered |
| `5` | `c < k` (`3 < 3` false) -> `USE_DROP` | `(3, 0)` | `false` | `3` | `3` | Open |
| `6` | `WHILE (!atGoal)` -> `MOVE_FWD` × 2 | `(5, 0)` | `false` | `3` | `3` | **Reached!** |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Redesign `cmp.2`?** Robot Grid enforces strict 1-slot carrying; replacing multi-plank stock refills with 1-cell variable-threshold delivery teaches **`c < k`** cleanly using only real Robot Grid sensors (`$tileDial`, `atGoal`) and atomic 3-address `c = c + 1`.

</details>
