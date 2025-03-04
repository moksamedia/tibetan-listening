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
            <SoundGroupCard
              :group="group"
              :groupIndex="groupIndex"
              :audioContext="audioContext"
              :xs="xs"
              :pushErrorMessage="pushErrorMessage"
            />
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

    const loadSoundFiles = async () => {
      try {
        if (audioContext.value == null) throw Error('loadSoundFiles() No audio context')
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
