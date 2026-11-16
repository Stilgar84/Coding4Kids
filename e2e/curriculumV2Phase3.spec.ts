import { test, expect } from '@playwright/test';

const PHASE3_MODULE_IDS = [
  'seq',
  'param',
  'loop',
  'func',
  'branch',
  'while',
  'var',
  'cmp',
] as const;

test.describe('Curriculum V2 Phase 3: 8-Module Catalog (123 Activities), Sandbox Live/Sensors & var/cmp Real UI Flows', () => {
  let pageErrors: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('P3-1: default boot opens Curriculum Browser with all 8 modules (123 activities, 0 inter) and non-overflowing header', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await expect(page.getByTestId('btn-lesson-picker')).toBeVisible();

    const narrowHeaderOverflow = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.scrollWidth - header.clientWidth : 0;
    });
    expect(narrowHeaderOverflow).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopHeaderOverflow = await page.evaluate(() => {
      const header = document.querySelector('header');
      return header ? header.scrollWidth - header.clientWidth : 0;
    });
    expect(desktopHeaderOverflow).toBeLessThanOrEqual(0);

    await page.getByTestId('btn-lesson-picker').click();
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();

    const unlockBtn = page.getByTestId('btn-toggle-unlock-all');
    if ((await unlockBtn.getAttribute('aria-pressed')) !== 'true') {
      await unlockBtn.click();
    }
    await expect(unlockBtn).toHaveAttribute('aria-pressed', 'true');

    for (const modId of PHASE3_MODULE_IDS) {
      const section = page.getByTestId(`module-section-${modId}`);
      await expect(section).toBeAttached();
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }
    await expect(page.getByTestId('module-section-inter')).toHaveCount(0);
    await expect(page.locator('[data-picker-card="curriculum"]')).toHaveCount(123);
  });

  test('P3-2: /?mode=sandbox exposes Phase 3 Grid World Items, typed variable/cmp palette blocks, and Turtle Interactive Live mode', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=sandbox');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    // Phase 3 typed blocks & condition controls in Sandbox palette
    await expect(page.getByTestId('palette-var-assign')).toBeVisible();
    await expect(page.getByTestId('palette-var-op')).toBeVisible();
    await expect(page.getByTestId('palette-if')).toBeVisible();

    // Phase 3 Grid World Items popover tools (Beacon, Tile Dial, Stack Depot)
    await page.getByTestId('tool-world-items-menu').click();
    await expect(page.getByTestId('world-items-popover')).toBeVisible();
    await expect(page.getByTestId('tool-beacon')).toBeVisible();
    await expect(page.getByTestId('tool-dial')).toBeVisible();
    await expect(page.getByTestId('tool-stack-depot')).toBeVisible();
    await page.getByTestId('tool-dial').click();
    await expect(page.getByTestId('dial-value-picker')).toBeVisible();
    // Close popover while keeping DIAL selected so it does not intercept cell-1-2 clicks
    await page.getByTestId('tool-world-items-menu').click();
    await expect(page.getByTestId('world-items-popover')).toHaveCount(0);
    await page.getByTestId('cell-1-2').click();
    await expect(page.getByTestId('dial-tile-1-2')).toBeAttached();

    // Switch to Turtle Sandbox via LessonPickerModal Sandbox tab
    await page.getByTestId('btn-lesson-picker').click();
    await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();
    await page.getByTestId('picker-mode-sandbox').click();
    await page.getByTestId('sim-tab-turtle').click();
    await page.waitForSelector('[data-testid="turtle-canvas-svg"]');

    // Toggle Turtle Interactive Live mode + Clear Each Frame toggle
    const liveBtn = page.getByTestId('tool-turtle-live');
    await expect(liveBtn).toBeVisible();
    await expect(liveBtn).toHaveAttribute('aria-pressed', 'false');
    await liveBtn.click();
    await expect(liveBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('tool-turtle-live-clear')).toBeVisible();

    // Build IF (keyHeld RIGHT) { FORWARD } -> mounts InteractiveControlsBar
    await page.getByTestId('palette-if').click();
    await page.getByTestId('cond-sensor-keyHeld').click();
    await page.getByTestId('cond-keyheld-opt-RIGHT').click();
    await page.getByTestId('palette-turtle-forward').click();

    await expect(page.getByTestId('interactive-controls-bar')).toBeVisible();
    await expect(page.getByTestId('btn-interactive-key-right')).toBeVisible();
    await page.getByTestId('btn-interactive-key-right').click();

    // Turn Live mode back off cleanly
    await liveBtn.click();
    await expect(liveBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('P3-3: Module var real UI flows — var.0 multi-env explanation demo badges and var.2 parameterized dial solve across all 3 variants', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. var.0: Turtle Tab 1 -> var-badge-s, Grid Tab 2 -> var-badge-d, Continue through Tab 3 -> var.1
    await page.goto('/?mode=curriculum&activity=var.0');
    await page.waitForSelector('[data-testid="turtle-canvas-svg"]');
    await expect(page.getByTestId('explanation-demo-bar')).toBeVisible();
    await expect(page.getByTestId('copilot-card-banner')).toBeVisible();

    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('toolbar-variables')).toBeVisible();
    await expect(page.getByTestId('toolbar-variables').getByTestId('var-badge-s')).toBeVisible();

    await page.getByTestId('demo-tab-2').click();
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await page.getByTestId('btn-step').click();
    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('toolbar-variables')).toBeVisible();
    await expect(page.getByTestId('toolbar-variables').getByTestId('var-badge-d')).toBeVisible();

    // Continue from Tab 2 -> Tab 3 -> var.1
    await page.getByTestId('btn-explanation-continue').click();
    await expect(page.getByTestId('demo-tab-3')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('btn-explanation-continue').click();
    await expect(page.getByTestId('explanation-demo-bar')).toHaveCount(0);
    await expect(page.getByTestId('btn-lesson-picker')).toContainText('var.1');

    // 2. var.2: Starter has [MOVE_FWD, d = $tileDial]; assemble MOVE_FWD d -> TURN_LEFT -> MOVE_FWD d
    await page.goto('/?mode=curriculum&activity=var.2');
    await page.waitForSelector('[data-testid="grid-canvas"]');

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-var-d').click();
    await page.getByTestId('palette-turn-left').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-var-d').click();

    // Cycle speed 1x -> 4x -> 16x (2 clicks; avoid Instant live auto-eval before btn-play)
    await page.getByTestId('btn-speed').click();
    await page.getByTestId('btn-speed').click();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('victory-modal').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
  });

  test('P3-4: Module cmp real UI flows — cmp.1 Switchyard $itemWeight > 10 solve, cmp.M1 0/5 Charge Pad badge, and cmp.5a Beat reticle + F1 scope', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. cmp.1: 2-tap trash starter, then build WHILE { IF ($itemWeight > 10) { LEFT } ELSE { RIGHT } SEND_NEXT }
    await page.goto('/?mode=curriculum&activity=cmp.1');
    await page.waitForSelector('[data-testid="switchyard-canvas"]');

    const trashBtn = page.getByTestId('btn-trash');
    await trashBtn.click();
    await expect(trashBtn).toHaveAttribute('data-armed', 'true');
    await trashBtn.click();
    await expect(page.locator('[data-block-type]')).toHaveCount(0);

    await page.getByTestId('palette-while').click();
    await page.getByTestId('palette-if').click();
    await page.getByTestId('cond-sensor-cmp').click();
    await page.getByTestId('cond-cmp-left-sensor-$itemWeight').click();
    await page.getByTestId('cond-cmp-op->').click();
    await page.getByTestId('cond-cmp-right-num-10').click();
    await page.getByTestId('palette-switchyard-switch-left').click();
    await page.getByTestId('palette-else').click();
    await page.getByTestId('palette-switchyard-switch-right').click();
    await page.locator('[data-block-type="END_IF"]').click();
    await page.getByTestId('palette-switchyard-send-next').click();

    // Cycle speed 1x -> 4x -> 16x (2 clicks; avoid Instant live auto-eval suppressing victory-modal)
    await page.getByTestId('btn-speed').click();
    await page.getByTestId('btn-speed').click();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('victory-modal').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);

    // 2. cmp.M1: Multi-crate Charge Pad switch renders zero-reading numeric 0/5 badge at (4,2)
    await page.goto('/?mode=curriculum&activity=cmp.M1');
    await page.waitForSelector('[data-testid="grid-canvas"]');
    await expect(page.getByTestId('floor-switch-count-4-2')).toHaveText('0/5');

    // 3. cmp.5a: Beat cursor puzzle renders beat-canvas, beat-cursor-reticle, and F1 scope tab
    await page.goto('/?mode=curriculum&activity=cmp.5a');
    await page.waitForSelector('[data-testid="beat-canvas"]');
    await expect(page.getByTestId('beat-cursor-reticle')).toBeAttached();
    const fnToggle = page.getByTestId('btn-toggle-function-bar');
    if ((await fnToggle.getAttribute('aria-expanded')) !== 'true') {
      await fnToggle.click();
    }
    await expect(page.getByTestId('palette-tab-f1')).toBeVisible();
  });
});
