# Workspace Agent Rules

## General rules
- When asked for a review, a report, a plan or anything similar,
  create an artifact or link to a md file instead of putting long response in the output. In the output only put a very short summary with main point as well as things link next steps (which are not part of the artifact).
- Very important, when addressing comments on report/plan/review (be it artifact or file). Modify the part of the report which should change but also **keep all previous parts which did not change**! don't focus only on modified part. **No comment on a section mean its approved (or is pending review) and must be kept as is (can be updated but not removed)** and not lost!

## UI Principles & Kid-Friendly Design Contract
- **Mandatory UI Guidelines**: Before creating or modifying any UI component, toolbar, HUD overlay, palette control, or modal, read and follow [`docs/ui_guidelines.md`](./docs/ui_guidelines.md) (5–7y Zero-Reading Rule, strict single-row `<header>` budget, non-overlapping `pane-simulation` HUD slots, strict icon disambiguation, 2-tap destructive safety, click-to-dismiss `VictoryCelebrationModal` guards, and Zustand v5 SSR-safe store reads).

## Testing & Sandbox Execution
- **Always run Playwright outside the sandbox**: Any command that launches Playwright browsers or E2E tests (e.g., `npx playwright test`, `npm run test:e2e`, or `npm test` since it runs `npm run test:e2e`) MUST be executed directly with `BypassSandbox: true` without attempting a sandboxed run first.
- Unit tests (`npm run test:unit`) and production builds (`npm run build`) should still be run inside the standard sandbox (`BypassSandbox: false`).

## Curriculum Authoring & Tooling
- When authoring or modifying `docs/curriculum/` lesson/challenge specs or SVG assets, follow [`docs/curriculum/authoring_guide.md`](./docs/curriculum/authoring_guide.md) (document templates, Two-Layer Reading Policy, closer-inclusive flat block counting, and canonical pseudocode ↔ JSON AST rules).
- Validate curriculum changes inside the standard sandbox (`BypassSandbox: false`) using `npm run curriculum:logo`, `npm run curriculum:verify`, and `npm run curriculum:audit -- seq param loop func branch while var cmp --strict-stage2`.
