import { describe, expect, test } from 'vitest'
import { allDone, applyObservation, createMissions, isWanted, matches, missionText, MISSIONS_PER_SET } from './missions'
import { SPECIES } from './species'
import { stampKinds, type Zukan } from './zukan'
import { AREAS, areaById, speciesOfArea } from './zooMap'

function seq(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('しいくいんさんの おねがい', () => {
  test.each(AREAS)('$name: えさ・とくいわざ・みる を1つずつ、このエリアの ちがう動物で出す', area => {
    const here = speciesOfArea(area)
    for (let seed = 0; seed < 20; seed++) {
      const set = createMissions(area.id, here, {}, seq(((seed * 7) % 20) / 20, ((seed * 13) % 20) / 20, ((seed * 3) % 20) / 20))
      expect(set.missions).toHaveLength(MISSIONS_PER_SET)
      expect(set.done).toEqual([false, false, false])
      const [feed, special, watch] = set.missions
      expect(feed.kind).toBe('feed')
      expect(SPECIES[special.species!].specials.map(s => s.clip)).toContain(special.kind)
      expect(['see', 'sleep']).toContain(watch.kind)
      const named = set.missions.flatMap(m => (m.species ? [m.species] : []))
      expect(new Set(named).size).toBe(named.length)
      for (const id of named) expect(here).toContain(id)
    }
  })

  test('まだ スタンプのない お題を 選びやすい', () => {
    const area = areaById('savanna')
    const here = speciesOfArea(area)
    // ゾウ以外の えさスタンプは もう持っている
    const zukan: Zukan = Object.fromEntries(here.filter(id => id !== 'elephant').map(id => [id, ['feed']]))
    let elephant = 0
    for (let i = 0; i < 200; i++) {
      const set = createMissions(area.id, here, zukan, seq(i / 200, 0.5, 0.5))
      if (set.missions[0].species === 'elephant') elephant++
    }
    // 重みは 4:1。7種なら ゾウは 4/(4+6) = 40% ほど（等しく選ぶと 1/7）
    expect(elephant / 200).toBeGreaterThan(0.3)
  })

  test('観察の知らせで お題が できて、ぜんぶ できたら おわり', () => {
    let set = createMissions('farm', ['pig', 'horse', 'rabbit'], {}, seq(0, 0, 0.99))
    const [feed, special, watch] = set.missions
    expect(feed).toEqual({ species: 'pig', kind: 'feed' })
    expect(special.species).toBe('horse')
    expect(watch).toEqual({ species: null, kind: 'sleep' })
    expect(isWanted(set, 'horse', special.kind)).toBe(true)
    expect(isWanted(set, 'rabbit', special.kind)).toBe(false)

    // ちがう動物・ちがう こと では できない
    expect(applyObservation(set, 'horse', 'feed').completed).toEqual([])
    let r = applyObservation(set, 'pig', 'feed')
    expect(r.completed).toEqual([0])
    set = r.set
    // 同じ お題は 2回 できない
    expect(applyObservation(set, 'pig', 'feed').completed).toEqual([])
    expect(isWanted(set, 'pig', 'feed')).toBe(false)
    // ねている どうぶつは、どの動物でも よい
    r = applyObservation(set, 'rabbit', 'sleep')
    expect(r.completed).toEqual([2])
    set = r.set
    expect(allDone(set)).toBe(false)
    set = applyObservation(set, 'horse', special.kind).set
    expect(allDone(set)).toBe(true)
  })

  test('お題の文は ひらがな中心で、動物の名前・えさ・わざの名前が入る', () => {
    expect(matches({ species: null, kind: 'sleep' }, 'lion', 'sleep')).toBe(true)
    expect(missionText({ species: 'pig', kind: 'feed' })).toEqual({ emoji: '🌽', text: 'ブタに とうもろこしを あげよう' })
    expect(missionText({ species: 'raccoon', kind: 'Wash' }).text).toBe('アライグマの「てあらい」を みつけよう')
    expect(missionText({ species: 'horse', kind: 'see' }).text).toBe('ウマを ちかくで よく みよう')
    expect(missionText({ species: null, kind: 'sleep' }).text).toBe('ねている どうぶつを みつけよう')
    // お題は すべて スタンプと同じ種類の できごとから作る（観察の知らせで判定できる）
    for (const area of AREAS) {
      for (const m of createMissions(area.id, speciesOfArea(area), {}).missions) {
        if (m.species) expect(stampKinds(m.species)).toContain(m.kind)
      }
    }
  })
})
