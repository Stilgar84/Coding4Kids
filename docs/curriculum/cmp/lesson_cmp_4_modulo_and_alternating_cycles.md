# Lesson `cmp.4` — Modulo & Alternating Cycles (`c % 2 == 1`)

> [← `cmp.3`](./lesson_cmp_3_division_and_remainder_math.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🚂 Puzzle · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.5` →](./lesson_cmp_5_computed_geometry.md)

---

## 1. One-Concept Goal

Count each arriving crate (`c = c + 1`) and use strict 3-address modulo **`r = c % 2`** to alternate **`#1, #3, #5...`** (**Left Dock A**) and **`#2, #4, #6...`** (**Right Dock B**) cleanly on any train length.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `switchyard` (`1` switch `A`) | Twin-Track Parity split (`#1..#6` and variable lengths) |
| **Palette (`Control`)** | `WHILE`, `IF / ELSE` | `LOOP_START` disabled |
| **Palette (`Actions`)** | `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` | `SWITCH_TOGGLE` omitted to isolate `% 2` logic |
| **Palette (`Vars & Math`)** | `VAR_ASSIGN`, `VAR_OP (+, %)`, `==`, `!=`, `0`, `1`, `2` | Strict 3-address `OP_VAR_OP` before `IF` |
| **Block Budget** | `slotCap: 13`, `par: 11`, `Starter: 5`, `Edit Delta: 6` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN`, `5` flat blocks — counts crates, sends all Left)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 },
          { "op": "SWITCH_LEFT" },
          { "op": "SEND_NEXT" }
        ]
      }
    ]
  }
}
```

### Reference Solution (`MAIN`, `11` flat blocks — `Edit Delta: 6`)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          { "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 },
          { "op": "VAR_OP", "target": "r", "left": "c", "operator": "%", "right": 2 },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": "==", "left": "r", "right": 1 },
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

> **Guided Co-Pilot Card (`<= 2` sentences):** Compute remainder **`r = c % 2`** right inside the loop before the `If` block. Odd crates (`r == 1`) go Left (`A`), and even crates (`r == 0`) go Right (`B`)!

---

## 4. Multi-Stream Suite (`4` Variants) & Anti-Bypass Rules

| Variant | Train Stream (`label` / `weight`) | Expected Dock A (`#1, #3, #5...`) | Expected Dock B (`#2, #4, #6...`) |
| :---: | :--- | :--- | :--- |
| **#1** | `6` crates: `[#1, #2, #3, #4, #5, #6]` | `[#1, #3, #5]` (`3`) | `[#2, #4, #6]` (`3`) |
| **#2** | `4` crates: `[#1, #2, #3, #4]` | `[#1, #3]` (`2`) | `[#2, #4]` (`2`) |
| **#3** | `5` crates: `[#1, #2, #3, #4, #5]` | `[#1, #3, #5]` (`3`) | `[#2, #4]` (`2`) |
| **#4** | `8` crates: `[#1..#8]` | `[#1, #3, #5, #7]` (`4`) | `[#2, #4, #6, #8]` (`4`) |

- **`antiBypassRules`:**
  1. `SWITCH_TOGGLE` and `LOOP_START` are excluded from the palette, forcing modulo parity (`c % 2`) instead of pair unrolling.
  2. Odd-length Variant #3 (`5` crates) catches hardcoded 2-item pair loops; lengths `4, 5, 6, 8` defeat fixed repetition.

---

## 5. Step-by-Step Execution Trace (Variant #1, `6` Crates)

| Crate | `c` After `+ 1` | `r = c % 2` | `r == 1` | Routed Dock |
| :---: | :---: | :---: | :---: | :--- |
| `#1` | `1` | `1` | `true` | Left — Dock A |
| `#2` | `2` | `0` | `false` | Right — Dock B |
| `#3` | `3` | `1` | `true` | Left — Dock A |
| `#4` | `4` | `0` | `false` | Right — Dock B |
| `#5` | `5` | `1` | `true` | Left — Dock A |
| `#6` | `6` | `0` | `false` | Right — Dock B |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Compute `r = c % 2` Explicitly?** In 3-address `OP_VAR_OP`, `If` blocks only compare variables and numbers (`r == 1`), keeping intermediate math visible in the Watch Tray (`c: 1 -> 2 -> 3`, `r: 1 -> 0 -> 1`). Note that `$itemWeight` is ignored here so learners isolate `% 2` count parity cleanly.

</details>
