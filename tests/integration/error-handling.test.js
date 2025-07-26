import { test, expect } from '@playwright/test';
import { setupAudioMocks } from './helpers/audio-mock.js';

test.describe('Error Handling', () => {
  test('should handle audio context creation failure', async ({ page }) => {
    // Mock AudioContext failure
    await page.addInitScript(() => {
      window.AudioContext = class {
        constructor() {
          throw new Error('AudioContext creation failed');
        }
      };
    });

    await page.goto('/');
    
    // Should show error message or fallback state
    await expect(page.getByText(/error|failed|audio/i)).toBeVisible({ timeout: 15000 });
  });

  test('should handle network failures gracefully', async ({ page }) => {
    // Mock network failures
    await page.addInitScript(() => {
      window.fetch = () => Promise.reject(new Error('Network error'));
    });

    await page.goto('/');
    
    // Should show error state
    await expect(page.getByText(/error|failed|network/i)).toBeVisible({ timeout: 15000 });
  });

  test('should handle corrupted manifest files', async ({ page }) => {
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async (url) => {
        if (url.includes('manifest.json')) {
          return {
            ok: true,
            json: () => Promise.resolve({ invalid: 'data' }) // Corrupted manifest
          };
        }
        return originalFetch(url);
      };
    });

    await page.goto('/');
    
    // Should handle corrupted data gracefully
    await expect(page.getByText(/error|invalid|failed/i)).toBeVisible({ timeout: 15000 });
  });

  test('should handle missing sprite files', async ({ page }) => {
    await setupAudioMocks(page);
    
    // Override to simulate missing sprite files
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async (url) => {
        if (url.includes('.mp3')) {
          return { ok: false, status: 404 }; // Missing audio files
        }
        return originalFetch(url);
      };
    });

    await page.goto('/');
    
    // Should show error state for missing files
    await expect(page.getByText(/error|failed|missing/i)).toBeVisible({ timeout: 15000 });
  });

  test('should handle audio decode errors', async ({ page }) => {
    await page.addInitScript(() => {
      window.AudioContext = class {
        constructor() {
          this.destination = { connect: () => {} };
        }
        
        createBufferSource() {
          return {
            buffer: null,
            connect: () => {},
            start: () => {},
            stop: () => {}
          };
        }
        
        createGain() {
          return {
            gain: { value: 1 },
            connect: () => {}
          };
        }
        
        decodeAudioData() {
          return Promise.reject(new Error('Audio decode failed'));
        }
      };
    });

    await page.goto('/');
    
    // Should handle decode errors
    await expect(page.getByText(/error|decode|failed/i)).toBeVisible({ timeout: 15000 });
  });

  test('should show user-friendly error messages', async ({ page }) => {
    // Simulate various error conditions
    await page.addInitScript(() => {
      window.AudioContext = class {
        constructor() {
          throw new Error('Audio system not available');
        }
      };
    });

    await page.goto('/');
    
    // Error messages should be user-friendly, not technical
    const errorElement = page.getByText(/error|failed/i);
    await expect(errorElement).toBeVisible({ timeout: 15000 });
    
    // Should not show raw error stack traces to users
    await expect(page.getByText(/stack|trace|\.js:/)).not.toBeVisible();
  });

  test('should provide retry functionality for transient errors', async ({ page }) => {
    let failCount = 0;
    
    // Mock intermittent failures
    await page.addInitScript(() => {
      let attempts = 0;
      const originalFetch = window.fetch;
      window.fetch = async (url) => {
        attempts++;
        if (url.includes('manifest.json') && attempts <= 2) {
          throw new Error('Temporary network error');
        }
        return originalFetch(url);
      };
    });

    await page.goto('/');
    
    // Look for retry functionality
    const retryButton = page.getByRole('button', { name: /retry|reload/i });
    if (await retryButton.isVisible({ timeout: 10000 })) {
      await retryButton.click();
      
      // Should eventually succeed after retry
      await expect(page.locator('.v-card')).toBeVisible({ timeout: 15000 });
    }
  });

  test('should handle long sound playback errors gracefully', async ({ page }) => {
    await setupAudioMocks(page);
    await page.goto('/');
    
    // Wait for loading
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Mock playback failure for long sounds
    await page.addInitScript(() => {
      // Override the audio service to fail on long sound playback
      window.mockLongSoundFailure = true;
    });

    // Try to play long sound if available
    const longButtonCount = await page.locator('.long-btn').count();
    if (longButtonCount > 0) {
      // Wait for long sprites to be available
      await page.waitForTimeout(3000);
      
      const longButton = page.locator('.long-btn').first();
      if (await longButton.isEnabled()) {
        await longButton.click();
        
        // Should show error message but not crash
        await expect(page.getByText(/error.*long.*sound/i)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should maintain app functionality after non-critical errors', async ({ page }) => {
    await setupAudioMocks(page);
    await page.goto('/');
    
    // Wait for loading
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
    
    // Simulate non-critical error (e.g., one sprite fails to load)
    await page.evaluate(() => {
      console.error('Simulated non-critical error');
    });
    
    // App should continue to function
    const soundCard = page.locator('.v-card').first();
    const randomButton = soundCard.getByRole('button', { name: /random/i });
    
    await expect(randomButton).toBeEnabled();
    await randomButton.click();
    
    // Should still be able to play sounds
    await expect(soundCard.getByRole('button', { name: /again/i })).toBeVisible();
  });
});