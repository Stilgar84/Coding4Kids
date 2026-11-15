# Lesson `cmp.0` — Comparing Numbers (`<`, `>`, `<=`, `>=`, `==`, `!=`)

> [← Module `cmp` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.1` →](./lesson_cmp_1_weight_thresholds_and_quotas.md)

---

## 1. One-Concept Goal

Watch numeric comparisons (`>`, `<`, `==`) evaluate live inside the **Watch Tray** and Switchyard gate badge to drive `If / Else` routing decisions.

---

## 2. Guided Co-Pilot Experience (`2` Interactive Beats)

> **UI Contract ([`ui_guidelines.md`](../../ui_guidelines.md)):** Guided Co-Pilot card stays `<= 2` sentences per beat with zero text clutter on the block canvas or Watch Tray badges.

### Beat 1 — Heavy vs. Light Weight Gate (`$itemWeight > 10`)

- **Co-Pilot Card (`<= 2` sentences):** Watch each crate's weight badge light up green (`true`) or red (`false`) against **`> 10`**. Notice **`10 > 10`** evaluates **`false`**, so exact **`10 kg`** stays on the Express track!
- **Preloaded Train Stream (Beat 1):**

| Index | Label | Weight (`kg`) | `$itemWeight > 10` | Routed Dock |
| :---: | :--- | :---: | :---: | :--- |
| `1` | Box A | `4` | `false` (`4 > 10`) | Right — Express (`B`) |
| `2` | Crate B | `14` | `true` (`14 > 10`) | Left — Heavy (`A`) |
| `3` | Crate C | `10` | `false` (`10 > 10`) | Right — Express (`B`) |
| `4` | Crate D | `12` | `true` (`12 > 10`) | Left — Heavy (`A`) |

- **Demo Program (`MAIN`, `8` flat blocks):**

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
            "cond": { "op": "CMP", "operator": ">", "left": "$itemWeight", "right": 10 },
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

### Beat 2 — Exact Dock Quota Stop (`$dockCount [A] == $dockQuota [A]`)

- **Co-Pilot Card (`<= 2` sentences):** Switch tracks compare **`$dockCount [A]`** (`0, 1, 2...`) with the painted **`$dockQuota [A]`** sign (**`2`**). As soon as they match (**`==`**), extra crates detour to Dock B!
- **Preloaded Train Stream (Beat 2, `$dockQuota [A] = 2`):**

| Index | `$dockCount [A]` Before | `$dockCount [A] == $dockQuota [A]` | Routed Dock | `$dockCount [A]` After |
| :---: | :---: | :---: | :--- | :---: |
| `1` | `0` | `false` (`0 == 2`) | Left — Dock A | `1` |
| `2` | `1` | `false` (`1 == 2`) | Left — Dock A | `2` |
| `3` | `2` | `true` (`2 == 2`) | Right — Dock B | `2` |
| `4` | `2` | `true` (`2 == 2`) | Right — Dock B | `2` |

- **Demo Program (`MAIN`, `8` flat blocks):**

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
            "cond": { "op": "CMP", "operator": "==", "left": "$dockCount[0]", "right": "$dockQuota[0]" },
            "then": [{ "op": "SWITCH_RIGHT" }],
            "else": [{ "op": "SWITCH_LEFT" }]
          },
          { "op": "SEND_NEXT" }
        ]
      }
    ]
  }
}
```

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Strict vs. Inclusive Boundaries:** Young learners often assume `"greater than 10"` includes `10`. Highlighting Crate C (`10 kg`) in Beat 1 builds crisp intuition before [`cmp.1`](./lesson_cmp_1_weight_thresholds_and_quotas.md) and [`cmp.9`](./lesson_cmp_9_fix_boundary_weight_gate.md), contrasting `>` / `<` (strict) with `>=` / `<=` (inclusive) and `==` / `!=` (exact match / mismatch).
- **Watch Tray Chips:** Every `CMP` step displays `left op right -> ✓ / ✕` directly in the Watch Tray alongside live `$itemWeight`, `$dockCount[0]`, and `$dockQuota[0]`.

</details>
