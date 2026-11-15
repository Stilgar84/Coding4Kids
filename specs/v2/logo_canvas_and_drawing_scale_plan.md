# 🐢 Turtle LOGO Canvas Sizing & Drawing Scale Plan

> **Scope & Intent:** Records the environment/platform upgrades and previous-module (`seq`–`func`) parameter adjustments required so **every** Turtle LOGO drawing across all curriculum modules (`seq` through `fp`) and Sandbox mode stays **substantially larger than the turtle sprite** while the turtle remains **zoom-independent and sized to one workspace block**, and the canvas expands, frames, pans, and zooms without artificial boundaries.
> **Status:** Updated planning document (zoom-independent block-sized turtle + `DEFAULT_STEP_DISTANCE = 100`) created alongside `branch`–`cmp` Stage 2 authoring and `seq`–`func` LOGO scale bumps per user review feedback. Zero `src/`, `tests/`, or `e2e/` code files were altered.

---

## 1. Problem Statement & Quantitative Scale Standard

### 1.1 Why Small Drawings Hide Behind the Turtle
- In `src/simulations/turtle/components/TurtleCanvas.tsx`, the current world-scaled turtle SVG avatar (`turtle-robot`) renders at **`r = 22` outer aura (`44px` diameter)**, `r = 18` shell (`36px` diameter), head reaching `y = -27`, and rear flippers at `y = +18` — an effective **`40px × 45px` world-unit footprint** that swells to `100–250px` when zoomed in (`2×–8×`) or shrinks to a `1px` speck when zoomed out (`0.02×–0.25×`) on huge fractals/spirals.
- Meanwhile, SVG thumbnails (`renderTurtleMapSvg` in `src/services/mapThumbnailGenerator.ts` and legacy `.svg` renders) draw only a `12×15px` triangle. That discrepancy masked small strokes (`10–35px` segments, `300 / n` shrunken polygon sides, `r = 10` tiny flowers/eyes) during Stage 1/early docs authoring, leaving strokes hidden underneath the turtle body during live playback.
- Attempting to cap large polygons with `l = 300 / n` (`n = 10 -> 30px`, `n = 12 -> 25px`) inside a fixed `[-180..+180] × [-140..+140]` box shrinks geometry *below* the turtle body! Instead, drawings remain bold and visible, the canvas/viewport expands smoothly around them, and the turtle itself becomes **zoom-independent and block-sized** (`r = 12` / `~28×32px` screen pixels).

### 1.2 Mandatory Cross-Module Drawing Scale Rule
Every Turtle LOGO starter, `📖` demo, variation card, and challenge target across `seq`–`fp` MUST satisfy:
1. **Overall Ink Bounding Box:** `max(inkWidth, inkHeight) >= 160px` (`200–450px+` typical; large showcase drawings of `500–1,000px+` are welcome).
2. **Primary Stroke & Motif Visibility:** Main edges, rays, and petals should use steps **`>= 60–150px`** (`2×–5×` the `~28×32px` turtle body at `1×` zoom) or arc diameters **`>= 100–150px`**, so lines clearly project out from under the turtle shell as it draws.
3. **Sub-Details & Spirals:** Inner windows, eyes, tips, or tight spiral inner turns should generally stay **`>= 25–50px`** (`r >= 15–25`), avoiding `3–15px` micro-shapes or shrinking-by-`n` formulas (`300 / n`, `120 / ●`).

---

## 2. Environment & Platform Changes Needed (`specs/v2/env_logo_plan.md` & `platform_plan.md`)

### 2.1 Practically Infinite Canvas & Zoom-Safe Grid (`TurtleCanvas.tsx`)
1. **Widen Zoom Limits (`TurtleCanvas.tsx:182, 252`):** Expand zoom clamp from `[0.2, 5]` to **`[0.02, 8]`** (`50×` zoom-out covering `~25,000px+` of world space without clamping) so Sandbox users and large spiral/fractal programs never hit a zoom wall.
2. **Viewport-Dynamic Origin Axes & Adaptive `#turtle-grid` Spacing (`TurtleCanvas.tsx:287–299`):** Replace the hardcoded `-10000..+10000` crosshair `<line>` endpoints with bounds derived from the current camera viewport (`pan`, `zoom`, container dimensions), and step `#turtle-grid` world pattern spacing smoothly (`50 → 250 → 1000` at `effectiveZoom < 0.25` / `< 0.05`) so grid lines never alias into solid gray when zoomed far out while aligned `100px` steps hit exact `2 × 50px` grid intersections.

### 2.2 Auto-Expanding Camera Framing & Zoom-Independent Block-Sized Turtle (`TurtleCanvas.tsx`, `useAppStore.ts`, `turtleEnvironment.tsx`)
1. **Auto-Fit Camera Overflow During Run (`autoFitOverflow`):**
   - Start at readable `zoom: 1` centered near `(0, 0)`.
   - Whenever `computedBounds` (drawing ink or turtle pose) exceeds `~85%` of the currently visible viewport at the current `zoom`, smoothly zoom out (up to `zoom >= 0.02`) and re-center `pan` automatically — **unless the user manually panned/zoomed during the run** (which pins user camera control until reset/rewind).
   - That guarantees both small-to-medium drawings (`200×200px`) AND huge drawings (`n = 12` `100px`-side polygon `386×386px`, giant spirals `600×600px`, Koch snowflakes) always stay completely visible while drawing, with **zero clipping** and **zero need to shrink coordinates**.
2. **Zoom-Independent, Block-Sized Turtle (`~28×32px` Screen-Space Sprite):**
   - Shrink the base `turtle-robot` SVG geometry (`TurtleCanvas.tsx:341–384`) by `~0.7×` so its visual footprint matches **one workspace block tile** (`BlockItem.tsx` renders `40×40px` tiles with `20–28px` icons): **`r = 12` (`24px` shell diameter)**, **`~28×32px` head-to-flipper body**, **`r = 16` (`32px` soft aura)**, centered with its active pen nib at `(0, 0)`.
   - Apply inverse-zoom scaling directly inside the `<g transform>` on `turtle-robot`:
     `transform={`translate(${robotPose.x}, ${robotPose.y}) rotate(${robotPose.heading}) scale(${teleportScale / effectiveZoom})`}`
     so the active pen nib at `(0, 0)` stays pixel-locked to `(robotPose.x, robotPose.y)` across the entire **`0.02×..8×`** zoom range—never shrinking into a `1px` speck when zoomed out on giant fractals, never ballooning over lines when zoomed in (`2×–8×`) to inspect corners, and keeping a standard `100px` step `> 3×` longer than the turtle at `1×` zoom.
3. **Thumbnail Wrapper Consistency (`mapThumbnailGenerator.ts`):** Render `renderTurtleMapSvg` with consistent block-sized turtle proportions (`~14–16px` aura / `~28×32px` span at `1×` viewBox) so design-time thumbnails accurately reveal stroke-to-turtle legibility.

### 2.3 Rounded Default Step & Aligned Parameter Pickers (`turtleEnvironment.tsx` & `physics.ts`)
1. **`DEFAULT_STEP_DISTANCE`: `50` → `100` (`src/simulations/turtle/physics.ts` & `turtleEnvironment.tsx`):**
   - Aligns parameterless `seq` steps (`FORWARD`/`BACKWARD` without length picker) cleanly to **`100px`** (`2 × 50px` grid squares, exact match with parameterized `FORWARD [100]` in `param`+), eliminating any scale jump between `seq` and `param`.
2. **Aligned Round Length / Radius / Teleport Parameter Options (`turtleEnvironment.tsx`):**
   - `TURTLE_LENGTH_PARAM_DEF`: `[25, 50, 75, 100, 150, 200, 250, 300]` (`defaultValue: 100`).
   - `TURTLE_ARC_RADIUS_PARAM_DEF`: `[25, 50, 75, 100, 150, 200]` (`defaultValue: 50`).
   - `TURTLE_TELEPORT_X_PARAM_DEF` & `Y`: `[-250, -200, -150, -100, -50, 0, 50, 100, 150, 200, 250]`.
   - *(Numeric variables `a..z` remain completely unbounded in expressions.)*

### 2.4 Expanded `insideCanvas` Nominal Paper Bounds (`docs/envs/turtle_logo.md` §1 & `CurriculumTurtleDefinition`)
- Widen default nominal `insideCanvas` rectangle from `[-180..+180] × [-140..+140]` (`360×280px`) to **`[-300..+300] × [-240..+240]` (`600×480px`)**.
- Add optional per-lesson `canvasBounds?: { halfWidth: number; halfHeight: number }` on `CurriculumTurtleDefinition` so `while.6` and `while.B` can bounce boldly across a spacious frame (`600×480px`) while `Sandbox` remains completely unbounded (only checking nominal bounds if the user explicitly places an `insideCanvas` sensor block).
- Sync `docs/envs/turtle_logo.md` §1 line 15 and `specs/v2/env_logo_plan.md` Phase 1–2 sections accordingly when Phase 1/2 code lands.

---

## 3. Previous Stage 2 Modules (`seq`, `param`, `loop`, `func`) — Scale Bump Checklist

All `branch`, `while`, `var`, and `cmp` Stage 2 LOGO lessons already obey `inkMaxSpan >= 160px` (`162–790px`). For `seq`–`func`, the Stage 2 docs and SVGs in `docs/curriculum/{seq,param,loop,func}/` are updated to **`DEFAULT_STEP_DISTANCE = 100`** and rounded/homogeneous parameter bumps (`>= 160px` everywhere; `render_logo_svg.mjs` updated to `DEFAULT_STEP_DISTANCE = 100`):

| Module | Affected Item(s) | Previous Span | Issue vs. Block-Sized / World Turtle | Applied Bump (`seq`–`func` Docs & SVGs; Phase 1 `src/` Parity Target) |
| :--- | :--- | :--- | :--- | :--- |
| **`seq`** | `seq.6`, `seq.7` (incl. `seq.7` Starter), `seq.B` (`12` SVGs) | `58` .. `158px` | `50px` default step left `seq.6`–`seq.B` below `160px` | Raising `DEFAULT_STEP_DISTANCE` `50 → 100` scales `seq.6`, `seq.7` Var 1–3, and `seq.B` by exact `×2` (**`200`–`308px`**); `seq.7` Starter (`Parallel Bars =`) uses `2 × FORWARD` per bar (`10` blocks `<= 14`, **`200×108px`**). |
| **`param`** | `param.2` Starter & Vars 1–4; `param.3` Starter & Var 1; `param.B` Starter, Var 1 & Var 4 (`10` SVGs) | `108` .. `208px` | `param.2`/`param.3` triangles, stars, hexagons & `param.B` `r50` heart/petal curves sat `< 160px` or `~150px` width | `param.2`: Starter `100 → 200`, Var 1 `100/75 → 150/100`, Var 2 `100 → 150`, Var 3 `75 → 100`, Var 4 `125 → 200` (`[25, 50, 75, 100, 125, 150, 200]`); `param.3`: Starter `×2` (`200/50/200/150`), Var 1 `100 → 200`; `param.B`: Starter `100/r50 → 150/r75`, Var 1 `×2` (`r100/100/r50`), Var 4 Flower `100/r50 → 150/r75` (`173`–`280px`). |
| **`loop`** | `loop.3` Starter, Var 1, Var 2; `loop.7` Var 1, Var 2, Var 3 (`6` SVGs) | `128` .. `260px` | `loop.3` Starter/Compass `< 160px`, `loop.7` Var 1 (`r50` `141px` ink) & Var 3 (`130px` Ring of Stars), unrounded `85`/`55`/`40` params | `loop.3`: Starter `120 → 200`, Var 1 `50 → 75`, Var 2 `125/90 → 200/150`; `loop.7`: Var 1 `r50 → r75`, Var 2 `85/r55/50 → 100/r75/75`, Var 3 `40/75 → 75/150` (**`190`–`365px`**). |
| **`func`** | `func.2` Starter & Vars 1–4; `func.B` Starter, Var 1, Var 2 (`8` SVGs) | `144` .. `238px` | `func.2` small stamps (`20–35px` stars/trunks/windows) & `func.B` Castle/Train/Harbor `4–24px` sub-strokes | `func.2`: Starter `85/35 → 150/75`, Var 1 Forest `80/20/40 → 150/50/100`, Var 2 Petal Ring `60/r24 → 100/r50`, Var 3A Cozy Cottage exact `×2`, Var 3B Dipper exact `×2`; `func.B`: Starter Castle, Var 1 Train & Var 2 Harbor exact `×2` (`[4, 8, ...] → [8, 16, ...]`, **`220`–`412px`**). |

---

## 4. Pre-Stage-2 Checklist for Remaining Modules (`inter`, `tape`, `anim`, `args`, `rec`, `conc`, `fp`)

When these modules advance from Stage 1 reports to Stage 2 docs, enforce the same `>= 160px` overall / `>= 60px` stroke rule (updating small Stage 1 values):
- **`inter`:** `inter.5` (`FORWARD [16 → 50]` stamp squares, `FORWARD [55 → 110]` polygon), `inter.6` (`FORWARD [14 → 45]`).
- **`tape`:** `tape.1` / `tape.B` skylines & waveforms: keep bar widths/heights bold (`25–40px` steps, `80–200px` heights, `>= 240px` total span).
- **`anim`:** `anim.0` / `anim.4` / `anim.9` / `anim.10`: drop conservative `-40..+40px` clamping! Morph `anim.9` polygons at bold `100–120px` sides (`200–400px+` diameters) and polar orbits at `120–180px` radii (`300–400px` scene) relying on `autoFitOverflow` camera framing.
- **`args`:** `args.0` (`30/70 → 80/150` squares); `args.1` Snowman (`r = 22/35/50 → 35/55/85`, total height `~350px`); **`args.6` MUST NOT shrink polygons via `b = 120 / ●`** — use bold fixed `FORWARD [65]` (with wider stamp spacing via `Call F2` / `TELEPORT` row offset) so 10-gons are clearly visible (`~210px` diameter) instead of `39px` specks!
- **`rec` & `fp`:** `rec.3` (`Call F1(110)` → `Call F1(200)`), `rec.4`/`rec.9` (`180–240px` trunks, `r = 12` coral blossom circles instead of `r = 3`), `rec.10`/`rec.B` (`180 → 270px` Koch bases on auto-expanding canvas).
- **`conc`:** `conc.2` (`TELEPORT [±140, ±100]` scene houses/suns at `120px+` scale), `conc.11` (`80px → 150px` rocket launch + `50px → 100px` burst rays).
