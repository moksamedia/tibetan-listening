import jsEWTS from "./jsewts";
import sounds from '../assets/sounds.json'
import {SoundFile, SoundVersionGroup, SoundGroup} from '../library/sound-classes'

export const rawJson = sounds

const contextPath = process.env.NODE_ENV == "production" ? "/utils/sounds/" : "/sounds/"

export function replaceWylieInString(string) {
    console.log("replaceWylieInString:" + string)
    const match = string.match(/({([^{]*)})/);
    if (match) {
        const [full, withBrackets, wylie] = match;
        console.log(match)
        const unicode = jsEWTS.fromWylie(wylie)
        const newString = string.replace(full, unicode)
        console.log("replaceWylieInString: " + newString)
        return replaceWylieInString(newString)
    }
    else return string
}

export function getSpeakerFromFilePath(path) {
    const match = path.match(/\/?(.*)\//);
    const [full, speaker] = match;
    return speaker ? speaker : null
}

export function processWylie(json) {
    console.log(json)
    let newJson = json
    json.forEach( (soundGroup, index) => {
        json[index].name = replaceWylieInString(soundGroup.name)
        if (soundGroup.versionGroups) {
            soundGroup.versionGroups.forEach((vg, j) => {
                json[index].versionGroups[j].name = replaceWylieInString(vg.name)
                vg.files.forEach((file, k) => {
                    json[index].versionGroups[j].files[k] = replaceWylieInString(file)
                })
            })
        }
    })
    return newJson
}

async function loadAudioBuffer(path, audioContext) {
    const fullPath = contextPath + path
    try {
        console.log("Loading " + fullPath)
        const response = await fetch(fullPath);
        console.log(response)
        const arrayBuffer = await response.arrayBuffer();
        const buffer =  await audioContext.decodeAudioData(arrayBuffer);
        console.log(buffer)
        return buffer;
    } 
    catch (error) {
      console.error(`Error loading audio file ${fullPath}:`, error);
      throw error;
    }
}

export async function buildSoundGroups(json, audioContext) {
    let soundGroups =
    await Promise.all(json.map(async (sg) => {
        const soundGroupObj = new SoundGroup(sg.name)
        const longFile = sg.long
        const longBuffer = audioContext != null ? await loadAudioBuffer(longFile, audioContext) : null
        soundGroupObj.long = longBuffer
        
        /*
            Can build the json dynamically from a pattern, assuming all version groups
            have the same number of files and are named appropriate.
            
            Assumptions:
            - name is in format: {sound1} vs {sound2} vs {sound3}
            - file names are "{sound1} 1.mp3" "{sound1} 2.mp3" etc.
            - speaker name path can be pulled from long file
            - all sounds have an equal number of files set by applyPattern
        */
        if (sg.applyPattern) {
            console.log("Applying pattern " + sg.applyPattern)
            let sounds = sg.name.split(" vs ")
            // remove any non-tibetan chars from final sound name
            // to remove any final notes, such as " (noun)"
            sounds = sounds.map(s => s.replace(/[^\u0f00-\u0fff]*/g,""))
            const numFiles = sg.applyPattern
            sg.versionGroups = []
            sounds.forEach(soundName => {
                // create the version group

                const speaker = getSpeakerFromFilePath(sg.long)

                const files = []
                for (let c=0;c<numFiles;c++) {
                    files.push(`${speaker}/${soundName} ${c+1}.mp3`)
                }

                sg.versionGroups.push({
                    name:soundName,
                    files:files
                })
            })
        }
        await Promise.all(sg.versionGroups.map(async (vg) => {
            await Promise.all(vg.files.map(async (file) => {
                const speaker = getSpeakerFromFilePath(file)
                const buffer = audioContext != null ? await loadAudioBuffer(file, audioContext) : null
                if (buffer == null) throw Error("Null buffer")
                soundGroupObj.pushSoundFile(vg.name,file,speaker,buffer);
            }));
        }));
        return soundGroupObj;
    }));
    console.log(soundGroups)
    return soundGroups;
}

export async function getSoundGroups(audioContext) {
    const processedJson = processWylie(sounds)
    return await buildSoundGroups(processedJson, audioContext)
}