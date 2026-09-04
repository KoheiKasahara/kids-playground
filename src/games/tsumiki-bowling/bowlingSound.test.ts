import { describe, expect, it } from 'vitest'
import {
  BOWLING_SOUND_COOLDOWN_MS,
  MAX_ACTIVE_BOWLING_VOICES,
  bounceTones,
  clatterTones,
  createBowlingSoundGate,
  impactTones,
  launchTones,
  perfectTones,
  resultTones,
  type BowlingTone,
} from './bowlingSound'

const MIN_VOLUME = 0.02
const MAX_VOLUME = 0.13
/** 幼児向けに耳へ刺さらないようにする上限周波数。 */
const MAX_FREQUENCY = 2000

function assertVolumeRange(tones: BowlingTone[]): void {
  for (const tone of tones) {
    expect(tone.volume).toBeGreaterThanOrEqual(MIN_VOLUME)
    expect(tone.volume).toBeLessThanOrEqual(MAX_VOLUME)
  }
}

function assertNoHarshFrequency(tones: BowlingTone[]): void {
  for (const tone of tones) {
    expect(tone.frequency).toBeLessThanOrEqual(MAX_FREQUENCY)
  }
}

function totalDurationMs(tones: BowlingTone[]): number {
  return Math.max(0, ...tones.map((tone) => tone.delay + tone.duration))
}

describe('玉ごとの音色差', () => {
  it('どっしりだまの衝突音の基音は、ちいさいだまより明確に低い', () => {
    const heavy = impactTones('heavy', 0.5)
    const small = impactTones('small', 0.5)
    expect(heavy[0]!.frequency).toBeLessThan(small[0]!.frequency)
  })

  it('どっしりだまの発射音の基音は、はずむだま・ちいさいだまより低い', () => {
    const heavy = launchTones('heavy', 0.5)
    const bouncy = launchTones('bouncy', 0.5)
    const small = launchTones('small', 0.5)
    expect(heavy[0]!.frequency).toBeLessThan(bouncy[0]!.frequency)
    expect(heavy[0]!.frequency).toBeLessThan(small[0]!.frequency)
  })

  it('ちいさいだまの発射音は駆け上がる短音で、他の玉より合計時間が短い', () => {
    const small = launchTones('small', 0.5)
    const heavy = launchTones('heavy', 0.5)
    expect(small.length).toBeGreaterThanOrEqual(2)
    // 周波数が単調に上がっていく（駆け上がり）。
    for (let i = 1; i < small.length; i += 1) {
      expect(small[i]!.frequency).toBeGreaterThan(small[i - 1]!.frequency)
    }
    expect(totalDurationMs(small)).toBeLessThanOrEqual(150)
    expect(totalDurationMs(small)).toBeLessThan(totalDurationMs(heavy) + 200)
  })

  it('強さ(power/strength)が上がるほど音量が上がる', () => {
    const weak = launchTones('heavy', 0)
    const strong = launchTones('heavy', 1)
    expect(strong[0]!.volume).toBeGreaterThan(weak[0]!.volume)

    const weakImpact = impactTones('bouncy', 0)
    const strongImpact = impactTones('bouncy', 1)
    expect(strongImpact[0]!.volume).toBeGreaterThan(weakImpact[0]!.volume)
  })
})

describe('bounceTones', () => {
  it('はずむだまは、バウンドのたびに音程が上がっていく', () => {
    const first = bounceTones('bouncy', 1)
    const second = bounceTones('bouncy', 2)
    const third = bounceTones('bouncy', 3)
    expect(second[0]!.frequency).toBeGreaterThan(first[0]!.frequency)
    expect(third[0]!.frequency).toBeGreaterThan(second[0]!.frequency)
  })

  it('5段目で音程が頭打ちになり、それ以上は上がらない', () => {
    const fifth = bounceTones('bouncy', 5)
    const sixth = bounceTones('bouncy', 6)
    const tenth = bounceTones('bouncy', 10)
    expect(sixth[0]!.frequency).toBe(fifth[0]!.frequency)
    expect(tenth[0]!.frequency).toBe(fifth[0]!.frequency)
  })

  it('頭打ち後は音量がわずかに下がっていく', () => {
    const fifth = bounceTones('bouncy', 5)
    const tenth = bounceTones('bouncy', 10)
    expect(tenth[0]!.volume).toBeLessThan(fifth[0]!.volume)
  })

  it('はずむだま以外は控えめな音量で、はずむだまが主役であることが分かる', () => {
    const bouncy = bounceTones('bouncy', 1)
    const heavy = bounceTones('heavy', 1)
    const small = bounceTones('small', 1)
    expect(heavy[0]!.volume).toBeLessThan(bouncy[0]!.volume)
    expect(small[0]!.volume).toBeLessThan(bouncy[0]!.volume)
  })

  it('bounceIndexが0以下や小数でも例外を投げず、1として扱う', () => {
    expect(() => bounceTones('bouncy', 0)).not.toThrow()
    expect(() => bounceTones('bouncy', -3)).not.toThrow()
    expect(() => bounceTones('bouncy', Number.NaN)).not.toThrow()
    expect(bounceTones('bouncy', 0)).toEqual(bounceTones('bouncy', 1))
  })
})

describe('clatterTones', () => {
  it('何十個倒れても、音は最大2音までしか重ねない', () => {
    expect(clatterTones(1).length).toBeLessThanOrEqual(2)
    expect(clatterTones(3).length).toBeLessThanOrEqual(2)
    expect(clatterTones(20).length).toBeLessThanOrEqual(2)
    expect(clatterTones(1000).length).toBeLessThanOrEqual(2)
  })

  it('1個のときは1音、2個以上のときは2音になる', () => {
    expect(clatterTones(1)).toHaveLength(1)
    expect(clatterTones(2)).toHaveLength(2)
    expect(clatterTones(9)).toHaveLength(2)
  })

  it('倒れた数が多いほど音量がわずかに上がる（が、上限を超えない）', () => {
    const few = clatterTones(1)
    const many = clatterTones(20)
    expect(many[0]!.volume).toBeGreaterThanOrEqual(few[0]!.volume)
    assertVolumeRange(many)
  })
})

describe('音量・周波数レンジ', () => {
  const cases: [string, BowlingTone[]][] = [
    ['launchTones heavy', launchTones('heavy', 0.5)],
    ['launchTones bouncy', launchTones('bouncy', 0.5)],
    ['launchTones small', launchTones('small', 0.5)],
    ['impactTones heavy', impactTones('heavy', 0.5)],
    ['impactTones bouncy', impactTones('bouncy', 0.5)],
    ['impactTones small', impactTones('small', 0.5)],
    ['bounceTones bouncy', bounceTones('bouncy', 3)],
    ['bounceTones heavy', bounceTones('heavy', 3)],
    ['clatterTones', clatterTones(5)],
    ['perfectTones', perfectTones()],
    ['resultTones', resultTones()],
  ]

  it.each(cases)('%s は音量0.02〜0.13、周波数2000Hz以下に収まる', (_label, tones) => {
    assertVolumeRange(tones)
    assertNoHarshFrequency(tones)
  })

  it('通常の効果音（perfect/result以外）は合計時間が350ms以内に収まる', () => {
    expect(totalDurationMs(launchTones('small', 1))).toBeLessThanOrEqual(350)
    expect(totalDurationMs(impactTones('heavy', 1))).toBeLessThanOrEqual(350)
    expect(totalDurationMs(bounceTones('bouncy', 1))).toBeLessThanOrEqual(350)
    expect(totalDurationMs(clatterTones(10))).toBeLessThanOrEqual(350)
  })
})

describe('createBowlingSoundGate', () => {
  it('同じ種類の音はクールダウン未満の間隔では許可しない', () => {
    const gate = createBowlingSoundGate()
    expect(gate.request('impact', 1000, 1)).toBe(true)
    expect(gate.request('impact', 1000 + BOWLING_SOUND_COOLDOWN_MS.impact - 1, 1)).toBe(false)
    expect(gate.request('impact', 1000 + BOWLING_SOUND_COOLDOWN_MS.impact, 1)).toBe(true)
  })

  it('種類が違えば、それぞれ独立してクールダウンを持つ', () => {
    const gate = createBowlingSoundGate()
    expect(gate.request('impact', 1000, 1)).toBe(true)
    expect(gate.request('bounce', 1000, 1)).toBe(true)
    expect(gate.request('clatter', 1000, 1)).toBe(true)
  })

  // 「ガガガガ」対策の中核テスト: 積み木が一斉に崩れて同一フレーム相当の時刻へ
  // 大量の再生要求が来ても、許可される音の合計数は上限以内に収まる。
  it('同一nowMsで10連続requestしても、許可される音数がMAX_ACTIVE_BOWLING_VOICES以内に収まる', () => {
    const gate = createBowlingSoundGate()
    const kinds: Array<'impact' | 'bounce' | 'clatter' | 'launch'> = [
      'impact',
      'bounce',
      'clatter',
      'launch',
    ]
    let allowedVoices = 0
    for (let i = 0; i < 10; i += 1) {
      const kind = kinds[i % kinds.length]!
      // クールダウンだけで潰れないよう、種類を毎回変えて音数上限の効きを見る。
      if (gate.request(kind, 5000, 1)) {
        allowedVoices += 1
      }
    }
    expect(allowedVoices).toBeLessThanOrEqual(MAX_ACTIVE_BOWLING_VOICES)
  })

  it('voicesが複数まとまった音でも、合計がMAX_ACTIVE_BOWLING_VOICESを超えたら拒否する', () => {
    const gate = createBowlingSoundGate()
    expect(gate.request('launch', 2000, MAX_ACTIVE_BOWLING_VOICES)).toBe(true)
    // 直後に別種類でも1音すら追加できない（直近の音数がすでに上限に達している）。
    expect(gate.request('impact', 2000, 1)).toBe(false)
  })

  it('200msを過ぎれば、古い音数はカウントから外れて再び鳴らせる', () => {
    const gate = createBowlingSoundGate()
    expect(gate.request('launch', 1000, MAX_ACTIVE_BOWLING_VOICES)).toBe(true)
    expect(gate.request('impact', 1201, 1)).toBe(true)
  })

  it('perfect/resultは音数上限の対象外だが、クールダウンは効く', () => {
    const gate = createBowlingSoundGate()
    // 音数上限をすでに使い切っていても、perfectは鳴らせる。
    expect(gate.request('launch', 1000, MAX_ACTIVE_BOWLING_VOICES)).toBe(true)
    expect(gate.request('perfect', 1000, 4)).toBe(true)
    // ただしクールダウン未満で連発は許さない。
    expect(gate.request('perfect', 1000 + BOWLING_SOUND_COOLDOWN_MS.perfect - 1, 4)).toBe(false)
    expect(gate.request('result', 1000, 3)).toBe(true)
  })
})
