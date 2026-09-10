import { describe, expect, it } from 'vitest'
import { area, beginGrab, bodyPath, center, CONTAINERS, createSlime, FEELS, FLOOR, holeOutline, lift, morph, outline, poke, shapePreview, SHAPE_IDS, SHAPES, squish, stepSlime, WIDTH, type Container, type Feel, type ShapeId, type Slime } from './slimeSimulation'
const run = (s: Slime, count: number, feel: Feel = 'soft') => { for (let i = 0; i < count; i++) stepSlime(s, [], feel) }
const extent = (s: Slime, axis: 'x' | 'y') => Math.max(...s.points.map((p) => p[axis])) - Math.min(...s.points.map((p) => p[axis]))
function expectStable(s: Slime) {
  for (const p of s.points) {
    expect(Number.isFinite(p.x + p.y + p.px + p.py)).toBe(true)
    expect(p.x).toBeGreaterThanOrEqual(12)
    expect(p.x).toBeLessThanOrEqual(WIDTH - 12)
    expect(p.y).toBeGreaterThanOrEqual(12)
    expect(p.y).toBeLessThanOrEqual(FLOOR)
  }
  expect(area(s)).toBeGreaterThan(s.shape.restArea * 0.65)
  expect(area(s)).toBeLessThan(s.shape.restArea * 1.3)
}
describe('slime soft body', () => {
  it.each<Feel>(['soft', 'bouncy'])('lands without collapsing and settles (%s)', (feel) => {
    const s = createSlime()
    run(s, 900, feel)
    expectStable(s)
    expect(Math.max(...s.points.map((p) => p.y))).toBeCloseTo(FLOOR, 0)
    const before = center(s)
    run(s, 60, feel)
    expect(Math.hypot(center(s).x - before.x, center(s).y - before.y)).toBeLessThan(2)
  })
  it('only grabs the body or its forgiving rim, and allows two distinct fingers', () => {
    const s = createSlime()
    expect(beginGrab(s, { x: 20, y: 20 })).toBeNull()
    const first = beginGrab(s, { x: 440, y: 265 })!
    expect(first).not.toBeNull()
    const second = beginGrab(s, { x: 160, y: 265 }, [first])!
    expect(second.index).not.toBe(first.index)
  })
  it('stretches toward a held finger and recovers after release', () => {
    const s = createSlime()
    run(s, 180)
    const p = s.points[36]
    const grab = beginGrab(s, { x: p.x, y: p.y })!
    grab.target.y = 40
    for (let i = 0; i < 100; i++) stepSlime(s, [grab])
    expect(s.points[grab.index].y).toBeLessThan(100)
    const heldHeight = extent(s, 'y')
    run(s, 400)
    expectStable(s)
    expect(extent(s, 'y')).toBeLessThan(heldHeight)
    expect(center(s).y).toBeGreaterThan(300)
  })
  it.each<Feel>(['soft', 'bouncy'])('survives repeated opposing drags, squishes and drops (%s)', (feel) => {
    const s = createSlime()
    for (let round = 0; round < 20; round++) {
      const left = beginGrab(s, { ...s.points[24] })!
      const right = beginGrab(s, { ...s.points[0] }, [left])!
      left.target = { x: -1000, y: round % 2 ? -1000 : 1000 }
      right.target = { x: 2000, y: round % 2 ? 1000 : -1000 }
      for (let i = 0; i < 30; i++) stepSlime(s, [left, right], feel)
      squish(s); lift(s); run(s, 90, feel)
    }
    run(s, 300, feel)
    expectStable(s)
    expect(outline(s)).not.toMatch(/NaN|Infinity/)
  })
  it('a quick tap leaves a ripple without requiring a drag', () => {
    const s = createSlime()
    run(s, 180)
    const untouched = structuredClone(s)
    poke(s, 36)
    run(s, 8); run(untouched, 8)
    expect(Math.abs(s.points[36].y - untouched.points[36].y)).toBeGreaterThan(1)
    run(s, 300)
    expectStable(s)
  })
  it('squish flattens and widens; lift moves up then falls back', () => {
    const s = createSlime()
    run(s, 180)
    const w = extent(s, 'x'), h = extent(s, 'y')
    squish(s)
    expect(extent(s, 'x')).toBeGreaterThan(w)
    expect(extent(s, 'y')).toBeLessThan(h)
    run(s, 180)
    const y = center(s).y
    lift(s)
    expect(center(s).y).toBeLessThan(y - 70)
    run(s, 300)
    expect(center(s).y).toBeGreaterThan(y - 5)
    expectStable(s)
  })
})
const hold = (s: Slime, index: number, target: { x: number; y: number }, count: number, feel: Feel = 'soft', holders: readonly Container[] = []) => {
  const grab = beginGrab(s, { ...s.points[index] })!
  for (let i = 0; i < count; i++) { grab.target = target; stepSlime(s, [grab], feel, holders) }
  return grab
}
const shake = (s: Slime, feel: Feel) => {
  const grab = beginGrab(s, { ...s.points[12] })!
  for (let i = 0; i < 180; i++) { grab.target = { x: 300 + Math.sin(i / 3) * 170, y: 260 }; stepSlime(s, [grab], feel) }
}
/** rest形状からのずれ。戻りきったかどうかを形に依らず測る。 */
const deform = (s: Slime) => {
  const c = center(s)
  return s.points.reduce((sum, p, i) => sum + Math.hypot(p.x - c.x - s.shape.rest[i].x, p.y - c.y - s.shape.rest[i].y), 0) / s.points.length
}
/** 離したあと高さが伸び縮みを何回折り返したか。跳ね返りの回数。 */
function rebounds(s: Slime, feel: Feel, count: number) {
  const trail: number[] = []
  for (let i = 0; i < count; i++) { stepSlime(s, [], feel); trail.push(extent(s, 'y')) }
  let flips = 0
  for (let i = 2; i < trail.length; i++) {
    if (Math.abs(trail[i] - trail[i - 1]) > 0.4 && Math.sign(trail[i] - trail[i - 1]) !== Math.sign(trail[i - 1] - trail[i - 2])) flips += 1
  }
  return flips
}
const fit = (s: Slime, holder: Container) => s.points.reduce((sum, p, i) => sum + Math.hypot(p.x - holder.inner[i].x, p.y - holder.inner[i].y), 0) / s.points.length

describe('slime shapes', () => {
  it.each(SHAPE_IDS)('%s settles on the floor with its own outline', (id) => {
    const s = createSlime(id)
    expect(s.shape.id).toBe(id)
    run(s, 700)
    expectStable(s)
    expect(Math.max(...s.points.map((p) => p.y))).toBeCloseTo(FLOOR, 0)
  })
  it.each(SHAPE_IDS)('%s uses the same drag and recovery logic', (id) => {
    const s = createSlime(id)
    run(s, 180)
    const resting = extent(s, 'y')
    hold(s, 36, { x: 300, y: 40 }, 120)
    expect(extent(s, 'y')).toBeGreaterThan(resting)
    run(s, 500)
    expectStable(s)
    expect(extent(s, 'y')).toBeLessThan(extent(s, 'y') + 1)
    expect(outline(s)).not.toMatch(/NaN|Infinity/)
  })
  it('keeps the shapes visibly different from one another', () => {
    const spans = SHAPE_IDS.map((id) => {
      const rest = SHAPES[id].rest
      return `${Math.round(Math.max(...rest.map((p) => p.x)))}x${Math.round(Math.max(...rest.map((p) => p.y)))}x${Math.round(SHAPES[id].restArea / 1000)}`
    })
    expect(new Set(spans).size).toBe(SHAPE_IDS.length)
  })
  it('morphs in place, keeping the center and dropping the old deformation', () => {
    const s = createSlime('round')
    run(s, 200)
    hold(s, 36, { x: 400, y: 80 }, 60)
    const before = center(s)
    morph(s, 'star')
    expect(s.shape.id).toBe('star')
    expect(center(s).x).toBeCloseTo(before.x, 0)
    expect(s.points.every((p) => p.x === p.px && p.y === p.py)).toBe(true)
    run(s, 400)
    expectStable(s)
  })
  it('ドーナツの穴は外周と逆回りに描かれる', () => {
    // 同じ回り方（evenodd頼み）にすると、大きく伸ばして輪郭が自分と重なった部分まで穴になる。
    const turn = (d: string) => {
      const points = [...d.matchAll(/Q(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
      return Math.sign(points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length]
        return sum + p.x * q.y - q.x * p.y
      }, 0))
    }
    const s = createSlime('donut')
    expect(turn(outline(s))).not.toBe(0)
    expect(turn(holeOutline(s))).toBe(-turn(outline(s)))
    expect(turn(shapePreview('donut', 34).split('Z ')[1])).toBe(-turn(shapePreview('donut', 34).split('Z ')[0]))
  })
  it('draws a hole only for the donut, and previews every shape', () => {
    for (const id of SHAPE_IDS) {
      const s = createSlime(id)
      const preview = shapePreview(id, 34)
      expect(preview.startsWith('M')).toBe(true)
      expect(preview).not.toMatch(/NaN/)
      expect(holeOutline(s) === '').toBe(id !== 'donut')
      expect(bodyPath(s).match(/M/g)!.length).toBe(id === 'donut' ? 2 : 1)
      expect(preview.match(/M/g)!.length).toBe(id === 'donut' ? 2 : 1)
    }
  })
})

describe('slime feels', () => {
  it('とろ〜りは細く長く伸び、ぷるぷるは太いまま伸びる', () => {
    const stretched = (feel: Feel) => {
      const s = createSlime()
      run(s, 180, feel)
      hold(s, 36, { x: 300, y: 40 }, 150, feel)
      return { height: extent(s, 'y'), width: extent(s, 'x') }
    }
    const soft = stretched('soft'), bouncy = stretched('bouncy')
    expect(soft.height).toBeGreaterThan(bouncy.height)
    expect(soft.width).toBeLessThan(bouncy.width)
  })
  it('ぷるぷるは離すと小刻みに跳ね返り、とろ〜りは折り返さずゆっくり戻る', () => {
    const released = (feel: Feel) => {
      const s = createSlime()
      run(s, 180, feel)
      hold(s, 36, { x: 300, y: 40 }, 120, feel)
      const flips = rebounds(s, feel, 240)
      return { flips, left: deform(s) }
    }
    const soft = released('soft'), bouncy = released('bouncy')
    expect(bouncy.flips).toBeGreaterThanOrEqual(4)
    expect(soft.flips).toBeLessThanOrEqual(2)
    // とろ〜りは同じ時間だけ待ってもまだ形が戻りきらない。
    expect(soft.left).toBeGreaterThan(bouncy.left)
  })
  it('ぷるぷるは揺らすと震えが続き、とろ〜りは震えない', () => {
    const shaken = (feel: Feel) => {
      const s = createSlime()
      run(s, 180, feel)
      shake(s, feel)
      run(s, 90, feel)
      return s
    }
    const soft = shaken('soft'), bouncy = shaken('bouncy')
    expect(soft.jiggle).toBe(0)
    expect(bouncy.jiggle).toBeGreaterThan(0.2)
    // 震えは自分で増えず、放っておけば必ず消える。
    run(bouncy, 600, 'bouncy')
    expect(bouncy.jiggle).toBeLessThan(0.05)
    expectStable(bouncy)
    expectStable(soft)
  })
  it('とろ〜りだけが伸ばした先から滴を垂らし、滴は落ちて消える', () => {
    const s = createSlime()
    run(s, 180)
    const grab = beginGrab(s, { ...s.points[36] })!
    for (let i = 0; i < 200; i++) { grab.target = { x: 300, y: 40 }; stepSlime(s, [grab], 'soft') }
    expect(s.drips.length).toBeGreaterThan(0)
    expect(s.drips.length).toBeLessThanOrEqual(FEELS.soft.drip.max)
    expect(s.drips.every((drip) => drip.y <= FLOOR)).toBe(true)
    run(s, 400)
    expect(s.drips).toHaveLength(0)
    const bouncy = createSlime()
    run(bouncy, 180, 'bouncy')
    const held = beginGrab(bouncy, { ...bouncy.points[36] })!
    for (let i = 0; i < 200; i++) { held.target = { x: 300, y: 40 }; stepSlime(bouncy, [held], 'bouncy') }
    expect(bouncy.drips).toHaveLength(0)
  })
  it('質感はパラメータの束として足せる形になっている', () => {
    for (const feel of Object.values(FEELS)) {
      expect(feel.spring).toBeGreaterThan(0)
      expect(feel.drag).toBeGreaterThan(0.9)
      expect(feel.drag).toBeLessThan(1)
      expect(feel.look.body).toBeGreaterThan(0)
      expect(feel.voice.base).toBeGreaterThan(0)
    }
    expect(FEELS.soft.spring).toBeLessThan(FEELS.bouncy.spring)
    expect(FEELS.soft.look.body).toBeLessThan(FEELS.bouncy.look.body)
    expect(FEELS.soft.voice.base).toBeLessThan(FEELS.bouncy.voice.base)
  })
})

describe('slime containers', () => {
  const cup = CONTAINERS[0], plate = CONTAINERS[1], star = CONTAINERS[2]
  it('容器がなければ形は変わらない', () => {
    const s = createSlime()
    hold(s, 0, { x: cup.center.x, y: cup.center.y }, 200)
    expect(s.molded).toBeNull()
    run(s, 300)
    expectStable(s)
  })
  it.each(CONTAINERS)('$id へ乗せると内側の輪郭にぴったり収まる', (holder) => {
    const s = createSlime()
    run(s, 200)
    hold(s, 0, holder.center, 240, 'soft', [holder])
    expect(s.molded).toBe(holder.id)
    expect(fit(s, holder)).toBeLessThan(12)
    expect(Math.abs(area(s) / holder.innerArea - 1)).toBeLessThan(0.35)
    expect(outline(s)).not.toMatch(/NaN|Infinity/)
  })
  it('形がどれでも容器に合わせて変形する', () => {
    for (const id of SHAPE_IDS) {
      const s = createSlime(id as ShapeId)
      run(s, 200, 'soft', )
      hold(s, 0, cup.center, 240, 'soft', [cup])
      expect(s.molded).toBe('cup')
      expect(fit(s, cup)).toBeLessThan(14)
    }
  })
  it('引き出すと元の形へ戻り、容器の跡が少しだけ残る', () => {
    const s = createSlime('star')
    run(s, 200)
    hold(s, 0, cup.center, 200, 'soft', [cup])
    expect(s.molded).toBe('cup')
    const grab = beginGrab(s, { ...s.points[0] })!
    let trace = ''
    for (let i = 0; i < 60; i++) {
      grab.target = { x: 380, y: 120 }
      stepSlime(s, [grab], 'soft', [cup])
      if (s.event === 'free') trace = s.ghost!.d
    }
    expect(s.molded).toBeNull()
    expect(trace).toBeTruthy()
    expect(trace).not.toMatch(/NaN/)
    for (let i = 0; i < 400; i++) stepSlime(s, [], 'soft', [cup])
    expect(s.ghost).toBeNull()
    expect(s.molded).toBeNull()
    expectStable(s)
    expect(fit(s, cup)).toBeGreaterThan(40)
  })
  it('別の容器へ移し替えられる', () => {
    const s = createSlime()
    run(s, 200)
    hold(s, 0, star.center, 200, 'soft', [cup, star])
    expect(s.molded).toBe('star')
    hold(s, 0, cup.center, 260, 'soft', [cup, star])
    expect(s.molded).toBe('cup')
    expect(fit(s, cup)).toBeLessThan(14)
  })
  it('乗り降りのたびに一度だけ合図を出す', () => {
    const s = createSlime()
    run(s, 200)
    const grab = beginGrab(s, { ...s.points[0] })!
    const events: string[] = []
    for (let i = 0; i < 240; i++) {
      grab.target = i < 120 ? plate.center : { x: 300, y: 60 }
      stepSlime(s, [grab], 'bouncy', [plate])
      if (s.event) events.push(s.event)
    }
    expect(events).toEqual(['fit', 'free'])
  })
  it('容器を片付けたら形が戻る', () => {
    const s = createSlime()
    run(s, 200)
    hold(s, 0, plate.center, 200, 'soft', [plate])
    expect(s.molded).toBe('plate')
    run(s, 300)
    expect(s.molded).toBeNull()
    expectStable(s)
  })
  it('容器は画面の中に収まり、互いに重ならない', () => {
    for (const holder of CONTAINERS) {
      for (const p of holder.inner) {
        expect(p.x).toBeGreaterThanOrEqual(12)
        expect(p.x).toBeLessThanOrEqual(WIDTH - 12)
        expect(p.y).toBeLessThanOrEqual(FLOOR)
        expect(p.y).toBeGreaterThanOrEqual(12)
      }
      expect(holder.release).toBeGreaterThan(holder.grip)
      expect(holder.innerArea).toBeGreaterThan(0)
      expect(holder.wall).not.toMatch(/NaN/)
    }
    const spread = CONTAINERS.map((holder) => holder.center.x).sort((a, b) => a - b)
    expect(spread[1] - spread[0]).toBeGreaterThan(160)
    expect(spread[2] - spread[1]).toBeGreaterThan(160)
  })
})
