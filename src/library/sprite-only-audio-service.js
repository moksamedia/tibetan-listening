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
    this.sprites = new Map(); // speaker -> { buffer, manifest }
    this.masterManifest = null;
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
   * Load sprite for speaker if not already loaded
   */
  async loadSprite(speaker) {
    if (this.sprites.has(speaker)) {
      return this.sprites.get(speaker);
    }

    const spriteInfo = this.masterManifest.sprites[speaker];
    if (!spriteInfo) {
      throw new Error(`No sprite available for speaker: ${speaker}`);
    }

    console.log(`🔄 Loading sprite for ${speaker}...`);

    // Load audio and manifest in parallel
    const [audioResponse, manifestResponse] = await Promise.all([
      fetch(`${SPRITE_BASE_PATH}${spriteInfo.audioFile}`),
      fetch(`${SPRITE_BASE_PATH}${spriteInfo.manifestFile}`)
    ]);

    if (!audioResponse.ok || !manifestResponse.ok) {
      throw new Error(`Failed to load sprite files for ${speaker}`);
    }

    const [arrayBuffer, manifest] = await Promise.all([
      audioResponse.arrayBuffer(),
      manifestResponse.json()
    ]);

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    const spriteData = {
      buffer: audioBuffer,
      manifest: manifest
    };

    this.sprites.set(speaker, spriteData);
    console.log(`✅ Loaded sprite for ${speaker}: ${manifest.totalFiles} sounds`);
    
    return spriteData;
  }

  /**
   * Play a sound from a speaker's sprite
   */
  async playSound(speaker, soundKey, options = {}) {
    const spriteData = await this.loadSprite(speaker);
    const spriteInfo = spriteData.manifest.spritemap[soundKey];
    
    if (!spriteInfo) {
      throw new Error(`Sound "${soundKey}" not found in ${speaker} sprite`);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = spriteData.buffer;
    
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
   * Preload sprites for multiple speakers
   */
  async preloadSprites(speakers) {
    const loadPromises = speakers.map(speaker => 
      this.loadSprite(speaker).catch(error => 
        console.warn(`Failed to preload ${speaker}:`, error.message)
      )
    );
    await Promise.all(loadPromises);
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
  constructor(name, audioService) {
    this.name = name;
    this.audioService = audioService;
    this.sounds = []; // Array of {speaker, soundKey} objects
    this.isCorrect = null; // For UI state
    this.nextIndex = 0; // For rotation
    this.speakerIndices = {}; // For per-speaker rotation
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
    return await this.audioService.playSound(speaker, soundKey, options);
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
  constructor(name, audioService) {
    this.name = name;
    this.audioService = audioService;
    this.versionGroups = [];
    this.longSounds = []; // Array of {speaker, soundKey} objects
    this.currentVersionGroup = null; // For random game
    this.isPlaying = false;
    this.note = null;
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
    return await this.audioService.playSound(speaker, soundKey, options);
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
   */
  async preloadSprites() {
    const speakers = this.getAllSpeakers();
    await this.audioService.preloadSprites(speakers);
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