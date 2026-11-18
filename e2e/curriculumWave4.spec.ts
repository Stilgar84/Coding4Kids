import { test, expect } from '@playwright/test';

test.describe('Wave 4: seq (seq.4–seq.A), Browser & Badges, param (param.1–param.8) & Loop Brackets (loop.0–loop.7)', () => {
  test('C8b: steps through buggy starter on seq.4, loads ? scaffold via Hint, and solves seq.A anti-bypass checks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=seq.4&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // seq.4 pre-loads 5-block buggy starter
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

    // Verify seq.A dev constraint proofs pass all 5 anti-bypass rules
    await page.goto('/?mode=curriculum&activity=seq.A&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
  });

  test('C12: enforces sequential module unlock in LessonPickerModal, supports 1-tap Unlock All, and opens BadgeCollectionModal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=seq.0');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await page.getByTestId('btn-lesson-picker').click();
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();

    // seq is unlocked; param, loop & func start locked until unlocked
    await expect(page.getByTestId('btn-activity-seq.1')).toBeEnabled();
    await expect(page.getByTestId('module-locked-param')).toBeVisible();
    await expect(page.getByTestId('btn-activity-param.1')).toBeDisabled();

    // Toggle 1-tap Unlock All -> param, loop & func become interactive immediately
    await page.getByTestId('btn-toggle-unlock-all').click();
    await expect(page.getByTestId('btn-activity-param.1')).toBeEnabled();
    await expect(page.getByTestId('btn-activity-loop.1')).toBeEnabled();
    await expect(page.getByTestId('btn-activity-func.1')).toBeEnabled();

    // Open BadgeCollectionModal via header Badges button and dismiss with Escape
    await page.getByTestId('btn-open-badges').click();
    await expect(page.getByTestId('badge-collection-modal')).toBeVisible();
    await expect(page.getByTestId('badge-capstone-chip-seq.A')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('badge-collection-modal')).toHaveCount(0);
  });

  test('C13 & C15: tests param.1 repeat badges, runs param.5 Beat Tier 2 notes/rows, and steps param.7 object demo tabs into param.8', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // param.1 Repeat Badges Corridor (5-slot tray with repeat number badges enabled)
    await page.goto('/?mode=curriculum&activity=param.1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 5');
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-5').click();
    await expect(page.locator('[data-testid^="badge-repeat-MOVE_FWD"]')).toHaveText('5');

    // param.5 Beat Tier 2 starter + playable variations
    await page.goto('/?mode=curriculum&activity=param.5');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    await expect(page.getByTestId('variation-cards-panel')).toBeVisible();
    await page.getByTestId('btn-step').click();

    // param.7 Interactive World Items 3-tab Explanation Demo
    await page.goto('/?mode=curriculum&activity=param.7');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('demo-tab-1')).toBeVisible();
    await expect(page.getByTestId('demo-tab-2')).toBeVisible();
    await expect(page.getByTestId('demo-tab-3')).toBeVisible();
    await page.getByTestId('demo-tab-3').click();
    await page.getByTestId('btn-step').click();

    // Tab [2] hasn't been viewed yet, so first Next click moves to unviewed Tab [2], then second Next advances to param.8 (5 × 5)
    await page.getByTestId('btn-explanation-continue').click();
    await expect(page.getByTestId('demo-tab-2')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('btn-explanation-continue').click();
    await expect(page.getByTestId('btn-lesson-picker')).toContainText('param.8');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('5 × 5');
  });

  test('C16: renders live loop iteration spotlight in loop.0 and solid color-coded nested loop brackets in loop.7', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=loop.0');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Switch to Tab [2] (Loop ×4) and step into the loop to see live 1/4 iteration badge
    await page.getByTestId('demo-tab-2').click();
    await expect(page.locator('[data-testid="loop-bracket-segment"]').first()).toBeVisible();
    await page.getByTestId('btn-step').click();
    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('loop-iteration-badge')).toContainText('1/4');

    // Open loop.7 Nested Loop Rosettes and load Variation 3 (Ring of 5 Stars nested Loop ×5 { Loop ×5 })
    await page.goto('/?mode=curriculum&activity=loop.7');
    await page.waitForSelector('[data-testid="variation-cards-panel"]');
    const loadButtons = page.locator('[data-testid^="btn-load-variation-"]');
    await expect(loadButtons).toHaveCount(4);
    await page.getByTestId('btn-load-variation-var3-ring-of-stars').click();

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
