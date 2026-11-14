# Side Module `inter`: 🕹️ Interactive Controls & Events *(Initial Stub)*

- **Module ID:** `inter`
- **Track:** Parallel Side Module (unlocks after Core Module [`var`](../var/overview.md))
- **Environments:** 🎵 Beat & Light Matrix (`8×8` up to `16×16` / `32×32`), 🐢 Turtle LOGO (`♾️ Live Interactive Mode`)

---

## Scope

### Core Concepts to Teach
1. **Live Input Polling:** Reading pointer/tap coordinates (`$pointerX`, `$pointerY`, `$pointerDown`—quantized to closest LED in Beat or canvas `(x, y)` in LOGO) and cross-device virtual D-Pad / action buttons (`▲ ▼ ◀ ▶ 🅰️ 🅱️`).
2. **LOGO Live Interactive Mode (`♾️`):** Running `MAIN` continuously at interactive frame rates using live sensor data, persistent variables, and optional random rolls (`🎲`).
3. **Queued Event Handlers (`On Key` / `On Tap → F1`):** Attaching helper tabs to input events using **single-threaded queued dispatch** (run-to-completion when idle, or dispatched cleanly between frames in Live Mode) to build playable synths, soundboards, reactive pixel pads, and mini-games with zero concurrency hazards.
4. **Expanded Matrix Canvases:** Unlocking `16×16` and `32×32` LED matrices for richer interactive pixel toys.

### Planned Capstones *(Module Badge)*
- **`inter.A` *(Idea — 🎨 Beat & Light)*:** *Playable Synth & Reactive Pixel Pad* (combining queued `On Key` / `On Tap` triggers with live LED ripples).
- **`inter.B` *(Idea — 🎨 Turtle LOGO `♾️ Live Mode`)*:** *Interactive Kaleidoscope / Arcade Sketch* (steering live geometry with `$pointerX`/`$pointerY` and virtual buttons).
