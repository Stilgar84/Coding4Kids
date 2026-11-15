# Lesson while.8: Fix-It Bug Hunt — Premature `While` Exit

**ID:** `while.8` · **Format:** 🔧 Multi-Stream Fix-It (`4` Simultaneous Streams) · **Env:** [Switchyard](../../envs/switchyard.md)
**One-Concept Goal:** Diagnose why a `While (itemColor == [Red])` guard passes an all-Red stream yet strands remaining cars on the belt (`🚂 ×N left!`) across `4` Switchyard streams, and repair it with **`Edit Delta: 1`** (`While (hasNextItem)`).

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> Look at why Stream `[1 ✓]` turns green while Streams `[2 ✗]`, `[3 ✗]`, and `[4 ✗]` stop early with cars still flashing amber on the track (`🚂 ×3 left!`): someone accidentally put **`itemColor == [Red]`** in the `While` condition instead of **`hasNextItem`**! The instant a Blue car reaches the scanner, the `While` loop quits early instead of draining the rest of the train. Tap Stream `2` to step right to the stopped frame, then swap just that top `While` condition to `hasNextItem`!
> *(Learner Workspace Rule: **0** learner-facing words — `[1 ✓] [2 ✗] [3 ✗] [4 ✗]` stream tabs, amber `🚂 ×3 left!` stranded-car pulse, and `⏮ → ⏭` frame replay communicate the bug visually.)*

</details>

---

## 1. Env Setup & Visual Diagnostics ([Switchyard](../../envs/switchyard.md))

- **Track Layout:** Single Scanner + **`1` Switch** (`↙` Left → `Dock 1` Red target; `↘` Right → `Dock 2` Blue target), zero damaged cars (`scrapRules: []`).
- **Diagnostic UX:** Running the buggy starter automatically turns `[1 ✓]` green while `[2 ✗]`, `[3 ✗]`, `[4 ✗]` light red, flashing **`🚂 ×3 left!`** over the leftover cars and auto-focusing `[2 ✗]` so the learner can scrub `⏮ → ⏭` and watch `While (itemColor == [Red])` stop on the very first Blue car.

---

## 2. Palette, Sensor & Budget Contract

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `SWITCH_LEFT`, `SWITCH_RIGHT`, `SEND_NEXT` |
| **`allowedControlBlocks`** | `WHILE` (+ `END_WHILE`), `IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `hasNextItem` (`0x10`), `itemColor == [Red / Blue]` (`0x12`) |
| **`allowedCombinators`** | `[]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN` / `false` / `false` |
| **`slotCap`** | `9` (`perScope.MAIN: 9`, `maxTotal: 9`) |
| **`starterBlocks`** | `9` (pre-filled working sorter with broken `While (itemColor == [Red])` guard) |
| **`editDelta`** | `1` (swap `While` condition `itemColor == [Red]` → `hasNextItem`) |
| **`antiBypassRules`** | Varying lengths `{2, 4, 3, 5}` + Stream 3 beginning with `[🔵, ...]` block any `Loop ×N` or single-pass fix. |

---

## 3. Four Simultaneous Streams (`Starter` Outcome vs. Target)

| Stream | Incoming Stream (Front → Back) | Len | Target `Dock 1` (`↙`) | Target `Dock 2` (`↘`) | Buggy Starter Outcome | Fixed Outcome |
| :---: | :--- | :---: | :--- | :--- | :--- | :---: |
| **1** | `[🔴, 🔴]` | `2` | `[🔴, 🔴]` | `[]` | `[1 ✓]` *(False pass — all Red!)* | **`[1 ✓]`** |
| **2** | `[🔴, 🔵, 🔴, 🔵]` | `4` | `[🔴, 🔴]` | `[🔵, 🔵]` | `[2 ✗]` Stops on 2nd car (`🚂 ×3 left!`) | **`[2 ✓]`** |
| **3** | `[🔵, 🔵, 🔴]` | `3` | `[🔴]` | `[🔵, 🔵]` | `[3 ✗]` Stops at tick 0 (`🚂 ×3 left!`) | **`[3 ✓]`** |
| **4** | `[🔴, 🔴, 🔵, 🔴, 🔴]` | `5` | `[🔴, 🔴, 🔴, 🔴]` | `[🔵]` | `[4 ✗]` Stops on 3rd car (`🚂 ×3 left!`) | **`[4 ✓]`** |

---

## 4. Buggy Starter, Clue Reveal & Fixed Solution (`9` Flat Blocks)

### Pre-Loaded Buggy Starter (`MAIN: 9` flat blocks)
```text
While (itemColor == [Red])    // <-- BUG: exits as soon as first non-Red car arrives!
  If (itemColor == [Red])
    SWITCH_LEFT
  Else
    SWITCH_RIGHT
  End If
  SEND_NEXT
End While
```

### Clue Reveal (`partialHelp` — highlights top `While` condition socket)
```text
While (? ("sensor"))
  If (itemColor == [Red])
    SWITCH_LEFT
  Else
    SWITCH_RIGHT
  End If
  SEND_NEXT
End While
```

### Fixed Canonical Solution (`MAIN: 9` flat blocks — `Edit Delta: 1`)
```text
While (hasNextItem)
  If (itemColor == [Red])
    SWITCH_LEFT
  Else
    SWITCH_RIGHT
  End If
  SEND_NEXT
End While
```

---

## 5. Before / After Execution Trace (`Stream 2: [🔴, 🔵, 🔴, 🔵]`)

| Version | Iteration | Car at Scanner | `While` Condition Result | Result After Loop |
| :--- | :---: | :---: | :--- | :--- |
| **Buggy (`itemColor==Red`)** | `1` | `🔴` | `True` → `SWITCH_LEFT`, `SEND_NEXT` (`Dock 1: [🔴]`) | — |
| **Buggy (`itemColor==Red`)** | `2` | `🔵` | **`False`** → Exits `While` early! | `Dock 2: []`, **`🚂 ×3 left!` → `[2 ✗]`** |
| **Fixed (`hasNextItem`)** | `1..4` | `🔴, 🔵, 🔴, 🔵` | `True × 4` → routes all `4` cars → `False` on empty | `D1: [🔴,🔴]`, `D2: [🔵,🔵]` → **`[2 ✓]`** |
