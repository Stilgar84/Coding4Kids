# Lesson `tape.7` — Count the Reds

- **Format:** 🧩 Puzzle (`Depot · Counting & Exact Output`)
- **Environment:** 🏗️ Cargo Depot (`8`-cell `🛡️` immutable Tape + `8` neutral grey crates in `INPUT`)
- **One-Concept Goal:** Visit every cell `1..8` on an immutable (`🛡️`) Tape without crashing past `#8` or skipping `#8`, count matching `Red` (`🔴`) cells into `c`, and ship `c` neutral crates (`Loop [c]`, safe `0`-iteration no-op).

---

## Puzzle Contract & Capabilities

```json
{
  "id": "tape.7",
  "env": "depot",
  "tape": { "length": 8, "readOnly": true, "immutableIcon": "🛡️" },
  "input": { "count": 8, "item": { "type": "crate", "color": "grey" } },
  "victoryCondition": {
    "exactOutputCount": "redCount",
    "allowNonEmptyInput": true,
    "targetOutputMatchesExactCount": true
  },
  "antiBypassRules": [
    "Red count spans 0, 1 (strictly at boundary cell #8), 3, and 5 across 4 variants — hardcoding Loop [K] fails.",
    "Using While ($headPos < $tapeLength) skips cell #8 (fails V2 with 0 instead of 1 and V3/V4 off-by-one).",
    "Calling TAPE_STEP [RIGHT] unconditionally inside Loop [$tapeLength] triggers cell #9 COLLISION."
  ],
  "slotCap": 18,
  "maxPerTab": 10
}
```

---

## 4 Simultaneous Variants (`V1` `0` Reds `Loop [0]` & `V2` Boundary Cell `#8`)

| Variant | Tape `1..8` | `Red` Indices | `exactOutputCount` (`c`) | Trap Caught |
| :--- | :--- | :---: | :---: | :--- |
| **`V1_Zero_Reds_Loop0`** | `["blue", "green", "yellow", "blue", "purple", "cyan", "green", "orange"]` | None | **`0`** (`[]`) | Verifies `Loop [0]` is a safe 0-iteration no-op (`steps: 36`) |
| **`V2_One_Red_At_Cell8_Boundary`** | `["blue", "green", "cyan", "yellow", "purple", "blue", "orange", "red"]` | `#8` | **`1`** | Catches off-by-one `While ($headPos < $tapeLength)` skip bug (`steps: 39`) |
| **`V3_Three_Reds_With_Ends`** | `["red", "blue", "purple", "red", "cyan", "green", "yellow", "red"]` | `#1, #4, #8` | **`3`** | Tests start + middle + end `#8` counting (`steps: 45`) |
| **`V4_Five_Reds_Dense`** | `["red", "red", "blue", "red", "green", "red", "purple", "red"]` | `#1, #2, #4, #6, #8` | **`5`** | Verifies dense alternating counts & provisioning (`steps: 51`) |

---

## Starter Workspace (`3` flat blocks, `slotCap: 18`)

```text
// MAIN (3 flat blocks)
TAPE_SEEK [1]
c = 0
DEPOT_MOVE_TO [INPUT]
```

```json
{
  "slotCap": 18,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    { "op": "DEPOT_MOVE_TO", "station": "INPUT" }
  ]
}
```

---

## Partial Help Scaffold (`MAIN` `6` + `F1` `4` = `10` flat blocks → `PAUSED_ON_PLACEHOLDER`)

```text
// MAIN (6 flat blocks)
TAPE_SEEK [1]
c = 0
Loop [$tapeLength]
  Call F1
End Loop
?

// F1 (4 flat blocks)
If ($cellColor == red)
  c = c + 1
End If
?
```

```json
{
  "slotCap": 18,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [{ "op": "CALL_FN", "fn": "F1" }]
    },
    { "op": "PLACEHOLDER" }
  ],
  "F1": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
      "then": [{ "op": "VAR_OP", "target": "c", "left": "c", "operator": "+", "right": 1 }]
    },
    { "op": "PLACEHOLDER" }
  ]
}
```

---

## Reference Solution (`MAIN` `10` + `F1` `6` = `16` flat blocks, `slotCap: 18` — Verified `allPassed: true`)

```text
// MAIN (10 flat blocks)
TAPE_SEEK [1]
c = 0
Loop [$tapeLength]
  Call F1
End Loop
DEPOT_MOVE_TO [INPUT]
Loop [c]
  DEPOT_GRAB [INPUT]
  DEPOT_SEND_OUT
End Loop

// F1 (6 flat blocks)
If ($cellColor == red)
  c = c + 1
End If
If ($headPos < $tapeLength)
  TAPE_STEP [RIGHT]
End If
```

```json
{
  "slotCap": 18,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "VAR_ASSIGN", "var": "c", "value": 0 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [{ "op": "CALL_FN", "fn": "F1" }]
    },
    { "op": "DEPOT_MOVE_TO", "station": "INPUT" },
    {
      "op": "LOOP",
      "count": "c",
      "body": [
        { "op": "DEPOT_GRAB", "station": "INPUT" },
        { "op": "DEPOT_SEND_OUT" }
      ]
    }
  ],
  "F1": [
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
```

- **Verifier (`npm run curriculum:verify`):** `blockCounts: { "MAIN": 10, "F1": 6 }` (`total: 16`), `slotCapOk: true`, `partialHelpStatus: "PAUSED_ON_PLACEHOLDER"`, `allPassed: true` (`steps: 36 / 39 / 45 / 51`).

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Drilling Both Boundary Laws:** Variant 1 (`0` Reds) proves `Loop [0]` safely does nothing without crashing on empty `OUTPUT`; Variant 2 (only cell `#8` is `Red`) proves why checking the cell *before* stepping—and guarding `TAPE_STEP [RIGHT]` with `If ($headPos < $tapeLength)`—beats `While ($headPos < $tapeLength)`.
- **Uniform Neutral Crates:** Keeping `INPUT` stocked with `8` neutral grey crates (`allowNonEmptyInput: true`, `exactOutputCount: c`) mirrors real inventory provisioning cleanly.

</details>
