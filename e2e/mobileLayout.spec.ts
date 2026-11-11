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

  test('renders unified single-row top bar across 360px, 375px, 820px, and 1280px with zero overflow', async ({ page }) => {
    // Verify 375px mobile single-row header buttons
    await expect(page.getByTestId('btn-hamburger-menu')).toBeVisible();
    await expect(page.getByTestId('btn-lesson-picker')).toBeVisible();
    await expect(page.getByTestId('btn-solution')).toBeVisible();
    await expect(page.getByTestId('btn-undo')).toBeVisible();
    await expect(page.getByTestId('btn-reset')).toBeVisible();
    await expect(page.getByTestId('btn-step')).toBeVisible();
    await expect(page.getByTestId('btn-play')).toBeVisible();
    await expect(page.getByTestId('btn-speed')).toBeVisible();

    // Chevrons & profile pill hide cleanly on <sm / <md
    await expect(page.getByTestId('btn-prev-lesson')).not.toBeVisible();
    await expect(page.getByTestId('btn-next-lesson')).not.toBeVisible();
    await expect(page.getByTestId('btn-profile-switcher')).not.toBeVisible();

    // On Grid Level 1 (has solution), Save hides on <md; switching to Turtle (no solution) surfaces Save on <md!
    await expect(page.getByTestId('btn-save-modal')).not.toBeVisible();
    await page.getByTestId('btn-lesson-picker').click();
    await page.getByTestId('sim-tab-turtle').click();
    await expect(page.getByTestId('btn-save-modal')).toBeVisible();

    // Check zero horizontal overflow and single-row height across 360px, 375px, 820px, and 1280px
    for (const width of [360, 375, 820, 1280]) {
      await page.setViewportSize({ width, height: 667 });
      const metrics = await page.locator('header').evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        height: el.getBoundingClientRect().height,
      }));
      expect(metrics.scrollWidth, `Header overflow at ${width}px`).toBeLessThanOrEqual(metrics.clientWidth);
      expect(metrics.height, `Header wrapped at ${width}px`).toBeLessThanOrEqual(68);
    }
  });

  test('opens and closes unified hamburger menu drawer with kid-friendly rows', async ({ page }) => {
    await page.getByTestId('btn-hamburger-menu').click();

    const drawer = page.getByTestId('mobile-drawer-content');
    await expect(drawer).toBeVisible();

    // Row 1: Save, Open, Share
    await expect(page.getByTestId('drawer-btn-save')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-load')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-share')).toBeVisible();

    // Row 2: Player Profile card
    await expect(page.getByTestId('drawer-btn-profile-switcher')).toBeVisible();

    // Row 3: Mode & World quick switch + Lesson Picker shortcut
    await expect(page.getByTestId('drawer-mode-curriculum')).toBeVisible();
    await expect(page.getByTestId('drawer-mode-sandbox')).toBeVisible();
    await expect(page.getByTestId('drawer-tab-grid')).toBeVisible();
    await expect(page.getByTestId('drawer-tab-turtle')).toBeVisible();
    await expect(page.getByTestId('drawer-tab-beat')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-lesson-picker')).toBeVisible();

    // Row 4: Sound, Redo, Map toggle, Fullscreen
    await expect(page.getByTestId('drawer-btn-sound')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-redo')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-toggle-map')).toBeVisible();
    await expect(page.getByTestId('drawer-btn-fullscreen')).toBeVisible();

    await page.getByTestId('btn-close-mobile-menu').click();
    await expect(drawer).not.toBeVisible();
  });

  test('collapsible function bar in subpalette control row toggles cleanly', async ({ page }) => {
    await expect(page.getByTestId('palette-function-bar')).not.toBeVisible();

    const toggleFuncBtn = page.getByTestId('btn-toggle-function-bar');
    await expect(toggleFuncBtn).toBeVisible();
    await toggleFuncBtn.click();

    const funcBar = page.getByTestId('palette-function-bar');
    await expect(funcBar).toBeVisible();
    await expect(page.getByTestId('palette-tab-main')).toBeVisible();
    await expect(page.getByTestId('palette-tab-f1')).toBeVisible();

    await page.getByTestId('palette-tab-f1').click();
    await expect(toggleFuncBtn).toHaveText(/F1/);

    await toggleFuncBtn.click();
    await expect(funcBar).not.toBeVisible();
  });

  test('deletes single block using smart trash button in subpalette control row', async ({ page }) => {
    const trashBtn = page.getByTestId('btn-trash');
    await expect(trashBtn).toBeVisible();
    await expect(trashBtn).toBeDisabled();

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();

    const fwdBlock = page.locator('[data-testid^="block-MOVE_FWD"]');
    const turnBlock = page.locator('[data-testid^="block-TURN_LEFT"]');
    await expect(fwdBlock).toBeVisible();
    await expect(turnBlock).toBeVisible();

    await fwdBlock.click();
    await expect(trashBtn).toBeEnabled();
    await trashBtn.click();

    await expect(fwdBlock).not.toBeVisible();
    await expect(turnBlock).toBeVisible();
  });

  test('hides and shows simulation map via menu drawer to provide 100% editor height', async ({ page }) => {
    const mapPane = page.getByTestId('pane-simulation');
    await expect(mapPane).toBeVisible();

    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-toggle-map').click();
    await expect(mapPane).not.toBeVisible();

    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-toggle-map').click();
    await expect(mapPane).toBeVisible();
  });

  test('subpalette parameters open without clipping', async ({ page }) => {
    await page.getByTestId('palette-var-assign').click();

    const subpalette = page.getByTestId('block-subpalette-var-assign');
    await expect(subpalette).toBeVisible();

    const varBtn = page.getByTestId('subpalette-assign-a-b');
    await expect(varBtn).toBeVisible();
    await varBtn.click();

    const paramToggleBtn = page.getByTestId('palette-param-toggle-btn');
    await paramToggleBtn.click();
    await expect(subpalette).not.toBeVisible();
  });
});
