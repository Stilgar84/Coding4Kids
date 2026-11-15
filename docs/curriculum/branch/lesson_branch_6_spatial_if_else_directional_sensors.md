# `branch.6` — `📖` Spatial Directional Sensors (`pathLeft` & `pathRight`)

- **Slug / Legacy Alias:** `branch.6` *(Legacy M5: `5.6`)*
- **Order:** `8` (Guided Read-Only Concept Demo)
- **Environment:** `robot-grid`
- **One-Concept Goal:** Introduce egocentric corridor sensors **`pathLeft`** and **`pathRight`** — letting the robot feel open side hallways relative to its own nose without any floor beacons.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Robot displays tiny green/grey side whisker arcs on its left/right flanks when `pathLeft`/`pathRight` evaluates at T-junction `(1,1)` across `[1 ✓] [2 ✓]`.
- **Coach Spotlights (`2` Tabs):**
  - **Tab 1 (`pathLeft`):** Steps onto `(1,1)` facing `EAST`; Map 1 has open North arm `(1,0) 🏁` (`pathLeft == true → TURN_LEFT`); Map 2 has wall North and open South arm `(1,2) 🏁` (`pathLeft == false → ELSE → TURN_RIGHT`).
  - **Tab 2 (`pathRight`):** Same two maps solved cleanly by checking **`pathRight`** (`TURN_RIGHT` when right is open, `ELSE TURN_LEFT`), illustrating egocentric symmetry.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

No colored paint on the floor this time! Instead, **`pathLeft`** and **`pathRight`** work like whiskers: they check whether the tile to the **robot's own left or right shoulder** is open. Look at the **1 / 2 map switcher**: whether the hallway branches North (Map 1) or South (Map 2), one `IF [pathLeft] / ELSE` turns into the open exit!

</details>

---

## 2. Palette, Sensors & Environment Rules

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["IF", "ELSE", "END_IF"],
  "allowedSensors": ["pathLeft", "pathRight"],
  "allowedBlockParams": { "MOVE_FWD": false, "TURN_LEFT": false, "TURN_RIGHT": false },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 8 },
  "editDelta": 0,
  "gridRules": {
    "requireAllItemsCollected": false,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  }
}
```

---

## 3. Multi-Map Specification (`3×3` T-Junction, `2` Variants)

- **Variant 1 (Open North):** Start `(0,1) EAST` → `(1,1)` open; `(1,0)` `🏁`; `(1,2)` `#`; `(2,1)` `#`.
- **Variant 2 (Open South):** Start `(0,1) EAST` → `(1,1)` open; `(1,0)` `#`; `(1,2)` `🏁`; `(2,1)` `#`.

```text
Variant 1:               Variant 2:
 #   🏁   #               #   #   #
[S→][ . ] #              [S→][ . ] #
 #   #    #               #   🏁  #
```

---

## 4. Tab Programs & Traces (`7` Flat Blocks Each)

### Tab 1 (`pathLeft`)
```text
MAIN (7 flat blocks):
1. MOVE_FWD
2. IF (pathLeft)
3.   TURN_LEFT
4. ELSE
5.   TURN_RIGHT
6. END_IF
7. MOVE_FWD
```

### Tab 2 (`pathRight`)
```text
MAIN (7 flat blocks):
1. MOVE_FWD
2. IF (pathRight)
3.   TURN_RIGHT
4. ELSE
5.   TURN_LEFT
6. END_IF
7. MOVE_FWD
```

- **Trace:** Both tabs arrive at `(1,1)` facing `EAST` (`North = Left`, `South = Right`). Var 1 ends at `(1,0)` Goal ✓; Var 2 ends at `(1,2)` Goal ✓.
