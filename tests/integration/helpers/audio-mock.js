/**
 * Audio Mock System for Integration Testing
 * 
 * Provides mock implementations of Web Audio API and audio functionality
 * that don't require actual audio files or user interaction for testing.
 */

export class MockAudioContext {
  constructor() {
    this.destination = new MockAudioNode();
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'running';
    this.sources = [];
  }

  createBufferSource() {
    const source = new MockAudioBufferSource(this);
    this.sources.push(source);
    return source;
  }

  createGain() {
    return new MockGainNode();
  }

  decodeAudioData(arrayBuffer) {
    // Mock audio buffer with fake timing data
    return Promise.resolve(new MockAudioBuffer());
  }
}

export class MockAudioBuffer {
  constructor(duration = 10) {
    this.length = 44100 * duration; // 10 seconds at 44.1kHz
    this.sampleRate = 44100;
    this.numberOfChannels = 2;
    this.duration = duration;
  }
}

export class MockAudioBufferSource {
  constructor(context) {
    this.context = context;
    this.buffer = null;
    this.onended = null;
    this.connected = false;
    this.playing = false;
    this.startTime = 0;
    this.duration = 0;
  }

  connect(destination) {
    this.connected = true;
    this.destination = destination;
    return destination;
  }

  start(when = 0, offset = 0, duration) {
    this.playing = true;
    this.startTime = this.context.currentTime + when;
    this.offset = offset;
    this.duration = duration;
    
    // Simulate audio ending
    const playDuration = duration || (this.buffer ? this.buffer.duration - offset : 1);
    setTimeout(() => {
      this.playing = false;
      if (this.onended) {
        this.onended();
      }
    }, playDuration * 100); // Speed up for testing (100ms instead of 1s)
  }

  stop() {
    this.playing = false;
  }
}

export class MockGainNode {
  constructor() {
    this.gain = { value: 1 };
  }

  connect(destination) {
    return destination;
  }
}

export class MockAudioNode {
  connect(destination) {
    return destination;
  }
}

/**
 * Mock fetch for sprite manifests and audio files
 */
export async function mockFetch(url) {
  if (url.includes('manifest.json')) {
    return {
      ok: true,
      json: () => Promise.resolve({
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        separateWordAndLongSprites: true,
        sprites: {
          khelsang: {
            word: {
              audioFile: 'khelsang-words-sprite.mp3',
              manifestFile: 'khelsang-words-sprite.json',
              totalFiles: 10,
              totalDuration: 30,
            },
            long: {
              audioFile: 'khelsang-long-sprite.mp3', 
              manifestFile: 'khelsang-long-sprite.json',
              totalFiles: 5,
              totalDuration: 25,
            },
            totalFiles: 15,
            totalDuration: 55,
          }
        }
      })
    };
  }

  if (url.includes('khelsang-words-sprite.json')) {
    return {
      ok: true,
      json: () => Promise.resolve({
        speaker: 'khelsang',
        type: 'words',
        totalFiles: 10,
        spritemap: {
          'test_word_1': { start: 0, length: 1000 },
          'test_word_2': { start: 1500, length: 1200 },
          'test_word_3': { start: 3000, length: 800 }
        }
      })
    };
  }

  if (url.includes('khelsang-long-sprite.json')) {
    return {
      ok: true,
      json: () => Promise.resolve({
        speaker: 'khelsang',
        type: 'long',
        totalFiles: 5,
        spritemap: {
          'test_long_1': { start: 0, length: 3000 },
          'test_long_2': { start: 4000, length: 4500 }
        }
      })
    };
  }

  if (url.includes('.mp3')) {
    // Mock audio file - return empty ArrayBuffer
    return {
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    };
  }

  return { ok: false, status: 404 };
}

/**
 * Setup function to inject mocks into the page
 */
export async function setupAudioMocks(page) {
  await page.addInitScript(() => {
    // Mock Web Audio API
    window.AudioContext = class MockAudioContext {
      constructor() {
        this.destination = { connect: () => {} };
        this.sampleRate = 44100;
        this.currentTime = 0;
        this.state = 'running';
      }

      createBufferSource() {
        return {
          buffer: null,
          onended: null,
          connect: () => {},
          start: (when = 0, offset = 0, duration) => {
            setTimeout(() => {
              if (this.onended) this.onended();
            }, 100); // Quick completion for testing
          },
          stop: () => {}
        };
      }

      createGain() {
        return {
          gain: { value: 1 },
          connect: () => {}
        };
      }

      decodeAudioData() {
        return Promise.resolve({
          length: 44100,
          sampleRate: 44100,
          numberOfChannels: 2,
          duration: 1
        });
      }
    };

    // Mock fetch for audio files
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      // Use mock for audio-related URLs
      if (url.includes('/assets/sounds/') || url.includes('/utils/assets/sounds/')) {
        if (url.includes('manifest.json')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              version: '1.0.0',
              separateWordAndLongSprites: true,
              sprites: {
                khelsang: {
                  word: {
                    audioFile: 'khelsang-words-sprite.mp3',
                    manifestFile: 'khelsang-words-sprite.json',
                    totalFiles: 3,
                    totalDuration: 10
                  },
                  long: {
                    audioFile: 'khelsang-long-sprite.mp3',
                    manifestFile: 'khelsang-long-sprite.json', 
                    totalFiles: 2,
                    totalDuration: 8
                  },
                  totalFiles: 5,
                  totalDuration: 18
                }
              }
            })
          };
        }

        if (url.includes('words-sprite.json')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              speaker: 'khelsang',
              type: 'words',
              spritemap: {
                'test_word_1': { start: 0, length: 1000 },
                'test_word_2': { start: 1500, length: 1200 },
                'test_word_3': { start: 3000, length: 800 }
              }
            })
          };
        }

        if (url.includes('long-sprite.json')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              speaker: 'khelsang',
              type: 'long',
              spritemap: {
                'test_long_1': { start: 0, length: 3000 },
                'test_long_2': { start: 4000, length: 4500 }
              }
            })
          };
        }

        if (url.includes('.mp3')) {
          return {
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          };
        }
      }

      // Use original fetch for everything else
      return originalFetch(url, options);
    };

    // Speed up timers for testing
    window.TESTING_MODE = true;
  });
}