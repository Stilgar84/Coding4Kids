# `anim.8a`: Multi-Frame Sprite Sheet (`🎨` Creative Sandbox)

- **World:** 🎵 Beat & Light Matrix (`8×8` + Sparse Memory Tape, `BEAT_VERSION = 2`)
- **Card Type:** `🎨` Creative Sandbox (`Starter` + `3` Variation Cards)
- **Prerequisite:** [`anim.8`](./lesson_anim_8_animated_tape_equalizer.md)
- **Hardware Config:** `matrixSize: 8`, `beatVersion: 2`, `defaultLoopPlayback: true`, `$tapeLength = 256`
- **Block Budget (Closer-Inclusive):** `Starter: 9` (`Slot Cap: 14`; Var 1: `11 / 16`, Var 2: `10 / 14`, Var 3: `14 / 20`)

> **Guided Co-Pilot Card:**
> Store **4 crisp `8×8` frames** on the Tape at cells **`1, 65, 129, 193`**, peek at them inside **`🟦 8×8 Sprite View`**, and blit each frame in 1 tick with **`STAMP_FROM_TAPE`** (`i = i + 64`)!

<details>
<summary>📖 Parent / Teacher Tip — `STAMP_FROM_TAPE` Stride (`64` Cells) & `∅` Transparency</summary>

- **Zero Sprite Boilerplate (`$tapeLength = 256`):** In `tape`, learners learned `STAMP_FROM_TAPE` (`📼→🟦`) stamps an `8×8` (`64`-cell row-major) sprite starting at `headPos` while leaving `headPos` untouched. Advancing `i = i + 64` jumps cleanly between frames `1 → 65 → 129 → 193`!
- **`🟦 8×8 Sprite View` Popover:** Clicking any sprite frame anchor (`1`, `65`, `129`, `193`) in `TapeDock` opens an `8×8` pixel-art miniature grid editor so kids draw by painting swatches instead of counting linear cell numbers.
- **Transparent `∅` vs `Black` (`⊘`):** Empty cells (`∅`, omitted keys in sparse `cells`) **preserve** underlying LEDs (used in **Var 3** so a UFO glides across a starry sky without erasing stars), whereas `Black` cells actively turn LEDs off.

</details>

---

## Palette & Capabilities

```json
{
  "env": "beat",
  "matrixSize": 8,
  "beatVersion": 2,
  "defaultLoopPlayback": true,
  "allowVariables": true,
  "varNames": "a..z",
  "allowTape": true,
  "tapeMinLength": 256,
  "allowedBlocks": [
    "SET_BEAT_DELAY", "CLEAR_LEDS", "SET_LED_COLOR",
    "LIGHT_PIXEL", "STAMP_FROM_TAPE", "DRUM_KICK", "DRUM_SNARE",
    "PLAY_NOTE", "WAIT_BEAT", "LOOP_START",
    "VAR_ASSIGN", "VAR_OP", "TAPE_SEEK"
  ]
}
```

---

## Starter: Rocket Blastoff — 4-Frame `8×8` Sprite Sheet (`9` Flat Blocks)

```text
Frame 1 (Cell 1):   Frame 2 (Cell 65):  Frame 3 (Cell 129): Frame 4 (Cell 193):
. . . R . . . .     . . . R . . . .     . . . W . . . .     . . . R . . . .
. . W R W . . .     . . W W W . . .     . . R R R . . .     . C . W . . C .
. . W C W . . .     . . W C W . . .     . . W C W . . .     . . . O . . . .
. . W W W . . .     . . W W W . . .     . . W W W . . .     . . O Y O . . .
. R W W W R . .     . R W W W R . .     . R W W W R . .     . . . O . . . .
. R . O . R . .     . R O Y O R . .     . . O Y O . . .     C . . . . . . C
. . . . . . . .     . . . O . . . .     . . O . O . . .     . . . . . . . .
B B B B B B B B     B B B B B B B B     . . . . . . . .     . . . . . . . .
```

```text
// MAIN (9 flat blocks)
SET_BEAT_DELAY [0]
i = 1
Loop [4]
  CLEAR_LEDS
  TAPE_SEEK [i]
  STAMP_FROM_TAPE
  DRUM_KICK
  i = i + 64
End Loop
```

```json
{
  "slotCap": 14,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": {
    "length": 256,
    "cells": {
      "4": "red", "11": "white", "12": "red", "13": "white",
      "19": "white", "20": "cyan", "21": "white",
      "27": "white", "28": "white", "29": "white",
      "34": "red", "35": "white", "36": "white", "37": "white", "38": "red",
      "42": "red", "44": "orange", "46": "red",
      "57": "blue", "58": "blue", "59": "blue", "60": "blue", "61": "blue", "62": "blue", "63": "blue", "64": "blue",

      "68": "red", "75": "white", "76": "white", "77": "white",
      "83": "white", "84": "cyan", "85": "white",
      "91": "white", "92": "white", "93": "white",
      "98": "red", "99": "white", "100": "white", "101": "white", "102": "red",
      "106": "red", "107": "orange", "108": "yellow", "109": "orange", "110": "red",
      "116": "orange",
      "121": "blue", "122": "blue", "123": "blue", "124": "blue", "125": "blue", "126": "blue", "127": "blue", "128": "blue",

      "132": "white", "139": "red", "140": "red", "141": "red",
      "147": "white", "148": "cyan", "149": "white",
      "155": "white", "156": "white", "157": "white",
      "162": "red", "163": "white", "164": "white", "165": "white", "166": "red",
      "171": "orange", "172": "yellow", "173": "orange", "179": "orange", "181": "orange",

      "196": "red", "202": "cyan", "204": "white", "207": "cyan",
      "212": "orange", "219": "orange", "220": "yellow", "221": "orange",
      "228": "orange", "233": "cyan", "240": "cyan"
    }
  },
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "STAMP_FROM_TAPE" },
        { "op": "DRUM_KICK" },
        { "op": "VAR_OP", "target": "i", "operator": "+", "left": "i", "right": 64 }
      ]
    }
  ]
}
```

---

## Variation 1: Walking Pixel Dino (`11` Flat Blocks)

```text
// MAIN (11 flat blocks)
SET_BEAT_DELAY [0]
Loop [3]
  i = 1
  Loop [4]
    CLEAR_LEDS
    TAPE_SEEK [i]
    STAMP_FROM_TAPE
    DRUM_SNARE
    i = i + 64
  End Loop
End Loop
```

```json
{
  "slotCap": 16,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": {
    "length": 256,
    "cells": {
      "13": "green", "14": "green", "15": "green",
      "21": "green", "22": "yellow", "23": "green",
      "28": "green", "29": "green", "30": "green",
      "35": "green", "36": "green", "37": "green",
      "42": "green", "43": "green", "44": "green",
      "51": "green", "53": "green", "59": "green", "61": "green",

      "77": "green", "78": "green", "79": "green",
      "85": "green", "86": "yellow", "87": "green",
      "92": "green", "93": "green", "94": "green",
      "99": "green", "100": "green", "101": "green",
      "106": "green", "107": "green", "108": "green",
      "114": "green", "117": "green", "122": "green", "126": "green",

      "140": "green", "141": "green", "142": "green",
      "148": "green", "149": "yellow", "150": "green",
      "155": "green", "156": "green", "157": "green",
      "163": "green", "164": "green", "165": "green",
      "171": "green", "172": "green", "178": "green", "181": "green", "186": "green",

      "205": "green", "206": "green", "207": "green",
      "213": "green", "214": "yellow", "215": "green",
      "220": "green", "221": "green", "222": "green",
      "227": "green", "228": "green", "229": "green",
      "234": "green", "235": "green", "236": "green",
      "243": "green", "244": "green", "252": "green"
    }
  },
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
        {
          "op": "LOOP_START",
          "count": 4,
          "body": [
            { "op": "CLEAR_LEDS" },
            { "op": "TAPE_SEEK", "index": "i" },
            { "op": "STAMP_FROM_TAPE" },
            { "op": "DRUM_SNARE" },
            { "op": "VAR_OP", "target": "i", "operator": "+", "left": "i", "right": 64 }
          ]
        }
      ]
    }
  ]
}
```

---

## Variation 2: Chomping Pixel Critter (`10` Flat Blocks)

```text
// MAIN (10 flat blocks)
SET_BEAT_DELAY [0]
i = 1
Loop [4]
  CLEAR_LEDS
  TAPE_SEEK [i]
  STAMP_FROM_TAPE
  PLAY_NOTE [5, 0.25]
  WAIT_BEAT [0.25]
  i = i + 64
End Loop
```

```json
{
  "slotCap": 14,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": {
    "length": 256,
    "cells": {
      "11": "yellow", "12": "yellow", "13": "yellow", "14": "yellow",
      "18": "yellow", "19": "blue", "20": "yellow", "21": "yellow", "22": "yellow",
      "26": "yellow", "27": "yellow", "28": "yellow", "29": "yellow",
      "34": "yellow", "35": "yellow", "36": "yellow",
      "42": "yellow", "43": "yellow", "44": "yellow", "45": "yellow", "46": "yellow",
      "51": "yellow", "52": "yellow", "53": "yellow", "54": "yellow",

      "75": "yellow", "76": "yellow", "77": "yellow", "78": "yellow",
      "82": "yellow", "83": "blue", "84": "yellow", "85": "yellow", "86": "yellow",
      "90": "yellow", "91": "yellow", "92": "yellow",
      "98": "yellow", "99": "yellow",
      "106": "yellow", "107": "yellow", "108": "yellow", "109": "yellow",
      "115": "yellow", "116": "yellow", "117": "yellow", "118": "yellow",

      "139": "yellow", "140": "yellow", "141": "yellow", "142": "yellow",
      "146": "yellow", "147": "blue", "148": "yellow", "149": "yellow", "150": "yellow", "151": "yellow",
      "154": "yellow", "155": "yellow", "156": "yellow", "157": "yellow", "158": "yellow", "159": "yellow",
      "162": "yellow", "163": "yellow", "164": "yellow", "165": "yellow", "166": "yellow",
      "171": "yellow", "172": "yellow", "173": "yellow", "174": "yellow",

      "203": "yellow", "204": "yellow", "205": "yellow", "206": "yellow",
      "210": "yellow", "211": "blue", "212": "yellow", "213": "yellow", "214": "yellow",
      "218": "yellow", "219": "yellow", "220": "yellow",
      "226": "yellow", "227": "yellow",
      "234": "yellow", "235": "yellow", "236": "yellow", "237": "yellow",
      "243": "yellow", "244": "yellow", "245": "yellow", "246": "yellow"
    }
  },
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "STAMP_FROM_TAPE" },
        { "op": "PLAY_NOTE", "pitch": 5, "duration": 0.25 },
        { "op": "WAIT_BEAT", "beats": 0.25 },
        { "op": "VAR_OP", "target": "i", "operator": "+", "left": "i", "right": 64 }
      ]
    }
  ]
}
```

---

## Variation 3: Transparent `∅` Sky Overlay (`14` Flat Blocks)

```text
// MAIN (14 flat blocks)
SET_BEAT_DELAY [0]
i = 1
Loop [4]
  CLEAR_LEDS
  SET_LED_COLOR [Yellow]
  LIGHT_PIXEL [1, 2]
  LIGHT_PIXEL [7, 1]
  LIGHT_PIXEL [2, 7]
  LIGHT_PIXEL [8, 6]
  TAPE_SEEK [i]
  STAMP_FROM_TAPE
  PLAY_NOTE [6, 0.5]
  i = i + 64
End Loop
```

```json
{
  "slotCap": 20,
  "matrixSize": 8,
  "beatVersion": 2,
  "tape": {
    "length": 256,
    "cells": {
      "20": "cyan", "21": "cyan",
      "27": "purple", "28": "white", "29": "white", "30": "purple",
      "35": "pink", "38": "pink",

      "82": "cyan", "83": "cyan",
      "89": "purple", "90": "white", "91": "white", "92": "purple",
      "97": "pink", "100": "pink",

      "149": "cyan", "150": "cyan",
      "156": "purple", "157": "white", "158": "white", "159": "purple",
      "164": "pink", "167": "pink",

      "212": "cyan", "213": "cyan",
      "219": "purple", "220": "white", "221": "white", "222": "purple",
      "227": "pink", "230": "pink"
    }
  },
  "MAIN": [
    { "op": "SET_BEAT_DELAY", "stepDelayMultiplier": 0 },
    { "op": "VAR_ASSIGN", "var": "i", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "CLEAR_LEDS" },
        { "op": "SET_LED_COLOR", "color": "Yellow" },
        { "op": "LIGHT_PIXEL", "x": 1, "y": 2 },
        { "op": "LIGHT_PIXEL", "x": 7, "y": 1 },
        { "op": "LIGHT_PIXEL", "x": 2, "y": 7 },
        { "op": "LIGHT_PIXEL", "x": 8, "y": 6 },
        { "op": "TAPE_SEEK", "index": "i" },
        { "op": "STAMP_FROM_TAPE" },
        { "op": "PLAY_NOTE", "pitch": 6, "duration": 0.5 },
        { "op": "VAR_OP", "target": "i", "operator": "+", "left": "i", "right": 64 }
      ]
    }
  ]
}
```
