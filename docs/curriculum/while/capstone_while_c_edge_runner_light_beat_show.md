# Capstone while.C: Edge-Runner Light & Beat Show

**ID:** `while.C` · **Format:** 🎨 Creative Synthesis Capstone (`Starter + 3 Variation Cards`) · **Env:** [Beat & Light](../../envs/beat_light.md)
**One-Concept Goal:** Compose variable-free light and rhythm shows on the `8×8` grid combining `While (NOT cursorAtEdge)`, `If (NOT cursorAtEdge)` end-guards, `Black (8)` Erase (`⊘`) sweeps, percussion accents, and the `🎛️ $input` dial.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

> This finale pulls together everything from `while.7` plus `Black (8)` = Erase (`⊘`) and `🎛️ $input` mode switching! In **Starter**, Cyan chimes paint the entire 28-LED border and then a dark `Black (8)` pass erases the frame pixel-by-pixel right behind it. In **Variation 3 (`$input = 4`)**, the cursor fills all `64` tiles Purple from top to bottom and then sweeps counter-clockwise around the outer edge with `Black (8)` to reveal a glowing `6×6` inner stage!
> *(Learner Workspace Rule: **0** learner-facing words — directional reticle, Black `⊘` swatch, soft edge-clamp feedback, and `🎛️ $input` auto-rerun drive everything visually.)*

</details>

---

## 1. Env Setup & Constraints ([Beat & Light](../../envs/beat_light.md))

- **Matrix:** `8×8` Core (`1..8 × 1..8`; stretches cleanly to `16×16` / `32×32` in Pro Sandbox!).
- **Cursor Reset:** `(x: 1, y: 1, dir: East)` (`cursorAtEdge == false`), directional reticle enabled; **soft edge-clamp** (zero hard `COLLISION`), all presets verified **`bonks: 0`**.
- **Audio & Palette:** C Major pitches `1..8`, valid `PLAY_NOTE` durations `[0.5, 1, 2]`, `SET_BEAT_DELAY [0.25]` (`100ms`), `Black (8)` = Erase (`⊘`), strictly **no variables `a–z`**.

| Property | Specification |
| :--- | :--- |
| **`allowedSimBlocks`** | `SET_LED`, `SET_CURSOR_COLOR` (`0..9`, `Black (8)` = Erase `⊘`), `CURSOR_STEP`, `CURSOR_TURN [Left / Right]`, `SET_BEAT_DELAY`, `WAIT_BEAT`, `PLAY_NOTE`, `DRUM_KICK`, `DRUM_SNARE`, `DRUM_CLAP`, `PLAY_CHIME`, `CALL_FN` (`F1`, `F2`, `F3`) |
| **`allowedControlBlocks`** | `LOOP_START` (+ `END_LOOP`), `WHILE` (+ `END_WHILE`), `IF`, `ELSE_IF`, `ELSE`, `END_IF` |
| **`allowedSensors`** | `cursorAtEdge` (`0x2A`), `$input` (`🎛️` `1..4`) |
| **`allowedCombinators`** | `[NOT]` |
| **`allowRepeatBadges` / `allowActionParams`** | `true` / `true` |
| **`allowedScopes` / `allowVariables` / `allowRecursion`** | `MAIN`, `F1`, `F2`, `F3` / `false` / `false` |
| **`slotCap`** | `Starter / Var 1`: `<= 14/tab`; `Var 2`: `<= 20/tab`; `Var 3 Showcase`: `<= 26/tab` |

---

## 2. Starter & 3 Creative Variation Cards (All Verified `bonks: 0`)

### Starter — **Erase-and-Chime Chase** (`MAIN: 9 + F1: 6 + F2: 4 = 19` flat blocks)
- **Result (`8×8`):** Paints all `28` border LEDs Cyan with chimes, then wipes them dark (`0` lit) returning cleanly to `(1, 1, East)` in `99` steps (`bonks: 0`).
```text
// MAIN (9 flat blocks)
SET_BEAT_DELAY [0.25]
SET_CURSOR_COLOR [Cyan]
Loop [4]
  CALL_FN [F1]
End Loop
SET_CURSOR_COLOR [Black]
Loop [4]
  CALL_FN [F2]
End Loop

// F1 (6 flat blocks)
While (NOT cursorAtEdge)
  CURSOR_STEP
  PLAY_NOTE [4, 0.5]
End While
CURSOR_TURN [Right]
PLAY_CHIME

// F2 (4 flat blocks)
While (NOT cursorAtEdge)
  CURSOR_STEP
End While
CURSOR_TURN [Right]
```

### Variation 1 — **Dual-Color Checker Chase** (`MAIN: 4 + F1: 12 = 16` flat blocks)
- **Result (`8×8`):** Alternates Pink & Cyan along every edge step (`28` LEDs, `28` notes, `4` corner kicks, `93` steps, ends `(1, 1, East)`, `bonks: 0`).
```text
// MAIN (4 flat blocks)
SET_BEAT_DELAY [0.25]
Loop [4]
  CALL_FN [F1]
End Loop

// F1 (12 flat blocks)
While (NOT cursorAtEdge)
  SET_CURSOR_COLOR [Pink]
  CURSOR_STEP
  PLAY_NOTE [5, 0.5]
  If (NOT cursorAtEdge)
    SET_CURSOR_COLOR [Cyan]
    CURSOR_STEP
    PLAY_NOTE [7, 0.5]
  End If
End While
CURSOR_TURN [Right]
DRUM_KICK
```

### Variation 2 — **Full-Pad Rainbow Snake Disco** (`MAIN: 18 + F1: 7 + F2: 11 = 36` flat blocks)
- **Result (`8×8`):** Sweeps **all `64 / 64` LEDs** across 8 rainbow bands (`Red/Amber/Green/Cyan/Blue/Purple/Pink/Amber`) with melodic row notes & turn-corner drums (`152` steps, ends `(1, 8, East)`, `bonks: 0`).
```text
// MAIN (18 flat blocks)
SET_BEAT_DELAY [0.25]
SET_LED [1, 1, Red]
SET_CURSOR_COLOR [Red]
CALL_FN [F1]
SET_CURSOR_COLOR [Amber]
CALL_FN [F2]
SET_CURSOR_COLOR [Green]
CALL_FN [F1]
SET_CURSOR_COLOR [Cyan]
CALL_FN [F2]
SET_CURSOR_COLOR [Blue]
CALL_FN [F1]
SET_CURSOR_COLOR [Purple]
CALL_FN [F2]
SET_CURSOR_COLOR [Pink]
CALL_FN [F1]
SET_CURSOR_COLOR [Amber]
CALL_FN [F2]

// F1 (7 flat blocks — East sweep + South drop)
While (NOT cursorAtEdge)
  CURSOR_STEP
  PLAY_NOTE [5, 0.5]
End While
CURSOR_TURN [Right]
CURSOR_STEP
DRUM_KICK
CURSOR_TURN [Right]

// F2 (11 flat blocks — West sweep + guarded South drop)
While (NOT cursorAtEdge)
  CURSOR_STEP
  PLAY_NOTE [6, 0.5]
End While
CURSOR_TURN [Left]
If (NOT cursorAtEdge)
  CURSOR_STEP
  DRUM_SNARE
End If
CURSOR_TURN [Left]
```

### Variation 3 (Showcase) — **`🎛️ $input` Adaptive Groove Pad (`1..4`)** (`MAIN: 26 + F1: 5 + F2: 12 + F3: 6`)
- **`$input == 1` (`66` steps):** Cyan Border Pulse (`28` LEDs, `28` notes, `4` kicks).
- **`$input == 2` (`82` steps):** Amber Full-Matrix `64/64` Snake Fill (`F2`).
- **`$input == 3` (`69` steps):** 4-Color Rainbow Edge Show (`Pink`, `Cyan`, `Amber`, `Green`, `28` LEDs).
- **`$input == 4` (`143` steps):** Purple Full-Pad Fill → Counter-Clockwise `Black (8)` Erase (`⊘`) Border Wipe carving a glowing **`6×6` (`36`-LED) inner square** (`28` snares, `bonks: 0`)!
```text
// MAIN (26 flat blocks)
SET_BEAT_DELAY [0.25]
If ($input == 1)
  SET_CURSOR_COLOR [Cyan]
  Loop [4]
    CALL_FN [F1]
  End Loop
Else If ($input == 2)
  SET_LED [1, 1, Amber]
  SET_CURSOR_COLOR [Amber]
  CALL_FN [F2]
Else If ($input == 3)
  SET_CURSOR_COLOR [Pink]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Cyan]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Amber]
  CALL_FN [F1]
  SET_CURSOR_COLOR [Green]
  CALL_FN [F1]
Else
  SET_LED [1, 1, Purple]
  SET_CURSOR_COLOR [Purple]
  CALL_FN [F2]
  SET_CURSOR_COLOR [Black]
  Loop [4]
    CALL_FN [F3]
  End Loop
End If

// F1 (5 flat blocks — Musical Border Leg)
While (NOT cursorAtEdge)
  CURSOR_STEP
  PLAY_NOTE [5, 0.5]
End While
CURSOR_TURN [Right]
DRUM_KICK

// F2 (12 flat blocks — Silent Snake Fill)
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

// F3 (6 flat blocks — Counter-Clockwise Erase Sweep)
While (NOT cursorAtEdge)
  CURSOR_STEP
  DRUM_SNARE
End While
CURSOR_TURN [Left]
```
