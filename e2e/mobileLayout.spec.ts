import { test, expect } from '@playwright/test';

test.describe('Mobile Phone Compact Vertical Layout', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE standard portrait mobile viewport
    isMobile: true,
    hasTouch: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');
  });

  test('renders thin single-line top bar with hamburger menu and critical buttons', async ({ page }) => {
    // Hamburger menu button and compact prev/next lesson navigation should be visible on mobile
    const hamburgerBtn = page.getByTestId('btn-hamburger-menu');
    await expect(hamburgerBtn).toBeVisible();
    await expect(page.getByTestId('btn-mobile-prev-lesson')).toBeVisible();
    await expect(page.getByTestId('btn-mobile-mode-indicator')).toContainText('L1');
    await expect(page.getByTestId('btn-mobile-next-lesson')).toBeVisible();

    // Critical buttons should be visible
    await expect(page.getByTestId('btn-undo')).toBeVisible();
    await expect(page.getByTestId('btn-redo')).toBeVisible();
    await expect(page.getByTestId('btn-toggle-map')).toBeVisible();
    await expect(page.getByTestId('btn-reset')).toBeVisible();
    await expect(page.getByTestId('btn-play')).toBeVisible();

    // Verify top bar stays within 375px viewport with no horizontal overflow
    const headerOverflows = await page.locator('header').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(headerOverflows).toBe(false);

    // Navigate next/prev lessons directly from narrow top bar
    await page.getByTestId('btn-mobile-next-lesson').click();
    await expect(page.getByTestId('btn-mobile-mode-indicator')).toContainText('L2');
    await page.getByTestId('btn-mobile-prev-lesson').click();
    await expect(page.getByTestId('btn-mobile-mode-indicator')).toContainText('L1');

    // Desktop-only toolbar buttons should NOT be visible in the top header
    await expect(page.getByTestId('btn-save-modal')).not.toBeVisible();
    await expect(page.getByTestId('btn-load-modal')).not.toBeVisible();
    await expect(page.getByTestId('btn-export-import')).not.toBeVisible();
    await expect(page.getByTestId('btn-step')).not.toBeVisible();
    await expect(page.getByTestId('sim-tab-grid')).not.toBeVisible();
  });

  test('opens and closes mobile hamburger drawer with secondary controls', async ({ page }) => {
    // Click hamburger button to open drawer
    await page.getByTestId('btn-hamburger-menu').click();

    // Verify drawer overlay and drawer content are visible
    const drawer = page.getByTestId('mobile-drawer-content');
    await expect(drawer).toBeVisible();

    // Controls inside drawer should be visible
    await expect(page.getByTestId('drawer-tab-grid')).toBeVisible();
    await expect(page.getByTestId('drawer-tab-turtle')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-save')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-load')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-share')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-speed')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-fullscreen')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-toggle-map')).toBeVisible();

    // Close the drawer using the close button
    await page.getByTestId('btn-close-mobile-menu').click();
    await expect(drawer).not.toBeVisible();
  });

  test('collapsible function bar in subpalette control row toggles cleanly', async ({ page }) => {
    // By default, collapsible function bar is hidden
    await expect(page.getByTestId('palette-function-bar')).not.toBeVisible();

    // Click function bar toggle button
    const toggleFuncBtn = page.getByTestId('btn-toggle-function-bar');
    await expect(toggleFuncBtn).toBeVisible();
    await toggleFuncBtn.click();

    // Function bar should now be visible with scope tabs
    const funcBar = page.getByTestId('palette-function-bar');
    await expect(funcBar).toBeVisible();
    await expect(page.getByTestId('palette-tab-main')).toBeVisible();
    await expect(page.getByTestId('palette-tab-f1')).toBeVisible();

    // Click F1 tab
    await page.getByTestId('palette-tab-f1').click();

    // Toggle button should now show F1
    await expect(toggleFuncBtn).toHaveText(/F1/);

    // Click toggle button again to hide function bar
    await toggleFuncBtn.click();
    await expect(funcBar).not.toBeVisible();
  });

  test('deletes single block using delete button in subpalette control row', async ({ page }) => {
    const deleteBtn = page.getByTestId('btn-palette-delete-block');
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toBeDisabled();

    // Add two blocks to workspace
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();

    const fwdBlock = page.locator('[data-testid^="block-MOVE_FWD"]');
    const turnBlock = page.locator('[data-testid^="block-TURN_LEFT"]');
    await expect(fwdBlock).toBeVisible();
    await expect(turnBlock).toBeVisible();

    // Click on the forward block to select it
    await fwdBlock.click();

    // Delete button in subpalette should now be enabled
    await expect(deleteBtn).toBeEnabled();

    // Click delete button
    await deleteBtn.click();

    // Forward block should be removed, turn block remains
    await expect(fwdBlock).not.toBeVisible();
    await expect(turnBlock).toBeVisible();
  });

  test('hides and shows simulation map to provide 100% editor height', async ({ page }) => {
    const mapPane = page.getByTestId('pane-simulation');
    await expect(mapPane).toBeVisible();

    // Click map toggle button in top bar
    const mapToggleBtn = page.getByTestId('btn-toggle-map');
    await mapToggleBtn.click();

    // Map pane should now be hidden
    await expect(mapPane).not.toBeVisible();

    // Click map toggle button again to restore map
    await mapToggleBtn.click();
    await expect(mapPane).toBeVisible();
  });

  test('subpalette parameters open without clipping', async ({ page }) => {
    // Add variable assignment block which has parameters
    await page.getByTestId('palette-var-assign').click();

    // Variable subpalette should be visible
    const subpalette = page.getByTestId('block-subpalette-var-assign');
    await expect(subpalette).toBeVisible();

    // Check that variable options inside subpalette are visible and clickable
    const varBtn = page.getByTestId('subpalette-assign-a-b');
    await expect(varBtn).toBeVisible();
    await varBtn.click();

    // Toggle subpalette closed via param toggle button
    const paramToggleBtn = page.getByTestId('palette-param-toggle-btn');
    await paramToggleBtn.click();
    await expect(subpalette).not.toBeVisible();
  });
});
