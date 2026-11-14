# Module `rec`: Recursion — Self-Reference, Hanoi, Fractals & Backtracking

> [← Curriculum Overview](../overview.md)

**Cognitive Goal:** Demystify recursion in gentle, explicit steps: (1) tail call + base case, (2) stack unwinding on return, (3) parameter shrinking, (4) branching fractals & animated depth sweeps, (5) 3-peg **Tower of Hanoi** in the Depot, and (6) footprint-guided cave backtracking. Completing `rec` unlocks Side Module **[`fp`](../fp/overview.md)** and **Optional 🔥 Mastery Set `rec`**.

**Environments:**
- [🤖 Robot Grid](../../envs/robot_grid.md)
- [🐢 Turtle LOGO](../../envs/turtle_logo.md)
- [🏗️ Depot](../../envs/depot.md)

---

## Lessons & Capstones

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`rec.0`** | 📖 | 🤖 | [Self-Calls, Base Cases & Stack Unwinding](./lesson_rec_0_self_calls_base_cases_unwinding.md) |
| **`rec.1`** | 🤖 | 🤖 | [Tail Recursion & the Base Case](./lesson_rec_1_tail_recursion_base_case.md) |
| **`rec.2`** | 🤖 | 🤖 | [Unwinding the Call Stack (Actions *After* `Call F1`)](./lesson_rec_2_unwinding_call_stack.md) |
| **`rec.3`** | 🐢 | 🐢 | [Linear Recursive Shrinking (`F1(●)`)](./lesson_rec_3_linear_recursive_shrinking.md) |
| **`rec.4`** | 🐢 | 🐢 | [Branching Recursion & State Restoration (Fractals)](./lesson_rec_4_branching_recursion_fractals.md) |
| **`rec.5`** | 🤖 | 🤖 | [Recursive Fork Probing & Heading Hygiene](./lesson_rec_5_recursive_fork_probing.md) |
| **`rec.6`** | 📖 | 🤖 | [Footprint Breadcrumbs & `unvisitedAhead`](./lesson_rec_6_footprint_breadcrumbs_unvisited_ahead.md) |
| **`rec.7`** | 🤖 | 🤖 | [Multi-Branch Cave Search (`unvisitedAhead`)](./lesson_rec_7_multi_branch_cave_search.md) |
| **`rec.8`** | 🏗️ | 🏗️ | [Tower of Hanoi (3 Discs)](./lesson_rec_8_tower_of_hanoi.md) |
| **`rec.9`** | 🐢 | 🐢 | [Fractal Tree Depth Explorer (`$input`)](./lesson_rec_9_fractal_tree_depth_slideshow.md) |
| **`rec.10`** | 🐢 | 🐢 | [Koch L-System Depth Explorer (`$input`)](./lesson_rec_10_koch_lsystem_depth_animator.md) |
| **`rec.11`** *(Idea)* | 🤖 / 🏗️ | 🤖 / 🏗️ | *Fix-It Bug Hunt: Fix a runaway recursive helper missing its base-case guard (`● == 0` / `pathAhead`) that overflows the call stack* |
| **`rec.A`** | 🏆 | 🤖 | [Capstone `rec.A` — Deep Cavern Retrieval](./capstone_rec_a_deep_cavern_retrieval.md) |
| **`rec.B`** | 🎨 | 🐢 | [Capstone `rec.B` — Fractal Forest & Crystal Showcase](./capstone_rec_b_fractal_forest_crystal_showcase.md) |

## Optional 🔥 Mastery Challenges (Set `rec` — Unlocked after `rec`)

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`rec.M1`** | 🔥 | 🤖 | [Challenge `rec.M1` — Multi-Relic Catacombs](./challenge_rec_m1_multi_relic_catacombs.md) |
| **`rec.M2`** | 🔥 | 🏗️ | [Challenge `rec.M2` — 4-Disc Tower of Hanoi](./challenge_rec_m2_4_disc_hanoi.md) |
| **`rec.M3`** | 🔥 | 🐢 | [Challenge `rec.M3` — Dual-Rule Dragon Curve (Mutual Recursion)](./challenge_rec_m3_dragon_curve.md) |
| **`rec.M4`** | 🔥 | 🐢 | [Challenge `rec.M4` — Koch Snowflake Island & Sierpinski Carpet](./challenge_rec_m4_koch_island_sierpinski.md) |
