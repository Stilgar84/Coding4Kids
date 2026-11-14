# 🤖 Robot Grid Environment Specification

**Robot Grid** is a spatial puzzle and free-play simulation environment used across Core Modules `seq`–`cmp`, `tape`, `args`, `rec`, and Side Module `conc` of [the curriculum](../curriculum/overview.md). Learners program one or more directional robots on a 2D grid with walls, beacons, dials, and interactive objects.

*(For cross-environment features such as `If/Else`, `While`, `CMP`, local shape-socket/function parameters, `?` placeholders, typed variables, the shared Sparse Memory Tape, concurrency primitives, multi-profile saves, and lesson versioning, see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for non-overlapping HUD slots & Zero-Reading icon rules, see [UI Guidelines](../ui_guidelines.md); for core Grid movement opcodes and `ENV_VERSION_GRID` v1–v4 binary payloads, see [Binary Format §4 & §7.2](../binary_format.md); for Stack/Queue/Tower-of-Hanoi sorting puzzles, see [Depot (`depot.md`)](./depot.md).)*

---

## 1. Visual Grid Rules & Distinct Interactive World Items (`param`+)

To move beyond pure navigation puzzles while keeping **programming 100% zero-reading**, the grid provides four distinct world item types alongside waypoints, floor switches, beacons, dials, and entrance pedestals:

- **Ordered Waypoints & Shuttered Goal Barriers (`seq`+ — Zero `🔒` Icons):**
  - **Ordered Flags (`order > 0`, e.g., `1 → 2 → Goal`)** render in three unmistakable states:
    1. **Active Next:** Full-brightness raised pennant (`🚩 1`) with subtle idle halo.
    2. **Gated Future:** Dimmed shuttered pennant wrapped in a dashed ring with a dashed sequence chain (**`1 ⋯▶ 2`**). **Never render a padlock (`🔒`) on flags, goals, or the Top-Right `grid-readonly-badge` (use `🛡️`/`👁️`)**—`🔒` is strictly reserved for `conc` Mutex locks (`ui_guidelines.md` §4 `One Icon = One Meaning`).
    3. **Collected:** Crisp green `✓` stamp + lowered muted flag marker.
  - Stepping onto Flag `k` pulses green `✓` and animates a shutter release along `k → k+1` to illuminate the next flag or `Goal`. Stepping onto a still-gated future flag is a **harmless pass-through no-op** (never `COLLISION`), triggering a gentle shutter wiggle and pulsing the active prerequisite flag.
  - **Unordered Collectible Flags (`order = 0`, `loop` / `rec` / `cmp`):** Render without sequence chains and never block one another.
  - **Shuttered Goal Preconditions (`🏁 k/N`):** When `Goal` is gated by `requiredForGoal` floor switches, ordered waypoints, `requireAllItemsCollected`, `requireEmptyBackpackAtGoal`, or Relic delivery, render a sliding shutter barrier + compact progress badge (e.g., `🏁 0/8`) on the `Goal` tile rather than a padlock.
- **Direct On-Robot 1-Slot Carry (`Shoulder Gripper` — Retires `BackpackHud`):**
  - Robot Grid enforces **strict 1-slot carrying capacity** (`carryingItem` boolean), rendered **directly on the robot sprite** on an upper-right shoulder cradle (`~40%` of tile width, inside the robot's tile bounding box):
    - Held items stay **`0°` screen-upright** (optional `±6°` grip tilt) with a crisp `2px` high-contrast outline halo and tiny robotic pincer fingers across all 4 headings (`N/E/S/W`).
    - The robot's front visor/eyes, forward directional chevron (`▲`), and underlying floor cues (`Switch`, `Dial`, `Beacon`, `Flag`) remain **100% unobstructed**.
    - Top-Left `BackpackHud` (`🎒`) is retired completely (`ui_guidelines.md` §3).
  - **Supply Stack Depots (`stackCountOverrides`, `count > 1`):** Floor depots render as a tiered mini-stack with a bold remaining-count badge (`×5`); each `PICK_UP` moves 1 unit onto the robot's shoulder gripper while decrementing the floor badge (`5 → 4 → ...`) for `Loop ×c` shuttle loops.
  - **Tile Capacity:** Max `1` floor pickup item (or `1` supply stack) per tile; Floor Switches, Beacons, Dials, and Entrance Pedestals are floor surfaces underneath items.
- **🔑 Keys & Locked Gates (`param`+ — Consumed, Color + Shape Matched):** Double-encoded colored/shaped keys (`Amber ●`, `Emerald ▲`, `Purple ◆` per `binary_format.md` §4.2) carried on the shoulder gripper emit a gleam pulse when facing a **matching** closed gate (`●`, `▲`, `◆`) 1 cell ahead; `USE_DROP` inserts and rotates the key `90°`, retracts the gate bars, and **consumes** the key.
- **🪵 Planks & Water Gaps (`param`+ — Retrievable 1-Cell-Ahead Portable Bridges):** Beveled cross-slat planks project a translucent bridge-ghost outline over open water 1 cell ahead when carried. `USE_DROP` bridges that water cell (`pathAhead: false → true`) with a splash ring. Unlike keys, **planks are NOT consumed**: standing on any adjacent land tile facing a bridged water tile **1 cell ahead** and executing `PICK_UP` extends the gripper 1 cell forward to retrieve the plank onto the robot's shoulder mount (re-opening rippling water `pathAhead: true → false`)—enabling single-plank loops and 2-plank leapfrog puzzles.
- **📦 Crates / Energy Cells & Floor Switches (`param`+ — Current-Tile Hold & Floor Circuit):** Carryable power-core cubes dropped onto (and picked back up from) the robot's **current** floor tile/recessed octagonal Floor Switch. A thin **floor circuit trace line** connects each switch to its `linkedGateIdx`; switches depress and keep their gate open strictly while occupied (`isPressed = hasCrateOnTile || hasRobotOnTile`), lighting the floor circuit green/cyan.
- **Numbered Floor Dials (`tileDial`, `var`+):** Flush **circular rotary gauge plates** embedded in the floor tile with a slate metallic bezel, rim ticks, and bold tabular integer (`1..20`)—clearly distinct from raised pennant flags (`🚩 1`). Reading a dial animates a glowing numeral arc/beam to its consumer (`VARS` watch box for `a = tileDial`, active `F1(●)` socket for `Call F1(tileDial)`, outgoing `📨` channel badge for `Send`, or comparison gleam for `cmp`).
- **💎 Relics & Entrance Pedestals (`rec` & `conc`, `typeIdx = 3` in `ENV_VERSION_GRID_V4`):** Faceted star-crystal artifacts inside branching caves carried (1 at a time) back onto recessed Cave Entrance Pedestal rings (`hollow relic silhouette` target until delivered).

---

## 2. Grid Object Action Blocks (`param`+) & Completion Timing

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `PICK_UP` | Robot claw / hand up | Repeat badge (optional) | Picks up an item on the robot's **current floor tile** (or 1 unit from a `count > 1` Supply Stack) **OR** reaches 1 cell forward to retrieve a deployed **Plank from a bridged water tile directly ahead** onto the robot's shoulder gripper (with upward arc + sparkle). On empty tile/no retrievable plank, empty claw extends and shakes; if already carrying (`1`-slot full), the **held item directly on the robot** shakes amber/red (`strictInteractionCollision: true` elevates invalid pickups/drops to `COLLISION` `💥`). |
| `USE_DROP` | Hand down / key-use icon | Repeat badge (optional) | Contextually uses or places the carried shoulder item: inserts & **consumes** a matching **Key** into a gate 1 cell ahead (mismatched bow/keyhole flash on wrong key), bridges open water 1 cell ahead with a **Plank**, drops a **Crate/Cell** onto the current floor tile/switch (lighting connected gate circuits), or places a **Relic** onto an Entrance Pedestal. |

- **End-of-Program Goal Evaluation (`seq`+ / `while`+):** Robot Grid evaluates `'SUCCESS'` when program execution terminates cleanly (no `COLLISION`, `'STEP_LIMIT'`, `'MATH_ERROR'`, `'STACK_OVERFLOW'`, or `'DEADLOCK'`) while the robot stands on a satisfied `Goal` (all required ordered flags, `requiredForGoal` switches, `requireAllItemsCollected`, `requireEmptyBackpackAtGoal`, and Relic conditions met)—never cutting off a running loop mid-execution (preserving `While (NOT atGoal)` loops and overshoot debugging).

---

## 3. Robot Grid Sensors (`branch`+)

Sensors plug visually into shared `If`, `If / Else`, `While`, `0x30 CMP`, and `VAR_ASSIGN` blocks, projecting clean directional/target scan cues directly on the grid:

| Sensor | Visual Badge | Type | Meaning |
| :--- | :--- | :---: | :--- |
| `pathAhead` | Forward arrow + clear check | Boolean | Emits forward visor scan (`✓` green / `✕` red bumper); `true` if tile ahead has no wall, border, open water, locked gate, or partner robot (`conc`). |
| `pathLeft` | Left relative arrow + check | Boolean | Emits left sensor-ear scan (`✓`/`✕`); `true` if the robot's egocentric Left cell is passable. |
| `pathRight` | Right relative arrow + check | Boolean | Emits right sensor-ear scan (`✓`/`✕`); `true` if the robot's egocentric Right cell is passable. |
| `unvisitedAhead` | Forward arrow + fresh footprint | Boolean | `COND_TAG = 0x08`. Auto-renders robotic tread footprints whenever present in the activity (manual `Trace` toggle also supported). Pre-seeds `(initialX, initialY)` as `visited = true` at reset (`t = 0`) and keeps footprints permanently across `MOVE_BACK` (supporting cyclic and acyclic caves). Lights green sparkle `✓` if `pathAhead && !visited[ahead]`, muted footprint `✕` if visited, or red bumper `✕` if blocked. |
| `itemHere` | Sparkle / item on tile | Boolean | `true` if a pickup item sits on the robot's **current** tile OR a retrievable bridged **Plank** lies 1 cell ahead on water (projecting a forward scan ring onto that Plank when true). |
| `carryingItem` | Robot claw holding item *(replaces `🎒`)* | Boolean | `true` if the robot's shoulder gripper is currently holding an item (pulses a highlight ring around the held item on the active robot sprite). |
| `atGoal` | Checkered goal flag | Boolean | `true` when the robot stands on an active, unlocked `Goal` pad with prerequisites met. |
| `tileColor == [Swatch]` | Floor tile color swatch | Boolean | `true` when the floor beacon (`Red ●`, `Blue ▲`, `Green ■`, `Yellow ◆`) under the robot matches the swatch (mapped cleanly to `PALETTE_COLORS`: `red=1, blue=2, green=3, yellow/amber=4`). |
| `tileDial` | Rotary floor dial badge | Numeric | Returns the integer on the current circular floor dial (`0` if none, emitting a muted `0` ring), used in `a = tileDial`, `0x30 CMP`, `Send`, or `Call F1(tileDial)`. |

---

## 4. Multi-Robot Concurrency (`conc`) & Sparse Tape Integration

- **Strict `1:1` Team Robots (`conc` & `ENV_VERSION_GRID_V4` Sandbox — Zero `🔀 Fork` / `🤝 Join`):**
  - Supports `2–3` color- and shape/number-coded robots (`Bot 1 🔴` → `Main 1`, `Bot 2 🔵` → `Main 2`, `Bot 3 🟢` → `Main 3`; extensible up to `Main 4`) starting synchronously at `t = 0` from their authored `robots[]` spawn tiles. `🔀 Fork` and `🤝 Join` blocks are disabled on Robot Grid so spatial puzzles remain visually deterministic.
  - Because carried items render on each robot's own shoulder gripper inside its tile and team footprints tint per-bot (`🔴`/`🔵`/`🟢` over shared `visited` state in `conc.M3`), multi-bot state stays legible without HUD clutter.
  - Enables **cooperative switch-and-gate relays** (Bot 🔵 holds Floor Switch open in `conc.5` while Bot 🔴 crosses with `🚧 Barrier`), **vault code relays** (`📨 Send` / `📬 $recv`), and **narrow-bridge / mutex (`🔒 Lock` / `🔓 Unlock`) synchronization**.
- **Complete Multi-Robot Collision, Wait & Deadlock Cues (`💥`, `⏳`, `🔒💥`):**
  - **Collisions (`COLLISION` `💥`):** Localized starburst + dual-robot shake on: (1) entering the same tile on the same tick, (2) **head-on edge swap** (`A: u → v` & `B: v → u` simultaneously), (3) simultaneous `PICK_UP` on the same item or 1-count stack, (4) simultaneous `USE_DROP` onto the same water tile, or (5) gate closing onto a traversing partner during a switch-release race.
  - **Following Permitted:** Entering a tile **simultaneously vacated** by a partner (`B: u → v` while `A: v → w` succeeds) is **allowed**; `pathAhead/Left/Right` still evaluate `false` when a partner currently occupies that adjacent tile.
  - **Above-Robot Wait Bubbles & Deadlock (`🔒💥`):** A paused robot shows an in-world bubble above its tile (`⏳🚧` Barrier, `⏳📬` Channel Receive, `⏳🔒` Mutex Lock) and Top-Right displays the `⏱️` Wall-Clock Tick counter. If all active robots stall simultaneously in `WAITING` state, simulation terminates with `'DEADLOCK'` (`🔒💥` Top-Center Pill + pulsing dependency ring across waiting robots).
- **Sparse Memory Tape (`tape.9` & Sandbox):** `8`–`16` cells in Puzzles; `10,000` cells in Mastery Challenges and Free-Play Sandbox, rendered in the shared collapsible `shrink-0` `TapeDock` above the canvas (`ui_guidelines.md` §3), decoupled cleanly from Grid map state (see [Platform Requirements](../platform_requirements.md)).
