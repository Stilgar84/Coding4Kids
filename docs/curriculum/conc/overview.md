# Side Module `conc`: ⚡ Concurrency — Multi-Programs, Synchronization & Parallel Algorithms

- **Module ID:** `conc`
- **Track:** Parallel Side Module (unlocks after Core Module [`args`](../args/overview.md); Mastery Challenge `conc.M1` additionally builds on [`rec`](../rec/overview.md))
- **Environments:** 🎵 Beat & Light Matrix, 🐢 Turtle LOGO, 🤖 Robot Grid (Multi-Robot), 🏗️ Depot (Dual-Worker), 📼 Sparse Memory Tape (Per-Worker Heads)

---

## 1. Pedagogical Goal & Scope

`conc` introduces concurrent and parallel thinking step by step—starting with joyful, hazard-free lockstep polyrhythms and multi-agent cooperation, progressing through **barriers** and **value-copy message passing** (communication without shared-memory bugs), dynamically **forking** parameterized workers, diagnosing **shared-state race conditions & deadlocks** (including Fix-It puzzles), protecting shared state with **mutex locks** and **FIFO queues**, and culminating in **Parallel Sort** that visibly beats single-worker execution on the **Wall-Clock Tick Speedometer (`⏱️`)**.

> **Reading & Co-Pilot Assumption:** Workspace blocks remain 100% zero-reading; concise Guided Explanation Cards may accompany `📖 Explanation` lessons for subtle interleaving, blocking, and deadlock concepts.

---

## 2. Planned Concept & Lesson Arc

### Stage 1: Multiple `Main` Programs (`Main 1`, `Main 2`) & Wall-Clock Speedup (`⏱️`)
- **Concept:** Running 2+ independent entry tabs simultaneously in deterministic lockstep (`Main 1` executes 1 tick + `Main 2` executes 1 tick = `1` elapsed wall-clock beat `⏱️`), introducing the `⏱️` Wall-Clock Tick badge.
- **Creative Onboarding (`🎵 Beat & Light` & `🐢 Turtle LOGO`):**
  - *Beat Band:* `Main 1` plays the drum groove while `Main 2` plays melody + LED patterns on the exact same beat clock.
  - *Separate Scene Elements (`🐢 LOGO`):* Each `Main` tab owns an independent turtle starting at `(0, 0, 0°)` with isolated pen state—drawing separate scene elements in half the wall-clock time.
- **Constrained Puzzle (`🤖 Robot Grid`):** Two color-coded robots (`Bot 🔴`, `Bot 🔵`) clearing separate wings or holding a pressure plate so a partner crosses a gate.

### Stage 2: Global Barrier Synchronization (`🚧 Barrier`)
- **Concept:** Aligning execution phases when workers take unpredictable numbers of ticks to reach a milestone.
- **Mechanism:** `🚧 SYNC_BARRIER` pauses an arriving worker (`⏳🚧` badge) until **all** currently active workers reach a barrier, then releases everyone together.
- **Exercises:**
  - *Multi-Map 2-Robot Relay (`🤖 Grid`):* Validated across **3–4 variant maps** where `Bot 🔴` and `Bot 🔵` face corridors of varying lengths—hardcoded `WAIT` counts fail; `🚧 Barrier` keeps gate-holding synchronized across all variants.
  - *Audio-Visual Drop Sync (`🎵 Beat & Light`):* Aligning an irregular melody riff (`Main 1`) with a synchronized full-pad LED burst (`Main 2`) on the downbeat.

### Stage 3: Message Passing (`📨 Send` & Blocking `📬 $recv`)
- **Concept:** Coordinating and transferring data safely via **copied values** over color-coded channels (`🔴`, `🔵`, `🟢`)—achieving both data transfer and synchronization with zero shared-memory race conditions.
- **Mechanism:**
  - `📨 SEND [Channel, Value]` sends a copy of a `TypedValue` (`number` or `color`, literal or variable).
  - `📬 $recv [Channel]` blocks the reading worker (`⏳📬`) until a message is available on `Channel`, returning the copied value (e.g., `a = $recv [🔴]`).
- **Exercises:**
  - *Vault Code Relay (`🤖 Grid`):* `Bot 🔴` reads `tileDial` in a sealed room and `Send`s the code over `🔴` so `Bot 🔵` knows how many steps/items to process.
  - *Command Dispatcher (`🏗️ Depot`):* Inspector worker scans incoming items and sends routing/count tokens to a packer worker.

### Stage 4: Dynamic Spawning (`🔀 Fork`) & Child Barrier (`🚧 Join`)
- **Concept:** Spawning multiple concurrent instances of a parameterized helper `F1(●, ▲, ■)` dynamically and waiting for spawned tasks to complete.
- **Mechanism:**
  - `🔀 Fork F1(●, ▲, ■)` spawns a new worker fiber with **isolated local copies** of sockets `(●, ▲, ■)`.
  - *Turtle LOGO Pose Rule:* A forked turtle **clones the parent turtle's current `(x, y, heading, penColor, penWidth, penDown)`** at the moment of the fork—enabling simultaneous branching trees and fireworks without backward state-restoration boilerplate.
  - `🚧 Join` blocks the parent worker until its forked children finish.

### Stage 5: Shared-State Race Conditions, Fix-It Debugging & Mutex Locks (`🔒` / `🔓`)
- **Concept:** Contrasting safe local sockets and message copies against **shared mutable state** (`a`–`z` globals, shared Depot stations, and overlapping Tape cells).
- **Exercises:**
  - *`📖 Explanation` + Fix-It Puzzle (Lost Update & Double-Grab):* Stepping tick-by-tick through two workers running `a = a + 1` (interleaved reads/writes losing counts!) and two Depot claws checking `NOT stationEmpty` on the same tick before colliding (`💥`) on the last ring/block.
  - *Mutex Synchronization (`🔒 Lock [🔴/🔵]` & `🔓 Unlock [🔴/🔵]`):* Protecting critical sections so waiting workers pause (`⏳🔴`) cleanly; includes a visual **Deadlock Fix-It** demo/puzzle when two workers acquire `🔴` and `🔵` in opposite orders.
  - *Producer–Consumer Pipeline (`🏗️ Depot`):* Worker 1 filters `Input → FIFO Queue` while Worker 2 concurrently drains `FIFO Queue → Stacks` safely.

### Stage 6: Parallel Sort & Speedup Capstones (`conc.A`–`conc.B`)
- **Per-Worker Tape Heads (`▲1`, `▲2`, …):** Each active worker maintains its **own color-coded `headPos`** over the shared `TapeState.cells` dictionary—allowing disjoint slices (`[1..4]` vs. `[5..8]`) to sort **lock-free in true parallel** while overlapping cell writes still race if unsynchronized.
- **Capstone `conc.A` — Parallel Odd-Even Brick Sort (`📼 Tape`):** Concurrent compare-and-swap workers alternating even/odd neighbor pairs separated by `🚧 Barrier` phases, visibly cutting `⏱️` wall-clock ticks.
- **Capstone `conc.B` — Parallel Chunk Sort + Two-Way Merge (`📼 Tape` & `🏗️ Depot`):** `Fork F1(1, 4)` + `Fork F1(5, 8)` sorting disjoint halves concurrently on separate Tape heads → `🚧 Join` → Two-Way Merge, side-by-side with single-worker sort tick count (`⏱️`).

---

## 3. Planned Optional Mastery Challenges (`🔥` Unlocked After `conc`)

- **`conc.M1` — Recursive Parallel Merge Sort *(requires [`rec`](../rec/overview.md))*:** Recursive divide-and-conquer `Fork` + `Join` sorting larger Sparse Tape arrays in logarithmic parallel depth.
- **`conc.M2` — Deadlock-Free Dual-Crane Warehouse (`🏗️ Depot`):** Coordinating two claws across shared stacks and locks without circular wait.
- **`conc.M3` — Multi-Robot Coordinated Catacombs (`🤖 Robot Grid`):** 3-robot cooperative exploration using barriers and message channels across variant maps.
