# `param.1`: Action Repeat Badges (`🤖`)

- **Activity ID:** `param.1` *(Legacy Alias: `2.1`)*
- **Format:** `puzzle`
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `🤖`
- **Concept:** Compressing Straight Runs Inside a Physical 5-Slot Tray Using `×2..×9` Repeat Badges

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

The tray only holds **5 slots** (`[□][□][□][□][□]`), whereas walking the U-shaped outer corridor one cell at a time takes **15 blocks**. Encourage your child to tap the `×N` badge pill on `MOVE_FWD` so the top corridor (`×5`) and the right/bottom corridors (`×4` each) fit cleanly in 5 slots. The two `?` scaffold slots help isolate which runs need distance badges without giving away the answer.

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
- **SlotCap (`SlotCapConfig`):** `{ "maxTotal": 5, "perScope": { "MAIN": 5 } }`
- **Edit Delta Budget:** `2` from `partialHelp` (or `5` from blank; `≤ 6–8` Early Puzzle guardrail)
- **Env Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **Anti-Bypass Rules:**
  - `2.1-require-repeat-badges`: Cannot solve the `6×5` U-corridor within `5` slots when `allowRepeatBadges: false` (unrolled minimum = `15` blocks: `5 + 1 + 4 + 1 + 4`).
- **UI & Coach Spotlights:**
  - Locked `5`-slot physical tray bar (`5 / 5`) clearly visible under `MAIN`.
  - Pulsing amber highlight on `PLACEHOLDER` slots #3 and #5 when `partialHelp` mode is active.

## Initial World State (Grid)

- **Grid:** `6×5` (`x = 0..5, y = 0..4`), Robot start: `(0, 0)` facing `EAST`
- **Flags:** `[{"id": "goal_2_1", "x": 1, "y": 4, "isGoal": true, "order": 1}]` (shuttered `🏁` pad)
- **Barriers (`13` segments forming U-corridor):**
  - Horizontal walls: `H(0,1), H(1,1), H(2,1), H(3,1), H(4,1)` and `H(1,4), H(2,4), H(3,4), H(4,4)`
  - Vertical walls: `V(5,1), V(5,2), V(5,3), V(1,4)`

```text
+---+---+---+---+---+---+
| RE  .   .   .   .   . |  <- y=0: open across x=0..5 (5 steps East!)
+---+---+---+---+---+   +
| .   .   .   .   . | . |  <- y=1: col 5 open downward; interior blocked
+   +   +   +   +   +   +
| .   .   .   .   . | . |  <- y=2
+   +   +   +   +   +   +
| .   .   .   .   . | . |  <- y=3
+   +---+---+---+---+   +
| . | 🏁  .   .   .   . |  <- y=4: V(1,4) seals left edge; Goal at (1,4) (4 steps West!)
+---+---+---+---+---+---+
```

## Workspaces & Canonical Solution

### Starter Workspace (`starterWorkspace`)
- Empty `5`-slot tray (`[]`, `Edit Delta = 5` from blank).

### Partial Help (`partialHelp`, mode=`scaffold`)
- **MAIN (`5` slots, `Edit Delta = 2`):**
  1. `MOVE_FWD` (`repeat: 5`)
  2. `TURN_RIGHT`
  3. `PLACEHOLDER {"hintCategory": "motion"}`
  4. `TURN_RIGHT`
  5. `PLACEHOLDER {"hintCategory": "motion"}`

### Canonical Solution (`referenceSolution`)
- **MAIN (`5` blocks `blocks.length = 5`, Tray `5 / 5`):**
  1. `MOVE_FWD` (`repeat: 5`)
  2. `TURN_RIGHT`
  3. `MOVE_FWD` (`repeat: 4`)
  4. `TURN_RIGHT`
  5. `MOVE_FWD` (`repeat: 4`)

- **Step Trace:**
  1. `(0,0,E)` -> `MOVE_FWD ×5` -> `(5,0,E)`
  2. `TURN_RIGHT` -> `(5,0,S)`
  3. `MOVE_FWD ×4` -> `(5,4,S)`
  4. `TURN_RIGHT` -> `(5,4,W)`
  5. `MOVE_FWD ×4` -> `(1,4,W)` — lands cleanly on shuttered `🏁`!

## Verification Checklist
- [x] Barrier walls strictly block every interior shortcut (`H(0..4,1)`, `V(5,1..3)`, `H(1..4,4)`, `V(1,4)`).
- [x] Unrolled path length = `5 + 1 + 4 + 1 + 4 = 15 > 5`; impossible without `×N` badges.
- [x] Total `blocks.length = 5`, within `≤ 8` puzzle guardrail (`Edit Delta = 5` blank / `2` scaffold).
