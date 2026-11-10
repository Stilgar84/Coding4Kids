# Workspace Agent Rules

## Testing & Sandbox Execution
- **Always run Playwright outside the sandbox**: Any command that launches Playwright browsers or E2E tests (e.g., `npx playwright test`, `npm run test:e2e`, or `npm test` since it runs `npm run test:e2e`) MUST be executed directly with `BypassSandbox: true` without attempting a sandboxed run first.
- Unit tests (`npm run test:unit`) and production builds (`npm run build`) should still be run inside the standard sandbox (`BypassSandbox: false`).
