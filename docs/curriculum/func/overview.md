# Module: Functions (`func`)

> **Core Concept:** Naming reusable action sequences (`F1`, `F2`, `F3`), jumping into a helper tab, executing its steps, returning to the caller right after the `CALL` block, layering helpers (`Main → F1 → F2` and `Main → F1 → F3`), and practicing **state hygiene** (leaving position, heading, pen/brush, or stack order clean for the caller).

## Overview & Lesson Order

| ID | Spec File | Format | Environment | Core Concept |
| :--- | :--- | :--- | :--- | :--- |
| **func.0** | [Jumping to `F1` & Returning](./lesson_func_0_jumping_to_f1_and_returning.md) | 📖 Demo | 🤖 Robot Grid | Animated execution-pointer call jump from `Main` into `F1` and clean return back to `Main`. |
| **func.1** | [Defining & Calling Helper `F1`](./lesson_func_1_defining_calling_helper_f1.md) | 🤖 Puzzle | 🤖 Robot Grid | Creating a reusable staircase helper in `F1` (`6`-slot `Main` forces calling `F1`). |
| **func.2** | [Shape Stamps & State Hygiene](./lesson_func_2_shape_stamps_state_hygiene.md) | 🎨 Creative | 🐢 Turtle LOGO | Stamping stars, trees, petals, windows, and constellations with `F1` while restoring heading and pen state. |
| **func.3** | [Chorus & Verse Composition](./lesson_func_3_chorus_and_verse_composition.md) | 🎨 Creative | 🎵 Beat & Light Pad | Sequencing named musical & visual sections (`F1` Verse, `F2` Chorus) from `Main` (`0ms` batch draw + `1×` beat playback). |
| **func.4** | [Functions & Loops Together](./lesson_func_4_functions_and_loops_together.md) | 🤖 Puzzle | 🤖 Robot Grid | Nesting a `Loop` inside `F1` and calling `F1` inside a `Loop` in `Main` around a 3-turn spiral staircase (`allowRepeatBadges: true`, bypass-proof). |
| **func.5** | [Layered Composition (`Main → F1 → F2`)](./lesson_func_5_layered_composition.md) | 🤖 Puzzle | 🤖 Robot Grid | Two-level helper layering across a 3-chamber key/gate corridor (`F2` unlocks & steps in; `F1` finishes alcove & backs out). |
| **func.6** | [Double Stack Reversal](./lesson_func_6_double_stack_reversal.md) | 🏗️ Puzzle | 🏗️ Automated Depot | Stacking two `loop.9`-style reversals (`F1`: `S1 → S2`, `F2`: `S2 → S3`) in `Main` so reversing twice restores exact ring order (`reverse(reverse(X)) = X`). |
| **func.7** | [Fix State Hygiene Drift](./lesson_func_7_fix_state_hygiene_drift.md) | 🔧 Fix-It | 🤖 Robot Grid | Debugging a missing return turn (`TURN_RIGHT`) at the end of `F1` that drifts heading `90°` per call and crashes on Iteration 2. |
| **func.A** | [Modular Station Repair](./capstone_func_a_modular_station_repair.md) | 🏆 Capstone | 🤖 Robot Grid | Module `func` mastery puzzle: 3-wing Key/Gate/Flag repair (`Main → F1 → F2` + `Loop ×3`) then straight down the open West hall to `Goal`. |
| **func.B** | [Castle Architect](./capstone_func_b_castle_architect.md) | 🎨 Capstone | 🐢 Turtle LOGO | Multi-tier scene composition using all 4 tabs (`Main → F1/F2`, `F1 → F3`, `F3` reusable micro-motif) — Castles, Trains, Harbors & Meadows. |
| **func.C** | [Full Song Choreography](./capstone_func_c_full_song_choreography.md) | 🎨 Capstone | 🎵 Beat & Light Pad | Full `Main` arrangement calling `F1` (Intro), `F2` (Verse/Beat), and `F3` (Chorus/Drop) across Concerts, Arcade Battles, Fireworks & Robot Boogie. |

---

## Cross-Module Design Contracts & Progression Guardrails

### 1. Progressive Scope Tabs (`F1` → `F2` → `F3`) & Recursion Lock
- **`allowRecursion: false` on ALL 11 activities:** Calling a tab from itself (`F1 → F1`) or creating any cycle (`F1 → F2 → F1`) is blocked by the Workspace/UI picker (`F1` tab hides `CALL_FN F1`, etc.; runtime enforces `allowRecursion: false` for Module `func`). True recursion belongs strictly to Module `rec`.
- **Tab Visibility Curve:**
  - `func.0`, `func.1`, `func.2`, `func.4`, `func.7`: `allowedScopes: ["MAIN", "F1"]` (`F2` and `F3` hidden).
  - `func.3`, `func.5`, `func.6`, `func.A`: `allowedScopes: ["MAIN", "F1", "F2"]` (`F3` hidden).
  - `func.B`, `func.C`: `allowedScopes: ["MAIN", "F1", "F2", "F3"]` (all 4 tabs unlocked).

### 2. Unified Flat Block Counting, Slot Budgets & Atomic Pair-Insertion
- **Unified Counting:** Every `LOOP_START` + `LOOP_END` pair adds `2 + countFlatBlocks(body)` to a scope's flat block total (`Platform Requirements §5`).
- **Atomic Pair-Insertion:** Inserting a `LOOP_START` atomically inserts `[LOOP_START, LOOP_END]` and requires `remainingForScope >= 2` slots (where `remainingForScope = min(perScope[scope] - len(scope), maxTotal - sumAllScopes)`).
- **Tight Slot Caps (`sum(perScope) >= maxTotal`) & Edit Deltas:**
  - Guided puzzles keep **Edit Delta ≤ 6–8** via light placeholder/starter scaffolding (`func.1`, `func.4`, `func.5`, `func.6`, `func.7`).
  - Capstones keep **Edit Delta ≤ 10–12** (`func.A` solves cleanly in **`11` blocks** from a blank workspace inside `MAIN: 5, F1: 4, F2: 4, maxTotal: 13`).
  - Creative sandboxes scale progressively: **Starter & Var 1** target `≤ 14/tab` (2-tab sandboxes `≤ 24 total`), **Var 2** targets `≤ 20/tab & ≤ 40 total` (or clean `3–4`-tab compositions), and **Var 3** targets `≤ 30/tab & ≤ 60–80 total`.

### 3. Double Stack Reversal Bridge (`loop.9` → `func.6`)
- **`loop.9`** introduces single-pass LIFO stack transfer (`S1 → S2` reverses ring order once).
- **`func.6`** chains two named helper tabs (`CALL_FN F1` `S1 → S2`, `CALL_FN F2` `S2 → S3`) in the Toy-Crane Workshop (`activeStationsMask: 0x07`, `enforceHanoiRule: false`), letting learners watch two reversals cancel out (`reverse(reverse(X)) = X`) without repeating code manually.

### 4. Zero-Reading UI & State Hygiene
- **Zero Learner-Facing Text:** Workspace, palette, coach spotlights, and `VictoryCelebrationModal` contain zero reading prose in Module `func` (5–7y Zero-Reading Policy). Adult-only tips live exclusively inside collapsed `<details>` (`📖 Parent / Teacher Tip`, runtime `explanationText`).
- **Icon Disambiguation:** Every action, badge, and parameter picker preserves its canonical visual icon (`VisualParamBadges.tsx`, `PALETTE_COLORS` swatches `0..9`, `BeatDelayVisual` `⚡0` / `¼×–4×`, trajectory arcs for `ARC_LEFT`/`ARC_RIGHT` & turns, `1 ⋯▶ 2` ordered flags & shuttered `🏁`).

---

## At-a-Glance Summary Matrix

| ID | Env | `allowedScopes` | `slotCap` (`perScope` / `maxTotal`) | Canonical / Solution Blocks | Edit Delta | Key Stage 2 Fixes Applied |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **func.0** | 🤖 | `MAIN, F1` | Read-only Demo (`2` tabs) | Tab 1: `3+3=6`; Tab 2: `4+4=8` | `0` (Demo) | Fixed Tab 1 flag order (`0`), deleted 3 OOB walls in Tab 2, fixed Tab 2 `MAIN` (`3 → 4` blocks) to land ON `(4,0)`. |
| **func.1** | 🤖 | `MAIN, F1` | `{ MAIN: 6, F1: 4 } / 10` | `6 + 3 = 9` | `6` | Tightened `maxTotal: 10`, scaffolded `MAIN` with 3 `function` `?` placeholders (`Edit Delta 6`). |
| **func.2** | 🐢 | `MAIN, F1` | Creative (`Starter` 16, `Var1` 24, `Var2` 16, `Var3` 35/40) | `16`–`40` | Sandbox | Removed `TELEPORT`, aligned to canonical 10-swatch colors, fixed Big Dipper closing stroke & `penDown: false`. |
| **func.3** | 🎵 | `MAIN, F1, F2` | Creative (`17`–`38` total) | `17`–`38` | Sandbox | Clamped all pitches to `1..8`, `SET_BEAT_DELAY` multiplier `[0, 1]`, replaced 4-frame sprite card with `🚀 Rocket Countdown & Blastoff`, zero OOB cursor. |
| **func.4** | 🤖 | `MAIN, F1` | `{ MAIN: 4, F1: 6 } / 10` | `4 + 6 = 10` | `7` | Replaced bypassable `4.4` corridor with `6×6` 3-Turn Spiral Staircase Wings + end-of-program Goal; non-adjacent ops defeat repeat-badge bypass. |
| **func.5** | 🤖 | `MAIN, F1, F2` | `{ MAIN: 5, F1: 5, F2: 4 } / 14` | `5 + 5 + 4 = 14` | `8` | Added `7×3` chamber divider walls & eliminated fatal `MOVE_BACK` off Goal `(2,3)` so final `MOVE_FWD ×2` lands ON `(6,2)`. |
| **func.6** | 🏗️ | `MAIN, F1, F2` | `{ MAIN: 3, F1: 6, F2: 8 } / 17` | `2 + 6 + 6 = 14` | `7` | `activeStationsMask: 0x07`, uniform `"rings/blocks"`, `F1` pre-filled (`S1→S2`) + clean `MAIN` placeholder (`no leaked station`). |
| **func.7** | 🤖 | `MAIN, F1` | `{ MAIN: 5, F1: 4 } / 9` | `5 + 4 = 9` | `1` | Promoted from `*(Idea)*`: 1-block `TURN_RIGHT` Fix-It curing heading drift crash on Iteration 2. |
| **func.A** | 🤖 | `MAIN, F1, F2` | `{ MAIN: 5, F1: 4, F2: 4 } / 13` | `5 + 3 + 3 = 11` | `11` | Replaced fatal `4A` West-wing `MOVE_BACK` off Goal with open West hall `(2,2)→(0,2)`; `F1: 4` & `MAIN: 5` mathematically enforce both `F1` & `F2`. |
| **func.B** | 🐢 | `MAIN, F1, F2, F3` | Creative (`43`–`67` total) | `43`–`67` | Sandbox | Zero `TELEPORT`, zero `#ffffff` ink on `#ffffff` background, crisp SVG previews across Castle, Train, Harbor & Meadow. |
| **func.C** | 🎵 | `MAIN, F1, F2, F3` | Creative (`37`–`51` total) | `37`–`51` | Sandbox | Canonical `1..8` pitches, `SET_BEAT_DELAY` multiplier, full `STAMP_PRESET` `0..7` palette, strictly `1..8 × 1..8` cursor bounds. |
