// 3Dどうぶつえんの効果音。音声ファイルは持たず Web Audio で合成し、共通の出口（getSoundOutput）へつなぐ。
// 音が出ない環境でも遊べるよう、失敗は握りつぶす（見た目の反応だけで遊びが成り立つ）。

import { createToneNodes, getSharedAudioContext, getSoundOutput, isSoundEnabled, playNoiseBurst, playTone } from '../../audio/sound'

export type ZooSound = 'select' | 'drop' | 'munch' | 'happy' | 'trumpet' | 'splash' | 'roar' | 'hum' | 'squeak' | 'honk' | 'neigh' | 'yawn' | 'sniff' | 'punch' | 'boing' | 'growl' | 'clap' | 'kiki' | 'purr' | 'chomp' | 'baa' | 'drum' | 'snort' | 'kon' | 'info' | 'snore' | 'stamp' | 'gate' | 'howl' | 'yip' | 'chirp' | 'mee' | 'bonk' | 'peep' | 'oink' | 'medal'
  | 'countdown' | 'go' | 'cheer' | 'goal'

function withContext(play: (ctx: AudioContext, now: number) => void): void {
  if (!isSoundEnabled()) return
  try {
    const ctx = getSharedAudioContext()
    if (!ctx) return
    play(ctx, ctx.currentTime)
  } catch {
    // 音を鳴らせない端末でも、動物の反応（動き・ハート）だけで遊べる
  }
}

/** 音程が滑らかに変わる、フィルタ付きの声（ゾウ・ライオン・キリンの鳴き声のもと）。 */
function voice(ctx: AudioContext, start: number, points: [number, number][], volume: number, type: OscillatorType,
  cutoff: number, vibrato = 0): void {
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = type
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  filter.Q.value = 2
  const end = start + points[points.length - 1][0]
  osc.frequency.setValueAtTime(points[0][1], start)
  for (const [t, f] of points.slice(1)) osc.frequency.linearRampToValueAtTime(f, start + t)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.05)
  gain.gain.setValueAtTime(volume, Math.max(start + 0.05, end - 0.12))
  gain.gain.linearRampToValueAtTime(0, end)
  if (vibrato > 0) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 7
    depth.gain.value = vibrato
    lfo.connect(depth)
    depth.connect(osc.frequency)
    lfo.start(start)
    lfo.stop(end)
  }
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(getSoundOutput(ctx))
  osc.start(start)
  osc.stop(end)
}

export function playZooSound(sound: ZooSound): void {
  withContext((ctx, now) => {
    switch (sound) {
      case 'select':
        playTone(ctx, 660, now, 0.09, 0.14, 'triangle')
        playTone(ctx, 990, now + 0.06, 0.12, 0.12, 'triangle')
        return
      case 'info':
        ;[523, 659, 784].forEach((f, i) => playTone(ctx, f, now + i * 0.07, 0.14, 0.12, 'sine'))
        return
      case 'stamp':
        // スタンプ「ぽんっ」と、きらきらの上がる音
        playTone(ctx, 330, now, 0.08, 0.22, 'triangle')
        playNoiseBurst(ctx, now, 0.05, 0.14, 'lowpass', 1400)
        ;[1047, 1319, 1568, 2093].forEach((f, i) => playTone(ctx, f, now + 0.1 + i * 0.07, 0.18, 0.1, 'sine'))
        return
      case 'medal':
        // おねがい たっせい: ドミソドの ファンファーレと、きらきら
        ;[523, 659, 784, 1047].forEach((f, i) => playTone(ctx, f, now + i * 0.11, i === 3 ? 0.42 : 0.16, 0.14, 'triangle'))
        ;[1568, 2093, 2637].forEach((f, i) => playTone(ctx, f, now + 0.5 + i * 0.08, 0.2, 0.08, 'sine'))
        return
      case 'gate':
        // となりのエリアへ: 足音2つと、上がる音
        for (let i = 0; i < 2; i++) playNoiseBurst(ctx, now + i * 0.16, 0.06, 0.16, 'lowpass', 700)
        ;[392, 523, 659].forEach((f, i) => playTone(ctx, f, now + 0.32 + i * 0.09, 0.16, 0.12, 'triangle'))
        return
      case 'drop':
        // ひゅーっと落ちて、ぽとん
        {
          const tone = createToneNodes(ctx, 900, now, 0.28, 0.08, 'sine')
          tone.oscillator.frequency.linearRampToValueAtTime(420, now + 0.28)
          tone.oscillator.start(now)
          tone.oscillator.stop(now + 0.28)
        }
        playTone(ctx, 220, now + 0.3, 0.1, 0.2, 'sine')
        playNoiseBurst(ctx, now + 0.3, 0.08, 0.12, 'lowpass', 900)
        return
      case 'munch':
        for (let i = 0; i < 3; i++) {
          playNoiseBurst(ctx, now + i * 0.17, 0.07, 0.2, 'bandpass', 1300 + i * 120)
          playTone(ctx, 180 - i * 10, now + i * 0.17, 0.06, 0.1, 'triangle')
        }
        return
      case 'happy':
        ;[784, 988, 1175, 1568].forEach((f, i) => playTone(ctx, f, now + i * 0.075, 0.16, 0.11, 'triangle'))
        return
      case 'trumpet':
        // パオーン: のこぎり波を持ち上げて伸ばす
        voice(ctx, now, [[0, 260], [0.12, 420], [0.5, 520], [0.85, 470], [1.0, 380]], 0.2, 'sawtooth', 1800, 12)
        voice(ctx, now, [[0, 520], [0.12, 840], [0.5, 1040], [0.85, 940], [1.0, 760]], 0.05, 'square', 2600, 20)
        return
      case 'splash':
        for (let i = 0; i < 4; i++) playNoiseBurst(ctx, now + i * 0.12, 0.25, 0.14, 'highpass', 2200 + i * 300)
        return
      case 'roar':
        // ガオー: 低いうなりを下げていく（こわすぎない高さ）
        voice(ctx, now, [[0, 170], [0.15, 240], [0.7, 150], [0.9, 120]], 0.22, 'sawtooth', 900, 18)
        playNoiseBurst(ctx, now + 0.05, 0.7, 0.08, 'bandpass', 600)
        return
      case 'hum':
        // キリンのやさしいハミング
        voice(ctx, now, [[0, 110], [0.3, 125], [0.9, 105]], 0.2, 'triangle', 700, 4)
        return
      case 'squeak':
        // パンダの「めぇー」: 高めの声を2回、少しゆらしながら
        voice(ctx, now, [[0, 620], [0.12, 820], [0.28, 700]], 0.16, 'triangle', 2400, 18)
        voice(ctx, now + 0.34, [[0, 660], [0.14, 880], [0.34, 720]], 0.16, 'triangle', 2400, 18)
        return
      case 'honk':
        // ペンギンの「クワッ クワッ」: 短く鼻にかかった声を2回
        voice(ctx, now, [[0, 480], [0.07, 720], [0.2, 560]], 0.15, 'sawtooth', 1900, 10)
        voice(ctx, now + 0.28, [[0, 520], [0.07, 760], [0.24, 590]], 0.15, 'sawtooth', 1900, 10)
        return
      case 'neigh':
        // シマウマの「ヒヒーン」: 高く上がってふるえながら下がる声
        voice(ctx, now, [[0, 420], [0.15, 900], [0.55, 780], [0.9, 520]], 0.15, 'sawtooth', 2200, 40)
        return
      case 'yawn':
        // カバの大あくび「ふわぁ〜」: 低い声がゆっくり上がって下がる
        voice(ctx, now, [[0, 130], [0.35, 210], [0.9, 170], [1.3, 110]], 0.24, 'sawtooth', 700, 6)
        return
      case 'sniff':
        // ウサギの鼻ひくひく「ぷすぷす」と、小さな「きゅっ」
        for (let i = 0; i < 4; i++) playNoiseBurst(ctx, now + i * 0.11, 0.06, 0.2, 'bandpass', 2600)
        playTone(ctx, 1320, now + 0.5, 0.1, 0.12, 'sine')
        return
      case 'punch':
        // カンガルーのボクシング「ぽこぽこ」: やわらかい打音を4回
        for (let i = 0; i < 4; i++) {
          playTone(ctx, 220 + (i % 2) * 60, now + i * 0.2, 0.08, 0.22, 'triangle')
          playNoiseBurst(ctx, now + i * 0.2, 0.05, 0.12, 'lowpass', 1200)
        }
        return
      case 'boing':
        // 大ジャンプ「びよーん」: 音程が上がってはずむ
        {
          const tone = createToneNodes(ctx, 180, now, 0.5, 0.2, 'triangle')
          tone.oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.3)
          tone.oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.5)
          tone.oscillator.start(now)
          tone.oscillator.stop(now + 0.5)
        }
        return
      case 'growl':
        // シロクマの「ぐるる」: 低い声をふるわせる（こわくない大きさ）
        voice(ctx, now, [[0, 140], [0.3, 175], [0.8, 120]], 0.22, 'sawtooth', 650, 22)
        return
      case 'clap':
        // ぱちぱち: 短い手びょうしを5回
        for (let i = 0; i < 5; i++) playNoiseBurst(ctx, now + i * 0.32, 0.05, 0.24, 'bandpass', 1800)
        return
      case 'kiki':
        // サルの「キッキッ」: 高く短い声を3回
        for (let i = 0; i < 3; i++) voice(ctx, now + i * 0.16, [[0, 1100], [0.05, 1500], [0.11, 1200]], 0.13, 'square', 3200, 0)
        return
      case 'purr':
        // カピバラの「キュルル」: やわらかい声を小さくふるわせる
        voice(ctx, now, [[0, 380], [0.25, 430], [0.6, 360], [0.9, 400]], 0.16, 'triangle', 1400, 28)
        return
      case 'chomp':
        // ワニの「パクッ」: 口を閉じる音を2回
        for (const t of [0, 0.9]) {
          playNoiseBurst(ctx, now + t, 0.08, 0.26, 'bandpass', 900)
          playTone(ctx, 150, now + t, 0.12, 0.22, 'triangle')
        }
        return
      case 'baa':
        // ヒツジの「メェー」: ふるえる声をのばす
        voice(ctx, now, [[0, 340], [0.1, 470], [0.75, 420], [0.95, 360]], 0.17, 'sawtooth', 1500, 34)
        return
      case 'drum':
        // ゴリラのドラミング「ドンドコ」: 低い太鼓の音を速く6回
        for (let i = 0; i < 6; i++) {
          const tone = createToneNodes(ctx, 150 - (i % 2) * 25, now + i * 0.14, 0.12, 0.26, 'sine')
          tone.oscillator.frequency.exponentialRampToValueAtTime(70, now + i * 0.14 + 0.12)
          tone.oscillator.start(now + i * 0.14)
          tone.oscillator.stop(now + i * 0.14 + 0.12)
        }
        return
      case 'oink':
        // ブタの「ぶーぶー」: 鼻にかかった低い声を2回、短くはずませる
        for (const t of [0, 0.3]) {
          voice(ctx, now + t, [[0, 190], [0.06, 260], [0.2, 170]], 0.22, 'sawtooth', 900, 18)
          playNoiseBurst(ctx, now + t, 0.12, 0.1, 'lowpass', 600)
        }
        return
      case 'snort':
        // サイの「ふんっ」: 鼻から勢いよく息を出す音を2回
        for (const t of [0, 0.35]) {
          playNoiseBurst(ctx, now + t, 0.22, 0.26, 'lowpass', 700)
          playTone(ctx, 110, now + t, 0.16, 0.14, 'sawtooth')
        }
        return
      case 'kon':
        // キツネの「コーン」: 高く澄んだ声を長くのばす
        voice(ctx, now, [[0, 620], [0.15, 900], [0.8, 820], [1.1, 640]], 0.15, 'triangle', 2600, 10)
        return
      case 'howl':
        // オオカミの遠ぼえ「アオーーン」: ゆっくり上がって、長くのばしてから下がる（こわくない高さ）
        voice(ctx, now, [[0, 330], [0.35, 560], [1.1, 600], [1.6, 470], [1.9, 380]], 0.15, 'triangle', 1800, 9)
        voice(ctx, now, [[0, 660], [0.35, 1120], [1.1, 1200], [1.6, 940], [1.9, 760]], 0.04, 'sine', 2600, 9)
        return
      case 'yip':
        // あそぼう！の「きゃんきゃん」: 短く高い声を2回
        voice(ctx, now, [[0, 700], [0.06, 1050], [0.14, 820]], 0.14, 'triangle', 2800, 0)
        voice(ctx, now + 0.22, [[0, 760], [0.06, 1120], [0.15, 860]], 0.14, 'triangle', 2800, 0)
        return
      case 'chirp':
        // チーターの「チュルル」: 小鳥のような高い声を3回
        for (let i = 0; i < 3; i++) voice(ctx, now + i * 0.18, [[0, 1400], [0.05, 1900], [0.12, 1600]], 0.12, 'sine', 4000, 30)
        return
      case 'mee':
        // ヤギの「メェ〜」: ヒツジより高く、ふるえる声
        voice(ctx, now, [[0, 520], [0.08, 700], [0.55, 640], [0.8, 560]], 0.15, 'sawtooth', 2200, 40)
        return
      case 'bonk':
        // ごっつん: やわらかい打音（こわくない）
        playTone(ctx, 190, now, 0.12, 0.26, 'triangle')
        playNoiseBurst(ctx, now, 0.07, 0.16, 'lowpass', 900)
        return
      case 'peep':
        // ミーアキャットの見はりの合図「ピッ ピッ」
        for (let i = 0; i < 2; i++) voice(ctx, now + i * 0.22, [[0, 1300], [0.05, 1600], [0.1, 1350]], 0.12, 'triangle', 3600, 0)
        return
      case 'snore':
        voice(ctx, now, [[0, 90], [0.5, 120], [0.9, 85]], 0.08, 'triangle', 500)
        return
      // ---- どうぶつレース ----
      case 'countdown':
        // よーい: 「ピッ」
        playTone(ctx, 880, now, 0.16, 0.2, 'triangle')
        return
      case 'go':
        // どん！: 高い「ピーッ」と、やわらかい「ぱん」
        playNoiseBurst(ctx, now, 0.1, 0.18, 'lowpass', 1800)
        playTone(ctx, 1320, now, 0.5, 0.2, 'triangle')
        playTone(ctx, 1760, now, 0.5, 0.07, 'sine')
        return
      case 'cheer':
        // おきゃくさんの「わーっ」と はくしゅ
        for (let i = 0; i < 6; i++) playNoiseBurst(ctx, now + i * 0.13, 0.32, 0.07, 'bandpass', 900 + (i % 3) * 380)
        for (let i = 0; i < 8; i++) playNoiseBurst(ctx, now + 0.05 + i * 0.11 + (i % 2) * 0.03, 0.04, 0.12, 'highpass', 2400)
        return
      case 'goal':
        // ゴール！: ソドミソーの ファンファーレと、きらきら
        ;[392, 523, 659, 784].forEach((f, i) => playTone(ctx, f, now + i * 0.12, i === 3 ? 0.5 : 0.14, 0.15, 'triangle'))
        ;[1047, 1319, 1568].forEach(f => playTone(ctx, f, now + 0.5, 0.45, 0.06, 'sine'))
        ;[2093, 2637].forEach((f, i) => playTone(ctx, f, now + 0.62 + i * 0.08, 0.18, 0.06, 'sine'))
        return
    }
  })
}
