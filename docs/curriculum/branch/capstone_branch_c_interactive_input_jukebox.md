# `branch.C` — `🏆 🎨 🎵` Capstone: Interactive `$input` Jukebox

- **Slug / Legacy Alias:** `branch.C` *(Consolidates `branch.11` *(Idea)* + `5C` into one non-duplicated Beat Jukebox Capstone)*
- **Order:** `21` (`🏆 🎨 🎵` Beat & Light Pad Capstone)
- **Environment:** `beat` (`8×8` Core Grid + `C4–C5` Audio Notes)
- **One-Concept Goal:** Turn **`🎛️ $input`** (`1..4` numbers or color swatches) + **`IF / ELSE IF / ELSE`** + **`[MAIN, F1, F2, F3]`** into a live multi-track musical light jukebox with `Loop (∞)` ON and clean `$input`-change audio/LED resets!

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Trophy + Music badge (`🏆 🎵`), Top-Dock **`🎛️ $input`** (`[1] [2] [3] [4]`, switching to `🔴 🔵 🟢 🟡` swatches in Variation 3), **`🔁 Loop (∞)` toggled ON by default**, `[MAIN, F1, F2, F3]` tabs, and `3` clickable **Variation Cards**.
- **Strict Beat Pad & Audio Hygiene (`docs/envs/beat_light.md`):**
  - Core grid strictly **`1..8 × 1..8`**; musical pitches strictly **`1..8` (`C4–C5`)**.
  - Cursor reticle at `(1,1)` remains **hidden** (absolute `SET_LED_XY (x, y)` + `STAMP_PRESET (0..7)` only; zero cursor walk ops).
  - **`STAMP_PRESET (0..7)`** always executes **before** individual `SET_LED_XY` / `CLEAR_PAD` overlays (`SET_BEAT_DELAY 0` instant paint vs `SET_BEAT_DELAY 1` `1×` 400ms beat).
  - **`SET_LED_COLOR [Black]`** renders semantic **`⊘` off-pad** indicator (Variation 2).
  - **Clean Beat Reset:** Changing `$input` during live playback immediately halts lingering voices and clears LEDs before starting the newly selected track cleanly from step 1!

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Now your `IF / ELSE IF / ELSE` switchboard powers a **live 4-track Beat & Light Jukebox**! With **Loop (`🔁`)** turned on, tap `[1]`, `[2]`, `[3]`, or `[4]` on the `$input` bar while music plays — the pad resets cleanly and jumps straight into the matching song and pixel light show in `F1`, `F2`, or `F3`! *(And look ahead: in Module `while`, you'll also check `hasNextItem` inside `Switchyard`.)*

</details>

---

## 2. Palette, Sensors & Beat Contract

```json
{
  "isCapstone": true,
  "isSandbox": true,
  "allowedScopes": ["MAIN", "F1", "F2", "F3"],
  "allowRecursion": false,
  "allowedSimBlocks": [
    "PLAY_NOTE", "REST", "SET_LED_XY", "SET_LED_COLOR",
    "STAMP_PRESET", "CLEAR_PAD", "SET_BEAT_DELAY", "CALL_FN"
  ],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "IF", "ELSE_IF", "ELSE", "END_IF"],
  "allowedSensors": ["$input"],
  "allowedCombinators": ["OR", "NOT"],
  "inputConfig": {
    "mode": "int",
    "min": 1,
    "max": 4,
    "options": [1, 2, 3, 4],
    "previewInput": 1
  },
  "beatRules": {
    "gridSize": 8,
    "pitchRange": [1, 8],
    "stampPresetRange": [0, 7],
    "stepDelayMultipliersAllowed": [0, 1],
    "isLoopingDefault": true,
    "hideReticleWhenUnused": true,
    "cleanResetOnInputChange": true
  },
  "slotCap": { "MAIN": 22, "F1": 22, "F2": 22, "F3": 22 },
  "editDelta": "free (>= 1 edit or live $input track switch)"
}
```

---

## 3. Starter Jukebox — 4-Track Pocket Synth (`Total: 39` Flat Blocks)

```text
MAIN (13 flat blocks):
1.  IF ($input == 1)
2.    CALL_FN (F1)
3.  ELSE_IF ($input == 2)
4.    CALL_FN (F2)
5.  ELSE_IF ($input == 3)
6.    CALL_FN (F3)
7.  ELSE
8.    STAMP_PRESET (6)
9.    SET_BEAT_DELAY (1)
10.   PLAY_NOTE (1)
11.   PLAY_NOTE (5)
12.   CLEAR_PAD
13. END_IF

F1 (9 flat blocks — Track 1: Happy Sun Arpeggio):
1. STAMP_PRESET (2)
2. SET_BEAT_DELAY (0)
3. SET_LED_XY (4, 4, Yellow)
4. SET_LED_XY (5, 4, Yellow)
5. SET_BEAT_DELAY (1)
6. PLAY_NOTE (1)
7. PLAY_NOTE (3)
8. PLAY_NOTE (5)
9. PLAY_NOTE (8)

F2 (8 flat blocks — Track 2: Cozy Cyan Raindrop):
1. STAMP_PRESET (4)
2. SET_BEAT_DELAY (1)
3. PLAY_NOTE (6)
4. SET_LED_XY (2, 3, Cyan)
5. PLAY_NOTE (4)
6. SET_LED_XY (6, 5, Blue)
7. PLAY_NOTE (1)
8. REST

F3 (9 flat blocks — Track 3: Arcade Bass Groove):
1. STAMP_PRESET (1)
2. SET_BEAT_DELAY (1)
3. LOOP_START (2)
4.   PLAY_NOTE (1)
5.   PLAY_NOTE (5)
6.   PLAY_NOTE (8)
7.   REST
8. LOOP_END
9. CLEAR_PAD
```

---

## 4. Variation Cards (`3` Clickable Musical Remixes)

### Variation 1 — Remix Equalizer (`OR` Corner Strobe)
- **Concept:** Uses `IF ($input == 1 OR $input == 4)` in `MAIN` to paint Amber corner lights `(1,1)` and `(8,8)` instantly (`SET_BEAT_DELAY 0`) before dispatching `F1` (`1`), `F2` (`2/3`), or `F3` (`4`).
- **Bounds Check:** LED coords `(1,1)`, `(8,8)`, `(4,5)` all `∈ 1..8`; notes `1, 3, 5, 6, 8` all `∈ 1..8`.

### Variation 2 — Day / Night Visualizer (`NOT` + `SET_LED_COLOR [Black]` `⊘`)
- **Concept:** When `NOT ($input == 3)`, plays bright golden stamp (`STAMP_PRESET 3`) + `F1` melody (`5, 6, 8`); when `$input == 3` ("Midnight Quiet"), calls `F2` which clears `(4,4)` and `(5,5)` with **`SET_LED_COLOR [Black]` (`⊘`)** and plays gentle low bass (`1, 2, 1`).
- **Bounds Check:** `STAMP_PRESET 3` executes strictly before `SET_LED_COLOR [Black]` overlays; all coords `∈ 1..8`, notes `1..8`.

### Variation 3 — Color Swatch Jukebox (`$inputConfig.mode: "color"`)
- **`inputConfig`:** `{ "mode": "color", "options": ["red", "blue", "green", "yellow"], "previewInput": "red" }`
- **Tracks:**
  - `Red` → `STAMP_PRESET 0` + Rock Rhythm (`F1`: `1, 1, 5, 1`)
  - `Blue` → `STAMP_PRESET 5` + Chill Synth (`F2`: `8, 6, 4, 2`)
  - `Green` → `STAMP_PRESET 7` + Nature Chime (`F3`: `3, 5, 7, 8`)
  - `Yellow` → `STAMP_PRESET 2` + Brass Fanfare (`PLAY_NOTE 1, 5, 8, 8`)
