import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { installFakeAudio, measureSample, type SoundMeasurement } from '../test/audio/soundMeter'
import type { FakeAudioContext } from '../test/audio/fakeAudioContext'
import { GAME_SOUND_SAMPLES } from '../test/audio/gameSoundSamples'
import { GAME_CATALOG } from '../games/gameCatalog'
import { GAME_SOUND_LEVEL_DB, SOUND_LOUDNESS_TARGET_DB, SOUND_LOUDNESS_TOLERANCE_DB } from './gameSoundLevels'

/** 代表音のうち小さい音も、目標からこれ以上は小さくしない（小さすぎて「音がない」と感じさせない）。 */
const QUIETEST_SOUND_BELOW_TARGET_DB = 20
/** BGM・走行音は効果音を邪魔しないよう、目標よりこれ以上小さくする。 */
const BACKGROUND_BELOW_TARGET_DB = 3
/** 補正後もリミッターに頼らず波形が割れないこと [dBFS]。 */
const MAX_PEAK_DBFS = -1

type GameReport = {
  gameId: string
  /** いちばん大きい代表音 [dB]。ゲームの大きさはこれでそろえる。 */
  loudest: number
  trim: number
  sounds: SoundMeasurement[]
  background: SoundMeasurement[]
}

let ctx: FakeAudioContext
const reports = new Map<string, GameReport>()

function measureGame(gameId: string): GameReport {
  const cached = reports.get(gameId)
  if (cached) return cached
  const sounds: SoundMeasurement[] = []
  const background: SoundMeasurement[] = []
  for (const sample of GAME_SOUND_SAMPLES[gameId] ?? []) {
    const measurement = measureSample(ctx, sample)
    if (sample.background) background.push(measurement)
    else sounds.push(measurement)
  }
  const report = {
    gameId,
    loudest: Math.max(...sounds.map((sound) => sound.level)),
    trim: GAME_SOUND_LEVEL_DB[gameId] ?? 0,
    sounds,
    background,
  }
  reports.set(gameId, report)
  return report
}

const describeSounds = (sounds: SoundMeasurement[], trim: number) =>
  sounds.map((sound) => `${sound.name} ${(sound.level + trim).toFixed(1)}`).join(', ')

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] })
  ctx = installFakeAudio()
})

afterAll(() => {
  // PRINT_SOUND_LEVELS=1 npx vitest run src/audio/gameSoundLevels.test.ts で、補正後の大きさの一覧を出せる。
  if (process.env.PRINT_SOUND_LEVELS) {
    const rows = [...reports.values()].sort((a, b) => a.loudest + a.trim - (b.loudest + b.trim))
    console.log(rows.map((row) => [
      row.gameId.padEnd(22),
      `loudest ${row.loudest.toFixed(1).padStart(6)}`,
      `trim ${row.trim.toFixed(1).padStart(5)}`,
      `→ ${(row.loudest + row.trim).toFixed(1).padStart(6)}`,
      `| ${describeSounds(row.sounds, row.trim)}`,
      row.background.length ? `| bg ${describeSounds(row.background, row.trim)}` : '',
    ].join(' ')).join('\n'))
  }
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('game sound loudness', () => {
  const gameIds = GAME_CATALOG.map((game) => game.id)

  it.each(gameIds)('%s registers representative sounds that actually play', (gameId) => {
    const samples = GAME_SOUND_SAMPLES[gameId]
    expect(samples, `${gameId} の代表的な効果音を src/test/audio/gameSoundSamples.ts に登録してください（音のないゲームはつくらない）`).toBeDefined()
    expect(samples!.filter((sample) => !sample.background).length).toBeGreaterThan(0)
    const report = measureGame(gameId)
    for (const sound of [...report.sounds, ...report.background]) {
      expect(sound.level, `${gameId}「${sound.name}」が鳴っていません`).toBeGreaterThan(-80)
    }
  })

  it.each(gameIds)('%s sounds about as loud as the other games', (gameId) => {
    const report = measureGame(gameId)
    const adjusted = report.loudest + report.trim
    const suggested = Math.round((SOUND_LOUDNESS_TARGET_DB - report.loudest) * 2) / 2
    expect(
      Math.abs(adjusted - SOUND_LOUDNESS_TARGET_DB),
      `${gameId} のいちばん大きい代表音は補正後 ${adjusted.toFixed(1)} dB（目標 ${SOUND_LOUDNESS_TARGET_DB} dB）。`
        + ` src/audio/gameSoundLevels.ts の GAME_SOUND_LEVEL_DB に '${gameId}': ${suggested} と書いてください。`,
    ).toBeLessThanOrEqual(SOUND_LOUDNESS_TOLERANCE_DB)
  })

  it.each(gameIds)('%s keeps every representative sound audible and unclipped', (gameId) => {
    const report = measureGame(gameId)
    for (const sound of report.sounds) {
      expect(
        sound.level + report.trim,
        `${gameId}「${sound.name}」が小さすぎます。効果音の音量（volume）を上げてください。`,
      ).toBeGreaterThanOrEqual(SOUND_LOUDNESS_TARGET_DB - QUIETEST_SOUND_BELOW_TARGET_DB)
    }
    for (const sound of [...report.sounds, ...report.background]) {
      expect(sound.peakDb + report.trim, `${gameId}「${sound.name}」は補正後に波形が割れます`).toBeLessThanOrEqual(MAX_PEAK_DBFS)
    }
  })

  it.each(gameIds)('%s keeps music and engine sounds under the sound effects', (gameId) => {
    const report = measureGame(gameId)
    for (const sound of report.background) {
      expect(
        sound.level + report.trim,
        `${gameId}「${sound.name}」（鳴り続ける音）が大きすぎます`,
      ).toBeLessThanOrEqual(SOUND_LOUDNESS_TARGET_DB - BACKGROUND_BELOW_TARGET_DB)
    }
  })

  it('keeps the tables limited to real games', () => {
    const ids = new Set(gameIds)
    expect(Object.keys(GAME_SOUND_LEVEL_DB).filter((id) => !ids.has(id))).toEqual([])
    expect(Object.keys(GAME_SOUND_SAMPLES).filter((id) => !ids.has(id))).toEqual([])
  })
})

describe('sound routing', () => {
  const root = join(__dirname, '..')
  const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })

  it('connects every sound to the shared output instead of the speakers directly', () => {
    const offenders = sourceFiles(root)
      .filter((path) => relative(root, path) !== join('audio', 'sound.ts'))
      .filter((path) => /\.destination\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path))
    expect(offenders, 'ctx.destination ではなく getSoundOutput(ctx) へつないでください（音量補正とリミッターが効かなくなります）').toEqual([])
  })

  it('creates AudioContexts and audio elements only in the shared audio modules', () => {
    // ピアノは録音音源の読み込みと破棄を自分で管理するため、自前の Context を持つ（出口は共通）。
    const allowed = new Set([join('audio', 'sound.ts'), join('games', 'shared', 'music', 'pianoAudio.ts')])
    const offenders = sourceFiles(root)
      .filter((path) => !allowed.has(relative(root, path)))
      .filter((path) => /\bwebkitAudioContext\b|\bnew\s+(window\.)?AudioContext\b|\bnew\s+Audio\(|<audio\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path))
    expect(offenders, 'getSharedAudioContext() を使い回してください').toEqual([])
  })
})
