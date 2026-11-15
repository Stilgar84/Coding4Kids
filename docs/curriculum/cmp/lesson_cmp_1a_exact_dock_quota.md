# Lesson `cmp.1a` — Exact Dock Quota (`$dockCount < $dockQuota`) *(New)*

> [← `cmp.1`](./lesson_cmp_1_weight_thresholds_and_quotas.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🚂 Puzzle · **Environment:** [🚂 Switchyard](../../envs/switchyard.md) · **Next:** [`cmp.2` →](./lesson_cmp_2_variable_threshold_checks.md)

---

## 1. One-Concept Goal

Fill **Left Dock A** up to its dynamic **`$dockQuota [A]`** counter (`$dockCount [0] < $dockQuota [0]`), then divert every remaining crate to **Right Dock B** without overfilling Dock A.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `switchyard` (`1` switch `A`) | Painted gauge displays live `$dockCount[0]` / `$dockQuota[0]` |
| **Palette (`Control`)** | `WHILE`, `IF / ELSE` | `LOOP_START` excluded |
| **Palette (`Actions`)** | `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` | `SWITCH_TOGGLE` omitted |
| **Palette (`Sensors / Ops`)** | `hasNextItem`, `$dockCount[0]`, `$dockQuota[0]`, `<`, `<=`, `==` | Focus on counter `<` quota |
| **Block Budget** | `slotCap: 10`, `par: 8`, `Starter: 4`, `Edit Delta: 5` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN`, `4` flat blocks — overfills Dock A on all runs)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasNextItem" },
        "body": [
          { "op": "SWITCH_LEFT" },
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
            "cond": { "op": "CMP", "operator": "<", "left": "$dockCount[0]", "right": "$dockQuota[0]" },
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

> **Guided Co-Pilot Card (`<= 2` sentences):** Watch **`$dockCount [A]`** climb as crates enter Dock A. When it matches **`$dockQuota [A]`**, **`<`** turns false and sends the rest to Dock B!

---

## 4. Multi-Stream Suite (`4` Variants) & Anti-Bypass Rules

| Variant | Train Length | `$dockQuota[0]` | Expected Dock A Count | Expected Dock B Count |
| :---: | :---: | :---: | :---: | :---: |
| **#1** | `5` (`[2, 5, 4, 8, 3]`) | `2` | `2` (`[2, 5]`) | `3` (`[4, 8, 3]`) |
| **#2** | `6` (`[9, 1, 7, 6, 4, 2]`) | `4` | `4` (`[9, 1, 7, 6]`) | `2` (`[4, 2]`) |
| **#3** | `4` (`[6, 8, 3, 5]`) | `1` | `1` (`[6]`) | `3` (`[8, 3, 5]`) |
| **#4** | `7` (`[4, 4, 9, 2, 7, 5, 1]`) | `3` | `3` (`[4, 4, 9]`) | `4` (`[2, 7, 5, 1]`) |

- **`antiBypassRules`:**
  1. Varying `$dockQuota[0]` across `2, 4, 1, 3` blocks hardcoded counts (`Loop [2]`, `c < 2`).
  2. Strict `<` is enforced: accidental `<=` puts `quota + 1` crates into Dock A (`3` instead of `2` on #1), failing the dock capacity check.

---

## 5. Step-by-Step Execution Trace (Variant #1, `$dockQuota[0] = 2`)

| Crate # | `$dockCount[0]` Before | `$dockCount[0] < 2` | Action | Dock A After | Dock B After |
| :---: | :---: | :--- | :--- | :--- | :--- |
| `1` (`2 kg`) | `0` | `true` (`0 < 2`) | `SWITCH_LEFT`, `SEND_NEXT` | `[2]` | `[]` |
| `2` (`5 kg`) | `1` | `true` (`1 < 2`) | `SWITCH_LEFT`, `SEND_NEXT` | `[2, 5]` | `[]` |
| `3` (`4 kg`) | `2` | `false` (`2 < 2`) | `SWITCH_RIGHT`, `SEND_NEXT` | `[2, 5]` | `[4]` |
| `4` (`8 kg`) | `2` | `false` (`2 < 2`) | `SWITCH_RIGHT`, `SEND_NEXT` | `[2, 5]` | `[4, 8]` |
| `5` (`3 kg`) | `2` | `false` (`2 < 2`) | `SWITCH_RIGHT`, `SEND_NEXT` | `[2, 5]` | `[4, 8, 3]` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Count vs. Capacity Off-By-One:** Zero-based arrival (`count = 0`) compared before loading means `count == quota` is the exact stopping state—so `<` continues loading and `==` / `>=` overflows cleanly. This prepares learners directly for the twin-boundary bug in [`cmp.9`](./lesson_cmp_9_fix_boundary_weight_gate.md).

</details>
