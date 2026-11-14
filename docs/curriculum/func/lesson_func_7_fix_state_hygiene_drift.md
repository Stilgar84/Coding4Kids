# func.7: Fix State Hygiene Drift

- **Header ID:** `func.7` *(Promoted from Idea)*
- **Format:** 🔧 Fix-It
- **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)
- **One-Concept Goal:** Debug a broken helper `F1` whose missing return turn (`TURN_RIGHT`) leaves the robot facing `NORTH` instead of `EAST` after Iteration 1, causing Iteration 2 to walk straight into the North wall!

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Every time the robot dips into a side alley and backs out (`Turn Left → Forward → Back`), it ends up facing **North** instead of **East** down the hallway! Watch what happens on loop #2: because `F1` forgot to turn back `Right`, the robot marches North into the wall instead of moving East to the second alcove. Add one `Turn Right` at the end of `F1` to fix the whole run!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1"]` (`F2`, `F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"]`
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`targets: ["F1"]`; hidden inside `F1`)
  - `allowedBlockParams`: `{ "LOOP_START": { "repeat": [2, 3, 4] } }`
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `false`
- **Slot Trays & Edit Delta:**
  - `slotCap`: `{ "perScope": { "MAIN": 5, "F1": 4 }, "maxTotal": 9 }` (`sum(perScope) = 9 == maxTotal`)
  - **Canonical Solution Count:** `5 (MAIN) + 4 (F1) = 9` flat blocks.
  - **Edit Delta:** **`1`** (Learner appends `TURN_RIGHT` at the end of pre-filled buggy `F1`, within `≤ 6–8`).
- **UI Coach Spotlights (`uiSpotlights`):** `["fix-it-watch-crash", "scope-tab-f1", "heading-state-hygiene"]`
- **Environment Flags (`envConfig`):**
  - `strictInteractionCollision`: `true`
  - `requireAllItemsCollected`: `true`
  - `requireEmptyBackpackAtGoal`: `false`

---

## Grid Layout & Coordinates (`7 × 2` Alcove Hallway)

- **Dimensions:** `width: 7, height: 2` (`x: 0..6, y: 0..1`)
- **Robot Start:** `{ "x": 0, "y": 1, "dir": "EAST" }`
- **Goal (Shuttered `🏁 0/3 → 3/3`):** `{ "x": 6, "y": 1 }`
- **Ordered Flags (`1 ⋯▶ 3`, `order: 0..2`):**
  - `Flag 1`: `{ "x": 2, "y": 0, "order": 0 }`
  - `Flag 2`: `{ "x": 4, "y": 0, "order": 1 }`
  - `Flag 3`: `{ "x": 6, "y": 0, "order": 2 }`
- **Barriers (`V(1..6, 0)` separate row-0 alcoves; `H(0,1), H(1,1), H(3,1), H(5,1)` leave entrances open ONLY at `x=2, 4, 6`):**
  ```json
  [
    { "x": 1, "y": 0, "type": "V" },
    { "x": 2, "y": 0, "type": "V" },
    { "x": 3, "y": 0, "type": "V" },
    { "x": 4, "y": 0, "type": "V" },
    { "x": 5, "y": 0, "type": "V" },
    { "x": 6, "y": 0, "type": "V" },
    { "x": 0, "y": 1, "type": "H" },
    { "x": 1, "y": 1, "type": "H" },
    { "x": 3, "y": 1, "type": "H" },
    { "x": 5, "y": 1, "type": "H" }
  ]
  ```

```text
   0   1   2   3   4   5   6
0  . │ . │ ① │ . │ ② │ . │ ③
   ─   ─   ▲   ─   ▲   ─   ▲
1 🤖──▶●──▶●──▶●──▶●──▶●──▶🏁
```

---

## Workspaces & Solutions

### Initial Buggy Starter Workspace (`Edit Delta: 1`)
- **`MAIN` (`5` flat blocks, already correct!):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "MOVE_FWD" },
        { "op": "CALL_FN", "fn": "F1" }
      ]
    }
  ]
  ```
- **`F1` (`3` blocks — MISSING `TURN_RIGHT` at end!):**
  ```json
  [
    { "op": "TURN_LEFT" },
    { "op": "MOVE_FWD" },
    { "op": "MOVE_BACK" }
  ]
  ```

#### Buggy Execution Trace (Starter)
1. **Iter 1:** `(0,1,E)` → `MOVE_FWD ×2` → `(2,1,E)` → `CALL F1`: `TURN_LEFT(N)` → `MOVE_FWD(2,0)` (Flag 1) → `MOVE_BACK(2,1)` — returns still facing **`NORTH`**!
2. **Iter 2:** `(2,1, NORTH)` → `MOVE_FWD` → `(2,0)` → `MOVE_FWD` → **💥 `COLLISION` against North outer border (`y = -1`)!**

### Partial / Clue Workspace (Clue Reveal)
- **`MAIN`:** `[LOOP_START ×3, MOVE_FWD, MOVE_FWD, CALL_FN F1, LOOP_END]`
- **`F1`:** `[TURN_LEFT, MOVE_FWD, MOVE_BACK, PLACEHOLDER("turn")]`

### Canonical Fixed Solution (`5 + 4 = 9` flat blocks)
- **`MAIN` (`5` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "MOVE_FWD" },
        { "op": "CALL_FN", "fn": "F1" }
      ]
    }
  ]
  ```
- **`F1` (`4` flat blocks):**
  ```json
  [
    { "op": "TURN_LEFT" },
    { "op": "MOVE_FWD" },
    { "op": "MOVE_BACK" },
    { "op": "TURN_RIGHT" }
  ]
  ```

#### Fixed Execution Trace
1. **Iter 1:** `(0,1,E)` → `(2,1,E)` → `F1` collects **Flag 1 `(2,0)`** (`1/3`), backs to `(2,1)`, **`TURN_RIGHT`** restores `EAST`.
2. **Iter 2:** `(2,1,E)` → `(4,1,E)` → `F1` collects **Flag 2 `(4,0)`** (`2/3`), backs to `(4,1)`, **`TURN_RIGHT`** restores `EAST`.
3. **Iter 3:** `(4,1,E)` → `(6,1,E)` → `F1` collects **Flag 3 `(6,0)`** (`3/3` — `🏁` opens!), backs to **`(6, 1, EAST)` = `Goal` ✅** (End-of-program Victory!).

---

## Edge Cases & Acceptance Criteria
- **Buggy Starter Verification:** Must reliably hit `COLLISION` on Iteration 2 (`(2,0) → North`).
- **One-Block Fix Verification:** Appending `TURN_RIGHT` in `F1` (`1` edit) passes cleanly without editing `MAIN`.
- **Zero-Reading Check:** Collapsed adult tip only; no error prose shown on `COLLISION`.
