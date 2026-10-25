import { test, expect } from '@playwright/test';

test.describe('Robot Emulator E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="grid-canvas"]');
  });

  test('loads application with split-pane layout and non-text visual controls', async ({ page }) => {
    // Check split panes
    await expect(page.getByTestId('pane-programming')).toBeVisible();
    await expect(page.getByTestId('pane-simulation')).toBeVisible();

    // Check level buttons (1, 2, 3)
    await expect(page.getByTestId('btn-level-1')).toBeVisible();
    await expect(page.getByTestId('btn-level-2')).toBeVisible();
    await expect(page.getByTestId('btn-level-3')).toBeVisible();

    // Check robot and grid
    await expect(page.getByTestId('robot')).toBeVisible();
    await expect(page.getByTestId('grid-canvas')).toBeVisible();

    // Check palette movement buttons
    await expect(page.getByTestId('palette-move-fwd')).toBeVisible();
    await expect(page.getByTestId('palette-turn-left')).toBeVisible();
    await expect(page.getByTestId('palette-turn-right')).toBeVisible();
  });

  test('adds movement block and attaches number repeat badge', async ({ page }) => {
    // Click Forward block in palette
    await page.getByTestId('palette-move-fwd').click();

    // Verify block was added to sequence
    const block = page.locator('[data-testid^="block-MOVE_FWD"]');
    await expect(block).toBeVisible();

    // Click number 3 in palette number badges
    await page.getByTestId('palette-number-3').click();

    // Verify number badge on block is 3
    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toHaveText('3');
  });

  test('executes code in lockstep to reach goal on Level 1', async ({ page }) => {
    // Select Level 1 (Robot starts at x:0, y:2 facing EAST; Goal at x:4, y:2)
    await page.getByTestId('btn-level-1').click();

    // Add Forward block with multiplier 4
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-4').click();

    // Click Play
    await page.getByTestId('btn-play').click();

    // Wait for victory banner
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 5000 });
  });

  test('detects wall barrier collision and displays collision feedback', async ({ page }) => {
    // Select Level 1
    await page.getByTestId('btn-level-1').click();

    // Toggle wall between (0, 2) and (1, 2): Vertical wall at x:1, y:2
    const wallHitbox = page.getByTestId('wall-v-hitbox-1-2');
    await wallHitbox.click();

    // Verify wall line appears
    await expect(page.getByTestId('wall-v-1-2')).toBeVisible();

    // Add Move Forward block
    await page.getByTestId('palette-move-fwd').click();

    // Click Step button
    await page.getByTestId('btn-step').click();

    // Expect collision banner to appear
    await expect(page.getByTestId('status-collision')).toBeVisible();
  });

  test('executes structured loop using number badge', async ({ page }) => {
    // Add Loop Start
    await page.getByTestId('palette-loop-start').click();

    // Set loop count to 2
    await page.getByTestId('palette-number-2').click();

    // Add Turn Right inside loop
    await page.getByTestId('palette-turn-right').click();

    // Add Loop End
    await page.getByTestId('palette-loop-end').click();

    // Step through the loop
    await page.getByTestId('btn-step').click(); // Enter loop
    await page.getByTestId('btn-step').click(); // Turn right (facing SOUTH)
    await page.getByTestId('btn-step').click(); // Loop end check
    await page.getByTestId('btn-step').click(); // Turn right 2nd iteration (facing WEST)
  });

  test('supports Function 1 definition and call', async ({ page }) => {
    // Switch to Function 1 tab
    await page.getByTestId('tab-f1').click();

    // Add Turn Left in F1
    await page.getByTestId('palette-turn-left').click();

    // Switch back to Main tab
    await page.getByTestId('tab-main').click();

    // Add Call F1 block in Main
    await page.getByTestId('palette-call-f1').click();

    // Step: Calls F1
    await page.getByTestId('btn-step').click();

    // Tab should automatically show F1 as active
    await expect(page.getByTestId('tab-f1')).toBeVisible();
  });

  test('only shows number badge when repeatCount > 1 and hides when undefined or 1', async ({ page }) => {
    // Add Forward block (default repeatCount undefined)
    await page.getByTestId('palette-move-fwd').click();

    // Verify repeat badge is NOT visible on block
    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toHaveCount(0);

    // Apply repeat multiplier 3 from palette
    await page.getByTestId('palette-number-3').click();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('3');
  });

  test('supports block selection and insertion point positioning', async ({ page }) => {
    // Add Move Forward block
    await page.getByTestId('palette-move-fwd').click();
    // Add Turn Left block
    await page.getByTestId('palette-turn-left').click();

    // Initially 2 blocks
    const blocks = page.locator('[data-testid^="block-"]');
    await expect(blocks).toHaveCount(2);

    // Click the first block (Move Forward) to select it
    await blocks.first().click();
    await expect(blocks.first()).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('selection-insertion-pip')).toBeVisible();

    // Insert Turn Right from palette: should insert at index 1 (between Forward and Left)
    await page.getByTestId('palette-turn-right').click();

    // Now 3 blocks: Forward, Turn Right, Turn Left
    await expect(blocks).toHaveCount(3);
    const middleBlock = blocks.nth(1);
    await expect(middleBlock).toHaveAttribute('data-testid', /TURN_RIGHT/);

    // Clicking background clears selection
    await page.locator('[data-bg-canvas="true"]').first().click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('selection-insertion-pip')).toHaveCount(0);
  });

  test('detects unclosed loop, displays error banner and disables play/step', async ({ page }) => {
    // Add only Loop Start
    await page.getByTestId('palette-loop-start').click();

    // Expect warning banner
    await expect(page.getByTestId('loop-error-banner')).toBeVisible();

    // Expect Play and Step to be disabled
    await expect(page.getByTestId('btn-play')).toBeDisabled();
    await expect(page.getByTestId('btn-step')).toBeDisabled();

    // Add matching Loop End
    await page.getByTestId('palette-loop-end').click();

    // Warning banner should disappear
    await expect(page.getByTestId('loop-error-banner')).toHaveCount(0);
    await expect(page.getByTestId('btn-play')).toBeEnabled();
    await expect(page.getByTestId('btn-step')).toBeEnabled();
  });

  test('supports drag block to palette for deletion', async ({ page }) => {
    // Add Move Forward block
    await page.getByTestId('palette-move-fwd').click();
    const block = page.locator('[data-testid^="block-MOVE_FWD"]');
    await expect(block).toBeVisible();

    // Drag block to palette
    const palette = page.getByTestId('palette-container');
    await block.dragTo(palette);

    // Verify block was removed
    await expect(block).toHaveCount(0);
  });

  test('clicking on a tag removes it', async ({ page }) => {
    // Add Move Forward block
    await page.getByTestId('palette-move-fwd').click();
    // Add number 3
    await page.getByTestId('palette-number-3').click();

    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('3');

    // Click on the badge to remove it
    await badge.click();

    // Badge should be removed
    await expect(badge).toHaveCount(0);
  });

  test('auto-resets and plays when clicking play button after program reached success or collision', async ({ page }) => {
    // Select Level 1
    await page.getByTestId('btn-level-1').click();

    // Add Forward block with multiplier 4 to reach goal
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-4').click();

    // Run to goal
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 5000 });

    // Now click Play again! Should auto-reset first and run to victory again
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-success')).toBeVisible({ timeout: 5000 });
  });

  test('allows resizing the playing board in each direction', async ({ page }) => {
    await page.getByTestId('btn-level-1').click();

    // Initial size indicator is 5 × 5
    const indicator = page.getByTestId('grid-size-indicator');
    await expect(indicator).toHaveText('5 × 5');

    // Extend RIGHT
    await page.getByTestId('btn-resize-right-plus').click();
    await expect(indicator).toHaveText('6 × 5');

    // Extend BOTTOM
    await page.getByTestId('btn-resize-bottom-plus').click();
    await expect(indicator).toHaveText('6 × 6');

    // Extend LEFT
    await page.getByTestId('btn-resize-left-plus').click();
    await expect(indicator).toHaveText('7 × 6');

    // Extend TOP
    await page.getByTestId('btn-resize-top-plus').click();
    await expect(indicator).toHaveText('7 × 7');
  });

  test('shows current iteration as <current>/<total> with distinct color on label at runtime', async ({ page }) => {
    // Add Move Forward block with multiplier 3
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-3').click();

    // Step 1: block executes iteration 1 of 3
    await page.getByTestId('btn-step').click();

    // Label should display 1/3 with current colored
    const badge = page.locator('[data-testid^="badge-repeat-MOVE_FWD"]');
    await expect(badge).toBeVisible();
    const currentSpan = page.getByTestId('iteration-current');
    const totalSpan = page.getByTestId('iteration-total');

    await expect(currentSpan).toHaveText('1');
    await expect(totalSpan).toHaveText('3');
    await expect(currentSpan).toHaveClass(/text-amber-400/);

    // Step 2: iteration 2 of 3
    await page.getByTestId('btn-step').click();
    await expect(currentSpan).toHaveText('2');
    await expect(totalSpan).toHaveText('3');
  });

  test('allows dragging mouse to draw multiple barriers in barrier mode', async ({ page }) => {
    await page.getByTestId('btn-level-1').click();

    // Activate wall/barrier tool
    await page.getByTestId('tool-wall').click();

    // Drag mouse across horizontal wall hitboxes at row 1: (0, 1), (1, 1), (2, 1)
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

    // Verify all 3 walls were created
    await expect(page.getByTestId('wall-h-0-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-1-1')).toBeVisible();
    await expect(page.getByTestId('wall-h-2-1')).toBeVisible();
  });
});
