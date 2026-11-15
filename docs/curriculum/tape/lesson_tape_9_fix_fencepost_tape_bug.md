# Lesson `tape.9` — Fix the Fencepost Tape Bug (`Fix-It`)

- **Format:** 🔧 Fix-It Bug Hunt (`Robot Grid · Tape Patrol`)
- **Environment:** 🤖 Robot Grid (`6×5` walled maze, `Flags` / `goal`, `tileColor` beacons, `8`-cell `TapeDock`; NO `unvisitedAhead`)
- **One-Concept Goal:** Debug a pre-filled Robot Tape-patrol program in a **2-block edit delta (`10 → 12` flat blocks)** so it stops cleanly on sparse `∅` cells *and* avoids the cell `#9` `TAPE_STEP` fencepost `COLLISION` on full `8`-cell Tapes.

---

## Bug Hunt Brief & Contract

```json
{
  "id": "tape.9",
  "env": "grid",
  "tape": { "length": 8, "readOnly": true, "immutableIcon": "🛡️" },
  "robotRules": "Green = straight; Red (red floor beacon) = TURN_RIGHT; Blue (blue floor beacon) = TURN_LEFT; every step runs MOVE_FWD toward Goal Flag (G). NO unvisitedAhead used.",
  "starterBugSymptoms": {
    "V1_to_V3": "Loop [$tapeLength] keeps stepping after sparse ∅ end -> TYPE_ERROR: $cellColor on cell #6/#7/#8 (undefined)",
    "V4_Full8": "Reaches Goal at step 8, then executes unguarded TAPE_STEP [RIGHT] -> COLLISION: TAPE_STEP(RIGHT) out of bounds from 8"
  },
  "slotCap": 14,
  "editDelta": "Swap Loop [$tapeLength] -> While (NOT $cellEmpty AND NOT atGoal), and wrap TAPE_STEP [RIGHT] in If ($headPos < $tapeLength) ... End If (+2 blocks)"
}
```

---

## 4 Simultaneous Variants & Verified ASCII Maps (`curriculum:verify --ascii`)

| Variant | Tape `1..8` | Start Pose | Goal Flag (`G`) | Buggy Starter Outcome | Fixed Outcome |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **`V1_Sparse5_RightHook`** | `["green", "red", "green", "green", "green"]` (`6..8 = ∅`) | `(0, 4, N)` | `(4, 3)` | `TYPE_ERROR` (`cell #6 undefined`) | `SUCCESS` (`28` steps) |
| **`V2_Sparse6_Zigzag`** | `["green", "green", "red", "green", "blue", "green"]` (`7..8 = ∅`) | `(0, 4, N)` | `(2, 0)` | `TYPE_ERROR` (`cell #7 undefined`) | `SUCCESS` (`34` steps) |
| **`V3_Sparse7_TopCorridor`** | `["green", "green", "green", "red", "green", "green", "green"]` (`8 = ∅`) | `(0, 4, N)` | `(4, 1)` | `TYPE_ERROR` (`cell #8 undefined`) | `SUCCESS` (`38` steps) |
| **`V4_Full8_BoundaryTrap`** | `["green", "red", "green", "blue", "green", "red", "green", "green"]` | `(0, 4, N)` | `(5, 1)` | `COLLISION` (`TAPE_STEP out of bounds from 8`) | `SUCCESS` (`44` steps) |

### Verified `verify_puzzle_trace --ascii` Maps

```text
--- Variant V1_Sparse5_RightHook ---
+---+---+---+---+---+---+
| .   .   .   .   .   . |
+   +   +   +   +   +   +
| .   . | .   .   .   . |
+---+   +   +   +   +   +
| .   .   .   .   .   . |
+   +   +   +   +---+   +
| .   .   .   .   G | . |
+   +   +   +   +---+   +
|RN   .   .   .   .   . |
+---+---+---+---+---+---+

--- Variant V2_Sparse6_Zigzag ---
+---+---+---+---+---+---+
| .   . | G | .   .   . |
+---+   +   +   +   +   +
| .   .   .   .   .   . |
+   +   +   +   +   +   +
| .   .   . | .   .   . |
+   +   +   +   +   +   +
| .   .   .   .   .   . |
+   +   +   +   +   +   +
|RN   .   .   .   .   . |
+---+---+---+---+---+---+

--- Variant V3_Sparse7_TopCorridor ---
+---+---+---+---+---+---+
| .   .   .   .   .   . |
+   +   +   +   +---+   +
| .   .   .   .   G | . |
+   +   +   +   +---+   +
| . | .   .   .   .   . |
+   +   +   +   +   +   +
| .   .   .   .   .   . |
+   +   +   +   +   +   +
|RN   .   .   .   .   . |
+---+---+---+---+---+---+

--- Variant V4_Full8_BoundaryTrap ---
+---+---+---+---+---+---+
| .   .   .   .   .   . |
+   +   +   +   +   +   +
| . | .   .   .   .   G |
+   +---+   +   +   +   +
| .   .   . | .   .   . |
+   +   +   +---+   +   +
| .   .   .   .   .   . |
+   +   +   +   +   +   +
|RN   .   .   .   .   . |
+---+---+---+---+---+---+
```

---

## Buggy Starter Workspace (`10` flat blocks — Fails All 4 Variants)

```text
// MAIN (10 flat blocks)
TAPE_SEEK [1]
Loop [$tapeLength]
  If ($cellColor == red)
    TURN_RIGHT
  Else If ($cellColor == blue)
    TURN_LEFT
  End If
  MOVE_FWD
  TAPE_STEP [RIGHT]
End Loop
```

```json
{
  "slotCap": 14,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "LOOP",
      "count": "$tapeLength",
      "body": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
          "then": [{ "op": "TURN_RIGHT" }],
          "elseIfs": [
            {
              "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "blue" },
              "body": [{ "op": "TURN_LEFT" }]
            }
          ]
        },
        { "op": "MOVE_FWD" },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ]
}
```

---

## Partial Help Scaffold (`5` flat blocks → `PAUSED_ON_PLACEHOLDER`)

```text
// MAIN (5 flat blocks)
TAPE_SEEK [1]
While (NOT $cellEmpty AND NOT atGoal)
  MOVE_FWD
  ?
End While
```

```json
{
  "slotCap": 14,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": {
        "op": "AND",
        "left": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "$cellEmpty" } },
        "right": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } }
      },
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "PLACEHOLDER" }
      ]
    }
  ]
}
```

---

## Fixed Reference Solution (`12` flat blocks, `slotCap: 14` — Verified `allPassed: true`)

```text
// MAIN (12 flat blocks)
TAPE_SEEK [1]
While (NOT $cellEmpty AND NOT atGoal)
  If ($cellColor == red)
    TURN_RIGHT
  Else If ($cellColor == blue)
    TURN_LEFT
  End If
  MOVE_FWD
  If ($headPos < $tapeLength)
    TAPE_STEP [RIGHT]
  End If
End While
```

```json
{
  "slotCap": 14,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": {
        "op": "AND",
        "left": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "$cellEmpty" } },
        "right": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "atGoal" } }
      },
      "body": [
        {
          "op": "IF",
          "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "red" },
          "then": [{ "op": "TURN_RIGHT" }],
          "elseIfs": [
            {
              "cond": { "op": "CMP", "operator": "==", "left": "$cellColor", "right": "blue" },
              "body": [{ "op": "TURN_LEFT" }]
            }
          ]
        },
        { "op": "MOVE_FWD" },
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

- **Verifier (`npm run curriculum:verify`):** Buggy starter (`10` flat blocks) fails ALL `4` variants (`TYPE_ERROR` on `V1..V3`, `COLLISION` on `V4`); Fixed Reference (`12` flat blocks, `slotCapOk: true`, `partialHelpStatus: "PAUSED_ON_PLACEHOLDER"`) passes **`allPassed: true`** (`28 / 34 / 38 / 44` steps).

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Both Guards Matter:** On sparse paths (`5..7` instructions), replacing `Loop [$tapeLength]` with `While (NOT $cellEmpty AND NOT atGoal)` prevents reading blank `∅` cells (`TYPE_ERROR`). On a full `8`-cell path (`V4`), the robot reaches `G` on step `8`, so `If ($headPos < $tapeLength)` around `TAPE_STEP [RIGHT]` is still required to prevent an immediate cell `#9` `COLLISION` before the loop re-checks `NOT atGoal`!

</details>
