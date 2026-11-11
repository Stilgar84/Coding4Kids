# Kid-Friendly UI Principles & Guidelines (Ages 5–7)

This document defines the mandatory UI, layout, iconography, and accessibility rules for all components across **🤖 Robot Grid**, **🐢 Turtle LOGO**, **🎵 Beat & Light Matrix**, and **🚂 Switchyard** (see also [curriculum.md](./curriculum.md) and [platform_requirements.md](./platform_requirements.md)).

---

## 1. The 5–7 Year-Old Zero-Reading Rule

- **Visuals First, Minimal Labels:** Primary learner controls must communicate through unmistakable icons, color/shape cues, spatial placement, and gentle animations—paired at most with 1–2 short words (e.g., `Save`, `Hint`, `Next ▶`).
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
  - Numbered lesson pill strips (`1..16`, `1.0..9B`), `<select>` dropdowns, or `Learn / Sandbox` / `World` tab bars (use `LessonPickerModal` and `☰ Menu`).
  - Simulation/map editor toolbars (`GridToolbarTools`, `TurtleToolbarTools`, `BeatToolbarTools`).
  - Live runtime watch bars (`VARS`), backpack indicators, or multi-map/multi-stream validation pips.
  - Secondary actions like `Redo`, `Start Over`, `Edit in Sandbox`, `Load`, `Share`, or `Fullscreen` (all live in `☰ Menu`).

---

## 3. Non-Overlapping `pane-simulation` HUD Architecture

Every overlay or toolbar inside `pane-simulation` has a dedicated, non-colliding slot:

| Slot | Location inside `pane-simulation` | Assigned Controls |
| :--- | :--- | :--- |
| **Top Dock (`shrink-0`)** | Flex row above canvas (Sandbox Grid only) | `GridToolbarTools` (`Robot`, `Wall`, `Flag`, `Goal`, `World Items` popover, `Erase`, `Clear Map`; collapsible behind `✏️ Edit Map` on `<640px`). Never floats over grid cells or resize handles. |
| **Top-Left Stack** | `absolute top-3 left-3 flex flex-col items-start gap-1.5` | Shared vertical HUD stack for `BackpackHud` (`🎒`), `toolbar-variables` (`VARS` live memory watch boxes), and Module 9 `CallStack` frames—guaranteeing zero overlap. |
| **Top-Center Pill** | `absolute top-3 left-1/2 -translate-x-1/2` | `status-success` (`🏁`), `status-collision` (`💥`), and Module 5+ multi-map / multi-stream status pips (`[1 ✓] [2 ✗] [3 ·]`). |
| **Top-Right Badge** | `absolute top-3 right-3` | Compact `🔒` read-only map indicator (`grid-readonly-badge` with `sr-only` text) + board size badge (`grid-size-indicator`). |
| **Bottom-Left Pill** | `absolute bottom-3 left-3` | Compact `turtle-info-pill` (`X:` / `Y:` + heading) in Turtle LOGO. |
| **Bottom-Right Controls** | `absolute bottom-3 right-3` | Grid `Trace` + `Fit` buttons (`GridCanvas`), or compact `TurtleToolbarTools` (`+`, `-`, `Fit`, `Center`) in Turtle LOGO. |
| **Canvas Header Row** | `BeatCanvas` `shrink-0` top bar | Beat step counter + `tool-beat-active-color` swatch + `tool-beat-mute` (`🔊`/`🔇`). |
| **Bottom Dock (`shrink-0`)** | Flex dock below canvas | `VariationCardsPanel` (illustrated/playable creative cards + `✓ Done / Next →` completion CTA). |

---

## 4. One Icon = One Meaning (Strict Icon Disambiguation)

Never reuse the same arrow or trash glyph for unrelated concepts:

- **`Undo2` (`↶`):** Workspace Undo **only** (`btn-undo`).
- **`Redo2` (`↪`):** Workspace Redo **only** (`drawer-btn-redo` inside `☰ Menu`).
- **`SkipBack` (`⏮`):** Simulation Rewind / Reset to Start **only** (`btn-reset`).
- **`RotateCcw` / `RotateCw`:** Spatial robot/turtle Left & Right turns **only** (`TURN_LEFT` / `TURN_RIGHT`).
- **`CornerDownLeft` / Closing Brackets:** Structural block closers (`LOOP_END`, and matching bracket glyphs for future `END_IF` / `END_WHILE`)—never `Undo2`.
- **`Trash2` (`🗑️`):** Single smart workspace Trash control (`btn-trash`)—never twin side-by-side trash buttons.

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
- **Zustand v5 SSR Compatibility (`renderToStaticMarkup`):** Components reading `useAppStore` must subscribe and read live state via the SSR-safe pattern:
  ```ts
  useAppStore();
  const { ... } = useAppStore.getState();
  ```
  so Vitest `renderToStaticMarkup` tests reflect `useAppStore.setState(...)` mutations deterministically.
