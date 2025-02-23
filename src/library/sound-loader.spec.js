import { 
    processWylie, 
    replaceWylieInString, 
    buildSoundGroups 
} from "./sound-loader"
import { expect, test } from 'vitest'
import soundstest from '../assets/sounds-test.json'
import { stringifyJSON } from "./utils"

test('Check replaceWylieInString', () => {
    expect(replaceWylieInString("{dpe ba } vs {'bad pa } (nouns)")).toBe("དཔེ་བ་ vs འབད་པ་ (nouns)")
    expect(replaceWylieInString("{bod} and {mtha' } and {slob sbyong }")).toBe("བོད and མཐའ་ and སློབ་སྦྱོང་")

})

test('Check wylie replacement in JSON', () => {
    expect(replaceWylieInString("རྟོག་པ་ vs ལྡོག་པ་ (verbs) {rtogs pa }")).toBe("རྟོག་པ་ vs ལྡོག་པ་ (verbs) རྟོགས་པ་")
    expect(replaceWylieInString("/khelsang/{rtog pa }_1")).toBe("/khelsang/རྟོག་པ་_1")

    const processedJson = processWylie(soundstest)
    expect(processedJson[0].name).toBe("རྟོག་པ་ vs ལྡོག་པ་ (verbs) རྟོགས་པ་")
    expect(processedJson[0].versionGroups[0].name).toBe("ལྡོག་པ་")
    expect(processedJson[0].versionGroups[1].name).toBe("bob")

    expect(processedJson[0].versionGroups[0].files[0]).toBe("/khelsang/ལྡོག་པ་_1")
    expect(processedJson[0].versionGroups[0].files[1]).toBe("/khelsang/ལྡོག་པ་_2")

    expect(processedJson[0].versionGroups[1].files[0]).toBe("/khelsang/རྟོགས་པ་_1")
    expect(processedJson[0].versionGroups[1].files[1]).toBe("/khelsang/རྟོགས་པ་_2")
})

test('Build sound groups', async () => {
    const processedJson = processWylie(soundstest)
    const result = await buildSoundGroups(processedJson)
    console.log("result", stringifyJSON(result))
    expect(result.length).toBe(2)
    const [sg1, sg2] = result
    expect(sg1.name).toBe("རྟོག་པ་ vs ལྡོག་པ་ (verbs) རྟོགས་པ་")
    expect(sg2.name).toBe("དཔེ་བ་ vs འབད་པ་ (nouns)")

    expect(sg1.soundVersions.length).toBe(2)
    expect(sg2.soundVersions.length).toBe(3)

    expect(sg2.soundVersions[0].files.length).toBe(2)
    expect(sg2.soundVersions[1].files.length).toBe(1)
    expect(sg2.soundVersions[2].files.length).toBe(3)
})