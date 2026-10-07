import { describe, expect, test } from 'vitest'
import { conversationFor, moodsAt, SPEAKER_NAMES, type Conversation } from './dialogue'
import { createWorld, getObjective, interactOnArrival, STAGES, targetPoi, updateWorld, type World } from './model'

function arrive(world: World, id: Parameters<typeof targetPoi>[1]) {
  targetPoi(world, id)
  for (let frame = 0; world.path.length > 0 && frame < 1000; frame += 1) updateWorld(world, 0.1)
  return interactOnArrival(world)!
}

function expectWellFormed(conversation: Conversation | null) {
  expect(conversation).not.toBeNull()
  expect(conversation!.lines.length).toBeGreaterThan(1)
  for (const line of conversation!.lines) {
    expect(line.text.trim()).not.toBe('')
    expect([conversation!.partner, 'fox']).toContain(line.speaker)
    expect(SPEAKER_NAMES[line.speaker]).toBeTruthy()
  }
}

describe('おはなし', () => {
  test.each(STAGES.map((stage, index) => [stage.name, index] as const))('%s: ゆうびんやさんと どうぶつにだけ 話しかけ、ものを拾うときは地図のまま', (_, index) => {
    const world = createWorld(index)
    const talks: Conversation[] = []
    for (let step = 0; !world.completed && step < 20; step += 1) {
      const event = arrive(world, getObjective(world).targetId!)
      const conversation = conversationFor(world, event)
      if (event.poiId === 'post' || event.type === 'deliver' || event.type === 'complete') {
        expectWellFormed(conversation)
        talks.push(conversation!)
      } else expect(conversation).toBeNull()
    }
    expect(world.completed).toBe(true)
    expect(talks.map((talk) => talk.partner)).toEqual(['owl', ...STAGES[index].deliveries])
    // The finale is a longer goodbye than an ordinary delivery.
    expect(talks.at(-1)!.lines.length).toBeGreaterThan(talks.at(-2)!.lines.length)
  })

  test('あいさつは季節で変わり、はしが こわれていると こまった顔で 教えてくれる', () => {
    const spring = conversationFor(createWorld(0), { type: 'collect', text: '', poiId: 'post' })!
    expect(spring.lines[0].text).toContain('おはよう')
    expect(spring.lines.some((line) => line.speaker === 'owl' && line.mood === 'worried' && line.text.includes('はし'))).toBe(true)
    const dusk = createWorld(2)
    dusk.flags.bridgeRepaired = true
    const night = conversationFor(dusk, { type: 'collect', text: '', poiId: 'post' })!
    expect(night.lines[0].text).toContain('こんばんは')
    expect(night.lines.some((line) => line.mood === 'worried')).toBe(false)
  })

  test('品物がないと お願い、届けたあとは お礼、今日の相手でなければ おさんぽの話', () => {
    const world = createWorld(0)
    world.flags.bridgeRepaired = true
    const request = conversationFor(world, { type: 'none', text: '', poiId: 'rabbit' })!
    expect(request.partner).toBe('rabbit')
    expect(request.lines[0]).toMatchObject({ speaker: 'rabbit', mood: 'worried' })
    world.delivered.push('rabbit')
    expect(conversationFor(world, { type: 'none', text: '', poiId: 'rabbit' })!.lines[0]).toMatchObject({ speaker: 'rabbit', mood: 'happy' })
    expectWellFormed(conversationFor(world, { type: 'none', text: '', poiId: 'bear' }))
    expect(conversationFor(world, { type: 'none', text: '', poiId: 'bear' })!.lines[1].text).toContain('おさんぽ')
    expect(conversationFor(world, { type: 'collect', text: '', poiId: 'wood' })).toBeNull()
  })

  test('話していない人は さいごの表情のまま', () => {
    const conversation = conversationFor(createWorld(0), { type: 'collect', text: '', poiId: 'post' })!
    const foxLine = conversation.lines.findIndex((line) => line.speaker === 'fox')
    const moods = moodsAt(conversation, foxLine)
    expect(moods.owl).toBe(conversation.lines[foxLine - 1].mood)
    expect(moodsAt(conversation, 0).fox).toBe('normal')
  })
})
