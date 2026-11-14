# Platform & Shared Architecture Implementation Plan (v2)

**Status:** Stage 2 Authoritative Spec (`platform`)
**Owners:** `platform` (Shared Engine, Serialization, Store, Shared Chrome/UI, Curriculum Framework)
**Related Docs & Specs:**
- [`docs/ui_guidelines.md`](../../docs/ui_guidelines.md)
- [`docs/platform_requirements.md`](../../docs/platform_requirements.md)
- [`docs/binary_format.md`](../../docs/binary_format.md)
- [`specs/v2/master_roadmap_and_shared_files.md`](./master_roadmap_and_shared_files.md)
- [`specs/curriculum_m4_m6_plan.md`](../curriculum_m4_m6_plan.md) (baseline M4–M6 context)

---

## 1. Current `src/` Baseline & Verified Live Bugs Inventory

This baseline reflects direct Stage 2 Round A inspection of shared `src/` files:

### 1.1 Interpreter, Headless Runner & Placeholders
- **`src/engine/interpreter.ts`**:
  - Enforces `MAX_CALL_STACK_DEPTH = 32` and `MAX_TOTAL_STEPS = 10000`, currently returning `'COLLISION'` on both stack overflow and step-limit expiration rather than explicit terminal statuses (`STACK_OVERFLOW`, `STEP_LIMIT`).
  - `evaluateValue` supports numeric literals/variables only (no `TypedValue` `'number'` vs `'color'` discrimination yet), and `evaluateBinaryOp` silently returns `0` on `/ 0` and `% 0` instead of returning `MATH_ERROR`.
  - `CALL_F1..CALL_F3` pushes `{ scope, pc: 0, subTickLeft: 0 }` without frame-local parameter bindings; `PLACEHOLDER` pauses cleanly.
- **`src/engine/simulationRunner.ts`**:
  - `registerSimulation` omits `switchyardSimulationEnvironment` from the shared registry.
  - `runHeadlessSimulation` hardcodes `MAX_SAVE_SIMULATION_STEPS = 1000` and coerces non-`SUCCESS`/`COLLISION`/`PAUSED` statuses to `'IDLE'`.
- **`src/engine/placeholderHelpers.ts`**:
  - `computeGhostPreviewSteps` currently supports Grid simulations only.
  - `inferHintCategoryForBlockType` omits `DEPOT_SEND_GATE`, conditional blocks, sensors, variables, operators, and shape sockets.

### 1.2 Serialization & Binary Protocol
- **`src/engine/serialization/env/beatSerializer.ts`**:
  - Live Beat opcodes **`0x1E` (`OP_BEAT_SET_DELAY`, lines `114, 228, 323`)** and **`0x1F` (`OP_BEAT_WAIT_DURATION`, lines `91, 240, 330`)** occupy the top of the `0x10..0x1F` environment opcode window, making Beat's 16-slot env opcode range 100% full.
- **`src/engine/serialization/conditionSerializer.ts`**:
  - `PALETTE_COLOR_NAMES` maps index `4` to `'amber'` without aliasing `'yellow'`, breaking `tileColor('yellow')` round-trip encoding.
  - `SENSOR_REF_FLAG = 0x80`, `COLOR_LITERAL_FLAG = 0x40`, and `COND_TAG_CMP_RESERVED = 0x30` are declared; `writeSensorExpr` has an `itemDamaged` encoding collision (`0x11` Switchyard vs `0x1A` Depot v1–v3) to clean up as Depot retires `0x1A` on v4.
- **`src/engine/serialization/profileSerializer.ts`**:
  - `SIM_CODE_GRID=0..DEPOT=4` is wired (`encodeCompactLessonId` already writes `0x80..0xFD` for numeric `1.0..9C` and lossless `0x01..0x7F` UTF-8 strings for slug IDs).
  - `BEAT_EXCLUSIVE_BLOCKS` omits `SET_BEAT_DELAY` and `STAMP_FROM_TAPE`; `DEPOT_EXCLUSIVE_BLOCKS` omits `DEPOT_SEND_GATE`.
  - `statusToCode` maps `IDLE=0, SUCCESS=1, COLLISION=2, PAUSED=3` (extended terminal failure statuses need consistent mapping into failure class `2` on legacy v1 saves without data loss).
- **`src/engine/serialization/codeScopes.ts` & `codeSerializer.ts`**:
  - Scope serialization covers `MAIN` and `F1..F3` (`0x00`, `0x81..0x83`) but lacks concurrent worker scopes `MAIN_2..MAIN_4` (`0x01..0x03`), `inter` queued event scopes (`0x40..0x46`), Tape opcodes (`0x0C..0x0E`), universal escape `0x0F OP_EXT`, `OP_CALL_FN` (`0x03` bit `0x20`) argument streams, and active `0x30 CMP` / `0x28..0x2E` condition tags.

### 1.3 Curriculum Policy, Store & Services
- **`src/data/curriculum/types.ts` & `src/data/curriculum/index.ts`**:
  - `PaletteConfig`, `SlotCapConfig`, `AntiBypassRule`, `ConditionSensorType` (currently Grid/Switchyard/Depot only), `ConditionExpr` (includes `cmp` shape), `ActivityVersionPayload`, `CurriculumActivity`, `CurriculumModule`, `MasteryChallengeTier`.
  - `CURRICULUM_MODULES` imports linear `M1..M6` without Side-Track DAG prerequisite links (`cmp ==> inter`, `tape ==> anim`, `args ==> conc`, `rec ==> fp`) or legacy numeric-to-slug alias tables.
- **`src/utils/curriculumStagePolicy.ts`**:
  - Needs `remainingForScope >= 2` atomic control-pair support, `allowedBlockParams` (`A/B` switch, active Beat color gating), `palette.allowRecursion`, Side-Track DAG module resolution, and slug ID lookup aliases.
- **`src/services/profileService.ts`**:
  - `markLessonCompleted` iterates linear `CURRICULUM_MODULES[i + 1]` and does not unlock Side-Track DAG branch modules.
- **`src/store/useAppStore.ts`**:
  - `setFocusedVariantIndex` updates `gridState` and `depotState` but **omits `switchyardState`**, breaking multi-stream inspection in Switchyard.
  - `addBlock` checks single-slot remaining capacity only; it does not enforce atomic pair insertion (`remainingForScope >= 2`) for structural pairs (`LOOP_START`+`LOOP_END`, `IF`+`END_IF`, `WHILE`+`END_WHILE`).
  - `step` and `play` execution loops need synchronized support for extended terminal statuses (`TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, `DEADLOCK`), `$input` reactive reruns, queued events (`inter`), Tape state, Flipbook/Live modes, and round-robin `WorkerFiberState[]`.

### 1.4 Shared UI Chrome & Workspace Components
- **`src/App.tsx`**:
  - `ActiveSimulationPane` passes `positionClassName={activeSimId === 'depot' ? 'top-12 left-3' : 'top-3 left-3'}` to `<SimulationTopLeftHud />`, breaking the unified `[Top Dock / Viewport / Bottom Dock]` shell (`>= 48px` HUD clearance) and creating Beat canvas corner overlap.
- **`src/components/MultiRunPipsBar.tsx`**:
  - `isFail` checks `'COLLISION'` only, misclassifying `TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, and `DEADLOCK`.
- **`src/components/BlockSubpalette.tsx`**:
  - Edits `VAR_ASSIGN`, `VAR_OP`, and generic `simPaletteItems` `paramDefs` **with zero UI to edit `IF` / `ELSE_IF` / `WHILE` conditions (`<ConditionSubpalette>`)**.
  - Lines `63–95` hardcode `allKnown = ['$tileDial','$x','$y','$heading']`, filtering out all non-Grid/Turtle environment sensors.
- **`src/components/BlockPalette.tsx` & `src/components/WorkspaceCanvas.tsx`**:
  - `CORE_CONTROL_ITEMS` inserts single control blocks (`LOOP_START`, `IF`, `WHILE`) individually rather than paired (`LOOP_START+LOOP_END`, `IF+END_IF`, `WHILE+END_WHILE`) with atomic `remainingForScope >= 2` gating.
- **`src/components/BlockItem.tsx`**:
  - `lines 761, 786` render `'🎯 Dial'` English label instead of a zero-reading graphic (duplicated in `BlockSubpalette.tsx:64,78,109`).
- **`src/components/ConditionBadge.tsx`**:
  - Line `80` renders `carryingItem` using the `🎒` backpack icon retired under [`docs/ui_guidelines.md`](../../docs/ui_guidelines.md); lines `54–59` (`cmp`) need full multi-env sensor/typed comparison rendering.
- **`src/components/LessonPickerModal.tsx`**:
  - `sim-tab-depot` displays `"Crate Depot"` instead of `"Depot"` (also check `SaveProgramModal`); `CURRICULUM_MODULES.map(...)` renders flat tabs without Side-Track DAG branch cues.
- **`src/components/SolutionModal.tsx`**:
  - Lines `375–440` duplicate block icon/color switches manually (amber `IF` without `<ConditionBadge>`, `WHILE` uses `Repeat`, `SCRAP_ITEM` uses `CornerDownLeft`).
- **`src/components/MobileDrawerMenu.tsx`**:
  - Align Hide/Show Turtle toggle cues with `🐢👁️`.

---

## 2. Keep-vs-Replace Matrix

| Area | File / Symbol | Decision | Rationale & Action |
|---|---|---|---|
| **Binary I/O** | `src/engine/serialization/binaryWriter.ts`, `binaryReader.ts` | **KEEP** | Clean bounded buffer primitives; reuse for all v2–v4 env payloads and `0x0F OP_EXT`. |
| **Compact ID Codec** | `encodeCompactLessonId` in `profileSerializer.ts` | **KEEP** | Already supports `0x80..0xFD` (`1.0..9C`) and lossless `0x01..0x7F` UTF-8 slug paths. |
| **Param SVGs** | `VisualParamBadges.tsx` (`RotationVisual`, `ArcAngleVisual`, `AngleVisual`, `RadiusVisual`, `ColorVisual`, `PenWidthVisual`, `LengthVisual`, `PitchVisual`, `BeatDurationVisual`, `StampPresetVisual`, `BeatDelayVisual`, `DepotStationVisual`, `DepotGateVisual`) | **KEEP / EXTEND APPROVED** | Preserve `RotationVisual`, `ArcAngleVisual`, `RadiusVisual` trajectory/curvature badges (no popover pie-wedge/combined-arc previews per `#295`/`#302`), `DepotStationVisual` `[1][2][3]`/`Q` geometry, and Beat `#ffffff`/`ColorVisual` invariant (`tests/module2ParamsAndBeatTier2.test.ts:516–539`). Apply **user-approved**: Ph1 Turtle `showEraserCue?: boolean` White (`9`) diagonal eraser-tip corner cue (`#302`); Ph2–3 Switchyard `[A]`/`[B]` & `[A]`/`[B]`/`[C]` chips (`#300`); Ph4 `DepotGateVisual` zero-reading `↪`/`✓`/`✗` SVG pills + `INPUT`/`TAPE` chips (`#299`). |
| **Header Bar** | `src/components/Toolbar.tsx` | **KEEP** | Strict single-row `<header>` budget works cleanly (`flex-nowrap`, `scrollWidth <= clientWidth` from `360px+`). |
| **Victory Modal** | `src/components/VictoryCelebrationModal.tsx` | **KEEP** | Synchronous live-transition spam guards + click-to-dismiss overlay (`dismissVictoryModal()`) prevent trapping young learners. |
| **Creative Next Bar** | `src/components/CurriculumNextLessonBar.tsx` | **KEEP** | Case A solved puzzle (`allVariantsSucceeded`) + Case B hidden-map creative bypass work cleanly. |
| **Spotlights** | `ExplanationDemoBar.tsx`, `VariableAndDialSpotlight.tsx` | **EXTEND** | Keep spotlight mechanics; add Phase 2–5 spotlights (Conditionals, Watch/Dial, Tape window, Sockets/Calls, Concurrency wait) and apply Ph3 `$tileDial` circular rotary gauge alignment (`#301`). |
| **Viewport Shell** | `src/App.tsx` (`ActiveSimulationPane`, `SimulationTopLeftHud`) | **REPLACE LAYOUT** | Unified `[Top Dock shrink-0 -> Viewport flex-1 min-h-0 -> Bottom Dock shrink-0]`; retire `depot` `top-12` hack; guarantee `>= 48px` HUD clearance. |
| **Backpack & Conditions** | `BackpackHud` & `ConditionBadge.tsx` (`L80` `🎒`, env badges) | **RETIRE / UPGRADE APPROVED** | Globally retire `🎒`; swap `carryingItem` to mini robotic claw. Apply **user-approved**: Ph2 Robot `itemHere` floor sparkle/box away from `💎` (`#301`), Switchyard unified `hasNextItem`/`itemDamaged`/`itemColor`/`itemIcon` (`#300`), and Depot `hasItem` claw-gripping-ring + `heldColor`/`topColor` Claw-Ring/Stack-Top SVGs (`#299`). |
| **Flags & Goals** | Lock padlocks (`🔒`) on multi-map flags / goals | **RETIRE** | Replace `🔒` with `1 ⋯▶ 2` dot-line chains and shuttered/closed `🏁` targets; swap `GridCanvas.tsx:615` `grid-readonly-badge` to `🛡️`/`👁️` (`#301`) so `🔒` stays 100% exclusive to `conc` Mutexes. |
| **Subpalette** | `src/components/BlockSubpalette.tsx` | **EXTEND / FIX** | Add `<ConditionSubpalette>` (`IF`/`ELSE_IF`/`WHILE`, Phase 2), replace hardcoded `allKnown` (`lines 63–95`) with dynamic `currentSimEnv.sensors` merge (Phase 3), and apply Ph3 `$tileDial` rotary gauge glyph (`#301`). |
| **Palette Pairing** | `src/components/BlockPalette.tsx`, `useAppStore.ts` (`addBlock`) | **EXTEND** | Convert control pairs (`LOOP_START+LOOP_END`, `IF+END_IF`, `WHILE+END_WHILE`) to atomic pair insertion requiring `remainingForScope >= 2` (Phase 2). |
| **Watch Overlay** | `src/components/VariableWatchOverlay.tsx` | **EXTEND** | Keep `VAR_SHAPE_MAP` (`●▲■★♪↕↔`), add `TypedValue` swatch rendering & `TYPE_ERROR` bounce animation (Phase 3). |
| **Multi-Run Pips** | `src/components/MultiRunPipsBar.tsx`, `useAppStore.ts` (`setFocusedVariantIndex`) | **FIX + EXTEND** | Fix `switchyardState` variant switching (Phase 2); treat all terminal failure statuses as `[k ✗]` `isFail` (Phase 3). |
| **Interpreter** | `src/engine/interpreter.ts`, `simulationRunner.ts` | **EXTEND** | Register `switchyard` (Ph 1), add `TypedValue` & terminal statuses (`TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, `DEADLOCK`) (Ph 3), Tape + `0x0F OP_EXT` (Ph 4), stack sockets/`allowRecursion`/`MAX_CALL_STACK_DEPTH = 64`/`WorkerFiberState[]` (Ph 5). |
| **Picker & Solution** | `LessonPickerModal.tsx`, `SaveProgramModal.tsx`, `SolutionModal.tsx` | **EXTEND / DEDUP** | Rename `"Crate Depot"` -> `"Depot"` (Ph 1), Side-Track DAG & slug aliases (Ph 3/4/5), deduplicate `SolutionModal` block rendering (`lines 375–440`). |

---

## 3. Engineering Principles & Scope Boundary

1. **Zero-Reading 5–7y Rule & Single-Row `<header>`:** Code blocks stay 100% zero-reading across all modules. `<header>` (`Toolbar.tsx`) remains `flex-nowrap` with zero world tabs, `VARS`, or toolbars; `Top Dock` (`shrink-0`) inside `pane-simulation` holds `GridToolbarTools`, `<SceneInputBar>` (`🎛️ $input`), and `<TapeDock>`, keeping **`>= 48px` clearance** above `SimulationTopLeftHud`.
2. **Icon Preservation Contract & User Icon Rulings (`#295`, `#299`, `#300`, `#301`, `#302`, `#304`):** Keep existing refined SVGs in `VisualParamBadges.tsx` (preserving LOGO `RotationVisual`, `ArcAngleVisual`, `RadiusVisual` trajectory/curvature badges — **no popover pie-wedge or combined-arc previews** per `#295`/`#302` — and keeping core `ColorVisual` symbol-free per `tests/module2ParamsAndBeatTier2.test.ts:516–539`), `BlockItem.tsx`, and `*Environment.tsx` unchanged by default. Only Stage-1-approved fixes (`BackpackHud` retirement, `1 ⋯▶ 2` / shuttered `🏁` flags, conditional `(1,1)` Beat reticle & `tool-beat-active-color` gating, Depot `SCRAP` retirement) and **user-approved icon updates across Phases 1–4** (`#299` Depot, `#300` Switchyard, `#301` Robot, `#302` LOGO, `#304` Beat — cataloged in **§6.1**) ship directly; **§6.2** holds the sole remaining pre-Phase-5 optional item.
3. **Lossless Backward Compatibility (`FORMAT_VERSION = 1`):** Every `envVersion` ceiling bump (`grid v4`, `turtle v2`, `beat v2`, `switchyard v2`, `depot v4`) MUST preserve byte-faithful decoding of all v1–v3 URL shares, local saves (`localSaveService.ts`), profiles (`profileService.ts`), and PWA restore payloads (`pwaStateRestoreService.ts`).
4. **Strict Store & Shared-File Boundary:** All React components reading Zustand state use SSR-safe `useAppStoreSelector` (`useSyncExternalStore` + `shallow`). Env packages integrate exclusively via `SimulationEnvironment` hooks without modifying shared `interpreter.ts` internals.
5. **Anti-Bypass & Split-Sandbox Testing:** Every headless curriculum solution verification MUST pass `< 200ms` per puzzle (including Partial `?` scaffolds and Anti-Bypass negative checks). Per `AGENTS.md`: `npm run build` and `npm run test:unit` run in standard sandbox (`BypassSandbox: false`), while `npx playwright test`, `npm run test:e2e`, and `npm test` run directly with `BypassSandbox: true`.

---

## 4. Synchronized 5-Phase Platform Implementation Plan

This 5-phase sequence matches [`docs/platform_requirements.md` §4](../../docs/platform_requirements.md#4-phased-delivery-roadmap-synchronized-5-phase-progressive-ladder) and [`specs/v2/master_roadmap_and_shared_files.md` §2](./master_roadmap_and_shared_files.md#2-synchronized-5-phase-progressive-ladder-platform--all-5-environments) 1:1.

### Phase 1: Core Spine `seq` → `param` → `loop` → `func` *(Baseline Chrome, HUD Clearance, User-Approved Ph1 Icons & Hygiene)*
*Goal: Rock-solid M1–M3/4 UX baseline across all 5 environments with zero HUD overlap, retired `🎒` / non-mutex `🔒`, clean Beat Black=Off visuals, Turtle eraser/TELEPORT polish, and simulation registration.*

- **Commit `P1-C1` — Unified Top/Viewport/Bottom Shell, HUD Clearance & Rename**
  - **Files:** `src/App.tsx`, `src/components/SimulationTopLeftHud.tsx`, `src/components/LessonPickerModal.tsx`, `src/components/SaveProgramModal.tsx`, `src/components/MobileDrawerMenu.tsx`, `src/engine/simulation/types.ts`, `src/components/VariationCardsPanel.tsx`, `src/services/pwaStateRestoreService.ts`
  - **Changes:**
    - Refactor `ActiveSimulationPane` in `src/App.tsx` to `[Top Dock shrink-0 -> Viewport relative flex-1 min-h-0 -> Bottom Dock shrink-0]` across all 5 sims; delete the `activeSimId === 'depot' ? 'top-12 left-3' : 'top-3 left-3'` offset hack and guarantee `>= 48px` clear top sky inside canvas viewports / Beat header row.
    - Rename `sim-tab-depot` / `"Crate Depot"` → `"Depot"` across `LessonPickerModal.tsx` and `SaveProgramModal.tsx`.
    - Align Hide/Show Turtle label/glyph cues in `MobileDrawerMenu.tsx` with `🐢👁️`.
    - Coordinate Beat `#304` `Black` (`8` / `#0f172a`) = Off/Erase main-view fix: normalize `#0f172a`/`#000000` → `null` in `sanitizeBeatState` (`pwaStateRestoreService.ts`), guard `isLit = Boolean(ledColor) && !isBeatLedOffHex(ledColor)` in `VariationCardPreview` (`VariationCardsPanel.tsx:597`), keep compact white ring on `variation-beat-cursor` (`629–636`, no miniature directional triangle per user `#304`), and upgrade `beat-step-counter` to `🎵 #N`.
    - Extend `SimulationEnvironment.Renderer` props in `src/engine/simulation/types.ts` with optional live telemetry cues (`activeBlockId` / step-eval hooks) for spotlights.
- **Commit `P1-C2` — Retire `BackpackHud` (`🎒`) & Non-Mutex `🔒`, Approved Ph1 Icons (`#301`/`#302`/`#304`), Switchyard Registry & Codec**
  - **Files:** `src/components/ConditionBadge.tsx`, `src/components/SimulationTopLeftHud.tsx`, `src/components/params/VisualParamBadges.tsx`, `src/components/params/BlockParamBadge.tsx`, `src/components/params/ParamSelectionPopover.tsx`, `src/components/BlockItem.tsx`, `src/engine/simulationRunner.ts`, `src/engine/serialization/profileSerializer.ts`, `src/utils/curriculumStagePolicy.ts`
  - **Changes:**
    - Retire `BackpackHud` (`🎒`) globally; update `ConditionBadge.tsx` line `80` `carryingItem` icon from `🎒` to a crisp mini robotic claw holding an item matching Robot/Depot claws; coordinate with `env-robot` on `1 ⋯▶ 2` / shuttered `🏁` flags and `GridCanvas.tsx:615` `grid-readonly-badge` `🛡️`/`👁️` (`#301`) so `🔒` is reserved solely for `conc`.
    - Apply **user-approved LOGO `#302` icons**: add `showEraserCue?: boolean` diagonal eraser-tip corner accent on `#ffffff` (`White`, `9`) gated strictly to Turtle `SET_PEN_COLOR` inside `VisualParamBadges.tsx` / `BlockParamBadge.tsx` / `ParamSelectionPopover.tsx` (zero `data-shape-cue`, leaving Beat `#ffffff` & `tests/module2ParamsAndBeatTier2.test.ts:516–539` untouched), and add miniature turtle silhouette accent beside `Crosshair` on `TELEPORT` (`BlockItem.tsx`).
    - Apply **user-approved Beat `#304` swatch cue**: style Beat `#0f172a` (`Black`) as recessed off-pad + `⊘` Erase overlay outside `ColorVisual` in `BlockParamBadge.tsx:53–67` and `ParamSelectionPopover.tsx:263–275` (`SET_LED_COLOR` only, preserving symbol-free `ColorVisual` test invariant).
    - Register `switchyardSimulationEnvironment` in `src/engine/simulationRunner.ts` (`registerSimulation`).
    - Add `'SET_BEAT_DELAY'` to `BEAT_EXCLUSIVE_BLOCKS` and `'DEPOT_SEND_GATE'` to `DEPOT_EXCLUSIVE_BLOCKS` in `src/engine/serialization/profileSerializer.ts`.
    - Prep `curriculumStagePolicy.ts` hooks for Side-Track DAG edges (`sideTracks` / prerequisites) and `allowRecursion` guardrails.
- **Phase 1 Verification:**
  - *Human checks:* (1) All 5 sim viewports clear `<SimulationTopLeftHud />` by `>= 48px` at `375×667` and `1280×800`; (2) `BeatCanvas` `(1,1)` shows no phantom reticle on play-only lessons, gates `tool-beat-active-color`, renders `🎵 #N`, and draws Beat `Black (8)` as recessed LED-off (`⊘` erase badge); (3) Zero `🎒` icons remain and `grid-readonly-badge` uses `🛡️`/`👁️`; (4) Turtle `SET_PEN_COLOR` White shows `showEraserCue` & `TELEPORT` keeps `Crosshair`+mini-turtle while Beat `#ffffff` stays clean; (5) `switchyard` registers cleanly with `"Depot"` naming.
  - *Automated tests:* `npm run test:unit` (`BypassSandbox: false`) — existing `tests/module2ParamsAndBeatTier2.test.ts` remains green plus `tests/platformPhase1ChromeAndStore.test.ts` **(NEW)** covering `registerSimulation('switchyard')`, `BEAT_EXCLUSIVE_BLOCKS` (`SET_BEAT_DELAY`), `DEPOT_EXCLUSIVE_BLOCKS` (`DEPOT_SEND_GATE`), `BackpackHud` absence, and Beat `Black` = `null` sanitization. Playwright E2E (`BypassSandbox: true`) checking single-row `<header>` (`scrollWidth <= clientWidth` at `360px`/`1280px`) and zero HUD overlap across all 5 envs.

---

### Phase 2: Core `branch` → `while` *(Conditionals, `<ConditionSubpalette>`, Atomic Pairs, `$input` & Switchyard v2 / Depot v4)*
*Goal: Adaptive multi-map/multi-stream puzzles, interactive `<ConditionSubpalette>`, `$input`-driven branches, atomic control pairs, Switchyard v2 / Depot v4 handoffs, and user-approved Phase 2 condition/chip SVGs.*

- **Commit `P2-C1` — `<ConditionSubpalette>`, Atomic Control Pairs & `<SceneInputBar>`**
  - **Files:** `src/components/BlockSubpalette.tsx`, `src/components/ConditionSubpalette.tsx` **(NEW)**, `src/components/SceneInputBar.tsx` **(NEW)**, `src/components/BlockPalette.tsx`, `src/components/WorkspaceCanvas.tsx`, `src/store/useAppStore.ts`, `src/data/curriculum/types.ts`
  - **Changes:**
    - Build `<ConditionSubpalette>` **(NEW)** inside `BlockSubpalette.tsx` for editing `IF`, `ELSE_IF`, and `WHILE` blocks: staged `allowedSensors`, `allowedCombinators` (`NOT`, `AND`, `OR`), plus zero-reading color/icon/station pickers (`insideCanvas`, `cursorAtEdge`, `heldColor`, `topColor`, `stationEmpty`, `hasNextItem`, `itemColor`, `itemIcon`, `itemDamaged`, `tileColor`, `unvisitedAhead`, etc.).
    - Update `CORE_CONTROL_ITEMS` in `BlockPalette.tsx` and `addBlock` in `useAppStore.ts` to insert structural pairs atomically (`LOOP_START`+`LOOP_END`, `IF`+`END_IF`, `WHILE`+`END_WHILE`), gating on `remainingForScope >= 2` and shaking the `WorkspaceCanvas` slot tray when `< 2` slots remain.
    - Build Top-Dock **`<SceneInputBar>` (`🎛️ $input`)** + `setSceneInput` in `useAppStore.ts` with deterministic reset and auto-rerun on change.
    - Fix `setFocusedVariantIndex` in `useAppStore.ts` to sync `switchyardState` alongside `gridState` and `depotState`, and surface live condition-evaluation trace cues.
- **Commit `P2-C2` — Color Alias Fix, Condition Codes (`0x28`/`0x2A`/Depot v4), Placeholder Hints & Approved Ph2 Icons**
  - **Files:** `src/engine/serialization/conditionSerializer.ts`, `src/engine/placeholderHelpers.ts`, `src/components/ConditionBadge.tsx`, `src/components/params/VisualParamBadges.tsx`, `src/components/SolutionModal.tsx`, `tests/depotQueueAndScrap.test.ts`
  - **Changes:**
    - Fix `PALETTE_COLOR_NAMES` in `conditionSerializer.ts` so both `'yellow'` and `'amber'` alias cleanly to index `4`.
    - Add condition tags `0x28 insideCanvas` (Turtle) and `0x2A cursorAtEdge` (Beat), extend `STATION_CODES` `+6=PHYSICAL_TAPE`, and isolate legacy Depot `0x1A itemDamaged` to v1–v3 decode compat while Depot v4 retires `0x1A` (eliminating `writeSensorExpr` conflict with Switchyard `0x11 itemDamaged`).
    - Expand `inferHintCategoryForBlockType` in `placeholderHelpers.ts` to cover `DEPOT_SEND_GATE`, conditionals, sensors, variables, ops, and sockets.
    - Apply **user-approved Phase 2 condition & param visuals**:
      - *Robot (`#301`):* Switch `ConditionBadge.tsx` `itemHere` away from `💎` to a floor sparkle/box emblem (preventing collision with Ph5 `💎 Relic`), plus `unvisitedAhead` footprint preview badge.
      - *Switchyard (`#300`):* Render unified `hasNextItem` (mini train car + `?`), `itemDamaged` (cracked car + `⚡`), `itemColor` (colored chassis badge), and `itemIcon` (cargo emblem badge) in `ConditionBadge.tsx`; add `[A]`/`[B]` junction mini-chip in `VisualParamBadges.tsx`; replace Switchyard `SCRAP_ITEM` `CornerDownLeft` in `SolutionModal.tsx:413` with trapdoor+`♻️` chute glyph.
      - *Depot (`#299`):* Replace `hasItem` `📦` with toy-claw gripping a ring SVG and replace `heldColor`/`topColor` `✊`/`🔝` emojis with Claw-Ring vs Stack-Top micro-SVGs in `ConditionBadge.tsx`; coordinate `tests/depotQueueAndScrap.test.ts` migration cleanly with `env-depot`.
- **Phase 2 Verification:**
  - *Human checks:* (1) Selecting `IF`/`ELSE_IF`/`WHILE` opens `<ConditionSubpalette>` with staged zero-reading icons; (2) Adding `LOOP`/`IF`/`WHILE` with 1 remaining slot shakes the tray cleanly without creating orphans; (3) Switchyard `[1 ✓][2 ✗][3 ·]` pips switch `switchyardState`; (4) Changing `<SceneInputBar>` `🎛️` auto-reruns `branch` creative scenes; (5) Depot `hasItem` / `heldColor` / `topColor`, Switchyard `↙`/`↘` + trapdoor + `[A]`/`[B]`, and Robot `itemHere` render unmistakably without reading; (6) `tileColor('yellow')` round-trips cleanly.
  - *Automated tests:* `npm run test:unit` (`BypassSandbox: false`) — migrated `tests/depotQueueAndScrap.test.ts` plus `tests/platformPhase2Conditions.test.ts` **(NEW)** testing `<ConditionSubpalette>`, `remainingForScope >= 2` atomic pairing, `setFocusedVariantIndex` Switchyard sync, `'yellow'`↔`'amber'` index `4`, `0x28`/`0x2A`, and Depot v1–v3 `0x1A` legacy decode. Playwright E2E (`BypassSandbox: true`) running Switchyard v2 & Depot v4 conditional puzzles (`< 200ms` solver parity).

---

### Phase 3: Core `var` → `cmp` & Side `inter` *(Typed Values, `0x30 CMP`, Statuses, `🎲`, Dynamic Sensors & Queued Events)*
*Goal: Generative math art/music, typed safety (`TYPE_ERROR` watch bounce), distinct terminal failure pills, dynamic sensor subpalette, interactive `$pointer*`/D-Pad/`0x40..0x46` events, `cmp ==> inter` DAG, and user-approved Ph3 `$tileDial` / Switchyard badges.*

- **Commit `P3-C1` — `TypedValue` Runtime, Distinct `SimulationStatus`, `0x30 CMP` & Strict 3-Address Math**
  - **Files:** `src/types/index.ts`, `src/engine/interpreter.ts`, `src/engine/simulationRunner.ts`, `src/components/VariableWatchOverlay.tsx`, `src/components/SimulationTopLeftHud.tsx`, `src/components/MultiRunPipsBar.tsx`, `src/engine/serialization/conditionSerializer.ts`, `src/engine/serialization/profileSerializer.ts`
  - **Changes:**
    - Implement canonical `TypedValue` (`{ type: 'number'; value: number } | { type: 'color'; value: PaletteColor }`) over `PALETTE_COLORS` `0..9` (`0..7` matching `TURTLE_COLOR_PALETTE`, `'yellow'`/`'amber'`@4, `8='orange'`, `9='white'`). Update `VariableWatchOverlay.tsx` (`VarBadge`) to show filled swatches inside `●▲■★♪↕↔` sockets and bounce/pulse on type mismatch.
    - Extend `SimulationStatus` across `types/index.ts`, `interpreter.ts`, `simulationRunner.ts`, `SimulationTopLeftHud.tsx`, and `MultiRunPipsBar.tsx`: **`TYPE_ERROR` (`🎨≠#`)**, **`MATH_ERROR` (`🧮÷0`)**, **`STACK_OVERFLOW` (`📚💥`)**, **`STEP_LIMIT` (`⏳🔁`)**, **`DEADLOCK` (`🔒💥`)**. Return `MATH_ERROR` on `/ 0` and `% 0`, `STACK_OVERFLOW` on call depth overflow, and `STEP_LIMIT` on `MAX_TOTAL_STEPS = 10000` (stop coercing non-`SUCCESS/COLLISION/PAUSED` in `runHeadlessSimulation`; preserve failure class `2` compatibility in `statusToCode`).
    - Activate **`0x30 COND_TAG_CMP`** (`=`, `!=`, `<`, `<=`, `>`, `>=`), strict 3-address `OP_VAR_OP` (preserving floats for `$rand01 * 360`), and short-circuit `AND`/`OR`.
- **Commit `P3-C2` — `🎲` Random Presets, Dynamic Sensors (`allKnown` Fix), Approved Ph3 Icons (`#300`/`#301`), `inter` Events & `cmp ==> inter` DAG**
  - **Files:** `src/components/BlockSubpalette.tsx`, `src/components/BlockItem.tsx`, `src/components/params/VisualParamBadges.tsx`, `src/components/params/ParamSelectionPopover.tsx`, `src/engine/serialization/codeScopes.ts`, `src/engine/serialization/conditionSerializer.ts`, `src/data/curriculum/types.ts`, `src/data/curriculum/index.ts`, `src/utils/curriculumStagePolicy.ts`, `src/services/profileService.ts`, `src/components/LessonPickerModal.tsx`, `src/components/VariableAndDialSpotlight.tsx`
  - **Changes:**
    - Replace hardcoded `allKnown = ['$tileDial','$x','$y','$heading']` in `BlockSubpalette.tsx` (`lines 63–95`) with dynamic merge of `currentSimEnv.sensors` and curriculum `palette`.
    - Apply **user-approved Phase 3 icons**:
      - *Robot (`#301`):* Unify `$tileDial` across `BlockItem.tsx:761,786`, `BlockSubpalette.tsx:64,78,109`, `VariableAndDialSpotlight.tsx:167` (and `gridEnvironment.tsx:241`) onto one zero-reading circular rotary gauge glyph matching `BeaconAndDialLayer`.
      - *Switchyard (`#300`):* Add Switchyard numeric sensor badges `⚖️` (`$itemWeight`), `[A]` target gauge (`$dockQuota`), `[A]` filled bars (`$dockCount`), `🎨` (`$itemColor`), and `[A]`/`[B]`/`[C]` dock parameter chips in `VisualParamBadges.tsx` without changing existing non-Switchyard icons.
    - Add `🎲` seeded random sensors (`$randCoin`, `$randD4`, `$randD6`, `$randD8`, `$randD20`, `$rand01`, `$randomColor` `0x85..0x8B`) and interactive input refs (`$input` `0x84`, `$pointerX/Y/Down` `0x93..0x95`, Depot `0xA0..0xA4`, Switchyard `0xA8..0xAB`, Beat `0xB0..0xB2`) + `0x2E keyHeld`.
    - Wire `inter` Event Scopes **`0x40..0x46`** (`ON_TAP`, `ON_KEY_UP/DOWN/LEFT/RIGHT/A/B`) + Bottom-Dock D-Pad / `A`/`B` bar with single-threaded queued dispatch at idle or frame boundaries.
    - Enable Curriculum Slug IDs (`seq.0..rec.B`, `inter.*`, `cmp.*`), transparent legacy numeric aliasing (`"1.0"`→`"seq.0"`), and `cmp ==> inter` DAG unlock in `profileService.ts` & `LessonPickerModal.tsx`.
- **Phase 3 Verification:**
  - *Human checks:* (1) `a = tileColor; a = a + 1` bounces `VarBadge` and renders `TYPE_ERROR` (`🎨≠#`) pill; `/ 0` renders `MATH_ERROR` (`🧮÷0`); infinite `WHILE` renders `STEP_LIMIT` (`⏳🔁`); (2) Non-Grid sensors appear dynamically in `BlockSubpalette.tsx` and `$tileDial` uses the unified rotary dial everywhere; (3) Virtual D-Pad / pointer events drive queued `ON_TAP`/`ON_KEY_*` handlers smoothly; (4) Completing `cmp` unlocks `inter` side-track.
  - *Automated tests:* `npm run test:unit` (`BypassSandbox: false`) — `tests/platformPhase3TypedCmpInter.test.ts` **(NEW)** covering `TypedValue`, `0x30 CMP`, `/ 0` `MATH_ERROR`, `STEP_LIMIT`, `0x84..0xB2` refs, `0x40..0x46` queued dispatch, deterministic `🎲` seeding, and slug/DAG unlocks. Playwright E2E (`BypassSandbox: true`) testing `cmp`, `inter`, and `TYPE_ERROR` UX `< 200ms`.

---

### Phase 4: Core `tape` → `sort` & Side `anim` *(Sparse Tape, `TapeDock`, `OP_EXT 0x0F`, `⏱️` Speedometer, Flipbook Hooks & Approved `DepotGateVisual`)*
*Goal: 10,000-cell Sparse Memory Tape with windowed dock, `OP_EXT 0x0F` (incl. Beat `0x20 STAMP_FROM_TAPE`), search/sort Wall-Clock Tick Speedometer, `tape ==> anim` DAG, Flipbook/Beat v2 hooks, and zero-reading `DepotGateVisual` SVG pills.*

- **Commit `P4-C1` — Sparse `TapeState` (`1..10,000`), Opcodes `0x0C..0x0E`, `OP_EXT 0x0F`, `<TapeDock>` & `DepotGateVisual`**
  - **Files:** `src/types/index.ts`, `src/engine/interpreter.ts`, `src/engine/serialization/codeSerializer.ts`, `src/engine/serialization/profileSerializer.ts`, `src/store/useAppStore.ts`, `src/components/TapeDock.tsx` **(NEW)**, `src/components/BlockPalette.tsx`, `src/components/params/VisualParamBadges.tsx`, `src/services/localSaveService.ts`, `src/services/pwaStateRestoreService.ts`
  - **Changes:**
    - Add sparse `TapeState` (`length <= 10_000`, `cells: Record<number, TypedValue>`, `headPos`, `workerHeads?`) to interpreter & `useAppStore.ts`.
    - Wire `OP_TAPE_SEEK (0x0C)` (`Math.trunc`, `< 1` / `> length` → `'COLLISION'`), `OP_TAPE_STEP (0x0D)`, `OP_TAPE_WRITE (0x0E)`, Tape sensor refs (`0x8C..0x90`: `$cellValue`, `$cellColor`, `$cellEmpty`, `$headPos`, `$tapeLength`), and `0x2C cellEmpty`.
    - Implement **`OP_EXT = 0x0F`** dispatcher in `codeSerializer.ts` & `interpreter.ts` with Beat `0x20 EXT_BEAT_STAMP_FROM_TAPE` cleanly bypassing Beat's full `0x10..0x1F` range; add `'STAMP_FROM_TAPE'` to `BEAT_EXCLUSIVE_BLOCKS` in `profileSerializer.ts`.
    - Apply **user-approved Depot `#299` `VisualParamBadges.tsx`** upgrades: replace `'OUT'/'ACCEPT'/'REJECT'` uppercase text in `DepotGateVisual` with zero-reading `↪` / `✓` / `✗` SVG pills, and add `'INPUT'` / `'TAPE'` station chips while preserving `DepotStationVisual` `[1][2][3]`/`Q` base geometry.
    - Build Top-Dock **`<TapeDock>`** **(NEW)** (`7–9` cell sliding window centered on head, `Jump #`, Sandbox 10-swatch/number/`∅` cell editor popover) plus §9 Sparse Tape persistence for Sandboxes.
- **Commit `P4-C2` — `⏱️` Tick Speedometer, `tape ==> anim` DAG & Turtle/Beat `v2` Platform Hooks**
  - **Files:** `src/components/SimulationTopLeftHud.tsx`, `src/App.tsx`, `src/engine/simulationRunner.ts`, `src/components/VariationCardsPanel.tsx`, `src/utils/curriculumStagePolicy.ts`
  - **Changes:**
    - Render Top-Right **`⏱️` Wall-Clock Tick Speedometer** badge on `sort`+ lessons.
    - Expose Flipbook frame-caching & `VariationCardsPanel` animated preview loop hooks (`5–10 fps`, seeded `🎲`) and wire `tape ==> anim` Side-Track DAG unlock alongside Turtle `v2` / Beat `v2` serializers.
- **Phase 4 Verification:**
  - *Human checks:* (1) `<TapeDock>` scrolls cleanly across `1..10,000` sparse cells inside Top Dock without DOM overhead or HUD overlap; (2) Out-of-bounds `TAPE_SEEK` / `TAPE_STEP` stops cleanly with `'COLLISION'`; (3) Beat `STAMP_FROM_TAPE` round-trips via `0x0F 0x20` without disturbing `0x1E`/`0x1F`; (4) `DepotGateVisual` renders zero-reading `↪`/`✓`/`✗` SVG pills; (5) `sort` puzzles visibly count `⏱️` wall-clock ticks.
  - *Automated tests:* `npm run test:unit` (`BypassSandbox: false`) — `tests/platformPhase4TapeExtAndSpeed.test.ts` **(NEW)** testing `0x0C..0x0E`, `0x0F 0x20`, `BEAT_EXCLUSIVE_BLOCKS`, §9 Sparse Tape round-trip, `1..10,000` bounds collision, zero-reading `DepotGateVisual` pills, and Flipbook/`Beat v2` header decode alongside legacy v1 streams. Playwright E2E (`BypassSandbox: true`) testing Tape sort + Beat `STAMP_FROM_TAPE` + LOGO Flipbook `< 200ms`.

---

### Phase 5: Core `args` → `rec` & Sides `conc`, `fp` *(Sockets, Depth-64 Recursion, Multi-Worker Concurrency, `[Fn]` Sockets & Verification)*
*Goal: Parameterized recursive subroutines (`MAX_CALL_STACK_DEPTH = 64`), multi-worker round-robin concurrency (`MAIN_2..MAIN_4`), cycle `DEADLOCK`, higher-order `[Fn]` parameters, and full curriculum Anti-Bypass verification.*

- **Commit `P5-C1` — Shape Sockets (`●/▲/■`), `OP_CALL_FN` Args, Depth-64 Recursion & `SolutionModal` Dedup**
  - **Files:** `src/types/index.ts`, `src/engine/interpreter.ts`, `src/engine/serialization/codeSerializer.ts`, `src/utils/curriculumStagePolicy.ts`, `src/components/SimulationTopLeftHud.tsx`, `src/components/ExplanationDemoBar.tsx`, `src/components/SolutionModal.tsx`
  - **Changes:**
    - Add frame-local `StackFrame.args` (`●/▲/■`, `0xC0..0xC2`) and `OP_CALL_FN` (`0x03` bit `0x20`) arg stream in `codeSerializer.ts` while keeping zero-arg legacy calls byte-identical.
    - Raise `MAX_CALL_STACK_DEPTH` to **`64`** (reporting `STACK_OVERFLOW` `📚💥` on breach), enforce per-lesson `palette.allowRecursion`, and render call-stack breadcrumbs (`[Main] -> [F1 ●:3]`) in `SimulationTopLeftHud.callStackSlot`.
    - Deduplicate `SolutionModal.tsx` (`lines 375–440`) so clue blocks reuse shared `BlockItem` / `<ConditionBadge>` visuals 1:1.
- **Commit `P5-C2` — `conc` Concurrency (`MAIN_2..MAIN_4`, `OP_EXT 0x01..0x06`), `fp` `[Fn]` Sockets & DAG Completion**
  - **Files:** `src/types/index.ts`, `src/engine/interpreter.ts`, `src/engine/serialization/codeScopes.ts`, `src/engine/serialization/codeSerializer.ts`, `src/components/BlockPalette.tsx`, `src/components/TapeDock.tsx`, `src/components/SimulationTopLeftHud.tsx`, `src/data/curriculum/index.ts`, `src/services/profileService.ts`, `src/components/LessonPickerModal.tsx`
  - **Changes:**
    - Enable worker scopes **`MAIN_2..MAIN_4` (`0x01..0x03`)** in `codeScopes.ts` & `PALETTE_SCOPE_TABS` (`conc`).
    - Implement deterministic lockstep round-robin `WorkerFiberState[]` (`1` round across active workers = `1` `elapsedTicks` `⏱️`), `OP_EXT 0x01..0x06` (`SYNC_BARRIER`, `SEND`/`$recv 0x96`, `FORK`, `JOIN`, `LOCK`, `UNLOCK`), cycle-based `DEADLOCK` detector (`🔒💥`), Top-Left wait badges (`⏳🔒`, `⏳📬`, `⏳🚧`), and per-worker Tape cursor markers (`▲1`, `▲2`) in `TapeDock`.
    - Implement `fp` `StackFrame.fnBindings` (`[Fn]` sockets) + `OP_EXT 0x07 RETURN` & `0x08 CALL_PARAM_FN`.
    - Enable remaining Side-Track DAG edges (`args ==> conc`, `rec ==> fp`), Grid `ENV_VERSION_GRID_V4 = 4` shared hooks, and non-linear `LessonPickerModal` branch visuals.
- **Commit `P5-C3` — Full Verification Suite, Anti-Bypass Audit & Golden Legacy Corpus**
  - **Files:** `tests/` **(NEW & updated platform tests)**, `e2e/` **(NEW E2E verification)**
  - **Changes:**
    - Run automated headless curriculum verification across **all modules and side-tracks** in all 5 environments (`grid`, `turtle`, `beat`, `switchyard`, `depot`), asserting canonical `SUCCESS`, anti-bypass rejection of empty/partial programs, and **`< 200ms` runtime per puzzle**.
    - Assert 100% golden fixture decode parity across v1–v3 maps, legacy `0x80..0xFD` IDs, profiles, and localStorage restores.
- **Phase 5 Verification:**
  - *Human checks:* (1) `args`/`rec` show frame-local `●/▲/■` pills and trigger `STACK_OVERFLOW` at depth 64; (2) `conc` shows `MAIN_2..MAIN_4` tabs, exclusive `🔒`/`🔓` mutexes, `▲1`/`▲2` tape heads, wait rings, and crisp `DEADLOCK` badge; (3) `LessonPickerModal` shows `cmp ==> inter`, `tape ==> anim`, `args ==> conc`, `rec ==> fp` cleanly without text walls; (4) `SolutionModal` matches workspace blocks 1:1.
  - *Automated tests:*
    - `npm run test:unit` (`BypassSandbox: false`): full suite incl. `tests/platformPhase5ConcurrencyFpDag.test.ts` **(NEW)** and legacy binary regression suite.
    - `npm run build` (`BypassSandbox: false`): clean TypeScript & Vite production build.
    - `npm run test:e2e` / `npx playwright test` (`BypassSandbox: true`): complete E2E matrix across all 5 envs, Phases 1–5 mechanics, Side-Track DAG unlocks, and `< 200ms` solver assertions.

---

## 5. Binary Format & Compatibility Matrix

All wire allocations align verbatim with [`docs/binary_format.md`](../../docs/binary_format.md) and [`specs/v2/master_roadmap_and_shared_files.md` §5](./master_roadmap_and_shared_files.md#5-wire-protocol-quick-reference-format_version--1):

| Dimension | Legacy / Existing Baseline | Stage 2 Target Spec | Backward-Compatibility Guarantee |
|---|---|---|---|
| **`envVersion` Ceilings** | `grid v1..3`, `turtle v1`, `beat v1`, `switchyard v1`, `depot v1..3` | `grid v1..4`, `turtle v1..2`, `beat v1..2`, `switchyard v1..2`, `depot v1..4` | Readers branch on `envVersion` and decode all v1–v3 payloads losslessly; bumped headers emit only when extended features exist. |
| **`CompactLessonId` & `simCode`** | `0x80..0xFD` (`1.0..9C`), `0x01..0x7F` UTF-8 string; `simCode 0..4` (`4=depot`) | Same dual codec encodes all Slug IDs (`seq.0..rec.B`, `inter.*`, `conc.*`) cleanly | `encodeCompactLessonId` already handles UTF-8 slugs; canonical alias map resolves numeric saves (`"1.0"`→`"seq.0"`). |
| **Terminal `statusToCode`** | `0=IDLE, 1=SUCCESS, 2=COLLISION, 3=PAUSED` | Maps extended failure states (`TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, `DEADLOCK`) cleanly | Preserves `0..3` legacy manual-save code layout (all terminal failures map cleanly to failure code `2` on legacy boundaries). |
| **`ScopeId` Tags (`§5.1`)** | `0x00=MAIN`, `0x81..0x83=F1..F3` | Keep `0x00`, `0x81..0x83`; add **`0x01..0x03 = MAIN_2..MAIN_4` (`conc`)** & **`0x40..0x46 = ON_TAP, ON_KEY_*` (`inter`)** | Zero tag collision across core, event, and concurrent worker scopes. |
| **Color & Sensor Refs (`§6.2`)** | `SENSOR_REF_FLAG = 0x80`, `COLOR_LITERAL_FLAG = 0x40`; `PALETTE_COLOR_NAMES[4] = 'amber'` | `0x80..0x96` Shared/Live, `0xA0..0xA4` Depot, `0xA8..0xAB` Switchyard, `0xB0..0xB2` Beat, `0xC0..0xC2` Sockets (`●/▲/■`); alias **`'yellow'` ↔ `'amber'` @ `4`**; `0..9` extended palette (`TURTLE_COLOR_PALETTE` `0..7` untouched + `8=orange`, `9=white`; Beat `0=Cyan..9=White`) | Fixes previously broken `'yellow'` `tileColor` round-trips while keeping all `0..7` saved streams byte-identical. |
| **Tape & `OP_EXT` (`§7.1`)** | `0x01..0x0B` core ops; Beat `0x10..0x1F` full (`0x1E OP_BEAT_SET_DELAY`, `0x1F OP_BEAT_WAIT_DURATION` live) | **`0x0C..0x0E` Tape ops** (`OP_TAPE_SEEK`, `OP_TAPE_STEP`, `OP_TAPE_WRITE`), **`0x0F OP_EXT`** (`0x01..0x08` shared `conc`/`fp` + **`0x20 EXT_BEAT_STAMP_FROM_TAPE`**), `OP_CALL_FN` (`0x03` bit `0x20`) args | Avoids colliding with Beat's full `0x10..0x1F` range while giving platform + all envs an extensible opcode space. |
| **`ConditionExpr` (`§7.1.2`)** | Legacy unary tags, `0x1A` Depot `itemDamaged`, reserved `0x30` | Active **`0x30 CMP`**, **`0x28 insideCanvas`**, **`0x2A cursorAtEdge`**, **`0x2C cellEmpty`**, **`0x2E keyHeld`**, Switchyard `0x10..0x13` (`0x11 itemDamaged`), Depot `0x18..0x1C` (`+6=PHYSICAL_TAPE`, `0x1A` v1–v3 compat only) | Legacy condition streams decode identically via pre-`0x28` tag dispatch. |

---

## 6. Icon Rulings Register (User-Reviewed Across All 5 Environments)

Every environment's optional icon proposals were reviewed by the user during Stage 2 (`#295`, `#299`, `#300`, `#301`, `#302`, `#304`):

### 6.1 Approved / Rejected User Rulings (Locked Into Phases 1–4 Above)
- **Robot Grid (`#301` — ALL 3 APPROVED):**
  - `grid-readonly-badge` (`GridCanvas.tsx:615` — **Phase 1**): `🛡️`/`👁️` instead of `🔒`.
  - `ConditionBadge.tsx` `itemHere` (**Phase 2**): floor sparkle/box emblem away from `💎` (`Relic`).
  - `$tileDial` unification (**Phase 3**): single circular rotary gauge glyph across `BlockItem.tsx:761,786`, `BlockSubpalette.tsx:64,78,109`, `VariableAndDialSpotlight.tsx:167`, and `gridEnvironment.tsx:241`.
- **Turtle LOGO (`#295`, `#302` — 2 APPROVED, 2 REJECTED):**
  - *Approved:* `showEraserCue?: boolean` diagonal eraser-tip corner accent on `#ffffff` in Turtle `SET_PEN_COLOR` (**Phase 1**, `VisualParamBadges.tsx`/`BlockParamBadge.tsx`/`ParamSelectionPopover.tsx`, zero `data-shape-cue`, Beat `#ffffff` untouched); miniature turtle silhouette accent beside `Crosshair` on `TELEPORT` (**Phase 1**).
  - *Rejected (`no` — DO NOT implement):* Popover angle pie-wedge helper (`TURN_*`) and combined `Radius + Angle` live arc preview (`ARC_*`) — keep `RotationVisual`, `ArcAngleVisual`, and `RadiusVisual` unchanged.
- **Beat & Light Matrix (`#304` — 2 APPROVED, 1 REJECTED):**
  - *Approved:* `Black` (`8` / `#0f172a`) = LED Off / Erase everywhere in Beat (`beatEnvironment.tsx`, `presets.ts`, `pwaStateRestoreService.ts`, `BeatLedCell`, `VariationCardsPanel.tsx:597`, `mapThumbnailGenerator.ts:465`) + recessed off-pad & `⊘` overlay on Beat swatch pickers outside `ColorVisual` (**Phase 1**); `beat-step-counter` `🎵 #N` prefix (**Phase 1**).
  - *Rejected (`no too small` — DO NOT implement):* Miniature directional triangle inside `variation-beat-cursor` (`VariationCardsPanel.tsx:629–636`).
- **Switchyard (`#300` — ALL 4 APPROVED):**
  - Directional `↙`/`↘` `SWITCH_LEFT`/`SWITCH_RIGHT` SVGs & trapdoor+`♻️` `ScrapIcon` (replacing `CornerDownLeft` in `switchyardEnvironment.tsx` & `SolutionModal.tsx:413`, **Phase 2**); unified Switchyard condition/numeric glyphs (`ConditionBadge.tsx` + `switchyardEnvironment.tsx`, **Phases 2–3**); compact `[A]`/`[B]` junction & `[A]`/`[B]`/`[C]` dock chips in `VisualParamBadges.tsx` (**Phases 2–3**, non-Switchyard icons untouched).
- **Depot (`#299` — ALL 4 APPROVED):**
  - `ConditionBadge.tsx` `hasItem` claw-gripping-ring SVG & `heldColor`/`topColor` Claw-Ring/Stack-Top micro-SVGs (**Phase 2**); `DepotToolbarTools.tsx` stacked ring & preset glyphs (**Phase 2**); `VisualParamBadges.tsx` `DepotGateVisual` zero-reading `↪`/`✓`/`✗` SVG pills keeping `DepotStationVisual` `[1][2][3]`/`Q` geometry (**Phase 4**).

### 6.2 Remaining Optional Item (Ask User Before Changing Outside Phase 5)
1. **Shared `SolutionModal.tsx` (`lines 375–440`) Full Early Renderer Deduplication:** Switchyard's broken `CornerDownLeft` `SCRAP_ITEM` icon (`SolutionModal.tsx:413`) is fixed in **Phase 2** (`#300`), and full `SolutionModal` consolidation with `BlockItem.tsx` (`IF` color/badge, `WHILE` badge) is scheduled for **Phase 5 (`P5-C1`)** — ask the user only if pulling full deduplication earlier into Phase 1/2 is preferred.
