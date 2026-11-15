# Lesson while.1: Conditional Loops (`While`)

**ID:** `while.1` · **Format:** 🤖 Core Multi-Run Puzzle (`4` Simultaneous Maps) · **Env:** [Robot Grid](../../envs/robot_grid.md)
**One-Concept Goal:** Chain two `While` loops sequentially—proving execution resumes normally after `End While`—to navigate `4` L-shaped tunnels of varying leg lengths (`(2,3)`, `(5,2)`, `(3,5)`, `(6,4)`).

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> Fixed repeat counts won't work here because all four L-shaped tunnels have different lengths! Keep the pre-placed first `While (pathAhead)` loop to drive to the corner wall, turn `Right`, and add a second `While` loop after `End While` to walk down to the checkered flag.
> *(Learner Workspace Rule: **0** learner-facing words — visual corner radar pulses & `[1 ✓] [2 ✗] [3 ·] [4 ·]` run pips drive discovery.)*

</details>

---

## 1. Palette, Sensor & Budget Contract

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `MOVE_FWD`, `TURN_LEFT`, `TURN_RIGHT` |
| **`allowedControlBlocks`** | `WHILE` (+ paired `END_WHILE`) |
| **`allowedSensors`** | `pathAhead`, `atGoal` |
| **`allowedCombinators`** | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` (`Loop ×N` excluded; action repeat pills locked) |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN` / `false` / `false` |
| **`slotCap`** | `7` (`perScope.MAIN: 7`, `maxTotal: 7`) |
| **`starterBlocks`** | `3` (`While (pathAhead) { MOVE_FWD } End While`) |
| **`editDelta`** | `4` (`+TURN_RIGHT`, `+While`, `+MOVE_FWD`, `+End While`; `<= 6–8` Core Limit) |
| **`antiBypassRules`** | `4` unequal L-tunnel shapes (`L1 ∈ {2,3,5,6}`, `L2 ∈ {2,3,4,5}`); total straight steps `{5,7,8,10}` defeat any single `While (pathAhead)` (stops at corner `(L1,0)`) and any hardcoded repeat sequence. |

---

## 2. Four Simultaneous Variant L-Tunnel Maps

Every map uses tight `1`-tile-wide L-corridors carved along `y = 0` from `(0,0)` to `(L1, 0)` and down `x = L1` from `(L1, 0)` to `(L1, L2)`. All other interior edges are walled (`H`/`V` follow [robot_grid.md](../../envs/robot_grid.md): `V(x,y)` left of `(x,y)`, `H(x,y)` top of `(x,y)`):

- **Map 1 (`3×4`, `(L1=2, L2=3)`):** `Start: (0,0) East`, `Goal: (2,3)`
  `V: [[2,1],[2,2],[2,3]]` · `H: [[0,1],[1,1]]` *(outer border encloses `3×4`)*
  ```text
  +---+---+---+
  | S→        |
  +---+---+   +
  | x | x |   |
  +---+---+   +
  | x | x |   |
  +---+---+   +
  | x | x | 🏁|
  +---+---+---+
  ```
- **Map 2 (`6×3`, `(L1=5, L2=2)`):** `Start: (0,0) East`, `Goal: (5,2)`
  `V: [[5,1],[5,2]]` · `H: [[0,1],[1,1],[2,1],[3,1],[4,1]]`
  ```text
  +---+---+---+---+---+---+
  | S→                    |
  +---+---+---+---+---+   +
  | x | x | x | x | x |   |
  +---+---+---+---+---+   +
  | x | x | x | x | x | 🏁|
  +---+---+---+---+---+---+
  ```
- **Map 3 (`4×6`, `(L1=3, L2=5)`):** `Start: (0,0) East`, `Goal: (3,5)`
  `V: [[3,1],[3,2],[3,3],[3,4],[3,5]]` · `H: [[0,1],[1,1],[2,1]]`
- **Map 4 (`7×5`, `(L1=6, L2=4)`):** `Start: (0,0) East`, `Goal: (6,4)`
  `V: [[6,1],[6,2],[6,3],[6,4]]` · `H: [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1]]`

*(In unreachable sealed cells marked `x`, `H` and `V` walls isolate only the open L-corridor `(0..L1, 0)` and `(L1, 0..L2)`.)*

---

## 3. Starter, Clue Reveal & Canonical Reference Solution

### Starter (`MAIN: 3 flat blocks`)
```text
While (pathAhead)
  MOVE_FWD
End While
```

### Clue Reveal (`partialHelp` — `MAIN: 7` slots with `?` cues)
```text
While (pathAhead)
  MOVE_FWD
End While
TURN_RIGHT
While (? ("sensor"))
  ? ("move")
End While
```

### Canonical Reference Solution (`MAIN: 7 flat blocks`)
```text
While (pathAhead)
  MOVE_FWD
End While
TURN_RIGHT
While (pathAhead)
  MOVE_FWD
End While
```
*(Behavioral equivalence: replacing the second `While (pathAhead)` with `While (NOT atGoal)` is equally `7` flat blocks and also passes all `4` maps cleanly via End-of-Program Goal Evaluation.)*

---

## 4. Multi-Run Execution Trace

| Map | First `While (pathAhead)` | Corner Action | Second `While (pathAhead)` | Total Moves | End-of-Program Result |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Map 1 (`3×4`)** | `(0,0)->(2,0)E`, wall stop | `TURN_RIGHT` → `(2,0)S` | `(2,0)->(2,3)S`, wall stop | `6` | `(2,3,S)` on Goal → `[1 ✓]` |
| **Map 2 (`6×3`)** | `(0,0)->(5,0)E`, wall stop | `TURN_RIGHT` → `(5,0)S` | `(5,0)->(5,2)S`, wall stop | `8` | `(5,2,S)` on Goal → `[2 ✓]` |
| **Map 3 (`4×6`)** | `(0,0)->(3,0)E`, wall stop | `TURN_RIGHT` → `(3,0)S` | `(3,0)->(3,5)S`, wall stop | `9` | `(3,5,S)` on Goal → `[3 ✓]` |
| **Map 4 (`7×5`)** | `(0,0)->(6,0)E`, wall stop | `TURN_RIGHT` → `(6,0)S` | `(6,0)->(6,4)S`, wall stop | `11` | `(6,4,S)` on Goal → `[4 ✓]` |
