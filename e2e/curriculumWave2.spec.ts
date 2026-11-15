import { test, expect } from '@playwright/test';
import { solveAdultMathGate } from './helpers';

test.describe('Wave 2: Staged Palettes, Profiles, Ordered Waypoints, Placeholders, LOGO Variations & Beat Matrix', () => {
  test('C2 + C7: enforces staged palette & 4-slot physical tray on seq.1 and runs Ghost-Step Preview without mutating workspace', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=seq.1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Staged palette on seq.1: only MOVE_FWD visible; no turns, loops, functions, or repeat badges
    await expect(page.getByTestId('palette-move-fwd')).toBeVisible();
    await expect(page.getByTestId('palette-turn-left')).toHaveCount(0);
    await expect(page.getByTestId('palette-loop-start')).toHaveCount(0);
    await expect(page.getByTestId('palette-call-f1')).toHaveCount(0);

    // 4-slot physical tray starts with 0 placed blocks and 4 empty slots, with slot counter inline next to smart trash button
    const slotCounter = page.getByTestId('workspace-slot-counter');
    const trashBtn = page.getByTestId('btn-trash');
    await expect(slotCounter).toBeVisible();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 4');
    await expect(page.getByTestId('workspace-empty-slot')).toHaveCount(4);
    await expect(page.getByTestId('tab-main')).toHaveCount(0);
    await expect(page.getByTestId('btn-workspace-undo')).toHaveCount(0);

    const counterBox = await slotCounter.boundingBox();
    const trashBox = await trashBtn.boundingBox();
    expect(counterBox).not.toBeNull();
    expect(trashBox).not.toBeNull();
    expect(Math.abs(counterBox!.y - trashBox!.y)).toBeLessThan(8);

    // Trigger Tier 1 Ghost-Step Preview from Two-Tier Help Modal -> ungated & workspace blocks remain 0
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('tier1-ghost-card')).toBeVisible();
    await expect(page.getByTestId('adult-math-gate')).toHaveCount(0);
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
    await page.goto('/?mode=curriculum&activity=seq.1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Add 2 blocks on Default Profile in Activity seq.1
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-move-fwd').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Switch to seq.2 and back to seq.1 -> auto-restores 2 blocks
    await page.getByTestId('btn-next-lesson').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);
    await page.getByTestId('btn-prev-lesson').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Create a new Frog profile -> starts clean with 0 blocks on seq.1
    await page.getByTestId('btn-profile-switcher').click();
    await expect(page.getByTestId('profile-switcher-modal')).toBeVisible();
    await page.getByTestId('btn-show-create-profile').click();
    await page.getByTestId('avatar-option-frog').click();
    await page.getByTestId('input-profile-name').fill('Hopper');
    await page.getByTestId('btn-create-profile').click();
    await expect(page.getByTestId('profile-switcher-modal')).toHaveCount(0);
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);

    // Switch back to Default profile -> restores 2 blocks on seq.1
    await page.getByTestId('btn-profile-switcher').click();
    await page.getByTestId('profile-card-default').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

    // Reset to Starter via Unified Menu Drawer clears blocks, and 1-tap header Undo restores them!
    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-reset-to-starter').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(0);
    await page.getByTestId('btn-undo').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
  });

  test('C6: shutters Flag 2 and Goal [0/2] before Flag 1 on Activity seq.5 and unlocks sequentially', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=seq.5');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Activity seq.5 has Flag 1 -> Flag 2 -> Goal; Flag 2 and Goal start shuttered while Flag 1 stays open
    await expect(page.getByTestId('flag-padlock-overlay')).toBeAttached();
    await expect(page.getByTestId('padlock-flag-1')).toHaveCount(0);
    await expect(page.getByTestId('padlock-flag-2')).toHaveAttribute('data-shutter-variant', 'waypoint');
    await expect(page.getByTestId('padlock-goal-2-1')).toHaveAttribute('data-shutter-variant', 'goal');
    await expect(page.getByTestId('goal-shutter-progress')).toContainText('0/2');
    await expect(page.locator('[data-testid^="padlock-"]')).toHaveCount(2);

    // Two-Tier Help Modal: Tier 1 starter stays ungated; Tier 2 full answer is gated by Grown-Up Math Check
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('tier1-scaffold-card')).toBeVisible();
    await expect(page.getByTestId('btn-load-scaffold')).toBeEnabled();
    await expect(page.getByTestId('adult-math-gate')).toHaveCount(0);

    await page.getByTestId('btn-reveal-full-solution').click();
    await expect(page.getByTestId('adult-math-gate')).toBeVisible();
    await expect(page.getByTestId('btn-load-solution')).toHaveCount(0);
    await solveAdultMathGate(page);

    await page.getByTestId('btn-load-solution').click();
    await expect(page.getByTestId('solution-modal')).toHaveCount(0);

    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid^="padlock-"]')).toHaveCount(0);
  });

  test('C9: renders parameterless Module 1 Turtle LOGO (seq.6) with VariationCardsPanel SVG thumbnails and Undo-safe Load Code', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=seq.6');
    await page.waitForSelector('[data-testid="variation-cards-panel"]');

    // Starter workspace loads with parameter badges hidden on M1 LOGO blocks
    const initialCount = await page.locator('[data-testid^="block-"]').count();
    expect(initialCount).toBeGreaterThanOrEqual(6);
    await expect(page.locator('[data-testid^="block-params-container-"]')).toHaveCount(0);

    // 3 auto-rendered SVG variation thumbnails are visible
    await expect(page.locator('[data-testid^="variation-thumbnail-"]')).toHaveCount(3);

    // Load a variation card and then Undo via canonical header Undo button back to starter workspace
    await page.locator('[data-testid^="btn-load-variation-"]').nth(1).click();
    await expect(page.getByTestId('btn-undo')).toBeEnabled();
    await page.getByTestId('btn-undo').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(initialCount);
  });

  test('C10: runs Beat & Light Matrix in Sandbox with single SimulationTopLeftHud, 8x8 RGB LEDs, drum/stamp blocks, and headless audio resilience', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Switch to Beat & Light environment via LessonPickerModal
    await page.getByTestId('btn-lesson-picker').click();
    await page.getByTestId('sim-tab-beat').click();
    await expect(page.getByTestId('beat-canvas')).toBeVisible();
    await expect(page.getByTestId('beat-led-grid')).toBeVisible();
    await expect(page.getByTestId('tool-beat-mute')).toBeVisible();

    // Add Variable Assign + Kick Drum + Heart Stamp and verify BeatCanvas renders a single SimulationTopLeftHud
    await page.getByTestId('palette-var-assign').click();
    await page.getByTestId('subpalette-assign-b-num-3').click();
    await page.getByTestId('palette-beat-drum-kick').click();
    await page.getByTestId('palette-beat-stamp-heart').click();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(3);

    await page.getByTestId('btn-step').click(); // VAR_ASSIGN sets a = 3
    await expect(page.getByTestId('beat-canvas').getByTestId('simulation-top-left-hud')).toHaveCount(1);
    await expect(page.getByTestId('simulation-top-left-hud')).toHaveCount(1);

    await page.getByTestId('btn-step').click(); // DRUM_KICK
    await expect(page.getByTestId('beat-step-counter')).toContainText('1');
    await page.getByTestId('btn-step').click(); // STAMP_HEART
    await expect(page.getByTestId('beat-step-counter')).toContainText('2');
  });
});
