# Challenge `cmp.M3` — Snake-Plow Warehouse Sweeper *(Redesigned)*

> [← `cmp.M2`](./challenge_cmp_m2_balanced_twin_scale.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🔥 Mastery Challenge · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **Next Module:** [`tape` →](../tape/overview.md)

---

## 1. One-Concept Goal

Start from an **empty `0`-block workspace**, sweep every floor tile (`flag`, `order: 0`) across unknown **`N × M`** open warehouse grids in a continuous boustrophedon snake path using row counter **`r`** and parity **`p = r % 2`** to alternate South U-turns until **`🏁`**.

---

## 2. Mastery Challenge Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `robot_grid` (`M × N` open rectangle, `flags: order 0` on all tiles except `(0, 0)` and `🏁`) | Start `(0, 0)` facing East; odd `N` places `🏁` at `(M-1, N-1)`, even `N` places `🏁` at `(0, N-1)` |
| **Starter Code** | **`0` blocks** (`MAIN: []`) | Mastery Blank-Canvas Rule |
| **Palette (`Control & Logic`)** | `WHILE`, `IF / ELSE`, `AND`, `NOT` | `LOOP_START` excluded |
| **Palette (`Actions`)** | `MOVE_FWD`, `TURN_LEFT`, `TURN_RIGHT` | Pure navigation + sweep coverage |
| **Palette (`Vars & Sensors`)** | `VAR_ASSIGN`, `VAR_OP (+, %)`, `pathAhead`, `atGoal`, `==`, `0`, `1`, `2` | **`pathLeft`/`pathRight` intentionally omitted (`antiBypassRules`)** |
| **Block Budget** | `slotCap: 20/tab, 50 total`, `par: 19`, `Starter: 0` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`0` blocks — blank workspace)

```json
{
  "scopes": {
    "MAIN": []
  }
}
```

### Reference Solution (`MAIN`, `19` flat blocks)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "r", "value": 0 },
      {
        "op": "WHILE",
        "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
        "body": [
          {
            "op": "WHILE",
            "cond": {
              "op": "AND",
              "left": { "op": "SENSOR", "sensor": "pathAhead" },
              "right": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } }
            },
            "body": [{ "op": "MOVE_FWD" }]
          },
          {
            "op": "IF",
            "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } },
            "then": [
              { "op": "VAR_OP", "target": "p", "left": "r", "operator": "%", "right": 2 },
              {
                "op": "IF",
                "cond": { "op": "CMP", "operator": "==", "left": "p", "right": 0 },
                "then": [
                  { "op": "TURN_RIGHT" },
                  { "op": "MOVE_FWD" },
                  { "op": "TURN_RIGHT" }
                ],
                "else": [
                  { "op": "TURN_LEFT" },
                  { "op": "MOVE_FWD" },
                  { "op": "TURN_LEFT" }
                ]
              },
              { "op": "VAR_OP", "target": "r", "left": "r", "operator": "+", "right": 1 }
            ]
          }
        ]
      }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Walk across each row until hitting a wall or **`🏁`**, then check **`p = r % 2`** to drop down one row (**Right U-turn** on even rows, **Left U-turn** on odd rows)! Guard with **`!atGoal`** so the final corner stops on **`🏁`**.

---

## 4. Multi-Grid Suite (`4` Variants) & Anti-Bypass Rules

| Map | Dimensions (`Rows N × Cols M`) | Total Floor Flags | Goal `🏁` Corner | Row Sequence |
| :---: | :---: | :---: | :---: | :--- |
| **#1** | `3 × 4` (Odd `N = 3`) | `10` | `(3, 2)` (South-East) | East -> West -> East |
| **#2** | `4 × 3` (Even `N = 4`) | `10` | `(0, 3)` (South-West) | East -> West -> East -> West |
| **#3** | `4 × 5` (Even `N = 4`) | `18` | `(0, 3)` (South-West) | East -> West -> East -> West |
| **#4** | `5 × 4` (Odd `N = 5`) | `18` | `(3, 4)` (South-East) | East -> West -> East -> West -> East |

- **`antiBypassRules`:**
  1. `pathLeft` and `pathRight` are removed from the palette so parity turns (`p = r % 2`) are the only way to steer between Eastbound and Westbound rows.
  2. Collector flags (`order: 0`) cover every interior/edge floor tile so hugging only the outer perimeter to `🏁` fails coverage immediately.
  3. Alternating odd `N` (`3, 5` -> SE goal) and even `N` (`4, 4` -> SW goal) plus varied widths `M` (`3..5`) catches hardcoded zig-zag loops.

---

## 5. Step-by-Step Execution Trace (Map #1 `3 × 4` & Map #2 `4 × 3`)

| Row `r` | `p = r % 2` | Sweep Path (Map #1 `3 × 4`) | End-of-Row Turn | `r` After |
| :---: | :---: | :--- | :--- | :---: |
| `0` | `0` | `(0, 0) -> (3, 0)` (East) | `!atGoal` -> `RIGHT, FWD, RIGHT` -> `(3, 1)` West | `1` |
| `1` | `1` | `(3, 1) -> (0, 1)` (West) | `!atGoal` -> `LEFT, FWD, LEFT` -> `(0, 2)` East | `2` |
| `2` | `0` | `(0, 2) -> (3, 2)` (East) | `atGoal == true` -> **All 10 flags swept; Done!** | `2` |

*(On Map #2 `4 × 3`, `r = 2` turns Right onto `(2, 3)` Westbound, sweeps `(2, 3) -> (0, 3)`, and halts on `🏁` at `(0, 3)` with all 10 flags swept.)*

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Redesign `cmp.M3`?** Eliminating legacy multi-plank stock refills matches Robot Grid's strict 1-slot carry contract while spotlighting the classic boustrophedon coverage algorithm (`N × M` unknown grid sweep driven purely by row-parity `% 2` + `!atGoal`).
- **Module Complete!** Passing `cmp.M1`–`cmp.M3` unlocks both the core sequential path [`tape`](../tape/overview.md) and the side-track module [`inter`](../inter/overview.md).

</details>
