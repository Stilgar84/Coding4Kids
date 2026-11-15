# Capstone `tape.A` — The Color Histogram

- **Format:** 🏆 Capstone Puzzle (`Depot · Manifest-Driven Sorting`)
- **Environment:** 🏗️ Cargo Depot (`8` uniform neutral grey-white blocks in `INPUT`, color-coded bin bases `[1 🔴][2 🔵][3 🟢]` on Stacks `1..3`, electronic `8`-cell `🛡️` Tape)
- **One-Concept Goal:** Read an `8`-cell color manifest on the Tape (containing `Red`, `Blue`, `Green`, and optional `Black` skip markers) and stack matching counts of neutral blocks onto Stacks `1..3` within a **`12`-block edit delta** (`18` total flat blocks).

---

## Guided Co-Pilot Card

The crane's **Input** dispenser holds neutral grey blocks—you can't tell their stack just by looking at the crate! Read each color in the **Tape Dock** (`🔴 → 1`, `🔵 → 2`, `🟢 → 3`, `⚫ → skip`) inside `F1` to build a live color bar chart!

---

## Capstone Contract & Anti-Bypass Rules

```json
{
  "id": "tape.A",
  "env": "depot",
  "tape": { "length": 8, "readOnly": true, "immutableIcon": "🛡️" },
  "input": { "count": 8, "item": { "type": "block", "color": "grey" } },
  "stacksUI": ["[1 🔴]", "[2 🔵]", "[3 🟢]"],
  "antiBypassRules": [
    "INPUT holds uniform neutral grey blocks — sorting by $heldColor without reading the Tape fails.",
    "V2 has 0 Blue crates; V3 has Black blank markers that MUST be skipped without grabbing from INPUT.",
    "Scaffolded MAIN (6 flat blocks) gives learners a clean <= 12 block edit delta in F1 (total 18 <= slotCap 20)."
  ],
  "slotCap": 20,
  "maxPerTab": 14
}
```

---

## 4 Simultaneous Variants (Balanced, `0`-Blue, `Black`-Skip, Green-Dominant)

| Variant | Tape `1..8` | Target Stack Heights `[S1 🔴, S2 🔵, S3 🟢]` | Verified Steps |
| :--- | :--- | :---: | :---: |
| **`V1_Balanced_Mix`** | `["red", "blue", "green", "red", "blue", "red", "green", "blue"]` | `[3, 3, 2]` | `74` |
| **`V2_Zero_Blues`** | `["green", "red", "green", "green", "red", "green", "red", "red"]` | `[4, 0, 4]` | `74` |
| **`V3_With_Black_Skips`** | `["red", "black", "blue", "green", "black", "red", "blue", "green"]` | `[2, 2, 2]` | `64` |
| **`V4_Green_Dominant`** | `["green", "green", "blue", "green", "red", "green", "green", "blue"]` | `[1, 2, 5]` | `74` |

---

## Starter Workspace (`MAIN` Pre-Scaffolded `6` flat blocks; `12` edit delta in `F1`)

```text
// MAIN (6 flat blocks — pre-scaffolded)
i = 1
Loop [$tapeLength]
  TAPE_SEEK [i]
  Call F1
  i = i + 1
End Loop
```

```json
{
  "slotCap": 20,
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "i", "left": "i", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": []
}
```

---

## Partial Help Scaffold (`MAIN` `6` + `F1` `5` = `11` flat blocks → `PAUSED_ON_PLACEHOLDER`)

```text
// MAIN (6 flat blocks)
i = 1
Loop [$tapeLength]
  TAPE_SEEK [i]
  Call F1
  i = i + 1
End Loop

// F1 (5 flat blocks)
If ($cellColor != black)
  DEPOT_MOVE_TO [INPUT]
  DEPOT_GRAB [INPUT]
  ?
End If
```

```json
{
  "slotCap": 20,
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "i", "left": "i", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "!=", "left": "$cellColor", "right": "black" },
      "then": [
        { "op": "DEPOT_MOVE_TO", "station": "INPUT" },
        { "op": "DEPOT_GRAB", "station": "INPUT" },
        { "op": "PLACEHOLDER" }
      ]
    }
  ]
}
```

---

## Reference Solution (`MAIN` `6` + `F1` `12` = `18` flat blocks, `slotCap: 20` — Verified `allPassed: true`)

```text
// MAIN (6 flat blocks)
i = 1
Loop [$tapeLength]
  TAPE_SEEK [i]
  Call F1
  i = i + 1
End Loop

// F1 (12 flat blocks)
If ($cellColor != black)
  DEPOT_MOVE_TO [INPUT]
  DEPOT_GRAB [INPUT]
  If ($cellColor == red)
    DEPOT_MOVE_TO [1]
  Else If ($cellColor == blue)
    DEPOT_MOVE_TO [2]
  Else
    DEPOT_MOVE_TO [3]
  End If
  DEPOT_PLACE
End If
```

```json
{
  "slotCap": 20,
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "CALL_FN", "fn": "F1" },
        { "op": "VAR_OP", "target": "i", "left": "i", "operator": "+", "right": 1 }
      ]
    }
  ],
  "F1": [
    {
      "op": "IF",
      "cond": { "op": "CMP", "operator": "!=", "left": "$cellColor", "right": "black" },
      "then": [
        { "op": "DEPOT_MOVE_TO", "station": "INPUT" },
        { "op": "DEPOT_GRAB", "station": "INPUT" },
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
          "then": [{ "op": "DEPOT_MOVE_TO", "station": 1 }],
          "elseIfs": [
            {
              "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "blue" },
              "body": [{ "op": "DEPOT_MOVE_TO", "station": 2 }]
            }
          ],
          "else": [{ "op": "DEPOT_MOVE_TO", "station": 3 }]
        },
        { "op": "DEPOT_PLACE" }
      ]
    }
  ]
}
```

- **Verifier (`npm run curriculum:verify`):** `blockCounts: { "MAIN": 6, "F1": 12 }` (`total: 18`), `slotCapOk: true`, `partialHelpStatus: "PAUSED_ON_PLACEHOLDER"`, `allPassed: true` (`steps: 74 / 74 / 64 / 74`).

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Neutral Blocks + Bin Bases:** Making physical `INPUT` crates neutral grey-white (`{ color: "grey" }`) prevents bypassing the Tape with `$heldColor`, turning `Stacks 1..3` (`[1 🔴][2 🔵][3 🟢]`) into a genuine electronic-to-physical histogram!
- **Index-Loop Alternative (`sort` Preview):** Scaffolding `i = 1..$tapeLength` with `TAPE_SEEK [i]` inside `MAIN` keeps the learner's edit delta at exactly `12` flat blocks (`<= 12` capstone guideline) while reinforcing indexed `TAPE_SEEK [var]` ahead of `sort.0`.

</details>
