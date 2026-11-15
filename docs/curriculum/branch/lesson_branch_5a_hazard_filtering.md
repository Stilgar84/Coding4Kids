# `branch.5a` — Hazard Filtering (`itemDamaged` + `SCRAP_ITEM`)

- **Slug / Legacy Alias:** `branch.5a` *(New Stage 2 Lesson)*
- **Order:** `7`
- **Environment:** `switchyard`
- **One-Concept Goal:** Guard a working 1-switch sorter with **`IF (itemDamaged) { SCRAP_ITEM } ELSE { ... }`** so cracked/sparking parcels (`💥`) are shredded at the gate while intact **Crystals (`💎`)** go Left `↙` and intact **Crates (`📦`)** go Right `↘`.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Single Y-junction (`[A]` badge omitted). Left Dock (`↙`) shows `💎 Crystal` (clean); Right Dock (`↘`) shows `📦 Crate` (clean); red gate shredder badge `💥→🗑️` pulses whenever a damaged parcel reaches the gate.
- **Coach Spotlight:** Highlights the working Crystal/Crate sorter in `Starter`, then spotlights `IF (itemDamaged)` + `SCRAP_ITEM` + `ELSE` wrapping it inside the `×5` loop.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

The conveyor already knows how to send Crystals Left and Crates Right — **but damaged parcels (`💥`) are sneaking onto the docks!** Wrap **`IF [itemDamaged] → SCRAP_ITEM / ELSE`** around the sorter inside the loop so broken items are shredded right at the entrance while clean parcels continue safely to their docks.

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT", "SCRAP_ITEM"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE", "END_IF"],
  "allowedSensors": ["itemDamaged", "itemIcon"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "SWITCH_LEFT": { "switchBadge": "omitted_single_switch" },
    "SWITCH_RIGHT": { "switchBadge": "omitted_single_switch" },
    "SEND_NEXT": false,
    "SCRAP_ITEM": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 12 },
  "editDelta": 4,
  "switchyardRules": {
    "switchCount": 1,
    "omitSingleSwitchBadge": true,
    "scrapEnabled": true,
    "scrapRules": "damaged",
    "streamLength": 5
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE", "SCRAP_ITEM"],
    "notes": "Both Docks require clean items only (any 💥 in ↙ or ↘ fails; scrapping clean items fails via scrapRules: 'damaged'). Varying 💥 positions across 3 streams block hardcoded unrolls."
  }
}
```

---

## 3. Switchyard Streams (`3` Variants, Fixed `N = 5`)

- **Variant 1:** `[Crystal(Good), Crystal(💥), Crate(Good), Crate(💥), Crystal(Good)]`
  - `↙`: `[Crystal, Crystal]` | `↘`: `[Crate]` | Scrapped: `2 💥`
- **Variant 2:** `[Crate(💥), Crystal(💥), Crate(Good), Crystal(Good), Crate(Good)]`
  - `↙`: `[Crystal]` | `↘`: `[Crate, Crate]` | Scrapped: `2 💥`
- **Variant 3:** `[Crystal(💥), Crate(Good), Crystal(Good), Crate(💥), Crystal(💥)]`
  - `↙`: `[Crystal]` | `↘`: `[Crate]` | Scrapped: `3 💥`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`7` Flat Blocks — Damaged Parcels Leak Into Docks!)
```text
MAIN (7 flat blocks):
1. LOOP_START (5)
2.   SWITCH_RIGHT
3.   IF (itemIcon == Crystal)
4.     SWITCH_LEFT
5.   END_IF
6.   SEND_NEXT
7. LOOP_END
```
- **Why Starter Fails:** Sends `Crystal(💥)` to `↙` and `Crate(💥)` to `↘` (`💥 Hazard in Dock` fail).

### Partial Help (`9` Flat Blocks — `Edit Delta: 2` left)
```text
MAIN (9 flat blocks):
1. LOOP_START (5)
2.   IF (itemDamaged)
3.     SCRAP_ITEM
4.   END_IF
5.   SWITCH_RIGHT
6.   IF (itemIcon == Crystal)
7.     SWITCH_LEFT
8.   END_IF
9.   SEND_NEXT
10. LOOP_END
```
*(Without `ELSE`, after `SCRAP_ITEM` deletes item `i`, `SEND_NEXT` immediately dispatches item `i+1` or crashes! Student adds `ELSE` before `SWITCH_RIGHT` and keeps closing `END_IF` around it.)*

### Canonical Reference Solution (`11` Flat Blocks — `Edit Delta: 4`, within `slotCap: 12`)
```text
MAIN (11 flat blocks):
1.  LOOP_START (5)
2.    IF (itemDamaged)
3.      SCRAP_ITEM
4.    ELSE
5.      SWITCH_RIGHT
6.      IF (itemIcon == Crystal)
7.        SWITCH_LEFT
8.      END_IF
9.      SEND_NEXT
10.   END_IF
11. LOOP_END
```

### Multi-Variant Trace Summary

| Item # | Var 1 | Var 2 | Var 3 |
|---|---|---|---|
| `1` | `Crystal(Good) → ↙` | `Crate(💥) → SCRAP` | `Crystal(💥) → SCRAP` |
| `2` | `Crystal(💥) → SCRAP` | `Crystal(💥) → SCRAP` | `Crate(Good) → ↘` |
| `3` | `Crate(Good) → ↘` | `Crate(Good) → ↘` | `Crystal(Good) → ↙` |
| `4` | `Crate(💥) → SCRAP` | `Crystal(Good) → ↙` | `Crate(💥) → SCRAP` |
| `5` | `Crystal(Good) → ↙` ✓ | `Crate(Good) → ↘` ✓ | `Crystal(💥) → SCRAP` ✓ |
