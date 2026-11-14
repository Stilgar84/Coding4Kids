# Module `args`: Parameterized Functions & Stored Programs

> [← Curriculum Overview](../overview.md)

**Cognitive Goal:** Pass values into visual shape sockets (`F1(●)`, `F1(●, ▲)`, `F1(●, ▲, ■)`) with **isolated local stack scope**—explicitly contrasting private local sockets against shared globals (`a`–`z`) and Tape—and combine parameterized helpers with the `10,000`-cell sparse tape to build instruction interpreters, shape stampers, serializers, arpeggiators, and stack movers (`TransferN`). Completing `args` unlocks Side Module **[`conc`](../conc/overview.md)** and **Optional 🔥 Mastery Set `args`**.

**Environments:**
- [🐢 Turtle LOGO](../../envs/turtle_logo.md)
- [🤖 Robot Grid](../../envs/robot_grid.md)
- [🚂 Switchyard / Conveyor Sorter](../../envs/switchyard.md)
- [🎵 Beat & Light Matrix](../../envs/beat_light.md)
- [🏗️ Depot](../../envs/depot.md)

---

## Lessons & Capstones

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`args.0`** | 📖 | 🐢 | [Shape-Socket Inputs (`F1(●)`) & Local vs. Shared Scope](./lesson_args_0_shape_socket_inputs.md) |
| **`args.1`** | 🐢 | 🐢 | [Single-Input Helpers (`F1(●)`)](./lesson_args_1_single_input_helpers.md) |
| **`args.2`** | 🤖 | 🤖 | [Parameterized Corridor Helpers (`ClearBranch(●)`)](./lesson_args_2_parameterized_corridor_helpers.md) |
| **`args.3`** | 🚂 | 🚂 | [Parameterized Batch Subroutines (`FillBatch(●)`)](./lesson_args_3_parameterized_batch_subroutines.md) |
| **`args.4`** | 🐢 | 🐢 | [Two-Socket Toolkits (`F1(●, ▲)` = `Polygon(sides, size)`)](./lesson_args_4_two_socket_toolkits.md) |
| **`args.5`** | 🐢 | 🐢 | [Turtle Command Tape (Stored-Program Interpreter)](./lesson_args_5_turtle_command_tape.md) |
| **`args.6`** | 🐢 | 🐢 | [Multi-Shape Stamp Row](./lesson_args_6_multi_shape_stamp_row.md) |
| **`args.7`** | 🐢 | 🐢 | [Record & Mirror (Serialization)](./lesson_args_7_record_and_mirror.md) |
| **`args.8`** | 🎵 | 🎵 | [Tape Arpeggiator](./lesson_args_8_tape_arpeggiator.md) |
| **`args.9`** | 🏗️ | 🏗️ | [`TransferN(●, ▲, ■)` Stack Helper](./lesson_args_9_transfer_n_helper.md) |
| **`args.A`** | 🏆 | 🤖 | [Capstone `args.A` — Asymmetric Reactor Calibration](./capstone_args_a_asymmetric_reactor_calibration.md) |
| **`args.B`** | 🎨 | 🐢 | [Capstone `args.B` — Procedural City Skyline](./capstone_args_b_procedural_city_skyline.md) |

## Optional 🔥 Mastery Challenges (Set `args` — Unlocked after `args`)

| ID | Format | Env | Title |
| :--- | :---: | :---: | :--- |
| **`args.M1`** | 🔥 | 🏗️ / 🤖 | [Challenge `args.M1` — Physical Sorting Crane](./challenge_args_m1_sorting_crane.md) |
| **`args.M2`** | 🔥 | 🚂 | [Challenge `args.M2` — Run-Length Order Dispatcher](./challenge_args_m2_rle_order_dispatcher.md) |
| **`args.M3`** | 🔥 | 🏗️ / 📼 | [Challenge `args.M3` — Balanced Brackets via Sparse Tape-as-Stack](./challenge_args_m3_balanced_brackets.md) |
