<template>
  <v-main>
    <v-container :fluid="xs == true ? true : false">
      <v-row>
        <v-col cols="12" class="instructions">
          <p>
            Pick a row and press "Random." This will play a random syllable from among the two or
            three on that row. You have to press the button below corresponding to the correct
            sound. The "Random" button changes to "Again," meaning that it will play the reference
            sound again. When you chose the correct syllable, the row will reset.
          </p>
          <p>
            The sounds have 2-3 different recordings that they cycle through, so each identical
            syllable won't sound exactly the same each time (the small number in parens). This is on
            purpose to have a range of sounds for each syllable.
          </p>
          <p>
            The "Long" button plays a recording where the speaker speaks the syllables together.
          </p>
        </v-col>
      </v-row>
      <v-banner
        class="error-banner"
        v-if="errorMessage"
        color="red"
        sticky
        @click="dismissErrorBanner"
      >
        <v-icon left>mdi-alert-circle</v-icon>
        {{ errorMessage }}
      </v-banner>
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
                      @click="playLong(group)"
                      :density="xs ? 'comfortable' : 'default'"
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
import { ref, onMounted } from 'vue'
import { getSoundGroups } from '../library/sound-loader'
import { useDisplay } from 'vuetify'

export default {
  name: 'SoundGame',

  setup() {
    const { mobile, smAndDown, xs } = useDisplay()
    const isLoading = ref(true)
    const soundGroups = ref([])
    const audioContext = ref(null)
    const errorMessage = ref('This is just a test')

    const loadSoundFiles = async () => {
      try {
        if (audioContext.value == null) throw Error('No audio context')
        soundGroups.value = await getSoundGroups(audioContext.value)
        console.log('soundGroups', soundGroups.value)
        isLoading.value = false
      } catch (error) {
        console.error('Error loading sound files:', error)
      }
    }
    const dismissErrorBanner = () => {
      errorMessage.value = ''
    }
    const pushErrorMessage = (message, duration = 10000) => {
      errorMessage.value = message
      setTimeout(() => {
        errorMessage.value = ''
      }, duration)
    }

    const loadBuffersForGroupIfNeeded = async (group) => {
      if (group.needToLoadBuffers(group)) {
        console.log('Loading buffers for:', group.name)
        try {
          await group.loadBuffers(audioContext.value)
        } catch (error) {
          console.error('Error loading sound buffers:', error)
          group.isPlaying = false
          pushErrorMessage(`Error loading sound buffers for ${group.name}`)
          return
        }
      } else {
        console.log('Buffers already loaded for:', group.name)
      }
    }

    const playLong = async (group) => {
      await loadBuffersForGroupIfNeeded(group)
      try {
        const source = audioContext.value.createBufferSource()
        source.buffer = group.long.getBuffer()
        source.connect(audioContext.value.destination)
        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
      }
    }

    const playRandomSound = async (groupIndex) => {
      const group = soundGroups.value[groupIndex]
      if (!group || group.isPlaying) return

      group.resetGuesses()

      if (!group.currentSoundVersionGroup) {
        group.setRandomCurrentSounVersionGroup()
      }

      group.isPlaying = true

      await loadBuffersForGroupIfNeeded(group)

      try {
        const source = audioContext.value.createBufferSource()
        const randomFile = group.currentSoundVersionGroup.getRandom()
        source.buffer = randomFile.getBuffer()
        console.log('Playing:', group.currentSoundVersionGroup.name)
        console.log('Buffer:', source.buffer)
        source.connect(audioContext.value.destination)

        source.onended = () => {
          group.isPlaying = false
        }

        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
        group.isPlaying = false
      }
    }

    const checkAnswer = async (soundVersionGroup, groupIndex) => {
      const group = soundGroups.value[groupIndex]

      await loadBuffersForGroupIfNeeded(group)

      try {
        const source = audioContext.value.createBufferSource()
        source.buffer = await soundVersionGroup.getNextBuffer(audioContext.value)
        source.connect(audioContext.value.destination)
        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
      }

      if (!group.currentSoundVersionGroup) return

      const isCorrect = soundVersionGroup.name === group.currentSoundVersionGroup.name
      soundVersionGroup.isCorrect = isCorrect

      if (isCorrect) {
        setTimeout(() => {
          group.currentSoundVersionGroup = null
          group.resetGuesses()
        }, 700)
      } else {
        setTimeout(() => {
          soundVersionGroup.isCorrect = null
        }, 700)
      }
    }

    const getButtonColor = (soundVersionGroup) => {
      if (soundVersionGroup.isCorrect === null) return 'default'
      return soundVersionGroup.isCorrect ? 'success' : 'error'
    }

    onMounted(async () => {
      try {
        audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
        await loadSoundFiles()
      } catch (error) {
        console.error('Error initializing sound game:', error)
      }
    })

    return {
      mobile,
      smAndDown,
      xs,
      isLoading,
      soundGroups,
      playLong,
      playRandomSound,
      checkAnswer,
      getButtonColor,
      errorMessage,
      dismissErrorBanner,
    }
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
.v-banner.error-banner {
  background-color: #e85f5f;
  color: white;
  font-size: 130%;
  border-radius: 10px;
  opacity: 0.9;
  width: 80%;
  margin: 0 auto;
}

@media only screen and (max-device-width: 480px) {
  .answer-btn-group .v-btn__content,
  .group-title {
    font-size: 140% !important;
  }
}
</style>
