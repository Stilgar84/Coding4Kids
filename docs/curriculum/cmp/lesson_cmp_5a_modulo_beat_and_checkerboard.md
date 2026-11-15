# Lesson `cmp.5a` — Modulo Beat & Parity LED Runway *(Promoted)*

> [← `cmp.5`](./lesson_cmp_5_computed_geometry.md) · [Module `cmp` Overview](./overview.md) · **Format:** 🎵 Puzzle · **Environment:** [🎵 Beat & Light Matrix](../../envs/beat_light.md) · **Next:** [`cmp.6` →](./lesson_cmp_6_comparing_stack_tops.md)

---

## 1. One-Concept Goal

Light an alternating **Cyan / Purple** checkerboard stripe along whichever row the cursor starts on using **`($cursorX + $cursorY) % 2`** inside **`F1`**, synced to an 8-beat Kick/Snare **`$beatIndex % 2`** groove.

---

## 2. Puzzle Configuration & Palette

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Environment** | `beat_light` (`8 × 8`, `1..8 × 1..8`) | `SET_LED_COLOR` / `LIGHT_PIXEL` apply immediately; `DRUM_*` consumes `1` beat (`$beatIndex: 1..8`) |
| **Palette (`Control & Fns`)** | `LOOP_START`, `IF / ELSE`, `CALL_FN (F1)` | Both `MAIN` and `F1` tabs editable (`<= 14/tab`) |
| **Palette (`Music & LEDs`)** | `DRUM_KICK`, `DRUM_SNARE`, `SET_LED_COLOR`, `LIGHT_PIXEL`, `CURSOR_STEP` | Uses `cyan` and `purple` swatches |
| **Palette (`Vars & Sensors`)** | `VAR_OP (+, %)`, `$cursorX`, `$cursorY`, `$beatIndex`, `<`, `==`, `0`, `1`, `2`, `8` | Strict 3-address `OP_VAR_OP` before `IF` |
| **Block Budget** | `slotCap: 14/tab`, `par: MAIN 12, F1 8 (20 total)`, `Starter: MAIN 12, F1 1`, `Edit Delta: 7` | Flat closer-inclusive counting |

---

## 3. Starter Code & Reference Solution

### Starter Code (`MAIN` complete `12` blocks; `F1` incomplete `1` block — always dark/unlit)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "LOOP_START",
        "count": 8,
        "body": [
          { "op": "CALL_FN", "fn": "F1" },
          { "op": "VAR_OP", "target": "b", "left": "$beatIndex", "operator": "%", "right": 2 },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": "==", "left": "b", "right": 1 },
            "then": [{ "op": "DRUM_KICK" }],
            "else": [{ "op": "DRUM_SNARE" }]
          },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": "<", "left": "$cursorX", "right": 8 },
            "then": [{ "op": "CURSOR_STEP" }]
          }
        ]
      }
    ],
    "F1": [
      { "op": "LIGHT_PIXEL", "x": "$cursorX", "y": "$cursorY" }
    ]
  }
}
```

### Reference Solution (`MAIN: 12`, `F1: 8` — `Edit Delta: 7` inside `F1`)

```json
{
  "scopes": {
    "MAIN": [
      {
        "op": "LOOP_START",
        "count": 8,
        "body": [
          { "op": "CALL_FN", "fn": "F1" },
          { "op": "VAR_OP", "target": "b", "left": "$beatIndex", "operator": "%", "right": 2 },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": "==", "left": "b", "right": 1 },
            "then": [{ "op": "DRUM_KICK" }],
            "else": [{ "op": "DRUM_SNARE" }]
          },
          {
            "op": "IF",
            "cond": { "op": "CMP", "operator": "<", "left": "$cursorX", "right": 8 },
            "then": [{ "op": "CURSOR_STEP" }]
          }
        ]
      }
    ],
    "F1": [
      { "op": "VAR_OP", "target": "s", "left": "$cursorX", "operator": "+", "right": "$cursorY" },
      { "op": "VAR_OP", "target": "p", "left": "s", "operator": "%", "right": 2 },
      {
        "op": "IF",
        "cond": { "op": "CMP", "operator": "==", "left": "p", "right": 0 },
        "then": [{ "op": "SET_LED_COLOR", "color": "cyan" }],
        "else": [{ "op": "SET_LED_COLOR", "color": "purple" }]
      },
      { "op": "LIGHT_PIXEL", "x": "$cursorX", "y": "$cursorY" }
    ]
  }
}
```

> **Guided Co-Pilot Card (`<= 2` sentences):** Add **`$cursorX + $cursorY`** inside **`F1`**, then check **`p = s % 2`** to switch between **Cyan** (`0`) and **Purple** (`1`). Different rows start on opposite checkerboard colors!

---

## 4. Multi-Row Suite (`4` Variants) & Anti-Bypass Rules

| Variant | Cursor Start (`x, y`, Facing East) | Expected Row LED Pattern (`cols 1..8`) | Expected 8-Beat Audio |
| :---: | :---: | :--- | :--- |
| **#1** | `(1, 1)` (Odd Row) | `[Cyan, Purple, Cyan, Purple, Cyan, Purple, Cyan, Purple]` | `Kick, Snare, Kick, Snare, Kick, Snare, Kick, Snare` |
| **#2** | `(1, 2)` (Even Row) | `[Purple, Cyan, Purple, Cyan, Purple, Cyan, Purple, Cyan]` | `Kick, Snare, Kick, Snare, Kick, Snare, Kick, Snare` |
| **#3** | `(1, 5)` (Odd Row) | `[Cyan, Purple, Cyan, Purple, Cyan, Purple, Cyan, Purple]` | `Kick, Snare, Kick, Snare, Kick, Snare, Kick, Snare` |
| **#4** | `(1, 6)` (Even Row) | `[Purple, Cyan, Purple, Cyan, Purple, Cyan, Purple, Cyan]` | `Kick, Snare, Kick, Snare, Kick, Snare, Kick, Snare` |

- **`antiBypassRules`:**
  1. Using `$beatIndex % 2` or `$cursorX % 2` alone matches odd rows (#1, #3) but **inverts** and fails every even row (#2, #4). Only `($cursorX + $cursorY) % 2` passes all 4!
  2. Guarding `IF ($cursorX < 8)` prevents out-of-bounds steps at column `8`.

---

## 5. Step-by-Step Execution Trace (Variant #2, Start `(1, 2)`)

| Beat | Cursor `(x, y)` | `s = x + y` | `p = s % 2` | LED Color | Drum (`b = $beatIndex % 2`) |
| :---: | :---: | :---: | :---: | :--- | :--- |
| `1` | `(1, 2)` | `3` | `1` | **Purple** | `1 -> DRUM_KICK` |
| `2` | `(2, 2)` | `4` | `0` | **Cyan** | `0 -> DRUM_SNARE` |
| `3` | `(3, 2)` | `5` | `1` | **Purple** | `1 -> DRUM_KICK` |
| `4` | `(4, 2)` | `6` | `0` | **Cyan** | `0 -> DRUM_SNARE` |
| `5..8` | `(5, 2)..(8, 2)` | `7..10` | `1, 0, 1, 0` | `Purple, Cyan, Purple, Cyan` | `Kick, Snare, Kick, Snare` |

<details>
<summary>📖 Parent / Teacher Tip</summary>

- **Why Promote `cmp.5a` Here?** Learners already explored `i % 2` in Switchyard (`cmp.4`) and LOGO (`cmp.5`); Beat & Light applies 2D coordinate parity `(x + y) % 2` immediately inside a fun audio-visual puzzle while isolating **`F1`** composition so the learner edits just `7` blocks.

</details>
