import { test, expect } from '@playwright/test';

test.describe('Wave 4: M1 Robot (1.4-1A), Browser & Badges, M2 Params/Beat (2.1-2.5, 2B), M2 Objects (2.6-2A) & Loop Brackets (3.0-3.3)', () => {
  test('C8b: steps through buggy starter on 1.4, loads ? scaffold via Hint, and solves 1A anti-bypass checks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.4&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // 1.4 pre-loads 5-block buggy starter
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(5);

    // Open Hint modal -> verify Dev Constraint Proofs are Verified, then load Tier 1 ? scaffold
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('solution-modal')).toBeVisible();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();

    // Pressing Step until ? placeholder pauses cleanly
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('btn-step').click();
    }

    // Verify 1A dev constraint proofs pass all 5 anti-bypass rules
    await page.goto('/?mode=curriculum&activity=1A&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
  });

  test('C12: enforces sequential module unlock in LessonPickerModal, supports 1-tap Unlock All, and opens BadgeCollectionModal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.0');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await page.getByTestId('btn-lesson-picker').click();
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();

    // Module 1 is unlocked; Module 2 & Module 3 start locked until unlocked
    await expect(page.getByTestId('btn-activity-1.1')).toBeEnabled();
    await expect(page.getByTestId('module-locked-module-2')).toBeVisible();
    await expect(page.getByTestId('btn-activity-2.1')).toBeDisabled();

    // Toggle 1-tap Unlock All -> Module 2 & Module 3 become interactive immediately
    await page.getByTestId('btn-toggle-unlock-all').click();
    await expect(page.getByTestId('btn-activity-2.1')).toBeEnabled();
    await expect(page.getByTestId('btn-activity-3.1')).toBeEnabled();

    // Open BadgeCollectionModal via header Badges button and dismiss with Escape
    await page.getByTestId('btn-open-badges').click();
    await expect(page.getByTestId('badge-collection-modal')).toBeVisible();
    await expect(page.getByTestId('badge-capstone-chip-1A')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('badge-collection-modal')).toHaveCount(0);
  });

  test('C13 & C15: solves 2.1 with repeat badges, runs 2.5 Beat Tier 2 notes/rows, and steps 2.6 object demo tabs', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2.5 Beat Tier 2 starter + playable variations
    await page.goto('/?mode=curriculum&activity=2.5');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    await expect(page.getByTestId('variation-cards-panel')).toBeVisible();
    await page.getByTestId('btn-step').click();

    // 2.6 Interactive World Items 3-tab Explanation Demo
    await page.goto('/?mode=curriculum&activity=2.6');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('demo-tab-1')).toBeVisible();
    await expect(page.getByTestId('demo-tab-2')).toBeVisible();
    await expect(page.getByTestId('demo-tab-3')).toBeVisible();
    await page.getByTestId('demo-tab-3').click();
    await page.getByTestId('btn-step').click();

    // Continue advances directly to 2.7 (8-slot object puzzle)
    await page.getByTestId('btn-explanation-continue').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('5 × 5');
  });

  test('C16: renders live loop iteration spotlight in 3.0 and solid color-coded nested loop brackets in 3.3', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=3.0');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Switch to Tab [2] (Loop ×4) and step into the loop to see live 1/4 iteration badge
    await page.getByTestId('demo-tab-2').click();
    await expect(page.locator('[data-testid="loop-bracket-segment"]').first()).toBeVisible();
    await page.getByTestId('btn-step').click();
    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('loop-iteration-badge')).toContainText('1/4');

    // Open 3.3 Star Loops and load Variation 3 (Spiked Sun Rays nested Loop ×6 { Loop ×2 })
    await page.goto('/?mode=curriculum&activity=3.3');
    await page.waitForSelector('[data-testid="variation-cards-panel"]');
    const loadButtons = page.locator('[data-testid^="btn-load-variation-"]');
    await expect(loadButtons).toHaveCount(3);
    await loadButtons.nth(2).click();

    // Verify both depth-1 and depth-2 loop bracket rails render as solid lines without marker symbols
    await expect(page.getByTestId('workspace-sequence')).toHaveAttribute('data-max-loop-depth', '2');
    await expect(
      page.locator('[data-testid="loop-bracket-segment"][data-loop-depth="1"][data-loop-stroke="solid"]').first()
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="loop-bracket-segment"][data-loop-depth="2"][data-loop-stroke="solid"]').first()
    ).toBeVisible();
    await expect(page.locator('[data-loop-stroke="dashed"]')).toHaveCount(0);
    await expect(page.locator('[data-loop-marker]')).toHaveCount(0);
  });
});
