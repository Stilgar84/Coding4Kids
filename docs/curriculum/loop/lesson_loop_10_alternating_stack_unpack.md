# `loop.10` — Alternating Stack Unpack

> **Format**: Practice (`🏗️`) · **Module**: [`loop`](./overview.md) · **Environment**: [Depot](../../envs/depot.md) (`envVersion: 4`, Toy-Crane Workshop `v4`) · **Legacy ID**: `3.10` *(Updated with `targetOutput` ghost sequence & sky-chute `OUT`)*

## One-Concept Goal

Alternate grabbing the top glossy color ring from **`Stack 1`** and **`Stack 2`** inside a `Loop Start [×3]` / `Loop End` (`8` flat blocks) and launch each ring cleanly into the **`OUT` sky-chute** using `DEPOT_SEND_OUT`.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Look at the dashed target pattern in the **`OUT` sky-chute tray**: **`Red, Yellow, Green, Yellow, Blue, Yellow`**! Inside **`Loop Start [×3]`**, `Move to 1` → `Grab` → `Send Out`, then `Move to 2` → `Grab` → `Send Out` interleaves one colored ring from `Stack 1` with one `Yellow` ring from `Stack 2` on every round—turning an `18`-block unpack into `8` compact blocks! *(Notice `Send Out` launches straight to `OUT` without moving away from the stack!)*

</details>

## UI & Playground Contract

- **Zero Reading**: Stations use icon + peg numbers (`1`, `2`, `3`) plus the top `OUT` sky-chute.
- **Station Mask (`activeStationsMask`)**: `["STACK_1", "STACK_2", "STACK_3", "OUT"]` (`INPUT`, `QUEUE`, and `TapeDock` hidden).
- **Target Ghost Output**: Dashed preview beads along the `OUT` conveyor tray showing `["RED", "YELLOW", "GREEN", "YELLOW", "BLUE", "YELLOW"]`.
- **Slot Cap**: `slotCap.maxTotal = 8` (exact flat closer-inclusive match: `Loop Start`/`End` `2` + `6` body blocks; prevents `18`-block unrolled bypass!). **Edit-Delta**: `8`.

## Palette & Capabilities

```json
{
  "allowedSimBlocks": ["DEPOT_MOVE_TO", "DEPOT_GRAB", "DEPOT_PLACE", "DEPOT_SEND_OUT"],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": false,
  "allowActionParams": true,
  "allowedBlockParams": ["station"],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 8 },
  "antiBypassRules": [
    {
      "id": "single-depth-loop-only",
      "description": "Single-depth loop only",
      "maxLoopNestingDepth": 0
    }
  ]
}
```

## Depot `v4` Setup (`STACK_1..3 + OUT`)

```json
{
  "envVersion": 4,
  "activeStationsMask": ["STACK_1", "STACK_2", "STACK_3", "OUT"],
  "enforceHanoiRule": false,
  "workerStation": "STACK_1",
  "clawItem": null,
  "stacks": [
    ["BLUE", "GREEN", "RED"],
    ["YELLOW", "YELLOW", "YELLOW"],
    []
  ],
  "targetStacks": [[], [], []],
  "inputQueue": [],
  "targetOutput": ["RED", "YELLOW", "GREEN", "YELLOW", "BLUE", "YELLOW"]
}
```

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`)

```json
{ "MAIN": [] }
```

### Partial Help (`partialHelp`, `mode: "scaffold"`)

```json
{
  "mode": "scaffold",
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
        { "op": "DEPOT_GRAB" },
        { "op": "PLACEHOLDER", "hintCategory": "item" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "PLACEHOLDER", "hintCategory": "item" },
        { "op": "DEPOT_SEND_OUT" }
      ]
    }
  ]
}
```

### Canonical Solution (`referenceSolution` — `8` flat closer-inclusive blocks)

```json
{
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
        { "op": "DEPOT_GRAB" },
        { "op": "DEPOT_SEND_OUT" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "DEPOT_GRAB" },
        { "op": "DEPOT_SEND_OUT" }
      ]
    }
  ]
}
```

### Step-by-Step Trace

| Loop Iter | `STACK_1` Pop | `STACK_2` Pop | `outputQueue` Accumulated | Crane After Iter |
| :---: | :---: | :---: | :--- | :---: |
| `1/3` | `"RED"` | `"YELLOW"` | `["RED", "YELLOW"]` | `STACK_2` |
| `2/3` | `"GREEN"` | `"YELLOW"` | `["RED", "YELLOW", "GREEN", "YELLOW"]` | `STACK_2` |
| `3/3` | `"BLUE"` | `"YELLOW"` | `["RED", "YELLOW", "GREEN", "YELLOW", "BLUE", "YELLOW"]` ✅ | `STACK_2` |
