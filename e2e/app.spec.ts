import { test, expect, Page } from '@playwright/test';

async function selectSandboxLevel(page: Page, level: 1 | 2 | 3) {
  await page.getByTestId('btn-lesson-picker').click();
  await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();
  await page.getByTestId(`btn-level-${level}`).click();
  await expect(page.getByTestId('lesson-picker-modal')).toHaveCount(0);
}

async function selectSimWorld(page: Page, sim: 'grid' | 'turtle' | 'beat') {
  await page.getByTestId('btn-lesson-picker').click();
  await expect(page.getByTestId('lesson-picker-modal')).toBeVisible();
  await page.getByTestId(`sim-tab-${sim}`).click();
  if (sim !== 'grid') {
    await expect(page.getByTestId('lesson-picker-modal')).toHaveCount(0);
  } else {
    await page.keyboard.press('Escape');
  }
}

test.describe('Robot Emulator E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');
  });

  test('loads application with split-pane layout, single-row header, and visual LessonPickerModal controls', async ({ page }) => {
    // Check split panes
    await expect(page.getByTestId('pane-programming')).toBeVisible();
    await expect(page.getByTestId('pane-simulation')).toBeVisible();

    // Check unified single-row header & LessonPickerModal level buttons (1, 2, 3)
    const headerOverflows = await page.locator('header').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(headerOverflows).toBe(false);
    await page.getByTestId('btn-lesson-picker').click();
    await expect(page.getByTestId('btn-level-1')).toBeVisible();
    await expect(page.getByTestId('btn-level-2')).toBeVisible();
    await expect(page.getByTestId('btn-level-3')).toBeVisible();
    await page.keyboard.press('Escape');

    // Check robot and grid
    await expect(page.getByTestId('robot')).toBeVisible();
    await expect(page.getByTestId('grid-canvas')).toBeVisible();

    // Check palette movement buttons
    await expect(page.getByTestId('palette-move-fwd')).toBeVisible();
    await expect(page.getByTestId('palette-turn-left')).toBeVisible();
    await expect(page.getByTestId('palette-turn-right')).toBeVisible();
  });

  test('adds movement block and attaches number repeat badge', async ({ page }) => {
    await page.getByTestId('palette-move-fwd').click();

    const block = page.locator('[data-testid^="block-MOVE_FWD"]');
    await expect(block).toBeVisible();

    await page.getByTestId('palette-number-3').click();

    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toHaveText('3');
  });

  test('executes code in lockstep to reach goal on Level 1 and celebrates with click-to-dismiss VictoryCelebrationModal', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-4').click();

    await page.getByTestId('btn-play').click();

    // Wait for victory modal + status-success pill
    const victoryModal = page.getByTestId('victory-modal');
    await expect(victoryModal).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('status-success')).toBeVisible();

    // Clicking anywhere on VictoryCelebrationModal dismisses it while leaving status-success intact
    await victoryModal.click({ position: { x: 16, y: 16 } });
    await expect(victoryModal).toHaveCount(0);
    await expect(page.getByTestId('status-success')).toBeVisible();
  });

  test('detects wall barrier collision and displays collision feedback', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    const wallHitbox = page.getByTestId('wall-v-hitbox-1-2');
    await wallHitbox.click();

    await expect(page.getByTestId('wall-v-1-2')).toBeVisible();

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('btn-step').click();

    await expect(page.getByTestId('status-collision')).toBeVisible();
  });

  test('executes structured loop using number badge', async ({ page }) => {
    await page.getByTestId('palette-loop-start').click();
    await page.getByTestId('palette-number-2').click();
    await page.getByTestId('palette-turn-right').click();
    await page.getByTestId('palette-loop-end').click();

    await page.getByTestId('btn-step').click(); // Enter loop
    await page.getByTestId('btn-step').click(); // Turn right (facing SOUTH)
    await page.getByTestId('btn-step').click(); // Loop end check
    await page.getByTestId('btn-step').click(); // Turn right 2nd iteration (facing WEST)
  });

  test('supports Function 1 definition and call', async ({ page }) => {
    const toggleFuncBtn = page.getByTestId('btn-toggle-function-bar');
    await toggleFuncBtn.click();
    await page.getByTestId('palette-tab-f1').click();

    await page.getByTestId('palette-turn-left').click();

    await page.getByTestId('palette-tab-main').click();
    await toggleFuncBtn.click();

    await page.getByTestId('palette-call-f1').click();

    await page.getByTestId('btn-step').click();

    await expect(toggleFuncBtn).toContainText('F1');
  });

  test('only shows number badge when repeatCount > 1 and hides when undefined or 1', async ({ page }) => {
    await page.getByTestId('palette-move-fwd').click();

    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toHaveCount(0);

    await page.getByTestId('palette-number-3').click();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('3');
  });

  test('supports block selection and insertion point positioning', async ({ page }) => {
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();

    const blocks = page.locator('[data-testid^="block-"]');
    await expect(blocks).toHaveCount(2);

    await blocks.first().click();
    await expect(blocks.first()).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('selection-insertion-pip')).toBeVisible();

    await page.getByTestId('palette-turn-right').click();

    await expect(blocks).toHaveCount(3);
    const middleBlock = blocks.nth(1);
    await expect(middleBlock).toHaveAttribute('data-testid', /TURN_RIGHT/);

    await page.locator('[data-bg-canvas="true"]').first().click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('selection-insertion-pip')).toHaveCount(0);
  });

  test('detects unclosed loop, displays error banner and disables play/step', async ({ page }) => {
    await page.getByTestId('palette-loop-start').click();

    await expect(page.getByTestId('loop-error-banner')).toBeVisible();

    await expect(page.getByTestId('btn-play')).toBeDisabled();
    await expect(page.getByTestId('btn-step')).toBeDisabled();

    await page.getByTestId('palette-loop-end').click();

    await expect(page.getByTestId('loop-error-banner')).toHaveCount(0);
    await expect(page.getByTestId('btn-play')).toBeEnabled();
    await expect(page.getByTestId('btn-step')).toBeEnabled();
  });

  test('supports drag block to palette for deletion', async ({ page }) => {
    await page.getByTestId('palette-move-fwd').click();
    const block = page.locator('[data-testid^="block-MOVE_FWD"]');
    await expect(block).toBeVisible();

    const palette = page.getByTestId('palette-container');
    await block.dragTo(palette);

    await expect(block).toHaveCount(0);
  });

  test('clicking on a tag removes it', async ({ page }) => {
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-3').click();

    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('3');

    await badge.click();

    await expect(badge).toHaveCount(0);
  });

  test('auto-resets and plays when clicking play button after program reached success or collision', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-4').click();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('victory-modal').click({ position: { x: 16, y: 16 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
    await expect(page.getByTestId('status-success')).toBeVisible();

    // Now click Play again! Should auto-reset first and run to victory again
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 5000 });
  });

  test('allows resizing the playing board in each direction', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    const indicator = page.getByTestId('grid-size-indicator');
    await expect(indicator).toHaveText('5 × 5');

    await page.getByTestId('btn-resize-right-plus').click();
    await expect(indicator).toHaveText('6 × 5');

    await page.getByTestId('btn-resize-bottom-plus').click();
    await expect(indicator).toHaveText('6 × 6');

    await page.getByTestId('btn-resize-left-plus').click();
    await expect(indicator).toHaveText('7 × 6');

    await page.getByTestId('btn-resize-top-plus').click();
    await expect(indicator).toHaveText('7 × 7');
  });

  test('shows current iteration as <current>/<total> with distinct color on label at runtime', async ({ page }) => {
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-3').click();

    await page.getByTestId('btn-step').click();

    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toBeVisible();
    const currentSpan = page.getByTestId('iteration-current');
    const totalSpan = page.getByTestId('iteration-total');

    await expect(currentSpan).toHaveText('1');
    await expect(totalSpan).toHaveText('3');
    await expect(currentSpan).toHaveClass(/text-amber-400/);

    await page.getByTestId('btn-step').click();
    await expect(currentSpan).toHaveText('2');
    await expect(totalSpan).toHaveText('3');
  });

  test('allows dragging mouse to draw multiple barriers in barrier mode', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    await page.getByTestId('tool-wall').click();

    const box0 = await page.getByTestId('wall-h-hitbox-0-1').boundingBox();
    const box1 = await page.getByTestId('wall-h-hitbox-1-1').boundingBox();
    const box2 = await page.getByTestId('wall-h-hitbox-2-1').boundingBox();

    if (box0 && box1 && box2) {
      await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
      await page.mouse.down();
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, { steps: 5 });
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 5 });
      await page.mouse.up();
    }

    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-1-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-2-1')).toBeVisible();
  });

  test('displays solution modal on clicking solution button and auto-closes on loading solution into workspace', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    const solutionBtn = page.getByTestId('btn-solution');
    await expect(solutionBtn).toBeVisible();
    await solutionBtn.click();

    const modal = page.getByTestId('solution-modal');
    await expect(modal).toBeVisible();

    const loadBtn = page.getByTestId('btn-load-solution');
    await expect(loadBtn).toBeVisible();
    await loadBtn.click();

    // Modal auto-closes so learner can click Play immediately!
    await expect(modal).not.toBeVisible();

    const blocks = page.locator('[data-testid^="block-"]');
    await expect(blocks.first()).toBeVisible();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 5000 });
  });

  test('supports smart 1-tap selected delete and 2-tap armed clear workspace via unified btn-trash', async ({ page }) => {
    const trashBtn = page.getByTestId('btn-trash');
    await expect(trashBtn).toBeVisible();
    await expect(trashBtn).toBeDisabled();

    // Add three blocks: Move Forward, Turn Left, Move Forward
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();
    await page.getByTestId('palette-move-fwd').click();

    const allBlocks = page.locator('[data-testid^="block-"]');
    await expect(allBlocks).toHaveCount(3);
    await expect(trashBtn).toBeEnabled();
    await expect(trashBtn).toHaveAttribute('data-armed', 'false');

    // Select the middle block (Turn Left) -> 1-tap deletes only Turn Left
    const turnLeftBlock = page.locator('[data-testid^="block-TURN_LEFT"]');
    await turnLeftBlock.click();
    await trashBtn.click();

    await expect(allBlocks).toHaveCount(2);
    await expect(turnLeftBlock).toHaveCount(0);
    const forwardBlocks = page.locator('[data-testid^="block-MOVE_FWD"]');
    await expect(forwardBlocks).toHaveCount(2);

    // Select the first block and press Delete key on keyboard
    await forwardBlocks.first().click();
    await page.keyboard.press('Delete');
    await expect(allBlocks).toHaveCount(1);

    // Unselected 2-tap safety: 1st tap arms without deleting; Escape disarms; 2 taps clear all!
    await expect(trashBtn).toHaveAttribute('data-armed', 'false');
    await trashBtn.click();
    await expect(trashBtn).toHaveAttribute('data-armed', 'true');
    await expect(allBlocks).toHaveCount(1);

    await page.keyboard.press('Escape');
    await expect(trashBtn).toHaveAttribute('data-armed', 'false');
    await expect(allBlocks).toHaveCount(1);

    await trashBtn.click();
    await expect(trashBtn).toHaveAttribute('data-armed', 'true');
    await trashBtn.click();
    await expect(allBlocks).toHaveCount(0);
    await expect(trashBtn).toBeDisabled();
  });

  test('supports touch drag and drop to add blocks and repeat badges', async ({ page }) => {
    const touchDrag = async (srcSelector: string, tgtSelector: string) => {
      await page.evaluate(({ src, tgt }) => {
        const srcEl = document.querySelector(src);
        const tgtEl = document.querySelector(tgt);
        if (!srcEl || !tgtEl) throw new Error(`Not found: ${src} -> ${tgt}`);

        const srcRect = srcEl.getBoundingClientRect();
        const tgtRect = tgtEl.getBoundingClientRect();

        const startX = srcRect.left + srcRect.width / 2;
        const startY = srcRect.top + srcRect.height / 2;
        const endX = tgtRect.left + tgtRect.width / 2;
        const endY = tgtRect.top + tgtRect.height / 2;

        const touchStart = new Touch({
          identifier: 101,
          target: srcEl,
          clientX: startX,
          clientY: startY,
          pageX: startX,
          pageY: startY,
          screenX: startX,
          screenY: startY,
        });

        srcEl.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touchStart],
          targetTouches: [touchStart],
          changedTouches: [touchStart],
        }));

        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          const curX = startX + (endX - startX) * (i / steps);
          const curY = startY + (endY - startY) * (i / steps);
          const touchMove = new Touch({
            identifier: 101,
            target: srcEl,
            clientX: curX,
            clientY: curY,
            pageX: curX,
            pageY: curY,
            screenX: curX,
            screenY: curY,
          });

          window.dispatchEvent(new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [touchMove],
            targetTouches: [touchMove],
            changedTouches: [touchMove],
          }));
        }

        const touchEnd = new Touch({
          identifier: 101,
          target: srcEl,
          clientX: endX,
          clientY: endY,
          pageX: endX,
          pageY: endY,
          screenX: endX,
          screenY: endY,
        });

        window.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [touchEnd],
        }));
      }, { src: srcSelector, tgt: tgtSelector });
    };

    await touchDrag('[data-testid="palette-move-fwd"]', '[data-testid="workspace-sequence"]');

    const block = page.locator('[data-testid^="block-MOVE_FWD"]');
    await expect(block).toBeVisible();

    await touchDrag('[data-testid="palette-number-5"]', '[data-testid^="block-MOVE_FWD"]');

    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('5');

    await touchDrag('[data-testid^="block-MOVE_FWD"]', '[data-testid="palette-container"]');
    await expect(block).toHaveCount(0);
  });

  test('tablet drag and drop with concurrent pointer and touch events creates exactly one block per drop', async ({ page }) => {
    const tabletDrag = async (srcSelector: string, tgtSelector: string) => {
      await page.evaluate(({ src, tgt }) => {
        const srcEl = document.querySelector(src);
        const tgtEl = document.querySelector(tgt);
        if (!srcEl || !tgtEl) throw new Error(`Not found: ${src} -> ${tgt}`);

        const srcRect = srcEl.getBoundingClientRect();
        const tgtRect = tgtEl.getBoundingClientRect();

        const startX = srcRect.left + srcRect.width / 2;
        const startY = srcRect.top + srcRect.height / 2;
        const endX = tgtRect.left + tgtRect.width / 2;
        const endY = tgtRect.top + tgtRect.height / 2;

        const touchId = 201;

        srcEl.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: touchId,
          pointerType: 'touch',
          clientX: startX,
          clientY: startY,
        }));

        const touchStart = new Touch({
          identifier: touchId,
          target: srcEl,
          clientX: startX,
          clientY: startY,
          pageX: startX,
          pageY: startY,
          screenX: startX,
          screenY: startY,
        });
        srcEl.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touchStart],
          targetTouches: [touchStart],
          changedTouches: [touchStart],
        }));

        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          const curX = startX + (endX - startX) * (i / steps);
          const curY = startY + (endY - startY) * (i / steps);

          window.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            pointerId: touchId,
            pointerType: 'touch',
            clientX: curX,
            clientY: curY,
          }));

          const touchMove = new Touch({
            identifier: touchId,
            target: srcEl,
            clientX: curX,
            clientY: curY,
            pageX: curX,
            pageY: curY,
            screenX: curX,
            screenY: curY,
          });
          window.dispatchEvent(new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [touchMove],
            targetTouches: [touchMove],
            changedTouches: [touchMove],
          }));
        }

        window.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: touchId,
          pointerType: 'touch',
          clientX: endX,
          clientY: endY,
        }));

        const touchEnd = new Touch({
          identifier: touchId,
          target: srcEl,
          clientX: endX,
          clientY: endY,
          pageX: endX,
          pageY: endY,
          screenX: endX,
          screenY: endY,
        });
        window.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [touchEnd],
        }));
      }, { src: srcSelector, tgt: tgtSelector });
    };

    await tabletDrag('[data-testid="palette-move-fwd"]', '[data-testid="workspace-sequence"]');
    const blocksAfterFirst = page.locator('[data-testid^="block-"]');
    await expect(blocksAfterFirst).toHaveCount(1);

    await tabletDrag('[data-testid="palette-turn-left"]', '[data-testid="workspace-sequence"]');
    const blocksAfterSecond = page.locator('[data-testid^="block-"]');
    await expect(blocksAfterSecond).toHaveCount(2);

    await tabletDrag('[data-testid="palette-turn-right"]', '[data-testid="workspace-sequence"]');
    const blocksAfterThird = page.locator('[data-testid^="block-"]');
    await expect(blocksAfterThird).toHaveCount(3);
  });

  test('supports touch drag and drop to reorder blocks within sequence', async ({ page }) => {
    const touchDrag = async (srcSelector: string, tgtSelector: string, dropRightHalf = false) => {
      await page.evaluate(({ src, tgt, rightHalf }) => {
        const srcEl = document.querySelector(src);
        const tgtEl = document.querySelector(tgt);
        if (!srcEl || !tgtEl) throw new Error(`Not found: ${src} -> ${tgt}`);

        const srcRect = srcEl.getBoundingClientRect();
        const tgtRect = tgtEl.getBoundingClientRect();

        const startX = srcRect.left + srcRect.width / 2;
        const startY = srcRect.top + srcRect.height / 2;
        const endX = rightHalf ? tgtRect.right - 5 : tgtRect.left + 5;
        const endY = tgtRect.top + tgtRect.height / 2;

        const touchStart = new Touch({
          identifier: 202,
          target: srcEl,
          clientX: startX,
          clientY: startY,
          pageX: startX,
          pageY: startY,
          screenX: startX,
          screenY: startY,
        });

        srcEl.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [touchStart],
          targetTouches: [touchStart],
          changedTouches: [touchStart],
        }));

        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          const curX = startX + (endX - startX) * (i / steps);
          const curY = startY + (endY - startY) * (i / steps);
          const touchMove = new Touch({
            identifier: 202,
            target: srcEl,
            clientX: curX,
            clientY: curY,
            pageX: curX,
            pageY: curY,
            screenX: curX,
            screenY: curY,
          });

          window.dispatchEvent(new TouchEvent('touchmove', {
            bubbles: true,
            cancelable: true,
            touches: [touchMove],
            targetTouches: [touchMove],
            changedTouches: [touchMove],
          }));
        }

        const touchEnd = new Touch({
          identifier: 202,
          target: srcEl,
          clientX: endX,
          clientY: endY,
          pageX: endX,
          pageY: endY,
          screenX: endX,
          screenY: endY,
        });

        window.dispatchEvent(new TouchEvent('touchend', {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [touchEnd],
        }));
      }, { src: srcSelector, tgt: tgtSelector, rightHalf: dropRightHalf });
    };

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();

    const blocks = page.locator('[data-testid^="block-"]');
    await expect(blocks).toHaveCount(2);

    const firstBlockBefore = await blocks.nth(0).getAttribute('data-testid');
    expect(firstBlockBefore).toContain('MOVE_FWD');

    await touchDrag('[data-testid^="block-TURN_LEFT"]', '[data-testid^="block-MOVE_FWD"]', false);

    const firstBlockAfter = await blocks.nth(0).getAttribute('data-testid');
    expect(firstBlockAfter).toContain('TURN_LEFT');
  });

  test('keeps trajectory and fit buttons in place when grid scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 500 });
    const scrollContainer = page.getByTestId('grid-scroll-container');
    const traceBtn = page.getByTestId('btn-toggle-trace');
    const fitBtn = page.getByTestId('btn-toggle-fit');

    await expect(traceBtn).toBeVisible();
    await expect(fitBtn).toBeVisible();

    const traceBoxBefore = await traceBtn.boundingBox();
    const fitBoxBefore = await fitBtn.boundingBox();
    expect(traceBoxBefore).not.toBeNull();
    expect(fitBoxBefore).not.toBeNull();

    await scrollContainer.evaluate((el) => {
      el.scrollLeft = 80;
      el.scrollTop = 80;
    });

    const traceBoxAfter = await traceBtn.boundingBox();
    const fitBoxAfter = await fitBtn.boundingBox();

    expect(traceBoxAfter?.x).toBeCloseTo(traceBoxBefore!.x, 1);
    expect(traceBoxAfter?.y).toBeCloseTo(traceBoxBefore!.y, 1);
    expect(fitBoxAfter?.x).toBeCloseTo(fitBoxBefore!.x, 1);
    expect(fitBoxAfter?.y).toBeCloseTo(fitBoxBefore!.y, 1);
  });

  test('does not cut off top and left of map view on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 480 });
    const scrollContainer = page.getByTestId('grid-scroll-container');

    await scrollContainer.evaluate((el) => {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    });

    const containerBox = await scrollContainer.boundingBox();
    const topHandle = page.getByTestId('resize-handle-top');
    const leftHandle = page.getByTestId('resize-handle-left');

    const topHandleBox = await topHandle.boundingBox();
    const leftHandleBox = await leftHandle.boundingBox();

    expect(topHandleBox!.y).toBeGreaterThanOrEqual(containerBox!.y);
    expect(leftHandleBox!.x).toBeGreaterThanOrEqual(containerBox!.x);
  });

  test('toggles fit to available size mode to scale the map view within viewport', async ({ page }) => {
    const fitBtn = page.getByTestId('btn-toggle-fit');
    await expect(fitBtn).toBeVisible();

    const wrapper = page.getByTestId('grid-fit-wrapper');

    await fitBtn.click();
    await expect(fitBtn).toHaveAttribute('title', /Reset to Actual Size/i);
    await expect(wrapper).toHaveAttribute('style', /width:/);

    await fitBtn.click();
    await expect(fitBtn).toHaveAttribute('title', /Fit to Available Size/i);
  });

  test('opens action parameter popover visibly below badge without being clipped by palette', async ({ page }) => {
    await selectSimWorld(page, 'turtle');

    await page.getByTestId('palette-turtle-turn-left').click();

    const paramBadge = page.getByTestId('block-param-badge-angle');
    await expect(paramBadge).toBeVisible();

    await paramBadge.click();

    const popover = page.getByTestId('param-popover-angle');
    await expect(popover).toBeVisible();

    const paletteBox = await page.getByTestId('palette-container').boundingBox();
    const popoverBox = await popover.boundingBox();

    expect(paletteBox).not.toBeNull();
    expect(popoverBox).not.toBeNull();

    expect(popoverBox!.y).toBeGreaterThanOrEqual(paletteBox!.y + paletteBox!.height);

    const option45 = page.getByTestId('param-option-45');
    await expect(option45).toBeVisible();
    await option45.click();

    await expect(popover).not.toBeVisible();
  });

  test('displays action param toggle icon on repeat row and toggles parameter visibility without full row title', async ({ page }) => {
    const toggleBtn = page.getByTestId('palette-param-toggle-btn');
    await expect(toggleBtn).toBeVisible();
    await expect(page.getByTestId('subpalette-header')).toHaveCount(0);

    await selectSimWorld(page, 'turtle');

    await page.getByTestId('palette-turtle-turn-left').click();

    const subpalette = page.getByTestId('block-subpalette');
    await expect(subpalette).toBeVisible();
    await expect(page.getByTestId('subpalette-header')).toHaveCount(0);

    await toggleBtn.click();
    await expect(subpalette).toHaveCount(0);

    await toggleBtn.click();
    await expect(subpalette).toBeVisible();

    const subpaletteOpt45 = page.getByTestId('subpalette-param-angle-45');
    await expect(subpaletteOpt45).toBeVisible();
    await subpaletteOpt45.click();

    await expect(page.getByTestId('block-param-badge-angle')).toContainText('45°');
  });

  test('animates turtle drawing in real-time with active line segment and avatar updates', async ({ page }) => {
    await selectSimWorld(page, 'turtle');
    await expect(page.getByTestId('turtle-canvas-container')).toBeVisible();

    await page.getByTestId('palette-turtle-forward').click();

    await page.getByTestId('btn-step').click();

    const robot = page.getByTestId('turtle-robot');
    await expect(robot).toBeVisible();

    await expect(page.getByTestId('turtle-line-0')).toBeAttached({ timeout: 5000 });
    const infoPill = page.getByTestId('turtle-info-pill');
    await expect(infoPill).toContainText('Y: -50');
  });

  test('supports undo via toolbar button and redo via unified menu drawer for code edits', async ({ page }) => {
    const tbUndo = page.getByTestId('btn-undo');
    await expect(tbUndo).toBeDisabled();

    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-turn-left').click();
    const blocks = page.locator('[data-testid^="block-"]');
    await expect(blocks).toHaveCount(2);
    await expect(tbUndo).toBeEnabled();

    await tbUndo.click();
    await expect(blocks).toHaveCount(1);
    await tbUndo.click();
    await expect(blocks).toHaveCount(0);
    await expect(tbUndo).toBeDisabled();

    // Redo twice via Unified Menu Drawer
    await page.getByTestId('btn-hamburger-menu').click();
    const drawerRedo = page.getByTestId('drawer-btn-redo');
    await expect(drawerRedo).toBeEnabled();
    await drawerRedo.click();
    await expect(blocks).toHaveCount(1);
    await drawerRedo.click();
    await expect(blocks).toHaveCount(2);
    await expect(drawerRedo).toBeDisabled();
    await page.getByTestId('btn-close-mobile-menu').click();
  });

  test('supports undo and redo keyboard shortcuts (Ctrl+Z and Ctrl+Y)', async ({ page }) => {
    await page.getByTestId('palette-turn-left').click();
    const blocks = page.locator('[data-testid^="block-"]');
    await expect(blocks).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(blocks).toHaveCount(0);

    await page.keyboard.press('Control+y');
    await expect(blocks).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(blocks).toHaveCount(0);
    await page.keyboard.press('Control+Shift+z');
    await expect(blocks).toHaveCount(1);
  });

  test('supports undo and redo for single wall hitbox toggle', async ({ page }) => {
    const wallHitbox = page.getByTestId('wall-v-hitbox-1-2');
    await wallHitbox.click();
    await expect(page.getByTestId('wall-v-1-2')).toBeVisible();

    await page.getByTestId('btn-undo').click();
    await expect(page.getByTestId('wall-v-1-2')).toHaveCount(0);

    await page.keyboard.press('Control+y');
    await expect(page.getByTestId('wall-v-1-2')).toBeVisible();
  });

  test('batches dragged walls into a single undo step', async ({ page }) => {
    await selectSandboxLevel(page, 1);

    await page.getByTestId('tool-wall').click();

    const box0 = await page.getByTestId('wall-h-hitbox-0-1').boundingBox();
    const box1 = await page.getByTestId('wall-h-hitbox-1-1').boundingBox();
    const box2 = await page.getByTestId('wall-h-hitbox-2-1').boundingBox();

    if (box0 && box1 && box2) {
      await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
      await page.mouse.down();
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2, { steps: 5 });
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 5 });
      await page.mouse.up();
    }

    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-1-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-2-1')).toBeVisible();

    await page.getByTestId('btn-undo').click();
    await expect(page.getByTestId('wall-h-0-1')).toHaveCount(0);
    await expect(page.getByTestId('wall-h-1-1')).toHaveCount(0);
    await expect(page.getByTestId('wall-h-2-1')).toHaveCount(0);

    await page.keyboard.press('Control+y');
    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-1-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-2-1')).toBeVisible();
  });
});
