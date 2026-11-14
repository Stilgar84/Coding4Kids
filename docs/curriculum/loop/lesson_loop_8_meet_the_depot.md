# `loop.8` — Meet the Depot: Stackable Color Rings

> **Format**: Comprehension Demo (`📖 🏗️`) · **Module**: [`loop`](./overview.md) · **Environment**: [Depot](../../envs/depot.md) (`envVersion: 4`, Toy-Crane Workshop `v4`) · **Legacy ID**: `3.8` *(Updated to Uniform Glossy Color Rings `v4` spec)*

## One-Concept Goal

Introduce **Depot** (`envVersion: 4` Toy-Crane Workshop) in **Stack-Only onboarding mode**: **Last-In, First-Out (LIFO)** stack access on `Stack 1..3`, crane movement (`DEPOT_MOVE_TO`), picking/placing the top glossy color ring (`DEPOT_GRAB`, `DEPOT_PLACE`), and dispatching rings into the **`OUT` sky-chute** (`DEPOT_SEND_OUT`, leaving `workerStation` unchanged!).

<details>
<summary>📖 Parent / Teacher Tip</summary>

Welcome to the **Toy-Crane Workshop**! Only the **top glowing ring** on a peg can be grabbed! Watch **Demo Tab 1**: because **Blue** sits on top of **Red** in `Stack 1`, moving them one by one to `Stack 2` reverses their order (`Red` on top of `Blue`!). Now switch to **Demo Tab 2** to meet **`Send Out`**: it launches the crane's held ring straight into the top **OUT sky-chute** *without* moving the crane away from `Stack 1`! Finally, **Demo Tab 3** folds Tab 1 into a neat 6-block **`Loop Start [×2]`**!

</details>

## UI & Playground Contract

- **Zero Reading**: Stations use icon + ring numbers (`1`, `2`, `3`, `OUT` chute icon) with zero prose labels.
- **Station Mask (`activeStationsMask`)**: Stack-only onboarding — only `STACK_1`, `STACK_2`, `STACK_3` appear in Tabs 1 & 3; `OUT` unlocks in Tab 2 (`INPUT`, `QUEUE`, and `TapeDock` remain hidden until `branch`/`while`/`var`).
- **Claw & Target Ghosts**: Held ring renders directly inside the crane's **claw jaws** (`no BackpackHud` `🎒`). Target positions render as translucent dashed silhouettes on empty `Stack 2` (Tabs 1 & 3) and the `OUT` tray (Tab 2).
- **No Hanoi Size Rule**: Uniform Glossy Color Rings (`Red`, `Blue`, `Green`, `Yellow`) render with identical width (`enforceHanoiRule: false`).
- **Coach Spotlights**:
  - Tab 1: `execution-order` + `depot-stack-top` (glow shifts down from `BLUE` to `RED`).
  - Tab 2: `execution-order` + `depot-out-chute` (`DEPOT_SEND_OUT` keeps `workerStation = STACK_1`).
  - Tab 3: `execution-order` + `loop-counter` (`1/2..2/2`).

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
  "slotCap": { "maxTotal": 14 }
}
```

## Depot `v4` Setup Baseline

```json
{
  "envVersion": 4,
  "workerStation": "STACK_1",
  "clawItem": null,
  "enforceHanoiRule": false,
  "inputQueue": [],
  "targetOutput": []
}
```

*(Array convention: index `0` is **bottom** of the peg; last index is **top** of the peg.)*

## Demo Tabs (`demoTabs`)

### Tab 1 — LIFO Order Reversal (`7` flat blocks · `STACK_1..3` visible)

```json
{
  "id": "tab-depot-lifo",
  "icon": "🗼",
  "activeStationsMask": ["STACK_1", "STACK_2", "STACK_3"],
  "spotlights": ["execution-order", "depot-stack-top"],
  "stacks": [["RED", "BLUE"], [], []],
  "targetStacks": [[], ["BLUE", "RED"], []],
  "targetOutput": [],
  "MAIN": [
    { "op": "DEPOT_GRAB" },
    { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
    { "op": "DEPOT_PLACE" },
    { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
    { "op": "DEPOT_GRAB" },
    { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
    { "op": "DEPOT_PLACE" }
  ]
}
```

### Tab 2 — Instant `OUT` Sky-Chute Dispatch (`4` flat blocks · `STACK_1..3 + OUT` visible)

```json
{
  "id": "tab-depot-send-out",
  "icon": "📤",
  "activeStationsMask": ["STACK_1", "STACK_2", "STACK_3", "OUT"],
  "spotlights": ["execution-order", "depot-out-chute"],
  "stacks": [["GREEN", "RED"], [], []],
  "targetStacks": [[], [], []],
  "targetOutput": ["RED", "GREEN"],
  "MAIN": [
    { "op": "DEPOT_GRAB" },
    { "op": "DEPOT_SEND_OUT" },
    { "op": "DEPOT_GRAB" },
    { "op": "DEPOT_SEND_OUT" }
  ]
}
```

*(Notice `workerStation` stays on `STACK_1` after the first `DEPOT_SEND_OUT`, so the second `DEPOT_GRAB` immediately pops `"GREEN"` without moving!)*

### Tab 3 — Looping Stack Transfer (`6` flat blocks · `STACK_1..3` visible)

```json
{
  "id": "tab-depot-loop",
  "icon": "🔁",
  "activeStationsMask": ["STACK_1", "STACK_2", "STACK_3"],
  "spotlights": ["execution-order", "loop-counter"],
  "stacks": [["RED", "BLUE"], [], []],
  "targetStacks": [[], ["BLUE", "RED"], []],
  "targetOutput": [],
  "MAIN": [
    {
      "op": "LOOP_START",
      "count": 2,
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
