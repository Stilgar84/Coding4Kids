# Lesson `rec.6` — Footprint Breadcrumbs & `unvisitedAhead`

> [← Module `rec` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🤖 Robot Grid](../../envs/robot_grid.md)

Two side-by-side cave demos:
1. Showing why checking `pathAhead` alone at multi-way junctions loops back onto already-walked tiles.
2. Showing how floor footprints make `unvisitedAhead` light up *only* on fresh, unexplored branches so dead ends unwind cleanly.
