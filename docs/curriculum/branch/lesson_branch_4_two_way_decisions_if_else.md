# `branch.4` — `📖` Two-Way Decisions (`Else` & `SCRAP_ITEM` Debut)

- **Slug / Legacy Alias:** `branch.4` *(Legacy M5: `5.4`)*
- **Order:** `5` (Guided Read-Only Concept Demo)
- **Environment:** `robot-grid` (Tab 1) + `switchyard` (Tab 2)
- **One-Concept Goal:** Introduce **`ELSE`** as an either-or fork — first steering left vs right on a Grid beacon (Tab 1, uppercase `"RED"`/`"BLUE"` colors), then debuting **`itemDamaged` + `SCRAP_ITEM`** (`💥` shredder) vs `SEND_NEXT` in the Switchyard (Tab 2).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words.
  - **Tab 1 (`robot-grid`):** `3×3` / `5×3` beacon crossroad with `[1 ✓] [2 ✓]` map pips (`🔵 Blue` tile steers North `TURN_LEFT`; `🔴 Red` tile steers South `TURN_RIGHT`).
  - **Tab 2 (`switchyard`):** `1`-switch layout (`[A]` badge omitted, Left Dock `↙` open for clean parcels) + red hazard shredder flash on `SCRAP_ITEM` (`💥`) when a sparking damaged parcel arrives.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Now **`ELSE`** unlocks true two-way choices: **either** run the top branch **or** the bottom branch, never both! In **Tab 1**, one `IF [tileColor == Blue] / ELSE` turns the robot toward the matching goal on two opposite maps. In **Tab 2**, damaged parcels (`💥`) are **scrapped** cleanly at the gate with `SCRAP_ITEM` while intact parcels pass through `ELSE → SEND_NEXT`!

</details>

---

## 2. Tab 1 (`robot-grid`) Specification — Meet `ELSE`

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "env": "robot-grid",
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["IF", "ELSE", "END_IF"],
  "allowedSensors": ["tileColor"],
  "allowedBlockParams": { "MOVE_FWD": false, "TURN_LEFT": false, "TURN_RIGHT": false },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 8 },
  "editDelta": 0,
  "gridRules": {
    "requireAllItemsCollected": false,
    "requireEmptyBackpackAtGoal": false,
    "strictInteractionCollision": true
  }
}
```

> **Legacy `5.4` Fix Applied:** Tile beacons strictly match uppercase enum constants (`"BLUE"` / `"RED"`; legacy lowercase `"red"` mismatch eliminated).

### Tab 1 Maps (`3×3` Crossroad, `2` Variants)
- **Start:** `(0, 1)` facing `EAST` (`→`).
- **Variant 1 (`BLUE` Beacon → North Goal):** `(1,1)` = `BLUE`; `(1,0)` = `🏁`; `(1,2)` = `#` Wall; `(0,0),(2,0),(2,1),(0,2),(2,2)` = `#` Walls.
- **Variant 2 (`RED` Beacon → South Goal):** `(1,1)` = `RED`; `(1,2)` = `🏁`; `(1,0)` = `#` Wall; same outer walls.

```text
Variant 1:               Variant 2:
 #   🏁   #               #   #   #
[S→][🔵]  #              [S→][🔴]  #
 #   #    #               #   🏁  #
```

### Tab 1 Reference Program (`7` Flat Blocks)
```text
MAIN (7 flat blocks):
1. MOVE_FWD
2. IF (tileColor == Blue)
3.   TURN_LEFT
4. ELSE
5.   TURN_RIGHT
6. END_IF
7. MOVE_FWD
```
- **Trace:** Step `1` → `(1,1)`. On Var 1 (`BLUE`), `IF` turns `LEFT` (`NORTH`) and step `2` reaches `(1,0)` Goal ✓. On Var 2 (`RED`), `ELSE` turns `RIGHT` (`SOUTH`) and step `2` reaches `(1,2)` Goal ✓.

---

## 3. Tab 2 (`switchyard`) Specification — `SCRAP_ITEM` Debut

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "env": "switchyard",
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowedSimBlocks": ["SWITCH_LEFT", "SEND_NEXT", "SCRAP_ITEM"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE", "END_IF"],
  "allowedSensors": ["itemDamaged"],
  "allowedBlockParams": { "LOOP_START": { "min": 2, "max": 8 } },
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "slotCap": { "MAIN": 9 },
  "editDelta": 0,
  "switchyardRules": {
    "switchCount": 1,
    "omitSingleSwitchBadge": true,
    "scrapEnabled": true,
    "scrapRules": "damaged",
    "streamLength": 4
  }
}
```

### Tab 2 Layout & Stream (`N = 4`)
- **Queue (`N = 4`):** `[Crate(Clean), Crate(Damaged 💥), Battery(Clean), Gear(Damaged 💥)]`
- **Target Left Dock (`↙`):** `[Crate(Clean), Battery(Clean)]` (Right Dock `↘` unused / empty)

### Tab 2 Reference Program (`8` Flat Blocks)
```text
MAIN (8 flat blocks):
1. SWITCH_LEFT
2. LOOP_START (4)
3.   IF (itemDamaged)
4.     SCRAP_ITEM
5.   ELSE
6.     SEND_NEXT
7.   END_IF
8. LOOP_END
```
- **Trace:** `SWITCH_LEFT` aims the single track at `↙`. Items `1 & 3` (clean) enter `ELSE → SEND_NEXT` and dock safely in `↙`; Items `2 & 4` (`💥` damaged) trigger `IF (itemDamaged) → SCRAP_ITEM` right at the gate (`scrapRules: "damaged"` ✓). Zero damaged parcels docked, zero clean parcels shredded!
