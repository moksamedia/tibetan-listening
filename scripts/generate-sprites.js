#!/usr/bin/env node

/**
 * Audio Sprite Generation Script for Tibetan Listening App
 * 
 * Converts individual audio files into optimized sprite files per speaker
 * Features:
 * - SHA-256 hash-based change detection
 * - Speaker-specific sprite generation
 * - Force regeneration option
 * - JSON manifest generation with timing data
 * - Silent audio trimming using ffmpeg
 * - Multiple audio file versions support
 */

import audiosprite from 'audiosprite';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync, readdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { createHash } from 'crypto';

const execAsync = promisify(exec);
const audiospriteAsync = promisify(audiosprite);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  projectRoot: join(__dirname, '..'),
  soundsDir: join(__dirname, '../audio-source/sounds'),
  outputDir: join(__dirname, '../public/assets/sounds'),
  soundsJsonPath: join(__dirname, '../src/assets/sounds.json'),
  fileTrackingPath: join(__dirname, '../public/assets/sounds/.file-tracking.json'),
  speakers: ['khelsang', 'ngawang', 'tseringsamden', 'wangdac', 'misc'],
  
  // Audio processing options
  silenceDuration: 200, // ms between sounds in sprite
  maxSilenceMs: 150, // Max silence before/after clips
  trimSilence: true, // Trim silence from audio files
  
  // Output options
  format: 'mp3',
  bitrate: 128,
  sampleRate: 44100,
  channels: 2,
};

class SpriteGenerator {
  constructor(options = {}) {
    this.forceRegenerate = options.forceRegenerate || false;
    this.debugMode = options.debugMode || false;
    this.trimSilence = options.trimSilence !== false;
    this.maxSilenceMs = options.maxSilenceMs || CONFIG.maxSilenceMs;
    this.tempDir = join(CONFIG.outputDir, '.tmp');
  }

  async run() {
    console.log('🎵 Audio Sprite Generator');
    console.log('========================');
    
    // Parse command line arguments
    this.parseArguments();
    
    try {
      // Ensure output directory exists
      this.ensureOutputDir();
      
      // Load file tracking data
      const previousTracking = this.loadFileTracking();
      const currentTracking = {};
      const results = {};
      let skippedCount = 0;
      let generatedCount = 0;
      
      // Generate sprites for each speaker
      for (const speaker of CONFIG.speakers) {
        try {
          const result = await this.generateSpriteForSpeaker(speaker, previousTracking, currentTracking);
          results[speaker] = result;
          
          if (result === 'skipped') {
            skippedCount++;
          } else if (result) {
            generatedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to generate sprite for ${speaker}:`, error.message);
          results[speaker] = null;
        }
      }
      
      // Save updated file tracking data
      this.saveFileTracking(currentTracking);
      
      // Generate master manifest
      const successfulResults = Object.fromEntries(
        Object.entries(results).filter(([_, result]) => result && result !== 'skipped')
      );
      
      if (Object.keys(successfulResults).length > 0) {
        await this.generateMasterManifest(successfulResults);
      }
      
      console.log('\n🎉 Audio sprite generation complete!');
      console.log(`📊 Summary: ${generatedCount} generated, ${skippedCount} skipped`);
      
      // Show results
      console.log('\n📊 Generation Results:');
      for (const [speaker, data] of Object.entries(results)) {
        if (data === 'skipped') {
          console.log(`  ${speaker}: ⏭️  Skipped (no changes)`);
        } else if (data && typeof data === 'object') {
          console.log(`  ${speaker}: ${data.totalSounds} sounds, ${data.totalDuration.toFixed(2)}s total`);
        } else {
          console.log(`  ${speaker}: ❌ Failed`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error generating sprites:', error.message);
      process.exit(1);
    }
  }

  parseArguments() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg === '--force' || arg === '-f') {
        this.forceRegenerate = true;
      } else if (arg === '--debug') {
        this.debugMode = true;
      } else if (arg === '--maxSilenceMs') {
        const value = parseInt(args[i + 1]);
        if (!isNaN(value)) {
          this.maxSilenceMs = value;
          i++;
        }
      } else if (arg === '--trimSilence') {
        const value = args[i + 1];
        if (value === 'false') {
          this.trimSilence = false;
          i++;
        }
      }
    }
    
    if (this.forceRegenerate) {
      console.log('🔄 Force regeneration enabled');
    }
    if (this.debugMode) {
      console.log('🐛 Debug mode enabled - temporary files will be preserved');
    }
  }

  loadFileTracking() {
    try {
      if (!existsSync(CONFIG.fileTrackingPath)) {
        console.log('📋 No previous file tracking data found (first run)');
        return {};
      }
      const trackingContent = readFileSync(CONFIG.fileTrackingPath, 'utf8');
      const tracking = JSON.parse(trackingContent);
      console.log(`📋 Loaded file tracking data for ${Object.keys(tracking).length} speakers`);
      return tracking;
    } catch (error) {
      console.warn('⚠️  Failed to load file tracking data:', error.message);
      return {};
    }
  }

  saveFileTracking(trackingData) {
    try {
      writeFileSync(CONFIG.fileTrackingPath, JSON.stringify(trackingData, null, 2));
      console.log('💾 File tracking data saved');
    } catch (error) {
      console.warn('⚠️  Failed to save file tracking data:', error.message);
    }
  }

  ensureOutputDir() {
    if (!existsSync(CONFIG.outputDir)) {
      mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  async prepareTempDirectory() {
    try {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true });
      }
      mkdirSync(this.tempDir, { recursive: true });
      console.log(`  📁 Created temporary directory: ${this.tempDir}`);
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to prepare temp directory:`, error.message);
      return false;
    }
  }

  async cleanupTempDirectory() {
    if (this.debugMode) {
      console.log(`  🐛 Debug mode: Preserving temporary directory: ${this.tempDir}`);
      return;
    }
    
    try {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true });
        console.log(`  🧹 Cleaned up temporary directory`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to cleanup temp directory:`, error.message);
    }
  }

  async generateSpriteForSpeaker(speaker, previousTracking, currentTracking) {
    console.log(`\n🗣️  Processing speaker: ${speaker}`);
    
    const speakerDir = join(CONFIG.soundsDir, speaker);
    
    // Check if speaker directory exists
    if (!existsSync(speakerDir)) {
      console.log(`⚠️  Speaker directory not found: ${speakerDir}`);
      return null;
    }
    
    // Scan all files for this speaker
    const speakerFiles = this.scanSpeakerFiles(speakerDir);
    const speakerHash = this.calculateSpeakerHash(speakerFiles);
    
    currentTracking[speaker] = {
      files: speakerFiles,
      hash: speakerHash,
      lastGenerated: new Date().toISOString()
    };

    const hasChanged = this.forceRegenerate || 
                      !previousTracking[speaker] || 
                      previousTracking[speaker].hash !== speakerHash;

    if (!hasChanged) {
      console.log(`  ⏭️  Skipping ${speaker} (no changes detected)`);
      return 'skipped';
    }

    console.log(`  🔄 Regenerating ${speaker} (${this.forceRegenerate ? 'forced' : 'changes detected'})`);
    
    // Generate sprite
    const spriteData = await this.createSprite(speaker);
    
    console.log(`✅ ${speaker} sprite generated successfully`);
    return spriteData;
  }

  scanSpeakerFiles(speakerDir) {
    const files = {};

    if (!existsSync(speakerDir)) {
      return files;
    }

    try {
      const allFiles = readdirSync(speakerDir)
        .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a'))
        .map(file => join(speakerDir, file));

      for (const filePath of allFiles) {
        try {
          const stats = statSync(filePath);
          const content = readFileSync(filePath);
          const hash = createHash('sha256').update(content).digest('hex');
          
          files[filePath] = {
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            hash: hash.substring(0, 16)
          };
        } catch (fileError) {
          console.warn(`    ⚠️  Failed to process file ${filePath}:`, fileError.message);
        }
      }

      console.log(`  📁 Scanned ${Object.keys(files).length} audio files in ${basename(speakerDir)}`);
    } catch (error) {
      console.warn(`  ⚠️  Failed to scan speaker directory ${speakerDir}:`, error.message);
    }

    return files;
  }

  calculateSpeakerHash(speakerFiles) {
    const fileEntries = Object.entries(speakerFiles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, data]) => `${path}:${data.hash}:${data.mtime}:${data.size}`)
      .join('|');
    
    if (fileEntries.length === 0) {
      return 'empty';
    }

    return createHash('sha256').update(fileEntries).digest('hex').substring(0, 12);
  }

  async trimSilenceFromFile(inputPath, outputPath) {
    try {
      const maxSilenceSeconds = this.maxSilenceMs / 1000;
      
      const command = [
        'ffmpeg',
        '-i', `"${inputPath}"`,
        '-af', `"silenceremove=start_periods=1:start_silence=${maxSilenceSeconds}:start_threshold=-50dB:detection=peak,reverse,silenceremove=start_periods=1:start_silence=${maxSilenceSeconds}:start_threshold=-50dB:detection=peak,reverse"`,
        '-y',
        `"${outputPath}"`
      ].join(' ');

      await execAsync(command);
      return true;
    } catch (error) {
      console.warn(`    ⚠️  Failed to trim silence from ${inputPath}:`, error.message);
      try {
        await execAsync(`cp "${inputPath}" "${outputPath}"`);
        return true;
      } catch (copyError) {
        console.error(`    ❌ Failed to copy original file:`, copyError.message);
        return false;
      }
    }
  }

  async createSprite(speaker) {
    const speakerDir = join(CONFIG.soundsDir, speaker);
    const outputName = `${speaker}-sprite`;
    
    console.log(`  📁 Speaker directory: ${speakerDir}`);
    console.log(`  🎯 Output name: ${outputName}`);
    console.log(`  ✂️  Silence trimming: ${this.trimSilence ? `enabled (max ${this.maxSilenceMs}ms)` : 'disabled'}`);
    
    // Prepare temporary directory for processed files
    if (this.trimSilence && !await this.prepareTempDirectory()) {
      throw new Error('Failed to prepare temporary directory');
    }
    
    try {
      // Get all audio files for this speaker
      const allFiles = readdirSync(speakerDir)
        .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a'))
        .sort();
        
      console.log(`  🔍 Found ${allFiles.length} audio files`);
      
      if (allFiles.length === 0) {
        throw new Error(`No sound files found for ${speaker}`);
      }
      
      // Process files (trim silence if enabled)
      const availableFiles = [];
      const fileMap = {};
      
      for (const fileName of allFiles) {
        const inputFile = join(speakerDir, fileName);
        let fileToUse = inputFile;
        
        if (this.trimSilence) {
          const trimmedFile = join(this.tempDir, fileName);
          const trimSuccess = await this.trimSilenceFromFile(inputFile, trimmedFile);
          
          if (trimSuccess) {
            fileToUse = trimmedFile;
            console.log(`    ✂️  ${fileName}: trimmed and ready`);
          } else {
            console.log(`    ⚠️  ${fileName}: using original (trim failed)`);
          }
        } else {
          console.log(`    ✓ ${fileName}: ${inputFile}`);
        }
        
        availableFiles.push(fileToUse);
        fileMap[fileToUse] = basename(fileName, extname(fileName));
      }
      
      // Use audiosprite to generate the sprite
      console.log(`  🎵 Generating sprite with ${availableFiles.length} files...`);
    
      const options = {
        output: join(CONFIG.outputDir, outputName),
        format: CONFIG.format,
        gap: CONFIG.silenceDuration / 1000,
        export: CONFIG.format,
        bitrate: CONFIG.bitrate,
        vbr: -1,
        samplerate: CONFIG.sampleRate,
        channels: CONFIG.channels,
        logger: {
          debug: () => {},
          info: (msg) => console.log(`    ${msg}`),
          log: (msg) => console.log(`    ${msg}`)
        }
      };
      
      const result = await audiospriteAsync(availableFiles, options);
      
      // Transform the audiosprite result to match our expected format
      const transformedSprite = {};
      
      if (!result || !result.spritemap) {
        console.error(`  ❌ No sprite data in result:`, result);
        throw new Error('Audiosprite did not return sprite data');
      }
      
      // Map the generated sprite data back to our file names
      for (const [spriteName, spriteInfo] of Object.entries(result.spritemap)) {
        const cleanName = basename(spriteName, extname(spriteName));
        transformedSprite[cleanName] = {
          start: Math.round(spriteInfo.start * 1000),
          length: Math.round((spriteInfo.end - spriteInfo.start) * 1000),
          originalPath: spriteName
        };
        console.log(`    🔗 Mapped ${cleanName}: [${transformedSprite[cleanName].start}, ${transformedSprite[cleanName].length}]`);
      }
      
      // Create our format sprite data
      const spriteData = {
        speaker: speaker,
        generatedAt: new Date().toISOString(),
        totalFiles: Object.keys(transformedSprite).length,
        totalDuration: Math.max(...Object.values(result.spritemap).map(s => s.end * 1000)),
        src: [`${speaker}-sprite.mp3`],
        spritemap: transformedSprite
      };
      
      // Write our custom sprite JSON file
      const spriteJsonFile = join(CONFIG.outputDir, `${speaker}-sprite.json`);
      writeFileSync(spriteJsonFile, JSON.stringify(spriteData, null, 2));
      console.log(`  💾 Sprite data written to: ${spriteJsonFile}`);
      
      console.log(`  ✅ Sprite generation complete`);
      
      return {
        spriteFile: `${speaker}-sprite.mp3`,
        spriteData: spriteJsonFile,
        totalSounds: availableFiles.length,
        totalDuration: spriteData.totalDuration / 1000,
        spritemap: transformedSprite
      };
      
    } catch (error) {
      console.error(`  ❌ Audiosprite generation failed:`, error.message);
      throw error;
    } finally {
      if (this.trimSilence) {
        await this.cleanupTempDirectory();
      }
    }
  }

  async postProcessManifest(jsonFile, speaker) {
    const manifest = JSON.parse(await fs.readFile(jsonFile, 'utf8'));
    
    // Add metadata
    manifest.speaker = speaker;
    manifest.generatedAt = new Date().toISOString();
    manifest.totalFiles = Object.keys(manifest.spritemap).length;
    
    // Calculate total duration
    let totalDuration = 0;
    Object.values(manifest.spritemap).forEach(sprite => {
      totalDuration = Math.max(totalDuration, sprite.start + sprite.length);
    });
    manifest.totalDuration = totalDuration;
    
    // Process spritemap to use relative file names
    const processedSpritemap = {};
    Object.entries(manifest.spritemap).forEach(([key, value]) => {
      // Extract just the filename from the full path
      const filename = path.basename(key, path.extname(key));
      processedSpritemap[filename] = {
        ...value,
        originalPath: key
      };
    });
    manifest.spritemap = processedSpritemap;
    
    // Save processed manifest
    await fs.writeFile(jsonFile, JSON.stringify(manifest, null, 2));
  }

  async generateMasterManifest(spriteResults) {
    console.log('\n📋 Generating master manifest...');
    
    const masterManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      spritesGenerated: new Date().toISOString(),
      sprites: {}
    };
    
    // Add sprite data to master manifest
    for (const [speaker, spriteData] of Object.entries(spriteResults)) {
      if (spriteData) {
        masterManifest.sprites[speaker] = {
          audioFile: spriteData.spriteFile,
          manifestFile: basename(spriteData.spriteData),
          totalFiles: spriteData.totalSounds,
          totalDuration: spriteData.totalDuration,
          generatedAt: new Date().toISOString()
        };
      }
    }
    
    const masterPath = join(CONFIG.outputDir, 'manifest.json');
    writeFileSync(masterPath, JSON.stringify(masterManifest, null, 2));
    
    console.log(`✅ Master manifest saved to: ${masterPath}`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--debug') {
      options.debugMode = true;
    } else if (arg === '--force' || arg === '-f') {
      options.forceRegenerate = true;
    } else if (arg === '--maxSilenceMs') {
      const value = parseInt(args[i + 1]);
      if (!isNaN(value)) {
        options.maxSilenceMs = value;
        i++;
      }
    } else if (arg === '--trimSilence') {
      const value = args[i + 1];
      if (value === 'false') {
        options.trimSilence = false;
        i++;
      }
    }
  }
  
  // Show configuration 
  if (options.debugMode || options.forceRegenerate) {
    console.log('📋 Configuration:', {
      debugMode: options.debugMode || false,
      forceRegenerate: options.forceRegenerate || false,
      maxSilenceMs: options.maxSilenceMs || CONFIG.maxSilenceMs,
      trimSilence: options.trimSilence !== false
    });
  }
  
  const generator = new SpriteGenerator(options);
  
  generator.run()
    .then(() => {
      if (options.debugMode) {
        console.log(`\n🐛 Debug: Temporary files preserved in: ${join(CONFIG.outputDir, '.tmp')}`);
      }
    })
    .catch((error) => {
      console.error('❌ Sprite generation failed:', error.message);
      process.exit(1);
    });
}

export default SpriteGenerator;