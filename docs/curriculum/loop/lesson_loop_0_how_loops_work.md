# `loop.0` — How `Loop Start` & `Loop End` Work

> **Format**: Comprehension Demo (`📖 🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Legacy ID**: `3.0`

## One-Concept Goal

Introduce **bounded counted repetition** with paired `Loop Start [N]` and `Loop End` delimiter blocks by running the exact same perimeter flag patrol twice: first **unrolled** (`8` blocks) and then **compressed** (`5` flat blocks) with live execution highlighting and loop-counter progress.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Press **Run** on **Demo Tab 1** to watch the robot walk the long, unrolled program around the outer track. Then switch to **Demo Tab 2** and press **Run** again! Watch how `Loop Start [×4]` wraps `Turn Right` + `Move Forward [×3]` cleanly inside `Loop End`, counts `1/4 → 2/4 → 3/4 → 4/4` on the loop header badge, and then **exits past `Loop End`** to take one final `Move Forward` step onto the Flag Goal!

</details>

## UI & Playground Contract

- **Zero Reading**: No on-screen prose, no text badges on blocks, no canvas labels.
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Coach Spotlights**:
  - Tab 1: `execution-order` (highlights active sequential blocks stepping down `[MAIN]`).
  - Tab 2: `execution-order` + `loop-counter` (active orange highlight around the `Loop Start [×4]` header pill showing `1/4`..`4/4`, stepping down to final `MOVE_FWD` after `Loop End`).
- **HUD & Canvas Conventions**:
  - Ordered flags render numeric badges `1`, `2`, `3` with directional dashed connector chevrons `1 ⋯▶ 2 ⋯▶ 3 ⋯▶ 🏁`.
  - Goal renders at `(1,0)` with checkered flag icon `🏁` (unlocked).
  - No `BackpackHud` (`🎒`).

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

## Grid Setup (`6 × 5`, `x = 0..5`, `y = 0..4`)

- **Start Pose**: `(1, 1)` facing **`NORTH`**
- **Ordered Flags**: `F1 = (4, 1)` (`order: 1`), `F2 = (4, 4)` (`order: 2`), `F3 = (1, 4)` (`order: 3`)
- **Goal**: `(1, 0)` (`order: 4`, `isGoal: true`)

```text
     0   1   2   3   4   5
   +---+---+---+---+---+---+
 0 |   |🏁G|   |   |   |   |
   +---+   +---+---+---+---+
 1 |   |🤖^→   →   → 1 |   |
   +---+   +---+---+   +---+
 2 |   | ↑ |   |   | ↓ |   |
   +---+   +   +   +   +---+
 3 |   | ↑ |   |   | ↓ |   |
   +---+   +---+---+   +---+
 4 |   | 3 ←   ←   ← 2 |   |
   +---+---+---+---+---+---+
```

*(Note: Horizontal wall `{"orientation":"H","x":1,"y":1}` is omitted — path between `(1,1)` and `(1,0)` is open; the perimeter loop path stays enclosed inside outer border walls and the center `2×2` island.)*

```json
{
  "gridWidth": 6,
  "gridHeight": 5,
  "start": { "x": 1, "y": 1, "dir": "NORTH" },
  "goal": { "x": 1, "y": 0 },
  "flags": [
    { "id": "F1", "x": 4, "y": 1, "isGoal": false, "order": 1 },
    { "id": "F2", "x": 4, "y": 4, "isGoal": false, "order": 2 },
    { "id": "F3", "x": 1, "y": 4, "isGoal": false, "order": 3 },
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

## Demo Tabs (`demoTabs`)

### Tab 1 — Unrolled Patrol (`8` flat blocks)

```json
{
  "id": "tab-unrolled",
  "icon": "👣",
  "spotlights": ["execution-order"],
  "MAIN": [
    { "op": "TURN_RIGHT" },
    { "op": "MOVE_FWD", "repeat": 3 },
    { "op": "TURN_RIGHT" },
    { "op": "MOVE_FWD", "repeat": 3 },
    { "op": "TURN_RIGHT" },
    { "op": "MOVE_FWD", "repeat": 3 },
    { "op": "TURN_RIGHT" },
    { "op": "MOVE_FWD", "repeat": 4 }
  ]
}
```

### Tab 2 — Loop Patrol + Exit Step (`5` flat closer-inclusive blocks)

| # | Block | Counter / Trace |
| :---: | :--- | :--- |
| 1 | `LOOP_START [×4]` | Enters loop (`1/4..4/4`) |
| 2 | `  TURN_RIGHT` | Turns `E → S → W → N` |
| 3 | `  MOVE_FWD [×3]` | `F1(4,1)` → `F2(4,4)` → `F3(1,4)` → `(1,1)` |
| 4 | `LOOP_END` | Repeats until `4/4`, then exits loop |
| 5 | `MOVE_FWD [×1]` | `(1,1) N → (1,0)` **`🏁 Goal!`** |

```json
{
  "id": "tab-loop",
  "icon": "🔁",
  "spotlights": ["execution-order", "loop-counter"],
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD", "repeat": 3 }
      ]
    },
    { "op": "MOVE_FWD", "repeat": 1 }
  ]
}
```
