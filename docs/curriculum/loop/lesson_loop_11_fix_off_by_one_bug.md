# `loop.11` — Fix-It: Fix the Off-by-One Loop Bug

> **Format**: Fix-It (`🐛 🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Promoted From**: Legacy Lesson `11` *(Off-by-one `×4` vs `×3 + 1` post-loop cleanup)*

## One-Concept Goal

Diagnose and repair a classic **off-by-one loop bug**: pressing **Run** on the starter program crashes on the 4th iteration (`×4`), so the learner reduces the loop count to **`×3`** and appends **1 `Move Forward` step after `Loop End`** to cross the finish line cleanly.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Press **Run** first to see why the buggy program crashes! There are only **3 diagonal steps down**, so `Loop Start [×4]` tries to step off the bottom edge on turn `4/4`! Change **`×4` → `×3`** so the robot safely finishes on flag `3`, then add **`Move Forward`** right **below `Loop End`** to walk onto the Flag Goal!

</details>

## UI & Playground Contract

- **Zero Reading**: Ordered flags render `1 ⋯▶ 2 ⋯▶ 3 ⋯▶ 🏁`. Crash highlights the offending `Loop` block inside `[MAIN]`.
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Slot Cap**: `slotCap.maxTotal = 8` (starter occupies `6` slots; fixed solution uses `7` slots; **Edit-Delta: `2`** — adjust loop repeat `×4 → ×3` and append `MOVE_FWD` after `Loop End`).
- **Anti-Bypass Guardrail**: Sealed zig-zag staircase walls prevent bypassing flags or taking an early diagonal cut, and `×3` without post-loop `MOVE_FWD` stops at `(3, 3)` short of `(4, 3)` Goal.

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
  "slotCap": { "maxTotal": 8 },
  "antiBypassRules": [
    {
      "id": "single-depth-loop-only",
      "description": "Single-depth loop + post-loop step only",
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

## Grid Setup (`5 × 4`, `x = 0..4`, `y = 0..3`)

- **Start Pose**: `(0, 0)` facing **`EAST`**
- **Ordered Flags**: `F1 = (1, 1)` (`order: 1`), `F2 = (2, 2)` (`order: 2`), `F3 = (3, 3)` (`order: 3`)
- **Goal**: `(4, 3)` (`order: 4`, `isGoal: true`)

```text
     0   1   2   3   4
   +---+---+---+---+---+
 0 |🤖>→ v |   |   |   |
   +---+ ↓ +---+---+---+
 1 |   | 1 → v |   |   |
   +---+---+ ↓ +---+---+
 2 |   |   | 2 → v |   |
   +---+---+---+ ↓ +---+
 3 |   |   |   | 3 →🏁G|
   +---+---+---+---+---+
```

```json
{
  "gridWidth": 5,
  "gridHeight": 4,
  "start": { "x": 0, "y": 0, "dir": "EAST" },
  "goal": { "x": 4, "y": 3 },
  "flags": [
    { "id": "F1", "x": 1, "y": 1, "isGoal": false, "order": 1 },
    { "id": "F2", "x": 2, "y": 2, "isGoal": false, "order": 2 },
    { "id": "F3", "x": 3, "y": 3, "isGoal": false, "order": 3 },
    { "id": "G", "x": 4, "y": 3, "isGoal": true, "order": 4 }
  ],
  "barriers": [
    { "orientation": "H", "x": 0, "y": 1 },
    { "orientation": "V", "x": 2, "y": 0 },
    { "orientation": "V", "x": 1, "y": 1 },
    { "orientation": "H", "x": 1, "y": 2 },
    { "orientation": "H", "x": 2, "y": 1 },
    { "orientation": "V", "x": 3, "y": 1 },
    { "orientation": "V", "x": 2, "y": 2 },
    { "orientation": "H", "x": 2, "y": 3 },
    { "orientation": "H", "x": 3, "y": 2 },
    { "orientation": "V", "x": 4, "y": 2 },
    { "orientation": "V", "x": 3, "y": 3 },
    { "orientation": "H", "x": 4, "y": 3 }
  ]
}
```

## Workspaces & Canonical Solution

### Buggy Starter Workspace (`starterWorkspace` — `6` flat blocks, crashes!)

```json
{
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_LEFT" }
      ]
    }
  ]
}
```

**Buggy Trace**:
- Iter `1/4`: `(0,0)E → (1,0)E → S → (1,1)[F1] → E`
- Iter `2/4`: `(1,1)E → (2,1)E → S → (2,2)[F2] → E`
- Iter `3/4`: `(2,2)E → (3,2)E → S → (3,3)[F3] → E`
- Iter `4/4`: `(3,3)E → (4,3) → S →` tries `(4,4)` = **CRASH (out-of-bounds south wall)!**

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
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_LEFT" }
      ]
    },
    { "op": "PLACEHOLDER", "hintCategory": "motion" }
  ]
}
```

### Canonical Solution (`referenceSolution` — `7` flat closer-inclusive blocks, `Edit-Delta = 2`)

```json
{
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT" },
        { "op": "MOVE_FWD" },
        { "op": "TURN_LEFT" }
      ]
    },
    { "op": "MOVE_FWD" }
  ]
}
```
