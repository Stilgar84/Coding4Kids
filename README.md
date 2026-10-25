[![Build](https://github.com/Stilgar84/Coding4Kids/actions/workflows/static.yml/badge.svg)](https://github.com/Stilgar84/Coding4Kids/actions/workflows/static.yml)
 [![Tests](https://github.com/Stilgar84/Coding4Kids/actions/workflows/test.yml/badge.svg)](https://github.com/Stilgar84/Coding4Kids/actions/workflows/test.yml)

# 🤖 Robot Emulator

A kid-friendly, pre-reader visual robot programming app with a 2D grid simulation, designed for Windows PC and Android tablets with full offline PWA support.

---

## ✨ Features

- **Zero-Reading Required (Icon + Number UI)**: All blocks, tools, and actions are represented with high-contrast, intuitive icons and numbers.
- **Split Screen Layout**:
  - **Left**: Block-based programming environment with drag/tap palette, number repeat badges, loops, and Functions 1, 2, 3.
  - **Right**: 2D Grid simulation with robot orientation, edge barriers, intermediate flags, goal flag, and path tracing.
- **Lockstep Interpreter**:
  - Executes one instruction at a time live against the simulation environment (no pre-flattening).
  - Built-in support for future conditional statements and sensor checks.
  - Real-time active block highlighting during playback and step-by-step execution.
- **Loop Support**:
  - `Loop Start` paired with `Loop End`. Drag or tap any number badge (`2`..`9`) onto the loop to set iteration count.
- **Subroutines / Functions**:
  - Dedicated tabs for `Main`, `Function 1`, `Function 2`, and `Function 3`.
  - Subroutine call blocks (`Call 1`, `Call 2`, `Call 3`) with recursion safety guards.
- **Barrier & Grid Editing**:
  - Tap cell edges to toggle barriers preventing robot motion.
  - Interactive tools to place robot heading, intermediate flags, and goal flags.
  - Optional toggleable footstep path trace (`👣`).
- **Offline Progressive Web App (PWA)**:
  - Service worker caching ensures 100% offline availability on both Windows desktop and Android tablets.
- **End-to-End & Unit Testing from Day 1**:
  - Playwright E2E testing across Desktop Chrome and Android Tablet viewports.
  - Vitest unit testing for interpreter state transitions, loop unrolling, and edge collision checks.

---

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing
```bash
# Run Unit Tests (Vitest)
npm run test:unit

# Run End-to-End Tests (Playwright)
npm run test:e2e

# Run Complete Suite
npm run test
```

### Production Build & PWA
```bash
npm run build
npm run preview
```
