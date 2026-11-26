// 行動（behavior.ts）が決めたクリップ・速さ・旋回の速さを、Three.js の AnimationMixer へ写す。
// - 歩き: 直進 Walk と曲がり歩き WalkLeft / WalkRight を旋回の速さでブレンドし、再生速度は移動の速さに合わせる。
// - 走り・方向転換も、1周あたりの移動量・旋回量から再生速度を決める（足が滑らない）。
// - クリップの切り替えはウェイトを一定の速さで移し替えてなめらかにつなぐ。

import * as THREE from 'three'
import type { AnimalState } from './behavior'
import type { AnimalManifest } from './motion'

const WALK_GROUP = ['Walk', 'WalkLeft', 'WalkRight'] as const

/**
 * 重ねがけ用のクリップ（まばたき）から、指定した骨の大きさのトラックだけを残す。
 * glTF の書き出しは全身の骨を含めるため、そのまま重ねると体が休止姿勢へ引き戻されてしまう。
 */
export function overlayClip(clip: THREE.AnimationClip, bones: readonly string[]): THREE.AnimationClip {
  const keep = new Set(bones.map(b => `${b}.scale`))
  return new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter(t => keep.has(t.name)))
}
const FADE: Record<string, number> = { default: 0.3, LieDown: 0.5, GetUp: 0.35, Sleep: 0.6, Idle: 0.35 }

export class AnimalAnimator {
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private readonly weights = new Map<string, number>()
  private token = -1
  private blinkIn = 2 + Math.random() * 3
  private readonly walkSpeed: number
  private readonly runSpeed: number
  private readonly walkTurn: number
  private readonly turnSpeed: number

  constructor(readonly mixer: THREE.AnimationMixer, clips: readonly THREE.AnimationClip[],
    private readonly manifest: AnimalManifest, scale: number) {
    for (const source of clips) {
      const info = manifest.clips[source.name]
      if (!info) continue
      const clip = info.kind === 'overlay' && info.bones ? overlayClip(source, info.bones) : source
      const action = mixer.clipAction(clip)
      action.setLoop(info.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
      action.clampWhenFinished = !info.loop && info.kind !== 'overlay'
      this.actions.set(clip.name, action)
      this.weights.set(clip.name, 0)
    }
    const c = manifest.clips
    const rate = (name: string) => (c[name].distancePerCycle ?? 0) / c[name].duration * scale
    this.walkSpeed = rate('Walk')
    this.runSpeed = rate('Run')
    this.walkTurn = ((c.WalkLeft.turnPerCycle ?? 0) / c.WalkLeft.duration) * Math.PI / 180
    this.turnSpeed = (Math.abs(c.TurnLeft.turnPerCycle ?? 0) / c.TurnLeft.duration) * Math.PI / 180
    this.weights.set('Idle', 1)
    this.start('Idle')
  }

  private start(name: string, restart = false): THREE.AnimationAction | undefined {
    const action = this.actions.get(name)
    if (!action) return undefined
    if (restart) action.reset()
    if (!action.isRunning()) action.play()
    return action
  }

  /** 毎フレーム呼ぶ。visible が false（画面外）のときは呼び出し側で間引いてよい。レース（race/）は行動の状態のうち再生に使う分だけを渡す。 */
  update(dt: number, a: Pick<AnimalState, 'clip' | 'clipToken' | 'speed' | 'turnRate' | 'mode'>): void {
    const targets = new Map<string, number>()
    const clip = a.clip
    if (clip === 'Walk' || clip === 'Run') {
      const move = Math.min(1, a.speed / (0.35 * this.walkSpeed))
      targets.set('Idle', 1 - move)
      if (clip === 'Walk') {
        const scaleRate = Math.max(0.25, a.speed / this.walkSpeed)
        const turn = Math.max(-1, Math.min(1, a.turnRate / (this.walkTurn * scaleRate)))
        targets.set('Walk', move * (1 - Math.abs(turn)))
        targets.set('WalkLeft', move * Math.max(0, turn))
        targets.set('WalkRight', move * Math.max(0, -turn))
      } else {
        targets.set('Run', move)
      }
    } else {
      targets.set(this.actions.has(clip) ? clip : 'Idle', 1)
    }

    if (a.clipToken !== this.token) {
      this.token = a.clipToken
      const info = this.manifest.clips[clip]
      if (info && !info.loop) this.start(clip, true)
      if (clip === 'Sleep' || clip === 'Idle') this.start(clip)
    }

    // 歩きの3つは同じ周期・同じ位相で作ってあるので、時刻をそろえて混ぜる
    const walk = this.actions.get('Walk')
    const fade = (FADE[clip] ?? FADE.default)
    let total = 0
    for (const [name, action] of this.actions) {
      if (this.manifest.clips[name]?.kind === 'overlay') continue
      const target = targets.get(name) ?? 0
      const current = this.weights.get(name) ?? 0
      const step = dt / fade
      const next = current + Math.max(-step, Math.min(step, target - current))
      this.weights.set(name, next)
      total += next
      if (next > 0.001 && !action.isRunning() && (this.manifest.clips[name]?.loop ?? false)) {
        // 走り⇔歩きは周期の割合をそろえて始める（足の運びが途中で飛ばない）
        if ((name === 'Run' || WALK_GROUP.includes(name as never)) && walk) {
          const ref = name === 'Run' ? walk : this.actions.get('Run')
          const refWeight = ref ? this.weights.get(ref.getClip().name) ?? 0 : 0
          action.time = ref && refWeight > 0.001 ? (ref.time / ref.getClip().duration) * action.getClip().duration : 0
        }
        action.play()
      }
    }
    // ウェイトの合計を 1 にそろえる（合計が 1 未満だと休止姿勢が混ざってしまう）
    for (const [name, action] of this.actions) {
      if (this.manifest.clips[name]?.kind === 'overlay') continue
      const w = (this.weights.get(name) ?? 0) / (total || 1)
      action.setEffectiveWeight(w)
      if (w <= 0.001 && (targets.get(name) ?? 0) === 0 && action.isRunning() && this.manifest.clips[name]?.loop) action.stop()
    }

    const ts = (name: string, v: number) => this.actions.get(name)?.setEffectiveTimeScale(v)
    const walkRate = Math.max(0.3, a.speed / this.walkSpeed)
    for (const name of WALK_GROUP) ts(name, walkRate)
    ts('Run', Math.max(0.4, a.speed / this.runSpeed))
    const turnRate = a.mode === 'turn' ? Math.max(0.5, Math.min(1.4, Math.abs(a.turnRate) / this.turnSpeed)) : 1
    ts('TurnLeft', turnRate)
    ts('TurnRight', turnRate)
    if (walk) {
      for (const name of ['WalkLeft', 'WalkRight']) {
        const action = this.actions.get(name)
        if (action) action.time = walk.time
      }
    }

    // まばたき: 歩き・走り・方向転換の最中だけ重ねる（待機・食事などはクリップ自体に入っている）
    this.blinkIn -= dt
    if (this.blinkIn <= 0) {
      this.blinkIn = 2.5 + Math.random() * 3.5
      if (clip === 'Walk' || clip === 'Run' || clip.startsWith('Turn')) {
        const blink = this.start('Blink', true)
        blink?.setEffectiveWeight(1)
      }
    }
    this.mixer.update(dt)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
  }
}
