# `loop.5a` — How Nested Loops Work

> **Format**: Comprehension Demo (`📖 🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Promoted Prerequisite**: Required before `loop.6`

## One-Concept Goal

Visualize **how an inner `Loop Start` / `Loop End` runs completely inside each single step of an outer `Loop Start` / `Loop End`** using compact live progress counters (`1/4`..`4/4`) directly on active loop header pills.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Press **Run** on **Demo Tab 1** and watch **both** loop counters at the same time! Notice how the **outer loop counter** pauses at `1/4` while the **inner loop counter** finishes all `1/4 → 2/4 → 3/4 → 4/4` sides of one small square (`1` petal), returns to `(1, 1)`, turns right once, and then bumps the outer counter to `2/4`! Switch to **Demo Tab 2** to see how flatly repeating all 4 sides takes `11` blocks instead of just `7`!

</details>

## UI & Playground Contract

- **Zero Reading**: Active outer & inner `Loop Start [×4]` header pills render compact live counter badges (`1/4`..`4/4`); ordered clover flags render `1 ⋯▶ 2 ⋯▶ 3 ⋯▶ 4 ⋯▶ 🏁`.
- **Coach Spotlights**:
  - Tab 1: `execution-order` + `loop-counter` (nested dual-pill progress counters on outer & inner `Loop` headers).
  - Tab 2: `execution-order` + `loop-counter` (single un-nested `Loop ×4` comparison).
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).

## Palette & Capabilities

```json
{
  "allowedSimBlocks": ["MOVE_FWD", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": false,
  "allowActionParams": false,
  "allowedBlockParams": [],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 14 }
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

## Grid Setup (`3 × 3`, `x = 0..2`, `y = 0..2`)

- **Start Pose**: `(1, 1)` facing **`NORTH`**
- **Ordered Flags**: `F1 = (2, 0)` (`order: 1`), `F2 = (2, 2)` (`order: 2`), `F3 = (0, 2)` (`order: 3`), `F4 = (0, 0)` (`order: 4`)
- **Goal**: `(1, 1)` (`order: 5`, `isGoal: true`)

```text
     0   1   2
   +---+---+---+
 0 | 4 |   | 1 |
   +---+---+---+
 1 |   |🤖^|   |
   +---+---+---+
 2 | 3 |   | 2 |
   +---+---+---+
```

```json
{
  "gridWidth": 3,
  "gridHeight": 3,
  "start": { "x": 1, "y": 1, "dir": "NORTH" },
  "goal": { "x": 1, "y": 1 },
  "flags": [
    { "id": "F1", "x": 2, "y": 0, "isGoal": false, "order": 1 },
    { "id": "F2", "x": 2, "y": 2, "isGoal": false, "order": 2 },
    { "id": "F3", "x": 0, "y": 2, "isGoal": false, "order": 3 },
    { "id": "F4", "x": 0, "y": 0, "isGoal": false, "order": 4 },
    { "id": "G", "x": 1, "y": 1, "isGoal": true, "order": 5 }
  ],
  "barriers": []
}
```

## Demo Tabs (`demoTabs`)

### Tab 1 — Nested 4×4 Clover Loops (`7` flat closer-inclusive blocks)

```json
{
  "id": "tab-nested-clover",
  "icon": "🍀",
  "spotlights": ["execution-order", "loop-counter"],
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        {
          "op": "LOOP_START",
          "count": 4,
          "body": [
            { "op": "MOVE_FWD" },
            { "op": "TURN_RIGHT" }
          ]
        },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
}
```

**Trace (Tab 1)**:
- Outer `1/4` (starts `(1,1) N`): Inner `1..4` traces `(1,1)→(1,0)→(2,0)[F1]→(2,1)→(1,1) N`, then Outer `TURN_RIGHT` faces `E`.
- Outer `2/4` (`(1,1) E`): Inner traces `(1,1)→(2,1)→(2,2)[F2]→(1,2)→(1,1) E`, Outer `TURN_RIGHT` faces `S`.
- Outer `3/4` (`(1,1) S`): Inner hits `[F3]` at `(0,2)`, Outer faces `W`.
- Outer `4/4` (`(1,1) W`): Inner hits `[F4]` at `(0,0)`, Outer returns to `(1,1) N` **`🏁 Goal!`**

### Tab 2 — Single-Depth Unrolled Comparison (`11` flat blocks)

```json
{
  "id": "tab-flat-petal",
  "icon": "📐",
  "spotlights": ["execution-order", "loop-counter"],
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
}
```
