# `loop.A` — Capstone: The Automated Greenhouse

> **Format**: Capstone (`🏆 🤖`) · **Module**: [`loop`](./overview.md) · **Environment**: [Robot Grid](../../envs/robot_grid.md) · **Legacy ID**: `3A` *(Updated to strict interaction rules, shoulder gripper visual, and shuttered `🏁 0/8` Goal gate)*

## One-Concept Goal

Synthesize **nested loops (`Loop ×4 × Loop ×2`), repeat badges (`Move Back [×4]`), and strict `PICK_UP` / `USE_DROP` item workflows** to plant all `8` soil pads along a symmetric 9×9 `+`-shaped greenhouse in exactly `10` flat blocks.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Look at the 4 symmetric garden aisles radiating **North, East, South, and West** from the center shuttered Goal **`🏁 0/8`**! Every aisle has **2 crates** and **2 brown soil pads** lined up in a row. Inside the **outer `Loop Start [×4]`**, use an **inner `Loop Start [×2]`** (`Move Forward` → `Pick Up` → `Move Forward` → `Use / Drop`) to place both crates down one aisle, then **`Move Back [×4]`** to back straight into `(4, 4)` and **`Turn Right`** toward the next garden aisle! When all `8/8` soil pads turn bright green, the shuttered **`🏁 8/8`** Goal unlocks right beneath the robot!

</details>

## UI & Playground Contract

- **Zero Reading**: Shuttered Goal renders animated metal shutter doors + **`🏁 0/8`** (`0/8` → `8/8`, **never `🔒` padlocks**). Carried crate rests visually on the robot's upper-right **shoulder gripper** (`no BackpackHud` `🎒`).
- **Enabled Scope Tabs**: `[MAIN]` only (`allowRecursion: false`, `allowVariables: false`).
- **Slot Cap**: `slotCap.maxTotal = 10` (exact match to canonical nested solution; **Edit-Delta: `10`**).
- **Anti-Bypass Guardrail**: Strict interaction (`strictInteractionCollision: true`), shuttered goal tied to all `8` switches (`requiredForGoal: true`), `requireEmptyBackpackAtGoal: true`, and tight `slotCap.maxTotal = 10` blocking unrolled/flat workarounds.

## Palette & Capabilities

```json
{
  "allowedSimBlocks": [
    "MOVE_FWD",
    "MOVE_BACK",
    "TURN_LEFT",
    "TURN_RIGHT",
    "PICK_UP",
    "USE_DROP"
  ],
  "allowedControlBlocks": ["LOOP_START"],
  "allowedScopes": ["MAIN"],
  "allowRepeatBadges": true,
  "allowActionParams": false,
  "allowedBlockParams": [],
  "allowVariables": false,
  "allowRecursion": false,
  "slotCap": { "maxTotal": 10 }
}
```

## Validation Flags

```json
{
  "strictInteractionCollision": true,
  "requireAllItemsCollected": false,
  "requireEmptyBackpackAtGoal": true,
  "enforceOrderedFlags": false
}
```

## Grid Setup (`9 × 9`, `x = 0..8`, `y = 0..8`)

- **Start Pose**: `(4, 4)` facing **`NORTH`**
- **Goal**: `(4, 4)` (shuttered **`🏁 0/8`** until all 8 `floorSwitches` are pressed)
- **8 Crates (`items`)**: `(4, 3)`, `(4, 1)`, `(5, 4)`, `(7, 4)`, `(4, 5)`, `(4, 7)`, `(3, 4)`, `(1, 4)`
- **8 Soil Pads (`floorSwitches`, `requiredForGoal: true`)**: `(4, 2)`, `(4, 0)`, `(6, 4)`, `(8, 4)`, `(4, 6)`, `(4, 8)`, `(2, 4)`, `(0, 4)`

```text
     0   1   2   3   4   5   6   7   8
   +---+---+---+---+---+---+---+---+---+
 0 |               | 🟤|               |
 1 |   H E D G E   | 📦|   H E D G E   |
 2 |               | 🟤|               |
 3 |               | 📦|               |
   +---+---+---+---+   +---+---+---+---+
 4 | 🟤  📦  🟤  📦|🤖🏁| 📦  🟤  📦  🟤|
   +---+---+---+---+   +---+---+---+---+
 5 |               | 📦|               |
 6 |   H E D G E   | 🟤|   H E D G E   |
 7 |               | 📦|               |
 8 |               | 🟤|               |
   +---+---+---+---+---+---+---+---+---+
```

```json
{
  "gridWidth": 9,
  "gridHeight": 9,
  "start": { "x": 4, "y": 4, "dir": "NORTH" },
  "goal": { "x": 4, "y": 4 },
  "items": [
    { "id": "c-n1", "kind": "crate", "x": 4, "y": 3 },
    { "id": "c-n2", "kind": "crate", "x": 4, "y": 1 },
    { "id": "c-e1", "kind": "crate", "x": 5, "y": 4 },
    { "id": "c-e2", "kind": "crate", "x": 7, "y": 4 },
    { "id": "c-s1", "kind": "crate", "x": 4, "y": 5 },
    { "id": "c-s2", "kind": "crate", "x": 4, "y": 7 },
    { "id": "c-w1", "kind": "crate", "x": 3, "y": 4 },
    { "id": "c-w2", "kind": "crate", "x": 1, "y": 4 }
  ],
  "floorSwitches": [
    { "id": "sw-n1", "x": 4, "y": 2, "requiredForGoal": true },
    { "id": "sw-n2", "x": 4, "y": 0, "requiredForGoal": true },
    { "id": "sw-e1", "x": 6, "y": 4, "requiredForGoal": true },
    { "id": "sw-e2", "x": 8, "y": 4, "requiredForGoal": true },
    { "id": "sw-s1", "x": 4, "y": 6, "requiredForGoal": true },
    { "id": "sw-s2", "x": 4, "y": 8, "requiredForGoal": true },
    { "id": "sw-w1", "x": 2, "y": 4, "requiredForGoal": true },
    { "id": "sw-w2", "x": 0, "y": 4, "requiredForGoal": true }
  ],
  "barriers": [
    { "orientation": "V", "x": 4, "y": 0 }, { "orientation": "V", "x": 5, "y": 0 },
    { "orientation": "V", "x": 4, "y": 1 }, { "orientation": "V", "x": 5, "y": 1 },
    { "orientation": "V", "x": 4, "y": 2 }, { "orientation": "V", "x": 5, "y": 2 },
    { "orientation": "V", "x": 4, "y": 3 }, { "orientation": "V", "x": 5, "y": 3 },
    { "orientation": "V", "x": 4, "y": 5 }, { "orientation": "V", "x": 5, "y": 5 },
    { "orientation": "V", "x": 4, "y": 6 }, { "orientation": "V", "x": 5, "y": 6 },
    { "orientation": "V", "x": 4, "y": 7 }, { "orientation": "V", "x": 5, "y": 7 },
    { "orientation": "V", "x": 4, "y": 8 }, { "orientation": "V", "x": 5, "y": 8 },
    { "orientation": "H", "x": 0, "y": 4 }, { "orientation": "H", "x": 0, "y": 5 },
    { "orientation": "H", "x": 1, "y": 4 }, { "orientation": "H", "x": 1, "y": 5 },
    { "orientation": "H", "x": 2, "y": 4 }, { "orientation": "H", "x": 2, "y": 5 },
    { "orientation": "H", "x": 3, "y": 4 }, { "orientation": "H", "x": 3, "y": 5 },
    { "orientation": "H", "x": 5, "y": 4 }, { "orientation": "H", "x": 5, "y": 5 },
    { "orientation": "H", "x": 6, "y": 4 }, { "orientation": "H", "x": 6, "y": 5 },
    { "orientation": "H", "x": 7, "y": 4 }, { "orientation": "H", "x": 7, "y": 5 },
    { "orientation": "H", "x": 8, "y": 4 }, { "orientation": "H", "x": 8, "y": 5 }
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
          "count": 2,
          "body": [
            { "op": "MOVE_FWD" },
            { "op": "PLACEHOLDER", "hintCategory": "item" },
            { "op": "MOVE_FWD" },
            { "op": "PLACEHOLDER", "hintCategory": "item" }
          ]
        },
        { "op": "MOVE_BACK", "repeat": 4 },
        { "op": "PLACEHOLDER", "hintCategory": "turn" }
      ]
    }
  ]
}
```

### Canonical Solution (`referenceSolution` — `10` flat closer-inclusive blocks)

```json
{
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        {
          "op": "LOOP_START",
          "count": 2,
          "body": [
            { "op": "MOVE_FWD" },
            { "op": "PICK_UP" },
            { "op": "MOVE_FWD" },
            { "op": "USE_DROP" }
          ]
        },
        { "op": "MOVE_BACK", "repeat": 4 },
        { "op": "TURN_RIGHT" }
      ]
    }
  ]
}
```

### Step-by-Step Trace

| Outer Iter | Heading | Inner `1/2` Pickup → Drop | Inner `2/2` Pickup → Drop | Return (`MOVE_BACK×4` + `TR`) | Switches Lit |
| :---: | :--- | :--- | :--- | :--- | :---: |
| `1/4` | `NORTH` | `(4,3) 📦` → `(4,2) 🟤` | `(4,1) 📦` → `(4,0) 🟤` | `(4,4) EAST` | `2/8` |
| `2/4` | `EAST` | `(5,4) 📦` → `(6,4) 🟤` | `(7,4) 📦` → `(8,4) 🟤` | `(4,4) SOUTH` | `4/8` |
| `3/4` | `SOUTH` | `(4,5) 📦` → `(4,6) 🟤` | `(4,7) 📦` → `(4,8) 🟤` | `(4,4) WEST` | `6/8` |
| `4/4` | `WEST` | `(3,4) 📦` → `(2,4) 🟤` | `(1,4) 📦` → `(0,4) 🟤` | **`(4,4) NORTH 🏁`** | **`8/8 ✅`** |
