# Lesson `seq.2` — Turning in Place (First Corner)

> [← Module `seq` Overview](./overview.md) · **Format:** 🤖 Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.2` (Legacy Alias: `1.2` Part 1)

**One-Concept Goal:** Understand that turning rotates the robot `90°` on the same tile **without** stepping forward, navigating a single North-start L-corner before tackling upside-down South/West turns in [`seq.2a`](./lesson_seq_2a_egocentric_turns.md).

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Young newcomers often expect `Turn Right` to both turn *and* walk around the corner in one block. Starting upright (`NORTH`) lets learners focus solely on pairing `Turn Right` **plus** `Move Forward` on a single corner (`4` blocks total) inside a `5`-slot tray that blocks `Turn Left ×3`.

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 5, "perScope": { "MAIN": 5 } }` · **Edit Delta:** `4`
- **Anti-Bypass Rules:** `[{ "id": "seq.2-require-turn-right", "forbidBlocks": ["TURN_RIGHT"], "note": "TURN_LEFT x3 + 3x MOVE_FWD requires 6 blocks > 5-slot cap" }]`
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **UI Spotlights:** `TURN_RIGHT` palette icon & robot visor orientation highlight

---

## World State (Robot Grid)

- **Dimensions:** `3×3`
- **Start Pose (`startPose`):** `(0, 2, NORTH)`
- **Flags (`flags[]`):** `[{"id": "goal_seq_2", "x": 2, "y": 1, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `H(0,1), H(1,1), H(2,1), V(1,2), H(1,2), H(2,2)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| .   .   . |
+---+---+---+
| .   .   G |
+   +---+---+
| RN| .   . |
+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`)
- **MAIN** (`0` blocks, empty): `[]`

### Partial Help (`partialHelp`, Ghost + Scaffold)
- **Ghost Preview (`ghostPreview.maxSteps: 1`):** Shows `(0, 2) → (0, 1)`
- **Scaffold (`MAIN`, `4` slots):**
  1. `MOVE_FWD`
  2. `PLACEHOLDER { "hintCategory": "turn" }` (`?`)
  3. `MOVE_FWD`
  4. `MOVE_FWD`

### Canonical Solution (`referenceSolution`)
- **MAIN** (`4` flat blocks):
  1. `MOVE_FWD`
  2. `TURN_RIGHT`
  3. `MOVE_FWD`
  4. `MOVE_FWD`

### Step-by-Step Verification Trace
1. Start: `(0, 2, NORTH)`
2. `MOVE_FWD` → `(0, 1, NORTH)`
3. `TURN_RIGHT` → `(0, 1, EAST)` *(same tile, visor pivots right)*
4. `MOVE_FWD` → `(1, 1, EAST)`
5. `MOVE_FWD` → `(2, 1, EAST)` → stands on `goal_seq_2` → **`SUCCESS` (`🏁`)**
- *Bypass check:* Replacing `TURN_RIGHT` with `TURN_LEFT × 3` needs `6` blocks (`> 5`-slot tray).
