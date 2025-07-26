/**
 * Test Data Helpers
 * 
 * Provides mock sound group data for testing
 */

export const mockSoundGroupData = [
  {
    "name": "Test Sound Group 1",
    "versionGroups": [
      {
        "name": "Test Word 1",
        "sounds": [
          {
            "speaker": "khelsang",
            "soundKey": "test_word_1",
            "verified": true,
            "originalPath": "khelsang/test_word_1.mp3"
          }
        ]
      },
      {
        "name": "Test Word 2", 
        "sounds": [
          {
            "speaker": "khelsang",
            "soundKey": "test_word_2",
            "verified": true,
            "originalPath": "khelsang/test_word_2.mp3"
          }
        ]
      }
    ],
    "longSounds": [
      {
        "speaker": "khelsang",
        "soundKey": "test_long_1",
        "verified": true,
        "originalPath": "khelsang/test_long_1.mp3"
      }
    ]
  },
  {
    "name": "Test Sound Group 2",
    "versionGroups": [
      {
        "name": "Test Word 3",
        "sounds": [
          {
            "speaker": "khelsang", 
            "soundKey": "test_word_3",
            "verified": true,
            "originalPath": "khelsang/test_word_3.mp3"
          }
        ]
      }
    ],
    "longSounds": [
      {
        "speaker": "khelsang",
        "soundKey": "test_long_2", 
        "verified": true,
        "originalPath": "khelsang/test_long_2.mp3"
      }
    ]
  }
];

/**
 * Mock the sounds-processed.json import in tests
 */
export async function mockSoundsProcessedJson(page) {
  await page.addInitScript(() => {
    // Mock the sounds-processed.json import
    window.mockSoundGroupData = [
      {
        "name": "བཀའ་ vs དགའ་",
        "versionGroups": [
          {
            "name": "བཀའ་",
            "sounds": [
              {
                "speaker": "khelsang",
                "soundKey": "བཀའ་_1",
                "verified": true,
                "originalPath": "khelsang/བཀའ་_1.mp3"
              }
            ]
          },
          {
            "name": "དགའ་",
            "sounds": [
              {
                "speaker": "khelsang", 
                "soundKey": "དགའ་_1",
                "verified": true,
                "originalPath": "khelsang/དགའ་_1.mp3"
              }
            ]
          }
        ],
        "longSounds": [
          {
            "speaker": "khelsang",
            "soundKey": "བཀའ་ vs དགའ་",
            "verified": true,
            "originalPath": "khelsang/བཀའ་ vs དགའ་.mp3"
          }
        ]
      }
    ];
  });
}