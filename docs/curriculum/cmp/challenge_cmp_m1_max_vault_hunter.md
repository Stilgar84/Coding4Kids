# Challenge `cmp.M1` — The Max-Vault Hunter *(Option A)*

> [← `cmp.C`](./capstone_cmp_c_parametric_spirograph_galaxy.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🔥 Mastery Challenge · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **Next:** [`cmp.M2` →](./challenge_cmp_m2_balanced_twin_scale.md)

---

## 1. One-Concept Goal

Start from an **empty `0`-block workspace**, walk a variable-length dial corridor to discover the maximum value **`m`** (`IF (d > m)`), shuttle **`m`** single Energy Cells (`LOOP [m] { CALL F1 }`) from the Supply Stack to the Master Charge Pad, and exit through the unshuttered **`🏁`**.

---

## 2. Mastery Challenge Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `robot_grid` (`0..D × 0..3`) | Start `(0, 1)` East; dials on `(1, 1)..(D, 1)` with East wall; Supply `(D, 0)` (`stackCountOverrides: 10`); Charge Pad `(D, 2)` (exact target `m`); `🏁` at `(D, 3)` |
| **Starter Code** | **`0` blocks** (`MAIN: []`, `F1: []`) | Mastery Blank-Canvas Rule |
| **Palette (`Control & Fns`)** | `LOOP_START`, `WHILE`, `IF`, `CALL_FN (F1)` | Both `MAIN` and `F1` start blank (`<= 20/tab`, `<= 50` total) |
| **Palette (`Actions`)** | `MOVE_FWD`, `TURN_LEFT`, `TURN_RIGHT`, `PICK_UP`, `USE_DROP` | Strictly 1-slot carry (`F1` shuttles `1` cell at a time) |
| **Palette (`Vars & Sensors`)** | `VAR_ASSIGN`, `pathAhead`, `atGoal`, `$tileDial`, `>`, `0` | — |
| **Block Budget** | `slotCap: 20/tab, 50 total`, `par: MAIN 17, F1 10 (27 total)`, `Starter: 0` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`0` blocks — blank workspace)

```json
{
  "scopes": {
    "MAIN": [],
    "F1": []
  }
}
```

### Reference Solution (`MAIN: 17`, `F1: 10`, `27` total)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "m", "value": 0 },
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "pathAhead" },
        "body": [
          { "op": "MOVE_FWD" },
          { "op": "VAR_ASSIGN", "var": "d", "value": "$tileDial" },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": ">", "left": "d", "right": "m" },
            "then": [{ "op": "VAR_ASSIGN", "var": "m", "value": "d" }]
          }
        ]
      },
      { "op": "TURN_LEFT" },
      {
        "op": "LOOP_START",
        "count": "m",
        "body": [{ "op": "CALL_FN", "fn": "F1" }]
      },
      { "op": "TURN_RIGHT" },
      { "op": "TURN_RIGHT" },
      {
        "op": "WHILE",
        "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
        "body": [{ "op": "MOVE_FWD" }]
      }
    ],
    "F1": [
      { "op": "MOVE_FWD" },
      { "op": "PICK_UP" },
      { "op": "TURN_RIGHT" },
      { "op": "TURN_RIGHT" },
      { "op": "MOVE_FWD" },
      { "op": "MOVE_FWD" },
      { "op": "USE_DROP" },
      { "op": "TURN_RIGHT" },
      { "op": "TURN_RIGHT" },
      { "op": "MOVE_FWD" }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Walk east until `!pathAhead` while keeping the biggest **`$tileDial`** in **`m`**. Turn North at the vault end so **`F1`** can shuttle **`m`** cells South onto the Charge Pad before walking to **`🏁`**!

---

## 4. Multi-Map Suite (`4` Variants) & Anti-Bypass Rules

| Map | Hall End `D` | Corridor Dials (`x = 1..D, y = 1`) | Max `m` (Required Charge) | Supply `(D, 0)` | Pad `(D, 2)` | Goal `🏁` `(D, 3)` |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: |
| **#1** | `4` | `[2, 5, 1, 3]` | **`5`** | `10` cells | Exact `5` | `(4, 3)` |
| **#2** | `3` | `[4, 2, 1]` (Max first!) | **`4`** | `10` cells | Exact `4` | `(3, 3)` |
| **#3** | `5` | `[1, 2, 3, 2, 6]` (Max last!) | **`6`** | `10` cells | Exact `6` | `(5, 3)` |
| **#4** | `6` | `[3, 3, 1, 2, 4, 3]` | **`4`** | `10` cells | Exact `4` | `(6, 3)` |

- **`antiBypassRules`:**
  1. Charge Pad enforces **exact `== m`** delivery (`< m` leaves `🏁` shuttered; `> m` overcharges/fails), blocking fixed `LOOP [5]` or summing all dials.
  2. Max sits at middle (#1), first (#2), last (#3), and late-middle (#4) across variable hall lengths `3..6`, defeating `"last dial"` or `"first dial"` shortcuts.
  3. Zero multi-item carry: Option A explicitly cycles `1` cell per `F1` call inside `LOOP [m]`.

---

## 5. Step-by-Step Execution Trace (Map #2, `D = 3`, Dials `[4, 2, 1]`)

| Phase | Action / Position | `d` | `m` | Charge Pad `(3, 2)` |
| :--- | :--- | :---: | :---: | :---: |
| Init | `(0, 1)` East | — | `0` | `0 / 4` |
| Step 1 | `(1, 1)` | `4` | `4 > 0 -> 4` | `0 / 4` |
| Step 2 | `(2, 1)` | `2` | `2 > 4` (`false`) -> `4` | `0 / 4` |
| Step 3 | `(3, 1)` (`!pathAhead`) | `1` | `1 > 4` (`false`) -> `4` | `0 / 4` |
| Turn | `TURN_LEFT` -> face North at `(3, 1)` | — | `4` | `0 / 4` |
| Shuttles | `LOOP [4] { CALL F1 }` -> `4` round-trips `(3,0) -> (3,2)` | — | `4` | **`4 / 4` (`🏁` Open!)** |
| Exit | `2× TURN_RIGHT` (South), `WHILE (!atGoal) MOVE_FWD` -> `(3, 3)` | — | `4` | **Goal Reached!** |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Zero-Starter Decomposition:** Having `F1` and `MAIN` both start blank asks learners to compose two distinct Robot Grid skills from scratch: variable-length running-max scanning (`WHILE (pathAhead)` + `d > m`) followed by counted `1`-slot subroutine shuttles (`LOOP [m] { CALL F1 }`).

</details>
