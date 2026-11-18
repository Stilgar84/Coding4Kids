# Kid-Friendly UI Principles & Guidelines (Ages 5–7 Floor, Pro Sandbox Ceiling)

This document defines the mandatory UI, layout, iconography, and accessibility rules for all components across **[🤖 Robot Grid](./envs/robot_grid.md)**, **[🐢 Turtle LOGO](./envs/turtle_logo.md)**, **[🎵 Beat & Light Matrix](./envs/beat_light.md)**, **[🏗️ Depot](./envs/depot.md)**, and **[🚂 Switchyard](./envs/switchyard.md)** (see also [Curriculum Overview](./curriculum/overview.md) and [Platform Requirements](./platform_requirements.md)).

---

## 1. The Zero-Reading Workspace & Two-Layer Reading Rule

- **100% Zero-Reading Workspace Always:** Across every module and sandbox, programming controls and blocks must communicate through unmistakable icons, color/shape cues, spatial placement, and gentle animations—paired at most with 1–2 short words (e.g., `Save`, `Hint`, `Next ▶`).
- **Two-Layer Lesson Explanation Policy:** Early Core modules (`seq`–`while`, ~Ages 5–7) require zero reading anywhere (spotlights and ghost previews explain autonomously). Intermediate and advanced modules (`var`+, plus side modules `anim`, `inter`, `conc`, `fp`) may display concise **Guided / Co-Pilot Explanation Cards** during `📖 Explanation` demos for older readers (`8+`) or adult co-pilots reading aloud.
- **No Developer or Adult Jargon in Learner Views:** Never surface terms like `Base64URL Binary Payload`, `Pre-simulated up to 1000 steps`, `Local Storage`, `• v1`, or raw enum identifiers (`PICK_UP`, `ARC_LEFT`, `STAMP_HEART`) in learner-facing UI.
- **Collapsible Adult Context:** Pedagogical summaries, `Core Concept`, and multi-sentence descriptions belong inside a collapsed **`📖 Parent / Teacher Tip`** disclosure (`aria-expanded="false"` by default).
- **Concrete Visual Metaphors:** Represent abstract concepts physically—for example, physical slot trays (`[■][■][□]`) for block caps, color-coded variable boxes (`[📦 a]`) instead of raw algebra, and shape-socket badges (`●`, `▲`, `■`) for function parameters.

---

## 2. Strict Single-Row `<header>` Budget

- **Never Wrap Across Any Viewport (`360px`–`1920px+`):** `<header>` (`Toolbar.tsx`) uses `flex-nowrap` with fixed single-row height (`48px` narrow / `56px` wide) and must maintain `header.scrollWidth <= header.clientWidth` at every viewport width from `360px` upward.
- **Allowed `<header>` Controls Only:**
  - **Left cluster:** `☰ Menu` (`btn-hamburger-menu`), `👤 Profile` (`hidden md:flex`), and `[◀ (hidden sm:flex) | Lesson/World Picker Pill (min-w-0 shrink truncate) | ▶ (hidden sm:flex)]`.
  - **Right cluster:** Optional `Update` pill (`hidden md:flex`), `💡 Hint` (`btn-solution` when available) or `💾 Save` (`btn-save-modal`, always visible on `md+` and visible on `<md` whenever `💡 Hint` is absent), `↶ Undo` (`btn-undo`), `⏮ Rewind` (`btn-reset`), `⏭ Step` (`btn-step`), `▶ Play / ⏸ Pause` (`btn-play` / `btn-pause`), and `⚡ Speed` (`btn-speed`).
- **Explicitly Forbidden in `<header>`:**
  - Numbered/slug lesson pill strips (`1..16`, `seq.0..rec.B`), `<select>` dropdowns, or `Learn / Sandbox` / `World` tab bars (use `LessonPickerModal` and `☰ Menu`).
  - Simulation/map editor toolbars (`GridToolbarTools`, `TurtleToolbarTools`, `BeatToolbarTools`).
  - Live runtime watch bars (`VARS`), backpack indicators, or multi-map/multi-stream validation pips.
  - Secondary actions like `Redo`, `Start Over`, `Edit in Sandbox`, `Load`, `Share`, or `Fullscreen` (all live in `☰ Menu`).

---

## 3. Non-Overlapping `pane-simulation` HUD Architecture

All 5 environments share the unified flex shell `[Top Dock shrink-0] -> [Viewport relative flex-1 min-h-0] -> [Bottom Dock shrink-0]` in `src/App.tsx`, guaranteeing a **`>= 48px` top HUD clearance band** inside the canvas viewport (or dedicated `shrink-0` header bar in Beat) without per-environment offset hacks (`top-12`). Every overlay or toolbar inside `pane-simulation` has a dedicated, non-colliding slot:

| Slot | Location inside `pane-simulation` | Assigned Controls |
| :--- | :--- | :--- |
| **Top Dock (`shrink-0`)** | Flex row(s) above canvas | `GridToolbarTools` in Sandbox Grid (`Robot`, `Wall`, `Flag`, `Goal`, `World Items` popover, `Erase`, `Clear Map`; collapsible behind `✏️ Edit Map` on `<640px`), the `🎛️ $input` Scene Selector (`branch`+), and/or the windowed 7–9 cell `TapeDock` (`shrink-0`, `tape`+ with `Jump #` & per-worker heads `▲1`/`▲2` in `conc`). Never floats over canvas cells or resize handles. |
| **Top-Left Stack** | `absolute top-3 left-3 flex flex-col items-start gap-1.5` | Shared vertical HUD stack for `toolbar-variables` (`VARS` live numeric & color-swatch memory watch boxes, incl. `TYPE_ERROR` bounce), `rec` `CallStack` depth/socket pills (`[Main] -> [F1 ●:3]`), and `conc` lock/channel wait badges (`⏳🔒`, `⏳📬`)—guaranteeing zero overlap. *(Legacy `BackpackHud` `🎒` is retired globally; Robot & Depot render carried items directly on their shoulder/claw grippers.)* |
| **Top-Center Pill** | `absolute top-3 left-1/2 -translate-x-1/2` | `status-success` (`🏁`), distinct terminal error pills (`💥` Collision, `🎨≠#` Type Error, `🧮÷0` Math Error, `📚💥` Stack Overflow, `⏳🔁` Step Limit, `🔒💥` Deadlock), and `branch`+ multi-map / multi-stream / multi-depot status pips (`[1 ✓] [2 ✗] [3 ·]`). |
| **Top-Right Badge** | `absolute top-3 right-3` | Compact read-only map indicator (`grid-readonly-badge` with `sr-only` text) + board size badge (`grid-size-indicator`) + `⏱️` Wall-Clock Tick Speedometer (`sort` / `conc`+) in Grid/Depot/Switchyard, or `Hide Turtle` (`🐢👁️`) + `Loop` (`∞`) + `Random Seed` (`🎲`, `tool-random-seed`) / `Flipbook` (`🕒 Xs`) / `♾️ Live` mode pills in Turtle LOGO ([`envs/turtle_logo.md`](./envs/turtle_logo.md)). |
| **Bottom-Left Pill** | `absolute bottom-3 left-3` | Compact `turtle-info-pill` (`X:` / `Y:` + heading, plus `$frame` in Flipbook mode) in Turtle LOGO. |
| **Bottom-Right Controls** | `absolute bottom-3 right-3` | Grid `Trace` + `Fit` buttons (`GridCanvas`), or compact `TurtleToolbarTools` (`+`, `-`, `Fit`, `Center`) in Turtle LOGO. |
| **Canvas Header Row** | `BeatCanvas` `shrink-0` top bar | Beat `🎵 #N` step counter + gated `tool-beat-active-color` swatch (shown only when `SET_LED_COLOR` is in lesson palette; `Black` `8` renders as recessed LED-off + `⊘` erase cue outside core `ColorVisual`) + `tool-beat-mute` (`🔊`/`🔇`) + `Loop Mode` (`∞`) toggle + `Random Seed` (`🎲`, `tool-random-seed`), cleanly above canvas and clear of `SimulationTopLeftHud`. Beat's directional `(1,1)` cursor reticle (`beat-cursor-reticle`) renders only when `cursor.visible === true`. |
| **Bottom Dock (`shrink-0`)** | Flex dock(s) below canvas | LOGO Flipbook Timeline Scrubber + `⏩ Render All` / `🧹 Clear Between Frames` bar (`anim`), `inter` Virtual D-Pad + `🅰️`/`🅱️` action bar, `VariationCardsPanel` (compact white ring `variation-beat-cursor`), and `CurriculumNextLessonBar` (`⭐ Next →` bar on solved puzzle exercises). |

---

## 4. One Icon = One Meaning (Strict Icon Disambiguation & Icon Preservation)

Never reuse the same arrow, padlock, or trash glyph for unrelated concepts, and preserve existing refined SVG icons across `VisualParamBadges.tsx`, `BlockItem.tsx`, and `*Environment.tsx` by default:

- **`Undo2` (`↶`):** Workspace Undo **only** (`btn-undo`).
- **`Redo2` (`↪`):** Workspace Redo **only** (`drawer-btn-redo` inside `☰ Menu`).
- **`SkipBack` (`⏮`):** Simulation Rewind / Reset to Start **only** (`btn-reset`).
- **`RotateCcw` / `RotateCw`:** Spatial robot/turtle Left & Right turns **only** (`TURN_LEFT` / `TURN_RIGHT`).
- **`CornerDownLeft` / Closing Brackets & Under-Block Rails:** `CornerDownLeft` is reserved for loop-back closers (`LOOP_END`, `END_WHILE`), while `END_IF` spells `END` (matching `IF` / `ELSE IF` / `ELSE`)—never `Undo2` or `SCRAP_ITEM`. All multiblock structures (`LOOP`, `IF`, `WHILE`) share the bottom-up non-crossing under-block bracket rail system (`loop-bracket-segment`).
- **`Trash2` (`🗑️`):** Single smart workspace Trash control (`btn-trash`)—never twin side-by-side trash buttons.
- **On-Agent Carry vs. Retiring `🎒`:** Carried items render directly on Robot's upper-right shoulder gripper and Depot's claw jaws (with `carryingItem` sensor showing a mini robotic claw holding an item instead of `🎒`).
- **Ordered Waypoints & Goals (`1 ⋯▶ 2`, Shuttered `🏁`):** Grid ordered flags use numbered dashed sequence chains `1 ⋯▶ 2` (omitted when `order === 0`), and locked goals use a shuttered `🏁 k/N` barrier instead of `🔒`, reserving padlocks (`🔒`/`🔓`) strictly for `conc` Mutex blocks and wait rings.

---

## 5. Destructive Safety & Anti-Duplication

- **Smart 2-Tap Trash (`btn-trash`):**
  - When a block is selected (`selectedBlockId !== null`): **1 tap** deletes only that selected block (`removeBlock`).
  - When no block is selected and the active scope has blocks: **1st tap** arms confirmation (`data-armed="true"`, red `Trash2 + ?`); **2nd tap within 3s** calls `clearWorkspace(activeScope)` (strictly clearing the active scope, **never** `resetActivityToStarter`, so starter-populated creative lessons can be genuinely cleared). Auto-disarms after 3s, `Escape`, outside pointer tap, or selection/scope/lesson changes.
- **Universal 1-Tap Undo Protection:** Loading a Clue Scaffold, Full Solution, Variation Card, or `Start Over` (`resetActivityToStarter`) must push the learner's prior blocks onto the Undo stack first.
- **Zero Duplicate Controls:** Do not add secondary Undo buttons (`btn-variation-undo`, `btn-workspace-undo`) or redundant canvas Clear buttons (`tool-clear-canvas`, `tool-beat-clear`) that duplicate top-bar `↶ Undo` and `⏮ Rewind`.

---

## 6. Modal, Victory Celebration, Touch Targets & SSR Rules

- **Above-the-Fold Primary CTAs:** Every modal (`SolutionModal`, `SaveProgramModal`, `LoadProgramModal`, `ExportImportModal`, `LessonPickerModal`, `ProfileSwitcherModal`, `LessonVersionMismatchModal`) must keep its primary kid action visible without scrolling on both `375×667` phones and `1280×800` desktops.
- **Full-Screen Click-to-Dismiss Victory Celebration (`VictoryCelebrationModal`):**
  - Opens synchronously in store state (`isVictoryModalOpen: true`, using CSS entrance delay on animated runs rather than async store timers) when `step()` / `play()` or a direct user block edit in `instant` mode transitions `prevStatus !== 'SUCCESS'` → `'SUCCESS'`, or when a Capstone / Module Badge (`🏅`) is earned.
  - **Spam Guards:** Never trigger on `loadSolution()`, `format === 'explanation'` demo tabs, map edits, mode/lesson/world switches, hydration, `importCode()`, or `undo()`/`redo()`.
  - **Click Anywhere to Dismiss:** Clicking/tapping anywhere on the overlay (or pressing `Escape` / `Enter` / `Space`) dismisses the modal while keeping the canvas `status-success` pill visible underneath; `Next ▶` (`btn-victory-next`, `e.stopPropagation()`) advances in Curriculum mode.
- **Touch Targets:** Interactive controls must be `≥ 36×36px` on narrow mobile (`<640px`) and `≥ 44×44px` on tablet/desktop (`≥768px`).
- **Zustand v5 SSR Compatibility & Selective Subscriptions (`renderToStaticMarkup`):** Components reading `useAppStore` should subscribe selectively via `useAppStoreSelector` (`src/store/useAppStore.ts`, backed by `useSyncExternalStore(useAppStore.subscribe, getSnapshot, getSnapshot)` with `shallow` equality) so Vitest `renderToStaticMarkup` tests reflect `useAppStore.setState(...)` mutations deterministically while avoiding unnecessary client re-renders on unrelated store ticks:
  ```ts
  const { activeSimId, isPlaying } = useAppStoreSelector((s) => ({
    activeSimId: s.activeSimId,
    isPlaying: s.isPlaying,
  }));
  ```
  Closed modals and drawers should gate on their open boolean (`useAppStoreSelector((s) => s.isFooOpen)`) before rendering content.
