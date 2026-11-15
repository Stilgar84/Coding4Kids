# Lesson `cmp.6` — Comparing Stack Tops (`$heldValue` vs. `$topValue`)

> [← `cmp.5a`](./lesson_cmp_5a_modulo_beat_and_checkerboard.md) · [Module `cmp` Overview](./overview.md) · **Format:** 📖 Explanation (`2` Beats) · **Environment:** [🏗️ Depot](../../envs/depot.md) · **Next:** [`cmp.7` →](./lesson_cmp_7_count_and_provision.md)

---

## 1. One-Concept Goal

See how Depot's non-destructive **`$topValue [Station]`** sensor peeks at the glowing top Numbered Toy Block without popping it—and why checking **`stationEmpty [Station] OR ...`** first prevents **`TYPE_ERROR`** on empty stacks.

---

## 2. Guided Co-Pilot Experience (`2` Interactive Beats)

> **Depot Mode (`ENV_VERSION_DEPOT_V4 = 4`):** `enforceHanoiRule: false`, `requireEmptyStacks: false`. Uses **Numbered Toy Blocks** (`$heldValue`, `$topValue`); **`$topColor` stays locked until Module `args`**.

### Beat 1 — Non-Destructive Stack Peek (`$heldValue > $topValue [Stack 1]`)

- **Co-Pilot Card (`<= 2` sentences):** Hold block **`[7]`** above **Stack 1** (top **`[4]`**) to watch **`$heldValue > $topValue [Stack 1]`** evaluate **`true`** without moving Stack 1. Bigger blocks stay on **Output**; smaller ones route to **Stack 2**!
- **Preloaded Trace (`Input = [7, 2]`, `Stack 1 = [4]`):**
  1. `PICK_UP [Input]` -> `$heldValue = 7`, `$topValue [Stack 1] = 4` -> `7 > 4` is `true` -> `PLACE [Output]`. (`Stack 1` still `[4]`!)
  2. `PICK_UP [Input]` -> `$heldValue = 2`, `$topValue [Stack 1] = 4` -> `2 > 4` is `false` -> `PLACE [Stack 2]`.

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

### Beat 2 — Safe Empty-Stack Short-Circuit (`stationEmpty [Stack 2] OR ...`)

- **Co-Pilot Card (`<= 2` sentences):** Peeking **`$topValue`** on an empty stack triggers **`TYPE_ERROR`** because there is no top number! Put **`stationEmpty [Stack 2] OR ...`** first so an empty stack skips the peek safely.

```json
{
  "scopes": {
    "MAIN": [
      { "op": "PICK_UP", "station": "INPUT" },
      {
        "op": "IF",
        "cond": {
          "op": "OR",
          "left": { "op": "SENSOR", "sensor": "stationEmpty", "station": "STACK_2" },
          "right": { "op": "CMP", "operator": ">", "left": "$heldValue", "right": "$topValue[STACK_2]" }
        },
        "then": [{ "op": "PLACE", "station": "STACK_2" }],
        "else": [{ "op": "PLACE", "station": "OUTPUT" }]
      }
    ]
  }
}
```

| Demo Mode | `Stack 2` State | `$heldValue` | Outcome |
| :--- | :--- | :---: | :--- |
| **Unguarded Peek (`$heldValue > $topValue[STACK_2]`)** | Empty `[]` | `5` | Raises **`TYPE_ERROR`** (empty top peek) |
| **Short-Circuit Guard (`stationEmpty OR >`)** | Empty `[]` | `5` | Left side `true` -> short-circuits -> `PLACE [STACK_2]` |
| **Short-Circuit Guard (`stationEmpty OR >`)** | `[9]` | `5` | Left `false` -> checks `5 > 9` (`false`) -> `PLACE [OUTPUT]` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Remove `$topColor` Here?** `$topColor` is introduced later in Module `args` / typed inspections. Restricting `cmp.6`–`cmp.8` strictly to **Numbered Toy Blocks** (`$heldValue` and `$topValue`) avoids premature mixed-type rules while teaching left-to-right short-circuit `OR` before [`cmp.8`](./lesson_cmp_8_maximum_crate_hunter.md).

</details>
