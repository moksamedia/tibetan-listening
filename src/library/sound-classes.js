import MersenneTwister from 'mersenne-twister'
const generator = new MersenneTwister();

export class SoundFile {
    path = null
    name = null
    group = null
    version = null
    buffer = null
    speaker = null
    constructor(params) {
        console.log("SoundFile: "+JSON.stringify(params))
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
    files = [];
    constructor(name) {
        this.name = name;
    }
    addFile(soundFile) {
        this.files.push(soundFile)
    }
    getFile(index,buffer) {
        return files[index]
    }
    nextFile = 0
    getNext() {
        if (this.files.length == 0) return null;
        if (this.files.length == 1) return this.files[0]
        const next = this.files[this.nextFile]
        this.nextFile += 1
        if (this.nextFile == this.files.length) this.nextFile = 0
        return next
    }
    getNextBuffer() {
        return this.getNext().buffer
    }
    getRandom() {
        if (this.files.length == 0) return null;
        if (this.files.length == 1) return this.files[0]
        const randomIdx =  Math.floor(generator.random()*this.files.length);
        console.log(`length=${this.files.length}, randomIdx=${randomIdx}`)
        //const randomIdx = Math.floor(Math.random()*this.files.length);
        return this.files[randomIdx];
    }
    getRandomBuffer() {
        console.log(this)
        return this.getRandom()?.buffer
    }
}

// highest level class
export class SoundGroup {
    name
    currentSoundVersionGroup = null;
    isPlaying = false;
    soundVersions = []
    long = null
    constructor(name) {
        this.name = name;
    }
    setRandomCurrentSounVersionGroup() {
        const randomIndex = Math.floor(Math.random() * this.soundVersions.length);
        this.currentSoundVersionGroup = this.soundVersions[randomIndex];
    }
    resetGuesses() {
        this.soundVersions.forEach(sv => sv.isCorrect = null)
    }
    getScreenName() {
        if (this.name) return this.name
        else return this.soundVersions.map(soundVersionGroup => soundVersionGroup.name).join(" vs ")
    }
    soundVersionGroupForName(name) {
        return this.soundVersions.find(svg => svg.name == name)
    }
    pushSoundFile(name,file,speaker,buffer) {
        console.log("pushSoundFile file", file)
        console.log("buffer", buffer)
        let soundVersionGroup = this.soundVersionGroupForName(name)
        if (!soundVersionGroup) {
            soundVersionGroup = new SoundVersionGroup(name)
            soundVersionGroup.addFile(new SoundFile({path:file, speaker, buffer}))
            this.soundVersions.push(soundVersionGroup)
        }
        else {
            soundVersionGroup.addFile(new SoundFile({path:file, speaker, buffer}))
        }
        console.log("soundVersionGroup created -- " + soundVersionGroup.name)
    }
}