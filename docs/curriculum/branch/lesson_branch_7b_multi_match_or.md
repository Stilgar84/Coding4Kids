# `branch.7b` — Multi-Match `Or` Emblem Consolidation

- **Slug / Legacy Alias:** `branch.7b` *(New Stage 2 Lesson)*
- **Order:** `14`
- **Environment:** `switchyard`
- **One-Concept Goal:** Use the **`OR`** combinator in **`IF (itemIcon == Battery OR itemIcon == Crystal)`** to send two power-cell emblems to Dock `↙` and hardware (`Crate`/`Gear`) to Dock `↘` across `3` fixed streams (`N = 6`).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. `1`-Switch Y-fork (`[A]` badge omitted). Left Dock (`↙`) shows `🔋 + 💎`; Right Dock (`↘`) shows `📦 + ⚙️`.
- **Coach Spotlight:** Highlights `OR` combinator slot inside `IF / ELSE` inside Starter `LOOP_START (6) / SEND_NEXT / LOOP_END`.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Both **Batteries (`🔋`)** and **Crystals (`💎`)** belong in the **Power Bin (Left)**, while Crates and Gears go **Right**. Snap an **`OR`** block inside `IF` so **either** `itemIcon == Battery` **or** `itemIcon == Crystal` flips the switch Left (`SWITCH_LEFT`), and `ELSE` sends everything else Right!

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
  "allowedCombinators": ["OR"],
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
    "streamLength": 6
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "ELSE", "LOOP_START"],
    "notes": "Both Battery & Crystal appear in all 3 streams alongside both Crate & Gear, blocking single-icon checks without OR."
  }
}
```

---

## 3. Switchyard Streams (`3` Variants, Fixed `N = 6`)

- **Variant 1:** `[Battery, Crate, Crystal, Gear, Battery, Crystal]`
  - `↙`: `[Battery, Crystal, Battery, Crystal]` | `↘`: `[Crate, Gear]`
- **Variant 2:** `[Gear, Crystal, Crate, Battery, Gear, Crate]`
  - `↙`: `[Crystal, Battery]` | `↘`: `[Gear, Crate, Gear, Crate]`
- **Variant 3:** `[Crystal, Battery, Battery, Crate, Crystal, Gear]`
  - `↙`: `[Crystal, Battery, Battery, Crystal]` | `↘`: `[Crate, Gear]`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`3` Flat Blocks)
```text
MAIN (3 flat blocks):
1. LOOP_START (6)
2.   SEND_NEXT
3. LOOP_END
```

### Partial Help (`6` Flat Blocks — `Edit Delta: 2` left)
```text
MAIN (7 flat blocks):
1. LOOP_START (6)
2.   IF (itemIcon == Battery OR itemIcon == Crystal)
3.     SWITCH_LEFT
4.   ELSE
5.   END_IF
6.   SEND_NEXT
7. LOOP_END
```

### Canonical Reference Solution (`8` Flat Blocks — `Edit Delta: 5`, within `slotCap: 9`)
```text
MAIN (8 flat blocks):
1. LOOP_START (6)
2.   IF (itemIcon == Battery OR itemIcon == Crystal)
3.     SWITCH_LEFT
4.   ELSE
5.     SWITCH_RIGHT
6.   END_IF
7.   SEND_NEXT
8. LOOP_END
```

### Trace Summary

| Item # | Var 1 | Var 2 | Var 3 |
|---|---|---|---|
| `1` | `Battery → ↙` | `Gear → ↘` | `Crystal → ↙` |
| `2` | `Crate → ↘` | `Crystal → ↙` | `Battery → ↙` |
| `3` | `Crystal → ↙` | `Crate → ↘` | `Battery → ↙` |
| `4` | `Gear → ↘` | `Battery → ↙` | `Crate → ↘` |
| `5` | `Battery → ↙` | `Gear → ↘` | `Crystal → ↙` |
| `6` | `Crystal → ↙` ✓ | `Crate → ↘` ✓ | `Gear → ↘` ✓ |
