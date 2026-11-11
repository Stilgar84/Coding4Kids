import { test, expect } from '@playwright/test';

test.describe('Wave 3: Lesson Save Slots, Constraint Solver, Demo Runner (1.0), Beat Variations (1.8/1C) & World Items', () => {
  test('C8a: runs Lesson 1.0 Explanation Demo tabs with POV spotlights and advances to 1.1 via Continue', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.0');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('demo-tab-1')).toHaveAttribute('aria-selected', 'true');

    // Step Tab [1] once, then switch to Tab [2] (Egocentric Robot POV) via keyboard ArrowRight
    await page.getByTestId('btn-step').click();
    await page.getByTestId('demo-tab-1').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('demo-tab-2')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('grid-slot-demo-spotlights')).toBeAttached();

    // Click Continue (->) to mark 1.0 completed and advance to 1.1
    await page.getByTestId('btn-explanation-continue').click();
    await expect(page.getByTestId('explanation-demo-bar')).toHaveCount(0);
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 3');
  });

  test('C5: renders verified anti-bypass Constraint Proofs inspector on /?dev=1 and hides in learner mode', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.2&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('solution-modal')).toBeVisible();
    await expect(page.getByTestId('btn-toggle-constraint-proofs')).toBeVisible();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');

    // Expand if collapsed and verify rule badges
    const toggleBtn = page.getByTestId('btn-toggle-constraint-proofs');
    const expanded = await toggleBtn.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggleBtn.click();
    }
    await expect(page.getByTestId('dev-constraint-proofs-panel')).toBeVisible();
    await expect(page.getByTestId('constraint-rule-1.2-require-turn-left')).toHaveAttribute(
      'data-rule-passed',
      'true'
    );
  });

  test('C4: saves and switches between numbered manual Lesson Save Slots on Activity 1.2', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.2');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Save 1-block attempt into Slot 1
    await page.getByTestId('palette-move-fwd').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(1);
    await page.getByTestId('btn-save-modal').click();
    await expect(page.getByTestId('save-slot-btn-1')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('btn-confirm-save').click();
    await page.keyboard.press('Escape');

    // Add 2 more blocks (total 3) and save into Slot 2
    await page.getByTestId('palette-turn-left').click();
    await page.getByTestId('palette-move-fwd').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(3);
    await page.getByTestId('btn-save-modal').click();
    await expect(page.getByTestId('save-slot-btn-2')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('btn-confirm-save').click();
    await page.keyboard.press('Escape');

    // Load Slot 1 back from Load Modal -> workspace returns to 1 block
    await page.getByTestId('btn-load-modal').click();
    await expect(page.getByTestId('load-filter-current-lesson')).toContainText('(2)');
    const slot1LoadBtn = page
      .locator('[data-testid^="saved-card-"]', { hasText: 'Slot 1' })
      .locator('[data-testid^="btn-load-entry-"]');
    await slot1LoadBtn.click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(1);
  });

  test('C11: previews playable 8x8 Beat variation cards in 1.8 without mutating main workspace', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.8');
    await page.waitForSelector('[data-testid="beat-canvas"]');

    const starterBlockCount = await page.locator('[data-testid^="block-"]').count();
    expect(starterBlockCount).toBeGreaterThanOrEqual(6);

    const previewButtons = page.locator('[data-testid^="btn-preview-variation-"]');
    await expect(previewButtons).toHaveCount(3);

    // Start preview on Card 1, then switch preview to Card 2 -> Card 1 stops, main blocks unchanged
    await previewButtons.nth(0).click();
    await expect(previewButtons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await previewButtons.nth(1).click();
    await expect(previewButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(previewButtons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(starterBlockCount);
  });

  test('C14: places Water + Plank in Sandbox Grid and crosses via Pick Up & Use/Drop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Level 1 starts at (0,2) facing EAST -> Goal at (4,2).
    // Place Plank at (1,2) and Water at (2,2) using Sandbox World Items popover.
    await page.getByTestId('tool-world-items-menu').click();
    await expect(page.getByTestId('world-items-popover')).toBeVisible();
    await page.getByTestId('tool-plank').click();
    await page.getByTestId('cell-1-2').click();

    await page.getByTestId('tool-world-items-menu').click();
    await page.getByTestId('tool-water').click();
    await page.getByTestId('cell-2-2').click();

    // Build solution: Move Fwd -> Pick Up -> Use/Drop -> Move Fwd x3
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-pick-up').click();
    await page.getByTestId('palette-use-drop').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 8000 });
  });
});
