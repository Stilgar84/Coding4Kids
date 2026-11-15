# 🐢 Turtle LOGO v2 — Architecture & Implementation Plan

> **Scope & Ownership:** Covers `src/simulations/turtle/**`, `src/engine/serialization/env/turtleSerializer.ts`, Turtle SVG rendering in `src/services/mapThumbnailGenerator.ts` and `src/components/VariationCardsPanel.tsx`, and Turtle-specific extensions coordinated with `@platform` across Phases 1–5 (`docs/envs/turtle_logo.md` and `#287`).
> **Constraint:** Preserves all existing refined trajectory/curvature/width/length/core-swatch icons (`RotationVisual`, `ArcAngleVisual`, `RadiusVisual`, `PenWidthVisual`, `LengthVisual`, Beat `ColorVisual`, `BlockItem.tsx` motion/pen icons) verbatim; user review (`no` / `yes`) resolved Section 3 by rejecting popover pie-wedges/combined arc previews and approving the Turtle `White (9)` eraser swatch corner micro-cue and `TELEPORT` mini-turtle accent.

---

## 1. Current `src/` Baseline (Observed Code Audit)

### 1.1 Existing Turtle-Owned Modules
- **`src/simulations/turtle/types.ts`:** Defines `TurtlePose`, `TurtleLine`, `TurtleArc`, `TurtlePathItem`, `TurtleActiveAnimation`, `TurtleBounds`, and `TurtleState` (`robot`, `penDown`, `penColor`, `penWidth`, `paths`, `status`, `pan`, `zoom`, `fitToView`, `computedBounds`, `activeAnimation`, `instantMode`, `showTurtle`).
- **`src/simulations/turtle/physics.ts`:**
  - Pure math & RAF interpolation helpers: `normalizeHeading`, `getArcCenter`, `getSpeedMultiplier`, `calculateLinearDuration`, `calculateArcDuration`, `calculateAngularDuration`, `calculateTeleportDuration`, `calculateWaitDuration`, `createTurtleAnimation`, `interpolateAnimationPose`, `updateBoundingBox`, `moveTurtleForward`, `moveTurtleBackward`, `turnTurtle`, `arcTurtle`, `teleportTurtle`, `getArcSvgPath`, `getArcProgressPose`, `getLineProgressPose`, `getTurnProgressPose`, `isTurtleMotionAction`, `isTurtleAnimatedAction`.
  - **Coordinate Convention (`physics.ts` & `tests/turtlePhysics.test.ts`):** `dx = distance * Math.sin(rad)` and `dy = -distance * Math.cos(rad)`. Heading `0°` moves visually Up (`-Y` in SVG, so `(0,0,0°)` forward `50px` yields `(0, -50)`).
- **`src/simulations/turtle/turtleEnvironment.tsx`:**
  - Registers 14 `TURTLE_PALETTE_ITEMS` and parameter defs including `TURTLE_COLOR_PARAM_DEF` (already contains `0..9`, including `8: #f97316` Orange and `9: #ffffff` White), `TURTLE_ANGLE_PARAM_DEF`, `sensors` (`$x`, `$y`, `$heading`), `readSensor` (`Math.round`), `resetState`, `executeAction`, and `evaluateCompletion: () => 'IDLE'`.
- **`src/simulations/turtle/components/TurtleCanvas.tsx` & `TurtleToolbarTools.tsx`:**
  - Pan/zoom/pinch SVG viewport (`TurtleCommittedPaths`, `turtle-robot` SVG avatar), Top-Right pill (`tool-toggle-turtle` `<Eye>`/`<EyeOff>`, `tool-loop-playback` `<InfinityIcon>`), Bottom-Left `turtle-info-pill` (`X:`, `Y:`, `∠ °`, color circle), Bottom-Right `TurtleToolbarTools` (`ZoomIn`/`ZoomOut`/`Maximize`/`Compass`, `w-8 h-8 sm:w-9 sm:h-9`).
- **`src/engine/serialization/env/turtleSerializer.ts`:**
  - `writeTurtleParams` / `readTurtleParams`, `TURTLE_COLOR_PALETTE`, `OP_TURTLE_TELEPORT` `refMask`.

### 1.2 Gaps & Bugs Found in Existing `src/`
1. **`OP_TURTLE_SET_PEN_COLOR (0x18)` lacks variable/sensor encoding (`turtleSerializer.ts` & `codeScopes.ts` L419):** `writeTurtleParams` always calls `colorToByte` and ignores `paramVarMask`, blocking color variables (`a`–`z`), `$randomColor`, and function color sockets (`TypedValue`). `docs/binary_format.md` §7.3 also still lists `0..7` instead of `0..9`.
2. **`interpreter.ts` L915–924 only resolves numeric variable/sensor references via `evaluateValue`:** Needs `TypedValue` (`color` + `number`) support for `SET_PEN_COLOR`, plus shared `$input`, `🎲` rolls, `$frame`, `$time`, `$pointerX`/`$pointerY`/`$pointerDown`, `keyHeld`, `Main 1..4`, `Fork`/`Join`/`Sync`/`Send`/`$recv`/`Lock`, and `[Fn]` sockets.
3. **`TURTLE_ANGLE_PARAM_DEF` missing geometry presets:** Lacks `72` (pentagon) and `144` (5-point star) quick-tap presets; `ParamSelectionPopover` (`coord`) lacks a `🏠 (0,0,0°)` quick-preset for `TELEPORT`.
4. **Canvas UX gaps:** No `PEN_UP` visual lift/air-trail cues; no crisp White ink-layer compositing or `#e2e8f0` Variation/thumbnail framing; `tool-toggle-turtle` uses bare `<Eye>` instead of `🐢👁️` and toolbar tap targets are `32–36px`; no dashed `insideCanvas` nominal frame; no Flipbook frame cache/Bottom-Dock scrubber/`🕒 Xs`; no Live `♾️` pointer-vs-pan arbitration; no `TurtleWorkerState[]` multi-turtle rendering or wait cues.
5. **Thumbnail/Preview & Store gaps (`useAppStore.ts` L503–965, `mapThumbnailGenerator.ts`, `VariationCardsPanel.tsx`):** `BlockSubpalette.tsx` (L63–95) filters out non-Grid/Turtle sensors via a hardcoded `allKnown` array; `mapThumbnailGenerator` & `VariationCardsPanel` have static-only rendering without `previewFrame`, `previewInput`, seeded `🎲`, or animated SVG flipbook loop previews.

---

## 2. Keep-vs-Replace Matrix

| Component / Module | Decision | Rationale & Scope |
| :--- | :--- | :--- |
| `src/simulations/turtle/physics.ts` | **Keep & Extend** | Solid pure kinematics & RAF interpolation; add helper support for multi-worker/flipbook reset & instant-bake stepping without breaking existing `tests/turtlePhysics.test.ts`. |
| `src/simulations/turtle/turtleEnvironment.tsx` | **Keep & Extend** | Add `72°`/`144°` presets, `insideCanvas` boolean sensor, `$frame`/`$time`/`$pointer*` / shared sensor adapters, `PEN_UP` air-trail event/metadata, `$randomColor` & color-var support in `SET_PEN_COLOR`. |
| `src/simulations/turtle/components/TurtleCanvas.tsx` | **Keep & Upgrade In-Place** | Preserve SVG pan/zoom/pinch/`fitToView`; add `PEN_UP` air-trail & `TELEPORT` warp cues, crisp White ink-layer compositing, dashed `insideCanvas` frame, `🐢👁️` toggle, Bottom-Dock Flipbook/Live controls, Live `♾️` single-finger pointer capture + hover reticle + conditional `👆 X, Y`, `🕒 Xs` readout, and multi-worker `TurtleWorkerState[]` + wait pills + `⏱️`. |
| `src/simulations/turtle/components/TurtleToolbarTools.tsx` | **Keep & Tune** | Enforce `>=36px` mobile / `>=44px` desktop touch targets cleanly inside bottom-right canvas corner. |
| `src/components/params/VisualParamBadges.tsx` | **Keep Default; Extend Additive** | Keep `RotationVisual`, `ArcAngleVisual`, `RadiusVisual`, `PenWidthVisual`, `LengthVisual`, and default/Beat `ColorVisual` verbatim (no popover pie-wedges or combined arc preview). Add user-approved Turtle-only `showEraserCue?: boolean` diagonal eraser-tip corner accent on `White (9)` (`#ffffff`) swatch pill (symbol-free & zero `data-shape-cue` so `tests/module2ParamsAndBeatTier2.test.ts` stays green) + additive `SensorVisual` badges for `$frame`/`$time`/`$pointer*`/`$input`/`🎲`. |
| `src/components/BlockItem.tsx` | **Keep Icons; Extend Params & TELEPORT** | Keep all Turtle palette/block SVGs untouched (`ArrowUp/Down`, `RotateCcw/Cw`, `Arc L/R`, `PenTool`, `Palette`, `Hourglass`, `Zap`, `Eraser`); keep Lucide `Crosshair` base on `TELEPORT` while adding the user-approved miniature turtle silhouette accent; support color-var / `$randomColor` chip rendering on `SET_PEN_COLOR`. |
| `src/engine/serialization/env/turtleSerializer.ts` | **Extend Backward-Compatibly** | Keep `ENV_VERSION_TURTLE = 1` byte-identical when static & tape-empty; add `paramVarMask & 0x02` (`encodeVarOrSensorIndex`) for `SET_PEN_COLOR`; add `ENV_VERSION_TURTLE_V2 = 2` env header (`mode`, `clearBetweenFrames`, `totalFrames`, `fps`, optional sparse tape). |
| `src/services/mapThumbnailGenerator.ts` & `src/components/VariationCardsPanel.tsx` | **Extend** | Wrap SVG previews in `#e2e8f0` container (reveals White eraser strokes); support `previewFrame`, `previewInput`, seeded `🎲`, and low-CPU (`5–10 fps`) cached mini-SVG flipbook loops on Variation Cards. |

---

## 3. User-Reviewed Icon Decisions (Resolved)

Per user review on Section 3 (`no` on items 1–2, `yes` on items 3–4):

### Approved (`yes` — Included in Plan Below)
1. **White (`9`) Eraser Swatch Micro-Cue (`ColorVisual`, Turtle `SET_PEN_COLOR` only):** Add a subtle diagonal eraser-tip corner accent on the `#ffffff` swatch pill (gated via `showEraserCue?: boolean` in Turtle `SET_PEN_COLOR` badges/popovers so Beat's `#ffffff` LED swatch stays untouched and `tests/module2ParamsAndBeatTier2.test.ts:516–539` `data-shape-cue`/symbol-free assertions stay green).
2. **`TELEPORT` Icon Accent (`Crosshair` + Mini Turtle):** Keep Lucide `Crosshair` on the `TELEPORT` block/badge unchanged as the primary glyph and add a subtle miniature turtle silhouette accent (`turtleEnvironment.tsx` / `BlockItem.tsx`).

### Rejected (`no` — Do Not Implement; Keep Existing Icons Unchanged)
1. **Popover Angle Pie-Wedge Helper (`ParamSelectionPopover` for `TURN_LEFT` / `TURN_RIGHT`):** Rejected (`no`) — keep existing `RotationVisual` only.
2. **Combined `Radius + Angle` Live Arc Preview (`ParamSelectionPopover` for `ARC_LEFT` / `ARC_RIGHT`):** Rejected (`no`) — keep existing separate `RadiusVisual` and `ArcAngleVisual` controls only.

---

## 4. Mandatory 5-Phase Progressive Implementation Plan

### Phase 1: Turtle Foundations (`seq` → `param` → `loop` → `func`)
- **UI & Canvas Polish (`TurtleCanvas.tsx`, `TurtleToolbarTools.tsx`, `MobileDrawerMenu.tsx`, `physics.ts`):**
  - Upgrade `tool-toggle-turtle` and `MobileDrawerMenu.tsx` (L480–500) to `🐢👁️` Hide Turtle toggle; enforce `>=36px` mobile / `>=44px` desktop tap targets in `TurtleToolbarTools.tsx` and top-right HUD pills.
  - Widen zoom clamp to `[0.02, 8]` across wheel, pinch, `fitToView`, and `TurtleToolbarTools.tsx`; step `#turtle-grid` adaptively (`50px` → `250px` → `1000px`) aligned to world coordinates, render viewport-dynamic origin crosshairs, enable `autoFitOverflow` during runs until manual pan/zoom, and keep the `turtle-robot` SVG compact & block-sized (`r = 12`, `~28×32px` via `1 / effectiveZoom` inverse scaling).
  - Render `PEN_UP` visual lift/translucent turtle pen tip (`scale(1.12)`, lifted shadow, hollow nib) + brief (`~1s`) fading dashed air-trail segment during animated playback (excluded from static canvas/thumbnails); implement explicit White (`9` `#ffffff`) ink-layer compositing over `#ffffff` background without silent VM stroke-width inflation.
  - Wrap canvas preview thumbnails (`renderTurtleMapSvg` in `mapThumbnailGenerator.ts`, `VariationCardPreview` in `VariationCardsPanel.tsx`) in subtle `#e2e8f0` framing so White strokes read clearly, and align `renderTurtleMapSvg` turtle SVG geometry (`r = 12`, `~28×32px`) with `TurtleCanvas`.
- **Parameter Presets & Approved Icon Polish (`turtleEnvironment.tsx`, `VisualParamBadges.tsx`, `BlockItem.tsx`, `BlockParamBadge.tsx`, `ParamSelectionPopover.tsx`):**
  - Set `DEFAULT_STEP_DISTANCE = 100`; configure `TURTLE_LENGTH_PARAM_DEF` (`defaultValue: 100`, options `[25, 50, 75, 100, 125, 150, 200, 250, 300]`), `TURTLE_ARC_RADIUS_PARAM_DEF` (`defaultValue: 50`, options `[25, 50, 75, 100, 150, 200]`), and `TURTLE_TELEPORT_X_PARAM_DEF`/`Y` (`[-250, -200, -150, -100, -50, 0, 50, 100, 150, 200, 250]`).
  - Add `72` and `144` quick-tap geometry degrees to `TURTLE_ANGLE_PARAM_DEF` (preserving `RotationVisual` unchanged; no pie-wedge or combined arc popovers).
  - Add `🏠 (0, 0, 0°)` quick-preset button inside `ParamSelectionPopover` (`coord` / `TELEPORT`), and add the approved miniature turtle silhouette accent beside Lucide `Crosshair` on `TELEPORT` (`turtleEnvironment.tsx` / `BlockItem.tsx`).
  - Add the approved `showEraserCue` diagonal eraser-tip corner accent on `#ffffff` (`White`, index `9`) inside `ColorVisual` when rendered for Turtle `SET_PEN_COLOR` (`BlockParamBadge` / `ParamSelectionPopover`, leaving Beat's `#ffffff` swatch unchanged and keeping `data-shape-cue` absent).
- **Tests:** `tests/turtlePhysics.test.ts`, `tests/turtleAnimation.test.ts`, & `tests/module2ParamsAndBeatTier2.test.ts` (assert `DEFAULT_STEP_DISTANCE = 100`, aligned param options, `[0.02, 8]` zoom & adaptive grid, `autoFitOverflow`, zoom-independent `~28×32px` turtle & `renderTurtleMapSvg` parity, `72°`/`144°` presets, `White` `#ffffff` color rendering + Turtle `showEraserCue` corner cue without breaking `module2ParamsAndBeatTier2` swatch invariants, `TELEPORT` `Crosshair` + turtle accent, `PEN_UP` no-committed-path + air-trail cue, and Hide Turtle state persistence across animations).

### Phase 2: Conditional Canvas Framing & Sensors (`branch` → `while`)
- **Canvas Framing & `insideCanvas` (`turtleEnvironment.tsx`, `TurtleCanvas.tsx`, `physics.ts`):**
  - Default nominal bounds (`DEFAULT_TURTLE_CANVAS_BOUNDS`): `[-300..+300] × [-240..+240]` (`600×480px`), overridable via optional `canvasBounds?: { halfWidth: number; halfHeight: number }` on `TurtleState` and `CurriculumTurtleDefinition`. Draw a subtle dashed nominal boundary rectangle on `TurtleCanvas.tsx` when `state.canvasBounds` is set corresponding to boolean sensor `insideCanvas`, while keeping pan/zoom drawing bounds practically unbounded (`[0.02, 8]`).
  - Implement `isTurtleInsideCanvas` and `evaluateSensor('insideCanvas', state)` in `turtleEnvironment.tsx` honoring `state.canvasBounds ?? DEFAULT_TURTLE_CANVAS_BOUNDS` with inclusive `1e-6` epsilon (`Math.abs(x) <= halfW + 1e-6 && Math.abs(y) <= halfH + 1e-6`) so reversing via `BACKWARD [d]` reliably returns inside bounds.
- **Shared Integration (`conditionSerializer.ts`, `curriculum/types.ts`, `ConditionBadge.tsx`, `curriculumStagePolicy.ts`):**
  - Wire `@platform` tag **`0x28`** for `insideCanvas` in `conditionSerializer.ts` and render its zero-reading frame badge in `ConditionBadge.tsx`.
  - Support Top-Dock `SceneInputBar` (`$input`) readiness for Turtle `branch`/`while` lessons.
- **Tests:** Unit test `insideCanvas` boundary truthiness & `0x28` binary round-trip in `conditionSerializer` + `turtlePhysics.test.ts`.

### Phase 3: Typed Colors, Sensors, Randomness & Live Interactive Mode (`var` → `cmp` → `inter`)
- **Serialization & Interpreter (`turtleSerializer.ts`, `codeScopes.ts`, `interpreter.ts`, `serialization/types.ts`):**
  - Enable `MASK_HAS_VAR_PARAM` (`paramVarMask & 0x02`) on `OP_TURTLE_SET_PEN_COLOR (0x18)` using `encodeVarOrSensorIndex` (`0..25` for `a..z`, `0x80 | sensorIdx` for `$randomColor`), keeping `0..9` literal `uint8` encoding byte-identical.
  - Resolve `TypedValue` (`color` | `number`) and `@platform` sensor tokens (`0x84..0x96`: `$input`, `🎲` rolls, `$randomColor`, `$pointerX`, `$pointerY`, `$pointerDown`) cleanly in `interpreter.ts` L915–924 & `BlockSubpalette.tsx` (post-`allKnown` sensor-filter fix).
  - Add `TELEPORT` departure flash + landing crosshair ring animation (`TurtleCanvas.tsx`, complementing the Phase 1 `Crosshair` + miniature turtle block icon).
- **Live Interactive Mode `♾️` (`useAppStore.ts`, `TurtleCanvas.tsx`, `turtleSerializer.ts`):**
  - Emit `ENV_VERSION_TURTLE_V2 = 2` header (`turtleFlags` `mode = 2` for Live Mode, `clearBetweenFrames` bit `0x04`) when saved/shared from Sandbox; emit `v1` when static & tape-empty.
  - Implement fixed `~15–30 fps` `runTurtleExecutionLoop` Live ticker (guarded per tick by a bounded step cap e.g. `2,500–5,000` steps): coupled pose+canvas reset (`🧹 ON`: resets `(0,0,0°)` + paths, retains `a..z` & Tape; `🧹 OFF`: keeps accumulated paths **and** turtle pose + vars/Tape).
  - Implement pointer-vs-pan/zoom arbitration in `TurtleCanvas.tsx`: 1-finger tap/drag updates `$pointerX`/`$pointerY`/`$pointerDown` (with hover reticle & conditional `👆 X, Y` readout in `turtle-info-pill`) when Live Mode runs; 2-finger pinch/drag zooms/pans; pausing restores 1-finger pan.
  - Dispatch queued `ON_TAP (0x40)` and `ON_KEY_* (0x41..0x46)` scopes (driven by Bottom-Dock `[◀▲▼▶]` / `[🅰️🅱️]` strip, collapsing `VariationCardsPanel` behind `🎨 (N)` on `<640px`) between frames with subtle canvas ripple feedback; wire shared `0x2E keyHeld` and `0x30 CMP`.
- **Tests:** Unit tests for `SET_PEN_COLOR` variable/`$randomColor` binary roundtrip (`v1`/`v2`), Live `♾️` pointer arbitration, `🧹 ON/OFF` coupled reset vs persistent trails/pose, and Playwright E2E verifying Live pointer interaction + 2-finger/paused pan.

### Phase 4: Flipbook Animation Mode, Variation Loops & Sparse Tape (`tape` → `anim` → `sort`)
- **Flipbook State & Two-Phase Engine (`useAppStore.ts`, `TurtleState`, `pwaStateRestoreService.ts`):**
  - Store `preRunSnapshot` (variables `a..z` + sparse Tape + `$frame = 1`), `clearBetweenFrames` (`boolean`), `totalFrames` (`N`), `fps`, deterministic `$time = ($frame - 1) / fps`, and cached baked frames (`TurtlePathItem[][]` / `TurtlePose[]` vector snapshots) with per-frame `MAX_TOTAL_STEPS = 10,000`.
  - **First Pass (Draw & Bake):** Animate each frame visibly (`Pre-Clear Hold` briefly before frame `k+1` clears), supporting `Instant` skip directly to baked frames and **`⏩ Render All Frames`** fast-bake button; preserve `mergeLiveTurtleViewState` viewport (`pan`/`zoom`/`showTurtle`).
  - Serialize Flipbook sandbox config (`mode = 1`, `totalFrames`, `fps`, optional sparse Tape) under `ENV_VERSION_TURTLE_V2 = 2` (and `profileSerializer.ts` round-trip).
- **Bottom-Dock Scrubber & Mobile Consolidation (`TurtleCanvas.tsx`, `App.tsx`, `SimulationTopLeftHud.tsx`):**
  - Place Timeline Scrubber (`1..N`), Play/Pause, Loop (`1×`/`∞`), speed multiplier (`0.5×`/`1×`/`2×`), `🎞️ N` totalFrames stepper (`2..60`), `🧹 Clear Between Frames [ON/OFF]`, and Rewind (`⏮`) inside `TurtleCanvas` Bottom Dock (`shrink-0`, zero `<header>` additions; `<640px` collapses with `VariationCardsPanel` behind `🎨 (N)` when `TapeDock` shares vertical space so canvas keeps `>= 200px` height).
  - Add **`🕒 Xs`** elapsed time pill to Bottom-Left `turtle-info-pill` (strictly distinct from `⏱️`).
- **Thumbnails & Variation Cards (`simulationRunner.ts`, `mapThumbnailGenerator.ts`, `VariationCardsPanel.tsx`):**
  - Extend `runHeadlessSimulation` + `renderTurtleVariationPreview` with `previewFrame`, `previewInput`, deterministic seeded `🎲`, and low-CPU (`5–10 fps`) animated mini-SVG flipbook frame loops inside `#e2e8f0` Variation Card frames.
- **Tests:** Unit tests for `$frame` / `$time` determinism, `Pre-Clear Hold` / `Render All Frames` / `⏮` rewind restore, `ENV_VERSION_TURTLE_V2` roundtrip, and `VariationCardsPanel` Flipbook frame preview tests; E2E Flipbook Draw & Bake + Scrubber Playwright test.

### Phase 5: Multi-Turtle Concurrency (`conc`) & Higher-Order Callbacks (`fp`)
- **Multi-Worker Turtle State (`TurtleCanvas.tsx`, `physics.ts`, `turtleEnvironment.tsx`, `useAppStore.ts`):**
  - Extend `TurtleState` / renderer slice with `workers: TurtleWorkerState[]` (covering `Main 1..4` tabs `0x00..0x03` and `Fork` children spawned via `OP_EXT 0x03`, capped at shared worker limit e.g. `32`).
  - `Main 1..4` workers spawn at `(0, 0, 0°)` with color-coded turtle shell rings (`🔴1`, `🔵2`, …) and concentric origin separation offsets; `Fork` inherits exact parent `(x, y, heading, penDown, penColor, penWidth)` with mitosis split-pop and `~200ms` graceful fadeout upon child completion (keeping strokes).
  - Render compact floating canvas wait/shield cues (`⏳🚧`, `⏳📬`, `⏳🔒`, `🛡️`) over paused workers and surface the Top-Right **`⏱️`** wall-clock tick indicator (distinct from Flipbook `🕒 Xs`), plus per-worker `TapeDock` heads (`▲1 ▲2`).
- **Higher-Order Callback Compatibility (`fp`):**
  - Execute `CALL_PARAM_FN` (`OP_EXT 0x08` / `RETURN 0x07`) smoothly inside turtle stroke animations and headless `runHeadlessSimulation` / Variation Card previews with zero new Turtle-specific FP blocks.
- **Tests:** Unit tests for `Fork` pose inheritance & isolated pen state, `Main 1..2` concurrent deterministic interleaving, `⏱️` vs `🕒` telemetry separation, and Playwright E2E multi-turtle canvas render.

---

## 5. Shared-File Coordination & Schema Alignment (`@platform` `#287`)

| Shared File / Area | Platform Owner Decision (`#287`) | `env-logo` Integration Point |
| :--- | :--- | :--- |
| `src/App.tsx` & `SimulationTopLeftHud.tsx` | Unified `[Top Dock → Viewport flex-1 (≥48px top HUD clearance) → Bottom Dock]`, `BackpackHud` retired | Mount `TurtleCanvas` Bottom-Dock Flipbook/Live controls inside `TurtleCanvas` footer dock (`shrink-0`); clear `>=48px` top band for `SimulationTopLeftHud` & `MultiRunPipsBar`. |
| `src/engine/serialization/types.ts` & `docs/binary_format.md` | `ENV_VERSION_TURTLE_V2 = 2`, `OP_EXT = 0x0F`, `ConditionExpr` `0x28` (`insideCanvas`), `0x2C`/`0x2E`/`0x30`, `SENSOR_REF_FLAG` `0x84..0x96` & `0xC0..0xC2`, `0..9` `PALETTE_COLORS` | Keep `ENV_VERSION_TURTLE = 1` unchanged for static empty-tape programs; emit `V2` only when `flipbook`/`live`/`fps`/sandbox tape are active; enable `paramVarMask & 0x02` on `0x18 SET_PEN_COLOR`. |
| `src/engine/interpreter.ts`, `codeScopes.ts`, `codeSerializer.ts`, `profileSerializer.ts` | Per-frame step reset, `TypedValue` vars, `Main 1..4` (`0x00..0x03`), `ON_TAP`/`ON_KEY_*` (`0x40..0x46`), `FORK`/`JOIN`/`SYNC`/`SEND`/`LOCK`/`RETURN`/`CALL_PARAM_FN` | Resolve color vars/`$randomColor` in `SET_PEN_COLOR`, wire `insideCanvas` + `$frame`/`$time`/`$pointer*` sensors, persist `ENV_VERSION_TURTLE_V2` & multi-Main scopes in backups/saves. |
| `src/store/useAppStore.ts` & `pwaStateRestoreService.ts` | Multi-worker runtime scheduler, shared `TapeState` & `SceneInputBar`, `VariantRunSnapshot` error chips | Upgrade `stepTurtleAnimation` / `runTurtleExecutionLoop` for Flipbook Bake+Scrub, `PreRunSnapshot` Rewind, Live `♾️` loop, queued events, and `workers[]`. |
| `src/components/BlockSubpalette.tsx`, `ConditionBadge.tsx`, `ParamSelectionPopover.tsx`, `VisualParamBadges.tsx` | Build `<ConditionSubpalette>`, fix `allKnown` sensor filter (`L63–95`), preserve existing icons | Expose Turtle sensors (`$x/$y/$heading`, `$frame/$time`, `$pointer*`, `insideCanvas`), `🏠 (0,0,0°)` `TELEPORT` preset, `72°/144°` angle presets, Turtle-gated `White (9)` `showEraserCue` swatch corner micro-cue, and `TELEPORT` mini-turtle accent while keeping `RotationVisual`, `ArcAngleVisual`, and `RadiusVisual` unchanged (no pie-wedges/combined arc previews). |
