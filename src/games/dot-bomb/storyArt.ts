// おはなしの ぶたい（はいけい と とうじょうじんぶつ）を かく。

import { cached, eggSprite } from './art'
import { BOSS_FOOT_Y, BOSS_W, dragonArt, kingPodArt, penguinArt, puniKingArt, wormArt } from './bossArt'
import { bayer, hash2, makeCanvas, mixHex, oval, rect, shadedOval, spriteCanvas, type Img } from './pixel'
import { HERO_PAL, OUTLINE, RIDE_FRONT, RIDE_SIDE, heroRows, ridePalette } from './sprites'
import type { RideColor } from './stages'
import type { SceneBg, Speaker } from './story'

export const STORY_W = 224
export const STORY_H = 112
const GROUND = 96

type Sky = { top: string; bottom: string; far: string; near: string; ground: string; ground2: string }

const SKIES: Record<SceneBg, Sky> = {
  village: { top: '#6ac4ff', bottom: '#c8f0ff', far: '#8ad86a', near: '#5ab84a', ground: '#78c850', ground2: '#5aa83e' },
  forest: { top: '#58b8f0', bottom: '#b8ecff', far: '#3e8a46', near: '#2e6a3a', ground: '#76c84a', ground2: '#5aa83e' },
  desert: { top: '#ff9a5a', bottom: '#ffe0a0', far: '#e8a860', near: '#d48c48', ground: '#f5d27e', ground2: '#e3b862' },
  ice: { top: '#1a2a5a', bottom: '#4a78c0', far: '#c8dcf8', near: '#9cb4e0', ground: '#eaf4ff', ground2: '#c0d4f0' },
  volcano: { top: '#2a0e14', bottom: '#8a2a1e', far: '#3a2028', near: '#24141a', ground: '#644a4e', ground2: '#3e2c34' },
  castle: { top: '#1e1030', bottom: '#5a3a7a', far: '#3e2c54', near: '#2a1a40', ground: '#b2a8c8', ground2: '#7e7498' },
  ending: { top: '#ff8aa0', bottom: '#ffe0a0', far: '#8ad86a', near: '#5ab84a', ground: '#78c850', ground2: '#5aa83e' },
}

function backdrop(bg: SceneBg) {
  return cached(`story-bg:${bg}`, () => {
    const made = makeCanvas(STORY_W, STORY_H)
    if (!made) return null
    const { ctx } = made
    const sky = SKIES[bg]
    for (let y = 0; y < GROUND; y++) {
      for (let x = 0; x < STORY_W; x++) {
        const t = y / GROUND + (bayer(x, y) - .5) * .12
        ctx.fillStyle = t < .45 ? sky.top : t < .7 ? mixHex(sky.top, sky.bottom, .5) : sky.bottom
        ctx.fillRect(x, y, 1, 1)
      }
    }
    // とおくの もの
    switch (bg) {
      case 'desert':
        oval(ctx, 180, 26, 12, 12, '#fff2b0')
        oval(ctx, 180, 26, 9, 9, '#ffffff')
        for (let i = 0; i < 18; i++) rect(ctx, 70 - i, 52 + i * 2, i * 2 + 1, 2, i % 3 ? '#e8b878' : '#d49a58')
        break
      case 'ice':
        for (let i = 0; i < 40; i++) rect(ctx, Math.floor(hash2(i, 1) * STORY_W), Math.floor(hash2(i, 2) * 50), 1, 1, '#ffffff')
        for (let x = 0; x < STORY_W; x++) {
          const y = 18 + Math.sin(x * .05) * 6 + Math.sin(x * .13) * 3
          for (let k = 0; k < 8; k++) if (bayer(x, k) < .5 - k * .05) rect(ctx, x, Math.round(y + k), 1, 1, k % 2 ? '#7affc8' : '#9a8aff')
        }
        break
      case 'volcano':
        for (let i = 0; i < 46; i++) rect(ctx, 110 - i * 2, 40 + i, i * 4 + 4, 1, '#3a2028')
        oval(ctx, 112, 40, 10, 3, '#ff6a1e')
        for (let i = 0; i < 12; i++) rect(ctx, 104 + Math.floor(hash2(i, 5) * 16), 22 + Math.floor(hash2(i, 6) * 18), 2, 2, i % 2 ? '#ffd23c' : '#ff6a1e')
        break
      case 'castle':
        for (let i = 0; i < 30; i++) rect(ctx, Math.floor(hash2(i, 3) * STORY_W), Math.floor(hash2(i, 4) * 40), 1, 1, '#ffffff')
        oval(ctx, 40, 20, 8, 8, '#fff6c0')
        rect(ctx, 120, 34, 70, 50, '#2a1a40')
        for (const x of [116, 140, 168, 186]) { rect(ctx, x, 22, 12, 62, '#2a1a40'); rect(ctx, x - 1, 18, 14, 4, '#3e2c54'); for (let k = 0; k < 14; k += 4) rect(ctx, x + k - 1, 15, 2, 3, '#3e2c54') }
        for (const [x, y] of [[124, 40], [146, 50], [172, 36], [158, 60]]) rect(ctx, x, y, 3, 4, '#ffd23c')
        rect(ctx, 150, 68, 12, 16, '#140a20')
        break
      case 'ending':
        for (let i = 0; i < 6; i++) {
          const colors = ['#ff5a6a', '#ff9a3a', '#ffe14a', '#7ce06a', '#5ad0ff', '#b48aff']
          for (let a = 0; a < 180; a++) {
            const r = 70 - i * 3
            const x = 112 + Math.cos(Math.PI + a / 180 * Math.PI) * r * 1.4
            const y = 96 + Math.sin(Math.PI + a / 180 * Math.PI) * r
            rect(ctx, Math.round(x), Math.round(y), 2, 2, colors[i])
          }
        }
        break
      default:
        for (let i = 0; i < 4; i++) {
          const cx = 30 + i * 60, cy = 22 + (i % 2) * 6
          oval(ctx, cx, cy, 14, 5, '#ffffff')
          oval(ctx, cx + 8, cy - 3, 9, 5, '#ffffff')
        }
    }
    // おか と き
    for (let x = 0; x < STORY_W; x++) {
      const h1 = 66 + Math.sin(x * .03) * 8 + Math.sin(x * .09) * 3
      rect(ctx, x, Math.round(h1), 1, GROUND - Math.round(h1), SKIES[bg].far)
      const h2 = 80 + Math.sin(x * .05 + 2) * 5
      rect(ctx, x, Math.round(h2), 1, GROUND - Math.round(h2), SKIES[bg].near)
    }
    if (bg === 'forest' || bg === 'village' || bg === 'ending') {
      for (let i = 0; i < 7; i++) {
        const x = 10 + i * 34 + Math.floor(hash2(i, 9) * 10)
        rect(ctx, x - 1, 70, 3, 14, '#7a4a2a')
        shadedOval(ctx, x, 64, 9, 10, ['#9ae46c', '#5cc048', '#3e8a3a', '#2a6a30'])
      }
    }
    if (bg === 'village' || bg === 'ending') {
      for (const x of [50, 150]) {
        shadedOval(ctx, x, 82, 14, 10, ['#ffe0b0', '#f0c080', '#d09a58'])
        oval(ctx, x, 74, 15, 6, '#e05a4a')
        rect(ctx, x - 3, 84, 6, 8, '#7a4a2a')
      }
    }
    if (bg === 'desert') {
      for (const x of [30, 196]) { rect(ctx, x, 70, 4, 18, '#3e9a4a'); rect(ctx, x - 5, 74, 5, 3, '#3e9a4a'); rect(ctx, x - 5, 70, 3, 5, '#3e9a4a'); rect(ctx, x + 4, 76, 5, 3, '#3e9a4a'); rect(ctx, x + 6, 72, 3, 5, '#3e9a4a') }
    }
    // じめん
    for (let y = GROUND; y < STORY_H; y++) {
      for (let x = 0; x < STORY_W; x++) {
        ctx.fillStyle = (y - GROUND) / 16 + bayer(x, y) * .4 < .5 ? SKIES[bg].ground : SKIES[bg].ground2
        ctx.fillRect(x, y, 1, 1)
      }
    }
    rect(ctx, 0, GROUND, STORY_W, 1, mixHex(SKIES[bg].ground, '#ffffff', .4))
    return made.canvas
  })
}

function elderSprite() {
  return cached('story:elder', () => {
    const base = spriteCanvas(RIDE_FRONT, { ...ridePalette('green'), c: '#e8dcc0', C: '#c4b48e', h: '#fff8e8' })
    const made = makeCanvas(18, 18)
    if (!base || !made) return null
    const { ctx } = made
    ctx.drawImage(base, 0, 2)
    // しろい ひげ と つえ
    oval(ctx, 8, 13, 4, 3, '#ffffff')
    rect(ctx, 7, 15, 2, 2, '#ffffff')
    rect(ctx, 15, 6, 2, 12, '#9a5a2a')
    rect(ctx, 14, 5, 4, 2, '#9a5a2a')
    // まゆげ
    rect(ctx, 3, 7, 3, 1, '#ffffff')
    rect(ctx, 10, 7, 3, 1, '#ffffff')
    return made.canvas
  })
}

function castSprite(who: Speaker, color: RideColor, face: number): Img | null {
  switch (who) {
    case 'pon': return cached(`story:pon:${face}`, () => spriteCanvas(heroRows('side', 'stand'), HERO_PAL, face < 0))
    case 'elder': return elderSprite()
    case 'pyonta': return cached(`story:pyonta:${color}:${face}`, () => spriteCanvas(RIDE_SIDE, ridePalette(color), face < 0))
    case 'king': return kingPodArt(0, 'normal', face)
    case 'puni': return puniKingArt(1, 'normal', face)
    case 'worm': return wormArt(1, false, 'normal', face)
    case 'penguin': return penguinArt('stand', 'normal', 0, face)
    case 'dragon': return dragonArt(1, false, 'normal', face)
    default: return null
  }
}

const BIG: Speaker[] = ['king', 'puni', 'worm', 'penguin', 'dragon']

/** ぶたいを かく。しゃべっている ひとは ぴょこぴょこ はねる。 */
export function drawStory(target: CanvasRenderingContext2D, bg: SceneBg, cast: Speaker[], speaking: Speaker | null, color: RideColor, t: number, sad: boolean) {
  const back = backdrop(bg)
  if (back) target.drawImage(back, 0, 0)
  const slots = cast.length
  cast.forEach((who, i) => {
    const big = BIG.includes(who)
    const x = Math.round(STORY_W * (i + .5) / slots)
    const face = i < slots / 2 ? 1 : -1
    const img = castSprite(who, color, face)
    if (!img) return
    const talking = speaking === who
    const hop = talking ? Math.round(Math.abs(Math.sin(t * 9)) * 3) : Math.round(Math.sin(t * 2 + i) * .6)
    const sh = cached(`story-shadow:${big}`, () => {
      const made = makeCanvas(big ? 40 : 16, big ? 6 : 4)
      if (made) oval(made.ctx, made.canvas.width / 2, made.canvas.height / 2, made.canvas.width / 2, made.canvas.height / 2, 'rgba(0,0,0,.25)')
      return made?.canvas ?? null
    })
    if (sh) target.drawImage(sh, x - sh.width / 2, GROUND + 2)
    if (big) target.drawImage(img, x - BOSS_W / 2, GROUND + 4 - BOSS_FOOT_Y - hop)
    else target.drawImage(img, x - Math.floor(img.width / 2), GROUND + 3 - img.height - hop)
    if (who === 'pyonta' && sad) {
      const egg = eggSprite(color)
      if (egg) target.drawImage(egg, x + 8, GROUND - 12)
    }
    if (talking) {
      // ふきだしの しるし
      const top = big ? GROUND + 4 - BOSS_FOOT_Y - 6 : GROUND - 22
      const by = top - 6 - hop
      rect(target, x - 4, by, 9, 6, '#ffffff')
      rect(target, x - 3, by - 1, 7, 1, '#ffffff')
      rect(target, x - 3, by + 6, 7, 1, '#ffffff')
      rect(target, x, by + 7, 2, 2, '#ffffff')
      for (let k = 0; k < 3; k++) rect(target, x - 2 + k * 2, by + 2, 1, 2, (Math.floor(t * 6) % 3) >= k ? OUTLINE : '#c8c8d8')
    }
  })
  if (bg === 'ending') {
    for (let i = 0; i < 4; i++) {
      const c: RideColor = (['green', 'blue', 'pink', 'yellow'] as const)[i]
      const img = castSprite('pyonta', c, i % 2 ? -1 : 1)
      const x = 20 + ((t * 30 + i * 56) % (STORY_W + 40)) - 20
      const hop = Math.round(Math.abs(Math.sin(t * 8 + i)) * 6)
      if (img) target.drawImage(img, Math.round(x), GROUND + 12 - 16 - hop)
    }
  }
}

