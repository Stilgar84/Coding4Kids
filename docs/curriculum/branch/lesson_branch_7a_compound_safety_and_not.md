# `branch.7a` — Compound Safety (`AND` + `NOT`, Amber Key Vault)

- **Slug / Legacy Alias:** `branch.7a` *(New Stage 2 Lesson)*
- **Order:** `13`
- **Environment:** `robot-grid`
- **One-Concept Goal:** Combine **`itemHere AND (NOT carryingItem)`** inside a loop so a robot with a `1`-slot shoulder gripper takes **exactly one Amber Key (`🔑`)** regardless of duplicate spares, unlocks the Amber Gate (`●`), and reaches `🏁`.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Top simulation shows `1`-slot shoulder gripper icon (NO `🎒` BackpackHud) and shuttered `🏁` goal behind an **Amber Locked Gate (`●`)**. Multiple Amber Keys appear on Variants 2 & 3.
- **Coach Spotlight:** Highlights `IF (itemHere AND (NOT carryingItem))` → `PICK_UP` inside the pre-built `LOOP_START (3)` + `USE_DROP` Starter.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Your robot can only carry **one item at a time** on its shoulder gripper! Across the **3 test vaults**, `1`, `2`, or `3` spare Amber Keys sit along the hallway. Snap **`IF [itemHere AND (NOT carryingItem)]`** around `PICK_UP` so the robot grabs a key **only when a key is underfoot AND its gripper is still empty** — then `USE_DROP` unlocks the Amber Gate!

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "PICK_UP", "USE_DROP"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "END_IF"],
  "allowedSensors": ["itemHere", "carryingItem"],
  "allowedCombinators": ["AND", "NOT"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 6 },
    "MOVE_FWD": false,
    "PICK_UP": false,
    "USE_DROP": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 10 },
  "editDelta": 3,
  "gridRules": {
    "requireAllItemsCollected": false,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "LOOP_START"],
    "notes": "IF (itemHere) alone collides on Var 2/3 (strictInteractionCollision when grabbing a 2nd key with full 1-slot gripper); IF (NOT carryingItem) alone collides on Var 1 empty tiles (1,1)/(2,1). Only (itemHere AND (NOT carryingItem)) solves all 3."
  }
}
```

---

## 3. Multi-Map Specification (`6×3` Vaults, `3` Variants)

All `3` corridors share `y = 1` (`#` walls on `y = 0, 2`, Start `(0,1) EAST`, Amber Gate `●` at `(4,1)`, Goal `🏁` at `(5,1)`):

- **Variant 1 (`1` Key at `(3,1)`):** `[S→] [ . ] [ . ] [ 🔑 ] [ ● ] [🏁]`
- **Variant 2 (`2` Keys at `(2,1), (3,1)`):** `[S→] [ . ] [ 🔑 ] [ 🔑 ] [ ● ] [🏁]`
- **Variant 3 (`3` Keys at `(1,1), (2,1), (3,1)`):** `[S→] [ 🔑 ] [ 🔑 ] [ 🔑 ] [ ● ] [🏁]`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`6` Flat Blocks — Hits Locked Gate Without a Key!)
```text
MAIN (6 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3. LOOP_END
4. USE_DROP
5. MOVE_FWD
6. MOVE_FWD
```

### Partial Help (`8` Flat Blocks — `Edit Delta: 1` left)
```text
MAIN (8 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3.   IF (itemHere AND (NOT carryingItem))
4.   END_IF
5. LOOP_END
6. USE_DROP
7. MOVE_FWD
8. MOVE_FWD
```

### Canonical Reference Solution (`9` Flat Blocks — `Edit Delta: 3`, within `slotCap: 10`)
```text
MAIN (9 flat blocks):
1. LOOP_START (3)
2.   MOVE_FWD
3.   IF (itemHere AND (NOT carryingItem))
4.     PICK_UP
5.   END_IF
6. LOOP_END
7. USE_DROP
8. MOVE_FWD
9. MOVE_FWD
```

### Trace Across All 3 Maps

| Step | Var 1 (`1 🔑`) | Var 2 (`2 🔑`) | Var 3 (`3 🔑`) |
|---|---|---|---|
| Loop `1` `(1,1)` | `itemHere=false` | `itemHere=false` | `true && true` → **Grab `🔑`** |
| Loop `2` `(2,1)` | `itemHere=false` | `true && true` → **Grab `🔑`** | `true && false` → **Skip!** |
| Loop `3` `(3,1)` | `true && true` → **Grab `🔑`** | `true && false` → **Skip!** | `true && false` → **Skip!** |
| Line `7` `USE_DROP` | Opens Gate `● @(4,1)` | Opens Gate `● @(4,1)` | Opens Gate `● @(4,1)` |
| Lines `8–9` `FWD ×2` | `(4,1) → (5,1)` **`🏁` Win!** | `(4,1) → (5,1)` **`🏁` Win!** | `(4,1) → (5,1)` **`🏁` Win!** |
