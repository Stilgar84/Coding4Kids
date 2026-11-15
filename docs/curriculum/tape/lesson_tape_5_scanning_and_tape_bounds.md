# Lesson `tape.5` — Scanning & Tape Bounds

- **Format:** 📖 Explanation (3 Runnable Demo Tabs)
- **Environment:** 🏗️ Cargo Depot (`Electronic Top-Dock TapeDock: finite length 8, 🛡️ Crystal Shield immutable cells`)
- **One-Concept Goal:** Safely search and sweep finite `8`-cell immutable (`🛡️`) Tape arrays in Depot—avoiding `COLLISION` past cell `8` *and* the off-by-one bug that skips cell `8`.

---

## Guided Co-Pilot Card

Depot shows a finite **8-cell electronic Memory Tape** (`🛡️` shielded read-only) at the **top** of the screen—never grab Tape cells with the crane! Watch Tab 2 stop safely at `#8`, and watch Tab 3 visit **every** cell `#1..#8` without crashing on `#9`.

---

## Electronic `TapeDock` & Safe Fencepost Rules

```json
{
  "env": "depot",
  "mode": "explanation_3_tabs",
  "uiContract": {
    "tapeDockLocation": "Top Dock (shrink-0, strictly separate from Depot canvas — NO floor peg sockets)",
    "readOnlyIcon": "🛡️ Crystal Shield",
    "physicalVsElectronic": "DEPOT_GRAB / DEPOT_PLACE operate only on INPUT/QUEUE/STACK_1..3 — never on electronic Tape cells"
  },
  "tape": { "length": 8, "readOnly": true },
  "sensors": ["$headPos", "$tapeLength", "$cellColor"],
  "actions": ["TAPE_SEEK", "TAPE_STEP", "VAR_ASSIGN", "VAR_OP"]
}
```

---

## Tab 1 — Direct Random Access (`TAPE_SEEK [3]`)

**Tape (`🛡️` `1..8`):** `["red", "blue", "green", "yellow", "purple", "cyan", "orange", "red"]`

- Jumps straight to cell `#3` without walking cells `#1..#2` and reads `a = $cellColor` (`Green`).

```text
// MAIN (2 flat blocks)
TAPE_SEEK [3]
a = $cellColor
```

```json
{
  "slotCap": 2,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 3 },
    { "op": "VAR_ASSIGN", "var": "a", "value": "$cellColor" }
  ]
}
```

---

## Tab 2 — Bounded Search Until Found (`$headPos < $tapeLength AND $cellColor != green`)

**Tape (`🛡️` `1..8`, NO Green):** `["red", "blue", "yellow", "purple", "cyan", "orange", "red", "blue"]`

- Left-to-right short-circuiting on `AND`: when `$headPos` reaches `8`, `$headPos < $tapeLength` (`8 < 8`) evaluates `false` first and halts cleanly **without** stepping onto invalid cell `#9` (`COLLISION`).

```text
// MAIN (4 flat blocks)
TAPE_SEEK [1]
While ($headPos < $tapeLength AND $cellColor != green)
  TAPE_STEP [RIGHT]
End While
```

```json
{
  "slotCap": 4,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": {
        "op": "AND",
        "left": { "op": "CMP", "operator": "<", "left": "$headPos", "right": "$tapeLength" },
        "right": { "op": "CMP", "operator": "!=", "left": "$cellColor", "right": "green" }
      },
      "body": [{ "op": "TAPE_STEP", "direction": "RIGHT" }]
    }
  ]
}
```

---

## Tab 3 — Safe Full-Element Scan (`Loop [$tapeLength]` + Guarded Step)

**Tape (`🛡️` `1..8`, Red at `#1`, `#3`, and boundary `#8`):** `["red", "blue", "red", "yellow", "purple", "cyan", "orange", "red"]`

- **Why `While ($headPos < $tapeLength)` alone fails full scans:** The head stops at `#8` *before* checking cell `#8`, missing the tail Red (`c = 2` instead of `3`)!
- **Two clean full-scan solutions:**
  1. `Loop [$tapeLength]` processes the current cell first, then guards `If ($headPos < $tapeLength) { TAPE_STEP [RIGHT] }` (`10` flat blocks below -> `c = 3`!).
  2. Counter loop `i = 1`, `Loop [$tapeLength]` with `TAPE_SEEK [i]` + `i = i + 1` (drilled in `tape.7a` / `tape.A`).

```text
// MAIN (10 flat blocks)
TAPE_SEEK [1]
c = 0
Loop [$tapeLength]
  If ($cellColor == red)
    c = c + 1
  End If
  If ($headPos < $tapeLength)
    TAPE_STEP [RIGHT]
  End If
End Loop
```

```json
{
  "slotCap": 10,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
          "then": [{ "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 }]
        },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "<", "left": "$headPos", "right": "$tapeLength" },
          "then": [{ "op": "TAPE_STEP", "direction": "RIGHT" }]
        }
      ]
    }
  ]
}
```

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Electronic vs. Physical Clarity:** Depot puzzles strictly separate **conserved physical crates/rings** on the floor (`INPUT` / `QUEUE` / `STACK_1..3` / `OUTPUT`) from the **electronic `TapeDock`** at the top (`TAPE_SEEK`, `TAPE_STEP`, `TAPE_WRITE`, `🛡️` immutable cells in read-only puzzles).
- **Predicate Safety:** `$cellColor == [Swatch]` / `!= [Swatch]` comparisons evaluate safely as boolean predicates on any cell type (`number` or `∅`), whereas typed extraction (`a = $cellColor`) requires a real color cell. Keeping all 8 cells populated in `tape.5`–`tape.7` eases learners into bounds safety before `tape.7a` introduces `∅`.

</details>
