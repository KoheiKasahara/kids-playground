/**
 * クイズの正解・不正解、パネルめくりの手触りを知らせる効果音を Web Audio API で合成する。
 * 音声ファイルを追加せず標準APIだけで鳴らすことで、アセット追加やライセンスの心配なしに
 * オフライン（PWA）でも確実に再生できるようにする。
 * Web Audio 非対応環境（一部ブラウザやテスト環境の jsdom）では何もしない。
 */

type AudioContextConstructor = new () => AudioContext

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const withWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return withWebkit.AudioContext ?? withWebkit.webkitAudioContext
}

let sharedContext: AudioContext | undefined

/** 音を鳴らすかどうか。将来 UI から ON/OFF できるようにするための切り替えフラグ（既定は ON）。 */
let soundEnabled = true

/** サウンドの ON/OFF を切り替える。false にすると、以降すべての play* 関数が即座に何もしなくなる。 */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
}

/** 現在サウンドが有効かどうかを返す。 */
export function isSoundEnabled(): boolean {
  return soundEnabled
}

function getAudioContext(): AudioContext | undefined {
  const Ctor = getAudioContextConstructor()
  if (!Ctor) return undefined
  if (!sharedContext) {
    try {
      sharedContext = new Ctor()
    } catch {
      return undefined
    }
  }
  if (sharedContext.state === 'suspended') {
    // クリックなどのユーザー操作中に呼ばれるため resume() は許可される想定だが、
    // 環境によっては拒否されることがあるので失敗しても無視する。
    sharedContext.resume().catch(() => {})
  }
  return sharedContext
}

/**
 * AudioContext を用意して resume するだけの関数。
 * iOS Safari は「ユーザー操作イベントの中で最初に AudioContext を作る/resume する」ことを
 * 要求するため、パネルタップや選択肢クリックなどのイベントハンドラの先頭で呼んでおく。
 * setTimeout 経由で少し後から鳴らす音（パネルの連続めくりなど）も、ここで先に
 * resume 済みにしておくことで iOS でも確実に鳴るようにする。
 */
export function primeAudio(): void {
  if (!soundEnabled) return
  getAudioContext()
}

export type KomaBattleImpactSoundKind = 'koma' | 'bumper' | 'wall'
type KomaBattleDefeatReason = 'toppled' | 'stopped' | 'outOfArena'

/** コマバトル専用の、速度連動回転音の上限。 */
const KOMA_SPIN_SOUND_MAX_SPEED = 75
/** 回転音が小さすぎて聞こえなくならないための下限ゲイン。 */
const KOMA_SPIN_SOUND_MIN_GAIN = 0.003
/** 回転音が大きくなりすぎないための最大ゲイン。 */
const KOMA_SPIN_SOUND_MAX_GAIN = 0.03
/** 連続接触の音をまとめる全体クールダウン[ms]。 */
const KOMA_IMPACT_SOUND_COOLDOWN_MS = 85
/** 場外/転倒/停止音の近接再生をまとめるクールダウン[ms]。 */
const KOMA_DEFEAT_SOUND_COOLDOWN_MS = 140
/** 同一フレーム付近の多重入力で短音が重なりすぎないための技術的な間隔[ms]。 */
const KOMA_BOOST_SOUND_COOLDOWN_MS = 40

type KomaBattleTone = {
  oscillator: OscillatorNode
  gain: GainNode
}

function setSmoothedAudioParam(
  parameter: AudioParam,
  value: number,
  now: number,
  timeConstant: number,
): void {
  const targetParameter = parameter as AudioParam & {
    cancelScheduledValues?: (time: number) => void
    setTargetAtTime?: (nextValue: number, startTime: number, nextTimeConstant: number) => void
  }
  targetParameter.cancelScheduledValues?.(now)
  if (targetParameter.setTargetAtTime !== undefined) {
    targetParameter.setTargetAtTime(value, now, timeConstant)
  } else if (targetParameter.linearRampToValueAtTime !== undefined) {
    targetParameter.linearRampToValueAtTime(value, now + timeConstant)
  } else {
    targetParameter.value = value
  }
}

/** 「まわせ！」を押した瞬間の短い上行音。AudioContextは共有utilityから取得する。 */
export function playKomaBattleStartSound(): void {
  if (!soundEnabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTone(ctx, 280, now, 0.1, 0.11, 'triangle')
    playTone(ctx, 560, now + 0.055, 0.16, 0.12, 'sine')
  } catch {
    // 音声APIの不調で試合開始を止めない。
  }
}

function playKomaBattleImpactSound(
  kind: KomaBattleImpactSoundKind,
  intensity: number,
  activeTones: Set<KomaBattleTone>,
): void {
  if (!soundEnabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const safeIntensity = Number.isFinite(intensity)
      ? Math.min(1, Math.max(0, intensity))
      : 0
    const baseFrequency = kind === 'bumper' ? 360 : kind === 'wall' ? 230 : 155
    const frequency = baseFrequency + safeIntensity * (kind === 'koma' ? 45 : 85)
    const volume = Math.min(0.085, 0.024 + safeIntensity * 0.061)
    const duration = kind === 'koma' ? 0.11 : 0.08
    playTrackedKomaTone(
      ctx,
      frequency,
      ctx.currentTime,
      duration,
      volume,
      'triangle',
      activeTones,
    )
    // 強いコマ同士の衝突だけ、短い高音を薄く重ねて「ガツン」を伝える。
    if (kind === 'koma' && safeIntensity >= 0.66) {
      playTrackedKomaTone(
        ctx,
        frequency * 2.15,
        ctx.currentTime + 0.006,
        0.065,
        volume * 0.34,
        'sine',
        activeTones,
      )
    }
  } catch {
    // 音を出せない環境でも物理と演出は継続する。
  }
}

function playKomaBattleDefeatSound(
  reason: KomaBattleDefeatReason,
  activeTones: Set<KomaBattleTone>,
): void {
  if (!soundEnabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    if (reason === 'outOfArena') {
      playTrackedKomaTone(ctx, 250, now, 0.1, 0.1, 'triangle', activeTones)
      playTrackedKomaTone(ctx, 145, now + 0.06, 0.18, 0.09, 'sine', activeTones)
      return
    }
    const first = reason === 'toppled' ? 230 : 190
    const second = reason === 'toppled' ? 135 : 120
    playTrackedKomaTone(ctx, first, now, 0.09, 0.08, 'triangle', activeTones)
    playTrackedKomaTone(ctx, second, now + 0.055, 0.15, 0.07, 'sine', activeTones)
  } catch {
    // 音声APIの不調で勝敗判定を止めない。
  }
}

/** タップしたコマが元気になった瞬間を伝える、短い上行音。 */
function playKomaBattleBoostSound(activeTones: Set<KomaBattleTone>): void {
  if (!soundEnabled) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime
    playTrackedKomaTone(ctx, 520, now, 0.075, 0.065, 'triangle', activeTones)
    playTrackedKomaTone(ctx, 780, now + 0.035, 0.11, 0.055, 'sine', activeTones)
  } catch {
    // 音声APIの不調でタップブーストを止めない。
  }
}

export type KomaBattleSoundController = {
  /** 回転音のノードを1組だけ作る。実際の音量/音程はupdateSpinで追従する。 */
  startSpin: () => void
  /** 回転速度[rad/s]へ滑らかに追従させる。AudioNodeは追加生成しない。 */
  updateSpin: (spinSpeed: number) => void
  /** 回転音をフェードアウトする。ノードはrun終了時のdisposeまで再利用する。 */
  stopSpin: () => void
  /** コマ同士/バンパー/壁の代表衝突音を鳴らす。 */
  playImpact: (kind: KomaBattleImpactSoundKind, intensity: number) => void
  /** 触ったコマへブーストが入ったことを知らせる短い音。 */
  playBoost: () => void
  /** 場外・転倒・停止の代表音を鳴らす。 */
  playDefeat: (reason: KomaBattleDefeatReason) => void
  /** 勝利/引き分けをrun中1回だけ鳴らす。 */
  playVictory: () => void
  playDraw: () => void
  /** タブが隠れている間は回転音を無音にし、復帰後のupdateで戻す。 */
  setSuspended: (suspended: boolean) => void
  /** 予約済みの回転音とAudioNodeを破棄する。 */
  dispose: () => void
}

/**
 * コマバトル1試合ぶんの音声状態を束ねる。
 * 回転音は発音中ずっとoscillator/gainを作り直さず、速度に応じてAudioParamだけを更新する。
 */
export function createKomaBattleSoundController(): KomaBattleSoundController {
  let oscillator: OscillatorNode | undefined
  let gain: GainNode | undefined
  let spinContext: AudioContext | undefined
  let disposed = false
  let suspended = false
  let spinRequested = false
  let lastSpinGain = 0
  let lastImpactAt: number | null = null
  let lastBoostAt: number | null = null
  let lastDefeatAt: number | null = null
  let resultPlayed = false
  const activeTones = new Set<KomaBattleTone>()

  function ensureSpinNodes(): AudioContext | undefined {
    if (disposed || !soundEnabled) return undefined
    const ctx = getAudioContext()
    if (!ctx) return undefined
    if (oscillator === undefined || gain === undefined) {
      oscillator = ctx.createOscillator()
      gain = ctx.createGain()
      spinContext = ctx
      oscillator.type = 'triangle'
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0, ctx.currentTime)
      oscillator.start(ctx.currentTime)
    }
    return ctx
  }

  function setSpinGain(value: number, now: number): void {
    if (gain === undefined) return
    const safeValue = Math.min(KOMA_SPIN_SOUND_MAX_GAIN, Math.max(0, value))
    if (Math.abs(safeValue - lastSpinGain) < 0.0005) return
    lastSpinGain = safeValue
    setSmoothedAudioParam(gain.gain, safeValue, now, 0.055)
  }

  function stopSpin(): void {
    spinRequested = false
    if (gain === undefined) return
    const ctx = spinContext ?? getAudioContext()
    if (ctx) setSpinGain(0, ctx.currentTime)
  }

  return {
    startSpin() {
      if (disposed) return
      spinRequested = true
    },
    updateSpin(spinSpeed) {
      if (disposed || !spinRequested) return
      if (suspended || !soundEnabled) {
        // グローバルの音量設定が途中でOFFになっても、既に鳴っている回転音を残さない。
        if (gain !== undefined && spinContext !== undefined) {
          setSpinGain(0, spinContext.currentTime)
        }
        return
      }
      const speed = Number.isFinite(spinSpeed) ? Math.max(0, spinSpeed) : 0
      const ctx = ensureSpinNodes()
      if (!ctx || oscillator === undefined) return
      const ratio = Math.min(1, speed / KOMA_SPIN_SOUND_MAX_SPEED)
      const now = ctx.currentTime
      const frequency = 78 + ratio * 94
      setSmoothedAudioParam(oscillator.frequency, frequency, now, 0.07)
      setSpinGain(speed <= 0.5 ? 0 : KOMA_SPIN_SOUND_MIN_GAIN + ratio * 0.024, now)
    },
    stopSpin,
    playImpact(kind, intensity) {
      if (disposed || !soundEnabled) return
      const wallClockNow = Date.now()
      if (
        lastImpactAt !== null
        && wallClockNow - lastImpactAt < KOMA_IMPACT_SOUND_COOLDOWN_MS
      ) return
      lastImpactAt = wallClockNow
      playKomaBattleImpactSound(kind, intensity, activeTones)
    },
    playBoost() {
      if (disposed || !soundEnabled) return
      const wallClockNow = Date.now()
      if (lastBoostAt !== null && wallClockNow - lastBoostAt < KOMA_BOOST_SOUND_COOLDOWN_MS) return
      lastBoostAt = wallClockNow
      playKomaBattleBoostSound(activeTones)
    },
    playDefeat(reason) {
      if (disposed || !soundEnabled) return
      const wallClockNow = Date.now()
      if (lastDefeatAt !== null && wallClockNow - lastDefeatAt < KOMA_DEFEAT_SOUND_COOLDOWN_MS) return
      lastDefeatAt = wallClockNow
      playKomaBattleDefeatSound(reason, activeTones)
    },
    playVictory() {
      if (disposed || !soundEnabled || resultPlayed) return
      resultPlayed = true
      try {
        const ctx = getAudioContext()
        if (!ctx) return
        const now = ctx.currentTime
        ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
          playTrackedKomaTone(
            ctx,
            frequency,
            now + index * 0.09,
            0.24,
            0.14,
            'triangle',
            activeTones,
          )
        })
      } catch {
        // 音声APIの不調で再戦操作を妨げない。
      }
    },
    playDraw() {
      if (disposed || !soundEnabled || resultPlayed) return
      resultPlayed = true
      try {
        const ctx = getAudioContext()
        if (!ctx) return
        const now = ctx.currentTime
        playTrackedKomaTone(ctx, 440, now, 0.13, 0.09, 'sine', activeTones)
        playTrackedKomaTone(ctx, 440, now + 0.14, 0.18, 0.08, 'sine', activeTones)
      } catch {
        // 音声APIの不調で再戦操作を妨げない。
      }
    },
    setSuspended(nextSuspended) {
      suspended = nextSuspended
      if (suspended) {
        if (gain !== undefined) {
          // 隠れている間にgetAudioContext()を呼ぶと、既にsuspendedでも
          // resumeを試みてしまうため、このrunで保持しているContextだけを使う。
          const ctx = spinContext
          if (ctx) setSpinGain(0, ctx.currentTime)
        }
      }
    },
    dispose() {
      if (disposed) return
      stopSpin()
      disposed = true
      if (gain !== undefined) {
        try { gain.disconnect() } catch { /* 解放済み/テスト用ノード */ }
      }
      if (oscillator !== undefined) {
        try { oscillator.stop() } catch { /* 既に停止済み */ }
        try { oscillator.disconnect() } catch { /* 解放済み/テスト用ノード */ }
      }
      for (const tone of activeTones) {
        try { tone.oscillator.stop() } catch { /* 既に停止済み/再生済み */ }
        try { tone.gain.disconnect() } catch { /* 解放済み/テスト用ノード */ }
        try { tone.oscillator.disconnect() } catch { /* 解放済み/テスト用ノード */ }
      }
      activeTones.clear()
      gain = undefined
      oscillator = undefined
      spinContext = undefined
    },
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): void {
  const tone = createToneNodes(ctx, frequency, startTime, duration, volume, type)
  tone.oscillator.start(startTime)
  tone.oscillator.stop(startTime + duration)
}

function createToneNodes(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): KomaBattleTone {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02)
  gain.gain.linearRampToValueAtTime(0, startTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  return { oscillator, gain }
}

/** コマバトルの予約音をrun単位で追跡し、再戦時に途中停止できるようにする。 */
function playTrackedKomaTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
  activeTones: Set<KomaBattleTone>,
): void {
  const tone = createToneNodes(ctx, frequency, startTime, duration, volume, type)
  activeTones.add(tone)
  const cleanup = () => {
    activeTones.delete(tone)
    try { tone.gain.disconnect() } catch { /* 再戦時に先に解放済み */ }
    try { tone.oscillator.disconnect() } catch { /* 再戦時に先に解放済み */ }
  }
  tone.oscillator.onended = cleanup
  tone.oscillator.start(startTime)
  tone.oscillator.stop(startTime + duration)
}

/** せいかい音「ピンポーン」: 高いラ→低いミ の2音チャイム */
export function playCorrectSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 880, now, 0.25, 0.2, 'sine') // ピン (A5)
  playTone(ctx, 659.25, now + 0.18, 0.35, 0.2, 'sine') // ポーン (E5)
}

/** ふせいかい音「ブブー」: 低い音を2回短く鳴らすブザー */
export function playIncorrectSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 150, now, 0.18, 0.15, 'sawtooth')
  playTone(ctx, 150, now + 0.24, 0.28, 0.15, 'sawtooth')
}

/**
 * 2色の絵の具が寄って混ざる短い「ぽこっ」という音。
 * 成功チャイムとは時間をずらして ColorMixQuizPlay 側で鳴らすため、二つの演出が重ならない。
 */
export function playColorMixSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 430, now, 0.14, 0.1, 'triangle')
  playTone(ctx, 610, now + 0.07, 0.11, 0.08, 'sine')
}

/**
 * パネルを1枚めくったときの「ポン♪」音。
 * びっくりさせない柔らかい音にするため、低音は避けて 600Hz〜1kHz 帯の一音だけを
 * 短く（130ms）鳴らす。正解音より控えめな音量にしてある。
 */
export function playPanelOpenSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 740, now, 0.13, 0.12, 'triangle')
}

/** 国選択音の連続再生を抑える短い間隔。連打でも操作感は残しつつ、音の濁りを避ける。 */
const GLOBE_COUNTRY_SELECT_SOUND_MIN_INTERVAL_MS = 100
let lastGlobeCountrySelectSoundAt: number | null = null

/**
 * 地球儀で国を選んだときの、丸く短い「ぷるん♪」。
 * 小さな上行2音を重ねずに並べ、クリック音や正解音より控えめな手触りにする。
 */
export function playGlobeCountrySelectSound(): void {
  if (!soundEnabled) return
  const wallClockNow = Date.now()
  if (
    lastGlobeCountrySelectSoundAt !== null
    && wallClockNow - lastGlobeCountrySelectSoundAt < GLOBE_COUNTRY_SELECT_SOUND_MIN_INTERVAL_MS
  ) return
  lastGlobeCountrySelectSoundAt = wallClockNow

  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 520, now, 0.09, 0.07, 'triangle')
  playTone(ctx, 680, now + 0.045, 0.12, 0.06, 'sine')
}

/** 特徴スポット選択音の連打を抑える最小間隔。 */
const PLANET_SPOT_SELECT_SOUND_MIN_INTERVAL_MS = 120
let lastPlanetSpotSelectSoundAt: number | null = null

/**
 * わくせいぎで特徴スポットを見つけたときの、軽い「キラッ」。
 * 正解音のような達成感は出さず(クイズではないため)、音量も控えめにする。特徴ごとに音は変えない。
 */
export function playPlanetSpotSelectSound(): void {
  if (!soundEnabled) return
  const wallClockNow = Date.now()
  if (
    lastPlanetSpotSelectSoundAt !== null
    && wallClockNow - lastPlanetSpotSelectSoundAt < PLANET_SPOT_SELECT_SOUND_MIN_INTERVAL_MS
  ) return
  lastPlanetSpotSelectSoundAt = wallClockNow

  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 784, now, 0.09, 0.05, 'sine') // G5
  playTone(ctx, 1046.5, now + 0.06, 0.09, 0.05, 'sine') // C6
  playTone(ctx, 1568, now + 0.12, 0.1, 0.045, 'sine') // G6
}

/** メジャーペンタトニックスケール（ド・レ・ミ・ソ・ラ）の半音オフセット。黒鍵を含まないので不協和になりにくい */
const PENTATONIC_STEPS = [0, 2, 4, 7, 9]
/** playPanelRevealSound の基準周波数（D5） */
const REVEAL_BASE_FREQUENCY = 587.33

/**
 * 正解後（または不正解後の種明かし）に、残りのパネルを連続でめくっていくときの音。
 * 残り枚数（total）に関わらず、burst 全体でペンタトニックスケール1オクターブぶんだけ
 * 均等に駆け上がるよう、step を 0〜1 の進捗率に正規化してからスケールの音数に割り当てる
 * （残りが2枚でも15枚でも、常に587Hz(D5)〜988Hz(B5)程度の範囲に収まり、耳に刺さらない）。
 * 最後の1枚（step === total）だけさらに一段高く鳴らして「見えた！」の達成感を出す。
 * 連続再生されるため、通常のパネル音より小さい音量・短い長さにしてある。
 */
export function playPanelRevealSound(step: number, total: number): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const safeTotal = Math.max(1, Math.trunc(total))
  const safeStep = Math.min(Math.max(Math.trunc(step), 1), safeTotal)
  const isLast = safeStep >= safeTotal

  const progress = safeTotal > 1 ? (safeStep - 1) / (safeTotal - 1) : 0
  const scaleIndex = Math.round(progress * (PENTATONIC_STEPS.length - 1)) // 0〜4
  const semitones = PENTATONIC_STEPS[scaleIndex] + (isLast ? 5 : 0)
  const frequency = REVEAL_BASE_FREQUENCY * 2 ** (semitones / 12)

  const now = ctx.currentTime
  playTone(ctx, frequency, now, 0.1, 0.08, 'sine')
}

// --- こっきピンボール専用の効果音 --------------------------------------------

/**
 * ボールを打ち出す「シュッ」。他のplayTone呼び出しと同様に周波数オートメーションは使わず、
 * 低い音→高い音の2音を間を詰めて連続再生することで「駆け上がる」勢いを表す。
 */
export function playPinballLaunchSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 320, now, 0.09, 0.12, 'triangle')
  playTone(ctx, 640, now + 0.05, 0.1, 0.12, 'triangle')
}

/**
 * バンパー音の連続再生を間引くクールダウン（ms）。
 * 3球が同時にバンパーへ何度も当たるゲーム性のため、間引かないと音が濁って耳障りになる。
 * モジュールスコープで前回再生時刻を持つ（複数のバンパーに当たっても1つの間隔として扱う）。
 */
const BUMPER_SOUND_MIN_INTERVAL_MS = 70
let lastBumperSoundAt = 0

/** バンパー衝突の「コッ」。短く控えめな音を、クールダウンで間引きながら鳴らす */
export function playPinballBumperSound(): void {
  if (!soundEnabled) return
  const now = Date.now()
  if (now - lastBumperSoundAt < BUMPER_SOUND_MIN_INTERVAL_MS) return
  lastBumperSoundAt = now
  const ctx = getAudioContext()
  if (!ctx) return
  // 400〜700Hz帯の中で毎回わずかに高さを変え、単調な連打に聞こえないようにする
  const frequency = 400 + Math.random() * 300
  playTone(ctx, frequency, ctx.currentTime, 0.06, 0.05, 'triangle')
}

/** おもちゃの連打で音が重なりすぎないよう、2種類のおもちゃで共通の間隔を設ける。 */
const PINBALL_TOY_SOUND_MIN_INTERVAL_MS = 70
let lastPinballToySoundAt: number | null = null

function canPlayPinballToySound(): boolean {
  if (!soundEnabled) return false
  const now = Date.now()
  if (
    lastPinballToySoundAt !== null &&
    now - lastPinballToySoundAt < PINBALL_TOY_SOUND_MIN_INTERVAL_MS
  ) {
    return false
  }
  lastPinballToySoundAt = now
  return true
}

/** 回転おもちゃの「くるくる」。短い2音を少しずらし、主役の音より控えめに鳴らす。 */
export function playPinballSpinnerSound(): void {
  if (!canPlayPinballToySound()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 620, now, 0.06, 0.05, 'sine')
  playTone(ctx, 820, now + 0.04, 0.07, 0.05, 'sine')
}

/** 押し上げおもちゃの「ポンッ」。短い低音から高音へつなぎ、弾む感じだけを添える。 */
export function playPinballLauncherSound(): void {
  if (!canPlayPinballToySound()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 300, now, 0.06, 0.06, 'triangle')
  playTone(ctx, 640, now + 0.025, 0.09, 0.06, 'sine')
}

/** ジャンプ台の「ドュン↑」。押し上げおもちゃより勢いのある3音の駆け上がりで、ロケット発射の印象にする。 */
export function playPinballJumppadSound(): void {
  if (!canPlayPinballToySound()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 220, now, 0.05, 0.07, 'triangle')
  playTone(ctx, 440, now + 0.03, 0.06, 0.07, 'triangle')
  playTone(ctx, 760, now + 0.06, 0.09, 0.06, 'sine')
}

/** シーソーの「ギィ、コトン」。木の板が傾く低めの2音で、回転・打ち上げ系とは違う質感にする。 */
export function playPinballSeesawSound(): void {
  if (!canPlayPinballToySound()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 260, now, 0.07, 0.06, 'triangle')
  playTone(ctx, 180, now + 0.05, 0.1, 0.07, 'sine')
}

/** 得点ゾーンの得点。1000点にいちばん近いほど高く華やかな音になる */
export function playPinballScoreSound(score: number): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  // 得点(100〜1000)を0〜1に正規化し、ペンタトニックスケール1オクターブぶんの高さへ割り当てる
  const progress = Math.min(1, Math.max(0, score / 1000))
  const scaleIndex = Math.round(progress * (PENTATONIC_STEPS.length - 1))
  const frequency = 523.25 * 2 ** (PENTATONIC_STEPS[scaleIndex] / 12) // C5 基準
  playTone(ctx, frequency, now, 0.22, 0.16, 'sine')
  // 高得点ほどオクターブ上を薄く重ねて、華やかさを足す
  if (score >= 1000) {
    playTone(ctx, frequency * 2, now + 0.05, 0.3, 0.1, 'sine')
  }
}

/** 合計点発表のファンファーレ。ペンタトニックで3音、駆け上がる */
export function playPinballTotalSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const base = 523.25 // C5
  const steps = [PENTATONIC_STEPS[0], PENTATONIC_STEPS[2], PENTATONIC_STEPS[4]]
  steps.forEach((semitones, i) => {
    const frequency = base * 2 ** (semitones / 12)
    playTone(ctx, frequency, now + i * 0.16, 0.32, 0.18, 'sine')
  })
}

// --- こっきドミノ専用の効果音 --------------------------------------------

/** 倒伏音の基準となる短いクリックの周波数。幼児向けに中音域へ収める。 */
const DOMINO_TICK_CLICK_FREQUENCY = 480
/** 倒伏音に重ねる木片のボディ音の周波数。クリックより少し低くして厚みを出す。 */
const DOMINO_TICK_BODY_FREQUENCY = 390
/** 打撃音の立ち上がり。既存playToneの20msでは短い木片音の頭が丸くなるため専用値にする。 */
const DOMINO_CLICK_ATTACK_SECONDS = 0.003
/** 指数減衰の終端。AudioParamは0へ指数補間できないため、最後に明示的に0へ落とす。 */
const DOMINO_CLICK_MIN_GAIN = 0.0001

/** 既存playToneと違い、数msで立ち上がって指数的に減衰する打撃音用エンベロープ。 */
function playDominoClick(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType,
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const stopTime = startTime + duration
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(DOMINO_CLICK_MIN_GAIN, startTime)
  gain.gain.linearRampToValueAtTime(volume, startTime + DOMINO_CLICK_ATTACK_SECONDS)
  gain.gain.exponentialRampToValueAtTime(DOMINO_CLICK_MIN_GAIN, stopTime)
  gain.gain.setValueAtTime(0, stopTime)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(stopTime)
}

/** ドミノが倒れ始めたときの「カタッ」。連打を前提に短く小さく鳴らす。 */
export function playDominoTickSound(intensity: number): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const safeIntensity = Number.isFinite(intensity)
    ? Math.min(1, Math.max(0, intensity))
    : 0
  // 音程と音量を少しだけ揺らし、連続した同音の機械的な印象を避ける。
  const frequencyVariation = 0.92 + Math.random() * 0.16
  const volumeVariation = 0.9 + Math.random() * 0.2
  const clickFrequency =
    (DOMINO_TICK_CLICK_FREQUENCY + safeIntensity * 40) * frequencyVariation
  const bodyFrequency =
    (DOMINO_TICK_BODY_FREQUENCY + safeIntensity * 40) * frequencyVariation
  const baseVolume = (0.03 + safeIntensity * 0.06) * volumeVariation
  const now = ctx.currentTime

  playDominoClick(ctx, clickFrequency, now, 0.045, baseVolume * 0.8, 'triangle')
  playDominoClick(ctx, bodyFrequency, now + 0.006, 0.06, baseVolume * 0.65, 'sine')
}

/** 国旗完成の「できた！」。短い4音の上行アルペジオで倒伏音と区別する。 */
export function playDominoCompleteSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const frequencies = [523.25, 659.25, 783.99, 1046.5] // C5→E5→G5→C6
  frequencies.forEach((frequency, index) => {
    playTone(ctx, frequency, now + index * 0.11, 0.32, 0.18, 'triangle')
  })
  // 最後のC6だけ薄く重ね、短い成功感を足す。
  playTone(ctx, 2093, now + 0.34, 0.42, 0.08, 'sine')
}

// --- こっきころころめいろ専用の効果音 ---

/** 壁に当たった「コツ」。衝突判定側で間引くため、ここではクールダウンを持たせない。 */
export function playMazeWallHitSound(intensity: number): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const safeIntensity = Number.isFinite(intensity)
    ? Math.min(1, Math.max(0, intensity))
    : 0
  // 240〜360Hz帯で毎回少しだけ高さを変え、同じ壁への連続接触を単調に聞かせない。
  const frequency = 240 + Math.random() * 120
  const volume = 0.018 + safeIntensity * 0.032
  playDominoClick(ctx, frequency, ctx.currentTime, 0.045, volume, 'triangle')
}

/** 星を取った「キラッ」。集めた順にペンタトニックを一段ずつ上がる2音にする。 */
export function playMazeStarSound(collectedIndex: number): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const safeIndex = Number.isFinite(collectedIndex)
    ? Math.min(
        PENTATONIC_STEPS.length - 1,
        Math.max(0, Math.trunc(collectedIndex)),
      )
    : 0
  const nextIndex = Math.min(safeIndex + 1, PENTATONIC_STEPS.length - 1)
  const firstSemitones = PENTATONIC_STEPS[safeIndex]!
  const secondSemitones = PENTATONIC_STEPS[nextIndex]! + (safeIndex === nextIndex ? 12 : 0)
  const baseFrequency = 523.25 // C5
  const now = ctx.currentTime
  playTone(ctx, baseFrequency * 2 ** (firstSemitones / 12), now, 0.09, 0.07, 'sine')
  playTone(
    ctx,
    baseFrequency * 2 ** (secondSemitones / 12),
    now + 0.05,
    0.1,
    0.06,
    'sine',
  )
}

/** ゴールの「できた！」。C5からC6までを0.1秒間隔で短く駆け上がる。 */
export function playMazeGoalSound(): void {
  if (!soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const frequencies = [523.25, 659.25, 783.99, 1046.5] // C5→E5→G5→C6
  frequencies.forEach((frequency, index) => {
    playTone(ctx, frequency, now + index * 0.1, 0.28, 0.16, 'triangle')
  })
}

// --- 3Dせんろづくり専用の効果音 ----------------------------------------------

/** レールの接続が確定したときの、短く明るいクリック。 */
export function playRailSnapSound(enabled = true): void {
  if (!enabled || !soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  playTone(ctx, 920, ctx.currentTime, 0.075, 0.045, 'triangle')
}

/** 電車が通常走行を始めるときの小さな発車音。 */
export function playRailDepartureSound(enabled = true): void {
  if (!enabled || !soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 260, now, 0.13, 0.045, 'triangle')
  playTone(ctx, 390, now + 0.08, 0.17, 0.04, 'sine')
}

/** 駅に停車したときの柔らかな到着音。 */
export function playRailStationStopSound(enabled = true): void {
  if (!enabled || !soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 660, now, 0.16, 0.04, 'sine')
  playTone(ctx, 520, now + 0.11, 0.2, 0.035, 'sine')
}

/** 駅から再発車するときの短い上行音。 */
export function playRailStationDepartureSound(enabled = true): void {
  if (!enabled || !soundEnabled) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  playTone(ctx, 420, now, 0.12, 0.04, 'triangle')
  playTone(ctx, 620, now + 0.085, 0.16, 0.035, 'sine')
}

// 呼び出し側で役割を読みやすくする別名（音色・実装は上の共有関数と同じ）。
export const playRailSnapClickSound = playRailSnapSound
export const playRailStartSound = playRailDepartureSound
export const playRailStationArrivalSound = playRailStationStopSound

/**
 * くるまのみちづくりの出発音。
 * 音声APIの不調がゲーム本体へ波及しないよう、車ゲーム側では安全な境界にする。
 */
const CAR_DEPARTURE_SOUND_MIN_INTERVAL_MS = 120
let lastCarDepartureSoundAt: number | null = null

export function playCarDepartureSound(): void {
  if (!soundEnabled) return
  const wallClockNow = Date.now()
  if (
    lastCarDepartureSoundAt !== null
    && wallClockNow - lastCarDepartureSoundAt < CAR_DEPARTURE_SOUND_MIN_INTERVAL_MS
  ) return
  lastCarDepartureSoundAt = wallClockNow

  try {
    playRailDepartureSound()
  } catch {
    // 音を出せない環境でも、出発処理はそのまま続ける。
  }
}

/** くるまがゴールしたときの短い上行成功音。 */
const CAR_GOAL_SOUND_MIN_INTERVAL_MS = 180
let lastCarGoalSoundAt: number | null = null

export function playCarGoalSound(): void {
  if (!soundEnabled) return

  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const wallClockNow = Date.now()
    if (
      lastCarGoalSoundAt !== null
      && wallClockNow - lastCarGoalSoundAt < CAR_GOAL_SOUND_MIN_INTERVAL_MS
    ) return
    lastCarGoalSoundAt = wallClockNow

    const now = ctx.currentTime
    playTone(ctx, 523.25, now, 0.18, 0.11, 'triangle')
    playTone(ctx, 659.25, now + 0.07, 0.2, 0.11, 'triangle')
    playTone(ctx, 1046.5, now + 0.15, 0.3, 0.12, 'sine')
  } catch {
    // 音声APIが使えなくてもゴール状態と演出は継続する。
  }
}

/**
 * いろぬりパズルで「できた！」を押したときの完成音。
 * ぬった絵が動き出す合図として、短く上へ駆け上がる4音＋キラッとした高音を鳴らす。
 * 連打で音が重なって割れないよう、既存の効果音と同じく最小間隔を設けている。
 */
const COLOR_PAINT_FINISH_SOUND_MIN_INTERVAL_MS = 400
let lastColorPaintFinishSoundAt: number | null = null

export function playColorPaintFinishSound(): void {
  if (!soundEnabled) return

  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const wallClockNow = Date.now()
    if (
      lastColorPaintFinishSoundAt !== null
      && wallClockNow - lastColorPaintFinishSoundAt < COLOR_PAINT_FINISH_SOUND_MIN_INTERVAL_MS
    ) return
    lastColorPaintFinishSoundAt = wallClockNow

    const now = ctx.currentTime
    // ド・ミ・ソ・ド（上）の分散和音。
    playTone(ctx, 523.25, now, 0.14, 0.1, 'triangle')
    playTone(ctx, 659.25, now + 0.06, 0.14, 0.1, 'triangle')
    playTone(ctx, 783.99, now + 0.12, 0.16, 0.1, 'triangle')
    playTone(ctx, 1046.5, now + 0.18, 0.32, 0.11, 'sine')
    // 最後にキラッと高い音を重ねる（画面のキラキラと合わせる）。
    playTone(ctx, 1567.98, now + 0.24, 0.26, 0.06, 'sine')
  } catch {
    // 音を出せない環境でも、完成演出はそのまま続ける。
  }
}

export type RailTrainSoundStatus =
  | 'ready'
  | 'running'
  | 'waiting'
  | 'approachingStation'
  | 'stoppedAtStation'
  | 'departing'

export type RailTrainSoundController = {
  /** RAFから毎フレーム呼ぶ。オーディオノードは走行開始時にだけ遅延生成する。 */
  update: (speed: number, status: RailTrainSoundStatus, inTunnel?: boolean) => void
  /** Optional shared profile hook used by the car-road adapter. */
  setVehicleProfile: (profile: CarRoadSoundProfile) => void
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

/**
 * 電車の走行音を1組のノードだけで管理する。
 * ready/waiting/stoppedAtStation ではゲインを0にし、running系だけ速度へ追従させる。
 */
export function createRailTrainSoundController(initialEnabled = true): RailTrainSoundController {
  let enabled = initialEnabled
  let profile: CarRoadSoundProfile = {
    oscillatorType: 'triangle',
    baseFrequency: 92,
    speedFrequency: 28,
    gainBase: 0.008,
    gainSpeed: 0.006,
    maxGain: 0.04,
  }
  let oscillator: OscillatorNode | undefined
  let gain: GainNode | undefined
  let disposed = false
  let targetGain = 0

  const setGain = (value: number, now: number) => {
    if (gain === undefined) return
    const safeValue = Math.min(0.045, Math.max(0, value))
    // engineはRAFごとにupdate/setEnabledを呼ぶため、同じ目標値を再予約しない。
    if (Math.abs(safeValue - targetGain) < 0.0005) return
    targetGain = safeValue
    const parameter = gain.gain as AudioParam & {
      cancelScheduledValues?: (time: number) => void
      setTargetAtTime?: (nextValue: number, startTime: number, timeConstant: number) => void
    }
    parameter.cancelScheduledValues?.(now)
    if (parameter.setTargetAtTime !== undefined) {
      parameter.setTargetAtTime(safeValue, now, 0.045)
    } else if (parameter.linearRampToValueAtTime !== undefined) {
      parameter.linearRampToValueAtTime(safeValue, now + 0.045)
    } else {
      parameter.value = safeValue
    }
  }

  const ensureNodes = (): AudioContext | undefined => {
    if (disposed || !enabled || !soundEnabled) return undefined
    const ctx = getAudioContext()
    if (!ctx) return undefined
    if (oscillator === undefined || gain === undefined) {
      oscillator = ctx.createOscillator()
      gain = ctx.createGain()
      oscillator.type = profile.oscillatorType
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0, ctx.currentTime)
      oscillator.start(ctx.currentTime)
    }
    return ctx
  }

  return {
    update(speed, status, inTunnel = false) {
      if (disposed) return
      const isMoving = status === 'running'
        || status === 'approachingStation'
        || status === 'departing'
      const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
      if (!isMoving || safeSpeed <= 0.015) {
        if (gain !== undefined) {
          const ctx = getAudioContext()
          if (ctx !== undefined) setGain(0, ctx.currentTime)
        }
        return
      }
      const ctx = isMoving && safeSpeed > 0.015 ? ensureNodes() : undefined
      if (ctx === undefined || gain === undefined || oscillator === undefined) {
        if (gain !== undefined && !soundEnabled) setGain(0, getAudioContext()?.currentTime ?? 0)
        return
      }
      const now = ctx.currentTime
      const tunnelFactor = inTunnel ? 0.86 : 1
      const frequency = (profile.baseFrequency + Math.min(220, safeSpeed * profile.speedFrequency)) * (inTunnel ? 0.9 : 1)
      const frequencyParameter = oscillator.frequency as AudioParam & {
        setTargetAtTime?: (nextValue: number, startTime: number, timeConstant: number) => void
      }
      if (frequencyParameter.setTargetAtTime !== undefined) {
        frequencyParameter.setTargetAtTime(frequency, now, 0.06)
      } else {
        frequencyParameter.value = frequency
      }
      setGain(Math.min(profile.maxGain, (profile.gainBase + safeSpeed * profile.gainSpeed) * tunnelFactor), now)
    },
    setVehicleProfile(nextProfile) {
      profile = nextProfile
      if (oscillator !== undefined) oscillator.type = profile.oscillatorType
    },
    setEnabled(nextEnabled) {
      if (enabled === nextEnabled) return
      enabled = nextEnabled
      if (!enabled && gain !== undefined) {
        setGain(0, getAudioContext()?.currentTime ?? 0)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (gain !== undefined) {
        try { gain.disconnect() } catch { /* Web Audioモックや解放済みノード */ }
      }
      if (oscillator !== undefined) {
        try { oscillator.stop() } catch { /* 既に停止済み */ }
        try { oscillator.disconnect() } catch { /* Web Audioモックや解放済みノード */ }
      }
      gain = undefined
      oscillator = undefined
    },
  }
}

export const createRailSoundController = createRailTrainSoundController

export type CarRoadSoundController = {
  /** 走行中だけ音を有効にする。AudioNodeはcontroller内で1組だけ再利用する。 */
  setRunning: (running: boolean) => void
  /** 停止中に次回走行で使う車種の走行音プロファイルを選ぶ。 */
  setVehicle: (vehicleId: CarRoadSoundVehicleId) => void
  dispose: () => void
}

export type CarRoadSoundVehicleId = 'car' | 'police-car' | 'bus' | 'bulldozer'

type CarRoadSoundProfile = Readonly<{
  oscillatorType: OscillatorType
  baseFrequency: number
  speedFrequency: number
  gainBase: number
  gainSpeed: number
  maxGain: number
}>

/**
 * 幼児向けに違いが聞き取りやすい、控えめな合成走行音の設定。
 * 外部音源を使わず、既存の1つのオシレーターを車種ごとに調整する。
 */
const CAR_ROAD_SOUND_PROFILES: Record<CarRoadSoundVehicleId, CarRoadSoundProfile> = {
  car: { oscillatorType: 'triangle', baseFrequency: 118, speedFrequency: 26, gainBase: 0.004, gainSpeed: 0.004, maxGain: 0.018 },
  'police-car': { oscillatorType: 'sawtooth', baseFrequency: 145, speedFrequency: 30, gainBase: 0.004, gainSpeed: 0.0045, maxGain: 0.022 },
  bus: { oscillatorType: 'triangle', baseFrequency: 82, speedFrequency: 20, gainBase: 0.004, gainSpeed: 0.004, maxGain: 0.021 },
  bulldozer: { oscillatorType: 'square', baseFrequency: 62, speedFrequency: 15, gainBase: 0.0045, gainSpeed: 0.0045, maxGain: 0.024 },
}

/**
 * くるまのみちづくり用の走行音adapter。
 * 既存の走行音controllerを再利用し、ゲーム側が複雑な音声状態を持たないようにする。
 */
export function createCarRoadSoundController(initialEnabled = true): CarRoadSoundController {
  const controller = createRailTrainSoundController(initialEnabled)
  let vehicleId: CarRoadSoundVehicleId = 'car'
  return {
    setRunning(running) {
      try {
        const profile = CAR_ROAD_SOUND_PROFILES[vehicleId]
        controller.setVehicleProfile(profile)
        controller.update(running ? 1 : 0, running ? 'running' : 'ready')
      } catch {
        // Web Audio実装が壊れていても、走行状態や画面操作を止めない。
      }
    },
    setVehicle(nextVehicleId) {
      vehicleId = nextVehicleId
      controller.setVehicleProfile(CAR_ROAD_SOUND_PROFILES[nextVehicleId])
    },
    dispose() {
      try {
        controller.dispose()
      } catch {
        // 解放処理の失敗も画面離脱を妨げない。
      }
    },
  }
}
