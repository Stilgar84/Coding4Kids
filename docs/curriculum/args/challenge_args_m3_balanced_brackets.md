# Challenge `args.M3` — Balanced Brackets via Sparse Tape-as-Stack

> [← Module `args` Overview](./overview.md) · **Format:** 🔥 Mastery Challenge (`args`) · **Environment:** [🏗️ Depot](../../envs/depot.md) / [📼 Sparse Memory Tape](../../platform_requirements.md#12-shared-sparse-memory-tape-subsystem-with-per-worker-heads-in-conc)

**Setup:** Queue delivers a stream of colored open/close rings/blocks on a **`10,000`-cell sparse tape** used as an explicit stack (`s` = stack pointer starting at `1`):
- `🔴 Red` = push `Blue` expected closer onto tape at `s`, `s = s + 1`
- `🟢 Green` = push `Yellow` expected closer onto tape at `s`, `s = s + 1`
- `🔵 Blue` / `🟡 Yellow` = pop (`s = s - 1`, `TAPE_SEEK [s]`, verify `$cellColor == $heldColor`; if `s < 1` before pop, `TAPE_SEEK [0]` or flag `v = 0` rejects unbalanced closer!).
