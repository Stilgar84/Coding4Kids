# func.5: Layered Composition (`Main → F1 → F2`)

- **Header ID:** `func.5` (Legacy `4.5`)
- **Format:** 🤖 Puzzle
- **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)
- **One-Concept Goal:** Compose two layers of helper tabs (`Main → F1 → F2`): `F2` picks up the matching key, turns North, unlocks the gate, and steps inside; `F1` calls `F2`, grabs the flag, backs safely back into the hallway (`MOVE_BACK × 2`), and faces East again; `Main` repeats `F1` across 3 chambers and walks onto `Goal (6, 2)`.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Now `F1` itself calls a second helper, `F2`! Put the micro-job — `Pick Up Key → Turn Left → Unlock Gate → Step In` — inside `F2`. Then `F1` calls `F2`, grabs the flag, backs straight out (`Back, Back`), and turns `Right` to restore its East hallway heading so `Main`'s loop can glide cleanly to the next doorway and finish on `🏁`!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1", "F2"]` (`F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false` (`F1` can call `F2`, `MAIN` can call `F1`/`F2`; `F2` hides `CALL_FN` so no cycles can form).
- **Palette:**
  - `allowedSimBlocks`: `["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"]`
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`MAIN` allows `F1, F2`; `F1` allows `F2`; `F2` hides `CALL_FN`)
  - `allowedBlockParams`: `{ "LOOP_START": { "repeat": [2, 3, 4, 5] } }`
  - `allowRepeatBadges`: `true` *(or `false` — note `MOVE_FWD ×2` / `MOVE_BACK ×2` fit cleanly inside `5`-slot `MAIN` / `F1` even without badges! Wait: let's keep `allowRepeatBadges: false` so every single action block is 1-for-1 legible AND check slot counts: `MAIN` `[LOOP×3, CALL F1, MOVE_FWD, MOVE_FWD, LOOP_END]` = **`5`** slots, `F1` `[CALL F2, MOVE_FWD, MOVE_BACK, MOVE_BACK, TURN_RIGHT]` = **`5`** slots, `F2` `[PICK_UP, TURN_LEFT, USE_DROP, MOVE_FWD]` = **`4`** slots! Zero badges needed!)*
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `false`
- **Slot Trays & Edit Delta:**
  - `slotCap`: `{ "perScope": { "MAIN": 5, "F1": 5, "F2": 4 }, "maxTotal": 14 }` (`sum(perScope) = 14 == maxTotal`, `≤ 5` slots/tab!)
  - **Canonical Solution Count:** `5 (MAIN) + 5 (F1) + 4 (F2) = 14` flat blocks.
  - **Edit Delta:** **`8`** (`1` `CALL_FN F1` in pre-scaffolded `MAIN` + `5` blocks authored in `F1` + `2` `?` replacements in pre-scaffolded `F2`, within `≤ 6–8`).
  - **Bypass Mathematical Proof:** Completing all 3 identical chambers (`PICK_UP, TURN_L, USE_DROP, MOVE_FWD, MOVE_FWD, MOVE_BACK, MOVE_BACK, TURN_R` = `8` distinct ops) plus `MOVE_FWD × 2` (`10` ops total × 3 bays) requires `F2` + `F1` + `MAIN`'s `LOOP ×3`; a `5`-slot `F1` cannot inline `F2`'s `4` blocks alongside `MOVE_FWD, MOVE_BACK, MOVE_BACK, TURN_RIGHT` (`8 > 5`).
- **UI Coach Spotlights (`uiSpotlights`):** `["scope-tab-f2", "nested-call-f1-to-f2", "use-drop-before-step"]`
- **Environment Flags (`envConfig`):**
  - `strictInteractionCollision`: `true`
  - `requireAllItemsCollected`: `true`
  - `requireEmptyBackpackAtGoal`: `true`

---

## Grid Layout & Coordinates (`7 × 3` 3-Chamber Corridor)

*(Fixes legacy `4.5` missing alcove barriers AND fixes legacy `4.5`'s fatal `MOVE_BACK` off Goal `(2, 3)` at end of `MAIN` by placing `Goal` cleanly at `(6, 2)` after the 3rd chamber!)*

- **Dimensions:** `width: 7, height: 3` (`x: 0..6, y: 0..2`)
- **Robot Start:** `{ "x": 0, "y": 2, "dir": "EAST" }`
- **Goal (Shuttered `🏁 0/3 → 3/3`, empty hands required):** `{ "x": 6, "y": 2 }`
- **Keys (`items`):**
  - `{ "x": 0, "y": 2, "type": "KEY", "color": "amber", "shape": "circle" }` *(●)*
  - `{ "x": 2, "y": 2, "type": "KEY", "color": "emerald", "shape": "triangle" }` *(▲)*
  - `{ "x": 4, "y": 2, "type": "KEY", "color": "purple", "shape": "diamond" }` *(◆)*
- **Gates (`gates`, match key color + shape):**
  - `{ "x": 0, "y": 1, "color": "amber", "shape": "circle" }` *(●)*
  - `{ "x": 2, "y": 1, "color": "emerald", "shape": "triangle" }` *(▲)*
  - `{ "x": 4, "y": 1, "color": "purple", "shape": "diamond" }` *(◆)*
- **Ordered Flags (`1 ⋯▶ 3`, `order: 0..2`):**
  - `Flag 1`: `{ "x": 0, "y": 0, "order": 0 }`
  - `Flag 2`: `{ "x": 2, "y": 0, "order": 1 }`
  - `Flag 3`: `{ "x": 4, "y": 0, "order": 2 }`
- **Barriers (Seals chambers `x=0, 2, 4` and ceiling of hallway `x=1, 3, 5, 6`):**
  ```json
  [
    { "x": 1, "y": 0, "type": "V" },
    { "x": 1, "y": 1, "type": "V" },
    { "x": 2, "y": 0, "type": "V" },
    { "x": 2, "y": 1, "type": "V" },
    { "x": 3, "y": 0, "type": "V" },
    { "x": 3, "y": 1, "type": "V" },
    { "x": 4, "y": 0, "type": "V" },
    { "x": 4, "y": 1, "type": "V" },
    { "x": 5, "y": 0, "type": "V" },
    { "x": 5, "y": 1, "type": "V" },
    { "x": 1, "y": 2, "type": "H" },
    { "x": 3, "y": 2, "type": "H" },
    { "x": 5, "y": 2, "type": "H" },
    { "x": 6, "y": 2, "type": "H" }
  ]
  ```

```text
   0     1     2     3     4     5     6
0 ①  │  .  │  ②  │  .  │  ③  │  .     .
1 🟨● │  .  │ 🟩▲ │  .  │ 🟪◆ │  .     .
         ─           ─           ─     ─
2 🤖🔑● ──▶ . ──▶ 🔑▲ ──▶ . ──▶ 🔑◆ ──▶ . ──▶ 🏁
```

---

## Workspaces & Solutions

### Initial Starter Workspace (`Edit Delta: 8`)
- **`MAIN` (`4` slots filled + `1` `?` placeholder):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "PLACEHOLDER", "hintCategory": "function" },
        { "op": "MOVE_FWD" },
        { "op": "MOVE_FWD" }
      ]
    }
  ]
  ```
- **`F1` (`0` blocks):** `[]`
- **`F2` (`2` blocks + `2` `?` placeholders):**
  ```json
  [
    { "op": "PICK_UP" },
    { "op": "PLACEHOLDER", "hintCategory": "turn" },
    { "op": "PLACEHOLDER", "hintCategory": "item" },
    { "op": "MOVE_FWD" }
  ]
  ```

### Partial / Clue Workspace (Clue Reveal)
- **`MAIN`:** `[LOOP_START ×3, CALL_FN F1, MOVE_FWD, MOVE_FWD, LOOP_END]`
- **`F1`:** `[CALL_FN F2, PLACEHOLDER("motion"), MOVE_BACK, MOVE_BACK, PLACEHOLDER("turn")]`
- **`F2`:** `[PICK_UP, TURN_LEFT, USE_DROP, MOVE_FWD]`

### Canonical Full Solution (`5 + 5 + 4 = 14` flat blocks)
- **`MAIN` (`5` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "MOVE_FWD" },
        { "op": "MOVE_FWD" }
      ]
    }
  ]
  ```
- **`F1` (`5` flat blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F2" },
    { "op": "MOVE_FWD" },
    { "op": "MOVE_BACK" },
    { "op": "MOVE_BACK" },
    { "op": "TURN_RIGHT" }
  ]
  ```
- **`F2` (`4` flat blocks):**
  ```json
  [
    { "op": "PICK_UP" },
    { "op": "TURN_LEFT" },
    { "op": "USE_DROP" },
    { "op": "MOVE_FWD" }
  ]
  ```

#### Execution Trace
1. Start at `(0, 2, EAST)`.
2. **Iter 1 (`x=0` Amber Bay):**
   - `F1 → F2`: `PICK_UP` (amber key) → `TURN_LEFT` `(N)` → `USE_DROP` (unlocks `(0,1)` amber gate) → `MOVE_FWD` `(0,1)`.
   - `F1`: `MOVE_FWD` `(0,0)` (collects **Flag 1**, `1/3`) → `MOVE_BACK ×2` → `(0,2,N)` → `TURN_RIGHT` `(0,2,E)`.
   - `MAIN`: `MOVE_FWD ×2` → `(2,2,E)`.
3. **Iter 2 (`x=2` Emerald Bay):**
   - Same `F1 → F2` sequence unlocks `(2,1)`, collects **Flag 2 `(2,0)`** (`2/3`), backs to `(2,2,E)`, advances `2` East → `(4,2,E)`.
4. **Iter 3 (`x=4` Purple Bay):**
   - Same `F1 → F2` sequence unlocks `(4,1)`, collects **Flag 3 `(4,0)`** (`3/3` — `🏁` opens!), backs to `(4,2,E)`, advances `2` East → **`(6, 2, EAST)` = `Goal` ✅** (Empty backpack, all 3 keys spent, all 3 flags collected, ends squarely ON `Goal`!).

---

## Edge Cases & Acceptance Criteria
- **Starter Failure Check:** Running Starter ignores `?`, marches `6` steps East (`(0,2)→(6,2)`) onto shuttered `Goal` with `0/3` flags and `0/3` keys used → **FAILS cleanly** (`requireAllItemsCollected: true`).
- **Mid-Alcove Safety Check:** Backing out twice (`MOVE_BACK, MOVE_BACK`) stops at `(x,2)` without walking off South edge (`y=2 → y=3` would crash).
- **Zero-Bypass Check:** No tab exceeds `5` slots (`MAIN: 5, F1: 5, F2: 4`); `allowRecursion: false`.
