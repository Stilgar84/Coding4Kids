# `param.9`: Portable Planks & Double River (`🤖`)

- **Activity ID:** `param.9` *(Stage 2 Split 2/3 from legacy `2.7` — isolates 1-ahead Plank drop + U-turn 1-ahead retrieval before `loop.5`)*
- **Format:** `puzzle`
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `🤖`
- **Concept:** Laying a Plank 1 Cell Ahead (`USE_DROP`), Crossing Water, U-Turning (`TURN_LEFT ×2`) to Retrieve (`PICK_UP`), and Reusing the Plank

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

There is only **one wooden plank** and **two separate water gaps**! After the pre-filled start moves onto the plank (`MOVE_FWD`) and picks it up (`PICK_UP`), guide the robot to:
1. Drop the plank across River #1 **1 cell ahead** (`USE_DROP`) and step `×2` onto the dry stone island.
2. Turn `180°` (`TURN_LEFT ×2`) to face back toward the plank behind it, call `PICK_UP` from **1 cell ahead** to lift the bridge back into its gripper, turn right to face River #2 North, drop the plank again, and cross `×2` to `🏁`!
*(Pre-filled blocks 1–2 keep the learner's **Edit Delta = 7** inside the 9-slot tray.)*

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
- **SlotCap (`SlotCapConfig`):** `{ "maxTotal": 9, "perScope": { "MAIN": 9 } }`
- **Edit Delta Budget:** `7` from `starterWorkspace` (2 blocks pre-filled; `≤ 8` Early Puzzle guardrail) | `5` from `partialHelp`
- **Env & Validation Flags:**
  - `strictInteractionCollision: true`
  - `requireAllItemsCollected: false`
  - `requireEmptyBackpackAtGoal: false`
  - Carried Plank renders in upper-right shoulder gripper (`no BackpackHud`).
- **Anti-Bypass Rules:**
  - `param.9-require-plank-reuse`: Cannot cross both moats with a single `USE_DROP` (requires `PICK_UP >= 2` and `USE_DROP >= 2`).
  - `param.9-require-repeat-badges`: Cannot fit inside the `9`-slot tray when `allowRepeatBadges: false` (unrolled = `12` blocks).

## Initial World State (Grid)

- **Grid:** `5×4` (`x = 0..4, y = 0..3`), Robot start: `(0, 2)` facing `EAST`
- **Flags:** `[{"id": "goal_param_9", "x": 3, "y": 0, "isGoal": true, "order": 1}]` (`🏁`)
- **World Items:** `[{"id": "plank_param_9", "type": "plank", "x": 1, "y": 2}]`
- **Water Cells:** `[{"x": 2, "y": 0}, {"x": 2, "y": 1}, {"x": 2, "y": 2}, {"x": 2, "y": 3}, {"x": 3, "y": 1}, {"x": 4, "y": 1}]`
- **Barriers (`7` segments confining path to the two unique bridge tiles `(2,2)` and `(3,1)`):**
  - Horizontal: `H(0,2), H(1,2)` (top of start lane), `H(0,3), H(1,3), H(3,3)` (bottom walls)
  - Vertical: `V(4,2), V(4,0)`

```text
+---+---+---+---+---+
| .   . | ~ | 🏁| . |   <- y=0: Goal at (3,0); V(4,0) right of Goal; water at (2,0)
+---+---+   +   +---+
| .   . | ~   ~   ~ |   <- y=1: water moat across (2,1),(3,1),(4,1); H(0,2),H(1,2) block north from start lane
+---+---+   +---+---+
| RE  P   ~   . | . |   <- y=2: (0,2)=RE, (1,2)=Plank, (2,2)=River #1, (3,2)=Island, V(4,2) East wall
+---+---+   +---+---+
| .   . | ~ | .   . |   <- y=3: H(0,3),H(1,3),H(3,3) seal south edges
+---+---+---+---+---+
```

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`, `2` pre-filled blocks -> `Edit Delta = 7`)
- **MAIN:**
  1. `MOVE_FWD` (`×1`)
  2. `PICK_UP`

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN (`9` slots, `Edit Delta = 5`):**
  1. `MOVE_FWD`
  2. `PICK_UP`
  3. `USE_DROP`
  4. `PLACEHOLDER {"hintCategory": "motion"}` *(expected: `MOVE_FWD ×2`)*
  5. `PLACEHOLDER {"hintCategory": "motion"}` *(expected: `TURN_LEFT ×2`)*
  6. `PLACEHOLDER {"hintCategory": "item"}` *(expected: `PICK_UP`)*
  7. `TURN_RIGHT`
  8. `PLACEHOLDER {"hintCategory": "item"}` *(expected: `USE_DROP`)*
  9. `PLACEHOLDER {"hintCategory": "motion"}` *(expected: `MOVE_FWD ×2`)*

### Canonical Solution (`referenceSolution`)
- **MAIN (`blocks.length = 9`, Tray `9 / 9`, `Edit Delta = 7` vs starter):**
  1. `MOVE_FWD` *(pre-filled -> `(1,2)` Plank)*
  2. `PICK_UP` *(pre-filled -> grabs Plank)*
  3. `USE_DROP` *(lays Plank onto `(2,2)`)*
  4. `MOVE_FWD` (`repeat: 2`) *(crosses `(2,2)` onto `(3,2)` island)*
  5. `TURN_LEFT` (`repeat: 2`) *(180° U-turn -> faces `WEST` toward `(2,2)`)*
  6. `PICK_UP` *(retrieves Plank from `(2,2)` 1 cell ahead!)*
  7. `TURN_RIGHT` *(faces `NORTH` toward `(3,1)` Water!)*
  8. `USE_DROP` *(lays Plank onto `(3,1)`)*
  9. `MOVE_FWD` (`repeat: 2`) *(crosses `(3,1)` to `(3,0) 🏁`!)*

## Verification Checklist
- [x] Water moat + barriers guarantee `(2, 2)` and `(3, 1)` cannot be bypassed and single Plank MUST be retrieved once (`PICK_UP ×2`, `USE_DROP ×2`).
- [x] `Edit Delta = 7` (from `2`-block starter, `5` from scaffold) fits inside `≤ 8` Early Puzzle guardrail; unrolled = `12 > 9`.
- [x] Directly scaffolds 1-ahead Plank retrieval needed in `loop.5`.
