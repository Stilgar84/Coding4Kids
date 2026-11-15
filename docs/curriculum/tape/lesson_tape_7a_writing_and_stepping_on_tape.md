# Lesson `tape.7a` — Writing, Erasing & Stepping on Tape

- **Format:** 📖 Explanation (3 Runnable Depot Demo Tabs)
- **Environment:** 🏗️ Cargo Depot (`Writable 8-cell Electronic TapeDock`, `TAPE_WRITE`, `TAPE_STEP [LEFT]`, `$cellEmpty`, `$cellValue`)
- **One-Concept Goal:** Write and erase Tape cells (`TAPE_WRITE`, `TAPE_WRITE [CLEAR]`), detect empty `∅` sentinel cells (`$cellEmpty`), step backward safely (`TAPE_STEP [LEFT]`), and use numeric `$cellValue` + dynamic `TAPE_SEEK [i]` in Depot.

---

## Guided Co-Pilot Card

The crane can **scan and copy** crate colors (`TAPE_WRITE`) onto empty `∅` Tape cells (`$cellEmpty`)—and step **left (`◀`)** back down the Tape! Tap **Play** on all 3 tabs to see writing, `CLEAR`, backward stepping, and number-indexed Depot stations.

---

## Capabilities & Cross-Module Readiness

```json
{
  "env": "depot",
  "mode": "explanation_3_tabs",
  "tape": { "length": 8, "readOnly": false },
  "sensors": ["$heldColor", "$cellEmpty", "$cellValue", "$headPos", "$tapeLength"],
  "actions": ["TAPE_SEEK", "TAPE_STEP", "TAPE_WRITE", "DEPOT_MOVE_TO", "DEPOT_GRAB", "DEPOT_PLACE", "DEPOT_SEND_OUT", "VAR_ASSIGN", "VAR_OP"]
}
```

---

## Tab 1 — `TAPE_WRITE`, `CLEAR` (`∅`), and Digital Copy-Beam VFX

**Initial State:** `INPUT = [🔴, 🔵, 🟡]` · `Tape = 8 empty ∅ cells`

- **Physical Conservation vs. Memory Copy:** `TAPE_WRITE [$heldColor]` fires a digital copy-beam from the claw to the top `TapeDock` while the physical crate remains in the claw to ship via `DEPOT_SEND_OUT`. Then `TAPE_SEEK [2]` + `TAPE_WRITE [CLEAR]` erases cell `#2` back to `∅` (`$cellEmpty == 1`).

```text
// MAIN (10 flat blocks)
TAPE_SEEK [1]
DEPOT_MOVE_TO [INPUT]
Loop [3]
  DEPOT_GRAB [INPUT]
  TAPE_WRITE [$heldColor]
  DEPOT_SEND_OUT
  TAPE_STEP [RIGHT]
End Loop
TAPE_SEEK [2]
TAPE_WRITE [CLEAR]
```

```json
{
  "slotCap": 10,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "DEPOT_MOVE_TO", "station": "INPUT" },
    {
      "op": "LOOP",
      "count": 3,
      "body": [
        { "op": "DEPOT_GRAB", "station": "INPUT" },
        { "op": "TAPE_WRITE", "value": "$heldColor" },
        { "op": "DEPOT_SEND_OUT" },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    },
    { "op": "TAPE_SEEK", "index": 2 },
    { "op": "TAPE_WRITE", "value": "CLEAR" }
  ]
}
```

---

## Tab 2 — `$cellEmpty` Sentinel Stop & Safe `TAPE_STEP [LEFT]`

**Initial Tape:** `["red", "green", "blue", "yellow", "purple"]` (`cells 6..8 = ∅`)

- Walks right until `$cellEmpty` turns `true` at `#6` (`NOT $cellEmpty` stops cleanly), steps one left onto `#5` (`TAPE_STEP [LEFT]`), then walks back down to `#1` guarded by `While ($headPos > 1)` (zero `#0` `COLLISION`!).

```text
// MAIN (8 flat blocks)
TAPE_SEEK [1]
While (NOT $cellEmpty AND $headPos < $tapeLength)
  TAPE_STEP [RIGHT]
End While
TAPE_STEP [LEFT]
While ($headPos > 1)
  TAPE_STEP [LEFT]
End While
```

```json
{
  "slotCap": 8,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": {
        "op": "AND",
        "left": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "$cellEmpty" } },
        "right": { "op": "CMP", "operator": "<", "left": "$headPos", "right": "$tapeLength" }
      },
      "body": [{ "op": "TAPE_STEP", "direction": "RIGHT" }]
    },
    { "op": "TAPE_STEP", "direction": "LEFT" },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": ">", "left": "$headPos", "right": 1 },
      "body": [{ "op": "TAPE_STEP", "direction": "LEFT" }]
    }
  ]
}
```

---

## Tab 3 — Depot Numeric `$cellValue` & Dynamic `TAPE_SEEK [i]`

**Initial State:** `Tape = [2, 1, 3, 2, 1]` (`6..8 = ∅`) · `INPUT = [1, 2, 3, 4, 5]` neutral numbered crates

- Bridges `tape` into `sort` and `args`: uses a counter index `TAPE_SEEK [i]`, extracts numeric `n = $cellValue` inside Depot, and steers `DEPOT_MOVE_TO [n]` dynamically to Stacks `1..3`!

```text
// MAIN (10 flat blocks)
i = 1
Loop [5]
  TAPE_SEEK [i]
  n = $cellValue
  DEPOT_MOVE_TO [INPUT]
  DEPOT_GRAB [INPUT]
  DEPOT_MOVE_TO [n]
  DEPOT_PLACE
  i = i + 1
End Loop
```

```json
{
  "slotCap": 10,
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP",
      "count": 5,
      "body": [
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "VAR_ASSIGN", "var": "n", "value": "$cellValue" },
        { "op": "DEPOT_MOVE_TO", "station": "INPUT" },
        { "op": "DEPOT_GRAB", "station": "INPUT" },
        { "op": "DEPOT_MOVE_TO", "station": "n" },
        { "op": "DEPOT_PLACE" },
        { "op": "VAR_OP", "target": "i", "left": "i", "operator": "+", "right": 1 }
      ]
    }
  ]
}
```

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **4 Cross-Module Foundations in One Explanation:** Putting `tape.7a` directly before `tape.8` removes the steep jump into writing Memory Tape during a Queue puzzle while introducing `$cellEmpty`, `TAPE_STEP [LEFT]`, `TAPE_WRITE [CLEAR]`, and dynamic Depot `TAPE_SEEK [i]` / `$cellValue` required by `sort` and `args`.

</details>
