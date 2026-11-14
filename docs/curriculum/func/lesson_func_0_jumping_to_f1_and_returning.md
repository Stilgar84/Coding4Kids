# func.0: Jumping to `F1` and Returning

- **Header ID:** `func.0` (Legacy `4.0`)
- **Format:** 📖 Demo
- **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)
- **One-Concept Goal:** Watch the execution pointer jump from `Main` into `F1`, step through `F1` while tabs follow automatically, and return to `Main` right after the `CALL F1` block.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

When the robot hits a `CALL F1` card in `Main`, it pauses its spot on the `Main` tray, hops over to the `F1` tab to run every step inside `F1`, and jumps right back to the very next card after `CALL F1`! In Tab 2, watch how calling `F1` twice builds a two-step staircase without copying those four blocks twice.

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule; tab names use iconic `Main` / `F1` badges only).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1"]` (`F2`, `F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Demo Mode Flags:** `isReadOnlyDemo: true`, `demoAutoFollowScope: true` (workspace switches automatically to `F1` during `CALL F1` execution and back to `MAIN` on return).
- **Palette (Read-Only Demo View):**
  - `allowedSimBlocks`: `["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"]`
  - `allowedControlBlocks`: `["CALL_FN"]` (`targets: ["F1"]`)
  - `allowedBlockParams`: `{}`
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `false`
- **UI Coach Spotlights (`uiSpotlights`):** `["execution-order", "call-stack-jump", "auto-tab-follow"]`
- **Environment Flags (`envConfig`):**
  - `strictInteractionCollision`: `true`
  - `requireAllItemsCollected`: `false`
  - `requireEmptyBackpackAtGoal`: `false`

---

## Demo Tabs (2 Interactive Scenarios)

### Demo Tab 1: One Staircase Jump (`5 × 4` Grid)

#### Grid Layout & Coordinates
- **Dimensions:** `width: 5, height: 4` (`x: 0..4, y: 0..3`)
- **Robot Start:** `{ "x": 1, "y": 2, "dir": "EAST" }`
- **Goal:** `{ "x": 3, "y": 1 }`
- **Flags:** `[{ "x": 3, "y": 1, "order": 0 }]` *(fixes legacy duplicate/off-track flag order)*
- **Items / Keys / Gates / Planks:** `[]`
- **Barriers:**
  - `[{ "x": 3, "y": 2, "type": "H" }, { "x": 3, "y": 2, "type": "V" }]`
  - *(`H(3,2)` separates `(3,1)` and `(3,2)`; `V(3,2)` separates `(2,2)` and `(3,2)` — frames the shortcut corner without touching the staircase path.)*

```text
   0   1   2   3   4
0  .   .   .   .   .
1  .   .   ●──▶🏁  .
           ▲
2  .  🤖──▶● │ .   .
             ─
3  .   .   .   .   .
```

#### Demo Code (`Tab 1`)
- **`MAIN` (`3` blocks):**
  ```json
  [
    { "op": "MOVE_FWD" },
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "MOVE_FWD" }
  ]
  ```
- **`F1` (`3` blocks):**
  ```json
  [
    { "op": "TURN_LEFT" },
    { "op": "MOVE_FWD" },
    { "op": "TURN_RIGHT" }
  ]
  ```

#### Execution Trace (`Tab 1`)
1. `MAIN[0]` `MOVE_FWD` → `(2, 2, EAST)`
2. `MAIN[1]` `CALL_FN F1` → UI tab spotlights & jumps into `F1`:
   - `F1[0]` `TURN_LEFT` → `(2, 2, NORTH)`
   - `F1[1]` `MOVE_FWD` → `(2, 1, NORTH)`
   - `F1[2]` `TURN_RIGHT` → `(2, 1, EAST)`
   - Return from `F1` → UI tab returns to `MAIN`.
3. `MAIN[2]` `MOVE_FWD` → **`(3, 1, EAST)` = `Goal` ✅** (End-of-program Victory!)

---

### Demo Tab 2: Double Staircase Reuse (`6 × 4` Grid)

#### Grid Layout & Coordinates
- **Dimensions:** `width: 6, height: 4` (`x: 0..5, y: 0..3`)
- **Robot Start:** `{ "x": 0, "y": 2, "dir": "EAST" }`
- **Goal:** `{ "x": 4, "y": 0 }`
- **Flags:** `[{ "x": 4, "y": 0, "order": 0 }]`
- **Items / Keys / Gates / Planks:** `[]`
- **Barriers (Cleanly In-Bounds — 3 legacy out-of-bounds `y:0`/`x:0` barriers removed):**
  - `[{ "x": 0, "y": 2, "type": "H" }, { "x": 2, "y": 2, "type": "V" }, { "x": 2, "y": 2, "type": "H" }, { "x": 4, "y": 1, "type": "V" }]`
  - *(`H(0,2)` blocks `(0,1)↔(0,2)`; `V(2,2)` blocks `(1,2)↔(2,2)`; `H(2,2)` blocks `(2,1)↔(2,2)`; `V(4,1)` blocks `(3,1)↔(4,1)`.)*

```text
   0   1   2   3   4   5
0  .   .   .   ●──▶🏁  .
               ▲
1  .   ●──▶●──▶● │ .   .
   ─   ▲   ─
2 🤖──▶● │ .   .   .   .
3  .   .   .   .   .   .
```

#### Demo Code (`Tab 2`)
*(Legacy `4.0` Tab 2 halted one tile short at `(3,0)` because `MAIN` only had 3 blocks. Fixed to `4` blocks in `MAIN` so final `MOVE_FWD` lands squarely ON `Goal (4,0)`.)*
- **`MAIN` (`4` blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "MOVE_FWD" },
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "MOVE_FWD" }
  ]
  ```
- **`F1` (`4` blocks):**
  ```json
  [
    { "op": "MOVE_FWD" },
    { "op": "TURN_LEFT" },
    { "op": "MOVE_FWD" },
    { "op": "TURN_RIGHT" }
  ]
  ```

#### Execution Trace (`Tab 2`)
1. `MAIN[0]` `CALL_FN F1`: `(0,2,E)` → `MOVE_FWD` `(1,2,E)` → `TURN_LEFT` `(1,2,N)` → `MOVE_FWD` `(1,1,N)` → `TURN_RIGHT` `(1,1,E)`.
2. `MAIN[1]` `MOVE_FWD`: `(2,1,E)`.
3. `MAIN[2]` `CALL_FN F1`: `(2,1,E)` → `MOVE_FWD` `(3,1,E)` → `TURN_LEFT` `(3,1,N)` → `MOVE_FWD` `(3,0,N)` → `TURN_RIGHT` `(3,0,E)`.
4. `MAIN[3]` `MOVE_FWD`: **`(4, 0, EAST)` = `Goal` ✅** (End-of-program Victory!)

---

## Edge Cases & Acceptance Criteria
- **Zero-Reading Check:** Confirm zero instructions or prose render anywhere in the learner workspace or Victory modal; `📖 Parent / Teacher Tip` collapses by default.
- **Tab Follow Verification:** Playback must switch visible scope highlight cleanly from `MAIN` → `F1` → `MAIN` in both tabs.
- **Victory Verification:** Both Tab 1 and Tab 2 finish ON `Goal` (`(3,1)` and `(4,0)`) at end-of-program with zero barrier collisions and zero out-of-bounds wall coordinates.
