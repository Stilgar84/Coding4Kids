# 🚂 Switchyard / Conveyor Sorter Environment Specification

`Switchyard` is a **constrained, validated puzzle environment** introduced in Core Module `branch` of [the curriculum](../curriculum/overview.md) (used across `branch`, `while`, `cmp`, `args`, Planned Side Module `fp`, and Optional **Mastery Challenges**).

While **[🤖 Robot Grid](./robot_grid.md)** excels at spatial navigation, egocentric orientation turns (`Left`/`Right` relative to robot heading) add extra mental load when 5–7 year-old newcomers first learn `If / Else` branching, boolean logic, numeric comparisons (`<`, `>`, `==`), modulo (`%`), and running quotas. And while **[🏗️ Depot](./depot.md)** models stateful multi-step container manipulation (`MoveTo` → `Grab` → `MoveTo` → `Place`), `Switchyard` provides playful, **1-block stateless mechanical train routing** and hazard scrapping—letting learners focus 100% on **inspecting data, making decisions, and routing streams** within compact block budgets.

*(For cross-environment language blocks, multi-stream validation mechanics, and the shared Sparse Memory Tape, see [Shared Language, Lesson Mechanics & Platform Requirements](../platform_requirements.md).)*

---

## 1. Visual Simulation, Orientation & Zero-Reading Rules

### 1.1 Zero-Rotation Top-to-Bottom Track Tree & Toy-Workshop Aesthetic
To preserve Switchyard's core pedagogical advantage (zero egocentric left/right rotation), screen direction maps **1:1** to track direction on a responsive daylight canvas (`viewBox="0 0 640 540"`):

- **Top `48px` HUD Clearance Zone (`y = 0..48`):** Styled as warm sky / station ceiling beams so [`ui_guidelines.md` §3](../ui_guidelines.md#3-non-overlapping-pane-simulation-hud-architecture) overlays (**Top-Center Pill** `[1 ✓] [2 ✗] [3 ·]` + status pill, **Top-Left Stack** `VARS` / `CallStack`, and **Top-Right Badge** `🔒` + `🚂 N` + `⏱️`) **never** occlude train cars, the tunnel portal, or the Scanner Gate. Switchyard uses **no `BackpackHud`** (`🎒`).
- **Brick Feeder Tunnel (`y = 54..130`):** A brick/steel **Tunnel Mouth** on the upper-left (`x = 24..80`) displays a live **Tunnel Signal Lantern** (glowing green while `hasNextItem == true`, muted amber/gray when the last car enters the scanner) and a **`+N` convoy counter** whenever `> 6` cars wait off-screen.
- **Incoming Stream Queue:** Connected toy cargo flatbeds with wheel bogies and brass couplers glide horizontally along wooden-tie tracks before curving `90°` downward at `x = 290` into the upright **Inspection Scanner Gate** (`x = 320, y = 150..220`):
  - **Progressive Visual Clutter Control (Show Only Active Lesson Properties):**
    - **Color:** High-saturation car body (`Red`, `Blue`, `Green`, `Amber` / `Yellow`; extensible across canonical 10-color `PALETTE_COLORS`).
    - **Cargo Emblem:** Distinct vector icon (`Crate`, `Battery`, `Gear`, `Crystal`) sized for colorblind-safe silhouette recognition.
    - **Condition Visual (`itemDamaged`):** Four unmistakable simultaneous cues—dark fracture + `-5°` bed tilt, animated pulsing amber/orange sparks (`⚡`), rising smoke wisps, and a **`⚠️` corner hazard badge + dashed danger halo**.
    - **Weight / Value Badge (`cmp`+ Only):** Hidden in `branch` and `while` so younger learners are not distracted; large high-contrast white number plate (`1..99` tabular digits) pinned on the car front with heavy-rivet visual cues for heavy crates (`> 10`), plus optional `#1, #2...` sequence tags in modulo round-robin puzzles (`cmp.4`).
    - **Order Header / Manifest Car (`args.M2` Only):** Distinct mini-locomotive cab + clipboard manifest plate (`[Color × Count]`, e.g. `[🔵 ×3]`) visually set apart from regular cargo cars behind it.
- **Inspection Scanner Gate & Synchronized Code-to-Sensor Pulse:**
  - Mounted Scanner Arch hood displays **only sensors active in the current module** (`Color`, `Emblem`, `⚠️` Hazard, `⚖️` Weight). Each incoming car triggers a crisp horizontal cyan laser sweep (`~160ms`), locking in its hood badges.
  - Whenever an `If`, `Else If`, `While`, `NOT/AND/OR`, `VAR_ASSIGN`, or `CMP` block evaluates a sensor or quota check, the workspace block header and the matching Scanner/Dock canvas feature pulse simultaneously with a green **`✓`** ring (`true`) or red/slate **`✗`** ring (`false`), including visual comparison bubbles (`[⚖️ 14] > [⚖️ 10] ✓`) and synchronized Watch Tray (`VARS`) ↔ Quota Gauge highlights (`~220ms` visible hold in `1× Play`; paused directly on the condition header in `⏭ Step`).
- **Attached Hazard Scrap Chute (`x = 400..565, y = 148..228`):** Branches directly off the **right wall of the Scanner Arch** into a **`♻️` Hazard Recycle Bin**, visually proving that `SCRAP_ITEM` (`exclusive to Switchyard`) bypasses Switch A / Switch B completely.
- **0, 1, or 2 Track Switches (`Switch A`, `Switch B`) & Continuous Glowing Active Path:**
  - **Canonical Curriculum Topologies:** Never render dead or unused branches:
    - **0 Switches (`1` Dock):** Straight rail from Scanner to centered single dock (`SWITCH_LEFT`/`SWITCH_RIGHT` omitted).
    - **1 Switch (`2` Docks — `branch.2`–`5`, `while.5`, `cmp.*`, `fp.6`):** Single turntable `Switch A` forks screen-left (`↙` Dock A) and screen-right (`↘` Dock B); circular junction badge `A` is omitted on 1-switch maps.
    - **2 Switches (`3` Docks — `branch.8`, `branch.A`, `args.3`, `args.M2`):** `Switch A` forks Left → `Dock A` and Right → `Switch B`, which forks Left → `Dock B` and Right → `Dock C`; switches display bold `A` and `B` junction badges matching switch blocks. *(An optional 3-switch / 4-dock tree may be used strictly in Pro Sandbox.)*
  - **Live Path Preview (`IDLE`, `⏭ Step`, `▶ Play`):** Turntable blades + mechanical levers pivot `±28°` (`150ms` spring ease). Before `SEND_NEXT` fires, a glowing cyan/emerald underlay and marching directional chevrons (`⌄ ⌄ ⌄`) continuously trace the open route from **Scanner → Active Switches → Destination Dock**, dimming unreachable tracks (`Switch A = LEFT` visibly dims `Switch B` and Docks `B`/`C`).

### 1.2 Self-Documenting Target Docks, Specialized Mechanics & Icon Failure Diagnostics (Zero Text)
- **Floor-Painted Acceptance Rules & Segmented Quotas:** Each receiving dock along `y = 415..520` renders wide bay markings directly on the floor:
  - Color swatch and/or cargo emblem (`Red Crate` = accepts only undamaged Red Crates; small green `✓` intact seal shown when hazards exist).
  - Weight limit scale badge (`⚖️ ≤ 10`, `⚖️ > 10`) or round-robin slot tickets (`[1][3][5]`, `[2][4][6]` in `cmp.4`).
  - Segmented **Quota Gauge** (`[■■□□]`, e.g. `2 / 4`) that pops segments into place on each valid car and lowers a **`✓ FULL`** green-striped bay gate bar when reached.
  - Delivered cars shrink (`50%`) and park inside the bay tray.
- **Specialized Module Visuals:**
  - **Twin Balance Beam (`cmp.M2`):** Dock A and Dock B act as weighbridge pans joined by a central brass/wood **Fulcrum Balance Beam** (`±15°` tilt proportional to `leftSum - rightSum`) with bold live `⚖️` pan totals and an emerald/amber balance-tolerance zone.
  - **Order Header Manifests (`args.M2`):** Active Order Banner pins above Fulfillment `Dock A`, while `Dock B` acts as a dedicated **Return / Recycle Dock** for processed manifest headers and non-matching intact cars (keeping `SCRAP_ITEM` strictly hazard-only).
  - **Functional Strategy Filters (`fp.6` `RouteByRule([F?])`):** Helper sockets `[F2]`/`[F3]` return predicate/parity booleans via universal `↩️ Return` against matching Dock A floor stencils with **0 new Switchyard blocks or sensors**.
- **Celebratory Match vs. Zero-Reading Failure Feedback:** Valid deliveries expand a green shockwave ring across the bay; complete multi-stream wins pulse all docks gold `✓`. Every failure triggers an unmistakable on-canvas animation and icon-only diagnostic bubble directly over the offending dock, bin, or queue:
  - **Wrong Color / Emblem:** Spring bumper recoil (`12px`) + `Expected [🔴📦] ≠ Got [🔵📦]`
  - **Damaged Car to Intact Dock:** Spark bounce + `Expected [✓] ≠ Got [⚠️]`
  - **Weight Rule Violated (`cmp`+):** Scale plate shake + `[⚖️ 14] > [⚖️ 10] ✗`
  - **Over-Quota Delivery:** Lowered gate bar bump + `[4 / 4 FULL!] ✗`
  - **Valid Car Scrapped (`SCRAP_ITEM`):** Chute recoil + `[♻️ = scrapRule] ≠ [🔴📦]`
  - **Program Ends Early / Stranded Cars:** Remaining feeder cars pulse amber + `🚂 ×2 left!`
  - **Unmet Dock Quota:** Empty `[□]` slots pulse amber/red + `[■■□□] 2 / 4 ✗`

*(All Switchyard animations scale cleanly with `<header>` `⚡ Speed` (`1×`, `2×`, `4×`, `Instant`) and respect `prefers-reduced-motion`.)*

---

## 2. Multi-Stream Validation & Solution Support

- **Simultaneous Multi-Stream Pips (`[1 ✓] [2 ✗] [3 ·]`):** Every Switchyard puzzle validates the learner's program against **3–4 different incoming queues** visible from the start, ensuring hardcoded `Left, Right, Left` sequences cannot pass.
  - **Pre-`While` Queue Length Rule (`branch`):** Because `branch` introduces `Loop ×N` before `While`, all simultaneous streams in any `branch` activity MUST share the same queue length (`N = 4..6` cars) while varying color/icon/hazard ordering; `while.5` deliberately introduces unequal lengths (`2..6` cars).
  - **Interactive Stream Preview (`IDLE`):** Tapping any pip in the Top-Center Pill immediately swaps the live convoy preview on the canvas (`120ms` slide) without modifying workspace blocks.
  - **Smart Failure Auto-Focus & Step-Debug:** When one stream passes (`[1 ✓]`) and another fails (`[2 ✗]`), the runner automatically focuses the canvas onto the first failing stream at its exact failure state with its icon diagnostic bubble (`§1.2`). Hitting `⏮ Rewind` → `⏭ Step` keeps that failing stream selected for block-by-block inspection.
- **Partial & Full Visual Solutions:** Every Switchyard lesson provides:
  1. A **Partial Solution** (e.g., `While (hasNextItem)` outer loop or `If (?)` skeleton pre-placed).
  2. A **Full Working Solution** loadable in one tap (Undo-protected).

---

## 3. Action Blocks

| Block ID | Visual Icon | Parameters | Behavior |
| :--- | :--- | :--- | :--- |
| `SWITCH_LEFT` | Track fork pointing Left (`↙`) | Optional Junction badge (`A`, `B` on multi-switch maps; omitted on 1-switch maps) | Sets the designated track switch (`A` default, or `B`) to its Left branch (`150ms` blade/lever swing, `1` tick). Re-asserting an already-Left switch plays a subtle confirmation glow. |
| `SWITCH_RIGHT` | Track fork pointing Right (`↘`) | Optional Junction badge (`A`, `B` on multi-switch maps) | Sets the designated track switch (`A` default, or `B`) to its Right branch (`1` tick). |
| `SEND_NEXT` | Train/conveyor arrow `→` | Repeat badge (`×N`, variable `a..z`, or socket `●`) | Dispatches **1 scanned car per sub-tick** smoothly along the glowing active switch path into its destination dock, emitting a countdown pill (`×3 → ×2 → ×1`) and sliding the feeder queue forward. Fails (`COLLISION`) on an empty scanner or violated dock rule. |
| `SCRAP_ITEM` | Hazard / recycle chute icon | None | Diverts the car currently at the scanner sideways down the Scanner-attached trapdoor chute into the `♻️` bin and pulls the next car into the scanner. Valid strictly according to puzzle `scrapRules` (`itemDamaged` default; `itemDamaged OR itemWeight > limit` in weight-threshold lessons like `cmp.A`); fails (`COLLISION`) if empty or rule not met. |

---

## 4. Sensor Conditions & Numeric Readouts

Switchyard sensors plug visually into `If`, `If / Else`, `While`, relational comparisons (`0x30 CMP` in `cmp`+), and variable assignment (`a = [Sensor]`) blocks:

### Boolean & Category Sensors (`branch` & `while`)

| Sensor | Binary Tag | Visual Badge | Evaluates True When... |
| :--- | :--- | :--- | :--- |
| `hasNextItem` | `0x10` | Train car + `?` | At least one car remains at the scanner / incoming track (standard loop condition for `While (hasNextItem)`). |
| `itemColor == [Swatch]` | `0x12` | Colored car swatch | Scanned car matches the selected color swatch (`Red`, `Blue`, `Green`, `Amber` / `PALETTE_COLORS` `0..9`). |
| `itemIcon == [Emblem]` | `0x13` | Cargo icon badge | Scanned car matches the selected cargo icon (`Crate`, `Battery`, `Gear`, `Crystal`). |
| `itemDamaged` | `0x11` | Cracked/sparking icon | Scanned car is damaged/hazardous and must be sent to `SCRAP_ITEM`. |

### Numeric & Typed Readouts (`cmp`+ / `args`+)

| Readout | Binary Ref (`0x80 \| id`) | Parameters | Visual Badge | Value Returned |
| :--- | :--- | :--- | :--- | :--- |
| `$itemWeight` | `0xA8` | None | Scale / number tag (`⚖️`) | The integer weight/value (`1..99`) printed on the scanned car (used in `itemWeight > 10`, `sum = sum + itemWeight`, or `Call F1(itemWeight)`). |
| `$dockQuota` | `0xAA` | `dockIdx` (`0=A` default, `1=B`, `2=C`) | Dock gauge target (`[A]`) | The target item quota painted on the selected dock (`[A]`, `[B]`, or `[C]`). |
| `$dockCount` | `0xAB` | `dockIdx` (`0=A` default, `1=B`, `2=C`) | Dock fill counter (`[A]`) | Current **delivered car count** (`[■■□□]`, strictly car count—never weight, keeping user accumulators like `l = l + itemWeight` intact in `cmp.M2`). |
| `$itemColor` *(Gated)* | `0xA9` | None | Color swatch (`🎨`) | Canonical `TypedValue` `color` (`PALETTE_COLORS` `0..9`) of the scanned car (or manifest header in `args.M2`); strictly gated to `args`+ / Sandbox and hidden in `branch`/`while`. |

---

## 5. Shared Sparse Memory Tape Integration

- **Tape Length:** `8`–`16` cells in Puzzles; `10,000` cells in Mastery Challenges.
- **Rendering Slot:** Collapsible `shrink-0` Tape Dock above the canvas (read-only in puzzles; omitted when unused as in `fp.6` functional filter routing, which uses higher-order `[Fn]` predicate callbacks without mutating or mounting a Tape; see [Platform Requirements](../platform_requirements.md) and [UI Guidelines §3](../ui_guidelines.md#3-non-overlapping-pane-simulation-hud-architecture)).
