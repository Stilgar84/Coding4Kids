# func.A: Modular Station Repair

- **Header ID:** `func.A` (Legacy `4A`)
- **Format:** 🏆 Capstone
- **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)
- **One-Concept Goal:** Master modular helper composition (`Main → F1 → F2` + `Loop ×3`) to service 3 radial Key/Gate/Flag repair wings (`North`, `East`, `South`) around a central hub `(2, 2)` and then walk two steps West onto the open `Goal (0, 2)` — built cleanly from an empty workspace in `11` total blocks (`≤ 12` Capstone Edit Delta).

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Look at the three repair tunnels around the hub: `North`, `East`, and `South` all have the exact same job — pick up a key (`PICK_UP`), unlock the gate ahead (`USE_DROP`), and step onto the flag (`MOVE_FWD`). Put those three steps in `F2`! Then teach `F1` how to enter one tunnel, run `F2`, and back out (`MOVE_BACK ×2`). Finally, in `Main`, repeat `[Call F1 → Turn Right]` three times and march straight down the West hall to `🏁`!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1", "F2"]` (`F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"]`
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`MAIN` allows `F1, F2`; `F1` allows `F2`; `F2` hides `CALL_FN`)
  - `allowedBlockParams`: `{ "LOOP_START": { "repeat": [2, 3, 4] } }`
  - `allowRepeatBadges`: `true` *(used for `MOVE_BACK ×2` in `F1` and trailing `MOVE_FWD ×2` in `MAIN`)*
  - `allowActionParams`: `false`
- **Slot Trays & Edit Delta:**
  - `slotCap`: `{ "perScope": { "MAIN": 5, "F1": 4, "F2": 4 }, "maxTotal": 13 }` (`sum(perScope) = 13 == maxTotal`, `≤ 5` slots/tab!)
  - **Atomic Pair-Insertion:** `LOOP_START` in `MAIN` inserts `[LOOP_START, LOOP_END]` (`2` slots), leaving `2` inner slots (`[CALL_FN F1, TURN_RIGHT]`) plus `1` trailing slot (`MOVE_FWD(×2)`).
  - **Canonical Solution Count:** `5 (MAIN) + 3 (F1) + 3 (F2) = 11` flat blocks.
  - **Edit Delta:** **`11`** (empty Starter Workspace → `11` blocks authored directly, within `≤ 10–12` Capstone target!).
  - **Bypass Mathematical Proof:**
    - `MAIN` (`5` slots max) with `LOOP` + `MOVE_FWD(×2)` leaves only `2` body slots inside the loop — impossible to inline `F1`'s `MOVE_FWD + CALL_FN F2 + MOVE_BACK(×2) + TURN_RIGHT` (`4` body ops) without `CALL_FN F1`.
    - `F1` (`4` slots max) cannot inline `F2`'s `PICK_UP + USE_DROP + MOVE_FWD` alongside `MOVE_FWD + MOVE_BACK(×2)` because non-adjacent ops (`MOVE_FWD, PICK_UP, USE_DROP, MOVE_FWD, MOVE_BACK(×2)`) require **`5`** distinct slots (`> 4`), making `CALL_FN F2` mathematically mandatory!
- **UI Coach Spotlights (`uiSpotlights`):** `["capstone-blank-canvas", "radial-3-wing-symmetry", "west-hall-finish"]`
- **Environment Flags (`envConfig`):**
  - `strictInteractionCollision`: `true`
  - `requireAllItemsCollected`: `true`
  - `requireEmptyBackpackAtGoal`: `true`

---

## Grid Layout & Coordinates (`6 × 6` 3-Wing Radial Hub + Open West Hall)

*(Fixes legacy `4A`'s fatal flaw where placing Goal inside a gated West corridor caused final `MOVE_BACK ×2` in `F1` to step OFF Goal! Here `North/East/South` are the 3 repair wings and `West` is an open hall leading straight to `Goal (0, 2)`.)*

- **Dimensions:** `width: 6, height: 6` (`x: 0..5, y: 0..5`)
- **Robot Start:** `{ "x": 2, "y": 2, "dir": "NORTH" }`
- **Goal (Shuttered `🏁 0/3 → 3/3`, empty hands required):** `{ "x": 0, "y": 2 }`
- **Keys (`items`):**
  - `{ "x": 2, "y": 1, "type": "KEY", "color": "amber", "shape": "circle" }` *(North ●)*
  - `{ "x": 3, "y": 2, "type": "KEY", "color": "emerald", "shape": "triangle" }` *(East ▲)*
  - `{ "x": 2, "y": 3, "type": "KEY", "color": "purple", "shape": "diamond" }` *(South ◆)*
- **Gates (`gates`, match key color + shape):**
  - `{ "x": 2, "y": 0, "color": "amber", "shape": "circle" }` *(North ●)*
  - `{ "x": 4, "y": 2, "color": "emerald", "shape": "triangle" }` *(East ▲)*
  - `{ "x": 2, "y": 4, "color": "purple", "shape": "diamond" }` *(South ◆)*
- **Ordered Flags (`1 ⋯▶ 3`, placed on the gate cells; stepping onto `(2,0), (4,2), (2,4)` after `USE_DROP` unlocks & collects):**
  - `Flag 1`: `{ "x": 2, "y": 0, "order": 0 }`
  - `Flag 2`: `{ "x": 4, "y": 2, "order": 1 }`
  - `Flag 3`: `{ "x": 2, "y": 4, "order": 2 }`
- **Barriers (Laterally seals all 4 corridors around `(2,2)`):**
  ```json
  [
    { "x": 2, "y": 0, "type": "V" },
    { "x": 2, "y": 1, "type": "V" },
    { "x": 3, "y": 0, "type": "V" },
    { "x": 3, "y": 1, "type": "V" },
    { "x": 3, "y": 2, "type": "H" },
    { "x": 4, "y": 2, "type": "H" },
    { "x": 3, "y": 3, "type": "H" },
    { "x": 4, "y": 3, "type": "H" },
    { "x": 5, "y": 2, "type": "V" },
    { "x": 2, "y": 3, "type": "V" },
    { "x": 2, "y": 4, "type": "V" },
    { "x": 3, "y": 3, "type": "V" },
    { "x": 3, "y": 4, "type": "V" },
    { "x": 2, "y": 5, "type": "H" },
    { "x": 0, "y": 2, "type": "H" },
    { "x": 1, "y": 2, "type": "H" },
    { "x": 0, "y": 3, "type": "H" },
    { "x": 1, "y": 3, "type": "H" }
  ]
  ```

```text
   0     1     2      3      4     5
0  .     .  │🟨●①  │  .      .     .
1  .     .  │ 🔑●  │  .      .     .
   ───   ───   ▲             ─
2 🏁 ◀── ● ◀── 🤖  ──▶🔑▲──▶🟩▲② │ .
   ───   ───   ▼      ─      ─
3  .     .  │ 🔑◆  │  .      .     .
4  .     .  │🟪◆③  │  .      .     .
              ───
5  .     .     .      .      .     .
```

---

## Workspaces & Solutions

### Initial Starter Workspace (`Edit Delta: 11`)
- **`MAIN`:** `[]`
- **`F1`:** `[]`
- **`F2`:** `[]`

### Partial / Clue Workspace (Clue Reveal)
- **`MAIN`:** `[LOOP_START ×3, CALL_FN F1, TURN_RIGHT, LOOP_END, MOVE_FWD(repeat: 2)]`
- **`F1`:** `[MOVE_FWD, PLACEHOLDER("function"), MOVE_BACK(repeat: 2)]`
- **`F2`:** `[PICK_UP, USE_DROP, PLACEHOLDER("motion")]`

### Canonical Full Solution (`5 + 3 + 3 = 11` flat blocks)
- **`MAIN` (`5` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "TURN_RIGHT" }
      ]
    },
    { "op": "MOVE_FWD", "repeat": 2 }
  ]
  ```
- **`F1` (`3` blocks):**
  ```json
  [
    { "op": "MOVE_FWD" },
    { "op": "CALL_FN", "fn": "F2" },
    { "op": "MOVE_BACK", "repeat": 2 }
  ]
  ```
- **`F2` (`3` blocks):**
  ```json
  [
    { "op": "PICK_UP" },
    { "op": "USE_DROP" },
    { "op": "MOVE_FWD" }
  ]
  ```

#### Execution Trace
1. Start at `(2, 2, NORTH)`.
2. **Iter 1 (North Wing):** `CALL F1` → `MOVE_FWD(2,1,N)` → `F2`: `PICK_UP` (amber key), `USE_DROP` (unlocks `(2,0)`), `MOVE_FWD(2,0,N)` (collects **Flag 1**, `1/3`) → `MOVE_BACK ×2` back to `(2,2,N)` → `TURN_RIGHT` → `(2,2,E)`.
3. **Iter 2 (East Wing):** `CALL F1` → `MOVE_FWD(3,2,E)` → `F2`: `PICK_UP` (emerald key), `USE_DROP` (unlocks `(4,2)`), `MOVE_FWD(4,2,E)` (collects **Flag 2**, `2/3`) → `MOVE_BACK ×2` back to `(2,2,E)` → `TURN_RIGHT` → `(2,2,S)`.
4. **Iter 3 (South Wing):** `CALL F1` → `MOVE_FWD(2,3,S)` → `F2`: `PICK_UP` (purple key), `USE_DROP` (unlocks `(2,4)`), `MOVE_FWD(2,4,S)` (collects **Flag 3**, `3/3` — `🏁` opens!) → `MOVE_BACK ×2` back to `(2,2,S)` → `TURN_RIGHT` → `(2,2,W)`.
5. **West Hall Finish:** `MOVE_FWD(repeat: 2)` → `(1,2,W)` → **`(0, 2, WEST)` = `Goal` ✅** (Empty backpack, all 3 keys spent, all 3 ordered flags collected, ends squarely ON `Goal`!).

---

## Edge Cases & Acceptance Criteria
- **Starter Failure Check:** Running empty Starter stays at `(2,2)` off `Goal` → fails cleanly.
- **No `F3` Tab Check:** Only `["MAIN", "F1", "F2"]` tabs render (`F3` omitted).
- **Zero-Bypass Check:** Verified that `MAIN: 5, F1: 4, F2: 4` makes skipping `F1` or `F2` impossible even with `allowRepeatBadges: true`.
