# Page snapshot

```yaml
- main:
  - paragraph: Pick a row and press "Random." This will play a random syllable from among the two or three on that row. You have to press the button below corresponding to the correct sound. The "Random" button changes to "Again," meaning that it will play the reference sound again. When you chose the correct syllable, the row will reset.
  - paragraph: The sounds have 2-3 different recordings that they cycle through, so each identical syllable won't sound exactly the same each time (the small number in parens). This is on purpose to have a range of sounds for each syllable.
  - paragraph: The "Long" button plays a recording where the speaker speaks the syllables together.
  - paragraph: All audio sprites are preloaded when the app starts, so sounds play instantly without any delays.
  - paragraph:
    - text: 🎵
    - strong: Audio sprites enabled!
    - text: Sounds are loaded from optimized sprite files for faster performance. (0/1 speakers loaded)
  - checkbox "Show Favorites Only"
  - text: Show Favorites Only
  - alert
  - checkbox "Autoplay on correct choice" [checked]
  - text: Autoplay on correct choice
  - alert
  - text: Loading complete! All sprites ready for instant playback.
  - progressbar
  - text: Setting up sound groups and preparing sprites...
- img
- img
```