# Lesson `tape.4a` — Custom Tape Sprite Stamp (`STAMP_FROM_TAPE` `📼→🟦`)

- **Format:** 🎨 Creative Sandbox
- **Environment:** 🎵 Beat & Light (`BEAT_VERSION = 2`, `1D` Top-Dock `TapeDock` + Beat Popover **`🟦 8×8 Sprite View`**, `$tapeLength >= 192`)
- **One-Concept Goal:** Pack `8×8 = 64` color cells onto the Memory Tape, paint them live with **`STAMP_FROM_TAPE [startIndex]`** (`OP_BEAT_STAMP_FROM_TAPE 0x1F`), and distinguish **`∅` transparent skip** from **`Black` (`8` `⊘`) active erase**.

---

## Guided Co-Pilot Card

Sixty-four Tape cells in a row make one **8×8 pixel picture**! Open **`🟦 8×8 Sprite View`** inside the top **Tape Dock** to draw your own rocket or alien, leave corners **`∅` empty** so backgrounds shine through, and stamp animated frames in one block!

---

## Capabilities & Sprite Memory Contract

```json
{
  "env": "beat_light",
  "mode": "creative_sandbox",
  "binaryOpcode": "OP_BEAT_STAMP_FROM_TAPE (0x1F)",
  "tape": {
    "length": 10000,
    "minPopulatedSpan": 192,
    "window": "1..8 (1D Top Dock) + Popover 🟦 8×8 Sprite View (#1..#64 grid)",
    "transparencyRule": "Empty ∅ skips pixel (keeps backdrop LED intact); Black (8, ⊘) actively paints dark/erases; numeric cell inside 64-cell window raises TYPE_ERROR & scrolls dock to #k"
  },
  "actions": ["SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR", "LIGHT_ROW", "LIGHT_COL", "STAMP_FROM_TAPE", "DRUM_KICK", "DRUM_SNARE", "PLAY_CHIME", "PLAY_NOTE", "WAIT_BEAT", "VAR_ASSIGN", "VAR_OP"],
  "starterBudget": { "MAIN": 8, "slotCap": 20 }
}
```

---

## Starter Workspace — Pixel Rocket over Starlight (`Cells 1..64`)

**8×8 Sprite Layout (`1..64`, row-major `#1..#8` = top row .. `#57..#64` = bottom row):**

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **R1 (`1..8`)** | `∅` | `∅` | `∅` | 🔴 | 🔴 | `∅` | `∅` | `∅` |
| **R2 (`9..16`)** | `∅` | `∅` | 🔴 | ⚪ | ⚪ | 🔴 | `∅` | `∅` |
| **R3 (`17..24`)** | `∅` | `∅` | ⚪ | 🩵 | 🩵 | ⚪ | `∅` | `∅` |
| **R4 (`25..32`)** | `∅` | `∅` | ⚪ | ⚪ | ⚪ | ⚪ | `∅` | `∅` |
| **R5 (`33..40`)** | `∅` | 🔴 | ⚪ | ⚪ | ⚪ | ⚪ | 🔴 | `∅` |
| **R6 (`41..48`)** | `∅` | 🔴 | `∅` | ⚪ | ⚪ | `∅` | 🔴 | `∅` |
| **R7 (`49..56`)** | `∅` | `∅` | `∅` | 🟠 | 🟠 | `∅` | `∅` | `∅` |
| **R8 (`57..64`)** | `∅` | `∅` | `∅` | 🟡 | 🟡 | `∅` | `∅` | `∅` |

Notice rows 7–8 (`Blue` horizon) shine around the orange/yellow flame because margins are `∅` empty!

### Canonical Pseudocode (`MAIN` — `8` flat blocks)

```text
// MAIN (8 flat blocks)
SET_BEAT_DELAY [0]
CLEAR_LEDS
SET_LED_COLOR [blue]
LIGHT_ROW [7]
LIGHT_ROW [8]
STAMP_FROM_TAPE [1]
PLAY_CHIME
WAIT_BEAT [1]
```

### Canonical JSON AST (`Starter`)

```json
{
  "slotCap": 12,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "blue" },
    { "op": "LIGHT_ROW", "row": 7 },
    { "op": "LIGHT_ROW", "row": 8 },
    { "op": "STAMP_FROM_TAPE", "value": 1 },
    { "op": "PLAY_CHIME" },
    { "op": "WAIT_BEAT", "beats": 1 }
  ]
}
```

---

## Variation Cards (`1..3`)

### Variation 1 — 2-Frame Dancing Alien (`1..64` Arms Down & `65..128` Arms Up)

**Tape (`1..128`):** Cells `1..64` = `Green` alien with arms down (`#25`, `#32`, `#33`, `#40` `∅`); cells `65..128` = `Green` alien with arms raised (`#17`, `#24` `Green` instead).

```text
// MAIN (9 flat blocks)
SET_BEAT_DELAY [0]
Loop [4]
  CLEAR_LEDS
  STAMP_FROM_TAPE [1]
  DRUM_KICK
  CLEAR_LEDS
  STAMP_FROM_TAPE [65]
  DRUM_SNARE
End Loop
```

```json
{
  "slotCap": 12,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "STAMP_FROM_TAPE", "value": 1 },
        { "op": "DRUM_KICK" },
        { "op": "CLEAR_LEDS" },
        { "op": "STAMP_FROM_TAPE", "value": 65 },
        { "op": "DRUM_SNARE" }
      ]
    }
  ]
}
```

### Variation 2 — Sticker Mask (`∅` Transparent Margins vs `Black` `⊘` Shadow Outline)

**Tape (`1..64`):** Crown/Heart sticker whose outer `1`-cell rim is **`∅`** (preserves rainbow columns) and whose inner border ring is **`Black` (`8` `⊘`)** (carves crisp black shadow outline over rainbow!).

```text
// MAIN (17 flat blocks)
SET_BEAT_DELAY [0]
CLEAR_LEDS
SET_LED_COLOR [cyan]
LIGHT_COL [1]
LIGHT_COL [2]
SET_LED_COLOR [blue]
LIGHT_COL [3]
LIGHT_COL [4]
SET_LED_COLOR [purple]
LIGHT_COL [5]
LIGHT_COL [6]
SET_LED_COLOR [pink]
LIGHT_COL [7]
LIGHT_COL [8]
STAMP_FROM_TAPE [1]
PLAY_CHIME
WAIT_BEAT [1]
```

```json
{
  "slotCap": 20,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "cyan" },
    { "op": "LIGHT_COL", "col": 1 },
    { "op": "LIGHT_COL", "col": 2 },
    { "op": "SET_LED_COLOR", "color": "blue" },
    { "op": "LIGHT_COL", "col": 3 },
    { "op": "LIGHT_COL", "col": 4 },
    { "op": "SET_LED_COLOR", "color": "purple" },
    { "op": "LIGHT_COL", "col": 5 },
    { "op": "LIGHT_COL", "col": 6 },
    { "op": "SET_LED_COLOR", "color": "pink" },
    { "op": "LIGHT_COL", "col": 7 },
    { "op": "LIGHT_COL", "col": 8 },
    { "op": "STAMP_FROM_TAPE", "value": 1 },
    { "op": "PLAY_CHIME" },
    { "op": "WAIT_BEAT", "beats": 1 }
  ]
}
```

### Variation 3 — `3-2-1` Blastoff Countdown (`1..192` Multi-Frame Offset Loop)

**Tape (`1..192`):** `1..64` = Yellow `"3"`, `65..128` = Orange `"2"`, `129..192` = Red `"1"`; loop advances sprite start offset `s = s + 64` and pitch `n = n + 2`.

```text
// MAIN (14 flat blocks)
SET_BEAT_DELAY [0]
s = 1
n = 1
Loop [3]
  CLEAR_LEDS
  STAMP_FROM_TAPE [s]
  PLAY_NOTE [n, 1]
  s = s + 64
  n = n + 2
End Loop
CLEAR_LEDS
SET_LED_COLOR [yellow]
LIGHT_ROW [4]
PLAY_CHIME
```

```json
{
  "slotCap": 18,
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "s", "value": 1 },
    { "op": "VAR_ASSIGN", "var": "n", "value": 1 },
    {
      "op": "LOOP",
      "count": 3,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "STAMP_FROM_TAPE", "value": "s" },
        { "op": "PLAY_NOTE", "pitch": "n", "duration": 1 },
        { "op": "VAR_OP", "target": "s", "left": "s", "operator": "+", "right": 64 },
        { "op": "VAR_OP", "target": "n", "left": "n", "operator": "+", "right": 2 }
      ]
    },
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "yellow" },
    { "op": "LIGHT_ROW", "row": 4 },
    { "op": "PLAY_CHIME" }
  ]
}
```

---

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why `1D` Top Dock + `🟦 8×8 Sprite View` Popover:** Keeping the main `TapeDock` single-row (`7–9` visible cells, `shrink-0`) preserves `>= 200px` canvas/matrix height on mobile, while opening Beat's optional `🟦 8×8 Sprite View` popover lets kids paint sprites effortlessly and immediately jump/scroll to cell `#k` if a numeric value sneaks into cells `s..s+63` (`TYPE_ERROR`).
- **Curriculum Link (`tape.C` & `anim.8a`):** Introducing `STAMP_FROM_TAPE`, `∅` vs `Black` masking, and `+64` frame offsets here directly unlocks `tape.C` Variation 2 (dancing mascot) and `anim.8a` (multi-frame sprite animation) later.

</details>
