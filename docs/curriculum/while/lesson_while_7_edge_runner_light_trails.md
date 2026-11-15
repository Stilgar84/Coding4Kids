# Lesson while.7: Edge-Runner Light Trails (`While (NOT cursorAtEdge)`)

**ID:** `while.7` · **Format:** 🎨 Creative Open Sandbox (`Starter + 3 Variation Cards`) · **Env:** [Beat & Light](../../envs/beat_light.md)
**One-Concept Goal:** Paint border chasers, 4-color corner grooves, and guarded full-matrix snake sweeps using `While (NOT cursorAtEdge)` + `CURSOR_STEP` with zero hard edge crashes.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> The green directional reticle starts at top-left `(1, 1)` facing **East**, so `cursorAtEdge` is `false` until the cursor reaches an outer edge facing outward (`x=8` East, `y=8` South, `x=1` West, `y=1` North). `CURSOR_STEP` moves one tile forward and paints it—so a 4-leg border loop hits `(2..8, 1)` → `(8, 2..8)` → `(7..1, 8)` → `(1, 7..1)`, lighting every one of the `28` border LEDs cleanly! Notice in Variation 2 (`Snake Sweep`), `If (NOT cursorAtEdge)` skips the very last step at bottom-left `(1, 8)` so the cursor finishes cleanly with zero soft edge-bonks (`bonks: 0`)!
> *(Learner Workspace Rule: **0** learner-facing words — directional reticle, soft edge-clamp flash on clamped edge attempts, Black (`8`) = Erase `⊘`, and `$input` dial drive everything visually.)*

</details>

---

## 1. Env Setup & Constraints ([Beat & Light](../../envs/beat_light.md))

- **Matrix:** `8×8` Core (`1..8 × 1..8`; automatically stretches to `16×16` / `32×32` in Pro Sandbox!).
- **Cursor Reset:** `(x: 1, y: 1, dir: East)` (`cursorAtEdge == false`), directional pixel-arrow reticle **visible** whenever cursor blocks exist (`beat-cursor-reticle`).
- **Step & Edge Semantics:** `CURSOR_STEP` advances 1 tile then lights it (`Black (8)` = Erase `⊘`). Stepping when `cursorAtEdge == true` performs a kid-safe **soft edge-clamp** (stays in-bounds, flashes edge rim + soft bonk — **zero** hard `COLLISION` fail).
- **Audio / Timing Contract:** Canonical `SET_BEAT_DELAY` multiplier (`0.25` = `100ms`, `0.5` = `200ms`, `1` = `400ms`), `PLAY_NOTE` pitches `1..8` C Major with valid durations `[0.5, 1, 2]`. Strictly **no variables `a–z`**.

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `SET_LED`, `SET_CURSOR_COLOR` (`0..9`, `Black (8)` = Erase `⊘`), `CURSOR_STEP`, `CURSOR_TURN [Left / Right]`, `SET_BEAT_DELAY`, `WAIT_BEAT`, `PLAY_NOTE`, `DRUM_KICK`, `DRUM_SNARE`, `DRUM_CLAP`, `PLAY_CHIME`, `CALL_FN` (`F1`, `F2`) |
| **`allowedControlBlocks`** | `LOOP_START` (+ `END_LOOP`), `WHILE` (+ `END_WHILE`), `IF`, `ELSE_IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `cursorAtEdge` (`0x2A`), `$input` (`🎛️` `1..3`) |
| **`allowedCombinators`** | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `true` / `true` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN`, `F1`, `F2` / `false` / `false` |
| **`slotCap`** | `Starter`: `<= 14/tab`; `Vars`: `perScope: 16` (`Var 3` Showcase `<= 24/tab`) |

---

## 2. Starter & 3 Creative Variation Cards (All Verified `bonks: 0`)

### Starter — **Border Chaser Synth** (`MAIN: 9` flat blocks)
- **Result (`8×8`):** `28 / 28` outer border LEDs lit, `28` notes, `62` steps, ends `(1, 1, East)`, **`bonks: 0`**.
```text
// MAIN (9 flat blocks)
SET_BEAT_DELAY [0.25]
SET_CURSOR_COLOR [Cyan]
Loop [4]
  While (NOT cursorAtEdge)
    CURSOR_STEP
    PLAY_NOTE [4, 0.5]
  End While
  CURSOR_TURN [Right]
End Loop
```

### Variation 1 — **4-Color Corner Groove** (`MAIN: 13 + F1: 5 = 18` flat blocks)
- **Result (`8×8`):** `28 / 28` multicolor border LEDs, distinct drum hit on every corner (`69` steps, ends `(1, 1, East)`, **`bonks: 0`**).
```text
// MAIN (13 flat blocks)
SET_BEAT_DELAY [0.25]
SET_CURSOR_COLOR [Cyan]
CALL_FN [F1]
DRUM_KICK
SET_CURSOR_COLOR [Pink]
CALL_FN [F1]
DRUM_SNARE
SET_CURSOR_COLOR [Amber]
CALL_FN [F1]
DRUM_CLAP
SET_CURSOR_COLOR [Green]
CALL_FN [F1]
PLAY_CHIME

// F1 (5 flat blocks)
While (NOT cursorAtEdge)
  CURSOR_STEP
  PLAY_NOTE [5, 0.5]
End While
CURSOR_TURN [Right]
```

### Variation 2 — **Full-Matrix Snake Sweep (`While` + `If`)** (`MAIN: 14 + F1: 3 = 17` flat blocks)
- **Result (`8×8`):** Lights all **`64 / 64`** LEDs boustrophedon-style across rows `1..8`, `81` steps, ends `(1, 8, East)`, **`bonks: 0`** (demonstrating `If (NOT cursorAtEdge)` guarding row 8's South exit!).
```text
// MAIN (14 flat blocks)
SET_CURSOR_COLOR [Purple]
SET_LED [1, 1, Purple]
Loop [4]
  CALL_FN [F1]
  CURSOR_TURN [Right]
  CURSOR_STEP
  CURSOR_TURN [Right]
  CALL_FN [F1]
  CURSOR_TURN [Left]
  If (NOT cursorAtEdge)
    CURSOR_STEP
  End If
  CURSOR_TURN [Left]
End Loop

// F1 (3 flat blocks)
While (NOT cursorAtEdge)
  CURSOR_STEP
End While
```

### Variation 3 (Showcase) — **`🎛️ $input` Edge-Runner Studio (`1..3`)** (`MAIN: 23 + F1: 6 + F2: 12 = 41`)
- **`$input == 1` (`69` steps):** 4-Color Musical Border Chase (`28` LEDs, `28` notes, `4` kicks).
- **`$input == 2` (`82` steps):** Blue Full-Matrix `64/64` Snake Sweep (`F2`).
- **`$input == 3` (`66` steps):** Half-Border Draw + `Black (8)` Erase (`⊘`) Snare Wipe (`14` LEDs, `14` notes, `16` snares, `bonks: 0`).
```text
// MAIN (23 flat blocks)
SET_BEAT_DELAY [0.25]
If ($input == 1)
  SET_CURSOR_COLOR [Cyan]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Amber]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Pink]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Green]
  CALL_FN [F1]
Else If ($input == 2)
  SET_CURSOR_COLOR [Blue]
  CALL_FN [F2]
Else
  SET_CURSOR_COLOR [Red]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Purple]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Black]
  Loop [2]
    While (NOT cursorAtEdge)
      CURSOR_STEP
      DRUM_SNARE
    End While
    CURSOR_TURN [Right]
  End Loop
End If

// F1 (6 flat blocks)
While (NOT cursorAtEdge)
  CURSOR_STEP
  PLAY_NOTE [5, 0.5]
End While
CURSOR_TURN [Right]
DRUM_KICK

// F2 (12 flat blocks)
SET_LED [1, 1, Blue]
Loop [4]
  While (NOT cursorAtEdge)
    CURSOR_STEP
  End While
  CURSOR_TURN [Right]
  CURSOR_STEP
  CURSOR_TURN [Right]
  While (NOT cursorAtEdge)
    CURSOR_STEP
  End While
  CURSOR_TURN [Left]
  If (NOT cursorAtEdge)
    CURSOR_STEP
  End If
  CURSOR_TURN [Left]
End Loop
```
