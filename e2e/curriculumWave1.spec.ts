import { test, expect } from '@playwright/test';

test.describe('Wave 1 / Commit 1: Curriculum (Learn) vs Free-Play (Sandbox) Mode', () => {
  test('enforces read-only maps in Learn mode across seq.1–seq.2a, celebrates with VictoryCelebrationModal, and mounts GridOverlayLayer slots', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Starts in Sandbox mode by default with editable tools & resize handles
    await expect(page.getByTestId('tool-wall')).toBeVisible();
    await expect(page.getByTestId('resize-handle-right')).toBeVisible();
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);

    // GridOverlayLayer slots are mounted inside GridCanvas SVG
    await expect(page.getByTestId('grid-slot-world-items')).toBeAttached();
    await expect(page.getByTestId('grid-slot-flag-padlocks')).toBeAttached();
    await expect(page.getByTestId('grid-slot-ghost-preview')).toBeAttached();
    await expect(page.getByTestId('grid-slot-demo-spotlights')).toBeAttached();

    // Open LessonPickerModal -> switch to Learn mode -> select Activity seq.1 (4 × 4)
    await page.getByTestId('btn-lesson-picker').click();
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();
    await page.getByTestId('picker-mode-curriculum').click();
    await expect(page.getByTestId('mode-status-announcer')).toContainText('seq.0');
    await page.getByTestId('btn-activity-seq.1').click();
    await expect(page.getByTestId('lesson-picker-modal')).toHaveCount(0);

    await expect(page.getByTestId('mode-status-announcer')).toContainText('seq.1');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 4');
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
    await expect(page.getByTestId('wall-h-0-2')).toBeVisible();

    // Solve Activity seq.1 with 3 Move Forward blocks -> opens VictoryCelebrationModal with Next button!
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('status-success')).toBeVisible();

    // Click Next inside VictoryCelebrationModal -> advances straight to Activity seq.2 (3 × 3)
    await page.getByTestId('btn-victory-next').click();
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();

    // Advance to Activity seq.2a (3 × 3) via header next chevron
    await page.getByTestId('btn-next-lesson').click();
    await expect(page.getByTestId('btn-lesson-picker')).toContainText('seq.2a');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');
    await expect(page.getByTestId('goal-flag-1-2')).toBeVisible();
  });

  test('clones curriculum activity into editable Sandbox mode via Open Copy in Sandbox without mutating Learn map', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=seq.2');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Booted directly into Learn mode on Activity seq.2
    await expect(page.getByTestId('btn-lesson-picker')).toContainText('seq.2');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();

    // Place 2 blocks in Activity seq.2
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Click "Open Copy in Sandbox" from Unified Menu Drawer
    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-open-copy-sandbox').click();

    // Now in Sandbox mode with cloned 3 × 3 map and 2 blocks, and full editing restored
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
    await expect(page.getByTestId('tool-wall')).toBeVisible();
    await expect(page.getByTestId('resize-handle-right')).toBeVisible();

    // Resize cloned Sandbox map to 4 × 3 and toggle a custom wall
    await page.getByTestId('btn-resize-right-plus').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('4 × 3');
    await page.getByTestId('wall-v-hitbox-1-1').click();
    await expect(page.getByTestId('wall-v-1-1')).toBeVisible();

    // Switch back to Learn mode -> original seq.2 map is still read-only 3 × 3 without custom wall
    await page.getByTestId('btn-lesson-picker').click();
    await page.getByTestId('picker-mode-curriculum').click();
    await page.getByTestId('btn-activity-seq.2').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
    await expect(page.getByTestId('wall-v-1-1')).toHaveCount(0);
  });

  test('supports keyboard activation (Tab + Enter/Space + Escape) and mobile drawer mode switching', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Open LessonPickerModal via keyboard Enter
    const pickerBtn = page.getByTestId('btn-lesson-picker');
    await pickerBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();

    // Switch to Learn mode and pick seq.1
    await page.getByTestId('picker-mode-curriculum').click();
    await page.getByTestId('btn-activity-seq.1').click();
    await expect(page.getByTestId('lesson-picker-modal')).toHaveCount(0);

    // Open Solution modal and close with Escape
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('solution-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('solution-modal')).toHaveCount(0);

    // Resize to mobile compact viewport (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByTestId('btn-lesson-picker')).toContainText('seq.1');

    // Open LessonPickerModal on mobile to jump to seq.3
    await page.getByTestId('btn-lesson-picker').click();
    await page.getByTestId('btn-activity-seq.3').click();
    await expect(page.getByTestId('btn-lesson-picker')).toContainText('seq.3');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');

    // Open mobile drawer and verify Escape closes it
    await page.getByTestId('btn-hamburger-menu').click();
    await expect(page.getByTestId('mobile-drawer-content')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mobile-drawer-content')).toHaveCount(0);

    // Reopen drawer in Learn mode: Map Editor Tools hidden, click Open Copy in Sandbox
    await page.getByTestId('btn-hamburger-menu').click();
    await expect(page.getByTestId('drawer-mode-curriculum')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tool-wall')).toHaveCount(0);

    await page.getByTestId('drawer-btn-open-copy-sandbox').click();

    // Drawer closes automatically and app switches to Sandbox mode on mobile with Map Editor dock restored!
    await expect(page.getByTestId('mobile-drawer-content')).toHaveCount(0);
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);
    await expect(page.getByTestId('tool-wall')).toBeVisible();
  });
});
