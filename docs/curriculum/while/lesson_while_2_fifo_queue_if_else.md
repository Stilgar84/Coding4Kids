# Lesson while.2: FIFO Conveyor Queue & `heldColor == [Swatch]`

**ID:** `while.2` · **Format:** 📖 Guided Autonomous Explanation (`2` Runnable Tabs) · **Env:** [Depot](../../envs/depot.md) (`ENV_VERSION_DEPOT_V4`)
**One-Concept Goal:** Introduce Depot's animated **FIFO Queue** belt cleanly over two runnable tabs: first contrasting **First-In, First-Out (`Queue → OUT`)** arrival order against **LIFO (`Stack 1`)** reversal, then pairing `While (NOT stationEmpty [Queue])` with zero-reading **`heldColor == [Swatch]`** + `If / Else` routing.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> **Tab 1 (`FIFO Queue vs. LIFO Stack`):** Watch the four colored rings ride in from the right funnel! Sending them straight out from the front of the Queue keeps their arrival order (`🔴 🔵 🟢 🟡`). Dropping them onto `Stack 1` first flips the pile upside down (`🟡 🟢 🔵 🔴` — Last-In, First-Out!).
> **Tab 2 (`Inspect & Route`):** Now the worker grabs the front ring from the Queue, checks the glowing ring inside its claw (`heldColor == [Red]`), and drops Red rings onto `Stack 1` and Blue rings onto `Stack 2` until the Queue empties!
> *(Learner Workspace Rule: **0** learner-facing words — belt chevrons, Right-hand Back Entry Funnel vs. Left-hand Front Pickup Cradle, glowing ring spotlights, and swatch predicates communicate everything visually.)*

</details>

---

## 1. Env Contract (`ENV_VERSION_DEPOT_V4`)

- **Stations Enabled (`activeStationsMask = 0x0F` + `OUTPUT`):** `STACK_1`, `STACK_2`, `STACK_3`, `QUEUE`, plus `OUTPUT` chute (`workerStation` starts `QUEUE`).
- **Assets & Zero-Reading Contract:** Uniform `0..9` **Color Rings** (`red`, `blue`, `green`, `yellow`/`amber`) ONLY — zero crates, zero `SCRAP`/`itemDamaged` (`0x1A` retired), zero `BackpackHud`, zero `🔒` padlock badges on stations.
- **Visual Belt Cues:** `QUEUE` animates rolling belt chevrons feeding rings in from the **Right-hand Back Entry Funnel** and surfacing the next ring at the **Left-hand Front Pickup Cradle** (`DEPOT_GRAB` pops the front ring; `DEPOT_SEND_OUT [OUT]` keeps `workerStation` invariant per [depot.md](../../envs/depot.md) §2).
- **Zero-Reading Predicates:** `stationEmpty [Queue]` (`0x18`), `heldColor == [Swatch]` (`0x1B`), and `topColor == [Swatch]` (`0x1C` peek badge shown in sensor drawer for non-destructive inspection before grabbing).

---

## 2. Runnable Tab Specifications

### Tab 1 (`[1]`): FIFO Queue (`Queue → OUT`) vs. LIFO Stack Reversal
- **Pre-loaded Queue (Front → Back):** `[🔴 Red, 🔵 Blue, 🟢 Green, 🟡 Yellow]`
- **Autonomous 2-Beat Demo:**
  - **Beat A (LIFO Contrast — `Queue → Stack 1 → OUT`, `8` blocks):**
    1. Drains Queue onto `Stack 1`: `🔴` bottom, `🟡` top (`[🔴, 🔵, 🟢, 🟡]`).
    2. Drains `Stack 1` to `OUTPUT`: `OUTPUT` receives **`[🟡, 🟢, 🔵, 🔴]`** (reversed!). Target overlay pulses red mismatch against `[🔴, 🔵, 🟢, 🟡]`.
  - **Beat B (Canonical FIFO `Queue → OUT` — `5` flat blocks):**
    ```text
    While (NOT stationEmpty [Queue])
      DEPOT_MOVE_TO [Queue]
      DEPOT_GRAB
      DEPOT_SEND_OUT [OUT]
    End While
    ```
    Delivers **`[🔴, 🔵, 🟢, 🟡]`** straight to `OUTPUT` in exact FIFO arrival order → `🏁 SUCCESS`!

### Tab 2 (`[2]`): Inspect `heldColor == [Swatch]` & Route to Stacks
- **Pre-loaded Queue (Front → Back):** `[🔴 Red, 🔵 Blue, 🔴 Red, 🔵 Blue]`
- **Spotlight Sequence:** At `DEPOT_GRAB`, the front ring clamps in the worker's claw and pulses bright Red/Blue as `If (heldColor == [Red])` evaluates (`topColor == [Red]` also briefly pulses on the front cradle ring before `DEPOT_GRAB` to show peek vs. hold).
- **Canonical Demo Program (`MAIN: 10` flat blocks):**
  ```text
  While (NOT stationEmpty [Queue])
    DEPOT_MOVE_TO [Queue]
    DEPOT_GRAB
    If (heldColor == [Red])
      DEPOT_MOVE_TO [Stack 1]
    Else
      DEPOT_MOVE_TO [Stack 2]
    End If
    DEPOT_PLACE
  End While
  ```

---

## 3. Palette & Sensor Contract

| Metric | Tab 1 | Tab 2 |
| :--- | :--- | :--- |
| **`allowedSimBlocks`** | `DEPOT_MOVE_TO`, `DEPOT_GRAB`, `DEPOT_SEND_OUT` | `DEPOT_MOVE_TO`, `DEPOT_GRAB`, `DEPOT_PLACE` |
| **`allowedControlBlocks`** | `WHILE` (+ `END_WHILE`) | `WHILE` (+ `END_WHILE`), `IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `stationEmpty [Queue]` | `stationEmpty [Queue]`, `heldColor == [Swatch]`, `topColor == [Swatch]` |
| **`allowedCombinators`** | `[NOT]` | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` | `false` / `false` |
| **`allowedScopes` / `Variables` / `Recursion`** | `MAIN` / `false` / `false` | `MAIN` / `false` / `false` |
| **Flat Block Count (`blocks.length`)** | `5` | `10` |

---

## 4. Execution Trace (`Tab 1` Beat B & `Tab 2`)

| Iteration | Tab 1 (`Queue` Front → `OUT`) | Tab 2 (`Queue` Front → Target Stack) |
| :---: | :--- | :--- |
| **1** | Grab `🔴` → `OUT: [🔴]` (`Queue: [🔵,🟢,🟡]`) | Grab `🔴` (`heldColor==Red` True) → `Stack 1: [🔴]` |
| **2** | Grab `🔵` → `OUT: [🔴,🔵]` (`Queue: [🟢,🟡]`) | Grab `🔵` (`heldColor==Red` False) → `Stack 2: [🔵]` |
| **3** | Grab `🟢` → `OUT: [🔴,🔵,🟢]` (`Queue: [🟡]`) | Grab `🔴` (`heldColor==Red` True) → `Stack 1: [🔴,🔴]` |
| **4** | Grab `🟡` → `OUT: [🔴,🔵,🟢,🟡]` (`Queue: []`) | Grab `🔵` (`heldColor==Red` False) → `Stack 2: [🔵,🔵]` |
| **Exit** | `stationEmpty [Queue] == True` → `🏁 SUCCESS` | `stationEmpty [Queue] == True` → `Stack 1 [🔴,🔴]`, `Stack 2 [🔵,🔵]` → `🏁 SUCCESS` |
