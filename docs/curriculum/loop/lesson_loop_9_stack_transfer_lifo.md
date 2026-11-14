# `loop.9` — Stack Transfer (LIFO Discovery)

> **Format**: Practice (`🏗️`) · **Module**: [`loop`](./overview.md) · **Environment**: [Depot](../../envs/depot.md) (`envVersion: 4`, Toy-Crane Workshop `v4`) · **Legacy ID**: `3.9` *(Updated to Uniform Glossy Color Rings `v4` spec with ghost target stack)*

## One-Concept Goal

Transfer a **4-ring color tower** from `Stack 1` to `Stack 2` inside a single `Loop Start [×4]` / `Loop End` (`6` flat blocks) and observe how **LIFO stack order reverses** automatically (`Yellow–Green–Blue–Red` bottom→top becomes `Red–Blue–Green–Yellow` bottom→top).

<details>
<summary>📖 Parent / Teacher Tip</summary>

Look at the translucent **dashed ghost rings** waiting on empty `Stack 2`: **Red** lands on the very bottom and **Yellow** ends up on top! Because the crane always grabs the **top ring first**, repeating the exact same 4-block cycle **`Move to 1` → `Grab` → `Move to 2` → `Place`** `4` times inside `Loop Start [×4]` automatically reverses the whole stack into the matching target!

</details>

## UI & Playground Contract

- **Zero Reading**: Uniform Glossy Color Rings (`Yellow`, `Green`, `Blue`, `Red`) with peg numbers `1`, `2`, `3` only.
- **Station Mask (`activeStationsMask`)**: `["STACK_1", "STACK_2", "STACK_3"]` (`OUT`, `INPUT`, `QUEUE`, and `TapeDock` hidden).
- **Target Ghost Silhouette**: Translucent dashed outline stacked on empty `Stack 2` showing exact bottom→top colors `["RED", "BLUE", "GREEN", "YELLOW"]`.
- **Claw Indicator**: Held ring renders between overhead **claw jaws** (`no BackpackHud` `🎒`).
- **Slot Cap**: `slotCap.maxTotal = 6` (exact flat closer-inclusive match: `Loop Start`/`End` `2` + `4` body blocks; blocks `16`-block unrolled solution!). **Edit-Delta**: `6`.

## Palette & Capabilities

```json
{
  "allowedSimBlocks": ["DEPOT_MOVE_TO", "DEPOT_GRAB", "DEPOT_PLACE"],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": false,
  "allowActionParams": true,
  "allowedBlockParams": ["station"],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 6 },
  "antiBypassRules": [
    {
      "id": "single-depth-loop-only",
      "description": "Single-depth loop only",
      "maxLoopNestingDepth": 0
    }
  ]
}
```

## Depot `v4` Setup (`STACK_1..3` only)

```json
{
  "envVersion": 4,
  "activeStationsMask": ["STACK_1", "STACK_2", "STACK_3"],
  "enforceHanoiRule": false,
  "workerStation": "STACK_1",
  "clawItem": null,
  "stacks": [["YELLOW", "GREEN", "BLUE", "RED"], [], []],
  "targetStacks": [[], ["RED", "BLUE", "GREEN", "YELLOW"], []],
  "inputQueue": [],
  "targetOutput": []
}
```

*(Array order: index `0` is bottom of peg, last index is top of peg.)*

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
      "count": 4,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
        { "op": "PLACEHOLDER", "hintCategory": "item" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "PLACEHOLDER", "hintCategory": "item" }
      ]
    }
  ]
}
```

### Canonical Solution (`referenceSolution` — `6` flat closer-inclusive blocks)

```json
{
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
        { "op": "DEPOT_GRAB" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "DEPOT_PLACE" }
      ]
    }
  ]
}
```

### Step-by-Step Trace

| Loop Iter | `STACK_1` Before | Ring Moved | `STACK_2` After | Crane Pose |
| :---: | :--- | :---: | :--- | :---: |
| `1/4` | `[Y, G, B, R]` | `RED` | `[RED]` | `STACK_2` |
| `2/4` | `[Y, G, B]` | `BLUE` | `[RED, BLUE]` | `STACK_2` |
| `3/4` | `[Y, G]` | `GREEN` | `[RED, BLUE, GREEN]` | `STACK_2` |
| `4/4` | `[Y]` | `YELLOW` | `[RED, BLUE, GREEN, YELLOW]` ✅ | `STACK_2` |
