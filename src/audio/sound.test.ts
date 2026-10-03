import { describe, expect, it } from 'vitest'
import { FakeAudioContext, FakeDynamicsCompressorNode, FakeGainNode } from '../test/audio/fakeAudioContext'
import { GAME_SOUND_LEVEL_DB } from './gameSoundLevels'
import { getSoundOutput, setActiveSoundGame } from './sound'

const asAudioContext = (ctx: FakeAudioContext) => ctx as unknown as AudioContext

describe('shared sound output', () => {
  it('reuses one gain + limiter chain per AudioContext and only the limiter reaches the speakers', () => {
    const ctx = new FakeAudioContext()
    const output = getSoundOutput(asAudioContext(ctx)) as unknown as FakeGainNode
    expect(getSoundOutput(asAudioContext(ctx))).toBe(output)
    expect(output).toBeInstanceOf(FakeGainNode)
    const limiter = output.outputs[0]!.to
    expect(limiter).toBeInstanceOf(FakeDynamicsCompressorNode)
    expect(ctx.destination.inputs.map((connection) => connection.from)).toEqual([limiter])
  })

  it('applies the playing game level to every context, including ones created later', () => {
    const [gameId, levelDb] = Object.entries(GAME_SOUND_LEVEL_DB).find(([, db]) => db > 0)!
    const before = new FakeAudioContext()
    const outputBefore = getSoundOutput(asAudioContext(before)) as unknown as FakeGainNode
    setActiveSoundGame(gameId)
    expect(outputBefore.gain.value).toBeCloseTo(10 ** (levelDb / 20))
    const after = new FakeAudioContext()
    expect((getSoundOutput(asAudioContext(after)) as unknown as FakeGainNode).gain.value).toBeCloseTo(10 ** (levelDb / 20))
    setActiveSoundGame(undefined)
    expect(outputBefore.gain.value).toBe(1)
  })

  it('falls back to the speakers when the context cannot build nodes', () => {
    const destination = {}
    const broken = { destination, createGain: () => { throw new Error('unsupported') } } as unknown as AudioContext
    expect(getSoundOutput(broken)).toBe(destination)
  })
})
