# Lesson `seq.0` — How Programs Run & Robot Point-of-View

> [← Module `seq` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md) · **ID:** `seq.0` (Legacy Alias: `1.0`)

**One-Concept Goal:** Introduce top-to-bottom block execution and egocentric rotation (turning from the robot's own visor orientation—both facing North and upside-down facing South) through 3 short runnable demos with zero reading required.

<details>
<summary>📖 Parent / Teacher Tip (Adult Context — Collapsed by Default)</summary>

Programs run strictly one block at a time from top to bottom. Turning (`Turn Left` / `Turn Right`) rotates the robot **on the same tile** without stepping forward—and "left" or "right" always depends on where the robot's eyes/visor point, not the child's screen left or right. Encourage your learner to press **⏭ Step** (`btn-step`) or **▶ Play** (`btn-play`) across all three tabs (`[1]`, `[2]`, `[3]`) before tapping **Continue (`→`)**.

</details>

---

## Palette, Scopes, Flags & UI Spotlights

- **Allowed Blocks (`allowedSimBlocks`):** `["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"]`
- **Allowed Control Blocks (`allowedControlBlocks`):** `[]`
- **Action Parameters / Repeat Badges:** `allowActionParams: false`, `allowRepeatBadges: false`, `allowVariables: false`
- **Allowed Scope Tabs:** `["MAIN"]` (`allowRecursion: false`)
- **Slot Cap (`slotCap`):** `null` *(read-only demo tabs; no puzzle validation)*
- **Environment Flags:** `strictInteractionCollision: false`, `requireAllItemsCollected: false`, `requireEmptyBackpackAtGoal: false`
- **UI Coach Spotlights (`pointer-events-none`):**
  - Coach pulse rings rendered underneath `btn-play` (`▶`) and `btn-step` (`⏭`) in the `<header>` without blocking clicks.
  - Per-tab canvas/workspace spotlights: `["execution-order"]` (Tab 1), `["egocentric-pov", "rotation-in-place"]` (Tab 2), `["egocentric-pov", "south-pov-turn"]` (Tab 3).

---

## Demo Tabs (`demoTabs[]`)

### Tab 1 (`seq.0-tab-1`): ▶️ 1 — Top-to-Bottom Stepping
- **Grid:** `3×3`, `startPose: (1, 2, NORTH)`
- **Goal (`flags[]`):** `[{"id": "goal_seq_0_t1", "x": 1, "y": 0, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `V(1,0), V(2,0), V(1,1), V(2,1), V(1,2), V(2,2)` *(framing center vertical lane)*
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| . | G | . |
+   +   +   +
| . | . | . |
+   +   +   +
| . | RN| . |
+---+---+---+
```

- **Code (`MAIN`, `2` flat blocks):**
  1. `MOVE_FWD`
  2. `MOVE_FWD`
- **Trace:** `(1,2)N` → Step 1 `(1,1)N` → Step 2 `(1,0)N` (`Goal 🏁`, `SUCCESS` preview).

---

### Tab 2 (`seq.0-tab-2`): 👀 2 — Turn Rotates in Place (Facing North)
- **Grid:** `3×3`, `startPose: (0, 1, NORTH)`
- **Goal (`flags[]`):** `[{"id": "goal_seq_0_t2", "x": 2, "y": 1, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `H(0,1), H(1,1), H(2,1), H(0,2), H(1,2), H(2,2)` *(horizontal middle corridor)*
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| .   .   . |
+---+---+---+
| RN  .   G |
+---+---+---+
| .   .   . |
+---+---+---+
```

- **Code (`MAIN`, `3` flat blocks):**
  1. `TURN_RIGHT` *(Spotlights visor turning `NORTH → EAST` while tile stays `(0, 1)`)*
  2. `MOVE_FWD`
  3. `MOVE_FWD`
- **Trace:** `(0,1)N` → Step 1 `(0,1)E` → Step 2 `(1,1)E` → Step 3 `(2,1)E` (`Goal 🏁`, `SUCCESS` preview).

---

### Tab 3 (`seq.0-tab-3`): 🔄 3 — Robot Point-of-View (Facing South)
- **Grid:** `3×3`, `startPose: (2, 0, SOUTH)`
- **Goal (`flags[]`):** `[{"id": "goal_seq_0_t3", "x": 1, "y": 1, "isGoal": true, "order": 1}]`
- **Walls (`barriers[]`):** `V(2,0), H(1,1), V(1,1), H(1,2), H(2,2)`
- **Items / Water / Gates / Switches:** All `[]`

```text
+---+---+---+
| .   . | RS|
+   +---+   +
| . | G   . |
+   +---+---+
| .   .   . |
+---+---+---+
```

- **Code (`MAIN`, `3` flat blocks):**
  1. `MOVE_FWD`
  2. `TURN_RIGHT` *(Spotlights robot turning `SOUTH → WEST` — screen-left is the South-facing robot's own right!)*
  3. `MOVE_FWD`
- **Trace:** `(2,0)S` → Step 1 `(2,1)S` → Step 2 `(2,1)W` → Step 3 `(1,1)W` (`Goal 🏁`, `SUCCESS` preview).

---

## Initial Starter Workspace (`starterWorkspace`)

Mirrors Tab 1 (`[MOVE_FWD, MOVE_FWD]`, `2` blocks) so pressing Play immediately works if the demo workspace is inspected.
