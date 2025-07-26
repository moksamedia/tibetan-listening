/**
 * Enhanced Sound Loader with Sprite Support
 * 
 * This loader extends the original sound-loader.js to support both:
 * 1. New sprite-based audio system (preferred)
 * 2. Fallback to individual files (backward compatibility)
 */

import { SpriteAudioService, SpriteSoundFile, SpriteSoundVersionGroup, SpriteSoundGroup } from './sprite-audio-service.js';
import { getSoundGroups as getOriginalSoundGroups, contextPath, getSpeakerFromFilePath, replaceWylieInString } from './sound-loader.js';
import sounds from '../assets/sounds.json';

let spriteService = null;
let spriteAvailable = false;

/**
 * Initialize the sprite-based audio system
 */
export async function initializeSpriteAudio(audioContext) {
  try {
    console.log('🔄 Initializing sprite audio system...');
    spriteService = new SpriteAudioService(audioContext);
    spriteAvailable = await spriteService.initialize();
    
    if (spriteAvailable) {
      console.log('🎵 Sprite audio system enabled');
      console.log('📊 Available speakers:', spriteService.getAvailableSpeakers());
      return true;
    } else {
      console.log('📁 Using individual audio files (sprites not available)');
      return false;
    }
  } catch (error) {
    console.warn('Failed to initialize sprite audio:', error.message);
    console.log('📁 Falling back to individual audio files');
    return false;
  }
}

/**
 * Get sound groups with sprite support
 */
export async function getSoundGroups(audioContext) {
  // Always try to initialize sprites first
  await initializeSpriteAudio(audioContext);
  
  if (spriteAvailable && spriteService) {
    return await buildSpriteSoundGroups(audioContext);
  } else {
    // Fallback to original implementation
    return await getOriginalSoundGroups(audioContext);
  }
}

/**
 * Build sound groups using sprite system
 */
async function buildSpriteSoundGroups(audioContext) {
  console.log('🎵 Building sound groups with sprite support...');
  
  const processedJson = processWylie(sounds);
  const soundGroups = [];
  
  for (const sg of processedJson) {
    const soundGroup = new SpriteSoundGroup(sg.name, spriteService);
    
    // Add note if present
    if (sg.note) {
      soundGroup.note = sg.note;
    }
    
    // Process long files - these will still use individual files
    let longs = [];
    if (!Array.isArray(sg.long)) {
      longs.push(sg.long);
    } else {
      longs = sg.long;
    }
    
    // Long files remain as individual files for now
    soundGroup.long = longs.map(longFile => ({
      path: longFile,
      buffer: null,
      getBuffer: function() {
        if (!this.buffer) {
          throw new Error('Long file buffer not loaded: ' + this.path);
        }
        return this.buffer;
      },
      async loadBuffer(audioContext) {
        if (!this.buffer) {
          const fullPath = contextPath + this.path;
          const response = await fetch(fullPath);
          const arrayBuffer = await response.arrayBuffer();
          this.buffer = await audioContext.decodeAudioData(arrayBuffer);
        }
      }
    }));
    
    // Process version groups with sprite support
    await processVersionGroups(sg, soundGroup);
    
    soundGroups.push(soundGroup);
  }
  
  console.log(`✅ Built ${soundGroups.length} sound groups with sprite support`);
  return soundGroups;
}

/**
 * Process version groups for sprite-based loading
 */
async function processVersionGroups(sg, soundGroup) {
  // Handle applyPattern logic (auto-generate version groups)
  if (sg.applyPattern) {
    console.log('Applying pattern for', sg.name);
    let sounds = sg.name.includes(' vs ') ? sg.name.split(' vs ') : sg.name.split(' ');
    sounds = sounds.map(s => s.replace(/[^\u0f00-\u0fff]*/g, ''));
    sg.versionGroups = sg.versionGroups || [];
    
    sounds.forEach(soundName => {
      sg.applyPattern.forEach(pattern => {
        const speaker = pattern.speaker;
        const numFiles = pattern.num;
        const files = [];
        for (let c = 0; c < numFiles; c++) {
          files.push(`${speaker}/${soundName} ${c + 1}.mp3`);
        }
        sg.versionGroups.push({
          name: soundName,
          files: files,
        });
      });
    });
  }
  
  // Process each version group
  for (const vg of sg.versionGroups || []) {
    const versionGroup = new SpriteSoundVersionGroup(vg.name, spriteService);
    
    for (const filePath of vg.files) {
      const speaker = getSpeakerFromFilePath(filePath);
      const soundKey = extractSoundKeyFromFilePath(filePath);
      
      // Always create sprite-aware sound files, they'll determine at play time whether to use sprites
      let soundFile = new SpriteSoundFile({
        path: filePath,
        speaker: speaker,
        spriteService: spriteService, // Always pass the service, it will handle availability
        soundKey: soundKey,
        buffer: null
      });
      
      console.log(`📁 Created sprite-aware sound file for ${speaker}/${soundKey}`);
      
      versionGroup.addFile(soundFile);
    }
    
    soundGroup.soundVersions.push(versionGroup);
  }
}

/**
 * Extract sound key from file path for sprite lookup
 * Converts "speaker/filename.mp3" to "filename"
 */
function extractSoundKeyFromFilePath(filePath) {
  const fileName = filePath.split('/').pop(); // Get filename
  return fileName.replace(/\.(mp3|wav|m4a)$/i, ''); // Remove extension
}

/**
 * Process Wylie text in JSON (same as original)
 */
function processWylie(json) {
  let newJson = [...json]; // Create a copy
  
  newJson.forEach((soundGroup, index) => {
    newJson[index].name = replaceWylieInString(soundGroup.name);
    if (soundGroup.versionGroups) {
      soundGroup.versionGroups.forEach((vg, j) => {
        newJson[index].versionGroups[j].name = replaceWylieInString(vg.name);
        vg.files.forEach((file, k) => {
          newJson[index].versionGroups[j].files[k] = replaceWylieInString(file);
        });
      });
    }
  });
  
  return newJson;
}

/**
 * Get sprite service instance (for debugging/inspection)
 */
export function getSpriteService() {
  return spriteService;
}

/**
 * Check if sprites are being used
 */
export function isUsingSprites() {
  return spriteAvailable;
}

/**
 * Get sprite statistics
 */
export function getSpriteStats() {
  return spriteService ? spriteService.getStats() : null;
}