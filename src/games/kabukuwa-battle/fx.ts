// たたかいの こまかい えんしゅつ（ひばな・つちけむり・はっぱ・ほし・かみふぶき）。
// つぶは ばしょの ざひょう（u, v, z）で うごかし、かくときに カメラで うつす。

import type { Battle, BattleEvent } from './battle'
import type { StageId } from './stages'

export type ParticleKind = 'spark' | 'dust' | 'leaf' | 'star' | 'confetti' | 'ring' | 'drop' | 'glow' | 'burst' | 'lines' | 'flash'

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
  /** うごきを へらす せってい（ひかりの てんだけを しずかに だす）。 */
  calm: boolean
  parts: Particle[]
  random: () => number
}

export function createFx(seed = 1, calm = false): Fx {
  let s = seed >>> 0
  return {
    calm,
    parts: [],
    random: () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    },
  }
}

function add(fx: Fx, p: Omit<Particle, 'max'>) {
  if (fx.calm && (p.kind === 'flash' || p.kind === 'lines' || p.kind === 'burst' || p.kind === 'ring')) return
  if (fx.parts.length >= 260) fx.parts.shift()
  fx.parts.push({ ...p, ...(fx.calm ? { vu: 0, vv: 0, vz: 0 } : {}), max: p.life })
}

export function burst(fx: Fx, kind: ParticleKind, u: number, v: number, z: number, count: number, colors: readonly string[], speed: number, life: number, up = 0) {
  if (fx.calm) count = Math.min(count, 4)
  for (let i = 0; i < count; i++) {
    const a = fx.random() * Math.PI * 2
    const sp = speed * (.4 + fx.random() * .6)
    add(fx, {
      kind, u: u + (fx.calm ? Math.cos(a) * 5 : 0), v, z: z + (fx.calm ? Math.sin(a) * 5 : 0),
      vu: Math.cos(a) * sp, vv: Math.sin(a) * sp * .6, vz: up + (fx.random() - .3) * speed,
      life: life * (.6 + fx.random() * .5), color: colors[i % colors.length], size: kind === 'confetti' ? 2 : 1,
    })
  }
}

const SPARK = ['#ffffff', '#fff2a0', '#ffd04a']
const DUST = ['#c8b490', '#a89470', '#8a7858']
const LEAF = ['#4a7a2a', '#6a9a34', '#8a6a2a', '#a8762a']
const CONFETTI = ['#ff5a5a', '#ffd23a', '#5ad06a', '#4aa8ff', '#e07aff', '#ffffff']

/** わざの かたちを えがく。u・v の むきは せめた むしに あわせる。 */
function techniqueTrail(fx: Fx, e: Extract<BattleEvent, { type: 'hit' }>, battle: Battle) {
  if (fx.calm) return
  const heading = battle.f[e.side].heading
  const du = Math.cos(heading), dv = Math.sin(heading)
  const point = (along: number, across: number, height: number, forward: number, sideways: number, up: number, color: string, kind: ParticleKind = 'spark') => {
    add(fx, {
      kind, u: e.u + du * along - dv * across, v: e.v + dv * along + du * across, z: e.z + height,
      vu: du * forward - dv * sideways, vv: dv * forward + du * sideways, vz: up,
      life: .5, color, size: 1,
    })
  }
  switch (e.move) {
    case 'rush':
    case 'charge': {
      // れんぞくづきは 3ぼんの すじ。たいあたりは あしもとの つちけむり。
      const rushing = e.move === 'rush'
      for (let lane = -1; lane <= 1; lane++) {
        for (let i = 0; i < 6; i++) {
          point(-i * 5, lane * 5, rushing ? lane * 3 : -8, 85 + i * 7, lane * 4, rushing ? 10 : 4, rushing ? '#b5efff' : DUST[i % DUST.length], rushing ? 'spark' : 'dust')
        }
      }
      break
    }
    case 'sweep':
    case 'utchari': {
      // よこなげは ちめんに そった はんえん、うっちゃりは あたまを こす おおきな ゆみ。
      const reverse = e.move === 'utchari'
      const turn = battle.f[e.side].orbit
      for (let i = 0; i < 15; i++) {
        const a = -Math.PI * .8 + i / 14 * Math.PI * 1.6
        const r = reverse ? 30 : 24
        point(Math.cos(a) * r - 12, Math.sin(a) * r * turn, reverse ? Math.cos(a) * 22 + 12 : 2,
          -Math.sin(a) * 50, Math.cos(a) * 50 * turn, reverse ? 50 : 12, reverse ? '#ffbd78' : '#a9f4dc')
      }
      add(fx, { kind: 'ring', u: e.u, v: e.v, z: e.z, vu: 0, vv: 0, vz: 0, life: .45, color: reverse ? '#ffbd78' : '#a9f4dc', size: reverse ? 24 : 20 })
      break
    }
    case 'toss':
      // まっすぐ かちあげる たかい ひかりの はしら。
      for (let i = 0; i < 12; i++) point(0, (i % 3 - 1) * 4, i * 3, 8, 0, 105 + i * 3, '#c7d0ff')
      for (let i = 0; i < 3; i++) {
        add(fx, { kind: 'ring', u: e.u, v: e.v, z: e.z + i * 15, vu: du * 8, vv: dv * 8, vz: 65, life: .48, color: '#c7d0ff', size: 7 - i })
      }
      break
    case 'scoop':
      for (let i = 0; i < 12; i++) {
        const a = i / 11 * Math.PI * .7
        point(-16 + Math.sin(a) * 25, 0, 2 + (1 - Math.cos(a)) * 20, Math.cos(a) * 55, 0, 70, '#ffe394')
      }
      break
    case 'lift':
      for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) point(i * 2, side * 7, i * 5, 16, side * 4, 75, '#d5f8a8', 'star')
      }
      break
    case 'pinch':
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) point(-4 + i * 2, side * (8 + i * 3), i % 2 * 3, 0, -side * 55, 8, '#ffb6c9')
      }
      break
  }
}

/** たたかいの できごとに あわせて つぶを だす。 */
export function spawnFx(fx: Fx, e: BattleEvent, battle: Battle) {
  const stage: StageId = battle.stage
  switch (e.type) {
    case 'windup': {
      const f = battle.f[e.side]
      const du = Math.cos(f.heading), dv = Math.sin(f.heading)
      const u = f.u + du * f.front * .6, v = f.v + dv * f.front * .6
      // からだを ためる あいだに、ツノ・あごの さきへ ひかりが あつまる。
      const count = fx.calm ? 1 : 7
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2
        const r = fx.calm ? 0 : 16
        add(fx, { kind: 'star', u: u + Math.cos(a) * r, v, z: f.z + 14 + Math.sin(a) * r, vu: -Math.cos(a) * 32, vv: 0, vz: -Math.sin(a) * 32, life: .38, color: '#c8eaff', size: 1 })
      }
      break
    }
    case 'clash':
      burst(fx, 'spark', e.u, e.v, 8, 14, SPARK, 80, .4, 24)
      add(fx, { kind: 'ring', u: e.u, v: e.v, z: 8, vu: 0, vv: 0, vz: 0, life: .25, color: '#ffffff', size: 7 })
      add(fx, { kind: 'burst', u: e.u, v: e.v, z: 8, vu: 0, vv: 0, vz: 0, life: .22, color: '#ffffff', size: 18 })
      break
    case 'hit': {
      const big = e.big || e.move === 'utchari'
      burst(fx, 'spark', e.u, e.v, e.z, big ? 24 : 12, SPARK, big ? 130 : 90, .5, 34)
      burst(fx, 'star', e.u, e.v, e.z + 6, big ? 8 : 4, ['#ffe060', '#ffffff'], 70, .8, 46)
      add(fx, { kind: 'ring', u: e.u, v: e.v, z: e.z, vu: 0, vv: 0, vz: 0, life: .3, color: '#fff6c0', size: big ? 14 : 9 })
      add(fx, { kind: 'burst', u: e.u, v: e.v, z: e.z, vu: 0, vv: 0, vz: 0, life: .28, color: '#fffbe8', size: big ? 34 : 22 })
      techniqueTrail(fx, e, battle)
      if (big && !fx.calm) {
        add(fx, { kind: 'lines', u: e.u, v: e.v, z: e.z, vu: 0, vv: 0, vz: 0, life: .45, color: 'rgba(255,255,255,.75)', size: 26 })
        add(fx, { kind: 'flash', u: e.u, v: e.v, z: e.z, vu: 0, vv: 0, vz: 0, life: .14, color: '#ffffff', size: 1 })
      }
      if (stage === 'branch' && !fx.calm) burst(fx, 'leaf', e.u, e.v, 4, 4, LEAF, 40, 1.6, 10)
      break
    }
    case 'block':
      burst(fx, 'spark', e.u, e.v, 8, 8, SPARK, 60, .3, 18)
      add(fx, { kind: 'burst', u: e.u, v: e.v, z: 10, vu: 0, vv: 0, vz: 0, life: .18, color: '#d8e8ff', size: 12 })
      break
    case 'dodge': {
      if (fx.calm) break
      const f = battle.f[e.side]
      // よけた あとの、よこへ ながれる みじかい すじ。
      const du = -Math.sin(f.heading), dv = Math.cos(f.heading)
      for (let i = 0; i < 9; i++) {
        add(fx, { kind: 'spark', u: f.u - du * i * 3, v: f.v - dv * i * 3, z: f.z + 7 + i % 3 * 3, vu: du * 45, vv: dv * 45, vz: 10, life: .3, color: '#c4efff', size: 1 })
      }
      break
    }
    case 'land':
      burst(fx, 'dust', e.u, e.v, 0, 16, DUST, 55, .6, 14)
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
  if (fx.calm) return
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
    if (fx.calm) continue
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
