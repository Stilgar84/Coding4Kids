# `branch.5` — Binary `If / Else` Icon Sorting (`Battery` vs Others)

- **Slug / Legacy Alias:** `branch.5` *(Legacy M5: `5.5`)*
- **Order:** `6`
- **Environment:** `switchyard`
- **One-Concept Goal:** Replace the default-track workaround from `branch.3` with a clean **`IF (itemIcon == Battery) / ELSE`** two-way split across `3` fixed-length conveyor streams (`N = 5`, zero `SCRAP_ITEM`).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Single Y-junction (`[A]` badge omitted). Left Dock (`↙`) displays `🔋 Battery` target badge; Right Dock (`↘`) displays `📦⚙️💎` catch-all group badge. Colors are mixed across every icon.
- **Coach Spotlight:** Highlights `IF (itemIcon == Battery)` → `SWITCH_LEFT` and `ELSE` → `SWITCH_RIGHT` inside the loop before `SEND_NEXT`.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

In `branch.3`, you flipped the switch back to right at the start of every turn. Now use **`IF / ELSE`**! Whenever a **Battery (`🔋`)** arrives, send it **Left**; **`ELSE`** (every Crate, Gear, or Crystal) flips the switch **Right**, followed by a single **`SEND_NEXT`** to dispatch the parcel cleanly.

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE", "END_IF"],
  "allowedSensors": ["itemIcon"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "SWITCH_LEFT": { "switchBadge": "omitted_single_switch" },
    "SWITCH_RIGHT": { "switchBadge": "omitted_single_switch" },
    "SEND_NEXT": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 9 },
  "editDelta": 5,
  "switchyardRules": {
    "switchCount": 1,
    "omitSingleSwitchBadge": true,
    "scrapEnabled": false,
    "streamLength": 5
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE", "LOOP_START"],
    "notes": "Mixed icons (Crate/Gear/Crystal) in Right Dock prevent checking Crate; Battery positions vary across all 3 N=5 streams."
  }
}
```

---

## 3. Switchyard Streams (`3` Variants, Fixed `N = 5`)

- **Variant 1:** `[Battery(Amber), Crate(Blue), Gear(Red), Battery(Green), Crystal(Purple)]`
  - Left `↙`: `[Battery(A), Battery(G)]` | Right `↘`: `[Crate(B), Gear(R), Crystal(P)]`
- **Variant 2:** `[Crate(Red), Crystal(Blue), Battery(Blue), Gear(Amber), Battery(Red)]`
  - Left `↙`: `[Battery(B), Battery(R)]` | Right `↘`: `[Crate(R), Crystal(B), Gear(A)]`
- **Variant 3:** `[Battery(Blue), Battery(Red), Crate(Green), Battery(Purple), Gear(Blue)]`
  - Left `↙`: `[Battery(B), Battery(R), Battery(P)]` | Right `↘`: `[Crate(G), Gear(B)]`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`3` Flat Blocks)
```text
MAIN (3 flat blocks):
1. LOOP_START (5)
2.   SEND_NEXT
3. LOOP_END
```

### Partial Help (`7` Flat Blocks — `Edit Delta: 1` left)
```text
MAIN (7 flat blocks):
1. LOOP_START (5)
2.   IF (itemIcon == Battery)
3.     SWITCH_LEFT
4.   ELSE
5.   END_IF
6.   SEND_NEXT
7. LOOP_END
```
*(Student snaps `SWITCH_RIGHT` inside the `ELSE` branch.)*

### Canonical Reference Solution (`8` Flat Blocks — `Edit Delta: 5`, within `slotCap: 9`)
```text
MAIN (8 flat blocks):
1. LOOP_START (5)
2.   IF (itemIcon == Battery)
3.     SWITCH_LEFT
4.   ELSE
5.     SWITCH_RIGHT
6.   END_IF
7.   SEND_NEXT
8. LOOP_END
```

### Multi-Variant Trace Summary

| Item # | Var 1 (`↙` / `↘`) | Var 2 (`↙` / `↘`) | Var 3 (`↙` / `↘`) |
|---|---|---|---|
| `1` | `Battery → ↙` | `Crate → ↘` | `Battery → ↙` |
| `2` | `Crate → ↘` | `Crystal → ↘` | `Battery → ↙` |
| `3` | `Gear → ↘` | `Battery → ↙` | `Crate → ↘` |
| `4` | `Battery → ↙` | `Gear → ↘` | `Battery → ↙` |
| `5` | `Crystal → ↘` ✓ | `Battery → ↙` ✓ | `Gear → ↘` ✓ |
