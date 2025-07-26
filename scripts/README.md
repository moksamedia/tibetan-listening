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

The Vue.js application uses a simplified sprite-only audio system that assumes sprites are always available. This eliminates fallback complexity while maintaining all speaker/version functionality.

Key integration points:
- `src/library/sprite-only-audio-service.js` - Simplified sprite-only audio service
- `src/library/sprite-only-sound-loader.js` - Clean sound loader without fallback complexity  
- `src/views/HomeView.vue` - UI shows sprite status
- `src/components/SoundGroupCard.vue` - Uses simplified sprite sound classes

**Note**: The application requires sprites to function. Always run `npm run generate-sprites` before starting the app.

## Development Workflow

1. **Make changes** to audio files in `public/sounds/` or to `src/assets/sounds.json`
2. **Run audio build process**: `npm run build-audio` (this audits sounds, expands patterns, and generates sprites)
3. **Test the app** - sprites will be used automatically
4. **For production builds** - include `npm run build-audio` in your CI/CD pipeline

### Individual Commands

- `npm run audit-sounds` - Check for missing files and show statistics
- `npm run audit-sounds:fix` - Process patterns, Wylie text, and generate sounds-processed.json
- `npm run generate-sprites` - Generate sprite files (automatically runs audit first)
- `npm run build-audio` - Complete audio build process (audit + sprites)

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
- **Important**: The app requires sprites to function - no fallback to individual files

**Large sprite files**
- Sprites inherit the quality of source files
- Consider optimizing source audio files first
- Adjust audiosprite quality settings in `generate-sprites.js` if needed