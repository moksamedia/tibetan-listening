# Audio Sprite Generation Scripts

This directory contains scripts for converting the Tibetan listening app from individual audio files to an optimized audio sprite system.

## Overview

The audio sprite system combines multiple individual audio files into single sprite files per speaker, with JSON manifests containing timing data for each sound. This provides several benefits:

- **Faster loading**: Reduces HTTP requests from 600+ individual files to just a few sprite files
- **Better caching**: Large sprite files cache better than many small files  
- **Improved performance**: Especially beneficial for mobile devices and PWAs
- **Silence trimming**: Automatically removes silence from audio clips for consistency

## Files

### `generate-sprites.js`
Main script that converts individual audio files into sprite files.

**Features:**
- Generates separate sprites for each speaker (`khelsang`, `ngawang`, `tseringsamden`, `wangdac`, `misc`)
- SHA-256 hash-based change detection to skip unchanged files
- Optional silence trimming using ffmpeg
- Force regeneration option
- Master manifest generation

**Usage:**
```bash
# Generate sprites (only for changed files)
npm run generate-sprites

# Force regenerate all sprites
npm run generate-sprites:force

# With custom options (direct node execution)
node scripts/generate-sprites.js --force --debug --maxSilenceMs 200
```

**Options:**
- `--force` / `-f`: Force regeneration of all sprites regardless of file changes
- `--debug`: Enable debug mode (preserves temporary files)
- `--maxSilenceMs N`: Maximum silence duration to trim (default: 150ms)
- `--trimSilence false`: Disable silence trimming

## Generated Files

The script generates the following files in `public/assets/sounds/`:

- `manifest.json` - Master manifest listing all available sprites
- `{speaker}-sprite.mp3` - Audio sprite file for each speaker
- `{speaker}-sprite.json` - Timing data for each speaker's sprite
- `.file-tracking.json` - Internal file change tracking data (hidden)

### Example Sprite Data Structure
```json
{
  "speaker": "khelsang",
  "generatedAt": "2025-01-15T10:30:00.000Z", 
  "totalFiles": 360,
  "totalDuration": 865899,
  "src": ["khelsang-sprite.mp3"],
  "spritemap": {
    "ཀ་ 1": {
      "start": 6600, 
      "length": 408,
      "originalPath": "ཀ་ 1"
    }
  }
}
```

## Requirements

- **Node.js** 14+ with ES modules support
- **audiosprite** package (installed automatically)
- **ffmpeg** (for silence trimming) - install with `brew install ffmpeg` on macOS

## Performance

The sprite system provides significant performance improvements:

- **Original system**: ~643 individual HTTP requests for all audio files
- **Sprite system**: 5 sprite files + 5 manifest files = 10 total requests
- **File size**: Similar total size but better compression and caching
- **Loading speed**: Faster initial load, especially on mobile networks

## Integration

The Vue.js application automatically detects if sprites are available and uses them preferentially, falling back to individual files if sprites are not found.

Key integration points:
- `src/library/sprite-audio-service.js` - Core sprite audio service
- `src/library/sprite-sound-loader.js` - Enhanced sound loader with sprite support  
- `src/views/HomeView.vue` - UI shows sprite status
- `src/components/SoundGroupCard.vue` - Uses sprite-aware sound classes

## Development Workflow

1. **Make changes** to audio files in `public/sounds/`
2. **Run sprite generation**: `npm run generate-sprites`
3. **Test the app** - sprites will be used automatically if available
4. **For production builds** - include sprite generation in your CI/CD pipeline

## Troubleshooting

**Error: "audiosprite command not found"**
- Install audiosprite: `npm install audiosprite --save-dev`

**Error: "ffmpeg not found"** 
- Install ffmpeg: `brew install ffmpeg` (macOS) or equivalent for your OS
- Or disable silence trimming: `node scripts/generate-sprites.js --trimSilence false`

**Sprites not loading in app**
- Check that `public/assets/sounds/manifest.json` exists
- Verify sprite files are accessible at `/assets/sounds/` in your web server
- Check browser console for loading errors

**Large sprite files**
- Sprites inherit the quality of source files
- Consider optimizing source audio files first
- Adjust audiosprite quality settings in `generate-sprites.js` if needed