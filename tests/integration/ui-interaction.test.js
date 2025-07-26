import { test, expect } from '@playwright/test';
import { setupAudioMocks } from './helpers/audio-mock.js';

test.describe('UI Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioMocks(page);
    await page.goto('/');
    
    // Wait for app to load
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
  });

  test('should display sound group cards', async ({ page }) => {
    // Should show at least one sound group card
    await expect(page.locator('.v-card')).toHaveCount({ min: 1 });
    
    // Cards should have titles
    await expect(page.locator('.group-title')).toHaveCount({ min: 1 });
  });

  test('should show and hide loading states appropriately', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Initially no loading state on buttons
    await expect(soundCard.getByRole('button', { name: /random/i })).not.toHaveAttribute('loading');
    
    // After clicking random, might show brief loading state
    await soundCard.getByRole('button', { name: /random/i }).click();
    
    // Should eventually show Again button (not loading)
    await expect(soundCard.getByRole('button', { name: /again/i })).not.toHaveAttribute('loading');
  });

  test('should handle favorite functionality', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Should have favorite icon
    const favoriteIcon = soundCard.locator('.favorite-icon');
    await expect(favoriteIcon).toBeVisible();
    
    // Click to favorite
    await favoriteIcon.click();
    
    // Icon should change state (color or icon type)
    // Note: This test might need adjustment based on exact implementation
    await expect(favoriteIcon).toHaveClass(/yellow|favorited/);
  });

  test('should show stop button during play', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Play random sound
    await soundCard.getByRole('button', { name: /random/i }).click();
    
    // Should show stop button
    const stopButton = soundCard.locator('[icon="mdi-stop"]');
    await expect(stopButton).toBeVisible();
    
    // Click stop button
    await stopButton.click();
    
    // Should return to initial state
    await expect(soundCard.getByRole('button', { name: /random/i })).toBeVisible();
  });

  test('should handle multiple sound groups independently', async ({ page }) => {
    const soundCards = page.locator('.v-card');
    const cardCount = await soundCards.count();
    
    if (cardCount > 1) {
      // Play sound in first card
      await soundCards.nth(0).getByRole('button', { name: /random/i }).click();
      
      // First card should show Again button
      await expect(soundCards.nth(0).getByRole('button', { name: /again/i })).toBeVisible();
      
      // Second card should still show Random button
      await expect(soundCards.nth(1).getByRole('button', { name: /random/i })).toBeVisible();
      
      // Play sound in second card
      await soundCards.nth(1).getByRole('button', { name: /random/i }).click();
      
      // Both cards should now show Again buttons
      await expect(soundCards.nth(0).getByRole('button', { name: /again/i })).toBeVisible();
      await expect(soundCards.nth(1).getByRole('button', { name: /again/i })).toBeVisible();
    }
  });

  test('should display sound group notes when present', async ({ page }) => {
    // Look for sound groups that have notes
    const noteText = page.locator('.v-card .v-card-text .v-row').filter({ hasText: /note|description/i });
    
    // If notes exist, they should be visible
    if (await noteText.count() > 0) {
      await expect(noteText.first()).toBeVisible();
    }
  });

  test('should be responsive on mobile viewports', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Sound cards should still be visible and functional
    await expect(page.locator('.v-card')).toBeVisible();
    
    // Buttons should be appropriately sized for mobile
    const randomButton = page.locator('.v-card').first().getByRole('button', { name: /random/i });
    await expect(randomButton).toBeVisible();
    
    // Should be able to interact on mobile
    await randomButton.click();
    await expect(page.locator('.answer-btn-group .v-btn')).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Focus first random button
    const randomButton = page.locator('.v-card').first().getByRole('button', { name: /random/i });
    await randomButton.focus();
    
    // Should be able to activate with Enter key
    await page.keyboard.press('Enter');
    
    // Should show answer buttons
    await expect(page.locator('.answer-btn-group .v-btn')).toBeVisible();
    
    // Should be able to tab to answer buttons
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});