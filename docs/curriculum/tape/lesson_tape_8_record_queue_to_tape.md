# Lesson `tape.8` — Record Queue to Tape

> [← Module `tape` Overview](./overview.md) · **Format:** 🏗️ Puzzle · **Environment:** [🏗️ Depot](../../envs/depot.md)

Drain 6 colored rings/blocks from the FIFO Queue, recording each item's `$heldColor` into Tape cells `1..6` in arrival order via `TAPE_WRITE` (and sending the physical item to Output, cleanly separating conserved physical items from electronic Tape memory).
