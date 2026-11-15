# `branch.0` — `📖` Sensors & `If` Multi-Map Demo (`itemHere`)

- **Slug / Legacy Alias:** `branch.0` *(Legacy M5: `5.0`)*
- **Order:** `1` (Guided Read-Only Concept Demo)
- **Environment:** `robot-grid`
- **One-Concept Goal:** Introduce the **`IF`** block and **`itemHere`** sensor on a multi-map robot corridor — showing why **one** 6-block conditional program solves different item positions without hardcoding steps.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words of prose (`🤖❓` / `★` / `🏁` icon cues only). Top-center pill displays multi-map verification pips `[1 ✓] [2 ✓]`.
- **Coach Spotlights (`2` Tabs):**
  - **Tab 1:** Highlights the `IF (itemHere)` block pulsing over `(3,0)` on Map 1, then highlights the goal shutter opening (`🏁 0/1` → `🏁 1/1`).
  - **Tab 2:** Switches live to Map 2 (item moved to `(1,0)`), highlighting the **exact same 6 blocks** passing both pips `[1 ✓] [2 ✓]`.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Until now, the robot always followed the same script blindly. Notice the **1 / 2 map switcher** at the top! The glowing gem sits in a **different spot** on Map 1 and Map 2, yet **one single program** solves both maps because `IF [itemHere]` checks the floor right beneath the robot on every step and only triggers `PICK_UP` when a gem is actually there.

</details>

---

## 2. Palette, Sensors, Scopes & Environment Rules

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "PICK_UP"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "END_IF"],
  "allowedSensors": ["itemHere"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "MOVE_FWD": false,
    "PICK_UP": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 7 },
  "editDelta": 0,
  "gridRules": {
    "requireAllItemsCollected": true,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  }
}
```

> **Note vs Legacy `5.0`:** Unused `TURN_LEFT` / `TURN_RIGHT` blocks and `USE_DROP` are removed from the demo palette (`branch.0` has straight corridors only). No `BackpackHud` (`🎒`) is rendered — the robot uses its single shoulder gripper indicator.

---

## 3. Multi-Map Specification (`2` Demo Maps, Same Program)

### Variant 1 — Map 1 (Star at `(3,0)`)
`6×1` Eastbound corridor (`0 ≤ x ≤ 5`, `y = 0`).
- **Start:** `(0, 0)` facing `EAST` (`→`)
- **Item (`gem_blue`):** `(3, 0)`
- **Goal:** `(5, 0)` (`🏁 0/1` shuttered until `gem_blue` collected)

```text
[S→] [ . ] [ . ] [ ★ ] [ . ] [🏁]
(0,0)(1,0) (2,0) (3,0) (4,0) (5,0)
```

### Variant 2 — Map 2 (Star at `(1,0)`)
`6×1` Eastbound corridor (`0 ≤ x ≤ 5`, `y = 0`).
- **Start:** `(0, 0)` facing `EAST` (`→`)
- **Item (`gem_blue`):** `(1, 0)`
- **Goal:** `(5, 0)` (`🏁 0/1` shuttered until `gem_blue` collected)

```text
[S→] [ ★ ] [ . ] [ . ] [ . ] [🏁]
(0,0)(1,0) (2,0) (3,0) (4,0) (5,0)
```

---

## 4. Reference Program & Step-by-Step Traces (`6` Flat Blocks)

```text
MAIN (6 flat blocks):
1. LOOP_START (5)
2.   MOVE_FWD
3.   IF (itemHere)
4.     PICK_UP
5.   END_IF
6. LOOP_END
```

| Step | Action | Map 1 State `(x, y)` | Map 1 `itemHere` | Map 2 State `(x, y)` | Map 2 `itemHere` |
|---|---|---|---|---|---|
| `1` | `MOVE_FWD` | `(1,0)` | `false` (skip `PICK_UP`) | `(1,0)` | `true` → `PICK_UP` (`1/1`) |
| `2` | `MOVE_FWD` | `(2,0)` | `false` (skip `PICK_UP`) | `(2,0)` | `false` (skip `PICK_UP`) |
| `3` | `MOVE_FWD` | `(3,0)` | `true` → `PICK_UP` (`1/1`) | `(3,0)` | `false` (skip `PICK_UP`) |
| `4` | `MOVE_FWD` | `(4,0)` | `false` (skip `PICK_UP`) | `(4,0)` | `false` (skip `PICK_UP`) |
| `5` | `MOVE_FWD` | `(5,0)` Goal | **Win! (`1/1`)** | `(5,0)` Goal | **Win! (`1/1`)** |
