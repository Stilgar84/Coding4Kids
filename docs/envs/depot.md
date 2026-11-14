# 🏗️ Depot Environment Specification

**Depot** (`ENV_ID_DEPOT = 0x07`) is a side-view toy-crane & container puzzle/sandbox environment introduced in Core Module `loop` of [the curriculum](../curriculum/overview.md) (used across `loop`, `func`, `while`, `cmp`, `tape`, `sort`, `args`, `rec`, and Side Modules `conc` & `fp`). It teaches core data structures (**LIFO stacks**, **FIFO conveyor queues**, and random-access **Memory Tape** sorting/searching) plus **producer–consumer & multi-claw synchronization (`conc`)** through tactile physical metaphors.

*(For cross-environment features—including the shared Sparse Memory Tape blocks/sensors, Typed Variable System, `⏱️` Wall-Clock Tick Speedometer, and Concurrency primitives—see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for binary payload layout, see [Binary Format §4.5 & §7.6](../binary_format.md#45-depot-warehouse-payload-env_id_depot--0x07-envversion--13).)*

---

## 1. Design Philosophy & Kid-Friendly Visual Silhouette

Experiencing all three containers side by side in the Depot teaches **why different data structures exist**:

| Entity | Physical Constraint | What the Learner Discovers |
| :--- | :--- | :--- |
| 🏗️ **Stack** (`1..3` towers) | Only the top ring/block glows; lower ones are locked underneath | "I can only grab the top one — and they come out backwards!" → **LIFO** |
| 📦 **Queue** (conveyor belt) | Items enter at the back, exit only at the front | "First in line goes out first!" → **FIFO** |
| 📼 **Tape** (numbered rail) | Sliding head(s) jump directly to any index `1..N` | "I can jump straight to cell #50 or #500!" → **Random access** |

- **Colorful Stackable Rings / Numbered Blocks (Distinct from Switchyard Trains):** Rather than repeating Switchyard's industrial cargo crates and scrap chutes, Depot items render as **bright, beveled stackable rings/discs and numbered toy blocks**. Sized rings make `rec`'s Tower of Hanoi rule (`$heldValue > $topValue` cannot stack a wider ring onto a narrower one) **visually self-explanatory** from `loop` onward!

---

## 2. Side-View Scene Layout

```
   ┌── INPUT ──┐                                        ┌─ OUTPUT ─┐
   │ 🟡🟢🔵🔴  │                                        │  ✅ ✅   │
   └─────┬─────┘                                        └──────────┘
  ╔══════╧══════════════════════════════════════════════════════════╗
  ║   Stack 1       Stack 2       Stack 3                           ║
  ║   ┌──────┐     ┌──────┐     ┌──────┐                           ║
  ║   │  🔴  │     │      │     │      │   ← Only top item glows    ║
  ║   │  🔵  │     │      │     │      │   ← Lower items dimmed     ║
  ║   │  🟢  │     │      │     │      │                           ║
  ║   │  🟡  │     │      │     │      │                           ║
  ║   ╞══════╡     ╞══════╡     ╞══════╡                           ║
  ║   [ 1 🔴 ]     [ 2 🔵 ]     [ 3 🟢 ]                           ║
  ║                                                                 ║
  ║   Queue   ◄── 🟠 🟣 🔵 ───── (back)                             ║
  ║         (front)                                                 ║
  ║                                                                 ║
  ║   Tape   ◀ [1] … [1:·][2:·][3:·][4:·][5:·][6:·][7:·] … [N] ▶    ║
  ║                       ▲1 (per-worker head in conc)              ║
  ║                                                                 ║
  ║            🤖 Worker Claw (2 color-coded claws in conc)         ║
  ╚═════════════════════════════════════════════════════════════════╝
```

---

## 3. Depot Action Blocks (4) & Tape Semantics Clarity

| Block | Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `DEPOT_MOVE_TO` | Arrow → station | `STACK_1` (`1`), `STACK_2` (`2`), `STACK_3` (`3`), `QUEUE`, `TAPE`, `INPUT` — stacks `1..3` also accept a numeric variable (`a`–`z`) or shape socket (`●`, `▲`, `■`) | Slides worker claw to station (1 tick). Errors (`COLLISION`) if dynamic stack number `< 1` or `> 3`. |
| `DEPOT_GRAB` | Claw ↑ | None | **Physical pickup from container:** lifts accessible item into claw (pops top of Stack, dequeues front of Queue, pulls next from Input, or lifts physical peg from a socketed Tape slot when physical-peg mode is active). Errors (`COLLISION`) if empty or claw already holds an item. |
| `DEPOT_PLACE` | Claw ↓ | None | Places held item at worker's station (pushes onto Stack, enqueues at back of Queue, or seats peg into socketed Tape slot). Errors (`COLLISION`) if claw empty or Hanoi ring-size rule (`$heldValue > $topValue`) is violated. |
| `DEPOT_SEND_OUT` | Arrow → ✅ | Gate (`OUT` default, or `ACCEPT` / `REJECT` when decision verdict gates are active) | Sends held item (or verdict token) to Output dock. *(Hazard `SCRAP` stays exclusively in [🚂 Switchyard](./switchyard.md).)* Errors (`COLLISION`) if claw empty when item required. |

> **Physical Peg Slots vs. Electronic Tape Memory:** To avoid confusing conserved physical items (`DEPOT_GRAB` / `DEPOT_PLACE`) with electronic memory copies (`$cellValue`, `$cellColor`, `TAPE_WRITE`), electronic Tape puzzles interact with the Tape strictly via shared Tape blocks/sensors (`TAPE_SEEK`, `TAPE_STEP`, `TAPE_WRITE`, `$cellValue`, `$cellColor`), while physical peg-transfer puzzles visually render recessed peg-sockets on the rail.

---

## 4. Depot Sensors (6)

| Sensor | Badge | Parameters | Type | Meaning |
| :--- | :--- | :--- | :---: | :--- |
| `stationEmpty` | Container + `∅` | Station (`CURRENT` default, `STACK_1`/`2`/`3`, `QUEUE`, `INPUT`) | `boolean` | `1` when target station has zero items (parameterized so merge/consumer loops can test `NOT stationEmpty [STACK_1]` from anywhere) |
| `hasItem` | Claw + `✓` | None | `boolean` | `1` when worker's claw holds an item |
| `$heldColor` | Claw + 🎨 | None | `color` | Color of held item (`TYPE_ERROR` if empty claw or number-only block) |
| `$heldValue` | Claw + `#` | None | `number` | Number/size on held item (`TYPE_ERROR` if empty claw or color-only item) |
| `$topColor` | Top + 🎨 | None | `color` | **Non-destructive peek:** color of glowing top/front item at worker's current station (`TYPE_ERROR` if empty or number-only item) |
| `$topValue` | Top + `#` | None | `number` | **Non-destructive peek:** number/size on glowing top/front item at worker's current station (`TYPE_ERROR` if empty or color-only item) |

---

## 5. Multi-Worker Concurrency (`conc`) & Victory Conditions

- **Dual-Worker Claws & Per-Worker Tape Heads (`conc`):**
  - Supports **2+ color-coded Worker Claws (`Worker 🔴`, `Worker 🔵`)** operating simultaneously:
    - **Producer–Consumer Pipelines:** `Worker 🔴` filters `Input → FIFO Queue` while `Worker 🔵` drains `FIFO Queue → Stacks`.
    - **Race Condition & `🔒 Lock` Hazards:** Two claws executing `DEPOT_GRAB` or `DEPOT_PLACE` on the same Stack in the same tick—or grabbing from a 1-item station without synchronization—trigger a clear visual `COLLISION` (`💥`).
    - **Parallel Sort on Tape:** Each active worker receives its **own color-coded Tape head (`▲1`, `▲2`)** over the shared `TapeState.cells` rail so disjoint sub-arrays sort in true parallel while visibly halving `⏱️` wall-clock ticks!
- **Victory Conditions:** Output sequence match, Station/Tape target order match, no leftover items when required, and Verdict gate match (`ACCEPT` / `REJECT` across **4 simultaneous multi-run variants**).
