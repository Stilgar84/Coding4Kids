# Challenge `cmp.M2` — Balanced Twin-Scale Loader

> [← `cmp.M1`](./challenge_cmp_m1_max_vault_hunter.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🔥 Mastery Challenge · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.M3` →](./challenge_cmp_m3_snake_plow_sweeper.md)

---

## 1. One-Concept Goal

Start from an **empty `0`-block workspace**, scrap any **`itemDamaged`** crate, and route valid crates onto **Dock A (`l`)** or **Dock B (`r`)** by keeping both scales' **running weight totals** balanced (**`l <= r`**).

---

## 2. Mastery Challenge Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `switchyard` (`1` switch `A`) | Twin balance scale tracks cumulative weight (`l` Left, `r` Right) |
| **Starter Code** | **`0` blocks** (`MAIN: []`) | Mastery Blank-Canvas Rule |
| **Palette (`Control`)** | `WHILE`, `IF / ELSE` | `LOOP_START` disabled |
| **Palette (`Actions`)** | `SCRAP_ITEM`, `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` | `SWITCH_TOGGLE` omitted |
| **Palette (`Vars & Sensors`)** | `VAR_ASSIGN`, `VAR_OP (+)`, `hasNextItem`, `itemDamaged`, `$itemWeight`, `<=`, `<`, `>`, `0` | Strict 3-address `l = l + $itemWeight` |
| **Block Budget** | `slotCap: 20/tab, 50 total`, `par: 16`, `Starter: 0` | Flat closer-inclusive counting |

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

### Reference Solution (`MAIN`, `16` flat blocks)

```json
{
  "scopes": {
    "MAIN": [
      { "op": "VAR_ASSIGN", "var": "l", "value": 0 },
      { "op": "VAR_ASSIGN", "var": "r", "value": 0 },
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          {
            "op": "IF",
            "cond": { "op": "SENSOR", "sensor": "itemDamaged" },
            "then": [{ "op": "SCRAP_ITEM" }],
            "else": [
              {
                "op": "IF",
                "cond": { "op": "CMP", "operator": "<=", "left": "l", "right": "r" },
                "then": [
                  { "op": "SWITCH_LEFT" },
                  { "op": "VAR_OP", "target": "l", "left": "l", "operator": "+", "right": "$itemWeight" }
                ],
                "else": [
                  { "op": "SWITCH_RIGHT" },
                  { "op": "VAR_OP", "target": "r", "left": "r", "operator": "+", "right": "$itemWeight" }
                ]
              },
              { "op": "SEND_NEXT" }
            ]
          }
        ]
      }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Track running scale totals **`l`** and **`r`**. Scrap damaged crates first, then always tip valid crates onto the lighter scale (**`l <= r`**) — alternating by `% 2` won't balance heavy weights!

---

## 4. Multi-Stream Suite (`4` Variants) & Anti-`% 2` Verification

*(Crates marked `*` have `itemDamaged: true`.)*

| Variant | Train Stream (`$itemWeight` in `kg`) | Greedy `l <= r` Outcome (`Dock A`, `Dock B`) | Greedy Imbalance `\|L - R\|` | Naive `% 2` Imbalance |
| :---: | :--- | :--- | :---: | :---: |
| **#1** | `[10, 2*, 4, 3, 3]` | `A=[10] (10)`, `B=[4, 3, 3] (10)` · Scrap `[2*]` | **`0`** | `13` vs `7` (`6` — **FAIL**) |
| **#2** | `[12, 5, 4, 3, 1*, 8, 8]` | `A=[12, 8] (20)`, `B=[5, 4, 3, 8] (20)` · Scrap `[1*]` | **`0`** | `24` vs `16` (`8` — **FAIL**) |
| **#3** | `[15, 5, 5, 5, 6*]` | `A=[15] (15)`, `B=[5, 5, 5] (15)` · Scrap `[6*]` | **`0`** | `20` vs `10` (`10` — **FAIL**) |
| **#4** | `[20, 6, 7, 7, 4*, 8, 8]` | `A=[20, 8] (28)`, `B=[6, 7, 7, 8] (28)` · Scrap `[4*]` | **`0`** | `35` vs `21` (`14` — **FAIL**) |

- **`antiBypassRules`:**
  1. Every stream contains `1` large anchor crate followed by multiple medium crates summing to balance it, so count-based `% 2` alternation creates imbalances of `6–14 kg` and fails ALL 4 variants (win target requires `|L - R| == 0` AND all damaged crates scrapped).
  2. Damaged crates appear in varied positions (`2nd`, `5th`, `last`, `5th`) so hardcoding scrap indices fails.

---

## 5. Step-by-Step Execution Trace (Variant #1, `[10, 2*, 4, 3, 3]`)

| Crate | `itemDamaged` | `l <= r` Before | Action | `l` After | `r` After |
| :---: | :---: | :--- | :--- | :---: | :---: |
| `10` | `false` | `0 <= 0` (`true`) | `SWITCH_LEFT`, `l = 0 + 10`, `SEND_NEXT` | `10` | `0` |
| `2*` | `true` | — | `SCRAP_ITEM` | `10` | `0` |
| `4` | `false` | `10 <= 0` (`false`) | `SWITCH_RIGHT`, `r = 0 + 4`, `SEND_NEXT` | `10` | `4` |
| `3` | `false` | `10 <= 4` (`false`) | `SWITCH_RIGHT`, `r = 4 + 3`, `SEND_NEXT` | `10` | `7` |
| `3` | `false` | `10 <= 7` (`false`) | `SWITCH_RIGHT`, `r = 7 + 3`, `SEND_NEXT` | **`10`** | **`10`** |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Anti-`% 2` Matters:** Kids fresh from [`cmp.4`](./lesson_cmp_4_modulo_and_alternating_cycles.md) often reach for modulo alternation (`c % 2`) everywhere. Designing streams where one dock takes `3` small crates while the other holds `1` heavy crate proves dynamically why comparing running accumulators (`l <= r`) solves load balancing when `% 2` fails.

</details>
