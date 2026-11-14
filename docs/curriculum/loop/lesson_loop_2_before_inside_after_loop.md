# `loop.2` — Before, Inside, and After the Loop

> **Format**: Practice (`🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Legacy ID**: `3.2`

## One-Concept Goal

Combine **setup steps before `Loop Start`**, **repeated patrol legs inside the loop**, and **cleanup steps after `Loop End`** to enter, sweep, and exit a walled courtyard.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Notice how the robot starts one tile *north* of the main track, facing South! First take **1 step Forward** before the loop to enter the track (`Before`). Next repeat **`Turn Left` + `Move Forward [×3]`** `3` times around the corners (`Inside`). Finally, after `Loop End`, **`Turn Right`** and take **1 step Forward** (`After`) to step through the top gate onto the Flag Goal!

</details>

## UI & Playground Contract

- **Zero Reading**: Ordered flags render `1 ⋯▶ 2 ⋯▶ 3 ⋯▶ 🏁`. No prose labels inside canvas or workspace.
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Slot Cap**: `slotCap.maxTotal = 7` (exact flat closer-inclusive match: `1` Before + `Loop Start`/`End` `2` + `2` Inside + `2` After). **Edit-Delta**: `7` (`3` `?` slots in Partial Help).
- **Anti-Bypass Guardrail**: Walled entry/exit pocket (`V:1,3`, `V:2,3`, `H:1,3`, `V:5,4`) crashes any attempt to place the entry/exit step inside the loop, and `slotCap.maxTotal = 7` forces `[×3]` loop + `[×3]` repeat badge.

## Palette & Capabilities

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "allowedBlockParams": [],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 7 },
  "antiBypassRules": [
    {
      "id": "single-loop-only",
      "description": "Before + single-depth loop + After only",
      "maxLoopNestingDepth": 0,
      "pureSingleLoopOnly": true
    }
  ]
}
```

## Validation Flags

```json
{
  "strictInteractionCollision": false,
  "requireAllItemsCollected": false,
  "requireEmptyBackpackAtGoal": false,
  "enforceOrderedFlags": true
}
```

## Grid Setup (`6 × 5`, `x = 0..5`, `y = 0..4`)

- **Start Pose**: `(1, 3)` facing **`SOUTH`**
- **Ordered Flags**: `F1 = (4, 4)` (`order: 1`), `F2 = (4, 1)` (`order: 2`), `F3 = (1, 1)` (`order: 3`)
- **Goal**: `(1, 0)` (`order: 4`, `isGoal: true`)

```text
     0   1   2   3   4   5
   +---+---+---+---+---+---+
 0 |   |🏁G|   |   |   |   |
   +---+ ↑ +---+---+---+---+
 1 |   | 3 ←   ←   ← 2 |   |
   +---+   +---+---+ ↑ +---+
 2 |   |   |   |   | ↑ |   |
   +---+---+   +   + ↑ +---+
 3 |   |🤖v|   |   | ↑ |   |
   +---+ ↓ +---+---+ ↑ +---+
 4 |   |   →   →   → 1 |   |
   +---+---+---+---+---+---+
```

```json
{
  "gridWidth": 6,
  "gridHeight": 5,
  "start": { "x": 1, "y": 3, "dir": "SOUTH" },
  "goal": { "x": 1, "y": 0 },
  "flags": [
    { "id": "F1", "x": 4, "y": 4, "isGoal": false, "order": 1 },
    { "id": "F2", "x": 4, "y": 1, "isGoal": false, "order": 2 },
    { "id": "F3", "x": 1, "y": 1, "isGoal": false, "order": 3 },
    { "id": "G", "x": 1, "y": 0, "isGoal": true, "order": 4 }
  ],
  "barriers": [
    { "orientation": "V", "x": 1, "y": 0 },
    { "orientation": "V", "x": 2, "y": 0 },
    { "orientation": "V", "x": 1, "y": 1 },
    { "orientation": "V", "x": 1, "y": 2 },
    { "orientation": "V", "x": 1, "y": 3 },
    { "orientation": "V", "x": 1, "y": 4 },
    { "orientation": "V", "x": 5, "y": 1 },
    { "orientation": "V", "x": 5, "y": 2 },
    { "orientation": "V", "x": 5, "y": 3 },
    { "orientation": "V", "x": 5, "y": 4 },
    { "orientation": "H", "x": 1, "y": 3 },
    { "orientation": "H", "x": 2, "y": 1 },
    { "orientation": "H", "x": 3, "y": 1 },
    { "orientation": "H", "x": 4, "y": 1 },
    { "orientation": "V", "x": 2, "y": 2 },
    { "orientation": "V", "x": 2, "y": 3 },
    { "orientation": "V", "x": 4, "y": 2 },
    { "orientation": "V", "x": 4, "y": 3 },
    { "orientation": "H", "x": 2, "y": 2 },
    { "orientation": "H", "x": 3, "y": 2 },
    { "orientation": "H", "x": 2, "y": 4 },
    { "orientation": "H", "x": 3, "y": 4 }
  ]
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
    { "op": "MOVE_FWD", "repeat": 1 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "PLACEHOLDER", "hintCategory": "turn" },
        { "op": "MOVE_FWD", "repeat": 3 }
      ]
    },
    { "op": "PLACEHOLDER", "hintCategory": "turn" },
    { "op": "PLACEHOLDER", "hintCategory": "motion" }
  ]
}
```

### Canonical Solution (`referenceSolution` — `7` flat closer-inclusive blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD", "repeat": 1 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "TURN_LEFT" },
        { "op": "MOVE_FWD", "repeat": 3 }
      ]
    },
    { "op": "TURN_RIGHT" },
    { "op": "MOVE_FWD", "repeat": 1 }
  ]
}
```

### Step-by-Step Trace

| Phase | Action | Pose After | Milestone |
| :--- | :--- | :--- | :---: |
| Before | `MOVE_FWD [×1]` | `(1,4) S` | Enters track |
| Loop `1/3` | `TURN_LEFT → E`, `MOVE_FWD [×3]` | `(4,4) E` | Flag `1` |
| Loop `2/3` | `TURN_LEFT → N`, `MOVE_FWD [×3]` | `(4,1) N` | Flag `2` |
| Loop `3/3` | `TURN_LEFT → W`, `MOVE_FWD [×3]` | `(1,1) W` | Flag `3` |
| After | `TURN_RIGHT → N`, `MOVE_FWD [×1]` | `(1,0) N` | **`🏁 Goal!`** |
