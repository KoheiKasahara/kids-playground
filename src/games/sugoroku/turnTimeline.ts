import type { HapticKind } from '../../utils/haptics'
import type { BoardMover } from './SugorokuBoard'
import type { SquareEvent } from './courses'
import type { SugorokuSound } from './sounds'
import type { GameState, TurnPlan } from './sugorokuGame'

/** 1かいの ばんの ながれの はやさ [ms]。こどもが めで おえる ように ゆっくりめ。 */
export const TIMING = {
  /** サイコロが ころがる じかん。 */
  rollMs: 720,
  /** ころがる あいだに めが かわる かんかく。 */
  faceMs: 90,
  /** でた めを みせてから あるきだすまで。 */
  afterRollMs: 420,
  /** 1マス すすむ じかん。 */
  stepMs: 300,
  /** しかけの ことばを よむ じかん。 */
  eventMs: 1000,
  /** ワープで とんでいく じかん。 */
  warpMs: 700,
  /** うごきおわってから つぎの ひとの ばんに なるまで。 */
  settleMs: 450,
} as const

export type TimelineFrame = {
  at: number
  positions?: readonly number[]
  dice?: number
  rolling?: boolean
  mover?: BoardMover | null
  message?: string
  sound?: { kind: SugorokuSound; step?: number }
  haptic?: HapticKind
}

export function eventMessage(event: SquareEvent): string {
  switch (event.kind) {
    case 'forward': return `やったね！ ${event.steps} すすむ`
    case 'back': return `あらら、${event.steps} もどる`
    case 'rest': return 'ひとやすみ。つぎは 1かい やすみ'
    case 'again': return 'もう1かい ふれるよ！'
    case 'warp': return 'ワープ！ びゅーん'
  }
}

const isGood = (event: SquareEvent) => event.kind === 'forward' || event.kind === 'again' || event.kind === 'warp'

/** サイコロを ふってから つぎの ひとの ばんに なるまでの、がめんの うごきを じかんじゅんに ならべる。 */
export function turnTimeline(plan: TurnPlan, before: GameState, timing: typeof TIMING = TIMING): { frames: TimelineFrame[]; duration: number } {
  const { player } = plan
  const frames: TimelineFrame[] = [{ at: 0, rolling: true, mover: null, message: 'ころころ…', sound: { kind: 'roll' }, haptic: 'tap' }]
  const faces = Math.floor(timing.rollMs / timing.faceMs)
  for (let face = 1; face < faces; face++) frames.push({ at: face * timing.faceMs, dice: ((plan.roll + face) % 6) + 1 })
  let at = timing.rollMs
  frames.push({ at, rolling: false, dice: plan.roll, message: `${plan.roll}が でた！`, sound: { kind: 'dice' } })

  let positions = before.positions
  let hop = 0
  const walk = (squares: readonly number[], flying: boolean) => {
    squares.forEach((square, index) => {
      if (index > 0) at += timing.stepMs
      positions = positions.map((position, who) => (who === player ? square : position))
      frames.push({
        at,
        positions,
        mover: { player, hop: ++hop, count: flying ? null : index + 1, flying },
        sound: flying ? { kind: 'warp' } : { kind: 'step', step: index },
      })
    })
  }

  at += timing.afterRollMs
  walk(plan.walk, false)
  at += timing.stepMs

  if (plan.event) {
    frames.push({
      at,
      mover: { player, hop, count: null, flying: false },
      message: eventMessage(plan.event),
      sound: { kind: plan.event.kind === 'rest' ? 'rest' : isGood(plan.event) ? 'good' : 'bad' },
      haptic: isGood(plan.event) ? 'success' : 'impact',
    })
    at += timing.eventMs
    if (plan.eventWalk.length > 0) {
      const flying = plan.event.kind === 'warp'
      walk(plan.eventWalk, flying)
      at += flying ? timing.warpMs : timing.stepMs
    }
  }

  return { frames, duration: at + timing.settleMs }
}
