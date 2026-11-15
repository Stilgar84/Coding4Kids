# Lesson `cmp.7` — Numbered Toy-Block Filter (`$heldValue > $topValue`) *(Redesigned)*

> [← `cmp.6`](./lesson_cmp_6_comparing_stack_tops.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md) · **Next:** [`cmp.8` →](./lesson_cmp_8_maximum_crate_hunter.md)

---

## 1. One-Concept Goal

Keep the reference block resting undisturbed on **Stack 1**, pick up every numbered Toy Block from **Input**, send blocks strictly greater than Stack 1's top (**`$heldValue > $topValue [Stack 1]`**) to **Output**, and park all smaller or equal blocks on **Stack 2**.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `depot` (`ENV_VERSION_DEPOT_V4 = 4`) | `enforceHanoiRule: false`, `requireEmptyStacks: false`; active stations: `INPUT`, `STACK_1`, `STACK_2`, `OUTPUT` |
| **Palette (`Control`)** | `WHILE`, `IF / ELSE` | `LOOP_START` excluded |
| **Palette (`Actions`)** | `PICK_UP`, `PLACE` | `STACK_1` holds fixed threshold `[T]`; never pop `STACK_1` |
| **Palette (`Sensors & Ops`)** | `hasItem`, `$heldValue`, `$topValue`, `>`, `<`, `>=`, `==` | Stack peek strictly non-destructive |
| **Block Budget** | `slotCap: 10`, `par: 8`, `Starter: 4`, `Edit Delta: 5` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN`, `4` flat blocks — routes all Input blocks to Output unfiltered)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasItem", "station": "INPUT" },
        "body": [
          { "op": "PICK_UP", "station": "INPUT" },
          { "op": "PLACE", "station": "OUTPUT" }
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
        "cond": { "op": "SENSOR", "sensor": "hasItem", "station": "INPUT" },
        "body": [
          { "op": "PICK_UP", "station": "INPUT" },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": ">", "left": "$heldValue", "right": "$topValue[STACK_1]" },
            "then": [{ "op": "PLACE", "station": "OUTPUT" }],
            "else": [{ "op": "PLACE", "station": "STACK_2" }]
          }
        ]
      }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Stack 1 holds your secret gate number **`$topValue [Stack 1]`**. Send only bigger blocks (**`>`**) to **Output** and drop everything else on **Stack 2**!

---

## 4. Multi-Run Suite (`4` Variants) & Anti-Bypass Rules

| Variant | `Stack 1` Gate `[T]` | `Input` Queue (Bottom -> Top / Pop Order) | Expected `Output` (`> T`) | Expected `Stack 2` (`<= T`) |
| :---: | :---: | :--- | :--- | :--- |
| **#1** | `[5]` | `[2, 8, 5, 9, 4]` | `[8, 9]` | `[2, 5, 4]` |
| **#2** | `[8]` | `[10, 8, 7, 12]` | `[10, 12]` | `[8, 7]` |
| **#3** | `[3]` | `[1, 4, 3, 6, 2, 7]` | `[4, 6, 7]` | `[1, 3, 2]` |
| **#4** | `[10]` | `[10, 15, 3, 11, 9]` | `[15, 11]` | `[10, 3, 9]` |

- **`antiBypassRules`:**
  1. Varying Stack 1 threshold `T ∈ {5, 8, 3, 10}` across variants defeats hardcoded numbers like `$heldValue > 5`.
  2. Every variant includes an exact tie (`== T`: `5, 8, 3, 10`) that MUST route to `Stack 2`, catching accidental `>=`.
  3. `Stack 1` must still contain `[T]` untouched at halt.

---

## 5. Step-by-Step Execution Trace (Variant #1, `Stack 1 = [5]`)

| Step | Popped Block | `$heldValue > $topValue[STACK_1]` | Branch | `Output` | `Stack 2` |
| :---: | :---: | :--- | :--- | :--- | :--- |
| `1` | `2` | `2 > 5` -> `false` | `PLACE [STACK_2]` | `[]` | `[2]` |
| `2` | `8` | `8 > 5` -> `true` | `PLACE [OUTPUT]` | `[8]` | `[2]` |
| `3` | `5` | `5 > 5` -> `false` | `PLACE [STACK_2]` | `[8]` | `[2, 5]` |
| `4` | `9` | `9 > 5` -> `true` | `PLACE [OUTPUT]` | `[8, 9]` | `[2, 5]` |
| `5` | `4` | `4 > 5` -> `false` | `PLACE [STACK_2]` | `[8, 9]` | `[2, 5, 4]` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Redesign `cmp.7`?** The legacy `"Count Stack 1 into c and move c items"` overlapped [`var.4`–`var.6`](../var/overview.md) and ignored [`cmp.6`](./lesson_cmp_6_comparing_stack_tops.md) completely. Focusing `cmp.7` directly on **`$heldValue > $topValue [Stack 1]`** builds fluent single-stack comparison right before the dynamic champion-swap in [`cmp.8`](./lesson_cmp_8_maximum_crate_hunter.md).

</details>
