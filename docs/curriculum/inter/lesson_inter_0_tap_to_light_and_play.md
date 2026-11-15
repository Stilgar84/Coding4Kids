# Lesson `inter.0`: Tap to Light & Play (`🎵` Beat & Light Matrix `8×8`)

- **Type:** `📖` Explanation & Guided Demo (`inter` Track Kickoff)
- **Previous:** [Module `inter` Overview](./overview.md) | **Next:** [`inter.1` Multi-Zone X/Y Synth](./lesson_inter_1_multi_zone_xy_synth.md)

| Metadata | Value |
|---|---|
| Environment & Mode | `🎵` Beat & Light Matrix (`8×8` Grid, coords `1..8 × 1..8`) |
| New Blocks Unlocked | `+ ⚡` Tab **`0x40 ON_TAP`** (`👆`), Sensors **`0x93 $pointerX`**, **`0x94 $pointerY`** |
| Visible Event Tabs | `MAIN` (`▶️`), `ON_TAP` (`👆`) |
| Flat Block Budget | Demo 1: `2` \| Demo 2: `4` \| Guided Try-It: `5` (`slotCap: 8`) |

---

## 1. Visual Concept Card (`👆` Event Tab vs. `▶️` MAIN)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Tap the **`+ ⚡` (`👆`)** tab to wake blocks ONLY when your finger touches the glowing grid! Look how **`👆X`** picks the note and **`👆Y`** picks the row.

<details>
<summary>📖 Parent / Teacher Tip</summary>

Notice that **zero blocks sit inside `MAIN` (`▶️`)**. Unlike earlier lessons that ran once from top to bottom and stopped, programs with an `ON_TAP` (`0x40`) tab stay awake and wait silently in the event queue until the child taps or clicks anywhere on the `8×8` matrix. `$pointerX` (`0x93`) maps horizontally from `1` (left) to `8` (right, matching C Major notes `1..8`), and `$pointerY` (`0x94`) maps vertically from `1` (top) to `8` (bottom).

</details>

---

## 2. Walkthrough Demos (`📖` Two Step-by-Step Examples)

### Demo 1 — Instant Finger Piano (`2` flat blocks)

Each tap lights the exact LED under the finger and plays the column's C Major pitch (`1..8`).

```text
// ON_TAP (0x40)
LIGHT_PIXEL [$pointerX, $pointerY]
PLAY_NOTE [$pointerX, 0.5]
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 4,
  "MAIN": [],
  "ON_TAP": [
    { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
    { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.5 }
  ]
}
```

### Demo 2 — Single-Dot Spotlight & Chime (`4` flat blocks)

Adding `CLEAR_LEDS` and `SET_LED_COLOR [$randomColor]` turns overlapping piano notes into a crisp moving spotlight whose pitch climbs upward (`$pointerY`).

```text
// ON_TAP (0x40)
CLEAR_LEDS
SET_LED_COLOR [$randomColor]
LIGHT_PIXEL [$pointerX, $pointerY]
PLAY_NOTE [$pointerY, 0.5]
```

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "slotCap": 6,
  "MAIN": [],
  "ON_TAP": [
    { "op": "CLEAR_LEDS" },
    { "op": "SET_LED_COLOR", "color": "$randomColor" },
    { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
    { "op": "PLAY_NOTE", "pitch": "$pointerY", "duration": 0.5 }
  ]
}
```

---

## 3. Guided Hands-On Try-It (`🎯` Crosshair Chime Pad)

> **Guided Co-Pilot Card (Read-Aloud, <= 2 sentences):**  
> Tap a square to light a rainbow dot — now add one **`LIGHT_ROW [👆Y]`** block inside **`👆`** so the whole row glows like a piano key!

### Challenge & Palette Spec (`Edit Delta: 2` — swap pitch to `$pointerX` and insert `LIGHT_ROW`)

```json
{
  "env": "beat",
  "sizePreset": 0,
  "grid": "8x8",
  "allowedTabs": ["MAIN", "ON_TAP"],
  "allowedSimBlocks": [
    "CLEAR_LEDS",
    "SET_LED_COLOR",
    "LIGHT_PIXEL",
    "LIGHT_ROW",
    "LIGHT_COL",
    "PLAY_NOTE"
  ],
  "allowedSensors": ["$pointerX", "$pointerY", "$randomColor"],
  "slotCap": 8,
  "initial": {
    "MAIN": [],
    "ON_TAP": [
      { "op": "CLEAR_LEDS" },
      { "op": "SET_LED_COLOR", "color": "cyan" },
      { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
      { "op": "PLAY_NOTE", "pitch": "$pointerY", "duration": 0.5 }
    ]
  },
  "solution": {
    "MAIN": [],
    "ON_TAP": [
      { "op": "CLEAR_LEDS" },
      { "op": "SET_LED_COLOR", "color": "$randomColor" },
      { "op": "LIGHT_ROW", "row": "$pointerY" },
      { "op": "LIGHT_PIXEL", "x": "$pointerX", "y": "$pointerY" },
      { "op": "PLAY_NOTE", "pitch": "$pointerX", "duration": 0.5 }
    ]
  }
}
```

### Verification Checklist
- [ ] **No blocks inside `MAIN`:** Tapping `▶️` enters event-idle state; nothing runs until `ON_TAP` fires.
- [ ] **Touch / Mouse Parity:** Tapping `(x=1, y=8)` lights row `8` in a random color and plays pitch `1` (Low C); tapping `(x=8, y=2)` lights row `2` and plays pitch `8` (High C).
- [ ] **Block Count:** `ON_TAP` holds `5` flat blocks (`<= slotCap 8`).
