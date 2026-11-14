# Capstone `seq.A` — The Compact Labyrinth

> [← Module `seq` Overview](./overview.md) · **Format:** 🏆 Capstone Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.A` (Legacy Alias: `1A`)

**One-Concept Goal:** Synthesize all Module `seq` Robot Grid skills—step-debugging a broken 4-block starter leg (`Edit Delta = 1 fix + 5 appends = 6`), South/West egocentric turns, `Move Back` out of a 1-tile pocket, and ordered `1 ⋯▶ 2 → Goal` waypoints—inside a `4×4` maze (`≤ 10` blocks).

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

This capstone unlocks Module `seq`'s **Robot Navigator Mastery Milestone**. The pre-loaded 4-block starter walks South to `(2, 1)` and mistakenly turns **West** (`TURN_RIGHT` from South) straight into a wall on Step 3. Have your child press **⏭ Step** (`btn-step`) to diagnose Block 2 (`TURN_RIGHT → TURN_LEFT`), back out of Flag `1`'s dead-end pocket using `MOVE_BACK`, and finish collecting Flag `2` (`1 ⋯▶ 2`) before reaching the shuttered `🏁` Goal.

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 10, "perScope": { "MAIN": 10 } }` · **Edit Delta:** `6` *(fix Block 2 + append 5 blocks)*
- **Anti-Bypass Rules:**
  - `seq.A-starter-must-fail`: `{ "unmodifiedStarterMustFail": true, "minStarterEditDistance": 1 }` *(unmodified starter collides at `(2, 1) ↔ (1, 1)`)*
  - `seq.A-require-move-back`: Turning `180°` inside `(3, 1)` without `MOVE_BACK` requires `11` blocks (`> 10`-slot cap).
  - `seq.A-require-turn-left` / `seq.A-require-turn-right` (`maxActionExecutions: { "MOVE_BACK": 1 }`): Replacing either turn with `3×` opposite turn overflows `10` slots.
  - `seq.A-direct-goal-locked`: `{ "directToGoalMustFailLock": true }`.
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **Waypoints UX (`envs/robot_grid.md` §1):** Ordered flags use dimmed shuttered pennants + `1 ⋯▶ 2` chain + shuttered `🏁` (`no 🔒` icons); stepping early onto `Flag 2` or `Goal` wiggles gently (`!= COLLISION`).
- **UI Spotlights:** `btn-step` (`⏭ Step`) + `10`-slot physical tray.

---

## World State (Robot Grid)

- **Dimensions:** `4×4`
- **Start Pose (`startPose`):** `(2, 0, SOUTH)`
- **Flags (`flags[]`):**
  1. `{"id": "f1_seq_A", "x": 3, "y": 1, "isGoal": false, "order": 1}`
  2. `{"id": "f2_seq_A", "x": 2, "y": 2, "isGoal": false, "order": 2}`
  3. `{"id": "goal_seq_A", "x": 0, "y": 2, "isGoal": true, "order": 3}`
- **Walls (`barriers[]`):** `V(2,0), V(3,0), V(2,1), H(3,1), H(3,2), V(3,2), H(2,3), H(0,2), H(1,2), H(0,3), H(1,3)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+---+
| .   . | RS| . |
+   +   +   +---+
| .   . | .   F1|
+---+---+   +---+
| G   .   F2| . |
+---+---+---+---+
| .   .   .   . |
+---+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`, Buggy — `4` blocks)
- **MAIN** (`4` blocks pre-loaded):
  1. `MOVE_FWD`
  2. `TURN_RIGHT` *(BUG: turns `SOUTH → WEST` toward wall `V(2,1)` instead of `TURN_LEFT` into `Flag 1`)*
  3. `MOVE_FWD` *(crashes against `V(2,1)` on Step 3!)*
  4. `MOVE_BACK`

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN** (`9` slots):
  1. `MOVE_FWD`
  2. `PLACEHOLDER { "hintCategory": "turn" }` (`?`)
  3. `MOVE_FWD`
  4. `MOVE_BACK`
  5. `TURN_RIGHT`
  6. `MOVE_FWD`
  7. `PLACEHOLDER { "hintCategory": "turn" }` (`?`)
  8. `MOVE_FWD`
  9. `MOVE_FWD`

### Canonical Solution (`referenceSolution`)
- **MAIN** (`9` flat blocks):
  1. `MOVE_FWD`
  2. `TURN_LEFT`
  3. `MOVE_FWD`
  4. `MOVE_BACK`
  5. `TURN_RIGHT`
  6. `MOVE_FWD`
  7. `TURN_RIGHT`
  8. `MOVE_FWD`
  9. `MOVE_FWD`

### Step-by-Step Verification Trace
1. Start: `(2, 0, SOUTH)`, active next flag = `1`
2. `MOVE_FWD` → `(2, 1, SOUTH)`
3. `TURN_LEFT` → `(2, 1, EAST)` *(South-facing robot's left = screen-right `EAST`)*
4. `MOVE_FWD` → `(3, 1, EAST)` → collects `Flag 1 ✓` (`1 ⋯▶ 2` shutter opens for `Flag 2`)
5. `MOVE_BACK` → `(2, 1, EAST)` *(retreats from Flag 1 pocket)*
6. `TURN_RIGHT` → `(2, 1, SOUTH)`
7. `MOVE_FWD` → `(2, 2, SOUTH)` → collects `Flag 2 ✓` (`Goal 🏁` shutter opens!)
8. `TURN_RIGHT` → `(2, 2, WEST)` *(South-facing robot's right = screen-left `WEST`)*
9. `MOVE_FWD` → `(1, 2, WEST)`
10. `MOVE_FWD` → `(0, 2, WEST)` → stands on unlocked `goal_seq_A` → **`SUCCESS` (`🏁`)**
