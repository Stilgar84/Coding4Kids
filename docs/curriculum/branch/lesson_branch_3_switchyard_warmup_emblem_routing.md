# `branch.3` — Switchyard Warmup: Emblem Routing (`itemIcon`)

- **Slug / Legacy Alias:** `branch.3` *(Legacy M5: `5.3`; replaces deleted `hazard_filtering` stub)*
- **Order:** `4`
- **Environment:** `switchyard`
- **One-Concept Goal:** Practice 1-switch Y-fork routing across `3` fixed-length conveyor streams (`N = 4`) by checking **`itemIcon == Gear`** regardless of parcel color (zero `SCRAP_ITEM` yet).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Single Y-junction (`[A]` badge omitted). Left Dock (`↙`) displays `⚙️ Gear` target badge; Right Dock (`↘`) displays `📦 Crate` target badge. Queue items mix `Red`/`Blue`/`Amber` paints on both emblems so color cannot be trusted.
- **Coach Spotlight:** Pulses `⚙️` icon sensor badge on `IF (itemIcon == Gear)` inside the pre-built `SWITCH_RIGHT + SEND_NEXT` Starter loop.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Don't be tricked by the paint! Both **Gears (`⚙️`)** and **Crates (`📦`)** arrive in mixed colors across all `3` test streams. Add **`IF [itemIcon == Gear]`** inside the loop to flip the switch left (`SWITCH_LEFT`) only for Gears while letting Crates roll down the default right track (`SWITCH_RIGHT`), then send every parcel once with `SEND_NEXT`.

</details>

---

## 2. Palette, Sensors & Anti-Bypass Contract

```json
{
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "END_IF"],
  "allowedSensors": ["itemIcon"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "SWITCH_LEFT": { "switchBadge": "omitted_single_switch" },
    "SWITCH_RIGHT": { "switchBadge": "omitted_single_switch" },
    "SEND_NEXT": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 8 },
  "editDelta": 3,
  "switchyardRules": {
    "switchCount": 1,
    "omitSingleSwitchBadge": true,
    "scrapEnabled": false,
    "streamLength": 4
  },
  "antiBypassRules": {
    "multiVariantPassRequired": true,
    "requiredOpcodes": ["IF", "LOOP_START"],
    "notes": "Mixed colors across Gears/Crates prevent color cheating (itemColor absent anyway); Gear positions {0,2}, {2,3}, {0,1,2} across 3 streams defeat hardcoded unrolled loops."
  }
}
```

---

## 3. Switchyard Streams (`3` Variants, Fixed `N = 4`)

- **Variant 1:** `[Gear(Red), Crate(Blue), Gear(Amber), Crate(Red)]`
  - Left `↙`: `[Gear(Red), Gear(Amber)]` | Right `↘`: `[Crate(Blue), Crate(Red)]`
- **Variant 2:** `[Crate(Red), Crate(Blue), Gear(Blue), Gear(Green)]`
  - Left `↙`: `[Gear(Blue), Gear(Green)]` | Right `↘`: `[Crate(Red), Crate(Blue)]`
- **Variant 3:** `[Gear(Blue), Gear(Red), Gear(Amber), Crate(Blue)]`
  - Left `↙`: `[Gear(Blue), Gear(Red), Gear(Amber)]` | Right `↘`: `[Crate(Blue)]`

---

## 4. Starter, Partial Help & Canonical Solution

### Starter Code (`4` Flat Blocks — Everything Goes Right)
```text
MAIN (4 flat blocks):
1. LOOP_START (4)
2.   SWITCH_RIGHT
3.   SEND_NEXT
4. LOOP_END
```
- **Why Starter Fails:** Sends all `4` parcels (including `⚙️ Gear`s) to Right Dock `↘`.

### Partial Help (`6` Flat Blocks — `Edit Delta: 1` left)
```text
MAIN (6 flat blocks):
1. LOOP_START (4)
2.   SWITCH_RIGHT
3.   IF (itemIcon == Gear)
4.   END_IF
5.   SEND_NEXT
6. LOOP_END
```

### Canonical Reference Solution (`7` Flat Blocks — `Edit Delta: 3`, within `slotCap: 8`)
```text
MAIN (7 flat blocks):
1. LOOP_START (4)
2.   SWITCH_RIGHT
3.   IF (itemIcon == Gear)
4.     SWITCH_LEFT
5.   END_IF
6.   SEND_NEXT
7. LOOP_END
```

### Variant Trace Matrix

| Step | Var 1 (`↙` / `↘`) | Var 2 (`↙` / `↘`) | Var 3 (`↙` / `↘`) |
|---|---|---|---|
| `1` | `Gear(R) → ↙` | `Crate(R) → ↘` | `Gear(B) → ↙` |
| `2` | `Crate(B) → ↘` | `Crate(B) → ↘` | `Gear(R) → ↙` |
| `3` | `Gear(A) → ↙` | `Gear(B) → ↙` | `Gear(A) → ↙` |
| `4` | `Crate(R) → ↘` ✓ | `Gear(G) → ↙` ✓ | `Crate(B) → ↘` ✓ |
