# 🚂 Switchyard / Conveyor Sorter Environment Specification

`Switchyard` is a **constrained, validated puzzle environment** introduced in Core Module `branch` of [the curriculum](../curriculum/overview.md) (used across `branch`, `while`, `cmp`, `args`, Planned Side Module `fp`, and Optional **Mastery Challenges**).

While **[🤖 Robot Grid](./robot_grid.md)** excels at spatial navigation, egocentric orientation turns (`Left`/`Right` relative to robot heading) add extra mental load when 5–7 year-old newcomers first learn `If / Else` branching, boolean logic, numeric comparisons (`<`, `>`, `==`), modulo (`%`), and running quotas. And while **[🏗️ Depot](./depot.md)** models stateful multi-step container manipulation (`MoveTo` → `Grab` → `MoveTo` → `Place`), `Switchyard` provides playful, **1-block stateless mechanical train routing** and hazard scrapping—letting learners focus 100% on **inspecting data, making decisions, and routing streams** within compact block budgets.

*(For cross-environment language blocks, multi-stream validation mechanics, and the shared Sparse Memory Tape, see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md).)*

---

## 1. Visual Simulation & Zero-Reading Rules

- **Incoming Stream Queue:** A visible track/belt holding upcoming train cars so learners can see every item's properties before and during execution:
  - **Color:** High-contrast body color (Red, Blue, Green, Amber).
  - **Cargo Emblem:** Distinct icon (Crate, Battery, Gear, Crystal).
  - **Condition Visual:** Intact vs. cracked/sparking (`itemDamaged`) for hazard rejection puzzles (`SCRAP_ITEM` is exclusive to Switchyard).
  - **Weight / Value Badge (`cmp`+):** Large number (`1..99`) printed directly on the car.
- **Inspection Scanner Gate:** An illuminated arch right before the switches; when a car sits under the scanner, sensor badges highlight live with its readouts.
- **1 to 3 Track Switches (`Switch A`, `Switch B`):** Animated rail diverters showing which branch is currently open (`Left` vs. `Right`).
- **Self-Documenting Target Docks & Scrap Chute (Zero Text Required):**
  - Each receiving dock paints its **acceptance rules directly onto the dock floor**:
    - Color swatch / cargo emblem (e.g., Red Crate icon = accepts only undamaged Red Crates).
    - Weight limit scale badge (e.g., `≤ 10` = rejects items heavier than `10`).
    - Segmented **Quota Gauge** (`[■■□□]`, e.g., `2 / 4`) that fills visually as valid cars arrive.
    - Balance beam connecting twin docks (for `cmp.M2` weight-balancing puzzles).
  - Routing a wrong or damaged item into a dock—or leaving cars unsorted when the program ends—triggers an immediate visual collision/mismatch highlight on that dock.

---

## 2. Multi-Stream Validation & Solution Support

- **Simultaneous Multi-Stream Pips (`[1 ✓] [2 ·] [3 ·]`):** Every Switchyard puzzle validates the learner's program against **3–4 different incoming queues** visible from the start, ensuring hardcoded `Left, Right, Left` sequences cannot pass.
- **Partial & Full Visual Solutions:** Every Switchyard lesson provides:
  1. A **Partial Solution** (e.g., `While (hasNextItem)` outer loop or `If (?)` skeleton pre-placed).
  2. A **Full Working Solution** loadable in one tap (Undo-protected).

---

## 3. Action Blocks

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `SWITCH_LEFT` | Track fork pointing Left | Optional Junction badge (`A`, `B` on multi-switch maps; omitted on 1-switch maps) | Sets the track switch to the Left branch (0-travel instant mechanical flip, 1 tick). |
| `SWITCH_RIGHT` | Track fork pointing Right | Optional Junction badge (`A`, `B` on multi-switch maps) | Sets the track switch to the Right branch (1 tick). |
| `SEND_NEXT` | Train/conveyor arrow `→` | Repeat badge (`×N` or variable `a..z`) | Advances the car currently at the scanner along the active switch path into its destination dock, and pulls the next car into the scanner. |
| `SCRAP_ITEM` | Hazard / recycle chute icon | None | Diverts the car currently at the scanner directly into the scrap chute and pulls the next car into the scanner. |

---

## 4. Sensor Conditions & Numeric Readouts

Switchyard sensors plug visually into `If`, `If / Else`, `While`, and variable assignment (`a = [Sensor]`) blocks:

### Boolean & Category Sensors (`branch` & `while`)

| Sensor | Visual Badge | Evaluates True When... |
| :--- | :--- | :--- |
| `hasNextItem` | Train car + `?` | At least one car remains at the scanner / incoming track (standard loop condition for `While (hasNextItem)`). |
| `itemColor == [Swatch]` | Colored car swatch | Scanned car matches the selected color swatch (`Red`, `Blue`, `Green`, `Amber`). |
| `itemIcon == [Emblem]` | Cargo icon badge | Scanned car matches the selected cargo icon (`Crate`, `Battery`, `Gear`, `Crystal`). |
| `itemDamaged` | Cracked/sparking icon | Scanned car is damaged/hazardous and must be sent to `SCRAP_ITEM`. |

### Numeric Readouts (`cmp`+)

| Readout | Visual Badge | Numeric Value Returned |
| :--- | :--- | :--- |
| `itemWeight` | Scale / number tag | The integer weight/value (`1..99`) printed on the scanned car (used in `itemWeight > 10`, `sum = sum + itemWeight`, or `Call F1(itemWeight)`). |
| `dockQuota` | Dock gauge target | The target item/weight quota painted on Dock A (or selected dock badge). |
| `dockCount` | Dock fill counter | Current number of cars (or total weight) already delivered to the selected dock. |

---

## 5. Shared Sparse Memory Tape Integration

- **Tape Length:** `8`–`16` cells in Puzzles; `10,000` cells in Mastery Challenges.
- **Rendering Slot:** Collapsible `shrink-0` Tape Dock above the canvas (read-only in puzzles; see [Platform Requirements](../platform_requirements.md) and [UI Guidelines §3](../ui_guidelines.md#3-non-overlapping-pane-simulation-hud-architecture)).
