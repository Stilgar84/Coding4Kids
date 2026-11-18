import { test, expect } from '@playwright/test';

test.describe('Depot (Dock env): Tall viewport crane distance, claw sensor light/beam & top-aligned INPUT', () => {
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

  test('bounds grabber-to-station distance on tall viewports (1280x1100 vs 1280x720) and top-aligns INPUT first-element-at-top', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/?mode=curriculum&activity=cmp.6');
    await page.waitForSelector('[data-testid="depot-canvas"]');
    await expect(page.getByTestId('depot-input-station')).toBeVisible();

    // Measure crane-to-station gap at standard 1280x720 viewport
    const crane = page.getByTestId('depot-worker-crane');
    const inputStation = page.getByTestId('depot-input-station');
    const craneBox720 = await crane.boundingBox();
    const inputBox720 = await inputStation.boundingBox();
    expect(craneBox720).not.toBeNull();
    expect(inputBox720).not.toBeNull();
    const gap720 = inputBox720!.y - (craneBox720!.y + craneBox720!.height);
    expect(gap720).toBeGreaterThan(0);
    expect(gap720).toBeLessThan(90);

    // Resize to a very tall viewport (1280x1100) and verify crane stays close to stations
    await page.setViewportSize({ width: 1280, height: 1100 });
    const craneBox1100 = await crane.boundingBox();
    const inputBox1100 = await inputStation.boundingBox();
    expect(craneBox1100).not.toBeNull();
    expect(inputBox1100).not.toBeNull();
    const gap1100 = inputBox1100!.y - (craneBox1100!.y + craneBox1100!.height);
    expect(gap1100).toBeGreaterThan(0);
    expect(gap1100).toBeLessThan(90);
    expect(Math.abs(gap1100 - gap720)).toBeLessThanOrEqual(8);

    // Verify INPUT aligns items to the top with first element (crate-0: [7]) at the top above crate-1 ([2])
    const crate0Box = await page.getByTestId('depot-input-crate-0').boundingBox();
    const crate1Box = await page.getByTestId('depot-input-crate-1').boundingBox();
    expect(crate0Box).not.toBeNull();
    expect(crate1Box).not.toBeNull();
    expect(crate0Box!.y).toBeLessThan(crate1Box!.y);
    expect(crate0Box!.y - inputBox1100!.y).toBeLessThan(36);

    // Verify Stack 1 remains bottom-aligned (opposite of INPUT)
    const stack1Box = await page.getByTestId('depot-stack-1').boundingBox();
    const stack1Crate0Box = await page.getByTestId('depot-stack-1-crate-0').boundingBox();
    expect(stack1Box).not.toBeNull();
    expect(stack1Crate0Box).not.toBeNull();
    expect(stack1Crate0Box!.y - stack1Box!.y).toBeGreaterThan(100);

    // Step through cmp.6 Demo Tab 1 until GRAB takes top INPUT item [7] and [2] advances to crate-0
    await expect(page.getByTestId('depot-input-crate-0').locator('[data-value="7"]')).toBeVisible();
    await expect(page.getByTestId('depot-input-crate-1').locator('[data-value="2"]')).toBeVisible();

    for (let i = 0; i < 4; i++) {
      if ((await page.getByTestId('depot-claw-held-crate').count()) > 0) break;
      await page.getByTestId('btn-step').click();
    }

    await expect(page.getByTestId('depot-claw-held-crate').locator('[data-value="7"]')).toBeVisible();
    await expect(page.getByTestId('depot-input-crate-0').locator('[data-value="2"]')).toBeVisible();
  });

  test('mounts sensor LED on claw wrist and emits exactly one sensor-beam from the claw in while.2 Demo Tab 2', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?mode=curriculum&activity=while.2');
    await page.waitForSelector('[data-testid="depot-canvas"]');

    await page.getByTestId('demo-tab-2').click();

    const led = page.getByTestId('depot-claw-sensor-led');
    const beam = page.getByTestId('depot-sensor-beam');
    const crane = page.getByTestId('depot-worker-crane');

    await expect(led).toBeVisible();
    await expect(beam).toHaveCount(1);
    await expect(beam).toBeVisible();

    const craneBox = await crane.boundingBox();
    const ledBox = await led.boundingBox();
    const beamBox = await beam.boundingBox();
    expect(craneBox).not.toBeNull();
    expect(ledBox).not.toBeNull();
    expect(beamBox).not.toBeNull();

    // Sensor LED and beam origin sit horizontally centered on the claw wrist inside the crane rig
    const ledCenterX = ledBox!.x + ledBox!.width / 2;
    const beamCenterX = beamBox!.x + beamBox!.width / 2;
    expect(Math.abs(ledCenterX - beamCenterX)).toBeLessThan(20);
    expect(beamBox!.y).toBeGreaterThanOrEqual(ledBox!.y - 2);
    expect(beamBox!.y).toBeLessThanOrEqual(ledBox!.y + 20);
  });
});
