# RobotEmu Binary Serialization Format Specification

## 1. Overview

This document specifies the compact binary format for serializing RobotEmu programs (code workspace) and environment state (such as Grid world layouts).

The raw binary stream is serialized as a plain **Base64URL** string (RFC 4648 §5, characters `A-Z`, `a-z`, `0-9`, `-`, `_`, no padding `=`). No external text prefixes (like `rb1:`) are used; format versioning is resolved internally by the first byte of the binary payload.

---

## 2. High-Level Stream Layout

```
+-----------------------------------------------------------------------------------------+
| formatVersion (1B) | envId (1B) | envVersion (1B) | [Env Payload (Grid)] | Code Payload |
+-----------------------------------------------------------------------------------------+
```

### 2.1 File Header (3 Bytes)

| Offset | Field | Type | Description |
| :--- | :--- | :--- | :--- |
| `0x00` | `formatVersion` | `uint8` | Global format version (`1`). Governs universal layout, VLE, and control flow opcodes. |
| `0x01` | `envId` | `uint8` | Simulation Environment ID:<br>• `0x00`: Generic / Code-only (no env state)<br>• `0x01`: `grid` (includes grid map payload)<br>• `0x02`: `turtle` (canvas, no map payload)<br>• `0x03`+: Future environments |
| `0x02` | `envVersion` | `uint8` | Environment-specific version (`1`). Governs env-specific opcode mapping, parameter types, and env state layout. |

> **Environment State Deduction**:
> The `envId` determines whether an environment state payload is present. For `envId = 0x01` (`grid`), the map payload immediately follows byte 2. For `envId = 0x00` or `0x02` (`turtle`), there is no map payload, and the code payload starts immediately at byte 3.

---

## 3. Variable-Length Encoding (VLE / LEB128)

Unsigned integer counts, lengths, coordinates, angles, and radius use standard 7-bit continuation LEB128:
- Values $V < 128$: single byte `V` (`bit 7 = 0`).
- Values $V \ge 128$: byte is `(V & 0x7F) | 0x80`, followed by remaining bits shifted right by 7.
- Values $< 128$ consume **1 byte**.

---

## 4. Environment State Payload (`envId = 0x01` Grid World)

When `envId = 0x01`, the map payload immediately follows the 3-byte header:

```
+-------------------------------------------------------------------------+
| width (VLE) | height (VLE) | robotPose (1-2B)                           |
| barrierCount (VLE) | ... packed barriers ...                            |
| flagCount (VLE)    | ... packed flags ...                               |
+-------------------------------------------------------------------------+
```

1. **Dimensions**:
   - `width: VLE`
   - `height: VLE`
2. **Robot Pose**:
   - For small grids ($\text{width} \le 16 \text{ and } \text{height} \le 16$):
     - Byte 1: `[x: 4 bits][y: 4 bits]`
     - Byte 2: `[dir: 2 bits]` (`0` = NORTH, `1` = EAST, `2` = SOUTH, `3` = WEST)
   - For large grids ($\text{width} > 16 \text{ or } \text{height} > 16$):
     - `x: VLE`, `y: VLE`, `dir: uint8`
3. **Barriers**:
   - `barrierCount: VLE`
   - Small grid barrier (1 byte each):
     - `bit 7`: Orientation (`0` = 'H', `1` = 'V')
     - `bits 6..4`: `x` (3–4 bits)
     - `bits 3..0`: `y` (4 bits)
   - Large grid barrier: `[ori: 1 bit][x: 7 bits]` followed by `y: VLE`.
4. **Flags & Objectives**:
   - `flagCount: VLE`
   - Small grid flag (2 bytes each):
     - Byte 1: `[x: 4 bits][y: 4 bits]`
     - Byte 2: `[isGoal: 1 bit][order: 7 bits]` (`isGoal = 1` for final goal, `order = 1..127` for numbered flags)
   - Large grid flag: `x: VLE`, `y: VLE`, `isGoal: 1 bit | order: 7 bits`.

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
The high bit separates the main entry point from subfunctions:
- `0x00`: `MAIN` (high bit `0`)
- `0x80 | fnIndex`: Subfunctions (high bit `1`)
  - `0x81`: `F1`
  - `0x82`: `F2`
  - `0x83`: `F3`

---

## 6. Block Envelope & Opcode Encoding

Each block begins with an instruction header byte:

```
  Bit 7      Bit 6      Bits 4..0
+----------+----------+-----------------------------------------+
| Reserved | HasRep   | Opcode (0..31)                          |
+----------+----------+-----------------------------------------+
```
- **Bit 7 (`Reserved`)**: Reserved for future flag use (must be `0`).
- **Bit 6 (`HasRep`)**:
  - `0`: Default execution (`repeatCount = 1` or omitted).
  - `1`: Followed immediately by `repeatCount: VLE`.
- **Bits 4..0 (`Opcode`)**: Value from `0` to `31`.

> **Parameter Rule**: The opcode strictly dictates what parameters follow and their exact binary types. No parameter length headers or metadata tags are used.

---

## 7. Opcode Tables

### 7.1 Universal Control Flow Opcodes (`0x00`–`0x0F`)
Governed by `formatVersion = 1` across all environments.

| Opcode | Instruction | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `0x01` | `LOOP_START` | None | Loop iteration count encoded via `HasRep` + `repeatCount: VLE`. |
| `0x02` | `LOOP_END` | None | Loop end block. |
| `0x03` | `CALL_FN` | `fnIndex: uint8` | Single byte: `1` for `F1`, `2` for `F2`, `3` for `F3`. |
| `0x04` | `IF` | Reserved | Condition parameter (reserved). |
| `0x05` | `ELSE` | None | Else branch (reserved). |
| `0x06` | `END_IF` | None | End if (reserved). |

---

### 7.2 Grid World Opcodes (`envId = 0x01`, `envVersion = 1`)

| Opcode | Action Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `MOVE_FWD` | None | Move forward 1 cell (supports repeat). |
| `0x11` | `MOVE_BACK` | None | Move backward 1 cell (supports repeat). |
| `0x12` | `TURN_LEFT` | None | Turn left 90° (supports repeat). |
| `0x13` | `TURN_RIGHT` | None | Turn right 90° (supports repeat). |

---

### 7.3 Turtle World Opcodes (`envId = 0x02`, `envVersion = 1`)

| Opcode | Action Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `FORWARD` | None | Step forward (supports repeat). |
| `0x11` | `BACKWARD` | None | Step backward (supports repeat). |
| `0x12` | `TURN_LEFT` | `angle: VLE` | Turn left by degrees (e.g. 30, 45, 90 via VLE). |
| `0x13` | `TURN_RIGHT` | `angle: VLE` | Turn right by degrees (e.g. 30, 45, 90 via VLE). |
| `0x14` | `ARC_LEFT` | `radius: VLE`, `angle: VLE` | Arc left by radius and degrees (both VLE). |
| `0x15` | `ARC_RIGHT` | `radius: VLE`, `angle: VLE` | Arc right by radius and degrees (both VLE). |
| `0x16` | `PEN_UP` | None | Lift pen up. |
| `0x17` | `PEN_DOWN` | None | Lower pen down. |
| `0x18` | `SET_PEN_COLOR` | `colorId: uint8` | 1-byte color index: `0` = `#0f172a` (Black), `1` = `#ef4444` (Red), `2` = `#3b82f6` (Blue), `3` = `#10b981` (Green), `4` = `#f59e0b` (Amber), `5` = `#8b5cf6` (Purple). |

---

## 8. Base64URL Encoding

The resulting byte sequence (`Uint8Array`) is encoded as Base64URL (no padding):
- Standard Base64 `+` replaced with `-`.
- Standard Base64 `/` replaced with `_`.
- Trailing `=` padding characters omitted.
- Decoding converts `-` to `+`, `_` to `/`, re-adds padding, and decodes with `atob`.
