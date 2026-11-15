# Lesson while.0: `While` Loops vs. Fixed Repeat Counts

**ID:** `while.0` · **Format:** 📖 Guided Autonomous Explanation (`2` Runnable Tabs) · **Env:** [Robot Grid](../../envs/robot_grid.md)
**One-Concept Goal:** Visually contrast fixed `Loop ×N` counts against condition-driven `While (pathAhead)` and `While (NOT atGoal)` across short and long halls so learners see *why* scanning before stepping eliminates under-runs and wall crashes.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> **Tab 1:** Notice how `Loop ×2` works only on the 2-tile hall, and `Loop ×7` crashes 💥 into the short wall! `While (pathAhead)` checks the green laser beam *before* each step, so the exact same 3 blocks stop safely at the end of *both* halls.
> **Tab 2:** What if the checkered flag sits in the middle of a longer hall? `While (pathAhead)` would march right past the flag to the wall—use `While (NOT atGoal)` to stop cleanly the instant the robot lands on `🏁`!
> *(Learner Workspace Rule: **0** learner-facing words — communicated 100% via spotlight animation, radar cone pulses, `💥` crash cue, and `🏁` flag pulse.)*

</details>

---

## 1. Runnable Tab Specifications

### Tab 1 (`[1]`): `While (pathAhead)` Beats Fixed `Loop ×N`
- **Visual Contrast Setup:** Side-by-side (or consecutive) **Short Hall (`3×1`, `2` moves)** and **Long Hall (`8×1`, `7` moves)**, starting `(0, 0)` facing **East (`dir = 1`)**, Goal at `(2, 0)` / `(7, 0)`:
  ```text
  Short Hall (3x1):  [ 🤖→ ][ . ][ 🏁 ]
  Long Hall  (8x1):  [ 🤖→ ][ . ][ . ][ . ][ . ][ . ][ . ][ 🏁 ]
  ```
- **3-Beat Autonomous Comparison Sequence:**
  1. **Beat A (`Loop [2] { MOVE_FWD }`):** Passes Short Hall `(2, 0)`, then stops 5 tiles short at `(2, 0)` on Long Hall (`End-of-Program Goal Evaluation` fails — Goal icon pulses gently).
  2. **Beat B (`Loop [7] { MOVE_FWD }`):** Passes Long Hall `(7, 0)`, then slams into `(2, 0)` East outer wall on tick 3 in Short Hall → `💥` (`COLLISION`).
  3. **Beat C (Canonical `While (pathAhead)` — `3` flat blocks):** Robot pulses front sensor ray on every tick (`pathAhead == true` → `MOVE_FWD`; `pathAhead == false` at wall → exits `End While` cleanly at `(2, 0)` on Short Hall AND `(7, 0)` on Long Hall → `🏁 SUCCESS`!).

### Tab 2 (`[2]`): `While (NOT atGoal)` Stops Mid-Corridor & Exits Safely
- **Grid Setup (`6×1` Hall):** `w: 6, h: 1`, `start: { x: 0, y: 0, dir: 1 (East) }`, `goal: { x: 3, y: 0 }`, open path all the way to `(5, 0)`:
  ```text
  Mid-Hall Goal (6x1): [ 🤖→ ][ . ][ . ][ 🏁 ][ . ][ . ]
  ```
- **2-Beat Autonomous Comparison Sequence:**
  1. **Beat A (Pitfall — `While (pathAhead) { MOVE_FWD }`):** Robot steps `(0,0) -> (1,0) -> (2,0) -> (3,0) -> (4,0) -> (5,0)`, walking straight over the checkered flag to the far wall and failing End-of-Program Goal Evaluation!
  2. **Beat B (Canonical `While (NOT atGoal)` — `3` flat blocks):** At `(0,0)`, `(1,0)`, `(2,0)`, `atGoal` pulses false → `NOT atGoal == true` → `MOVE_FWD`. At `(3, 0)`, bottom Goal scanner lights green (`atGoal == true` → `NOT atGoal == false`) → loop exits cleanly at `End While` while standing on `(3, 0)` → `🏁 SUCCESS`!
  *(Note: Stepping an empty `While (pathAhead) { TURN_RIGHT }` visual ghost micro-demo or tooltip note introduces amber `⏳🔁` `'STEP_LIMIT'` if a loop never changes world state, visibly distinct from `💥` wall crash.)*

---

## 2. Canonical Demo Programs (`MAIN`)

```text
// Tab 1 — Canonical Program (MAIN: 3 flat blocks)
While (pathAhead)
  MOVE_FWD
End While

// Tab 2 — Canonical Program (MAIN: 3 flat blocks)
While (NOT atGoal)
  MOVE_FWD
End While
```

| Metric | Tab 1 (`While (pathAhead)`) | Tab 2 (`While (NOT atGoal)`) |
| :--- | :--- | :--- |
| **`allowedSimBlocks`** | `MOVE_FWD` | `MOVE_FWD` |
| **`allowedControlBlocks`** | `WHILE` (+ paired `END_WHILE`), (`LOOP_START` shown in contrast beat) | `WHILE` (+ paired `END_WHILE`) |
| **`allowedSensors`** | `pathAhead` | `atGoal` |
| **`allowedCombinators`** | `[]` | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `false` / `false` | `false` / `false` |
| **`allowedScopes` / `Variables` / `Recursion`** | `MAIN` / `false` / `false` | `MAIN` / `false` / `false` |
| **Flat Block Count (`blocks.length`)** | `3` | `3` |

---

## 3. Execution Trace (`Tab 1` & `Tab 2`)

| Tab / Map | Tick `0` | Steps Executed | Loop Exit Condition | End Pose & Result |
| :--- | :--- | :--- | :--- | :--- |
| **Tab 1 — Short (`3×1`)** | `(0,0,E)` `pathAhead=T` | `MOVE_FWD` → `(1,0)`, `MOVE_FWD` → `(2,0)` | `(2,0,E)` `pathAhead=F` | `(2,0,E)` on Goal → `🏁 SUCCESS` (`2` moves) |
| **Tab 1 — Long (`8×1`)** | `(0,0,E)` `pathAhead=T` | `7 × MOVE_FWD` → `(7,0)` | `(7,0,E)` `pathAhead=F` | `(7,0,E)` on Goal → `🏁 SUCCESS` (`7` moves) |
| **Tab 2 — Mid-Goal (`6×1`)** | `(0,0,E)` `NOT atGoal=T` | `3 × MOVE_FWD` → `(3,0)` | `(3,0,E)` `atGoal=T` (`NOT=F`) | `(3,0,E)` on Goal → `🏁 SUCCESS` (`3` moves) |
