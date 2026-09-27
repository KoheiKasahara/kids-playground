import type { KindId } from './items'
import { ARM_W, MAGNET_H, MAGNET_HALF_W, TIP_H } from './world'

/**
 * ぴたっと じしゃく の え（Canvas で その場で かく オリジナル）。
 * どの え も (0, 0) を まんなかに して、ワールドの 単位で かく。
 */

type G = CanvasRenderingContext2D

export const INK = '#3b2a4a'
export const FONT = "'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif"
const INK_SOFT = 'rgba(59, 42, 74, .55)'

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + k, y)
  g.arcTo(x + w, y, x + w, y + h, k)
  g.arcTo(x + w, y + h, x, y + h, k)
  g.arcTo(x, y + h, x, y, k)
  g.arcTo(x, y, x + w, y, k)
  g.closePath()
}

function lin(g: G, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const grad = g.createLinearGradient(x0, y0, x1, y1)
  for (const [o, c] of stops) grad.addColorStop(o, c)
  return grad
}

function rad(g: G, x: number, y: number, r0: number, x1: number, y1: number, r1: number, stops: [number, string][]) {
  const grad = g.createRadialGradient(x, y, r0, x1, y1, r1)
  for (const [o, c] of stops) grad.addColorStop(o, c)
  return grad
}

/** はがねの つや（たてに ならんだ ひかり）。 */
function steel(g: G, y0: number, y1: number, tint = 0) {
  const t = tint
  return lin(g, 0, y0, 0, y1, [
    [0, `hsl(${210 + t} 22% 96%)`],
    [0.28, `hsl(${212 + t} 14% 74%)`],
    [0.5, `hsl(${214 + t} 12% 58%)`],
    [0.62, `hsl(${210 + t} 16% 84%)`],
    [1, `hsl(${216 + t} 14% 50%)`],
  ])
}

function outline(g: G, w = 1.3, color = INK_SOFT) {
  g.lineWidth = w
  g.strokeStyle = color
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.stroke()
}

function shine(g: G, x0: number, y0: number, x1: number, y1: number, w = 1.1, a = 0.85) {
  g.beginPath()
  g.moveTo(x0, y0)
  g.lineTo(x1, y1)
  g.lineCap = 'round'
  g.lineWidth = w
  g.strokeStyle = `rgba(255,255,255,${a})`
  g.stroke()
}

// ---------------- てつ の もの ----------------

const CLIP_COLORS = ['#ff4f6e', '#3f8cff', '#ffc233', '#2fc27a']

function drawClip(g: G, v: number) {
  const color = CLIP_COLORS[v % CLIP_COLORS.length]
  g.save()
  g.beginPath()
  g.moveTo(-6, 2.2)
  g.lineTo(8.4, 2.2)
  g.arc(8.4, 0, 2.2, Math.PI / 2, -Math.PI / 2, true)
  g.lineTo(-8.2, -2.2)
  g.arc(-8.2, 0.9, 3.1, -Math.PI / 2, Math.PI / 2, true)
  g.lineTo(9.6, 4)
  g.arc(9.6, -0.2, 4.2, Math.PI / 2, -Math.PI / 2, true)
  g.lineTo(-9.8, -4.4)
  g.arc(-9.8, 0, 4.4, -Math.PI / 2, Math.PI * 0.35, true)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.lineWidth = 3.4
  g.strokeStyle = INK_SOFT
  g.stroke()
  g.lineWidth = 2.3
  g.strokeStyle = color
  g.stroke()
  g.lineWidth = 0.8
  g.strokeStyle = 'rgba(255,255,255,.7)'
  g.translate(-0.3, -0.5)
  g.stroke()
  g.restore()
}
function drawNail(g: G) {
  // じく
  g.beginPath()
  g.moveTo(-14, -1.7)
  g.lineTo(12, -1.7)
  g.lineTo(17, 0)
  g.lineTo(12, 1.7)
  g.lineTo(-14, 1.7)
  g.closePath()
  g.fillStyle = steel(g, -1.7, 1.7)
  g.fill()
  outline(g, 1)
  // あたま
  rr(g, -17, -5, 3.6, 10, 1.2)
  g.fillStyle = steel(g, -5, 5, 4)
  g.fill()
  outline(g, 1)
  shine(g, -12, -0.7, 10, -0.7, 0.7, 0.9)
}

function threads(g: G, x0: number, x1: number, h: number, step = 2.4) {
  g.save()
  g.lineWidth = 0.6
  g.strokeStyle = 'rgba(40,50,70,.45)'
  for (let x = x0 + 1; x < x1 - 0.5; x += step) {
    g.beginPath()
    g.moveTo(x, -h)
    g.lineTo(x + step * 0.6, h)
    g.stroke()
  }
  g.restore()
}

function drawScrew(g: G) {
  g.beginPath()
  g.moveTo(-8, -2.6)
  g.lineTo(9, -2.6)
  g.lineTo(13, 0)
  g.lineTo(9, 2.6)
  g.lineTo(-8, 2.6)
  g.closePath()
  g.fillStyle = steel(g, -2.6, 2.6, 20)
  g.fill()
  outline(g, 1)
  threads(g, -8, 10, 2.6)
  // まるい あたま（＋の みぞ）
  g.beginPath()
  g.moveTo(-8, -4.5)
  g.quadraticCurveTo(-13.5, -4.5, -13.5, 0)
  g.quadraticCurveTo(-13.5, 4.5, -8, 4.5)
  g.closePath()
  g.fillStyle = steel(g, -4.5, 4.5, 24)
  g.fill()
  outline(g, 1)
  g.fillStyle = 'rgba(40,50,70,.55)'
  g.fillRect(-11.6, -0.5, 3, 1)
  shine(g, -6, -1.4, 8, -1.4, 0.6, 0.8)
}

function drawNut(g: G) {
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const x = Math.cos(a) * 9, y = Math.sin(a) * 9
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.fillStyle = rad(g, -3, -4, 1, 0, 0, 11, [[0, '#f6f9fc'], [0.5, '#a8b3c2'], [1, '#6d7888']])
  g.fill()
  outline(g, 1.1)
  // めんの かげ
  g.save()
  g.clip()
  g.fillStyle = 'rgba(40,50,70,.18)'
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(9, 0)
  g.lineTo(4.5, 7.8)
  g.lineTo(-4.5, 7.8)
  g.closePath()
  g.fill()
  g.restore()
  g.beginPath()
  g.arc(0, 0, 3.8, 0, Math.PI * 2)
  g.fillStyle = rad(g, 1, 1, 0.5, 0, 0, 4, [[0, '#3b4454'], [1, '#6b7584']])
  g.fill()
  outline(g, 0.8)
  shine(g, -5.5, -5.2, -1, -7.4, 0.9, 0.9)
}

function drawBolt(g: G) {
  g.beginPath()
  g.moveTo(-8, -3)
  g.lineTo(13, -3)
  g.lineTo(16, 0)
  g.lineTo(13, 3)
  g.lineTo(-8, 3)
  g.closePath()
  g.fillStyle = steel(g, -3, 3, 10)
  g.fill()
  outline(g, 1)
  threads(g, -2, 14, 3, 2.2)
  rr(g, -16, -5.5, 8.5, 11, 1.4)
  g.fillStyle = steel(g, -5.5, 5.5, 14)
  g.fill()
  outline(g, 1)
  g.fillStyle = 'rgba(40,50,70,.18)'
  g.fillRect(-16, 1.8, 8.5, 3.6)
  shine(g, -14.5, -3.6, -9.5, -3.6, 0.8)
  shine(g, -6, -1.6, 10, -1.6, 0.6, 0.7)
}

const PIN_COLORS = ['#ff7eb6', '#57b8ff', '#ffd23f']

function drawPin(g: G, v: number) {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(-10, 2.8)
  g.lineTo(11, 2.8)
  g.arc(11, 0.4, 2.4, Math.PI / 2, -Math.PI * 0.9, true)
  g.lineTo(-10, -1.5)
  g.lineWidth = 2.6
  g.strokeStyle = INK_SOFT
  g.stroke()
  g.lineWidth = 1.5
  g.strokeStyle = steel(g, -3, 3)
  g.stroke()
  g.restore()
  // ばねの わ
  g.beginPath()
  g.arc(11.5, 0.4, 3, 0, Math.PI * 2)
  g.lineWidth = 1
  g.strokeStyle = '#8994a4'
  g.stroke()
  // いろの ついた とめがね
  rr(g, -15, -4.4, 7.5, 8.8, 3)
  g.fillStyle = lin(g, 0, -4.4, 0, 4.4, [[0, '#fff'], [0.35, PIN_COLORS[v % 3]], [1, PIN_COLORS[v % 3]]])
  g.fill()
  outline(g, 1)
  shine(g, -13.4, -2.6, -9.6, -2.6, 0.9)
}

function drawSpring(g: G) {
  g.save()
  g.lineCap = 'round'
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4
      g.beginPath()
      g.ellipse(x, 0, 2.4, 5.6, 0.22, pass ? Math.PI * 0.5 : -Math.PI * 0.5, pass ? Math.PI * 1.5 : Math.PI * 0.5)
      g.lineWidth = pass ? 2.2 : 2.8
      g.strokeStyle = pass ? steel(g, -6, 6, 6) : INK_SOFT
      g.stroke()
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = -10 + i * 4
    g.beginPath()
    g.ellipse(x, 0, 2.4, 5.6, 0.22, -Math.PI * 0.5, Math.PI * 0.5)
    g.lineWidth = 2.2
    g.strokeStyle = steel(g, -6, 6, -4)
    g.stroke()
    g.beginPath()
    g.ellipse(x, 0, 2.4, 5.6, 0.22, -Math.PI * 0.35, -Math.PI * 0.05)
    g.lineWidth = 0.7
    g.strokeStyle = 'rgba(255,255,255,.85)'
    g.stroke()
  }
  g.restore()
}

function drawGear(g: G) {
  const teeth = 9
  g.beginPath()
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? 11 : 8.4
    g.arc(0, 0, r, a0 + 0.04, a1 - 0.04)
  }
  g.closePath()
  g.fillStyle = rad(g, -3, -4, 1, 0, 0, 12, [[0, '#eef2f7'], [0.55, '#98a3b3'], [1, '#5f6a7a']])
  g.fill()
  outline(g, 1.1)
  g.beginPath()
  g.arc(0, 0, 5.6, 0, Math.PI * 2)
  g.strokeStyle = 'rgba(40,50,70,.3)'
  g.lineWidth = 1
  g.stroke()
  g.beginPath()
  g.arc(0, 0, 2.6, 0, Math.PI * 2)
  g.fillStyle = '#434c5b'
  g.fill()
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    g.beginPath()
    g.arc(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 1.1, 0, Math.PI * 2)
    g.fillStyle = 'rgba(50,60,75,.55)'
    g.fill()
  }
}

function drawBall(g: G) {
  g.beginPath()
  g.arc(0, 0, 7, 0, Math.PI * 2)
  g.fillStyle = rad(g, -2.4, -2.8, 0.4, 0, 0, 7.4, [[0, '#ffffff'], [0.25, '#dfe6ef'], [0.6, '#8c97a8'], [0.85, '#586273'], [1, '#9aa5b5']])
  g.fill()
  outline(g, 1)
  // まわりが うつりこむ おび
  g.beginPath()
  g.ellipse(0, 1.8, 6.2, 1.6, 0, 0, Math.PI * 2)
  g.fillStyle = 'rgba(255,255,255,.22)'
  g.fill()
  g.beginPath()
  g.arc(-2.3, -2.6, 1.6, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
}

function drawCan(g: G, steelCan: boolean) {
  // かんは たてむきに かく（からだが たおれれば いっしょに たおれる）。
  rr(g, -13, -20, 26, 40, 3.5)
  g.fillStyle = lin(g, -13, 0, 13, 0, steelCan
    ? [[0, '#6b4a2e'], [0.25, '#b77b45'], [0.45, '#e2a56a'], [0.7, '#8e5a30'], [1, '#553820']]
    : [[0, '#5ab4d6'], [0.25, '#a8e6fb'], [0.45, '#e7fbff'], [0.7, '#78cbe8'], [1, '#3e8fb3']])
  g.fill()
  outline(g, 1.2)
  // ふちの きんぞく
  for (const y of [-20, 16.5]) {
    rr(g, -13, y, 26, 3.5, 1.5)
    g.fillStyle = lin(g, -13, 0, 13, 0, [[0, '#7c8696'], [0.4, '#eef2f6'], [1, '#6c7686']])
    g.fill()
  }
  if (steelCan) {
    // コーヒーの ラベル
    rr(g, -13, -8, 26, 12, 1)
    g.fillStyle = 'rgba(255,245,225,.92)'
    g.fill()
    g.beginPath()
    g.ellipse(0, -2, 4.4, 3.4, 0, 0, Math.PI * 2)
    g.fillStyle = '#6b3d1f'
    g.fill()
    g.beginPath()
    g.moveTo(0, -5)
    g.quadraticCurveTo(-1.5, -2, 0, 1)
    g.strokeStyle = '#e9c49a'
    g.lineWidth = 0.7
    g.stroke()
  } else {
    // あわの もよう
    g.fillStyle = 'rgba(255,255,255,.75)'
    for (const [x, y, r] of [[-5, -6, 2.4], [3, -1, 1.6], [-2, 5, 1.8], [6, 7, 1.2], [5, -10, 1.3]]) {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  // リサイクルの しるし（まる に S / A）
  g.beginPath()
  g.arc(7, 10, 3.6, 0, Math.PI * 2)
  g.fillStyle = steelCan ? '#fff6e8' : '#ffffff'
  g.fill()
  g.fillStyle = steelCan ? '#6b3d1f' : '#2a7aa0'
  g.font = `900 5px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(steelCan ? 'S' : 'A', 7, 10.3)
  shine(g, -7.5, -15, -7.5, 14, 1.4, 0.55)
}

function starPath(g: G, r: number, inner: number, round = 1.6) {
  g.beginPath()
  const pts: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
    const rr0 = i % 2 === 0 ? r : inner
    pts.push([Math.cos(a) * rr0, Math.sin(a) * rr0])
  }
  g.moveTo((pts[0][0] + pts[9][0]) / 2, (pts[0][1] + pts[9][1]) / 2)
  for (let i = 0; i < 10; i++) {
    const p = pts[i], q = pts[(i + 1) % 10]
    g.arcTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, round)
  }
  g.closePath()
}

function drawStar(g: G) {
  starPath(g, 13.5, 6.2, 1.8)
  g.fillStyle = lin(g, -8, -12, 8, 12, [[0, '#fff6b8'], [0.35, '#ffd43b'], [0.75, '#ffb000'], [1, '#e08a00']])
  g.fill()
  outline(g, 1.4, '#8a4b00')
  starPath(g, 8.5, 3.9, 1)
  g.fillStyle = 'rgba(255,255,255,.35)'
  g.fill()
  g.beginPath()
  g.ellipse(-3.4, -4.6, 2.2, 1.2, -0.6, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
}

const FISH_COLORS: [string, string, string][] = [
  ['#ff8a3d', '#ffc98f', '#e0561a'],
  ['#ff6fa8', '#ffc4dc', '#d93f7c'],
  ['#3fb6ff', '#b4e6ff', '#1f7fd1'],
  ['#56d26a', '#c3f5c5', '#239b3f'],
]

/** さかな（みぎむき）。wag = しっぽの ふり（-1〜1）。 */
export function drawFish(g: G, v: number, wag: number, mouthOpen = 0) {
  const [body, belly, dark] = FISH_COLORS[v % FISH_COLORS.length]
  // しっぽ
  g.save()
  g.translate(-14, 0)
  g.rotate(wag * 0.45)
  g.beginPath()
  g.moveTo(2, 0)
  g.quadraticCurveTo(-6, -9, -10, -9.5)
  g.quadraticCurveTo(-7, 0, -10, 9.5)
  g.quadraticCurveTo(-6, 9, 2, 0)
  g.fillStyle = dark
  g.fill()
  outline(g, 1.1)
  g.restore()
  // せびれ
  g.beginPath()
  g.moveTo(-6, -7)
  g.quadraticCurveTo(0, -14, 6, -7.5)
  g.closePath()
  g.fillStyle = dark
  g.fill()
  outline(g, 1)
  // からだ
  g.beginPath()
  g.ellipse(0, 0, 17, 9, 0, 0, Math.PI * 2)
  g.fillStyle = lin(g, 0, -9, 0, 9, [[0, body], [0.6, body], [1, belly]])
  g.fill()
  outline(g, 1.3)
  // もよう
  g.save()
  g.beginPath()
  g.ellipse(0, 0, 17, 9, 0, 0, Math.PI * 2)
  g.clip()
  g.fillStyle = 'rgba(255,255,255,.35)'
  for (const x of [-7, 0]) {
    g.beginPath()
    g.ellipse(x, 0, 1.8, 10, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
  // むなびれ
  g.beginPath()
  g.ellipse(2, 3, 4.5, 2.2, 0.5 + wag * 0.3, 0, Math.PI * 2)
  g.fillStyle = belly
  g.fill()
  outline(g, 0.8)
  // め
  g.beginPath()
  g.arc(9.5, -2.2, 3.1, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  outline(g, 0.8)
  g.beginPath()
  g.arc(10.3, -2.2, 1.8, 0, Math.PI * 2)
  g.fillStyle = INK
  g.fill()
  g.beginPath()
  g.arc(10.9, -2.9, 0.6, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  // ほっぺ
  g.beginPath()
  g.ellipse(8, 2.8, 2, 1.2, 0, 0, Math.PI * 2)
  g.fillStyle = 'rgba(255,90,120,.4)'
  g.fill()
  // くち と てつの わ
  g.beginPath()
  g.arc(16.4, 1, 1.2 + mouthOpen, 0, Math.PI * 2)
  g.fillStyle = '#7a2a3a'
  g.fill()
  g.beginPath()
  g.arc(19, 0.6, 3, 0, Math.PI * 2)
  g.lineWidth = 2.4
  g.strokeStyle = INK_SOFT
  g.stroke()
  g.lineWidth = 1.6
  g.strokeStyle = steel(g, -3, 3)
  g.stroke()
  shine(g, 18, -1.6, 20.2, -1.6, 0.6)
}

function drawAnchor(g: G) {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const path = () => {
    g.beginPath()
    g.moveTo(0, -9)
    g.lineTo(0, 12)
    g.moveTo(-8, -5.5)
    g.lineTo(8, -5.5)
    g.moveTo(-11, 4)
    g.quadraticCurveTo(-9, 13, 0, 13.5)
    g.quadraticCurveTo(9, 13, 11, 4)
  }
  path()
  g.lineWidth = 6.4
  g.strokeStyle = INK_SOFT
  g.stroke()
  path()
  g.lineWidth = 4.6
  g.strokeStyle = lin(g, -12, 0, 12, 0, [[0, '#5d6878'], [0.45, '#b9c3d0'], [1, '#4d5767']])
  g.stroke()
  // さきっぽ
  for (const s of [-1, 1]) {
    g.beginPath()
    g.moveTo(s * 11, 1)
    g.lineTo(s * 13.5, 6.5)
    g.lineTo(s * 8.5, 5)
    g.closePath()
    g.fillStyle = '#7a8595'
    g.fill()
    outline(g, 1)
  }
  // わ
  g.beginPath()
  g.arc(0, -12, 3.4, 0, Math.PI * 2)
  g.lineWidth = 3.8
  g.strokeStyle = INK_SOFT
  g.stroke()
  g.lineWidth = 2.4
  g.strokeStyle = '#a5afbd'
  g.stroke()
  shine(g, -1, -8, -1, 10, 0.9, 0.7)
  g.restore()
}

// ---------------- くっつかない もの ----------------

const PENCIL_COLORS = ['#ffcf3a', '#56c271', '#ff6b6b']

function drawPencil(g: G, v: number) {
  const c = PENCIL_COLORS[v % 3]
  // ほんたい（ろっかくの めん）
  g.beginPath()
  g.rect(-19, -4, 34, 8)
  g.fillStyle = lin(g, 0, -4, 0, 4, [[0, '#ffffff'], [0.12, c], [0.5, c], [0.52, 'rgba(0,0,0,.08)'], [0.53, c], [1, c]])
  g.fill()
  g.fillStyle = 'rgba(0,0,0,.12)'
  g.fillRect(-19, 1.6, 34, 2.4)
  // けずった き
  g.beginPath()
  g.moveTo(15, -4)
  g.lineTo(24, -1.1)
  g.lineTo(24, 1.1)
  g.lineTo(15, 4)
  g.closePath()
  g.fillStyle = '#f3c99a'
  g.fill()
  g.beginPath()
  g.moveTo(24, -1.1)
  g.lineTo(27, 0)
  g.lineTo(24, 1.1)
  g.closePath()
  g.fillStyle = '#3d3d48'
  g.fill()
  // けしゴム と きんぞくの わ
  rr(g, -27, -4, 5.5, 8, 2)
  g.fillStyle = '#ff9eb5'
  g.fill()
  g.fillStyle = lin(g, 0, -4, 0, 4, [[0, '#fff5cc'], [0.4, '#d8b25a'], [1, '#9c7a2e']])
  g.fillRect(-22, -4, 3.4, 8)
  g.beginPath()
  g.moveTo(-27, -4)
  g.lineTo(15, -4)
  g.lineTo(24, -1.1)
  g.lineTo(27, 0)
  g.lineTo(24, 1.1)
  g.lineTo(15, 4)
  g.lineTo(-27, 4)
  g.closePath()
  outline(g, 1.1)
}

function drawEraser(g: G) {
  rr(g, -13, -7, 26, 14, 2.6)
  g.fillStyle = lin(g, 0, -7, 0, 7, [[0, '#ffffff'], [1, '#e6e8ee']])
  g.fill()
  outline(g, 1.2)
  rr(g, -6, -7.4, 19.4, 14.8, 1.2)
  g.fillStyle = lin(g, 0, -7, 0, 7, [[0, '#5aa8ff'], [1, '#2e6fd6']])
  g.fill()
  outline(g, 1)
  g.fillStyle = '#fff'
  g.fillRect(-4, -3.2, 15.6, 2)
  g.fillStyle = '#ffe34d'
  g.fillRect(-4, 0.6, 9, 1.6)
  shine(g, -11, -4.6, -8, -4.6, 1.2, 0.9)
}

const CRAYON_COLORS = ['#ff5a5f', '#4f7cff', '#35b35a']

function drawCrayon(g: G, v: number) {
  const c = CRAYON_COLORS[v % 3]
  g.beginPath()
  g.moveTo(-17, -4)
  g.lineTo(11, -4)
  g.lineTo(17, -1)
  g.lineTo(17, 1)
  g.lineTo(11, 4)
  g.lineTo(-17, 4)
  g.closePath()
  g.fillStyle = lin(g, 0, -4, 0, 4, [[0, '#ffffff'], [0.2, c], [1, c]])
  g.fill()
  outline(g, 1.1)
  // かみの まき
  rr(g, -13, -4.2, 20, 8.4, 1)
  g.fillStyle = 'rgba(255,255,255,.55)'
  g.fill()
  g.fillStyle = c
  g.fillRect(-9, -1.6, 12, 3.2)
  g.strokeStyle = 'rgba(0,0,0,.18)'
  g.lineWidth = 0.6
  g.strokeRect(-13, -4.2, 20, 8.4)
}

const BLOCK_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b']
const BLOCK_LETTERS = ['あ', 'い', 'う']

function drawBlock(g: G, v: number) {
  rr(g, -12, -12, 24, 24, 3)
  g.fillStyle = lin(g, -12, -12, 12, 12, [[0, '#ffe9c7'], [1, '#e7b980']])
  g.fill()
  outline(g, 1.3)
  // きめ
  g.save()
  g.clip()
  g.strokeStyle = 'rgba(160,100,40,.18)'
  g.lineWidth = 0.7
  for (let i = -3; i < 4; i++) {
    g.beginPath()
    g.moveTo(-12, i * 6 + 2)
    g.bezierCurveTo(-4, i * 6 - 1, 4, i * 6 + 4, 12, i * 6 + 1)
    g.stroke()
  }
  g.restore()
  rr(g, -8, -8, 16, 16, 2.5)
  g.fillStyle = BLOCK_COLORS[v % 3]
  g.fill()
  g.fillStyle = '#fff'
  g.font = `900 12px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(BLOCK_LETTERS[v % 3], 0, 0.8)
}

function drawMarble(g: G, v: number) {
  const tint = v % 2 === 0 ? ['#7fe3ff', '#1b9ad1'] : ['#b8ff9e', '#3aa84a']
  g.beginPath()
  g.arc(0, 0, 7.5, 0, Math.PI * 2)
  g.fillStyle = rad(g, -2, -2.5, 0.5, 0, 0, 7.5, [[0, 'rgba(255,255,255,.95)'], [0.4, 'rgba(225,245,255,.55)'], [1, 'rgba(160,200,230,.65)']])
  g.fill()
  // なかの もよう
  g.save()
  g.beginPath()
  g.arc(0, 0, 7.5, 0, Math.PI * 2)
  g.clip()
  g.beginPath()
  g.moveTo(-6, 3)
  g.bezierCurveTo(-2, -5, 2, 6, 6, -3)
  g.lineWidth = 3.2
  g.strokeStyle = tint[0]
  g.stroke()
  g.lineWidth = 1.2
  g.strokeStyle = tint[1]
  g.stroke()
  g.restore()
  g.beginPath()
  g.arc(0, 0, 7.5, 0, Math.PI * 2)
  outline(g, 1, 'rgba(59,42,74,.4)')
  g.beginPath()
  g.ellipse(-2.6, -3.2, 2.2, 1.3, -0.6, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
}

function drawAcorn(g: G) {
  g.beginPath()
  g.ellipse(0, 2, 6.4, 6.6, 0, 0, Math.PI * 2)
  g.fillStyle = lin(g, -6, 0, 6, 0, [[0, '#b0642a'], [0.4, '#dd8f48'], [1, '#8a4a1c']])
  g.fill()
  outline(g, 1.1)
  g.beginPath()
  g.ellipse(0, -3, 7.2, 4, 0, Math.PI, 0)
  g.lineTo(7.2, -2)
  g.quadraticCurveTo(0, 0.5, -7.2, -2)
  g.closePath()
  g.fillStyle = '#9b7a4f'
  g.fill()
  outline(g, 1.1)
  g.fillStyle = 'rgba(60,40,20,.35)'
  for (let i = -2; i <= 2; i++) {
    g.beginPath()
    g.arc(i * 2.6, -3.4 + Math.abs(i) * 0.4, 0.8, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.moveTo(0, -6.8)
  g.lineTo(0.8, -9.4)
  g.lineWidth = 1.8
  g.strokeStyle = '#6b4f2e'
  g.stroke()
  shine(g, -3, 1, -2.6, 5, 1.3, 0.55)
}

function drawCoin(g: G) {
  rr(g, -11, -2.5, 22, 5, 2)
  g.fillStyle = lin(g, 0, -2.5, 0, 2.5, [[0, '#f7c39a'], [0.5, '#c97a45'], [1, '#8f4e25']])
  g.fill()
  outline(g, 1)
}

const SHELL_COLORS = [['#ffd6e0', '#ff9fb8'], ['#fff1d6', '#f3c27a']]

function drawShell(g: G, v: number, pts: readonly { x: number; y: number }[]) {
  const [a, b] = SHELL_COLORS[v % 2]
  const ys = pts.map((p) => p.y)
  const top = Math.min(...ys), bottom = Math.max(...ys)
  g.beginPath()
  g.moveTo(-12, bottom)
  g.bezierCurveTo(-13, top + 2, -5, top - 1, 0, top - 0.5)
  g.bezierCurveTo(5, top - 1, 13, top + 2, 12, bottom)
  g.quadraticCurveTo(0, bottom + 2, -12, bottom)
  g.closePath()
  g.fillStyle = lin(g, 0, top, 0, bottom, [[0, a], [1, b]])
  g.fill()
  outline(g, 1.1)
  g.save()
  g.clip()
  g.strokeStyle = 'rgba(160,80,90,.35)'
  g.lineWidth = 0.8
  for (let i = -4; i <= 4; i++) {
    g.beginPath()
    g.moveTo(0, bottom + 4)
    g.lineTo(i * 3.6, top)
    g.stroke()
  }
  g.restore()
}

function drawPebble(g: G, v: number, pts: readonly { x: number; y: number }[]) {
  g.beginPath()
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2
    if (i === 0) g.moveTo(mx, my)
    else g.quadraticCurveTo(p.x, p.y, mx, my)
  })
  const p0 = pts[0], p1 = pts[1]
  g.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2)
  g.closePath()
  g.fillStyle = v % 2 === 0
    ? rad(g, -3, -4, 1, 0, 0, 14, [[0, '#d7dce3'], [1, '#8a93a0']])
    : rad(g, -3, -4, 1, 0, 0, 14, [[0, '#e8d8c4'], [1, '#a88e72']])
  g.fill()
  outline(g, 1.1)
  g.fillStyle = 'rgba(60,60,70,.25)'
  for (const [x, y] of [[-4, 1], [3, -2], [6, 2], [-1, -3]]) {
    g.beginPath()
    g.arc(x, y, 0.7, 0, Math.PI * 2)
    g.fill()
  }
  g.beginPath()
  g.ellipse(-4, -3, 3, 1.2, -0.3, 0, Math.PI * 2)
  g.fillStyle = 'rgba(255,255,255,.5)'
  g.fill()
}

const SHOVEL_COLORS = ['#ff5d73', '#4c9dff']

function drawShovel(g: G, v: number) {
  const c = SHOVEL_COLORS[v % 2]
  rr(g, -23, -2.6, 26, 5.2, 2.4)
  g.fillStyle = c
  g.fill()
  outline(g, 1)
  rr(g, -26, -4.4, 6, 8.8, 3)
  g.fill()
  outline(g, 1)
  g.beginPath()
  g.moveTo(2, -5.5)
  g.quadraticCurveTo(22, -7, 23, 0)
  g.quadraticCurveTo(22, 7, 2, 5.5)
  g.closePath()
  g.fillStyle = lin(g, 0, -6, 0, 6, [[0, '#ffffff'], [0.25, c], [1, c]])
  g.fill()
  outline(g, 1.1)
  shine(g, 6, -3, 17, -3.6, 1.1, 0.7)
}

function drawDuck(g: G) {
  // からだ
  g.beginPath()
  g.moveTo(-13, 3)
  g.quadraticCurveTo(-16, -4, -11, -3)
  g.quadraticCurveTo(-4, -3, 0, 0)
  g.quadraticCurveTo(12, -1, 13, 6)
  g.quadraticCurveTo(10, 11, -2, 11)
  g.quadraticCurveTo(-12, 11, -13, 3)
  g.closePath()
  g.fillStyle = lin(g, 0, -4, 0, 11, [[0, '#fff27a'], [1, '#ffc21f']])
  g.fill()
  outline(g, 1.2)
  // あたま
  g.beginPath()
  g.arc(5, -8, 6.6, 0, Math.PI * 2)
  g.fillStyle = rad(g, 3, -10, 1, 5, -8, 7, [[0, '#fff7a8'], [1, '#ffc928']])
  g.fill()
  outline(g, 1.2)
  // くちばし
  g.beginPath()
  g.moveTo(10.5, -8.6)
  g.quadraticCurveTo(16.5, -8.8, 15.5, -5.8)
  g.quadraticCurveTo(13, -4.6, 10.5, -5.8)
  g.closePath()
  g.fillStyle = '#ff8a1f'
  g.fill()
  outline(g, 1)
  g.beginPath()
  g.arc(6.8, -9.6, 1.3, 0, Math.PI * 2)
  g.fillStyle = INK
  g.fill()
  g.beginPath()
  g.arc(7.2, -10, 0.45, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  // はね
  g.beginPath()
  g.ellipse(-3, 4, 6, 3.4, -0.3, 0, Math.PI * 2)
  g.fillStyle = 'rgba(255,170,0,.35)'
  g.fill()
}

function drawBoot(g: G) {
  g.beginPath()
  g.moveTo(-9, -16)
  g.lineTo(5, -16)
  g.lineTo(5.5, 3)
  g.quadraticCurveTo(15, 5, 15.5, 12)
  g.lineTo(15.5, 16)
  g.lineTo(-9, 16)
  g.closePath()
  g.fillStyle = lin(g, -9, 0, 16, 0, [[0, '#3fa65a'], [0.4, '#67d17f'], [1, '#2f8246']])
  g.fill()
  outline(g, 1.3)
  g.fillStyle = '#2b6b3a'
  g.fillRect(-9, 13, 24.5, 3)
  rr(g, -10, -18, 16, 4.2, 1.6)
  g.fillStyle = '#ffd43b'
  g.fill()
  outline(g, 1)
  shine(g, -5, -11, -5, 9, 1.5, 0.5)
}

function drawStarfish(g: G) {
  starPath(g, 12.5, 5.4, 3)
  g.fillStyle = lin(g, -8, -10, 8, 10, [[0, '#ffb38a'], [1, '#ff6f5e']])
  g.fill()
  outline(g, 1.2)
  g.fillStyle = 'rgba(255,255,255,.55)'
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2
    for (const r of [4, 7.5]) {
      g.beginPath()
      g.arc(Math.cos(a) * r, Math.sin(a) * r, r === 4 ? 1 : 0.8, 0, Math.PI * 2)
      g.fill()
    }
  }
}

/** くらげ（ふわふわ うごく）。 */
export function drawJelly(g: G, time: number) {
  const pulse = Math.sin(time * 3.2)
  g.save()
  g.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const x = -8 + i * 4
    g.beginPath()
    g.moveTo(x, 3)
    for (let k = 1; k <= 4; k++) g.lineTo(x + Math.sin(time * 3 + i + k * 0.9) * 1.8, 3 + k * 4.4 + pulse)
    g.lineWidth = 1.6
    g.strokeStyle = 'rgba(255,140,190,.75)'
    g.stroke()
  }
  g.beginPath()
  g.ellipse(0, -2, 13 + pulse * 0.9, 10 - pulse * 0.9, 0, Math.PI, 0)
  g.quadraticCurveTo(0, 7, -13 - pulse * 0.9, -2)
  g.closePath()
  g.fillStyle = rad(g, -4, -8, 1, 0, -2, 15, [[0, 'rgba(255,255,255,.95)'], [0.5, 'rgba(255,170,210,.8)'], [1, 'rgba(240,110,170,.7)']])
  g.fill()
  outline(g, 1.1, 'rgba(160,50,110,.55)')
  g.beginPath()
  g.arc(-4, -3, 1.2, 0, Math.PI * 2)
  g.arc(4, -3, 1.2, 0, Math.PI * 2)
  g.fillStyle = INK
  g.fill()
  g.beginPath()
  g.arc(0, -0.5, 1.6, 0.2, Math.PI - 0.2)
  g.lineWidth = 0.9
  g.strokeStyle = INK
  g.stroke()
  g.restore()
}

/** ものを かく（アニメの ない もの）。 */
export function drawItemArt(g: G, kind: KindId, variant: number, pts: readonly { x: number; y: number }[]) {
  switch (kind) {
    case 'clip': return drawClip(g, variant)
    case 'nail': return drawNail(g)
    case 'screw': return drawScrew(g)
    case 'nut': return drawNut(g)
    case 'bolt': return drawBolt(g)
    case 'pin': return drawPin(g, variant)
    case 'spring': return drawSpring(g)
    case 'gear': return drawGear(g)
    case 'ball': return drawBall(g)
    case 'steelcan': return drawCan(g, true)
    case 'alcan': return drawCan(g, false)
    case 'star': return drawStar(g)
    case 'fish': return drawFish(g, variant, 0)
    case 'anchor': return drawAnchor(g)
    case 'pencil': return drawPencil(g, variant)
    case 'eraser': return drawEraser(g)
    case 'crayon': return drawCrayon(g, variant)
    case 'block': return drawBlock(g, variant)
    case 'marble': return drawMarble(g, variant)
    case 'acorn': return drawAcorn(g)
    case 'coin': return drawCoin(g)
    case 'shell': return drawShell(g, variant, pts)
    case 'pebble': return drawPebble(g, variant, pts)
    case 'shovel': return drawShovel(g, variant)
    case 'duck': return drawDuck(g)
    case 'boot': return drawBoot(g)
    case 'starfish': return drawStarfish(g)
    case 'jelly': return drawJelly(g, 0)
  }
}

// ---------------- じしゃく ----------------

export type Face = { mood: 'idle' | 'eager' | 'happy' | 'puzzled'; lookX: number; lookY: number; blink: number; time: number }

const RED = ['#ff8a8f', '#ff4d5a', '#d8233a', '#a8142a']
const BLUE = ['#8cc4ff', '#3d8bff', '#1f5fd6', '#16409c']

function uPath(g: G, half: number, height: number, arm: number) {
  const r = half
  const cy = -height + r
  const ir = half - arm
  g.beginPath()
  g.moveTo(-half, 0)
  g.lineTo(-half, cy)
  g.arc(0, cy, r, Math.PI, 0)
  g.lineTo(half, 0)
  g.lineTo(half - arm, 0)
  g.lineTo(half - arm, cy)
  g.arc(0, cy, ir, 0, Math.PI, true)
  g.lineTo(-half + arm, 0)
  g.closePath()
}

/** U の じしゃく（ローカル: ポールの した まんなかが 0）。 */
export function drawMagnet(g: G, face: Face) {
  drawMagnetBody(g)
  drawMagnetFace(g, face)
}

/** じしゃくの からだ（かおの ない ところ。かわらないので えを とっておける）。 */
export function drawMagnetBody(g: G) {
  const half = MAGNET_HALF_W, height = MAGNET_H, arm = ARM_W
  const cy = -height + half
  // からだ（ひだり あか / みぎ あお）
  g.save()
  uPath(g, half, height, arm)
  g.clip()
  g.fillStyle = lin(g, -half, 0, 0, 0, [[0, RED[2]], [0.3, RED[1]], [0.55, RED[0]], [0.8, RED[1]], [1, RED[2]]])
  g.fillRect(-half - 2, -height - 2, half + 2, height + 4)
  g.fillStyle = lin(g, 0, 0, half, 0, [[0, BLUE[2]], [0.2, BLUE[1]], [0.45, BLUE[0]], [0.7, BLUE[1]], [1, BLUE[2]]])
  g.fillRect(0, -height - 2, half + 2, height + 4)
  // アーチの たてかげ
  g.fillStyle = lin(g, 0, -height, 0, cy + 8, [[0, 'rgba(255,255,255,.35)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0)']])
  g.fillRect(-half, -height, half * 2, half)
  // つやの すじ（U に そって）
  g.beginPath()
  g.moveTo(-half + arm * 0.42, -TIP_H - 3)
  g.lineTo(-half + arm * 0.42, cy)
  g.arc(0, cy, half - arm * 0.58, Math.PI, Math.PI * 1.42)
  g.lineWidth = 3.4
  g.strokeStyle = 'rgba(255,255,255,.5)'
  g.lineCap = 'round'
  g.stroke()
  g.beginPath()
  g.moveTo(half - arm * 0.6, -TIP_H - 3)
  g.lineTo(half - arm * 0.6, cy + 4)
  g.lineWidth = 2.4
  g.strokeStyle = 'rgba(255,255,255,.28)'
  g.stroke()
  // はがねの さき
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -half : half - arm
    g.fillStyle = lin(g, x0, 0, x0 + arm, 0, [[0, '#8793a3'], [0.3, '#e9eef4'], [0.5, '#ffffff'], [0.75, '#b7c1ce'], [1, '#6f7a8b']])
    g.fillRect(x0 - 1, -TIP_H, arm + 2, TIP_H + 1)
    g.fillStyle = 'rgba(0,0,0,.18)'
    g.fillRect(x0 - 1, -TIP_H, arm + 2, 1.6)
  }
  // まんなかの つなぎめ
  g.fillStyle = 'rgba(40,20,50,.25)'
  g.fillRect(-0.7, -height, 1.4, arm + 1)
  g.restore()
  uPath(g, half, height, arm)
  g.lineWidth = 2.2
  g.strokeStyle = INK
  g.lineJoin = 'round'
  g.stroke()
  // N と S
  g.save()
  g.font = `900 15px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 3
  g.strokeStyle = 'rgba(80,10,30,.35)'
  g.strokeText('N', -half + arm / 2, -TIP_H - 13)
  g.strokeStyle = 'rgba(10,30,90,.35)'
  g.strokeText('S', half - arm / 2, -TIP_H - 13)
  g.fillStyle = '#fff'
  g.fillText('N', -half + arm / 2, -TIP_H - 13)
  g.fillText('S', half - arm / 2, -TIP_H - 13)
  g.restore()
}

export function drawMagnetFace(g: G, face: Face) {
  drawFace(g, face, -MAGNET_H + MAGNET_HALF_W)
}

function drawFace(g: G, face: Face, cy: number) {
  const fy = cy - 16
  // ほっぺ
  g.fillStyle = 'rgba(255,190,210,.55)'
  for (const s of [-1, 1]) {
    g.beginPath()
    g.ellipse(s * 17, fy + 7, 3.6, 2.2, 0, 0, Math.PI * 2)
    g.fill()
  }
  const lx = Math.max(-1, Math.min(1, face.lookX)), ly = Math.max(-1, Math.min(1, face.lookY))
  const happy = face.mood === 'happy'
  for (const s of [-1, 1]) {
    const ex = s * 9.5, ey = fy
    if (happy) {
      g.beginPath()
      g.arc(ex, ey + 1.6, 3.6, Math.PI * 1.1, Math.PI * 1.9)
      g.lineWidth = 2.2
      g.strokeStyle = INK
      g.lineCap = 'round'
      g.stroke()
      continue
    }
    const open = Math.max(0.1, 1 - face.blink)
    g.beginPath()
    g.ellipse(ex, ey, 4.6, 5.4 * open, 0, 0, Math.PI * 2)
    g.fillStyle = '#fff'
    g.fill()
    g.lineWidth = 1.2
    g.strokeStyle = INK
    g.stroke()
    if (open > 0.3) {
      const pr = face.mood === 'eager' ? 3.1 : 2.6
      g.beginPath()
      g.ellipse(ex + lx * 1.7, ey + ly * 2.2, pr, pr * open, 0, 0, Math.PI * 2)
      g.fillStyle = INK
      g.fill()
      g.beginPath()
      g.arc(ex + lx * 1.7 - 0.9, ey + ly * 2.2 - 1.2, 0.9, 0, Math.PI * 2)
      g.fillStyle = '#fff'
      g.fill()
    }
  }
  // くち
  g.beginPath()
  g.lineCap = 'round'
  g.lineWidth = 1.8
  g.strokeStyle = INK
  if (happy) {
    g.moveTo(-4.6, fy + 5.5)
    g.quadraticCurveTo(0, fy + 12.5, 4.6, fy + 5.5)
    g.closePath()
    g.fillStyle = '#c9344d'
    g.fill()
    g.stroke()
  } else if (face.mood === 'puzzled') {
    g.moveTo(-3, fy + 8)
    g.quadraticCurveTo(0, fy + 6, 3, fy + 8.4)
    g.stroke()
  } else if (face.mood === 'eager') {
    g.ellipse(0, fy + 8, 2.4, 2.8, 0, 0, Math.PI * 2)
    g.fillStyle = '#c9344d'
    g.fill()
    g.stroke()
  } else {
    g.moveTo(-3.4, fy + 6.5)
    g.quadraticCurveTo(0, fy + 9.6, 3.4, fy + 6.5)
    g.stroke()
  }
}
