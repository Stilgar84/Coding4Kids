# `param.10`: Crates & Weighted Floor Switches (`🤖`)

- **Activity ID:** `param.10` *(Stage 2 Split 3/3 from legacy `2.7` — isolates weighted Floor-Switch Crates before `loop.A`)*
- **Format:** `puzzle`
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `🤖`
- **Concept:** Picking Up a Crate and Dropping It (`USE_DROP`) onto the **Current Tile** to Hold Down a Linked Floor Switch (`isPressed = hasCrateOnTile || hasRobotOnTile`)

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

Unlike Keys and Planks (which act **1 cell ahead**), Crates drop straight down onto the **tile under the robot's feet** (`USE_DROP` on the current tile). Notice the "Aha!" rule (`isPressed = hasCrateOnTile || hasRobotOnTile`): when the robot walks onto the floor switch carrying the crate, the linked door slides open while the robot stands there—but if you walk off still carrying the crate, the door slams shut! Dropping the crate onto the switch lets the door stay open so the robot can sprint through to `🏁`.

</details>

## Palette, SlotCap & Validation Flags

- **Palette (`PaletteConfig`):**
  ```json
  {
    "allowedSimBlocks": ["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"],
    "allowedControlBlocks": [],
    "allowedScopes": ["MAIN"],
    "allowRepeatBadges": true,
    "allowActionParams": false,
    "allowedBlockParams": { "repeat": [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    "allowVariables": false,
    "allowRecursion": false
  }
  ```
- **SlotCap (`SlotCapConfig`):** `{ "maxTotal": 8, "perScope": { "MAIN": 8 } }`
- **Edit Delta Budget:** `7` from blank (`≤ 8` Early Puzzle guardrail) | `3` from `partialHelp`
- **Env & Validation Flags:**
  - `strictInteractionCollision: true`
  - `requireAllItemsCollected: false`
  - `requireEmptyBackpackAtGoal: false`
  - Switch formula: `isPressed = hasCrateOnTile || hasRobotOnTile` (`sw_param_10.requiredForGoal: true`)
  - Switch Door `(3, 2)` has NO Key — opens **only** while `sw_param_10` is pressed!
- **Anti-Bypass Rules:**
  - `param.10-require-crate-switch`: Cannot keep `door_param_10` open after stepping onto `(3, 3)` without dropping Crate on `(2, 3)` (`PICK_UP >= 1`, `USE_DROP >= 1`).
  - `param.10-require-repeat-badges`: Unrolled solution = `9` blocks `> 8` tray cap (`allowRepeatBadges: false` fails).

## Initial World State (Grid)

- **Grid:** `4×4` (`x = 0..3, y = 0..3`), Robot start: `(0, 3)` facing `EAST`
- **Flags:** `[{"id": "goal_param_10", "x": 3, "y": 0, "isGoal": true, "order": 1}]` (`🏁`)
- **World Items:** `[{"id": "crate_param_10", "type": "crate", "x": 1, "y": 3}]`
- **Floor Switches:** `[{"id": "sw_param_10", "x": 2, "y": 3, "linkedGateId": "door_param_10", "requiredForGoal": true}]`
- **Switch-Linked Doors:** `[{"id": "door_param_10", "x": 3, "y": 2, "shape": "diamond", "color": "purple", "unlocked": false, "linkedSwitchId": "sw_param_10"}]`
- **Barriers (`6` segments):**
  - Horizontal: `H(0,3), H(1,3), H(2,3)` *(North edge of row `y=3` sealed except `(3,3) -> (3,2)`)*
  - Vertical: `V(3,0), V(3,1), V(3,2)` *(seals column `3` Left edge above Switch Door)*

```text
+---+---+---+---+
| .   .   . | 🏁|   <- y=0: Goal at (3,0), V(3,0) left wall
+   +   +   +   +
| .   .   . | . |   <- y=1: V(3,1) left wall
+   +   +   +   +
| .   .   . | D |   <- y=2: Switch Door at (3,2), V(3,2) left wall
+---+---+---+   +   <- H(0,3), H(1,3), H(2,3) block North; open ONLY at (3,3)->(3,2)
| RE  C   S   . |   <- y=3: (0,3)=RE, (1,3)=Crate, (2,3)=Switch, (3,3)=corner
+---+---+---+---+
```

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`)
- Empty `8`-slot tray (`[]`, `Edit Delta = 7`).

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN (`7` slots, `Edit Delta = 3`):**
  1. `MOVE_FWD`
  2. `PLACEHOLDER {"hintCategory": "item"}` *(expected: `PICK_UP`)*
  3. `MOVE_FWD`
  4. `PLACEHOLDER {"hintCategory": "item"}` *(expected: `USE_DROP`)*
  5. `MOVE_FWD`
  6. `TURN_LEFT`
  7. `PLACEHOLDER {"hintCategory": "motion"}` *(expected: `MOVE_FWD ×3`)*

### Canonical Solution (`referenceSolution`)
- **MAIN (`blocks.length = 7`, Tray `7 / 8`):**
  1. `MOVE_FWD` -> `(1, 3)` (Crate)
  2. `PICK_UP` -> grabs Crate into shoulder gripper
  3. `MOVE_FWD` -> `(2, 3)` (stands on Switch; Door `(3, 2)` flickers open)
  4. `USE_DROP` -> drops Crate onto **current tile `(2, 3)`** (`Switch` stays depressed!)
  5. `MOVE_FWD` -> `(3, 3)` (Door `(3, 2)` remains open!)
  6. `TURN_LEFT` -> faces `NORTH`
  7. `MOVE_FWD` (`repeat: 3`) -> `(3, 2) -> (3, 1) -> (3, 0) 🏁`

## Verification Checklist
- [x] `isPressed = hasCrateOnTile || hasRobotOnTile` + `sw_param_10.requiredForGoal: true` + `strictInteractionCollision: true`.
- [x] Walking past `(2, 3)` without dropping Crate lets Door `(3, 2)` close before robot reaches `(3, 2)`.
- [x] `7 / 8` blocks (`Edit Delta = 7`), unrolled `9 > 8`; prepares learners cleanly for `loop.A`.
