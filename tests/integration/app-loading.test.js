import { test, expect } from '@playwright/test';
import { setupAudioMocks } from './helpers/audio-mock.js';

test.describe('Application Loading', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioMocks(page);
  });

  test('should load the application and show initial loading state', async ({ page }) => {
    await page.goto('/');
    
    // Check that the app title loads
    await expect(page).toHaveTitle(/Vite App/);
    
    // Should show loading progress initially
    await expect(page.locator('.v-progress-linear--active')).toBeVisible({ timeout: 10000 });
    
    // Should show loading message
    await expect(page.getByText(/Loading/i)).toBeVisible();
  });

  test('should complete loading and show sound groups', async ({ page }) => {
    await page.goto('/');
    
    // Wait for loading to complete (with reasonable timeout for mocked audio)
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Should show sound group cards after loading
    await expect(page.locator('.v-card').first()).toBeVisible();
    
    // Should show play buttons
    await expect(page.getByRole('button', { name: /random/i })).toBeVisible();
  });

  test('should show loading progress details', async ({ page }) => {
    await page.goto('/');
    
    // Should show progress percentage
    await expect(page.locator('.v-progress-linear--active[role="progressbar"]')).toBeVisible();
    
    // Should show loading phase messages
    const loadingMessage = page.locator('text=/Loading|Initializing|Processing/i');
    await expect(loadingMessage).toBeVisible();
  });

  test('should handle loading errors gracefully', async ({ page }) => {
    // Mock a failed audio service initialization
    await page.addInitScript(() => {
      window.AudioContext = class {
        constructor() {
          throw new Error('Mock audio initialization failure');
        }
      };
    });

    await page.goto('/');
    
    // Should either show error state or handle gracefully (app still loads with fallback)
    const errorText = page.getByText(/error|failed/i);
    const soundCards = page.locator('.v-card');
    
    // Either should show error or load normally with fallback
    await Promise.race([
      expect(errorText).toBeVisible({ timeout: 15000 }),
      expect(soundCards.first()).toBeVisible({ timeout: 15000 })
    ]);
  });
});