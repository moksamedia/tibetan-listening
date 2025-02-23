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
}

export class SoundVersionGroup {
  name
  isCorrect = null
  files = []
  buffersLoaded = false
  constructor(name) {
    this.name = name
  }
  async loadAudioBuffer(path, audioContext) {
    const fullPath = contextPath + path
    try {
      console.log('Loading ' + fullPath)
      const response = await fetch(fullPath)
      console.log(response)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = await audioContext.decodeAudioData(arrayBuffer)
      console.log(buffer)
      return buffer
    } catch (error) {
      console.error(`Error loading audio file ${fullPath}:`, error)
      throw error
    }
  }
  async loadBuffers(audioContext) {
    console.log('Loading buffers for ' + this.name)
    await Promise.all(
      this.files.map(async (file, index) => {
        const buffer =
          audioContext != null ? await this.loadAudioBuffer(file.path, audioContext) : null
        if (buffer == null) throw Error('Null buffer for ' + file.path)
        this.files[index].buffer = buffer
        console.log(`Loaded buffer for ${file.path}`)
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
  async getNext(audioContext) {
    if (!this.buffersLoaded) await this.loadBuffers(audioContext)
    if (this.files.length == 0) return null
    if (this.files.length == 1) return this.files[0]
    const next = this.files[this.nextFile]
    this.nextFile += 1
    if (this.nextFile == this.files.length) this.nextFile = 0
    return next
  }
  async getNextBuffer(audioContext) {
    if (!this.buffersLoaded) await this.loadBuffers(audioContext)
    return this.getNext(audioContext).buffer
  }
  async getRandom(audioContext) {
    if (!this.buffersLoaded) await this.loadBuffers(audioContext)
    if (this.files.length == 0) return null
    if (this.files.length == 1) return this.files[0]
    const randomIdx = getRandomInt(0, this.files.length - 1)
    console.log(`length=${this.files.length}, randomIdx=${randomIdx}`)
    return this.files[randomIdx]
  }
  async getRandomBuffer(audioContext) {
    if (!this.buffersLoaded) await this.loadBuffers(audioContext)
    return this.getRandom(audioContext).buffer
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
  async loadBuffers(audioContext) {
    await Promise.all(
      this.soundVersions.map(async (soundVersionGroup) => {
        if (!soundVersionGroup.buffersLoaded) await soundVersionGroup.loadBuffers(audioContext)
      }),
    )
  }
  setRandomCurrentSounVersionGroup() {
    this.loadBuffers()
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
