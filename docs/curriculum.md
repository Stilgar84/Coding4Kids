# Programming Curriculum for Complete Newcomers

This document defines the high-level curriculum roadmap for **Robot Emulator (`robotemu`)**, designed to take complete newcomers—with **zero prior programming knowledge** and **minimal-to-zero reading required**—from sequential actions to parameterized functions, fractals, and recursive backtracking across **9 progressive modules**.

For high-level specifications of the simulation environments, shared language blocks, and platform infrastructure referenced across this curriculum, see:
- [🛠️ Shared Language, Lesson Mechanics & Platform Requirements](./platform_requirements.md)
- [🎵 Beat & Light Matrix Environment](./env_beat_light.md)
- [🚂 Switchyard / Conveyor Sorter Environment](./env_switchyard.md)
- [🤖 Robot Grid Planned Extensions](./env_robot_extensions.md)

---

## 1. Terminology & Hierarchy

- **Curriculum:** The overall 9-module learning track.
- **Module (`Module 1` – `Module 9`):** A thematic chapter grouping focused lessons around one core programming paradigm, ending with 1–3 **Capstones** and awarding a **Module Badge**.
- **Lesson (`1.0`, `1.1`, …):** A single small-step activity inside a Module (either an interactive **Explanation Lesson**, a validated **Puzzle Lesson**, or an open **Sandbox Lesson**).
- **Capstone (`1A`, `1B`, …):** A richer synthesis puzzle or creative showcase at the end of a Module using everything learned in that Module.
- **Mastery Challenge (`Challenge 6.1` – `9.3`):** Fully optional, harder algorithmic challenges unlocked in a bonus drawer starting at the end of Module 6, awarding **Challenge Medals**.

---

## 2. Core Pedagogical Principles

1. **Strict One-Concept-Per-Lesson Pacing:**
   - Every lesson teaches **strictly one** new mental model.
   - Whenever a learner meets a brand-new environment, world item, or non-obvious sensor/operator, it is introduced **on its own** (via an interactive `📖 Explanation` lesson and/or using only already-mastered control blocks)—never pairing a new environment with a new control-flow jump.
2. **Zero-Reading Visual Learning:**
   - Objectives, constraints, hints, variations, and solutions communicate via **icons, numbers, animations, physical UI slot trays, and rendered previews** rather than paragraphs of text.
3. **Constraint-Driven Discovery (No Brute Force):**
   - Validated puzzles enforce **physical block-slot budgets**, **per-tab slot limits**, or **simultaneous multi-map / multi-stream validation** (`3–4` visible runs) so loops, helper functions, conditionals, and variables are genuinely required.
4. **Complementary Environment Tracks:**
   - **Constrained Puzzles (🤖 Robot Grid & 🚂 Switchyard):** Clear pass/fail validation, backed by non-spoiling **Partial Solutions** and guaranteed **Full Working Solutions**.
   - **Creative Sandboxes (🐢 Turtle LOGO & 🎵 Beat & Light Matrix):** No pass/fail anxiety; each lesson pre-loads a **working starter example** alongside **2–3 illustrated/playable variation cards** with **1-tap Copy / Load Code**.

---

## 3. Activity Formats, Solution Length Guardrails & Visual Support

### Five Activity Formats

| Format | Badge | Validation | Purpose |
| :--- | :---: | :--- | :--- |
| **Explanation Lesson (Interactive Demo)** | 📖 | **No Exercise** *(1-tap continue)* | Presents **1–3 runnable, step-able visual examples** with spotlight animations to explain a new environment, interactive object, sensor (`unvisitedAhead`), operator (`<, >, ==`, `%, /`), or control block (`Loop`, `Call F1`, `If/Else`, `While`, variables, sockets, recursion) before asking learners to solve puzzles with it. |
| **Puzzle Lesson** | 🤖 / 🚂 | **Validated Puzzle** | Focused single-concept puzzle with **Partial + Full Visual Solutions**. |
| **Sandbox Lesson** | 🐢 / 🎵 | **Open Sandbox** | Working starter program + **2–3 illustrated/playable variation cards** with **Copy / Load Code** (and 1-tap Undo). |
| **Module Capstone** | 🏆 / 🎨 | **Puzzle or Sandbox** | Synthesizes everything taught in the current Module into a rewarding milestone. |
| **Optional Mastery Challenge (Module 6+)** | 🔥 | **Bonus Challenge** *(fully optional)* | Unlocks upon finishing Modules 6, 7, 8, and 9. Never blocks progression; explores deeper algorithmic puzzles with multi-tab solutions (**Partial + Full Solutions** included). |

### Solution Length & Map Size Guardrails

To prevent scrolling fatigue on tablets and keep every exercise focused on its core idea, all reference solutions must obey strict block-count caps:

| Tier | Total Reference Blocks (All Tabs) | Max Blocks in Any Single Tab | Pacing Guardrail |
| :--- | :---: | :---: | :--- |
| **Modules 1–2 Lessons** | **3 – 8 blocks** | **8 blocks** | Keep Module 1 maps compact (`3×3` to `4×4`) before `×N` repeat badges exist so learners never chain 8+ duplicate moves. |
| **Modules 3–9 Lessons** | **4 – 10 blocks** | **7 blocks** | If a draft puzzle needs >10 blocks, trim map busywork or factor setup clutter. |
| **Sandbox Examples & Variations** | **4 – 12 blocks** | **8 blocks** | Entire program should fit visibly without scrolling (up to **15** in Capstones). |
| **Module Capstones (🏆)** | **8 – 14 blocks** | **8 blocks** | Difficulty comes from *combining* concepts across tabs, never tedious length. |
| **Mastery Challenges (🔥 Module 6+)** | **12 – 24 blocks** | **10 blocks** | Multi-tab depth (`Main` + `F1`–`F3`) allowed for optional algorithmic challenges. |

### Zero-Reading Support Mechanics

- **Partial + Full Visual Solutions (🤖 Robot & 🚂 Switchyard):**
  - **Tier 1 — Partial Solution (Scaffold):**
    - *Ultra-short puzzles (1–3 blocks):* **Canvas Ghost-Step Preview** animating the first move/turn on the map without revealing blocks.
    - *Standard/complex puzzles:* **Structural Skeletons** (e.g., `Loop` or `If/Else` brackets pre-placed with `?` placeholder blocks inside, or revealing `F1` while leaving `Main` open). Running a program with a `?` placeholder pauses cleanly on `?`, pulses it amber, and highlights the matching palette category.
  - **Tier 2 — Full Working Solution:** Verified visual block sequence with a one-tap **Load into Workspace** button (protected by 1-tap **Undo** so learner work is never lost).
- **Illustrated / Playable Variation Cards (🐢 LOGO & 🎵 Beat & Light):**
  - Each variation card shows an **auto-rendered image thumbnail** (LOGO) or an **in-card Play/Listen animated 8×8 preview** (Beat & Light) generated directly from that variation's block code, plus a **Copy / Load Code** button (backed by **Undo**).
- **Non-Verbal Constraint Cues:**
  - **Padlock-Gated Waypoints (`1 → 2 → Goal`):** Later flags stay dimmed/padlocked until earlier flags are collected.
  - **Physical Slot Trays (`[■][■][■][□][□]`):** Block budgets appear as physical workspace slots per tab that cap/shake when full.
  - **Simultaneous Multi-Run Pips (`[1 ✓] [2 ·] [3 ·]`):** Sensor/conditional lessons display all 3–4 test variants from the start so learners see one program must beat all layouts.

---

## 4. Progression Architecture

```mermaid
flowchart TD
    M1["Module 1: Sequences, Orientation & Debugging (Robot, LOGO, Beat/Light)"] --> M2["Module 2: Action Parameters & Object Use (Robot, LOGO, Beat/Light)"]
    M2 --> M3["Module 3: Loops & Nested Repetition (Robot, LOGO, Beat/Light)"]
    M3 --> M4["Module 4: Helper Functions & Decomposition (Robot, LOGO, Beat/Light)"]
    M4 --> M5["Module 5: Sensors & Conditionals (Robot, Switchyard)"]
    M5 --> M6["Module 6: Variables & Stepping Counters (Robot, LOGO, Beat/Light)"]
    M6 --> M7["Module 7: Comparisons, Quotas & Modulo Math (Switchyard, Robot, LOGO)"]
    M7 --> M8["Module 8: Parameterized Functions (Robot, LOGO, Switchyard)"]
    M8 --> M9["Module 9: Recursion, Fractals & Backtracking (Robot, LOGO)"]

    M6 -. "Unlocks Optional" .-> C1["🔥 Mastery Challenges Tier 1 (Multi-Dial Math & Dual Spirals)"]
    M7 -. "Unlocks Optional" .-> C2["🔥 Mastery Challenges Tier 2 (Max, Balance & Snake Sweep)"]
    M8 -. "Unlocks Optional" .-> C3["🔥 Mastery Challenges Tier 3 (Physical Sort & Batch Orders)"]
    M9 -. "Unlocks Optional" .-> C4["🔥 Mastery Challenges Tier 4 (Multi-Relic Search & Hanoi)"]
```

---

## 5. Module-by-Module Lesson & Capstone Catalog

### Module 1: First Steps — Sequences, Orientation & Visual Debugging
*Cognitive Goal: Understand top-to-bottom execution order, egocentric rotation vs. movement, tick-by-tick visual debugging, staged sub-goals, and parameterless creative sequencing. Grids stay `3×3`–`4×4`; puzzle solutions `3–6 blocks` (`8–10` in Capstone).*

- **Lesson 1.0 [📖 Explanation — 🤖 Robot] How Programs Run & Robot Point-of-View:** Two runnable visual demos: (1) top-to-bottom block highlighting moving step-by-step, and (2) how `Turn Left` / `Turn Right` rotate in place relative to where the robot's eyes face (North vs. South).
- **Lesson 1.1 [🤖 Robot] Moving Forward & Execution Order:** Chaining `Move Forward` blocks to reach a straight-line goal.
- **Lesson 1.2 [🤖 Robot] Turning in Place (Egocentric Orientation):** Distinguishing rotation (`Turn Left` / `Turn Right`) from movement, including South- and West-facing turns.
- **Lesson 1.3 [🤖 Robot] Stepping Backward:** Using `Move Back` to retreat out of tight 1-tile alcoves without turning around.
- **Lesson 1.4 [🤖 Robot] Visual Step-Debugging:** Using Step-by-Step playback on a 5-block starter program to spot and fix **1 wrong block** (using only `Forward`, `Back`, `Turn`).
- **Lesson 1.5 [🤖 Robot] Ordered Waypoints (`1 → 2 → Goal`):** Planning a route in short stages across padlock-gated numbered flags.
- **Lesson 1.6 [🐢 LOGO] First Continuous Line Drawings:**
  - *Starter Example:* Draws a corner step and a closed square using default `Forward` and `90° Turn`.
  - *Illustrated Copyable Variations:* `[Img 1]` Block letter `L` · `[Img 2]` Hook corner · `[Img 3]` Plus sign `+`.
- **Lesson 1.7 [🐢 LOGO] Lifting & Lowering the Pen (`Pen Up` / `Pen Down`):**
  - *Starter Example:* Draws two separate parallel bars `=`.
  - *Illustrated Copyable Variations:* `[Img 1]` 3-dash line · `[Img 2]` Detached window next to a door · `[Img 3]` Initials `H I`.
- **Lesson 1.8 [🎵 Beat & Light] Meet Beat & Light — Drum Pads & Icon Stamps:**
  - *Starter Example:* 4-beat `Kick–Snare` sequence flashing preset `Heart → Star` LED stamps.
  - *Playable Copyable Variations:* `[Preview 1]` Rock beat + blinking smiley · `[Preview 2]` 3-chime fanfare + sparkle · `[Preview 3]` Clap-clap-stomp groove.
- **🏆 Capstone 1A [🤖 Robot Puzzle] — *The Compact Labyrinth*:** `4×4` 3-flag maze combining South/West turns, `Move Back`, and fixing a broken starter leg (`≤ 10 blocks`).
- **🎨 Capstone 1B [🐢 LOGO Sandbox] — *Postcard Sketch*:** Starter draws a house with a detached floating window; illustrated copyable variations show a boxy robot face, 3-letter word, and twin towers.
- **🎨 Capstone 1C [🎵 Beat & Light Sandbox] — *Sticker & Beat Intro*:** Starter pairs drum hits with 3 animated LED stamps; playable copyable variations show a victory jingle, winking animation, and countdown beat.

---

### Module 2: Action Parameters & World Interaction
*Cognitive Goal: Customize how a single action behaves via visual parameter badges (counts, distances, angles, colors, radii, pitches) and interact statefully with world objects. Puzzle solutions `4–8 blocks`; Capstone `≤ 12 blocks`.*

- **Lesson 2.1 [🤖 Robot] Action Repeat Badges (`×2`..`×9`):** Compressing straight movements with count badges inside a physical 5-slot tray.
- **Lesson 2.2 [🐢 LOGO] Length & Turn Angle Parameters:**
  - *Starter Example:* Equilateral triangle (`Forward 100`, `Turn 120°`) demonstrating exterior turn angles.
  - *Illustrated Copyable Variations:* `[Img 1]` Steep mountain peak vs. wide roof · `[Img 2]` Tilted diamond (`60°` / `120°`) · `[Img 3]` Open hexagon dish.
- **Lesson 2.3 [🐢 LOGO] Persistent Style State (`Pen Color` & `Pen Width`):**
  - *Starter Example:* Three parallel strokes showing color and width remain active until changed again.
  - *Illustrated Copyable Variations:* `[Img 1]` 5-band rainbow ladder · `[Img 2]` Thick brown trunk + thin green twigs · `[Img 3]` Tricolor triangle.
- **Lesson 2.4 [🐢 LOGO] Multi-Parameter Actions (`Arc` Radius + Angle):**
  - *Starter Example:* Heart formed from two `180°` arcs and two straight lines.
  - *Illustrated Copyable Variations:* `[Img 1]` Wavy ocean line · `[Img 2]` 3-radius snowman (`25, 50, 75`) · `[Img 3]` Nested rainbow arches.
- **Lesson 2.5 [🎵 Beat & Light] Pitch, Duration & Colored LED Rows:**
  - *Starter Example:* 4-note melody with short/long durations lighting colored LED rows.
  - *Playable Copyable Variations:* `[Preview 1]` Doorbell chime · `[Preview 2]` Traffic-light countdown · `[Preview 3]` Rising color bar + bassline.
- **Lesson 2.6 [📖 Explanation — 🤖 Robot] Interactive World Items (`Pick Up` & `Use/Drop`):** Three bite-sized runnable demos: (1) `Key` unlocking a gate, (2) `Plank` bridging water, and (3) placing a `Crate` onto a floor switch (with 1-slot backpack indicator).
- **Lesson 2.7 [🤖 Robot] Fetching, Carrying & Using Objects:** Solving compact gate-and-bridge puzzles with `Pick Up`, `Use/Drop`, and repeat badges (`≤ 8 blocks`).
- **🏆 Capstone 2A [🤖 Robot Puzzle] — *The Supply Courier*:** Slot-capped puzzle (`≤ 10 blocks`) combining `×N` badges, a gate key, and a bridge plank.
- **🎨 Capstone 2B [🐢 LOGO Sandbox] — *Emblem & Emoji Studio*:** Starter draws a multi-width colored medal; illustrated copyable variations show a winking emoji, curved-petal flower, and bullseye shield.

---

### Module 3: Loops — Repeating Sequences & Nested Patterns
*Cognitive Goal: Spot multi-block repeating motifs, enclose them in `Loop Start` / `Loop End`, separate one-time setup/cleanup from the repeated body, and nest loops inside loops. Puzzle solutions `4–9 blocks`; Capstone `≤ 12 blocks`.*

- **Lesson 3.0 [📖 Explanation — 🤖 Robot] How `Loop Start` & `Loop End` Work:** Side-by-side interactive demo comparing 8 unrolled blocks against `Loop ×4 [2 blocks]`, spotlighting the live iteration counter (`1/4..4/4`) and exit past `Loop End`.
- **Lesson 3.1 [🤖 Robot] Simple Multi-Block Loops:** Wrapping a repeating 2–3 block stair-step motif in `Loop(N)` within a 5-slot tray.
- **Lesson 3.2 [🤖 Robot] Before, Inside, and After the Loop:** Separating one-time setup/finish steps from the loop body (preventing off-by-one / fencepost collisions).
- **Lesson 3.3 [🐢 LOGO] Closed Polygons & Star Loops:**
  - *Starter Example:* **5-pointed star** (`Loop 5: Forward, Turn 144°`).
  - *Illustrated Copyable Variations:* `[Img 1]` **6-pointed star** · `[Img 2]` **8-pointed star** (`Turn 135°`) · `[Img 3]` Spiked sun rays (`Forward, Back, Turn 30°`).
- **Lesson 3.4 [🎵 Beat & Light] Rhythm Loops & Chasing Border LEDs:**
  - *Starter Example:* Loops a 4-beat groove while advancing the LED cursor around the 8×8 border.
  - *Playable Copyable Variations:* `[Preview 1]` Syncopated clap ostinato · `[Preview 2]` Two-color alternating border flash · `[Preview 3]` Marquee chase lights.
- **Lesson 3.5 [🤖 Robot] Loops with Object Workflows:** Repeating fetch-and-place plank/crate cycles across uniform slots.
- **Lesson 3.6 [🤖 Robot] Nested Loops (Loop Inside a Loop):** Navigating 4-wing radial hubs or unidirectional rows (`≤ 8 blocks`).
- **Lesson 3.7 [🐢 LOGO] Nested Loop Rosettes & Spirographs:**
  - *Starter Example:* 6 rotated squares (`Loop 6 { Loop 4 { ... } Turn 60° }`).
  - *Illustrated Copyable Variations:* `[Img 1]` 12-petal arc flower · `[Img 2]` Rainbow pinwheel · `[Img 3]` Row of 5 spaced stars (`Pen Up` shift in outer loop).
- **🏆 Capstone 3A [🤖 Robot Puzzle] — *The Automated Greenhouse*:** Unidirectional multi-row (or 4-wing radial) object harvest & placement in `≤ 10 blocks` using nested loops + clean row resets (no conditionals needed).
- **🎨 Capstone 3B [🐢 LOGO Sandbox] — *Kaleidoscope Medallion*:** Starter draws a two-layer colored mandala; illustrated copyable variations show a snowflake ring, Ferris wheel, and honeycomb strip.
- **🎨 Capstone 3C [🎵 Beat & Light Sandbox] — *Looping Lightshow*:** Starter layers a beat loop with a nested 8×8 wave sweep; playable copyable variations show an equalizer pulse, radar sweep, and arcade loop.

---

### Module 4: Functions — Abstraction, Naming & Decomposition
*Cognitive Goal: Package reusable sub-tasks into `F1`, `F2`, `F3`, maintain "state hygiene" (restoring heading/pen state), combine functions with loops, and compose multi-layer helpers. Puzzle solutions `5–10 blocks` across tabs (`≤ 6 per tab`); Capstone `≤ 14 blocks`.*

- **Lesson 4.0 [📖 Explanation — 🤖 Robot] Jumping to `F1` and Returning:** Stepped animation tracing execution jumping from `Call F1` in `Main` into the `F1` tab, running `F1`, and resuming at the next block in `Main`.
- **Lesson 4.1 [🤖 Robot] Defining & Calling a Helper (`F1`):** Factoring out an identical 3-block maneuver needed at 3 non-adjacent places in `Main` (where differing intermediate steps prevent using a single loop).
- **Lesson 4.2 [🐢 LOGO] Shape Stamps & State Hygiene:**
  - *Starter Example:* `F1` draws a star and restores initial heading/pen state; `Main` jumps with `Pen Up` to stamp 4 stars cleanly.
  - *Illustrated Copyable Variations:* `[Img 1]` House with 4 stamped windows · `[Img 2]` Row of 3 stamped pine trees · `[Img 3]` Big Dipper constellation.
- **Lesson 4.3 [🎵 Beat & Light] Chorus & Verse Composition (`F1`, `F2`):**
  - *Starter Example:* `F1` = chorus groove + light burst, `F2` = melody bridge; `Main` plays `F1, F1, F2, F1`.
  - *Playable Copyable Variations:* `[Preview 1]` `A–B–A–B` dance track · `[Preview 2]` 4-frame sprite animation · `[Preview 3]` Call-and-response melody.
- **Lesson 4.4 [🤖 Robot] Functions + Loops Together:** Putting a branch-clearing loop inside `F1` and calling `F1` from a loop in `Main` (`≤ 8 blocks total`).
- **Lesson 4.5 [🤖 Robot] Layered Composition (`Main → F1 → F2`):** `F2` unlocks a gate mechanism; `F1` clears a room using `F2`; `Main` clears all rooms (`≤ 10 blocks total`).
- **🏆 Capstone 4A [🤖 Robot Puzzle] — *Modular Station Repair*:** Multi-wing repair puzzle with **5-slot trays per tab**, solved cleanly in `10–14 blocks` across `Main`, `F1`, and `F2`.
- **🎨 Capstone 4B [🐢 LOGO Sandbox] — *Castle Architect*:** Starter composes a castle from `Tower` (`F1`), `Wall` (`F2`), and `Flag` (`F3`); illustrated copyable variations show a city skyline, sailboat fleet, and flower garden.
- **🎨 Capstone 4C [🎵 Beat & Light Sandbox] — *Full Song Choreography*:** Starter arranges `Intro (F1) – Verse (F2) – Chorus (F3)`; playable copyable variations show a chiptune boss theme, fireworks finale, and pixel story.

---

### Module 5: Sensors & Conditionals — Adapting to an Unknown World
*Cognitive Goal: Write adaptive rules (`If`, `If/Else`, `While`, boolean combinators) verified simultaneously against **3–4 visible variant maps/streams** so hardcoded sequences fail. Switchyard onboarding and `If/Else` branching are introduced in separate dedicated lessons. Puzzle solutions `4–9 blocks`; Capstones `≤ 13 blocks`.*

- **Lesson 5.0 [📖 Explanation — 🤖 Robot] Sensors, `If`, and Multi-Map Runs:** Interactive demo showing the sensor beam inspecting tiles across **3 simultaneous hallways**—illustrating why `If (itemHere) { Pick Up }` passes all 3 while fixed sequences fail.
- **Lesson 5.1 [🤖 Robot] Sensing & Simple `If`:** Collecting randomly placed items along corridors using `Loop` + `If (itemHere)` (`≤ 5 blocks`).
- **Lesson 5.2 [📖 Explanation — 🚂 Switchyard] Meet the Switchyard (Scanner, Docks & Scrap Chute):** Pure environment tour using only already-familiar `Loop` and single-branch `If`: watches items roll under the scanner, `SEND_NEXT` deliver intact crates to a painted dock, and `If (itemDamaged) { SCRAP_ITEM }` drop cracked items into the scrap chute.
- **Lesson 5.3 [🚂 Switchyard] Switchyard Warmup — Hazard Filtering (`If`):** Practicing Switchyard controls using only `Loop` + `If (itemDamaged)` before `If / Else` is introduced (`≤ 5 blocks`).
- **Lesson 5.4 [📖 Explanation — 🚂 Switchyard] Two-Way Decisions (`If / Else`):** Dedicated control-flow demo on the now-familiar Switchyard: watches Red crates execute the `If` branch (`Switch Left`) and skip `Else`, while Blue crates jump directly to `Else` (`Switch Right`).
- **Lesson 5.5 [🚂 Switchyard] Binary `If / Else` Sorting:** Routing randomized streams of Red vs. Blue crates into painted twin docks (`≤ 6 blocks`).
- **Lesson 5.6 [🤖 Robot] Spatial `If / Else` & Directional Sensors (`tileColor`, `pathLeft`, `pathRight`):** Reacting to floor beacon colors and side-corridor openings across 3 map variants (`≤ 7 blocks`).
- **Lesson 5.7 [📖 Explanation — 🤖 Robot] `While` Loops vs. Fixed Repeat Counts:** Side-by-side demo showing `While (pathAhead)` stopping cleanly at walls in both 2-tile and 7-tile halls.
- **Lesson 5.8 [🤖 Robot] Conditional Loops (`While`):** Navigating variable-length corridors and tunnels using `While (NOT atGoal)` / `While (pathAhead)` (`≤ 6 blocks`).
- **Lesson 5.9 [🤖 Robot] Boolean Combinators (`NOT`, `AND`, `OR`):** Expressing compound rules like `If (itemHere AND NOT carryingItem)` (`≤ 7 blocks`).
- **Lesson 5.10 [🚂 Switchyard] Chained Multi-Way Routing (`If / Else If / Else`):** Sorting 3 cargo types across two track switches into matching painted docks (`≤ 9 blocks`).
- **🏆 Capstone 5A [🤖 Robot Multi-Map Puzzle] — *The Autonomous Maze Rover*:** Solve **4 simultaneous maze layouts** in `8–12 blocks` using `While (NOT atGoal)` + front/side wall or beacon sensors.
- **🏆 Capstone 5B [🚂 Switchyard Multi-Stream Puzzle] — *Hazard & Priority Router*:** Divert damaged items (`itemDamaged`) to the scrap chute while routing valid Red/Blue/Green crates cleanly (`9–12 blocks`).

---

### Module 6: Variables & Counters — Storing, Reading & Stepping Values
*Cognitive Goal: Understand variables purely as named memory boxes—storing constants (`s = 60`), reading world dials (`a = tileDial`), and stepping counters up/down inside loops (`a = a + 1`)—without mixing in relational comparisons or modulo yet. Puzzle solutions `4–8 blocks`; Capstone `≤ 13 blocks`. Completing Module 6 unlocks **Optional 🔥 Mastery Challenges Tier 1**.*

- **Lesson 6.0 [📖 Explanation — 🐢 / 🤖] Variable Memory Boxes:** Two short demos: (1) setting `s = 60` in the Watch Tray and watching multiple LOGO blocks read `s`, and (2) stepping onto a floor dial (`tileDial`) and watching its number animate into variable box `a`.
- **Lesson 6.1 [🐢 LOGO] Variables as Single-Point Constants:**
  - *Starter Example:* Proportioned house scaled by single variable `s = 60`.
  - *Illustrated Copyable Variations:* `[Img 1]` Tiny vs. giant house · `[Img 2]` Scalable robot head · `[Img 3]` Twin `s` and `s + 40` shapes.
- **Lesson 6.2 [🤖 Robot] Reading & Recalling a Dial Value:** Storing `a = tileDial` in Room 1 and moving/placing `a` times in Room 2 across 3 variant runs (`≤ 6 blocks`).
- **Lesson 6.3 [📖 Explanation — 🤖 Robot] Updating a Variable (`a = a + 1`):** Stepped animation showing `a` reading its current value, adding `1`, and updating its Watch Box on every loop pass (`1 → 2 → 3 → 4`).
- **Lesson 6.4 [🤖 Robot] Stepping Counters & Staircases:** Climbing `1, 2, 3, 4` arithmetic stairs or counting corridor beacons into `c` (`≤ 7 blocks`).
- **Lesson 6.5 [🐢 LOGO] Growing & Shrinking Loops (Spirals):**
  - *Starter Example:* Square spiral (`a = a + 8`, `Turn 90°`).
  - *Illustrated Copyable Variations:* `[Img 1]` Skewed star spiral (`92°` / `122°`) · `[Img 2]` Growing-radius seashell (`Arc`) · `[Img 3]` Shrinking inward tunnel (`a = a - 8`).
- **Lesson 6.6 [🎵 Beat & Light] Sweeping Coordinates & Scales:**
  - *Starter Example:* Increments note pitch `p` and LED column `x` inside a loop.
  - *Playable Copyable Variations:* `[Preview 1]` Diagonal laser sweep · `[Preview 2]` Growing equalizer bars (`1..8`) · `[Preview 3]` Up-and-down siren scale.
- **🏆 Capstone 6A [🤖 Robot Multi-Run Puzzle] — *Inventory Quartermaster*:** Survey a warehouse to count damaged nodes into `c`, walk to the supply depot to pick up `c` repair cells, and install them across randomized maps (`10–13 blocks`).
- **🎨 Capstone 6B [🐢 LOGO Sandbox] — *Spiral & Wave Studio*:** Starter pairs growing segment length with shifting turn angles; illustrated copyable variations show a double-ended scroll, shell horn, and pyramid steps.

---

### Module 7: Comparisons, Quotas & Modulo Math — Computing with Variables
*Cognitive Goal: Combine variables with conditionals and arithmetic operators—comparing numeric values (`<`, `>`, `==`), splitting cycles with modulo (`%`), and computing geometric angles (`360 / n`). Puzzle solutions `5–9 blocks`; Capstones `≤ 13 blocks`. Completing Module 7 unlocks **Optional 🔥 Mastery Challenges Tier 2**.*

- **Lesson 7.0 [📖 Explanation — 🚂 Switchyard] Comparing Numbers (`<`, `>`, `==`):** Interactive demo watching `itemWeight > 10` and `count == dockQuota` evaluate live in the Watch Tray and trigger `If / Else` branches.
- **Lesson 7.1 [🚂 Switchyard] Weight Thresholds & Quotas (`<`, `>`, `==`):** Diverting heavy crates (`itemWeight > 10`) and stopping Dock A fill as soon as `count == dockQuota` (`≤ 8 blocks`).
- **Lesson 7.2 [🤖 Robot] Variable Threshold Checks on the Grid:** Checking `cells == tileDial` or refilling carried planks when `stock == 0` across multi-run maps (`≤ 8 blocks`).
- **Lesson 7.3 [📖 Explanation — 🚂 / 🐢] Division & Remainder Math (`/` and `%`):** Two visual mini-demos: (1) watching `count % 2` alternate `0, 1, 0, 1` like a flip-flop toggle as items pass, and (2) watching `360 / n` slice a circle into `n` equal turn wedges.
- **Lesson 7.4 [🚂 Switchyard] Modulo & Alternating Cycles (`count % 2 == 0`):** Round-robin splitting items evenly between twin docks or inspecting every 3rd crate (`≤ 8 blocks`).
- **Lesson 7.5 [🐢 LOGO] Computed Geometry (`360 / n` & Alternating Colors):**
  - *Starter Example:* Computes `a = 360 / n` from top variable `n` to draw any regular polygon automatically.
  - *Illustrated Copyable Variations:* `[Img 1]` Universal odd `n`-pointed star (`720 / n`) · `[Img 2]` Two-color alternating burst (`i % 2`) · `[Img 3]` Concentric target rings with computed radii.
- **🏆 Capstone 7A [🚂 Switchyard Multi-Stream Puzzle] — *Batch Quota Dispatcher*:** Scrap overweight crates (`> limit`), fill Dock A up to its painted quota gauge, and overflow remaining valid crates to Dock B (`10–13 blocks`).
- **🏆 Capstone 7B [🤖 Robot Multi-Run Puzzle] — *Parity & Threshold Maintenance*:** Alternate left/right repair actions by step parity (`% 2`) while respecting energy thresholds (`10–13 blocks`).
- **🎨 Capstone 7C [🐢 LOGO Sandbox] — *Parametric Spirograph & Galaxy*:** Golden-angle flower controlled by 3 top variables; illustrated copyable variations show a spiderweb, optical vortex, and concentric mandala.

---

### Module 8: Parameterized Functions — Reusable Tools with Local Inputs
*Cognitive Goal: Pass values into visual shape sockets (`F1(●)`, `F1(●, ▲)`) with isolated local stack scope so helpers adapt per call without overwriting global variables—essential groundwork before recursion. Puzzle solutions `5–10 blocks`; Capstone `≤ 14 blocks`. Completing Module 8 unlocks **Optional 🔥 Mastery Challenges Tier 3**.*

- **Lesson 8.0 [📖 Explanation — 🐢 LOGO] Shape-Socket Inputs (`F1(●)`):** Interactive demo showing `Call F1(30)` and `Call F1(70)` plugging values into `F1`'s local `●` socket while leaving global variable `a` unchanged.
- **Lesson 8.1 [🐢 LOGO] Single-Input Helpers (`F1(●)`):**
  - *Starter Example:* `Circle(●)` stacked into a 3-tier snowman (`25, 45, 70`).
  - *Illustrated Copyable Variations:* `[Img 1]` 4 trees of varied heights · `[Img 2]` Bullseye rings · `[Img 3]` Family of 3 scaled houses.
- **Lesson 8.2 [🤖 Robot] Parameterized Corridor Helpers (`ClearBranch(●)`):** Calling `F1(●)` with different distances and dial-read values across asymmetric rooms (`≤ 8 blocks`).
- **Lesson 8.3 [🚂 Switchyard] Parameterized Batch Subroutines (`FillBatch(●)`):** Fulfilling sequential train orders of varied sizes via `Call F1(●)` (`≤ 9 blocks`).
- **Lesson 8.4 [🐢 LOGO] Two-Socket Toolkits (`F1(●, ▲)` = `Polygon(sides, size)`):**
  - *Starter Example:* Single `Polygon(●, ▲)` helper drawing triangular roofs, square walls, and octagonal signs (`≤ 10 blocks`).
  - *Illustrated Copyable Variations:* `[Img 1]` Scaled solar system · `[Img 2]` Stained-glass polygon mosaic · `[Img 3]` Multi-tooth gear train.
- **🏆 Capstone 8A [🤖 Robot Puzzle] — *Asymmetric Reactor Calibration*:** Floor dials encode `(distance, count)` pairs per wing; solved cleanly in `10–13 blocks` with `F1(●, ▲)`.
- **🎨 Capstone 8B [🐢 LOGO Sandbox] — *Procedural City Skyline*:** `Building(●, ▲)` street; illustrated copyable variations show a mountain range, ship fleet, and varied bookshelf.

---

### Module 9: Recursion — Self-Reference, Fractals & Backtracking
*Cognitive Goal: Demystify recursion in gentle, explicit steps: (1) tail call + base case, (2) stack unwinding on return, (3) parameter shrinking, (4) branching fractals with state restoration, and (5) footprint-guided cave backtracking. Puzzle solutions `4–11 blocks`; Capstone `≤ 14 blocks`. Completing Module 9 unlocks **Optional 🔥 Mastery Challenges Tier 4**.*

- **Lesson 9.0 [📖 Explanation — 🤖 Robot] Self-Calls, Base Cases & Stack Unwinding:** Two visual call-stack demos: (1) watching `F1` stack frames grow until `If (pathAhead)` becomes false, and (2) watching paused `F1` frames wake up in reverse (`3 → 2 → 1`) to execute blocks placed *after* `Call F1`.
- **Lesson 9.1 [🤖 Robot] Tail Recursion & the Base Case:** `If (pathAhead) { Forward, Call F1 }` across variable-length halls (`4 blocks`).
- **Lesson 9.2 [🤖 Robot] Unwinding the Call Stack (Actions *After* `Call F1`):** Walk to an unknown-distance relic via `Call F1` and place `Move Back` *after* `Call F1` to retrace the exact step count home without any counter variable (`5–6 blocks`).
- **Lesson 9.3 [🐢 LOGO] Linear Recursive Shrinking (`F1(●)`):**
  - *Starter Example:* `If (● > 10) { Forward(●), Turn(90°), Call F1(● - 10) }`.
  - *Illustrated Copyable Variations:* `[Img 1]` Rotated square tunnel · `[Img 2]` Recursive star spiral · `[Img 3]` Curved nautilus shell.
- **Lesson 9.4 [🐢 LOGO] Branching Recursion & State Restoration (Fractals):**
  - *Starter Example:* **Symmetric Binary Y-Tree** (`9–11 blocks`) restoring position (`Move Back(●)`), heading, and pen style at each fork.
  - *Illustrated Copyable Variations:* `[Img 1]` **3-branch pine tree** · `[Img 2]` Wind-swept asymmetric tree · `[Img 3]` **Koch** curve / **Sierpinski** triangle.
- **Lesson 9.5 [🤖 Robot] Recursive Fork Probing & Heading Hygiene:** Lighting beacons down a 2-way Y-fork cave and unwinding cleanly to start (`8–10 blocks`).
- **Lesson 9.6 [📖 Explanation — 🤖 Robot] Footprint Breadcrumbs & `unvisitedAhead`:** Two side-by-side cave demos: (1) showing why checking `pathAhead` alone at multi-way junctions loops back onto already-walked tiles, and (2) showing how floor footprints make `unvisitedAhead` light up *only* on fresh, unexplored branches so dead ends unwind cleanly.
- **Lesson 9.7 [🤖 Robot] Multi-Branch Cave Search (`unvisitedAhead`):** Probing `Left / Front / Right` in acyclic caves using `unvisitedAhead` and backing out of dead ends (`10–11 blocks`).
- **🏆 Capstone 9A [🤖 Robot Multi-Map Puzzle] — *Deep Cavern Retrieval*:** Enter 3 unseen branching cave trees, pick up the relic, and unwind all the way back to the entrance pad (`11–14 blocks`).
- **🎨 Capstone 9B [🐢 LOGO Masterpiece Sandbox] — *Fractal Forest & Crystal Showcase*:** Blossom-tipped fractal tree (with pen color/width restoration on unwind); illustrated copyable variations show a **Koch snowflake crystal**, **fractal fern**, and **coral reef**.

---

## 6. Optional Mastery Challenges (Bonus Tier — Module 6+ Only)

**Mastery Challenges** reside in a dedicated **Optional Challenges** drawer separate from the main curriculum path. They **never gate module progression**, unlock progressively from the end of Module 6 onward, permit richer multi-tab solutions (**12–24 blocks total**, `≤ 10 per tab`), and still include **Partial Scaffolds + Full Working Solutions**.

### 🔥 Tier 1 Mastery Challenges (Unlocked after Module 6 — Variables & Counters)
- **Challenge 6.1 [🤖 Robot] — *The Multi-Dial Vault Combination*:** Read 3 separate floor dials (`a`, `b`, `c`) across chambers and compute compound quantities (`a + b`, `b * 2`) to fetch exact supply counts and pace out unmarked bridge crossings (`~12–16 blocks`).
- **Challenge 6.2 [🐢 LOGO Creative Challenge] — *Counter-Rotating Opposing Spirals*:** Starter demonstrates one variable growing; illustrated copyable challenge targets weave an expanding variable `a` against a shrinking variable `b` into interlocking geometric tapestries (`~12–16 blocks`).

### 🔥 Tier 2 Mastery Challenges (Unlocked after Module 7 — Comparisons & Modulo)
- **Challenge 7.1 [🤖 Robot] — *The Max-Vault Hunter*:** Scan a multi-room vault of randomized floor dials to record the maximum value `m`, then fetch `m` energy cells to open the master exit (`~14–18 blocks`).
- **Challenge 7.2 [🚂 Switchyard] — *Balanced Twin-Scale Loader*:** Route incoming crates of varied weights (`1..25`) onto Left vs. Right docks while keeping both docks' **running total weights** balanced (`leftSum <= rightSum`), scrapping damaged crates (`~14–18 blocks`).
- **Challenge 7.3 [🤖 Robot] — *Snake-Plow Warehouse Sweeper*:** Traverse variable `N × M` grids in a true alternating snake pattern (`row % 2` alternating end turns) while refilling plank stock whenever carried planks reach `0` (`~16–20 blocks`).

### 🔥 Tier 3 Mastery Challenges (Unlocked after Module 8 — Parameterized Functions)
- **Challenge 8.1 [🤖 Robot] — *The Sorting Crane (Physical Bubble Sort)*:** A corridor holds 4–5 numbered crates in random order; use parameterized shuttle helpers (`F1(●)`) and `Pick Up`/`Drop` swaps to sort them in ascending order (`~18–22 blocks`).
- **Challenge 8.2 [🚂 Switchyard] — *Run-Length Order Dispatcher*:** Streams alternate between "order header" cars (specifying target color & count) and mixed cargo cars; use `F1(●, ▲)` helpers to fulfill chained orders while recycling non-matching cars (`~16–22 blocks`).

### 🔥 Tier 4 Mastery Challenges (Unlocked after Module 9 — Recursion)
- **Challenge 9.1 [🤖 Robot] — *Multi-Relic Catacombs*:** Search a deep acyclic labyrinth containing *multiple* relics and internal locked gates across branches, collecting every relic and unwinding back to the entrance (`~16–22 blocks`).
- **Challenge 9.2 [🤖 Robot] — *Tower of Energy Rings (Tower of Hanoi)*:** Move a stack of 3–4 sized energy rings from Pedestal A to Pedestal C via Pedestal B (never placing a larger ring onto a smaller one) using a 3-socket recursive function `F1(●, ▲, ■)` (`~14–18 blocks`).
- **Challenge 9.3 [🐢 LOGO Creative Challenge] — *Koch Snowflake Island & Mutual Fractals*:** Starter demonstrates a single Koch edge; illustrated copyable challenge targets include a closed **Koch Snowflake Island**, **Dragon Curve**, and **Sierpinski Carpet** (`~14–20 blocks`).
