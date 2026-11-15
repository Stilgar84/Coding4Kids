# Lesson while.4: 3-Way Queue Sort & FIFO Express Lane

**ID:** `while.4` · **Format:** 🏗️ Core Multi-Run Puzzle (`4` Simultaneous Streams) · **Env:** [Depot](../../envs/depot.md) (`ENV_VERSION_DEPOT_V4`)
**One-Concept Goal:** Extend `while.3`'s binary Queue sorter using `Else If (heldColor == [Blue])` and `DEPOT_SEND_OUT [OUT]` so Red rings stack on `Stack 1`, Blue rings stack on `Stack 2`, and **Express (`🟢 Green`, `🟡 Yellow`) rings exit straight to `Output` in exact FIFO arrival order**.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> Keep Red rings on `Stack 1` and use `Else If (heldColor == [Blue])` to send Blue rings to `Stack 2`—then put `DEPOT_SEND_OUT [OUT]` inside `Else` so Green and Yellow express rings glide straight out in the exact order they arrived (First-In, First-Out)! Remember `DEPOT_SEND_OUT [OUT]` empties the claw directly, so `DEPOT_PLACE` stays inside the `Stack 1` and `Stack 2` branches rather than after `End If`.
> *(Learner Workspace Rule: **0** learner-facing words — uniform Color Rings, glowing claw badges, FIFO target order strip on `Output`, and `[1 ✓] [2 ✗]` run indicators drive everything visually.)*

</details>

---

## 1. Why Express FIFO Matters (`Queue → OUT` vs. `Stack 3 → OUT`)

Unlike `while.3`, Depot now displays the **`OUTPUT` Target Strip** showing **exact arrival order** of every Green and Yellow ring (`🟢, 🟡` vs. `🟡, 🟢`). Routing Express rings onto `Stack 3` and later draining `Stack 3` to `OUTPUT` **reverses their order (LIFO)** and fails `targetOutput`; routing them straight via `DEPOT_SEND_OUT [OUT]` preserves FIFO order directly inside the `While` loop.

Because `DEPOT_SEND_OUT [OUT]` delivers the carried ring immediately (`heldItem -> null` while keeping `workerStation` at `QUEUE` per [depot.md](../../envs/depot.md) §2), `DEPOT_PLACE` belongs strictly inside the `Red` and `Blue` stack branches—**never** shared after `End If` (which would attempt `DEPOT_PLACE` with an empty claw → `COLLISION`).

---

## 2. Env Setup & Palette Contract (`ENV_VERSION_DEPOT_V4`)

- **Stations Active (`activeStationsMask = 0x0F` + `OUTPUT`):** `STACK_1`, `STACK_2`, `STACK_3` (unused), `QUEUE` (back-entry funnel → animated belt chevrons → front cradle), `OUTPUT` target checker active; initial `workerStation = QUEUE`, `heldItem = null`.
- **Assets:** Uniform Red (`1`), Blue (`2`), Green (`3`), Yellow/Amber (`4`) Color Rings — zero crates, zero `SCRAP`.

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `DEPOT_MOVE_TO` (`Queue`, `Stack 1`, `Stack 2`), `DEPOT_GRAB`, `DEPOT_PLACE`, `DEPOT_SEND_OUT [OUT]` |
| **`allowedControlBlocks`** | `WHILE` (+ `END_WHILE`), `IF`, `ELSE_IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `stationEmpty [Queue]`, `heldColor == [Red / Blue / Green / Yellow]`, `topColor == [Swatch]` |
| **`allowedCombinators`** | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN` / `false` / `false` |
| **`slotCap`** | `13` (`perScope.MAIN: 13`, `maxTotal: 13`; `<= 14/tab` Guardrail) |
| **`starterBlocks`** | `10` (pre-scaffolded binary `Red → Stack 1` sorter ending with `Else { ? ("conditional") }`) |
| **`editDelta`** | `5` (replaces `Else + ?` with `Else If (heldColor == [Blue]) { DEPOT_MOVE_TO [Stack 2], DEPOT_PLACE } Else { DEPOT_SEND_OUT [OUT] }`; `<= 6–8` Core Limit) |
| **`antiBypassRules`** | Variable queue lengths `{4, 5, 6, 7}` + paired Express colors (`[🟢, 🟡]` vs. `[🟡, 🟢, 🟢]`) fail any LIFO stack detour and any fixed `Loop ×N`. |

---

## 3. Four Simultaneous Variant Queues (`Front → Back`)

| Run | Initial `Queue` (Front → Back) | Len | Target `Stack 1` | Target `Stack 2` | Target `Output` (FIFO) |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | `[🔴, 🟢, 🔵, 🟡]` | `4` | `[🔴]` | `[🔵]` | **`[🟢, 🟡]`** *(LIFO trap → `[🟡, 🟢]`)* |
| **2** | `[🟡, 🔴, 🟢, 🔴, 🟢]` | `5` | `[🔴, 🔴]` | `[]` | **`[🟡, 🟢, 🟢]`** *(Zero Blue; Express first)* |
| **3** | `[🔵, 🟢, 🔴, 🟡, 🔵, 🟢]` | `6` | `[🔴]` | `[🔵, 🔵]` | **`[🟢, 🟡, 🟢]`** |
| **4** | `[🟢, 🟡, 🔴, 🔵, 🟢, 🔴, 🟡]` | `7` | `[🔴, 🔴]` | `[🔵]` | **`[🟢, 🟡, 🟢, 🟡]`** |

---

## 4. Starter, Clue Reveal & Canonical Reference Solution

### Starter (`MAIN: 10 flat blocks` out of `13` slots)
```text
While (NOT stationEmpty [Queue])
  DEPOT_MOVE_TO [Queue]
  DEPOT_GRAB
  If (heldColor == [Red])
    DEPOT_MOVE_TO [Stack 1]
    DEPOT_PLACE
  Else
    ? ("conditional")
  End If
End While
```

### Clue Reveal (`partialHelp` — `MAIN: 13` flat blocks)
```text
While (NOT stationEmpty [Queue])
  DEPOT_MOVE_TO [Queue]
  DEPOT_GRAB
  If (heldColor == [Red])
    DEPOT_MOVE_TO [Stack 1]
    DEPOT_PLACE
  Else If (heldColor == [Blue])
    ? ("move")
    DEPOT_PLACE
  Else
    ? ("action")
  End If
End While
```

### Canonical Reference Solution (`MAIN: 13 flat blocks`)
```text
While (NOT stationEmpty [Queue])
  DEPOT_MOVE_TO [Queue]
  DEPOT_GRAB
  If (heldColor == [Red])
    DEPOT_MOVE_TO [Stack 1]
    DEPOT_PLACE
  Else If (heldColor == [Blue])
    DEPOT_MOVE_TO [Stack 2]
    DEPOT_PLACE
  Else
    DEPOT_SEND_OUT [OUT]
  End If
End While
```

---

## 5. Multi-Run Execution Trace (Run 1 & Run 2)

| Run | Tick | Grabbed | Branch Taken | Stack 1 | Stack 2 | Output (FIFO) |
| :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| **1** | 1 | `🔴` | `If (heldColor==Red)` → `MoveTo [S1], Place` | `[🔴]` | `[]` | `[]` |
| **1** | 2 | `🟢` | `Else` → `SendOut [OUT]` | `[🔴]` | `[]` | `[🟢]` |
| **1** | 3 | `🔵` | `Else If (heldColor==Blue)` → `MoveTo [S2], Place` | `[🔴]` | `[🔵]` | `[🟢]` |
| **1** | 4 | `🟡` | `Else` → `SendOut [OUT]` | `[🔴]` | `[🔵]` | **`[🟢, 🟡]`** → `[1 ✓]` |
| **2** | 1 | `🟡` | `Else` → `SendOut [OUT]` | `[]` | `[]` | `[🟡]` |
| **2** | 2..5 | `🔴,🟢,🔴,🟢` | `S1`, `OUT`, `S1`, `OUT` | `[🔴, 🔴]` | `[]` | **`[🟡, 🟢, 🟢]`** → `[2 ✓]` |
