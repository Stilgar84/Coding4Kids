import { test, expect } from '@playwright/test';

test.describe('Switchyard (train env): depot queue order/counter, feeder animation, crash travel & failure bubbles', () => {
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

  test('branch.3: starts all 4 wagons in depot with plain counter, animates into scanner, crashes with Red Gear != Crate, and hides counter on solve', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=branch.3');
    await page.waitForSelector('[data-testid="switchyard-canvas"]');

    // 1. t = 0: Scanner is empty, all 4 wagons wait in depot, badge shows plain "4" (no + or ×)
    await expect(page.getByTestId('switchyard-scanner-wagon')).toHaveCount(0);
    const depotCount = page.getByTestId('switchyard-depot-count');
    await expect(depotCount).toHaveText('4');
    await expect(page.getByTestId('switchyard-tunnel-car-0')).toBeAttached();
    await expect(page.getByTestId('switchyard-tunnel-car-1')).toBeAttached();

    // Verify FIFO exit order: right car (tunnel-car-1, nearest exit) is Red (#ef4444), left car (tunnel-car-0) is Blue (#3b82f6)
    const tunnelCar0Fill = await page
      .getByTestId('switchyard-tunnel-car-0')
      .locator('rect[rx="6"]')
      .first()
      .getAttribute('fill');
    const tunnelCar1Fill = await page
      .getByTestId('switchyard-tunnel-car-1')
      .locator('rect[rx="6"]')
      .first()
      .getAttribute('fill');
    expect(tunnelCar0Fill).toBe('#3b82f6');
    expect(tunnelCar1Fill).toBe('#ef4444');

    // 2. First step loads Wagon #1 into scanner with feeder animation and decrements depot count to "3"
    await page.getByTestId('btn-step').click();
    await expect(page.getByTestId('switchyard-scanner-wagon')).toHaveCount(1);
    await expect(page.getByTestId('switchyard-scanner-wagon')).toHaveAttribute('data-feeder-anim', 'true');
    await expect(depotCount).toHaveText('3');

    // 3. Play Starter code -> Switch A turns right -> Red Gear collides at Crate Dock B
    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('status-collision')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('switchyard-inflight-wagon')).toHaveCount(1);

    const bubble = page.getByTestId('switchyard-failure-bubble');
    await expect(bubble).toBeVisible();
    const bubbleHtml = await bubble.innerHTML();
    expect(bubbleHtml).toContain('#ef4444');
    expect(bubbleHtml).not.toContain('fill="#f59e0b"');
    await expect(depotCount).toHaveText('3');

    // 4. Solve branch.3: insert IF (itemIcon == gear) { SWITCH_LEFT } after SWITCH_RIGHT
    await page.locator('[data-block-type="SWITCH_RIGHT"]').click();
    await page.getByTestId('palette-if').click();
    const sensorBtn = page.getByTestId('cond-sensor-itemIcon');
    if ((await sensorBtn.count()) > 0) {
      await sensorBtn.click();
    }
    await page.getByTestId('cond-icon-gear').click();
    await page.getByTestId('palette-switchyard-switch-left').click();

    // Switch speed 1x -> 4x -> 16x for snappy multi-variant completion
    await page.getByTestId('btn-speed').click();
    await page.getByTestId('btn-speed').click();

    await page.getByTestId('btn-play').click();
    await expect(page.getByTestId('victory-modal')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('switchyard-depot-count')).toHaveCount(0);

    await page.getByTestId('victory-modal').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('victory-modal')).toHaveCount(0);
  });
});
