# Lesson `var.2` — Reading & Recalling a Dial Value

| Field | Value |
| :--- | :--- |
| **ID** | `var.2` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Reading & Recalling a Dial Value |
| **Format** | `🤖` Interactive Grid Puzzle (`3` Variant Maps) |
| **Environment** | Robot Grid (`🤖`) |
| **Legacy ID** | `6.2` *(new)* |
| **Slot Cap** | `8` flat blocks |
| **Edit Delta** | `3` (Starter `2` blocks -> Solution `5` blocks) |
| **Variables Allowed** | `["d"]` (`VAR_ASSIGN` ONLY; `VAR_OP` locked) |
| **Sensors / Operators** | `["$tileDial"]` (`0` when not standing on a dial tile) |

---

## One-Concept Goal

Read `$tileDial` **once** into variable `d` before leaving the calibration tile, then **recall `[d]` across two separated `MOVE_FWD [×d]` corridors** after `$tileDial` has returned `0`.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- Notice why there is only **one** dial tile at `(2, 5)` and **zero** dial at the East corner: once the robot steps off `(2, 5)`, calling `$tileDial` again returns `0`.
- Across all `3` randomized maps (`d ∈ {2, 3, 4}`), hardcoded literal repeat counts (`×2`, `×3`, `×4`) fail on the other two maps.
- Learners only need to append the two movement strides and the corner turn (`Edit Delta = 3`) using the `[d]` pill already populated in the Memory Tray.

</details>

---

## Environment Setup & Grid Layouts (`3` Variants, `9×7` Grid)

```text
Variant 1 (d = 2 -> Goal (4, 3)):       Variant 2 (d = 3 -> Goal (5, 2)):       Variant 3 (d = 4 -> Goal (6, 1)):
  0 1 2 3 4 5 6 7 8                       0 1 2 3 4 5 6 7 8                       0 1 2 3 4 5 6 7 8
0 # # # # # # # # #                     0 # # # # # # # # #                     0 # # # # # # # # #
1 # # # # # # # # #                     1 # # # # # # # # #                     1 # # # # # # F # #
2 # # # # # # # # #                     2 # # # # # F # # #                     2 # # # # # # . # #
3 # # # # F # # # #                     3 # # # # # . # # #                     3 # # # # # # . # #
4 # # # # . # # # #                     4 # # # # # . # # #                     4 # # # # # # . # #
5 # > D . . # # # #                     5 # > D . . . # # #                     5 # > D . . . . # #
6 # # # # # # # # #                     6 # # # # # # # # #                     6 # # # # # # # # #

Legend: # Wall | > Start (1, 5) facing E | D Dial tile (2, 5) | . Floor | F Goal
```

```json
{
  "width": 9,
  "height": 7,
  "maxTicks": 40,
  "variants": [
    {
      "id": "v1_d2",
      "start": { "x": 1, "y": 5, "facing": "E" },
      "dials": [{ "x": 2, "y": 5, "value": 2 }],
      "goal": { "x": 4, "y": 3 },
      "walkableCorridor": [[1,5],[2,5],[3,5],[4,5],[4,4],[4,3]]
    },
    {
      "id": "v2_d3",
      "start": { "x": 1, "y": 5, "facing": "E" },
      "dials": [{ "x": 2, "y": 5, "value": 3 }],
      "goal": { "x": 5, "y": 2 },
      "walkableCorridor": [[1,5],[2,5],[3,5],[4,5],[5,5],[5,4],[5,3],[5,2]]
    },
    {
      "id": "v3_d4",
      "start": { "x": 1, "y": 5, "facing": "E" },
      "dials": [{ "x": 2, "y": 5, "value": 4 }],
      "goal": { "x": 6, "y": 1 },
      "walkableCorridor": [[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[6,4],[6,3],[6,2],[6,1]]
    }
  ]
}
```
*(Every non-corridor cell in the `9×7` grid is a `#` solid wall.)*

---

## Palette, Guardrails & Anti-Bypass

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["VAR_ASSIGN"],
  "allowedVariableNames": ["d"],
  "allowedValueSensors": ["$tileDial"],
  "allowedVarOps": [],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "slotCap": 8,
  "starterBlocks": 2,
  "solutionBlocks": 5,
  "editDelta": 3,
  "antiBypassRules": [
    "All 3 variants must pass in one submission (`d = 2, 3, 4`).",
    "Corner walls block overshooting past `x = 2 + d` or `y = 5 - d`.",
    "No `If` or `While` blocks are available in palette, preventing `while pathClearAhead` sensor-walking bypasses."
  ]
}
```

---

## Starter Code & Reference Solution

### Starter (`2` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "d", "value": "$tileDial" }
  ]
}
```

### Partial Hint (`?` Placeholder Form, `5` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "d", "value": "$tileDial" },
    { "op": "MOVE_FWD", "repeat": "?" },
    { "op": "TURN_LEFT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "?" }
  ]
}
```

### Reference Solution (`5` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "d", "value": "$tileDial" },
    { "op": "MOVE_FWD", "repeat": "d" },
    { "op": "TURN_LEFT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "d" }
  ]
}
```

---

## Execution Trace Across All `3` Variants

| Step | Block | V1 (`d = 2`) | V2 (`d = 3`) | V3 (`d = 4`) |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `MOVE_FWD` | `(2, 5, E)` on Dial `2` | `(2, 5, E)` on Dial `3` | `(2, 5, E)` on Dial `4` |
| 2 | `d = $tileDial` | `d = 2` | `d = 3` | `d = 4` |
| 3 | `MOVE_FWD [×d]` | `(4, 5, E)` (`$tileDial = 0`) | `(5, 5, E)` (`$tileDial = 0`) | `(6, 5, E)` (`$tileDial = 0`) |
| 4 | `TURN_LEFT [90]` | `(4, 5, N)` | `(5, 5, N)` | `(6, 5, N)` |
| 5 | `MOVE_FWD [×d]` | `(4, 3, N)` `🏁` | `(5, 2, N)` `🏁` | `(6, 1, N)` `🏁` |
