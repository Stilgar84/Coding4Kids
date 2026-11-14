# Module `branch`: Sensors & Branching — Making Decisions

> [← Curriculum Overview](../overview.md)

**Cognitive Goal:** Read live world sensors and the `🎛️ $input` scene selector to write adaptive branching rules (`If`, `If / Else`, `If / Else If / Else`, `NOT`/`AND`/`OR`) verified simultaneously against **3–4 visible variant maps/streams**, explicitly contrasting sequential `If` + `If` state-mutation bugs against `If / Else`, plus `$input`-driven creative branching. *(Conditional `While` loops & FIFO Queues continue in [`while`](../while/overview.md).)*

**Environments:**
- [🤖 Robot Grid](../../envs/robot_grid.md)
- [🚂 Switchyard / Conveyor Sorter](../../envs/switchyard.md)
- [🐢 Turtle LOGO](../../envs/turtle_logo.md)
- [🎵 Beat & Light Matrix](../../envs/beat_light.md)

---

## Lessons & Capstones

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`branch.0`** | 📖 | 🤖 | [Sensors, `If`, and Multi-Map Runs](./lesson_branch_0_sensors_if_multi_map.md) |
| **`branch.1`** | 🤖 | 🤖 | [Sensing & Simple `If`](./lesson_branch_1_sensing_and_simple_if.md) |
| **`branch.2`** | 📖 | 🚂 | [Meet the Switchyard (Scanner, Docks & Scrap Chute)](./lesson_branch_2_meet_the_switchyard.md) |
| **`branch.3`** | 🚂 | 🚂 | [Switchyard Warmup — Hazard Filtering (`If`)](./lesson_branch_3_switchyard_warmup_hazard_filtering.md) |
| **`branch.4`** | 📖 | 🚂 | [Two-Way Decisions (`If / Else`)](./lesson_branch_4_two_way_decisions_if_else.md) |
| **`branch.5`** | 🚂 | 🚂 | [Binary `If / Else` Sorting](./lesson_branch_5_binary_if_else_sorting.md) |
| **`branch.6`** | 🤖 | 🤖 | [Spatial `If / Else` & Directional Sensors](./lesson_branch_6_spatial_if_else_directional_sensors.md) |
| **`branch.7`** | 🤖 | 🤖 | [Boolean Combinators (`NOT`, `AND`, `OR`)](./lesson_branch_7_boolean_combinators.md) |
| **`branch.8`** | 🚂 | 🚂 | [Chained Multi-Way Routing (`If / Else If / Else`)](./lesson_branch_8_chained_multi_way_routing.md) |
| **`branch.9`** *(Idea)* | 🤖 | 🤖 | *Fix-It Bug Hunt: Fix a broken starter where two sequential `If` blocks mutate heading (`pathAhead`) and trigger both branches instead of `If / Else`* |
| **`branch.10`** *(Idea)* | 🐢 | 🐢 | *Creative `$input` Mood Mandala: Use the `🎛️ $input` selector (`1..4`) with `If / Else If` to switch live geometric shapes and palettes on tap* |
| **`branch.11`** *(Idea)* | 🎵 | 🎵 | *Creative `$input` Jukebox: Use `🎛️ $input` (`1..4`) to branch between distinct drum grooves and matching LED stamps* |
| **`branch.A`** | 🏆 | 🚂 | [Capstone `branch.A` — Hazard & Priority Router](./capstone_branch_a_hazard_priority_router.md) |
