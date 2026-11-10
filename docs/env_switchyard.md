# 🚂 Switchyard / Conveyor Sorter Environment Specification (High-Level)

`Switchyard` is a **constrained, validated puzzle environment** introduced in Module 5 of [the curriculum](./curriculum.md) (used across Modules 5, 7, 8, and Optional **Mastery Challenges**).

While **🤖 Robot Grid** excels at spatial navigation, orientation turns (`Left`/`Right` relative to robot heading) add extra mental load when newcomers first learn `If / Else` branching, numeric comparisons (`<`, `>`, `==`), modulo (`%`), and running totals. `Switchyard` removes egocentric turning completely—onboarding first with simple `If` hazard scrapping (`Lessons 5.2–5.3`) before introducing `If / Else` (`Lessons 5.4–5.5`)—so learners can focus purely on **inspecting data, making decisions, and routing streams**.

---

## 1. Visual Simulation & Zero-Reading Rules

- **Incoming Stream Queue:** A visible track/belt holding upcoming cars or crates so learners can see every item's properties before and during execution:
  - **Color:** High-contrast body color (Red, Blue, Green, Amber).
  - **Cargo Emblem:** Distinct icon (Crate, Battery, Gear, Crystal).
  - **Condition Visual:** Intact vs. cracked/sparking (`itemDamaged`) for hazard rejection puzzles.
  - **Weight / Value Badge (Module 7+):** Large number (`1..99`) printed directly on the item.
- **Inspection Scanner Gate:** An illuminated arch right before the switches; when an item sits under the scanner, sensor badges highlight live with the item's readouts.
- **1 to 3 Track Switches (`Switch A`, `Switch B`):** Animated rail/conveyor diverters showing which branch is currently open (`Left` vs. `Right`).
- **Self-Documenting Target Docks & Scrap Chute (Zero Text Required):**
  - Each receiving dock paints its **acceptance rules directly onto the dock floor**:
    - Color swatch / cargo emblem (e.g., Red Crate icon = accepts only undamaged Red Crates).
    - Weight limit scale badge (e.g., `≤ 10` = rejects items heavier than `10`).
    - Segmented **Quota Gauge** (`[■■□□]`, e.g., `2 / 4`) that fills visually as valid items arrive.
    - Balance beam connecting twin docks (for *Challenge 7.2* weight-balancing puzzles).
  - Routing a wrong or damaged item into a dock—or leaving items unsorted when the program ends—triggers an immediate visual collision/mismatch highlight on that dock.

---

## 2. Multi-Stream Validation & Solution Support

- **Simultaneous Multi-Stream Pips (`[1 ✓] [2 ·] [3 ·]`):** Every Switchyard puzzle validates the learner's program against **3–4 different incoming item queues** visible from the start, ensuring hardcoded `Left, Right, Left` sequences cannot pass.
- **Partial & Full Visual Solutions:** Like Robot Grid, every Switchyard lesson provides:
  1. A **Partial Solution** (e.g., `While (hasNextItem)` outer loop with `If (?)` skeleton pre-placed).
  2. A **Full Working Solution** loadable in one tap (with Undo).

---

## 3. Action Blocks

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `SWITCH_LEFT` | Track fork pointing Left | Optional Junction badge (`A`, `B` on multi-switch maps; omitted on 1-switch maps) | Sets the track switch to the Left branch (0-travel instant mechanical flip, 1 tick). |
| `SWITCH_RIGHT` | Track fork pointing Right | Optional Junction badge (`A`, `B` on multi-switch maps) | Sets the track switch to the Right branch (1 tick). |
| `SEND_NEXT` | Conveyor arrow `→` | Repeat badge (`×N` or variable `a..z`) | Advances the item currently at the scanner along the active switch path into its destination dock, and pulls the next item into the scanner. |
| `SCRAP_ITEM` | Trash / hazard chute icon | None | Diverts the item currently at the scanner directly into the scrap chute and pulls the next item into the scanner. |

---

## 4. Sensor Conditions & Numeric Readouts

Switchyard sensors plug visually into `If`, `If / Else`, `While`, and variable assignment (`a = [Sensor]`) blocks:

### Boolean & Category Sensors (Module 5+)

| Sensor | Visual Badge | Evaluates True When... |
| :--- | :--- | :--- |
| `hasNextItem` | Queue car + `?` | At least one item remains at the scanner / incoming belt (standard loop condition for `While (hasNextItem)`). |
| `itemColor == [Swatch]` | Colored crate swatch | Scanned item matches the selected color swatch (`Red`, `Blue`, `Green`, `Amber`). |
| `itemIcon == [Emblem]` | Cargo icon badge | Scanned item matches the selected cargo icon (`Crate`, `Battery`, `Gear`, `Crystal`). |
| `itemDamaged` | Cracked/sparking icon | Scanned item is damaged/hazardous and must be sent to `SCRAP_ITEM`. |

### Numeric Readouts (Module 7+)

| Readout | Visual Badge | Numeric Value Returned |
| :--- | :--- | :--- |
| `itemWeight` | Scale / number tag | The integer weight/value (`1..99`) printed on the scanned item (used in `itemWeight > 10`, `sum = sum + itemWeight`, or `Call F1(itemWeight)`). |
| `dockQuota` | Dock gauge target | The target item/weight quota painted on Dock A (or selected dock badge). |
| `dockCount` | Dock fill counter | Current number of items (or total weight) already delivered to the selected dock. |
