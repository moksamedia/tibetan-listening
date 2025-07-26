/**
 * Simplified Sprite-Only Audio Service
 * 
 * Assumes sprites are always available and removes all individual file fallback complexity.
 * Maintains all speaker/version functionality with a much cleaner API.
 */

const SPRITE_BASE_PATH = process.env.NODE_ENV === 'production' ? '/utils/assets/sounds/' : '/assets/sounds/';

export class SpriteOnlyAudioService {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.sprites = new Map(); // speaker -> { word, long, manifest }
    this.masterManifest = null;
    this.longSpritesLoaded = new Map(); // speaker -> boolean
    this.longSpritesLoading = new Map(); // speaker -> Promise
    this.backgroundLoadingStarted = false;
  }

  /**
   * Initialize by loading master manifest
   */
  async initialize() {
    const response = await fetch(`${SPRITE_BASE_PATH}manifest.json`);
    if (!response.ok) {
      throw new Error('Failed to load sprite manifest');
    }
    
    this.masterManifest = await response.json();
    console.log('🎵 Sprite audio service initialized with speakers:', this.getAvailableSpeakers());
    return true;
  }

  /**
   * Get available speakers
   */
  getAvailableSpeakers() {
    return Object.keys(this.masterManifest?.sprites || {});
  }

  /**
   * Load word sprite for speaker (for startup)
   */
  async loadWordSprite(speaker) {
    if (this.sprites.has(speaker)) {
      return this.sprites.get(speaker);
    }

    const spriteInfo = this.masterManifest.sprites[speaker];
    if (!spriteInfo) {
      throw new Error(`No sprite available for speaker: ${speaker}`);
    }

    console.log(`🔄 Loading word sprite for ${speaker}...`);

    // Check if we have separate word/long sprites or single sprite
    const hasSeparateSprites = this.masterManifest.separateWordAndLongSprites && spriteInfo.word;
    
    if (hasSeparateSprites) {
      // Load only word sprite for fast startup
      console.log(`📝 Loading word sprite for ${speaker}`);
      
      const wordSprite = await this.loadSingleSprite(speaker, spriteInfo.word, 'word');
      
      // Create combined structure with only word sprite loaded
      const combinedManifest = {
        speaker: speaker,
        totalFiles: spriteInfo.word.totalFiles, // Only word sounds initially
        totalDuration: spriteInfo.word.totalDuration,
        spritemap: { ...wordSprite.manifest.spritemap }
      };
      
      const combinedSprites = {
        word: wordSprite,
        long: null, // Will be loaded in background
        manifest: combinedManifest,
        hasLongSprite: !!spriteInfo.long
      };
      
      this.sprites.set(speaker, combinedSprites);
      this.longSpritesLoaded.set(speaker, false);
      
      console.log(`✅ Loaded word sprite for ${speaker}: ${wordSprite.manifest.totalFiles} sounds`);
      
      return combinedSprites;
    } else {
      // Load single sprite (backwards compatibility)
      const spriteData = await this.loadSingleSprite(speaker, spriteInfo, 'single');
      this.sprites.set(speaker, spriteData);
      this.longSpritesLoaded.set(speaker, true); // No separate long sprite
      console.log(`✅ Loaded sprite for ${speaker}: ${spriteData.manifest.totalFiles} sounds`);
      return spriteData;
    }
  }

  /**
   * Load long sprite for speaker in background
   */
  async loadLongSprite(speaker) {
    const spriteData = this.sprites.get(speaker);
    if (!spriteData || !spriteData.hasLongSprite || spriteData.long) {
      return; // Already loaded or no long sprite exists
    }

    // Check if already loading
    if (this.longSpritesLoading.has(speaker)) {
      return this.longSpritesLoading.get(speaker);
    }

    const spriteInfo = this.masterManifest.sprites[speaker];
    if (!spriteInfo.long) {
      return;
    }

    console.log(`🔄 Loading long sprite for ${speaker} in background...`);

    const loadPromise = this.loadSingleSprite(speaker, spriteInfo.long, 'long')
      .then(longSprite => {
        // Add long sprite to existing data
        spriteData.long = longSprite;
        
        // Merge long sounds into combined manifest
        const longSounds = Object.keys(longSprite.manifest.spritemap);
        Object.assign(spriteData.manifest.spritemap, longSprite.manifest.spritemap);
        
        // Update totals
        spriteData.manifest.totalFiles = spriteInfo.totalFiles;
        spriteData.manifest.totalDuration = spriteInfo.totalDuration;
        
        this.longSpritesLoaded.set(speaker, true);
        this.longSpritesLoading.delete(speaker);
        
        console.log(`✅ Loaded long sprite for ${speaker}: ${longSounds.length} long sounds`);
        
        return spriteData;
      })
      .catch(error => {
        console.error(`❌ Failed to load long sprite for ${speaker}:`, error);
        this.longSpritesLoading.delete(speaker);
        throw error;
      });

    this.longSpritesLoading.set(speaker, loadPromise);
    return loadPromise;
  }

  /**
   * Check if long sprites are loaded for a speaker
   */
  areLongSpritesLoaded(speaker) {
    return this.longSpritesLoaded.get(speaker) || false;
  }

  /**
   * Start background loading of all long sprites
   */
  async startBackgroundLongSpriteLoading() {
    if (this.backgroundLoadingStarted) {
      return;
    }
    
    this.backgroundLoadingStarted = true;
    console.log('🎭 Starting background loading of long sprites...');
    
    const speakers = this.getAvailableSpeakers();
    const loadPromises = speakers.map(speaker => 
      this.loadLongSprite(speaker).catch(error => 
        console.warn(`Failed to load long sprite for ${speaker}:`, error)
      )
    );
    
    await Promise.all(loadPromises);
    console.log('✅ Background loading of long sprites completed');
  }
  
  /**
   * Load a single sprite file and manifest
   */
  async loadSingleSprite(speaker, spriteInfo, type) {
    const audioUrl = `${SPRITE_BASE_PATH}${spriteInfo.audioFile}`;
    const manifestUrl = `${SPRITE_BASE_PATH}${spriteInfo.manifestFile}`;
    
    console.log(`🔍 Loading ${type} sprite for ${speaker}: ${manifestUrl}`);
    
    const [audioResponse, manifestResponse] = await Promise.all([
      fetch(audioUrl),
      fetch(manifestUrl)
    ]);

    if (!audioResponse.ok || !manifestResponse.ok) {
      console.error(`Failed to fetch ${type} sprite files for ${speaker}:`);
      console.error(`Audio (${audioResponse.status}): ${audioUrl}`);
      console.error(`Manifest (${manifestResponse.status}): ${manifestUrl}`);
      throw new Error(`Failed to load ${type} sprite files for ${speaker}`);
    }

    const [arrayBuffer, manifestText] = await Promise.all([
      audioResponse.arrayBuffer(),
      manifestResponse.text()
    ]);
    
    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch (error) {
      console.error(`Failed to parse ${type} sprite manifest for ${speaker}:`, error);
      console.error('Manifest text:', manifestText.substring(0, 200));
      throw new Error(`Invalid JSON in ${type} sprite manifest for ${speaker}`);
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    return {
      buffer: audioBuffer,
      manifest: manifest,
      type: type
    };
  }

  /**
   * Play a sound from a speaker's sprite
   */
  async playSound(speaker, soundKey, options = {}) {
    const spriteData = this.sprites.get(speaker);
    if (!spriteData) {
      throw new Error(`No sprite data loaded for speaker: ${speaker}`);
    }

    // Check if sound is in currently loaded sprites
    const spriteInfo = spriteData.manifest.spritemap[soundKey];
    if (!spriteInfo) {
      // If we have separate sprites and this might be a long sound, try loading it
      if (spriteData.hasLongSprite && !spriteData.long) {
        throw new Error(`Sound "${soundKey}" not available yet - long sprites still loading`);
      }
      throw new Error(`Sound "${soundKey}" not found in ${speaker} sprite`);
    }

    // Determine which buffer to use for separate sprites
    let audioBuffer = spriteData.buffer;
    
    if (spriteData.word) {
      // Check which sprite contains this sound
      const inWordSprite = spriteData.word.manifest.spritemap[soundKey];
      const inLongSprite = spriteData.long && spriteData.long.manifest.spritemap[soundKey];
      
      if (inWordSprite) {
        audioBuffer = spriteData.word.buffer;
      } else if (inLongSprite) {
        audioBuffer = spriteData.long.buffer;
      } else if (spriteData.hasLongSprite && !spriteData.long) {
        throw new Error(`Sound "${soundKey}" not available yet - long sprites still loading`);
      } else {
        throw new Error(`Sound "${soundKey}" not found in either word or long sprite for ${speaker}`);
      }
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Apply volume if specified
    let outputNode = this.audioContext.destination;
    if (options.volume !== undefined) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = options.volume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      outputNode = gainNode;
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
  }

  /**
   * Get all sounds available for a speaker
   */
  async getSoundsForSpeaker(speaker) {
    const spriteData = await this.loadSprite(speaker);
    return Object.keys(spriteData.manifest.spritemap);
  }

  /**
   * Check if a sound exists for a speaker
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
   * Preload word sprites for multiple speakers with progress tracking (fast startup)
   */
  async preloadWordSprites(speakers, onProgress = null) {
    if (!Array.isArray(speakers) || speakers.length === 0) {
      return;
    }

    const totalSpeakers = speakers.length;
    let loadedCount = 0;
    let failedCount = 0;

    // Report initial progress
    if (onProgress) {
      onProgress({
        loaded: 0,
        total: totalSpeakers,
        failed: 0,
        progress: 0,
        currentSpeaker: null,
        phase: 'starting'
      });
    }

    const loadPromises = speakers.map(async (speaker) => {
      try {
        if (onProgress) {
          onProgress({
            loaded: loadedCount,
            total: totalSpeakers,
            failed: failedCount,
            progress: (loadedCount / totalSpeakers) * 100,
            currentSpeaker: speaker,
            phase: 'loading'
          });
        }

        await this.loadWordSprite(speaker);
        loadedCount++;

        if (onProgress) {
          onProgress({
            loaded: loadedCount,
            total: totalSpeakers,
            failed: failedCount,
            progress: (loadedCount / totalSpeakers) * 100,
            currentSpeaker: speaker,
            phase: 'loaded'
          });
        }
      } catch (error) {
        console.warn(`Failed to preload word sprite ${speaker}:`, error.message);
        failedCount++;
        
        if (onProgress) {
          onProgress({
            loaded: loadedCount,
            total: totalSpeakers,
            failed: failedCount,
            progress: ((loadedCount + failedCount) / totalSpeakers) * 100,
            currentSpeaker: speaker,
            phase: 'failed',
            error: error.message
          });
        }
      }
    });

    await Promise.all(loadPromises);

    // Report completion
    if (onProgress) {
      onProgress({
        loaded: loadedCount,
        total: totalSpeakers,
        failed: failedCount,
        progress: 100,
        currentSpeaker: null,
        phase: 'completed'
      });
    }

    console.log(`🎵 Word sprite preloading completed: ${loadedCount}/${totalSpeakers} word sprites loaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
    
    // Start background loading of long sprites after word sprites are loaded
    setTimeout(() => {
      this.startBackgroundLongSpriteLoading();
    }, 100); // Small delay to let UI render
  }

  /**
   * Legacy method for backwards compatibility - now loads word sprites only
   */
  async preloadSprites(speakers, onProgress = null) {
    return this.preloadWordSprites(speakers, onProgress);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      totalSpeakers: this.getAvailableSpeakers().length,
      loadedSpeakers: this.sprites.size,
      sprites: Array.from(this.sprites.keys())
    };
  }
}

/**
 * Simplified Sound Classes for Sprite-Only System
 */

export class SoundVersionGroup {
  constructor(name, audioService = null) {
    this.name = name;
    this.audioService = audioService; // Will be set by audioManager if null
    this.sounds = []; // Array of {speaker, soundKey} objects
    this.isCorrect = null; // For UI state
    this.nextIndex = 0; // For rotation
    this.speakerIndices = {}; // For per-speaker rotation
  }

  /**
   * Get audio service, using singleton if not provided
   */
  async _getAudioService() {
    if (this.audioService) {
      return this.audioService;
    }
    
    // Import here to avoid circular dependency
    const { audioManager } = await import('./audio-manager.js');
    return audioManager.getAudioService();
  }

  /**
   * Add a sound variant to this group
   */
  addSound(speaker, soundKey) {
    this.sounds.push({ speaker, soundKey });
  }

  /**
   * Get all unique speakers in this version group
   */
  getSpeakers() {
    return [...new Set(this.sounds.map(sound => sound.speaker))];
  }

  /**
   * Play a specific sound by index
   */
  async playSound(index, options = {}) {
    if (index < 0 || index >= this.sounds.length) return null;
    const { speaker, soundKey } = this.sounds[index];
    const audioService = await this._getAudioService();
    return await audioService.playSound(speaker, soundKey, options);
  }

  /**
   * Get random sound and return play function
   */
  getRandom() {
    if (this.sounds.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.sounds.length);
    return {
      play: (options = {}) => this.playSound(randomIndex, options)
    };
  }

  /**
   * Get random sound from specific speaker
   */
  getRandomFromSpeaker(speaker) {
    const speakerIndices = this.sounds
      .map((sound, index) => sound.speaker === speaker ? index : -1)
      .filter(index => index !== -1);
    
    if (speakerIndices.length === 0) return null;
    
    const randomIndex = speakerIndices[Math.floor(Math.random() * speakerIndices.length)];
    return {
      play: (options = {}) => this.playSound(randomIndex, options)
    };
  }

  /**
   * Get next sound in rotation
   */
  getNext() {
    if (this.sounds.length === 0) return null;
    const index = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % this.sounds.length;
    return {
      play: (options = {}) => this.playSound(index, options)
    };
  }

  /**
   * Get next sound from specific speaker in rotation
   */
  getNextFromSpeaker(speaker) {
    const speakerIndices = this.sounds
      .map((sound, index) => sound.speaker === speaker ? index : -1)
      .filter(index => index !== -1);
    
    if (speakerIndices.length === 0) return null;
    
    // Initialize per-speaker rotation index
    if (this.speakerIndices[speaker] === undefined) {
      this.speakerIndices[speaker] = 0;
    }
    
    const speakerRotationIndex = this.speakerIndices[speaker];
    const actualIndex = speakerIndices[speakerRotationIndex];
    
    // Advance speaker rotation
    this.speakerIndices[speaker] = (speakerRotationIndex + 1) % speakerIndices.length;
    
    return {
      play: (options = {}) => this.playSound(actualIndex, options)
    };
  }

  /**
   * Reset UI state
   */
  resetState() {
    this.isCorrect = null;
  }
}

export class SoundGroup {
  constructor(name, audioService = null) {
    this.name = name;
    this.audioService = audioService; // Will be set by audioManager if null
    this.versionGroups = [];
    this.longSounds = []; // Array of {speaker, soundKey} objects
    this.currentVersionGroup = null; // For random game
    this.isPlaying = false;
    this.note = null;
  }

  /**
   * Get audio service, using singleton if not provided
   */
  async _getAudioService() {
    if (this.audioService) {
      return this.audioService;
    }
    
    // Import here to avoid circular dependency
    const { audioManager } = await import('./audio-manager.js');
    return audioManager.getAudioService();
  }

  /**
   * Add a version group to this sound group
   */
  addVersionGroup(versionGroup) {
    this.versionGroups.push(versionGroup);
  }

  /**
   * Add a long comparison sound
   */
  addLongSound(speaker, soundKey) {
    this.longSounds.push({ speaker, soundKey });
  }

  /**
   * Play a long sound by index
   */
  async playLongSound(index, options = {}) {
    if (index < 0 || index >= this.longSounds.length) return null;
    const { speaker, soundKey } = this.longSounds[index];
    const audioService = await this._getAudioService();
    
    // Check if long sprites are loaded for this speaker
    if (!audioService.areLongSpritesLoaded(speaker)) {
      throw new Error('Long sounds are still loading in background. Please wait...');
    }
    
    return await audioService.playSound(speaker, soundKey, options);
  }

  /**
   * Check if all long sounds are available for this sound group
   */
  async areLongSoundsAvailable() {
    if (this.longSounds.length === 0) {
      return true; // No long sounds to load
    }
    
    const audioService = await this._getAudioService();
    const speakers = [...new Set(this.longSounds.map(sound => sound.speaker))];
    
    return speakers.every(speaker => audioService.areLongSpritesLoaded(speaker));
  }

  /**
   * Get version group by name
   */
  getVersionGroup(name) {
    return this.versionGroups.find(vg => vg.name === name);
  }

  /**
   * Set random current version group for the game
   */
  setRandomCurrentVersionGroup() {
    if (this.versionGroups.length === 0) return;
    const randomIndex = Math.floor(Math.random() * this.versionGroups.length);
    this.currentVersionGroup = this.versionGroups[randomIndex];
  }

  /**
   * Reset all version group states
   */
  resetStates() {
    this.versionGroups.forEach(vg => vg.resetState());
    this.currentVersionGroup = null;
    this.isPlaying = false;
  }

  /**
   * Get display name for UI
   */
  getDisplayName() {
    return this.name || this.versionGroups.map(vg => vg.name).join(' vs ');
  }

  /**
   * Get all speakers used in this sound group
   */
  getAllSpeakers() {
    const speakers = new Set();
    this.versionGroups.forEach(vg => {
      vg.getSpeakers().forEach(speaker => speakers.add(speaker));
    });
    this.longSounds.forEach(sound => speakers.add(sound.speaker));
    return [...speakers];
  }

  /**
   * Preload all sprites needed for this sound group
   * NOTE: This method is now unused since we preload all sprites at app startup
   */
  async preloadSprites() {
    // No-op: sprites are preloaded at app startup
    console.log('Sprites already preloaded at startup for:', this.name);
  }

  /**
   * Favorite functionality
   */
  isFavorite() {
    return localStorage.getItem(`favorite-${this.name}`) === 'true';
  }

  toggleFavorite() {
    const newValue = this.isFavorite() ? 'false' : 'true';
    localStorage.setItem(`favorite-${this.name}`, newValue);
    return this.isFavorite();
  }
}