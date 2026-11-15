# Lesson `tape.6` — Find the Green Beacon

- **Format:** 🧩 Puzzle (`Depot · Tape Read`)
- **Environment:** 🏗️ Cargo Depot (`ENV_VERSION_DEPOT_V4` — electronic Top-Dock `8`-cell `🛡️` immutable Tape, `targetHeadPos`)
- **One-Concept Goal:** Scan an `8`-cell immutable (`🛡️`) Tape sequentially with `While ($cellColor != green)` until `$headPos` stops directly on the first `Green` (`🟢`) beacon across **4 simultaneous variants** (no physical crate movement needed).

---

## Puzzle Contract & Capabilities

```json
{
  "id": "tape.6",
  "env": "depot",
  "envVersion": "ENV_VERSION_DEPOT_V4",
  "tape": { "length": 8, "readOnly": true, "immutableIcon": "🛡️" },
  "victoryCondition": "Status OK and runtime.tape.workerHeads.main === variant.targetHeadPos across all 4 simultaneous variants",
  "antiBypassRules": [
    "Green index varies across 1, 4, 6, and 8 — hardcoding TAPE_SEEK [N] fails at least 3 of 4 variants.",
    "Must handle index 1 (0 steps entered) and boundary index 8 (must NOT step into cell 9 COLLISION)."
  ],
  "slotCap": 6,
  "editDeltaBudget": 4
}
```

---

## 4 Simultaneous Variants (`🛡️` Immutable 8-Cell Tapes)

| Variant | Tape `1..8` | `targetHeadPos` | Edge Case Covered |
| :--- | :--- | :---: | :--- |
| **`V1_Index1_Edge`** | `["green", "red", "blue", "yellow", "purple", "cyan", "orange", "red"]` | **`1`** | `0` loop iterations — stops immediately at cell `1` |
| **`V2_Index4_Middle`** | `["red", "blue", "yellow", "green", "purple", "cyan", "orange", "red"]` | **`4`** | Standard middle linear scan (`3` right steps) |
| **`V3_Index6_Late`** | `["blue", "orange", "red", "purple", "cyan", "green", "yellow", "blue"]` | **`6`** | Late scan across `5` non-green colors |
| **`V4_Index8_Boundary`** | `["purple", "red", "cyan", "blue", "orange", "yellow", "red", "green"]` | **`8`** | Tail cell `#8` boundary (stepping once more crashes `#9`) |

---

## Starter Workspace (`1` flat block, `slotCap: 6`)

```text
// MAIN (1 flat block)
TAPE_SEEK [1]
```

```json
{
  "slotCap": 6,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 }
  ]
}
```

---

## Partial Help Scaffold (`2` flat blocks → `PAUSED_ON_PLACEHOLDER`)

```text
// MAIN (2 flat blocks)
TAPE_SEEK [1]
?
```

```json
{
  "slotCap": 6,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "PLACEHOLDER" }
  ]
}
```

---

## Reference Solution (`4` flat blocks, `slotCap: 6` — Verified `allPassed: true`)

```text
// MAIN (4 flat blocks)
TAPE_SEEK [1]
While ($cellColor != green)
  TAPE_STEP [RIGHT]
End While
```

```json
{
  "slotCap": 6,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    {
      "op": "WHILE",
      "cond": { "op": "CMP", "operator": "!=", "left": "$cellColor", "right": "green" },
      "body": [{ "op": "TAPE_STEP", "direction": "RIGHT" }]
    }
  ]
}
```

- **Verifier (`npm run curriculum:verify`):** `blockCounts: { "MAIN": 4 }` (`total: 4`), `slotCapOk: true`, `partialHelpStatus: "PAUSED_ON_PLACEHOLDER"`, `allPassed: true` (`steps: 2 / 8 / 12 / 16` across V1..V4).

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Guaranteed Present First (`tape.6`) Before Missing-Element Search (`tape.7`/`9`):** Because every variant contains a `Green` beacon (`1..8`), `While ($cellColor != green)` halts safely without needing a compound `$headPos < $tapeLength` check yet—letting learners master Depot's `🛡️` electronic `TapeDock` and `targetHeadPos` stopping cleanly before `tape.7` tests full-length boundary counting.

</details>
