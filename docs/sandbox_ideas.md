# Free-Play Sandbox & Future Evolution Ideas (Non-Curriculum Backlog)

This document collects **advanced sandbox toys, power-user extensions, and long-term platform evolutions** that intentionally live **outside** the core newcomer curriculum ([`curriculum/overview.md`](./curriculum/overview.md))—either because they carry device-specific UX quirks unsuitable for graded lessons or because they target advanced hobbyists, older readers, and adult developers playing in **Pro Sandbox** mode.

---

## 1. Alternative / Textual Programming Representations (Post-Block Evolution)

Once learners read fluently and have mastered control flow, data structures, recursion, and concurrency in the zero-reading block workspace, `robotemu` can offer **additional programming frontends** compiling to the **exact same bytecode / interpreter VM and simulation environments**:
- **Structured Readable Blocks / Hybrid AST Editor:** Compact Scratch/Blockly-like or frame-based structured blocks with named variables, named functions, and inline expressions (`x + vx * dt`).
- **Text-Based Code View(s):** Lightweight kid-to-pro text syntax (e.g., Python-flavored or Lua/Pico-8-style scripts) with bidirectional or one-way block-to-text inspection, live line highlighting during tick-by-tick stepping, and full compatibility with every Grid, Switchyard, Depot, LOGO, and Beat & Light sandbox!

---

## 2. Hardware Sensors & Simulated Input Widgets

- **Hardware Gyroscope / Accelerometer (`$tiltX`, `$tiltY`, `$shake`):**
  - *Why deferred from curriculum:* Requires HTTPS gesture-gated OS permission dialogs on iOS Safari, behaves inconsistently across orientation-locked tablets, and requires fallback emulation on desktop/Chromebook.
  - *Sandbox design:* Expose `$tiltX` / `$tiltY` (`-1.0 .. +1.0`) in Free-Play Sandbox alongside a draggable **2D Virtual Tilt Puck** on desktop so users can build rolling-ball marble mazes on the Beat LED pad or tilt-steered LOGO brushes.
- **Microphone Level / Clap Trigger (`$micVolume`):**
  - Optional Web Audio `getUserMedia` amplitude readout for sound-reactive Beat & Light visualizers and voice-triggered LOGO bursts.

---

## 3. Advanced Concurrency & Preemptive Event Models

- **Preemptive / Concurrent Event Spawning:**
  - Side Module [`inter`](./curriculum/inter/overview.md) intentionally uses **single-threaded queued event dispatch** so interactive games never suffer accidental data races.
  - In Pro Sandbox (after `conc`), an optional **Concurrent Event Mode** could allow `On Tap` / `On Key` handlers to spawn concurrent fibers dynamically alongside running `Main` workers (combining events with `🔒 Lock` and `📨 Send`/`📬 $recv` channels).
- **Bounded / Non-Blocking Channels (`$canRecv`, Buffered Pipes):**
  - Extending `conc`'s synchronous rendezvous channels with buffered capacities (`1..N`) and non-blocking `$hasMessage` polling for actor-model simulations.

---

## 4. Demoscene Canvas, Audio & Simulation Extensions

- **High-Resolution Pixel Matrices (`64×64`+), Framebuffer Readback (`LEDS_TO_TAPE`) & Palette Shaders:**
  - Expanding Beat & Light's `8×8` / `16×16` / `32×32` LED matrix into a `64×64` fantasy-console framebuffer (paired with the `10,000`-cell Sparse Tape and [`STAMP_FROM_TAPE`](./envs/beat_light.md#2-action-blocks-staged-by-curriculum-module)).
  - **Matrix-to-Tape Readback (`LEDS_TO_TAPE` `🟦→📼` & `$ledColor(x, y)`):** Inverse of `STAMP_FROM_TAPE`—dumps the current `W × H` LED matrix colors into Sparse Tape starting at `headPos` (writing `∅` or `Black` for unlit LEDs) or reads individual pixel colors. While rarely needed in curriculum lessons, pairing `LEDS_TO_TAPE` + `STAMP_FROM_TAPE` unlocks double-buffered Conway's Game of Life, falling-sand cellular automata, and demoscene feedback shaders in Pro Sandbox.
- **Multi-Channel Synth & Waveform Controls:**
  - Unlocking waveform selection (sine, triangle, square, sawtooth, noise), ADSR envelope presets, and polyphonic chord voices across `Main 1..4` tracks in Beat & Light Sandbox.
- **Seeded PRNG Control:**
  - Optional explicit seed setter in Pro Sandbox so generative `🎲` LOGO artworks and procedural mazes can be shared deterministically via tiny Base64URL / QR payloads.
