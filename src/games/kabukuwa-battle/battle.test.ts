import { describe, expect, test } from 'vitest'
import { CLOSE_LOW, COMEBACK_BEHIND, COMEBACK_LOW, contactDistance, createBattle, cutInKind, drainEvents, DT, isComeback, planCutIn, READY_SECONDS, runToEnd, stepBattle, strikeChance, TIME_LIMIT, type Battle, type BattleEvent } from './battle'
import { SPECIES, speciesById, type Species } from './species'
import { STAGES, type StageId } from './stages'
import { moveRepertoire, RUSH_HIT_INTERVAL, strikeDuration, windupDuration, type Technique } from './techniques'

const sp = (id: string) => speciesById(id) as Species

/** さいごまで すすめて、でてきた できごとも あつめる。 */
function play(a: Species, b: Species, stage: StageId, seed: number) {
  const battle = createBattle(a, b, stage, seed)
  const events: BattleEvent[] = []
  for (let i = 0; i < (TIME_LIMIT + READY_SECONDS + 5) * 60 && battle.state !== 'over'; i++) {
    stepBattle(battle)
    events.push(...drainEvents(battle))
  }
  return { battle, events }
}

function winRate(a: Species, b: Species, stage: StageId, games: number) {
  let wins = 0
  for (let seed = 1; seed <= games; seed++) if (runToEnd(createBattle(a, b, stage, seed * 977)).winner === 0) wins++
  return wins / games
}

describe('たたかいの すすみかた', () => {
  test('はっけよい の あいだは うごかず、のこった！ で はじまる', () => {
    const battle = createBattle(sp('kabutomushi'), sp('nokogiri'), 'stump', 1)
    const start = battle.f.map(f => f.u)
    for (let i = 0; i < READY_SECONDS * 60 - 2; i++) stepBattle(battle)
    expect(battle.state).toBe('ready')
    expect(battle.f.map(f => f.u)).toEqual(start)
    for (let i = 0; i < 4; i++) stepBattle(battle)
    expect(battle.state).toBe('fight')
    expect(drainEvents(battle).map(e => e.type)).toEqual(['ready', 'go'])
  })

  test('おなじ たねなら おなじ けっか（くりかえし みても かわらない）', () => {
    const a = runToEnd(createBattle(sp('hercules'), sp('caucasus'), 'log', 42))
    const b = runToEnd(createBattle(sp('hercules'), sp('caucasus'), 'log', 42))
    expect(a.winner).toBe(b.winner)
    expect(a.reason).toBe(b.reason)
    expect(a.time).toBe(b.time)
  })

  test.each(STAGES.map(stage => stage.id))('%s: どの くみあわせでも じかんないに かならず しょうぶが つく', stage => {
    for (const [i, a] of SPECIES.entries()) {
      const b = SPECIES[(i * 5 + 3) % SPECIES.length]
      const { battle, events } = play(a, b, stage, 100 + i)
      expect(battle.state, `${a.id} vs ${b.id}`).toBe('over')
      expect(battle.winner).not.toBeNull()
      expect(battle.time).toBeLessThanOrEqual(TIME_LIMIT + DT)
      const end = events.find(e => e.type === 'end')
      expect(end).toEqual({ type: 'end', winner: battle.winner, reason: battle.reason, cutIn: cutInKind(battle, battle.winner!, battle.reason!) })
      expect(events.filter(e => e.type === 'end')).toHaveLength(1)
    }
  })

  // くみあう きょりの すこし てまえで 2ひきとも とまり、じかんぎれまで うごかなく なった ことが あった。
  test.each([
    ['branch', 'kabutomushi', 'caucasus', 7919],
    ['log', 'elephas', 'ookuwa', 7919 * 3],
    ['stump', 'atlas', 'grantii', 7919 * 6],
  ] as const)('%s: %s と %s が ちかづいた まま とまらない', (stage, a, b, seed) => {
    const battle = createBattle(sp(a), sp(b), stage, seed, STAGES.find(s => s.id === stage)?.startU)
    let quiet = 0, longest = 0
    for (let i = 0; i < (TIME_LIMIT + READY_SECONDS + 5) * 60 && battle.state !== 'over'; i++) {
      stepBattle(battle)
      const happened = drainEvents(battle).length > 0
      if (battle.state !== 'fight') continue
      quiet = happened ? 0 : quiet + DT
      longest = Math.max(longest, quiet)
    }
    expect(longest).toBeLessThan(8)
    expect(battle.reason).not.toBe('judge')
  })

  test('くみあうと ツノ・あごが ぶつかり、わざを だす', () => {
    const { events } = play(sp('caucasus'), sp('atlas'), 'stump', 3)
    const types = new Set(events.map(e => e.type))
    expect(types).toContain('clash')
    expect(types).toContain('windup')
    expect(events.some(e => e.type === 'hit' || e.type === 'block' || e.type === 'dodge')).toBe(true)
  })

  test('しょうぶの あとも かった ほうは うごきつづけ、まけた ほうは おちる か にげる', () => {
    const { battle } = play(sp('hercules'), sp('niji'), 'stump', 9)
    for (let i = 0; i < 180; i++) stepBattle(battle)
    const winner = battle.f[battle.winner!]
    const loser = battle.f[1 - battle.winner!]
    expect(['win', 'thrown', 'flipped', 'stagger']).toContain(winner.state)
    expect(['out', 'fall', 'flee']).toContain(loser.state)
  })
})

describe('ばしょごとの きまりかた', () => {
  function reasons(stage: StageId) {
    const found = new Set<string>()
    for (const [i, a] of SPECIES.entries()) {
      for (let k = 0; k < 4; k++) {
        const b = SPECIES[(i + k * 3 + 1) % SPECIES.length]
        found.add(runToEnd(createBattle(a, b, stage, 500 + i * 13 + k)).reason ?? '')
      }
    }
    return found
  }

  test('えだ: はしが ないので おしだしは なく、なげ・すべって おちる', () => {
    const found = reasons('branch')
    expect(found).not.toContain('push')
    expect(found).toContain('throw')
    expect(found).toContain('slip')
  })

  test('えだ: なげられても しがみついて もどる ことが ある', () => {
    let clung = false
    for (let seed = 1; seed < 40 && !clung; seed++) {
      clung = play(sp('kabutomushi'), sp('grantii'), 'branch', seed).events.some(e => e.type === 'cling')
    }
    expect(clung).toBe(true)
  })

  test.each(['log', 'stump'] as const)('%s: なげる か おしだして、そとへ おとす', stage => {
    const found = reasons(stage)
    expect(found).toContain('push')
    expect(found).toContain('throw')
    expect(found).not.toContain('slip')
  })

  test('はしで こらえると、ちいさな むしでも「うっちゃり」を だす ことが ある', () => {
    let utchari = false
    for (let seed = 1; seed < 60 && !utchari; seed++) {
      utchari = play(sp('niji'), sp('elephas'), 'stump', seed).events.some(e => e.type === 'windup' && e.move === 'utchari' && e.side === 0)
    }
    expect(utchari).toBe(true)
  })
})

describe('つよさ（ずかんの ステータス）', () => {
  test('つよい ほど わざが きまりやすい', () => {
    const big = createBattle(sp('hercules'), sp('niji'), 'stump', 1)
    expect(strikeChance(big.f[0], big.f[1])).toBeGreaterThan(strikeChance(big.f[1], big.f[0]))
  })

  test('大きくて ちからの つよい むしが ほとんど かつ。でも ぜったいでは ない', () => {
    const games = 60
    let upsets = 0
    for (const stage of STAGES) {
      const rate = winRate(sp('hercules'), sp('nokogiri'), stage.id, games)
      expect(rate, stage.id).toBeGreaterThanOrEqual(.75)
      upsets += Math.round((1 - rate) * games)
    }
    // ちいさな むしにも ときどき ぎゃくてんの チャンスが ある。
    expect(upsets).toBeGreaterThan(0)
  })

  test('おなじ むしどうしなら どちらも かつ ことが ある', () => {
    for (const stage of STAGES) {
      const rate = winRate(sp('kabutomushi'), sp('kabutomushi'), stage.id, 40)
      expect(rate, stage.id).toBeGreaterThan(.2)
      expect(rate, stage.id).toBeLessThan(.8)
    }
  })

  test('ライバルの ヘラクレスと コーカサスは いい しょうぶ', () => {
    let wins = 0, games = 0
    for (const stage of STAGES) {
      wins += Math.round(winRate(sp('hercules'), sp('caucasus'), stage.id, 40) * 40)
      games += 40
    }
    expect(wins / games).toBeGreaterThan(.3)
    expect(wins / games).toBeLessThan(.7)
  })
})

describe('その日の ちょうし', () => {
  test('ちょうし（form）は 0.8〜1.2 で、たね ごとに かわる', () => {
    const forms = new Set<number>()
    for (let seed = 1; seed <= 20; seed++) {
      const battle: Battle = createBattle(sp('miyama'), sp('ookuwa'), 'log', seed)
      for (const f of battle.f) {
        expect(f.form).toBeGreaterThanOrEqual(.8)
        expect(f.form).toBeLessThanOrEqual(1.2)
        forms.add(f.form)
      }
    }
    expect(forms.size).toBeGreaterThan(10)
  })
})

describe('ふえた わざの うごき', () => {
  /** まんなかで ためおわる ところから、よけずに あたる おなじ じょうけんで くらべる。 */
  function atStrike(move: Technique, stage: StageId = 'stump') {
    const battle = createBattle(sp('kabutomushi'), sp('kabutomushi'), stage, 91)
    battle.state = 'fight'
    battle.time = 12
    battle.random = () => 0
    const contact = contactDistance(...battle.f)
    for (const f of battle.f) {
      f.u = (f.side === 0 ? -1 : 1) * contact / 2
      f.state = f.side === 0 ? 'windup' : 'clash'
      f.form = 1
      f.wobble = [1, 0, 1, 0]
      f.cd = 100
    }
    battle.f[0].move = move
    battle.f[0].t = windupDuration(battle.f[0].sp, move)
    drainEvents(battle)
    return battle
  }

  test('よこなげは よこへ、かちあげは すくいなげより たかく とばす', () => {
    const scoop = atStrike('scoop'), sweep = atStrike('sweep'), toss = atStrike('toss')
    for (const battle of [scoop, sweep, toss]) {
      stepBattle(battle)
      expect(battle.f[1].state).toBe('thrown')
      expect(battle.f[1].st).toBeLessThan(battle.f[1].maxSt)
      expect(drainEvents(battle)).toEqual([expect.objectContaining({ type: 'hit', side: 0, move: battle.f[0].move })])
    }
    expect(Math.abs(sweep.f[1].vv)).toBeGreaterThan(Math.abs(sweep.f[1].vu))
    expect(toss.f[1].vz).toBeGreaterThan(scoop.f[1].vz * 1.2)
    expect(Math.hypot(toss.f[1].vu, toss.f[1].vv)).toBeLessThan(Math.hypot(scoop.f[1].vu, scoop.f[1].vv))
  })

  test.each(STAGES.map(stage => stage.id))('%s: れんぞくづきは じかんを あけて 3かい おし、さいごが いちばん つよい', stage => {
    const battle = atStrike('rush', stage)
    const hits: { time: number; stamina: number; push: number }[] = []
    const startU = battle.f[1].u
    for (let i = 0; i <= Math.ceil(strikeDuration('rush') / DT); i++) {
      stepBattle(battle)
      for (const event of drainEvents(battle)) {
        if (event.type === 'hit') {
          expect(event.move).toBe('rush')
          expect(battle.f[1].state).toBe('stagger')
          hits.push({ time: battle.time, stamina: battle.f[1].st, push: Math.hypot(battle.f[1].vu, battle.f[1].vv) })
        }
      }
    }
    expect(hits).toHaveLength(3)
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].time - hits[i - 1].time).toBeCloseTo(RUSH_HIT_INTERVAL, 1)
      expect(hits[i].stamina).toBeLessThan(hits[i - 1].stamina)
    }
    expect(hits[2].push).toBeGreaterThan(hits[0].push)
    expect(battle.f[1].u - startU).toBeGreaterThan(10)
    expect(battle.f[0].state).not.toBe('strike')
  })

  test('れんぞくづきは ふせがれたり、あいてが はなれたら つづかない', () => {
    const blocked = atStrike('rush')
    blocked.random = () => .999
    stepBattle(blocked)
    expect(drainEvents(blocked)).toEqual([expect.objectContaining({ type: 'block' })])
    const separated = atStrike('rush')
    stepBattle(separated)
    expect(drainEvents(separated)).toEqual([expect.objectContaining({ type: 'hit' })])
    separated.f[1].u += 60
    for (const battle of [blocked, separated]) {
      for (let i = 0; i < 30; i++) stepBattle(battle)
      expect(drainEvents(battle).some(event => event.type === 'hit')).toBe(false)
    }
  })

  test('れんぞくづきで げんきを つかいきらせたら、にげだす まえの わざで カットインする', () => {
    const make = () => {
      const battle = atStrike('rush')
      battle.f[1].st = 1
      battle.lowest = [.3, 1]
      battle.behind = [.4, 0]
      return battle
    }
    const plan = planCutIn(make())
    expect(plan).toEqual(expect.objectContaining({ kind: 'comeback', winner: 0 }))
    const battle = make()
    let at: BattleEvent[] = []
    for (let step = 1; step <= plan!.step; step++) {
      stepBattle(battle)
      at = drainEvents(battle)
    }
    expect(at).toContainEqual(expect.objectContaining({ type: 'hit', move: 'rush', side: 0 }))
    expect(battle.f[1].st).toBeLessThanOrEqual(0)
    expect(battle.state).toBe('fight')
    runToEnd(battle)
    expect(battle.reason).toBe('flee')
    expect(battle.winner).toBe(0)
  })

  test('たねで わざの えらびかたも きまり、どの むしも 3しゅるいを くりかえさず つかう', () => {
    for (const species of SPECIES) {
      const seen = new Set<Technique>()
      for (const seed of [71, 239, 517, 977]) {
        const a = play(species, species, 'branch', seed)
        const b = play(species, species, 'branch', seed)
        const moves = (events: BattleEvent[]) => events.filter(e => e.type === 'windup')
        expect(moves(a.events)).toEqual(moves(b.events))
        expect(a.battle.state).toBe('over')
        for (const side of [0, 1]) {
          let previous: Technique | null = null
          for (const event of moves(a.events)) {
            if (event.side !== side) continue
            expect(moveRepertoire(species)).toContain(event.move)
            expect(event.move).not.toBe(previous)
            seen.add(event.move)
            previous = event.move
          }
        }
      }
      expect(seen, species.id).toEqual(new Set(moveRepertoire(species)))
    }
  })
})

describe('ぎゃくてん', () => {
  test('げんきで まけていた ほうが かったときだけ。じかんぎれの はんていがちは ふくめない', () => {
    const behind = { lowest: [COMEBACK_LOW, 1] as [number, number], behind: [COMEBACK_BEHIND, 0] as [number, number] }
    expect(isComeback(behind, 0, 'throw')).toBe(true)
    expect(isComeback(behind, 0, 'judge')).toBe(false)
    expect(isComeback(behind, 1, 'throw')).toBe(false)
    expect(isComeback({ lowest: [COMEBACK_LOW + .1, 1], behind: [.5, 0] }, 0, 'push')).toBe(false)
    expect(isComeback({ lowest: [.1, 1], behind: [COMEBACK_BEHIND - .05, 0] }, 0, 'push')).toBe(false)
  })

  test('カットインは ぎゃくてん・せっせんで でて、あっしょうでは でない', () => {
    const base = { lowest: [1, 1] as [number, number], behind: [0, 0] as [number, number] }
    expect(cutInKind({ lowest: [COMEBACK_LOW, 1], behind: [COMEBACK_BEHIND, 0] }, 0, 'throw')).toBe('comeback')
    expect(cutInKind({ lowest: [CLOSE_LOW, 1], behind: [0, 0] }, 0, 'throw')).toBe('close')
    expect(cutInKind({ lowest: [CLOSE_LOW + .05, 1], behind: [0, 0] }, 0, 'throw')).toBeNull()
    expect(cutInKind(base, 0, 'flee')).toBeNull()
    expect(cutInKind({ lowest: [.2, 1], behind: [.5, 0] }, 0, 'judge')).toBeNull()
  })

  test('カットインは ぜんしあいの 15〜25% くらい（まいかい でると うるさい）', () => {
    let games = 0, cutIns = 0
    for (const stage of STAGES) {
      for (const [i, a] of SPECIES.entries()) {
        for (let k = 0; k < 4; k++) {
          const b = SPECIES[(i * 7 + k * 3 + 1) % SPECIES.length]
          const battle = runToEnd(createBattle(a, b, stage.id, 300 + i * 31 + k * 7, stage.startU))
          if (battle.winner === null || battle.reason === null) continue
          games++
          if (cutInKind(battle, battle.winner, battle.reason)) cutIns++
        }
      }
    }
    expect(cutIns / games).toBeGreaterThan(.15)
    expect(cutIns / games).toBeLessThan(.25)
  })

  test('カットインは きめての わざの ところで いれる（とんで いく まえ）', () => {
    let planned = 0, early = 0
    for (const stage of STAGES) {
      for (const [i, a] of SPECIES.entries()) {
        for (let k = 0; k < 2; k++) {
          const b = SPECIES[(i * 7 + k * 3 + 1) % SPECIES.length]
          const seed = 300 + i * 31 + k * 7
          const plan = planCutIn(createBattle(a, b, stage.id, seed, stage.startU))
          const battle = createBattle(a, b, stage.id, seed, stage.startU)
          let step = 0, at: BattleEvent[] = []
          while (battle.state !== 'over' && step < (TIME_LIMIT + READY_SECONDS + 5) * 60) {
            stepBattle(battle)
            const events = drainEvents(battle)
            if (++step === plan?.step) at = events
          }
          const kind = cutInKind(battle, battle.winner!, battle.reason!)
          expect(plan?.kind ?? null, `${stage.id} ${a.id} vs ${b.id}`).toBe(kind)
          if (!plan) continue
          planned++
          expect(plan.winner).toBe(battle.winner)
          expect(plan.step).toBeLessThanOrEqual(step)
          expect(at.some(e => (e.type === 'hit' && e.side === plan.winner) || (e.type === 'fall' && e.side !== plan.winner) || e.type === 'end')).toBe(true)
          if (plan.step < step) early++
        }
      }
    }
    expect(planned).toBeGreaterThan(5)
    // なげで きまる ときは おちる まえ（わざの ところ）に いれる。
    expect(early / planned).toBeGreaterThan(.5)
  })
})
