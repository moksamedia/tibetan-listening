#!/usr/bin/env node

/**
 * Audio Files Audit Script
 * 
 * This script:
 * 1. Verifies that all sound files referenced in sounds.json actually exist
 * 2. Expands "applyPattern" entries into explicit versionGroups
 * 3. Processes Wylie text replacements at build time
 * 4. Outputs a clean, declarative sounds.json for runtime use
 * 
 * Usage:
 *   node scripts/audit-sounds.js [--fix] [--output path] [--verbose]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import jsEWTS from '../src/library/jsewts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOUNDS_JSON_PATH = path.join(__dirname, '../src/assets/sounds.json');
const SOUNDS_DIR = path.join(__dirname, '../audio-source/sounds');
const OUTPUT_PATH = path.join(__dirname, '../src/assets/sounds-processed.json');

// Command line arguments
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const FIX_MODE = args.includes('--fix') || args.includes('-f');
const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
const CUSTOM_OUTPUT = outputIndex !== -1 ? args[outputIndex + 1] : null;

// Statistics
let stats = {
  totalGroups: 0,
  totalFiles: 0,
  missingFiles: 0,
  patternsExpanded: 0,
  wylieReplacements: 0,
  errors: []
};

/**
 * Log messages with optional verbose mode
 */
function log(message, force = false) {
  if (VERBOSE || force) {
    console.log(message);
  }
}

function error(message) {
  console.error(`❌ ${message}`);
  stats.errors.push(message);
}

function warn(message) {
  console.warn(`⚠️  ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

/**
 * Wylie text replacement using jsEWTS (same as original sound-loader.js)
 */
function replaceWylieInString(string) {
  if (!string) return string;
  
  log('replaceWylieInString:' + string);
  const match = string.match(/({([^{]*)})/)
  if (match) {
    const [full, withBrackets, wylie] = match;
    log(match);
    const unicode = jsEWTS.fromWylie(wylie);
    const newString = string.replace(full, unicode);
    log('replaceWylieInString: ' + newString);
    return replaceWylieInString(newString); // recursive for multiple replacements
  } else {
    return string;
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}


/**
 * Expand applyPattern into explicit version groups
 */
function expandApplyPattern(soundGroup) {
  if (!soundGroup.applyPattern) {
    return soundGroup;
  }

  log(`🔄 Expanding pattern for: ${soundGroup.name}`);
  
  // Extract sound names from the group name
  let soundNames = soundGroup.name.includes(' vs ') 
    ? soundGroup.name.split(' vs ') 
    : soundGroup.name.split(' ');
    
  // Clean up sound names (remove non-Tibetan characters like "(noun)")
  soundNames = soundNames.map(s => s.replace(/\s*\([^)]*\)\s*/g, '').trim());
  soundNames = soundNames.map(s => s.replace(/[^\u0f00-\u0fff\s]*/g, '').trim());
  soundNames = soundNames.filter(s => s.length > 0);
  
  log(`  Sound names: ${soundNames.join(', ')}`);
  
  // Initialize or extend existing version groups
  if (!soundGroup.versionGroups) {
    soundGroup.versionGroups = [];
  }
  
  // Create version groups for each sound name
  for (const soundName of soundNames) {
    // Check if version group already exists
    let versionGroup = soundGroup.versionGroups.find(vg => vg.name === soundName);
    if (!versionGroup) {
      versionGroup = {
        name: soundName,
        files: []
      };
      soundGroup.versionGroups.push(versionGroup);
    }
    
    // Apply each pattern
    for (const pattern of soundGroup.applyPattern) {
      const speaker = pattern.speaker;
      const numFiles = pattern.num;
      
      log(`  Applying pattern: ${speaker}, ${numFiles} files for "${soundName}"`);
      
      // Generate file paths for this pattern
      for (let i = 1; i <= numFiles; i++) {
        const filePath = `${speaker}/${soundName} ${i}.mp3`;
        if (!versionGroup.files.includes(filePath)) {
          versionGroup.files.push(filePath);
          log(`    Added: ${filePath}`);
        }
      }
    }
  }
  
  // Remove the applyPattern property
  delete soundGroup.applyPattern;
  stats.patternsExpanded++;
  
  return soundGroup;
}

/**
 * Process Wylie text replacements
 */
function processWylieReplacements(soundGroup) {
  const original = JSON.stringify(soundGroup);
  
  // Process group name
  if (soundGroup.name) {
    soundGroup.name = replaceWylieInString(soundGroup.name);
  }
  
  // Process version group names and file paths
  if (soundGroup.versionGroups) {
    soundGroup.versionGroups.forEach(vg => {
      vg.name = replaceWylieInString(vg.name);
      vg.files = vg.files.map(file => replaceWylieInString(file));
    });
  }
  
  // Process long file paths
  if (soundGroup.long) {
    if (Array.isArray(soundGroup.long)) {
      soundGroup.long = soundGroup.long.map(file => replaceWylieInString(file));
    } else {
      soundGroup.long = replaceWylieInString(soundGroup.long);
    }
  }
  
  const processed = JSON.stringify(soundGroup);
  if (original !== processed) {
    stats.wylieReplacements++;
    log(`  Processed Wylie text for: ${soundGroup.name}`);
  }
  
  return soundGroup;
}

/**
 * Verify that all files in a sound group exist
 */
async function verifyFiles(soundGroup) {
  const filesToCheck = [];
  
  // Collect all file paths
  if (soundGroup.versionGroups) {
    soundGroup.versionGroups.forEach(vg => {
      filesToCheck.push(...vg.files);
    });
  }
  
  if (soundGroup.long) {
    const longFiles = Array.isArray(soundGroup.long) ? soundGroup.long : [soundGroup.long];
    filesToCheck.push(...longFiles);
  }
  
  // Check each file
  for (const filePath of filesToCheck) {
    const fullPath = path.join(SOUNDS_DIR, filePath);
    const exists = await fileExists(fullPath);
    
    if (!exists) {
      error(`Missing file: ${filePath} (expected at: ${fullPath})`);
      stats.missingFiles++;
    } else {
      log(`  ✓ Found: ${filePath}`);
    }
    
    stats.totalFiles++;
  }
}

/**
 * Load sprite manifests for verification
 */
async function loadSpriteManifests() {
  const manifests = {};
  const manifestPath = path.join(__dirname, '../public/assets/sounds/manifest.json');
  
  try {
    const masterManifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
    log(`📋 Loaded master sprite manifest with ${Object.keys(masterManifest.sprites || {}).length} speakers`);
    
    for (const [speaker, spriteInfo] of Object.entries(masterManifest.sprites || {})) {
      try {
        const spriteManifestPath = path.join(__dirname, '../public/assets/sounds/', spriteInfo.manifestFile);
        const spriteManifest = JSON.parse(await fs.readFile(spriteManifestPath, 'utf-8'));
        manifests[speaker] = spriteManifest;
        log(`  ✓ Loaded ${speaker} sprite: ${Object.keys(spriteManifest.spritemap || {}).length} sounds`);
      } catch (error) {
        log(`  ⚠️  Could not load sprite manifest for ${speaker}: ${error.message}`);
      }
    }
  } catch (error) {
    log(`⚠️  Could not load master manifest: ${error.message}`);
  }
  
  return manifests;
}

/**
 * Preprocess sound data with sprite verification
 */
function preprocessSoundData(soundGroup, spriteManifests) {
  if (!soundGroup.versionGroups) return soundGroup;
  
  const processedVersionGroups = [];
  
  for (const vgConfig of soundGroup.versionGroups) {
    const processedSounds = [];
    
    for (const filePath of vgConfig.files) {
      const speaker = getSpeakerFromFilePath(filePath);
      const soundKey = extractSoundKey(filePath);
      
      // Check if sound exists in sprite manifest
      const verified = spriteManifests[speaker] && 
                      spriteManifests[speaker].spritemap && 
                      spriteManifests[speaker].spritemap[soundKey];
      
      if (verified) {
        processedSounds.push({
          speaker,
          soundKey,
          verified: true,
          originalPath: filePath
        });
        log(`    ✓ Verified: ${speaker}/${soundKey}`);
      } else {
        processedSounds.push({
          speaker,
          soundKey,
          verified: false,
          originalPath: filePath
        });
        log(`    ⚠️  Not in sprite: ${speaker}/${soundKey}`);
      }
    }
    
    processedVersionGroups.push({
      name: vgConfig.name,
      sounds: processedSounds
    });
  }
  
  // Process long sounds similarly
  const processedLongSounds = [];
  if (soundGroup.long) {
    const longFiles = Array.isArray(soundGroup.long) ? soundGroup.long : [soundGroup.long];
    
    for (const longFile of longFiles) {
      const speaker = getSpeakerFromFilePath(longFile);
      const soundKey = extractSoundKey(longFile);
      
      const verified = spriteManifests[speaker] && 
                      spriteManifests[speaker].spritemap && 
                      spriteManifests[speaker].spritemap[soundKey];
      
      processedLongSounds.push({
        speaker,
        soundKey,
        verified,
        originalPath: longFile
      });
    }
  }
  
  return {
    ...soundGroup,
    versionGroups: processedVersionGroups,
    longSounds: processedLongSounds,
    long: undefined // Remove old format
  };
}

/**
 * Helper functions for file processing
 */
function getSpeakerFromFilePath(filePath) {
  const match = filePath.match(/\/?(.*)\//)
  if (!match) return null;
  const [full, speaker] = match
  return speaker ? speaker : null
}

function extractSoundKey(filePath) {
  const fileName = filePath.split('/').pop();
  return fileName.replace(/\.(mp3|wav|m4a)$/i, '');
}

/**
 * Main audit function
 */
async function auditSounds() {
  try {
    log('🔍 Starting audio files audit...');
    
    // Load sounds.json
    const soundsData = await fs.readFile(SOUNDS_JSON_PATH, 'utf-8');
    const soundGroups = JSON.parse(soundsData);
    
    log(`📁 Loaded ${soundGroups.length} sound groups from ${SOUNDS_JSON_PATH}`);
    stats.totalGroups = soundGroups.length;
    
    // Load sprite manifests for verification
    const spriteManifests = await loadSpriteManifests();
    
    // Process each sound group
    const processedGroups = [];
    
    for (let i = 0; i < soundGroups.length; i++) {
      const soundGroup = soundGroups[i];
      log(`\n🎵 Processing group ${i + 1}/${soundGroups.length}: ${soundGroup.name}`);
      
      // Step 1: Expand applyPattern
      let processed = expandApplyPattern({ ...soundGroup });
      
      // Step 2: Process Wylie text
      processed = processWylieReplacements(processed);
      
      // Step 3: Verify files exist
      await verifyFiles(processed);
      
      // Step 4: Preprocess sound data with sprite verification
      processed = preprocessSoundData(processed, spriteManifests);
      
      processedGroups.push(processed);
    }
    
    // Output results
    const outputPath = CUSTOM_OUTPUT || OUTPUT_PATH;
    
    if (FIX_MODE || CUSTOM_OUTPUT) {
      await fs.writeFile(outputPath, JSON.stringify(processedGroups, null, 2), 'utf-8');
      success(`Processed sounds written to: ${outputPath}`);
    }
    
    // Print statistics
    console.log('\n📊 Audit Results:');
    console.log(`   Total groups: ${stats.totalGroups}`);
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   Missing files: ${stats.missingFiles}`);
    console.log(`   Patterns expanded: ${stats.patternsExpanded}`);
    console.log(`   Wylie replacements: ${stats.wylieReplacements}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ ${stats.errors.length} errors found:`);
      stats.errors.forEach(err => console.log(`   ${err}`));
      process.exit(1);
    } else {
      success('All files verified successfully!');
    }
    
    if (!FIX_MODE && !CUSTOM_OUTPUT) {
      console.log('\n💡 Run with --fix to write processed sounds.json');
      console.log('   or use --output <path> to specify custom output location');
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
Audio Files Audit Script

Usage:
  node scripts/audit-sounds.js [options]

Options:
  --fix, -f           Write processed sounds.json (expands patterns, processes Wylie)
  --output, -o PATH   Write to custom path instead of default
  --verbose, -v       Show detailed logging
  --help, -h          Show this help

Examples:
  node scripts/audit-sounds.js                    # Audit only, show results
  node scripts/audit-sounds.js --fix              # Audit and write processed file
  node scripts/audit-sounds.js -o sounds-new.json # Write to custom location
  node scripts/audit-sounds.js --verbose --fix    # Detailed logging with fix
`);
}

// Run the script
if (args.includes('--help') || args.includes('-h')) {
  showUsage();
} else {
  auditSounds();
}