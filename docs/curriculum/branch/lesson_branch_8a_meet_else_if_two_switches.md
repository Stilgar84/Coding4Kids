# `branch.8a` — `📖` Meet `Else If` & Two Switches (`[A]` / `[B]`)

- **Slug / Legacy Alias:** `branch.8a` *(New Stage 2 Guided Demo)*
- **Order:** `15` (Guided Read-Only Concept Demo)
- **Environment:** `switchyard`
- **One-Concept Goal:** Introduce **`ELSE IF`** priority chains AND the **2-switch, 3-dock tree** (`[A]` Left → **Dock `A`**; `[A]` Right → `[B]` Left → **Dock `B`**; `[A]` Right → `[B]` Right → **Dock `C`**).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. **`[A]`** and **`[B]`** square badges appear on both track switches and on `SWITCH_LEFT [A]` / `SWITCH_RIGHT [A]` / `SWITCH_LEFT [B]` / `SWITCH_RIGHT [B]` blocks (`N = 6` fixed stream, zero `SCRAP_ITEM`).
- **Coach Spotlights (`2` Tabs):**
  - **Tab 1 ("Three-Way Color Tree `A / B / C`"):** Steps `[Red, Blue, Green, Red, Blue, Green]` through `IF (Red) { [A]↙ } ELSE_IF (Blue) { [A]↘; [B]↙ } ELSE { [A]↘; [B]↘ }`, pulsing Switch `[A]` vs Switch `[B]` as each blade flips!
  - **Tab 2 ("First Match Wins — Priority Order"):** Introduces a `Crystal(Blue)` item! Shows **`IF (itemIcon == Crystal)` BEFORE `ELSE_IF (itemColor == Blue)`** so `Crystal(Blue)` goes to **Dock `A`** rather than getting stolen by the Blue lane (`Dock B`).

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Welcome to the **2-Switch Yard (`[A]` and `[B]`)**! Switch **`[A]`** sends Left straight into **Dock A**, or Right down to **Switch `[B]`**, which splits into **Dock B (Left)** and **Dock C (Right)**. Use **`IF / ELSE IF / ELSE`** to pick one of those `3` tracks cleanly — and remember, **`ELSE IF` stops at the FIRST rule that matches!**

</details>

---

## 2. Shared Configuration (`2` Read-Only Tabs)

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE_IF", "ELSE", "END_IF"],
  "allowedSensors": ["itemColor", "itemIcon"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "SWITCH_LEFT": { "switchBadge": ["A", "B"] },
    "SWITCH_RIGHT": { "switchBadge": ["A", "B"] }
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 13 },
  "editDelta": 0,
  "switchyardRules": {
    "switchCount": 2,
    "omitSingleSwitchBadge": false,
    "scrapEnabled": false,
    "streamLength": 6
  }
}
```

---

## 3. Tab 1 — `Red / Blue / Green` Three-Dock Demo (`N = 6`)

- **Stream:** `[Red, Blue, Green, Red, Blue, Green]`
- **Targets:** `Dock A`: `[Red, Red]` | `Dock B`: `[Blue, Blue]` | `Dock C`: `[Green, Green]`

```text
MAIN (12 flat blocks):
1.  LOOP_START (6)
2.    IF (itemColor == Red)
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

---

## 4. Tab 2 — Priority Order (`Crystal(Blue)` → `Dock A`, `N = 6`)

- **Stream:** `[Crystal(Blue), Crate(Blue), Gear(Red), Crystal(Red), Battery(Green), Crate(Green)]`
- **Targets:** `Dock A` (`💎 Crystal`): `[Crystal(Blue), Crystal(Red)]` | `Dock B` (`🔵 Other Blue`): `[Crate(Blue)]` | `Dock C` (`Rest`): `[Gear(Red), Battery(Green), Crate(Green)]`

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
- **Priority Trace:** Item 1 (`Crystal(Blue)`) matches **line 2 first** → `SWITCH_LEFT [A]` → **Dock `A`** (`ELSE_IF` at line 4 is skipped!). Item 2 (`Crate(Blue)`) fails line 2, matches line 4 → **Dock `B`** ✓.
