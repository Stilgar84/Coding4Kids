# Capstone `cmp.B` — Parity Bay & Threshold Maintenance *(Redesigned)*

> [← `cmp.A`](./capstone_cmp_a_batch_quota_dispatcher.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🏆 Capstone · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **Next:** [`cmp.C` →](./capstone_cmp_c_parametric_spirograph_galaxy.md)

---

## 1. One-Concept Goal

Walk a corridor of twin-sided maintenance bays: check each bay's **`t = $tileDial`** against the starting power limit **`k`**, and whenever **`t >= k`**, clear the overheated cell strictly from the **Left (`s % 2 == 1`)** or **Right (`s % 2 == 0`)** alcove using pre-wired helpers **`F1`** / **`F2`**.

---

## 2. Capstone Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `robot_grid` (Center hall `(0, 2)..(L-1, 2)` + open bays `y = 1` Left & `y = 3` Right) | Strictly 1-slot carry; each junction `(x, 2)` has drop pad + `$tileDial = t`; **`maxSteps` step budget rejects double-checking both bays** |
| **Palette (`Control & Fns`)** | `WHILE`, `IF / ELSE`, `CALL_FN (F1, F2)` | `F1` clears Left bay & drops on junction pad; `F2` clears Right bay & drops |
| **Palette (`Actions`)** | `MOVE_FWD`, `TURN_LEFT`, `TURN_RIGHT`, `PICK_UP`, `USE_DROP` | `F1` & `F2` pre-supplied in Starter (`8` flat blocks each) |
| **Palette (`Vars & Sensors`)** | `VAR_ASSIGN`, `VAR_OP (+, %)`, `$tileDial`, `atGoal`, `>=`, `==`, `0`, `1`, `2` | Strict 3-address `s = s + 1`, `r = s % 2` before `IF` |
| **Block Budget** | `slotCap: MAIN 18, F1 10, F2 10`, `par: MAIN 16, F1 8, F2 8 (32 total)`, `Starter: MAIN 6, F1 8, F2 8`, `Edit Delta: 10` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN: 6` incomplete blocks; `F1: 8` & `F2: 8` pre-loaded helpers)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "k", "value": "$tileDial" },
      { "op": "VAR_ASSIGN", "var": "s", "value": 0 },
      { "op": "MOVE_FWD" },
      {
        "op": "WHILE",
        "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
        "body": [
          { "op": "MOVE_FWD" }
        ]
      }
    ],
    "F1": [
      { "op": "TURN_LEFT" },
      { "op": "MOVE_FWD" },
      { "op": "PICK_UP" },
      { "op": "TURN_RIGHT" },
      { "op": "TURN_RIGHT" },
      { "op": "MOVE_FWD" },
      { "op": "USE_DROP" },
      { "op": "TURN_LEFT" }
    ],
    "F2": [
      { "op": "TURN_RIGHT" },
      { "op": "MOVE_FWD" },
      { "op": "PICK_UP" },
      { "op": "TURN_LEFT" },
      { "op": "TURN_LEFT" },
      { "op": "MOVE_FWD" },
      { "op": "USE_DROP" },
      { "op": "TURN_RIGHT" }
    ]
  }
}
```

### Reference Solution (`MAIN: 16`, `F1: 8`, `F2: 8`, `32` total — `Edit Delta: 10` inside `MAIN`)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "k", "value": "$tileDial" },
      { "op": "VAR_ASSIGN", "var": "s", "value": 0 },
      { "op": "MOVE_FWD" },
      {
        "op": "WHILE",
        "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
        "body": [
          { "op": "VAR_OP", "target": "s", "left": "s", "operator": "+", "right": 1 },
          { "op": "VAR_ASSIGN", "var": "t", "value": "$tileDial" },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": ">=", "left": "t", "right": "k" },
            "then": [
              { "op": "VAR_OP", "target": "r", "left": "s", "operator": "%", "right": 2 },
              {
                "op": "IF",
                "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
                "then": [{ "op": "CALL_FN", "fn": "F1" }],
                "else": [{ "op": "CALL_FN", "fn": "F2" }]
              }
            ]
          },
          { "op": "MOVE_FWD" }
        ]
      }
    ],
    "F1": [
      { "op": "TURN_LEFT" },
      { "op": "MOVE_FWD" },
      { "op": "PICK_UP" },
      { "op": "TURN_RIGHT" },
      { "op": "TURN_RIGHT" },
      { "op": "MOVE_FWD" },
      { "op": "USE_DROP" },
      { "op": "TURN_LEFT" }
    ],
    "F2": [
      { "op": "TURN_RIGHT" },
      { "op": "MOVE_FWD" },
      { "op": "PICK_UP" },
      { "op": "TURN_LEFT" },
      { "op": "TURN_LEFT" },
      { "op": "MOVE_FWD" },
      { "op": "USE_DROP" },
      { "op": "TURN_RIGHT" }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Save threshold **`k = $tileDial`** at the start, then at each bay check **`t >= k`**. When triggered, **`r = s % 2`** sends odd steps Left (**`F1`**) and even steps Right (**`F2`**) without wasting extra steps!

---

## 4. Multi-Map Suite (`4` Variants) & Anti-Bypass Rules

| Map | Start `(0, 2)` `k` | Junction Dials `t` (`x = 1..N`) | Required Bay Repairs | Goal `🏁` & Step Budget (`maxSteps`) |
| :---: | :---: | :--- | :--- | :---: |
| **#1** | `5` | `[7, 3, 6, 2]` (`N = 4`) | `1 -> Left (F1)`, `3 -> Left (F1)` | `(5, 2)`, `maxSteps: 11` |
| **#2** | `4` | `[4, 5, 2, 6, 4]` (`N = 5`) | `1L, 2R, 4R, 5L` | `(6, 2)`, `maxSteps: 16` |
| **#3** | `6` | `[2, 8, 6]` (`N = 3`) | `2R, 3L` | `(4, 2)`, `maxSteps: 10` |
| **#4** | `3` | `[1, 4, 3, 2, 5, 6]` (`N = 6`) | `2R, 3L, 5L, 6R` | `(7, 2)`, `maxSteps: 17` |

*(Step count formula: `(N + 1)` forward hall steps + `2 * repairedCount` bay steps + `2` margin = exact tight `maxSteps`, where `TURN_*` / `PICK_UP` / `USE_DROP` cost `0` grid-move steps or `3x` action-step cap; specifically checking BOTH Left and Right bays on even 1 junction adds `+2` move steps and busts `maxSteps` on strict-par variants #1 (`9` moves vs cap `11`? Set exact move caps: #1 `9`, #2 `14`, #3 `8`, #4 `15`!).)*

- **Exact Tight Move Budgets (`moveCap`):** **#1:** `9` (`5 + 2*2`), **#2:** `14` (`6 + 2*4`), **#3:** `8` (`4 + 2*2`), **#4:** `15` (`7 + 2*4`).
- **`antiBypassRules`:**
  1. Both `y = 1` (Left) and `y = 3` (Right) alcoves are open at every junction (`pathLeft == true && pathRight == true`), so wall sensors cannot guess which side holds the overheated cell.
  2. Strict `moveCap` (`9, 14, 8, 15` tile steps) blocks brute-force peeking both alcoves or entering `< k` junctions.
  3. Maps #2 and #4 include exact equality **`t == k`** (`4 == 4`, `3 == 3`) that MUST be serviced (`>= k`).

---

## 5. Step-by-Step Execution Trace (Map #1, `k = 5`, `Dials = [7, 3, 6, 2]`, `moveCap = 9`)

| Step | Junction `(x, 2)` | `s` | `t = $tileDial` | `t >= 5` | `r = s % 2` | Action | Moves So Far |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| Init | `(0,2) -> (1,2)` | `0` | `k = 5` | — | — | `MOVE_FWD` | `1` |
| `1` | `(1, 2)` | `1` | `7` | `true` | `1` | `CALL F1` (Left `(1,1)` pick & drop) -> `MOVE_FWD` | `1 + 2 + 1 = 4` |
| `2` | `(2, 2)` | `2` | `3` | `false` | — | Skip bays -> `MOVE_FWD` | `5` |
| `3` | `(3, 2)` | `3` | `6` | `true` | `1` | `CALL F1` (Left `(3,1)` pick & drop) -> `MOVE_FWD` | `5 + 2 + 1 = 8` |
| `4` | `(4, 2)` | `4` | `2` | `false` | — | Skip bays -> `MOVE_FWD` to `(5, 2) 🏁` | `9` (`<= 9`!) |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Redesign `cmp.B`?** Replacing abstract `"left/right repair actions"` with pre-wired alcove routines **`F1`** / **`F2`** and real 1-slot `PICK_UP` / `USE_DROP` keeps the learner focused 100% on composing **threshold gating (`t >= k`)** + **modulo parity (`r = s % 2`)** cleanly on Robot Grid.

</details>
