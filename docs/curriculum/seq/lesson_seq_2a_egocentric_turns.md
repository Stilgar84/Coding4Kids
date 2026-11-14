# Lesson `seq.2a` — Egocentric Turns (Facing South & West)

> [← Module `seq` Overview](./overview.md) · **Format:** 🤖 Puzzle · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.2a` *(New Split Part 2 of Legacy `1.2`)*

**One-Concept Goal:** Practice turning left and right strictly from the robot's own egocentric point-of-view while upside-down (`SOUTH`) and sideways (`WEST`).

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Once turning-in-place clicks from an upright North view in `seq.2`, this dedicated step tackles the classic mental rotation hurdle: when a robot walks **downward (`SOUTH`)**, turning **robot-Right** rotates toward the **left side of the screen (`WEST`)**—and then facing **West**, turning **robot-Left** turns downward (`SOUTH`) again! The `6`-slot tray guarantees neither turn can be bypassed with triple opposite turns (`7` blocks).

</details>

---

## Palette, Scopes, Caps & Flags

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Parameters & Variables:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `{ "maxTotal": 6, "perScope": { "MAIN": 6 } }` · **Edit Delta:** `5`
- **Anti-Bypass Rules:**
  - `seq.2a-require-turn-right`: cannot bypass `TURN_RIGHT` with `TURN_LEFT × 3` inside `6`-slot cap (`7 > 6`).
  - `seq.2a-require-turn-left`: cannot bypass `TURN_LEFT` with `TURN_RIGHT × 3` inside `6`-slot cap (`7 > 6`).
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **UI Spotlights:** Robot visor / directional arrow cue when facing `SOUTH` and `WEST`

---

## World State (Robot Grid)

- **Dimensions:** `3×3`
- **Start Pose (`startPose`):** `(2, 0, SOUTH)`
- **Flags (`flags[]`):** `[{"id": "goal_seq_2a", "x": 1, "y": 2, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `V(2,0), H(1,1), V(1,1), H(2,2), V(1,2), V(2,2)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| .   . | RS|
+   +---+   +
| . | .   . |
+   +   +---+
| . | G | . |
+---+---+---+
```

---

## Workspace Code & Execution Trace

### Starter Workspace (`starterWorkspace`)
- **MAIN** (`0` blocks, empty): `[]`

### Partial Help (`partialHelp`, Ghost + Scaffold)
- **Ghost Preview (`ghostPreview.maxSteps: 2`):** Shows `(2, 0) → (2, 1) SOUTH` then turning in place to `WEST`
- **Scaffold (`MAIN`, `5` slots):**
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

### Step-by-Step Verification Trace
1. Start: `(2, 0, SOUTH)`
2. `MOVE_FWD` → `(2, 1, SOUTH)`
3. `TURN_RIGHT` → `(2, 1, WEST)` *(South-facing robot's right = screen-left `WEST`)*
4. `MOVE_FWD` → `(1, 1, WEST)`
5. `TURN_LEFT` → `(1, 1, SOUTH)` *(West-facing robot's left = screen-down `SOUTH`)*
6. `MOVE_FWD` → `(1, 2, SOUTH)` → stands on `goal_seq_2a` → **`SUCCESS` (`🏁`)**
- *Bypass check:* Swapping either turn for `3×` opposite turn requires `7` blocks (`> 6`-slot cap). All alternative routes from `(2, 1)` or `(1, 1)` are walled off.
