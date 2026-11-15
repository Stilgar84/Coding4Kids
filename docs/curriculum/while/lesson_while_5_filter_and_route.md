# Lesson while.5: Switchyard Stream Filter & Route (`Main + F1`)

**ID:** `while.5` · **Format:** 🚂 Core Multi-Run Synthesis (`4` Simultaneous Streams) · **Env:** [Switchyard](../../envs/switchyard.md)
**One-Concept Goal:** Combine `func` (`F1`), `branch` (`If (itemDamaged) { SCRAP_ITEM } Else If ...`), and `while` (`While (hasNextItem)`) to inspect, scrap damaged cars safely, and route variable-length Red/Blue freight trains across `4` streams.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> `F1` already knows how to route intact Red and Blue cars onto the two tracks! Look closely at the top `If` slot inside `F1`—make it check `itemDamaged` and trigger `SCRAP_ITEM`, then build `While (hasNextItem) { CALL F1 }` inside `MAIN` so every train finishes cleanly no matter how many cars leave the tunnel. Note why `Else If` is vital: `SCRAP_ITEM` immediately pulls the next car under the scanner, so two separate `If` blocks would inspect the wrong car!
> *(Learner Workspace Rule: **0** learner-facing words — Tunnel Lantern `+N`, Scanner + attached trapdoor, glowing track chevrons, and `🚂 ×N left!` alert drive everything visually.)*

</details>

---

## 1. Env Setup & Visual Cues ([Switchyard](../../envs/switchyard.md))

- **Track Layout:** Single **Scanner + attached `SCRAP_ITEM` Trapdoor** (`scrapRules: ['damagedOnly']`), **`1` Switch** (`↙` Left → `Dock 1` Red target; `↘` Right → `Dock 2` Blue target; `A` switch label omitted since only 1 switch exists), `viewBox="0 0 640 540"` with `48px` top HUD clearance.
- **Visual Sync:** Tunnel Lantern pulses `+N` remaining hidden cars; glowing track chevrons highlight active route (`Dock 1` or `Dock 2`); exiting `While` with `hasNextItem == true` triggers amber `🚂 ×N left!` stranded-car pulse on the belt and auto-focuses the first failing stream `[k ✗]` for `⏮ → ⏭` stepping.

---

## 2. Palette, Sensor & Budget Contract

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT`, `SCRAP_ITEM`, `CALL_FN [F1]` |
| **`allowedControlBlocks`** | `WHILE` (+ `END_WHILE`), `IF`, `ELSE_IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `hasNextItem` (`0x10`), `itemDamaged` (`0x11`), `itemColor == [Red / Blue]` (`0x12`) |
| **`allowedCombinators`** | `[]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN`, `F1` / `false` / `false` |
| **`slotCap`** | `12` total (`perScope.MAIN: 3`, `perScope.F1: 9`) |
| **`starterBlocks`** | `MAIN: 0`, `F1: 7` (intact `Else If (itemColor == [Red])` / `Else` scaffolded; damaged top guard `? ("sensor")` + `? ("item")` open) |
| **`editDelta`** | `5` (`MAIN`: `+While`, `+CALL F1`, `+End While` = `3`; `F1`: fill `itemDamaged` + `SCRAP_ITEM` = `2`; `<= 6–8` Core Limit) |
| **`antiBypassRules`** | Unequal lengths `{2, 4, 5, 6}`, leading damaged car (`[💥, 🔵]` in Stream 1), and back-to-back damaged cars (`[💥, 💥]` in Stream 3) crash any sequential-`If` shortcut into `Dock 2` (`COLLISION`). |

---

## 3. Four Simultaneous Variant Train Streams (`Front → Back`)

| Stream | Incoming Cars (Front → Back) | Len | Target `Dock 1` (`↙`) | Target `Dock 2` (`↘`) | Expected Scrapped | Critical Guard Tested |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- |
| **1** | `[💥, 🔵]` | `2` | `[]` | `[🔵]` | `1` | Starts with damaged car; sequential `If` skips `🔵` check/misroutes! |
| **2** | `[💥, 🔴, 💥, 🔵]` | `4` | `[🔴]` | `[🔵]` | `2` | Alternating scrap + both docks |
| **3** | `[🔴, 💥, 💥, 🔵, 🔴]` | `5` | `[🔴, 🔴]` | `[🔵]` | `2` | **Consecutive `[💥, 💥]`**: sequential `If` pulls 2nd `💥` straight into `Dock 2` (`COLLISION`)! |
| **4** | `[🔵, 🔴, 💥, 🔵, 💥, 🔴]` | `6` | `[🔴, 🔴]` | `[🔵, 🔵]` | `2` | Max length `6`; verifies full drain without leftover cars |

---

## 4. Starter, Clue Reveal & Canonical Reference Solution

### Starter (`MAIN: 0` / `3` slots · `F1: 7` / `9` slots)
```text
// MAIN (0 / 3 slots)
(empty)

// F1 (7 / 9 slots)
If (? ("sensor"))
  ? ("item")
Else If (itemColor == [Red])
  SWITCH_LEFT
  SEND_NEXT
Else
  SWITCH_RIGHT
  SEND_NEXT
End If
```

### Clue Reveal (`partialHelp`)
```text
// MAIN (3 slots)
While (? ("sensor"))
  CALL_FN [F1]
End While

// F1 (9 slots — damaged guard filled, intact intact)
If (itemDamaged)
  ? ("item")
Else If (itemColor == [Red])
  SWITCH_LEFT
  SEND_NEXT
Else
  SWITCH_RIGHT
  SEND_NEXT
End If
```

### Canonical Reference Solution (`MAIN: 3 + F1: 9 = 12` flat blocks)
```text
// MAIN (3 flat blocks)
While (hasNextItem)
  CALL_FN [F1]
End While

// F1 (9 flat blocks)
If (itemDamaged)
  SCRAP_ITEM
Else If (itemColor == [Red])
  SWITCH_LEFT
  SEND_NEXT
Else
  SWITCH_RIGHT
  SEND_NEXT
End If
```

---

## 5. Multi-Run Execution Trace (Stream 3 — Consecutive `[💥, 💥]`)

| Tick (`MAIN`) | Car at Scanner | Branch in `F1` | Action Executed | `Dock 1` | `Dock 2` | `hasNextItem` After |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | `🔴` | `Else If (Red)` | `SWITCH_LEFT`, `SEND_NEXT` | `[🔴]` | `[]` | `True` (`[💥, 💥, 🔵, 🔴]`) |
| **2** | `💥` | `If (itemDamaged)` | `SCRAP_ITEM` (advances 2nd `💥` + returns!) | `[🔴]` | `[]` | `True` (`[💥, 🔵, 🔴]`) |
| **3** | `💥` | `If (itemDamaged)` | `SCRAP_ITEM` (advances `🔵` + returns!) | `[🔴]` | `[]` | `True` (`[🔵, 🔴]`) |
| **4** | `🔵` | `Else` | `SWITCH_RIGHT`, `SEND_NEXT` | `[🔴]` | `[🔵]` | `True` (`[🔴]`) |
| **5** | `🔴` | `Else If (Red)` | `SWITCH_LEFT`, `SEND_NEXT` | **`[🔴, 🔴]`** | **`[🔵]`** | `False` → Exit **`[3 ✓]`** |
