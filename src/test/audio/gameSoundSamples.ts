/**
 * 音量をそろえるために測る、ゲームごとの「代表的な効果音」。
 * gameSoundLevels.test.ts がここに並んだ音を実際に描き起こして大きさを測り、
 * ゲームどうしの大きさの差を src/audio/gameSoundLevels.ts の補正値でそろえる。
 *
 * ゲームを追加したら、そのゲームでよく鳴る音（タップ・せいかい・クリアなど）をここへ足す。
 * かべ・バンパー・ドミノのカタカタのように連打で鳴る細かい音は、わざと控えめなので入れない。
 * BGM や走行音のように鳴り続ける音は background: true にする（効果音より小さいことだけ確かめる）。
 */
import type { SoundSample } from './soundMeter'
import * as quiz from '../../utils/quizSound'
import { PianoAudioEngine } from '../../games/shared/music/pianoAudio'
import { PIANO_NOTES } from '../../games/shared/music/notes'
import * as animalBath from '../../games/animal-bath/sounds'
import { playBentoSound } from '../../games/bento-builder/sounds'
import { playBlockLandSound, playLineClearSound, playStackFullSound } from '../../games/block-puzzle/sounds'
import * as carBuilder from '../../games/car-builder/sounds'
import * as circuit from '../../games/circuit-racing/sounds'
import { playRoadEditSound } from '../../games/car-road-builder/sounds'
import { craneSound } from '../../games/crane-game/craneSound'
import * as dotAdventure from '../../games/dot-adventure/sounds'
import * as dotAquarium from '../../games/dot-aquarium/sounds'
import * as dotRun from '../../games/dot-run/sounds'
import * as dotZoo from '../../games/dot-zoo/sounds'
import { playStarSound as playDrawGoalStarSound, playWarpSound as playDrawGoalWarpSound } from '../../games/draw-goal/sounds'
import { playGlobeZoomSound } from '../../games/earth-globe/sounds'
import { playDeliverySound } from '../../games/forest-delivery/sounds'
import * as hoshi from '../../games/hoshi-tsunagi/sounds'
import * as jishaku from '../../games/jishaku-pitatto/sounds'
import * as sandbox from '../../games/magic-sandbox/sounds'
import * as marble from '../../games/marble-course/sounds'
import * as mato from '../../games/mato-ate/sounds'
import * as oekaki from '../../games/oekaki-korokoro/sounds'
import * as onaji from '../../games/onaji-pon/sounds'
import * as origami from '../../games/origami-play/sounds'
import { KartAudio } from '../../games/pixel-kart/audio'
import * as pukupuka from '../../games/pukupuka-rescue/sounds'
import { playPlanetUiSound } from '../../games/planet-globe/sounds'
import { playSlimeSound } from '../../games/puni-slime/slimeSound'
import { golfSound } from '../../games/putter-golf/golfSound'
import * as pyoko from '../../games/pyoko-touch/sounds'
import * as rhythm from '../../games/rhythm-pon/sounds'
import * as robo from '../../games/robo-kuzushi/sounds'
import * as shabon from '../../games/shabon-pachin/sounds'
import * as shinkei from '../../games/shinkeisuijaku/sounds'
import { playSnowSound } from '../../games/snowball-roll/sounds'
import { journeySound } from '../../games/train-journey/journeySound'
import * as treasure from '../../games/treasure-dig/sounds'
import * as tsumiki3d from '../../games/tsumiki-3d/sounds'
import { createBowlingSoundController } from '../../games/tsumiki-bowling/bowlingSound'
import * as waterWheel from '../../games/water-wheel-maze/sounds'

export type GameSoundSample = SoundSample & {
  /** BGM・走行音など鳴り続ける音。ゲームの大きさの基準には入れず、効果音より小さいことだけ確かめる。 */
  background?: boolean
}

const sample = (name: string, play: SoundSample['play']): GameSoundSample => ({ name, play })
const background = (name: string, seconds: number, play: SoundSample['play']): GameSoundSample => ({ name, play, seconds, background: true })

/** クイズ共通の「ピンポーン」「ブブー」。 */
const QUIZ_ANSWER = [sample('せいかい', quiz.playCorrectSound), sample('ふせいかい', quiz.playIncorrectSound)]

function pianoNotes(count: number): SoundSample['play'] {
  return ({ advance }) => {
    // 音源ファイルを読み込めないテスト環境では、読み込み前と同じ合成音で鳴る。
    // この合成音は録音音源とほぼ同じ大きさに合わせてある（ffmpegで音源を描き起こして確認済み）。
    const engine = new PianoAudioEngine()
    for (const note of PIANO_NOTES.slice(0, count)) {
      engine.playNote(note, 400)
      advance(400)
    }
    return () => engine.dispose()
  }
}

export const GAME_SOUND_SAMPLES: Readonly<Record<string, readonly GameSoundSample[]>> = {
  'flag-quiz': [...QUIZ_ANSWER, sample('パネルを めくる', quiz.playPanelOpenSound), sample('のこりを めくる', () => quiz.playPanelRevealSound(3, 6))],
  'flag-pinball': [
    sample('うちだし', quiz.playPinballLaunchSound),
    sample('とくてん', () => quiz.playPinballScoreSound(500)),
    sample('ごうけい', quiz.playPinballTotalSound),
    sample('くるくる', quiz.playPinballSpinnerSound),
  ],
  'flag-roll-adventure': [
    sample('おしあげ', quiz.playPinballLauncherSound),
    sample('くるくる', quiz.playPinballSpinnerSound),
    sample('ゴール', quiz.playPinballTotalSound),
  ],
  'domino-flag': [sample('かんせい', quiz.playDominoCompleteSound)],
  'flag-roll-maze': [
    sample('ほし', () => quiz.playMazeStarSound(1)),
    sample('ゴール', quiz.playMazeGoalSound),
    sample('ジャンプだい', quiz.playPinballJumppadSound),
  ],
  'flag-roll-puzzle': [sample('パーツ', quiz.playPanelOpenSound), sample('せいかい', quiz.playCorrectSound)],
  'vegetable-quiz': QUIZ_ANSWER,
  'fruit-quiz': QUIZ_ANSWER,
  'working-vehicle-quiz': QUIZ_ANSWER,
  'math-quiz': QUIZ_ANSWER,
  'color-mix-quiz': [sample('まぜる', quiz.playColorMixSound), ...QUIZ_ANSWER],
  'prefecture-quiz': [sample('せいかい', quiz.playCorrectSound), sample('ピースを おく', quiz.playPanelOpenSound)],
  'world-travel-quiz': [sample('せいかい', quiz.playCorrectSound)],
  'japan-travel-quiz': [sample('せいかい', quiz.playCorrectSound)],
  'piano-play': [sample('けんばん', pianoNotes(4))],
  'earth-globe': [
    sample('くにを えらぶ', quiz.playGlobeCountrySelectSound),
    sample('ちかづく', () => playGlobeZoomSound('in')),
    sample('ぜんたい', () => playGlobeZoomSound('reset')),
  ],
  'planet-globe': [
    sample('スポット', quiz.playPlanetSpotSelectSound),
    sample('てんたいを えらぶ', () => playPlanetUiSound('body')),
    sample('ちかづく', () => playPlanetUiSound('zoom-in')),
    sample('きりかえ', () => playPlanetUiSound('mode')),
  ],
  'koma-battle': [
    sample('まわせ', quiz.playKomaBattleStartSound),
    sample('ぶつかる', () => {
      const controller = quiz.createKomaBattleSoundController()
      controller.playImpact('koma', 0.8)
      return () => controller.dispose()
    }),
    sample('かち', () => {
      const controller = quiz.createKomaBattleSoundController()
      controller.playVictory()
      return () => controller.dispose()
    }),
    background('かいてん', 1.5, () => {
      const controller = quiz.createKomaBattleSoundController()
      controller.startSpin()
      controller.updateSpin(50)
      return () => controller.dispose()
    }),
  ],
  'rail-builder': [
    sample('レールを つなぐ', () => quiz.playRailSnapSound()),
    sample('しゅっぱつ', () => quiz.playRailDepartureSound()),
    sample('えきに とまる', () => quiz.playRailStationStopSound()),
    background('はしる', 1.5, ({ advance }) => {
      const controller = quiz.createRailTrainSoundController()
      for (let i = 0; i < 15; i++) {
        controller.update(2, 'running')
        advance(100)
      }
      return () => controller.dispose()
    }),
  ],
  'marble-course': [
    sample('おく', marble.playMarblePlaceSound),
    sample('つなぐ', marble.playMarbleSnapSound),
    sample('まわす', marble.playMarbleRotateSound),
    sample('けす', marble.playMarbleEraseSound),
    sample('ころがす', marble.playMarbleRollSound),
    sample('ジャンプ', () => marble.playMarbleEventSound('takeoff')),
    sample('ちゃくち', () => marble.playMarbleEventSound('land')),
    sample('ゴール', marble.playMarbleGoalSound),
    sample('おちた', marble.playMarbleMissSound),
  ],
  'car-road-builder': [
    sample('みちを おく', () => playRoadEditSound('place')),
    sample('うごかす', () => playRoadEditSound('move')),
    sample('まわす', () => playRoadEditSound('rotate')),
    sample('けす', () => playRoadEditSound('remove')),
    sample('おけない', () => playRoadEditSound('nope')),
    sample('しゅっぱつ', quiz.playCarDepartureSound),
    sample('ゴール', quiz.playCarGoalSound),
    background('はしる', 1.5, () => {
      const controller = quiz.createCarRoadSoundController()
      controller.setRunning(true)
      return () => controller.dispose()
    }),
  ],
  'car-builder': [
    sample('ひらく', carBuilder.playCarMenuSound),
    sample('パーツを えらぶ', carBuilder.playCarPartSelectSound),
    sample('はしる', carBuilder.playCarDriveStartSound),
    sample('かそく', carBuilder.playDriveBoostSound),
    sample('1しゅう', carBuilder.playCarLapSound),
  ],
  'color-paint-puzzle': [sample('ぬる', quiz.playColorPaintFillSound), sample('できた', quiz.playColorPaintFinishSound)],
  'tsumiki-bowling': [
    sample('なげる', () => {
      const controller = createBowlingSoundController()
      controller.playLaunch('heavy', 0.8)
      return () => controller.dispose()
    }),
    sample('あたる', () => {
      const controller = createBowlingSoundController()
      controller.playImpact('heavy', 0.8)
      return () => controller.dispose()
    }),
    sample('ぜんぶ たおした', () => {
      const controller = createBowlingSoundController()
      controller.playPerfect()
      return () => controller.dispose()
    }),
    sample('けっか', () => {
      const controller = createBowlingSoundController()
      controller.playResult()
      return () => controller.dispose()
    }),
  ],
  'block-puzzle': [
    sample('おく', playBlockLandSound),
    sample('そろった', () => playLineClearSound(1)),
    sample('いっぱい', playStackFullSound),
    sample('できた', quiz.playBlockPuzzleCompleteSound),
  ],
  'pukupuka-rescue': [
    sample('みず', () => pukupuka.playPukupukaWaterSound('fill')),
    sample('しかけ', () => pukupuka.playPukupukaActionSound('gate')),
    sample('ゴール', pukupuka.playPukupukaGoalSound),
  ],
  'rhythm-pon': [
    sample('どん', ({ ctx }) => rhythm.scheduleDrum('kick', ctx.currentTime, true)),
    sample('ぱん', ({ ctx }) => rhythm.scheduleDrum('clap', ctx.currentTime)),
    sample('ぴったり', () => rhythm.playSparkle(true)),
    sample('ファンファーレ', () => rhythm.playFanfare(3)),
  ],
  'animal-bath': [
    sample('ごしごし', () => animalBath.playBathRubSound(0)),
    sample('あわ', () => animalBath.playBathCleanSound(0, 3)),
    sample('じゃぶっ', () => animalBath.playBathCleanSound(1, 3)),
    sample('ふきっ', () => animalBath.playBathCleanSound(2, 3)),
    sample('できた', animalBath.playBathStepDoneSound),
    sample('ぴかぴか', animalBath.playBathFinishSound),
    sample('えらぶ', animalBath.playBathSelectSound),
  ],
  'origami-play': [sample('えらぶ', origami.playSelectSound), sample('おる', origami.playFoldSound), sample('できた', origami.playFinishSound)],
  'snowball-roll': [sample('ゆきを あつめる', () => playSnowSound(false, 2)), sample('できた', () => playSnowSound(true, 8))],
  'magic-sandbox': [
    sample('すな', () => sandbox.playMaterialSound(1)),
    sample('みず', () => sandbox.playMaterialSound(2)),
    sample('おはな', sandbox.playBloomSound),
    sample('えらぶ', sandbox.playSelectSound),
  ],
  'puni-slime': [
    sample('つかむ', () => playSlimeSound('grab', 'soft')),
    sample('つつく', () => playSlimeSound('poke', 'soft')),
    sample('ぽとん', () => playSlimeSound('drop', 'bouncy')),
  ],
  'bento-builder': [sample('いれる', () => playBentoSound('add')), sample('おく', () => playBentoSound('place')), sample('できた', () => playBentoSound('finish'))],
  'train-journey': [sample('ふえ', () => journeySound('horn')), sample('きりかえ', () => journeySound('switch')), sample('えき', () => journeySound('station')), sample('かそく', () => journeySound('boost'))],
  'circuit-racing': [
    sample('スタート', circuit.playRaceStartSound),
    sample('ブースト', circuit.playBoostSound),
    sample('とくべつ', circuit.playSpecialSound),
    background('エンジン', 1.5, () => {
      const hum = circuit.createEngineHum()
      hum.start()
      return () => hum.stop()
    }),
  ],
  'oekaki-korokoro': [sample('スタンプ', () => oekaki.playStampSound('star')), sample('できた', oekaki.playDoneSound)],
  'draw-goal': [sample('ほし', playDrawGoalStarSound), sample('ワープ', playDrawGoalWarpSound), sample('ゴール', quiz.playCorrectSound)],
  'crane-game': [sample('つかむ', () => craneSound('grab')), sample('ゲット', () => craneSound('get')), sample('はずれ', () => craneSound('miss')), background('うごく', 0.5, () => craneSound('motor'))],
  'treasure-dig': [sample('ほる', treasure.playDigSound), sample('たから', () => treasure.playTreasureSound(1, 3)), sample('クリア', treasure.playDigClearSound)],
  'forest-delivery': [sample('あつめる', () => playDeliverySound('collect')), sample('とどける', () => playDeliverySound('deliver')), sample('クリア', () => playDeliverySound('complete'))],
  'putter-golf': [sample('うつ', () => golfSound('putt')), sample('かべ', () => golfSound('wall')), sample('カップ', () => golfSound('cup')), sample('おめでとう', () => golfSound('cheer'))],
  shinkeisuijaku: [sample('めくる', shinkei.playCardFlipSound), sample('あたり', shinkei.playCardMatchSound), sample('はずれ', shinkei.playCardMismatchSound), sample('ぜんぶ', shinkei.playAllMatchedSound)],
  'water-wheel-maze': [sample('みず', waterWheel.playDropSound), sample('のせる', () => waterWheel.playRiderSound(1, 3)), sample('クリア', waterWheel.playWheelClearSound)],
  'pyoko-touch': [sample('タッチ', pyoko.playCatchSound), sample('おっと', pyoko.playOopsSound), sample('おしまい', pyoko.playFinishSound)],
  'hoshi-tsunagi': [sample('つなぐ', () => hoshi.playConnectSound(2)), sample('ちがう', hoshi.playWrongSound), sample('できた', hoshi.playCompleteSound)],
  'robo-kuzushi': [
    sample('とばす', robo.playLaunchSound),
    sample('あたる', () => robo.playHitSound('wood', 0.7)),
    sample('こわれる', () => robo.playBreakSound('wood')),
    sample('ロボ', robo.playRobotSound),
    sample('クリア', robo.playClearSound),
  ],
  'mato-ate': [sample('うつ', mato.playShootSound), sample('あたり', () => mato.playHitSound('normal', true, 1)), sample('はずれ', mato.playMissSound), sample('クリア', mato.playClearSound)],
  'dot-adventure': [
    sample('タップ', dotAdventure.playTapSound),
    sample('かけら', () => dotAdventure.playShardSound(2)),
    sample('スイッチ', dotAdventure.playSwitchSound),
    sample('ファンファーレ', dotAdventure.playFanfare),
    background('BGM', 3, () => dotAdventure.startBgm('forest')),
  ],
  'dot-zoo': [
    sample('おく', dotZoo.playPlaceSound),
    sample('ごはん', dotZoo.playMunchSound),
    sample('なきごえ', () => dotZoo.playCry('lion')),
    sample('よろこぶ', dotZoo.playHappySound),
    background('BGM', 3, () => dotZoo.startBgm('day')),
  ],
  'dot-aquarium': [
    sample('おく', dotAquarium.playPlaceSound),
    sample('ごはん', dotAquarium.playMunchSound),
    sample('よろこぶ', dotAquarium.playHappySound),
    sample('しんじゅ', dotAquarium.playPearlSound),
    background('BGM', 3, () => dotAquarium.startBgm('day')),
  ],
  'pixel-kart': [
    sample('カウントダウン', () => new KartAudio().effect('countdown')),
    sample('ジャンプ', () => new KartAudio().effect('jump')),
    sample('ゴール', () => new KartAudio().effect('finish')),
    background('BGM', 3, () => {
      const audio = new KartAudio()
      audio.start('forest')
      return () => audio.stop()
    }),
  ],
  'tsumiki-3d': [
    sample('おく', () => tsumiki3d.playPlaceSound(1)),
    sample('えらぶ', () => tsumiki3d.playSelectSound()),
    sample('まわす', tsumiki3d.playRotateSound),
    sample('ゴール', () => tsumiki3d.playGoalSound(1)),
  ],
  'dot-run': [
    sample('ジャンプ', dotRun.playJump),
    sample('にんじん', () => dotRun.playCarrot(0)),
    sample('ふむ', dotRun.playStomp),
    sample('ゴール', dotRun.playGoal),
    background('BGM', 3, () => dotRun.startBgm('meadow')),
  ],
  'jishaku-pitatto': [
    sample('くっつく', () => jishaku.playStick(1, 'metal')),
    sample('とびあがる', jishaku.playLift),
    sample('ほし', jishaku.playStar),
    sample('クリア', jishaku.playClear),
    background('BGM', 3, () => jishaku.startBgm('desk')),
  ],
  'shabon-pachin': [sample('ぱちん', shabon.playPopSound), sample('ぼよん', shabon.playBoingSound), sample('クリア', shabon.playClearSound)],
  'onaji-pon': [sample('つなぐ', () => onaji.playConnectSound(1)), sample('ひく', onaji.playDrawSound), sample('だめ', onaji.playNopeSound), sample('クリア', onaji.playClearSound)],
}
