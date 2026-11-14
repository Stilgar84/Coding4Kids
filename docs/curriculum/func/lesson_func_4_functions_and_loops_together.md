# func.4: Functions and Loops Together

- **Header ID:** `func.4` (Legacy `4.4`)
- **Format:** 🤖 Puzzle
- **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)
- **One-Concept Goal:** Put a `Loop` inside helper `F1` (`2` staircase zig-zags) AND call `F1` inside a `Loop` in `Main` (`3` spiral wings + `TURN_RIGHT`), defeating both straight-line repeat-badge bypasses and premature mid-loop exits.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

A `Loop` in `Main` turns the robot `90°` right after every wing (`× 3`), while a `Loop` inside `F1` climbs two staircase steps (`Left → Step → Right → Step × 2`) along that wing! Notice why repeat badges (`×2`, `×3`) on single blocks can't replace `F1`: every step inside `F1` alternates turns and moves, and the robot must reach the final flag at the very end of the third wing!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1"]` (`F2`, `F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"]`
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`targets: ["F1"]`; hidden while editing inside `F1`)
  - `allowedBlockParams`: `{ "LOOP_START": { "repeat": [2, 3, 4, 5, 6] } }`
  - `allowRepeatBadges`: `true` *(explicitly enabled here — non-adjacent alternating pattern in `F1` mathematically prevents replacing `LOOP` with action repeat badges!)*
  - `allowActionParams`: `false`
- **Slot Trays & Edit Delta:**
  - `slotCap`: `{ "perScope": { "MAIN": 4, "F1": 6 }, "maxTotal": 10 }` (`sum(perScope) = 10 == maxTotal`, `≤ 6`/tab)
  - **Atomic Pair-Insertion:** Inserting `LOOP_START` in `F1` inserts `[LOOP_START, LOOP_END]` (`2` slots), leaving `4` inner slots for `[TURN_LEFT, MOVE_FWD, TURN_RIGHT, MOVE_FWD]`.
  - **Canonical Solution Count:** `4 (MAIN) + 6 (F1) = 10` flat blocks.
  - **Edit Delta:** **`7`** (`1` `CALL_FN F1` replacing `?` in pre-scaffolded `MAIN` + `6` blocks authored in `F1`, within `≤ 6–8`).
  - **Bypass Mathematical Proof:** Inside `F1` (`6` slots max), the `4`-step motif `[TURN_LEFT, MOVE_FWD, TURN_RIGHT, MOVE_FWD]` has **zero adjacent identical ops** (`L ≠ F ≠ R ≠ F`), so `×2` repeat badges cannot compress `8` steps (`4 × 2`) into `6` slots without `LOOP` (`2 + 4 = 6` slots). Meanwhile `MAIN` (`4` slots) cannot inline `F1` and `TURN_RIGHT` (`× 3`), making both loops and `CALL F1` strictly required!
- **UI Coach Spotlights (`uiSpotlights`):** `["nested-loop-in-f1", "ordered-flags-1-to-5", "shuttered-goal"]`
- **Environment Flags (`envConfig`):**
  - `strictInteractionCollision`: `true`
  - `requireAllItemsCollected`: `true`
  - `requireEmptyBackpackAtGoal`: `false`

---

## Grid Layout & Coordinates (`6 × 6` 3-Turn Spiral Staircase Wings)

- **Dimensions:** `width: 6, height: 6` (`x: 0..5, y: 0..5`)
- **Robot Start:** `{ "x": 1, "y": 3, "dir": "EAST" }`
- **Goal (Shuttered `🏁 0/5 → 5/5`):** `{ "x": 3, "y": 5 }`
- **Ordered Flags (`1 ⋯▶ 5`, strictly ascending `order: 0..4`):**
  - `Flag 1`: `{ "x": 2, "y": 2, "order": 0 }`
  - `Flag 2`: `{ "x": 3, "y": 1, "order": 1 }`
  - `Flag 3`: `{ "x": 4, "y": 2, "order": 2 }`
  - `Flag 4`: `{ "x": 5, "y": 3, "order": 3 }`
  - `Flag 5`: `{ "x": 4, "y": 4, "order": 4 }`
- **Barriers (Seals inner island & prevents diagonal shortcuts; zero overlap with traversed spiral edges):**
  ```json
  [
    { "x": 1, "y": 3, "type": "V" },
    { "x": 2, "y": 3, "type": "V" },
    { "x": 1, "y": 4, "type": "H" },
    { "x": 2, "y": 3, "type": "H" },
    { "x": 3, "y": 3, "type": "V" },
    { "x": 3, "y": 2, "type": "H" },
    { "x": 4, "y": 2, "type": "V" },
    { "x": 4, "y": 3, "type": "H" },
    { "x": 4, "y": 3, "type": "V" },
    { "x": 5, "y": 3, "type": "V" },
    { "x": 4, "y": 4, "type": "H" },
    { "x": 3, "y": 4, "type": "H" },
    { "x": 4, "y": 4, "type": "V" },
    { "x": 3, "y": 4, "type": "V" },
    { "x": 3, "y": 5, "type": "H" }
  ]
  ```

```text
   0   1   2   3   4   5
0  .   .   .   .   .   .
1  .   .   ●──▶②──▶●   .
           ▲   ─   ▼
2  .   ●──▶①   . │ ③──▶●
       ▲   ─   ─   ─   ▼
3  . │🤖 │ . │ . │ . │ ④
       ─   ─   ─   ─   ▼
4  .   .   . │ . │ ⑤◀──●
               ─   ▼
5  .   .   .  🏁◀──●   .
```

---

## Workspaces & Solutions

### Initial Starter Workspace (`Edit Delta: 7`)
- **`MAIN` (`4` flat blocks pre-scaffolded):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "PLACEHOLDER", "hintCategory": "function" },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
  ```
- **`F1` (`0` blocks):** `[]`

### Partial / Clue Workspace (Clue Reveal)
- **`MAIN`:** `[LOOP_START ×3, CALL_FN F1, TURN_RIGHT, LOOP_END]`
- **`F1`:** `[LOOP_START ×2, TURN_LEFT, PLACEHOLDER("motion"), TURN_RIGHT, PLACEHOLDER("motion"), LOOP_END]`

### Canonical Full Solution (`4 + 6 = 10` flat blocks)
- **`MAIN` (`4` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
  ```
- **`F1` (`6` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 2,
      "body": [
        { "op": "TURN_LEFT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" }
      ]
    }
  ]
  ```

#### Execution Trace
1. Start at `(1, 3, EAST)`.
2. **Outer Iter 1:** `CALL_FN F1`:
   - Inner 1: `L(N), F(1,2), R(E), F(2,2)` → collects **Flag 1 `(2,2)`** (`1/5`).
   - Inner 2: `L(N), F(2,1), R(E), F(3,1)` → collects **Flag 2 `(3,1)`** (`2/5`).
   - `MAIN` `TURN_RIGHT` → `(3, 1, SOUTH)`.
3. **Outer Iter 2:** `CALL_FN F1`:
   - Inner 1: `L(E), F(4,1), R(S), F(4,2)` → collects **Flag 3 `(4,2)`** (`3/5`).
   - Inner 2: `L(E), F(5,2), R(S), F(5,3)` → collects **Flag 4 `(5,3)`** (`4/5`).
   - `MAIN` `TURN_RIGHT` → `(5, 3, WEST)`.
4. **Outer Iter 3:** `CALL_FN F1`:
   - Inner 1: `L(S), F(5,4), R(W), F(4,4)` → collects **Flag 5 `(4,4)`** (`5/5` — `🏁` shutter opens!).
   - Inner 2: `L(S), F(4,5), R(W), F(3,5)` → lands on `Goal (3,5)`.
   - `MAIN` `TURN_RIGHT` → stays on **`(3, 5, NORTH)` = `Goal` ✅** at end of program!

---

## Edge Cases & Acceptance Criteria
- **Starter Failure Check:** Running Starter spins in place (`TURN_RIGHT × 3`) on `(1, 3)` → fails cleanly off `Goal`.
- **End-of-Program Goal Check:** Even if `Loop ×3` wraps `Goal` in the last statement (`TURN_RIGHT`), `TURN_RIGHT` leaves the robot ON `(3,5)` so end-of-program Goal check passes cleanly without needing mid-loop termination.
- **No Repeat-Badge Bypass:** Verified that replacing `LOOP ×2` in `F1` with repeat badges still needs `8` blocks (`> 6` slots).
