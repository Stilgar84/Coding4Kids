# Side Module `fp`: λ Functional Programming *(Future Placeholder)*

- **Module ID:** `fp`
- **Track:** Parallel Side Module *(Planned — unlocks after Core Module [`rec`](../rec/overview.md))*
- **Environments:** 📼 Sparse Memory Tape, 🚂 Switchyard, 🏗️ Depot, 🐢 Turtle LOGO

---

## Planned Scope *(Placeholder)*

1. **Pure Transformations & Immutability:** Writing side-effect-free helpers that read input ranges/sockets and write to fresh output regions without mutating inputs in place.
2. **First-Class & Higher-Order Function Sockets (`F1([Fn], ●, ▲)`):** Passing a helper tab badge (`F2`, `F3`) into a function socket to parameterize *behavior*, not just values.
3. **Classic Higher-Order Patterns (`Map`, `Filter`, `Reduce / Fold`):** Transforming Tape sequences (`Map`), declarative stream/tape selection (`Filter`), and aggregating totals/maximums (`Fold`).
4. **Recursion Over Loops:** Expressing iteration and list processing purely through tail-recursive helpers and higher-order combinators.

### Planned Capstones *(Module Badge)*
- **`fp.A` *(Idea — 🏆 Sparse Tape / Depot)*:** *Declarative `Map → Filter → Fold` Pipeline* (transforming and aggregating a multi-run Tape dataset using higher-order function sockets without mutable loop counters).
