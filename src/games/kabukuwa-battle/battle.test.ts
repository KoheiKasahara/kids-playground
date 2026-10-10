import { describe, expect, test } from 'vitest'
import { createBattle, drainEvents, DT, READY_SECONDS, runToEnd, stepBattle, strikeChance, TIME_LIMIT, type Battle, type BattleEvent } from './battle'
import { SPECIES, speciesById, type Species } from './species'
import { STAGES, type StageId } from './stages'

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
      expect(end).toEqual({ type: 'end', winner: battle.winner, reason: battle.reason })
      expect(events.filter(e => e.type === 'end')).toHaveLength(1)
    }
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
