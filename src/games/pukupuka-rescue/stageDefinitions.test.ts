import { describe, expect, test } from 'vitest'
import {
  applyWave,
  createInitialState,
  friendIdsOf,
  getFloater,
  leaderAtGoal,
  leaderIdOf,
  stepGame,
  toggleBoard,
  toggleDrain,
  toggleGate,
  triggerWhale,
  type PukupukaGameState,
} from './pukupukaGame'
import { findPukupukaStage, PUKUPUKA_STAGES } from './stageDefinitions'
import { rectContainsPoint, type StageDefinition } from './types'

function run(stage: StageDefinition, state: PukupukaGameState, seconds: number, fill = false) {
  for (let i = 0; i < Math.round(seconds * 60); i++) state = stepGame(stage, state, 1000 / 60, fill ? 'fill' : null).state
  return state
}

function stageById(id: string): StageDefinition {
  const stage = findPukupukaStage(id)
  if (!stage) throw new Error(`${id} がありません`)
  return stage
}

type Step = ['fill' | 'wait', number] | ['drain' | 'gate' | 'board' | 'whale']

/** 子どもが押す順番どおりの手順。どの面も、仕掛けを1つずつ使えば全員を連れて帰れる。 */
const SOLUTIONS: Record<string, Step[]> = {
  'water-rise': [['fill', 8]],
  'land-on-platform': [['fill', 8], ['drain'], ['wait', 10]],
  'ring-the-bell': [['fill', 8], ['drain'], ['wait', 10]],
  'open-the-gate': [['fill', 8], ['gate'], ['fill', 10], ['drain'], ['wait', 12]],
  'whale-jump': [['fill', 8], ['whale'], ['wait', 5]],
  'change-the-flow': [['fill', 6], ['board'], ['wait', 6], ['board'], ['wait', 6]],
  'twisty-slide': [['fill', 8], ['wait', 5]],
  'long-waterway': [['fill', 8], ['gate'], ['wait', 6], ['fill', 8], ['drain'], ['wait', 12]],
}

function play(stage: StageDefinition, steps: readonly Step[], initial = createInitialState(stage)) {
  let state = initial
  for (const step of steps) {
    if (step[0] === 'fill' || step[0] === 'wait') state = run(stage, state, step[1], step[0] === 'fill')
    else if (step[0] === 'drain') state = toggleDrain(state)
    else if (step[0] === 'gate') state = toggleGate(state)
    else if (step[0] === 'board') state = toggleBoard(state)
    else state = triggerWhale(stage, state)
  }
  return state
}

function insideSolid(stage: StageDefinition, x: number, y: number) {
  return stage.solids.some((s) => x > s.x && x < s.x + s.width && y > s.y && y < s.y + s.height)
}

describe('救助パークの配置', () => {
  test('8面すべてに違う仕掛けがあり、IDは重複しない', () => {
    expect(PUKUPUKA_STAGES).toHaveLength(8)
    expect(new Set(PUKUPUKA_STAGES.map((s) => s.id)).size).toBe(8)
    // 面ごとに主役の仕掛けが変わり、同じ組み合わせの面を続けない。
    const signature = (s: StageDefinition) =>
      [s.gate && 'gate', s.board && 'board', s.bells?.length && 'bell', s.whale && 'whale', s.slide && 'slide',
        s.goal.requiresLanding && 'landing'].filter(Boolean).join('+')
    for (let i = 1; i < PUKUPUKA_STAGES.length; i++) {
      expect(signature(PUKUPUKA_STAGES[i])).not.toBe(signature(PUKUPUKA_STAGES[i - 1]))
    }
    expect(PUKUPUKA_STAGES.some((s) => s.bells?.length && s.doors?.length)).toBe(true)
    expect(PUKUPUKA_STAGES.some((s) => s.whale)).toBe(true)
    expect(PUKUPUKA_STAGES.some((s) => s.slide)).toBe(true)
  })

  test('蛇口は壁付け、栓は露出した床か壁の内面にあり、全操作が全景に収まる', () => {
    for (const stage of PUKUPUKA_STAGES) {
      expect(stage.viewportWidth ?? stage.width).toBe(stage.width)
      const faucet = stage.faucet!
      expect(stage.solids.some((s) => s.x + s.width === faucet.x - 8 && faucet.y > s.y && faucet.y < s.y + s.height)).toBe(true)
      const drain = stage.drain!
      const water = stage.waterBodies.find((b) => b.id === drain.sourceBodyId)!
      expect(water).toBeDefined()
      expect(drain.x).toBeGreaterThanOrEqual(water.left)
      expect(drain.x).toBeLessThanOrEqual(water.right)
      const insideX = drain.x + (drain.orientation === 'left-wall' ? 0.1 : drain.orientation === 'right-wall' ? -0.1 : 0)
      const insideY = drain.y - (drain.orientation && drain.orientation !== 'floor' ? 0 : 0.1)
      expect(insideSolid(stage, insideX, insideY)).toBe(false)
    }
  })

  test('隊長はアヒル1羽で、仲間はみんな足場の上から始まり、固定物に埋まっていない', () => {
    for (const stage of PUKUPUKA_STAGES) {
      expect(stage.floaters.filter((f) => f.kind === 'duck')).toHaveLength(1)
      expect(stage.goal.floaterIds).toContain(leaderIdOf(stage))
      expect(friendIdsOf(stage).length).toBeGreaterThan(0)
      for (const f of stage.floaters) {
        expect(stage.goal.floaterIds).toContain(f.id)
        expect(insideSolid(stage, f.startX, f.startY)).toBe(false)
      }
    }
  })

  test('星は最初から誰かに重なっておらず、はじめの状態では1つも拾われない', () => {
    for (const stage of PUKUPUKA_STAGES) {
      expect(stage.stars).toHaveLength(3)
      for (const star of stage.stars ?? []) {
        for (const f of stage.floaters) {
          expect(Math.hypot(f.startX - star.x, f.startY - star.y)).toBeGreaterThan(f.radius + 4)
        }
      }
      expect(run(stage, createInitialState(stage), 1).collectedStarIds).toEqual([])
    }
  })

  test('待っている仲間は、隊長が来るまで足場から流されない', () => {
    for (const stage of PUKUPUKA_STAGES) {
      const idle = run(stage, createInitialState(stage), 10)
      for (const id of friendIdsOf(stage)) {
        const definition = stage.floaters.find((f) => f.id === id)!
        const friend = getFloater(idle, id)!
        expect(friend.x).toBeCloseTo(definition.startX, 5)
      }
    }
  })
})

describe('全ステージの攻略と操作の必要性', () => {
  test.each(PUKUPUKA_STAGES)('$id は放置では終わらず、手順どおりに仕掛けを使うと全員を連れて帰れる', (stage) => {
    const idle = run(stage, createInitialState(stage), 20)
    expect(idle.phase).toBe('playing')
    expect(idle.rescuedIds).toEqual([])

    const solved = play(stage, SOLUTIONS[stage.id])
    expect(solved.phase).toBe('cleared')
    expect([...solved.rescuedIds].sort()).toEqual([...friendIdsOf(stage)].sort())
    expect(run(stage, solved, 2).rescuedIds).toEqual(solved.rescuedIds)
    // 解いたときには星もいくつか拾える（全部そろえるのは寄り道が必要な面もある）。
    expect(solved.collectedStarIds.length).toBeGreaterThan(0)
  })

  test.each(PUKUPUKA_STAGES)('$id は仲間を全員連れていないと、隊長だけでゴールしてもクリアにならない', (stage) => {
    const solved = play(stage, SOLUTIONS[stage.id])
    const leader = getFloater(solved, leaderIdOf(stage))!
    const alone = { ...solved, phase: 'playing' as const, rescuedIds: solved.rescuedIds.slice(1) }
    const result = stepGame(stage, alone, 1000 / 60)
    expect(result.goalReached).toBe(false)
    expect(result.state.phase).toBe('playing')
    expect(rectContainsPoint(stage.goal.area, leader.x, leader.y)).toBe(true)
  })

  test('さんばしの面は、満水で流すだけでは着地できない', () => {
    for (const id of ['land-on-platform', 'open-the-gate', 'long-waterway']) {
      const stage = stageById(id)
      let state = createInitialState(stage)
      if (stage.gate) state = toggleGate(state)
      expect(run(stage, state, 25, true).phase).toBe('playing')
    }
  })

  test('水門の面は、閉めたままでは右の島のくまを迎えられない', () => {
    const stage = stageById('open-the-gate')
    let state = run(stage, createInitialState(stage), 10, true)
    state = run(stage, toggleDrain(state), 12)
    expect(state.rescuedIds).not.toContain('ringBear')
    expect(getFloater(state, 'duck')!.x).toBeLessThan(stage.gate!.x)
  })

  test('ベルを鳴らすまでは、さくの向こうへ行けない', () => {
    const stage = stageById('ring-the-bell')
    // ベルに届かない高さまでしか水を入れずに排水すると、さくの手前で止まる。
    let state = run(stage, createInitialState(stage), 3.2, true)
    expect(state.rungBellIds).toEqual([])
    state = run(stage, toggleDrain(state), 10)
    expect(getFloater(state, 'duck')!.x).toBeLessThan(stage.doors![0].x)
    expect(state.doorLifts.fence).toBe(0)
    // ベルを鳴らせば、同じ排水でさくをくぐってゴールできる。
    state = run(stage, toggleDrain(state), 8, true)
    expect(state.rungBellIds).toEqual(['bell'])
    state = run(stage, toggleDrain(state), 10)
    expect(state.doorLifts.fence).toBe(1)
    expect(state.phase).toBe('cleared')
  })

  test('くじらは水が少ないと高さが足りず、落ちてもどってやり直せる', () => {
    const stage = stageById('whale-jump')
    let state = run(stage, createInitialState(stage), 2.2, true)
    const duckBefore = getFloater(state, 'duck')!
    expect(Math.abs(duckBefore.x - stage.whale!.x)).toBeLessThanOrEqual(stage.whale!.halfWidth)
    state = run(stage, triggerWhale(stage, state), 4)
    expect(getFloater(state, 'duck')!.x).toBeLessThan(44)
    expect(state.rescuedIds).not.toContain('penguin')
    // 水をいっぱいにしてから吹けば、かべをこえてペンギンと一緒にゴールの池へ。
    state = run(stage, state, 6, true)
    state = run(stage, triggerWhale(stage, state), 5)
    expect(state.phase).toBe('cleared')
  })

  test('くじらはしおふき中の連打では延長せず、柱の外の隊長は打ち上げない', () => {
    const stage = stageById('whale-jump')
    const initial = createInitialState(stage)
    const jetting = triggerWhale(stage, initial)
    expect(jetting.whaleJetMs).toBeGreaterThan(0)
    const later = run(stage, jetting, 0.5)
    expect(triggerWhale(stage, later)).toBe(later)
    // はじめの隊長は岩の左にいて、柱の上ではない。
    expect(getFloater(later, 'duck')!.launchMs ?? 0).toBe(0)
  })

  test('すべりだいは入口の高さまで水をためないと始まらず、仲間も同じ道すじをたどる', () => {
    const stage = stageById('twisty-slide')
    let state = run(stage, createInitialState(stage), 2, true)
    expect(state.slide).toBeNull()
    let slid = false
    let penguinOnSlide = false
    for (let i = 0; i < 60 * 8; i++) {
      state = stepGame(stage, state, 1000 / 60, 'fill').state
      if (state.slide) slid = true
      const penguin = getFloater(state, 'penguin')!
      if (penguin.x > stage.waterBodies[1].left && penguin.y < 60) penguinOnSlide = true
    }
    expect(slid).toBe(true)
    expect(penguinOnSlide).toBe(true)
    expect(state.phase).toBe('cleared')
  })

  test('流れの向きを変えないと、左の岩のかえるは迎えられない', () => {
    const stage = stageById('change-the-flow')
    let state = run(stage, createInitialState(stage), 12, true)
    expect(state.rescuedIds).toEqual(['boat'])
    expect(leaderAtGoal(stage, state)).toBe(true)
    expect(state.phase).toBe('playing')
    // 逆向きの波を連打しても、流れに逆らって左の岩までは届かない。
    for (let i = 0; i < 300; i++) state = run(stage, applyWave(stage, state, 84, 60), 1 / 60)
    expect(state.rescuedIds).not.toContain('frog')
    state = play(stage, [['board'], ['wait', 6], ['board'], ['wait', 6]], state)
    expect(state.phase).toBe('cleared')
  })
})
