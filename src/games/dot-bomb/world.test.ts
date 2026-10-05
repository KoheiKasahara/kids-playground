import { describe, expect, test } from 'vitest'
import {
  F_WARP, FIRE_FRAMES, FUSE, MAX_HEARTS, READY_FRAMES, T_FLOOR, T_HARD, T_SOFT, T_WALL, T_WATER, TILE, bombAt, center, hurtsHero, idx, ignite, isHeroFire, placeBombAt, tileAt,
  type World, type WorldEvent,
} from './core'
import { createWorld, dismissAlly, drainEvents, pressBomb, pressSkill, setDir, stageResult, stepWorld, summonAlly } from './world'
import { STAGES, WORLDS, type StageDef } from './stages'

function make(map: string[], extra: Partial<StageDef> = {}): World {
  const stage: StageDef = {
    id: 'test', world: 'forest', no: 't', name: 'てすと', map, enemies: { a: 'puni', b: 'tentou' }, density: 0, items: {}, egg: null,
    start: { bombs: 1, fire: 2 }, ...extra,
  }
  const w = createWorld(stage)
  for (let i = 0; i < READY_FRAMES; i++) stepWorld(w)
  expect(w.state).toBe('play')
  return w
}

function run(w: World, frames: number, events: WorldEvent[] = []) {
  for (let i = 0; i < frames; i++) {
    stepWorld(w)
    events.push(...drainEvents(w))
  }
  return events
}

const OPEN = [
  '#########',
  '#P......#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#########',
]

describe('dot-bomb の ステージ', () => {
  test('どの ステージも かこまれた ちず で、とびら・てき・スタートが ある', () => {
    expect(STAGES.length).toBe(15)
    expect(new Set(STAGES.map(s => s.id)).size).toBe(STAGES.length)
    for (const world of WORLDS) expect(STAGES.filter(s => s.world === world.id)).toHaveLength(3)
    for (const stage of STAGES) {
      const rows = stage.map
      expect(rows.every(r => r.length === rows[0].length), stage.id).toBe(true)
      expect(rows[0]).toMatch(/^#+$/)
      expect(rows[rows.length - 1]).toMatch(/^#+$/)
      for (const r of rows) expect(r[0] + r[r.length - 1], stage.id).toBe('##')
      const text = rows.join('')
      expect(text.split('P').length - 1, stage.id).toBe(1)
      if (stage.boss) {
        expect(text.split('B').length - 1, stage.id).toBe(1)
        expect(text.includes('D'), stage.id).toBe(false)
      } else {
        expect(text.split('D').length - 1, stage.id).toBe(1)
        const w = createWorld(stage)
        expect(w.enemies.length, stage.id).toBeGreaterThanOrEqual(3)
      }
      // ワープつぼは かならず 2こ ずつ。
      for (const n of '123456789') {
        const count = text.split(n).length - 1
        expect(count === 0 || count === 2, `${stage.id} warp ${n}`).toBe(true)
      }
    }
  })

  test('スタートの まわりに にげばしょが あり、とびらと てきへ みちが つながっている', () => {
    for (const stage of STAGES) {
      const w = createWorld(stage)
      const [sx, sy] = [Math.floor(w.hero.x / TILE), Math.floor(w.hero.y / TILE)]
      // ブロックは こわせるので とおれる ものと して、こわれない かべ・みずだけで つながりを しらべる。
      const seen = new Set([idx(w, sx, sy)])
      const queue = [[sx, sy]]
      while (queue.length) {
        const [x, y] = queue.shift()!
        const here = idx(w, x, y)
        const next: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
        if (w.floor[here] === F_WARP) {
          const to = w.warps.get(here)!
          next.push([to % w.cols, Math.floor(to / w.cols)])
        }
        for (const [nx, ny] of next) {
          const t = tileAt(w, nx, ny)
          if (t === T_WALL || t === T_HARD || t === T_WATER || seen.has(idx(w, nx, ny))) continue
          seen.add(idx(w, nx, ny))
          queue.push([nx, ny])
        }
      }
      if (w.door) expect(seen.has(idx(w, w.door.tx, w.door.ty)), `${stage.id} door`).toBe(true)
      for (const e of w.enemies) expect(seen.has(idx(w, e.fx, e.fy)), `${stage.id} enemy`).toBe(true)
      // さいしょの ボンから にげられる よう、スタートの となりと その さきが あいている。
      const open = (x: number, y: number) => tileAt(w, x, y) === T_FLOOR
      expect(open(sx + 1, sy) || open(sx, sy + 1), stage.id).toBe(true)
      expect((open(sx + 1, sy) && open(sx + 2, sy)) || (open(sx, sy + 1) && open(sx, sy + 2)) || (open(sx + 1, sy) && open(sx + 1, sy + 1)) || (open(sx, sy + 1) && open(sx + 1, sy + 1)), stage.id).toBe(true)
      for (const e of w.enemies) expect(Math.abs(e.fx - sx) + Math.abs(e.fy - sy), `${stage.id} enemy near start`).toBeGreaterThanOrEqual(5)
    }
  })

  test('ブロックの なかに たまご・ほしの かけら・アイテムが かくれている', () => {
    for (const stage of STAGES) {
      const w = createWorld(stage)
      const hidden = w.hidden.filter(Boolean)
      expect(hidden.some(h => h?.kind === 'star'), stage.id).toBe(true)
      if (stage.egg) expect(hidden.some(h => h?.kind === 'egg' && h.color === stage.egg), stage.id).toBe(true)
      w.hidden.forEach((h, i) => { if (h) expect(w.tiles[i], stage.id).toBe(T_SOFT) })
    }
  })

  test('おなじ ステージは いつも おなじ ならびに なる', () => {
    const a = createWorld(STAGES[0]), b = createWorld(STAGES[0])
    expect([...a.tiles]).toEqual([...b.tiles])
  })
})

describe('dot-bomb の うごき', () => {
  test('よーい の あいだは うごかず、どん で はじまる', () => {
    const w = createWorld(STAGES[0])
    const events = run(w, READY_FRAMES - 1)
    expect(w.state).toBe('ready')
    pressBomb(w)
    expect(w.input.bomb).toBe(0)
    run(w, 2, events)
    expect(events.some(e => e.type === 'go')).toBe(true)
    expect(w.state).toBe('play')
  })

  test('あるいて すすみ、はしらの かどに ずれて ぶつかっても よこに よって とおれる', () => {
    const w = make([
      '#######',
      '#P....#',
      '#.H.H.#',
      '#.....#',
      '#######',
    ])
    setDir(w, 1)
    run(w, 20)
    expect(w.hero.x).toBeGreaterThan(center(2))
    // ちょうど まがりかどより すこし ずれた ところで したを おす。
    w.hero.x = center(3) - 6
    w.hero.y = center(1)
    setDir(w, 2)
    run(w, 40)
    expect(w.hero.x).toBe(center(3))
    expect(w.hero.y).toBeGreaterThan(center(2))
  })

  test('ボンは 1つずつ おけて、いまの マスからは にげられるが、もどれない', () => {
    const w = make(OPEN)
    pressBomb(w)
    run(w, 1)
    expect(w.bombs).toHaveLength(1)
    pressBomb(w)
    run(w, 1)
    expect(w.bombs).toHaveLength(1)
    setDir(w, 1)
    run(w, 30)
    expect(w.hero.x).toBeGreaterThan(center(2))
    setDir(w, 3)
    run(w, 40)
    expect(w.hero.x).toBeGreaterThanOrEqual(center(2) - 1)
  })

  test('ボンは じかんで ばくはつし、ひは はしらで とまり、ブロックを こわして アイテムを だす', () => {
    const w = make([
      '#########',
      '#P.s.H..#',
      '#.......#',
      '#########',
    ], { start: { bombs: 1, fire: 3 } })
    w.hidden[idx(w, 3, 1)] = { kind: 'fire' }
    w.hero.x = center(4)
    pressBomb(w)
    run(w, 1)
    w.hero.x = center(4)
    w.hero.y = center(2)
    w.hero.inv = 999
    const events = run(w, FUSE + 2)
    expect(events.some(e => e.type === 'boom')).toBe(true)
    expect(w.fire[idx(w, 4, 1)]).toBeGreaterThan(0)
    expect(w.fire[idx(w, 6, 1)]).toBe(0) // はしらの むこうには とどかない
    expect(w.tiles[idx(w, 3, 1)]).toBe(T_SOFT)
    run(w, 30, events)
    expect(w.tiles[idx(w, 3, 1)]).toBe(T_FLOOR)
    expect(events.some(e => e.type === 'reveal' && e.kind === 'fire')).toBe(true)
    // アイテムを ひろうと ひが のびる。
    w.hero.x = center(3)
    w.hero.y = center(1)
    run(w, 2, events)
    expect(w.hero.fire).toBe(4)
    expect(events.some(e => e.type === 'item' && e.kind === 'fire')).toBe(true)
  })

  test('ひが ほかの ボンに とどくと つぎつぎ ばくはつする', () => {
    const w = make(OPEN, { start: { bombs: 3, fire: 2 } })
    w.hero.inv = 9999
    for (const x of [2, 4, 6]) { w.hero.x = center(x); pressBomb(w); run(w, 1) }
    expect(w.bombs).toHaveLength(3)
    w.bombs[1].fuse = 900
    w.bombs[2].fuse = 900
    w.bombs[0].fuse = 1
    run(w, 30)
    expect(w.bombs).toHaveLength(0)
  })

  test('じぶんの ひに あたると ハートが へり、ぜんぶ なくなると ミス', () => {
    const w = make(OPEN)
    pressBomb(w)
    const events = run(w, FUSE + 5)
    expect(w.hero.hearts).toBe(2)
    expect(events.some(e => e.type === 'hurt')).toBe(true)
    expect(w.hero.inv).toBeGreaterThan(0)
    w.hero.hearts = 1
    w.hero.inv = 0
    pressBomb(w)
    run(w, FUSE + 5, events)
    expect(w.state).toBe('miss')
    run(w, 130, events)
    expect(events.some(e => e.type === 'missDone')).toBe(true)
    expect(stageResult(w).noDamage).toBe(false)
  })
})

describe('dot-bomb の ピョンタ', () => {
  function ride(color: StageDef['egg'], map = OPEN) {
    const w = make(map, { start: { bombs: 3, fire: 2 } })
    w.items.push({ id: 99, tx: 2, ty: 1, kind: 'egg', color: color ?? 'green', age: 0 })
    setDir(w, 1)
    const events = run(w, 16)
    setDir(w, null)
    run(w, 40, events)
    expect(events.some(e => e.type === 'hatch')).toBe(true)
    expect(w.hero.ride).toBe(color)
    return w
  }

  test('たまごを ひろうと ピョンタが うまれて のれる。あたっても ピョンタが みがわりに なる', () => {
    const w = ride('green')
    const hearts = w.hero.hearts
    w.enemies.length = 0
    w.hero.inv = 0
    pressBomb(w)
    const events = run(w, FUSE + 4)
    expect(w.hero.ride).toBeNull()
    expect(w.hero.hearts).toBe(hearts)
    expect(events.some(e => e.type === 'dismount')).toBe(true)
    expect(w.runaways).toHaveLength(1)
  })

  test('みどりピョンタの ダッシュで びゅーんと すすみ、てきを たおす', () => {
    const w = ride('green')
    w.hero.dir = 1
    w.enemies.length = 0
    w.enemies.push({ id: 7, kind: 'puni', x: center(5), y: center(1), fx: 5, fy: 1, tx: 5, ty: 1, dir: 0, hp: 1, inv: 0, speed: 0, behave: 'wander', flying: false, dead: 0, wait: 999, stun: 0, age: 0 })
    pressSkill(w)
    const events = run(w, 20)
    expect(events.some(e => e.type === 'skill' && e.skill === 'dash')).toBe(true)
    expect(w.hero.x).toBeGreaterThan(center(5))
    expect(events.some(e => e.type === 'enemyHit' && e.dead)).toBe(true)
  })

  test('あおピョンタは ボンを けとばして すべらせる', () => {
    const w = ride('blue')
    w.hero.x = center(2)
    pressBomb(w)
    run(w, 1)
    setDir(w, 3)
    run(w, 14)
    setDir(w, 1)
    run(w, 3)
    setDir(w, null)
    w.hero.dir = 1
    pressSkill(w)
    run(w, 40)
    const b = w.bombs[0]
    expect(b.tx).toBe(7)
    expect(b.slide).toBeNull()
  })

  test('ピンクピョンタは ブロックを とびこえる', () => {
    const w = ride('pink', [
      '#########',
      '#P..s...#',
      '#.......#',
      '#########',
    ])
    w.hero.x = center(3)
    w.hero.y = center(1)
    w.hero.dir = 1
    pressSkill(w)
    const events = run(w, 34)
    expect(Math.round(w.hero.x)).toBe(center(5))
    expect(events.some(e => e.type === 'land')).toBe(true)
  })

  test('きいろピョンタは ボンを まっすぐ ならべて おく', () => {
    const w = ride('yellow')
    w.hero.x = center(2)
    w.hero.dir = 1
    pressSkill(w)
    run(w, 2)
    expect(w.bombs.map(b => b.tx)).toEqual([2, 3, 4])
  })
})

describe('dot-bomb の てき・とびら・ボス', () => {
  test('てきは ひで たおれ、ぜんぶ たおすと とびらが ひらき、はいると クリア', () => {
    const w = make([
      '#########',
      '#P.....D#',
      '#.......#',
      '#.....a.#',
      '#########',
    ])
    expect(w.enemies).toHaveLength(1)
    const e = w.enemies[0]
    e.wait = 9999
    w.hero.x = center(6)
    w.hero.y = center(1)
    pressBomb(w)
    run(w, 1)
    w.hero.x = center(3)
    w.hero.inv = 9999
    const events = run(w, FUSE + 3)
    expect(events.some(ev => ev.type === 'enemyHit' && ev.dead)).toBe(true)
    run(w, 60, events)
    expect(events.some(ev => ev.type === 'doorOpen')).toBe(true)
    expect(w.door?.open).toBe(true)
    setDir(w, 1)
    run(w, 80, events)
    expect(w.state).toBe('clear')
    run(w, 160, events)
    expect(events.some(ev => ev.type === 'done')).toBe(true)
    expect(stageResult(w).stars).toBe(2)
  })

  test('てきに さわると いたい', () => {
    const w = make(OPEN)
    w.enemies.push({ id: 5, kind: 'puni', x: center(1) + 8, y: center(1), fx: 2, fy: 1, tx: 2, ty: 1, dir: 0, hp: 1, inv: 0, speed: .4, behave: 'wander', flying: false, dead: 0, wait: 999, stun: 0, age: 0 })
    run(w, 4)
    expect(w.hero.hearts).toBe(2)
  })

  test('ボスは ポンの ひで いたがり、たおすと きんの たまごが でて ひろうと クリア', () => {
    const stage = STAGES.find(s => s.boss === 'puni')!
    const w = createWorld(stage)
    run(w, READY_FRAMES + 1)
    const boss = w.boss!
    expect(boss.hp).toBe(5)
    w.hero.inv = 99999
    let guard = 0
    const events: WorldEvent[] = []
    while (w.boss && w.boss.dead === 0 && guard++ < 40) {
      boss.state = 'rest'
      boss.t = 0
      boss.z = 0
      boss.inv = 0
      const bx = Math.floor(boss.x / TILE), by = Math.floor(boss.y / TILE)
      w.tiles[idx(w, bx, by)] = T_FLOOR
      w.bombs.length = 0
      w.bombs.push({ id: 900 + guard, tx: bx, ty: by, off: 0, slide: null, speed: 0, belt: false, kicked: false, fuse: 1, range: 1, owner: 'hero', chain: -1, age: 0 })
      run(w, 3, events)
      run(w, 75, events)
    }
    expect(events.filter(e => e.type === 'bossHit')).toHaveLength(5)
    expect(events.some(e => e.type === 'bossDown')).toBe(true)
    run(w, 160, events)
    const gold = w.items.find(i => i.kind === 'gold')!
    expect(gold).toBeDefined()
    w.hero.x = center(gold.tx)
    w.hero.y = center(gold.ty)
    run(w, 2, events)
    expect(w.state).toBe('clear')
  })

  test('ボスの ひでは ボスは いたがらない', () => {
    const stage = STAGES.find(s => s.boss === 'king')!
    const w = createWorld(stage)
    run(w, READY_FRAMES + 1)
    const boss = w.boss!
    boss.state = 'walk'
    const bx = Math.floor(boss.x / TILE), by = Math.floor(boss.y / TILE)
    w.bombs.push({ id: 1, tx: bx, ty: by, off: 0, slide: null, speed: 0, belt: false, kicked: false, fuse: 1, range: 1, owner: 'boss', chain: -1, age: 0 })
    run(w, 6)
    expect(boss.hp).toBe(boss.maxHp)
  })

  test.each(['puni', 'worm', 'penguin', 'dragon', 'king'] as const)('%s の ボスは しばらく たたかっても こわれない', kind => {
    const stage = STAGES.find(s => s.boss === kind)!
    const w = createWorld(stage)
    w.hero.inv = 1e9
    const events = run(w, READY_FRAMES + 60 * 40)
    expect(w.state).toBe('play')
    expect(events.some(e => e.type === 'bossAct')).toBe(true)
    expect(Number.isFinite(w.boss!.x) && Number.isFinite(w.boss!.y)).toBe(true)
  })
})

describe('dot-bomb の しかけ', () => {
  test('こおりの うえでは てを はなしても すこし すべる', () => {
    const w = make([
      '#########',
      '#PIIIIII#',
      '#.......#',
      '#########',
    ])
    setDir(w, 1)
    run(w, 12)
    const x = w.hero.x
    setDir(w, null)
    run(w, 20)
    expect(w.hero.x).toBeGreaterThan(x + 8)
  })

  test('ベルトコンベアは ポンと ボンを はこぶ', () => {
    const w = make([
      '#########',
      '#P>>>>..#',
      '#.......#',
      '#########',
    ])
    w.hero.x = center(2)
    run(w, 30)
    expect(w.hero.x).toBeGreaterThan(center(2) + 10)
    w.hero.x = center(1)
    w.hero.y = center(2)
    w.bombs.push({ id: 3, tx: 2, ty: 1, off: 0, slide: null, speed: 0, belt: false, kicked: false, fuse: 999, range: 1, owner: 'hero', chain: -1, age: 0 })
    run(w, 120)
    expect(w.bombs[0].tx).toBe(6)
  })

  test('ワープつぼに のると もう ひとつの つぼへ とぶ', () => {
    const w = make([
      '#########',
      '#P1....1#',
      '#.......#',
      '#########',
    ])
    setDir(w, 1)
    const events = run(w, 18)
    expect(events.some(e => e.type === 'warp')).toBe(true)
    expect(Math.floor(w.hero.x / TILE)).toBeGreaterThanOrEqual(6)
  })

  test('ひの あなは ときどき ひを ふきだす', () => {
    const w = make([
      '#########',
      '#P.....o#',
      '#.......#',
      '#########',
    ])
    const events = run(w, 400)
    expect(events.some(e => e.type === 'ventWarn')).toBe(true)
    expect(events.some(e => e.type === 'boom' && e.owner === 'vent')).toBe(true)
  })

  test('みずは あるけないが、ひは とおる', () => {
    const w = make([
      '#########',
      '#P~.....#',
      '#.......#',
      '#########',
    ])
    setDir(w, 1)
    run(w, 30)
    expect(w.hero.x).toBeLessThanOrEqual(center(1) + 1)
    setDir(w, null)
    pressBomb(w)
    run(w, 1)
    w.hero.inv = 999
    run(w, FUSE + 1)
    expect(w.fire[idx(w, 3, 1)]).toBeGreaterThan(0)
  })

  test('ハートは さいだいまで', () => {
    const w = make(OPEN)
    w.hero.hearts = MAX_HEARTS
    w.items.push({ id: 1, tx: 1, ty: 1, kind: 'heart', age: 0 })
    run(w, 2)
    expect(w.hero.hearts).toBe(MAX_HEARTS)
    expect(bombAt(w, 1, 1)).toBeUndefined()
    expect(FIRE_FRAMES).toBeGreaterThan(0)
  })
})

describe('dot-bomb の なかま', () => {
  const FIELD = [
    '###########',
    '#P........#',
    '#.........#',
    '#.......a.#',
    '###########',
  ]

  test('よぶと ポンの そばに でて、かえすと いなくなる', () => {
    const w = make(FIELD)
    const events = run(w, 0)
    summonAlly(w)
    expect(w.ally).not.toBeNull()
    expect(Math.abs(Math.floor(w.ally!.x / TILE) - 1) + Math.abs(Math.floor(w.ally!.y / TILE) - 1)).toBeLessThanOrEqual(1)
    dismissAlly(w)
    run(w, 1, events)
    expect(w.ally).toBeNull()
    expect(events.map(e => e.type)).toEqual(expect.arrayContaining(['allyIn', 'allyOut']))
  })

  test('なかまの ひは てきを たおすが、ポンは いたくなく、アイテムも きえず、なかまも へいき', () => {
    const w = make(OPEN)
    summonAlly(w)
    w.ally!.cool = 9999
    w.enemies.push({ id: 5, kind: 'puni', x: center(3), y: center(1), fx: 3, fy: 1, tx: 3, ty: 1, dir: 0, hp: 1, inv: 0, speed: .4, behave: 'wander', flying: false, dead: 0, wait: 9999, stun: 0, age: 0 })
    w.items.push({ id: 7, tx: 2, ty: 1, kind: 'fire', age: 0 })
    w.items.push({ id: 8, tx: 1, ty: 2, kind: 'heart', age: 0 })
    w.ally!.x = center(1); w.ally!.y = center(2); w.ally!.tx = 1; w.ally!.ty = 2
    placeBombAt(w, 1, 1, 2, 'ally', 1)
    run(w, 6)
    expect(w.stats.defeated).toBe(1)
    expect(w.hero.hearts).toBe(3)
    expect(w.stats.damage).toBe(0)
    expect(w.items.map(i => i.id).sort()).toEqual([7, 8])
    expect(w.ally).not.toBeNull()
  })

  test('ポンは なかまの ボンを すりぬけられるが、じぶんの ボンは とおれない', () => {
    const w = make(OPEN)
    run(w, 0)
    placeBombAt(w, 2, 1, 2, 'ally', 9999)
    setDir(w, 1)
    run(w, 30)
    expect(Math.floor(w.hero.x / TILE)).toBeGreaterThanOrEqual(3)

    const w2 = make(OPEN)
    run(w2, 0)
    placeBombAt(w2, 2, 1, 2, 'hero', 9999)
    setDir(w2, 1)
    run(w2, 30)
    expect(Math.floor(w2.hero.x / TILE)).toBe(1)
  })

  test('なかまの ひは ポンの ボンに うつらないが、ポンの ひは なかまの ボンに うつる', () => {
    const w = make(OPEN)
    placeBombAt(w, 3, 3, 2, 'ally', 1)
    const hero = placeBombAt(w, 5, 3, 2, 'hero', 9999)!
    run(w, 10)
    expect(w.bombs).toContain(hero)
    expect(hero.chain).toBe(-1)

    const w2 = make(OPEN)
    placeBombAt(w2, 3, 3, 2, 'hero', 1)
    placeBombAt(w2, 5, 3, 2, 'ally', 9999)
    run(w2, 10)
    expect(w2.bombs).toHaveLength(0)
  })

  test('なかまの ひに あぶない ひが かさなると、ポンは いたい', () => {
    const w = make(OPEN)
    ignite(w, 3, 2, 'ally')
    expect(hurtsHero(w, 3, 2)).toBe(false)
    expect(isHeroFire(w, 3, 2)).toBe(true)
    ignite(w, 3, 2, 'vent')
    expect(hurtsHero(w, 3, 2)).toBe(true)
  })

  test('なかまは じぶんで てきを さがして ボンで たおす', () => {
    const w = make(FIELD)
    w.enemies[0].wait = 99999
    summonAlly(w)
    const events: WorldEvent[] = []
    for (let i = 0; i < 1200 && w.stats.defeated === 0; i++) run(w, 1, events)
    expect(events.some(e => e.type === 'allyBomb')).toBe(true)
    expect(w.stats.defeated).toBe(1)
    expect(w.stats.damage).toBe(0)
  })

  test('とじこめられても なかまが ブロックを こわして みちを ひらく', () => {
    const w = make([
      '#########',
      '#P.s....#',
      '#..s..a.#',
      '#sss....#',
      '#########',
    ])
    w.enemies[0].wait = 99999
    summonAlly(w)
    const events: WorldEvent[] = []
    for (let i = 0; i < 2400 && w.stats.defeated === 0; i++) run(w, 1, events)
    expect(events.some(e => e.type === 'break')).toBe(true)
    expect(w.stats.defeated).toBe(1)
  })
})
