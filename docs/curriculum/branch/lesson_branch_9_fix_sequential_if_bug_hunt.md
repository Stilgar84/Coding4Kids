# `branch.9` — `🔧` Fix-It: Sequential-`If` Bug Hunt (`NOT` + `IF/ELSE`)

- **Slug / Legacy Alias:** `branch.9` *(Fix-It Bug Hunt placed at Order 12 right after `branch.7`)*
- **Order:** `12` (`🔧` Fix-It Lesson)
- **Environment:** `robot-grid`
- **One-Concept Goal:** Catch why two back-to-back **`IF`** blocks (`IF (NOT pathAhead)` followed by `IF (pathAhead)`) mutate heading mid-step and fall through — then fix the bug by merging them into **`IF / ELSE`** (`Edit Delta: 2`).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Wrench badge `🔧` in top header; `[1 ✗] [2 ✗] [3 ✓]` pips on initial Starter failure; red bug-spark pulses on line 5 `IF (pathAhead)` whenever a corner turn triggers a second action on the same loop tick!
- **Coach Spotlight:** Highlights the two middle blocks (`END_IF` + `IF (pathAhead)`) in the `8`-block Starter and pulses the **`ELSE`** wedge.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

**Look closely at why the robot overshoots on Maps 1 and 2!** Because the two `IF` blocks are stacked one after another, turning right at a wall **makes `pathAhead` become true right away** — so the second `IF` ALSO runs on the **exact same beat**! That makes a turn+step take `1` loop beat instead of `2`, leaving an extra beat at the end that walks right past the flag. Combine both `IF`s into one **`IF / ELSE`** so each beat does **either** a turn **or** a step!

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "isFixIt": true,
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE", "END_IF"],
  "allowedSensors": ["pathAhead"],
  "allowedCombinators": ["NOT"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 6 },
    "MOVE_FWD": false,
    "TURN_RIGHT": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 9 },
  "editDelta": 2,
  "gridRules": {
    "requireAllItemsCollected": false,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE", "LOOP_START"],
    "notes": "Var 1 (3m+1t = 3 buggy ticks) and Var 2 (3m+1t = 3 buggy ticks) overshoot onto open decoy traps with LOOP 4; Var 3 (straight 4m = 4 ticks) fails with LOOP 3. Only mutually exclusive IF/ELSE inside LOOP 4 passes all 3 maps."
  }
}
```

---

## 3. Multi-Map Specification (`5×5`, `3` Variants)

- **Variant 1 ("Mid-Corridor Turn" — `3m + 1t`):** Start `(0,0) EAST`. Open: `(0,0), (1,0), (2,0), (2,1)[🏁], (2,2)[trap]`. `#` at `(3,0)` and all other cells.
- **Variant 2 ("Turn Right at Start" — `3m + 1t`):** Start `(0,0) EAST`. `#` at `(1,0)`. Open: `(0,0), (0,1), (0,2), (0,3)[🏁], (0,4)[trap]`. All other cells `#`.
- **Variant 3 ("Straight 4-Step" — `4m + 0t`):** Start `(0,0) EAST`. Open: `(0,0), (1,0), (2,0), (3,0), (4,0)[🏁]`. All other cells `#`.

```text
Var 1 (Corner @(2,0)):   Var 2 (Turn @Start):     Var 3 (Straight 4):
[S→][ . ][ . ] #   #     [S→] #   #   #   #       [S→][ . ][ . ][ . ][🏁]
 #   #   🏁    #   #     [ . ]#   #   #   #        #   #   #   #   #
 #   #  [trap] #   #     [ . ]#   #   #   #
                          🏁  #
                         [trap]
```

---

## 4. Buggy Starter, Partial Help & Fixed Reference Solution

### Buggy Starter (`8` Flat Blocks — Passes Var 3 Only, Fails Var 1 & 2!)
```text
MAIN (8 flat blocks):
1. LOOP_START (4)
2.   IF (NOT pathAhead)
3.     TURN_RIGHT
4.   END_IF
5.   IF (pathAhead)
6.     MOVE_FWD
7.   END_IF
8. LOOP_END
```
- **Bug Trace (Var 1):** Iter1 `(1,0)` → Iter2 `(2,0)` → Iter3 turns `S` AND steps `(2,1)` → Iter4 steps **`(2,2)` (Overshoot Fail!)**.
- **Bug Trace (Var 2):** Iter1 turns `S` AND steps `(0,1)` → Iter2 `(0,2)` → Iter3 `(0,3)` → Iter4 steps **`(0,4)` (Overshoot Fail!)**.
- **Bypass Check (`LOOP 3`):** Passes Var 1 & 2, **FAILS Var 3** at `(3,0)` (`1` cell short of `(4,0)`!).

### Partial Help (`6` Flat Blocks — Remove Second `IF`, `Edit Delta: 1` left)
```text
MAIN (6 flat blocks):
1. LOOP_START (4)
2.   IF (NOT pathAhead)
3.     TURN_RIGHT
4.   ELSE
5.   END_IF
6. LOOP_END
```
*(Student drags `MOVE_FWD` inside `ELSE`.)*

### Fixed Canonical Solution (`7` Flat Blocks — `Edit Delta: 2` from Starter, within `slotCap: 9`)
```text
MAIN (7 flat blocks):
1. LOOP_START (4)
2.   IF (NOT pathAhead)
3.     TURN_RIGHT
4.   ELSE
5.     MOVE_FWD
6.   END_IF
7. LOOP_END
```

### Fixed Trace Across All 3 Maps

| Iter | Var 1 (`Corner @(2,0)`) | Var 2 (`Turn @Start`) | Var 3 (`Straight 4`) |
|---|---|---|---|
| `1` | `(1,0)` `MOVE_FWD` | `(0,0)` `TURN_RIGHT (S)` | `(1,0)` `MOVE_FWD` |
| `2` | `(2,0)` `MOVE_FWD` | `(0,1)` `MOVE_FWD` | `(2,0)` `MOVE_FWD` |
| `3` | `(2,0)` `TURN_RIGHT (S)` | `(0,2)` `MOVE_FWD` | `(3,0)` `MOVE_FWD` |
| `4` | `(2,1)` **`🏁` Win!** | `(0,3)` **`🏁` Win!** | `(4,0)` **`🏁` Win!** |
