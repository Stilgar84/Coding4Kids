# `loop.6` — Nested Loops: 4-Pillar Clover Patrol

> **Format**: Practice (`🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Prerequisite**: [`loop.5a`](./lesson_loop_5a_how_nested_loops_work.md) · **Legacy ID**: `3.6` *(Clockwork ordered flags `F1..F4` enforce full 4-petal nested traversal)*

## One-Concept Goal

Construct a **nested `Loop Start [×4]` inside `Loop Start [×4]`** (`4 × 4` patrol) to trace four 3×3 corner clover petals around four walled pillars in clockwise order and return home to `(2, 2)`.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Look familiar? Just like `loop.5a`, each of the 4 big corner loops marches **`Move Forward [×2]` + `Turn Right`** `4` times to circle one pillar! Nest that inner `Loop [×4]` inside an outer `Loop [×4]` that adds one extra **`Turn Right`** after each pillar so the robot walks cleanly around all 4 flags (`1 → 2 → 3 → 4 → Goal`) in only **7 blocks total**!

</details>

## UI & Playground Contract

- **Zero Reading**: Ordered clover flags display `1 ⋯▶ 2 ⋯▶ 3 ⋯▶ 4 ⋯▶ 🏁`.
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Slot Cap**: `slotCap.maxTotal = 7` (exact flat closer-inclusive match: Outer `Loop Start`/`End` `2` + Inner `Loop Start`/`End` `2` + `MOVE_FWD [×2]`, `TURN_RIGHT`, outer `TURN_RIGHT` `3` = `7`). **Edit-Delta**: `7` (`2` `?` slots in Partial Help).
- **Anti-Bypass Guardrail**: Clockwise ordered flags `F1→F2→F3→F4→Goal` prevent `Loop ×3` shortcuts and CCW order flips, while `slotCap.maxTotal = 7` blocks flat unrolling (`9+` blocks).

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
  "slotCap": { "maxTotal": 7 }
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

## Grid Setup (`5 × 5`, `x = 0..4`, `y = 0..4`)

- **Start Pose**: `(2, 2)` facing **`NORTH`**
- **4 Enclosed Pillar Obstacles**: `(1, 1)`, `(3, 1)`, `(1, 3)`, `(3, 3)`
- **Ordered Flags**: `F1 = (4, 0)` (`order: 1`), `F2 = (4, 4)` (`order: 2`), `F3 = (0, 4)` (`order: 3`), `F4 = (0, 0)` (`order: 4`)
- **Goal**: `(2, 2)` (`order: 5`, `isGoal: true`)

```text
     0   1   2   3   4
   +---+---+---+---+---+
 0 | 4 |   | ↑ |   | 1 |
   +   +---+   +---+   +
 1 |   |███| ↑ |███|   |
   +   +---+   +---+   +
 2 |   →   →🤖🏁 →   → |
   +   +---+   +---+   +
 3 |   |███| ↓ |███|   |
   +   +---+   +---+   +
 4 | 3 |   | ↓ |   | 2 |
   +---+---+---+---+---+
```

```json
{
  "gridWidth": 5,
  "gridHeight": 5,
  "start": { "x": 2, "y": 2, "dir": "NORTH" },
  "goal": { "x": 2, "y": 2 },
  "flags": [
    { "id": "F1", "x": 4, "y": 0, "isGoal": false, "order": 1 },
    { "id": "F2", "x": 4, "y": 4, "isGoal": false, "order": 2 },
    { "id": "F3", "x": 0, "y": 4, "isGoal": false, "order": 3 },
    { "id": "F4", "x": 0, "y": 0, "isGoal": false, "order": 4 },
    { "id": "G", "x": 2, "y": 2, "isGoal": true, "order": 5 }
  ],
  "barriers": [
    { "orientation": "H", "x": 1, "y": 1 },
    { "orientation": "H", "x": 1, "y": 2 },
    { "orientation": "V", "x": 1, "y": 1 },
    { "orientation": "V", "x": 2, "y": 1 },
    { "orientation": "H", "x": 3, "y": 1 },
    { "orientation": "H", "x": 3, "y": 2 },
    { "orientation": "V", "x": 3, "y": 1 },
    { "orientation": "V", "x": 4, "y": 1 },
    { "orientation": "H", "x": 1, "y": 3 },
    { "orientation": "H", "x": 1, "y": 4 },
    { "orientation": "V", "x": 1, "y": 3 },
    { "orientation": "V", "x": 2, "y": 3 },
    { "orientation": "H", "x": 3, "y": 3 },
    { "orientation": "H", "x": 3, "y": 4 },
    { "orientation": "V", "x": 3, "y": 3 },
    { "orientation": "V", "x": 4, "y": 3 }
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
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        {
          "op": "LOOP_START",
          "count": 4,
          "body": [
            { "op": "MOVE_FWD", "repeat": 2 },
            { "op": "PLACEHOLDER", "hintCategory": "turn" }
          ]
        },
        { "op": "PLACEHOLDER", "hintCategory": "turn" }
      ]
    }
  ]
}
```

### Canonical Solution (`referenceSolution` — `7` flat closer-inclusive blocks)

```json
{
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        {
          "op": "LOOP_START",
          "count": 4,
          "body": [
            { "op": "MOVE_FWD", "repeat": 2 },
            { "op": "TURN_RIGHT" }
          ]
        },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
}
```

### Step-by-Step Trace

| Outer Iter | Start Pose | Inner `×4` Square Loop Corners | Pillar Circled | End Pose |
| :---: | :--- | :--- | :---: | :--- |
| `1/4` | `(2,2) N` | `(2,0) → (4,0)[F1] → (4,2) → (2,2) N` + `TR` | `(3,1)` | `(2,2) E` |
| `2/4` | `(2,2) E` | `(4,2) → (4,4)[F2] → (2,4) → (2,2) E` + `TR` | `(3,3)` | `(2,2) S` |
| `3/4` | `(2,2) S` | `(2,4) → (0,4)[F3] → (0,2) → (2,2) S` + `TR` | `(1,3)` | `(2,2) W` |
| `4/4` | `(2,2) W` | `(0,2) → (0,0)[F4] → (2,0) → (2,2) W` + `TR` | `(1,1)` | **`(2,2) N 🏁`** |
