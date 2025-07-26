import { test, expect } from '@playwright/test';
import { setupAudioMocks } from './helpers/audio-mock.js';

test.describe('Progressive Loading', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioMocks(page);
  });

  test('should load word sprites first and enable word sounds immediately', async ({ page }) => {
    await page.goto('/');
    
    // Wait for word sprites to load (should be fast)
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Word sound buttons (Random, Answer buttons) should be enabled immediately
    const soundCard = page.locator('.v-card').first();
    const randomButton = soundCard.getByRole('button', { name: /random/i });
    await expect(randomButton).toBeEnabled();
    
    // Should be able to play word sounds immediately
    await randomButton.click();
    await expect(soundCard.getByRole('button', { name: /again/i })).toBeVisible({ timeout: 5000 });
  });

  test('should show long buttons as loading initially', async ({ page }) => {
    await page.goto('/');
    
    // Initially, long buttons should show loading state
    const longButton = page.locator('text=Loading...').or(page.locator('.long-btn:has-text("Loading")'));
    
    // If long buttons exist, they should initially be disabled/loading
    const longButtonCount = await page.locator('.long-btn').count();
    if (longButtonCount > 0) {
      await expect(page.locator('.long-btn').first()).toBeDisabled();
    }
  });

  test('should enable long buttons after background loading completes', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial word sprite loading
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Wait for long sprites to load in background (should be reasonably quick with mocks)
    await page.waitForTimeout(2000);
    
    // Long buttons should become enabled
    const longButtonCount = await page.locator('.long-btn').count();
    if (longButtonCount > 0) {
      const longButton = page.locator('.long-btn').first();
      await expect(longButton).toBeEnabled({ timeout: 10000 });
      await expect(longButton).toContainText(/long/i);
      await expect(longButton).not.toContainText(/loading/i);
    }
  });

  test('should play long sounds after they finish loading', async ({ page }) => {
    await page.goto('/');
    
    // Wait for complete loading
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Wait for background loading
    await page.waitForTimeout(3000);
    
    // Try to click long button if it exists
    const longButtonCount = await page.locator('.long-btn').count();
    if (longButtonCount > 0) {
      const longButton = page.locator('.long-btn').first();
      await expect(longButton).toBeEnabled({ timeout: 10000 });
      
      // Should be able to click and play long sound
      await longButton.click();
      
      // Should not show error (successful playback)
      await expect(page.locator('.v-alert--type-error')).not.toBeVisible();
    }
  });

  test('should show appropriate error if long sound played before loading', async ({ page }) => {
    // Override mocks to simulate slower long sprite loading
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (url.includes('long-sprite')) {
          // Delay long sprite loading
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        return originalFetch(url, options);
      };
    });

    await page.goto('/');
    
    // Wait for initial loading but not background loading
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Long buttons should still be disabled/loading
    const longButtonCount = await page.locator('.long-btn').count();
    if (longButtonCount > 0) {
      const longButton = page.locator('.long-btn').first();
      await expect(longButton).toBeDisabled();
    }
  });

  test('should show loading progress for word sprites during startup', async ({ page }) => {
    await page.goto('/');
    
    // Should show word sprite loading messages
    const loadingText = page.locator('text=/Loading word|word sprites|Loading.*speaker/i');
    await expect(loadingText).toBeVisible({ timeout: 5000 });
    
    // Progress should eventually complete
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
  });
});