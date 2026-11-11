import { test, expect } from '@playwright/test';

test.describe('PWA Assets & Update State Restoration E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/Coding4Kids/');
    await page.waitForSelector('[data-testid="grid-canvas"]');
  });

  test('serves valid PWA icon PNGs and SVG over HTTP', async ({ request }) => {
    const assets = [
      { path: '/Coding4Kids/pwa-192x192.png', type: 'image/png' },
      { path: '/Coding4Kids/pwa-512x512.png', type: 'image/png' },
      { path: '/Coding4Kids/pwa-maskable-512x512.png', type: 'image/png' },
      { path: '/Coding4Kids/apple-touch-icon.png', type: 'image/png' },
      { path: '/Coding4Kids/robot-icon.svg', type: 'image/svg+xml' },
    ];

    for (const asset of assets) {
      const response = await request.get(asset.path);
      expect(response.status(), `Expected 200 for ${asset.path}`).toBe(200);
      expect(response.headers()['content-type']).toContain(asset.type);
      const body = await response.body();
      expect(body.byteLength).toBeGreaterThan(100);
    }
  });

  test('proposes app update, supports snoozing, and restores workspace & map across reload', async ({ page }) => {
    // 1. Customize state: switch to Level 2 via LessonPickerModal, add blocks with repeat count, add a custom wall
    await page.getByTestId('btn-lesson-picker').click();
    await page.getByTestId('btn-level-2').click();
    await page.getByTestId('palette-move-fwd').click();
    await page.getByTestId('palette-number-4').click();
    await page.getByTestId('palette-turn-right').click();
    await page.getByTestId('wall-v-hitbox-1-1').click();
    await expect(page.getByTestId('wall-v-1-1')).toBeVisible();

    // 2. Simulate PWA update becoming ready
    await page.evaluate(() => {
      window.dispatchEvent(new Event('robotemu:pwa-simulate-update'));
    });

    const banner = page.getByTestId('pwa-update-banner');
    await expect(banner).toBeVisible();

    // 3. Click "Later" to snooze
    await page.getByTestId('btn-pwa-update-later').click();
    await expect(banner).not.toBeVisible();

    // Desktop toolbar shows subtle Update button while mobile has drawer button
    const toolbarUpdateBtn = page.getByTestId('btn-toolbar-pwa-update');
    if (await toolbarUpdateBtn.isVisible()) {
      await toolbarUpdateBtn.click();
    } else {
      await page.getByTestId('btn-hamburger-menu').click();
      await expect(page.getByTestId('drawer-btn-pwa-update')).toBeVisible();
      await page.getByTestId('btn-close-mobile-menu').click();
      await page.evaluate(() => {
        window.dispatchEvent(new Event('robotemu:pwa-simulate-update'));
      });
    }

    await expect(banner).toBeVisible();

    // 4. Click "Update Now" -> waits for navigation reload and restores workspace & custom map
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
      page.getByTestId('btn-pwa-update-now').click(),
    ]);

    await page.waitForSelector('[data-testid="grid-canvas"]');

    // 5. Verify post-update restoration toast and full state preservation
    await expect(page.getByTestId('pwa-restored-toast')).toBeVisible();
    await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
    await expect(page.locator('[data-testid^="badge-repeat-MOVE_FWD"]')).toHaveText('4');
    await expect(page.getByTestId('wall-v-1-1')).toBeVisible();
  });
});
