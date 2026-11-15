# Capstone `var.A` — Inventory Quartermaster

| Field | Value |
| :--- | :--- |
| **ID** | `var.A` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Inventory Quartermaster |
| **Format** | `🏆` Interactive Grid Capstone (`4` Variant Maps) |
| **Environment** | Robot Grid (`🤖`) |
| **Legacy ID** | `6A` |
| **Slot Cap** | `15` flat blocks |
| **Edit Delta** | `8` (Starter `4` blocks -> Solution `12` blocks) |
| **Variables Allowed** | `["c"]` |
| **Sensors / Operators** | `["pathClearAhead", "tileColor == Red"]`, `["+", "-", "*"]` |

---

## One-Concept Goal

Combine a `While` sensor scan, `If [tileColor == Red]` counter (`c = c + 1`), **strict 1-slot shoulder pickup (`PICK_UP`)**, dynamic `MOVE_FWD [×c]` delivery stride, and Floor Switch activation (`USE_DROP`) to unlock a shuttered Goal (`🏁 1/1`) across 4 randomized warehouse bays.

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **1-Slot Gripper Contract:** There is NO `BackpackHud` (`🎒`) and NO `itemDamaged` mechanic. The robot carries at most **one** Energy Cell (`📦` at `(7, 1)`) in its visible shoulder gripper (`strictInteractionCollision: true`, `requireEmptyBackpackAtGoal: true`).
- **How Shuttered Goal `🏁 1/1` Works:** Each variant places **one** active Floor Switch (`🔘`) at `(7, 1 + c)`. Dropping the Energy Cell onto `(7, 1 + c)` via `USE_DROP` latches `isPressed = true` even after the robot steps onto `🏁` at `(7, 2 + c)`.
- Because the entire vertical Calibration Shaft `(7, 2..6)` stays open floor across all `4` variants, using `While [pathClearAhead]` inside the shaft overshoots Switch `1..3` and drops the cell in the wrong place or misses `🏁`!

</details>

---

## Environment Setup & Grid Layouts (`4` Variants, `9×8` Grid)

```text
Variant 1 (c = 1 Red -> Switch (7,2) -> Goal (7,3)):   Variant 2 (c = 2 Red -> Switch (7,3) -> Goal (7,4)):
  0 1 2 3 4 5 6 7 8                                      0 1 2 3 4 5 6 7 8
0 # # # # # # # # #                                    0 # # # # # # # # #
1 # > . . R . . K #                                    1 # > . R . R . K #
2 # # # # # # # S #                                    2 # # # # # # # . #
3 # # # # # # # F #                                    3 # # # # # # # S #
4 # # # # # # # . #                                    4 # # # # # # # F #
5 # # # # # # # . #                                    5 # # # # # # # . #
6 # # # # # # # . #                                    6 # # # # # # # . #
7 # # # # # # # # #                                    7 # # # # # # # # #

Variant 3 (c = 3 Red -> Switch (7,4) -> Goal (7,5)):   Variant 4 (c = 4 Red -> Switch (7,5) -> Goal (7,6)):
  0 1 2 3 4 5 6 7 8                                      0 1 2 3 4 5 6 7 8
0 # # # # # # # # #                                    0 # # # # # # # # #
1 # > R . R . R K #                                    1 # > R R . R R K #
2 # # # # # # # . #                                    2 # # # # # # # . #
3 # # # # # # # . #                                    3 # # # # # # # . #
4 # # # # # # # S #                                    4 # # # # # # # . #
5 # # # # # # # F #                                    5 # # # # # # # S #
6 # # # # # # # . #                                    6 # # # # # # # F #
7 # # # # # # # # #                                    7 # # # # # # # # #

Legend: > Start (1, 1) E | R Red Beacon (`tileColor: red`) | K Energy Cell (7, 1) | S Floor Switch | F Shuttered Goal 1/1 | . Open Floor | # Wall
```

```json
{
  "width": 9,
  "height": 8,
  "maxTicks": 75,
  "strictInteractionCollision": true,
  "requireAllItemsCollected": false,
  "requireEmptyBackpackAtGoal": true,
  "sharedWalkable": [[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  "variants": [
    {
      "id": "v1_bay1",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 4, "y": 1, "color": "red" }],
      "items": [{ "id": "cell_0", "x": 7, "y": 1, "kind": "energy_cell" }],
      "switches": [{ "id": "sw_0", "x": 7, "y": 2, "order": 0 }],
      "goal": { "x": 7, "y": 3, "requiredSwitches": ["sw_0"] }
    },
    {
      "id": "v2_bay2",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 3, "y": 1, "color": "red" }, { "x": 5, "y": 1, "color": "red" }],
      "items": [{ "id": "cell_0", "x": 7, "y": 1, "kind": "energy_cell" }],
      "switches": [{ "id": "sw_0", "x": 7, "y": 3, "order": 0 }],
      "goal": { "x": 7, "y": 4, "requiredSwitches": ["sw_0"] }
    },
    {
      "id": "v3_bay3",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 2, "y": 1, "color": "red" }, { "x": 4, "y": 1, "color": "red" }, { "x": 6, "y": 1, "color": "red" }],
      "items": [{ "id": "cell_0", "x": 7, "y": 1, "kind": "energy_cell" }],
      "switches": [{ "id": "sw_0", "x": 7, "y": 4, "order": 0 }],
      "goal": { "x": 7, "y": 5, "requiredSwitches": ["sw_0"] }
    },
    {
      "id": "v4_bay4",
      "start": { "x": 1, "y": 1, "facing": "E" },
      "beacons": [{ "x": 2, "y": 1, "color": "red" }, { "x": 3, "y": 1, "color": "red" }, { "x": 5, "y": 1, "color": "red" }, { "x": 6, "y": 1, "color": "red" }],
      "items": [{ "id": "cell_0", "x": 7, "y": 1, "kind": "energy_cell" }],
      "switches": [{ "id": "sw_0", "x": 7, "y": 5, "order": 0 }],
      "goal": { "x": 7, "y": 6, "requiredSwitches": ["sw_0"] }
    }
  ]
}
```

---

## Palette, Guardrails & Anti-Bypass

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"],
  "allowedControlBlocks": ["WHILE", "END_WHILE", "IF", "END_IF", "VAR_ASSIGN", "VAR_OP"],
  "allowedVariableNames": ["c"],
  "allowedValueSensors": [],
  "allowedConditionSensors": ["pathClearAhead", "tileColor"],
  "allowedConditionColors": ["red"],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "slotCap": 15,
  "starterBlocks": 4,
  "solutionBlocks": 12,
  "editDelta": 8,
  "antiBypassRules": [
    "All 4 bays (`c = 1, 2, 3, 4`) must pass in a single submission.",
    "Only 1 Energy Cell exists (`(7, 1)`), so placing it on the wrong bay leaves `sw_0` unpressed and the Goal shutter closed (`0/1`).",
    "`requireEmptyBackpackAtGoal: true` rejects carrying the Energy Cell onto `🏁` without pressing `sw_0` via `USE_DROP`."
  ]
}
```

---

## Starter Code, Partial Hint & Reference Solution

### Starter (`4` Flat Blocks)

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
    }
  ]
}
```

### Partial Hint (`?` Form, `12` Flat Blocks)

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
    { "op": "PICK_UP" },
    { "op": "TURN_RIGHT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "?" },
    { "op": "USE_DROP" },
    { "op": "MOVE_FWD" }
  ]
}
```

### Reference Solution (`12` Flat Blocks)

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
    { "op": "PICK_UP" },
    { "op": "TURN_RIGHT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "c" },
    { "op": "USE_DROP" },
    { "op": "MOVE_FWD" }
  ]
}
```

---

## Execution Trace Across All `4` Variants

| Phase | Action | V1 (`c = 1`) | V2 (`c = 2`) | V3 (`c = 3`) | V4 (`c = 4`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Scan | `While pathClearAhead` `(2,1)..(7,1)` | `(7,1,E), c=1` | `(7,1,E), c=2` | `(7,1,E), c=3` | `(7,1,E), c=4` |
| Pickup | `PICK_UP`, `TURN_RIGHT` | Gripper `cell_0`, `(7,1,S)` | Gripper `cell_0`, `(7,1,S)` | Gripper `cell_0`, `(7,1,S)` | Gripper `cell_0`, `(7,1,S)` |
| Deliver | `MOVE_FWD [×c]` | `(7, 2, S)` on `sw_0` | `(7, 3, S)` on `sw_0` | `(7, 4, S)` on `sw_0` | `(7, 5, S)` on `sw_0` |
| Unlock | `USE_DROP` | `sw_0` pressed (`1/1`), empty | `sw_0` pressed (`1/1`), empty | `sw_0` pressed (`1/1`), empty | `sw_0` pressed (`1/1`), empty |
| Finish | `MOVE_FWD` | `(7, 3, S)` `🏁` Victory | `(7, 4, S)` `🏁` Victory | `(7, 5, S)` `🏁` Victory | `(7, 6, S)` `🏁` Victory |
