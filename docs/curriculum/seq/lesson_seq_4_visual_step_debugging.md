# Lesson `seq.4` — Visual Step-Debugging

> [← Module `seq` Overview](./overview.md) · **Format:** 🤖 Fix-It Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.4` (Legacy Alias: `1.4`)

**One-Concept Goal:** Use **⏭ Step** (`btn-step`) on a pre-populated 5-block program to spot the **single wrong turn** causing a wall crash, then swap only that wrong block.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Debugging is a core programming habit, not a failure! Instead of deleting the whole program, encourage your child to tap **⏭ Step** (`btn-step`) one block at a time and watch the robot stop right before crashing at `(1, 1)` on Block 4 (`Turn Right` turns South toward a wall instead of North toward the Goal). Swapping that single block (`Edit Delta = 1`) solves the puzzle inside the tight `5`-slot tray.

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 5, "perScope": { "MAIN": 5 } }` · **Edit Delta:** `1` *(swap 1 block in place)*
- **Anti-Bypass Rules:**
  - `seq.4-starter-must-fail`: `{ "unmodifiedStarterMustFail": true, "minStarterEditDistance": 1 }`
  - `seq.4-require-turn-left`: `TURN_RIGHT × 3` bypass overflows `5`-slot tray (`7 > 5`).
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **UI Spotlights (`pointer-events-none`):** Coach ring rendered directly beneath `btn-step` (`⏭ Step`) in the `<header>` plus active block highlight during step playback.

---

## World State (Robot Grid)

- **Dimensions:** `3×3`
- **Start Pose (`startPose`):** `(0, 2, NORTH)`
- **Flags (`flags[]`):** `[{"id": "goal_seq_4", "x": 1, "y": 0, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `H(0,1), V(1,2), H(1,2), V(2,0), V(2,1)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| .   G | . |
+---+   +   +
| .   . | . |
+   +---+---+
| RN| .   . |
+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`, Buggy — `5` blocks)
- **MAIN** (`5` blocks pre-loaded):
  1. `MOVE_FWD`
  2. `TURN_RIGHT`
  3. `MOVE_FWD`
  4. `TURN_RIGHT` *(BUG: turns `EAST → SOUTH` toward wall `H(1,2)` instead of `NORTH`)*
  5. `MOVE_FWD`

- **Buggy Starter Trace:**
  1. `MOVE_FWD` → `(0, 1, NORTH)`
  2. `TURN_RIGHT` → `(0, 1, EAST)`
  3. `MOVE_FWD` → `(1, 1, EAST)`
  4. `TURN_RIGHT` → `(1, 1, SOUTH)` *(facing wall `H(1,2)`)*
  5. `MOVE_FWD` → wall hit between `(1, 1)` and `(1, 2)` → **`COLLISION` (`💥`)**

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN** (`5` blocks — replaces buggy Block 4 with `?`):
  1. `MOVE_FWD`
  2. `TURN_RIGHT`
  3. `MOVE_FWD`
  4. `PLACEHOLDER { "hintCategory": "turn" }` (`?`)
  5. `MOVE_FWD`

### Canonical Solution (`referenceSolution`)
- **MAIN** (`5` flat blocks):
  1. `MOVE_FWD`
  2. `TURN_RIGHT`
  3. `MOVE_FWD`
  4. `TURN_LEFT`
  5. `MOVE_FWD`

### Step-by-Step Verification Trace (Fixed)
1. Start: `(0, 2, NORTH)`
2. `MOVE_FWD` → `(0, 1, NORTH)`
3. `TURN_RIGHT` → `(0, 1, EAST)`
4. `MOVE_FWD` → `(1, 1, EAST)`
5. `TURN_LEFT` → `(1, 1, NORTH)`
6. `MOVE_FWD` → `(1, 0, NORTH)` → stands on `goal_seq_4` → **`SUCCESS` (`🏁`)**
