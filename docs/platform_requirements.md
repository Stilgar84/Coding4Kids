# Shared Language, Lesson Mechanics & Platform Requirements (High-Level)

This document captures the high-level functional requirements needed across **all simulation environments** to run [the programming curriculum](./curriculum.md): shared language/block extensions, zero-reading pedagogical mechanics, multi-profile progression, versioned lesson saves, and celebratory rewards. For concrete layout budgets, HUD slots, iconography, and kid-UX rules, see [Kid-Friendly UI Principles & Guidelines (`ui_guidelines.md`)](./ui_guidelines.md).

---

## 1. Shared Language & Workspace UI Extensions

These language and workspace capabilities apply universally across **🤖 Robot Grid**, **🐢 Turtle LOGO**, **🎵 Beat & Light Matrix**, and **🚂 Switchyard**:

- **Explicit Conditional & Loop Blocks (Module 5+):**
  - `IF [condition] ... END_IF` — Executes inner blocks once if true; otherwise jumps past `END_IF`.
  - `IF [condition] ... ELSE ... END_IF` — Runs the top branch when true and skips `ELSE`, or jumps directly to `ELSE` when false (visually spotlighted during step-by-step playback).
  - `WHILE [condition] ... END_WHILE` — Repeats enclosed blocks while `[condition]` remains true (guarded against infinite loops by the interpreter step cap).
  - **Boolean Combinators:** Visual `NOT`, `AND`, and `OR` wrappers for sensor and comparison badges.
- **Visual Memory Watch Tray (Module 6+):**
  - Displays live, color-coded boxes only for variables present in the active workspace, updating on every tick and animating values when read from world sensors.
- **Shape-Socket Function Parameters & Local Stack Scope (Modules 8–9):**
  - Functions `F1`, `F2`, `F3` support up to **3 visual shape sockets (`●`, `▲`, `■`)** instead of text parameter names, with matching plug slots on `Call F1([●], [▲], [■])`.
  - Socket values are stored locally on each `StackFrame` in the call stack so recursive or nested calls never overwrite the caller's socket values.
- **Physical Block-Budget Slot Trays:**
  - When a lesson enforces a block cap (global or per function tab, e.g., `≤ 5 blocks`), the workspace renders visible slot trays (`[■][■][■][□][□]`) that visually fill up and gently shake/cap when full—communicating limits with zero text.

---

## 2. Lesson Pedagogical Mechanics & Teaching Tools

### `?` Placeholder Blocks (Partial Scaffolds)
- Used inside **Partial Solutions** and starter scaffolds to show program structure (e.g., `Loop` or `If/Else` brackets) while leaving specific actions or conditions for the learner to fill in.
- **Interaction:** Dropping or tapping a palette block onto `?` replaces it in place.
- **Safe Execution:** Running a workspace that still contains a `?` block never errors out; when execution reaches `?`, the interpreter **pauses cleanly on `?`**, pulses the block amber, and highlights the relevant palette group.

### Canvas Ghost-Step Preview
- Used as the non-spoiling **Partial Hint** on short (1–3 block) early lessons where a block skeleton would give away the entire answer.
- Renders a translucent "ghost" agent on the simulation canvas that animates only the first 1–2 moves/turns (or the first cycle of a repeating motif) without altering the learner's workspace blocks.

### Partial & Full Visual Solution System (with Undo Safety)
- Every constrained puzzle (**🤖 Robot** & **🚂 Switchyard**) supports two progressive help tiers:
  1. **Partial Help:** Displays the Ghost-Step Preview or lets the learner view/load the `?` Partial Block Scaffold (or single helper tab).
  2. **Full Working Solution:** Displays the complete verified block program visually and offers a 1-tap **Load into Workspace** action.
- **Non-Destructive Load:** Loading a partial scaffold, full solution, or creative variation pushes the learner's prior blocks onto the **Undo** stack so a single tap on Undo restores their own work.

### Illustrated & Playable Creative Variations (🐢 LOGO & 🎵 Beat & Light)
- Sandbox lessons pre-load a **working starter example** and present **2–3 Variation Cards**:
  - **LOGO Cards:** Auto-rendered visual thumbnail generated from the variation's actual block program.
  - **Beat & Light Cards:** Animated mini 8×8 preview with an **in-card Play/Listen (`▶`)** button so learners can hear and watch the target pattern without overwriting their workspace.
  - **Copy / Load Code:** Every card includes a 1-tap button to load its blocks into the workspace for study or remixing (Undo-protected).

### `📖 Explanation` Lesson (Interactive Demo) Mode
- Dedicated non-exercise lesson mode used to introduce new environments, interactive items, sensors, operators, or control blocks before learners must solve puzzles with them.
- **No Pass/Fail Validation:** Features 1–3 visual example tabs (`[1] [2] [3]`) pre-loaded with short runnable demos.
- **Visual Spotlights:** Supports synchronized visual callouts during playback/stepping (e.g., highlighting sensor scan beams, branch jumps over `Else`, Watch Box increments, or Call Stack frames stacking and unwinding) and completes via a clear **Continue (`→`)** button once explored.

### Simultaneous Multi-Map / Multi-Stream Validation (Module 5+)
- Adaptive lessons display **3–4 variant layouts/streams simultaneously** from the start (via live status pips `[1 ✓] [2 ·] [3 ·]` or a 2×2 split preview).
- A program succeeds only when a single Run passes **all** variants cleanly.

---

## 3. Curriculum Runner, Profiles, Saves & Rewards Infrastructure

### Kid-Friendly Multi-Profile System
- Supports multiple local user profiles on shared home or classroom devices.
- **Avatar-First Selection:** Each profile is identified by a **small kid-friendly visual avatar** (animal, robot, or character icon + accent color, with an optional name label) so pre-readers can recognize and switch to their profile without reading.
- Each profile maintains strictly isolated lesson progress, badges, active workspaces, and saved slots.

### Read-Only Curriculum Levels
- Whenever a user plays a curriculum lesson, capstone, explanation demo, or mastery challenge, the **environment/map is strictly Read-Only**—all grid-editing tools (barriers, flag placement, start-position moving) are hidden and disabled so learners cannot accidentally break or bypass the puzzle.
- Free-play Sandbox mode keeps full environment editing (and an optional *"Open Copy in Sandbox"* action can clone a creative workspace into free-play).

### Per-User, Per-Lesson Saves (Auto-Save / Auto-Restore + Multiple Slots)
- **Automatic Save & Restore When Switching Lessons:**
  - Every workspace edit in a lesson automatically saves to the active profile's working state for `(profileId, lessonId)` (and free-play Sandbox keeps its own separate auto-saved workspace).
  - Switching from Lesson A to Lesson B—and later returning to Lesson A—**automatically restores** the learner's exact blocks on Lesson A (or loads Lesson B's default starter blocks on first visit).
  - Includes an explicit **Reset to Starter** button so a learner can always return a lesson workspace to its clean initial state (Undo-protected).
- **Multiple Manual Save Slots per Lesson:** Learners can also save **multiple distinct versions** on the same lesson, capstone, or mastery challenge (represented visually with slot numbers/thumbnails) and switch between them freely.

### Lesson Save Format & Versioning Rules
- **Code-Only Lesson Save Payload:**
  - Saving a curriculum attempt serializes **only the user's block code** in the code payload, while the **environment section stores only `(lessonId, version)`** rather than duplicating the map geometry.
  - Keeps saves tiny (ideal for storage and QR sharing) and guarantees map integrity.
- **Retaining All Historical Lesson Versions in Code:**
  - Every curriculum activity definition carries an explicit `version` integer.
  - If a lesson's map, starter, or budget is revised in a future update, **all older `version` definitions remain in the codebase** alongside the newest version rather than being overwritten.
- **Version-Mismatch Prompt on Load:**
  - When loading a lesson save whose stored `version` differs from the latest version of `lessonId`, the UI **asks the user what to do** (with clear visual icons):
    1. **Load into Latest Lesson Version** — Places their saved code into the updated version of the lesson so they can test/adapt it for current completion.
    2. **Open in Original Lesson Version** — Runs their saved code against the preserved historical `version` definition so their prior solution continues to work exactly as originally built.

### Progression Tracking & Full Profile Export / Import
- **Completion & Unlocks:** Tracks per-lesson completion state per profile, unlocking modules sequentially while unlocking **Optional `🔥 Mastery Challenges`** in a dedicated bonus drawer as Modules 6, 7, 8, and 9 finish.
- **Whole-Profile Export & Import:**
  - Allows exporting and importing **all content belonging to a user profile** in one operation—profile avatar, all lesson/capstone/challenge completion records, earned badges, all per-lesson save slots, and free-play saves (via portable backup file and/or multi-QR transfer for offline tablets).
  - Importing prompts safely to add as a new profile or merge/replace an existing profile.

### Celebrations, Sound Effects & Collectible Badges
- **Standard Lesson Completion:**
  - Plays an upbeat victory jingle + lively canvas celebration effect (e.g., robot celebration animation / star burst) with a prominent one-tap **Next (`→`)** button.
- **Capstone (`🏆`/`🎨`) & Mastery Challenge (`🔥`) Grand Celebration:**
  - Triggers a **larger celebratory showcase**—richer fanfare audio, full-screen confetti/fireworks graphics, and a **Badge Unlock ceremony**.
- **Collectible Module Badges & Challenge Medals:**
  - Completing all Capstones in each of the **9 Modules** awards that module's unique **Module Mastery Badge**.
  - Completing each **Optional `🔥 Mastery Challenge`** awards a distinct **Challenge Medal**.
  - Earned badges and medals appear on the child's profile card and inside a visual **Badge / Trophy Collection** screen.
