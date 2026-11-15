# Lesson `cmp.8` — Maximum Numbered Block Hunter (`stationEmpty OR $heldValue > $topValue`)

> [← `cmp.7`](./lesson_cmp_7_count_and_provision.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md) · **Next:** [`cmp.9` →](./lesson_cmp_9_fix_boundary_weight_gate.md)

---

## 1. One-Concept Goal

Scan an **Input** line of any length while holding only **1 block at a time**: keep the running maximum on **Stack 1** via **`stationEmpty [Stack 1] OR $heldValue > $topValue [Stack 1]`**, park smaller blocks on **Stack 2** (swapping safely through **Stack 3** inside `F1`), and send the winning champion to **Output**.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `depot` (`ENV_VERSION_DEPOT_V4 = 4`) | **`enforceHanoiRule: false`**, **`requireEmptyStacks: false`** (discards stay safely on `STACK_2`); active stations: `INPUT`, `STACK_1`, `STACK_2`, `STACK_3`, `OUTPUT` |
| **Palette (`Control & Fns`)** | `WHILE`, `IF / ELSE`, `OR`, `CALL_FN (F1)` | Both `MAIN` and `F1` editable; short-circuit `OR` mandatory |
| **Palette (`Actions`)** | `PICK_UP`, `PLACE` | Strictly 1-block hand; `STACK_3` serves as 1-block swap bay |
| **Palette (`Sensors & Ops`)** | `hasItem`, `stationEmpty`, `$heldValue`, `$topValue`, `>` | No `$topColor` |
| **Block Budget** | `slotCap: 12/tab`, `par: MAIN 10, F1 7 (17 total)`, `Starter: MAIN 6, F1 7`, `Edit Delta: 6` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN` incomplete `6` blocks; `F1` swap helper pre-loaded `7` blocks)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "WHILE",
        "cond": { "op": "SENSOR", "sensor": "hasItem", "station": "INPUT" },
        "body": [
          { "op": "PICK_UP", "station": "INPUT" },
          { "op": "PLACE", "station": "STACK_1" }
        ]
      },
      { "op": "PICK_UP", "station": "STACK_1" },
      { "op": "PLACE", "station": "OUTPUT" }
    ],
    "F1": [
      { "op": "PLACE", "station": "STACK_3" },
      {
        "op": "IF",
        "cond": { "op": "SENSOR", "sensor": "hasItem", "station": "STACK_1" },
        "then": [
          { "op": "PICK_UP", "station": "STACK_1" },
          { "op": "PLACE", "station": "STACK_2" }
        ]
      },
      { "op": "PICK_UP", "station": "STACK_3" },
      { "op": "PLACE", "station": "STACK_1" }
    ]
  }
}
```

### Reference Solution (`MAIN: 10`, `F1: 7`, `17` total — `Edit Delta: 6` inside `MAIN`)

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
            "cond": {
              "op": "OR",
              "left": { "op": "SENSOR", "sensor": "stationEmpty", "station": "STACK_1" },
              "right": { "op": "CMP", "operator": ">", "left": "$heldValue", "right": "$topValue[STACK_1]" }
            },
            "then": [{ "op": "CALL_FN", "fn": "F1" }],
            "else": [{ "op": "PLACE", "station": "STACK_2" }]
          }
        ]
      },
      { "op": "PICK_UP", "station": "STACK_1" },
      { "op": "PLACE", "station": "OUTPUT" }
    ],
    "F1": [
      { "op": "PLACE", "station": "STACK_3" },
      {
        "op": "IF",
        "cond": { "op": "SENSOR", "sensor": "hasItem", "station": "STACK_1" },
        "then": [
          { "op": "PICK_UP", "station": "STACK_1" },
          { "op": "PLACE", "station": "STACK_2" }
        ]
      },
      { "op": "PICK_UP", "station": "STACK_3" },
      { "op": "PLACE", "station": "STACK_1" }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Put **`stationEmpty [Stack 1]`** on the LEFT of **`OR`** so the first block safely fills **Stack 1** without peeking an empty stack! **`F1`** swaps any smaller old champion to **Stack 2** via **Stack 3**.

---

## 4. Multi-Run Suite (`4` Variants) & Anti-Bypass Rules

| Variant | `Input` Queue (Pop Order) | Expected `Output` | Expected `Stack 2` Discards | `Stack 1` & `Stack 3` at Halt |
| :---: | :--- | :---: | :--- | :---: |
| **#1** | `[4, 9, 2, 7]` | `[9]` | `[4, 2, 7]` | Empty |
| **#2** | `[12, 5, 8, 11]` (Max first!) | `[12]` | `[5, 8, 11]` | Empty |
| **#3** | `[3, 6, 6, 15, 10]` (Max near end + tie) | `[15]` | `[3, 6, 6, 10]` | Empty |
| **#4** | `[1, 8, 4]` (`3` items) | `[8]` | `[1, 4]` | Empty |

- **`antiBypassRules`:**
  1. Max sits in middle (#1), first (#2), near end (#3), and short queue (#4), defeating `"keep first"`, `"keep last"`, or hardcoded counts.
  2. Reversing the `OR` order (`$heldValue > $topValue[STACK_1] OR stationEmpty[STACK_1]`) immediately fails iteration 1 with **`TYPE_ERROR`** on empty `STACK_1`.
  3. `enforceHanoiRule: false` lets `[2]` stack atop `[4]` on `STACK_2`, and `requireEmptyStacks: false` lets discarded blocks rest on `STACK_2`.

---

## 5. Step-by-Step Execution Trace (Variant #1, `Input = [4, 9, 2, 7]`)

| Step | Held | `stationEmpty[S1]` | `$heldValue > $topValue[S1]` | Action | `Stack 1` | `Stack 2` |
| :---: | :---: | :---: | :--- | :--- | :---: | :--- |
| `1` | `4` | `true` | *(short-circuited)* | `F1`: `4 -> S3 -> S1` | `[4]` | `[]` |
| `2` | `9` | `false` | `9 > 4` -> `true` | `F1`: `9 -> S3`, `4 -> S2`, `9 -> S1` | `[9]` | `[4]` |
| `3` | `2` | `false` | `2 > 9` -> `false` | `ELSE`: `2 -> S2` | `[9]` | `[4, 2]` |
| `4` | `7` | `false` | `7 > 9` -> `false` | `ELSE`: `7 -> S2` | `[9]` | `[4, 2, 7]` |
| `5` | — | — | Loop exits | `PICK_UP [S1]`, `PLACE [OUTPUT]` | `[]` | `[4, 2, 7]` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Real-World Pattern:** Keeping `F1` (1-slot swap via temporary bay `Stack 3`) pre-built keeps the edit focused squarely on **`stationEmpty [Stack 1] OR $heldValue > $topValue [Stack 1]`**—teaching short-circuit safety and running-maximum invariant thinking (`Stack 1` always holds the largest seen so far).

</details>
