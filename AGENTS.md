# Workspace Agent Rules

## UI Principles & Kid-Friendly Design Contract
- **Mandatory UI Guidelines**: Before creating or modifying any UI component, toolbar, HUD overlay, palette control, or modal, read and follow [`docs/ui_guidelines.md`](./docs/ui_guidelines.md) (5–7y Zero-Reading Rule, strict single-row `<header>` budget, non-overlapping `pane-simulation` HUD slots, strict icon disambiguation, 2-tap destructive safety, click-to-dismiss `VictoryCelebrationModal` guards, and Zustand v5 SSR-safe store reads).

## Testing & Sandbox Execution
- **Always run Playwright outside the sandbox**: Any command that launches Playwright browsers or E2E tests (e.g., `npx playwright test`, `npm run test:e2e`, or `npm test` since it runs `npm run test:e2e`) MUST be executed directly with `BypassSandbox: true` without attempting a sandboxed run first.
- Unit tests (`npm run test:unit`) and production builds (`npm run build`) should still be run inside the standard sandbox (`BypassSandbox: false`).
