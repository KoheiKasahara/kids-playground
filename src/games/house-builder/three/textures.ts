// ゆか・かべ・やね・まどの そとの けしきの え。すべて キャンバスに コードで かいた オリジナル。
// キャンバスが つかえない ところ（テストなど）では null を かえし、いろだけで ぬる。

import * as THREE from 'three'
import type { FloorKind, RoofKind, WallKind } from '../data'

/** おなじ もようを いつも おなじに かく ための かんたんな らんすう。 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hashText = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  let g: CanvasRenderingContext2D | null
  try {
    g = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!g) return null
  draw(g)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

function shade(color: string, amount: number): string {
  const c = new THREE.Color(color)
  if (amount > 0) c.lerp(new THREE.Color('#ffffff'), amount)
  else c.lerp(new THREE.Color('#000000'), -amount)
  return `#${c.getHexString()}`
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** ゆかの もよう。1マスぶん（よこ・たて とも 1マス）を 1まいに かく。 */
export function floorTexture(kind: FloorKind, base: string, line: string): THREE.Texture | null {
  const S = 256
  const rnd = seeded(hashText(kind + base + line))
  return canvasTexture(S, S, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, S, S)
    switch (kind) {
      case 'wood': {
        const rows = 6
        const h = S / rows
        for (let r = 0; r < rows; r++) {
          const offset = (r % 3) * (S / 3) + rnd() * 20
          for (let x = -S; x < S * 2; x += S * .9) {
            g.fillStyle = shade(base, (rnd() - .5) * .16)
            g.fillRect(x + offset, r * h, S * .9, h)
            g.strokeStyle = shade(base, -.12)
            g.lineWidth = 1
            for (let k = 0; k < 3; k++) {
              const yy = r * h + 4 + rnd() * (h - 8)
              g.beginPath()
              g.moveTo(x + offset, yy)
              g.bezierCurveTo(x + offset + S * .3, yy + rnd() * 4 - 2, x + offset + S * .6, yy + rnd() * 4 - 2, x + offset + S * .9, yy)
              g.stroke()
            }
            g.fillStyle = line
            g.fillRect(x + offset, r * h, 2, h)
          }
          g.fillStyle = line
          g.fillRect(0, r * h, S, 2)
        }
        break
      }
      case 'tile': {
        const n = 3
        const t = S / n
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          g.fillStyle = shade(base, (rnd() - .5) * .05)
          g.fillRect(x * t, y * t, t, t)
        }
        g.strokeStyle = line
        g.lineWidth = 4
        for (let i = 0; i <= n; i++) {
          g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke()
          g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke()
        }
        break
      }
      case 'tatami': {
        // 1マスに たたみ 2まい（たてながに ならべる）。
        for (let m = 0; m < 2; m++) {
          const x0 = m * (S / 2)
          g.fillStyle = shade(base, m ? -.04 : .02)
          g.fillRect(x0, 0, S / 2, S)
          g.strokeStyle = shade(base, -.1)
          g.lineWidth = 1
          for (let yy = 3; yy < S; yy += 5) {
            g.beginPath(); g.moveTo(x0 + 8, yy); g.lineTo(x0 + S / 2 - 8, yy); g.stroke()
          }
          g.fillStyle = '#3e5d3a'
          g.fillRect(x0, 0, 8, S)
          g.fillRect(x0 + S / 2 - 8, 0, 8, S)
        }
        g.fillStyle = line
        g.fillRect(0, 0, S, 2)
        break
      }
      case 'carpet': {
        for (let i = 0; i < 1600; i++) {
          g.fillStyle = rnd() < .5 ? line : shade(base, .12)
          g.globalAlpha = .35
          g.fillRect(rnd() * S, rnd() * S, 2, 2)
        }
        g.globalAlpha = 1
        break
      }
      case 'checker': {
        const n = 4
        const t = S / n
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          g.fillStyle = (x + y) % 2 ? line : base
          g.fillRect(x * t, y * t, t, t)
        }
        break
      }
      case 'stone': {
        g.fillStyle = line
        g.fillRect(0, 0, S, S)
        const n = 4
        const t = S / n
        for (let y = 0; y < n; y++) {
          const ox = (y % 2) * t / 2
          for (let x = -1; x < n; x++) {
            g.fillStyle = shade(base, (rnd() - .5) * .2)
            roundRect(g, x * t + ox + 4, y * t + 4, t - 8, t - 8, 14)
            g.fill()
          }
        }
        break
      }
      case 'marble': {
        g.strokeStyle = line
        for (let i = 0; i < 7; i++) {
          g.lineWidth = 1 + rnd() * 2
          g.globalAlpha = .55
          let x = rnd() * S
          let y = 0
          g.beginPath()
          g.moveTo(x, y)
          while (y < S) {
            x += (rnd() - .5) * 40
            y += 20 + rnd() * 20
            g.lineTo(x, y)
          }
          g.stroke()
        }
        g.globalAlpha = 1
        g.strokeStyle = shade(line, .2)
        g.lineWidth = 2
        g.strokeRect(0, 0, S / 2, S / 2)
        g.strokeRect(S / 2, S / 2, S / 2, S / 2)
        break
      }
    }
  })
}

/** そとの かべの もよう。よこ 2メートル・たて 1かいぶんを 1まいに かく。 */
export function wallTexture(kind: WallKind, base: string, line: string): THREE.Texture | null {
  const W = 256
  const H = 360
  const rnd = seeded(hashText(kind + base))
  return canvasTexture(W, H, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, W, H)
    switch (kind) {
      case 'plain':
        for (let i = 0; i < 900; i++) {
          g.fillStyle = rnd() < .5 ? shade(base, -.05) : shade(base, .3)
          g.fillRect(rnd() * W, rnd() * H, 2, 2)
        }
        break
      case 'brick': {
        const bh = H / 30
        const bw = W / 8
        for (let r = 0; r < 30; r++) {
          const off = r % 2 ? bw / 2 : 0
          for (let x = -bw; x < W + bw; x += bw) {
            g.fillStyle = shade(base, (rnd() - .5) * .22)
            g.fillRect(x + off + 1.5, r * bh + 1.5, bw - 3, bh - 3)
          }
        }
        g.globalCompositeOperation = 'destination-over'
        g.fillStyle = line
        g.fillRect(0, 0, W, H)
        g.globalCompositeOperation = 'source-over'
        break
      }
      case 'siding': {
        const n = 14
        const h = H / n
        for (let i = 0; i < n; i++) {
          const grad = g.createLinearGradient(0, i * h, 0, (i + 1) * h)
          grad.addColorStop(0, shade(base, .12))
          grad.addColorStop(1, shade(base, -.08))
          g.fillStyle = grad
          g.fillRect(0, i * h, W, h)
          g.fillStyle = line
          g.fillRect(0, (i + 1) * h - 3, W, 3)
        }
        break
      }
      case 'log': {
        const n = 11
        const h = H / n
        for (let i = 0; i < n; i++) {
          const grad = g.createLinearGradient(0, i * h, 0, (i + 1) * h)
          grad.addColorStop(0, shade(base, -.25))
          grad.addColorStop(.35, shade(base, .15))
          grad.addColorStop(1, shade(base, -.35))
          g.fillStyle = grad
          g.fillRect(0, i * h + 1, W, h - 2)
        }
        break
      }
      case 'wa': {
        const split = H * .6
        g.fillStyle = '#3b3330'
        g.fillRect(0, split, W, H - split)
        g.fillStyle = '#5a4e48'
        for (let x = 0; x < W; x += 16) g.fillRect(x, split, 3, H - split)
        g.fillStyle = '#2a2220'
        g.fillRect(0, split - 6, W, 8)
        g.fillRect(0, 0, W, 6)
        g.fillRect(0, 0, 8, split)
        break
      }
      case 'stone': {
        g.fillStyle = line
        g.fillRect(0, 0, W, H)
        const rows = 12
        const h = H / rows
        for (let r = 0; r < rows; r++) {
          let x = r % 2 ? -30 : 0
          while (x < W) {
            const w = 40 + rnd() * 40
            g.fillStyle = shade(base, (rnd() - .5) * .2)
            roundRect(g, x + 2, r * h + 2, w - 4, h - 4, 8)
            g.fill()
            x += w
          }
        }
        break
      }
    }
  })
}

/** やねの もよう。2メートル しかくを 1まいに かく。 */
export function roofTexture(kind: RoofKind, color: string, dark: string): THREE.Texture | null {
  const S = 256
  const rnd = seeded(hashText(kind + color))
  return canvasTexture(S, S, (g) => {
    g.fillStyle = color
    g.fillRect(0, 0, S, S)
    if (kind === 'kawara') {
      // たての なみ（かわらの すじ）。
      const n = 8
      const w = S / n
      for (let i = 0; i < n; i++) {
        const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0)
        grad.addColorStop(0, shade(color, -.25))
        grad.addColorStop(.5, shade(color, .18))
        grad.addColorStop(1, shade(color, -.25))
        g.fillStyle = grad
        g.fillRect(i * w, 0, w, S)
      }
      g.fillStyle = dark
      for (let y = 0; y < S; y += S / 6) g.fillRect(0, y, S, 2)
    } else if (kind === 'flat') {
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = rnd() < .5 ? shade(color, -.12) : shade(color, .15)
        g.fillRect(rnd() * S, rnd() * S, 2, 2)
      }
    } else {
      // よこに ならぶ かわら（うろこ）。
      const rows = 8
      const h = S / rows
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? h * .6 : 0
        for (let x = -h; x < S + h; x += h * 1.2) {
          g.fillStyle = shade(color, (rnd() - .5) * .14)
          roundRect(g, x + off + 1, r * h + 1, h * 1.2 - 2, h - 2, 6)
          g.fill()
        }
        g.fillStyle = dark
        g.globalAlpha = .55
        g.fillRect(0, (r + 1) * h - 3, S, 3)
        g.globalAlpha = 1
      }
    }
  })
}

/** まどの むこうの けしき（へやの なかから みる まど）。 */
export function viewTexture(): THREE.Texture | null {
  const S = 128
  return canvasTexture(S, S, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, S)
    sky.addColorStop(0, '#6cc4ff')
    sky.addColorStop(.7, '#d8f1ff')
    g.fillStyle = sky
    g.fillRect(0, 0, S, S)
    g.fillStyle = '#ffffff'
    for (const [x, y, r] of [[30, 30, 10], [42, 26, 12], [54, 31, 9], [96, 50, 8], [106, 46, 10]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = '#9fd67a'
    g.beginPath()
    g.moveTo(0, S)
    g.quadraticCurveTo(S * .3, S * .62, S * .6, S * .82)
    g.quadraticCurveTo(S * .8, S * .7, S, S * .78)
    g.lineTo(S, S)
    g.fill()
    g.fillStyle = '#4caf50'
    for (const x of [20, 88]) {
      g.beginPath(); g.arc(x, S * .74, 12, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = '#ffffff88'
    g.beginPath()
    g.moveTo(S * .1, S)
    g.lineTo(S * .35, 0)
    g.lineTo(S * .45, 0)
    g.lineTo(S * .2, S)
    g.fill()
  })
}
