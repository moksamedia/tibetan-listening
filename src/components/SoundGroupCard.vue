<template>
  <v-card>
    <v-card-title class="group-title">
      {{ group.getDisplayName() }}
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
            :color="group.currentVersionGroup != null ? 'primary' : 'white'"
            :loading="group.isPlaying"
            @click="handlePlayRandomSound"
            :disabled="group.isPlaying"
          >
            <v-icon left>mdi-play</v-icon>
            {{ group.currentVersionGroup != null ? 'Again' : 'Random' }}
          </v-btn>
          <v-btn
            v-if="group.currentVersionGroup != null"
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
              v-for="versionGroup in group.versionGroups"
              :key="versionGroup.name"
              size="x-large"
              :color="handleGetButtonColor(versionGroup)"
              @click="handleCheckAnswer(versionGroup)"
            >
              {{ versionGroup.name }}
              <span class="num-files">{{ `(${versionGroup.sounds.length})` }}</span>
            </v-btn>
          </div>
        </v-col>

        <v-col cols="12" md="2">
          <v-btn
            v-for="(longSound, idx) in group.longSounds"
            :key="`${longSound.speaker}-${longSound.soundKey}`"
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
      const speakers = group.value.versionGroups.map((vg) => vg.getSpeakers()).flat()
      return [...new Set(speakers)]
    }

    const loadBuffersForGroupIfNeeded = async () => {
      // For sprite-only system, we preload sprites instead of individual buffers
      try {
        console.log('Preloading sprites for:', group.value.name)
        
        // only show loading indicator after a short delay
        const delayTimeout = setTimeout(() => {
          loading.value = true
        }, 300)

        try {
          await group.value.preloadSprites()
        } catch (error) {
          console.error('Error preloading sprites:', error)
          group.value.isPlaying = false
          pushErrorMessage.value(`Error preloading sprites for ${group.value.name}`)
        } finally {
          clearTimeout(delayTimeout)
          loading.value = false
        }
      } catch (error) {
        console.error('Error in sprite preloading:', error)
      }
    }

    const handlePlayLong = async (idx) => {
      await loadBuffersForGroupIfNeeded()
      try {
        await group.value.playLongSound(idx)
      } catch (error) {
        console.error('Error playing long sound:', error)
      }
    }

    const resetGameState = () => {
      group.value.currentVersionGroup = null
      group.value.resetStates()
      group.value.isPlaying = false
    }

    const handlePlayRandomSound = async () => {
      if (!group.value || group.value.isPlaying) return

      group.value.resetStates()

      if (!group.value.currentVersionGroup) {
        group.value.setRandomCurrentVersionGroup()
      }

      await loadBuffersForGroupIfNeeded()
      group.value.isPlaying = true

      try {
        console.assert(audioContext.value, 'No audio context')
        const randomSound = group.value.currentVersionGroup.getRandom()
        console.log('Playing:', group.value.currentVersionGroup.name)
        
        const source = await randomSound.play({
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

    const handleCheckAnswer = async (versionGroup) => {
      await loadBuffersForGroupIfNeeded()

      try {
        const nextSound = versionGroup.getNext()
        await nextSound.play()
      } catch (error) {
        console.error('Error playing sound:', error)
      }

      if (!group.value.currentVersionGroup) return

      const isCorrect = versionGroup.name === group.value.currentVersionGroup.name
      versionGroup.isCorrect = isCorrect

      if (isCorrect) {
        postAnswerTimeout = setTimeout(() => {
          group.value.currentVersionGroup = null
          group.value.resetStates()
          if (autoplayRandom.value) {
            autoplayTimeout = setTimeout(() => {
              handlePlayRandomSound()
            }, AUTOPLAY_TIME)
          }
        }, 700)
      } else {
        postAnswerTimeout = setTimeout(() => {
          versionGroup.isCorrect = null
        }, 700)
      }

      // Clear the reset timeout if a guess is made
      if (resetTimeout) clearTimeout(resetTimeout)
    }

    const handleGetButtonColor = (versionGroup) => {
      if (versionGroup.isCorrect === null) return 'default'
      return versionGroup.isCorrect ? 'success' : 'error'
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
