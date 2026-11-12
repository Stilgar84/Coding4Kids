# RobotEmu Binary Serialization Format Specification

## 1. Overview

This document specifies the compact binary format (`FORMAT_VERSION = 1`) for serializing RobotEmu programs (code workspace), environment states (such as Grid world layouts), and standalone curriculum lesson attempts.

The raw binary stream is serialized as a plain **Base64URL** string (RFC 4648 §5, characters `A-Z`, `a-z`, `0-9`, `-`, `_`, no padding `=`). No external text prefixes (like `rb1:`) are used; format versioning and payload deduction are resolved internally by the first three bytes of the binary payload.

> **Spec Maintenance Rule:** Any commit that adds or activates an opcode, bitmask, or environment version MUST update this document in the same commit.

---

## 2. High-Level Stream Layouts

### 2.1 Standard Environment / Code Stream (`envId = 0x00..0x03`)

```
+-----------------------------------------------------------------------------------------------+
| formatVersion (1B) | envId (1B) | envVersion (1B) | [Optional Env State Payload] | Code Scopes |
+-----------------------------------------------------------------------------------------------+
```

| Offset | Field | Type | Description |
| :--- | :--- | :--- | :--- |
| `0x00` | `formatVersion` | `uint8` | Global format version (`1`). Governs universal layout, VLE, and control flow opcodes. |
| `0x01` | `envId` | `uint8` | Simulation Environment ID:<br>• `0x00`: `generic` / Code-only (uses Grid action opcodes, no map payload)<br>• `0x01`: `grid` (includes Grid map payload; `envVersion = 1` classic, `2` interactive items)<br>• `0x02`: `turtle` (Turtle LOGO canvas, no map payload)<br>• `0x03`: `beat` (Beat & Light 8×8 Matrix, no map payload)<br>• `0x04`: `lesson` (Standalone Curriculum Lesson envelope — see §2.2)<br>• `0x05`+: Reserved for future environments (e.g., `0x05` = `switchyard` in Module 5) |
| `0x02` | `envVersion` | `uint8` | Environment-specific version (`1` or `2` for `grid`; `1` for `turtle` and `beat`). Governs env-specific opcode mapping and env state layout. |

> **Environment State Deduction:**
> For `envId = 0x01` (`grid`), the Grid map payload (§4) immediately follows byte 2. For `envId = 0x00` (`generic`), `0x02` (`turtle`), and `0x03` (`beat`), there is no map payload, and the Code Payload (§5) starts immediately at byte 3.

### 2.2 Standalone Curriculum Lesson Share Envelope (`ENV_ID_LESSON = 0x04`)

Used when exporting or sharing a curriculum attempt as a self-contained Base64URL string or QR code without duplicating read-only lesson map geometry:

```
+----------------------------------------------------------------------------------------------------------+
| FORMAT_VERSION=1 (1B) | ENV_ID_LESSON=0x04 (1B) | innerEnvByte (1B) | lessonIdLen (VLE) | lessonId (UTF-8) |
| lessonVersion (VLE)   | ... Code Scopes (decoded using innerEnvByte) ...                                   |
+----------------------------------------------------------------------------------------------------------+
```

- `innerEnvByte` (`uint8` at offset `0x02`): Governs the domain opcode table used inside Code Scopes (`0x00` `generic` or `0x01` `grid` = Grid opcodes, `0x02` `turtle` = Turtle opcodes, `0x03` `beat` = Beat & Light opcodes).
- `lessonIdLen` (`VLE`, `> 0`) + `lessonId` (`UTF-8` bytes): Canonical activity ID (e.g., `"1.2"`, `"2A"`, `"3A"`, `"3C"`).
- `lessonVersion` (`VLE`, `≥ 1`): Integer version of the curriculum activity definition against which the attempt was authored (`getActivityAtVersion(lessonId, lessonVersion)` reconstructs the matching map/palette).

### 2.3 Local Storage Dual-Path (`SavedProgramEntry` JSON vs. `ENV_ID_LESSON = 0x04`)

Curriculum attempts support two complementary, lossless representations sharing the exact same inner `writeCodeScopes` / `readCodeScopes` payload:
1. **Local Storage Code-Only Path (`robotemu_saved_programs`):** `SavedProgramEntry` JSON records store `{ profileId, lessonId, lessonVersion, simId, code, ... }`, where `code` is a §2.1 code-only Base64URL stream (`envId = 0x00` for Grid, `0x02` for Turtle, `0x03` for Beat). Legacy v1 entries missing `profileId` migrate non-destructively to `'default'`.
2. **Standalone Share String Path (`ENV_ID_LESSON = 0x04`):** Embeds `(innerEnvByte, lessonId, lessonVersion)` directly inside the binary header (§2.2) so a single copied Base64URL string or QR code restores both the curriculum activity context and all code scopes without external JSON metadata.

---

## 3. Variable-Length Encoding (VLE / LEB128) & Variable Indices

- **Unsigned VLE (LEB128):** Counts, lengths, coordinates, angles, radii, and hint categories use standard 7-bit continuation LEB128:
  - Values $V < 128$: single byte `V` (`bit 7 = 0`).
  - Values $V \ge 128$: byte is `(V & 0x7F) | 0x80`, followed by remaining bits shifted right by 7.
- **Variable Index (`varIdx: uint8`):** Single-letter variable names `'a'..'z'` encode as 1 byte `0..25` (`'a' = 0`, `'b' = 1`, ..., `'z' = 25`).

---

## 4. Environment State Payload (`envId = 0x01` Grid World)

When `envId = 0x01`, the map payload immediately follows the 3-byte header. Small-grid packing applies whenever $\text{width} \le 16 \text{ and } \text{height} \le 16$.

### 4.1 Classic Grid Layout (`envVersion = 1` Prefix)

```
+-------------------------------------------------------------------------+
| width (VLE) | height (VLE) | robotPose (2-3B)                           |
| barrierCount (VLE) | ... packed barriers ...                            |
| flagCount (VLE)    | ... packed flags ...                               |
+-------------------------------------------------------------------------+
```

1. **Dimensions:** `width: VLE`, `height: VLE`.
2. **Robot Pose:**
   - Small grid ($\le 16 \times 16$): Byte 1 = `[x: 4 bits][y: 4 bits]`, Byte 2 = `[dir: 2 bits]` (`0` = NORTH, `1` = EAST, `2` = SOUTH, `3` = WEST). *(Note: `envVersion >= 2` serializes `initialX, initialY, initialDir` so post-run Instant mode exports preserve starting pose.)*
   - Large grid ($> 16$): `x: VLE`, `y: VLE`, `dir: uint8`.
3. **Barriers (`barrierCount: VLE`):**
   - Small grid (1 byte each): `[ori: 1 bit (0='H', 1='V')][x: 3 bits][y: 4 bits]`.
   - Large grid: `[ori: 1 bit][x: 7 bits]`, followed by `y: VLE`.
4. **Flags & Objectives (`flagCount: VLE`):**
   - Small grid (2 bytes each): Byte 1 = `[x: 4 bits][y: 4 bits]`, Byte 2 = `[isGoal: 1 bit][order: 7 bits]`.
   - Large grid: `x: VLE`, `y: VLE`, `[isGoal: 1 bit][order: 7 bits]`.

When `envVersion === 1` (`ENV_VERSION_GRID = 1`), the Grid payload ends here and Code Scopes (§5) begin immediately. **Classic Grid maps without any interactive world elements always emit byte-identical `envVersion = 1` streams** so existing saved URLs and QR codes never change.

### 4.2 Interactive World Extension Block (`ENV_VERSION_GRID_V2 = 2`)

Emitted only when a Grid map contains non-empty `waterCells`, `lockedGates`, `floorSwitches`, or `worldItems` (`items`). Immediately follows the exact `envVersion = 1` prefix above. Cell coordinates use `CellCoord` = 1 byte `[x: 4 bits][y: 4 bits]` on small grids ($\le 16 \times 16$) or `x: VLE, y: VLE` on large grids:

5. **Water Cells (`waterCount: VLE`):** `waterCount` × `CellCoord`.
6. **Locked Gates (`gateCount: VLE`):** For each gate:
   - `coord: CellCoord`
   - `attrByte: uint8` = `[000 (b7..b5) | colorIdx (b4..b2: 0=amber, 1=emerald, 2=purple) | shapeIdx (b1..b0: 0=circle ●, 1=triangle ▲, 2=diamond ◆)]`.
7. **Floor Switches (`switchCount: VLE`):** For each switch:
   - `coord: CellCoord`
   - `flagsByte: uint8`:
     - `bit 0 (0x01)`: `hasLinkedGate`
     - `bit 1 (0x02)`: `hasExplicitRequiredForGoal`
     - `bit 2 (0x04)`: `requiredForGoal` boolean value
   - If `hasLinkedGate`: followed by `linkedGateIdx: VLE` (0-based index into Locked Gates table).
8. **World Items (`itemCount: VLE`):** For each authored floor pickup item:
   - `coord: CellCoord`
   - `attrByte: uint8` = `[0 (b7) | colorIdx (b6..b4, keys only) | shapeIdx (b3..b2, keys only) | typeIdx (b1..b0: 0=key, 1=plank, 2=crate)]`.

---

## 5. Code Payload

The code payload serializes non-empty workspace scopes (`MAIN`, `F1`, `F2`, `F3`):

```
[scopeCount: VLE]
For each scope:
  [scopeId: uint8]
  [blockCount: VLE]
  ... sequence of Block Envelopes ...
```

### 5.1 Scope IDs
- `0x00`: `MAIN`
- `0x81`: `F1` (`0x80 | 1`)
- `0x82`: `F2` (`0x80 | 2`)
- `0x83`: `F3` (`0x80 | 3`)

---

## 6. Block Envelopes & Variable Parameter Masks

RobotEmu uses two distinct block-envelope layouts depending on the 5-bit opcode (`blockHeader & 0x1F`):

### 6.1 Standard Block Envelope (All Opcodes Except `0x07`, `0x08`, `0x09`)

```
Byte 0 (blockHeader):
  Bit 7 (0x80)    Bit 6 (0x40)    Bit 5 (0x20)   Bits 4..0 (0x1F)
+---------------+---------------+--------------+------------------+
| HasVarParam   | HasRep        | Reserved (0) | Opcode (0..31)   |
+---------------+---------------+--------------+------------------+

Optional Byte 1 (paramVarMask — PRESENT ONLY IF HasVarParam == 1):
  Bits 7..3 (0)   Bit 2 (0x04)     Bit 1 (0x02)     Bit 0 (0x01)
+---------------+----------------+----------------+----------------+
| Reserved (0)  | Param1IsVar    | Param0IsVar    | RepeatIsVar    |
+---------------+----------------+----------------+----------------+
```

1. **`paramVarMask` (`uint8`, present iff `HasVarParam == 1`):**
   - `bit 0 (0x01)`: `repeatCount` is a variable index (`varIdx: uint8`) instead of `VLE`.
   - `bit 1 (0x02)`: Action parameter 0 is a variable index (`varIdx: uint8`) instead of `VLE`/`uint8`.
   - `bit 2 (0x04)`: Action parameter 1 is a variable index (`varIdx: uint8`) instead of `VLE`.
2. **Repeat Count (present iff `HasRep == 1`):**
   - If `HasVarParam == 1` and `(paramVarMask & 0x01) != 0`: `varIdx: uint8` (`0..25`).
   - Otherwise: `repeatCount: VLE`.
3. **Opcode-Specific Parameters:** Dictated strictly by `(envByte, opcode)` and `paramVarMask` bits `1..2`.

### 6.2 Special Unconditional Descriptor Envelopes (`0x07`, `0x08`, `0x09`)

`OP_VAR_ASSIGN (0x07)`, `OP_VAR_OP (0x08)`, and `OP_PLACEHOLDER (0x09)` never use `HasVarParam` or `HasRep` (`Byte 0` is literally the raw opcode byte `0x07`, `0x08`, or `0x09` with bits `7..5 = 0`):

1. **`OP_VAR_ASSIGN = 0x07` (`a = b`):**
   ```
   Byte 0: 0x07 (OP_VAR_ASSIGN — bits 7..5 MUST be 0)
   Byte 1: operandDescMask (ALWAYS present; bits 1..0 = typeB, bits 7..2 = 0 in M1–M3; bit 4 reserved for M6 sensor)
   Byte 2: targetVarIdx (uint8: 0..25 for 'a'..'z')
   Byte 3+: operandB payload governed by operandDescMask
   ```
2. **`OP_VAR_OP = 0x08` (`a = b op c`):**
   ```
   Byte 0: 0x08 (OP_VAR_OP — bits 7..5 MUST be 0)
   Byte 1: operandDescMask (ALWAYS present; bits 1..0 = typeB, bits 3..2 = typeC, bits 7..4 = 0 in M1–M3; bits 5..4 reserved for M6 sensors)
   Byte 2: targetVarIdx (uint8: 0..25 for 'a'..'z')
   Byte 3: opByte (uint8: 0x00..0x0C — see §7.1.1)
   Byte 4+: operandB payload, followed immediately by operandC payload
   ```
   **2-Bit Operand Type Codes (`typeB`, `typeC`):**
   - `0` (`00`): Variable — `varIdx: uint8` (`0..25`)
   - `1` (`01`): Non-negative integer — `VLE(n)`
   - `2` (`10`): Negative integer — `VLE(abs(n))`
   - `3` (`11`): IEEE-754 float64 — `8 bytes` big-endian (`DataView.setFloat64`)
3. **`OP_PLACEHOLDER = 0x09` (`?` Scaffold Block):**
   ```
   Byte 0: 0x09 (OP_PLACEHOLDER — bits 7..5 MUST be 0)
   Byte 1+: hintCategory (VLE: 0..4 active in M1–M3; 5..15 reserved for M4–M9; unknown codes fall back to 'any')
   ```

---

## 7. Opcode Tables

### 7.1 Universal Control & Variable Opcodes (`0x00`–`0x0F`)

Governed by `FORMAT_VERSION = 1` across all environments.

| Opcode | Constant / Instruction | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `0x01` | `OP_LOOP_START` (`LOOP_START`) | None (uses `MASK_HAS_REP`) | Loop iteration count via `MASK_HAS_REP (0x40)` (`VLE` or `varIdx` via `MASK_HAS_VAR_PARAM (0x80)`). |
| `0x02` | `OP_LOOP_END` (`LOOP_END`) | None | Closes matching `LOOP_START` (supports arbitrary nesting depth). |
| `0x03` | `OP_CALL_FN` (`CALL_FN`) | `fnIndex: uint8` | Calls helper scope: `1` = `F1`, `2` = `F2`, `3` = `F3`. |
| `0x04` | `OP_IF` (`IF`) | Reserved (M5) | Conditional branch start (activated in Module 5). |
| `0x05` | `OP_ELSE` (`ELSE`) | None (M5) | Else branch separator (activated in Module 5). |
| `0x06` | `OP_END_IF` (`END_IF`) | None (M5) | Conditional branch closer (activated in Module 5). |
| `0x07` | `OP_VAR_ASSIGN` (`VAR_ASSIGN`) | `operandDescMask`, `varIdx`, `operandB` | Assigns `a = b` (see §6.2). |
| `0x08` | `OP_VAR_OP` (`VAR_OP`) | `operandDescMask`, `varIdx`, `opByte`, `operandB`, `operandC` | Evaluates `a = b op c` (see §6.2 & §7.1.1). |
| `0x09` | `OP_PLACEHOLDER` (`PLACEHOLDER`) | `hintCategory: VLE` | `?` scaffold slot. **Active in M1–M3 (`0..4`):** `0`=any, `1`=motion, `2`=turn, `3`=item, `4`=loop. **Reserved for M4–M9 (`5..15`):** `5`=function, `6`=conditional, `7`=sensor, `8`=variable, `9`=operator, `10`=socket (`11..15` unassigned; VLE-extensible). |
| `0x0A`–`0x0F` | Reserved | Reserved | Reserved for Module 5–9 control extensions (`ELSE_IF`, `WHILE`, `END_WHILE`, etc.). |

#### 7.1.1 `VAR_OP` Binary Operator Codes (`opByte: uint8`)

`0x00` `+` · `0x01` `-` · `0x02` `*` · `0x03` `/` · `0x04` `%` · `0x05` `==` · `0x06` `!=` · `0x07` `<` · `0x08` `<=` · `0x09` `>` · `0x0A` `>=` · `0x0B` `&&` · `0x0C` `||`.

---

### 7.2 Grid World Opcodes (`ENV_ID_GENERIC = 0x00` or `ENV_ID_GRID = 0x01`, `envVersion = 1..2`)

All Grid action opcodes use the Standard Block Envelope (§6.1) with `MASK_HAS_REP (0x40)` for repeat badges (`×2..×9` or higher `VLE`) and `MASK_HAS_VAR_PARAM (0x80)` (`paramVarMask & 0x01`) when repeat count is a variable.

| Opcode | Constant / Action Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `OP_GRID_MOVE_FWD` (`MOVE_FWD`) | None | Move forward 1 cell (supports `MASK_HAS_REP` + variable repeat). |
| `0x11` | `OP_GRID_MOVE_BACK` (`MOVE_BACK`) | None | Move backward 1 cell (supports `MASK_HAS_REP` + variable repeat). |
| `0x12` | `OP_GRID_TURN_LEFT` (`TURN_LEFT`) | None | Turn left 90° egocentrically (supports `MASK_HAS_REP` + variable repeat). |
| `0x13` | `OP_GRID_TURN_RIGHT` (`TURN_RIGHT`) | None | Turn right 90° egocentrically (supports `MASK_HAS_REP` + variable repeat). |
| `0x14` | `OP_GRID_PICK_UP` (`PICK_UP`) | None | Pick up floor item into 1-slot backpack (supports `MASK_HAS_REP` + variable repeat). |
| `0x15` | `OP_GRID_USE_DROP` (`USE_DROP`) | None | Use carried key/plank ahead or drop crate on current tile (supports `MASK_HAS_REP` + variable repeat). |

---

### 7.3 Turtle World Opcodes (`envId = 0x02`, `envVersion = 1`)

| Opcode | Action Type | Parameters (`param0`, `param1`) | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `FORWARD` | None | Step forward default `50px` (parameterless M1 / legacy, supports `HasRep`). |
| `0x11` | `BACKWARD` | None | Step backward default `50px` (parameterless M1 / legacy, supports `HasRep`). |
| `0x12` | `TURN_LEFT` | `angle: VLE \| varIdx` | Turn left in degrees (`param0`). |
| `0x13` | `TURN_RIGHT` | `angle: VLE \| varIdx` | Turn right in degrees (`param0`). |
| `0x14` | `ARC_LEFT` | `radius: VLE \| varIdx`, `angle: VLE \| varIdx` | Arc left by radius (`param0`) and degrees (`param1`). |
| `0x15` | `ARC_RIGHT` | `radius: VLE \| varIdx`, `angle: VLE \| varIdx` | Arc right by radius (`param0`) and degrees (`param1`). |
| `0x16` | `PEN_UP` | None | Lift pen up. |
| `0x17` | `PEN_DOWN` | None | Lower pen down. |
| `0x18` | `SET_PEN_COLOR` | `colorId: uint8` | Palette index: `0` = `#0f172a` (Black), `1` = `#ef4444` (Red), `2` = `#3b82f6` (Blue), `3` = `#10b981` (Green), `4` = `#f59e0b` (Amber), `5` = `#8b5cf6` (Purple), `6` = `#ec4899` (Pink), `7` = `#06b6d4` (Cyan). |
| `0x19` | `SET_PEN_WIDTH` | `width: VLE \| varIdx` | Line width in pixels (`param0`). |
| `0x1A` | `FORWARD` | `length: VLE \| varIdx` | Step forward explicit pixel distance (`param0`, supports `HasRep`). |
| `0x1B` | `BACKWARD` | `length: VLE \| varIdx` | Step backward explicit pixel distance (`param0`, supports `HasRep`). |

---

### 7.4 Beat & Light Matrix Opcodes (`ENV_ID_BEAT = 0x03`, `ENV_VERSION_BEAT = 1`)

All Beat & Light opcodes use the Standard Block Envelope (§6.1). When any repeat count or action parameter holds a variable name (`'a'..'z'`), `MASK_HAS_VAR_PARAM (0x80)` is set in `blockHeader` and `paramVarMask` (`Byte 1`) indicates which field(s) encode a 1-byte `varIdx (0..25)` instead of their literal representation (`bit 0 = 0x01` repeat, `bit 1 = 0x02` `param0`, `bit 2 = 0x04` `param1`).

| Opcode | Constant / Action Type | Parameters (`param0`, `param1`) | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `OP_BEAT_DRUM_KICK` (`DRUM_KICK`) | None | Kick drum hit, 1 beat (supports `MASK_HAS_REP` + variable repeat). |
| `0x11` | `OP_BEAT_DRUM_SNARE` (`DRUM_SNARE`) | None | Snare drum hit, 1 beat (supports `MASK_HAS_REP` + variable repeat). |
| `0x12` | `OP_BEAT_DRUM_CLAP` (`DRUM_CLAP`) | None | Handclap accent, 1 beat (supports `MASK_HAS_REP` + variable repeat). |
| `0x13` | `OP_BEAT_PLAY_CHIME` (`PLAY_CHIME`) | None | Bright chime, 1 beat (supports `MASK_HAS_REP` + variable repeat). |
| `0x14` | `OP_BEAT_STAMP_PRESET` (`STAMP_*` / `STAMP_PRESET`) | `presetByte: uint8 \| varIdx` | `0` = `STAMP_HEART`, `1` = `STAMP_STAR`, `2` = `STAMP_SMILE`; `0x80 \| id` (for `id <= 2`) or `3..7` (`NOTE`, `BOLT`, `DIAMOND`, `CHECK`, `ROBOT`) decodes as parameterized `STAMP_PRESET`; `varIdx` when `paramVarMask & 0x02`. |
| `0x15` | `OP_BEAT_WAIT_BEAT` (`WAIT_BEAT`) | None | Holds current LEDs silent for 1 beat (supports `MASK_HAS_REP` + variable repeat). |
| `0x16` | `OP_BEAT_CLEAR_LEDS` (`CLEAR_LEDS`) | None | Clears all 64 LEDs to off. |
| `0x17` | `OP_BEAT_PLAY_NOTE` (`PLAY_NOTE`) | `pitch: VLE \| varIdx`, `durCode: uint8` | Scale note `1..8` (`param0`, `VLE` or `varIdx` via `paramVarMask & 0x02`) + duration code (`0` = `0.5`, `1` = `1`, `2` = `2` beats). |
| `0x18` | `OP_BEAT_SET_LED_COLOR` (`SET_LED_COLOR`) | `colorId: uint8 \| varIdx` | Active LED color index (`0`=Cyan `#06b6d4`, `1`=Rose `#f43f5e`, `2`=Amber `#fbbf24`, `3`=Emerald `#10b981`, `4`=Purple `#a855f7`, `5`=Blue `#3b82f6`, `6`=Orange `#f97316`, `7`=Pink `#ec4899`) or `varIdx` (`paramVarMask & 0x02`). |
| `0x19` | `OP_BEAT_LIGHT_ROW` (`LIGHT_ROW`) | `y: VLE \| varIdx` | Lights row `y` (`1..8`, `param0`, `VLE` or `varIdx` via `paramVarMask & 0x02`) in active LED color. |
| `0x1A` | `OP_BEAT_LIGHT_COL` (`LIGHT_COL`) | `x: VLE \| varIdx` | Lights column `x` (`1..8`, `param0`, `VLE` or `varIdx` via `paramVarMask & 0x02`) in active LED color. |
| `0x1B` | `OP_BEAT_LIGHT_PIXEL` (`LIGHT_PIXEL`) | `x: VLE \| varIdx`, `y: VLE \| varIdx` | Lights pixel `(x, y)` (`param0` via `0x02`, `param1` via `0x04`) in active LED color. |
| `0x1C` | `OP_BEAT_CURSOR_STEP` (`CURSOR_STEP`) | None | Advances LED cursor 1 pixel and lights it (supports `MASK_HAS_REP` + variable repeat). |
| `0x1D` | `OP_BEAT_CURSOR_TURN` (`CURSOR_TURN`) | `dirByte: uint8` | Rotates LED cursor 90° (`0` = `LEFT`, `1` = `RIGHT`). |

---

## 8. Base64URL Encoding

The resulting byte sequence (`Uint8Array`) is encoded as Base64URL (no padding):
- Standard Base64 `+` replaced with `-`.
- Standard Base64 `/` replaced with `_`.
- Trailing `=` padding characters omitted.
- Decoding converts `-` to `+`, `_` to `/`, re-adds padding, and decodes with `atob`.
