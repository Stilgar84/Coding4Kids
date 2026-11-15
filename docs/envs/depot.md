# 🏗️ Depot Environment Specification

**Depot** (`ENV_ID_DEPOT = 0x07`, `SIM_CODE_DEPOT = 4`, `ENV_VERSION_DEPOT_V4 = 4`) is a side-view toy-crane & container puzzle/sandbox environment introduced in Core Module `loop` of [the curriculum](../curriculum/overview.md) (used across `loop`, `func`, `while`, `cmp`, `tape`, `sort`, `args`, `rec`, and Side Modules `conc` & `fp`). It teaches core data structures (**LIFO stacks**, **FIFO conveyor queues**, and random-access **Memory Tape** sorting/searching) plus **producer–consumer & multi-claw synchronization (`conc`)** through tactile physical metaphors.

*(For cross-environment features—including the shared Sparse Memory Tape blocks/sensors, Typed Variable System, canonical 10-color `PALETTE_COLORS`, `⏱️` Wall-Clock Tick Speedometer, and Concurrency primitives (`OP_EXT = 0x0F`)—see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md); for HUD slot budgeting and zero-reading rules, see [UI Guidelines](../ui_guidelines.md); for binary payload layout, see [Binary Format §4.5 & §7.6](../binary_format.md).)*

---

## 1. Design Philosophy & Kid-Friendly Visual Silhouette

Experiencing all three containers side by side in the Depot teaches **why different data structures exist**:

| Entity | Physical Constraint | What the Learner Discovers |
| :--- | :--- | :--- |
| 🏗️ **Stack** (`1..3` towers) | Open-top acrylic glass chute + center peg; only the top ring/block glows while lower ones are recessed behind diagonal glare lines | "I can only grab the top one — and they come out backwards!" → **LIFO** |
| 📦 **Queue** (U-shaped belt) | Upright 8-slot U-shaped roller conveyor (`∪`): items drop into the Top-Right Entry Funnel (`⬇`), ride around the bottom spoked-roller U-turn, and exit exclusively from the Top-Left Pickup Cradle (`▲`) | "First in line goes out first — and all 8 slots stay visible!" → **FIFO** |
| 📼 **Tape** (`TapeDock` vs. Peg Rail) | Electronic sliding laser heads (`▲1`, `▲2`) in the `Top Dock` jump directly to any cell `1..N`, strictly distinct from optional in-canvas recessed Physical Peg Sockets | "I can jump straight to cell #50 or #500 — and digital copies keep my ring in the claw!" → **Random access & conservation** |

### 1.1 Playful Toy-Crane Workshop Identity
- **Bright Makerspace Aesthetic (Distinct from Switchyard & Robot Grid):** Light blueprint-slate workshop backdrop, warm birch/anodized-aluminum workbench tabletop, brushed metal overhead gantry rail with visible end-bumpers, and chunky articulated toy-crane claw(s).
- **Zero Industrial / Hazard Overlap with Switchyard:** Industrial freight cars, `itemDamaged` (`0x1A`), and `SCRAP` chutes belong exclusively to [🚂 Switchyard](./switchyard.md). Depot items are always intact, solid tactile toy parts (`v4` omits `SCRAP` and `itemDamaged`).
- **Full-Scale On-Claw Cargo (No `BackpackHud` `🎒`):** Held rings, blocks, or tokens render full-size directly inside the physical claw jaws on canvas—so the global `BackpackHud` (`🎒`) is retired cleanly, leaving the Top-Left HUD stack clear for `VARS`, `CallStack`, and `conc` lock badges.
- **Strict Icon Meaning Rule (`One Icon = One Meaning`):** Never place `🔒` padlocks on buried LIFO stack items (use translucent acrylic sleeve framing + 75% muted shading behind diagonal glare instead). `🔒` is reserved strictly for `conc` Mutex Locks, and `🛡️` Crystal Shield frames are reserved strictly for `fp` read-only Tape ranges.

### 1.2 Four Distinct Item Visual Forms
Every item uses canonical 10-color `PALETTE_COLORS` (`0..9`: `black`, `red`, `blue`, `green`, `amber`/`yellow`, `purple`, `pink`, `cyan`, `orange`, `white`, with crisp outer borders on `black`/`white` and inner bevel notches for color-vision accessibility):

| Visual Mode | Active When | Rendering & Pedagogy |
| :--- | :--- | :--- |
| **Uniform Color Rings** | `loop`, `func`, `while`, `tape` (neutral grey-white tally units in `tape.A`) | Glossy beveled rings/discs without numeric labels so 5–7yo learners match colors cleanly (`heldColor`, `topColor`) |
| **Numbered Toy Blocks** | `enforceHanoiRule = false` & numeric `value` set (`cmp.6–8`, `sort.2–5`, `sort.A–B`, `sort.M3`, `args.9`, `args.M1`) | **Uniform-width** beveled blocks with centered bold tabular numerals (`[1]..[99]`), making temporary `[9]`-on-`[4]` stacking look physically natural during sorting/swaps |
| **Proportional-Width Hanoi Discs** | `enforceHanoiRule = true` (`rec.8`, `rec.M2`) | **Proportional-width** beveled discs threaded onto center stack pegs; horizontal width scales monotonically with `$value`, making `$heldValue > $topValue` self-explanatory |
| **Verdict Tokens (`🎫`)** | Decision-gate puzzles (`sort.0–1`, `args.M3`) | Rounded star-stamped Verdict Token (`hasItem = 1`, no color/number value) grabbed from `INPUT` and routed to `✅ ACCEPT` or `❌ REJECT` |

---

## 2. Side-View Scene Layout & Adaptive Framing

```
  ┌──────── 48px Top HUD Sky Clearance Band (MultiRunPips / Top-Left Stack) ────────┐
  ╔═════════════════════════ OVERHEAD GANTRY RAIL ══════════════════════════════════╗
  ║  [◀ Bumper]        🤖 Claw (🔴 / 🔵 offset depth lanes in conc)    [Bumper ▶]  ║
  ╚═════════╤═══════════════════════════════════════════════════════════════════════╝
            │  (Telescoping spring cable + optical scan lens)
            ▼
  ┌───────────┐   ┌────────┐ ┌────────┐ ┌────────┐   ┌──────────────────┐   ┌──────────┐
  │  INPUT    │   │STACK 1 │ │STACK 2 │ │STACK 3 │   │  QUEUE (U-Belt)  │   │ OUTPUT   │
  │ Dispenser │   │  ┌──┐  │ │  ┌──┐  │ │  ┌──┐  │   │ [▲ 0]      [7 ⬇] │   │  ┌────┐  │
  │ [🔵]      │   │  │🔴│  │ │  │  │  │ │  │  │  │   │  │🟠│  ││  │🟣│  │   │  │OUT │  │
  │ [🟢]      │   │  │🔵│  │ │  │  │  │ │  │  │  │   │  │🔵│▲ ││ ▼│🟢│  │   │  │ or │  │
  │ [🟡] ◀──  │   │  │🟢│  │ │  │  │  │ │  │  │  │   │  ╰─ ⊙ ◀ ⊙ ─╯     │   │  │✅/❌│  │
  │ (Grab ▲)  │   │ ═╧══╧═ │ │ ═╧══╧═ │ │ ═╧══╧═ │   │    [ ↺ FIFO ]    │   │  └────┘  │
  └───────────┘   │  [ 1 ] │ │  [ 2 ] │ │  [ 3 ] │   └──────────────────┘   └──────────┘
  [Optional Workbench Floor: Recessed Physical Peg Sockets ⌼1 ⌼2 ⌼3 ... (peg-mode only)]
```
*(Electronic Memory Tape **`TapeDock`** (`◀ [1] … [N] ▶`, optical heads `▲1`, `▲2`, and optional `🛡️` Crystal Shield read-only highlights) sits directly above this canvas inside the standardized **`Top Dock (shrink-0)`**—never overlapping the overhead gantry rail or workbench floor.)*

### 2.1 Adaptive Active-Station Framing (Clean Stage Rule)
Stations not used by a lesson are hidden cleanly (`activeStationsMask`) so early modules have maximum readability across desktop and `375px` mobile viewports:
- **Stack-Only (`loop.8–9`, `func.6`, `rec.8`, `rec.M2`):** Only `STACK 1..3` render (with `OUT` also hidden in pure stack-transfer puzzles).
- **Stack + Output (`loop.10`, `sort.3–4`):** `STACK 1..3` + `OUTPUT`.
- **Queue Puzzles (`while.2–4`, `sort.A`):** `STACK 1..3` + `QUEUE` (+ `OUTPUT` when required).
- **Input + Stacks + Output (`cmp.7–8`, `sort.1–2`, `tape.7`):** `INPUT` + `STACK 1..3` + `OUTPUT`.
- **Full Pipeline (`conc`, Free-Play Sandbox):** All active zones scale cleanly (`INPUT ~11%`, `STACK 1..3 ~42%`, `QUEUE ~31%`, `OUTPUT ~16%`).

### 2.2 Station Visual Details (LIFO vs. FIFO & Ghosts)
- **`INPUT` Supply Dispenser (Left):** Clear vertical tube with an illuminated bottom **Pickup Cradle** and an upward-only exit icon (`DEPOT_PLACE` triggers one-way barrier `⛔` `COLLISION`). Targetable by `DEPOT_GRAB`, `$topColor`, `$topValue`, and `stationEmpty [INPUT]`.
- **`STACK 1..3` Open-Top Acrylic Chutes (Center-Left):** Flared open top mouth + vertical center peg + bold numeric pedestal `[ 1 ] [ 2 ] [ 3 ]` (or color-coded bin pedestals `[ 1 🔴 ] [ 2 🔵 ] [ 3 🟢 ]` in `tape.A`).
  - **Top vs. Lower Items:** Only the top item shows full saturation + pulsing grab-halo (+ `▲` chevron when hovered); lower items render behind diagonal translucent acrylic glare lines at ~75% brightness.
  - **Zero-Reading Target Blueprints:** Empty target stacks render translucent (~25%) dashed ghost silhouettes (`bottom → top`) that pop `✓` as matching rings arrive; stacks that start non-empty render a compact **Mini Goal Stack Preview** beside/below the pedestal base.
- **`QUEUE` U-Shaped Conveyor Belt (Center-Right):** Upright 8-slot U-shaped conveyor (`∪`) matching stack bay height so all `0..8` queue items remain visible without clipping or scrolling. Features a **Top-Right Entry Funnel (`⬇`)** for `DEPOT_PLACE`, a **Right Entry Lane (`Slots 7 → 4 ▼`)**, a **Bottom Spoked-Roller U-Turn (`╰─ ⊙ ◀ ⊙ ─╯`)**, a **Left Exit Lane (`Slots 3 → 0 ▲`)**, and a stationary **Top-Left Pickup Cradle (`▲`, `Slot 0`)** highlighting ONLY the frontmost item for `DEPOT_GRAB` / `$topColor` / `$topValue`. As the front item lifts into the claw, remaining belt items smoothly glide forward one slot along their segment (up the left lane, around the bottom turn, and down the right lane). When placing onto the queue, the item drops into the Top-Right Entry Funnel and rides along the U-track to join the tail.
- **`OUTPUT` Delivery Dock (Right):**
  - **Standard `OUT` Mode:** Transparent overhead curved sky-chute feeding a horizontal target tray with ghost slots `[1][2][3]...`.
  - **Verdict Gate Mode (`ACCEPT` / `REJECT`, e.g., `sort.0–1`, `args.M3`):** Twin arched chutes—emerald **`✅ ACCEPT`** and coral-red **`❌ REJECT`**—with animated flap doors.

---

## 3. Depot Action Blocks (4) & Tape Semantics Clarity

All 4 Depot action blocks preserve M1–M6 opcode slots (`0x10..0x14`) and execute inside single-beat synchronized animations honoring the global `⚡ Speed` control:

| Block | Icon | Parameters & Wire Codes | Behavior & Visual Choreography |
| :--- | :--- | :--- | :--- |
| `DEPOT_MOVE_TO` | Arrow → station | `STACK_1` (`0`), `STACK_2` (`1`), `STACK_3` (`2`), `QUEUE` (`3`), `TAPE` (`4`), `INPUT` (`5`); stacks also accept a numeric variable (`a`–`z`) or shape socket (`●`, `▲`, `■` -> `1..3`) | Trolley rolls smoothly along gantry rail (`easeInOutCubic`), cable tilts subtly `±4°` then settles plumb, station pedestal lights up in worker's color. Dynamic vars/sockets ride as a `[2]` index pill onto the trolley; values `< 1` or `> 3` slam into the striped end-bumper (`COLLISION`). |
| `DEPOT_GRAB` | Claw ↑ | None | Cable extends into top of Stack / Top-Left Pickup Cradle (`Slot 0`) of Queue / Pickup Cradle of Input / occupied Physical Peg Socket (`TAPE` peg-mode only). Jaws grip item cleanly and lift **full-size into the claw jaws** (Queue items advance around the U-belt — up the left lane, around the bottom turn, and down the right lane; Input drops next). Errors (`COLLISION`) on empty bay, full claw, or non-peg `TAPE`. |
| `DEPOT_PLACE` | Claw ↓ | None | At `QUEUE`, claw dips over the **Top-Right Entry Funnel (`Slot 7`)**, drops the held item into the mouth, and the conveyor rides it down the right lane (and around the U-turn when `queueIndex <= 3`) to the queue tail; otherwise lowers at current station onto Stack top or empty Physical Peg Socket. Errors (`COLLISION`) on empty claw, `INPUT` one-way gate, non-peg `TAPE`, or Hanoi `$heldValue > $topValue` violation (`enforceHanoiRule = true`). |
| `DEPOT_SEND_OUT` / `DEPOT_SEND_GATE` | Arrow → `↪` / `✅` / `❌` | Parameterless `OUT` (`0x13`) or `DEPOT_SEND_GATE` (`0x14`: `0 = OUT` `↪`, `2 = ACCEPT` `✅`, `3 = REJECT` `❌`) | **Logical Station Invariance:** Claw remains anchored at `workerStation` while jaws open and launch the item through an overhead transparent sky-chute arc into `OUT`, `✅ ACCEPT`, or `❌ REJECT` (flashing `✓` or `✗` against expected target). Empty claw triggers `COLLISION` (`args.M3` uses `🎫` Verdict Token). |

> **Physical Peg Slots vs. Electronic Tape Memory:** To avoid confusing conserved physical items (`DEPOT_GRAB` / `DEPOT_PLACE`) with electronic memory copies (`$cellValue`, `$cellColor`, `TAPE_WRITE`), electronic Tape puzzles (`tape.5–8`, `sort.0–1`, `conc.B`, `fp`) use strictly the glowing `Top Dock` `TapeDock` blocks/sensors (`TAPE_SEEK`, `TAPE_STEP`, `TAPE_WRITE`, `$cellValue`, `$cellColor`, `cellEmpty`). Writing `TAPE_WRITE [$heldColor]` fires a **magenta/cyan electronic copy beam** from the held item up into `TapeDock` while keeping the physical object untouched in the claw. Only layouts configured with physical-peg mode render floor sockets (`⌼ 1..N`) and allow `DEPOT_MOVE_TO [TAPE]` + `DEPOT_GRAB`/`DEPOT_PLACE`.

---

## 4. Depot Sensors, Predicates & Live Visual Spotlights

### 4.1 Zero-Reading Boolean & Swatch Condition Predicates (`ConditionExpr`)
Used inside `If`, `Else If`, `While` before numeric comparisons (`cmp`):

| Tag | Predicate | Badge | Parameters (`STATION_CODES` / `PALETTE_COLORS`) | Meaning & Visual Spotlight |
| :--- | :--- | :--- | :--- | :--- |
| `0x18` | `stationEmpty` | Container + `∅` | `0 = CURRENT`, `1 = STACK_1`, `2 = STACK_2`, `3 = STACK_3`, `4 = QUEUE`, `5 = INPUT`, `6 = TAPE` | True when target station holds zero items. Pulses a dashed radar ring + `∅` around the queried bay from anywhere. |
| `0x19` | `hasItem` | Claw-Ring SVG | None | True when active claw holds any ring, block, disc, or `🎫` token. Pulses a green/dashed halo around the **claw jaws**. |
| `0x1B` | `heldColor` | Claw-Ring + 🎨 | Swatch `0..9` (`PALETTE_COLORS`) | True when held item color matches `[Swatch]`. Pulses swatch ring on claw cargo. |
| `0x1C` | `topColor` | Top-Ring + 🎨 | Swatch `0..9` (`PALETTE_COLORS`) | **Non-destructive peek:** true when top/front item at `workerStation` matches `[Swatch]`. Emits a **non-contact optical scan cone** onto the glowing top/front item. |

*(Legacy `0x1A itemDamaged` is retired in `ENV_VERSION_DEPOT_V4` — `SCRAP` and damaged items live solely in Switchyard.)*

### 4.2 Live Typed Value & Color Sensors (`SENSOR_REF_FLAG = 0x80` + `0x30 CMP`)

| Wire ID | Sensor | Badge | Parameters | Type | Meaning |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `0xA0` | `$heldValue` | Claw + `#` | None | `number` | Number/size on held item (`TYPE_ERROR` if empty claw or **color-only** item) |
| `0xA1` | `$topValue` | Top + `#` | None | `number` | **Non-destructive peek:** number/size on glowing top/front item at `workerStation` (`TYPE_ERROR` if empty bay or **color-only** item) |
| `0xA2` | `$heldColor` | Claw + 🎨 | None | `color` | Canonical color of held item (`TYPE_ERROR` if empty claw or **number-only / token** item) |
| `0xA3` | `$topColor` | Top + 🎨 | None | `color` | **Non-destructive peek:** canonical color of glowing top/front item at `workerStation` (`TYPE_ERROR` if empty bay or **number-only / token** item) |
| `0xA4` | `$stationLen` | Stack + `#` | `STATION_CODES` (`0..6`) | `number` | Item count currently in target station (`0..N`) |

- **Comparison Bridge Visuals (`cmp`, `sort`):** Evaluating `$heldValue > $topValue` draws a temporary glowing **comparison bridge badge** (`[ 9 ] > [ 4 ] ✓`) linking claw cargo and stack top; evaluating `a <= $topValue` bridges the active `VARS` chip and stack top; Tape pointer comparisons (`sort.0–1`) illuminate colored `[l]`, `[h]`, `[m]` frames and an equality/comparison arc in `TapeDock`.
- **Short-Circuit Guard Safety (`cmp`+):** Left-to-right short-circuiting on `AND` / `OR` ensures `If (NOT stationEmpty [CURRENT] AND $topValue > 5)` never triggers `TYPE_ERROR` on an empty bay.

---

## 5. Multi-Worker Concurrency (`conc`) & Extended Victory Conditions

### 5.1 Dual-Claw Concurrency (`conc`)
- **Color-Coded Claws & Depth-Offset Gantry Lanes:** Supports `Worker 🔴` (`Main 1` / Fork 1) and `Worker 🔵` (`Main 2` / Fork 2) traveling on subtly staggered depth-offset rail tracks so passing over the same station remains visually legible.
- **Simultaneous Lockstep Speedup (`⏱️`):** Both workers animate simultaneously in the same wall-clock tick, halving `⏱️` ticks against sequential baselines (e.g., `⏱️ 16 ← 48`).
- **Same-Tick Station Contention (`COLLISION` `💥`):** Hovering (`DEPOT_MOVE_TO`) at the same station is safe, but **any two workers executing `DEPOT_GRAB` or `DEPOT_PLACE` on the same station in the exact same tick** clash pincer-to-pincer with a bright `💥` starburst (`COLLISION`) unless serialized via `LOCK`/`UNLOCK` (`OP_EXT = 0x0F`), `SYNC_BARRIER`, or `SEND`/`$recv`.
- **Lock, Wait & Deadlock Visuals:**
  - Holding `🔒 Lock [🔴]` renders a glowing `🔒🔴` padlock badge directly on the owning trolley carriage.
  - A blocked worker hovers smoothly with an animated **`⏳🔒🔴` / `⏳📬🔴` / `⏳🚧` wait bubble** over its trolley.
  - A circular wait (`Worker 🔴` holding `🔒🔴` waiting on `🔒🔵` while `Worker 🔵` holds `🔒🔵` waiting on `🔒🔴`) renders a pulsing red cycle arc (`🔴 ⏳🔵 ⇄ 🔵 ⏳🔴`) and stops cleanly with **`DEADLOCK` (`🔒💥`)**.
- **Per-Worker Electronic Tape Heads (`▲1`, `▲2`):** Shared `TapeDock` assigns color-coded optical heads so parallel Tape sorting (`conc.B`, with physical claws parked/hidden) runs concurrently on disjoint ranges.

### 5.2 Victory & Multi-Run Validation Fields (`ENV_VERSION_DEPOT_V4`)
Evaluated simultaneously across up to 4 variants (`MultiRunPipsBar` `[1 ✓][2 ✗][3 ·][4 ·]` with click-to-inspect failure focus):
- **Container Targets:** `targetStacks` (ordered color/value match), `targetOutput` (ordered sequence match), `targetQueue` (optional ordered Queue target), `targetHeadPos`, and `targetTapeCells` (including partial/range expectations).
- **Decision & Rule Flags:** `verdictGateMode` (validates every item routed cleanly to `ACCEPT` vs `REJECT` per variant expectations), `exactOutputCount` (e.g., `cmp.8` `Output == [max]`), `enforceHanoiRule` (strictly per-level opt-in for `rec.8` / `rec.M2`), `requireEmptyStacks`, `allowNonEmptyInput` (`tape.7`), `activeStationsMask`, and `parTicks` (optional `⏱️` speedup target).

---

## 6. Zero-Reading Failure & Error Feedback Taxonomy

| Stop Status / Reason | Trigger | Zero-Reading On-Canvas Cue |
| :--- | :--- | :--- |
| **`COLLISION` (Hanoi Bounce)** | `DEPOT_PLACE` when `$heldValue > $topValue` and `enforceHanoiRule = true` | Held disc touches narrower disc, overhangs flash coral-red, disc bounces back with `[7] > [3] 🚫` (`💥`) |
| **`COLLISION` (Empty Grab)** | `DEPOT_GRAB` on empty Stack, Queue, Input, or empty Peg Socket | Jaws snap shut on empty air emitting puff + pulsing `∅` shockwave (`💥`) |
| **`COLLISION` (Full Claw)** | `DEPOT_GRAB` while claw already holds an item | Held item bonks top/front item with contact `💥` starburst and spring recoil |
| **`COLLISION` (Empty Place/Send)** | `DEPOT_PLACE`, `DEPOT_SEND_OUT`, or `DEPOT_SEND_GATE` with empty claw | Empty jaws snap open emitting puffing `∅` ghost cloud (`💥`) |
| **`COLLISION` (`INPUT` Place / Non-Peg `TAPE`)** | `DEPOT_PLACE` at `INPUT`, or `GRAB`/`PLACE` at `TAPE` in electronic-only mode | Held item rebounds off glowing one-way `⛔` barrier (`💥`) |
| **`COLLISION` (Bumper OOB)** | Dynamic `DEPOT_MOVE_TO [a]` with `a < 1` or `a > 3`, or Tape head OOB | Trolley (or `▲` head) slams into striped red/yellow end-bumper (`💥`) |
| **`COLLISION` (Station Contention)** | 2+ workers execute `GRAB`/`PLACE` on same station in same tick | Both claws converge and clash pincer-to-pincer with `💥` starburst |
| **`TYPE_ERROR`** | `$topValue` / `$heldValue` on color-only or empty slot; `$topColor` / `$heldColor` on number-only/token/empty | Optical beam or claw shows `∅` or `🎨 ↔ #` type-mismatch bounce |
| **`MATH_ERROR`** | `/ 0` or `% 0` in `OP_VAR_OP` | Shared `🧮÷0` pill over active block + top status bar |
| **`STACK_OVERFLOW`** | Recursion depth exceeds `MAX_CALL_STACK_DEPTH = 64` | Shared `📚💥` overflow cue + pulsing `CallStack` HUD |
| **`STEP_LIMIT`** | Loop / program exceeds step cap | Shared `⏳🔁` amber warning pill pulsing on offending loop |
| **`DEADLOCK`** | Circular mutex/barrier wait across workers | Pulsing red cycle arc `🔴 ⏳🔵 ⇄ 🔵 ⏳🔴` + `🔒💥` status pill |
| **End-of-Run Mismatch** | Wrong `OUT` sequence, wrong `✅/❌` Verdict gate, or leftover required items | Mismatched `OUT` slot flashes `[Expected]` vs `[Got]` `✗`; wrong gate flashes `✗`; un-cleared bays pulse amber `!` |
