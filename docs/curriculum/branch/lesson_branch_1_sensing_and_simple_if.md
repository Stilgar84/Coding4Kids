# `branch.1` — Sensing & Simple `If` (`itemHere`)

- **Slug / Legacy Alias:** `branch.1` *(Legacy M5: `5.1`)*
- **Order:** `2`
- **Environment:** `robot-grid`
- **One-Concept Goal:** Snap an **`IF (itemHere)`** block inside a `Loop ×5` corridor so a single program collects a star at **3 different positions** without blindly grabbing empty floor tiles.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words (`[1 ·] [2 ·] [3 ·]` multi-map pips in top-center pill; `[IF]` spotlight pulse inside Starter loop gap; `★` → `🏁` goal gauge).
- **Coach Spotlight:** Points from `Starter` loop's inner slot to `IF [itemHere]` and `PICK_UP` in the palette.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Look at the **3 map dots (`1 · 2 · 3`)** at the top of the screen: the star hides on a different tile in each corridor! Instead of counting steps to one star, wrap **`PICK_UP`** inside **`IF [itemHere]`** inside the `×5` loop so the robot checks every tile as it walks and grabs the star wherever it lands.

</details>

---

## 2. Palette, Sensors, Scopes & Anti-Bypass Contract

```json
{
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
  "editDelta": 3,
  "gridRules": {
    "requireAllItemsCollected": true,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "LOOP_START"],
    "rejectEmptyPickup": true,
    "notes": "3 distinct star indices (x=1, x=3, x=5) defeat hardcoded step counts; strict empty-grab rejection + requiredOpcodes ['IF'] block blind 'LOOP 5 { MOVE_FWD; PICK_UP }'."
  }
}
```

---

## 3. Multi-Map Specification (`3` Variants, Fixed `5`-Step Corridor)

All `3` maps share a `6×1` Eastbound corridor (`Start (0,0) EAST`, `Goal (5,0) 🏁`):

- **Variant 1 (Star at `(2,0)`):** `[S→] [ . ] [ ★ ] [ . ] [ . ] [🏁]`
- **Variant 2 (Star at `(4,0)`):** `[S→] [ . ] [ . ] [ . ] [ ★ ] [🏁]`
- **Variant 3 (Star at `(1,0)`):** `[S→] [ ★ ] [ . ] [ . ] [ . ] [🏁]`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`3` Flat Blocks — Walking Without Sensing)
```text
MAIN (3 flat blocks):
1. LOOP_START (5)
2.   MOVE_FWD
3. LOOP_END
```
- **Why Starter Fails:** Reaches `(5,0)` on all 3 variants with `0/1` stars; `🏁` shutter stays closed (`requireAllItemsCollected: true`).

### Partial Help (`5` Flat Blocks — `Edit Delta: 2` left)
```text
MAIN (5 flat blocks):
1. LOOP_START (5)
2.   MOVE_FWD
3.   IF (itemHere)
4.   END_IF
5. LOOP_END
```

### Canonical Reference Solution (`6` Flat Blocks — `Edit Delta: 3`, within `slotCap: 7`)
```text
MAIN (6 flat blocks):
1. LOOP_START (5)
2.   MOVE_FWD
3.   IF (itemHere)
4.     PICK_UP
5.   END_IF
6. LOOP_END
```

### Multi-Variant Trace Summary

| Iteration | Cell `(x, y)` | Var 1 (`★@(2,0)`) | Var 2 (`★@(4,0)`) | Var 3 (`★@(1,0)`) |
|---|---|---|---|---|
| `1` | `(1, 0)` | `false` | `false` | `true` → `PICK_UP (1/1)` |
| `2` | `(2, 0)` | `true` → `PICK_UP (1/1)` | `false` | `false` |
| `3` | `(3, 0)` | `false` | `false` | `false` |
| `4` | `(4, 0)` | `false` | `true` → `PICK_UP (1/1)` | `false` |
| `5` | `(5, 0)` | **Goal (`1/1`) ✓** | **Goal (`1/1`) ✓** | **Goal (`1/1`) ✓** |
