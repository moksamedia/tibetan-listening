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
          <p>
            The sounds for each group are loaded when you first click on a sound in the group, so
            there might be a delay the first time you play a sound in a group.
          </p>
          <p v-if="usingSprites" class="sprite-info">
            🎵 <strong>Audio sprites enabled!</strong> Sounds are loaded from optimized sprite files for faster performance.
            <span v-if="spriteStats">({{ spriteStats.loadedSpeakers }}/{{ spriteStats.totalSpeakers }} speakers loaded)</span>
          </p>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="6" class="text-right">
          <v-switch v-model="showFavoritesOnly" label="Show Favorites Only" class="mt-4"></v-switch>
        </v-col>
        <v-col cols="6" class="text-right">
          <v-switch
            v-model="autoplayRandom"
            label="Autoplay on correct choice"
            class="mt-4"
          ></v-switch>
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
          v-for="(group, groupIndex) in filteredSoundGroups"
          :key="group.name + groupIndex"
          class="mt-4"
        >
          <v-col cols="12">
            <SoundGroupCard
              :group="group"
              :groupIndex="groupIndex"
              :audioContext="audioContext"
              :xs="xs"
              :pushErrorMessage="pushErrorMessage"
              :autoplayRandom="autoplayRandom"
            />
          </v-col>
        </v-row>
      </template>
    </v-container>
  </v-main>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { getSoundGroups, getSpriteStats } from '../library/sprite-only-sound-loader'
import { useDisplay } from 'vuetify'
import SoundGroupCard from '../components/SoundGroupCard.vue'

export default {
  name: 'SoundGame',
  components: {
    SoundGroupCard,
  },
  setup() {
    const { mobile, smAndDown, xs } = useDisplay()
    const isLoading = ref(true)
    const soundGroups = ref([])
    const audioContext = ref(null)
    const errorMessage = ref(null)
    const showFavoritesOnly = ref(false)
    const autoplayRandom = ref(true)
    const usingSprites = ref(false)
    const spriteStats = ref(null)

    const loadSoundFiles = async () => {
      try {
        if (audioContext.value == null) throw Error('loadSoundFiles() No audio context')
        soundGroups.value = await getSoundGroups(audioContext.value)
        console.log('soundGroups', soundGroups.value)
        
        // Update sprite information (always true for sprite-only system)
        usingSprites.value = true
        spriteStats.value = getSpriteStats()
        console.log('🎵 Using sprite-only audio system:', spriteStats.value)
        
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

    const filteredSoundGroups = computed(() => {
      if (showFavoritesOnly.value) {
        return soundGroups.value.filter((group) => group.isFavorite())
      }
      return soundGroups.value
    })

    onMounted(async () => {
      try {
        audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
        console.assert(audioContext.value, 'No audio context')
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
      audioContext,
      errorMessage,
      dismissErrorBanner,
      pushErrorMessage,
      showFavoritesOnly,
      filteredSoundGroups,
      autoplayRandom,
      usingSprites,
      spriteStats,
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

.sprite-info {
  background-color: #e8f5e8;
  padding: 10px;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
  font-size: 110%;
  margin-top: 10px;
}

@media only screen and (max-device-width: 480px) {
  .answer-btn-group .v-btn__content,
  .group-title {
    font-size: 140% !important;
  }
}
</style>
