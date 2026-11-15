# Capstone while.A: The Autonomous Maze Rover

**ID:** `while.A` · **Format:** 🏆 Mastery Multi-Run Capstone (`4` Simultaneous Mazes) · **Env:** [Robot Grid](../../envs/robot_grid.md)
**One-Concept Goal:** Synthesize `While (NOT atGoal)` with `If / Else If / Else` wall sensors (`pathRight` / `pathLeft`, `pathAhead`) to solve `4` completely different **`5×5`–`6×6` spanning-tree mazes** with one unified `10`-block wall-follower program.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> No memorized path can escape all four mazes at once! Instead, teach the rover the classic **Wall-Follower Rule** inside `While (NOT atGoal)`:
> - **Right-Hand Rule:** *Can I turn Right (`pathRight`)? Turn Right & step forward! Else is ahead clear (`pathAhead`)? Step forward! Else turn Left (`TURN_LEFT`)!*
> - **Left-Hand Rule:** Same 10 blocks mirrored (`pathLeft` / `TURN_LEFT` / `pathAhead` / `TURN_RIGHT`)!
> Every maze here is a strict **simply-connected spanning tree** (zero detached islands), so *either* 10-block wall follower guarantees reaching `🏁` in under `50` moves!
> *(Learner Workspace Rule: **0** learner-facing words — radar beams ahead/left/right, checkered flag pulse, and `[1 ✓] [2 ✗] [3 ·] [4 ·]` pips guide everything visually.)*

</details>

---

## 1. Env Guarantee, Palette & Budget Contract

- **Simply-Connected Spanning-Tree Guarantee:** All `4` mazes satisfy `openEdges === (w × h) - 1`, `reachable === w × h`, and zero `2×2` open loops, ensuring **both** Right-Hand and Left-Hand `10`-block wall followers reach `Goal` cleanly without infinite loops.
- **Goal Evaluation:** Uses Robot Grid **End-of-Program Goal Evaluation** (`atGoal == true` terminates `While (NOT atGoal)` right on the checkered flag → `🏁 SUCCESS`).

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `MOVE_FWD`, `TURN_LEFT`, `TURN_RIGHT` |
| **`allowedControlBlocks`** | `WHILE` (+ `END_WHILE`), `IF`, `ELSE_IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `atGoal`, `pathAhead`, `pathLeft`, `pathRight` |
| **`allowedCombinators`** | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN` / `false` / `false` |
| **`slotCap`** | `12` (`perScope.MAIN: 12`, `maxTotal: 12`) |
| **`starterBlocks`** | `3` (`While (NOT atGoal) { ? ("conditional") } End While`) |
| **`editDelta`** | `8` (replaces `?` with `9`-block `If / Else If / Else` chain → `10` total blocks, `<= 10–12` Capstone Limit) |
| **`antiBypassRules`** | `4` different start positions/orientations (`(0,0)E`, `(0,2)E`, `(2,0)S`, `(0,0)E`), `5×5` and `6×6` sizes, dead-end pockets, and reversed Left vs. Right advantages defeat every hardcoded turn sequence. |

---

## 2. Four Simultaneous Spanning-Tree Variant Mazes

*(Walls follow [robot_grid.md](../../envs/robot_grid.md): `V(x,y)` sits left of `(x,y)` blocking `(x-1,y)↔(x,y)`; `H(x,y)` sits above `(x,y)` blocking `(x,y-1)↔(x,y)`; outer grid borders are solid.)*

### Map 1 (`5×5`) — Winding S-Corridor (`Start: (0,0) East`, `Goal: (4,4)`)
- **Walls:** `V: [[3,0],[3,1],[4,1],[1,2],[4,2],[2,3]]`, `H: [[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[0,4],[1,4],[3,4],[4,4]]` (`24` open edges / `25` cells)
```text
+---+---+---+---+---+
| S→        |       |
+---+---+   +   +   +
|           |   |   |
+   +---+---+   +   +
|   |           |   |
+   +   +---+---+   +
|       |           |
+---+---+   +---+---+
|                 🏁|
+---+---+---+---+---+
```

### Map 2 (`5×5`) — T-Junction & Dead-End Pocket (`Start: (0,2) East`, `Goal: (4,0)`)
- **Walls:** `V: [[3,0],[4,0],[2,1],[3,1],[3,2],[4,2],[3,3]]`, `H: [[1,1],[0,2],[1,2],[0,3],[1,3],[4,3],[1,4],[2,4],[3,4]]` (`24` open edges / `25` cells)
```text
+---+---+---+---+---+
|           |   | 🏁|
+   +---+   +   +   +
|       |   |       |
+---+---+   +   +   +
| S→        |   |   |
+---+---+   +   +---+
|           |       |
+   +---+---+---+   +
|                   |
+---+---+---+---+---+
```

### Map 3 (`5×5`) — U-Turn Alcove & Dual Wing (`Start: (2,0) South`, `Goal: (4,4)`)
- **Walls:** `V: [[2,0],[3,0],[1,1],[2,1],[3,1],[4,1],[1,2],[4,2],[1,3],[4,3],[1,4]]`, `H: [[1,3],[2,3],[4,3],[2,4],[3,4]]` (`24` open edges / `25` cells)
```text
+---+---+---+---+---+
|       | S↓|       |
+   +   +   +   +   +
|   |   |   |   |   |
+   +   +   +   +   +
|   |           |   |
+   +---+---+   +---+
|   |           |   |
+   +   +---+---+   +
|   |             🏁|
+---+---+---+---+---+
```

### Map 4 (`6×6`) — Grand Spiral Spanning Maze (`Start: (0,0) East`, `Goal: (3,3)`)
- **Walls:** `V: [[5,1],[1,2],[4,2],[5,2],[1,3],[2,3],[4,3],[5,3],[1,4],[5,4]]`, `H: [[0,1],[1,1],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[2,3],[2,4],[3,4],[1,5],[2,5],[3,5],[4,5]]` (`35` open edges / `36` cells)
```text
+---+---+---+---+---+---+
| S→                    |
+---+---+---+---+---+   +
|                   |   |
+   +---+---+---+   +   +
|   |           |   |   |
+   +   +---+   +   +   +
|   |   |     🏁|   |   |
+   +   +---+---+   +   +
|   |               |   |
+   +---+---+---+---+   +
|                       |
+---+---+---+---+---+---+
```

---

## 3. Starter, Clue Reveal & Canonical Wall-Follower Solutions

### Starter (`MAIN: 3 flat blocks`)
```text
While (NOT atGoal)
  ? ("conditional")
End While
```

### Clue Reveal (`partialHelp` — `MAIN: 10` slots with action hints)
```text
While (NOT atGoal)
  If (pathRight)
    TURN_RIGHT
    ? ("move")
  Else If (pathAhead)
    ? ("move")
  Else
    ? ("turn")
  End If
End While
```

### Canonical Solution A — **Right-Hand Wall Follower (`MAIN: 10 flat blocks`)**
```text
While (NOT atGoal)
  If (pathRight)
    TURN_RIGHT
    MOVE_FWD
  Else If (pathAhead)
    MOVE_FWD
  Else
    TURN_LEFT
  End If
End While
```

### Accepted Solution B — **Left-Hand Wall Follower (`MAIN: 10 flat blocks`)**
```text
While (NOT atGoal)
  If (pathLeft)
    TURN_LEFT
    MOVE_FWD
  Else If (pathAhead)
    MOVE_FWD
  Else
    TURN_RIGHT
  End If
End While
```

---

## 4. Verified Multi-Run Execution Trace (`Right-Hand` & `Left-Hand`)

| Maze | Grid & Goal | Right-Hand Steps (Moves+Turns) | Right-Hand Tiles | Left-Hand Steps (Moves+Turns) | Left-Hand Tiles | Outcome |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Map 1 (`S-Corridor`)** | `5×5` → `(4,4)` | `40` | `27` | `34` | `23` | `[1 ✓]` |
| **Map 2 (`T-Junction`)** | `5×5` → `(4,0)` | `29` | `19` | `49` | `31` | `[2 ✓]` |
| **Map 3 (`U-Turn Alcove`)** | `5×5` → `(4,4)` | `39` | `27` | `31` | `21` | `[3 ✓]` |
| **Map 4 (`Grand Spiral`)** | `6×6` → `(3,3)` | `43` | `35` | `43` | `35` | `[4 ✓]` |

- **Sample Key Trace (`Map 2`, Right-Hand):** `(0,2)->(1,2)->(2,2)` (reaches T-junction) → `pathRight` chooses South `(2,3)->(1,3)->(0,3)->(0,4)->(1,4)->(2,4)->(3,4)->(4,4)->(4,3)->(3,3)->(3,2)->(3,1)->(4,1)` → explores `(4,2)` dead end & U-turns cleanly via `TURN_LEFT ×2` → `(4,1)->(4,0)` → `atGoal == True` exits `End While` in **`29` steps** → **`[2 ✓]`**!
