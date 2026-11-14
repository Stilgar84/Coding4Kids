# Lesson `tape.5` — Scanning & Tape Bounds

> [← Module `tape` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🏗️ Depot](../../envs/depot.md)

Two demos on the physical Depot Tape rail:
1. `While (NOT $cellColor == Green)` linear scan stopping on target.
2. Out-of-bounds end-bumper `COLLISION` when stepping past cell `8` (e.g., when 🟢 is absent), guarded cleanly via `$headPos < $tapeLength` (such as `While ($headPos < $tapeLength AND NOT $cellColor == Green)`).
