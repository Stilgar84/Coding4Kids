import { test, expect } from '@playwright/test';

test.describe('Wave 6 (Commit 18): Full Module 1–3 Curriculum E2E Suite (Desktop & Android Tablet)', () => {
  test('1. isolates per-lesson auto-save across multiple learner profiles & restores read-only vs Open Copy in Sandbox cleanly', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=3.5');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Read-only curriculum map on 3.5 (6 × 5): editor tools & resize handles hidden
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('6 × 5');
    await expect(page.getByTestId('tool-wall')).toHaveCount(0);
    await expect(page.getByTestId('tool-world-items-menu')).toHaveCount(0);
    await expect(page.getByTestId('resize-handle-right')).toHaveCount(0);

    // Place a balanced 3-block loop on Default profile in 3.5: Loop Start + Move Fwd + Loop End
    await page.getByTestId('palette-loop-start').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-loop-end').click();
    await expect(page.locator('[data-block-type]')).toHaveCount(3);

    // Navigate to 3.6 and back to 3.5 -> auto-restores Default profile's 3 blocks
    await page.getByTestId('btn-next-lesson').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('5 × 5');
    await expect(page.locator('[data-block-type]')).toHaveCount(0);
    await page.getByTestId('btn-prev-lesson').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('6 × 5');
    await expect(page.locator('[data-block-type]')).toHaveCount(3);

    // Create a second learner profile (Owl) -> starts with 0 blocks on 3.5
    await page.getByTestId('btn-profile-switcher').click();
    await expect(page.getByTestId('profile-switcher-modal')).toBeVisible();
    await page.getByTestId('btn-show-create-profile').click();
    await page.getByTestId('avatar-option-owl').click();
    await page.getByTestId('input-profile-name').fill('Athena');
    await page.getByTestId('btn-create-profile').click();
    await expect(page.getByTestId('profile-switcher-modal')).toHaveCount(0);
    await expect(page.locator('[data-block-type]')).toHaveCount(0);

    // Switch back to Default profile -> restores 3 blocks on 3.5
    await page.getByTestId('btn-profile-switcher').click();
    await page.getByTestId('profile-card-default').click();
    await expect(page.locator('[data-block-type]')).toHaveCount(3);

    // Open Copy in Sandbox -> clones 6 × 5 map + 3 blocks with full editing tools enabled
    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-open-copy-sandbox').click();
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('6 × 5');
    await expect(page.locator('[data-block-type]')).toHaveCount(3);
    await expect(page.getByTestId('tool-wall')).toBeVisible();
    await expect(page.getByTestId('tool-world-items-menu')).toBeVisible();

    // Mutate cloned Sandbox board size -> original 3.5 curriculum map stays pristine 6 × 5
    await page.getByTestId('btn-resize-right-plus').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('7 × 5');

    await page.goto('/?mode=curriculum&activity=3.5');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('6 × 5');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
  });

  test('2. enforces 8-slot tray & ? placeholder pause/replacement on 3.5 (Planks + Water Loop)', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=3.5&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Physical 8-slot tray starts at 0 / 8
    await expect(page.getByTestId('workspace-slot-counter')).toBeVisible();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 8');
    await expect(page.getByTestId('workspace-empty-slot')).toHaveCount(8);

    // Open Hint modal -> verify Dev Constraint Proofs pass, then load Tier 1 ? scaffold (7 / 8 slots)
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('7 / 8');
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(3);

    // Step into the loop until execution pauses cleanly on the first ? placeholder block
    await page.getByTestId('btn-step').click(); // LOOP_START ×3
    await page.getByTestId('btn-step').click(); // MOVE_FWD onto plank
    await page.getByTestId('btn-step').click(); // reaches PLACEHOLDER -> pauses & announces!
    await expect(page.getByTestId('mode-status-announcer')).toContainText('placeholder');

    // Reset and replace all 3 ? placeholders in place: PICK_UP, USE_DROP, TURN_RIGHT
    await page.getByTestId('btn-reset').click();
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-pick-up').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(2);

    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-use-drop').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(1);

    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(0);

    // Run at 16x speed -> bridges all 3 canals, collects ordered flags, and wins!
    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('status-success')).toBeVisible();
  });

  test('3. executes nested loops in 3.6 & Capstone 3A (Planks/Water + Keys/Gates), unlocks badge-module-3 across 3A–3C, and supports click-to-dismiss', async ({
    page,
  }) => {
    // Part A: Verify 3.6 nested loop scaffold & anti-bypass proof
    await page.goto('/?mode=curriculum&activity=3.6&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();
    await expect(page.getByTestId('workspace-sequence')).toHaveAttribute('data-max-loop-depth', '2');

    // Replace inner turn '?' with TURN_RIGHT and outer motion '?' with MOVE_FWD ×2
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-2').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(0);

    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 8000 });

    // Click anywhere on VictoryCelebrationModal backdrop -> dismisses modal while status-success stays visible underneath
    await page.getByTestId('victory-modal').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
    await expect(page.getByTestId('status-success')).toBeVisible();

    // Part B: Solve Capstone 3A (6 × 6 Automated Greenhouse: 3 planks/water + 3 keys/gates + nested loops in 10 slots)
    await page.goto('/?mode=curriculum&activity=3A&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('6 × 6');
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 10');

    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('10 / 10');

    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-pick-up').click();
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-use-drop').click();
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();

    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('victory-modal')).toHaveAttribute('data-ceremony', 'badge');

    // Click Next inside VictoryCelebrationModal -> advances directly to Creative Capstone 3B (Kaleidoscope Medallion)
    await page.getByTestId('btn-victory-next').click();
    await expect(page.getByTestId('variation-cards-panel')).toBeVisible();
    await expect(page.locator('[data-testid^="variation-thumbnail-"]')).toHaveCount(3);

    // Complete 3B via Done CTA -> opens Capstone celebration -> click Next to advance to 3C (Looping Lightshow)
    await page.getByTestId('btn-complete-creative-activity').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible();
    await page.getByTestId('btn-victory-next').click();
    await page.waitForSelector('[data-testid="beat-canvas"]');

    // Complete 3C -> all 3 Module 3 capstones (3A, 3B, 3C) done -> unlocks Loop Architect (badge-module-3)!
    await page.getByTestId('btn-complete-creative-activity').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible();
    await expect(page.getByTestId('victory-modal')).toHaveAttribute('data-ceremony', 'badge');
    await expect(page.getByTestId('victory-earned-badge')).toContainText('Loop Architect');
    await expect(page.getByTestId('victory-live-announcement')).toContainText(
      'Module Mastery Badge unlocked: Loop Architect!'
    );

    // Dismiss ceremony via click-to-dismiss and verify BadgeCollectionModal shows 1/3 earned
    await page.getByTestId('victory-modal').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);

    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-badges').click();
    await expect(page.getByTestId('badge-collection-modal')).toBeVisible();
    await expect(page.getByTestId('badge-collection-count')).toContainText('1/3');
    await expect(page.getByTestId('badge-card-module-3')).toHaveAttribute('data-earned', 'true');
  });

  test('4. runs Beat & Light playback + directional LED cursor reticle in 3.4 & 3C with headless AudioContext resilience', async ({
    page,
  }) => {
    // Check 3.4 LED cursor starter first (Step 1: Set Color, 2: Loop ×4, 3: Kick, 4: Cursor Step)
    await page.goto('/?mode=curriculum&activity=3.4');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('btn-step').click();
    }
    await expect(page.getByTestId('beat-cursor-reticle')).toBeVisible();

    // Jump to Capstone 3C (Looping Lightshow)
    await page.goto('/?mode=curriculum&activity=3C');
    await page.waitForSelector('[data-testid="beat-canvas"]');

    await expect(page.getByTestId('beat-led-grid')).toBeVisible();
    await expect(page.getByTestId('workspace-sequence')).toHaveAttribute('data-max-loop-depth', '2');
    const mainBlockCount = await page.locator('[data-block-type]').count();
    expect(mainBlockCount).toBe(12);

    // Previewing a Beat variation card runs isolated LED preview without mutating main workspace
    const radarPreviewBtn = page.getByTestId('btn-preview-variation-3C-radar-sweep');
    await radarPreviewBtn.click();
    await expect(radarPreviewBtn).toHaveAttribute('aria-pressed', 'true');
    await radarPreviewBtn.click();
    await expect(radarPreviewBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-block-type]')).toHaveCount(mainBlockCount);

    // Step through 3C starter: Set Color -> Stamp Star -> Loop ×4 -> Kick -> Loop ×2 -> Cursor Step!
    for (let i = 0; i < 6; i++) {
      await page.getByTestId('btn-step').click();
    }
    await expect(page.getByTestId('beat-cursor-reticle')).toBeVisible();
    await expect(page.getByTestId('beat-cursor-reticle')).toHaveAttribute('data-cursor-x', '2');
    await expect(page.getByTestId('beat-cursor-reticle')).toHaveAttribute('data-cursor-y', '1');
    await expect(page.getByTestId('beat-cursor-reticle')).toHaveAttribute('data-cursor-dir', 'EAST');

    // Reset hides the LED cursor reticle and clears lit LEDs cleanly
    await page.getByTestId('btn-reset').click();
    await expect(page.getByTestId('beat-cursor-reticle')).toHaveCount(0);
  });

  test('5. supports keyboard navigation (Enter/Space/Escape/Tab) & aria-live announcements, and migrates legacy v1 robotemu_saved_programs', async ({
    page,
  }) => {
    // Seed a legacy v1 save entry without `profileId` before booting the app
    await page.addInitScript(() => {
      const existing = window.localStorage.getItem('__legacy_seeded__');
      if (!existing) {
        window.localStorage.setItem('__legacy_seeded__', '1');
        window.localStorage.setItem(
          'robotemu_saved_programs',
          JSON.stringify([
            {
              version: 1,
              id: 'legacy_v1_corridor',
              title: 'Legacy Corridor Bot',
              createdAt: 1700000000000,
              simId: 'grid',
              code: 'AQABAQADEBAQ', // 3 × MOVE_FWD in v1 generic code-only format
              screenshot: '',
              status: 'SUCCESS',
              stepCount: 3,
              levelId: 1,
            },
          ])
        );
      }
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Verify non-destructive in-place migration stamped profileId = 'default'
    const migratedProfileId = await page.evaluate(() => {
      const raw = window.localStorage.getItem('robotemu_saved_programs');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed[0]?.profileId ?? null;
    });
    expect(migratedProfileId).toBe('default');

    // Verify full 32-activity curriculum catalog & keyboard modal navigation (Enter + Space + Tab + Escape)
    const pickerBtn = page.getByTestId('btn-lesson-picker');
    await pickerBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();
    await page.getByTestId('picker-mode-curriculum').click();
    await expect(page.locator('[data-testid^="btn-activity-"]')).toHaveCount(32);
    await expect(page.getByTestId('mode-status-announcer')).toHaveAttribute('aria-live', 'polite');

    // Open BadgeCollectionModal from LessonPickerModal via keyboard Space, Tab focus-trap, and close with Escape
    const badgesBtn = page.getByTestId('btn-open-badges');
    await badgesBtn.focus();
    await page.keyboard.press(' ');
    await expect(page.getByTestId('badge-collection-modal')).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('badge-collection-modal')).toHaveCount(0);

    // Load migrated legacy v1 program from Load Modal on Default profile -> restores 3 MOVE_FWD blocks
    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-load').click();
    await page.getByTestId('load-filter-all').click();
    const legacyCard = page.locator('[data-testid^="saved-card-"]', {
      hasText: 'Legacy Corridor Bot',
    });
    await expect(legacyCard).toBeVisible();
    await legacyCard.locator('[data-testid^="btn-load-entry-"]').click();
    await expect(page.locator('[data-block-type]')).toHaveCount(3);
  });
});
