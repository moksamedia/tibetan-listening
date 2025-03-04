function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

import { contextPath } from './sound-loader'

export class SoundFile {
  path = null
  name = null
  group = null
  version = null
  buffer = null
  speaker = null
  constructor(params) {
    console.log('SoundFile: ' + JSON.stringify(params))
    this.path = params.path
    this.name = params.name
    this.group = params.group
    this.version = params.version
    this.speaker = params.speaker
    this.buffer = params.buffer
  }
  getBuffer() {
    if (this.buffer == null) {
      console.log('Buffer is null for ' + this.path)
      throw Error('Buffer is null for ' + this.path)
    }
    return this.buffer
  }
  setBuffer(b) {
    this.buffer = b
  }
}

const loadAudioBuffer = async (path, audioContext) => {
  console.assert(audioContext != null, 'loadAudioBuffer() audioContext is null')
  const fullPath = contextPath + path
  try {
    console.log('Loading ' + fullPath)
    const response = await fetch(fullPath)
    console.log(response)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = await audioContext.decodeAudioData(arrayBuffer)
    console.assert(buffer != null, 'Buffer is null for ' + fullPath)
    console.log(buffer)
    return buffer
  } catch (error) {
    console.error(`Error loading audio file ${fullPath}:`, error)
    throw error
  }
}

export class SoundVersionGroup {
  name
  isCorrect = null
  files = []
  constructor(name) {
    this.name = name
  }
  needToLoadBuffers() {
    return this.files.find((file) => file.buffer == null)
  }
  async loadBuffers(audioContext) {
    console.log('Loading buffers for ' + this.name)
    await Promise.all(
      this.files.map(async (file, index) => {
        if (this.files[index].buffer == null) {
          const buffer =
            audioContext != null ? await loadAudioBuffer(file.path, audioContext) : null
          if (buffer == null) throw Error('Null buffer for ' + file.path)
          this.files[index].setBuffer(buffer)
          console.log(`Loaded buffer for ${file.path}`)
        }
      }),
    )
    console.log('Buffers loaded')
    this.buffersLoaded = true
  }
  addFile(soundFile) {
    this.files.push(soundFile)
  }
  getFile(index) {
    return this.files[index]
  }
  nextFile = 0
  getNext() {
    if (this.files.length == 0) return null
    if (this.files.length == 1) return this.files[0]
    const next = this.files[this.nextFile]
    this.nextFile += 1
    if (this.nextFile == this.files.length) this.nextFile = 0
    return next
  }
  getNextBuffer() {
    return this.getNext().getBuffer()
  }
  getRandom() {
    if (this.files.length == 0) return null
    if (this.files.length == 1) return this.files[0]
    const randomIdx = getRandomInt(0, this.files.length - 1)
    console.log(`length=${this.files.length}, randomIdx=${randomIdx}`)
    return this.files[randomIdx]
  }
  getRandomBuffer() {
    return this.getRandom().getBuffer()
  }
}

// highest level class
export class SoundGroup {
  name
  currentSoundVersionGroup = null
  isPlaying = false
  soundVersions = []
  long = null
  constructor(name) {
    this.name = name
  }
  needToLoadBuffers() {
    return this.soundVersions.find((sv) => sv.needToLoadBuffers() != null)
  }
  async loadBuffers(audioContext) {
    await Promise.all(
      this.soundVersions.map(async (soundVersionGroup) => {
        await soundVersionGroup.loadBuffers(audioContext)
      }),
    )
    const longBuffer = await loadAudioBuffer(this.long.path, audioContext)
    this.long.setBuffer(longBuffer)
    console.assert(
      this.long.buffer != null,
      `Long buffer is null for ${this.name}, path ${this.long.path}`,
    )
  }
  setRandomCurrentSounVersionGroup() {
    const randomIndex = Math.floor(Math.random() * this.soundVersions.length)
    this.currentSoundVersionGroup = this.soundVersions[randomIndex]
  }
  resetGuesses() {
    this.soundVersions.forEach((sv) => (sv.isCorrect = null))
  }
  getScreenName() {
    if (this.name) return this.name
    else return this.soundVersions.map((soundVersionGroup) => soundVersionGroup.name).join(' vs ')
  }
  soundVersionGroupForName(name) {
    return this.soundVersions.find((svg) => svg.name == name)
  }
  isFavorite() {
    return localStorage.getItem(`favorite-${this.name}`) === 'true'
  }
  toggleFavorite() {
    const newValue = this.isFavorite() ? 'false' : 'true'
    localStorage.setItem(`favorite-${this.name}`, newValue)
    return this.isFavorite()
  }
  pushSoundFile(name, file, speaker, buffer) {
    console.log('pushSoundFile file', file)
    console.log('buffer', buffer)
    let soundVersionGroup = this.soundVersionGroupForName(name)
    if (!soundVersionGroup) {
      soundVersionGroup = new SoundVersionGroup(name)
      soundVersionGroup.addFile(new SoundFile({ path: file, speaker, buffer }))
      this.soundVersions.push(soundVersionGroup)
    } else {
      soundVersionGroup.addFile(new SoundFile({ path: file, speaker, buffer }))
    }
    console.log('soundVersionGroup created -- ' + soundVersionGroup.name)
  }
}
