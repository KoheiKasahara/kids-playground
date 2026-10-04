// ボスの え。まる・だえんを くみあわせて その場で かき、ふちどりを つける。
// どの え も みぎむき。ひだりむきは かがみうつしに する。

import { cached } from './art'
import { flipped, line, makeCanvas, outlined, oval, rect, shadedOval, type Img } from './pixel'
import { OUTLINE } from './sprites'

export const BOSS_W = 52
export const BOSS_H = 48
/** えの なかで あしもとが くる ところ。 */
export const BOSS_FOOT_Y = 44

type Ctx = CanvasRenderingContext2D

function eye(ctx: Ctx, x: number, y: number, r: number, mood: 'normal' | 'hurt' | 'angry' | 'dizzy', look = 1) {
  if (mood === 'hurt') {
    line(ctx, x - r, y - r + 1, x + r - 1, y, OUTLINE)
    line(ctx, x - r, y + r - 1, x + r - 1, y, OUTLINE)
    return
  }
  if (mood === 'dizzy') {
    oval(ctx, x, y, r, r, '#ffffff')
    rect(ctx, x - 1, y - 1, 3, 1, OUTLINE)
    rect(ctx, x + 1, y - 1, 1, 3, OUTLINE)
    rect(ctx, x - 1, y + 1, 3, 1, OUTLINE)
    return
  }
  oval(ctx, x, y, r, r + .5, OUTLINE)
  oval(ctx, x, y, r - 1, r - .5, '#ffffff')
  oval(ctx, x + look, y + .5, r * .55, r * .65, OUTLINE)
  rect(ctx, x + look - 1, y - 1, 1, 1, '#ffffff')
  if (mood === 'angry') line(ctx, x - r, y - r - 1, x + r, y - r + 1, OUTLINE)
}

function finish(src: Img | null, face: number) {
  const out = outlined(src, OUTLINE)
  return face < 0 ? flipped(out) : out
}

// ---------------- キングプニ ----------------

export function puniKingArt(squash: number, mood: 'normal' | 'hurt' | 'angry', face: number) {
  const s = Math.round(squash * 10) / 10
  return cached(`boss:puni:${s}:${mood}:${face}`, () => {
    const made = makeCanvas(BOSS_W, BOSS_H)
    if (!made) return null
    const { ctx } = made
    const rx = 19 / Math.sqrt(s), ry = 14 * s
    const cx = BOSS_W / 2, cy = BOSS_FOOT_Y - ry
    shadedOval(ctx, cx, cy, rx, ry, ['#e4ffc0', '#9eea72', '#5cc454', '#2f9446', '#1f6a36'])
    rect(ctx, cx - rx + 2, BOSS_FOOT_Y - 2, rx * 2 - 4, 2, '#1f6a36')
    oval(ctx, cx - rx * .45, cy - ry * .5, 4, 2.5, '#ffffff')
    rect(ctx, cx - rx * .45 + 4, cy - ry * .62, 2, 1, '#ffffff')
    // おうかん
    const top = cy - ry + 1
    rect(ctx, cx - 7, top - 4, 14, 5, '#ffd23c')
    for (const dx of [-7, -2, 3]) { rect(ctx, cx + dx, top - 8, 4, 4, '#ffd23c'); rect(ctx, cx + dx + 1, top - 9, 2, 1, '#ffd23c') }
    rect(ctx, cx - 7, top - 4, 14, 1, '#fff6a0')
    rect(ctx, cx - 7, top, 14, 1, '#d08a10')
    rect(ctx, cx - 1, top - 3, 2, 2, '#ff4d6a')
    rect(ctx, cx - 6, top - 3, 2, 2, '#4ab4ff')
    rect(ctx, cx + 4, top - 3, 2, 2, '#4ab4ff')
    // かお
    const ey = cy - ry * .05
    eye(ctx, cx - 6 + face * 2, ey, 3.5, mood)
    eye(ctx, cx + 6 + face * 2, ey, 3.5, mood)
    oval(ctx, cx - 11 + face * 2, ey + 5, 2.5, 1.5, '#ff8aa8')
    oval(ctx, cx + 11 + face * 2, ey + 5, 2.5, 1.5, '#ff8aa8')
    if (mood === 'hurt') oval(ctx, cx + face * 2, ey + 6, 3, 2.5, OUTLINE)
    else { rect(ctx, cx - 2 + face * 2, ey + 5, 1, 1, OUTLINE); rect(ctx, cx - 1 + face * 2, ey + 6, 3, 1, OUTLINE); rect(ctx, cx + 2 + face * 2, ey + 5, 1, 1, OUTLINE) }
    return outlined(made.canvas, OUTLINE)
  })
}

// ---------------- サンドワーム ズズ ----------------

export function wormArt(rise: number, mouth: boolean, mood: 'normal' | 'hurt', face: number) {
  const r = Math.round(rise * 6) / 6
  return cached(`boss:worm:${r}:${mouth}:${mood}:${face}`, () => {
    const made = makeCanvas(BOSS_W, BOSS_H)
    if (!made) return null
    const { ctx } = made
    const cx = BOSS_W / 2 - 2
    const ramp = ['#ffe0d0', '#f4a890', '#d47a6a', '#a04e52']
    const height = 30 * r
    for (let i = 0; i < 4; i++) {
      const y = BOSS_FOOT_Y - 4 - i * (height / 4)
      if (y > BOSS_FOOT_Y - 2) continue
      shadedOval(ctx, cx + Math.sin(i * .9) * 2, y, 9 - i * .4, 5, ramp)
      rect(ctx, cx - 6, y + 2, 12, 1, '#a04e52')
    }
    const hy = BOSS_FOOT_Y - 6 - height
    shadedOval(ctx, cx + 3, hy, 13, 11, ramp)
    // とげ
    for (const [dx, dy] of [[-8, -9], [-1, -12], [7, -10]]) { rect(ctx, cx + dx, hy + dy, 3, 3, '#fff0c0'); rect(ctx, cx + dx + 1, hy + dy - 2, 1, 2, '#fff0c0') }
    eye(ctx, cx + 2, hy - 3, 2.5, mood === 'hurt' ? 'hurt' : 'angry', 1)
    eye(ctx, cx + 9, hy - 3, 2.5, mood === 'hurt' ? 'hurt' : 'angry', 1)
    if (mouth) {
      oval(ctx, cx + 8, hy + 5, 6, 4, '#5a1a2a')
      for (let x = -4; x <= 4; x += 2) { rect(ctx, cx + 8 + x, hy + 2, 1, 2, '#ffffff'); rect(ctx, cx + 8 + x, hy + 7, 1, 1, '#ffffff') }
    } else {
      rect(ctx, cx + 3, hy + 5, 10, 1, OUTLINE)
      for (let x = 4; x < 13; x += 3) rect(ctx, x + cx, hy + 6, 1, 1, '#ffffff')
    }
    return finish(made.canvas, face)
  })
}

// ---------------- ペンギンしょうぐん ----------------

export function penguinArt(pose: 'stand' | 'slide' | 'dizzy' | 'throw', mood: 'normal' | 'hurt', step: number, face: number) {
  return cached(`boss:penguin:${pose}:${mood}:${step % 2}:${face}`, () => {
    const made = makeCanvas(BOSS_W, BOSS_H)
    if (!made) return null
    const { ctx } = made
    const cx = BOSS_W / 2
    const body = ['#5a6aa8', '#36447e', '#232c58', '#151a38']
    if (pose === 'slide') {
      shadedOval(ctx, cx, BOSS_FOOT_Y - 9, 20, 9, body)
      oval(ctx, cx + 2, BOSS_FOOT_Y - 6, 15, 5, '#ffffff')
      oval(ctx, cx + 16, BOSS_FOOT_Y - 13, 7, 6, '#36447e')
      // かぶと
      oval(ctx, cx + 15, BOSS_FOOT_Y - 17, 7, 4, '#3a3450')
      rect(ctx, cx + 12, BOSS_FOOT_Y - 24, 8, 2, '#ffd23c')
      rect(ctx, cx + 11, BOSS_FOOT_Y - 26, 2, 3, '#ffd23c')
      rect(ctx, cx + 19, BOSS_FOOT_Y - 26, 2, 3, '#ffd23c')
      rect(ctx, cx + 21, BOSS_FOOT_Y - 13, 5, 3, '#ffaa30')
      eye(ctx, cx + 18, BOSS_FOOT_Y - 14, 2, mood === 'hurt' ? 'hurt' : 'angry', 1)
      // かぜの せん
      for (let i = 0; i < 3; i++) rect(ctx, 2, BOSS_FOOT_Y - 14 + i * 4, 6 + i * 2, 1, '#e0f4ff')
      return finish(made.canvas, face)
    }
    const bob = step % 2
    shadedOval(ctx, cx, BOSS_FOOT_Y - 15 - bob, 15, 16, body)
    oval(ctx, cx + 2, BOSS_FOOT_Y - 12 - bob, 10, 12, '#ffffff')
    oval(ctx, cx + 3, BOSS_FOOT_Y - 10 - bob, 8, 9, '#e6eefa')
    // つばさ
    if (pose === 'throw') {
      oval(ctx, cx - 14, BOSS_FOOT_Y - 30, 4, 8, '#232c58')
      disc(ctx, cx - 15, BOSS_FOOT_Y - 39, 4)
    } else oval(ctx, cx - 13, BOSS_FOOT_Y - 15 - bob, 4, 9, '#232c58')
    oval(ctx, cx + 14, BOSS_FOOT_Y - 15 - bob, 3, 8, '#232c58')
    // かぶと
    const hy = BOSS_FOOT_Y - 30 - bob
    oval(ctx, cx, hy, 13, 6, '#3a3450')
    rect(ctx, cx - 14, hy + 2, 28, 3, '#5a5470')
    rect(ctx, cx - 14, hy + 4, 28, 1, '#2a2440')
    // くわがた（きんの つの）
    for (const s of [-1, 1]) {
      line(ctx, cx + s * 3, hy - 4, cx + s * 10, hy - 13, '#ffd23c')
      line(ctx, cx + s * 4, hy - 4, cx + s * 11, hy - 13, '#ffd23c')
      rect(ctx, cx + s * 10 - (s < 0 ? 1 : 0), hy - 15, 2, 2, '#fff6a0')
    }
    rect(ctx, cx - 2, hy - 6, 4, 4, '#ff4d5e')
    rect(ctx, cx - 1, hy - 5, 1, 1, '#ffd0d8')
    // かお
    const mood2 = pose === 'dizzy' ? 'dizzy' : mood === 'hurt' ? 'hurt' : 'angry'
    eye(ctx, cx - 1, hy + 9, 3, mood2, 1)
    eye(ctx, cx + 8, hy + 9, 3, mood2, 1)
    rect(ctx, cx + 1, hy + 13, 8, 3, '#ffaa30')
    rect(ctx, cx + 1, hy + 15, 8, 1, '#d07010')
    // あし
    oval(ctx, cx - 6, BOSS_FOOT_Y - 1, 5, 2, '#ffaa30')
    oval(ctx, cx + 7, BOSS_FOOT_Y - 1, 5, 2, '#ffaa30')
    return finish(made.canvas, face)
  })
}

function disc(ctx: Ctx, x: number, y: number, r: number) {
  shadedOval(ctx, x, y, r, r, ['#ffffff', '#e0ecff', '#b0c8f0'])
}

// ---------------- ほのおドラゴン ボルカ ----------------

export function dragonArt(wing: number, mouth: boolean, mood: 'normal' | 'hurt', face: number) {
  return cached(`boss:dragon:${wing}:${mouth}:${mood}:${face}`, () => {
    const made = makeCanvas(BOSS_W, BOSS_H)
    if (!made) return null
    const { ctx } = made
    const cx = BOSS_W / 2 - 3
    const red = ['#ff9a7a', '#f05a4a', '#c0303a', '#801a2a']
    // しっぽ
    for (let i = 0; i < 5; i++) shadedOval(ctx, cx - 12 - i * 3, BOSS_FOOT_Y - 8 + i * .5 - Math.sin(i) * 2, 4 - i * .5, 3.5 - i * .5, red)
    rect(ctx, cx - 28, BOSS_FOOT_Y - 12, 3, 3, '#ffd23c')
    // つばさ
    const wy = wing === 0 ? -26 : wing === 1 ? -18 : -10
    const wingCol = ['#c86ae0', '#9a3ec0', '#6a2290']
    for (let i = 0; i < 4; i++) {
      line(ctx, cx - 4, BOSS_FOOT_Y - 20, cx - 18 + i * 3, BOSS_FOOT_Y + wy + i * 3, wingCol[2])
    }
    shadedOval(ctx, cx - 11, BOSS_FOOT_Y + wy / 2 - 12, 9, 6 + (wing === 0 ? 3 : 0), wingCol)
    // からだ
    shadedOval(ctx, cx, BOSS_FOOT_Y - 13, 13, 12, red)
    oval(ctx, cx + 4, BOSS_FOOT_Y - 10, 7, 8, '#ffd27a')
    for (let y = -14; y < -2; y += 3) rect(ctx, cx + 1, BOSS_FOOT_Y + y, 7, 1, '#e0a040')
    // あし
    oval(ctx, cx - 5, BOSS_FOOT_Y - 2, 4, 2.5, '#c0303a')
    oval(ctx, cx + 7, BOSS_FOOT_Y - 2, 4, 2.5, '#c0303a')
    // あたま
    const hx = cx + 10, hy = BOSS_FOOT_Y - 28
    shadedOval(ctx, hx, hy, 9, 8, red)
    shadedOval(ctx, hx + 8, hy + 3, 6, mouth ? 3 : 4, red)
    for (const s of [-5, 1]) { line(ctx, hx + s, hy - 6, hx + s - 4, hy - 13, '#fff0c0'); line(ctx, hx + s + 1, hy - 6, hx + s - 3, hy - 13, '#fff0c0') }
    eye(ctx, hx + 3, hy - 2, 2.5, mood === 'hurt' ? 'hurt' : 'angry', 1)
    rect(ctx, hx + 12, hy + 1, 1, 1, OUTLINE)
    if (mouth) {
      oval(ctx, hx + 9, hy + 7, 5, 3, '#5a1018')
      oval(ctx, hx + 10, hy + 7, 3, 1.5, '#ffd23c')
      rect(ctx, hx + 6, hy + 4, 1, 2, '#ffffff')
      rect(ctx, hx + 10, hy + 4, 1, 2, '#ffffff')
    } else rect(ctx, hx + 5, hy + 6, 8, 1, OUTLINE)
    return finish(made.canvas, face)
  })
}

// ---------------- ガラクタだいおう ----------------

function kingFace(ctx: Ctx, x: number, y: number, mood: 'normal' | 'hurt' | 'angry') {
  shadedOval(ctx, x, y, 7, 6.5, ['#ffe8d0', '#ffd0a8', '#e8a880'])
  eye(ctx, x - 2, y - 1, 1.6, mood === 'hurt' ? 'hurt' : 'normal', 0)
  eye(ctx, x + 3, y - 1, 1.6, mood === 'hurt' ? 'hurt' : 'normal', 0)
  if (mood === 'angry') { line(ctx, x - 4, y - 4, x - 1, y - 3, OUTLINE); line(ctx, x + 2, y - 3, x + 5, y - 4, OUTLINE) }
  // ひげ
  rect(ctx, x - 5, y + 2, 4, 2, '#f4f4f4')
  rect(ctx, x + 2, y + 2, 4, 2, '#f4f4f4')
  rect(ctx, x - 6, y + 3, 1, 1, '#f4f4f4')
  rect(ctx, x + 6, y + 3, 1, 1, '#f4f4f4')
  rect(ctx, x, y + 1, 2, 2, '#ff9a8a')
  // おうかん
  rect(ctx, x - 5, y - 9, 11, 3, '#ffd23c')
  for (const dx of [-5, -1, 3]) rect(ctx, x + dx, y - 12, 3, 3, '#ffd23c')
  rect(ctx, x - 5, y - 9, 11, 1, '#fff6a0')
  rect(ctx, x, y - 8, 1, 1, '#ff4d6a')
}

export function kingMechArt(step: number, mood: 'normal' | 'hurt' | 'angry', broken: boolean, face: number) {
  return cached(`boss:king-mech:${step % 2}:${mood}:${broken}:${face}`, () => {
    const made = makeCanvas(BOSS_W, BOSS_H)
    if (!made) return null
    const { ctx } = made
    const cx = BOSS_W / 2
    const metal = ['#e8eef8', '#b8c4d8', '#8090b0', '#56607e']
    // キャタピラ
    rect(ctx, cx - 18, BOSS_FOOT_Y - 8, 36, 8, '#3a3e52')
    for (let x = -17 + (step % 2) * 2; x < 17; x += 4) rect(ctx, cx + x, BOSS_FOOT_Y - 7, 2, 6, '#6a6e88')
    for (const dx of [-13, 0, 13]) { oval(ctx, cx + dx, BOSS_FOOT_Y - 4, 3, 3, '#8a90aa'); rect(ctx, cx + dx, BOSS_FOOT_Y - 4, 1, 1, '#2a2c3e') }
    // からだ
    for (let y = 0; y < 16; y++) for (let x = 0; x < 34; x++) rect(ctx, cx - 17 + x, BOSS_FOOT_Y - 24 + y, 1, 1, metal[Math.min(3, Math.floor((x / 34) * 2 + y / 10))])
    rect(ctx, cx - 17, BOSS_FOOT_Y - 24, 34, 1, '#ffffff')
    rect(ctx, cx - 12, BOSS_FOOT_Y - 19, 24, 6, '#3a3e52')
    for (let i = 0; i < 4; i++) rect(ctx, cx - 10 + i * 6, BOSS_FOOT_Y - 18, 3, 4, i % 2 ? '#ff4d5e' : '#ffd23c')
    // うで
    oval(ctx, cx - 20, BOSS_FOOT_Y - 18, 4, 6, '#8090b0')
    oval(ctx, cx + 20, BOSS_FOOT_Y - 18, 4, 6, '#8090b0')
    rect(ctx, cx + 18, BOSS_FOOT_Y - 13, 6, 4, '#56607e')
    rect(ctx, cx - 24, BOSS_FOOT_Y - 13, 6, 4, '#56607e')
    // コクピット
    shadedOval(ctx, cx, BOSS_FOOT_Y - 30, 11, 8, ['#c8f0ff', '#8ad0f0', '#4aa0d0'])
    kingFace(ctx, cx + 1, BOSS_FOOT_Y - 30, mood)
    rect(ctx, cx - 7, BOSS_FOOT_Y - 36, 3, 2, '#ffffff')
    if (broken) {
      for (const [x, y] of [[-14, -22], [10, -20], [-4, -16], [14, -10]]) { rect(ctx, cx + x, BOSS_FOOT_Y + y, 3, 1, '#2a2c3e'); rect(ctx, cx + x + 1, BOSS_FOOT_Y + y + 1, 1, 2, '#2a2c3e') }
    }
    return finish(made.canvas, face)
  })
}

export function kingPodArt(step: number, mood: 'normal' | 'hurt' | 'angry', face: number) {
  return cached(`boss:king-pod:${step % 3}:${mood}:${face}`, () => {
    const made = makeCanvas(BOSS_W, BOSS_H)
    if (!made) return null
    const { ctx } = made
    const cx = BOSS_W / 2
    // プロペラ
    const blade = step % 3
    rect(ctx, cx - 1, BOSS_FOOT_Y - 42, 2, 6, '#56607e')
    rect(ctx, cx - (blade === 0 ? 12 : blade === 1 ? 6 : 2), BOSS_FOOT_Y - 43, blade === 0 ? 24 : blade === 1 ? 12 : 4, 2, '#d0d8e8')
    // ひとと おうさまの マント
    shadedOval(ctx, cx, BOSS_FOOT_Y - 24, 10, 9, ['#c88aff', '#9a5ad8', '#6a30a8'])
    kingFace(ctx, cx + 1, BOSS_FOOT_Y - 30, mood)
    // ポッド
    shadedOval(ctx, cx, BOSS_FOOT_Y - 12, 18, 8, ['#e8eef8', '#b8c4d8', '#8090b0', '#56607e'])
    rect(ctx, cx - 18, BOSS_FOOT_Y - 12, 36, 2, '#3a3e52')
    for (let i = -2; i <= 2; i++) rect(ctx, cx + i * 6, BOSS_FOOT_Y - 9, 2, 2, i % 2 ? '#ff4d5e' : '#ffd23c')
    // ジェット
    rect(ctx, cx - 6, BOSS_FOOT_Y - 4, 3, 3, '#56607e')
    rect(ctx, cx + 4, BOSS_FOOT_Y - 4, 3, 3, '#56607e')
    return finish(made.canvas, face)
  })
}
