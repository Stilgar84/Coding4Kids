# Lesson `seq.3` — Stepping Backward

> [← Module `seq` Overview](./overview.md) · **Format:** 🤖 Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.3` (Legacy Alias: `1.3`)

**One-Concept Goal:** Use `Move Back` to retreat cleanly out of a tight 1-cell vertical alcove **without** wasting extra turn blocks to spin `180°`.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Because turning in place never collides with side walls, only a **tight physical block budget (`4` slots)** teaches why `Move Back` exists! Turning `180°` and walking forward out of this 2-cell corridor takes `6` blocks—overflowing the `4`-slot tray—whereas `Move Back × 2 + Turn Right + Move Forward` fits effortlessly in `4`. (Ordered waypoint flags wait cleanly until `seq.5` so this lesson focuses 100% on `Move Back`.)

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 4, "perScope": { "MAIN": 4 } }` · **Edit Delta:** `4`
- **Anti-Bypass Rules:** `[{ "id": "seq.3-require-move-back", "forbidBlocks": ["MOVE_BACK"], "note": "Turning 180 deg + walking out requires 6 blocks > 4-slot cap" }]`
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **UI Spotlights:** `MOVE_BACK` palette block + `[■][■][■][■]` 4-slot tray

---

## World State (Robot Grid)

- **Dimensions:** `3×3`
- **Start Pose (`startPose`):** `(1, 0, NORTH)` *(inside 2-tile closed-top alcove `(1,0)–(1,1)`)*
- **Flags (`flags[]`):** `[{"id": "goal_seq_3", "x": 2, "y": 2, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `V(1,0), V(2,0), V(1,1), V(2,1), V(1,2)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| . | RN| . |
+   +   +   +
| . | . | . |
+   +   +   +
| . | .   G |
+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`)
- **MAIN** (`0` blocks, empty): `[]`

### Partial Help (`partialHelp`, Ghost + Scaffold)
- **Ghost Preview (`ghostPreview.maxSteps: 1`):** Shows `(1, 0) → (1, 1)` backing down while still facing `NORTH`
- **Scaffold (`MAIN`, `4` slots):**
  1. `MOVE_BACK`
  2. `PLACEHOLDER { "hintCategory": "motion" }` (`?`)
  3. `TURN_RIGHT`
  4. `MOVE_FWD`

### Canonical Solution (`referenceSolution`)
- **MAIN** (`4` flat blocks):
  1. `MOVE_BACK`
  2. `MOVE_BACK`
  3. `TURN_RIGHT`
  4. `MOVE_FWD`

### Step-by-Step Verification Trace
1. Start: `(1, 0, NORTH)`
2. `MOVE_BACK` → `(1, 1, NORTH)`
3. `MOVE_BACK` → `(1, 2, NORTH)`
4. `TURN_RIGHT` → `(1, 2, EAST)`
5. `MOVE_FWD` → `(2, 2, EAST)` → stands on `goal_seq_3` → **`SUCCESS` (`🏁`)**
- *Bypass check:* Without `MOVE_BACK`, `[TURN_RIGHT, TURN_RIGHT, MOVE_FWD, MOVE_FWD, TURN_LEFT, MOVE_FWD]` takes `6` blocks (`> 4`-slot cap).
