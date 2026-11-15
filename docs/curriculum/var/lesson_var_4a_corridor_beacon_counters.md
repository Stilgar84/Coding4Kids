# Lesson `var.4a` — Corridor Beacon Counters

| Field | Value |
| :--- | :--- |
| **ID** | `var.4a` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Corridor Beacon Counters |
| **Format** | `🤖` Interactive Grid Puzzle (`4` Variant Maps) |
| **Environment** | Robot Grid (`🤖`) |
| **Legacy ID** | `6.4a` *(new bridge)* |
| **Slot Cap** | `12` flat blocks |
| **Edit Delta** | `3` (Starter `6` blocks -> Solution `9` blocks) |
| **Variables Allowed** | `["c"]` (`VAR_ASSIGN` + `VAR_OP` with `+`, `-`, `*`) |
| **Sensors / Operators** | `["pathClearAhead", "tileColor == Red"]`, `["+", "-", "*"]` |

---

## One-Concept Goal

Use a counter variable (`c = 0`) inside a **`While [pathClearAhead]` + `If [tileColor == Red]`** scan loop to tally floor beacons along a corridor, then turn and walk `MOVE_FWD [×c]` to the exact matching Goal bay.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- This critical bridge connects `while` + `branch` (`If [tileColor == Red]`) directly with `var.3`'s counter pattern (`c = c + 1`) before the `var.A` Capstone adds 1-slot inventory handling.
- Point out why `Red` beacons never appear on the Start tile `(1, 1)`: the loop runs `MOVE_FWD` first (`(2,1)..(7,1)`), then checks `If [tileColor == Red]` on the tile it just landed on.
- Notice why the vertical shaft `(7, 2)..(7, 6)` stays open floor across **all 4 variants**: a second `While [pathClearAhead]` would walk straight past `🏁` to `(7, 6)` and fail Variants 1–3, ensuring only the exact tally `c` succeeds.

</details>

---

## Environment Setup & Grid Layouts (`4` Variants, `9×8` Grid)

```text
Variant 1 (c = 2 Red -> Goal (7, 3)):      Variant 2 (c = 3 Red -> Goal (7, 4)):
  0 1 2 3 4 5 6 7 8                          0 1 2 3 4 5 6 7 8
0 # # # # # # # # #                        0 # # # # # # # # #
1 # > . R . . R . #                        1 # > R . R . R . #
2 # # # # # # # . #                        2 # # # # # # # . #
3 # # # # # # # F #                        3 # # # # # # # . #
4 # # # # # # # . #                        4 # # # # # # # F #
5 # # # # # # # . #                        5 # # # # # # # . #
6 # # # # # # # . #                        6 # # # # # # # . #
7 # # # # # # # # #                        7 # # # # # # # # #

Variant 3 (c = 4 Red -> Goal (7, 5)):      Variant 4 (c = 5 Red -> Goal (7, 6)):
  0 1 2 3 4 5 6 7 8                          0 1 2 3 4 5 6 7 8
0 # # # # # # # # #                        0 # # # # # # # # #
1 # > R R . R . R #                        1 # > R R R R . R #
2 # # # # # # # . #                        2 # # # # # # # . #
3 # # # # # # # . #                        3 # # # # # # # . #
4 # # # # # # # . #                        4 # # # # # # # . #
5 # # # # # # # F #                        5 # # # # # # # . #
6 # # # # # # # . #                        6 # # # # # # # F #
7 # # # # # # # # #                        7 # # # # # # # # #

Legend: > Start (1, 1) E | R Red Beacon (`tileColor: red`) | . Open Floor | F Goal | # Wall
```

```json
{
  "width": 9,
  "height": 8,
  "maxTicks": 60,
  "sharedWalkable": [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  "variants": [
    {
      "id": "v1_red2",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 3, "y": 1, "color": "red" }, { "x": 6, "y": 1, "color": "red" }],
      "goal": { "x": 7, "y": 3 }
    },
    {
      "id": "v2_red3",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 2, "y": 1, "color": "red" }, { "x": 4, "y": 1, "color": "red" }, { "x": 6, "y": 1, "color": "red" }],
      "goal": { "x": 7, "y": 4 }
    },
    {
      "id": "v3_red4",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 2, "y": 1, "color": "red" }, { "x": 3, "y": 1, "color": "red" }, { "x": 5, "y": 1, "color": "red" }, { "x": 7, "y": 1, "color": "red" }],
      "goal": { "x": 7, "y": 5 }
    },
    {
      "id": "v4_red5",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 2, "y": 1, "color": "red" }, { "x": 3, "y": 1, "color": "red" }, { "x": 4, "y": 1, "color": "red" }, { "x": 5, "y": 1, "color": "red" }, { "x": 7, "y": 1, "color": "red" }],
      "goal": { "x": 7, "y": 6 }
    }
  ]
}
```

---

## Palette, Guardrails & Anti-Bypass

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["WHILE", "END_WHILE", "IF", "END_IF", "VAR_ASSIGN", "VAR_OP"],
  "allowedVariableNames": ["c"],
  "allowedValueSensors": [],
  "allowedConditionSensors": ["pathClearAhead", "tileColor"],
  "allowedConditionColors": ["red"],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "slotCap": 12,
  "starterBlocks": 6,
  "solutionBlocks": 9,
  "editDelta": 3,
  "antiBypassRules": [
    "All 4 corridor variants (`c = 2, 3, 4, 5`) share the identical open layout (`(1..7,1)` + `(7,2..6)`) so hardcoded strides fail on 3 out of 4 maps.",
    "Because open floor in column `7` continues all the way down to `(7, 6)` on every variant, a second `While [pathClearAhead]` overshoots `🏁` on Variants 1, 2, and 3.",
    "`atGoal` sensor is disabled; victory is evaluated strictly at end-of-program."
  ]
}
```

---

## Starter Code & Reference Solution

### Starter (`6` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    {
      "op": "WHILE",
      "cond": { "sensor": "pathClearAhead" },
      "body": [
        { "op": "MOVE_FWD" }
      ]
    },
    { "op": "TURN_RIGHT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": 1 }
  ]
}
```

### Partial Hint (`?` Form, `9` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    {
      "op": "WHILE",
      "cond": { "sensor": "pathClearAhead" },
      "body": [
        { "op": "MOVE_FWD" },
        {
          "op": "IF",
          "cond": { "sensor": "tileColor", "operator": "==", "value": "red" },
          "then": [
            { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": "?" }
          ]
        }
      ]
    },
    { "op": "TURN_RIGHT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "?" }
  ]
}
```

### Reference Solution (`9` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    {
      "op": "WHILE",
      "cond": { "sensor": "pathClearAhead" },
      "body": [
        { "op": "MOVE_FWD" },
        {
          "op": "IF",
          "cond": { "sensor": "tileColor", "operator": "==", "value": "red" },
          "then": [
            { "op": "VAR_OP", "target": "c", "operator": "+", "left": "c", "right": 1 }
          ]
        }
      ]
    },
    { "op": "TURN_RIGHT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "c" }
  ]
}
```

---

## Execution Trace Across All `4` Variants

| Phase | Action | V1 (`2 Red`) | V2 (`3 Red`) | V3 (`4 Red`) | V4 (`5 Red`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Init | `c = 0` | `(1, 1, E)`, `c = 0` | `(1, 1, E)`, `c = 0` | `(1, 1, E)`, `c = 0` | `(1, 1, E)`, `c = 0` |
| Scan Loop | `6` `MOVE_FWD` steps `(2,1)..(7,1)` | `(7, 1, E)`, `c = 2` | `(7, 1, E)`, `c = 3` | `(7, 1, E)`, `c = 4` | `(7, 1, E)`, `c = 5` |
| Turn | `TURN_RIGHT [90]` | `(7, 1, S)` | `(7, 1, S)` | `(7, 1, S)` | `(7, 1, S)` |
| Exit Stride | `MOVE_FWD [×c]` | `(7, 3, S)` `🏁` | `(7, 4, S)` `🏁` | `(7, 5, S)` `🏁` | `(7, 6, S)` `🏁` |
