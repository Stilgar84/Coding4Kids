# Lesson `var.4` — Stepping Counters & Arithmetic Spirals

| Field | Value |
| :--- | :--- |
| **ID** | `var.4` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Stepping Counters & Arithmetic Spirals |
| **Format** | `🤖` Interactive Grid Puzzle (`3` Variant Maps) |
| **Environment** | Robot Grid (`🤖`) |
| **Legacy ID** | `6.4` *(new)* |
| **Slot Cap** | `9` flat blocks |
| **Edit Delta** | `3` (Starter `4` blocks -> Solution `6` blocks) |
| **Variables Allowed** | `["s"]` (`VAR_ASSIGN` + `VAR_OP` with `+`, `-`, `*`) |
| **Sensors / Operators** | `["$tileDial"]`, `["+", "-", "*"]` |

---

## One-Concept Goal

Combine a runtime starting sensor (`s = $tileDial`) with an **in-loop self-updating counter (`s = s + 1`)** so a `Loop ×3` spiral adapts cleanly across three different starting dial values.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- Notice how the robot starts directly on top of the dial tile at `(5, 2)`! On tick 1, `s = $tileDial` reads the initial arm length (`1`, `2`, or `3` depending on the active test variant), and each of the `3` spiral turns adds `+1` (`s = s + 1`).
- Why can't learners unroll this without `s = s + 1`? Because the spiral arms grow from `1 -> 2 -> 3` in Variant 1, `2 -> 3 -> 4` in Variant 2, and `3 -> 4 -> 5` in Variant 3, landing on three distinct Goals `(3,4)`, `(3,5)`, and `(3,6)`.
- This prepares learners directly for unbounded spiral growth (`a = a + k`) in LOGO `var.5`.

</details>

---

## Environment Setup & Grid Layouts (`3` Variants, `10×8` Grid)

```text
Variant 1 (dial = 1 -> Goal (3, 4)):     Variant 2 (dial = 2 -> Goal (3, 5)):     Variant 3 (dial = 3 -> Goal (3, 6)):
  0 1 2 3 4 5 6 7 8 9                      0 1 2 3 4 5 6 7 8 9                      0 1 2 3 4 5 6 7 8 9
0 # # # # # # # # # #                    0 # # # # # # # # # #                    0 # # # # # # # # # #
1 # # # # # # # # # #                    1 # # # # # # # # # #                    1 # # # # # # # # # #
2 # # # # # > . # # #                    2 # # # # # > . . # #                    2 # # # # # > . . . #
3 # # # # # # . # # #                    3 # # # # # # # . # #                    3 # # # # # # # # . #
4 # # # F . . . # # #                    4 # # # # # # # . # #                    4 # # # # # # # # . #
5 # # # # # # # # # #                    5 # # # F . . . . # #                    5 # # # # # # # # . #
6 # # # # # # # # # #                    6 # # # # # # # # # #                    6 # # # F . . . . . #
7 # # # # # # # # # #                    7 # # # # # # # # # #                    7 # # # # # # # # # #

Legend: > Start & Dial (5, 2) facing E | . Walkable Spiral | F Variant Goal | # Wall
```

```json
{
  "width": 10,
  "height": 8,
  "maxTicks": 50,
  "variants": [
    {
      "id": "v1_d1",
      "start": { "x": 5, "y": 2, "facing": "E" },
      "dials": [{ "x": 5, "y": 2, "value": 1 }],
      "goal": { "x": 3, "y": 4 },
      "walkableCorridor": [[5,2],[6,2],[6,3],[6,4],[5,4],[4,4],[3,4]]
    },
    {
      "id": "v2_d2",
      "start": { "x": 5, "y": 2, "facing": "E" },
      "dials": [{ "x": 5, "y": 2, "value": 2 }],
      "goal": { "x": 3, "y": 5 },
      "walkableCorridor": [[5,2],[6,2],[7,2],[7,3],[7,4],[7,5],[6,5],[5,5],[4,5],[3,5]]
    },
    {
      "id": "v3_d3",
      "start": { "x": 5, "y": 2, "facing": "E" },
      "dials": [{ "x": 5, "y": 2, "value": 3 }],
      "goal": { "x": 3, "y": 6 },
      "walkableCorridor": [[5,2],[6,2],[7,2],[8,2],[8,3],[8,4],[8,5],[8,6],[7,6],[6,6],[5,6],[4,6],[3,6]]
    }
  ]
}
```

---

## Palette, Guardrails & Anti-Bypass

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "VAR_ASSIGN", "VAR_OP"],
  "allowedVariableNames": ["s"],
  "allowedValueSensors": ["$tileDial"],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "slotCap": 9,
  "starterBlocks": 4,
  "solutionBlocks": 6,
  "editDelta": 3,
  "antiBypassRules": [
    "All 3 variants (`dial = 1, 2, 3`) must pass in one run.",
    "No `If` or `While` blocks exist, preventing wall-following bypasses.",
    "Walls tightly hug each spiral turn so fixed step sizes hit walls immediately."
  ]
}
```

---

## Starter Code & Reference Solution

### Starter (`4` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "s", "value": "$tileDial" },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD", "repeat": "s" }
      ]
    }
  ]
}
```

### Partial Hint (`?` Form, `6` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "s", "value": "$tileDial" },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD", "repeat": "s" },
        { "op": "TURN_RIGHT", "angle": 90 },
        { "op": "VAR_OP", "target": "s", "operator": "+", "left": "s", "right": "?" }
      ]
    }
  ]
}
```

### Reference Solution (`6` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "s", "value": "$tileDial" },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD", "repeat": "s" },
        { "op": "TURN_RIGHT", "angle": 90 },
        { "op": "VAR_OP", "target": "s", "operator": "+", "left": "s", "right": 1 }
      ]
    }
  ]
}
```

---

## Execution Trace Across All `3` Variants

| Loop Turn | Action | V1 (`d = 1`) | V2 (`d = 2`) | V3 (`d = 3`) |
| :---: | :--- | :--- | :--- | :--- |
| Init | `s = $tileDial` | `(5, 2, E)`, `s = 1` | `(5, 2, E)`, `s = 2` | `(5, 2, E)`, `s = 3` |
| Turn 1 | `FWD ×s`, `RIGHT 90`, `s = s + 1` | `(6, 2, S)`, `s = 2` | `(7, 2, S)`, `s = 3` | `(8, 2, S)`, `s = 4` |
| Turn 2 | `FWD ×s`, `RIGHT 90`, `s = s + 1` | `(6, 4, W)`, `s = 3` | `(7, 5, W)`, `s = 4` | `(8, 6, W)`, `s = 5` |
| Turn 3 | `FWD ×s`, `RIGHT 90`, `s = s + 1` | `(3, 4, N)` `🏁`, `s = 4` | `(3, 5, N)` `🏁`, `s = 5` | `(3, 6, N)` `🏁`, `s = 6` |
