# func.1: Defining & Calling Helper `F1`

- **Header ID:** `func.1` (Legacy `4.1`)
- **Format:** 🤖 Puzzle
- **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)
- **One-Concept Goal:** Build a 3-block step-up helper in `F1` (`TURN_LEFT`, `MOVE_FWD`, `TURN_RIGHT`) and replace the three `?` function placeholders in `Main` with `CALL F1` inside a tight `6`-slot `Main` tray.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

There aren't enough slots in `Main` to spell out every step from start to flag! Open the `F1` tab to build a three-block "step-up" helper (`Turn Left → Move Forward → Turn Right`), then pop `CALL F1` into the three `?` spots on `Main` so `F1` lifts the robot one row higher each time.

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1"]` (`F2`, `F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"]`
  - `allowedControlBlocks`: `["CALL_FN"]` (`targets: ["F1"]`; hidden while editing inside `F1`)
  - `allowedBlockParams`: `{}`
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `false`
- **Slot Trays & Edit Delta:**
  - `slotCap`: `{ "perScope": { "MAIN": 6, "F1": 4 }, "maxTotal": 10 }` (`sum(perScope) = 10 == maxTotal`)
  - **Canonical Solution Count:** `6 (MAIN) + 3 (F1) = 9` flat blocks.
  - **Edit Delta:** **`6`** (`3` `?` placeholder replacements in `MAIN` + `3` blocks inserted into `F1`, within `≤ 6–8`).
  - **Bypass Mathematical Proof:** Shortest un-helped path from `(0,3,E)` to `(3,0)` moves `+3 East` and `-3 North` with at least `3` turns = minimum `9–10` blocks (`> 6` slots in `MAIN`). Calling `F1` is strictly mandatory.
- **UI Coach Spotlights (`uiSpotlights`):** `["scope-tab-f1", "placeholder-slot-function", "call-fn-block"]`
- **Environment Flags (`envConfig`):**
  - `strictInteractionCollision`: `true`
  - `requireAllItemsCollected`: `false`
  - `requireEmptyBackpackAtGoal`: `false`

---

## Grid Layout & Coordinates (`6 × 5`)

- **Dimensions:** `width: 6, height: 5` (`x: 0..5, y: 0..4`)
- **Robot Start:** `{ "x": 0, "y": 3, "dir": "EAST" }`
- **Goal:** `{ "x": 3, "y": 0 }`
- **Flags / Items / Keys / Gates / Planks:** `[]`
- **Barriers:**
  ```json
  [
    { "x": 1, "y": 3, "type": "V" },
    { "x": 1, "y": 3, "type": "H" },
    { "x": 0, "y": 2, "type": "H" },
    { "x": 2, "y": 2, "type": "V" },
    { "x": 1, "y": 1, "type": "H" },
    { "x": 2, "y": 2, "type": "H" },
    { "x": 4, "y": 1, "type": "V" },
    { "x": 3, "y": 2, "type": "H" }
  ]
  ```

```text
   0   1   2   3   4   5
0  .   .   .   🏁  .   .
       ─       ▲
1  .   ●──▶●──▶● │ .   .
   ─   ▲ │ ─   ─
2  ●──▶● │ .   .   .   .
   ▲   ─
3 🤖 │ .   .   .   .   .
4  .   .   .   .   .   .
```

---

## Workspaces & Solutions

### Initial Starter Workspace (`Edit Delta: 6`)
- **`MAIN` (`6` slots occupied by scaffold + 3 `?` placeholders):**
  ```json
  [
    { "op": "PLACEHOLDER", "hintCategory": "function" },
    { "op": "MOVE_FWD" },
    { "op": "PLACEHOLDER", "hintCategory": "function" },
    { "op": "MOVE_FWD" },
    { "op": "MOVE_FWD" },
    { "op": "PLACEHOLDER", "hintCategory": "function" }
  ]
  ```
- **`F1` (`0` blocks):** `[]`

### Partial / Clue Workspace (Clue Reveal)
- **`MAIN`:** `[CALL_FN F1, MOVE_FWD, ?, MOVE_FWD, MOVE_FWD, ?]`
- **`F1`:** `[TURN_LEFT, PLACEHOLDER("motion"), TURN_RIGHT]`

### Canonical Full Solution (`6 + 3 = 9` blocks)
- **`MAIN` (`6` blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "MOVE_FWD" },
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "MOVE_FWD" },
    { "op": "MOVE_FWD" },
    { "op": "CALL_FN", "fn": "F1" }
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
*(Note: `F1` has `4` tray slots so an equivalent solution `[TURN_LEFT, MOVE_FWD, TURN_RIGHT, MOVE_FWD]` would overshoot horizontally unless paired with a `4`-block `MAIN` `[CALL_FN F1, CALL_FN F1, MOVE_FWD, CALL_FN F1]` — wait: that shifts rows `(0,3)->(1,2)->(2,1)->(3,1)->(4,0)` missing `(3,0)` because `(0,3)→(3,0)` is `+3E, -3N`, whereas `MAIN` is pre-scaffolded with `[?, F, ?, F, F, ?]` guiding `(3E, 3N)` cleanly!)*

#### Execution Trace
1. Start at `(0, 3, EAST)`.
2. `CALL_FN F1` → `TURN_LEFT` `(N)`, `MOVE_FWD` `(0, 2)`, `TURN_RIGHT` `(E)`.
3. `MOVE_FWD` → `(1, 2, EAST)`.
4. `CALL_FN F1` → `(1, 1, EAST)`.
5. `MOVE_FWD`, `MOVE_FWD` → `(2, 1)` → `(3, 1, EAST)`.
6. `CALL_FN F1` → **`(3, 0, EAST)` = `Goal` ✅** (End-of-program Victory!)

---

## Edge Cases & Acceptance Criteria
- **Starter Failure Check:** Running the untouched Starter Workspace ignores `?` placeholders (`NOOP`), moves `3` times East? Wait — `V(1,3)` immediately stops `MOVE_FWD` at `(0,3)` → **FAILS immediately** on Starter (`strictInteractionCollision: true`)!
- **Slot Cap Check:** `MAIN` (`6`) blocks adding a 7th block; `total = 10` matches `sum(perScope) = 6 + 4 = 10`.
- **Hint Category Check:** All `?` blocks in Starter use `hintCategory: "function"` (`0x09` payload `5`) so icon badges match `CALL_FN F1`.
