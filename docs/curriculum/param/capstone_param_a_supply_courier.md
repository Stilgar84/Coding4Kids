# `param.A`: The Supply Courier (`🏆 🤖`)

- **Activity ID:** `param.A` *(Legacy Alias: `2A`)*
- **Format:** `capstone` (`capstoneType: puzzle`)
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `🏆 🤖`
- **Concept:** Sequential 1-Slot Gripper Planning (`Key -> Gate` First to Free Slot, Then `Plank -> Water` + `×N` Repeat Badges)

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

Because the robot's shoulder gripper can carry only **one item at a time**, sequence order matters! Fetch the purple diamond key (`◆`) at `(0, 0)`, turn right to face the locked `◆` gate 1 cell ahead, and call `USE_DROP` to unlock and consume it **before** walking `×5` East to pick up the wooden plank at `(5, 0)`. Then turn South, bridge the water cell at `(5, 1)`, and sprint `×4` South to `🏁` inside the 10-slot Early Capstone tray.

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
- **SlotCap (`SlotCapConfig`):** `{ "maxTotal": 10, "perScope": { "MAIN": 10 } }` *(Permitted Early Capstone guardrail: `≤ 10–12`)*
- **Edit Delta Budget:** `4` from `partialHelp` (or `9` from blank; `≤ 10–12` Early Capstone guardrail)
- **Env & Validation Flags:**
  - `strictInteractionCollision: true`
  - `requireAllItemsCollected: false`
  - `requireEmptyBackpackAtGoal: false`
  - On-robot upper-right shoulder gripper carry rendering (`no BackpackHud`); shuttered `🏁` goal pad.
- **Anti-Bypass Rules:**
  - `2A-require-world-interaction`: Cannot bypass without `PICK_UP` and `USE_DROP`.
  - `2A-require-both-key-and-plank`: Cannot skip either the Key+Gate or Plank+Water (`maxActionExecutions: { "USE_DROP": 1 }` blocked; requires `USE_DROP >= 2`).
  - `2A-require-repeat-badges`: Cannot fit inside the `10`-slot tray when `allowRepeatBadges: false` (unrolled = `19` blocks).

## Initial World State (Grid)

- **Grid:** `6×5` (`x = 0..5, y = 0..4`), Robot start: `(0, 4)` facing `NORTH`
- **Flags:** `[{"id": "goal_2A", "x": 5, "y": 4, "isGoal": true, "order": 1}]` (`🏁`)
- **World Items:**
  - `{"id": "key_2A", "type": "key", "x": 0, "y": 0, "shape": "diamond", "color": "purple"}`
  - `{"id": "plank_2A", "type": "plank", "x": 5, "y": 0}`
- **Locked Gates:** `[{"id": "gate_2A", "x": 1, "y": 0, "shape": "diamond", "color": "purple", "unlocked": false}]`
- **Water Cells:** `[{"x": 5, "y": 1}]`
- **Barriers (`12` segments):**
  - Vertical: `V(1,1..4)` and `V(5,1..4)`
  - Horizontal: `H(1,1), H(2,1), H(3,1), H(4,1)`

```text
+---+---+---+---+---+---+
| K   L   .   .   .   P |   <- y=0: (0,0)=Purple ◆ Key, (1,0)=Gate, (5,0)=Plank
+   +---+---+---+---+   +   <- H(1..4,1) block interior row 1; col 0 & col 5 vertical arms
| . | .   .   .   . | ~ |   <- y=1: V(1,1), V(5,1), Water at (5,1)
+   +   +   +   +   +   +
| . | .   .   .   . | . |   <- y=2
+   +   +   +   +   +   +
| . | .   .   .   . | . |   <- y=3
+   +   +   +   +   +   +
| RN| .   .   .   . | 🏁 |   <- y=4: Start (0,4,N) -> Goal (5,4)
+---+---+---+---+---+---+
```

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`)
- Empty `10`-slot tray (`[]`, `Edit Delta = 9` from blank).

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN (`9` slots, `Edit Delta = 4`):**
  1. `MOVE_FWD` (`repeat: 4`)
  2. `PICK_UP`
  3. `TURN_RIGHT`
  4. `PLACEHOLDER {"hintCategory": "item"}`
  5. `MOVE_FWD` (`repeat: 5`)
  6. `PLACEHOLDER {"hintCategory": "item"}`
  7. `TURN_RIGHT`
  8. `PLACEHOLDER {"hintCategory": "item"}`
  9. `PLACEHOLDER {"hintCategory": "motion"}`

### Canonical Solution (`referenceSolution`)
- **MAIN (`blocks.length = 9`, Tray `9 / 10`):**
  1. `MOVE_FWD` (`repeat: 4`) -> `(0, 0)` Key
  2. `PICK_UP` -> grabs Purple `◆` Key (gripper full)
  3. `TURN_RIGHT` -> faces `EAST` toward Gate `(1, 0)`
  4. `USE_DROP` -> unlocks `(1, 0)` (Key consumed -> **gripper empty!**)
  5. `MOVE_FWD` (`repeat: 5`) -> sprints across top hall `(1,0)..(5,0)` onto Plank
  6. `PICK_UP` -> grabs Wooden Plank at `(5, 0)`
  7. `TURN_RIGHT` -> faces `SOUTH` toward Water `(5, 1)`
  8. `USE_DROP` -> drops Plank across `(5, 1)`
  9. `MOVE_FWD` (`repeat: 4`) -> crosses `(5, 1)` to `(5, 4) 🏁`

## Verification Checklist
- [x] Strictly enforces sequential 1-slot gripper use (`Key` must unlock `(1, 0)` before reaching `Plank` at `(5, 0)`).
- [x] `9 / 10` blocks (`Edit Delta = 9` blank / `4` scaffold), unrolled `19 > 10`.
- [x] `strictInteractionCollision: true`, shoulder gripper carry UI, shuttered `🏁` goal.
