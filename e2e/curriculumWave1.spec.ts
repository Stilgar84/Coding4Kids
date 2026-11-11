import { test, expect } from '@playwright/test';

test.describe('Wave 1 / Commit 1: Curriculum (Learn) vs Free-Play (Sandbox) Mode', () => {
  test('enforces read-only maps in Learn mode across 1.1–1.3 and mounts GridOverlayLayer slots', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    const learnBtn = page.getByTestId('btn-mode-curriculum');
    const sandboxBtn = page.getByTestId('btn-mode-sandbox');

    // Starts in Sandbox mode by default with editable tools & resize handles
    await expect(sandboxBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(learnBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('tool-wall')).toBeVisible();
    await expect(page.getByTestId('resize-handle-right')).toBeVisible();
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);

    // GridOverlayLayer slots are mounted inside GridCanvas SVG
    await expect(page.getByTestId('grid-slot-world-items')).toBeAttached();
    await expect(page.getByTestId('grid-slot-flag-padlocks')).toBeAttached();
    await expect(page.getByTestId('grid-slot-ghost-preview')).toBeAttached();
    await expect(page.getByTestId('grid-slot-demo-spotlights')).toBeAttached();

    // Switch to Learn mode -> loads canonical first Module 1 Activity 1.0, then switch to 1.1 (4 × 3)
    await learnBtn.click();
    await expect(learnBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(sandboxBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('mode-status-announcer')).toContainText('1.0');
    await page.getByTestId('btn-activity-1.1').click();
    await expect(page.getByTestId('mode-status-announcer')).toContainText('1.1');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 3');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();

    // Map editor tools, resize handles, and wall hitboxes are absent in Learn mode
    await expect(page.getByTestId('tool-robot')).toHaveCount(0);
    await expect(page.getByTestId('tool-wall')).toHaveCount(0);
    await expect(page.getByTestId('tool-flag')).toHaveCount(0);
    await expect(page.getByTestId('tool-goal')).toHaveCount(0);
    await expect(page.getByTestId('tool-erase')).toHaveCount(0);
    await expect(page.getByTestId('resize-handle-top')).toHaveCount(0);
    await expect(page.getByTestId('resize-handle-bottom')).toHaveCount(0);
    await expect(page.getByTestId('resize-handle-left')).toHaveCount(0);
    await expect(page.getByTestId('resize-handle-right')).toHaveCount(0);
    await expect(page.locator('[data-testid^="wall-h-hitbox-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="wall-v-hitbox-"]')).toHaveCount(0);

    // Visible corridor walls are still rendered faithfully
    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();

    // Solve Activity 1.1 with 3 Move Forward blocks
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 5000 });

    // Switch to Activity 1.2 (4 × 4) and 1.3 (4 × 3) via quick pills
    await page.getByTestId('btn-activity-1.2').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 4');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();

    await page.getByTestId('btn-activity-1.3').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 3');
    await expect(page.getByTestId('flag-1')).toBeVisible();
  });

  test('clones curriculum activity into editable Sandbox mode via Open Copy in Sandbox without mutating Learn map', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=1.2');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Booted directly into Learn mode on Activity 1.2
    await expect(page.getByTestId('btn-mode-curriculum')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 4');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();

    // Place 2 blocks in Activity 1.2
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Click "Open Copy in Sandbox"
    await page.getByTestId('btn-open-copy-sandbox').click();

    // Now in Sandbox mode with cloned 4 × 4 map and 2 blocks, and full editing restored
    await expect(page.getByTestId('btn-mode-sandbox')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 4');
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
    await expect(page.getByTestId('tool-wall')).toBeVisible();
    await expect(page.getByTestId('resize-handle-right')).toBeVisible();

    // Resize cloned Sandbox map to 5 × 4 and toggle a wall
    await page.getByTestId('btn-resize-right-plus').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('5 × 4');
    await page.getByTestId('wall-h-hitbox-0-1').click();
    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();

    // Switch back to Learn mode -> original 1.2 map is still read-only 4 × 4 without custom wall
    await page.getByTestId('btn-mode-curriculum').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 4');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
    await expect(page.getByTestId('wall-h-0-1')).toHaveCount(0);
  });

  test('supports keyboard activation (Tab + Enter/Space + Escape) and mobile drawer mode switching', async ({
    page,
  }) => {
    // Desktop keyboard activation check
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    const learnBtn = page.getByTestId('btn-mode-curriculum');
    await learnBtn.focus();
    await page.keyboard.press('Enter');
    await expect(learnBtn).toHaveAttribute('aria-pressed', 'true');

    // Select validated puzzle 1.1, open Solution modal and close with Escape
    await page.getByTestId('btn-activity-1.1').click();
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('solution-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('solution-modal')).toHaveCount(0);

    // Resize to mobile compact viewport (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByTestId('btn-mobile-mode-indicator')).toContainText('1.1');

    // Navigate next/prev curriculum activities directly from narrow top bar
    await page.getByTestId('btn-mobile-next-lesson').click();
    await expect(page.getByTestId('btn-mobile-mode-indicator')).toContainText('1.2');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 4');
    await page.getByTestId('btn-mobile-prev-lesson').click();
    await expect(page.getByTestId('btn-mobile-mode-indicator')).toContainText('1.1');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 3');

    // Open mobile drawer and verify Escape closes it
    await page.getByTestId('btn-hamburger-menu').click();
    await expect(page.getByTestId('mobile-drawer-content')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mobile-drawer-content')).toHaveCount(0);

    // Reopen drawer in Learn mode: Map Editor Tools hidden, select 1.3, then Open Copy in Sandbox
    await page.getByTestId('btn-hamburger-menu').click();
    await expect(page.getByTestId('drawer-mode-curriculum')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tool-wall')).toHaveCount(0);

    await page.getByTestId('drawer-activity-1.3').click();
    await page.getByTestId('drawer-btn-open-copy-sandbox').click();

    // Drawer closes automatically and app switches to Sandbox mode on mobile
    await expect(page.getByTestId('mobile-drawer-content')).toHaveCount(0);
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);

    // Reopen drawer in Sandbox mode -> Map Editor Tools are back!
    await page.getByTestId('btn-hamburger-menu').click();
    const drawer = page.getByTestId('mobile-drawer-content');
    await expect(drawer.getByTestId('drawer-mode-sandbox')).toHaveAttribute('aria-pressed', 'true');
    await expect(drawer.getByTestId('tool-wall')).toBeVisible();
  });
});
