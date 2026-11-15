# Module `cmp` — Comparisons, Parity & Math

> **Curriculum Stage:** Stage 2 Spec (`g:\Project\antigravity\robotemu\docs\curriculum\cmp\`) · **Status:** Stage 2 Complete
> **DAG Dependencies:** [`var`](../var/overview.md) `==>` **`cmp`** `==>` [`tape`](../tape/overview.md) · **Side-Track Unlock:** **`cmp`** `==>` [`inter`](../inter/overview.md) · [`tape`](../tape/overview.md) `==>` [`anim`](../anim/overview.md)
> **Environments Used:** [🚂 Switchyard](../../envs/switchyard.md), [🤖 Robot Grid](../../envs/robot_grid.md), [🎨 Turtle LOGO](../../envs/turtle_logo.md), [🎵 Beat & Light Matrix](../../envs/beat_light.md), [🏗️ Depot](../../envs/depot.md)

---

## 1. Core Concept Scope

Module `cmp` extends numeric variables from Module [`var`](../var/overview.md) with relational logic and division arithmetic:

1. **Six Comparison Operators (`<`, `>`, `<=`, `>=`, `==`, `!=`):** Compare live Watch Tray values, environment sensors (`$itemWeight`, `$dockCount`, `$dockQuota`, `$tileDial`, `$cursorX`, `$beatIndex`), or Depot stack peeks (`$heldValue`, `$topValue`) inside `IF`, `ELSE_IF`, and `WHILE`.
2. **Division & Modulo (`/` and `%`):** Real `float64` division `/` slices exact polygon angles (`360 / n`, `720 / n`), while integer remainder `%` creates alternating cycles (`c % 2`), downbeats (`$beatIndex % 4`), and parity checkerboards (`(x + y) % 2`). Dividing or modding by `0` triggers an immediate `MATH_ERROR` (`🧮÷0`) pause bubble.
3. **Strict 3-Address Arithmetic (`OP_VAR_OP`):** Complex conditions and computed geometry NEVER embed math inside `If`, `While`, or action slots. Always compute into a named helper variable first (e.g., `r = c % 2`, then `IF (r == 1)`), keeping every line readable in the live Watch Tray.
4. **Non-Destructive Depot Peeks:** Numbered Toy-Block Mode (`enforceHanoiRule: false`, `requireEmptyStacks: false`) unlocks `$heldValue` and `$topValue [Station]` comparisons guarded by `stationEmpty [Station] OR ...` short-circuit logic (color-based top peeks stay gated to Module `args`).

---

## 2. Full Lesson, Sandbox, Capstone & Mastery Sequence (19 Activities)

| Code | Format | Env | One-Concept Goal | Link |
| :--- | :--- | :--- | :--- | :--- |
| **`cmp.0`** | 📖 Explanation | 🚂 Switchyard | Live Watch Tray demo of `<, >, <=, >=, ==, !=` on weight gates and dock quotas | [`lesson_cmp_0_comparing_numbers.md`](./lesson_cmp_0_comparing_numbers.md) |
| **`cmp.1`** | 🚂 Puzzle | 🚂 Switchyard | Strict greater-than weight gate (`$itemWeight > 10`) handling `10 kg` boundary crates | [`lesson_cmp_1_weight_thresholds_and_quotas.md`](./lesson_cmp_1_weight_thresholds_and_quotas.md) |
| **`cmp.1a`** | 🚂 Puzzle *(New)* | 🚂 Switchyard | Fill Dock A up to `$dockCount [A] < $dockQuota [A]` and overflow excess to Dock B | [`lesson_cmp_1a_exact_dock_quota.md`](./lesson_cmp_1a_exact_dock_quota.md) |
| **`cmp.2`** | 🤖 Puzzle *(Redesigned)* | 🤖 Robot Grid | Variable laser-drop distance (`c < k` from `$tileDial`) with 1-slot cell carry | [`lesson_cmp_2_variable_threshold_checks.md`](./lesson_cmp_2_variable_threshold_checks.md) |
| **`cmp.3`** | 📖 Explanation | 🚂/🎵/🎨 Mixed | 4-beat Watch Tray tour: `% 2` toggle, `% 4` beat + `(x+y)%2`, `360/n` heptagon, and `🧮÷0` guard | [`lesson_cmp_3_division_and_remainder_math.md`](./lesson_cmp_3_division_and_remainder_math.md) |
| **`cmp.4`** | 🚂 Puzzle | 🚂 Switchyard | Twin-track alternating parity split (`c % 2 == 1` vs `0`) across `#1..#N` streams | [`lesson_cmp_4_modulo_and_alternating_cycles.md`](./lesson_cmp_4_modulo_and_alternating_cycles.md) |
| **`cmp.5`** | 🎨 Sandbox | 🎨 Turtle LOGO | Parametric polygons (`360/n`), odd stars (`720/n`), `% 2` sunbursts, bullseyes & pinwheels | [`lesson_cmp_5_computed_geometry.md`](./lesson_cmp_5_computed_geometry.md) |
| **`cmp.5a`** | 🎵 Puzzle *(Promoted)* | 🎵 Beat & Light | Parity LED runway (`($cursorX + $cursorY) % 2`) paired with `% 2` drum groove | [`lesson_cmp_5a_modulo_beat_and_checkerboard.md`](./lesson_cmp_5a_modulo_beat_and_checkerboard.md) |
| **`cmp.6`** | 📖 Explanation | 🏗️ Depot | Non-destructive Toy-Block `$heldValue` vs `$topValue` peek + `stationEmpty` guard | [`lesson_cmp_6_comparing_stack_tops.md`](./lesson_cmp_6_comparing_stack_tops.md) |
| **`cmp.7`** | 🏗️ Puzzle *(Redesigned)* | 🏗️ Depot | Numbered Toy-Block threshold filter (`$heldValue > $topValue [Stack 1]`) | [`lesson_cmp_7_count_and_provision.md`](./lesson_cmp_7_count_and_provision.md) |
| **`cmp.8`** | 🏗️ Puzzle | 🏗️ Depot | Scan Input for maximum block via `stationEmpty [Stack 1] OR $heldValue > $topValue [Stack 1]` | [`lesson_cmp_8_maximum_crate_hunter.md`](./lesson_cmp_8_maximum_crate_hunter.md) |
| **`cmp.9`** | 🔧 Fix-It *(New)* | 🚂 Switchyard | Fix dual `<` vs `<=` off-by-one boundary gates on `$itemWeight` and `$dockCount` | [`lesson_cmp_9_fix_boundary_weight_gate.md`](./lesson_cmp_9_fix_boundary_weight_gate.md) |
| **`cmp.A`** | 🏆 Capstone | 🚂 Switchyard | Scrap overweight/damaged (`> 20` or `itemDamaged`), fill quota `A`, overflow to `B` | [`capstone_cmp_a_batch_quota_dispatcher.md`](./capstone_cmp_a_batch_quota_dispatcher.md) |
| **`cmp.B`** | 🏆 Capstone *(Redesigned)* | 🤖 Robot Grid | Alternating Left/Right bay cleanup (`s % 2`) gated by `$tileDial >= k` threshold | [`capstone_cmp_b_parity_and_threshold_maintenance.md`](./capstone_cmp_b_parity_and_threshold_maintenance.md) |
| **`cmp.C`** | 🎨 Capstone Sandbox | 🎨 Turtle LOGO | Parametric Spirograph Galaxy (`F1` petal crystal, `137.5°` sunflower, spiderweb, vortex, mandala) | [`capstone_cmp_c_parametric_spirograph_galaxy.md`](./capstone_cmp_c_parametric_spirograph_galaxy.md) |
| **`cmp.M1`** | 🔥 Mastery | 🤖 Robot Grid | Option A: scan randomized hall for max dial `m`, then shuttle `m` single crates via `Loop [m]` | [`challenge_cmp_m1_max_vault_hunter.md`](./challenge_cmp_m1_max_vault_hunter.md) |
| **`cmp.M2`** | 🔥 Mastery | 🚂 Switchyard | Scrap damaged crates and balance twin scale sums (`l <= r`), defeating naive `% 2` | [`challenge_cmp_m2_balanced_twin_scale.md`](./challenge_cmp_m2_balanced_twin_scale.md) |
| **`cmp.M3`** | 🔥 Mastery *(Redesigned)* | 🤖 Robot Grid | Full-coverage `N × M` open warehouse snake sweep (`r % 2` alternating U-turns) | [`challenge_cmp_m3_snake_plow_sweeper.md`](./challenge_cmp_m3_snake_plow_sweeper.md) |

> Note: `cmp.0..cmp.9`, `cmp.A..cmp.C`, and `cmp.M1..cmp.M3` account for all **18 numbered activities** plus this **Overview (`19` markdown files total)**.

---

## 3. Authoring & Verification Guardrails

- **Two-Layer Reading Policy ([`ui_guidelines.md`](../../ui_guidelines.md)):** Zero learner-facing prose on block workspaces or trace diagnostic readouts. Explanations (`cmp.0`, `cmp.3`, `cmp.6`) and Sandbox/Key tips use a concise Guided Co-Pilot card (`<= 2` sentences per card) paired with a collapsed `<details><summary>📖 Parent / Teacher Tip</summary>` drawer.
- **Two-Axis Complexity Guardrails:** Standard puzzle `Edit Delta <= 6–8` flat blocks (Capstones `<= 10–12`; Mastery `0` starter blocks, `<= 20/tab`, `<= 50` total). Block counts use exact closer-inclusive flat block counting (`LOOP_START` / `WHILE` = `2 + count(body)`, `IF` = `2 + count(then) + sum(ELSE_IF: 1 + count(body)) + (ELSE: 1 + count(else))`).
- **LOGO Scale Mandate (`cmp.3` Beat 3, `cmp.5`, `cmp.C`):** Never shrink polygons via `300 / n`. Every rendered SVG obeys `inkMaxSpan >= 160 px` (`scaleWarning: false`) against the `40 × 45 px` turtle footprint, rendered as static Frame-1 `.svg` files under [`./svg/`](./svg/) with zero `<animate>` tags.
- **No Unintroduced / Unverified Sensors:** Color-value sensors stay gated to `args`+ (`cmp.6`–`cmp.8` use numeric toy blocks only); Depot uses `ENV_VERSION_DEPOT_V4 = 4` (`enforceHanoiRule: false`, `requireEmptyStacks: false` on `cmp.7`/`cmp.8`); Robot Grid enforces strict 1-slot carry (no multi-plank inventory).
