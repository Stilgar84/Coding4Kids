# 🤖 Robot Grid Environment Specification

**Robot Grid** is a spatial puzzle and free-play simulation environment used across Core Modules `seq`–`cmp`, `tape`, `args`, `rec`, and Side Module `conc` of [the curriculum](../curriculum/overview.md). Learners program one or more directional robots on a 2D grid with walls, beacons, dials, and interactive objects.

*(For cross-environment features such as `If/Else`, `While`, local shape-socket function parameters, `?` placeholders, typed variables, the shared Sparse Memory Tape, concurrency primitives, multi-profile saves, and lesson versioning, see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for core Grid movement opcodes `MOVE_FWD`, `MOVE_BACK`, `TURN_LEFT`, `TURN_RIGHT`, see [Binary Format §7.2](../binary_format.md#72-grid-world-opcodes-env_id_generic--0x00-or-env_id_grid--0x01-envversion--13); for Stack/Queue/Tower-of-Hanoi sorting puzzles, see [Depot (`depot.md`)](./depot.md).)*

---

## 1. Visual Grid Rules & Distinct Interactive World Items (`param`+)

To move beyond pure navigation puzzles while keeping **programming 100% zero-reading**, the grid provides three mechanically orthogonal pickup items alongside waypoints, dials, and relics:

- **Padlock-Gated Ordered Waypoints (`seq`+):** When numbered flags (`1 → 2 → Goal`) must be visited in order, later flags display a dimmed padlock ring that visually unlocks when the preceding flag is collected.
- **🔑 Keys & Locked Gates (`param`+ — Consumed, Color-Matched):** Colored/shaped keys picked up from floor tiles unlock **matching** gate barriers (`Red Key` → `Red Gate`) directly ahead of the robot and are **consumed** on use.
- **🪵 Planks & Water Gaps (`param`+ — Retrievable Portable Bridges):** Carryable planks laid across 1-tile water channels directly ahead so the robot can walk across. Unlike keys, **planks are NOT consumed**: standing on any land tile facing a bridged water tile **1 cell ahead** and executing `PICK_UP` retrieves the plank back into the robot's backpack (re-opening the water gap)—enabling single-plank multi-river loops and 2-plank leapfrog puzzles!
- **📦 Crates / Energy Cells & Floor Switches (`param`+ — Current-Tile Hold):** Carryable items placed onto (and picked back up from) the robot's **current** floor tile/recessed switch to hold doors open or fulfill delivery goals.
- **Numbered Floor Dials (`tileDial`, `var`+):** Floor tiles displaying a bold integer (`1..20`); reading a dial animates the number flying from the floor tile into the target variable box.
- **Relics (`rec` & `conc`):** High-contrast artifacts inside branching caves that must be picked up and carried back to the entrance pad.

---

## 2. Grid Object Action Blocks (`param`+)

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `PICK_UP` | Robot claw / hand up | Repeat badge (optional) | Contextually picks up an item on the robot's **current floor tile** OR retrieves a deployed **Plank from a bridged water tile 1 cell directly ahead** into its visible backpack indicator (collides/shakes if backpack is full or neither target holds a retrievable item). |
| `USE_DROP` | Hand down / key-use icon | Repeat badge (optional) | Contextually uses or places the carried item: unlocks & consumes a color-matched **Key** on a gate 1 cell ahead, lays a carried **Plank** onto an open water tile 1 cell ahead, or drops a **Crate/Cell** onto the current floor tile/switch. |

---

## 3. Planned Robot Grid Sensors (`branch`+)

Sensors plug visually into shared `If`, `If / Else`, `While`, and `VAR_ASSIGN` blocks, emitting a subtle scan pulse on the grid when evaluated:

| Sensor | Visual Badge | Type | Meaning |
| :--- | :--- | :---: | :--- |
| `pathAhead` | Forward arrow + clear check | Boolean | `true` if the tile directly ahead of the robot has no wall, border, open water gap, locked gate, or blocking robot. |
| `pathLeft` | Left relative arrow + check | Boolean | `true` if the tile to the robot's egocentric Left is passable. |
| `pathRight` | Right relative arrow + check | Boolean | `true` if the tile to the robot's egocentric Right is passable. |
| `unvisitedAhead` | Forward arrow + fresh tile | Boolean | `true` if `pathAhead` is clear **and** the front tile has no robot footprint yet (introduced via its own `📖 Explanation` demo in `rec` for acyclic cave backtracking). |
| `itemHere` | Sparkle / crate on tile | Boolean | `true` if a pickup item sits on the robot's current tile (or a retrievable plank lies 1 cell ahead on water). |
| `carryingItem` | Backpack icon | Boolean | `true` if the robot is currently holding an item. |
| `atGoal` | Checkered goal flag | Boolean | `true` when the robot stands on its active goal pad (with required items/flags satisfied). |
| `tileColor == [Swatch]` | Floor tile color swatch | Boolean | `true` when the floor beacon under the robot matches the chosen swatch. |
| `tileDial` | Floor dial number icon | Numeric | Returns the integer printed on the current floor dial (`0` if none), used in `a = tileDial`, `Send`, or `Call F1(tileDial)`. |

---

## 4. Multi-Robot Concurrency (`conc`) & Sparse Tape Integration

- **Multi-Robot Maps (`conc` & Free-Play Sandbox):** Supports `2–4` color-coded robots (`Bot 🔴`, `Bot 🔵`, …) mapped to `Main 1`, `Main 2`, … (or spawned helpers) on a shared grid:
  - Enables **cooperative switch-and-gate puzzles** (Bot 🔴 holds a floor switch while Bot 🔵 crosses the open door, synchronized across variant map lengths via `🚧 Barrier`), **vault code relays** (`📨 Send` / `📬 $recv`), and **narrow-bridge / shared-relic collision & `🔒 Lock` puzzles**.
  - Stepping two robots into the same tile on the same tick (or both grabbing the same item simultaneously) triggers a clear visual `COLLISION` (`💥`).
- **Sparse Memory Tape:** `8`–`16` cells in Puzzles; `10,000` cells in Mastery Challenges and Free-Play Sandbox, rendered in a collapsible `shrink-0` Tape Dock above the canvas (see [Platform Requirements](../platform_requirements.md) and [UI Guidelines §3](../ui_guidelines.md#3-non-overlapping-pane-simulation-hud-architecture)).
