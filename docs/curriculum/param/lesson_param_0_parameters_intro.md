# `param.0`: Action Repeat Badges Intro (`📖 🤖`)

- **Activity ID:** `param.0` *(Stage 2 addition — bridges `seq.A` to `param.1`)*
- **Format:** `explanation` (`demoTabs` comparison)
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `📖 🤖`
- **Concept:** Equivalence Between Repeated Separate Blocks and a Single `[×N]` Parameter Badge

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

Before facing the locked 5-slot tray in `param.1`, learners run two tabs side-by-side on an identical straight runway: **Tab 1** uses five separate `MOVE_FWD` blocks from Module `seq`, while **Tab 2** collapses the exact same 5-cell sprint into **one** `MOVE_FWD` block wearing a `×5` badge. Tap **Play** or **Step** on both tabs so kids see the robot land on `🏁` identically—even though Tab 2 uses 80% fewer blocks.

</details>

## Palette, SlotCap & Validation Flags

- **Palette (`PaletteConfig`):**
  ```json
  {
    "allowedSimBlocks": ["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT"],
    "allowedControlBlocks": [],
    "allowedScopes": ["MAIN"],
    "allowRepeatBadges": true,
    "allowActionParams": false,
    "allowedBlockParams": { "repeat": [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    "allowVariables": false,
    "allowRecursion": false
  }
  ```
- **SlotCap (`SlotCapConfig`):** `null` (sandboxed explanation tabs; learner can also experiment on Tab 2)
- **Env Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **Anti-Bypass Rules:** `null` (explanation mode)
- **UI & Coach Spotlights:**
  - `execution-order`: active step halo pulses as `MOVE_FWD ×5` counts down ticks `5 -> 4 -> 3 -> 2 -> 1` in Tab 2 vs. five separate blocks in Tab 1.
  - `repeat-badge-pill`: pulsing glow ring around the green `[×5]` badge pill on block #1 in Tab 2, showing visual tap affordance `[×1 ↔ ×9]`.

## Initial World State (Shared Across Both Tabs)

- **Grid:** `6×5` (`x = 0..5, y = 0..4`), Robot start: `(0, 2)` facing `EAST`
- **Flags:** `[{"id": "goal_param_0", "x": 5, "y": 2, "isGoal": true, "order": 1}]` (shuttered `🏁` goal pad)
- **Barriers (walled horizontal lane along row `y = 2`):**
  - `H(0,2)..H(5,2)` (top walls of row 2) and `H(0,3)..H(5,3)` (bottom walls of row 2)

```text
+---+---+---+---+---+---+
| .   .   .   .   .   . |
+   +   +   +   +   +   +
| .   .   .   .   .   . |
+---+---+---+---+---+---+
| RE  .   .   .   .   🏁 |   <- y=2: walled 6-cell runway
+---+---+---+---+---+---+
| .   .   .   .   .   . |
+   +   +   +   +   +   +
| .   .   .   .   .   . |
+---+---+---+---+---+---+
```

## Demo Tabs (`demoTabs`)

### Tab 1 (`param-0-tab-1`): `🧱 1 — Five Separate Blocks (Seq Way)`
- **Total Flat Blocks (`blocks.length`):** `5`
- **MAIN:**
  1. `MOVE_FWD` (`×1`)
  2. `MOVE_FWD` (`×1`)
  3. `MOVE_FWD` (`×1`)
  4. `MOVE_FWD` (`×1`)
  5. `MOVE_FWD` (`×1`)
- **Step Trace:** `(0,2,E)` -> `(1,2)` -> `(2,2)` -> `(3,2)` -> `(4,2)` -> `(5,2) 🏁`.

### Tab 2 (`param-0-tab-2`): `🔢 2 — One Block ×5 (Param Way)` *(Default Starter)*
- **Total Flat Blocks (`blocks.length`):** `1`
- **MAIN:**
  1. `MOVE_FWD` (`repeat: 5`)
- **Step Trace:** `(0,2,E)` -> ticks 5 cells East `(1,2)->(2,2)->(3,2)->(4,2)->(5,2) 🏁`.

## Verification Checklist
- [x] Zero learner prose; adult context inside collapsible tip only.
- [x] Tab 1 (`5` blocks) and Tab 2 (`1` block with `×5`) produce identical simulation trajectories to `(5,2)`.
- [x] Introduces `[×N]` badge pill visually before `param.1`'s locked `5`-slot tray.
