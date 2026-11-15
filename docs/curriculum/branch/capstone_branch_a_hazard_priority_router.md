# `branch.A` — `🏆` Capstone: Hazard & Priority 3-Dock Router

- **Slug / Legacy Alias:** `branch.A` *(Legacy M5: `5A`)*
- **Order:** `19` (`🏆` Switchyard Module Capstone)
- **Environment:** `switchyard`
- **One-Concept Goal:** Compose every Switchyard skill in `branch` across **`[MAIN, F1]`**: guard the gate in `MAIN` (**`IF (itemDamaged) { SCRAP_ITEM } ELSE { CALL_FN F1; SEND_NEXT }`**) and delegate 3-dock priority color sorting into **`F1`** (`Red → A`, `Blue → B`, `Other → C`) over `3` fixed `N = 8` streams!

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Trophy capstone header (`🏆`), two scope tabs **`[MAIN, F1]`**, dual switches labeled **`[A]`** and **`[B]`**, Dock targets (`A = 🔴`, `B = 🔵`, `C = 🟢/🟡/🟣`), and `💥` scrapper gate. Fixed `8`-item streams (`Loop ×8`, zero `While`!).
- **Coach Spotlight:** Highlights `MAIN`'s missing `IF (itemDamaged) { SCRAP_ITEM } ELSE { ... }` wrapper around `CALL_FN (F1); SEND_NEXT`, and `F1`'s missing `ELSE_IF (itemColor == Blue)` + `ELSE` branches.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

In your **Switchyard Capstone**, split the job cleanly across two tabs:
- **`MAIN`** checks safety first: if a parcel is damaged (`💥`), **`SCRAP_ITEM`** shreds it right at the gate; otherwise **`ELSE`** calls helper **`F1`** to aim switches **`[A]`** and **`[B]`** before **`SEND_NEXT`** sends it home!
- **`F1`** sorts clean parcels by priority: **Red → Dock A**, **`ELSE IF` Blue → Dock B**, and **`ELSE` → Dock C**!

</details>

---

## 2. Palette, Scopes & Anti-Bypass Contract

```json
{
  "isCapstone": true,
  "allowedScopes": ["MAIN", "F1"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT", "SCRAP_ITEM", "CALL_FN"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE_IF", "ELSE", "END_IF"],
  "allowedSensors": ["itemDamaged", "itemColor"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 10 },
    "SWITCH_LEFT": { "switchBadge": ["A", "B"] },
    "SWITCH_RIGHT": { "switchBadge": ["A", "B"] }
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 10, "F1": 10 },
  "editDelta": 10,
  "switchyardRules": {
    "switchCount": 2,
    "omitSingleSwitchBadge": false,
    "scrapEnabled": true,
    "scrapRules": "damaged",
    "streamLength": 8
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE_IF", "ELSE", "SCRAP_ITEM", "CALL_FN"],
    "notes": "Single-scope flat code exceeds MAIN slotCap: 10 (needs >= 14 flat blocks without F1). Every stream includes damaged Red/Blue/Green/Other items and intact Red/Blue/Green/Amber/Purple across mixed icons, preventing icon shortcuts or missing scrap checks."
  }
}
```

---

## 3. Switchyard Streams (`3` Variants, Fixed `N = 8`)

- **Variant 1 ("Balanced Hazards & Colors"):**
  `[Red(Good), Blue(💥), Green(Good), Red(💥), Blue(Good), Amber(Good), Green(💥), Red(Good)]`
  - **Dock `A` (`🔴`):** `2` Red | **Dock `B` (`🔵`):** `1` Blue | **Dock `C` (`*`):** `[Green, Amber]` | **Scrapped:** `3 💥`
- **Variant 2 ("Double Adjacent Hazards + Mixed Icons"):**
  `[Crystal(Red 💥), Battery(Blue 💥), Crystal(Blue), Crate(Red), Gear(Amber), Crate(Green 💥), Battery(Red), Gear(Blue)]`
  - **Dock `A` (`🔴`):** `[Crate(R), Battery(R)]` | **Dock `B` (`🔵`):** `[Crystal(B), Gear(B)]` | **Dock `C` (`*`):** `[Gear(A)]` | **Scrapped:** `3 💥`
- **Variant 3 ("Late Hazards + Purple"):**
  `[Green(Good), Blue(Good), Blue(💥), Red(Good), Purple(Good), Red(💥), Blue(Good), Green(Good)]`
  - **Dock `A` (`🔴`):** `1` Red | **Dock `B` (`🔵`):** `2` Blue | **Dock `C` (`*`):** `[Green, Purple, Green]` | **Scrapped:** `2 💥`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`7` Flat Blocks: `MAIN: 4, F1: 3` — Unchecked Hazards + Single Red Branch)
```text
MAIN (4 flat blocks):
1. LOOP_START (8)
2.   CALL_FN (F1)
3.   SEND_NEXT
4. LOOP_END

F1 (3 flat blocks):
1. IF (itemColor == Red)
2.   SWITCH_LEFT [A]
3. END_IF
```

### Partial Help (`11` Flat Blocks: `MAIN: 8, F1: 3` — `MAIN` Complete, `Edit Delta: 6` left in `F1`)
```text
MAIN (8 flat blocks):
1. LOOP_START (8)
2.   IF (itemDamaged)
3.     SCRAP_ITEM
4.   ELSE
5.     CALL_FN (F1)
6.     SEND_NEXT
7.   END_IF
8. LOOP_END

F1 (3 flat blocks):
1. IF (itemColor == Red)
2.   SWITCH_LEFT [A]
3. END_IF
```

### Canonical Reference Solution (`17` Flat Blocks: `MAIN: 8, F1: 9` — `Edit Delta: 10`, within `10/tab`)
```text
MAIN (8 flat blocks):
1. LOOP_START (8)
2.   IF (itemDamaged)
3.     SCRAP_ITEM
4.   ELSE
5.     CALL_FN (F1)
6.     SEND_NEXT
7.   END_IF
8. LOOP_END

F1 (9 flat blocks):
1. IF (itemColor == Red)
2.   SWITCH_LEFT [A]
3. ELSE_IF (itemColor == Blue)
4.   SWITCH_RIGHT [A]
5.   SWITCH_LEFT [B]
6. ELSE
7.   SWITCH_RIGHT [A]
8.   SWITCH_RIGHT [B]
9. END_IF
```

### Trace Summary (`Variant 2`)

| Item # | Parcel | `MAIN` Decision | `F1` Switches | Final Dock |
|---|---|---|---|---|
| `1` | `Crystal(Red 💥)` | `itemDamaged == true → SCRAP_ITEM` | *(skipped)* | **Scrapped 💥** |
| `2` | `Battery(Blue 💥)` | `itemDamaged == true → SCRAP_ITEM` | *(skipped)* | **Scrapped 💥** |
| `3` | `Crystal(Blue)` | `ELSE → CALL F1; SEND_NEXT` | `ELSE_IF Blue → [A]↘ [B]↙` | **Dock B** |
| `4` | `Crate(Red)` | `ELSE → CALL F1; SEND_NEXT` | `IF Red → [A]↙` | **Dock A** |
| `5` | `Gear(Amber)` | `ELSE → CALL F1; SEND_NEXT` | `ELSE → [A]↘ [B]↘` | **Dock C** |
| `6` | `Crate(Green 💥)` | `itemDamaged == true → SCRAP_ITEM` | *(skipped)* | **Scrapped 💥** |
| `7` | `Battery(Red)` | `ELSE → CALL F1; SEND_NEXT` | `IF Red → [A]↙` | **Dock A** |
| `8` | `Gear(Blue)` | `ELSE → CALL F1; SEND_NEXT` | `ELSE_IF Blue → [A]↘ [B]↙` | **Dock B ✓** |
