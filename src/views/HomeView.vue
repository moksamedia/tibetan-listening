// SoundGame.vue
<template>
  <v-main>
    <v-container :fluid="xs == true ? true : false">
      <v-row>
        <v-col cols="12" class="instructions">
          <p>
            Pick a row and press "Random." This will play a random syllable from among the two or
            three on that row. You have to press the button corresponding to the correct sound.
          </p>
          <p>
            The sounds have 2-3 different recordings that they cycle through, so each identical
            syllable won't sound exactly the same each time (the small number in parens). This is on
            purpose to have a range of sounds for each syllable.
          </p>
        </v-col>
      </v-row>
      <v-row v-if="isLoading" justify="center" align="center" class="mt-4">
        <v-col cols="12" class="text-center">
          <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
          <div class="mt-2">Loading sound files...</div>
        </v-col>
      </v-row>

      <template v-else>
        <v-row
          v-for="(group, groupIndex) in soundGroups"
          :key="group.name + groupIndex"
          class="mt-4"
        >
          <v-col cols="12">
            <v-card>
              <v-card-title class="group-title">{{ group.getScreenName() }}</v-card-title>
              <v-card-text>
                <v-row align="center">
                  <v-col cols="12" md="3">
                    <v-btn
                      block
                      :color="group.currentSoundVersionGroup != null ? 'primary' : 'white'"
                      :loading="group.isPlaying"
                      @click="playRandomSound(groupIndex)"
                      :disabled="group.isPlaying"
                    >
                      <v-icon left>mdi-play</v-icon>
                      {{ group.currentSoundVersionGroup != null ? 'Again' : 'Random' }}
                    </v-btn>
                  </v-col>

                  <v-col cols="12" md="6">
                    <div class="answer-btn-group">
                      <v-btn
                        v-for="soundVersionGroup in group.soundVersions"
                        :key="soundVersionGroup.name"
                        size="x-large"
                        :color="getButtonColor(soundVersionGroup)"
                        @click="checkAnswer(soundVersionGroup, groupIndex)"
                      >
                        {{ soundVersionGroup.name }}
                        <span class="num-files">{{ `(${soundVersionGroup.files.length})` }}</span>
                      </v-btn>
                    </div>
                  </v-col>

                  <v-col cols="12" md="3">
                    <v-btn
                      block
                      color="secondary"
                      @click="playLong(group.long)"
                      :density="xs ? 'compact' : 'default'"
                    >
                      <v-icon left>mdi-play</v-icon>
                      Long
                    </v-btn>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </v-container>
  </v-main>
</template>

<script>
import { getSoundGroups } from '../library/sound-loader'
import { useDisplay } from 'vuetify'

export default {
  name: 'SoundGame',

  setup() {
    const { mobile, smAndDown, xs } = useDisplay()
    return {
      mobile,
      smAndDown,
      xs,
    }
  },

  data() {
    return {
      isLoading: true,
      soundGroups: [],
      audioContext: null,
    }
  },

  async created() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      await this.loadSoundFiles()
    } catch (error) {
      console.error('Error initializing sound game:', error)
    }
  },

  methods: {
    async loadSoundFiles() {
      try {
        if (this.audioContext == null) throw Error('No audio context')
        this.soundGroups = await getSoundGroups(this.audioContext)
        console.log('soundGroups', this.soundGroups)
        this.isLoading = false
      } catch (error) {
        console.error('Error loading sound files:', error)
      }
    },

    async loadAudioBuffer(path) {
      try {
        const response = await fetch(path)
        const arrayBuffer = await response.arrayBuffer()
        return await this.audioContext.decodeAudioData(arrayBuffer)
      } catch (error) {
        console.error(`Error loading audio file ${path}:`, error)
        throw error
      }
    },

    nameForGroup(group) {
      console.log(group)
      return group.sounds.reduce((acc, curr) => {
        acc === '' ? (acc = curr.name) : (acc += ' vs ' + curr.name)
        return acc
      }, '')
    },

    async playLong(longBuffer) {
      try {
        const source = this.audioContext.createBufferSource()
        source.buffer = longBuffer
        source.connect(this.audioContext.destination)

        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
        group.isPlaying = false
      }
    },

    async playRandomSound(groupIndex) {
      const group = this.soundGroups[groupIndex]
      if (!group || group.isPlaying) return

      group.resetGuesses()

      if (!group.currentSoundVersionGroup) {
        group.setRandomCurrentSounVersionGroup()
      }

      group.isPlaying = true

      try {
        const source = this.audioContext.createBufferSource()
        source.buffer = group.currentSoundVersionGroup.getRandomBuffer()
        source.connect(this.audioContext.destination)

        source.onended = () => {
          group.isPlaying = false
        }

        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
        group.isPlaying = false
      }
    },

    checkAnswer(soundVersionGroup, groupIndex) {
      const group = this.soundGroups[groupIndex]

      try {
        const source = this.audioContext.createBufferSource()
        source.buffer = soundVersionGroup.getNextBuffer()
        source.connect(this.audioContext.destination)
        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
      }

      if (!group.currentSoundVersionGroup) return

      const isCorrect = soundVersionGroup.name === group.currentSoundVersionGroup.name
      soundVersionGroup.isCorrect = isCorrect

      if (isCorrect) {
        setTimeout(function () {
          group.currentSoundVersionGroup = null
          group.resetGuesses()
        }, 700)
      } else {
        setTimeout(function () {
          soundVersionGroup.isCorrect = null
        }, 700)
      }
    },

    getButtonColor(soundVersionGroup) {
      if (soundVersionGroup.isCorrect === null) return 'default'
      return soundVersionGroup.isCorrect ? 'success' : 'error'
    },
  },
}
</script>

<style>
.instructions p {
  margin-bottom: 10px;
}
.answer-btn-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
}
.answer-btn-group .v-btn {
  margin: 10px;
}
.num-files {
  font-size: 50%;
  color: gray;
}
.answer-btn-group .v-btn__content,
.group-title {
  font-size: 150% !important;
}

@media only screen and (max-device-width: 480px) {
  .answer-btn-group .v-btn__content,
  .group-title {
    font-size: 140% !important;
  }
}
</style>
