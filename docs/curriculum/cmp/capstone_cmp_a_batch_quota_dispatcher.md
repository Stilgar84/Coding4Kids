# Capstone `cmp.A` — Batch Quota Dispatcher

> [← `cmp.9`](./lesson_cmp_9_fix_boundary_weight_gate.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🏆 Capstone · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.B` →](./capstone_cmp_b_parity_and_threshold_maintenance.md)

---

## 1. One-Concept Goal

Combine damage/overweight scrapping (**`itemDamaged OR $itemWeight > 20`**) with dynamic dock quota overflow (**`$dockCount [0] < $dockQuota [0]`**) using a single flat **`IF / ELSE_IF / ELSE`** dispatch pipeline.

---

## 2. Capstone Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `switchyard` (`1` switch `A`) | `scrapRules`: damaged OR weight `> 20 kg` (`20 kg` is valid!) |
| **Palette (`Control & Logic`)** | `WHILE`, `IF / ELSE_IF / ELSE`, `OR` | `LOOP_START` disabled |
| **Palette (`Actions`)** | `SCRAP_ITEM`, `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` | Every non-scrapped crate advances via `SEND_NEXT` |
| **Palette (`Sensors & Ops`)** | `hasNextItem`, `itemDamaged`, `$itemWeight`, `$dockCount[0]`, `$dockQuota[0]`, `>`, `<`, `<=`, `20` | — |
| **Block Budget** | `slotCap: 15`, `par: 11`, `Starter: 8`, `Edit Delta: 5` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN`, `8` flat blocks — scraps damaged only, routes all valid Right)

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
            "cond": { "op": "SENSOR", "sensor": "itemDamaged" },
            "then": [{ "op": "SCRAP_ITEM" }],
            "else": [
              { "op": "SWITCH_RIGHT" },
              { "op": "SEND_NEXT" }
            ]
          }
        ]
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
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          {
            "op": "IF",
            "cond": {
              "op": "OR",
              "left": { "op": "SENSOR", "sensor": "itemDamaged" },
              "right": { "op": "CMP", "operator": ">", "left": "$itemWeight", "right": 20 }
            },
            "then": [{ "op": "SCRAP_ITEM" }],
            "elseIfs": [
              {
                "cond": { "op": "CMP", "operator": "<", "left": "$dockCount[0]", "right": "$dockQuota[0]" },
                "body": [
                  { "op": "SWITCH_LEFT" },
                  { "op": "SEND_NEXT" }
                ]
              }
            ],
            "else": [
              { "op": "SWITCH_RIGHT" },
              { "op": "SEND_NEXT" }
            ]
          }
        ]
      }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Check scrap rules first (**`itemDamaged OR $itemWeight > 20`**) so broken or overweight crates never fill Dock A! Route valid crates Left until **`$dockCount [A] < $dockQuota [A]`** turns false, then overflow to Dock B.

---

## 4. Multi-Stream Suite (`4` Variants) & Anti-Bypass Rules

*(Crates marked `*` have `itemDamaged: true`.)*

| Variant | Train Stream (`kg`) | `$dockQuota[0]` | Expected Scrapped | Expected Dock A | Expected Dock B |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **#1** | `[8, 25, 12*, 20, 15, 6]` | `2` | `[25, 12*]` | `[8, 20]` (`2`) | `[15, 6]` (`2`) |
| **#2** | `[21, 10, 5*, 14, 18, 9, 3]` | `3` | `[21, 5*]` | `[10, 14, 18]` (`3`) | `[9, 3]` (`2`) |
| **#3** | `[19, 22*, 4]` | `1` | `[22*]` | `[19]` (`1`) | `[4]` (`1`) |
| **#4** | `[11, 20, 30, 7, 13*, 5]` | `4` | `[30, 13*]` | `[11, 20, 7, 5]` (`4`) | `[]` (`0`) |

- **`antiBypassRules`:**
  1. Checking `$dockCount[0] < $dockQuota[0]` BEFORE scrap rules passes invalid crates into Dock A or misses `SCRAP_ITEM`.
  2. Boundary weight `20` (#1 and #4) MUST pass to docks (catches `>= 20`), while `21` (#2) MUST be scrapped.

---

## 5. Step-by-Step Execution Trace (Variant #1, `$dockQuota[0] = 2`)

| Crate | `itemDamaged` | `w > 20` | `$dockCount[0] < 2` | Action | Dock A | Dock B | Scrap |
| :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `8` | `false` | `false` | `0 < 2` (`true`) | `SWITCH_LEFT`, `SEND_NEXT` | `[8]` | `[]` | `[]` |
| `25` | `false` | `true` | — | `SCRAP_ITEM` | `[8]` | `[]` | `[25]` |
| `12*` | `true` | — | — | `SCRAP_ITEM` | `[8]` | `[]` | `[25, 12*]` |
| `20` | `false` | `false` | `1 < 2` (`true`) | `SWITCH_LEFT`, `SEND_NEXT` | `[8, 20]` | `[]` | `[25, 12*]` |
| `15` | `false` | `false` | `2 < 2` (`false`) | `SWITCH_RIGHT`, `SEND_NEXT` | `[8, 20]` | `[15]` | `[25, 12*]` |
| `6` | `false` | `false` | `2 < 2` (`false`) | `SWITCH_RIGHT`, `SEND_NEXT` | `[8, 20]` | `[15, 6]` | `[25, 12*]` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Condition Precedence:** `IF / ELSE_IF / ELSE` teaches short-circuit filtering priority: reject hazards first (`itemDamaged OR > 20`), allocate limited capacity second (`< quota`), and default to overflow third (`ELSE`).

</details>
