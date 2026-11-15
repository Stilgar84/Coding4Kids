# `branch.6a` — Floor Beacon Forks (`tileColor`)

- **Slug / Legacy Alias:** `branch.6a` *(New Stage 2 Split from legacy `5.6`)*
- **Order:** `9`
- **Environment:** `robot-grid`
- **One-Concept Goal:** Navigate a `5×5` **3-step binary beacon maze** using `LOOP_START (3)` + **`IF (tileColor == Blue) { TURN_LEFT } ELSE { TURN_RIGHT }`** across `3` disjoint path shapes.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. `[1 ·] [2 ·] [3 ·]` pips in top pill; `🔵 Blue` / `🔴 Red` floor beacon tiles pulse under the robot at each decision square.
- **Coach Spotlight:** Highlights `Starter` loop's inner slot where `IF (tileColor == Blue) / ELSE` wraps `TURN_LEFT` vs `TURN_RIGHT`.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Now your robot takes **`3` forked steps** inside one loop! On every step forward, check the glowing tile beneath the robot: **`Blue` (`🔵`) turns Left**, and **`ELSE` (`Red` `🔴`) turns Right**. Test all **3 maps** to prove one 8-block loop steers through `L→R`, `R→L`, and `R→R` turns automatically!

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE", "END_IF"],
  "allowedSensors": ["tileColor"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 6 },
    "MOVE_FWD": false,
    "TURN_LEFT": false,
    "TURN_RIGHT": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 9 },
  "editDelta": 5,
  "gridRules": {
    "requireAllItemsCollected": false,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE", "LOOP_START"],
    "notes": "Three orthogonal turn signatures (L->R, R->L, R->R) inside 5x5 grid with wall-lined corridors defeat any hardcoded path."
  }
}
```

---

## 3. Multi-Map Specification (`5×5`, `3` Variants)

All `3` maps start at **`(2, 2)` facing `NORTH` (`↑`)** (`x ∈ [0..4], y ∈ [0..4]`):

- **Variant 1 (`L → R`):** `(2,1)` = `BLUE`, `(1,1)` = `RED`, `(1,0)` = `🏁` (all other cells `#`).
- **Variant 2 (`R → L`):** `(2,1)` = `RED`, `(3,1)` = `BLUE`, `(3,0)` = `🏁` (all other cells `#`).
- **Variant 3 (`R → R`):** `(2,1)` = `RED`, `(3,1)` = `RED`, `(3,2)` = `🏁` (all other cells `#`).

```text
Variant 1 (L→R):        Variant 2 (R→L):        Variant 3 (R→R):
 #   🏁   #   #   #      #   #   #   🏁  #       #   #   #   #   #
 #  [🔴][🔵]  #   #      #   #  [🔴][🔵] #       #   #  [🔴][🔴] #
 #   #  [S↑]  #   #      #   #  [S↑]  #  #       #   #  [S↑] 🏁  #
```

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`3` Flat Blocks)
```text
MAIN (3 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3. LOOP_END
```
- **Why Starter Fails:** Walks straight North into wall `#` at `(2,0)` on step 2.

### Partial Help (`6` Flat Blocks — `Edit Delta: 2` left)
```text
MAIN (6 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3.   IF (tileColor == Blue)
4.     TURN_LEFT
5.   END_IF
6. LOOP_END
```
*(Student splits `IF` with `ELSE` and inserts `TURN_RIGHT`.)*

### Canonical Reference Solution (`8` Flat Blocks — `Edit Delta: 5`, within `slotCap: 9`)
```text
MAIN (8 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3.   IF (tileColor == Blue)
4.     TURN_LEFT
5.   ELSE
6.     TURN_RIGHT
7.   END_IF
8. LOOP_END
```

### Trace Across All 3 Maps

| Iter | Var 1 (`L → R`) | Var 2 (`R → L`) | Var 3 (`R → R`) |
|---|---|---|---|
| `1` | `(2,1)` `🔵` → `WEST` | `(2,1)` `🔴` → `EAST` | `(2,1)` `🔴` → `EAST` |
| `2` | `(1,1)` `🔴` → `NORTH` | `(3,1)` `🔵` → `NORTH` | `(3,1)` `🔴` → `SOUTH` |
| `3` | `(1,0)` **`🏁` Win!** | `(3,0)` **`🏁` Win!** | `(3,2)` **`🏁` Win!** |
