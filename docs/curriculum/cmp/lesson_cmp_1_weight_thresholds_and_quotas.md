# Lesson `cmp.1` — Weight Thresholds (`$itemWeight > 10`)

> [← `cmp.0`](./lesson_cmp_0_comparing_numbers.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🚂 Puzzle · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.1a` →](./lesson_cmp_1a_exact_dock_quota.md)

---

## 1. One-Concept Goal

Route heavy crates strictly over **`10 kg`** (`$itemWeight > 10`) to **Left Dock A (Heavy)** while sending light and boundary crates (`<= 10 kg`) to **Right Dock B (Express)**.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `switchyard` (`1` switch `A`) | Left = Heavy Cargo (`A`), Right = Express (`B`) |
| **Palette (`Control`)** | `WHILE`, `IF / ELSE` | `LOOP_START` excluded (`antiBypassRules`) |
| **Palette (`Actions`)** | `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` | `SWITCH_TOGGLE` omitted |
| **Palette (`Sensors / Ops`)** | `hasNextItem`, `$itemWeight`, `>`, `<`, `==`, `10` | No `$dockQuota` yet (deferred to [`cmp.1a`](./lesson_cmp_1a_exact_dock_quota.md)) |
| **Block Budget** | `slotCap: 10`, `par: 8`, `Starter: 4`, `Edit Delta: 5` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN`, `4` flat blocks — sends every crate Right)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          { "op": "SWITCH_RIGHT" },
          { "op": "SEND_NEXT" }
        ]
      }
    ]
  }
}
```

### Reference Solution (`MAIN`, `8` flat blocks — `Edit Delta: 5`)

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

---

## 4. Multi-Stream Suite (`4` Variants) & Anti-Bypass Rules

| Variant | Incoming Queue (`$itemWeight` in `kg`) | Expected Dock A (`Left`, `> 10`) | Expected Dock B (`Right`, `<= 10`) |
| :---: | :--- | :--- | :--- |
| **#1** | `[4, 10, 15, 8, 12]` | `[15, 12]` | `[4, 10, 8]` |
| **#2** | `[11, 10, 9, 20, 10]` | `[11, 20]` | `[10, 9, 10]` |
| **#3** | `[15, 14, 1, 2]` | `[15, 14]` | `[1, 2]` |
| **#4** | `[10, 10, 11, 3, 18, 7]` | `[11, 18]` | `[10, 10, 3, 7]` |

- **`antiBypassRules`:**
  1. Every variant tests boundary weight **`10`** (`<= 10` -> Dock B) and/or **`11`** (`> 10` -> Dock A) so accidental `>= 10` fails #1, #2, and #4 immediately.
  2. Stream lengths (`5, 5, 4, 6`) and order flips defeat any fixed `Loop [n]` or hardcoded Left/Right pattern.

---

## 5. Step-by-Step Execution Trace (Variant #1)

| Step | Incoming Weight | Condition `$itemWeight > 10` | Branch | Dock A | Dock B |
| :---: | :---: | :--- | :--- | :--- | :--- |
| `1` | `4` | `4 > 10` -> `false` | `ELSE -> SWITCH_RIGHT` | `[]` | `[4]` |
| `2` | `10` | `10 > 10` -> `false` | `ELSE -> SWITCH_RIGHT` | `[]` | `[4, 10]` |
| `3` | `15` | `15 > 10` -> `true` | `THEN -> SWITCH_LEFT` | `[15]` | `[4, 10]` |
| `4` | `8` | `8 > 10` -> `false` | `ELSE -> SWITCH_RIGHT` | `[15]` | `[4, 10, 8]` |
| `5` | `12` | `12 > 10` -> `true` | `THEN -> SWITCH_LEFT` | `[15, 12]` | `[4, 10, 8]` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Separate Weight from Quotas?** Splitting pure `$itemWeight > 10` (`cmp.1`) from `$dockCount < $dockQuota` ([`cmp.1a`](./lesson_cmp_1a_exact_dock_quota.md)) honors One-Concept-Per-Lesson while forcing learners to treat `10 kg` explicitly as a boundary case before combining rules later in Fix-It [`cmp.9`](./lesson_cmp_9_fix_boundary_weight_gate.md).

</details>
