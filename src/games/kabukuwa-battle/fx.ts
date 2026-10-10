// たたかいの こまかい えんしゅつ（ひばな・つちけむり・はっぱ・ほし・かみふぶき）。
// つぶは ばしょの ざひょう（u, v, z）で うごかし、かくときに カメラで うつす。

import type { Battle, BattleEvent } from './battle'
import type { StageId } from './stages'

export type ParticleKind = 'spark' | 'dust' | 'leaf' | 'star' | 'confetti' | 'ring' | 'drop' | 'glow'

export type Particle = {
  kind: ParticleKind
  u: number; v: number; z: number
  vu: number; vv: number; vz: number
  life: number
  max: number
  color: string
  size: number
}

export type Fx = {
  parts: Particle[]
  random: () => number
}

export function createFx(seed = 1): Fx {
  let s = seed >>> 0
  return {
    parts: [],
    random: () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    },
  }
}

function add(fx: Fx, p: Omit<Particle, 'max'>) {
  if (fx.parts.length > 260) fx.parts.shift()
  fx.parts.push({ ...p, max: p.life })
}

export function burst(fx: Fx, kind: ParticleKind, u: number, v: number, z: number, count: number, colors: readonly string[], speed: number, life: number, up = 0) {
  for (let i = 0; i < count; i++) {
    const a = fx.random() * Math.PI * 2
    const sp = speed * (.4 + fx.random() * .6)
    add(fx, {
      kind, u, v, z,
      vu: Math.cos(a) * sp, vv: Math.sin(a) * sp * .6, vz: up + (fx.random() - .3) * speed,
      life: life * (.6 + fx.random() * .5), color: colors[i % colors.length], size: kind === 'confetti' ? 2 : 1,
    })
  }
}

const SPARK = ['#ffffff', '#fff2a0', '#ffd04a']
const DUST = ['#c8b490', '#a89470', '#8a7858']
const LEAF = ['#4a7a2a', '#6a9a34', '#8a6a2a', '#a8762a']
const CONFETTI = ['#ff5a5a', '#ffd23a', '#5ad06a', '#4aa8ff', '#e07aff', '#ffffff']

/** たたかいの できごとに あわせて つぶを だす。 */
export function spawnFx(fx: Fx, e: BattleEvent, battle: Battle) {
  const stage: StageId = battle.stage
  switch (e.type) {
    case 'clash':
      burst(fx, 'spark', e.u, e.v, 8, 10, SPARK, 70, .35, 20)
      add(fx, { kind: 'ring', u: e.u, v: e.v, z: 8, vu: 0, vv: 0, vz: 0, life: .25, color: '#ffffff', size: 4 })
      break
    case 'hit':
      burst(fx, 'spark', e.u, e.v, e.z, e.big ? 18 : 10, SPARK, e.big ? 110 : 80, .45, 30)
      burst(fx, 'star', e.u, e.v, e.z + 6, e.big ? 6 : 3, ['#ffe060', '#ffffff'], 60, .7, 40)
      add(fx, { kind: 'ring', u: e.u, v: e.v, z: e.z, vu: 0, vv: 0, vz: 0, life: .3, color: '#fff6c0', size: e.big ? 9 : 6 })
      if (stage === 'branch') burst(fx, 'leaf', e.u, e.v, 4, 4, LEAF, 40, 1.6, 10)
      break
    case 'block':
      burst(fx, 'spark', e.u, e.v, 8, 5, SPARK, 50, .25, 15)
      break
    case 'land':
      burst(fx, 'dust', e.u, e.v, 0, 10, DUST, 40, .55, 12)
      break
    case 'fall':
      if (stage === 'branch') {
        const f = battle.f[e.side]
        burst(fx, 'leaf', f.u, f.v, 0, 8, LEAF, 50, 2.2, 6)
      }
      break
    case 'end': {
      const w = battle.f[e.winner]
      burst(fx, 'confetti', w.u, w.v, 70, 50, CONFETTI, 90, 2.4, 50)
      break
    }
  }
}

/** たえず ちょっと ある もの（ほたる・まう はっぱ）。 */
export function ambient(fx: Fx, stage: StageId, dt: number, centerU: number) {
  if (stage === 'branch' && fx.random() < dt * 1.5) {
    add(fx, { kind: 'glow', u: centerU + (fx.random() - .5) * 360, v: 40 + fx.random() * 60, z: 20 + fx.random() * 120, vu: (fx.random() - .5) * 8, vv: 0, vz: (fx.random() - .5) * 6, life: 4 + fx.random() * 3, color: '#d8ff8a', size: 1 })
  }
  if (stage === 'log' && fx.random() < dt * .5) {
    add(fx, { kind: 'leaf', u: (fx.random() - .5) * 260, v: (fx.random() - .5) * 160, z: 130, vu: (fx.random() - .5) * 10, vv: 0, vz: -14, life: 9, color: LEAF[Math.floor(fx.random() * LEAF.length)], size: 1 })
  }
}

export function updateFx(fx: Fx, dt: number) {
  for (const p of fx.parts) {
    p.life -= dt
    p.u += p.vu * dt
    p.v += p.vv * dt
    p.z += p.vz * dt
    switch (p.kind) {
      case 'spark': p.vz -= 260 * dt; p.vu *= .92; p.vv *= .92; break
      case 'star': p.vz -= 120 * dt; break
      case 'dust': p.vu *= .9; p.vv *= .9; p.vz = 6; break
      case 'leaf': p.vz = Math.max(p.vz - 40 * dt, -18); p.vu = Math.sin(p.life * 3) * 14; break
      case 'confetti': p.vz = Math.max(p.vz - 120 * dt, -30); p.vu *= .97; p.vv *= .97; break
      case 'drop': p.vz -= 200 * dt; break
      default: break
    }
  }
  fx.parts = fx.parts.filter(p => p.life > 0)
}
