# `param.7`: Interactive World Objects Intro (`📖 🤖`)

- **Activity ID:** `param.7` *(Legacy Alias: `2.6` — cleanly renumbered after `param.6` / `param.C`)*
- **Format:** `explanation` (`demoTabs` — 3 isolated single-concept tabs)
- **Simulation:** `grid` ([Robot Grid](../../envs/robot_grid.md))
- **Icon:** `📖 🤖`
- **Concept:** 1-Slot On-Robot Carry Rules — Key->Gate (**1 Cell Ahead**), Plank->Water (**1 Cell Ahead**, Retrievable), Crate->Floor Switch (**Current Tile**)

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only Reference — Never Rendered to Learners)</summary>

Step through all **three** interactive tabs before solving the upcoming Grid object puzzles (`param.8`, `param.9`, `param.10`):
1. **Tab 1 — Key & Matching Gate:** Stand on the key, press `PICK_UP` (notice the key moves onto the **robot's upper-right shoulder gripper**—there is no backpack HUD), then walk in front of the **color + shape matching** gate and press `USE_DROP` to unlock the tile **1 cell ahead** (consuming the key).
2. **Tab 2 — Plank & Water Gap:** `USE_DROP` lays a plank across water **1 cell ahead**, letting you walk right over it—and you can even turn around and call `PICK_UP` from **1 cell behind/ahead** to reuse the same plank again!
3. **Tab 3 — Crate & Floor Switch:** Carry a crate onto a pressure switch and call `USE_DROP` to drop it directly onto the **current tile** (`isPressed = hasCrateOnTile || hasRobotOnTile`), holding the linked door open permanently after the robot walks away!
*(All object interactions enforce `strictInteractionCollision: true` with a max of `1` item per tile.)*

</details>

## Palette, SlotCap & Environment Flags

- **Palette (`PaletteConfig`):**
  ```json
  {
    "allowedSimBlocks": ["MOVE_FWD", "MOVE_BACK", "TURN_LEFT", "TURN_RIGHT", "PICK_UP", "USE_DROP"],
    "allowedControlBlocks": [],
    "allowedScopes": ["MAIN"],
    "allowRepeatBadges": true,
    "allowActionParams": false,
    "allowedBlockParams": { "repeat": [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    "allowVariables": false,
    "allowRecursion": false
  }
  ```
- **SlotCap (`SlotCapConfig`):** `null`
- **Env & Validation Flags (ALL 3 Tabs):**
  - `strictInteractionCollision: true` *(gentle bump feedback if `PICK_UP` or `USE_DROP` targets an empty/full/incompatible tile)*
  - Max `1` item/stack per floor tile and `1`-slot robot gripper capacity
  - **Carried Item UI (`ui_guidelines.md`):** Rendered directly in the **robot's upper-right shoulder gripper** at upright `0°` screen orientation with white outline halo (**`BackpackHud` retired globally**)
  - **Switch State Formula:** `isPressed = hasCrateOnTile || hasRobotOnTile`
  - **Spotlights:** `["execution-order", "world-item", "shoulder-gripper"]`

---

## Demo Tabs (`demoTabs`)

### Tab 1 (`param-7-tab-1`): `🔑 1 — Key & Locked Gate` (`4×3`, `5` blocks — *Default Starter*)
- **Grid:** `4×3` (`x = 0..3, y = 0..2`), Robot start: `(0, 1, EAST)`
- **Objects:**
  - `worldItems`: `[{"id": "key_2_6_t1", "type": "key", "x": 1, "y": 1, "shape": "circle", "color": "amber"}]`
  - `lockedGates`: `[{"id": "gate_2_6_t1", "x": 2, "y": 1, "shape": "circle", "color": "amber", "unlocked": false}]`
  - `flags`: `[{"id": "goal_2_6_tab1", "x": 3, "y": 1, "isGoal": true, "order": 1}]` (`🏁`)
  - `barriers`: `H(0,1)..H(3,1)`, `H(0,2)..H(3,2)` *(enclosed middle lane)*
```text
+---+---+---+---+
| .   .   .   . |
+---+---+---+---+
| RE  K   L   🏁 |   <- (0,1)=RE, (1,1)=Amber Circle Key, (2,1)=Gate, (3,1)=Goal
+---+---+---+---+
| .   .   .   . |
+---+---+---+---+
```
- **MAIN (`blocks.length = 5`):** `1. MOVE_FWD` -> `2. PICK_UP` -> `3. USE_DROP` *(1 ahead at `(2,1)`)* -> `4. MOVE_FWD` -> `5. MOVE_FWD`.

### Tab 2 (`param-7-tab-2`): `🪵 2 — Plank & Water Gap` (`4×3`, `5` blocks)
- **Grid:** `4×3` (`x = 0..3, y = 0..2`), Robot start: `(0, 1, EAST)`
- **Objects:**
  - `waterCells`: `[{"x": 2, "y": 1}]`
  - `worldItems`: `[{"id": "plank_2_6_t2", "type": "plank", "x": 1, "y": 1}]`
  - `flags`: `[{"id": "goal_2_6_tab2", "x": 3, "y": 1, "isGoal": true, "order": 1}]` (`🏁`)
  - `barriers`: `H(0,1)..H(3,1)`, `H(0,2)..H(3,2)`
```text
+---+---+---+---+
| .   .   .   . |
+---+---+---+---+
| RE  P   ~   🏁 |   <- (0,1)=RE, (1,1)=Plank, (2,1)=Water, (3,1)=Goal
+---+---+---+---+
| .   .   .   . |
+---+---+---+---+
```
- **MAIN (`blocks.length = 5`):** `1. MOVE_FWD` -> `2. PICK_UP` -> `3. USE_DROP` *(bridges `(2,1)` 1 ahead)* -> `4. MOVE_FWD` -> `5. MOVE_FWD`.

### Tab 3 (`param-7-tab-3`): `📦 3 — Crate & Floor Switch` (`5×3`, `5` blocks)
- **Grid:** `5×3` (`x = 0..4, y = 0..2`), Robot start: `(0, 1, EAST)`
- **Objects:**
  - `worldItems`: `[{"id": "crate_2_6_t3", "type": "crate", "x": 1, "y": 1}]`
  - `floorSwitches`: `[{"id": "sw_2_6_t3", "x": 2, "y": 1, "linkedGateId": "gate_2_6_t3", "requiredForGoal": false}]`
  - `lockedGates`: `[{"id": "gate_2_6_t3", "x": 3, "y": 1, "shape": "diamond", "color": "purple", "unlocked": false, "linkedSwitchId": "sw_2_6_t3"}]`
  - `flags`: `[{"id": "goal_2_6_tab3", "x": 4, "y": 1, "isGoal": true, "order": 1}]` (`🏁`)
  - `barriers`: `H(0,1)..H(4,1)`, `H(0,2)..H(4,2)`
```text
+---+---+---+---+---+
| .   .   .   .   . |
+---+---+---+---+---+
| RE  C   S   L   🏁 |   <- (1,1)=Crate, (2,1)=Switch, (3,1)=Linked Door, (4,1)=Goal
+---+---+---+---+---+
| .   .   .   .   . |
+---+---+---+---+---+
```
- **MAIN (`blocks.length = 5`):** `1. MOVE_FWD` -> `2. PICK_UP` -> `3. MOVE_FWD` *(steps onto switch `(2,1)`)* -> `4. USE_DROP` *(drops Crate on current tile `(2,1)`!)* -> `5. MOVE_FWD ×2`.

## Verification Checklist
- [x] Three isolated tabs obey `1–3` tab spec without blending Key, Plank, and Crate rules in one example.
- [x] Replaces retired `BackpackHud` text with direct upper-right robot shoulder gripper rendering and shuttered `🏁` goal pad.
- [x] Explicitly specifies `strictInteractionCollision: true` and `isPressed = hasCrateOnTile || hasRobotOnTile`.
