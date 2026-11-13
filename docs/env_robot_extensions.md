# 🤖 Robot Grid Planned Extensions (High-Level)

This document outlines the simulation-specific additions to **Robot Grid** (`src/simulations/grid/`) required across Modules 2, 5–6, 8, and 10–11 of [the curriculum](./curriculum.md).

*(For cross-environment blocks such as `If/Else`, `While`, local shape-socket function parameters, `?` placeholders, multi-profile saves, and lesson versioning, see [Shared Language, Lesson Mechanics & Platform Requirements](./platform_requirements.md); for Stack/Queue/Tower-of-Hanoi sorting puzzles, see [Depot & Memory Tape (`env_depot_and_tape.md`)](./env_depot_and_tape.md).)*

---

## 1. Visual Grid Rules & Interactive World Items (Module 2+)

To move beyond pure navigation puzzles while keeping **zero reading required**, the grid introduces self-explanatory interactive elements:

- **Padlock-Gated Ordered Waypoints (`Lesson 1.5+`):** When numbered flags (`1 → 2 → Goal`) must be visited in order, later flags display a dimmed padlock ring that visually unlocks when the preceding flag is collected.
- **Keys & Locked Gates (`Lesson 2.6+`):** Colored/shaped keys picked up from floor tiles unlock matching gate barriers directly ahead of the robot.
- **Planks & Water Gaps (`Lesson 2.6+`):** Carryable planks bridge 1-tile water channels ahead so the robot can cross safely.
- **Crates / Energy Cells & Floor Switches (`Lesson 2.6+`):** Carryable items placed onto recessed floor switches/pads to open doors or fulfill delivery goals (including corridor crate-swapping in *Challenge 10.1*; Tower of Hanoi disc stacking lives in **🏗️ Depot** `Lesson 11.8` & *Challenge 11.2*).
- **Numbered Floor Dials (`tileDial`, `Module 6+`):** Floor tiles displaying a bold integer (`1..20`); reading a dial animates the number flying from the floor tile into the target variable box.
- **Relics (`Module 11`):** High-contrast artifacts inside branching caves that must be picked up and carried back to the entrance pad.

---

## 2. Grid Object Action Blocks (Lesson 2.6+)

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `PICK_UP` | Robot claw / hand up | Repeat badge (optional in M6+ stack depots) | Picks up the item on the robot's current tile into its visible backpack indicator (collides/shakes if backpack is full or tile is empty). |
| `USE_DROP` | Hand down / key-use icon | Repeat badge (optional in M6+) | Contextually uses or places the carried item: unlocks a matching gate directly ahead, lays a carried plank onto water directly ahead, or drops a crate/cell onto the current floor tile/switch. |

---

## 3. Planned Robot Grid Sensors (Module 5+)

Sensors plug visually into shared `If`, `If / Else`, `While`, and `VAR_ASSIGN` blocks, emitting a subtle scan pulse on the grid when evaluated:

| Sensor | Visual Badge | Type | Meaning |
| :--- | :--- | :---: | :--- |
| `pathAhead` | Forward arrow + clear check | Boolean | `true` if the tile directly ahead of the robot has no wall, border, water gap, or locked gate. |
| `pathLeft` | Left relative arrow + check | Boolean | `true` if the tile to the robot's egocentric Left is passable. |
| `pathRight` | Right relative arrow + check | Boolean | `true` if the tile to the robot's egocentric Right is passable. |
| `unvisitedAhead` | Forward arrow + fresh tile | Boolean | `true` if `pathAhead` is clear **and** the front tile has no robot footprint yet (introduced via its own `📖 Explanation` demo in `Lesson 11.6` for acyclic cave backtracking). |
| `itemHere` | Sparkle / crate on tile | Boolean | `true` if an interactive pickup item sits on the robot's current tile. |
| `carryingItem` | Backpack icon | Boolean | `true` if the robot is currently holding an item. |
| `atGoal` | Checkered goal flag | Boolean | `true` when the robot stands on the active goal pad (with required items/flags satisfied). |
| `tileColor == [Swatch]` | Floor tile color swatch | Boolean | `true` when the floor beacon under the robot matches the chosen swatch. |
| `tileDial` | Floor dial number icon | Numeric | Returns the integer printed on the current floor dial (`0` if none), used in `a = tileDial` or `Call F1(tileDial)`. |
