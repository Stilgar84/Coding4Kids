# `branch.2` — `📖` Meet the Switchyard (Track Switching)

- **Slug / Legacy Alias:** `branch.2` *(Legacy M5: `5.2`)*
- **Order:** `3` (Guided Read-Only Concept Demo)
- **Environment:** `switchyard`
- **One-Concept Goal:** Introduce **1-switch Y-fork Track Switching**: flipping the diverter blade (`SWITCH_LEFT` / `SWITCH_RIGHT`) **before** `SEND_NEXT` dispatches a single parcel without consuming two items or using `SCRAP_ITEM`.

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Single Y-junction switch (`[A]` badge omitted for 1-switch simplicity), `↙` Left Blue Dock & `↘` Right Red Dock, top-center stream queue (`4` fixed parcels, `N = 4`, **NO `While` / NO `BackpackHud`**).
- **Coach Spotlights (`2` Tabs):**
  - **Tab 1 ("Default Track + `IF` Override"):** Steps through `[Red, Blue, Red, Blue]` highlighting that `SWITCH_RIGHT` resets the diverter to `↘` before `IF (itemColor == Blue)` selectively flips it to `↙`, and **only** `SEND_NEXT` sends the parcel down the chosen arm.
  - **Tab 2 ("Flip Either Way — Left Default + `IF` Right"):** Runs `[Blue, Blue, Red, Blue]` with `SWITCH_LEFT` default + `IF (itemColor == Red) { SWITCH_RIGHT } END_IF`, proving both directions work identically before `ELSE` is introduced in `branch.4`.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

In the **Switchyard**, `SWITCH_LEFT` and `SWITCH_RIGHT` only move the **rail track blade** — the parcel stays on the gate until **`SEND_NEXT`** pushes it down whichever track is active! Because there is no `ELSE` block yet, each loop pass starts by pointing the track to the default dock, then uses `IF` to flip it to the other dock only for matching colors, before finishing with a single **`SEND_NEXT`**.

</details>

---

## 2. Palette, Sensors & Switchyard Rules

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SWITCH_RIGHT", "SEND_NEXT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "END_IF"],
  "allowedSensors": ["itemColor"],
  "allowedBlockParams": {
    "LOOP_START": { "min": 2, "max": 8 },
    "SWITCH_LEFT": { "switchBadge": "omitted_single_switch" },
    "SWITCH_RIGHT": { "switchBadge": "omitted_single_switch" },
    "SEND_NEXT": false
  },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 8 },
  "editDelta": 0,
  "switchyardRules": {
    "switchCount": 1,
    "omitSingleSwitchBadge": true,
    "scrapEnabled": false,
    "streamLength": 4
  }
}
```

---

## 3. Switchyard Streams & Reference Traces (`N = 4`)

### Tab 1 Layout & Stream
- **Queue (`N = 4`):** `[Red-Crate, Blue-Crate, Red-Crate, Blue-Crate]`
- **Target Left Dock (`↙`):** `2× Blue` (`order irrelevant` or ordered `[Blue, Blue]`)
- **Target Right Dock (`↘`):** `2× Red` (`[Red, Red]`)

```text
MAIN (7 flat blocks):
1. LOOP_START (4)
2.   SWITCH_RIGHT
3.   IF (itemColor == Blue)
4.     SWITCH_LEFT
5.   END_IF
6.   SEND_NEXT
7. LOOP_END
```

| Item # | Head Item | `SWITCH_RIGHT` | `IF (itemColor == Blue)` | `SEND_NEXT` Target | Docks (`↙` / `↘`) |
|---|---|---|---|---|---|
| `1` | `Red-Crate` | Blade `→ ↘` | `false` | `↘ Right` | `[]` / `[R]` |
| `2` | `Blue-Crate` | Blade `→ ↘` | `true` → `SWITCH_LEFT` (`↙`) | `↙ Left` | `[B]` / `[R]` |
| `3` | `Red-Crate` | Blade `→ ↘` | `false` | `↘ Right` | `[B]` / `[R, R]` |
| `4` | `Blue-Crate` | Blade `→ ↘` | `true` → `SWITCH_LEFT` (`↙`) | `↙ Left` | `[B, B]` / `[R, R]` ✓ |

### Tab 2 Layout & Stream
- **Queue (`N = 4`):** `[Blue-Crate, Blue-Crate, Red-Crate, Blue-Crate]`
- **Target Left Dock (`↙`):** `[Blue, Blue, Blue]` | **Target Right Dock (`↘`):** `[Red]`

```text
MAIN (7 flat blocks):
1. LOOP_START (4)
2.   SWITCH_LEFT
3.   IF (itemColor == Red)
4.     SWITCH_RIGHT
5.   END_IF
6.   SEND_NEXT
7. LOOP_END
```

- Items `1, 2, 4` stay on `↙ Left` (`Blue`); Item `3` (`Red`) flips to `↘ Right` right before `SEND_NEXT`. Zero `SCRAP_ITEM`, zero double-consume!
