# `param.8`: Keys & Matching Gates (`🤖`)

- **Activity ID:** `param.8` *(Legacy Alias: `2.7`; Split 1/3 of legacy multi-item `2.7`)*
- **Format:** `puzzle`
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `🤖`
- **Concept:** Combining `PICK_UP`, `USE_DROP` (1 Cell Ahead), and `×N` Repeat Badges to Fetch a Key & Unlock a Matching Gate

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

This puzzle focuses purely on **Keys and Matching Gates**. The tray holds only **8 slots**, so kids use `×4` repeat badges to sprint North up to the emerald triangle key (`▲`), carry it in the robot's shoulder gripper across the top hallway, turn South right in front of the matching `▲` gate, press `USE_DROP` to unlock **1 cell ahead** (consuming the key), and sprint `×4` South to `🏁`.

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
- **Edit Delta Budget:** `3` from `partialHelp` (or `7` from blank; `≤ 8` Early Puzzle guardrail)
- **Env & Validation Flags:**
  - `strictInteractionCollision: true`
  - `requireAllItemsCollected: false`
  - `requireEmptyBackpackAtGoal: false`
  - Max `1` item per tile; carried Key renders on robot upper-right shoulder gripper (`no BackpackHud`).
- **Anti-Bypass Rules:**
  - `2.7-require-world-interaction`: Cannot pass Gate `(4, 1)` without `PICK_UP` and `USE_DROP`.
  - `2.7-require-repeat-badges`: Cannot fit inside the `8`-slot tray when `allowRepeatBadges: false` (unrolled = `16` blocks).

## Initial World State (Grid)

- **Grid:** `5×5` (`x = 0..4, y = 0..4`), Robot start: `(0, 4)` facing `NORTH`
- **Flags:** `[{"id": "goal_2_7", "x": 4, "y": 4, "isGoal": true, "order": 1}]` (`🏁`)
- **World Items:** `[{"id": "key_2_7", "type": "key", "x": 0, "y": 0, "shape": "triangle", "color": "emerald"}]`
- **Locked Gates:** `[{"id": "gate_2_7", "x": 4, "y": 1, "shape": "triangle", "color": "emerald", "unlocked": false}]`
- **Barriers (`11` segments):**
  - Vertical: `V(1,1), V(1,2), V(1,3), V(1,4)` and `V(4,1), V(4,2), V(4,3), V(4,4)`
  - Horizontal: `H(1,1), H(2,1), H(3,1)`

```text
+---+---+---+---+---+
| K   .   .   .   . |   <- y=0: Emerald Triangle Key at (0,0)
+   +---+---+---+   +
| . | .   .   . | L |   <- y=1: Emerald Triangle Gate at (4,1)
+   +   +   +   +   +
| . | .   .   . | . |   <- y=2
+   +   +   +   +   +
| . | .   .   . | . |   <- y=3
+   +   +   +   +   +
| RN| .   .   . | 🏁 |   <- y=4: Start (0,4,N) -> Goal (4,4)
+---+---+---+---+---+
```

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`)
- Empty `8`-slot tray (`[]`, `Edit Delta = 7`).

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN (`7` blocks, `Edit Delta = 3`):**
  1. `MOVE_FWD` (`repeat: 4`)
  2. `PLACEHOLDER {"hintCategory": "item"}`
  3. `TURN_RIGHT`
  4. `MOVE_FWD` (`repeat: 4`)
  5. `TURN_RIGHT`
  6. `PLACEHOLDER {"hintCategory": "item"}`
  7. `PLACEHOLDER {"hintCategory": "motion"}`

### Canonical Solution (`referenceSolution`)
- **MAIN (`blocks.length = 7`, Tray `7 / 8`):**
  1. `MOVE_FWD` (`repeat: 4`)
  2. `PICK_UP`
  3. `TURN_RIGHT`
  4. `MOVE_FWD` (`repeat: 4`)
  5. `TURN_RIGHT`
  6. `USE_DROP`
  7. `MOVE_FWD` (`repeat: 4`)

- **Step Trace:** `(0,4,N)` -> `×4` to `(0,0)` -> `PICK_UP` (Key in gripper) -> `TURN_RIGHT` (East) -> `×4` to `(4,0)` -> `TURN_RIGHT` (South facing Gate `(4,1)`) -> `USE_DROP` (unlocks `(4,1)`) -> `×4` to `(4,4) 🏁`.

## Verification Checklist
- [x] Barrier walls isolate `(4, 1)` Gate as unique route (`V(1,1..4)`, `H(1..3,1)`, `V(4,1..4)`).
- [x] `7 / 8` blocks (`Edit Delta = 7` blank / `3` scaffold), unrolled `16 > 8`.
- [x] `strictInteractionCollision: true`, on-robot shoulder gripper rendering, shuttered `🏁` goal.
