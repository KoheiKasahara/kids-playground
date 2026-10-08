/**
 * ゲームごとの音量補正 [dB]。共通の出口（sound.ts の getSoundOutput）がこの値で音量を上げ下げし、
 * どのゲームでも同じくらいの大きさで聞こえるようにする。
 *
 * そろえる基準は「そのゲームでいちばん大きい代表音」（せいかい・クリア・ファンファーレなど）。
 * 代表音は src/test/audio/gameSoundSamples.ts に並べ、`src/audio/gameSoundLevels.test.ts` が
 * 実際に描き起こして騒音計と同じ方法（A特性・Fast の最大値）で測る。
 * 値は手で決めず、ゲームを足したり効果音を変えたりしてテストが失敗したら、
 * 失敗メッセージに出る「おすすめの補正値」をここへ書く。補正が 0 のゲームは書かなくてよい。
 */

/** 各ゲームのいちばん大きい代表音の目標の大きさ [dB(A), フルスケールの 1kHz 正弦波が -3]。 */
export const SOUND_LOUDNESS_TARGET_DB = -21

/** 目標からのずれの許容幅 [dB]。これより大きくずれたら補正値を見直す。 */
export const SOUND_LOUDNESS_TOLERANCE_DB = 1.5

export const GAME_SOUND_LEVEL_DB: Readonly<Record<string, number>> = {
  'bento-builder': 9,
  'block-puzzle': 3,
  'car-road-builder': 3.5,
  'circuit-racing': 4.5,
  'color-paint-puzzle': 3,
  'crane-game': 12,
  'domino-flag': -1,
  'dot-adventure': 4.5,
  'dot-aquarium': 7.5,
  'dot-bomb': 5,
  'dot-monster-farm': 9,
  'dot-run': 6.5,
  'dot-zoo': 10,
  'earth-globe': 13,
  'forest-delivery': 11,
  'hoshi-tsunagi': 2.5,
  'jishaku-pitatto': 7.5,
  'koma-battle': 2.5,
  'kurukuru-rokuro': 4,
  'magic-sandbox': 8,
  'mato-ate': 7.5,
  'oekaki-korokoro': 8.5,
  'onaji-pon': 1.5,
  'origami-play': 14,
  'piano-play': 9,
  'pixel-kart': 14,
  'planet-globe': 12,
  'pukupuka-rescue': 5,
  'puni-slime': 21,
  'putter-golf': 10,
  'rail-builder': 16.5,
  'rhythm-pon': 6,
  'robo-kuzushi': 7.5,
  'shabon-pachin': 1.5,
  shinkeisuijaku: -1,
  'snowball-roll': 8,
  'train-journey': 15,
  'treasure-dig': 10.5,
  'tsumiki-3d': 9,
  'tsumiki-bowling': 5,
  'water-wheel-maze': 12,
}

/** ゲームidの音量補正 [dB]。ゲーム外や未登録のゲームでは 0（補正なし）。 */
export function gameSoundLevelDb(gameId: string | undefined): number {
  if (gameId === undefined) return 0
  return GAME_SOUND_LEVEL_DB[gameId] ?? 0
}
