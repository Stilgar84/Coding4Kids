# func.6: Double Stack Reversal

- **Header ID:** `func.6` (Legacy `4.6`)
- **Format:** 🏗️ Puzzle
- **Environment:** [🏗️ Automated Depot](../../envs/depot.md)
- **One-Concept Goal:** Observe that transferring a 4-ring stack once (`F1`: `Stack 1 → Stack 2`) reverses its color order (`LIFO`), and defining a second helper `F2` (`Stack 2 → Stack 3`) reverses it a *second* time — restoring the original bottom-to-top ring order without rewriting the loop in `Main` (`reverse(reverse(X)) = X`).

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

In `loop.9`, moving four rings from `Stack 1` to `Stack 2` flipped their color order upside down because the crane can only grab the **top** ring! Here `F1` already has that `Stack 1 → Stack 2` move ready. Build `F2` to move the four rings again from `Stack 2` to `Stack 3`, then call `F2` right after `F1` in `Main` — flipping an upside-down stack twice turns it right-side up again!

</details>

---

## Learner UI & Platform Config

- **Learner-Facing Text:** `0` words (100% Zero-Reading Rule; no `"crates"`, no `🔒` on lower rings, no `BackpackHud` `🎒`).
- **Enabled Scope Tabs (`allowedScopes`):** `["MAIN", "F1", "F2"]` (`F3` hidden).
- **Allow Recursion (`allowRecursion`):** `false`
- **Palette:**
  - `allowedSimBlocks`: `["DEPOT_MOVE_TO", "DEPOT_GRAB", "DEPOT_PLACE"]` *(Uniform Color Rings mode; `DEPOT_SEND_OUT` hidden)*
  - `allowedControlBlocks`: `["LOOP_START", "LOOP_END", "CALL_FN"]` (`MAIN` allows `F1, F2`; `F1` & `F2` hide `CALL_FN` or allow only non-cyclic calls — actually `F1`/`F2` hide `CALL_FN` in `func.6` so learners compose cleanly from `MAIN`!)
  - `allowedBlockParams`: `{ "DEPOT_MOVE_TO": ["STACK_1", "STACK_2", "STACK_3"], "LOOP_START": { "repeat": [2, 3, 4, 5] } }`
  - `allowRepeatBadges`: `false`
  - `allowActionParams`: `true` (`DEPOT_MOVE_TO` target badge `1 / 2 / 3`)
- **Slot Trays & Edit Delta:**
  - `slotCap`: `{ "perScope": { "MAIN": 3, "F1": 6, "F2": 8 }, "maxTotal": 17 }` (`sum(perScope) = 17 == maxTotal`)
  - **Atomic Pair-Insertion:** `LOOP_START` in `F2` inserts `[LOOP_START, LOOP_END]` (`2` slots), leaving `4` body slots.
  - **Canonical Solution Count:** `2 (MAIN) + 6 (F1) + 6 (F2) = 14` flat blocks.
  - **Edit Delta:** **`7`** (`1` `CALL_FN F2` replacing `?` in `MAIN` + `6` blocks authored in `F2`, within `≤ 6–8`).
  - **Bypass Mathematical Proof:** Moving 4 rings across 3 stacks requires `4 × 4 = 16` primitive `MOVE/GRAB/PLACE` ops (`8` moves per reversal); `MAIN` (`3` slots) cannot express `16` steps inline and `F1` is pre-filled for `S1 → S2`, so defining & calling `F2` (`S2 → S3`) in `MAIN` is the direct intended path.
- **UI Coach Spotlights (`uiSpotlights`):** `["depot-ghost-target-stack-3", "scope-tab-f2", "lifo-double-reversal"]`
- **Environment Flags (`envConfig`):**
  - `activeStationsMask`: `0x07` (`STACK_1`, `STACK_2`, `STACK_3` rendered only; `INPUT`, `QUEUE`, `OUTPUT` hidden)
  - `enforceHanoiRule`: `false`
  - `workerStation`: `"STACK_1"`

---

## Depot Setup & Coordinates (`STACK 1..3`)

- **Stations Rendered (`activeStationsMask: 0x07`):**
  - `STACK_1` (`0`)
  - `STACK_2` (`1`)
  - `STACK_3` (`2`) *(renders dashed 25%-opacity ghost silhouettes from bottom `yellow` to top `red`!)*
- **Initial Stacks (`bottom → top`):**
  ```json
  {
    "STACK_1": ["yellow", "green", "blue", "red"],
    "STACK_2": [],
    "STACK_3": []
  }
  ```
- **Target Stacks (`bottom → top`, identical order preserved!):**
  ```json
  {
    "STACK_1": [],
    "STACK_2": [],
    "STACK_3": ["yellow", "green", "blue", "red"]
  }
  ```

```text
  ┌────────┐   ┌────────┐   ┌────────┐
  │STACK 1 │   │STACK 2 │   │STACK 3 │ (Target Ghosts)
  │ [🔴]   │   │        │   │  ┆🔴┆  │
  │ [🔵]   │   │        │   │  ┆🔵┆  │
  │ [🟢]   │   │        │   │  ┆🟢┆  │
  │ [🟡]   │   │        │   │  ┆🟡┆  │
  │ ═╧══╧═ │   │ ═╧══╧═ │   │ ═╧══╧═ │
  │ [ 1  ] │   │ [ 2  ] │   │ [ 3  ] │
  └────────┘   └────────┘   └────────┘
```

---

## Workspaces & Solutions

### Initial Starter Workspace (`Edit Delta: 7`)
*(Clean `PLACEHOLDER` in `MAIN` — removes any legacy leaked `station` payload on placeholder blocks; pre-fills `F1` directly from `loop.9` so the learner builds `F2` + drops `CALL F2` into `MAIN`!)*
- **`MAIN` (`2` blocks in `3`-slot tray):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "PLACEHOLDER", "hintCategory": "function" }
  ]
  ```
- **`F1` (`6` flat blocks, pre-filled from `loop.9`):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
        { "op": "DEPOT_GRAB" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "DEPOT_PLACE" }
      ]
    }
  ]
  ```
- **`F2` (`0` blocks in `8`-slot tray):** `[]`

### Partial / Clue Workspace (Clue Reveal)
- **`MAIN`:** `[CALL_FN F1, CALL_FN F2]`
- **`F1`:** `[LOOP_START ×4, DEPOT_MOVE_TO(STACK_1), DEPOT_GRAB, DEPOT_MOVE_TO(STACK_2), DEPOT_PLACE, LOOP_END]`
- **`F2`:** `[LOOP_START ×4, DEPOT_MOVE_TO(STACK_2), PLACEHOLDER("item"), DEPOT_MOVE_TO(STACK_3), PLACEHOLDER("item"), LOOP_END]`

### Canonical Full Solution (`2 + 6 + 6 = 14` flat blocks)
- **`MAIN` (`2` blocks):**
  ```json
  [
    { "op": "CALL_FN", "fn": "F1" },
    { "op": "CALL_FN", "fn": "F2" }
  ]
  ```
- **`F1` (`6` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_1" },
        { "op": "DEPOT_GRAB" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "DEPOT_PLACE" }
      ]
    }
  ]
  ```
- **`F2` (`6` flat blocks):**
  ```json
  [
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "DEPOT_MOVE_TO", "station": "STACK_2" },
        { "op": "DEPOT_GRAB" },
        { "op": "DEPOT_MOVE_TO", "station": "STACK_3" },
        { "op": "DEPOT_PLACE" }
      ]
    }
  ]
  ```

#### Execution Trace
1. **Initial:** `S1: [yellow, green, blue, red]`, `S2: []`, `S3: []` (claw empty at `STACK_1`).
2. **After `CALL_FN F1` (1st Reversal — `S1 → S2`):**
   - Grab `red` → `S2:[red]`
   - Grab `blue` → `S2:[red, blue]`
   - Grab `green` → `S2:[red, blue, green]`
   - Grab `yellow` → `S2:[red, blue, green, yellow]` (`S1: []`)
3. **After `CALL_FN F2` (2nd Reversal — `S2 → S3`):**
   - Grab `yellow` → `S3:[yellow]`
   - Grab `green` → `S3:[yellow, green]`
   - Grab `blue` → `S3:[yellow, green, blue]`
   - Grab `red` → **`S3: [yellow, green, blue, red]`** (`S2: []`, claw empty) ✅ **Exact `targetStacks` match!**

---

## Edge Cases & Acceptance Criteria
- **Starter Failure Check:** Running Starter runs only `CALL_FN F1`, leaving all 4 rings reversed in `STACK_2` and `STACK_3` empty → **FAILS cleanly**.
- **Placeholder Purity Check:** Starter `PLACEHOLDER` carries only `hintCategory: "function"` (zero stray station payload).
- **Terminology Check:** Zero `"crates"`, zero `SCRAP`, zero `🔒` locks anywhere in visuals or adult tooltip (`Uniform Color Rings`).
