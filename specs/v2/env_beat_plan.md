# 🎵 Beat & Light Matrix (`v2`) — Implementation & Architecture Plan

This document specifies the `src/` implementation roadmap for **[Beat & Light Matrix](../../docs/envs/beat_light.md)** (`simId = 'beat'`, `ENV_ID_BEAT = 0x03`, `simCode = 2`), aligned with:
- [docs/envs/beat_light.md](../../docs/envs/beat_light.md)
- [docs/ui_guidelines.md](../../docs/ui_guidelines.md)
- [docs/binary_format.md](../../docs/binary_format.md)
- [docs/platform_requirements.md](../../docs/platform_requirements.md)
- Swarm `@platform` Round B locked coordination (`#287`)

> **Design Rule — Default Icon Preservation:** All existing refined palette SVGs in `src/simulations/beat/beatEnvironment.tsx` and custom parameter badges in `src/components/params/VisualParamBadges.tsx` (`PitchVisual`, `BeatDurationVisual`, `StampPresetVisual`, `GridCoordVisual`, `CursorTurnVisual`, `BeatDelayVisual`, `WaitDurationVisual`) are **preserved unchanged by default**. Only Stage-1-approved layout/gating fixes and the user-resolved icon decisions in [Section 3](#3-icon-review-outcomes-resolved-by-user) apply.

---

## 1. Current `src/` Baseline

Directly verified Beat & shared touchpoints in the repository today:

1. **Beat Simulation Module (`src/simulations/beat/`):**
   - `types.ts`: Fixed `BEAT_GRID_SIZE = 8`, `BEAT_LED_PALETTE` (`0..7` vibrant + `8` Black `#0f172a` + `9` White `#ffffff`), `BeatPresetName` (8 presets), `BeatCursorState` (`x`, `y`, `dir`, `visible`), `BeatState` (`leds[8][8]`, `activeColor`, `isColorCustomized`, `beatIndex`, `stepCount`, `cursor`, `isMuted`, `stepDelayMultiplier`, `status`).
   - `presets.ts`: `BEAT_STAMP_PRESETS` (`0=HEART`..`7=ROBOT`), `createPresetLedGrid` (full `8×8` bitmap replacement), `countLitLeds`.
   - `beatSynth.ts`: 1-octave C Major `BEAT_SCALE_FREQUENCIES` (`1..8` -> `261.63Hz..523.25Hz`), `OfflineAudioContext` pre-rendered sample cache, `main`/`preview` source isolation, low-quality voice caps (`8`/`4`), autoplay unlock queue, `playVictoryFanfare`. **Missing:** pitches `9..16`, `Math.trunc` + silent OOB rest, master `DynamicsCompressorNode`.
   - `beatEnvironment.tsx`: Registers 15 palette blocks (`DRUM_KICK`, `DRUM_SNARE`, `DRUM_CLAP`, `PLAY_CHIME`, `STAMP_HEART/STAR/SMILE`, `WAIT_BEAT`, `CLEAR_LEDS`, `PLAY_NOTE`, `SET_LED_COLOR`, `LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL`, `STAMP_PRESET`, `CURSOR_STEP`, `CURSOR_TURN`, `SET_BEAT_DELAY`), `cursor.visible = false` on reset, `resolvePaintLedCell` (`#0f172a` -> `null`). **Live gaps:**
     - `PLAY_NOTE` uses `Math.round` + `1..8` edge clamp instead of `Math.trunc` + silent OOB rest (`1..16` v2);
     - `LIGHT_ROW`/`LIGHT_COL`/`LIGHT_PIXEL` use `Math.round` + `1..8` edge clamp instead of `Math.trunc` + silent OOB no-op over `1..W`, `1..H`;
     - `stepBeatCursor` wraps modulo `BEAT_GRID_SIZE` (asserted in `tests/module3BeatCursor.test.ts:134–174`) rather than soft edge-clamp for `while (NOT cursorAtEdge)`;
     - `BEAT_DELAY_PARAM_DEF` & palette `params` default dropped `SET_BEAT_DELAY` to `delay: 0` while runtime initial `stepDelayMultiplier` is `1` (`useAppStore.ts:662`: `1× = 400ms`), and options are `[0, 0.25, 0.5, 1, 2, 4]` multipliers (not `ms`);
     - `resolveLedColor` assumes raw numeric indices `1..10` (`Math.round`), lacking `TypedValue` color/wire decoupling (`0..9`);
     - No `sensors` registered (`cursorAtEdge`, `$cursorX`, `$cursorY`, `$beatIndex`, `$pointerX/Y/Down`, `$randomColor`), no `STAMP_FROM_TAPE`.
   - `components/BeatCanvas.tsx`: Renders `shrink-0` top header bar (`beat-cue-indicator`, `beat-step-counter`, unconditional `tool-beat-active-color`, `beat-tap-for-sound-pill`, `tool-beat-mute`, `tool-loop-playback`) + `beat-ring` / `beat-ring-pulse` + CSS `8×8` LED grid + conditional `beat-cursor-reticle` (only rendered when `state.cursor.visible`, showing white ring + directional SVG triangle).
   - `components/BeatToolbarTools.tsx`: Unused duplicate of `tool-beat-mute` and `tool-beat-active-color` (referenced in `beatEnvironment.tsx:1062` `ToolsComponent`, never mounted by `App.tsx` or `Toolbar.tsx`).

2. **Shared Platform, UI & Serialization Touchpoints:**
   - `src/App.tsx` (`L65–70`): Mounts `<SimulationTopLeftHud positionClassName={activeSimId === 'depot' ? 'top-12 left-3' : 'top-3 left-3'} />` inside `ActiveSimulationPane` — **colliding with `BeatCanvas`'s top-left `beat-cue-indicator`** whenever variables or call-stack badges appear!
   - `src/components/VariationCardsPanel.tsx`: Live mini `8×8` preview + `BeatVariationPreviewPlayer` (`in-card ▶`/`⏹` toggle, `MAX_CONTROL_HOPS_PER_BEAT = 64`); mini cursor (`variation-beat-cursor`, `L629–636`) intentionally renders a compact white border ring only (`too small` for a directional triangle). Grid CSS assumes `8×8`, and `VariationCardPreview` (`L597`) + `renderBeatMapSvg` (`mapThumbnailGenerator.ts:465`) + `BeatLedCell` (`BeatCanvas.tsx:161`) check `Boolean(ledColor)` without rejecting `#0f172a`/`#000000`.
   - `BeatCanvas.tsx:332–345` (`tool-beat-active-color`) and workspace `SET_LED_COLOR` badges (`BlockParamBadge.tsx:66` -> `VisualParamBadges.tsx:277–304` `ColorVisual`) currently display `Black` (`8` / `#0f172a`) as a flat unshaded `#0f172a` swatch instead of the recessed shaded LED-Off pad + `⊘` Erase cue.
   - `src/components/params/VisualParamBadges.tsx`: Refined Beat SVGs (`PitchVisual`, `BeatDurationVisual`, `StampPresetVisual`, `GridCoordVisual`, `CursorTurnVisual`, `BeatDelayVisual`, `WaitDurationVisual`) + clean `ColorVisual` (guarded symbol-free by `tests/module2ParamsAndBeatTier2.test.ts:516–539`).
   - `src/components/BlockSubpalette.tsx` (`L63–95`): `availableSensors` filters hardcoded 4-element `allKnown` (`$tileDial, $x, $y, $heading`) when `policy.allowedValueSensors` is defined, dropping Beat/shared sensors (`$pointerX`, `$randomColor`, etc.).
   - `src/engine/serialization/types.ts` (`L229–245`) & `env/beatSerializer.ts`: **All 16 Beat slots `0x10..0x1F` are already allocated** (`0x1E = OP_BEAT_SET_DELAY`, `0x1F = OP_BEAT_WAIT_DURATION`), while `docs/binary_format.md` §7.4 stopped at `0x1D` and omitted colors `8..9`. `OP_BEAT_PLAY_NOTE` (`0x17`) currently encodes only `durCode` `0/1/2` (`<=0.5, 1, >=2` beats) and ignores `paramVarMask` bit `0x04` on duration.
   - `src/engine/serialization/profileSerializer.ts` (`L85–103`): `BEAT_EXCLUSIVE_BLOCKS` omits `'SET_BEAT_DELAY'` and future `'STAMP_FROM_TAPE'`.
   - `src/services/mapThumbnailGenerator.ts` (`renderBeatMapSvg`) & `pwaStateRestoreService.ts` (`sanitizeBeatState`): Hardcoded `BEAT_GRID_SIZE = 8`.
   - `src/store/useAppStore.ts` (`runBeatExecutionLoop`, `beatPassHadDelay`), `Toolbar.tsx`, `MobileDrawerMenu.tsx`, `SaveProgramModal.tsx`, `LoadProgramModal.tsx`, `LessonPickerModal.tsx`, `SolutionModal.tsx`, `CurriculumNextLessonBar.tsx`, `utils/curriculumStagePolicy.ts` (`isInstantSpeedDisabled`), `utils/performanceMonitor.ts`: Beat integration already live and tested.

---

## 2. Keep-vs-Replace Matrix

| Area / File | Decision | Plan Notes |
| :--- | :--- | :--- |
| `src/simulations/beat/beatSynth.ts` | **Keep & Extend** | Preserve Web Audio cache, `main`/`preview` isolation, low-quality caps, unlock queue; add `9..16` pitches, `Math.trunc` + OOB rest, and `DynamicsCompressorNode`. |
| `src/simulations/beat/presets.ts` | **Keep** | Preserve all 8 `8×8` `BEAT_STAMP_PRESETS` artworks (`#0..#7`) & full-frame `createPresetLedGrid` semantics (tested in `tests/beatEnvironment.test.ts:298–348`). Overlay compositing lives in `STAMP_FROM_TAPE`. |
| `src/simulations/beat/types.ts` | **Keep & Extend** | Add `width`/`height` (`8 \| 16 \| 32`), `edgeBonk` cue, optional `workers[]` / channel telemetry for `conc`. |
| `src/simulations/beat/beatEnvironment.tsx` | **Keep & Fix** | Keep 15 existing palette items & SVG icons; fix OOB pixel behavior (`Math.trunc` silent no-op), `PLAY_NOTE` `Math.trunc` + rest + `9..16`, `SET_BEAT_DELAY` multiplier options/default, soft edge-clamp `stepBeatCursor` (`while` phase), add `STAMP_FROM_TAPE` (`Phase 4`) & Beat `sensors`. |
| `src/simulations/beat/components/BeatCanvas.tsx` | **Keep & Fix** | Keep LED pad CSS, `beat-ring`, `beat-cue-indicator`, mute/loop/tap pills, conditional `beat-cursor-reticle` (`cursor.visible`); update `beat-step-counter` to `🎵 #N`; render `Black` (`#0f172a`) in `BeatLedCell` and `tool-beat-active-color` as recessed LED-Off (`⊘` cue on swatch, never unshaded black); gate `tool-beat-active-color` by lesson palette; clear `SimulationTopLeftHud`; scale to `16×16`/`32×32`; add optional pointer capture (`inter`). |
| `src/simulations/beat/components/BeatToolbarTools.tsx` | **Remove (Dead Code)** | Unmounted duplicate of `BeatCanvas.tsx` mute & active-color pills; remove `ToolsComponent` reference cleanly after verifying nothing imports it directly. |
| `src/components/params/VisualParamBadges.tsx`, `BlockParamBadge.tsx`, `ParamSelectionPopover.tsx` | **Keep Core + Off Wrapper** | Keep all Beat parameter badges/icons (`BeatDelayVisual`, `PitchVisual`, `StampPresetVisual`) and symbol-free `ColorVisual` core DOM verbatim; add Beat-only (`actionType === 'SET_LED_COLOR'`) recessed LED-Off + `⊘` Erase wrapper around `#0f172a` in workspace block badge & picker. |
| `src/engine/serialization/env/beatSerializer.ts` | **Keep & Extend (v2)** | Preserve lossless `ENV_VERSION_BEAT = 1` read/write; add `ENV_VERSION_BEAT = 2` support for `OP_EXT (0x0F)` `STAMP_FROM_TAPE`, `PLAY_NOTE` extended/var durations, and optional `W×H` + Tape state header. |
| `src/engine/serialization/profileSerializer.ts` | **Patch** | Add `'SET_BEAT_DELAY'` and `'STAMP_FROM_TAPE'` to `BEAT_EXCLUSIVE_BLOCKS` (`L85–103`). |
| `src/App.tsx` | **Align w/ Platform** | Unified `[Top Dock -> Canvas Wrapper -> Bottom Dock]` puts `BeatCanvas` Canvas Header Row above canvas & gives `SimulationTopLeftHud` clean non-colliding clearance (`#287`). |

---

## 3. Icon Review Outcomes (Resolved by User)

Per workspace & `@platform` `#287` icon-preservation rules, the user reviewed all three Beat visual proposals with these final decisions (zero pending Beat icon questions remain):

1. **`Black` (`8` / `#0f172a`) = LED Off / Erase (`yes` + main-view off requirement — Moved to Phase 1):** User approved the `⊘` / Off-Erase cue in the color picker AND required that **Black renders as turned Off on the main view** (today `tool-beat-active-color` and `SET_LED_COLOR` workspace badges show unshaded `#0f172a` black, different from recessed shaded off-LED pad cells). Keep `ColorVisual` itself symbol-free (`tests/module2ParamsAndBeatTier2.test.ts:516–539`) and keep Turtle `SET_PEN_COLOR` Black as solid ink by scoping the recessed off-pad + `⊘` cue strictly to Beat (`BeatCanvas.tsx` `tool-beat-active-color` and `SET_LED_COLOR` wrappers in `BlockParamBadge.tsx` / `ParamSelectionPopover.tsx` / `ParamVisual`), plus guarding all LED cell renderers/restorers so `#0f172a`/`#000000` is treated identically to `null` (Off).
2. **Music-Prefixed Beat Counter (`🎵 #N` vs `#N`) (`yes` — Moved to Phase 1):** User approved upgrading `beat-step-counter` (`BeatCanvas.tsx:325–327`) to `🎵 #${state.beatIndex}` so Beat step counters stand out cleanly from Tape address indices (`#1..#10000`) and numeric parameters.
3. **Directional Arrow inside Mini Variation Preview Cursor (`VariationCardsPanel.tsx:629–636`) (`no too small` — Rejected):** User declined adding a miniature triangle inside `variation-beat-cursor` as too small; keep mini variation cursors as the crisp white ring border only.

---

## 4. Synchronized 5-Phase Implementation Plan

Follows the unified 5-Phase Progressive Ladder locked in `#281` & `#287`:

### Phase 1: `seq → param → loop → func` (Header Clearance, Delay Consistency & Core Stability)

- **Shared / Beat Layout, Icons & HUD (`App.tsx`, `BeatCanvas.tsx`, `ui_guidelines.md §3`):**
  - Place `BeatCanvas`'s `Canvas Header Row` cleanly in the `shrink-0` header strip above the matrix grid wrapper (`SimulationTopLeftHud` sits inside the LED matrix wrapper or dedicated HUD clearance band), eliminating the `App.tsx:65` overlap over `beat-cue-indicator`.
  - Gate `tool-beat-active-color` in `BeatCanvas.tsx`: render only when `appMode === 'sandbox'` OR `SET_LED_COLOR` is enabled in the active curriculum lesson's `allowedSimBlocks` (using `computeStagedPalettePolicy`).
  - Prefix `beat-step-counter` in `BeatCanvas.tsx:325–327` as `🎵 #${state.beatIndex}` (approved icon refinement).
  - Ensure `Black` (`8` / `#0f172a`) renders visibly **Off / Erase** everywhere in Beat (never unshaded `#0f172a` black):
    - Export/use `isBeatLedOffHex(color)` (`#0f172a` / `#000000` case-insensitive) to normalize `#0f172a` -> `null` in `beatEnvironment.tsx` (`resolvePaintLedCell`), `presets.ts` (`createPresetLedGrid` `colorOverride` guard), and `pwaStateRestoreService.ts` (`sanitizeBeatState`), and guard `isLit = Boolean(ledColor) && !isBeatLedOffHex(ledColor)` in `BeatLedCell` (`BeatCanvas.tsx:161`), `VariationCardPreview` (`VariationCardsPanel.tsx:597`), and `renderBeatMapSvg` (`mapThumbnailGenerator.ts:465`) so off cells always draw the recessed shaded off-pad (`bg-slate-800/85 border-slate-700/60 shadow-inner` / `#1e293b` SVG pad).
    - Style `BeatCanvas.tsx:332–345` (`tool-beat-active-color`) and Beat `SET_LED_COLOR` swatches in `BlockParamBadge.tsx:53–67` + `ParamSelectionPopover.tsx:263–275` (`actionType === 'SET_LED_COLOR'`) with recessed shaded off-pad background (`bg-slate-800/85 border-slate-600/80 shadow-inner`, no dark neon glow) and a crisp `⊘` Off/Erase SVG overlay outside `ColorVisual`'s bare DOM (`tests/module2ParamsAndBeatTier2.test.ts:516–539` stays green and Turtle `SET_PEN_COLOR` Black remains solid ink).
  - Remove dead `BeatToolbarTools.tsx` (and `beatEnvironment.tsx:1062` `ToolsComponent: BeatToolbarTools`).
- **`SET_BEAT_DELAY` Reconciliation (`docs/envs/beat_light.md`, `beatEnvironment.tsx`, `useAppStore.ts`):**
  - Keep `stepDelayMultiplier` (`0`, `0.25×`, `0.5×`, `1×`, `2×`, `4×` × `globalSpeedMs = 400ms`, preserving `BeatDelayVisual` badges per `#287`). Optional `0.125×` (`⅛×`) added in Phase 4 (`ENV_VERSION_BEAT_V2`) if faster LED sweeps are desired without altering core options.
  - Ensure dropped `SET_BEAT_DELAY` block default (`BEAT_DELAY_PARAM_DEF.defaultValue`) matches intended authoring UX cleanly: keep `0` default if `SET_BEAT_DELAY` primary curriculum use is instant display-buffer batching (already tested in `tests/beatDelayAndTurtleAnimationOps.test.ts:52` & `tests/beatEnvironment.test.ts:562`), while runtime state initializes at `stepDelayMultiplier: 1` (`400ms`).
- **Serialization & Exclusive Detection (`docs/binary_format.md`, `profileSerializer.ts`, `beatSerializer.ts`):**
  - Sync `docs/binary_format.md` §7.4 to document already-shipped `0x1E OP_BEAT_SET_DELAY`, `0x1F OP_BEAT_WAIT_DURATION`, and `SET_LED_COLOR` `0..9` (`8=Black`, `9=White`).
  - Add `'SET_BEAT_DELAY'` to `BEAT_EXCLUSIVE_BLOCKS` in `src/engine/serialization/profileSerializer.ts:85–103` so sandbox Beat autosaves/manual saves detect Beat properly even when `SET_BEAT_DELAY` leads a workspace.
  - Sync `MobileDrawerMenu.tsx` Mute/Loop Beat controls and keep `VariationCardsPanel.tsx` (`variation-beat-cursor`) as the compact white ring border only (`too small` for miniature directional arrow).
- **Tests (Phase 1):**
  - Extend `tests/beatEnvironment.test.ts`, `tests/module1BeatAndCards.test.ts`, and `tests/module2ParamsAndBeatTier2.test.ts` for `tool-beat-active-color` gating in `seq` vs `param+`, `SimulationTopLeftHud` non-overlap geometry check (`App.tsx` + `BeatCanvas`), `🎵 #${beatIndex}` counter prefix, `#0f172a` Off/Erase main-view rendering (`BeatLedCell` `data-lit="false"` recessed pad + `⊘`/off cue on `tool-beat-active-color` and `SET_LED_COLOR` vs solid Black ink on `SET_PEN_COLOR` & symbol-free `ColorVisual`), and `profileSerializer.ts` `SET_BEAT_DELAY` detection.

### Phase 2: `branch → while` (Boolean Cursor Edge, Soft Edge Clamp & Scene `$input`)

- **Boolean Sensor `cursorAtEdge` (`0x2A`):**
  - `src/data/curriculum/types.ts`: Add `'cursorAtEdge'` to `BeatConditionSensor` / `ConditionSensorType`.
  - `src/engine/serialization/conditionSerializer.ts`: Allocate `COND_TAG_CURSOR_AT_EDGE = 0x2A` (`#287`), serialize/deserialize `cursorAtEdge`, and evaluate against `(cursor.x, cursor.y, cursor.dir, width, height)` facing outward (`WEST` at `x===1`, `EAST` at `x===W`, `NORTH` at `y===1`, `SOUTH` at `y===H`).
  - `src/simulations/beat/beatEnvironment.tsx`: Expose `cursorAtEdge` evaluator and switch `stepBeatCursor` from toroidal `%` modulo wrap to **soft edge-clamp** (stays at boundary cell + emits `edgeBonk` pulse without crashing, so `While (NOT cursorAtEdge)` terminates deterministically on borders & spirals!).
  - `src/components/ConditionBadge.tsx` & shared `<ConditionSubpalette>`: Render visual pixel-cursor-at-wall icon for `cursorAtEdge`.
- **Shared Scene `$input` Dock Widget (`🎛️`):**
  - Consume platform `SceneInputBar` value via `$input` in Beat `branch`/`inter` sandboxes (reactive re-run when learner taps selector `1..8` or swatch for interactive beatboxes/mood lamps).
- **Reticle Visibility Guard:**
  - Confirm `beat-cursor-reticle` stays hidden (`cursor.visible = false`) on `Reset` and in non-cursor `branch`/`while` lessons (`cursor.visible` activates only on `CURSOR_STEP` / `CURSOR_TURN`).
- **Tests (Phase 2):**
  - **Update `tests/module3BeatCursor.test.ts` (`L134–174`):** Replace toroidal edge-wrap expectations with soft edge-clamp + `edgeBonk` assertions and add `cursorAtEdge` directional truth-table + `ConditionExpr` `0x2A` round-trip tests.

### Phase 3: `var → cmp → inter` (2-Octave Audio, Expressions, Pointer Capture, Virtual D-Pad & Queued Events)

- **Audio Upgrades (`src/simulations/beat/beatSynth.ts`):**
  - Extend `BEAT_SCALE_FREQUENCIES` from `1..8` (`C4..C5`) to **`1..16` (`C4..D6`)** in C Major (`9=D5 587.33Hz` .. `16=C6/D6` — note exact `1..8` C4..C5 frequencies stay identical!).
  - Add a **Master `DynamicsCompressorNode`** before `ctx.destination` to prevent distortion during dense polyphonic triggers.
  - Truncate incoming pitch via `Math.trunc`; pitches `< 1` or `> 16` return silent rest (no audio voice spawned) for clean 1-beat rests.
- **Matrix Bounds, Color Variables & OOB Behavior (`src/simulations/beat/beatEnvironment.tsx`):**
  - Truncate `x`/`y` coordinates in `LIGHT_ROW`, `LIGHT_COL`, `LIGHT_PIXEL` via `Math.trunc` and treat `< 1` or `> width`/`height` as a **silent no-op** (removing edge clamping that distorts ripples/loops!). *(Review and update any OOB clamp unit test in `tests/module2ParamsAndBeatTier2.test.ts` if present.)*
  - Support canonical `TypedValue` `color` tokens (`PALETTE_COLORS` `0..9` from `#287`) inside `SET_LED_COLOR`: translate canonical color IDs to Beat's visual hex (`0..9`), while preserving legacy `BEAT_LED_PALETTE` `0..7` (`+8,9`) index round-trip inside `beatSerializer.ts` (`0x18`).
- **Beat & Shared Value Sensors (`SERIALIZED_SENSOR_IDS`, `BlockSubpalette.tsx`, `ParamSelectionPopover.tsx`):**
  - Fix **`src/components/BlockSubpalette.tsx` (`L63–95`)** so `availableSensors` merges `currentSimEnv.sensors` / shared `SERIALIZED_SENSOR_IDS` before filtering against `policy.allowedValueSensors`.
  - Wire Beat sensors via `#287` codes: **`$cursorX` (`0xB0`)**, **`$cursorY` (`0xB1`)**, **`$beatIndex` (`0xB2`)**, plus shared **`$input` (`0x84`)**, **`🎲` (`$randCoin..$rand01`)**, **`$randomColor`**, and **`$pointerX` / `$pointerY` / `$pointerDown`** (`0..W`, `0..H`, `0|1`) cleanly into `beatEnvironment.sensors`, `interpreter.ts` (`evaluateValue` / `L915–924`), `ParamSelectionPopover.tsx`, and `types.ts`.
  - Enable variable duration on `PLAY_NOTE` (`paramVarMask & 0x04`) and extended fractional/long beats (`0.125`, `0.25`, `0.5`, `1`, `2`, `4`) via `ENV_VERSION_BEAT = 2`.
- **Interactive Matrix & Virtual Controls (`inter`):**
  - `BeatCanvas.tsx`: Quantized cell pointer/tap tracking updating reactive `$pointerX` (`1..W`), `$pointerY` (`1..H`), and `$pointerDown` (`1|0`), plus hover/press glow without interfering with page scroll outside interactive mode.
  - Integrate `@platform` Bottom-Dock **Virtual D-Pad + `🅰️`/`🅱️`** (`keyHeld(0x2E)`) and **Queued Single-Threaded Event Scopes** (`ON_TAP = 0x40`, `ON_KEY_UP..B = 0x41..0x46` per `#287`), firing cleanly between main loop yields in `useAppStore.ts`!
  - Support new terminal pills (`MATH_ERROR` `🧮÷0`, `TYPE_ERROR`, `STEP_LIMIT`, `STACK_OVERFLOW`) seamlessly inside `MultiRunPipsBar` / `BeatCanvas`.
- **Tests (Phase 3):**
  - Unit tests in `tests/beatEnvironment.test.ts` & `tests/variables.test.ts` for `1..16` pitches, silent OOB rest & silent OOB pixel no-ops, `$cursorX`/`$cursorY`/`$beatIndex`/`$pointer*`/`$randomColor`, `keyHeld` `0x2E`, and `ENV_VERSION_BEAT = 2` `PLAY_NOTE` duration/var round-trip.

### Phase 4: `tape → anim → sort` (`W×H` Matrix, Frame Batching & `STAMP_FROM_TAPE`)

- **Dynamic Matrix Sizes (`8×8`, `16×16`, `32×32`) (`types.ts`, `BeatCanvas.tsx`, `pwaStateRestoreService.ts`, `mapThumbnailGenerator.ts`):**
  - Parameterize `BeatState.width` & `BeatState.height` (`8 | 16 | 32`, fixed `8×8` in core `seq`–`tape`/`args`/`rec`/`conc`, selectable preset in `inter`/`anim` & Sandbox).
  - Scale `BeatCanvas.tsx` LED cell spacing, `VariationCardsPanel.tsx` mini SVG grid, and `renderBeatMapSvg` (`mapThumbnailGenerator.ts`) proportionally from `width × height` using square CSS/SVG viewBoxes so `32×32` fits cleanly on `375×667` phones and `1280×800` desktops.
  - Update `sanitizeBeatState` (`pwaStateRestoreService.ts:350–409`) to validate & preserve `width × height` (`8 | 16 | 32`) grids safely on reload.
- **Explicit Hardware Display-Buffer Loops (`anim`):**
  - Preserve explicit `SET_BEAT_DELAY [0]` → `Loop` → `CLEAR_LEDS` first → draw frame → `WAIT_BEAT` pacing in `useAppStore.ts` (`runBeatExecutionLoop`), plus `1/8×` (`0.125`) delay option in `BEAT_DELAY_PARAM_DEF` / `BeatDelayVisual` (preserving all existing `0, ¼×..4×` glyphs) for smooth 8fps/16fps `anim` flipbook matrices.
- **`STAMP_FROM_TAPE` (`📼→🟦`, `OP_EXT = 0x0F`, `extOpcode = 0x20`):**
  - `src/simulations/beat/beatEnvironment.tsx` & `src/store/useAppStore.ts`: Execute `STAMP_FROM_TAPE` in 1 tick reading `width × height` cells from shared `TapeState` (`headPos .. headPos + width*height - 1` row-major `(1,1)..(W,H)`, leaving `headPos` unchanged):
    - **`color` cell:** Paints target `(x, y)` with `resolvePaintLedCell(color)` (`Black` clears cell to `null`; `White` & colors light cell);
    - **empty (`∅` / `null`) cell:** **Transparent** — leaves existing LED untouched;
    - **numeric cell:** Stops execution with `status = 'TYPE_ERROR'` (`🎨≠#`);
    - **`headPos + width * height - 1 > $tapeLength`:** Stops execution with `status = 'COLLISION'` (`💥`).
  - `src/engine/serialization/{types.ts, codeScopes.ts, codeSerializer.ts, env/beatSerializer.ts, profileSerializer.ts}`:
    - Encode/decode via universal **`OP_EXT = 0x0F`** + `extOpcode = 0x20` (`EXT_BEAT_STAMP_FROM_TAPE`, `envId = 0x03`, per `#287`).
    - Bump **`ENV_VERSION_BEAT_V2 = 2`** when `width !== 8`, `height !== 8`, `STAMP_FROM_TAPE`, `PLAY_NOTE` v2 features, or Beat Sandbox Sparse Tape is non-empty (keeping pure classic `8×8` programs on `ENV_VERSION_BEAT = 1` with 0-byte env state!).
    - Add `'STAMP_FROM_TAPE'` to `BEAT_EXCLUSIVE_BLOCKS` in `profileSerializer.ts:85–103`.
  - Mount platform `TapeDock` (`Top Dock`, `shrink-0`) cleanly above `BeatCanvas` in `tape` / Sandbox when Tape is enabled.
- **Tests (Phase 4):**
  - Binary round-trip (`ENV_VERSION_BEAT = 1` backward-compat vs `ENV_VERSION_BEAT = 2` `16×16`/`32×32` + `STAMP_FROM_TAPE` + sparse tape) in `tests/codeSerializer.test.ts` & `tests/beatEnvironment.test.ts`; sprite transparency, `Black` clear, `TYPE_ERROR`, and out-of-bounds `COLLISION` unit + E2E layout tests (`375×667` `32×32` responsive check).

### Phase 5: `args → rec → conc / fp` (Arguments, Recursion, Multi-Track Bands & Functional Remix)

- **`args` & `rec` Integration (`interpreter.ts`, `SimulationTopLeftHud.tsx`):**
  - Bind shape sockets (`●/▲/■` `0xC0..0xC2`) cleanly into `PLAY_NOTE`, `LIGHT_ROW`/`COL`/`PIXEL`, `SET_LED_COLOR`, `WAIT_BEAT`, and `LOOP_START` so kids parameterize musical phrases (transpose pitch `●+2`, chord helper `F1(root, beat)`) and `rec` recursive visual/rhythm fills (`MAX_CALL_STACK_DEPTH = 64` per `#287`, `STACK_OVERFLOW` `📚💥` safe stop).
  - Render `CallStack` depth badges inside `SimulationTopLeftHud` cleanly below `BeatCanvas`'s Canvas Header Row.
- **`conc` Multi-Track Bands & Barriers (`useAppStore.ts`, `interpreter.ts`, `beatSynth.ts`, `BeatCanvas.tsx`):**
  - Primary onboarding world for Concurrency: `Main 1..4` (`0x00..0x03`) tabs + **`FORK` / `JOIN` (`0x03` / `0x04`)** + **`SYNC_BARRIER` (`🚧`, `0x01`)** + **`SEND` / `$recv` (`0x02`)** + **`LOCK` / `UNLOCK` (`0x05` / `0x06`)** per `#287`.
  - Multi-track `Main 1` (Drums) & `Main 2` (Melody / LED Show) advance synchronously against the shared `BeatState` + global `beatIndex` clock; shared LED frame writes layer smoothly within each tick, while Master `DynamicsCompressorNode` + per-beat voice cap prevent audio overload.
  - Deadlock cycle detection surfaces `'DEADLOCK'` (`🔒💥`) cleanly in Top-Center Pill + `MultiRunPipsBar`.
- **`fp` Side Module (`0` New Beat Blocks):**
  - Reuse universal `RETURN` (`0x07`) and `CALL_PARAM_FN` (`0x08` / `F1([Fn])` in `StackFrame.fnBindings`) directly over Beat `PLAY_NOTE` / `LIGHT_*` scopes (`0` Beat-specific changes needed).
- **Tests (Phase 5):**
  - Multi-track `Main 1` + `Main 2` + `SYNC_BARRIER` alignment & polyphonic chord voice-cap test, `FORK`/`JOIN` Beat phrase overlap test, recursive call-stack overflow guard (`64`), and multi-`Main` `ENV_ID_LESSON = 0x04` / `ENV_VERSION_BEAT = 2` serialization round-trip.

---

## 5. Shared-File Coordination

Per `@platform` `#287`, shared files touched across Phases 1–5 are coordinated cleanly with `@platform` and sibling environments (`Robot Grid`, `Turtle LOGO`, `Switchyard`, `Depot`) so Beat adds zero duplicate state or competing HUDs:

| Shared File | Phase(s) | Beat Dependency / Change | Coordinated Owner |
| :--- | :---: | :--- | :--- |
| `src/App.tsx` | P1, P4, P5 | Unified `Top Dock -> Canvas Wrapper -> Bottom Dock` + `SimulationTopLeftHud` clearance below `BeatCanvas` header; mount `TapeDock` / `SceneInputBar` / `VirtualDPad`. | `@platform` |
| `src/utils/curriculumStagePolicy.ts` | P1, P2 | Reuse `allowedSimBlocks` / `allowedBlockParams` to gate `tool-beat-active-color`; keep `isInstantSpeedDisabled` (`beat -> true`). | `@platform` / `env-beat` |
| `src/components/VariationCardsPanel.tsx` | P1, P4 | Dynamic `width×height` SVG preview scaling; keep `variation-beat-cursor` as ring border only (mini directional arrow declined as too small); guard off/black `#0f172a` cells. | `env-beat` + `@env-logo` |
| `src/services/mapThumbnailGenerator.ts` | P1, P4 | Treat `#0f172a`/`#000000` as unlit off-pad in `renderBeatMapSvg` (`P1`); directional cursor parity & `8/16/32` dynamic scaling (`P4`). | `env-beat` |
| `src/services/pwaStateRestoreService.ts` | P1, P4 | Normalize `#0f172a`/`#000000` -> `null` (`P1`); `sanitizeBeatState` dynamic `width`/`height` (`8 \| 16 \| 32`) + queue fields (`P4`). | `env-beat` |
| `src/engine/serialization/profileSerializer.ts` | P1, P4 | Add `'SET_BEAT_DELAY'` (P1) and `'STAMP_FROM_TAPE'` (P4) to `BEAT_EXCLUSIVE_BLOCKS`. | `@platform` |
| `src/engine/serialization/conditionSerializer.ts` & `ConditionBadge.tsx` | P2, P3 | Add Beat `cursorAtEdge` (`0x2A`), shared `keyHeld` (`0x2E`), and `0x30 CMP`. | `@platform` / `env-beat` |
| `src/components/params/BlockParamBadge.tsx`, `ParamSelectionPopover.tsx` & `VisualParamBadges.tsx` | P1 | Wrap `SET_LED_COLOR` `#0f172a` with recessed LED-Off + `⊘` Erase cue (`P1`, keeping symbol-free `ColorVisual` core DOM & Turtle Black ink intact). | `@platform` / `env-beat` |
| `src/components/BlockSubpalette.tsx` & `ParamSelectionPopover.tsx` | P3 | Fix `BlockSubpalette.tsx:69–71` sensor filter to include `currentSimEnv.sensors`; expose `$cursorX/Y`, `$beatIndex`, `$pointer*`, `$randomColor`, `🎲`, `$input`. | `@platform` |
| `src/types/index.ts`, `src/engine/interpreter.ts`, `src/store/useAppStore.ts` | P3–P5 | `TypedValue` `color`, `SimulationStatus` (`TYPE_ERROR`, `MATH_ERROR`, `STACK_OVERFLOW`, `STEP_LIMIT`, `DEADLOCK`), `TapeState`, `args` sockets, `rec` depth `64`, `conc` fibers & queued events. | `@platform` |
| `src/engine/serialization/{types.ts, codeScopes.ts, codeSerializer.ts, env/beatSerializer.ts}` | P1–P5 | `OP_EXT = 0x0F` (`0x20 EXT_BEAT_STAMP_FROM_TAPE`), `ENV_VERSION_BEAT_V2 = 2` (`W×H`, `PLAY_NOTE` v2 dur/var, tape), `SENSOR_REF_FLAG` `0xB0..0xB2`, scopes `0x00..0x03` / `0x40..0x46`. | `@platform` / `env-beat` |
