/**
 * Simplified Sprite-Only Sound Loader
 * 
 * Clean implementation that assumes sprites are always available.
 * Builds sound groups directly from sprites and JSON configuration.
 */

import { SoundVersionGroup, SoundGroup } from './sprite-only-audio-service.js';
import { audioManager } from './audio-manager.js';
import sounds from '../assets/sounds-processed.json' with { type: 'json' };

/**
 * Extract speaker name from file path
 */
function getSpeakerFromFilePath(path) {
  const match = path.match(/\/?(.*)\//)
  const [full, speaker] = match
  return speaker ? speaker : null
}

/**
 * Initialize and get sound groups
 */
export async function getSoundGroups(audioContext, onProgress = null) {
  console.log('🔄 Loading sound groups with sprite-only system...');
  
  // Initialize audio manager singleton
  await audioManager.initialize(audioContext);
  
  // Process JSON configuration (already processed by audit script)
  const soundGroups = [];
  const allSpeakers = new Set();
  
  // Report initial progress for sound group processing
  if (onProgress) {
    onProgress({
      phase: 'processing',
      message: 'Processing sound groups...',
      progress: 0
    });
  }
  
  for (const sgConfig of sounds) {
    const soundGroup = new SoundGroup(sgConfig.name);
    
    // Add note if present
    if (sgConfig.note) {
      soundGroup.note = sgConfig.note;
    }
    
    // Process long files
    await processLongFiles(sgConfig, soundGroup);
    
    // Process version groups (already expanded)
    await processVersionGroups(sgConfig, soundGroup);
    
    // Collect all speakers used in this sound group
    soundGroup.getAllSpeakers().forEach(speaker => allSpeakers.add(speaker));
    
    soundGroups.push(soundGroup);
  }
  
  // Report completion of sound group processing
  if (onProgress) {
    onProgress({
      phase: 'preloading',
      message: 'Starting sprite preloading...',
      progress: 0
    });
  }
  
  // Preload word sprites at startup for fast loading (long sprites load in background)
  console.log('🚀 Preloading word sprites for fast startup...');
  await audioManager.preloadSprites([...allSpeakers], (spriteProgress) => {
    if (onProgress) {
      onProgress({
        phase: 'preloading',
        message: spriteProgress.currentSpeaker 
          ? `Loading word sounds for ${spriteProgress.currentSpeaker}...`
          : 'Loading word sprites...',
        progress: spriteProgress.progress,
        loaded: spriteProgress.loaded,
        total: spriteProgress.total,
        failed: spriteProgress.failed,
        currentSpeaker: spriteProgress.currentSpeaker,
        spritePhase: spriteProgress.phase
      });
    }
  });
  
  console.log(`✅ Loaded ${soundGroups.length} sound groups with word sprites preloaded (long sprites loading in background)`);
  return soundGroups;
}

/**
 * Process long comparison files
 */
async function processLongFiles(sgConfig, soundGroup) {
  if (!sgConfig.longSounds || sgConfig.longSounds.length === 0) {
    // Fallback for old format during transition
    if (sgConfig.long) {
      const longFiles = Array.isArray(sgConfig.long) ? sgConfig.long : [sgConfig.long];
      
      for (const longFile of longFiles) {
        const speaker = getSpeakerFromFilePath(longFile);
        const soundKey = extractSoundKey(longFile);
        
        // Check if this sound exists in the sprite
        const hasSound = await audioManager.hasSoundForSpeaker(speaker, soundKey);
        if (hasSound) {
          soundGroup.addLongSound(speaker, soundKey);
          console.log(`📄 Added long sound: ${speaker}/${soundKey}`);
        } else {
          console.warn(`⚠️  Long sound not found in sprite: ${speaker}/${soundKey}`);
        }
      }
    }
    return;
  }
  
  // Process preprocessed long sounds
  for (const longSound of sgConfig.longSounds) {
    if (longSound.verified) {
      soundGroup.addLongSound(longSound.speaker, longSound.soundKey);
      console.log(`📄 Added long sound: ${longSound.speaker}/${longSound.soundKey}`);
    } else {
      console.warn(`⚠️  Long sound not verified: ${longSound.speaker}/${longSound.soundKey}`);
    }
  }
}

/**
 * Process version groups (already expanded by audit script)
 */
async function processVersionGroups(sgConfig, soundGroup) {
  // Process explicitly defined version groups (patterns already expanded)
  if (sgConfig.versionGroups) {
    for (const vgConfig of sgConfig.versionGroups) {
      const versionGroup = new SoundVersionGroup(vgConfig.name);
      
      // Handle both old format (files array) and new format (sounds array)
      if (vgConfig.sounds) {
        // New preprocessed format with {speaker, soundKey, verified} objects
        for (const soundData of vgConfig.sounds) {
          if (soundData.verified) {
            versionGroup.addSound(soundData.speaker, soundData.soundKey);
            console.log(`🎵 Added sound: ${soundData.speaker}/${soundData.soundKey} to ${versionGroup.name}`);
          } else {
            console.warn(`⚠️  Sound not verified: ${soundData.speaker}/${soundData.soundKey}`);
          }
        }
      } else if (vgConfig.files) {
        // Fallback for old format during transition
        for (const filePath of vgConfig.files) {
          const speaker = getSpeakerFromFilePath(filePath);
          const soundKey = extractSoundKey(filePath);
          
          // Check if sound exists in sprite
          const hasSound = await audioManager.hasSoundForSpeaker(speaker, soundKey);
          if (hasSound) {
            versionGroup.addSound(speaker, soundKey);
            console.log(`🎵 Added sound: ${speaker}/${soundKey} to ${versionGroup.name}`);
          } else {
            console.warn(`⚠️  Sound not found in sprite: ${speaker}/${soundKey}`);
          }
        }
      }
      
      if (versionGroup.sounds.length > 0) {
        soundGroup.addVersionGroup(versionGroup);
      }
    }
  }
}


/**
 * Extract sound key from file path
 */
function extractSoundKey(filePath) {
  const fileName = filePath.split('/').pop(); // Get filename
  return fileName.replace(/\.(mp3|wav|m4a)$/i, ''); // Remove extension
}


/**
 * Get the audio service instance
 */
export function getAudioService() {
  return audioManager.getAudioService();
}

/**
 * Get sprite statistics
 */
export function getSpriteStats() {
  return audioManager.isInitialized() ? audioManager.getStats() : null;
}