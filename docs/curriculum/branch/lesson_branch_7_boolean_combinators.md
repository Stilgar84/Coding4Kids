# `branch.7` — `📖` Boolean Combinators (`NOT`, `AND`, `OR`)

- **Slug / Legacy Alias:** `branch.7` *(Legacy M5: `5.7`)*
- **Order:** `11` (Guided Read-Only Concept Demo)
- **Environment:** `robot-grid` (Tabs 1–2) + `switchyard` (Tab 3)
- **One-Concept Goal:** Introduce the three Boolean logic chips — **`NOT`** (flip a check), **`AND`** (both checks required), and **`OR`** (either check works) — before Fix-It debugging (`branch.9`) and compound puzzles (`branch.7a`/`7b`).

---

## 1. Zero-Reading UI & Adult Guidance

- **Learner-Facing UI:** Zero words. Logic pills highlight live (`! ⛔` for `NOT`, `& 🤝` for `AND`, `| 🔀` for `OR`) as each condition turns green or red during stepping.
- **Coach Spotlights (`3` Tabs):**
  - **Tab 1 (`NOT` — Wall Turn vs Walk):** `IF (NOT pathAhead) { TURN_RIGHT } ELSE { MOVE_FWD }` (`7` blocks) safely turns `SOUTH` at `(2,0)` without stepping twice in one loop turn (setting up `branch.9` Fix-It!).
  - **Tab 2 (`AND` — Exact Gem Filter):** `IF (tileColor == Blue AND itemHere) { PICK_UP }` skips the decoy gem on Red `(1,0)` and empty Blue tile `(2,0)`, grabbing only the gem on Blue `(3,0)`.
  - **Tab 3 (`OR` — Two-In-One Bin):** `IF (itemIcon == Battery OR itemIcon == Crystal) { SWITCH_LEFT } ELSE { SWITCH_RIGHT }` routes both power types Left and hardware Right.

<details>
<summary>📖 Parent / Teacher Tip (Adult-Only <code>explanationText</code>)</summary>

Combinators let you build smarter conditions from existing sensors:
- **`NOT`**: Flips true ↔ false (for example, `NOT pathAhead` means "a wall is right in front of me!").
- **`AND`**: Passes **only if both** sides are true (Gem on a Blue tile).
- **`OR`**: Passes if **either** side is true (Battery **or** Crystal).

</details>

---

## 2. Shared Configuration (`3` Read-Only Tabs)

```json
{
  "isGuidedDemo": true,
  "readOnlyWorkspace": true,
  "allowedScopes": ["MAIN"],
  "allowRecursion": false,
  "allowActionParams": false,
  "allowRepeatBadges": false,
  "editDelta": 0
}
```

---

## 3. Tab 1 — `NOT (pathAhead)` (`robot-grid`)

- **Palette:** `[MOVE_FWD, TURN_RIGHT]`, `[LOOP_START, LOOP_END, IF, ELSE, END_IF]`, sensor `pathAhead`, combinator `NOT`, `slotCap: 8`.
- **Map (`4×3` L-Corner):** Start `(0,0) EAST`, open `(1,0), (2,0), (2,1)[🏁]`, `#` wall at `(3,0)` and all other cells.

```text
MAIN (7 flat blocks):
1. LOOP_START (4)
2.   IF (NOT pathAhead)
3.     TURN_RIGHT
4.   ELSE
5.     MOVE_FWD
6.   END_IF
7. LOOP_END
```
- **Trace:** Iter 1 `(0,0)→(1,0)`; Iter 2 `(1,0)→(2,0)`; Iter 3 `NOT pathAhead == true` → `TURN_RIGHT (SOUTH)` at `(2,0)`; Iter 4 `(2,0)→(2,1) 🏁` ✓.

---

## 4. Tab 2 — `tileColor == Blue AND itemHere` (`robot-grid`)

- **Palette:** `[MOVE_FWD, PICK_UP]`, `[LOOP_START, LOOP_END, IF, END_IF]`, sensors `[tileColor, itemHere]`, combinator `AND`, `requireAllItemsCollected: false`, `slotCap: 7`.
- **Map (`5×1` Corridor):** `[S→] [🔴+★] [🔵] [🔵+★] [🏁]` (`(0,0)` to `(4,0)`).

```text
MAIN (6 flat blocks):
1. LOOP_START (4)
2.   MOVE_FWD
3.   IF (tileColor == Blue AND itemHere)
4.     PICK_UP
5.   END_IF
6. LOOP_END
```
- **Trace:** `(1,0)` Red+★ → `false`; `(2,0)` Blue+empty → `false`; `(3,0)` Blue+★ → `true → PICK_UP`; `(4,0)` Goal holding target gem ✓.

---

## 5. Tab 3 — `Battery OR Crystal` (`switchyard`)

- **Palette:** `[SWITCH_LEFT, SWITCH_RIGHT, SEND_NEXT]`, `[LOOP_START, LOOP_END, IF, ELSE, END_IF]`, sensor `itemIcon`, combinator `OR`, `1` switch (`[A]` badge omitted, `scrapEnabled: false`), `slotCap: 9`.
- **Stream (`N = 4`):** `[Battery(Amber), Gear(Blue), Crystal(Red), Crate(Green)]`
  - Left `↙`: `[Battery(A), Crystal(R)]` | Right `↘`: `[Gear(B), Crate(G)]`

```text
MAIN (8 flat blocks):
1. LOOP_START (4)
2.   IF (itemIcon == Battery OR itemIcon == Crystal)
3.     SWITCH_LEFT
4.   ELSE
5.     SWITCH_RIGHT
6.   END_IF
7.   SEND_NEXT
8. LOOP_END
```
- **Trace:** Item 1 (`Battery` → `↙`), Item 2 (`Gear` → `↘`), Item 3 (`Crystal` → `↙`), Item 4 (`Crate` → `↘`) ✓.
