# Lesson `cmp.9` — Fix-It: Boundary Weight & Quota Gate (`<` vs. `<=`) *(New)*

> [← `cmp.8`](./lesson_cmp_8_maximum_crate_hunter.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🔧 Fix-It · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.A` →](./capstone_cmp_a_batch_quota_dispatcher.md)

---

## 1. One-Concept Goal

Diagnose and repair two subtle **`<=` vs. `<`** off-by-one boundary bugs in an existing dispatch gate: **Dock A (Express)** only takes crates strictly **under `10 kg`** (`$itemWeight < 10`) while **`$dockCount [0] < $dockQuota [0]`**.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `switchyard` (`1` switch `A`) | Express Left (`A`: `< 10 kg` up to quota), Heavy/Overflow Right (`B`) |
| **Palette (`Control & Logic`)** | `WHILE`, `IF / ELSE`, `AND` | Pre-assembled in Starter; inspect Watch Tray on `10 kg` & quota match |
| **Palette (`Actions`)** | `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` | Keep gate structure intact |
| **Palette (`Operators`)** | `<`, `<=`, `>`, `>=`, `==`, `!=` | Change `<=` -> `<` on both sides of `AND` |
| **Block Budget** | `slotCap: 10`, `par: 8`, `Starter: 8`, `Edit Delta: 2` (2 operator edits) | Zero new blocks needed |

---

## 3. Buggy Starter Code & Fixed Reference Solution

### Buggy Starter Code (`MAIN`, `8` flat blocks — admits `10 kg` crates AND overfills Dock A by `1`)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          {
            "op": "IF",
            "cond": {
              "op": "AND",
              "left": { "op": "CMP", "operator": "<=", "left": "$itemWeight", "right": 10 },
              "right": { "op": "CMP", "operator": "<=", "left": "$dockCount[0]", "right": "$dockQuota[0]" }
            },
            "then": [{ "op": "SWITCH_LEFT" }],
            "else": [{ "op": "SWITCH_RIGHT" }]
          },
          { "op": "SEND_NEXT" }
        ]
      }
    ]
  }
}
```

### Fixed Reference Solution (`MAIN`, `8` flat blocks — `Edit Delta: 2` operator changes)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          {
            "op": "IF",
            "cond": {
              "op": "AND",
              "left": { "op": "CMP", "operator": "<", "left": "$itemWeight", "right": 10 },
              "right": { "op": "CMP", "operator": "<", "left": "$dockCount[0]", "right": "$dockQuota[0]" }
            },
            "then": [{ "op": "SWITCH_LEFT" }],
            "else": [{ "op": "SWITCH_RIGHT" }]
          },
          { "op": "SEND_NEXT" }
        ]
      }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Watch **`10 kg`** crates sneak into Express Dock A and see Dock A overflow past **`$dockQuota [A]`** by 1! Spot both off-by-one **`<=`** operators and switch them to strict **`<`**.

---

## 4. Multi-Stream Suite (`4` Variants) & Anti-Bypass Rules

| Variant | Train Weights (`kg`) | `$dockQuota[0]` | Expected Dock A (`< 10`, up to `quota`) | Expected Dock B (`>= 10` or overflow) |
| :---: | :--- | :---: | :--- | :--- |
| **#1** | `[6, 10, 8, 4, 15]` | `2` | `[6, 8]` (`2`) | `[10, 4, 15]` (`3`) |
| **#2** | `[10, 5, 9, 3]` | `1` | `[5]` (`1`) | `[10, 9, 3]` (`3`) |
| **#3** | `[10, 10, 4, 8]` | `3` | `[4, 8]` (`2 <= quota 3`) | `[10, 10]` (`2`) |
| **#4** | `[3, 7, 9, 2, 6]` | `3` | `[3, 7, 9]` (`3`) | `[2, 6]` (`2`) |

- **`antiBypassRules`:**
  1. Fixing ONLY `$itemWeight < 10` fails #1, #2, and #4 (overfills Dock A to `quota + 1`).
  2. Fixing ONLY `$dockCount[0] < $dockQuota[0]` fails #1, #2, and #3 (`10 kg` crates leak into Dock A).
  3. Notice #3 only has `2` qualifying crates (`4, 8`) with `quota = 3` — Dock A receives `2` (`<= quota`), NOT forced to `3` with invalid `10 kg` crates!

---

## 5. Bug Diagnosis vs. Fixed Trace (Variant #1, `quota = 2`)

| Crate | Buggy `<=` Check (`w<=10 && c<=2`) | Fixed `<` Check (`w<10 && c<2`) |
| :---: | :--- | :--- |
| `6` | `6<=10 && 0<=2` -> `Left` (`c=1`) | `6<10 && 0<2` -> `Left` (`c=1`) |
| `10` | **`10<=10 && 1<=2` -> `Left` (BUG: 10 kg in A!, `c=2`)** | **`10<10` -> `false` -> `Right` (Heavy B)** |
| `8` | **`8<=10 && 2<=2` -> `Left` (BUG: overfills A to 3!)** | `8<10 && 1<2` -> `Left` (`c=2`) |
| `4` | `4<=10 && 3<=2` -> `Right` | `4<10 && 2<2` -> `false` -> `Right` |
| `15` | `15<=10` -> `Right` | `15<10` -> `Right` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Add `cmp.9` Fix-It Here?** Off-by-one boundary bugs (`<` vs. `<=`) are the #1 real-world logic mistake after learning comparisons. Inspecting live `true/false` pills on `10` and on `count == quota` gives kids immediate debugging mastery before Capstone [`cmp.A`](./capstone_cmp_a_batch_quota_dispatcher.md).

</details>
