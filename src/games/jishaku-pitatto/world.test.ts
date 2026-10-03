import { describe, expect, test } from 'vitest'
import { KINDS } from './items'
import { STAGES, findStage, type StageDef } from './stages'
import {
  MAGNET_HALF_W, autoPilot, carryOver, createWorld, disposeWorld, drainEvents, fieldAt, floorAt, missionProgress, remainingTargets,
  setMagnetTarget, stepWorld, worldResult, worldSize, type World, type WorldEvent,
} from './world'

const PORTRAIT = { w: 360, h: 780 }
const LANDSCAPE = { w: 910, h: 430 }

function stage(id: string): StageDef {
  const found = findStage(id)
  if (!found) throw new Error(id)
  return found
}

function run(world: World, frames: number, each?: (w: World) => void): WorldEvent[] {
  const events: WorldEvent[] = []
  for (let i = 0; i < frames; i++) {
    each?.(world)
    stepWorld(world)
    events.push(...drainEvents(world))
  }
  return events
}

/** じしゃくを ものの ま上へ はこんで しばらく まつ。 */
function hoverOver(world: World, x: number, y: number, frames = 90) {
  return run(world, frames, (w) => setMagnetTarget(w, x, y))
}

describe('ステージの データ', () => {
  test('ステージの id は かさならず、どれも てつ と くっつかない もの と ほしバッジ3こ を もつ', () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length)
    for (const s of STAGES) {
      const kinds = s.items.map((p) => KINDS[p.kind])
      expect(kinds.every(Boolean)).toBe(true)
      expect(kinds.filter((k) => k.id === 'star')).toHaveLength(3)
      expect(kinds.some((k) => k.magnetic && k.id !== 'star')).toBe(true)
      expect(kinds.some((k) => !k.magnetic)).toBe(true)
      const propIds = new Set(s.props.map((p) => p.id))
      for (const p of s.items) if (p.on) expect(propIds.has(p.on)).toBe(true)
      expect(s.mission).toBeDefined()
    }
  })

  test('くっつく ものは ちからの かかる ばしょを もち、くっつかない ものは もたない', () => {
    for (const kind of Object.values(KINDS)) {
      if (kind.magnetic) {
        expect(kind.hot.length).toBeGreaterThan(0)
        expect(kind.pull).toBeGreaterThan(0)
      } else {
        expect(kind.hot).toHaveLength(0)
      }
    }
  })

  test('がめんの 大きさから、たてでも よこでも ものが ちいさく なりすぎない せかいを つくる', () => {
    const portrait = worldSize(390, 844)
    expect(portrait.w).toBeCloseTo(360)
    expect(portrait.h).toBeGreaterThan(700)
    const landscape = worldSize(844, 390)
    expect(landscape.h).toBeCloseTo(430)
    expect(landscape.w).toBeGreaterThan(800)
  })
})

describe('じしゃくの ちから', () => {
  test('ポールの ちかくほど つよく、とおくでは はたらかない', () => {
    const world = createWorld(stage('desk'), PORTRAIT)
    const m = world.magnet
    const out = { x: 0, y: 0 }
    const near = fieldAt(world, m.x, m.y + 30, out)
    expect(out.y).toBeLessThan(0)
    const mid = fieldAt(world, m.x, m.y + 60, out)
    const far = fieldAt(world, m.x, m.y + 400, out)
    expect(near).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(0)
    expect(far).toBe(0)
    disposeWorld(world)
  })

  test('てつの クリップは とびついて くっつき、じしゃくの したに ぶらさがる', () => {
    const world = createWorld(stage('desk'), PORTRAIT)
    const clip = world.items.find((it) => it.kind.id === 'clip')!
    const events = hoverOver(world, clip.x, clip.y - 12)
    expect(events.some((e) => e.type === 'stick' && e.id === clip.id)).toBe(true)
    expect(clip.state).toBe('stuck')
    run(world, 60, (w) => setMagnetTarget(w, w.w / 2, w.groundY - 220))
    expect(clip.y).toBeGreaterThan(world.magnet.y - 10)
    expect(Math.abs(clip.x - world.magnet.x)).toBeLessThan(MAGNET_HALF_W + 30)
    disposeWorld(world)
  })

  test('えんぴつ・けしゴムは じしゃくを ちかづけても くっつかず「しーん」と する', () => {
    const world = createWorld(stage('desk'), PORTRAIT)
    const eraser = world.items.find((it) => it.kind.id === 'eraser')!
    const events = hoverOver(world, eraser.x, eraser.y - 16, 120)
    expect(eraser.state).toBe('body')
    expect(events.some((e) => e.type === 'shiin' && e.id === eraser.id)).toBe(true)
    for (const it of world.items) if (!it.kind.magnetic) expect(it.state).not.toBe('stuck')
    disposeWorld(world)
  })

  test('じしゃくは つくえに めりこまない', () => {
    const world = createWorld(stage('desk'), PORTRAIT)
    run(world, 90, (w) => setMagnetTarget(w, w.w / 2, w.groundY + 200))
    const m = world.magnet
    expect(m.y).toBeLessThanOrEqual(floorAt(world, m.x - MAGNET_HALF_W, m.x + MAGNET_HALF_W) + 1)
    disposeWorld(world)
  })

  test('くっついた てつも じしゃくに なって、つぎの てつが つながる', () => {
    const world = createWorld(stage('desk'), LANDSCAPE)
    run(world, 60 * 40, autoPilot)
    expect(world.stuckOrder.some((it) => (it.stuck?.depth ?? 0) >= 2)).toBe(true)
    disposeWorld(world)
  })
})

describe('ステージの しかけ', () => {
  test('すなに うまった ものは じしゃくを ちかづけると ぽんっと でてくる', () => {
    const world = createWorld(stage('sand'), PORTRAIT)
    const buried = world.items.find((it) => it.state === 'buried')!
    const events = hoverOver(world, buried.x, world.groundY - 4, 120)
    expect(events.some((e) => e.type === 'pop' && e.id === buried.id)).toBe(true)
    expect(buried.state).not.toBe('buried')
    disposeWorld(world)
  })

  test('すなの うえを なぞると さてつが じしゃくに あつまる', () => {
    const world = createWorld(stage('sand'), PORTRAIT)
    const events = run(world, 240, (w) => setMagnetTarget(w, 30 + ((w.frame * 2) % (w.w - 60)), w.groundY - 2))
    expect(world.sand!.stuck).toBeGreaterThan(10)
    expect(events.some((e) => e.type === 'grains')).toBe(true)
    disposeWorld(world)
  })

  test('うみでは さかなが およぎ、くちの わに じしゃくを ちかづけると つれる', () => {
    const world = createWorld(stage('sea'), PORTRAIT)
    const fish = world.items.find((it) => it.kind.id === 'fish')!
    const x0 = fish.x
    run(world, 120)
    expect(Math.abs(fish.x - x0)).toBeGreaterThan(5)
    const events = run(world, 360, (w) => setMagnetTarget(w, fish.x + (fish.flip ? -20 : 20), fish.y - 6))
    expect(events.some((e) => e.type === 'hooked' && e.id === fish.id)).toBe(true)
    expect(fish.state).toBe('stuck')
    disposeWorld(world)
  })
})

describe('あたらしい ステージの しかけ', () => {
  test('こうじょうでは ベルトに のった ものが みぎへ ながれ、はしまで いくと ひだりの つつから でてくる', () => {
    const world = createWorld(stage('factory'), PORTRAIT)
    // じしゃくは とおくの うえに おいておく。
    const away = (w: World) => setMagnetTarget(w, w.w / 2, w.topLimit)
    const block = world.items.find((it) => it.kind.id === 'block')!
    const x0 = block.x
    run(world, 90, away)
    expect(block.x).toBeGreaterThan(x0 + 30)
    const events = run(world, 60 * 12, away)
    expect(events.some((e) => e.type === 'loop' && e.id === block.id)).toBe(true)
    for (const it of world.items) expect(it.x).toBeLessThan(world.w)
    disposeWorld(world)
  })

  test('こうえんでは ふうせんで とぶ てつに じしゃくを ちかづけると ふうせんが はなれて くっつく', () => {
    const world = createWorld(stage('park'), PORTRAIT)
    const clip = world.items.find((it) => it.kind.id === 'clip')!
    expect(clip.swim?.balloon).not.toBeNull()
    expect(clip.y).toBeLessThan(world.groundY - 40)
    run(world, 60 * 3, (w) => setMagnetTarget(w, w.w / 2, w.topLimit))
    expect(clip.y).toBeLessThan(world.groundY - 40)
    const events = run(world, 240, (w) => setMagnetTarget(w, clip.x, clip.y - 14))
    expect(events.some((e) => e.type === 'balloon' && e.id === clip.id)).toBe(true)
    expect(clip.state).toBe('stuck')
    // くっつかない アヒルは ふうせんで とんだまま。
    const duck = world.items.find((it) => it.kind.id === 'duck')!
    run(world, 240, (w) => setMagnetTarget(w, duck.x, duck.y - 14))
    expect(duck.swim?.balloon).not.toBeNull()
    expect(duck.state).toBe('body')
    disposeWorld(world)
  })
})

describe('チャレンジ', () => {
  test('てつを つなげた だんの かずで せいこうし、いちどだけ しらせる', () => {
    const world = createWorld(stage('desk'), LANDSCAPE)
    const events = run(world, 60 * 40, autoPilot)
    expect(world.maxDepth).toBeGreaterThanOrEqual(3)
    expect(missionProgress(world)).toMatchObject({ goal: 3, done: true })
    expect(events.filter((e) => e.type === 'mission')).toHaveLength(1)
    disposeWorld(world)
  })

  test('さてつの チャレンジは あつめた つぶの かずで すすむ', () => {
    const world = createWorld(stage('sand'), PORTRAIT)
    expect(missionProgress(world)).toMatchObject({ value: 0, done: false })
    const events = run(world, 60 * 12, (w) => setMagnetTarget(w, 30 + Math.abs(((w.frame * 2) % (2 * (w.w - 60))) - (w.w - 60)), w.groundY - 2))
    expect(missionProgress(world).value).toBe(world.sand!.stuck)
    expect(missionProgress(world)).toMatchObject({ goal: 200, done: true })
    expect(events.some((e) => e.type === 'mission')).toBe(true)
    disposeWorld(world)
  })

  test('じかんの チャレンジは まにあえば せいこう、すぎたら しっぱい', () => {
    const fast = createWorld(stage('sea'), PORTRAIT)
    run(fast, 60 * 60, autoPilot)
    expect(fast.phase).toBe('clear')
    expect(missionProgress(fast)).toMatchObject({ done: true, failed: false })
    disposeWorld(fast)
    const slow = createWorld(stage('sea'), PORTRAIT)
    run(slow, 60 * 33, (w) => setMagnetTarget(w, w.w / 2, w.topLimit))
    expect(missionProgress(slow)).toMatchObject({ done: false, failed: true })
    const events = run(slow, 60 * 60, autoPilot)
    expect(slow.phase).toBe('clear')
    expect(missionProgress(slow).done).toBe(false)
    expect(events.some((e) => e.type === 'mission')).toBe(false)
    disposeWorld(slow)
  })
})

describe('がめんを まわす', () => {
  test('よこ むきの せかいへ うつしても、くっついた もの と さてつは じしゃくに のこる', () => {
    const from = createWorld(stage('sand'), PORTRAIT)
    run(from, 60 * 6, autoPilot)
    const stuckIds = from.stuckOrder.map((it) => it.id)
    expect(stuckIds.length).toBeGreaterThan(2)
    const to = createWorld(stage('sand'), LANDSCAPE)
    carryOver(from, to)
    expect(to.stuckOrder.map((it) => it.id).sort()).toEqual([...stuckIds].sort())
    expect(to.sand!.stuck).toBe(from.sand!.stuck)
    expect(drainEvents(to)).toHaveLength(0)
    run(to, 60)
    for (const it of to.stuckOrder) expect(Math.abs(it.x - to.magnet.x)).toBeLessThan(90)
    disposeWorld(from)
    disposeWorld(to)
  })
})

describe('さいごまで あそべる', () => {
  for (const s of STAGES) {
    for (const [label, size] of [['たて', PORTRAIT], ['よこ', LANDSCAPE]] as const) {
      test(`${s.name}（${label}）を おてほんが クリアできる`, () => {
        const world = createWorld(s, size)
        let cleared = false
        for (let i = 0; i < 60 * 90 && !cleared; i++) {
          autoPilot(world)
          stepWorld(world)
          cleared = drainEvents(world).some((e) => e.type === 'clear')
        }
        expect(cleared).toBe(true)
        expect(remainingTargets(world)).toBe(0)
        const result = worldResult(world)
        expect(result.stars).toBeGreaterThanOrEqual(1)
        expect(result.stars).toBeLessThanOrEqual(3)
        expect(result.stuckKinds.every((k) => KINDS[k].magnetic)).toBe(true)
        expect(result.otherKinds.every((k) => !KINDS[k].magnetic)).toBe(true)
        disposeWorld(world)
      })
    }
  }
})
