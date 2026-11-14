# Lesson `seq.5` — Ordered Waypoints (`1 ⋯▶ 2 → Goal`)

> [← Module `seq` Overview](./overview.md) · **Format:** 🤖 Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.5` (Legacy Alias: `1.5`)

**One-Concept Goal:** Plan a staged route in sequence across ordered waypoints (`Flag 1` → `Flag 2` → `Goal 🏁`), combining forward steps, `Move Back`, and turns.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Real programs satisfy sub-goals in order before completing a task. Here `Flag 1` is active first while `Flag 2` shows a **dimmed shuttered pennant** linked by a dashed sequence chain (`1 ⋯▶ 2`), and the Goal shows a shuttered `🏁` barrier (never `🔒`, keeping padlocks strictly for concurrency locks). Stepping onto `Flag 2` or the Goal early is a **safe, non-crashing wiggle no-op** that pulses the active next flag (`Flag 1`). Using `Move Back` out of `Flag 1`'s side pocket solves the route in `6` blocks (`7`-slot cap blocks turning `180°`).

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 7, "perScope": { "MAIN": 7 } }` · **Edit Delta:** `6`
- **Anti-Bypass Rules:**
  - `seq.5-direct-goal-locked`: `{ "directToGoalMustFailLock": true, "note": "4-block shortcut [TR, FWD, TR, FWD] reaches Goal with F1/F2 uncollected -> shutter remains closed" }`
  - `seq.5-require-move-back`: Turning `180°` out of `(0, 2)` without `MOVE_BACK` requires `8` blocks (`> 7`-slot cap).
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **Visual Waypoint Semantics (`envs/robot_grid.md` §1):** Ordered flags (`order > 0`) render as active pennant (`1`), dimmed shuttered pennant with dashed sequence chain (`1 ⋯▶ 2`), and shuttered `🏁` Goal (`no 🔒 icons`). Stepping early onto a future flag triggers a gentle shutter wiggle (`!= COLLISION`).

---

## World State (Robot Grid)

- **Dimensions:** `3×3`
- **Start Pose (`startPose`):** `(1, 2, WEST)`
- **Flags (`flags[]`):**
  1. `{"id": "f1_seq_5", "x": 0, "y": 2, "isGoal": false, "order": 1}`
  2. `{"id": "f2_seq_5", "x": 1, "y": 1, "isGoal": false, "order": 2}`
  3. `{"id": "goal_seq_5", "x": 2, "y": 1, "isGoal": true, "order": 3}`
- **Walls (`barriers[]`):** `H(0,2), H(1,1), H(2,1), V(1,1), V(2,2)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| .   .   . |
+   +---+---+
| . | F2  G |
+---+   +---+
| F1  RW| . |
+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`)
- **MAIN** (`0` blocks, empty): `[]`

### Partial Help (`partialHelp`, mode=`scaffold`)
- **Ghost Preview (`ghostPreview.maxSteps: 1`):** Shows `(1, 2) → (0, 2)` collecting `Flag 1`
- **Scaffold (`MAIN`, `6` slots):**
  1. `MOVE_FWD`
  2. `MOVE_BACK`
  3. `PLACEHOLDER { "hintCategory": "turn" }` (`?`)
  4. `MOVE_FWD`
  5. `PLACEHOLDER { "hintCategory": "turn" }` (`?`)
  6. `MOVE_FWD`

### Canonical Solution (`referenceSolution`)
- **MAIN** (`6` flat blocks):
  1. `MOVE_FWD`
  2. `MOVE_BACK`
  3. `TURN_RIGHT`
  4. `MOVE_FWD`
  5. `TURN_RIGHT`
  6. `MOVE_FWD`

### Step-by-Step Verification Trace
1. Start: `(1, 2, WEST)`, active next flag = `1`
2. `MOVE_FWD` → `(0, 2, WEST)` → collects `Flag 1 ✓` (`1 ⋯▶ 2` shutter opens for `Flag 2`)
3. `MOVE_BACK` → `(1, 2, WEST)`
4. `TURN_RIGHT` → `(1, 2, NORTH)`
5. `MOVE_FWD` → `(1, 1, NORTH)` → collects `Flag 2 ✓` (`Goal 🏁` shutter opens!)
6. `TURN_RIGHT` → `(1, 1, EAST)`
7. `MOVE_FWD` → `(2, 1, EAST)` → stands on unlocked `goal_seq_5` → **`SUCCESS` (`🏁`)**
- *Bypass check:* Skipping `Flag 1` leaves `Goal` shuttered (`!= SUCCESS`). Turning around instead of `MOVE_BACK` takes `[FWD, TR, TR, FWD, TL, FWD, TR, FWD]` = `8` blocks (`> 7`-slot cap).
