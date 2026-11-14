# `loop.5` — Loops with Object Workflows

> **Format**: Practice (`🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Legacy ID**: `3.5` *(Fixed single-plank 3-river leap)*

## One-Concept Goal

Combine **item carry/place workflows** (`Pick Up` + `Use / Drop`) with counted repetition to reuse **one single bridge plank** across three consecutive rivers.

<details>
<summary>📖 Parent / Teacher Tip</summary>

There are **3 rivers**, but the robot only has **1 wooden plank**! First `Pick Up` the plank at the start tile (watch it appear on the robot's shoulder gripper!). Inside `Loop Start [×3]`, `Use / Drop` the plank onto the river ahead, walk `Move Forward [×2]` onto solid ground, `Turn Right [×2]` to face back toward the plank you just crossed, `Pick Up` the plank behind you, and `Turn Right [×2]` again to face the next river! *(Tip: use the `[×2]` repeat badge on `Turn Right` so everything fits inside 8 slots!)*

</details>

## UI & Playground Contract

- **Zero Reading**: Visual river water tiles, single wooden plank item icon, and shoulder gripper indicator (`no BackpackHud` `🎒`).
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Slot Cap**: `slotCap.maxTotal = 8` (exact flat closer-inclusive match: `1` pre-loop `PICK_UP` + `Loop Start`/`End` `2` + `5` body blocks). **Edit-Delta**: `8` (`2` `?` turn replacements in Partial Help).
- **Anti-Bypass Guardrail**: Strict interaction rules (`strictInteractionCollision: true`), single plank (`cannot bridge all 3 rivers at once without retrieving it`), and `slotCap.maxTotal = 8`.

## Palette & Capabilities

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "allowedBlockParams": [],
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

## Validation Flags

```json
{
  "strictInteractionCollision": true,
  "requireAllItemsCollected": false,
  "requireEmptyBackpackAtGoal": false,
  "enforceOrderedFlags": false
}
```

*(Note: `requireEmptyBackpackAtGoal: false` ensures completing the final retrieval cleanly or reaching `(6, 1)` Goal succeeds without punishing carrying the single reusable plank.)*

## Grid Setup (`7 × 3`, `x = 0..6`, `y = 0..2`)

- **Start Pose**: `(0, 1)` facing **`EAST`**
- **Goal**: `(6, 1)` (`isGoal: true`)
- **Water Cells**: `(1, 1)`, `(3, 1)`, `(5, 1)`
- **Items**: `[{ "id": "plank-1", "kind": "plank", "x": 0, "y": 1 }]` *(only 1 plank)*

```text
     0   1   2   3   4   5   6
   +---+---+---+---+---+---+---+
 0 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
 1 |🤖🪵| ~ | . | ~ | . | ~ |🏁G|
   +---+---+---+---+---+---+---+
 2 |   |   |   |   |   |   |   |
   +---+---+---+---+---+---+---+
```

```json
{
  "gridWidth": 7,
  "gridHeight": 3,
  "start": { "x": 0, "y": 1, "dir": "EAST" },
  "goal": { "x": 6, "y": 1 },
  "waterCells": [
    { "x": 1, "y": 1 },
    { "x": 3, "y": 1 },
    { "x": 5, "y": 1 }
  ],
  "items": [{ "id": "plank-1", "kind": "plank", "x": 0, "y": 1 }],
  "barriers": [
    { "orientation": "H", "x": 0, "y": 1 },
    { "orientation": "H", "x": 1, "y": 1 },
    { "orientation": "H", "x": 2, "y": 1 },
    { "orientation": "H", "x": 3, "y": 1 },
    { "orientation": "H", "x": 4, "y": 1 },
    { "orientation": "H", "x": 5, "y": 1 },
    { "orientation": "H", "x": 6, "y": 1 },
    { "orientation": "H", "x": 0, "y": 2 },
    { "orientation": "H", "x": 1, "y": 2 },
    { "orientation": "H", "x": 2, "y": 2 },
    { "orientation": "H", "x": 3, "y": 2 },
    { "orientation": "H", "x": 4, "y": 2 },
    { "orientation": "H", "x": 5, "y": 2 },
    { "orientation": "H", "x": 6, "y": 2 }
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
    { "op": "PICK_UP" },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "USE_DROP" },
        { "op": "MOVE_FWD", "repeat": 2 },
        { "op": "PLACEHOLDER", "hintCategory": "turn" },
        { "op": "PICK_UP" },
        { "op": "PLACEHOLDER", "hintCategory": "turn" }
      ]
    }
  ]
}
```

### Canonical Solution (`referenceSolution` — `8` flat closer-inclusive blocks)

```json
{
  "MAIN": [
    { "op": "PICK_UP" },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "USE_DROP" },
        { "op": "MOVE_FWD", "repeat": 2 },
        { "op": "TURN_RIGHT", "repeat": 2 },
        { "op": "PICK_UP" },
        { "op": "TURN_RIGHT", "repeat": 2 }
      ]
    }
  ]
}
```

### Step-by-Step Trace

| Step | Action | Robot Pose | Shoulder Gripper | Rivers Bridged |
| :--- | :--- | :--- | :---: | :---: |
| Init | `PICK_UP` | `(0,1) E` | `🪵 plank-1` | `—` |
| `1/3` | `USE_DROP` → `FWD×2` → `TR×2` → `PICK_UP` → `TR×2` | `(2,1) E` | `🪵 plank-1` | `(1,1)` bridged then picked back up |
| `2/3` | `USE_DROP` → `FWD×2` → `TR×2` → `PICK_UP` → `TR×2` | `(4,1) E` | `🪵 plank-1` | `(3,1)` bridged then picked back up |
| `3/3` | `USE_DROP` → `FWD×2` **`🏁`** → `TR×2` → `PICK_UP` → `TR×2` | `(6,1) E` | `🪵 plank-1` | **`🏁 Goal reached!`** |
