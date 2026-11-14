# Switchyard v2 Clean Replacement & Curriculum Alignment Plan

> **Owner:** `@env-switchyard`  
> **Scope:** Clean replacement of the legacy **🚂 Switchyard** simulation (`src/simulations/switchyard/*`, `src/engine/verification/switchyardConstraintSolver.ts`, `src/engine/serialization/env/switchyardSerializer.ts`, `renderSwitchyardMapSvg`) aligned with the Stage 1 visual/UX specification, unified `SimulationEnvironment` / `useAppStore` contracts, and `@platform` Round B schema & shared-file decisions.  
> **Paired Specifications:** [`docs/envs/switchyard.md`](../../docs/envs/switchyard.md) · [`docs/ui_guidelines.md`](../../docs/ui_guidelines.md) · [`docs/binary_format.md`](../../docs/binary_format.md) · [`docs/platform_requirements.md`](../../docs/platform_requirements.md)

---

## 1. Current `src/` Baseline & Audited Defects

### 1.1 Audited File Inventory
- **Switchyard Simulation Module (`src/simulations/switchyard/`):**
  - [`types.ts`](../../src/simulations/switchyard/types.ts) (104 lines): `ItemColor`, `ItemIcon`, `SwitchyardItem`, `DockId`, `DockSpec`, `DockState`, `SwitchState`, `SwitchyardFailureReason`, `SwitchyardState`, `ITEM_COLOR_INDEX`, `ITEM_ICON_INDEX`.
  - [`presets.ts`](../../src/simulations/switchyard/presets.ts) (32 lines): `DEFAULT_SWITCHYARD_STATE`, `HAZARD_PRESET`.
  - [`physics.ts`](../../src/simulations/switchyard/physics.ts) (232 lines): `createInitialSwitchyardState`, `resetSwitchyardState`, `evaluateSwitchyardSensor`, `routeCurrentItem`, `applySwitchyardAction`, `evaluateSwitchyardCompletion`.
  - [`switchyardEnvironment.tsx`](../../src/simulations/switchyard/switchyardEnvironment.tsx) (150 lines): `SwitchIcon`, `SendNextIcon`, `ScrapIcon`, `SWITCHYARD_PALETTE_ITEMS`, `SWITCHYARD_SENSORS`, `switchyardSimulationEnvironment`.
  - [`components/SwitchyardCanvas.tsx`](../../src/simulations/switchyard/components/SwitchyardCanvas.tsx) (479 lines): Dark `480×320` left-to-right SVG renderer (`SwitchArrow`, `DockBox`), preserving `data-testid="switchyard-sensor-beam"` and `data-testid="switchyard-branch-skip"`.
  - [`components/SwitchyardToolbarTools.tsx`](../../src/simulations/switchyard/components/SwitchyardToolbarTools.tsx) (20 lines): Placeholder `🚂 Switchyard Sandbox` banner.
- **Verification & Serialization:**
  - [`src/engine/verification/switchyardConstraintSolver.ts`](../../src/engine/verification/switchyardConstraintSolver.ts) (621 lines): `canonicalizeSwitchyardState`, `validateSwitchyardWorkspaceAgainstSlotCap`, `validateSwitchyardWorkspaceAgainstPalette`, `executeSwitchyardWorkspace`, `checkSwitchyardReferenceSolution`, `checkSwitchyardScaffoldWorkspace`, `verifySwitchyardActivityRule`, `verifySwitchyardActivityConstraints`.
  - [`src/engine/serialization/env/switchyardSerializer.ts`](../../src/engine/serialization/env/switchyardSerializer.ts) (227 lines): `writeSwitchyardState`, `readSwitchyardState`, `writeSwitchyardParams`, `readSwitchyardBlock` (`ENV_ID_SWITCHYARD = 0x05`, `ENV_VERSION_SWITCHYARD = 1`, opcodes `0x10..0x13`).
- **Shared Integration & Tests:**
  - [`src/engine/simulationRunner.ts`](../../src/engine/simulationRunner.ts), [`src/engine/interpreter.ts`](../../src/engine/interpreter.ts), [`src/engine/simulation/types.ts`](../../src/engine/simulation/types.ts), [`src/store/useAppStore.ts`](../../src/store/useAppStore.ts), [`src/App.tsx`](../../src/App.tsx), [`src/components/MultiRunPipsBar.tsx`](../../src/components/MultiRunPipsBar.tsx), [`src/components/BlockSubpalette.tsx`](../../src/components/BlockSubpalette.tsx), [`src/components/ConditionBadge.tsx`](../../src/components/ConditionBadge.tsx), [`src/components/params/VisualParamBadges.tsx`](../../src/components/params/VisualParamBadges.tsx), [`src/services/mapThumbnailGenerator.ts`](../../src/services/mapThumbnailGenerator.ts), [`src/services/pwaStateRestoreService.ts`](../../src/services/pwaStateRestoreService.ts), [`src/services/localSaveService.ts`](../../src/services/localSaveService.ts), [`src/data/curriculum/module5Demos.ts`](../../src/data/curriculum/module5Demos.ts).
  - Existing unit tests: [`tests/switchyardSimulation.test.ts`](../../tests/switchyardSimulation.test.ts), [`tests/module5Demos.test.ts`](../../tests/module5Demos.test.ts), [`tests/constraintSolverM4M6.test.ts`](../../tests/constraintSolverM4M6.test.ts), [`tests/multiVariantAndHudFoundation.test.ts`](../../tests/multiVariantAndHudFoundation.test.ts), [`tests/profileSerializer.test.ts`](../../tests/profileSerializer.test.ts).

### 1.2 Critical Live Bugs Identified in Code Audit
1. **Unregistered Headless Simulation (`simulationRunner.ts`):** `registerSimulation(switchyardSimulationEnvironment)` is completely missing from `simulationRunner.ts` (lines 14–23), breaking unified headless execution via the registry.
2. **Double `repeatCount` Execution (`physics.ts` L194–203 vs `interpreter.ts` L907–957):** `applySwitchyardAction('SEND_NEXT', ...)` loops `repeatCount` times inside a single call while `tickInterpreter` already executes `executeAction` once per repeat sub-tick (`N × N` dispatches!).
3. **Broken Curriculum Definition Ingestion (`physics.ts` L17–42):** `createInitialSwitchyardState` ignores `CurriculumSwitchyardDefinition` fields (`incomingStream`, `switches[].initialDirection`, `docks[].expectedColor/expectedIcon/acceptsDamaged`, `scrapChute`, lowercase colors `'red'|'blue'|'amber'|'emerald'`, icon `'gem'`) passed by `useAppStore.ts` (`as any`).
4. **Multi-Stream Pip Preview & Focus Gap (`useAppStore.ts` L2724–2735):** `setFocusedVariantIndex` updates `gridState`, `depotState`, and `runtime`, omitting `switchyardState`—preventing `[1 ✓][2 ✗][3 ·]` pip tapping and failure auto-focus from switching the Switchyard canvas.
5. **Mental-Rotation Legacy Geometry (`SwitchyardCanvas.tsx` L1–479):** Dark `#0f172a` `480×320` left-to-right layout sends `SWITCH_LEFT` **UP** (`-Y`) and `SWITCH_RIGHT` **DOWN** (`+Y`), displays raw emojis, omits `acceptIcon` / `weight` / `quota` / `balance beam` / `manifest` visuals, detaches `SCRAP` visually, lacks continuous glowing path + animated car rolling, and lacks the `48px` top HUD clearance band.
6. **Constraint Solver Blind Spots (`switchyardConstraintSolver.ts` L488–618):** `verifySwitchyardActivityRule` hardcodes `baseActions` without `junction: 'B'` switches (making 2-switch puzzles like `branch.8` / `branch.A` unsolvable) or numeric/comparison constructs (`cmp`, `args`, `fp`).
7. **Binary Schema V1 Gaps (`switchyardSerializer.ts` L1–227):** Note `writeSwitchyardParams` / `readSwitchyardBlock` already serialize 1-byte `junctionIdx` (`0='A'|1='B'`) on `0x10`/`0x11`, but `writeSwitchyardState` / `readSwitchyardState` lack `0`-switch topologies, `scrapRules`, `weight (1..99)`, `quota`, `maxWeight`/`minWeight`, `cmp.M2` balance mode, `args.M2` manifest headers & return bay, `#seq` sequence tags, and numeric sensors (`$itemWeight`, `$itemColor`, `$dockQuota`, `$dockCount`).
8. **Hardcoded Sensor Filter (`BlockSubpalette.tsx` L69–71):** `allKnown` is hardcoded to `['$tileDial', '$x', '$y', '$heading']`, hiding Switchyard numeric readouts until merged with `currentSimEnv.sensors`.
9. **Missing Rich Failure Diagnostics & Status Codes (`types.ts`, `physics.ts`, `interpreter.ts`, `MultiRunPipsBar.tsx`):** `physics.ts` collapses errors into coarse `SwitchyardFailureReason` strings without structured expected-vs-received payload for zero-reading canvas bubbles, while `STEP_LIMIT`, `STACK_OVERFLOW`, `MATH_ERROR`, `TYPE_ERROR`, and `DEADLOCK` collapse into `'COLLISION'` or `0` divide.
10. **Icon Duplication & Policy Violation (`switchyardEnvironment.tsx` L47–83, L108–113):** `SwitchIcon` renders the exact same fork SVG for both `SWITCH_LEFT` and `SWITCH_RIGHT`; `ScrapIcon` uses `CornerDownLeft` (violating [`ui_guidelines.md` §4](../../docs/ui_guidelines.md#4-strict-icon-disambiguation-one-icon--one-meaning)); `SWITCHYARD_SENSORS` emojis diverge from [`ConditionBadge.tsx`](../../src/components/ConditionBadge.tsx).

---

## 2. Keep vs. Replace Matrix

| File / Area | Disposition | Notes & Compatibility Guardrails |
| :--- | :---: | :--- |
| `src/simulations/switchyard/types.ts` | **Replace cleanly** | Upgrade to v2 types (`topology`, `scrapRules`, `weight`, `seqNum`, `orderManifest`, `quota`, `balanceMode`, `SwitchyardFailureDetail`, `SwitchyardAnimEvent`, `SwitchyardSensorSpotlight`) while keeping `ITEM_COLOR_INDEX`, `ITEM_ICON_INDEX`, `'RED'..'YELLOW'` + `'red'..'amber'` normalization helpers. |
| `src/simulations/switchyard/physics.ts` | **Replace cleanly** | Single-item-per-call `SEND_NEXT`, full `CurriculumSwitchyardDefinition` adapter, `0..3` switch tree routing, `scrapRules` check, quota/weight/balance/stranded-car evaluation, structured diagnostic bubbles. |
| `src/simulations/switchyard/presets.ts` | **Replace cleanly** | Daylight 1-switch & 2-switch Sandbox presets (`DEFAULT_SWITCHYARD_STATE`, `HAZARD_PRESET`, `TWO_SWITCH_PRESET`). |
| `src/simulations/switchyard/switchyardEnvironment.tsx` | **Replace cleanly (apply user-approved §3 Switchyard icons)** | Add optional `junction: 'A' | 'B'` action parameter, register numeric sensors (`$itemWeight`, `$dockQuota`, `$dockCount`, gated `$itemColor`), expose v2 palette & evaluator, and apply approved directional `SWITCH_LEFT`/`SWITCH_RIGHT` & trapdoor `ScrapIcon` SVGs (§3). |
| `src/simulations/switchyard/components/SwitchyardCanvas.tsx` | **Replace cleanly** | Daylight `viewBox="0 0 640 540"` Top-to-Bottom track tree, `48px` sky clearance, tunnel `+N`, scanner laser sweep + hood lights + step spotlight, attached scrap chute, continuous glowing active rail path + marching chevrons, cubic-bezier car chug, floor stencils, Quota Gauges, Twin Balance Beam, Manifest Orders, zero-reading failure bubbles. Keep `data-testid="switchyard-sensor-beam"` & `"switchyard-branch-skip"` for spotlight compatibility. |
| `src/simulations/switchyard/components/SwitchyardToolbarTools.tsx` | **Replace cleanly** | Compact Sandbox topology selector (`1-Switch`, `2-Switch`, `3-Switch` in Sandbox; clean badge in lessons). |
| `src/engine/verification/switchyardConstraintSolver.ts` | **Replace cleanly** | Uses v2 physics, handles `0..2` switches (`junction: 'A'|'B'`), variable-length multi-stream runs, `0x30 CMP`, variables, sockets (`●`), `[Fn]` callbacks, closer-inclusive flat block counting. |
| `src/engine/serialization/env/switchyardSerializer.ts` | **Extend cleanly (v1 read-compat + `ENV_VERSION_SWITCHYARD_V2 = 2`)** | Losslessly reads existing `ENV_VERSION_SWITCHYARD = 1` payloads AND writes `ENV_VERSION_SWITCHYARD = 1` when unused; emits `ENV_VERSION_SWITCHYARD_V2 = 2` whenever weights, quotas, scrap rules, manifests, sequences, balance beam, or sandbox sparse tape are active. |
| `src/services/mapThumbnailGenerator.ts` (`renderSwitchyardMapSvg`) | **Replace helper** | Render miniature Top-to-Bottom daylight track tree + scanner + docks matching `SwitchyardCanvas.tsx`. |
| `src/components/params/VisualParamBadges.tsx`, `BlockItem.tsx`, `ConditionBadge.tsx` | **Preserve all existing non-Switchyard icons; apply user-approved §3 Switchyard badges** | Do **not** alter existing non-Switchyard icons (`RepeatVisual`, `PaletteColorVisual`, arrow/arc trajectory badges, etc.); apply only the user-approved Switchyard condition glyphs & `[A]`/`[B]`/`[C]` chips from §3 in Phases 2–3 (coordinated with `@platform`). |

---

## 3. Switchyard Icon Improvements *(Approved by User)*

Per project icon-preservation policy, all existing refined non-Switchyard icons in [`VisualParamBadges.tsx`](../../src/components/params/VisualParamBadges.tsx), [`BlockItem.tsx`](../../src/components/BlockItem.tsx), and [`ConditionBadge.tsx`](../../src/components/ConditionBadge.tsx) remain unchanged. The user approved (`ok`) all four Switchyard-specific icon updates below for implementation in Phases 2–3:

1. **Disambiguate `SWITCH_LEFT` vs. `SWITCH_RIGHT` SVG (`switchyardEnvironment.tsx` L63–83 — Phase 2):**
   - *Current:* Both actions render the exact same `SwitchIcon` fork graphic, distinguishable only by background color/text.
   - *Approved Change:* Replace with directional Top-to-Bottom fork SVGs highlighting the active left branch (`↙`) vs. right branch (`↘`) so 5–7 year-old non-readers distinguish them purely by silhouette.
2. **Replace `ScrapIcon` `CornerDownLeft` Arrow (`switchyardEnvironment.tsx` L47–59 — Phase 2):**
   - *Current:* Uses `CornerDownLeft`, colliding visually with loop/return iconography (`ui_guidelines.md §4`).
   - *Approved Change:* Replace with a yellow/black Scanner trapdoor chute + `♻️` bin silhouette matching the on-canvas side chute.
3. **Unify Switchyard Condition Icons (`switchyardEnvironment.tsx` L108–113 vs. `ConditionBadge.tsx` L90–103 — Phase 2 boolean / Phase 3 numeric):**
   - *Current:* `SWITCHYARD_SENSORS` uses `🚂`/`⚡`/`🎨`/`📦`, whereas `ConditionBadge.tsx` renders `📦`/`💥`/`🏷️`.
   - *Approved Change:* Align on unified zero-reading glyphs: `hasNextItem` (mini train car + `?`), `itemDamaged` (cracked car + `⚡`), `itemColor` (colored train chassis badge), `itemIcon` (cargo emblem badge), plus numeric badges `⚖️` (`$itemWeight`), `[A]` target gauge (`$dockQuota`), `[A]` filled bars (`$dockCount`), and `🎨` (`$itemColor`).
4. **Compact Junction `[A]` / `[B]` & Dock `[A]` / `[B]` / `[C]` Parameter Chips (`VisualParamBadges.tsx` — Phase 2 junction / Phase 3 dock):**
   - *Approved Change:* Add a Top-to-Bottom junction mini-chip `[A]`/`[B]` for 2-switch `SWITCH_LEFT`/`SWITCH_RIGHT` blocks (hidden on 1-switch maps) and matching bay badge `[A]`/`[B]`/`[C]` on `dockQuota`/`dockCount`, without modifying any existing non-Switchyard `VisualParamBadges.tsx` icons.

---

## 4. Synchronized 5-Phase Implementation Plan (Phases 1–5)

### Phase 1 (`seq` → `param` → `loop` → `func`): Registry, HUD Shell & Multi-Stream Store Hook
*(Curriculum Switchyard lessons start in Module `branch` / Phase 2; Phase 1 prepares platform integration cleanly with zero Switchyard breakage.)*
- **Files Touched (Coordinated):**
  - `src/engine/simulationRunner.ts` (shared, `@platform`): Register `switchyardSimulationEnvironment` via `registerSimulation(switchyardSimulationEnvironment)`.
  - `src/store/useAppStore.ts` (`setFocusedVariantIndex`, L2724–2735, shared): Restore `target.switchyardState` alongside `gridState` / `depotState` / `runtime` when switching variant pips.
  - `src/App.tsx` (shared layout): Unify `[Top Dock shrink-0] -> [Viewport relative flex-1 min-h-0] -> [Bottom Dock shrink-0]` with `>= 48px` HUD top clearance across environments.
  - `tests/switchyardSimulation.test.ts` & `tests/multiVariantAndHudFoundation.test.ts`: Verify headless `switchyard` execution via `simulationRunner.ts` works through registry and `setFocusedVariantIndex` swaps `switchyardState`.
- **Verification:**
  - **Unit (`npm run test:unit` inside sandbox):** Existing `tests/switchyardSimulation.test.ts`, `tests/module5Demos.test.ts`, `tests/multiVariantAndHudFoundation.test.ts`, `tests/constraintSolverM4M6.test.ts` remain green.

### Phase 2 (`branch` → `while`): Switchyard v2 Clean Replacement MVP
*(Delivers complete Toy-Workshop visual/animation overhaul + `0..2` switches + `ConditionSubpalette` + `branch.2, branch.3, branch.4, branch.5, branch.8, branch.A, while.5, while.8`.)*
- **Files Replaced / Added (`src/simulations/switchyard/` + Solver/Thumbnail):**
  - `src/simulations/switchyard/types.ts`: Define `SwitchyardTopology`, `SwitchyardItem` (`color`, `icon`, `damaged`, optional Phase 3/5 fields), `SwitchyardDockSpec`, `SwitchyardScrapRule` (`'damaged_only' | ...`), `SwitchyardFailureDetail`, `SwitchyardAnimEvent`, `SwitchyardSensorSpotlight`, `SwitchyardState`.
  - `src/simulations/switchyard/physics.ts`: Implement `normalizeSwitchyardDefinition`, `createInitialSwitchyardState`, `resetSwitchyardState`, `evaluateSwitchyardSensor`, `routeCurrentItem` (`0..3` switch topologies), `applySwitchyardAction` (**strictly 1 item per `SEND_NEXT` call**), `evaluateSwitchyardCompletion` (`STRANDED_CARS` `🚂 ×N left!` when queue non-empty at program end).
  - `src/simulations/switchyard/presets.ts`: Replace presets with daylight 1-switch & 2-switch starter streams.
  - `src/simulations/switchyard/switchyardEnvironment.tsx`: Wire v2 `SWITCHYARD_PALETTE_ITEMS`, `SWITCHYARD_SENSORS`, `junction` (`'A' | 'B'`) action parameter definition, directional `SWITCH_LEFT`/`SWITCH_RIGHT` (`↙`/`↘`) & trapdoor chute `ScrapIcon` SVGs + unified Switchyard sensor glyphs (§3, user-approved), `executeAction`, `evaluateSensor`, `evaluateCompletion`, `Renderer: SwitchyardCanvas`.
  - `src/simulations/switchyard/components/SwitchyardCanvas.tsx`: Full `viewBox="0 0 640 540"` Top-to-Bottom SVG stage (`y=0..48` sky band, upper-left Brick Tunnel + lantern + `+N` convoy, curved feeder tracks with wooden ties, upright Inspection Scanner Gate `(320, 150..220)` with `160ms` laser sweep + hood sensor slots + 4-cue `itemDamaged` sparks/tilt/smoke/`⚠️`, right-wall yellow/black Hazard Trapdoor Chute + `♻️` bin, `Switch A` / `Switch B` turntables + `150ms` blade/lever swing + **continuous glowing cyan/emerald active rail path + marching chevrons `⌄ ⌄ ⌄`** dimming unreachable legs, `320ms` cubic-bezier car chug scaled by `speedMultiplier` + `prefers-reduced-motion`, bottom Receiving Docks `y=415..520` with `≥44px` floor stencils, parked mini-cars, match shockwave, and icon failure diagnostic bubbles). Preserve `data-testid="switchyard-sensor-beam"` and `"switchyard-branch-skip"`.
  - `src/simulations/switchyard/components/SwitchyardToolbarTools.tsx`: Sandbox topology toggle (`1-Switch`, `2-Switch`, `3-Switch`), hidden/read-only in validated lessons.
  - `src/engine/verification/switchyardConstraintSolver.ts`: Rewrite solver using v2 `physics.ts`, supporting `junction: 'A'|'B'` actions, equal-length streams (`branch.*`) vs variable-length streams (`while.5`, `2..6` cars), `0` / `1` / `2` switches, and closer-inclusive block counting.
  - `src/services/mapThumbnailGenerator.ts` (`renderSwitchyardMapSvg`): Render daylight Top-to-Bottom mini-map matching v2 canvas.
- **Shared Integration Touchpoints (with `@platform`):**
  - `src/components/BlockSubpalette.tsx`, `src/components/ConditionBadge.tsx`, `src/components/params/VisualParamBadges.tsx`, `src/engine/interpreter.ts`, `src/store/useAppStore.ts`, `src/components/MultiRunPipsBar.tsx`: Wire `<ConditionSubpalette>`, atomic pair insertion, unified Switchyard boolean condition glyphs (`hasNextItem`, `itemDamaged`, `itemColor`, `itemIcon`) & `[A]`/`[B]` junction mini-chip (§3, non-Switchyard icons untouched), condition-header step spotlight sync (`~220ms` at `1×`, held on `If`/`While` in `⏭ Step`), pip click preview (`IDLE`), and auto-focus onto first `[k ✗]` pip on multi-stream failure (retaining stream focus on `⏮ Rewind -> ⏭ Step`).
  - `src/services/pwaStateRestoreService.ts` (`sanitizeSwitchyardState`) & `src/data/curriculum/module5Demos.ts`: Migrate demo streams `5.2`/`5.4` to match `branch.2`/`branch.3`/`branch.4` refactored pedagogy and sanitize v2 fields cleanly.
- **Phase 2 Verification:**
  - **Unit (`npm run test:unit`):** Update/expand [`tests/switchyardSimulation.test.ts`](../../tests/switchyardSimulation.test.ts), [`tests/module5Demos.test.ts`](../../tests/module5Demos.test.ts), and [`tests/constraintSolverM4M6.test.ts`](../../tests/constraintSolverM4M6.test.ts) covering `0..2` switch routing, single-item `SEND_NEXT ×3` sub-tick semantics, `CurriculumSwitchyardDefinition` ingestion, `SCRAP_ITEM` valid vs intact error (`scrapRules`), stranded-car exit detection, structured failure diagnostics, spotlight `switchyard-sensor-beam`/`branch-skip` data-testids, and `branch.2..branch.A` + `while.5` constraint verification.
  - **Playwright E2E (`BypassSandbox: true`, `e2e/curriculumWave2.spec.ts` / `e2e/mobileLayout.spec.ts`):** Verify `48px` HUD sky non-overlap on desktop (`1280×720`) and mobile (`375×667`), `IDLE` `[2 ·]` pip click updates previewed feeder cars, `While (hasNextItem)` solves multi-stream `while.5`, and mismatched dock / premature exit auto-focuses `[2 ✗]` displaying zero-reading diagnostic bubbles.

### Phase 3 (`var` → `cmp` → `inter`): Car Weights, Dock Quotas, Modulo Tags & Twin Balance Beam
*(Supports `cmp.0, cmp.1, cmp.1a, cmp.3, cmp.4, cmp.9, cmp.A, cmp.M2`.)*
- **Switchyard Simulation & Solver Changes:**
  - `src/simulations/switchyard/types.ts` & `physics.ts`: Add `weight (1..99)`, `seqNum (#1, #2...)`, dock constraints (`quota`, `maxWeight`, `minWeight`, `paritySlot`), `scrapRules: { kind: 'damaged_or_overweight'; maxWeight }` (for `cmp.A` `♻️ ⚠️ | ⚖️ > 10`), and `mode: 'balance_scale'` (`leftWeightSum`, `rightWeightSum`, `balanceTolerance`, `beamTiltDeg`, `cmp.M2`). Evaluate `$itemWeight` (`0xA8`), `$dockQuota` (`0xAA + dockIdx`, default `A`), and `$dockCount` (`0xAB + dockIdx`, strictly delivered **car count**, never overloaded as weight).
  - `src/simulations/switchyard/switchyardEnvironment.tsx` & `SwitchyardCanvas.tsx`: Enable weight plates (`1..99`) & heavy rivets (`>10`) strictly when lesson stage >= `cmp` (hidden in `branch`/`while`!), Scanner weight slot + `[⚖️ 14] > [⚖️ 10] ✓` spotlights, dock scale plates (`⚖️ ≤ 10`), Segmented Quota Gauges (`[■■□□]`) + lowered `✓ FULL` gate bar, `cmp.4` `#1, #2` sequence tags + round-robin dock ticket slots (`[1][3][5]` / `[2][4][6]`), and `cmp.M2` Twin-Scale Fulcrum Balance Beam (`±15°` tilt, live `⚖️` pan sums, emerald/amber tolerance dial).
  - `src/engine/verification/switchyardConstraintSolver.ts`: Verify variable counters (`c = c + 1`, `l = l + itemWeight`), modulo parity (`c % 2 == 0`), `0x30 CMP` comparisons (`<, <=, >, >=, ==, !=`), `cmp.A` (`12` flat blocks on 1-switch + overweight Scrap Chute), and `cmp.M2` (`14` blocks across 4 streams defeating `c % 2`).
- **Serialization & Shared Touchpoints:**
  - `src/engine/serialization/env/switchyardSerializer.ts`: Implement `ENV_VERSION_SWITCHYARD_V2 = 2` state writer/reader for weights, quotas, weight rules, parity slots, custom scrap max-weight, sequence numbers, and `balance_scale` mode (preserving `envVersion = 1` when absent).
  - `src/components/BlockSubpalette.tsx`, `src/components/params/VisualParamBadges.tsx`, `src/engine/serialization/{types,conditionSerializer}.ts`, `src/engine/interpreter.ts`, `src/components/MultiRunPipsBar.tsx`: `@platform` merges `currentSimEnv.sensors` into `BlockSubpalette`, renders `[A]`/`[B]`/`[C]` dock chips & numeric sensor badges (`⚖️` `$itemWeight`, `$dockQuota`, `$dockCount` per §3), activates `0x30 CMP`, wires `0xA8`/`0xAA`/`0xAB`, unifies `PALETTE_COLORS` (`'yellow'`/`'amber'`@4), and emits distinct `MATH_ERROR` (`🧮÷0`), `TYPE_ERROR`, and `STEP_LIMIT` (`⏳🔁`) statuses.
- **Phase 3 Verification:**
  - **Unit (`npm run test:unit`):** Add `tests/switchyardPhase3Cmp.test.ts` testing `ENV_VERSION_SWITCHYARD_V2 = 2` binary roundtrip, overweight `SCRAP_ITEM` rules (`cmp.A`), `✓ FULL` over-quota collision, `$dockCount` car-count purity, `cmp.M2` Twin Balance evaluation across 4 adversarial streams, and `0x30 CMP` (`0xA8..0xAB`) sensor evaluation.
  - **Playwright E2E (`BypassSandbox: true`, `e2e/curriculumWave3.spec.ts`):** Verify `cmp.A` `✓ FULL` gate barrier + overweight chute visual and `cmp.M2` Balance Beam tilt & 4-stream multi-run pass/fail.

### Phase 4 (`tape` → `anim` → `sort`): Shared Sparse Tape Host Compatibility
*(Switchyard has 0 curriculum lessons in `tape`/`anim`/`sort`; Phase 4 ensures clean Sandbox hosting alongside `TapeDock`.)*
- **Changes:**
  - `src/App.tsx`, `src/store/useAppStore.ts`, `src/simulations/switchyard/components/SwitchyardCanvas.tsx`: Ensure collapsible Top-Dock `TapeDock` stacks cleanly above Switchyard's `viewBox="0 0 640 540"` viewport in `flex-1 min-h-0` without squeezing receiving docks or overlapping the `48px` HUD sky band.
  - `src/engine/serialization/env/switchyardSerializer.ts`: Support `hasSparseTape` flag (`0x20`) in `ENV_VERSION_SWITCHYARD_V2 = 2` appending shared `§9` Sparse Tape cells for Switchyard Sandbox saves.
- **Verification:**
  - **Unit (`npm run test:unit`):** Switchyard `v2` + Sparse Tape serialization roundtrip & Sandbox `TAPE_WRITE`/`$itemWeight` execution test.
  - **Playwright E2E (`BypassSandbox: true`):** Verify Sandbox `TapeDock` collapse/expand leaves Switchyard `48px` HUD sky and docks unclipped on desktop + mobile.

### Phase 5 (`args` → `rec` → `conc` / `fp`): Parameterized Batching, Manifest Orders & Functional Filters
*(Supports `args.3`, `args.M2`, and Planned Side Module `fp.6` `RouteByRule([F?])`.)*
- **Switchyard Simulation, UI & Solver Changes:**
  - **`args.3` (`FillBatch(●)`):** Wire socket repeat parameter (`● = 0xC0`) into `SEND_NEXT` sub-ticks (`×3 → ×2 → ×1` countdown badge above Scanner Gate); ensure Dock rules handle fixed hazard counts or per-car validation cleanly (`Main 6 + F1 7`).
  - **`args.M2` (`Run-Length Order Dispatcher`):**
    - Add `kind: 'order_manifest'` car variant (`manifestColor`, `manifestCount`) in `types.ts`/`physics.ts`/`SwitchyardCanvas.tsx` rendering the miniature locomotive cab + `[Color × Count]` clipboard plate + Scanner corner Active Order Banner.
    - Add `returnBay: true` on `Dock B` for non-matching intact cars and processed manifest headers (keeping `SCRAP_ITEM` strictly hazard-only!).
    - Expose gated typed **`$itemColor`** (`0xA9`, returning canonical `TypedValue` `color` `0..9`), strictly enabled via `curriculumStagePolicy` for `args`+ / Sandbox and hidden in `branch`/`while`.
  - **`fp.6` (`RouteByRule([F?])`):**
    - Support Switchyard strategy predicate calls via `[F?]` function sockets (`OP_EXT = 0x0F`: `0x08 CALL_PARAM_FN`, `0x07 RETURN`) returning boolean / parity flags against Dock A floor stencils (`⚖️ > 10` vs even-parity pairs), with **0 new Switchyard blocks/sensors** and **no `TapeDock` or `🛡️` shield**.
  - **Telemetry & Solver:** Support Top-Right `⏱️` Wall-Clock Tick badge integration (`args`/`fp`) and update `switchyardConstraintSolver.ts` for `args.3`, `args.M2`, and `fp.6`.
- **Phase 5 Verification:**
  - **Unit (`npm run test:unit`):** Add `tests/switchyardPhase5ArgsFp.test.ts` testing `args.3` socket `SEND_NEXT` sub-ticking, `args.M2` manifest cars + Return Dock `B` + `$itemColor (0xA9)` binary & runtime roundtrip, `fp.6` `RouteByRule([F2])`/`RouteByRule([F3])` returning via `OP_EXT = 0x0F`, and `STACK_OVERFLOW` / `TYPE_ERROR` guards.
  - **Playwright E2E (`BypassSandbox: true`, `e2e/curriculumWave4.spec.ts`):** Verify `args.3`, `args.M2` manifest + return bay visuals, and `fp.6` `[F?]` callback switching across streams.

---

## 5. Binary Schema (`ENV_ID_SWITCHYARD = 0x05`) & Shared-File Coordination

### 5.1 Locked Schema Allocations (Aligned with `@platform` Round B)
- **Universal Zero-Regression Rule:** Emit byte-identical `ENV_VERSION_SWITCHYARD = 1` whenever a workspace/sandbox uses standard `1..2` switches, standard `damaged_only` scrap, no car weights/sequences/manifests, no dock weight/quota/parity/return rules, no balance scale mode, and no sandbox sparse tape. Emit **`ENV_VERSION_SWITCHYARD_V2 = 2`** only when any v2 feature is present; `readSwitchyardState` reads both `1` and `2`.
- **`ENV_VERSION_SWITCHYARD_V2 = 2` Payload Layout (immediately following 3-byte `[0x01, 0x05, 0x02]` header):**
  1. `v2Flags (uint8)`:
     - `bits 1..0`: `mode` (`0 = standard`, `1 = balance_scale`, `2 = order_manifest`, `3 = strategy_filter`).
     - `bits 3..2`: `scrapRuleMode` (`0 = damaged_only`, `1 = damaged_or_overweight`, `2 = never`, `3 = reserved`).
     - `bit 4 (0x10)`: `hasLayout` (`1 = custom layout & queue follow`).
     - `bit 5 (0x20)`: `hasSparseTape` (`1 = §9 Sparse Tape payload appended after layout`).
     - `bit 6 (0x40)`: `hasExtendedItems` (`1 = items carry weights / sequence tags / manifest headers`).
     - `bit 7 (0x80)`: `hasBalanceTolerance` (`1 = balanceTolerance: VLE follows`).
  2. If `scrapRuleMode === 1`: `scrapMaxWeight: VLE`.
  3. If `hasBalanceTolerance`: `balanceTolerance: VLE`.
  4. If `hasLayout`:
     - `switchCount (uint8: 0..3)` + `switchDirections` (`uint8` each: `0 = LEFT`, `1 = RIGHT`).
     - `dockCount (uint8: 1..4)` + per dock: `dockFlags (uint8)` (`b0 = hasAcceptColor`, `b1 = hasAcceptIcon`, `b2 = rejectDamaged`, `b3 = hasMaxWeight`, `b4 = hasMinWeight`, `b5 = hasQuota`, `b6 = isReturnBay`, `b7 = hasParitySlot`) followed by present fields (`acceptColorIdx: uint8 (0..9)`, `acceptIconIdx: uint8 (0..3)`, `maxWeight: VLE`, `minWeight: VLE`, `quota: VLE`, `parityByte: uint8`).
     - `queueLength: VLE` + per item:
       - If `!hasExtendedItems`: legacy 1-byte `[damaged:1b | icon:2b | color:2b]`.
       - If `hasExtendedItems`: `itemFlags (uint8)` (`b7 = isManifest`, `b6 = damaged`, `b5..b4 = iconIdx (0..3)`, `b3 = hasSeqNum`, `b2 = hasWeight`), `colorIdx: uint8 (0..9)`, `[manifestCount or weight: VLE]`, `[seqNum: VLE]`.
  5. If `hasSparseTape`: shared `§9` Sparse Tape payload.
- **Opcodes, Conditions & Sensor Reference IDs (`FORMAT_VERSION = 1`):**
  - **Switchyard Action Opcodes (`0x10..0x13`):** Existing `0x10 SWITCH_LEFT` and `0x11 SWITCH_RIGHT` keep 1-byte `junctionIdx` (`0='A'`, `1='B'`, optional `2='C'`), `0x12 SEND_NEXT`, `0x13 SCRAP_ITEM`; `fp.6` uses shared `OP_EXT = 0x0F` (`0x07 RETURN`, `0x08 CALL_PARAM_FN`).
  - **`ConditionExpr` Tags (`§7.1.2`):** Keep `0x10 hasNextItem`, `0x11 itemDamaged`, `0x12 itemColor (0..9)`, `0x13 itemIcon (0..3)`, `0x20..0x22 NOT/AND/OR`, `0x30 CMP`.
  - **`SENSOR_REF_FLAG = 0x80` (`§6.2`):** **`0xA8` `$itemWeight`**, **`0xA9` `$itemColor`** (gated), **`0xAA` `$dockQuota` + `dockIdx: uint8` (`0=A, 1=B, 2=C`)**, **`0xAB` `$dockCount` + `dockIdx: uint8` (`0=A, 1=B, 2=C`)**, plus **`0xC0..0xC2` Shape Sockets (`●/▲/■`)**.

### 5.2 Shared-File Ownership & Merge-Safety Matrix

| Shared File | Owning Lead | Switchyard Coordination | Target Phase |
| :--- | :--- | :--- | :---: |
| `src/engine/simulationRunner.ts` | `@platform` | Register `switchyardSimulationEnvironment` | Ph 1 |
| `src/store/useAppStore.ts` | `@platform` | Add `switchyardState` to `setFocusedVariantIndex`; auto-focus `[k ✗]` & spotlight sync | Ph 1–2 |
| `src/App.tsx` | `@platform` | Unified `[Top Dock] -> [Viewport >=48px sky] -> [Bottom Dock]` | Ph 1 |
| `src/components/BlockSubpalette.tsx` | `@platform` | `<ConditionSubpalette>`; merge `currentSimEnv.sensors` into sensor dropdown | Ph 2–3 |
| `src/components/ConditionBadge.tsx`, `src/components/params/VisualParamBadges.tsx` | `@platform` | User-approved Switchyard glyphs & `[A]`/`[B]`/`[C]` chips only (§3; preserve all non-Switchyard icons) | Ph 2–3 |
| `src/components/MultiRunPipsBar.tsx` | `@platform` | Permanent `[1 ✓][2 ✗][3 ·]` pip switching + extended failure statuses | Ph 2–3 |
| `src/engine/interpreter.ts` | `@platform` | Condition-header spotlight hook, `0x30 CMP`, `0xA8..0xAB`, `0x0F OP_EXT` | Ph 2–5 |
| `src/engine/serialization/{types,conditionSerializer,codeScopes,codeSerializer,profileSerializer}.ts` | `@platform` | `ENV_VERSION_SWITCHYARD_V2 = 2`, `0xA8..0xAB`, `0x30 CMP`, `0x0F OP_EXT`, `PALETTE_COLORS` `0..9` | Ph 2–5 |
| `src/services/pwaStateRestoreService.ts` | `@platform` / `@env-switchyard` | Update `sanitizeSwitchyardState` for v2 fields | Ph 2–3 |
| `src/services/mapThumbnailGenerator.ts` (`renderSwitchyardMapSvg`) | `@env-switchyard` | Rewrite isolated helper function cleanly | Ph 2 |
| `src/simulations/switchyard/*`, `switchyardConstraintSolver.ts`, `switchyardSerializer.ts` | `@env-switchyard` | Complete v2 ownership | Ph 2–5 |
