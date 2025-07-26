<template>
  <v-card>
    <v-card-title class="group-title">
      {{ group.getScreenName() }}
      <v-icon
        class="favorite-icon"
        :color="isFavorited ? 'yellow' : 'grey'"
        @click="toggleFavorite"
      >
        {{ isFavorited ? 'mdi-star' : 'mdi-star-outline' }}
      </v-icon>
    </v-card-title>
    <v-card-text v-if="loading" class="loading-panel">
      Loading sounds (each group loads only once when it is first played)
      <v-progress-linear indeterminate height="40" color="yellow"></v-progress-linear>
    </v-card-text>
    <v-card-text v-else>
      <v-row align="center">
        <!--
        <v-col cols="12" md="3">
          <v-select
            v-model="selectedSpeaker"
            :items="['all', ...getSpeakers()]"
            label="Select Speaker"
            dense
          ></v-select>
        </v-col>
        -->
        <v-col cols="12" md="3" class="d-flex align-center">
          <v-btn
            block
            :color="group.currentSoundVersionGroup != null ? 'primary' : 'white'"
            :loading="group.isPlaying"
            @click="handlePlayRandomSound"
            :disabled="group.isPlaying"
          >
            <v-icon left>mdi-play</v-icon>
            {{ group.currentSoundVersionGroup != null ? 'Again' : 'Random' }}
          </v-btn>
          <v-btn
            v-if="group.currentSoundVersionGroup != null"
            color="red"
            class="ml-2"
            density="comfortable"
            icon="mdi-stop"
            @click="cancelRandomSound"
          >
          </v-btn>
        </v-col>

        <v-col cols="12" md="6">
          <div class="answer-btn-group">
            <v-btn
              v-for="soundVersionGroup in group.soundVersions"
              :key="soundVersionGroup.name"
              size="x-large"
              :color="handleGetButtonColor(soundVersionGroup)"
              @click="handleCheckAnswer(soundVersionGroup)"
            >
              {{ soundVersionGroup.name }}
              <span class="num-files">{{ `(${soundVersionGroup.files.length})` }}</span>
            </v-btn>
          </div>
        </v-col>

        <v-col cols="12" md="2">
          <v-btn
            v-for="(l, idx) in group.long"
            :key="l.path"
            block
            color="secondary"
            @click="handlePlayLong(idx)"
            :density="xs ? 'comfortable' : 'default'"
            class="long-btn"
          >
            <v-icon left>mdi-play</v-icon>
            Long
          </v-btn>
        </v-col>
      </v-row>
      <v-row v-if="group.note"> {{ group.note }} </v-row>
    </v-card-text>
  </v-card>
</template>

<script>
import { defineComponent, toRefs, ref, onMounted, onUnmounted } from 'vue'

export default defineComponent({
  name: 'SoundGroupCard',
  props: {
    group: Object,
    groupIndex: Number,
    audioContext: Object,
    xs: Boolean,
    pushErrorMessage: Function,
    autoplayRandom: Boolean,
  },
  setup(props) {
    const { group, groupIndex, xs, audioContext, pushErrorMessage, autoplayRandom } = toRefs(props)
    const isFavorited = ref(false)
    const loading = ref(false)
    const selectedSpeaker = ref('all')
    let resetTimeout = null
    let autoplayTimeout = null
    let postAnswerTimeout = null
    console.log('autoplayRandom', autoplayRandom.value)
    const AUTOPLAY_TIME = 1000
    const NO_CHOICE_TIMEOUT = 15000

    const getSpeakers = () => {
      if (!group.value) return []
      const speakers = group.value.soundVersions.map((sv) => sv.getSpeakers()).flat()
      return [...new Set(speakers)]
    }

    const loadBuffersForGroupIfNeeded = async () => {
      if (group.value.needToLoadBuffers(group)) {
        console.log('Loading buffers for:', group.value.name)

        // only show loading indicator after a short delay
        const delayTimeout = setTimeout(() => {
          loading.value = true
        }, 300)

        try {
          console.assert(audioContext.value, 'No audio context')
          await group.value.loadBuffers(audioContext.value)
        } catch (error) {
          console.error('Error loading sound buffers:', error)
          group.value.isPlaying = false
          pushErrorMessage.value(`Error loading sound buffers for ${group.value.name}`)
        } finally {
          clearTimeout(delayTimeout)
          loading.value = false
        }
      } else {
        console.log('Buffers already loaded for:', group.value.name)
      }
    }

    const handlePlayLong = async (idx) => {
      await loadBuffersForGroupIfNeeded()
      try {
        const source = audioContext.value.createBufferSource()
        source.buffer = group.value.long[idx].getBuffer()
        source.connect(audioContext.value.destination)
        source.start(0)
      } catch (error) {
        console.error('Error playing sound:', error)
      }
    }

    const resetGameState = () => {
      group.value.currentSoundVersionGroup = null
      group.value.resetGuesses()
      group.value.isPlaying = false
    }

    const handlePlayRandomSound = async () => {
      if (!group.value || group.value.isPlaying) return

      group.value.resetGuesses()

      if (!group.value.currentSoundVersionGroup) {
        group.value.setRandomCurrentSounVersionGroup()
      }

      await loadBuffersForGroupIfNeeded()
      group.value.isPlaying = true

      try {
        console.assert(audioContext.value, 'No audio context')
        const randomFile = group.value.currentSoundVersionGroup.getRandom(selectedSpeaker.value)
        console.log('Playing:', group.value.currentSoundVersionGroup.name)
        
        const source = await randomFile.play({
          audioContext: audioContext.value,
          onEnded: () => {
            group.value.isPlaying = false
          }
        })

        // Set a timeout to reset the game state if no guess is made
        if (resetTimeout) clearTimeout(resetTimeout)
        resetTimeout = setTimeout(() => {
          console.log('No guess made within 30 seconds. Resetting game state.')
          resetGameState()
        }, NO_CHOICE_TIMEOUT)
      } catch (error) {
        console.error('Error playing sound:', error)
        group.value.isPlaying = false
      }
    }

    const cancelRandomSound = () => {
      group.value.isPlaying = false
      resetGameState()
    }

    const handleCheckAnswer = async (soundVersionGroup) => {
      await loadBuffersForGroupIfNeeded()

      try {
        const nextFile = soundVersionGroup.getNext()
        await nextFile.play({
          audioContext: audioContext.value
        })
      } catch (error) {
        console.error('Error playing sound:', error)
      }

      if (!group.value.currentSoundVersionGroup) return

      const isCorrect = soundVersionGroup.name === group.value.currentSoundVersionGroup.name
      soundVersionGroup.isCorrect = isCorrect

      if (isCorrect) {
        postAnswerTimeout = setTimeout(() => {
          group.value.currentSoundVersionGroup = null
          group.value.resetGuesses()
          if (autoplayRandom.value) {
            autoplayTimeout = setTimeout(() => {
              handlePlayRandomSound()
            }, AUTOPLAY_TIME)
          }
        }, 700)
      } else {
        postAnswerTimeout = setTimeout(() => {
          soundVersionGroup.isCorrect = null
        }, 700)
      }

      // Clear the reset timeout if a guess is made
      if (resetTimeout) clearTimeout(resetTimeout)
    }

    const handleGetButtonColor = (soundVersionGroup) => {
      if (soundVersionGroup.isCorrect === null) return 'default'
      return soundVersionGroup.isCorrect ? 'success' : 'error'
    }

    const toggleFavorite = () => {
      isFavorited.value = group.value.toggleFavorite()
    }

    onMounted(() => {
      isFavorited.value = group.value.isFavorite()
    })

    onUnmounted(() => {
      if (resetTimeout) clearTimeout(resetTimeout)
      if (autoplayTimeout) clearTimeout(autoplayTimeout)
      if (postAnswerTimeout) clearTimeout(postAnswerTimeout)
      group.value.isPlaying = false
    })

    return {
      handlePlayLong,
      handlePlayRandomSound,
      cancelRandomSound,
      handleCheckAnswer,
      handleGetButtonColor,
      isFavorited,
      toggleFavorite,
      loading,
      selectedSpeaker,
      getSpeakers,
    }
  },
})
</script>

<style scoped>
.loading-panel {
  text-align: center;
  font-size: 20px;
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
.group-title {
  font-size: 150% !important;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.favorite-icon {
  cursor: pointer;
}
.long-btn {
  margin: 10px;
}
</style>
