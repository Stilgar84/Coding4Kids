# 🤖 Robot Grid v2 Implementation Plan (`specs/v2/env_robot_plan.md`)

> **Status:** Stage 2 Authoritative Environment Plan (`env-robot`), aligned with Round B shared platform & binary reconciliations (`#287`), [`docs/envs/robot_grid.md`](../../docs/envs/robot_grid.md), [`docs/ui_guidelines.md`](../../docs/ui_guidelines.md), [`docs/platform_requirements.md`](../../docs/platform_requirements.md), and [`docs/binary_format.md`](../../docs/binary_format.md).  
> **Scope:** Covers **Robot Grid (`ENV_ID_GRID = 0x01`)** across Core Modules `seq`–`cmp`, `tape` (`tape.9`), `args`, `rec`, and Side Modules `conc` / `fp`. For shared interpreter, `ConditionSubpalette`, `TapeDock`, and `OP_EXT` infrastructure, see `specs/v2/platform_plan.md` & `specs/v2/master_roadmap_and_shared_files.md`.

---

## 1. Current `src/` Baseline & Keep-vs-Replace Audit Matrix

A direct audit of `src/` shows a mature Robot Grid v1–v3 runtime and visual stack already in place. **Do not discard and rewrite working Grid layers**; instead preserve the clean core while closing specific usability bugs, Stage 1 fixes, and v4 extensions:

| Component / Module | Path (`src/`) | Verdict | Current State & Required Delta |
| :--- | :--- | :---: | :--- |
| **Grid Core Simulation** | `src/simulations/grid/gridEnvironment.tsx` | **Keep & Enhance** | Keeps refined SVG palette icons (`MoveFwd`, `MoveBack`, `TurnLeft`, `TurnRight`, `PickUpIcon`, `UseDropIcon`) & `evaluateCompletion`. Fix end-of-program `'SUCCESS'` gating (`executeAction` must not trigger mid-loop `isSuccess`), expose `$tileDial`/`$x`/`$y`/`$heading`, wire `OP_EXT` (`CALL_PARAM_FN` for `fp`; block `FORK`/`JOIN`). |
| **Grid Physics** | `src/engine/physics.ts` | **Keep & Fix** | Keeps `executeRobotAction`, `hasWallBetween`, `isUnbridgedWater`, `resetGridInteractiveState`. Fix 4 verified gaps: (1) `order === 0` unordered flag guard in `isFlagPadlocked` (`L367`); (2) `syncWorldSwitchesAndGates` momentary `robotPos` (`hasCrateOnTile \|\| hasRobotOnTile`); (3) 1-ahead bridged Plank retrieve in `PICK_UP`; (4) `'relic'` handling in `USE_DROP`. |
| **Grid Sensors** | `src/simulations/grid/sensors.ts` | **Keep & Enhance** | Keeps `isCellWalkable`, `BEACON_COLOR_PALETTE_INDEX`, `evaluateGridSensor`. Add 1-ahead Plank check in `itemHere`, implement `unvisitedAhead` (`COND_TAG = 0x08` w/ seeded `visited[(initialX, initialY)]`), add partner-bot occupancy check to `isCellWalkable` (`conc`). |
| **Grid Canvas** | `src/components/GridCanvas.tsx` | **Keep & Enhance** | Keeps 72px SVG board, checkerboard, barrier toggles, `GridOverlayLayer`, fit/trace controls, and `<g data-testid="robot">`. **Remove `BackpackHud`** (`L549`), add upper-right shoulder-gripper carry + animations directly inside `<g data-testid="robot">`, add directional scan arcs, team footprints, multi-bot render loop (`robots[]`), above-robot wait bubbles (`⏳`), Top-Center `STEP_LIMIT`/`STACK_OVERFLOW`/`MATH_ERROR`/`DEADLOCK` pills, and Top-Right `⏱️` tick readout. |
| **World Items Layer** | `src/simulations/grid/components/WorldItemsLayer.tsx` | **Keep Artwork / Retire HUD** | **Retire & remove `BackpackHud`** (`L780–882`). Keep SVG Key (`Amber ●`/`Emerald ▲`/`Purple ◆`), Plank bridge/water, Floor Switch, and Portcullis Gate graphics + `detectWorldItemTransition`; add `'relic'` crystal, Cave Entrance Pedestal, floor circuit traces (switch → gate), and grab/deploy/key-dissolve/drop animations. |
| **Ordered Waypoints Overlay** | `src/simulations/grid/components/FlagPadlockOverlay.tsx` | **Replace Visuals** | Keep `detectPadlockTransition` event flow while **replacing all closed/opening SVG `🔒` padlocks (`L334–407`)** with 3-state pennants, dashed sequence chains (`1 ⋯▶ 2` for `order > 0`), gentle non-crashing wiggle + prerequisite pulse on early step, and shuttered `🏁 k/N` Goal barrier. |
| **Thumbnail Generator** | `src/services/mapThumbnailGenerator.ts` | **Targeted Replace** | Update `renderGridMapSvg` (`L321–355`) to emit `1 ⋯▶ 2` chains & shuttered `🏁` cues instead of SVG padlocks, plus Relic/Pedestal and multi-bot markers. |
| **Beacons, Dials, Layers, Ghosts, Toolbar** | `src/simulations/grid/components/{BeaconAndDialLayer, GridOverlayLayer, GhostStepOverlay, GridToolbarTools}.tsx` | **Keep & Extend** | Keep clean SVG beacons (`●▲■◆`), rotary dials (`1..20`), stack badges (`×N`), slot isolation, ghost robot, and toolbar. Add dial-read scan/fly animation trigger, `Relic` / `Entrance Pedestal` / `order = 0` flag / Sandbox extra-bot (`1..3`) authoring in `GridToolbarTools`. |
| **Spotlights** | `src/simulations/grid/components/{SensorAndBranchSpotlight, DemoSpotlightOverlay}.tsx`, `src/components/VariableAndDialSpotlight.tsx` | **Enhance** | Update `DemoSpotlightOverlay.tsx` (`hasBackpack` `L271–287, 527`) from corner `🎒` box to shoulder-claw highlight. Complete `SensorBeamGridOverlay` (`pathLeft`, `pathRight`, `tileColor`, `unvisitedAhead`, water/gate in `pathAhead`, 1-ahead Plank `itemHere`). Add target-aware `$tileDial` fly arc to `VARS` / `F1(●)` / `Send` / `cmp`. |
| **Grid Binary Serializer** | `src/engine/serialization/env/gridSerializer.ts` | **Keep & Extend V4** | Preserves `ENV_VERSION_GRID` V1/V2/V3 byte-for-byte. Add `ENV_VERSION_GRID_V4 = 4` (`typeIdx = 3` `'relic'`, Entrance Pedestals, `extraRobots[]`). Verify `order = 0` roundtrip. |

### Verified Live Bugs Caught in Round A (`src/`)
1. **End-of-Program vs. Mid-Loop `'SUCCESS'` (`interpreter.ts:961` + `physics.ts:1010`):** Currently `executeRobotAction` sets `isSuccess = goalEval.isSuccess` mid-program and `tickInterpreter` halts immediately (`isDone = actionRes.isSuccess`), breaking `While (NOT atGoal)` loops and overshoot checks.
2. **Color Index Mismatch on Yellow Beacons (`conditionSerializer.ts:127–146`):** `PALETTE_COLOR_NAMES[4]` is `'amber'`, while Grid `BeaconTile.color` uses `'yellow'` (`BEACON_COLOR_LIST[3]`, `sensors.ts` index `4`). `tileColor == 'yellow'` round-trips to `colorIdx = 0` (`'black'`). Fixed via `@platform` `#287` alias `'yellow' = 'amber' @ 4`.
3. **Floor Switch Missing Robot Presence (`physics.ts:163–201`):** `syncWorldSwitchesAndGates` only inspects floor Crates (`it.type === 'crate'`), ignoring a Robot standing directly on a Floor Switch (`param.7`, `conc.5`).
4. **Mixed `order = 0` Flag Padlock Guard (`physics.ts:367`):** `other.order < flag.order` assumes non-zero orders; explicitly guard so `order === 0` flags are never padlocked and never block `order > 0` chains.
5. **`itemHere` Missing 1-Ahead Plank (`sensors.ts` & `SensorAndBranchSpotlight.tsx`):** Checks current cell only; ignores retrievable bridged planks 1 cell ahead.
6. **`unvisitedAhead` Unimplemented (`sensors.ts`, `GridCanvas.tsx`):** Tag `0x08` exists in `conditionSerializer.ts`, but runtime sensor + auto-trace footprints + initial `(initialX, initialY)` visited seed do not.
7. **Collapsed Failure Statuses (`interpreter.ts:318,419`, `simulationRunner.ts:108`, `MultiRunPipsBar.tsx:69`, `constraintSolver.ts:684`):** Step cap and stack depth collapse to `'COLLISION'` instead of `'STEP_LIMIT'`, `'STACK_OVERFLOW'`, `'MATH_ERROR'`, `'DEADLOCK'`.

---

## 2. UI, Icon Preservation & Optional Improvements

### Preserved Refined Icons & Assets (Untouched by Default)
- **Palette & Block Action SVGs:** `MoveFwd`, `MoveBack`, `TurnLeft`, `TurnRight`, `PickUpIcon`, `UseDropIcon` (`gridEnvironment.tsx`), plus repeat badges (`BlockItem.tsx`) and `VisualParamBadges.tsx`.
- **World Item & Tile SVGs:** `KEY_GATE_VISUALS` (`Amber ●`, `Emerald ▲`, `Purple ◆`), Planks, Crates, Water ripples, Floor Switches, Portcullis Gates (`WorldItemsLayer.tsx`), Beacons (`Red ●`, `Blue ▲`, `Green ■`, `Yellow ◆`), rotary Floor Dials (`BeaconAndDialLayer.tsx`).

### Mandatory Approved UI & Icon Fixes (From Stage 1 & `@platform` `#287`)
1. **Global `BackpackHud` (`🎒`) Retirement:** Remove `BackpackHud` from `SimulationTopLeftHud` (`GridCanvas.tsx:549`) and `DemoSpotlightOverlay.tsx:271–287`; render held Key/Plank/Crate/Relic directly on the robot's upper-right shoulder claw inside `<g data-testid="robot">`. Keep `SimulationTopLeftHud` clean (`VARS`, later `CallStack`).
2. **`ConditionBadge.tsx:80` (`carryingItem`):** Replace `🎒` with a compact **robotic claw holding item** badge matching `PICK_UP`/`USE_DROP` & on-robot carry.
3. **Zero `🔒` on Waypoints & Goals (`ui_guidelines.md §4`):** Remove all closed/opening SVG padlocks from `FlagPadlockOverlay.tsx` and `mapThumbnailGenerator.ts`; render `1 ⋯▶ 2` chains and shuttered `🏁 k/N` progress barriers, keeping `🔒` strictly for `conc` Mutex locks.

### User-Approved Additional Icon Improvements *(Approved via User Review)*
1. **Unify `$tileDial` Rotary Gauge Icon (`BlockItem.tsx:761,786`, `BlockSubpalette.tsx:64,78,109`, `gridEnvironment.tsx:241`, `VariableAndDialSpotlight.tsx:167` — Phase 3):** Replace the conflicting `'🎯 Dial'` (contains English `"Dial"` + target emoji), `'🔢'`, and `'🎛️'` visuals with one zero-reading **circular rotary gauge SVG/icon** matching `BeaconAndDialLayer`'s on-grid dial bezel (`One Icon = One Meaning`).
2. **Swap `grid-readonly-badge` Off `🔒` (`GridCanvas.tsx:615` — Phase 1):** Replace `lucide-react` `Lock` (`🔒`) on Curriculum/Read-Only map badges with `🛡️` or `👁️` so `🔒` stays `100%` exclusive to `conc` Mutexes (`ui_guidelines.md §4`).
3. **Align `ConditionBadge.tsx` (`itemHere`) Away from `💎` (`Phase 2`):** Switch `itemHere` from `💎` to a clean floor sparkle/box emblem so it aligns with Keys/Planks/Crates and does not collide with `💎 Relic` (`typeIdx = 3`) in Phase 5.

---

## 3. Progressive 5-Phase Implementation Plan

### Phase 1: Spatial Clarity, Direct On-Robot Carry & Waypoint Polish (`seq`, `param`, `loop`, `func`)
- **Goals:** Fix `seq`–`func` usability before adding new sensors/modules; ship direct shoulder-gripper carrying, shuttered waypoints/Goal barriers, momentary floor switches, and end-of-program Goal evaluation.
- **Owned Grid Changes:**
  - `src/simulations/grid/components/WorldItemsLayer.tsx`: Delete `BackpackHud` (`L780–882`). Add floor circuit trace line SVG from each `FloorSwitch` to its `linkedGateIdx` (lit `#22d3ee`/`#10b981` when pressed). Add pick/drop/key-unlock/plank-splash animations & `strictInteractionCollision` / soft-shake triggers anchored on target tile or robot shoulder.
  - `src/components/GridCanvas.tsx`: Remove `<BackpackHud grid={grid} stacked />` (`L549`), and swap `grid-readonly-badge` (`L615`) from `Lock` (`🔒`) to `🛡️`/`👁️`. Inside `<g data-testid="robot">`, add upper-right shoulder cradle (`transform="translate(15, -16)"` in screen-upright `0°` counter-rotated against chassis angle!) with robotic pincers, `2px` `#0f172a` outline halo, and Item mini-SVG (`Key`/`Plank`/`Crate`), keeping front visor/eyes + triangle (`0,-16 7,-3 -7,-3`) and center floor tile unobstructed across `N/E/S/W`. Add 1-cell-ahead bridged Plank retrieval arm reach animation, hands-full shake on shoulder item, wrong-key bow/keyhole flash, and subtle backward tread dust on `MOVE_BACK` (`seq.3`).
  - `src/simulations/grid/components/FlagPadlockOverlay.tsx`: Replace `🔒` padlocks (`L334–407`) with: (a) **Gated future flag** = desaturated shuttered pennant + dashed circle + dashed `1 ⋯▶ 2` connector chain (`order > 0`, omitted for `order === 0`); (b) **Early step no-op** = gentle shutter wiggle + pulse highlight on prerequisite flag; (c) **Gated Goal** = sliding shutter barrier + `[🏁 k/N]` pill (`loop.A` `0/8`).
  - `src/simulations/grid/components/DemoSpotlightOverlay.tsx`: Update `hasBackpack` (`L271–287, 527`) to highlight the robot's shoulder gripper rather than a corner `🎒` chip.
  - `src/engine/physics.ts`: Guard `isFlagPadlocked` (`order === 0` never locks/blocks); add optional `robotPos` to `syncWorldSwitchesAndGates` (`hasCrateOnTile || hasRobotOnTile` for `param.7`) and call on `MOVE_FWD`/`MOVE_BACK` + reset; allow `PICK_UP` facing a 1-ahead bridged water cell to lift that Plank into `carriedItem`; enforce max 1 pickup item per tile.
  - `src/simulations/grid/gridEnvironment.tsx`: Defer `'SUCCESS'` to `evaluateCompletion` at program termination (`executeAction` returns `isSuccess: false` while setting collected flags, preserving clean end-of-program Goal evaluation).
- **Shared-File Coordination (`@platform` `#287`):**
  - `src/services/mapThumbnailGenerator.ts` (`L321–355`): Replace SVG padlock rings with dashed `1 ⋯▶ 2` / shuttered `🏁` cues.
  - Update any existing `BackpackHud` / mid-loop `isSuccess` unit expectations in `worldItemsAndGridV2.test.ts` / `orderedWaypoints.test.ts` / `module1Robot.test.ts`.
- **Verification:** `npm run test:unit` (`orderedWaypoints`, `worldItemsAndGridV2`, `module1Robot`, `module2Objects`, `module3LoopsPart1`, `module4Puzzles`), `npm run build`, and Playwright `curriculumM1M3.spec.ts` / `curriculumWave1.spec.ts` (`BypassSandbox: true`).

---

### Phase 2: Directional Sensors, `unvisitedAhead` Prep & Branch/While (`branch`, `while`)
- **Goals:** Complete all Grid boolean sensors, directional scan arcs, 1-ahead Plank `itemHere`, `tileColor` beacon matching, and multi-variant failure spotlighting (`branch`, `while`).
- **Owned Grid Changes:**
  - `src/simulations/grid/sensors.ts`: Extend `itemHere` to detect a retrievable bridged Plank 1 cell ahead; keep `atGoal` evaluating full Goal readiness (or aligned with active Goal preconditions); prepare `unvisitedAhead` helper (`visitedCells` lookup + `(initialX, initialY)` seed).
  - `src/components/GridCanvas.tsx` & `src/simulations/grid/components/SensorAndBranchSpotlight.tsx`: Render directional scan beams (`pathAhead` visor green `✓` / red wall-bumper `✕`, `pathLeft` left ear, `pathRight` right ear), forward sparkle scan onto 1-ahead Plank when `itemHere` hits, beacon color+shape match ring for `tileColor`, and full `SensorBeamGridOverlay` coverage for all 8 Grid sensors + water/gate checks. Add optional tread footprint layer driven by `Trace` toggle or `unvisitedAhead` presence.
- **Shared-File Coordination (`@platform` `#287`):**
  - `src/components/ConditionBadge.tsx`: Update `L80` (`carryingItem`) from `🎒` to claw-holding-item badge, switch `itemHere` from `💎` to a clean floor sparkle/box emblem (preventing future collision with `💎 Relic` in Phase 5), and add `unvisitedAhead` footprint preview badge.
  - `src/engine/serialization/conditionSerializer.ts` (`L127–146`): Alias `'yellow'` ↔ index `4` (`'amber'`) in `PALETTE_COLOR_NAMES` / `colorNameToIdx` so `tileColor == 'yellow'` round-trips cleanly.
  - `src/components/BlockSubpalette.tsx` & `src/engine/verification/constraintSolver.ts`: Consume `@platform` `<ConditionSubpalette>` and update solver awareness of end-of-program Goal evaluation + `branch.7` 1-item/decoy rules.
- **Verification:** `npm run test:unit` (`conditionalsAndWhile`, `gridV3AndSensors`, `module5Demos`, `constraintSolverM4M6`), `npm run build`, and Playwright `curriculumWave2.spec.ts` (`BypassSandbox: true`).

---

### Phase 3: Typed Variables, `0x30 CMP` & `$tileDial` Fly Animations (`var`, `cmp`, `inter`)
- **Goals:** Make Rotary Floor Dials visually unmistakable and animate target-aware reads (`VARS`, `CMP`, sockets) while adopting shared `'STEP_LIMIT'` / `'MATH_ERROR'` / `'STACK_OVERFLOW'` failure pills.
- **Owned Grid Changes:**
  - `src/simulations/grid/components/BeaconAndDialLayer.tsx` & `src/components/GridCanvas.tsx`: Enhance circular rotary Floor Dial pulse rings (`1..20`); render curved glowing numeral arc from active dial tile into `SimulationTopLeftHud` (`a = tileDial`) or crisp floating numeral pop + target beam (`cmp`, socket, `Send`), plus muted `0` ring when read on an empty tile.
  - `src/simulations/grid/components/GridToolbarTools.tsx`: Clean dial (`1..20`) + `count > 1` Supply Stack (`×N`) authoring controls for creative/sandbox maps.
  - `src/simulations/grid/gridEnvironment.tsx`: Confirm `$tileDial`, `$x`, `$y`, `$heading` numeric `readSensor` support alongside `ConditionExpr` `0x30 CMP` (`< <= > >= == !=` in `cmp.2`, `cmp.B`, `cmp.M1`).
- **Shared-File Coordination (`@platform` `#287`):**
  - `src/types/index.ts`, `src/engine/interpreter.ts` (`L318, L419`), `src/engine/simulationRunner.ts` (`L108`), `src/store/useAppStore.ts`, `src/components/MultiRunPipsBar.tsx`: Adopt unified terminal statuses (`'STEP_LIMIT'` `⏳🔁`, `'MATH_ERROR'` `🧮÷0`, `'STACK_OVERFLOW'` `📚💥`) and display them in `GridCanvas` Top-Center Pill + `MultiRunPipsBar` (`[2 ✗]`).
  - `src/engine/serialization/conditionSerializer.ts`, `src/components/BlockSubpalette.tsx`, `src/components/BlockItem.tsx`: Wire `0x30 CMP` binary & UI picker (`currentSimEnv.sensors` fix), and apply the user-approved `$tileDial` circular rotary gauge icon unification across `BlockItem.tsx:761,786`, `BlockSubpalette.tsx:64,78,109`, `gridEnvironment.tsx:241`, and `VariableAndDialSpotlight.tsx:167`.
- **Verification:** `npm run test:unit` (`variables`, `variablesAndMasteryUi`, `module6CreativeAndDemo`, `instantMode`), `npm run build`, and Playwright `curriculumWave3.spec.ts` (`BypassSandbox: true`).

---

### Phase 4: Sparse Memory Tape Integration (`tape`, `anim`, `sort`)
- **Goals:** Connect `tape.9` (Fencepost `TAPE_STEP` Fix-It) cleanly inside Robot Grid without polluting `GridState` binary streams or prematurely exposing `unvisitedAhead`.
- **Owned Grid Changes:**
  - `src/components/GridCanvas.tsx` & `src/simulations/grid/gridEnvironment.tsx`: Ensure `GridCanvas` renders smoothly inside `@platform`'s shared `[Top Dock (TapeDock) shrink-0] → [Viewport flex-1 min-h-0] → [Bottom Dock shrink-0]` flex frame with `>= 48px` top HUD clearance. On `tape.9` `TAPE_STEP` out-of-bounds crash, highlight `'COLLISION'` without breaking Flag / `tileColor` beacon visual telemetry. Keep `unvisitedAhead` excluded via `CurriculumActivity.palette` until Phase 5 (`rec.6`).
- **Shared-File Coordination (`@platform` `#287`):**
  - Sparse `TapeState` (`M[1..N]`), `OP_TAPE_*` (`0x0C..0x0E`), and windowed `TapeDock` remain platform-owned in `useAppStore.ts` / `App.tsx` / `interpreter.ts` — **zero custom Tape fields inside `GridState`**.
- **Verification:** `npm run test:unit` (`codeSerializer`, `stagedPaletteAndSlots`), `npm run build`, tape-grid headless Fix-It verification.

---

### Phase 5: Relics, Recursion (`rec`), Socket Arguments (`args`), `conc` Team Robots & `ENV_VERSION_GRID_V4` (`args`, `rec`, `conc`, `fp`)
- **Goals:** Ship `ENV_VERSION_GRID_V4 = 4` (Relics + Entrance Pedestals + `extraRobots[]`), `unvisitedAhead` cave exploration, recursive CallStack feedback, `1:1` multi-robot scheduling/collisions/wait bubbles/`🔒💥` deadlock, and `fp` indirect `[Fn]` pass-through.
- **Binary Schema (`ENV_VERSION_GRID_V4 = 4` in `src/engine/serialization/env/gridSerializer.ts` & `docs/binary_format.md`):**
  1. **Zero Regression (`envVersion = 1..3`):** Emit byte-identical `V1`/`V2`/`V3` whenever `worldItems` contains no `'relic'`, `entrancePads` is empty, and `extraRobots` is empty.
  2. **World Item `typeIdx = 3` (`0b11`) = `'relic'`:** Uses already-allocated 2-bit `typeIdx` (`attrByte & 0x03`) with zero bit-width growth.
  3. **V4 Extension Block (immediately after V3 block):**
     - `v4Flags: uint8` (`0x01 = hasEntrancePads`, `0x02 = hasExtraRobots`, `0xFC = 0`).
     - If `hasEntrancePads`: `padCount: VLE` × `Coord` (Entrance Pedestal drop/return targets).
     - If `hasExtraRobots`: `extraBotCount: VLE` (`Bot 2..N`; Bot 1 reuses V1 `robotPose`), each = `coord: Coord`, `dir: uint8 (0..3)`, `botMeta: uint8` (`bits 1..0 = scopeIdx 1..3 -> Main 2..4`, `bits 4..2 = shape/colorIdx`).
- **Owned Grid Changes:**
  - `src/simulations/grid/components/WorldItemsLayer.tsx` & `GridToolbarTools.tsx`: Add `'relic'` crystal SVG + hollow-crystal Entrance Pedestal ring (`rec.A`, `rec.M1`, `conc`) + Sandbox authoring toggles (`Relic`, `Entrance Pad`, `Order = 0` flag, `Bot 2/3` spawn markers).
  - `src/simulations/grid/sensors.ts`: Activate `unvisitedAhead` (`COND_TAG = 0x08`) using `grid.visitedCells` seeded with `(robot.initialX, robot.initialY)` (and all `robots[]` initial tiles in `conc`); auto-show permanent team-tinted tread footprints on `GridCanvas.tsx` (respecting `Trace` toggle).
  - `src/engine/physics.ts`: Add `'relic'` drop/placement on Entrance Pedestal (`USE_DROP`); add multi-robot lockstep resolver (`resolveMultiRobotGridTick`) enforcing same-tile collision, head-on swap (`A: u→v, B: v→u`), simultaneous `PICK_UP` / water `USE_DROP`, switch-release races, **allowing stepping into simultaneously vacated tiles**, and marking partner-occupied tiles `false` in `isCellWalkable` (`pathAhead/Left/Right`).
  - `src/components/GridCanvas.tsx`: Render `grid.robots[]` (`Bot 1 🔴` ●, `Bot 2 🔵` ▲, `Bot 3 🟢` ■ with crisp number badge `1/2/3`, per-bot shoulder carry, per-bot trace color), localized `💥` collision burst, floating above-robot wait bubbles (`⏳🚧`, `⏳📬`, `⏳🔒`), Top-Center `'DEADLOCK'` (`🔒💥`) pill + pulsing cycle ring, Top-Right `⏱️` Wall-Clock Tick counter, and `SimulationTopLeftHud` `callStackSlot` depth badges (`rec`).
- **Shared-File Coordination (`@platform` `#287`):**
  - `src/types/index.ts`, `src/engine/interpreter.ts`, `src/store/useAppStore.ts`, `src/engine/serialization/{types, codeSerializer, profileSerializer}.ts`: Coordinate `Main 1..3` (`SCOPE_ID = 0x00..0x02`), Grid policy blocking `🔀 Fork` / `🤝 Join` (`OP_EXT 0x03/0x04`), enabling `OP_EXT` (`0x01 SYNC_BARRIER`, `0x02 SEND`, `0x05 LOCK`, `0x06 UNLOCK`, `0x08 CALL_PARAM_FN`), `$tileDial` → `F1(●)` socket evaluation (`StackFrame.args`), recursion depth `64` + `'STACK_OVERFLOW'`, `'DEADLOCK'` all-waiting cycle detector, and `ENV_VERSION_GRID_V4` save/restore tests.
- **Verification:**
  - Unit (`npm run test:unit`): new Grid v4 serializer roundtrip (`relic`, `EntrancePad`, `extraRobots[]`), `order = 0` & cyclic `unvisitedAhead` solver tests, multi-bot lockstep collision/swap/vacated-follow/deadlock/switch-relay unit tests, `npm run build`.
  - E2E (`npm run test:e2e`, `BypassSandbox: true`): Playwright visual checks on shoulder carry (`N/E/S/W`), `1 ⋯▶ 2` & shuttered `🏁 0/8`, `tileDial` fly arc, `conc` dual-bot hold-switch & `'DEADLOCK'` `🔒💥`, and `curriculumWave4.spec.ts` / `mobileLayout.spec.ts`.
