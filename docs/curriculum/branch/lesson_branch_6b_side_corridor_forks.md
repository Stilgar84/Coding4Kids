# `branch.6b` — Side Corridor Forks (`pathLeft` / `pathRight`)

- **Slug / Legacy Alias:** `branch.6b` *(New Stage 2 Split from legacy `5.6`)*
- **Order:** `10`
- **Environment:** `robot-grid`
- **One-Concept Goal:** Solve `3` blind `5×5` corridor mazes (with **Variant 3 starting facing `SOUTH` `↓`**) using egocentric **`pathLeft` / `pathRight`** whisker sensors inside `LOOP_START (3)`.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. `[1 ·] [2 ·] [3 ·]` pips; plain grey/slate floor tiles (zero beacons). Variant 3 clearly faces the robot **downward (`↓`)** at `(2,0)` to catch global North/West compass confusion!
- **Coach Spotlight:** Highlights `pathLeft` (or `pathRight`) inside `IF / ELSE` inside the `×3` loop.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

No colored tiles to guide you this time! Use **`pathLeft`** (or **`pathRight`**) so the robot feels which side hallway is open on every step. Watch **Map 3**: the robot starts at the top facing **down (`↓`)**, so its own **left** points **East** on your screen — teaching true robot-perspective thinking!

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE", "END_IF"],
  "allowedSensors": ["pathLeft", "pathRight"],
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
    "notes": "Variant 1 (N start, L->L), Variant 2 (N start, R->L), and Variant 3 (S start, L->R) ensure only true relative pathLeft/pathRight IF/ELSE solves all 3."
  }
}
```

---

## 3. Multi-Map Specification (`5×5`, `3` Variants)

- **Variant 1 (Start `(2,2) NORTH`, `L → L`):** Open corridor `(2,2) → (2,1) → (1,1) → (1,2) 🏁`. All other cells `#`.
- **Variant 2 (Start `(2,2) NORTH`, `R → L`):** Open corridor `(2,2) → (2,1) → (3,1) → (3,0) 🏁`. All other cells `#`.
- **Variant 3 (Start `(2,0) SOUTH`, `L → R`):** Open corridor `(2,0) → (2,1) → (3,1) → (3,2) 🏁`. All other cells `#`.

```text
Variant 1 (N, L→L):      Variant 2 (N, R→L):      Variant 3 (S↓, L→R):
 #   #    #   #   #       #   #   #   🏁  #        #   #  [S↓]  #   #
 #  [ . ][ . ]#   #       #   #  [ . ][ . ]#        #   #  [ . ][ . ] #
 #   🏁  [S↑] #   #       #   #  [S↑]  #  #        #   #   #    🏁   #
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

### Partial Help (`6` Flat Blocks — `Edit Delta: 2` left)
```text
MAIN (6 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3.   IF (pathLeft)
4.     TURN_LEFT
5.   END_IF
6. LOOP_END
```

### Canonical Reference Solution (`8` Flat Blocks — `Edit Delta: 5`, within `slotCap: 9`)
*(Equivalently valid: `IF (pathRight) { TURN_RIGHT } ELSE { TURN_LEFT } END_IF`)*
```text
MAIN (8 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3.   IF (pathLeft)
4.     TURN_LEFT
5.   ELSE
6.     TURN_RIGHT
7.   END_IF
8. LOOP_END
```

### Trace Across All 3 Maps

| Iter | Var 1 (`(2,2) N`) | Var 2 (`(2,2) N`) | Var 3 (`(2,0) S↓`) |
|---|---|---|---|
| `1` | `(2,1)` `pathLeft=true` → `W` | `(2,1)` `pathLeft=false` → `E` | `(2,1)` `S↓`, Left is `(3,1)` open (`true`) → `E` |
| `2` | `(1,1)` `pathLeft=true` → `S` | `(3,1)` `pathLeft=true` → `N` | `(3,1)` `E→`, Left is `(3,0)` `#` (`false`) → `S` |
| `3` | `(1,2)` **`🏁` Win!** | `(3,0)` **`🏁` Win!** | `(3,2)` **`🏁` Win!** |
