# RobotEmu Binary Serialization Format Specification

## 1. Overview

This document specifies the compact binary format (`FORMAT_VERSION = 1`) for serializing RobotEmu programs (code workspace), environment states (such as Grid world layouts), standalone curriculum lesson attempts, and whole-profile player backups (`ENV_ID_PROFILE = 0x06`).

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
| `0x01` | `envId` | `uint8` | Simulation / Envelope ID:<br>• `0x00`: `generic` / Code-only (uses Grid action opcodes, no map payload)<br>• `0x01`: `grid` (includes Grid map payload; `envVersion = 1` classic, `2` interactive items, `3` sensors/beacons/dials/stack depots)<br>• `0x02`: `turtle` (Turtle LOGO canvas, no map payload)<br>• `0x03`: `beat` (Beat & Light 8×8 Matrix, no map payload)<br>• `0x04`: `lesson` (Standalone Curriculum Lesson envelope — see §2.2)<br>• `0x05`: `switchyard` (Switchyard sorting conveyor & docks — see §4.4 & §7.5)<br>• `0x06`: `profile` (Whole-Profile Backup Envelope — see §2.3)<br>• `0x07`: `depot` (Crate Depot warehouse; `envVersion = 1` code-only, `2` stack-only, `3` FIFO queue & scrap — see §4.5 & §7.6)<br>• `0x08`+: Reserved for future environments |
| `0x02` | `envVersion` | `uint8` | Environment-specific version (`1`, `2`, or `3` for `grid` and `depot`; `1` for `turtle`, `beat`, `switchyard`, and `profile`). Governs env-specific opcode mapping and payload layout. |

> **Environment State Deduction:**
> For `envId = 0x01` (`grid`) and `envId = 0x05` (`switchyard`), the environment state payload (§4) immediately follows byte 2. For `envId = 0x07` (`depot`) with `envVersion >= 2`, the Depot state payload (§4.5) immediately follows byte 2. For `envId = 0x00` (`generic`), `0x02` (`turtle`), `0x03` (`beat`), and `0x07` with `envVersion = 1`, there is no map payload, and the Code Payload (§5) starts immediately at byte 3.

### 2.2 Standalone Curriculum Lesson Share Envelope (`ENV_ID_LESSON = 0x04`)

Used when exporting or sharing a curriculum attempt as a self-contained Base64URL string or QR code without duplicating read-only lesson map geometry:

```
+----------------------------------------------------------------------------------------------------------+
| FORMAT_VERSION=1 (1B) | ENV_ID_LESSON=0x04 (1B) | innerEnvByte (1B) | lessonIdLen (VLE) | lessonId (UTF-8) |
| lessonVersion (VLE)   | ... Code Scopes (decoded using innerEnvByte) ...                                   |
+----------------------------------------------------------------------------------------------------------+
```

- `innerEnvByte` (`uint8` at offset `0x02`): Governs the domain opcode table used inside Code Scopes (`0x00` `generic` or `0x01` `grid` = Grid opcodes, `0x02` `turtle` = Turtle opcodes, `0x03` `beat` = Beat & Light opcodes, `0x05` `switchyard` = Switchyard opcodes).
- `lessonIdLen` (`VLE`, `> 0`) + `lessonId` (`UTF-8` bytes): Canonical activity ID (e.g., `"1.2"`, `"2A"`, `"3A"`, `"3C"`).
- `lessonVersion` (`VLE`, `≥ 1`): Integer version of the curriculum activity definition against which the attempt was authored (`getActivityAtVersion(lessonId, lessonVersion)` reconstructs the matching map/palette).

### 2.3 Whole-Profile Backup Envelope (`ENV_ID_PROFILE = 0x06`, `ENV_VERSION_PROFILE = 1`) & Local Storage Dual-Path

Curriculum attempts support complementary, lossless representations sharing the exact same inner `writeCodeScopes` / `readCodeScopes` payload:
1. **Local Storage Code-Only Path (`robotemu_saved_programs`):** `SavedProgramEntry` JSON records store `{ profileId, lessonId, lessonVersion, simId, code, ... }`, where `code` is a §2.1 code-only Base64URL stream (`envId = 0x00` for Grid, `0x02` for Turtle, `0x03` for Beat). Legacy v1 entries missing `profileId` migrate non-destructively to `'default'`.
2. **Standalone Share String Path (`ENV_ID_LESSON = 0x04`):** Embeds `(innerEnvByte, lessonId, lessonVersion)` directly inside the binary header (§2.2) so a single copied Base64URL string or QR code restores both the curriculum activity context and all code scopes without external JSON metadata.
3. **Whole-Profile Backup Envelope (`ENV_ID_PROFILE = 0x06`):** Packs an entire student profile—identity, curriculum progress, lesson/sandbox autosaves, and manual save slots—into a single QR-friendly binary stream (`Base64URL` prefix `AQYB...`; legacy `ROBOTEMU_PROFILE_BACKUP` v1 JSON remains accepted on import):

```
+--------------------------------------------------------------------------------------------------------+
| Header: 0x01 | 0x06 | 0x01 (3B)                                                                        |
| Identity: avatarColorByte (1B) | nameLen (VLE) + UTF-8 | exportedAtSec (VLE) | createdAtDelta (ZigZag) |
| Progress: progressFlags (1B) | [gated completions, module masks, badges, earnedMedals]                 |
| Saves: saveRecordCount (VLE) | ... Framed Save Records [recordHeader | short meta | binary payload] ...|
+--------------------------------------------------------------------------------------------------------+
```

#### 2.3.1 Profile Identity
- `avatarColorByte: uint8`: `(colorIdx << 4) | avatarIdx` (`avatarIdx` `0..7`, `colorIdx` `0..5`; unknown future indices fall back to `'robot'` / `'sky'`).
- `name`: `nameByteLen: VLE` + UTF-8 nickname (`0..24` UTF-16 code units, truncated cleanly on codepoint boundaries).
- `exportedAtSec: VLE`: Export Unix timestamp in whole seconds (`Math.floor(exportedAt / 1000)`).
- `createdAtDelta: ZigZag VLE`: Signed offset `createdAtSec - exportedAtSec`.

#### 2.3.2 Compact Lesson Identifier (`CompactLessonId`)
- `0x80..0xFD` (**1 byte**): Canonical Modules `1..9` × 14 sub-codes (`0..10` for numbered lessons `M.0`–`M.10`, `11..13` for capstones `MA`–`MC`): `0x80 + (moduleNum - 1) * 14 + subCode`.
- `0xFE` (**2 bytes**): Canonical Mastery Challenges `C1.1`–`C16.16`: `[0xFE, ((modNum - 1) << 4) | (chalNum - 1)]`.
- `0x01..0x7F`: Short UTF-8 lesson ID (`tag = utf8Len` `1..127` + UTF-8 bytes — handles suffixed IDs such as `"2.5a"`, `"3.3a"`, lessons `>= M.11`, and Modules `10..11`).
- `0x00`: Long (`>= 128` bytes) or empty UTF-8 escape: `[0x00, utf8Len: VLE, ...utf8Bytes]`. (`0xFF` reserved.)

#### 2.3.3 Compact Curriculum Progress (`progressFlags: uint8`)
- `bit 0 (0x01)`: `unlockAllModules === true`.
- `bit 1 (0x02)`: `hasV1Completions` -> `v1Count: VLE` + `v1Count × CompactLessonId` (hydrates `completedAt = exportedAt`, `version = 1`).
- `bit 2 (0x04)`: `hasVersionedCompletions` -> `verCount: VLE` + `verCount × (CompactLessonId + version: VLE)` (`version > 1`).
- `bit 3 (0x08)`: `hasNonDefaultModuleUnlocks` -> `moduleUnlockMask: VLE` (bit `k - 1` for `/^module-([1-9]|[1-4][0-9])$/`) + `extraUnlockedCount: VLE` + UTF-8 strings (`bit 3 == 0` implies default `['module-1']` in 0 bytes).
- `bit 4 (0x10)`: `hasBadges` -> `moduleBadgeMask: VLE` (bit `k - 1` for `/^badge-module-([1-9]|[1-4][0-9])$/`) + `extraBadgeCount: VLE` + UTF-8 strings.
- `bit 5 (0x20)`: `hasEarnedMedals` -> `medalCount: VLE` + UTF-8 strings (forward-compatible hook for Module 6 Mastery Challenge medals).
- `bits 7..6`: Reserved (`0`).

#### 2.3.4 Framed Save Records (`saveRecordCount: VLE`)
Each record begins with `recordHeader: uint8` (`bits 1..0 = entryKind`):
- **`entryKind = 0` (Lesson Autosave):** `b2`=`lessonVer > 1`, `b3`=`updatedAt > 0`, `b4`=`isEmptyWorkspace`, `b7..b5`=`0`; followed by `CompactLessonId`, `[lessonVer: VLE]`, `[updatedAtDelta: ZigZag VLE]`, and (`0B` if `isEmptyWorkspace`, else `payloadLen: VLE` + §2.1 code-only binary stream).
- **`entryKind = 1` (Sandbox Autosave):** `b4..b2`=`simCode` (`0`=grid, `1`=turtle, `2`=beat, `3`=switchyard, `7`=UTF-8 string), `b5`=`updatedAt > 0`, `b6`=`isEmptyWorkspace`, `b7`=`0`; followed by `[customSimId]`, `[updatedAtDelta: ZigZag VLE]`, and (`0B` if `isEmptyWorkspace`, else `payloadLen: VLE` + §2.1 code-only binary stream).
- **`entryKind = 2` (Manual Lesson Save):** `b3..b2`=`status` (`0`=`IDLE`, `1`=`SUCCESS`, `2`=`COLLISION`, `3`=`PAUSED`), `b4`=`hasCustomTitle`, `b5`=`lessonVer > 1`, `b6`=`slotNotOne`, `b7`=`hasExtraFlags`; followed by `CompactLessonId`, `[extraFlags: uint8 (b0=noSlotIndex, b1=hasLevelId, b2=hasExplicitSimId, b3=isRawUtf8Code)]`, `[slotIndex: VLE (if slotNotOne && !noSlotIndex)]`, `[lessonVer: VLE]`, `[title]`, `[levelId: VLE]`, `[simCode]`, `stepCount: VLE`, `createdAtDelta: ZigZag VLE`, and `payloadLen: VLE` + raw original `entry.code` bytes (`simId` deduced from `payload[1]` unless `hasExplicitSimId == 1`; non-canonical strings preserved losslessly via `isRawUtf8Code == 1`).
- **`entryKind = 3` (Manual Sandbox Save):** `b3..b2`=`status` (`0..3`), `b4`=`hasCustomTitle`, `b5`=`hasLevelId`, `b6`=`0`, `b7`=`hasExtraFlags`; followed by `[extraFlags: uint8 (b0=hasSlotIndex, b1=hasExplicitSimId, b2=isRawUtf8Code)]`, `[slotIndex: VLE]`, `[levelId: VLE]`, `[title]`, `[simCode]`, `stepCount: VLE`, `createdAtDelta: ZigZag VLE`, and `payloadLen: VLE` + raw original `entry.code` bytes (preserving embedded Grid v1/v2 maps).

---

## 3. Variable-Length Encoding (VLE / ZigZag VLE) & Variable Indices

- **Unsigned VLE (LEB128, up to 53-bit `Number.MAX_SAFE_INTEGER`):** Counts, lengths, Unix timestamps, module bitmasks, coordinates, angles, radii, and hint categories use 7-bit continuation LEB128 accumulated via safe power-of-128 arithmetic up to $2^{53} - 1$ (throwing on overflow if `shift >= 56` or value exceeds `Number.MAX_SAFE_INTEGER`):
  - Values $V < 128$: single byte `V` (`bit 7 = 0`).
  - Values $V \ge 128$: byte is `(V % 128) | 0x80`, followed by `Math.floor(V / 128)`.
- **Signed ZigZag VLE (`writeSignedVLE` / `readSignedVLE`):** Signed timestamp deltas and offsets map signed integers to small non-negative integers via float-safe ZigZag encoding ($s \ge 0 \mapsto 2s$, $s < 0 \mapsto -2s - 1$, normalizing `-0` to `0`) before encoding as unsigned VLE.
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

### 4.3 Grid v3 Sensor, Beacon, Dial & Stack Depot Extension Block (`ENV_VERSION_GRID_V3 = 3`)

Emitted only when a Grid map contains Module 5–6 extensions: `beaconTiles`, `dialTiles`, stackable depots (`count > 1` on `worldItems`), or curriculum rule flags (`strictInteractionCollision`, `requireAllItemsCollected`, `requireEmptyBackpackAtGoal`). Immediately follows the exact `envVersion = 2` payload above.

```
+-----------------------------------------------------------------------------------------+
| ... exact envVersion = 2 payload (waterCells, lockedGates, floorSwitches, worldItems)... |
| gridRulesMask (uint8)                                                                   |
| beaconCount (VLE) | ... packed beacons: CellCoord + attrByte ...                        |
| dialCount (VLE)   | ... packed dials: CellCoord + valueByte ...                         |
| stackCountOverridesCount (VLE) | ... packed stack items: itemIdx (VLE) + count (VLE) ...|
+-----------------------------------------------------------------------------------------+
```

9. **Grid Rules Mask (`gridRulesMask: uint8`):**
   - `bit 0 (0x01)`: `strictInteractionCollision` (blind `PICK_UP` on empty tile or invalid `USE_DROP` triggers `COLLISION`).
   - `bit 1 (0x02)`: `requireAllItemsCollected` (goal evaluation requires all floor world items to be collected).
   - `bit 2 (0x04)`: `requireEmptyBackpackAtGoal` (goal evaluation requires robot backpack to be empty).
   - `bits 7..3`: Reserved (`0`).
10. **Floor Beacons (`beaconCount: VLE`):** For each floor beacon tile:
    - `coord: CellCoord` (1 byte `[x: 4b][y: 4b]` on small grids, `x: VLE, y: VLE` on large grids).
    - `attrByte: uint8` = `[0000 (b7..b4) | colorIdx (b3..b2: 0=red, 1=blue, 2=green, 3=yellow) | shapeIdx (b1..b0: 0=circle ●, 1=triangle ▲, 2=square ■, 3=diamond ◆)]`.
11. **Floor Dials (`dialCount: VLE`):** For each numbered floor dial:
    - `coord: CellCoord`
    - `valueByte: uint8` = Dial value `1..20` (read by `$tileDial` sensor).
12. **Stack Count Overrides (`stackCountOverridesCount: VLE`):** For each world item with `count > 1`:
    - `itemIdx: VLE` (0-based index into the `worldItems` table).
    - `count: VLE` (total stack count, e.g. `3` or `5`).

### 4.4 Switchyard Environment State Payload (`ENV_ID_SWITCHYARD = 0x05`, `ENV_VERSION_SWITCHYARD = 1`)

When `envId = 0x05`, the Switchyard layout and queue payload immediately follows the 3-byte header:

```
+-------------------------------------------------------------------------+
| hasLayout (uint8)                                                       |
| [If hasLayout == 1]:                                                    |
|   layoutFlags (uint8: 0)                                                |
|   switchCount (uint8: 1..2)                                             |
|   ... switchDirections (1 byte each: 0=LEFT, 1=RIGHT) ...               |
|   dockCount (uint8: 2..3)                                               |
|   ... dockSpecs: dockFlags (1B), [acceptColorIdx: 1B], [acceptIconIdx: 1B] |
|   queueLength (VLE)                                                     |
|   ... queueItems (1 byte each: [damaged: 1b | icon: 2b | color: 2b]) ... |
+-------------------------------------------------------------------------+
```

1. **Layout Flag (`hasLayout: uint8`):**
   - `0x00`: Default sandbox layout (reconstructs via `createInitialSwitchyardState()`).
   - `0x01`: Custom or lesson layout follows.
2. **Layout Header:**
   - `layoutFlags` (`uint8`): Reserved flags (`0x00`).
   - `switchCount` (`uint8`, `1..2`): Number of track diverter switches (`1` for Switch A, `2` for Switches A and B).
   - For each switch: `direction: uint8` (`0` = `LEFT`, `1` = `RIGHT`).
3. **Target Docks (`dockCount: uint8`, `2..3`):** For each dock:
   - `dockFlags: uint8`:
     - `bit 0 (0x01)`: `hasAcceptColor`
     - `bit 1 (0x02)`: `hasAcceptIcon`
     - `bit 2 (0x04)`: `rejectDamaged`
   - If `hasAcceptColor` (`bit 0`): `acceptColorIdx: uint8` (`0` = `RED`, `1` = `BLUE`, `2` = `GREEN`, `3` = `YELLOW`).
   - If `hasAcceptIcon` (`bit 1`): `acceptIconIdx: uint8` (`0` = `CRATE`, `1` = `BATTERY`, `2` = `GEAR`, `3` = `CRYSTAL`).
4. **Queue (`queueLength: VLE`):**
   - For each item in the conveyor queue: 1 byte `itemByte`:
     - `bits 1..0`: `colorIdx` (`0` = `RED`, `1` = `BLUE`, `2` = `GREEN`, `3` = `YELLOW`).
     - `bits 3..2`: `iconIdx` (`0` = `CRATE`, `1` = `BATTERY`, `2` = `GEAR`, `3` = `CRYSTAL`).
     - `bit 4 (0x10)`: `damaged` flag (`1` = damaged / hazard item, `0` = intact).
     - `bits 7..5`: Reserved (`0`).
### 4.5 Depot Warehouse Payload (`ENV_ID_DEPOT = 0x07`, `envVersion = 1..3`)

When `envId = 0x07`:
- `envVersion = 1` (`ENV_VERSION_DEPOT = 1`): Code-only stream, no state payload; Code Payload (§5) begins immediately at byte 3.
- `envVersion = 2` (`ENV_VERSION_DEPOT_STATE = 2`): Stack-only layout (M3 baseline, e.g. lessons `3.8`–`3.10` and `4.6`):
  1. `flags: uint8`:
     - `bit 0 (0x01)`: `hasState` (always `1`)
     - `bit 1 (0x02)`: `hasTargetStacks`
     - `bit 2 (0x04)`: `hasTargetOutput`
  2. `workerStation: uint8`: `0` = `STACK_1`, `1` = `STACK_2`, `2` = `STACK_3`.
  3. `initialStacks`: 3 × crate list (`count: VLE`, followed by `count` × `colorByte: uint8` where 0=RED, 1=BLUE, 2=GREEN, 3=AMBER).
  4. `targetStacks` (if `bit 1`): 3 × crate list.
  5. `targetOutput` (if `bit 2`): 1 × crate list.
- `envVersion = 3` (`ENV_VERSION_DEPOT_QUEUE = 3`): Module 5 FIFO Conveyor Queue & Hazard extension layout:
  Follows the exact `envVersion = 2` prefix above (where `flags bit 3 (0x08)` indicates `hasQueue` and `workerStation` code `3` = `QUEUE`), followed immediately by:
  6. `queue`: `queueLen: VLE`, followed by `queueLen` × `queueItemByte: uint8` where `bits 3..0 = colorCode (0..3)` and `bit 7 (0x80) = damaged flag`.
  7. `scrapCount: VLE`: Count of scrapped damaged crates.
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
  Bit 7 (0x80)    Bit 6 (0x40)    Bit 5 (0x20)          Bits 4..0 (0x1F)
+---------------+---------------+---------------------+------------------+
| HasVarParam   | HasRep        | ElseHasCond (0x05)  | Opcode (0..31)   |
+---------------+---------------+---------------------+------------------+

Optional Byte 1 (paramVarMask — PRESENT ONLY IF HasVarParam == 1):
  Bits 7..3 (0)   Bit 2 (0x04)     Bit 1 (0x02)     Bit 0 (0x01)
+---------------+----------------+----------------+----------------+
| Reserved (0)  | Param1IsVar    | Param0IsVar    | RepeatIsVar    |
+---------------+----------------+----------------+----------------+
```

1. **`blockHeader` Bit 5 (`MASK_ELSE_HAS_COND = 0x20`):**
   - On `OP_ELSE = 0x05`, Bit 5 indicates an `ELSE_IF` block (`0x25`), followed immediately by a `ConditionExpr` prefix tree (§7.1.2).
   - Plain `ELSE` emits `0x05` (Bit 5 = 0, 0 parameter bytes).
   - For all other standard opcodes, Bit 5 is reserved (`0`).
2. **`paramVarMask` (`uint8`, present iff `HasVarParam == 1`):**
   - `bit 0 (0x01)`: `repeatCount` is a variable index (`varIdx: uint8`) instead of `VLE`.
   - `bit 1 (0x02)`: Action parameter 0 is a variable index (`varIdx: uint8`) instead of `VLE`/`uint8`.
   - `bit 2 (0x04)`: Action parameter 1 is a variable index (`varIdx: uint8`) instead of `VLE`.
3. **Repeat Count (present iff `HasRep == 1`):**
   - If `HasVarParam == 1` and `(paramVarMask & 0x01) != 0`: `varIdx: uint8` (`0..25`).
   - Otherwise: `repeatCount: VLE`.
3. **Opcode-Specific Parameters:** Dictated strictly by `(envByte, opcode)` and `paramVarMask` bits `1..2`.

### 6.2 Special Unconditional Descriptor Envelopes (`0x07`, `0x08`, `0x09`)

`OP_VAR_ASSIGN (0x07)`, `OP_VAR_OP (0x08)`, and `OP_PLACEHOLDER (0x09)` never use `HasVarParam` or `HasRep` (`Byte 0` is literally the raw opcode byte `0x07`, `0x08`, or `0x09` with bits `7..5 = 0`):

1. **`OP_VAR_ASSIGN = 0x07` (`a = b`):**
   ```
   Byte 0: 0x07 (OP_VAR_ASSIGN — bits 7..5 MUST be 0)
   Byte 1: operandDescMask (ALWAYS present; bits 1..0 = typeB, bits 7..2 = 0 in M1–M6; bit 6 / 0x40 reserved for M7 color literal)
   Byte 2: targetVarIdx (uint8: 0..25 for 'a'..'z')
   Byte 3+: operandB payload governed by operandDescMask
   ```
2. **`OP_VAR_OP = 0x08` (`a = b op c`):**
   ```
   Byte 0: 0x08 (OP_VAR_OP — bits 7..5 MUST be 0)
   Byte 1: operandDescMask (ALWAYS present; bits 1..0 = typeB, bits 3..2 = typeC, bits 7..4 = 0 in M1–M6)
   Byte 2: targetVarIdx (uint8: 0..25 for 'a'..'z')
   Byte 3: opByte (uint8: 0x00..0x0C — see §7.1.1)
   Byte 4+: operandB payload, followed immediately by operandC payload
   ```
   **2-Bit Operand Type Codes (`typeB`, `typeC`):**
   - `0` (`00`): Variable or Sensor Reference (`OPERAND_TYPE_VAR`) — `1 byte` (`varOrSensorIdx: uint8`):
     - `0x00`..`0x19`: Variables `'a'..'z'` (`0..25`).
     - `0x80`..`0x83`: Live Sensor References (`SENSOR_REF_FLAG = 0x80`):
       - `0x80`: `$x` (Turtle / LOGO X position)
       - `0x81`: `$y` (Turtle / LOGO Y position)
       - `0x82`: `$heading` (Turtle / LOGO heading angle 0..359°)
       - `0x83`: `$tileDial` (Grid World rotatable dial sensor)
       - `0x40`: Reserved for Module 7 color literal.
   - `1` (`01`): Non-negative integer — `VLE(n)`
   - `2` (`10`): Negative integer — `VLE(abs(n))`
   - `3` (`11`): IEEE-754 float64 — `8 bytes` big-endian (`DataView.setFloat64`)
3. **`OP_PLACEHOLDER = 0x09` (`?` Scaffold Block):**
   ```
   Byte 0: 0x09 (OP_PLACEHOLDER — bits 7..5 MUST be 0)
   Byte 1+: hintCategory (VLE: 0..4 active in M1–M3; 5..15 reserved for M4–M11; unknown codes fall back to 'any')
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
| `0x04` | `OP_IF` (`IF`) | `condition: ConditionExpr` | Conditional branch start; followed immediately by `ConditionExpr` prefix tree (§7.1.2). |
| `0x05` | `OP_ELSE` (`ELSE` / `ELSE_IF`) | None (`ELSE`), `condition: ConditionExpr` (`ELSE_IF`) | Branch separator. Plain `ELSE` emits `0x05` (0 param bytes, 1 byte total); `ELSE_IF` sets `MASK_ELSE_HAS_COND = 0x20` (`0x25`) followed immediately by `ConditionExpr` (§7.1.2). |
| `0x06` | `OP_END_IF` (`END_IF`) | None | Conditional branch closer (0 parameter bytes, 1 byte total). |
| `0x07` | `OP_VAR_ASSIGN` (`VAR_ASSIGN`) | `operandDescMask`, `varIdx`, `operandB` | Assigns `a = b` (see §6.2). |
| `0x08` | `OP_VAR_OP` (`VAR_OP`) | `operandDescMask`, `varIdx`, `opByte`, `operandB`, `operandC` | Evaluates `a = b op c` (see §6.2 & §7.1.1). |
| `0x09` | `OP_PLACEHOLDER` (`PLACEHOLDER`) | `hintCategory: VLE` | `?` scaffold slot. **Active in M1–M3 (`0..4`):** `0`=any, `1`=motion, `2`=turn, `3`=item, `4`=loop. **Reserved for M4–M11 (`5..15`):** `5`=function, `6`=conditional, `7`=sensor, `8`=variable, `9`=operator, `10`=socket (`11..15` unassigned; VLE-extensible). |
| `0x0A` | `OP_WHILE` (`WHILE`) | `condition: ConditionExpr` | Conditional loop start; followed immediately by `ConditionExpr` prefix tree (§7.1.2). |
| `0x0B` | `OP_END_WHILE` (`END_WHILE`) | None | Conditional loop closer (0 parameter bytes, 1 byte total). |
| `0x0C`–`0x0E` | Reserved | Reserved | Reserved for Module 7 shared tape opcodes (`OP_TAPE_SEEK = 0x0C`, `OP_TAPE_STEP = 0x0D`, `OP_TAPE_WRITE = 0x0E`; see [`env_depot_and_tape.md`](./env_depot_and_tape.md)). |
| `0x0F` | Reserved | Reserved | Reserved for future universal extensions. |

#### 7.1.1 `VAR_OP` Binary Operator Codes (`opByte: uint8`)

`0x00` `+` · `0x01` `-` · `0x02` `*` · `0x03` `/` · `0x04` `%` · `0x05` `==` · `0x06` `!=` · `0x07` `<` · `0x08` `<=` · `0x09` `>` · `0x0A` `>=` · `0x0B` `&&` · `0x0C` `||`.

#### 7.1.2 `ConditionExpr` Prefix-Tree Binary Encoding

`ConditionExpr` represents boolean sensor queries, relational expressions, and boolean combinators (`NOT`, `AND`, `OR`) encoded as a compact prefix tree. Each node starts with a 1-byte tag:

| Tag | Kind / Sensor | Parameters | Description |
| :--- | :--- | :--- | :--- |
| **Grid Boolean Sensors (`0x01`–`0x08`):** | | | |
| `0x01` | `pathAhead` | None | Robot path clear ahead. |
| `0x02` | `pathLeft` | None | Robot path clear to left. |
| `0x03` | `pathRight` | None | Robot path clear to right. |
| `0x04` | `itemHere` | None | Floor item present on current cell. |
| `0x05` | `carryingItem` | None | Robot backpack contains an item. |
| `0x06` | `atGoal` | None | Robot is standing on goal tile. |
| `0x07` | `tileColor` | `colorIdx: uint8` | Current tile matches color index (`0..9` in `PALETTE_COLORS`). |
| `0x08` | `unvisitedAhead` | None | Reserved for Module 11 footprint backtracking. |
| **Switchyard Boolean Sensors (`0x10`–`0x13`):** | | | |
| `0x10` | `hasNextItem` | None | Incoming car/item queue is non-empty. |
| `0x11` | `itemDamaged` | None | Scanned switchyard car is cracked/damaged. |
| `0x12` | `itemColor` | `colorIdx: uint8` | Scanned switchyard car color (`0..9`). |
| `0x13` | `itemIcon` | `iconIdx: uint8` | Scanned switchyard emblem (`0`=crate, `1`=battery, `2`=gear, `3`=crystal). |
| **Depot Boolean & Color-Match Sensors (`0x18`–`0x1C`):** | | | |
| `0x18` | `stationEmpty` | `stationCode: uint8` | Station is empty (`0`=CURRENT, `1`=STACK_1, `2`=STACK_2, `3`=STACK_3, `4`=QUEUE, `5`=INPUT). |
| `0x19` | `hasItem` | None | Claw/worker is holding a crate. |
| `0x1A` | `itemDamaged` | None | Held or front/top crate is cracked/damaged. |
| `0x1B` | `heldColor` | `colorIdx: uint8` | Held crate color (`0..9`). |
| `0x1C` | `topColor` | `colorIdx: uint8` | Top crate color of active stack (`0..9`). |
| **Boolean Combinators (`0x20`–`0x22`):** | | | |
| `0x20` | `NOT` | `operand: ConditionExpr` | Inverts child condition (e.g. `NOT pathAhead`). |
| `0x21` | `AND` | `left: ConditionExpr`, `right: ConditionExpr` | Conjunction of two child conditions. |
| `0x22` | `OR` | `left: ConditionExpr`, `right: ConditionExpr` | Disjunction of two child conditions. |
| **Reserved Comparisons (`0x30`):** | | | |
| `0x30` | `CMP` | Reserved | Reserved for Module 7 color equality & Module 8 numeric relational comparisons (`<`, `>`, `==`, `!=`, `%`). |

---

### 7.2 Grid World Opcodes (`ENV_ID_GENERIC = 0x00` or `ENV_ID_GRID = 0x01`, `envVersion = 1..3`)

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
| `0x1C` | `WAIT` | `duration: VLE \| varIdx` | Pause simulation for `duration` (encoded as hundredths of seconds `VLE`, or `varIdx`). |
| `0x1D` | `SET_INSTANT` | `mode: uint8` | Toggle instant drawing mode (`1` = ON, `0` = OFF). |
| `0x1E` | `CLEAR_CANVAS` | None | Clears turtle drawing canvas and resets pen state. |
| `0x1F` | `TELEPORT` | `refMask: uint8`, `x`, `y`, `heading` | Teleport turtle to coordinate `(x, y)` with `heading`. `refMask` bits `0` (x), `1` (y), `2` (heading) indicate if each coordinate is a `varIdx \| sensorIdx` (`uint8`) or signed `VLE`. |

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

### 7.5 Switchyard Conveyor & Sorter Opcodes (`ENV_ID_SWITCHYARD = 0x05`, `ENV_VERSION_SWITCHYARD = 1`)

All Switchyard action opcodes use the Standard Block Envelope (§6.1). `SEND_NEXT` supports `MASK_HAS_REP (0x40)` for batch dispatch badges (`×2..×9` or `VLE`) and `MASK_HAS_VAR_PARAM (0x80)` (`paramVarMask & 0x01`) when repeat count is a variable name (`'a'..'z'`).

| Opcode | Constant / Action Type | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `OP_SWITCHYARD_SWITCH_LEFT` (`SWITCH_LEFT`) | None | Toggle track switch A to `LEFT` branch (or toggles designated junction switch). |
| `0x11` | `OP_SWITCHYARD_SWITCH_RIGHT` (`SWITCH_RIGHT`) | None | Toggle track switch A to `RIGHT` branch (or toggles designated junction switch). |
| `0x12` | `OP_SWITCHYARD_SEND_NEXT` (`SEND_NEXT`) | None | Releases front car from the conveyor queue down track into the active switch network (supports `MASK_HAS_REP` + variable repeat). |
| `0x13` | `OP_SWITCHYARD_SCRAP_ITEM` (`SCRAP_ITEM`) | None | Diverts front car from the scanner gate directly into the scrap chute. Intact cars entering scrap cause `COLLISION`. |
### 7.6 Crate Depot Opcodes (`ENV_ID_DEPOT = 0x07`, `envVersion = 1..3`)

All Depot opcodes use the Standard Block Envelope (§6.1). When action parameters hold variable names (`'a'..'z'`), `MASK_HAS_VAR_PARAM (0x80)` is set in `blockHeader` and `paramVarMask` (`Byte 1`) indicates variable parameters (`bit 1 = 0x02` for `param0`).

| Opcode | Constant / Action Type | Parameters (`param0`) | Description |
| :--- | :--- | :--- | :--- |
| `0x10` | `OP_DEPOT_MOVE_TO` (`DEPOT_MOVE_TO`) | `stationCode: uint8 \| varIdx` | Station code (`0` = `STACK_1`, `1` = `STACK_2`, `2` = `STACK_3`, `3` = `QUEUE`). Supports `paramVarMask & 0x02` for dynamic stack index variable. |
| `0x11` | `OP_DEPOT_GRAB` (`DEPOT_GRAB`) | None | Grabs top crate from current stack or dequeues front crate from FIFO queue into claw. |
| `0x12` | `OP_DEPOT_PLACE` (`DEPOT_PLACE`) | None | Places held crate onto current stack or enqueues at back of FIFO queue. |
| `0x13` | `OP_DEPOT_SEND_OUT` (`DEPOT_SEND_OUT`) | None | Sends held crate to default `[OUT]` bay (parameterless for full M3 backward compatibility). |
| `0x14` | `OP_DEPOT_SEND_GATE` (`DEPOT_SEND_GATE`) | `gateCode: uint8 \| varIdx` | Sends held crate to specified dock gate (`0` = `OUT`, `1` = `SCRAP`, `2` = `ACCEPT`, `3` = `REJECT`). Supports `paramVarMask & 0x02`. |

#### 7.6.1 Depot Boolean Sensors (ConditionExpr `0x18`–`0x1C`)

Governed by Module 5 `ConditionExpr` prefix-tree evaluation:
- `0x18` `stationEmpty` (`stationCode: uint8` — `0=CURRENT`, `1=STACK_1`, `2=STACK_2`, `3=STACK_3`, `4=QUEUE`, `5=INPUT`): True when station has zero items.
- `0x19` `hasItem`: True when claw holds a crate.
- `0x1A` `itemDamaged`: True when held crate is damaged (cracked).
- `0x1B` `heldColor` (`colorIdx: uint8` `0..3`): True when `$heldColor == colorIdx`.
- `0x1C` `topColor` (`colorIdx: uint8` `0..3`): True when `$topColor == colorIdx` (non-destructive peek at top/front crate of current station).
---

## 8. Base64URL Encoding

The resulting byte sequence (`Uint8Array`) is encoded as Base64URL (no padding):
- Standard Base64 `+` replaced with `-`.
- Standard Base64 `/` replaced with `_`.
- Trailing `=` padding characters omitted.
- Decoding converts `-` to `+`, `_` to `/`, re-adds padding, and decodes with `atob`.
