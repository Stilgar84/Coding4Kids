# `loop.1` — Simple Multi-Block Loops

> **Format**: Practice (`🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Legacy ID**: `3.1` *(Upgraded from 5×5 spiral to 4×4 Zig-Zag Staircase)*

## One-Concept Goal

Practice putting **multiple distinct actions inside a single `Loop Start [N]` / `Loop End` body** to climb a diagonal zig-zag staircase without unrolling or bypassing.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Look closely at the zig-zag corridor leading up-right across the grid! Every stair step repeats the exact same **4-block dance**: `Move Forward`, `Turn Left`, `Move Forward`, `Turn Right`. Try filling in the `?` turn slots inside `Loop Start [×3] ... Loop End` so the robot climbs all 3 stairs cleanly in just **6 blocks total**! *(Why does unrolling fail? You only have 6 slots in the workspace tray!)*

</details>

## UI & Playground Contract

- **Zero Reading**: No text hints inside playfield or block tray; `?` scaffold slots use pure icon category cues (`hintCategory: "turn"`).
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Slot Cap**: `slotCap.maxTotal = 6` (exact flat closer-inclusive match: `Loop Start` + `Loop End` + `4` body blocks). **Edit-Delta**: `6` (with `?` hints in Partial Help: `2` replacements).
- **Anti-Bypass Guardrail**: Tight 1-cell stair corridor + `slotCap.maxTotal = 6` prevents unrolling (`12` blocks) and blocks single-action repeat shortcuts (`[×N]` badges disabled here).

## Palette & Capabilities

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": false,
  "allowActionParams": false,
  "allowedBlockParams": [],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 6 },
  "antiBypassRules": [
    {
      "id": "no-nested-loops",
      "description": "Single-depth loop only",
      "maxLoopNestingDepth": 0
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

## Grid Setup (`4 × 4`, `x = 0..3`, `y = 0..3`)

- **Start Pose**: `(0, 3)` facing **`EAST`**
- **Ordered Flags**: `F1 = (1, 2)` (`order: 1`), `F2 = (2, 1)` (`order: 2`)
- **Goal**: `(3, 0)` (`order: 3`, `isGoal: true`)

```text
     0   1   2   3
   +---+---+---+---+
 0 |   |   |   |🏁G|
   +---+---+---+ ↑ +
 1 |   |   | 2 → ↑ |
   +---+---+ ↑ +---+
 2 |   | 1 → ↑ |   |
   +---+ ↑ +---+---+
 3 |🤖>→ ↑ |   |   |
   +---+---+---+---+
```

```json
{
  "gridWidth": 4,
  "gridHeight": 4,
  "start": { "x": 0, "y": 3, "dir": "EAST" },
  "goal": { "x": 3, "y": 0 },
  "flags": [
    { "id": "F1", "x": 1, "y": 2, "isGoal": false, "order": 1 },
    { "id": "F2", "x": 2, "y": 1, "isGoal": false, "order": 2 },
    { "id": "G", "x": 3, "y": 0, "isGoal": true, "order": 3 }
  ],
  "barriers": [
    { "orientation": "H", "x": 0, "y": 3 },
    { "orientation": "V", "x": 2, "y": 3 },
    { "orientation": "V", "x": 1, "y": 2 },
    { "orientation": "H", "x": 1, "y": 2 },
    { "orientation": "H", "x": 2, "y": 3 },
    { "orientation": "V", "x": 3, "y": 2 },
    { "orientation": "V", "x": 2, "y": 1 },
    { "orientation": "H", "x": 2, "y": 1 },
    { "orientation": "H", "x": 3, "y": 2 },
    { "orientation": "V", "x": 3, "y": 0 }
  ]
}
```

*(Note: Every stair cell has both orthogonal off-corridor edges sealed so leaving the zig-zag immediately triggers a wall collision.)*

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`)

Empty `[MAIN]` (`0` blocks). *(A pre-seeded loop counter is optional, or let the learner drag `Loop Start` + pair `Loop End` directly from the palette.)*

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
        { "op": "MOVE_FWD" },
        { "op": "PLACEHOLDER", "hintCategory": "turn" },
        { "op": "MOVE_FWD" },
        { "op": "PLACEHOLDER", "hintCategory": "turn" }
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
      "count": 3,
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "TURN_LEFT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
}
```

### Step-by-Step Trace

| Iteration | Pose Start | Body Action Trace | Pose End | Milestone |
| :---: | :--- | :--- | :--- | :---: |
| `1/3` | `(0,3) E` | `FWD→(1,3)E`, `TL→N`, `FWD→(1,2)N`, `TR→E` | `(1,2) E` | Flag `1` |
| `2/3` | `(1,2) E` | `FWD→(2,2)E`, `TL→N`, `FWD→(2,1)N`, `TR→E` | `(2,1) E` | Flag `2` |
| `3/3` | `(2,1) E` | `FWD→(3,1)E`, `TL→N`, `FWD→(3,0)N`, `TR→E` | `(3,0) E` | **`🏁 Goal!`** |
