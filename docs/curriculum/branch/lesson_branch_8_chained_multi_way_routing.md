# `branch.8` — Chained Multi-Way Routing (`If / Else If / Else`)

- **Slug / Legacy Alias:** `branch.8` *(Legacy M5: `5.8`)*
- **Order:** `16`
- **Environment:** `switchyard`
- **One-Concept Goal:** Build a 3-Dock priority router using **`IF / ELSE IF / ELSE`** across `3` fixed streams (`N = 6`): **`💎 Crystal` (any color) → Dock `A`**, else **`🔵 Blue` (non-Crystal) → Dock `B`**, else **all others → Dock `C`**.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Dual switches labeled **`[A]`** and **`[B]`**. Target badges: **Dock `A`** = `💎`; **Dock `B`** = `🔵` (non-Crystal); **Dock `C`** = `*` (catch-all).
- **Coach Spotlight:** Highlights the open slot after `SWITCH_LEFT [A]` inside Starter, guiding insertion of **`ELSE_IF (itemColor == Blue)`** and **`ELSE`** with `[A]`/`[B]` switch blades.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

**Watch out for `Blue Crystals (💎)`!** Both `Dock A` (`Crystals`) and `Dock B` (`Blue`) could want them — so your code must check **`IF [itemIcon == Crystal]` FIRST** (already started for you!), then **`ELSE IF [itemColor == Blue]`** (`Right [A]` + `Left [B]`), and **`ELSE`** (`Right [A]` + `Right [B]`)!

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE_IF", "ELSE", "END_IF"],
  "allowedSensors": ["itemIcon", "itemColor"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "SWITCH_LEFT": { "switchBadge": ["A", "B"] },
    "SWITCH_RIGHT": { "switchBadge": ["A", "B"] }
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 13 },
  "editDelta": 6,
  "switchyardRules": {
    "switchCount": 2,
    "omitSingleSwitchBadge": false,
    "scrapEnabled": false,
    "streamLength": 6
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE_IF", "ELSE", "LOOP_START"],
    "notes": "Every stream contains Crystal(Blue) AND non-Crystal Blue items, defeating reversed priority or missing ELSE_IF."
  }
}
```

---

## 3. Switchyard Streams (`3` Variants, Fixed `N = 6`)

- **Variant 1:** `[Crystal(Blue), Crate(Blue), Gear(Red), Crystal(Red), Battery(Blue), Crate(Green)]`
  - `A`: `[Crystal(B), Crystal(R)]` | `B`: `[Crate(B), Battery(B)]` | `C`: `[Gear(R), Crate(G)]`
- **Variant 2:** `[Gear(Blue), Crystal(Green), Crate(Red), Crystal(Blue), Battery(Red), Gear(Blue)]`
  - `A`: `[Crystal(G), Crystal(B)]` | `B`: `[Gear(B), Gear(B)]` | `C`: `[Crate(R), Battery(R)]`
- **Variant 3:** `[Crate(Amber), Battery(Blue), Crystal(Blue), Gear(Amber), Crate(Blue), Crystal(Purple)]`
  - `A`: `[Crystal(B), Crystal(P)]` | `B`: `[Battery(B), Crate(B)]` | `C`: `[Crate(A), Gear(A)]`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`6` Flat Blocks — Dock A Setup Only)
```text
MAIN (6 flat blocks):
1. LOOP_START (6)
2.   IF (itemIcon == Crystal)
3.     SWITCH_LEFT [A]
4.   END_IF
5.   SEND_NEXT
6. LOOP_END
```

### Partial Help (`9` Flat Blocks — `Edit Delta: 3` left)
```text
MAIN (9 flat blocks):
1. LOOP_START (6)
2.   IF (itemIcon == Crystal)
3.     SWITCH_LEFT [A]
4.   ELSE_IF (itemColor == Blue)
5.     SWITCH_RIGHT [A]
6.     SWITCH_LEFT [B]
7.   END_IF
8.   SEND_NEXT
9. LOOP_END
```

### Canonical Reference Solution (`12` Flat Blocks — `Edit Delta: 6`, within `slotCap: 13`)
```text
MAIN (12 flat blocks):
1.  LOOP_START (6)
2.    IF (itemIcon == Crystal)
3.      SWITCH_LEFT [A]
4.    ELSE_IF (itemColor == Blue)
5.      SWITCH_RIGHT [A]
6.      SWITCH_LEFT [B]
7.    ELSE
8.      SWITCH_RIGHT [A]
9.      SWITCH_RIGHT [B]
10.   END_IF
11.   SEND_NEXT
12. LOOP_END
```

### Variant Trace Matrix

| # | Var 1 (`A/B/C`) | Var 2 (`A/B/C`) | Var 3 (`A/B/C`) |
|---|---|---|---|
| `1` | `Crystal(B) → A` | `Gear(B) → B` | `Crate(A) → C` |
| `2` | `Crate(B) → B` | `Crystal(G) → A` | `Battery(B) → B` |
| `3` | `Gear(R) → C` | `Crate(R) → C` | `Crystal(B) → A` |
| `4` | `Crystal(R) → A` | `Crystal(B) → A` | `Gear(A) → C` |
| `5` | `Battery(B) → B` | `Battery(R) → C` | `Crate(B) → B` |
| `6` | `Crate(G) → C` ✓ | `Gear(B) → B` ✓ | `Crystal(P) → A` ✓ |
