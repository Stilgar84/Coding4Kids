# Lesson `seq.1` — Moving Forward & Execution Order

> [← Module `seq` Overview](./overview.md) · **Format:** 🤖 Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.1` (Legacy Alias: `1.1`)

**One-Concept Goal:** Chain multiple `Move Forward` blocks in top-to-bottom sequence to walk along a straight corridor to the Goal.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Each `Move Forward` block moves the robot exactly **1 tile** in the direction it faces. Unlike dragging a character directly to the goal, programmers chain discrete step instructions (`1`, then `2`, then `3`) inside the workspace slot tray (`[■][■][■][□]`).

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 4, "perScope": { "MAIN": 4 } }` · **Edit Delta:** `3`
- **Anti-Bypass Rules:** `[{ "id": "seq.1-require-fwd", "forbidBlocks": ["MOVE_FWD"] }]`
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **UI Spotlights:** Slot tray (`[■][■][■][□]`), `btn-play`

---

## World State (Robot Grid)

- **Dimensions:** `4×4`
- **Start Pose (`startPose`):** `(0, 2, EAST)`
- **Flags (`flags[]`):** `[{"id": "goal_seq_1", "x": 3, "y": 2, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `H(0,2), H(1,2), H(2,2), H(3,2), H(0,3), H(1,3), H(2,3), H(3,3)` *(frames straight row-2 hallway)*
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+---+
| .   .   .   . |
+   +   +   +   +
| .   .   .   . |
+---+---+---+---+
| RE  .   .   G |
+---+---+---+---+
| .   .   .   . |
+---+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`)
- **MAIN** (`0` blocks, empty): `[]`

### Partial Help (`partialHelp`, Ghost + Scaffold)
- **Ghost Preview (`ghostPreview.maxSteps: 1`):** Shows `(0, 2) → (1, 2)`
- **Scaffold (`MAIN`, `3` slots):**
  1. `MOVE_FWD`
  2. `PLACEHOLDER { "hintCategory": "motion" }` (`?`)
  3. `PLACEHOLDER { "hintCategory": "motion" }` (`?`)

### Canonical Solution (`referenceSolution`)
- **MAIN** (`3` flat blocks):
  1. `MOVE_FWD`
  2. `MOVE_FWD`
  3. `MOVE_FWD`

### Step-by-Step Verification Trace
1. Start: `(0, 2, EAST)`
2. `MOVE_FWD` → `(1, 2, EAST)`
3. `MOVE_FWD` → `(2, 2, EAST)`
4. `MOVE_FWD` → `(3, 2, EAST)` → stands on `goal_seq_1` → **`SUCCESS` (`🏁`)**
