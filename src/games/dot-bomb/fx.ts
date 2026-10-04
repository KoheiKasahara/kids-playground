// こうか（つぶ・ゆれ・ひかり）。せかいの できごとから つくり、えの がわだけで うごかす。

import type { ItemKind, World, WorldEvent } from './core'
import { DX, DY, TILE } from './core'
import { hash2 } from './pixel'
import { RIDE_PALS } from './sprites'
import type { Theme } from './theme'

export type ParticleKind = 'spark' | 'debris' | 'smoke' | 'star' | 'ring' | 'confetti' | 'ember' | 'dust' | 'shell' | 'heart' | 'pop' | 'flame'

export type Particle = {
  kind: ParticleKind
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; max: number
  color: string; size: number
}

export type FloatIcon = { kind: ItemKind; x: number; y: number; life: number }
export type Trail = { x: number; y: number; dir: number; life: number }
export type Weather = { x: number; y: number; vx: number; vy: number; phase: number; size: number }

export type Fx = {
  parts: Particle[]
  icons: FloatIcon[]
  trails: Trail[]
  weather: Weather[]
  shake: number
  flash: number
  flashColor: string
  /** とびらが ひらいてからの じかん。 */
  doorGlow: number
  /** ばくはつの あとの こげあと（マス → のこり）。 */
  scorch: Map<number, number>
  seed: number
}

export function createFx(): Fx {
  return { parts: [], icons: [], trails: [], weather: [], shake: 0, flash: 0, flashColor: '#ffffff', doorGlow: 0, scorch: new Map(), seed: 1 }
}

const SPARK = ['#ffffff', '#fff6a0', '#ffd23c', '#ffb0c8']
const CONFETTI = ['#ff5a6a', '#ffd23c', '#5ad0ff', '#7ce06a', '#ff9ad8', '#ffffff']
const FIRE = ['#fff6c0', '#ffd23c', '#ff8a1e', '#ff4a1e']

function rand(fx: Fx) {
  fx.seed = (fx.seed * 16807) % 2147483647
  return fx.seed / 2147483647
}

function add(fx: Fx, p: Omit<Particle, 'life' | 'z' | 'vz'> & { z?: number; vz?: number }) {
  if (fx.parts.length > 420) return
  fx.parts.push({ z: 0, vz: 0, ...p, life: 0 })
}

function burst(fx: Fx, x: number, y: number, n: number, kind: ParticleKind, colors: readonly string[], speed: number, max: number, size = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(fx) * .5
    const s = speed * (.5 + rand(fx) * .7)
    add(fx, { kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .8, max: max * (.7 + rand(fx) * .5), color: colors[i % colors.length], size })
  }
}

export function spawnFx(fx: Fx, e: WorldEvent, world: World, theme: Theme) {
  switch (e.type) {
    case 'allyIn':
    case 'allyOut':
      add(fx, { kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, max: 18, color: '#7dffb0', size: 1 })
      burst(fx, e.x, e.y - 4, 10, 'star', SPARK, 1.6, 24)
      break
    case 'allyBomb':
    case 'place':
      for (let i = 0; i < 6; i++) add(fx, { kind: 'dust', x: e.x + (i - 2.5) * 2.4, y: e.y + 6, vx: (i - 2.5) * .25, vy: -.15, max: 16, color: '#ffffff', size: 2 })
      break
    case 'boom': {
      fx.shake = Math.min(9, Math.max(fx.shake, 3 + e.power * .7))
      fx.flash = Math.max(fx.flash, 3)
      fx.flashColor = '#fff4d0'
      burst(fx, e.x, e.y, 10, 'spark', FIRE, 2.4, 22)
      for (let i = 0; i < 6; i++) add(fx, { kind: 'ember', x: e.x + (rand(fx) - .5) * 12, y: e.y + (rand(fx) - .5) * 8, vx: (rand(fx) - .5) * .8, vy: -.6 - rand(fx) * .8, max: 40 + rand(fx) * 30, color: FIRE[1 + (i % 3)], size: 1 })
      // あとから けむりが のこる
      for (let i = 0; i < 4; i++) add(fx, { kind: 'smoke', x: e.x + (rand(fx) - .5) * 10, y: e.y + (rand(fx) - .5) * 6, vx: (rand(fx) - .5) * .4, vy: -.35 - rand(fx) * .3, max: 46 + rand(fx) * 20, color: '#6a6478', size: 4 + rand(fx) * 3 })
      const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE)
      fx.scorch.set(ty * world.cols + tx, 240)
      break
    }
    case 'break': {
      const colors = [theme.soft.light, theme.soft.top, theme.soft.side, theme.soft.accent]
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (rand(fx) - .5) * 2.6
        const s = 1 + rand(fx) * 1.6
        add(fx, { kind: 'debris', x: e.x + (rand(fx) - .5) * 10, y: e.y, z: 6, vx: Math.cos(a) * s * .8, vy: Math.sin(a) * s * .25, vz: 1.6 + rand(fx) * 1.8, max: 50, color: colors[i % colors.length], size: 2 + Math.floor(rand(fx) * 2) })
      }
      break
    }
    case 'reveal':
      add(fx, { kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, max: 18, color: '#ffffff', size: 1 })
      burst(fx, e.x, e.y, e.kind === 'gold' ? 18 : 8, 'star', SPARK, 1.4, 26)
      if (e.kind === 'gold') { fx.flash = 10; fx.flashColor = '#fff2a0' }
      break
    case 'item':
      add(fx, { kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, max: 16, color: '#fff6a0', size: 1 })
      burst(fx, e.x, e.y, 10, 'spark', SPARK, 1.8, 20)
      fx.icons.push({ kind: e.kind, x: e.x, y: e.y - 4, life: 0 })
      break
    case 'hatch':
      for (let i = 0; i < 10; i++) add(fx, { kind: 'shell', x: e.x + (rand(fx) - .5) * 8, y: e.y, z: 6, vx: (rand(fx) - .5) * 2.2, vy: (rand(fx) - .5) * .6, vz: 1.5 + rand(fx) * 2, max: 44, color: i % 3 ? '#ffffff' : RIDE_PALS[e.color].c, size: 2 })
      break
    case 'ride':
      burst(fx, e.x, e.y - 8, 6, 'heart', ['#ff7aa8'], .9, 34)
      burst(fx, e.x, e.y - 4, 12, 'star', SPARK, 1.6, 26)
      fx.shake = Math.max(fx.shake, 2)
      break
    case 'dismount':
      burst(fx, e.x, e.y - 4, 10, 'smoke', ['#ffffff'], 1.2, 26, 3)
      fx.shake = Math.max(fx.shake, 4)
      break
    case 'skill':
      if (e.skill === 'jump' || e.skill === 'line') for (let i = 0; i < 6; i++) add(fx, { kind: 'dust', x: e.x + (i - 2.5) * 3, y: e.y + 6, vx: (i - 2.5) * .35, vy: -.2, max: 18, color: '#ffffff', size: 2 })
      if (e.skill === 'kick') { burst(fx, e.x + DX[world.hero.dir] * 9, e.y + DY[world.hero.dir] * 6, 6, 'star', SPARK, 1.4, 16); fx.shake = Math.max(fx.shake, 2) }
      if (e.skill === 'dash') fx.shake = Math.max(fx.shake, 2)
      break
    case 'land':
      for (let i = 0; i < 8; i++) add(fx, { kind: 'dust', x: e.x + (i - 3.5) * 2.5, y: e.y + 6, vx: (i - 3.5) * .4, vy: -.2, max: 20, color: '#ffffff', size: 2 })
      fx.shake = Math.max(fx.shake, 2)
      break
    case 'bump':
      burst(fx, e.x, e.y, 5, 'star', ['#ffffff', '#fff6a0'], 1.2, 14)
      fx.shake = Math.max(fx.shake, 2)
      break
    case 'enemyHit':
      if (e.dead) {
        add(fx, { kind: 'pop', x: e.x, y: e.y - 2, vx: 0, vy: 0, max: 14, color: '#ffffff', size: 1 })
        burst(fx, e.x, e.y - 2, 10, 'star', SPARK, 2, 28)
        burst(fx, e.x, e.y, 6, 'smoke', ['#ffffff'], 1, 22, 3)
        fx.shake = Math.max(fx.shake, 3)
      } else burst(fx, e.x, e.y - 4, 6, 'star', ['#ffffff'], 1.4, 16)
      break
    case 'hurt':
      fx.shake = Math.max(fx.shake, 7)
      fx.flash = 8
      fx.flashColor = '#ff5a6a'
      burst(fx, e.x, e.y - 10, 5, 'star', ['#ffe060'], 1.2, 26)
      break
    case 'heal':
      burst(fx, e.x, e.y - 8, 6, 'heart', ['#ff7aa8'], .9, 30)
      break
    case 'doorOpen':
      fx.doorGlow = 1
      add(fx, { kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, max: 30, color: '#fff2b8', size: 2 })
      burst(fx, e.x, e.y, 16, 'star', SPARK, 1.8, 36)
      break
    case 'warp':
      burst(fx, e.x, e.y, 12, 'spark', ['#c8a0ff', '#ffffff', '#8ad0ff'], 1.6, 22)
      burst(fx, e.tx, e.ty, 12, 'spark', ['#c8a0ff', '#ffffff', '#8ad0ff'], 1.6, 22)
      add(fx, { kind: 'ring', x: e.tx, y: e.ty, vx: 0, vy: 0, max: 18, color: '#d8b8ff', size: 1 })
      break
    case 'ventWarn':
      for (let i = 0; i < 5; i++) add(fx, { kind: 'smoke', x: e.x + (rand(fx) - .5) * 8, y: e.y, vx: (rand(fx) - .5) * .3, vy: -.4 - rand(fx) * .3, max: 50, color: '#5a4a4a', size: 3 })
      break
    case 'bossHit':
      fx.shake = Math.max(fx.shake, 8)
      fx.flash = 5
      fx.flashColor = '#ffffff'
      burst(fx, e.x, e.y - 10, 14, 'star', SPARK, 2.4, 30)
      add(fx, { kind: 'ring', x: e.x, y: e.y - 10, vx: 0, vy: 0, max: 20, color: '#ffffff', size: 2 })
      break
    case 'bossAct':
      switch (e.act) {
        case 'land':
          fx.shake = Math.max(fx.shake, 7)
          add(fx, { kind: 'ring', x: e.x, y: e.y + 10, vx: 0, vy: 0, max: 22, color: '#ffffff', size: 2 })
          for (let i = 0; i < 12; i++) add(fx, { kind: 'dust', x: e.x + (i - 5.5) * 3, y: e.y + 12, vx: (i - 5.5) * .5, vy: -.3, max: 26, color: '#ffffff', size: 3 })
          break
        case 'emerge':
          fx.shake = Math.max(fx.shake, 6)
          for (let i = 0; i < 14; i++) add(fx, { kind: 'debris', x: e.x + (rand(fx) - .5) * 20, y: e.y + 8, z: 4, vx: (rand(fx) - .5) * 2.4, vy: (rand(fx) - .5) * .5, vz: 1.5 + rand(fx) * 2.5, max: 44, color: theme.floor[i % 3], size: 2 })
          break
        case 'bonk':
          fx.shake = Math.max(fx.shake, 8)
          burst(fx, e.x, e.y, 10, 'star', SPARK, 2, 26)
          break
        case 'roar':
          fx.shake = Math.max(fx.shake, 4)
          break
        case 'spawn':
          burst(fx, e.x, e.y, 10, 'smoke', ['#ffffff'], 1.4, 24, 3)
          break
        case 'break':
          fx.flash = 10
          fx.flashColor = '#ffffff'
          fx.shake = Math.max(fx.shake, 9)
          break
        case 'breath':
          fx.shake = Math.max(fx.shake, 5)
          break
        default:
          break
      }
      break
    case 'bossPop':
      add(fx, { kind: 'flame', x: e.x, y: e.y, vx: 0, vy: 0, max: 18, color: '#ffffff', size: 8 + rand(fx) * 5 })
      burst(fx, e.x, e.y, 8, 'spark', FIRE, 2, 22)
      fx.shake = Math.max(fx.shake, 5)
      break
    case 'bossDown':
      fx.flash = 16
      fx.flashColor = '#ffffff'
      fx.shake = 10
      break
    case 'clear':
      for (let i = 0; i < 80; i++) add(fx, { kind: 'confetti', x: e.x + (rand(fx) - .5) * 60, y: e.y - 70 - rand(fx) * 30, vx: (rand(fx) - .5) * 2.2, vy: -1 - rand(fx) * 2.5, max: 130 + rand(fx) * 60, color: CONFETTI[i % CONFETTI.length], size: 1 })
      burst(fx, e.x, e.y - 8, 16, 'star', SPARK, 2.2, 36)
      break
    case 'miss':
      fx.shake = 8
      burst(fx, e.x, e.y - 8, 8, 'star', ['#ffe060'], 1.4, 40)
      break
    default:
      break
  }
}

export function updateFx(fx: Fx, world: World, viewW: number, viewH: number, theme: Theme) {
  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - .45)
  if (fx.flash > 0) fx.flash--
  if (fx.doorGlow > 0) fx.doorGlow++
  for (const [k, v] of fx.scorch) { if (v <= 1) fx.scorch.delete(k); else fx.scorch.set(k, v - 1) }
  // ダッシュの ざんぞう
  const h = world.hero
  if (h.act?.kind === 'dash' && world.frame % 2 === 0) fx.trails.push({ x: h.x, y: h.y, dir: h.dir, life: 0 })
  for (const t of fx.trails) t.life++
  fx.trails = fx.trails.filter(t => t.life < 12)
  for (const icon of fx.icons) icon.life++
  fx.icons = fx.icons.filter(i => i.life < 40)
  for (const p of fx.parts) {
    p.life++
    p.x += p.vx
    p.y += p.vy
    switch (p.kind) {
      case 'debris':
      case 'shell':
        p.vz -= .18
        p.z += p.vz
        if (p.z <= 0) { p.z = 0; p.vz = -p.vz * .35; p.vx *= .6; p.vy *= .6 }
        break
      case 'confetti': p.vy = Math.min(1, p.vy + .05); p.vx *= .97; break
      case 'smoke': p.vx *= .96; p.vy *= .97; p.size += .05; break
      case 'ember': p.vx += Math.sin(p.life * .2 + p.x) * .02; break
      case 'heart': p.vy -= .01; p.vx *= .95; break
      case 'dust': p.vx *= .9; p.vy *= .9; break
      default: p.vx *= .93; p.vy *= .93
    }
  }
  fx.parts = fx.parts.filter(p => p.life < p.max)
  // てんき
  const want = theme.weather === 'dust' ? 14 : 26
  while (fx.weather.length < want) {
    fx.weather.push({ x: rand(fx) * viewW, y: rand(fx) * viewH, vx: 0, vy: 0, phase: rand(fx) * 6.28, size: rand(fx) < .3 ? 2 : 1 })
  }
  for (const w of fx.weather) {
    w.phase += .05
    switch (theme.weather) {
      case 'leaf': w.x += Math.sin(w.phase) * .4 + .15; w.y += .35; break
      case 'sand': w.x += 1.1 + Math.sin(w.phase) * .2; w.y += Math.sin(w.phase * 1.3) * .15; break
      case 'snow': w.x += Math.sin(w.phase) * .3; w.y += .45 + w.size * .15; break
      case 'ember': w.x += Math.sin(w.phase) * .25; w.y -= .45; break
      default: w.x += Math.sin(w.phase) * .15; w.y += Math.cos(w.phase * .7) * .12
    }
    if (w.y > viewH + 4) { w.y = -4; w.x = rand(fx) * viewW }
    if (w.y < -6) { w.y = viewH + 4; w.x = rand(fx) * viewW }
    if (w.x > viewW + 4) { w.x = -4; w.y = rand(fx) * viewH }
    if (w.x < -6) w.x = viewW + 4
  }
}

export function shakeOffset(fx: Fx, frame: number): [number, number] {
  if (fx.shake <= .3) return [0, 0]
  const s = fx.shake
  return [Math.round((hash2(frame, 1) - .5) * s), Math.round((hash2(frame, 2) - .5) * s * .8)]
}
