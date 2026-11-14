# Lesson `args.0` — Shape-Socket Inputs (`F1(●)`) & Local vs. Shared Scope

> [← Module `args` Overview](./overview.md) · **Format:** 📖 Explanation · **Environment:** [🐢 Turtle LOGO](../../envs/turtle_logo.md)

Interactive demo showing:
1. `Call F1(30)` and `Call F1(70)` plugging distinct values into `F1`'s private call-frame socket `●` while leaving global variable `a` untouched.
2. **Scope Hygiene Contrast:** Because helpers have no return-value slot, inputs travel safely via **local sockets (`●`, `▲`, `■`)** per call frame, whereas outputs or side-effects travel via the **world, shared globals (`a`–`z`), or Sparse Memory Tape**—setting up clean mental models for recursion (`rec`) and concurrency (`conc`).
