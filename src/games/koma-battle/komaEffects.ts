import * as THREE from 'three'

/**
 * コマのまわりに出す演出用テクスチャ。
 *
 * 以前は単色の平たいリングを貼っていたため「板が浮いている」ように見えていた。
 * ここでは縁がふわっと消えるグラデーションと、尾を引いて薄れる風の筋を描き、
 * 回転の残像や衝撃波らしく見せる。どちらも白で描き、Material.colorでタイプ色に染める。
 *
 * RingGeometryのUVは外半径を[0,1]に合わせた平面投影なので、キャンバス中心=リング中心になる。
 */

const TEXTURE_SIZE = 256

/** RingGeometryの内半径/外半径の比。テクスチャの描画帯をリングの形に合わせるため共有する。 */
export const SPIN_TRAIL_INNER_RATIO = 0.62
export const BOOST_WAVE_INNER_RATIO = 0.35

function createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  try {
    return { canvas, ctx: canvas.getContext('2d') }
  } catch {
    // 2Dコンテキストが使えない環境では無地のテクスチャになる(演出が消えるだけ)。
    return { canvas, ctx: null }
  }
}

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 回転の残像。
 * うっすらした光の帯の上に、先頭が明るく後ろへ細く消えていく風の筋を数本描く。
 * 筋はキャンバス上で時計回り(=リングを上から見て反時計回りの後ろ側)へ尾を引く。
 */
export function createSpinTrailTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas()
  if (!ctx) return toTexture(canvas)
  const c = TEXTURE_SIZE / 2
  const outer = c - 2
  const inner = outer * SPIN_TRAIL_INNER_RATIO

  // 下地: 帯の中ほどが少しだけ明るい、縁のない霞。
  const haze = ctx.createRadialGradient(c, c, inner, c, c, outer)
  haze.addColorStop(0, 'rgba(255,255,255,0)')
  haze.addColorStop(0.35, 'rgba(255,255,255,0.16)')
  haze.addColorStop(0.6, 'rgba(255,255,255,0.1)')
  haze.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = haze
  ctx.beginPath()
  ctx.arc(c, c, outer, 0, Math.PI * 2)
  ctx.arc(c, c, inner, 0, Math.PI * 2, true)
  ctx.fill()

  // 風の筋。半径と長さを少しずつずらし、機械的な等間隔に見えないようにする。
  const streaks = [
    { start: 0, radius: 0.3, length: 1.9, width: 5 },
    { start: 2.2, radius: 0.55, length: 1.5, width: 4 },
    { start: 4.1, radius: 0.4, length: 1.7, width: 4.5 },
    { start: 1.1, radius: 0.75, length: 1.0, width: 2.5 },
    { start: 3.3, radius: 0.2, length: 1.1, width: 2.5 },
    { start: 5.3, radius: 0.65, length: 1.2, width: 3 },
  ]
  ctx.lineCap = 'round'
  const segments = 40
  for (const streak of streaks) {
    const r = inner + (outer - inner) * streak.radius
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments
      const t1 = (i + 1) / segments
      const fade = Math.pow(1 - t0, 1.8)
      ctx.strokeStyle = `rgba(255,255,255,${(0.85 * fade).toFixed(3)})`
      ctx.lineWidth = Math.max(0.6, streak.width * (1 - t0 * 0.7))
      ctx.beginPath()
      ctx.arc(c, c, r, streak.start + streak.length * t0, streak.start + streak.length * t1)
      ctx.stroke()
    }
  }
  return toTexture(canvas)
}

/** タップ時の衝撃波。外側の縁が明るく、内側へやわらかく消える輪。 */
export function createBoostWaveTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas()
  if (!ctx) return toTexture(canvas)
  const c = TEXTURE_SIZE / 2
  const outer = c - 2
  const inner = outer * BOOST_WAVE_INNER_RATIO
  const wave = ctx.createRadialGradient(c, c, inner, c, c, outer)
  wave.addColorStop(0, 'rgba(255,255,255,0)')
  wave.addColorStop(0.55, 'rgba(255,255,255,0.18)')
  wave.addColorStop(0.82, 'rgba(255,255,255,0.9)')
  wave.addColorStop(0.9, 'rgba(255,255,255,0.55)')
  wave.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = wave
  ctx.beginPath()
  ctx.arc(c, c, outer, 0, Math.PI * 2)
  ctx.arc(c, c, inner, 0, Math.PI * 2, true)
  ctx.fill()
  return toTexture(canvas)
}
