# Lesson `tape.8` — Record Queue to Tape

- **Format:** 🧩 Puzzle (`Depot · Dynamic Tape Recording`)
- **Environment:** 🏗️ Cargo Depot (Variable-length FIFO `QUEUE` `4..7` crates → blank writable `8`-cell `∅` Tape)
- **One-Concept Goal:** Drain a variable-length FIFO `QUEUE` until `stationEmpty [QUEUE]`, firing `TAPE_WRITE [$heldColor]` to log every color onto Tape cells `1..N` while shipping every physical crate to `OUTPUT`.

---

## Puzzle Contract & Capabilities

```json
{
  "id": "tape.8",
  "env": "depot",
  "tape": { "length": 8, "readOnly": false, "initial": "all empty ∅" },
  "vfx": "Digital copy-beam from claw -> electronic TapeDock; physical crate conserved & delivered via DEPOT_SEND_OUT",
  "victoryCondition": "targetTapeCells matches queue color stream AND targetOutput preserves FIFO queue order",
  "antiBypassRules": [
    "Queue length varies across 4, 5, 6, and 7 items — hardcoding Loop [6] strands item #7 on V4 or crashes grabbing empty QUEUE on V1/V2.",
    "Max 7 items leave trailing cell #8 empty ∅, so post-write TAPE_STEP [RIGHT] on item #7 stops safely on cell #8."
  ],
  "slotCap": 10
}
```

---

## 4 Simultaneous Variants (`Queue` Lengths `4, 5, 6, 7`)

| Variant | FIFO `QUEUE` Stream | `targetTapeCells` & `targetOutput` Count |
| :--- | :--- | :---: |
| **`V1_Queue4`** | `[red, blue, green, yellow]` | `4` cells (`1:#ef4444 .. 4:#f59e0b`), stops head at `#5` |
| **`V2_Queue5`** | `[purple, cyan, red, orange, blue]` | `5` cells (`1:#8b5cf6 .. 5:#3b82f6`), stops head at `#6` |
| **`V3_Queue6`** | `[green, red, blue, yellow, purple, cyan]` | `6` cells (`1:#10b981 .. 6:#06b6d4`), stops head at `#7` |
| **`V4_Queue7_Safe_End`** | `[red, orange, yellow, green, cyan, blue, purple]` | `7` cells (`1:#ef4444 .. 7:#8b5cf6`), stops head safely at `#8` (`<= 8`) |

---

## Starter Workspace (`2` flat blocks, `slotCap: 10`)

```text
// MAIN (2 flat blocks)
TAPE_SEEK [1]
DEPOT_MOVE_TO [QUEUE]
```

```json
{
  "slotCap": 10,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "DEPOT_MOVE_TO", "station": "QUEUE" }
  ]
}
```

---

## Partial Help Scaffold (`7` flat blocks → `PAUSED_ON_PLACEHOLDER`)

```text
// MAIN (7 flat blocks)
TAPE_SEEK [1]
DEPOT_MOVE_TO [QUEUE]
While (NOT stationEmpty [QUEUE])
  DEPOT_GRAB [QUEUE]
  TAPE_WRITE [$heldColor]
  ?
End While
```

```json
{
  "slotCap": 10,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "DEPOT_MOVE_TO", "station": "QUEUE" },
    {
      "op": "WHILE",
      "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "stationEmpty", "station": "QUEUE" } },
      "body": [
        { "op": "DEPOT_GRAB", "station": "QUEUE" },
        { "op": "TAPE_WRITE", "value": "$heldColor" },
        { "op": "PLACEHOLDER" }
      ]
    }
  ]
}
```

---

## Reference Solution (`8` flat blocks, `slotCap: 10` — Verified `allPassed: true`)

```text
// MAIN (8 flat blocks)
TAPE_SEEK [1]
DEPOT_MOVE_TO [QUEUE]
While (NOT stationEmpty [QUEUE])
  DEPOT_GRAB [QUEUE]
  TAPE_WRITE [$heldColor]
  DEPOT_SEND_OUT
  TAPE_STEP [RIGHT]
End While
```

```json
{
  "slotCap": 10,
  "MAIN": [
    { "op": "TAPE_SEEK", "index": 1 },
    { "op": "DEPOT_MOVE_TO", "station": "QUEUE" },
    {
      "op": "WHILE",
      "cond": { "op": "NOT", "expr": { "op": "SENSOR", "sensor": "stationEmpty", "station": "QUEUE" } },
      "body": [
        { "op": "DEPOT_GRAB", "station": "QUEUE" },
        { "op": "TAPE_WRITE", "value": "$heldColor" },
        { "op": "DEPOT_SEND_OUT" },
        { "op": "TAPE_STEP", "direction": "RIGHT" }
      ]
    }
  ]
}
```

- **Verifier (`npm run curriculum:verify`):** `blockCounts: { "MAIN": 8 }` (`total: 8`), `slotCapOk: true`, `partialHelpStatus: "PAUSED_ON_PLACEHOLDER"`, `allPassed: true` (`steps: 23 / 28 / 33 / 38`).

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Direct Sensor Operand (`TAPE_WRITE [$heldColor]`):** `OP_TAPE_WRITE` supports reading `$heldColor` directly via `SENSOR_REF`, saving an extra intermediate variable while keeping `MAIN` cleanly at `8` flat blocks.
- **Zero-Boundary Surprise on 7-Item Max:** Keeping variable Queue streams between `4` and `7` items means every `TAPE_STEP [RIGHT]` lands cleanly inside `1..8`, focusing entirely on `While (NOT stationEmpty [QUEUE])` + `TAPE_WRITE` before `tape.9` drills the cell `9` fencepost fix.

</details>
