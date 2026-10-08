import { describe, expect, test } from 'vitest'
import { CLAY_HEX, drawPaint, drawStrokeSegments, GLAZES, glazeHex, isGlazeId, ringStroke, shownHex, totalPoints, type PaintSurface, type Stroke } from './paint'

/** 2Dキャンバスの かわり。よばれた かき方だけを きろくする。 */
function recorder() {
  const calls: { name: string; args: number[]; fill?: string }[] = []
  const state = { fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, lineCap: '', lineJoin: '' }
  const record = (name: string) => (...args: number[]) => { calls.push({ name, args, fill: state.fillStyle }) }
  const ctx = Object.assign(state, {
    fillRect: record('fillRect'), beginPath: record('beginPath'), moveTo: record('moveTo'), lineTo: record('lineTo'),
    stroke: record('stroke'), fill: record('fill'), arc: record('arc'), ellipse: record('ellipse'),
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const surface: PaintSurface = { width: 1000, height: 500, wallLength: 2, radiusAtV: () => 1 }

describe('いろ', () => {
  test('うわぐすりは 10しょく、id は かさならない', () => {
    expect(GLAZES).toHaveLength(10)
    expect(new Set(GLAZES.map(glaze => glaze.id)).size).toBe(GLAZES.length)
    expect(new Set(GLAZES.map(glaze => glaze.name)).size).toBe(GLAZES.length)
    expect(isGlazeId('blue')).toBe(true)
    expect(isGlazeId('gold')).toBe(false)
  })

  test('やく まえは 白っぽく、やくと もとの いろ', () => {
    expect(shownHex('blue', true)).toBe(glazeHex('blue'))
    expect(shownHex('blue', false)).not.toBe(glazeHex('blue'))
    expect(shownHex(null, false)).toBe(CLAY_HEX)
    for (const glaze of GLAZES) expect(shownHex(glaze.id, false)).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('ふでの せん', () => {
  test('まわり 1しゅうの せんは u=0〜1 を まわる', () => {
    const ring = ringStroke(0.3, 'red', 'thin')
    expect(ring.points[0]).toEqual([0, 0.3])
    expect(ring.points.at(-1)).toEqual([1, 0.3])
    expect(totalPoints({ base: null, strokes: [ring, ring] })).toBe(ring.points.length * 2)
  })

  test('つなぎめを またぐ せんは みじかい ほうで つなぎ、左右にも かく', () => {
    const { ctx, calls } = recorder()
    const stroke: Stroke = { color: 'red', brush: 'thick', points: [[0.98, 0.5], [0.02, 0.5]] }
    drawStrokeSegments(ctx, surface, stroke, 1, true)
    const segments = calls.filter(call => call.name === 'moveTo').map((move, index) => [move.args[0], calls.filter(call => call.name === 'lineTo')[index]!.args[0]])
    // 980→1020 の みじかい せん（と、左右に ずらした おなじ せん）。1000px を よこぎって もどる ながい せんは ない。
    for (const [from, to] of segments) expect(Math.abs(to! - from!)).toBeCloseTo(40, 5)
    expect(segments.map(([from]) => Math.round(from!))).toEqual([-20, 980])
  })

  test('ふでの はばは かべの ながさに あわせる', () => {
    const { ctx } = recorder()
    drawStrokeSegments(ctx, surface, { color: 'red', brush: 'thick', points: [[0.1, 0.5], [0.2, 0.5]] }, 1, false)
    expect(ctx.lineWidth).toBeCloseTo((0.2 / 2) * 500)
  })

  test('てんてんは まわりの くぎりごとに 1こ', () => {
    const { ctx, calls } = recorder()
    const points = Array.from({ length: 101 }, (_, i) => [i / 100, 0.5] as const)
    drawStrokeSegments(ctx, surface, { color: 'blue', brush: 'dots', points }, 1, true)
    expect(calls.filter(call => call.name === 'ellipse')).toHaveLength(11)
  })

  test('ぜんたいを かきなおす ときは うわぐすり → せん の じゅん。つちは すじも かく', () => {
    const glazed = recorder()
    drawPaint(glazed.ctx, surface, { base: 'yellow', strokes: [ringStroke(0.5, 'red', 'thick')] }, true)
    expect(glazed.calls[0]).toMatchObject({ name: 'fillRect', args: [0, 0, 1000, 500], fill: glazeHex('yellow') })
    expect(glazed.calls.some(call => call.name === 'stroke' && call.fill === glazeHex('red'))).toBe(true)
    const clay = recorder()
    drawPaint(clay.ctx, surface, { base: null, strokes: [] }, false)
    expect(clay.calls.filter(call => call.name === 'fillRect').length).toBeGreaterThan(50)
  })
})
