/**
 * Singleton Audio Manager
 * 
 * Centralizes audio context management and provides a single point of access
 * for all audio operations. Eliminates the need to pass audio context around.
 */

import { SpriteOnlyAudioService } from './sprite-only-audio-service.js';

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.audioService = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the audio manager with an audio context
   */
  async initialize(audioContext) {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize(audioContext);
    return this.initializationPromise;
  }

  async _doInitialize(audioContext) {
    if (this.initialized) {
      return this.audioService;
    }

    console.log('🎵 Initializing singleton audio manager...');
    
    this.audioContext = audioContext;
    this.audioService = new SpriteOnlyAudioService(audioContext);
    
    await this.audioService.initialize();
    this.initialized = true;
    
    console.log('✅ Audio manager initialized');
    return this.audioService;
  }

  /**
   * Get the audio service instance
   */
  getAudioService() {
    if (!this.initialized) {
      throw new Error('Audio manager not initialized. Call initialize() first.');
    }
    return this.audioService;
  }

  /**
   * Get the audio context
   */
  getAudioContext() {
    if (!this.initialized) {
      throw new Error('Audio manager not initialized. Call initialize() first.');
    }
    return this.audioContext;
  }

  /**
   * Check if audio manager is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get available speakers
   */
  getAvailableSpeakers() {
    return this.getAudioService().getAvailableSpeakers();
  }

  /**
   * Play a sound through the audio service
   */
  async playSound(speaker, soundKey, options = {}) {
    return this.getAudioService().playSound(speaker, soundKey, options);
  }

  /**
   * Preload sprites for multiple speakers with progress callback
   */
  async preloadSprites(speakers, onProgress = null) {
    return this.getAudioService().preloadSprites(speakers, onProgress);
  }

  /**
   * Check if a sound exists for a speaker
   */
  async hasSoundForSpeaker(speaker, soundKey) {
    return this.getAudioService().hasSoundForSpeaker(speaker, soundKey);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return this.getAudioService().getStats();
  }
}

// Export singleton instance
export const audioManager = new AudioManager();

// Export class for testing
export { AudioManager };