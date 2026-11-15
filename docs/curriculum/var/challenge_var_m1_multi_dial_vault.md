# Mastery Challenge `var.M1` — Multi-Dial Vault Combination

| Field | Value |
| :--- | :--- |
| **ID** | `var.M1` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Multi-Dial Vault Combination |
| **Format** | `🔥` Grid Mastery Challenge (`0`-Starter, Partial `?` Help + Full Solution, `4` Variants) |
| **Environment** | Robot Grid (`🤖`) |
| **Legacy ID** | `C6.1` |
| **Slot Cap** | `20` flat blocks |
| **Edit Delta** | `14` (`0` starter blocks -> `14` solution blocks; optional `partialHelp` fills structure with `?`) |
| **Variables Allowed** | `["a", "b", "c", "d", "e"]` |
| **Sensors / Operators** | `["$tileDial"]`, `["+", "-", "*"]` |

---

## One-Concept Goal

Read three sequential calibration dials (`a`, `b`, `c`), compute **two distinct 3-address formulas (`d = a + b` and `e = b * 2`)**, retrieve the 1-slot Vault Core (`PICK_UP`), activate the Vault Switch (`USE_DROP`) to unshutter `🏁 1/1`, and walk `MOVE_FWD [×c]` onto the Goal across 4 randomized Vault combinations.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- As a `🔥` Mastery Challenge, the workspace opens **empty (`0` starter blocks)** with an optional **Partial `?` Hint** button (`partialHelp` below) and a full `referenceSolution`.
- **1-Slot Vault Mechanics:** There are zero `🔒` padlock gates. The Vault Power Core (`📦` at `(4 + d, 9)`) must be picked up (`PICK_UP`) at the East corner and dropped (`USE_DROP`) onto the Vault Floor Switch (`🔘` at `(4 + d, 9 - e)`) so shuttered Goal `🏁 1/1` opens `c` tiles further North (`requireEmptyBackpackAtGoal: true`).
- **Why the open Vault Chamber `(7..9, 1..9)` stops cheats:** Because cols `7`, `8`, and `9` are open floor all the way from `y = 9` to `y = 1`, learners cannot use `While [pathClearAhead]` — exact arithmetic `d = a + b`, `e = b * 2`, and `c` are strictly required.

</details>

---

## Environment Setup & Grid Layouts (`4` Variants, `11×11` Grid)

```text
Shared Open Vault Topology (cols 7..9 open y: 1..9):
   0 1 2 3 4 5 6 7 8 9 10
 0 # # # # # # # # # # #
 1 # # # # # # # . . . #
 2 # # # # # # # . . . #
 3 # # # # # # # . . . #
 4 # # # # # # # . . . #
 5 # # # # # # # . . . #
 6 # # # # # # # . . . #
 7 # # # # # # # . . . #
 8 # # # # # # # . . . #
 9 # > A B C . . . . . #
10 # # # # # # # # # # #

Variant Placements:
- V1 (a=1, b=2, c=1 -> d=3, e=4): Core (7,9) -> Switch (7,5) -> Goal (7,4)
- V2 (a=3, b=1, c=2 -> d=4, e=2): Core (8,9) -> Switch (8,7) -> Goal (8,5)
- V3 (a=2, b=3, c=1 -> d=5, e=6): Core (9,9) -> Switch (9,3) -> Goal (9,2)
- V4 (a=1, b=3, c=2 -> d=4, e=6): Core (8,9) -> Switch (8,3) -> Goal (8,1)

Legend: > Start (1, 9) E | A, B, C Rotary Dials at (2,9), (3,9), (4,9) | . Open Floor | # Wall
```

```json
{
  "width": 11,
  "height": 11,
  "maxTicks": 80,
  "strictInteractionCollision": true,
  "requireAllItemsCollected": false,
  "requireEmptyBackpackAtGoal": true,
  "sharedWalkable": [
    [1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],
    [7,8],[8,8],[9,8],[7,7],[8,7],[9,7],[7,6],[8,6],[9,6],
    [7,5],[8,5],[9,5],[7,4],[8,4],[9,4],[7,3],[8,3],[9,3],
    [7,2],[8,2],[9,2],[7,1],[8,1],[9,1]
  ],
  "variants": [
    {
      "id": "v1_121",
      "start": { "x": 1, "y": 9, "facing": "E" },
      "dials": [{ "x": 2, "y": 9, "value": 1 }, { "x": 3, "y": 9, "value": 2 }, { "x": 4, "y": 9, "value": 1 }],
      "items": [{ "id": "core_0", "x": 7, "y": 9, "kind": "vault_core" }],
      "switches": [{ "id": "sw_0", "x": 7, "y": 5, "order": 0 }],
      "goal": { "x": 7, "y": 4, "requiredSwitches": ["sw_0"] }
    },
    {
      "id": "v2_312",
      "start": { "x": 1, "y": 9, "facing": "E" },
      "dials": [{ "x": 2, "y": 9, "value": 3 }, { "x": 3, "y": 9, "value": 1 }, { "x": 4, "y": 9, "value": 2 }],
      "items": [{ "id": "core_0", "x": 8, "y": 9, "kind": "vault_core" }],
      "switches": [{ "id": "sw_0", "x": 8, "y": 7, "order": 0 }],
      "goal": { "x": 8, "y": 5, "requiredSwitches": ["sw_0"] }
    },
    {
      "id": "v3_231",
      "start": { "x": 1, "y": 9, "facing": "E" },
      "dials": [{ "x": 2, "y": 9, "value": 2 }, { "x": 3, "y": 9, "value": 3 }, { "x": 4, "y": 9, "value": 1 }],
      "items": [{ "id": "core_0", "x": 9, "y": 9, "kind": "vault_core" }],
      "switches": [{ "id": "sw_0", "x": 9, "y": 3, "order": 0 }],
      "goal": { "x": 9, "y": 2, "requiredSwitches": ["sw_0"] }
    },
    {
      "id": "v4_132",
      "start": { "x": 1, "y": 9, "facing": "E" },
      "dials": [{ "x": 2, "y": 9, "value": 1 }, { "x": 3, "y": 9, "value": 3 }, { "x": 4, "y": 9, "value": 2 }],
      "items": [{ "id": "core_0", "x": 8, "y": 9, "kind": "vault_core" }],
      "switches": [{ "id": "sw_0", "x": 8, "y": 3, "order": 0 }],
      "goal": { "x": 8, "y": 1, "requiredSwitches": ["sw_0"] }
    }
  ]
}
```

---

## Palette, Guardrails & Anti-Bypass

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "VAR_ASSIGN", "VAR_OP"],
  "allowedVariableNames": ["a", "b", "c", "d", "e"],
  "allowedValueSensors": ["$tileDial"],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "slotCap": 20,
  "starterBlocks": 0,
  "solutionBlocks": 14,
  "editDelta": 14,
  "antiBypassRules": [
    "All 4 variants (`d ∈ {3,4,5,4}`, `e ∈ {4,2,6,6}`, `c ∈ {1,2,1,2}`) must pass in one submission.",
    "Pairs `(a,b)` distinguish `a + b` from `b * 2` and `a * b` (`(1,2)->3 vs 4`, `(3,1)->4 vs 2`, `(2,3)->5 vs 6`, `(1,3)->4 vs 6`).",
    "Open chamber `(7..9, 1..9)` leaves walls away from target coordinates, blocking `While` wall-walking cheats (`While` is also omitted from palette).",
    "`requireEmptyBackpackAtGoal: true` forces `PICK_UP` at `(4+d, 9)` and `USE_DROP` onto `sw_0` at `(4+d, 9-e)` before final `MOVE_FWD [×c]`."
  ]
}
```

---

## Starter, Partial `?` Help & Reference Solution

### Starter (`0` Blocks — Mastery Challenge)

```json
{ "MAIN": [] }
```

### Partial Help (`?` Hint Structure, `14` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "a", "value": "$tileDial" },
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "b", "value": "$tileDial" },
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "c", "value": "$tileDial" },
    { "op": "VAR_OP", "target": "d", "operator": "+", "left": "a", "right": "?" },
    { "op": "VAR_OP", "target": "e", "operator": "*", "left": "b", "right": "?" },
    { "op": "MOVE_FWD", "repeat": "?" },
    { "op": "PICK_UP" },
    { "op": "TURN_LEFT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "?" },
    { "op": "USE_DROP" },
    { "op": "MOVE_FWD", "repeat": "?" }
  ]
}
```

### Reference Solution (`14` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "a", "value": "$tileDial" },
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "b", "value": "$tileDial" },
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "c", "value": "$tileDial" },
    { "op": "VAR_OP", "target": "d", "operator": "+", "left": "a", "right": "b" },
    { "op": "VAR_OP", "target": "e", "operator": "*", "left": "b", "right": 2 },
    { "op": "MOVE_FWD", "repeat": "d" },
    { "op": "PICK_UP" },
    { "op": "TURN_LEFT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "e" },
    { "op": "USE_DROP" },
    { "op": "MOVE_FWD", "repeat": "c" }
  ]
}
```

---

## Execution Trace Across All `4` Variants

| Phase | Steps | V1 `(1, 2, 1)` | V2 `(3, 1, 2)` | V3 `(2, 3, 1)` | V4 `(1, 3, 2)` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Read Dials | `FWD, a, FWD, b, FWD, c` | `(4,9,E)`, `a=1,b=2,c=1` | `(4,9,E)`, `a=3,b=1,c=2` | `(4,9,E)`, `a=2,b=3,c=1` | `(4,9,E)`, `a=1,b=3,c=2` |
| Compute | `d = a + b`, `e = b * 2` | `d = 3`, `e = 4` | `d = 4`, `e = 2` | `d = 5`, `e = 6` | `d = 4`, `e = 6` |
| Bridge 1 | `MOVE_FWD [×d]`, `PICK_UP`, `LEFT` | `(7,9,N)` holding `core_0` | `(8,9,N)` holding `core_0` | `(9,9,N)` holding `core_0` | `(8,9,N)` holding `core_0` |
| Bridge 2 | `MOVE_FWD [×e]`, `USE_DROP` | `(7,5,N)`, `sw_0` `1/1`, empty | `(8,7,N)`, `sw_0` `1/1`, empty | `(9,3,N)`, `sw_0` `1/1`, empty | `(8,3,N)`, `sw_0` `1/1`, empty |
| Vault Goal | `MOVE_FWD [×c]` | `(7, 4, N)` `🏁` Victory | `(8, 5, N)` `🏁` Victory | `(9, 2, N)` `🏁` Victory | `(8, 1, N)` `🏁` Victory |
