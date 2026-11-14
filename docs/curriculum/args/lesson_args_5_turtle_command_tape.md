# Lesson `args.5` — Turtle Command Tape (Stored-Program Interpreter)

> [← Module `args` Overview](./overview.md) · **Format:** 🐢 Sandbox · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

**Initial Sparse Tape (`1..12` of `10,000`):** `[1, 3, 1, 2, 1, 3, 1, 2, 1, 3, 1, 2]` — instruction codes: `1 = Forward 30`, `2 = Turn Left 90°`, `3 = Turn Right 90°`, `4 = Pen Up`, `5 = Pen Down`

## Starter

```
// MAIN (6 blocks)
TAPE_SEEK [1]
While (NOT $cellEmpty)       // runs however many commands the kid puts on the 10k tape!
  a = $cellValue
  Call F1(a)
  TAPE_STEP [RIGHT]
End While

// F1(●): Instruction decoder (10 blocks — or split across F1/F2 ≤ 8 blocks/tab)
If (● == 1)
  FORWARD [30]
End If
If (● == 2)
  TURN_LEFT [90]
End If
If (● == 3)
  TURN_RIGHT [90]
End If
```

## Variation Cards

- `[Img 1]` **Staircase Climber:** `[1, 3, 1, 2, 1, 3, 1, 2, 1, 3, 1, 2]` (12 cells).
- `[Img 2]` **Greek Key Meander:** 24-command program stored in cells `1..24` drawing an interlocking border.
- `[Img 3]` **Dashed Secret Code (with `4`=PenUp / `5`=PenDown):** Uses `F2(●)` for pen codes `4` & `5` to draw Morse-style dot-dash art across 30+ cells.

**Kid discovery:** *"My blocks built a tiny computer, and the Tape is its program!"*
