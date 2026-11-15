import { test, expect } from '@playwright/test';

test.describe('Wave 6 (Phase 1): Full M1–M4 Curriculum E2E Suite (Desktop & Android Tablet)', () => {
  test('1. isolates per-lesson auto-save across multiple learner profiles & restores read-only vs Open Copy in Sandbox cleanly', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=loop.5');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Read-only curriculum map on loop.5 (7 × 3): editor tools & resize handles hidden
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('7 × 3');
    await expect(page.getByTestId('tool-wall')).toHaveCount(0);
    await expect(page.getByTestId('tool-world-items-menu')).toHaveCount(0);
    await expect(page.getByTestId('resize-handle-right')).toHaveCount(0);

    // Place a balanced 3-block loop on Default profile in loop.5: Loop Start + Move Fwd + Loop End
    await page.getByTestId('palette-loop-start').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-loop-end').click();
    await expect(page.locator('[data-block-type]')).toHaveCount(3);

    // Navigate to loop.5a and back to loop.5 -> auto-restores Default profile's 3 blocks
    await page.getByTestId('btn-next-lesson').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('3 × 3');
    await page.getByTestId('btn-prev-lesson').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('7 × 3');
    await expect(page.locator('[data-block-type]')).toHaveCount(3);

    // Create a second learner profile (Owl) -> starts with 0 blocks on loop.5
    await page.getByTestId('btn-profile-switcher').click();
    await expect(page.getByTestId('profile-switcher-modal')).toBeVisible();
    await page.getByTestId('btn-show-create-profile').click();
    await page.getByTestId('avatar-option-owl').click();
    await page.getByTestId('input-profile-name').fill('Athena');
    await page.getByTestId('btn-create-profile').click();
    await expect(page.getByTestId('profile-switcher-modal')).toHaveCount(0);
    await expect(page.locator('[data-block-type]')).toHaveCount(0);

    // Switch back to Default profile -> restores 3 blocks on loop.5
    await page.getByTestId('btn-profile-switcher').click();
    await page.getByTestId('profile-card-default').click();
    await expect(page.locator('[data-block-type]')).toHaveCount(3);

    // Open Copy in Sandbox -> clones 7 × 3 map + 3 blocks with full editing tools enabled
    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-open-copy-sandbox').click();
    await expect(page.getByTestId('grid-readonly-badge')).toHaveCount(0);
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('7 × 3');
    await expect(page.locator('[data-block-type]')).toHaveCount(3);
    await expect(page.getByTestId('tool-wall')).toBeVisible();
    await expect(page.getByTestId('tool-world-items-menu')).toBeVisible();

    // Mutate cloned Sandbox board size -> original loop.5 curriculum map stays pristine 7 × 3
    await page.getByTestId('btn-resize-right-plus').click();
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('8 × 3');

    await page.goto('/?mode=curriculum&activity=loop.5');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('7 × 3');
    await expect(page.getByTestId('grid-readonly-badge')).toBeVisible();
  });

  test('2. enforces 8-slot tray & ? placeholder pause/replacement on loop.5 (Bridge Builder Loop)', async ({
    page,
  }) => {
    await page.goto('/?mode=curriculum&activity=loop.5&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Physical 8-slot tray starts at 0 / 8
    await expect(page.getByTestId('workspace-slot-counter')).toBeVisible();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 8');
    await expect(page.getByTestId('workspace-empty-slot')).toHaveCount(8);

    // Open Hint modal -> verify Dev Constraint Proofs pass, then load Tier 1 ? scaffold (8 / 8 slots, 2 ? placeholders)
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('8 / 8');
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(2);

    // Step into the loop until execution pauses cleanly on the first ? placeholder block
    await page.getByTestId('btn-step').click(); // PICK_UP
    await page.getByTestId('btn-step').click(); // LOOP_START ×3
    await page.getByTestId('btn-step').click(); // USE_DROP
    await page.getByTestId('btn-step').click(); // MOVE_FWD 1/2
    await page.getByTestId('btn-step').click(); // MOVE_FWD 2/2
    await page.getByTestId('btn-step').click(); // reaches PLACEHOLDER -> pauses & announces!
    await expect(page.getByTestId('mode-status-announcer')).toContainText('placeholder');

    // Reset and replace both ? turn placeholders with TURN_RIGHT ×2
    await page.getByTestId('btn-reset').click();
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();
    await page.getByTestId('palette-number-2').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(1);

    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();
    await page.getByTestId('palette-number-2').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(0);

    // Run at 16x speed -> retrieves and reuses the single plank across all 3 moats to win!
    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('status-success')).toBeVisible();
  });

  test('3. executes nested loops in loop.6 & Capstone loop.A (9×9 Greenhouse), unlocks badge-loop across loop.A–loop.C, and supports click-to-dismiss', async ({
    page,
  }) => {
    // Part A: Verify loop.6 nested loop scaffold & anti-bypass proof
    await page.goto('/?mode=curriculum&activity=loop.6&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();
    await expect(page.getByTestId('workspace-sequence')).toHaveAttribute('data-max-loop-depth', '2');

    // Replace both turn '?' placeholders with TURN_RIGHT
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-turn-right').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(0);

    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 8000 });

    // Click anywhere on VictoryCelebrationModal backdrop -> dismisses modal while status-success stays visible underneath
    await page.getByTestId('victory-modal').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
    await expect(page.getByTestId('status-success')).toBeVisible();

    // Part B: Solve Capstone loop.A (9 × 9 +-Greenhouse: 8 crates + 8 floor switches + nested loops in 10 slots)
    await page.goto('/?mode=curriculum&activity=loop.A&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('grid-size-indicator')).toHaveText('9 × 9');
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

    // Click Next inside VictoryCelebrationModal -> advances directly to Creative Capstone loop.B (Kaleidoscope Medallion)
    await page.getByTestId('btn-victory-next').click();
    await expect(page.getByTestId('variation-cards-panel')).toBeVisible();
    await expect(page.locator('[data-testid^="variation-thumbnail-"]')).toHaveCount(3);

    // Complete loop.B via Done CTA -> opens Capstone celebration -> click Next to advance to loop.C (Looping Lightshow)
    await page.getByTestId('btn-complete-creative-activity').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible();
    await page.getByTestId('btn-victory-next').click();
    await page.waitForSelector('[data-testid="beat-canvas"]');

    // Complete loop.C -> all 3 loop capstones (loop.A, loop.B, loop.C) done -> unlocks Loop Architect (badge-loop)!
    await page.getByTestId('btn-complete-creative-activity').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible();
    await expect(page.getByTestId('victory-modal')).toHaveAttribute('data-ceremony', 'badge');
    await expect(page.getByTestId('victory-earned-badge')).toContainText('Loop Architect');
    await expect(page.getByTestId('victory-live-announcement')).toContainText(
      'Module Mastery Badge unlocked: Loop Architect!'
    );

    // Dismiss ceremony via click-to-dismiss and verify BadgeCollectionModal shows 1/4 earned
    await page.getByTestId('victory-modal').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);

    await page.getByTestId('btn-hamburger-menu').click();
    await page.getByTestId('drawer-btn-badges').click();
    await expect(page.getByTestId('badge-collection-modal')).toBeVisible();
    await expect(page.getByTestId('badge-collection-count')).toContainText('1/4');
    await expect(page.getByTestId('badge-card-loop')).toHaveAttribute('data-earned', 'true');
  });

  test('4. runs Beat & Light playback + directional LED cursor reticle in loop.4 & loop.C with headless AudioContext resilience', async ({
    page,
  }) => {
    // Check loop.4 LED cursor starter first (1: Set Beat Delay, 2: Set Color, 3: Loop ×4, 4: Cursor Step)
    await page.goto('/?mode=curriculum&activity=loop.4');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    for (let i = 0; i < 4; i++) {
      await page.getByTestId('btn-step').click();
    }
    await expect(page.getByTestId('beat-cursor-reticle')).toBeVisible();

    // Jump to Capstone loop.C (Looping Lightshow)
    await page.goto('/?mode=curriculum&activity=loop.C');
    await page.waitForSelector('[data-testid="beat-canvas"]');

    await expect(page.getByTestId('beat-led-grid')).toBeVisible();
    await expect(page.getByTestId('workspace-sequence')).toHaveAttribute('data-max-loop-depth', '2');
    const mainBlockCount = await page.locator('[data-block-type]').count();
    expect(mainBlockCount).toBe(14);

    // Previewing a Beat variation card runs isolated LED preview without mutating main workspace
    const radarPreviewBtn = page.getByTestId('btn-preview-variation-var1-neon-crosshair-fireworks');
    await radarPreviewBtn.click();
    await expect(radarPreviewBtn).toHaveAttribute('aria-pressed', 'true');
    await radarPreviewBtn.click();
    await expect(radarPreviewBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-block-type]')).toHaveCount(mainBlockCount);

    // Step through loop.C starter: Set Beat Delay -> Set Color -> Stamp Star -> Loop ×4 -> Kick -> Loop ×2 -> Cursor Step!
    for (let i = 0; i < 7; i++) {
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

    // Verify full 56-activity M1–M4 curriculum catalog & keyboard modal navigation (Enter + Space + Tab + Escape)
    const pickerBtn = page.getByTestId('btn-lesson-picker');
    await pickerBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();
    await page.getByTestId('picker-mode-curriculum').click();
    await expect(page.locator('[data-testid^="btn-activity-"]')).toHaveCount(56);
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

  test('6. runs param.6 speed demo, loop.3a cursor demo, loop.8–loop.9 Depot puzzle, func.0–func.1 subroutines & Depot Sandbox', async ({
    page,
  }) => {
    // 1. Lesson param.6 Explanation Demo (Beat Delay & Black Cutouts)
    await page.goto('/?mode=curriculum&activity=param.6');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('demo-tab-1')).toBeVisible();
    await expect(page.getByTestId('demo-tab-2')).toBeVisible();
    await expect(page.getByTestId('demo-tab-3')).toBeVisible();
    await page.getByTestId('demo-tab-2').click();
    await page.getByTestId('btn-step').click();

    // 2. Lesson loop.3a Explanation Demo (Meet the LED Cursor) + Turtle loop toggle sync on loop.3
    await page.goto('/?mode=curriculum&activity=loop.3a');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('demo-tab-1')).toBeVisible();
    await expect(page.getByTestId('demo-tab-2')).toBeVisible();

    await page.goto('/?mode=curriculum&activity=loop.3');
    await page.waitForSelector('[data-testid="turtle-canvas-svg"]');
    await expect(page.getByTestId('variation-cards-panel')).toBeVisible();
    await expect(page.locator('[data-testid^="variation-thumbnail-"]')).toHaveCount(3);
    await page.getByTestId('tool-loop-playback').click();
    await page.getByTestId('btn-hamburger-menu').click();
    await expect(page.getByTestId('drawer-btn-loop')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    // 3. Lesson loop.8 Explanation Demo (Meet the Cargo Depot)
    await page.goto('/?mode=curriculum&activity=loop.8');
    await page.waitForSelector('[data-testid="depot-canvas"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('demo-tab-1')).toBeVisible();
    await expect(page.getByTestId('demo-tab-2')).toBeVisible();
    await expect(page.getByTestId('demo-tab-3')).toBeVisible();

    // 4. Puzzle loop.9 LIFO Stack Transfer (6 slots + constraint proof + scaffold completion)
    await page.goto('/?mode=curriculum&activity=loop.9&dev=1');
    await page.waitForSelector('[data-testid="depot-canvas"]');
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('0 / 6');

    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.getByTestId('btn-load-scaffold').click();
    await expect(page.getByTestId('workspace-slot-count-label')).toHaveText('6 / 6');
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(2);

    // Replace both ? item placeholders with DEPOT_GRAB and DEPOT_PLACE
    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-depot-grab').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(1);

    await page.locator('[data-block-type="PLACEHOLDER"]').nth(0).click();
    await page.getByTestId('palette-depot-place').click();
    await expect(page.locator('[data-block-type="PLACEHOLDER"]')).toHaveCount(0);

    await page.getByTestId('btn-speed').click(); // 4x
    await page.getByTestId('btn-speed').click(); // 16x
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('status-success')).toBeVisible();
    await page.getByTestId('victory-modal').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
    await expect(page.getByTestId('status-success')).toBeVisible();

    // 5. Module 4 (`func`) preview: func.0 call-stack spotlight + func.1 constraint proof & F1 scope tab
    await page.goto('/?mode=curriculum&activity=func.0');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('call-stack-jump-spotlight')).toBeVisible();

    await page.goto('/?mode=curriculum&activity=func.1&dev=1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await page.getByTestId('btn-solution').click();
    await expect(page.getByTestId('constraint-overall-badge')).toContainText('Verified');
    await page.keyboard.press('Escape');

    // 6. Switch to Sandbox Depot via LessonPickerModal, verify clean V2 DOM (no scrap-bay/hud-claw) & 360px single-row header
    await page.getByTestId('btn-lesson-picker').click();
    await page.getByTestId('picker-mode-sandbox').click();
    await page.getByTestId('sim-tab-depot').click();
    await expect(page.getByTestId('depot-canvas')).toBeVisible();
    await expect(page.getByTestId('depot-scrap-bay')).toHaveCount(0);
    await expect(page.getByTestId('depot-hud-claw')).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 640 });
    const headerOverflow = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.scrollWidth - header.clientWidth : 0;
    });
    expect(headerOverflow).toBeLessThanOrEqual(0);
  });
});
