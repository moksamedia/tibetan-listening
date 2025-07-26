/**
 * Sprite-based Audio Service for Tibetan Listening App
 * 
 * Replaces individual file loading with optimized audio sprites
 * Features:
 * - Preloads sprite files on demand
 * - Plays audio segments from sprites using timing data
 * - Manages multiple speakers with separate sprites
 * - Caches loaded audio buffers
 * - Provides fallback to individual files if sprites not available
 */

import { SoundFile, SoundGroup, SoundVersionGroup } from './sound-classes.js';

const SPRITE_BASE_PATH = process.env.NODE_ENV === 'production' ? '/utils/assets/sounds/' : '/assets/sounds/';

export class SpriteAudioService {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.loadedSprites = new Map(); // speaker -> { buffer, manifest }
    this.loadingPromises = new Map(); // speaker -> Promise
    this.spriteManifest = null;
  }

  /**
   * Initialize the service by loading the master manifest
   */
  async initialize() {
    try {
      const manifestPath = `${SPRITE_BASE_PATH}manifest.json`;
      const response = await fetch(manifestPath);
      
      if (!response.ok) {
        console.warn('No sprite manifest found, falling back to individual files');
        return false;
      }
      
      this.spriteManifest = await response.json();
      console.log('🎵 Sprite audio service initialized with', Object.keys(this.spriteManifest.sprites || {}).length, 'speakers');
      return true;
    } catch (error) {
      console.warn('Failed to load sprite manifest:', error.message);
      return false;
    }
  }

  /**
   * Check if sprites are available
   */
  isAvailable() {
    return this.spriteManifest !== null;
  }

  /**
   * Get list of available speakers with sprites
   */
  getAvailableSpeakers() {
    if (!this.spriteManifest) return [];
    return Object.keys(this.spriteManifest.sprites || {});
  }

  /**
   * Load sprite for a specific speaker
   */
  async loadSpriteForSpeaker(speaker) {
    if (!this.spriteManifest || !this.spriteManifest.sprites[speaker]) {
      throw new Error(`No sprite available for speaker: ${speaker}`);
    }

    // Return existing sprite if already loaded
    if (this.loadedSprites.has(speaker)) {
      return this.loadedSprites.get(speaker);
    }

    // Return existing loading promise if currently loading
    if (this.loadingPromises.has(speaker)) {
      return await this.loadingPromises.get(speaker);
    }

    // Start loading
    const loadingPromise = this._loadSpriteData(speaker);
    this.loadingPromises.set(speaker, loadingPromise);

    try {
      const spriteData = await loadingPromise;
      this.loadedSprites.set(speaker, spriteData);
      this.loadingPromises.delete(speaker);
      return spriteData;
    } catch (error) {
      this.loadingPromises.delete(speaker);
      throw error;
    }
  }

  /**
   * Internal method to load sprite audio and manifest data
   */
  async _loadSpriteData(speaker) {
    const spriteInfo = this.spriteManifest.sprites[speaker];
    const audioPath = `${SPRITE_BASE_PATH}${spriteInfo.audioFile}`;
    const manifestPath = `${SPRITE_BASE_PATH}${spriteInfo.manifestFile}`;

    console.log(`🔄 Loading sprite for ${speaker}...`);

    // Load both audio file and manifest in parallel
    const [audioResponse, manifestResponse] = await Promise.all([
      fetch(audioPath),
      fetch(manifestPath)
    ]);

    if (!audioResponse.ok) {
      throw new Error(`Failed to load audio sprite: ${audioPath}`);
    }
    if (!manifestResponse.ok) {
      throw new Error(`Failed to load sprite manifest: ${manifestPath}`);
    }

    // Decode audio data
    const arrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Parse manifest
    const manifest = await manifestResponse.json();

    console.log(`✅ Loaded sprite for ${speaker}: ${manifest.totalFiles} sounds, ${(manifest.totalDuration / 1000).toFixed(1)}s`);

    return {
      buffer: audioBuffer,
      manifest: manifest,
      speaker: speaker
    };
  }

  /**
   * Play a specific sound from a sprite
   */
  async playSound(speaker, soundKey, options = {}) {
    try {
      // Load sprite if not already loaded
      const spriteData = await this.loadSpriteForSpeaker(speaker);
      
      // Get timing information for the sound
      const spriteInfo = spriteData.manifest.spritemap[soundKey];
      if (!spriteInfo) {
        throw new Error(`Sound "${soundKey}" not found in ${speaker} sprite`);
      }

      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = spriteData.buffer;
      
      // Apply options
      if (options.volume !== undefined) {
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = options.volume;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
      } else {
        source.connect(this.audioContext.destination);
      }

      // Set up end callback
      if (options.onEnded) {
        source.onended = options.onEnded;
      }

      // Play the specific segment
      const startTime = spriteInfo.start / 1000; // Convert ms to seconds
      const duration = spriteInfo.length / 1000; // Convert ms to seconds
      
      source.start(0, startTime, duration);
      
      return source;
    } catch (error) {
      console.error(`Failed to play sound ${soundKey} from ${speaker} sprite:`, error);
      throw error;
    }
  }

  /**
   * Get all available sounds for a speaker
   */
  async getSoundsForSpeaker(speaker) {
    try {
      const spriteData = await this.loadSpriteForSpeaker(speaker);
      return Object.keys(spriteData.manifest.spritemap);
    } catch (error) {
      console.warn(`Failed to get sounds for ${speaker}:`, error.message);
      return [];
    }
  }

  /**
   * Check if a specific sound is available in a speaker's sprite
   */
  async hasSoundForSpeaker(speaker, soundKey) {
    try {
      const sounds = await this.getSoundsForSpeaker(speaker);
      return sounds.includes(soundKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * Preload sprites for specified speakers
   */
  async preloadSprites(speakers) {
    if (!this.isAvailable()) {
      console.warn('Sprite service not available, cannot preload');
      return;
    }

    console.log('🔄 Preloading sprites for:', speakers.join(', '));
    
    const loadPromises = speakers
      .filter(speaker => this.spriteManifest.sprites[speaker])
      .map(speaker => this.loadSpriteForSpeaker(speaker).catch(error => {
        console.warn(`Failed to preload sprite for ${speaker}:`, error.message);
      }));

    await Promise.all(loadPromises);
    console.log('✅ Sprite preloading complete');
  }

  /**
   * Get sprite statistics
   */
  getStats() {
    return {
      available: this.isAvailable(),
      totalSpeakers: this.spriteManifest ? Object.keys(this.spriteManifest.sprites || {}).length : 0,
      loadedSpeakers: this.loadedSprites.size,
      loadingSpeakers: this.loadingPromises.size
    };
  }

  /**
   * Clear loaded sprites to free memory
   */
  clearCache() {
    this.loadedSprites.clear();
    this.loadingPromises.clear();
    console.log('🧹 Sprite cache cleared');
  }
}

/**
 * Enhanced Sound Classes that work with sprites
 */

export class SpriteSoundFile extends SoundFile {
  constructor(params) {
    super(params);
    this.spriteService = params.spriteService;
    this.soundKey = params.soundKey; // Key for this sound in the sprite
  }

  async play(options = {}) {
    // First try to use sprite
    if (this.spriteService && this.spriteService.isAvailable()) {
      try {
        const hasSound = await this.spriteService.hasSoundForSpeaker(this.speaker, this.soundKey);
        if (hasSound) {
          return await this.spriteService.playSound(this.speaker, this.soundKey, options);
        }
      } catch (error) {
        console.warn(`Failed to play from sprite for ${this.speaker}/${this.soundKey}:`, error.message);
      }
    }
    
    // Fallback to individual buffer loading and playback
    const audioContext = options.audioContext;
    if (!audioContext) {
      throw new Error('AudioContext required for fallback playback');
    }
    
    // Load buffer if not already loaded
    if (!this.buffer) {
      const contextPath = process.env.NODE_ENV === 'production' ? '/utils/sounds/' : '/sounds/';
      const fullPath = contextPath + this.path;
      try {
        console.log(`Loading individual file: ${fullPath}`);
        const response = await fetch(fullPath);
        const arrayBuffer = await response.arrayBuffer();
        this.buffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (error) {
        throw new Error(`Failed to load individual audio file ${fullPath}: ${error.message}`);
      }
    }
    
    // Play from buffer
    const source = audioContext.createBufferSource();
    source.buffer = this.buffer;
    source.connect(audioContext.destination);
    
    if (options.onEnded) {
      source.onended = options.onEnded;
    }
    
    source.start(0);
    return source;
  }
}

export class SpriteSoundVersionGroup extends SoundVersionGroup {
  constructor(name, spriteService) {
    super(name);
    this.spriteService = spriteService;
  }

  async loadBuffers(audioContext) {
    // If using sprites, we don't need to load individual buffers
    if (this.spriteService && this.spriteService.isAvailable()) {
      console.log(`Using sprite for ${this.name}, no individual buffers needed`);
      return;
    }
    
    // Fallback to individual buffer loading for non-sprite files
    console.log(`Loading individual buffers for ${this.name}`);
    await Promise.all(
      this.files.map(async (file, index) => {
        if (this.files[index].buffer == null) {
          const contextPath = process.env.NODE_ENV === 'production' ? '/utils/sounds/' : '/sounds/';
          const fullPath = contextPath + file.path;
          try {
            const response = await fetch(fullPath);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = await audioContext.decodeAudioData(arrayBuffer);
            this.files[index].buffer = buffer;
            console.log(`Loaded buffer for ${file.path}`);
          } catch (error) {
            console.error(`Failed to load buffer for ${file.path}:`, error);
            throw error;
          }
        }
      })
    );
    console.log('Individual buffers loaded');
  }

  async playRandomFromSpeaker(speaker, options = {}) {
    if (this.spriteService && this.spriteService.isAvailable()) {
      // Get all sounds for this version group from the specified speaker
      const speakerFiles = this.files.filter(file => file.speaker === speaker);
      if (speakerFiles.length === 0) {
        throw new Error(`No files found for speaker ${speaker} in ${this.name}`);
      }
      
      // Pick random file
      const randomFile = speakerFiles[Math.floor(Math.random() * speakerFiles.length)];
      return await randomFile.play(options);
    } else {
      // Fallback to original method
      const randomFile = this.getRandom();
      return randomFile.play(options);
    }
  }
}

export class SpriteSoundGroup extends SoundGroup {
  constructor(name, spriteService) {
    super(name);
    this.spriteService = spriteService;
  }

  needToLoadBuffers() {
    // If using sprites, we don't need individual buffers
    if (this.spriteService && this.spriteService.isAvailable()) {
      return false;
    }
    return super.needToLoadBuffers();
  }

  async loadBuffers(audioContext) {
    if (this.spriteService && this.spriteService.isAvailable()) {
      // Preload sprites for all speakers used in this sound group
      const speakers = new Set();
      this.soundVersions.forEach(sv => {
        sv.files.forEach(file => {
          if (file.speaker) speakers.add(file.speaker);
        });
      });
      
      await this.spriteService.preloadSprites([...speakers]);
      return;
    }
    
    // Fallback to individual buffer loading
    const soundVersionPromises = this.soundVersions.map(async (soundVersionGroup) => {
      await soundVersionGroup.loadBuffers(audioContext);
    });
    
    const longSoundPromises = this.long.map(async (longSoundFile) => {
      if (longSoundFile.loadBuffer) {
        await longSoundFile.loadBuffer(audioContext);
      }
    });
    
    await Promise.all([...soundVersionPromises, ...longSoundPromises]);
  }
}