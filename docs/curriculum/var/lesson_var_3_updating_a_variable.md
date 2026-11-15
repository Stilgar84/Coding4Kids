# Lesson `var.3` — Updating & Combining Variables

| Field | Value |
| :--- | :--- |
| **ID** | `var.3` |
| **Module** | `var` (Variables, Sensors & Arithmetic) |
| **Title** | Updating & Combining Variables |
| **Format** | `📖` Interactive Read-Only Explanation (`3` Tabs) |
| **Environment** | Robot Grid (`🤖`) |
| **Legacy ID** | `6.3` |
| **Slot Cap** | Read-only demo (`8` / `6` / `10` flat blocks) |
| **Edit Delta** | `0` (Read-Only Interactive Demo) |
| **Variables Allowed** | Tab 1–2: `["a"]`; Tab 3: `["a", "b", "c", "d"]` |
| **Sensors / Operators** | **Unlocks `VAR_OP` (`+`, `-`, `*`)** + `["$tileDial"]` (Tab 3); NO `/`, `%`, `<, >, ==` |

---

## One-Concept Goal

Introduce **3-address arithmetic** (`0x08 OP_VAR_OP` using `+`, `-`, `*` ONLY): updating a counter up (`a = a + 1`), counting a shrinking coil down (`a = a - 1`), and combining two variables (`c = a + b`, `d = b * 2`) before passing results into movement blocks.

---

## Guided Co-Pilot Explanation Cards

- **Tab 1 (`a = a + 1` Growing Staircase):** `a = a + 1 adds 1 to the old number inside [a] and saves the bigger number right back in [a].` `Each loop turn, the robot steps 1 tile farther!`
- **Tab 2 (`a = a - 1` Shrinking Coil):** `a = a - 1 takes 1 away from [a] each turn so the coil shrinks smoothly toward the center.` `Watch the Memory Tray count down 4, 3, 2, 1!`
- **Tab 3 (`c = a + b` & `d = b * 2` Bridge Math):** `Save two dials into [a] and [b], then compute [c = a + b] and [d = b * 2] before you walk.` `Math blocks calculate first, and action slots use the finished box!`

<details>
<summary>📖 Parent / Teacher Tip</summary>

- Children aged `5–7` often pause on `a = a + 1` because `=` in arithmetic means balance, whereas here it means **compute the right side (`old a + 1`), then store back into `a`**. Point to the right-side pills first (`a` + `1`) before the arrow/assignment into `a`.
- Strict 3-address rule: `var` **never allows inline math** inside `MOVE_FWD [× ...]` or `TELEPORT [...]`. Always compute into a variable (`c` or `d`) first, then plug `[c]` into `MOVE_FWD [×c]`.
- On Tab 3, dial values `(a = 2, b = 3)` are deliberately chosen so `a + b = 5`, `b * 2 = 6`, and `a * b = 6` are clear and distinct from `a = 2` or `b = 3`. Division `/` and modulo `%` stay locked until `cmp.3`.

</details>

---

## Palette & Capabilities (Module `var.3` Cumulative)

```json
{
  "readOnly": true,
  "allowedSimBlocks": ["MOVE_FWD", "TURN_LEFT", "TURN_RIGHT"],
  "allowedControlBlocks": ["LOOP_START", "LOOP_END", "VAR_ASSIGN", "VAR_OP"],
  "allowedVariableNames": ["a", "b", "c", "d"],
  "allowedValueSensors": ["$tileDial"],
  "allowedVarOps": ["+", "-", "*"],
  "allowRepeatBadges": true,
  "allowActionParams": false
}
```

---

## Tab 1 — Counting Up (`a = a + 1`, `9×6` Grid, `8` Flat Blocks)

### Grid Layout

```text
  0 1 2 3 4 5 6 7 8
0 # # # # # # # # #
1 # # # # . . . F #    > Start (1, 4) E
2 # # . . . # # # #    Path: (1,4)->(2,4)->(2,3)->(4,3)->(4,2)->(7,2)->(7,1) 🏁
3 # . . # # # # # #
4 # > . # # # # # #
5 # # # # # # # # #
```

```json
{
  "width": 9,
  "height": 6,
  "start": { "x": 1, "y": 4, "facing": "E" },
  "goal": { "x": 7, "y": 1 },
  "walkableCorridor": [[1,4],[2,4],[2,3],[3,3],[4,3],[4,2],[5,2],[6,2],[7,2],[7,1]]
}
```

### Program & Trace (`8` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "a", "value": 1 },
    {
      "op": "LOOP_START",
      "count": 3,
      "body": [
        { "op": "MOVE_FWD", "repeat": "a" },
        { "op": "TURN_LEFT", "angle": 90 },
        { "op": "MOVE_FWD" },
        { "op": "TURN_RIGHT", "angle": 90 },
        { "op": "VAR_OP", "target": "a", "operator": "+", "left": "a", "right": 1 }
      ]
    }
  ]
}
```

| Loop Iteration | `a` at Entry | `MOVE_FWD [×a]` End | `LEFT`, `FWD`, `RIGHT` End | `a = a + 1` Exit |
| :---: | :---: | :--- | :--- | :---: |
| 1 | `1` | `(2, 4, E)` | `(2, 3, E)` | `2` |
| 2 | `2` | `(4, 3, E)` | `(4, 2, E)` | `3` |
| 3 | `3` | `(7, 2, E)` | `(7, 1, E)` `🏁` | `4` |

---

## Tab 2 — Counting Down (`a = a - 1`, `7×7` Grid, `6` Flat Blocks)

### Grid Layout

```text
  0 1 2 3 4 5 6
0 # # # # # # #
1 # # # # # # #
2 # # # . . . #    > Start (1, 5) E
3 # # # F # . #    Path: (1,5)->(5,5)->(5,2)->(3,2)->(3,3) 🏁
4 # # # # # . #
5 # > . . . . #
6 # # # # # # #
```

```json
{
  "width": 7,
  "height": 7,
  "start": { "x": 1, "y": 5, "facing": "E" },
  "goal": { "x": 3, "y": 3 },
  "walkableCorridor": [[1,5],[2,5],[3,5],[4,5],[5,5],[5,4],[5,3],[5,2],[4,2],[3,2],[3,3]]
}
```

### Program & Trace (`6` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "VAR_ASSIGN", "var": "a", "value": 4 },
    {
      "op": "LOOP_START",
      "count": 4,
      "body": [
        { "op": "MOVE_FWD", "repeat": "a" },
        { "op": "TURN_LEFT", "angle": 90 },
        { "op": "VAR_OP", "target": "a", "operator": "-", "left": "a", "right": 1 }
      ]
    }
  ]
}
```

| Loop Iteration | `a` at Entry | `MOVE_FWD [×a]` + `TURN_LEFT` Pose | `a = a - 1` Exit |
| :---: | :---: | :--- | :---: |
| 1 | `4` | `(5, 5, N)` | `3` |
| 2 | `3` | `(5, 2, W)` | `2` |
| 3 | `2` | `(3, 2, S)` | `1` |
| 4 | `1` | `(3, 3, E)` `🏁` | `0` |

---

## Tab 3 — Combining Two Variables (`c = a + b`, `d = b * 2`, `10×9` Grid, `10` Flat Blocks)

### Grid Layout

```text
  0 1 2 3 4 5 6 7 8 9
0 # # # # # # # # # #
1 # # # # # # # # F #    > Start (1, 7) E
2 # # # # # # # # . #    Dial a at (2, 7) = 2
3 # # # # # # # # . #    Dial b at (3, 7) = 3
4 # # # # # # # # . #    Bridge 1 East: c = a + b = 5 -> (8, 7)
5 # # # # # # # # . #    Bridge 2 North: d = b * 2 = 6 -> (8, 1) 🏁
6 # # # # # # # # . #
7 # > A B . . . . . #
8 # # # # # # # # # #
```

```json
{
  "width": 10,
  "height": 9,
  "start": { "x": 1, "y": 7, "facing": "E" },
  "dials": [
    { "x": 2, "y": 7, "value": 2 },
    { "x": 3, "y": 7, "value": 3 }
  ],
  "goal": { "x": 8, "y": 1 },
  "walkableCorridor": [
    [1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7],[8,7],
    [8,6],[8,5],[8,4],[8,3],[8,2],[8,1]
  ]
}
```

### Program & Trace (`10` Flat Blocks)

```json
{
  "MAIN": [
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "a", "value": "$tileDial" },
    { "op": "MOVE_FWD" },
    { "op": "VAR_ASSIGN", "var": "b", "value": "$tileDial" },
    { "op": "VAR_OP", "target": "c", "operator": "+", "left": "a", "right": "b" },
    { "op": "VAR_OP", "target": "d", "operator": "*", "left": "b", "right": 2 },
    { "op": "MOVE_FWD", "repeat": "c" },
    { "op": "TURN_LEFT", "angle": 90 },
    { "op": "MOVE_FWD", "repeat": "d" }
  ]
}
```

*(Note: `9` flat blocks when omitting unused trailing blocks; `10` cap leaves room for visual highlight. Trace: `(1,7)->(2,7) [a=2]->(3,7) [b=3]->[c=5, d=6]->MOVE_FWD×5 -> (8,7)->TURN_LEFT->MOVE_FWD×6 -> (8,1) 🏁`.)*
