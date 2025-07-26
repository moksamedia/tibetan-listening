import { test, expect } from '@playwright/test';
import { setupAudioMocks } from './helpers/audio-mock.js';

test.describe('Audio Playback', () => {
  test.beforeEach(async ({ page }) => {
    await setupAudioMocks(page);
    await page.goto('/');
    
    // Wait for app to load
    await expect(page.locator('.v-progress-linear--active')).toBeHidden({ timeout: 30000 });
  });

  test('should play random sound when Random button is clicked', async ({ page }) => {
    // Find the first sound group card
    const soundCard = page.locator('.v-card').first();
    
    // Click the Random button
    const randomButton = soundCard.getByRole('button', { name: /random/i });
    await randomButton.click();
    
    // Button should change to "Again" after playing
    await expect(soundCard.getByRole('button', { name: /again/i })).toBeVisible({ timeout: 5000 });
    
    // Should show answer buttons
    await expect(soundCard.locator('.answer-btn-group .v-btn')).toBeVisible();
  });

  test('should show answer buttons after playing random sound', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Play random sound
    await soundCard.getByRole('button', { name: /random/i }).click();
    
    // Wait for answer buttons to appear
    await expect(soundCard.locator('.answer-btn-group .v-btn')).toHaveCount({ min: 1 }, { timeout: 5000 });
    
    // Answer buttons should be clickable
    const answerButton = soundCard.locator('.answer-btn-group .v-btn').first();
    await expect(answerButton).toBeEnabled();
  });

  test('should handle answer selection correctly', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Play random sound
    await soundCard.getByRole('button', { name: /random/i }).click();
    
    // Wait for answer buttons
    await expect(soundCard.locator('.answer-btn-group .v-btn')).toBeVisible();
    
    // Click an answer button
    const answerButton = soundCard.locator('.answer-btn-group .v-btn').first();
    await answerButton.click();
    
    // Should show feedback (correct/incorrect color or text)
    await expect(answerButton).toHaveClass(/success|error|correct|incorrect/);
  });

  test('should allow replaying with Again button', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Play random sound
    await soundCard.getByRole('button', { name: /random/i }).click();
    
    // Wait for Again button
    const againButton = soundCard.getByRole('button', { name: /again/i });
    await expect(againButton).toBeVisible();
    
    // Click Again button
    await againButton.click();
    
    // Should still show Again button (can replay multiple times)
    await expect(againButton).toBeVisible();
  });

  test('should reset game state when clicking random on new sound', async ({ page }) => {
    const soundCard = page.locator('.v-card').first();
    
    // Play and answer first sound
    await soundCard.getByRole('button', { name: /random/i }).click();
    await expect(soundCard.locator('.answer-btn-group .v-btn')).toBeVisible();
    
    const answerButton = soundCard.locator('.answer-btn-group .v-btn').first();
    await answerButton.click();
    
    // Play new random sound - this should reset the game state
    await soundCard.getByRole('button', { name: /random/i }).click();
    
    // Answer buttons should be reset (no success/error state)
    await expect(soundCard.locator('.answer-btn-group .v-btn').first()).not.toHaveClass(/success|error/);
  });
});