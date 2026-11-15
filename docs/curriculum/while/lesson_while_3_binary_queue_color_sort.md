# Lesson while.3: Binary Queue Color Sort

**ID:** `while.3` · **Format:** 🏗️ Core Multi-Run Puzzle (`4` Simultaneous Streams) · **Env:** [Depot](../../envs/depot.md) (`ENV_VERSION_DEPOT_V4`)
**One-Concept Goal:** Practice `While (NOT stationEmpty [Queue])` + binary `If (heldColor == [Red]) / Else` sorting across `4` queues of different lengths and compositions, using a pre-scaffolded Queue grab/place loop (`Edit Delta: 5`).

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> Four different queues are waiting on the belt—some have 3 rings, some have 6, and one is all Red! Use the Queue loop frame already in your workspace and plug an `If / Else` test inside so Red rings (`heldColor == [Red]`) go to `Stack 1` and Blue rings go to `Stack 2` before `DEPOT_PLACE`.
> *(Learner Workspace Rule: **0** learner-facing words — uniform Red/Blue rings, glowing claw ring checks, and `[1 ✓] [2 ✗]` run indicators communicate everything visually.)*

</details>

---

## 1. Env Setup & Palette Contract (`ENV_VERSION_DEPOT_V4`)

- **Stations Active (`activeStationsMask = 0x0B` or `0x0F`, `OUTPUT` unused):** `STACK_1`, `STACK_2`, `QUEUE` active (`STACK_3` empty/unused), initial `workerStation = QUEUE`, `heldItem = null`, empty stacks.
- **Ring Visuals:** Strictly uniform Red (`1`) and Blue (`2`) Color Rings — zero crates, zero `SCRAP`.

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `DEPOT_MOVE_TO` (`Queue`, `Stack 1`, `Stack 2`), `DEPOT_GRAB`, `DEPOT_PLACE` |
| **`allowedControlBlocks`** | `WHILE` (+ `END_WHILE`), `IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `stationEmpty [Queue]`, `heldColor == [Red / Blue]`, `topColor == [Red / Blue]` |
| **`allowedCombinators`** | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN` / `false` / `false` |
| **`slotCap`** | `10` (`perScope.MAIN: 10`, `maxTotal: 10`) |
| **`starterBlocks`** | `6` (`While (NOT stationEmpty [Queue]) { DEPOT_MOVE_TO [Queue], DEPOT_GRAB, ? ("conditional"), DEPOT_PLACE } End While`) |
| **`editDelta`** | `5` (replaces `?` with `If / MoveTo / Else / MoveTo / End If` = `+5 - 1` net change, `<= 6–8` Core Limit) |
| **`antiBypassRules`** | Queue lengths `{3, 5, 4, 6}` + Run 3 all-Red (`[🔴, 🔴, 🔴, 🔴]`) crash any fixed `Loop ×N` on empty `DEPOT_GRAB` (`COLLISION`) and fail hardcoded paths. |

---

## 2. Four Simultaneous Variant Queues (`Front → Back`)

| Run | Initial `Queue` (Front → Back) | Len | Target `Stack 1` | Target `Stack 2` | Edge Case Tested |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | `[🔴, 🔵, 🔴]` | `3` | `[🔴, 🔴]` | `[🔵]` | Short baseline alternating |
| **2** | `[🔵, 🔵, 🔴, 🔵, 🔴]` | `5` | `[🔴, 🔴]` | `[🔵, 🔵, 🔵]` | Starts Blue (`Else` branch first) |
| **3** | `[🔴, 🔴, 🔴, 🔴]` | `4` | `[🔴, 🔴, 🔴, 🔴]` | `[]` | **All-Red edge case** (exposes empty `Stack 2` assumptions) |
| **4** | `[🔵, 🔴, 🔵, 🔵, 🔵, 🔴]` | `6` | `[🔴, 🔴]` | `[🔵, 🔵, 🔵, 🔵]` | Longest queue (`6` beats `Loop ×3/×4/×5`) |

---

## 3. Starter, Clue Reveal & Canonical Reference Solution

### Starter (`MAIN: 6 flat blocks` out of `10` slots)
```text
While (NOT stationEmpty [Queue])
  DEPOT_MOVE_TO [Queue]
  DEPOT_GRAB
  ? ("conditional")
  DEPOT_PLACE
End While
```

### Clue Reveal (`partialHelp` — `MAIN: 10` flat blocks)
```text
While (NOT stationEmpty [Queue])
  DEPOT_MOVE_TO [Queue]
  DEPOT_GRAB
  If (heldColor == [Red])
    ? ("move")
  Else
    ? ("move")
  End If
  DEPOT_PLACE
End While
```

### Canonical Reference Solution (`MAIN: 10 flat blocks`)
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
*(Behavioral equivalence: Checking `topColor == [Red]` BEFORE `DEPOT_GRAB` produces the same target stacks; checking `heldColor == [Blue]` swaps `Stack 2` / `Stack 1` cleanly.)*

---

## 4. Multi-Run Execution Trace (Run 2 & Run 3)

| Run | Tick Loop | Queue Remaining | Stack 1 | Stack 2 | Outcome |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **2 (`len 5`)** | 1: Grab `🔵` → `Else` → `S2` | `[🔵, 🔴, 🔵, 🔴]` | `[]` | `[🔵]` | — |
| **2** | 2: Grab `🔵` → `Else` → `S2` | `[🔴, 🔵, 🔴]` | `[]` | `[🔵, 🔵]` | — |
| **2** | 3: Grab `🔴` → `If` → `S1` | `[🔵, 🔴]` | `[🔴]` | `[🔵, 🔵]` | — |
| **2** | 4: Grab `🔵` → `Else` → `S2` | `[🔴]` | `[🔴]` | `[🔵, 🔵, 🔵]` | — |
| **2** | 5: Grab `🔴` → `If` → `S1` | `[]` (`empty == T`) | `[🔴, 🔴]` | `[🔵, 🔵, 🔵]` | **`[2 ✓]`** |
| **3 (`len 4`)** | 1..4: `4 × (Grab 🔴 → If → S1)` | `[]` (`empty == T`) | `[🔴, 🔴, 🔴, 🔴]` | `[]` | **`[3 ✓]`** |
