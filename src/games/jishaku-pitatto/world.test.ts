import { describe, expect, test } from 'vitest'
import { KINDS } from './items'
import { STAGES, findStage, type StageDef } from './stages'
import {
  MAGNET_CAP, MAGNET_HALF_W, autoPilot, carryOver, createWorld, disposeWorld, drainEvents, fieldAt, floorAt, magnetFull, missionProgress,
  remainingTargets, setMagnetTarget, stepWorld, worldResult, worldSize, type World, type WorldEvent,
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

/** じしゃくを はこの うえへ はこぶ。 */
function toGoal(world: World, frames = 120) {
  return run(world, frames, (w) => setMagnetTarget(w, w.goal.cx, w.goal.top - 30))
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
    // ちかくまで もっていかないと ひっぱらない。
    expect(fieldAt(world, m.x, m.y + 110, out)).toBe(0)
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
    expect(world.maxDepth).toBeGreaterThanOrEqual(2)
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
    run(slow, 60 * 93, (w) => setMagnetTarget(w, w.w / 2, w.topLimit))
    expect(missionProgress(slow)).toMatchObject({ done: false, failed: true })
    const events = run(slow, 60 * 60, autoPilot)
    expect(slow.phase).toBe('clear')
    expect(missionProgress(slow).done).toBe(false)
    expect(events.some((e) => e.type === 'mission')).toBe(false)
    disposeWorld(slow)
  })
})

describe('はこに あつめる', () => {
  test('くっつけた だけでは あつめた ことに ならず、はこの うえで はなすと はこに しまわれる', () => {
    const world = createWorld(stage('desk'), PORTRAIT)
    const clip = world.items.find((it) => it.kind.id === 'clip')!
    const before = remainingTargets(world)
    hoverOver(world, clip.x, clip.y - 12)
    expect(clip.state).toBe('stuck')
    expect(remainingTargets(world)).toBe(before)
    const events = toGoal(world)
    expect(events.some((e) => e.type === 'release')).toBe(true)
    expect(events.some((e) => e.type === 'boxed' && e.id === clip.id)).toBe(true)
    expect(clip.state).toBe('boxed')
    expect(world.stuckOrder).toHaveLength(0)
    expect(remainingTargets(world)).toBeLessThan(before)
    // はこの なかの ものは もう ひっぱらない。
    run(world, 60, (w) => setMagnetTarget(w, w.goal.cx, w.goal.top - 30))
    expect(clip.state).toBe('boxed')
    disposeWorld(world)
  })

  test(`じしゃくが もてるのは ${MAGNET_CAP}こ まで。いっぱいだと ほかの てつは くっつかない`, () => {
    const world = createWorld(stage('desk'), LANDSCAPE)
    const events: WorldEvent[] = []
    for (let i = 0; i < 60 * 30 && !magnetFull(world); i++) {
      // おてほんは いっぱいに なるまで はこへ いかない ように、くっついた ものが あっても てつを さがす。
      const loose = world.items.filter((it) => it.kind.magnetic && it.state === 'body')
      const near = loose.sort((a, b) => Math.abs(a.x - world.magnet.x) - Math.abs(b.x - world.magnet.x))[0]
      if (near) setMagnetTarget(world, near.x, near.y - 6)
      stepWorld(world)
      events.push(...drainEvents(world))
    }
    expect(world.stuckOrder).toHaveLength(MAGNET_CAP)
    expect(events.filter((e) => e.type === 'full')).toHaveLength(1)
    const other = world.items.find((it) => it.kind.magnetic && it.state === 'body')!
    hoverOver(world, other.x, other.y - 8, 120)
    expect(other.state).toBe('body')
    expect(world.stuckOrder).toHaveLength(MAGNET_CAP)
    disposeWorld(world)
  })

  test('はじめの てつを ぜんぶ はこに いれると、つぎの なかまが でてくる', () => {
    for (const s of STAGES) {
      expect(s.items.some((p) => (p.wave ?? 0) > 0 && KINDS[p.kind].magnetic && p.kind !== 'star')).toBe(true)
    }
    const world = createWorld(stage('desk'), PORTRAIT)
    const later = world.items.filter((it) => it.wave > 0)
    expect(later.every((it) => it.state === 'hidden')).toBe(true)
    const events: WorldEvent[] = []
    for (let i = 0; i < 60 * 90 && world.phase === 'play'; i++) {
      autoPilot(world)
      stepWorld(world)
      events.push(...drainEvents(world))
    }
    const wave = events.findIndex((e) => e.type === 'wave')
    const clear = events.findIndex((e) => e.type === 'clear')
    expect(wave).toBeGreaterThanOrEqual(0)
    expect(clear).toBeGreaterThan(wave)
    expect(events.filter((e) => e.type === 'spawn')).toHaveLength(later.length)
    expect(later.filter((it) => it.target).every((it) => it.state === 'boxed')).toBe(true)
    disposeWorld(world)
  })

  test('こうじょうの はこに はいった ものは ベルトで ながされない', () => {
    const world = createWorld(stage('factory'), PORTRAIT)
    const events: WorldEvent[] = []
    for (let i = 0; i < 60 * 30 && !events.some((e) => e.type === 'boxed'); i++) {
      autoPilot(world)
      stepWorld(world)
      events.push(...drainEvents(world))
    }
    const boxed = events.find((e) => e.type === 'boxed')
    expect(boxed).toBeDefined()
    const it = world.items[(boxed as { id: number }).id]
    run(world, 60 * 3, (w) => setMagnetTarget(w, w.w / 2, w.topLimit))
    expect(it.state).toBe('boxed')
    expect(events.some((e) => e.type === 'loop' && e.id === it.id && events.indexOf(e) > events.indexOf(boxed!))).toBe(false)
    disposeWorld(world)
  })
})

describe('がめんを まわす', () => {
  test('よこ むきの せかいへ うつしても、くっついた もの と さてつは じしゃくに のこる', () => {
    const from = createWorld(stage('sand'), PORTRAIT)
    for (let i = 0; i < 60 * 20 && from.stuckOrder.length < 3; i++) run(from, 1, autoPilot)
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

  test('はこに しまった もの と あとから でてきた なかまも うつる', () => {
    const from = createWorld(stage('desk'), PORTRAIT)
    for (let i = 0; i < 60 * 60 && from.wave === 0; i++) run(from, 1, autoPilot)
    run(from, 60 * 3)
    const boxed = from.items.filter((it) => it.state === 'boxed').map((it) => it.id)
    expect(boxed.length).toBeGreaterThan(3)
    const to = createWorld(stage('desk'), LANDSCAPE)
    carryOver(from, to)
    expect(to.wave).toBe(1)
    expect(to.items.filter((it) => it.state === 'boxed').map((it) => it.id)).toEqual(boxed)
    expect(to.items.some((it) => it.state === 'hidden')).toBe(false)
    expect(remainingTargets(to)).toBe(remainingTargets(from))
    for (const id of boxed) {
      const it = to.items[id]
      expect(it.x).toBeGreaterThan(to.goal.x0)
      expect(it.x).toBeLessThan(to.goal.x1)
    }
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
