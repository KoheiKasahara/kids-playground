// たたかいの ざひょうは かえず、わざに あわせて 絵だけを うごかす。
// ポーズは 既存の あし・ツノ・あごを つかい、スプライトの 種類を ふやしすぎない。

import type { Fighter } from './battle'
import type { Pose } from './model'
import { RUSH_HIT_INTERVAL, strikeDuration, windupDuration } from './techniques'

export type FighterMotion = {
  pose: Pose
  /** からだの むきに たいする まえ・よこ・うえの ずれ。 */
  forward: number
  sideways: number
  height: number
  /** うえから みた ひねりと、まえを あげる かたむき。 */
  yaw: number
  pitch: number
}

const unit = (n: number) => Math.max(0, Math.min(1, n))
const ease = (n: number) => { const k = unit(n); return k * k * (3 - 2 * k) }

/** シミュレーションと おなじ わざの じかんで、ため・うちこみ・もどりを つくる。 */
export function fighterMotion(f: Fighter, calm = false): FighterMotion {
  const m: FighterMotion = { pose: { ...f.pose }, forward: 0, sideways: 0, height: 0, yaw: 0, pitch: 0 }
  const move = f.move ?? f.sp.move.kind
  const turn = f.orbit
  if (f.state === 'windup') {
    const k = ease(f.t / windupDuration(f.sp, move))
    m.forward = -4 * k
    m.pose.leg = 0
    switch (move) {
      case 'charge':
        m.forward = -8 * k; m.pitch = -.1 * k; m.pose.lift = .1; break
      case 'rush':
        m.forward = -3 * k; m.pitch = -.06 * k; m.pose.lift = .25; break
      case 'sweep':
        m.yaw = -.55 * turn * k; m.sideways = -3 * turn * k; m.pose.lift = .25; break
      case 'toss':
        m.forward = -6 * k; m.pitch = -.16 * k; m.pose.lift = 0; break
      case 'pinch':
        m.forward = -2 * k; m.pose.jaw = 1; m.pose.lift = .2 + .3 * k; break
      case 'lift':
        m.pose.jaw = 1; m.pose.lift = .2; m.pitch = -.05 * k; break
      case 'scoop':
        m.pose.lift = 0; m.pitch = -.1 * k; break
      case 'utchari':
        m.yaw = -.35 * turn * k; m.pitch = -.12 * k; m.pose.lift = .4; break
    }
  } else if (f.state === 'strike') {
    const k = unit(f.t / strikeDuration(move))
    // さいしょに すばやく うちこみ、さいごは もとの かまえへ もどる。
    const hit = (1 - ease(k))
    m.pose.leg = f.t * 2
    switch (move) {
      case 'charge':
        m.forward = 11 * hit; m.pitch = -.09 * hit; m.pose.lift = .1; break
      case 'rush': {
        // 3かいの あたり（0、.18、.36びょう）に あわせて つきだす。
        // さいしょは ふりだす。とめられたら、つぎの つきは ださない。
        const jab = Math.max(0, ...[0, RUSH_HIT_INTERVAL, RUSH_HIT_INTERVAL * 2].map((t, i) =>
          f.t >= t && (i === 0 || f.rushHits > i) ? 1 - (f.t - t) / .14 : 0))
        m.forward = 8 * jab; m.pitch = -.07 * jab; m.pose.lift = .15 + .35 * jab
        m.pose.leg = f.t * 5; m.pose.jaw = 1 - jab
        break
      }
      case 'sweep':
        m.forward = 3 * hit; m.sideways = 5 * turn * hit
        m.yaw = .8 * turn * hit; m.pitch = .08 * hit; m.pose.lift = .6 * hit; break
      case 'toss':
        m.forward = 4 * hit; m.height = 9 * hit; m.pitch = .32 * hit
        m.pose.lift = hit; m.pose.jaw = .2; break
      case 'pinch':
        m.forward = 3 * hit; m.pose.jaw = k < .65 ? 0 : ease((k - .65) / .35)
        m.pose.lift = .4; m.yaw = Math.sin(k * Math.PI * 4) * .05 * hit; break
      case 'lift':
        m.forward = 2 * hit; m.height = 5 * hit; m.pitch = .14 * hit
        m.pose.lift = hit; m.pose.jaw = k < .7 ? 0 : (k - .7) / .3; break
      case 'scoop':
        m.forward = 7 * hit; m.height = 3 * hit; m.pitch = .22 * hit
        m.pose.lift = hit; break
      case 'utchari':
        m.forward = -3 * hit; m.sideways = 4 * turn * hit; m.yaw = 1.05 * turn * hit
        m.height = 3 * hit; m.pitch = .22 * hit; m.pose.lift = hit; m.pose.jaw = 0; break
    }
  } else if (f.state === 'stagger') {
    const settle = Math.max(0, 1 - f.t / .55)
    m.forward = -3 * settle
    m.pitch = -.14 * settle
    m.yaw = Math.sin(f.t * 25) * .12 * settle
  } else if (f.state === 'flipped') {
    m.pitch = Math.sin(f.t * 12) * .12
    m.sideways = Math.sin(f.t * 9) * 1.2
  } else if (f.state === 'cling') {
    m.pitch = Math.sin(f.t * 5) * .1
  } else if (f.state === 'win') {
    const cheer = (1 - Math.cos(f.t * 5)) / 2
    if (f.sp.group === 'kabuto') {
      // カブトは ツノを ぐいっと あげ、クワガタは あごを ひらいて あしぶみ。
      m.height = cheer * 3; m.pitch = cheer * .15; m.pose.lift = .5 + cheer * .5
    } else {
      m.yaw = Math.sin(f.t * 4) * .16; m.sideways = Math.sin(f.t * 4) * 1.5
      m.pose.jaw = .5 + cheer * .5; m.pose.leg = f.t * 1.5
    }
  } else if (f.state === 'approach' || f.state === 'flee' || f.state === 'circle') {
    m.height = Math.abs(Math.sin(f.pose.leg * Math.PI * 2)) * .7
  }

  if (calm) {
    // わざの ツノ・あごは のこし、ゆれ・とびはね・こまかい あしぶみを とめる。
    m.forward = 0; m.sideways = 0; m.height = 0; m.yaw = 0; m.pitch = 0
    if (f.state === 'win' || f.state === 'ready') {
      m.pose.leg = 0; m.pose.lift = f.state === 'win' ? 1 : .25
      m.pose.jaw = f.sp.group === 'kuwagata' ? 1 : 0
    } else if (f.state === 'strike' || f.state === 'windup') m.pose.leg = 0
  }
  return m
}

/** からだの むきを つかって、絵の ずれだけを ばしょの ざひょうに うつす。 */
export function motionPosition(f: Pick<Fighter, 'u' | 'v' | 'z' | 'heading'>, m: FighterMotion) {
  const c = Math.cos(f.heading), s = Math.sin(f.heading)
  return { u: f.u + m.forward * c - m.sideways * s, v: f.v + m.forward * s + m.sideways * c, z: f.z + m.height }
}
