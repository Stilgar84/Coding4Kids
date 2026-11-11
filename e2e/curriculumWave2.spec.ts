import { test, expect } from '@playwright/test';

test.describe('Wave 2: Staged Palettes, Profiles, Padlocks, Placeholders, LOGO Variations & Beat Matrix', () => {
  test('C2 + C7: enforces staged palette & 4-slot physical tray on 1.1 and runs Ghost-Step Preview without mutating workspace', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=1.1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Staged palette on 1.1: only MOVE_FWD visible; no turns, loops, functions, or repeat badges
    await expect(page.getByTestId('palette-move-fwd')).toBeVisible();
    await expect(page.getByTestId('palette-turn-left')).toHaveCount(0);
    await expect(page.getByTestId('palette-loop-start')).toHaveCount(0);
    await expect(page.getByTestId('palette-call-f1')).toHaveCount(0);

    // 4-slot physical tray starts with 0 placed blocks and 4 empty slots, with slot counter inline in palette control row
    const slotCounter = page.getByTestId('workspace-slot-counter');
    const deleteBtn = page.getByTestId('btn-palette-delete-block');
    await expect(slotCounter).toBeVisible();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 4');
    await expect(page.getByTestId('workspace-empty-slot')).toHaveCount(4);
    await expect(page.getByTestId('tab-main')).toHaveCount(0);
    await expect(page.getByTestId('btn-workspace-undo')).toHaveCount(0);

    const counterBox = await slotCounter.boundingBox();
    const deleteBox = await deleteBtn.boundingBox();
    expect(counterBox).not.toBeNull();
    expect(deleteBox).not.toBeNull();
    expect(Math.abs(counterBox!.y - deleteBox!.y)).toBeLessThan(8);

    // Trigger Tier 1 Ghost-Step Preview from Two-Tier Help Modal -> workspace blocks remain 0
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('tier1-ghost-card')).toBeVisible();
    await page.getByTestId('btn-trigger-ghost-preview').click();
    await expect(page.getByTestId('solution-modal')).toHaveCount(0);
    await expect(page.getByTestId('ghost-step-overlay')).toBeAttached();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);

    // Fill all 4 physical slots and verify the 5th click is capped cleanly with status announcement
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('palette-move-fwd').click();
    }
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(4);
    await expect(page.getByTestId('workspace-empty-slot')).toHaveCount(0);
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('4 / 4');

    await page.getByTestId('palette-move-fwd').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(4);
    await expect(page.getByTestId('mode-status-announcer')).toContainText('4');
  });

  test('C3: isolates per-lesson auto-save across avatar profiles and supports Undo-protected Reset to Starter', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Add 2 blocks on Default Profile in Activity 1.1
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Switch to 1.2 and back to 1.1 -> auto-restores 2 blocks
    await page.getByTestId('btn-activity-1.2').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);
    await page.getByTestId('btn-activity-1.1').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Create a new Frog profile -> starts clean with 0 blocks on 1.1
    await page.getByTestId('btn-profile-switcher').click();
    await expect(page.getByTestId('profile-switcher-modal')).toBeVisible();
    await page.getByTestId('btn-show-create-profile').click();
    await page.getByTestId('avatar-option-frog').click();
    await page.getByTestId('input-profile-name').fill('Hopper');
    await page.getByTestId('btn-create-profile').click();
    await expect(page.getByTestId('profile-switcher-modal')).toHaveCount(0);
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);

    // Switch back to Default profile -> restores 2 blocks on 1.1
    await page.getByTestId('btn-profile-switcher').click();
    await page.getByTestId('profile-card-default').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Reset to Starter clears blocks, and 1-tap Undo restores them!
    await page.getByTestId('btn-reset-to-starter').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);
    await page.getByTestId('btn-undo').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
  });

  test('C6: displays padlock on Goal before Flag 1 on Activity 1.3 and unlocks sequentially', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=1.3');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Activity 1.3 has Flag 1 + Goal; Goal starts padlocked until Flag 1 is collected
    await expect(page.getByTestId('flag-padlock-overlay')).toBeAttached();
    await expect(page.locator('[data-testid^="padlock-"]')).toHaveCount(1);

    // Load full reference solution via Two-Tier Help Modal and run to unlock & win
    await page.getByTestId('btn-solution').click();
    await page.getByTestId('btn-reveal-full-solution').click();
    await page.getByTestId('btn-load-solution').click();
    await page.getByTestId('btn-close-solution').click();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('[data-testid^="padlock-goal"]')).toHaveCount(0);
  });

  test('C9: renders parameterless Module 1 Turtle LOGO (1.6) with VariationCardsPanel SVG thumbnails and Undo-safe Load Code', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=1.6');
    await page.waitForSelector('[data-testid="variation-cards-panel"]');

    // Starter workspace loads with parameter badges hidden on M1 LOGO blocks
    const initialCount = await page.locator('[data-testid^="block-"]').count();
    expect(initialCount).toBeGreaterThanOrEqual(6);
    await expect(page.locator('[data-testid^="block-params-container-"]')).toHaveCount(0);

    // 3 auto-rendered SVG variation thumbnails are visible
    await expect(page.locator('[data-testid^="variation-thumbnail-"]')).toHaveCount(3);

    // Load a variation card and then Undo back to starter workspace
    await page.locator('[data-testid^="btn-load-variation-"]').nth(1).click();
    await expect(page.getByTestId('btn-variation-undo')).toBeEnabled();
    await page.getByTestId('btn-variation-undo').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(initialCount);
  });

  test('C10: runs Beat & Light Matrix in Sandbox with 8x8 RGB LEDs, drum/stamp Tier 1 blocks, and headless audio resilience', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Switch to Beat & Light environment in Sandbox mode
    await page.getByTestId('sim-tab-beat').click();
    await expect(page.getByTestId('beat-canvas')).toBeVisible();
    await expect(page.getByTestId('beat-led-grid')).toBeVisible();
    await expect(page.getByTestId('tool-beat-mute')).toBeVisible();

    // Add Kick Drum + Heart Stamp and step/play without hanging even in headless Chromium
    await page.getByTestId('palette-beat-drum-kick').click();
    await page.getByTestId('palette-beat-stamp-heart').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('beat-step-counter')).toContainText('1');
    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('beat-step-counter')).toContainText('2');
  });
});
