/**
 * どーん！はなび の進行ロジック（純粋関数）。
 * よぞらを タッチすると そこへ はなびが あがり、ひらいた わの なかの ほしに あかりが つく。
 * ぜんぶの ほしを ともすと クリア。じかん せいげんは なく、はずしても しっぱいには ならない。
 *
 * 座標は よぞらの 左上を (0,0)、右下を (1,1) とする割合。よぞらは たてながなので、
 * きょりは よこはばを 1 とした ながさで はかる（たては SKY_ASPECT を かける）。
 */

export type HanabiStageId = 'yuugata' | 'yoru' | 'mayonaka'

export type HanabiStage = {
  id: HanabiStageId
  name: string
  hint: string
  emoji: string
  /** ともす ほしの かず。 */
  starCount: number
  /** ほしが ただよう はやさ [よこはば/秒]。0 なら うごかない。 */
  speed: number
  /** この かず いかの はなびで クリアすると ★3。 */
  threeStarShots: number
  /** この かず いかの はなびで クリアすると ★2。 */
  twoStarShots: number
}

export const STAGES: readonly HanabiStage[] = [
  { id: 'yuugata', name: 'ゆうがた', hint: 'ほしは うごかないよ', emoji: '🌆', starCount: 6, speed: 0, threeStarShots: 6, twoStarShots: 9 },
  { id: 'yoru', name: 'よる', hint: 'ほしが ゆっくり うごくよ', emoji: '🌃', starCount: 8, speed: 0.05, threeStarShots: 8, twoStarShots: 12 },
  { id: 'mayonaka', name: 'まよなか', hint: 'ほしが たくさん！', emoji: '🌌', starCount: 10, speed: 0.09, threeStarShots: 9, twoStarShots: 14 },
]

export function findStage(id: string): HanabiStage | undefined {
  return STAGES.find((stage) => stage.id === id)
}

/** よぞらの たて÷よこ。CSS の aspect-ratio と そろえる。 */
export const SKY_ASPECT = 4 / 3
/** はなびが ひらいて ほしに とどく はんけい [よこはば]。 */
export const BURST_RADIUS = 0.17
/** タッチしてから ひらくまでの じかん。 */
export const FLIGHT_MS = 500
/** ひらいた はなびを みせておく じかん。 */
export const BURST_SHOW_MS = 1300
/** あかりが ついた ほしを きらきら みせておく じかん。 */
export const LIT_SHOW_MS = 900
/** さいごの はなびを みおわってから けっかを だすまでの じかん。 */
export const FINALE_MS = 1100
/** いちどに あげられる（まだ ひらいていない）はなびの かず。れんだで かぞえすぎないようにする。 */
export const MAX_FLYING = 2
/** はなびの いろの かず。 */
export const COLOR_COUNT = 6

/** ほしが ただよう はんい。はしに かくれて タッチしにくく ならないようにする。 */
const BOUNDS = { minX: 0.1, maxX: 0.9, minY: 0.1, maxY: 0.72 }
const COLUMNS = 3

export type HanabiStar = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** あかりが ついた じこく。まだなら null。 */
  litAt: number | null
}

export type HanabiShell = {
  id: number
  x: number
  y: number
  colorIndex: number
  burstAt: number
  /** ひらいたか。 */
  burst: boolean
  /** ひらいたときに ともした ほしの かず。 */
  caught: number
}

export type HanabiState = {
  elapsedMs: number
  stars: HanabiStar[]
  shells: HanabiShell[]
  /** あかりが ついた ほしの かず。 */
  lit: number
  /** あげた はなびの かず。 */
  shots: number
  nextId: number
  /** ぜんぶ ともした じこく。まだなら null。 */
  completedAt: number | null
}

/** この刻みで ひらいた はなび。音・振動を鳴らすために画面へ伝える。 */
export type HanabiBurst = { shellId: number; caught: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function createInitialState(stage: HanabiStage): HanabiState {
  const rows = Math.ceil(stage.starCount / COLUMNS)
  const cellW = (BOUNDS.maxX - BOUNDS.minX) / COLUMNS
  const cellH = (BOUNDS.maxY - BOUNDS.minY) / rows
  const stars: HanabiStar[] = Array.from({ length: stage.starCount }, (_, index) => {
    // ますめに ひとつずつ おいて すこし ずらす。かさならず、まいかい ちがう ならびになる。
    const column = index % COLUMNS
    const row = Math.floor(index / COLUMNS)
    const angle = Math.random() * Math.PI * 2 + index
    return {
      id: index + 1,
      x: BOUNDS.minX + cellW * (column + 0.25 + Math.random() * 0.5),
      y: BOUNDS.minY + cellH * (row + 0.25 + Math.random() * 0.5),
      vx: Math.cos(angle) * stage.speed,
      vy: (Math.sin(angle) * stage.speed) / SKY_ASPECT,
      litAt: null,
    }
  })
  return { elapsedMs: 0, stars, shells: [], lit: 0, shots: 0, nextId: stage.starCount + 1, completedAt: null }
}

export function flyingCount(state: HanabiState): number {
  return state.shells.filter((shell) => !shell.burst).length
}

/** (x, y) へ はなびを あげる。ぜんぶ ともしたあとや、あげすぎのときは なにもしない。 */
export function launch(state: HanabiState, x: number, y: number): { state: HanabiState; launched: boolean } {
  if (state.completedAt !== null || flyingCount(state) >= MAX_FLYING) return { state, launched: false }
  const shell: HanabiShell = {
    id: state.nextId,
    x: clamp(x, 0.04, 0.96),
    // したの ほうは うちあげだいなので、そこでは ひらかない。
    y: clamp(y, 0.05, 0.82),
    colorIndex: state.shots % COLOR_COUNT,
    burstAt: state.elapsedMs + FLIGHT_MS,
    burst: false,
    caught: 0,
  }
  return {
    state: { ...state, shells: [...state.shells, shell], shots: state.shots + 1, nextId: state.nextId + 1 },
    launched: true,
  }
}

export function isInBurst(shell: Pick<HanabiShell, 'x' | 'y'>, star: Pick<HanabiStar, 'x' | 'y'>): boolean {
  return Math.hypot(star.x - shell.x, (star.y - shell.y) * SKY_ASPECT) <= BURST_RADIUS
}

function moveStar(star: HanabiStar, seconds: number): HanabiStar {
  if (star.litAt !== null || (star.vx === 0 && star.vy === 0)) return star
  let { x, y, vx, vy } = star
  x += vx * seconds
  y += vy * seconds
  if (x < BOUNDS.minX || x > BOUNDS.maxX) {
    vx = -vx
    x = clamp(x, BOUNDS.minX, BOUNDS.maxX)
  }
  if (y < BOUNDS.minY || y > BOUNDS.maxY) {
    vy = -vy
    y = clamp(y, BOUNDS.minY, BOUNDS.maxY)
  }
  return { ...star, x, y, vx, vy }
}

/** じかんを すすめる。ほしを うごかし、じかんに なった はなびを ひらいて ほしを ともす。 */
export function advance(state: HanabiState, deltaMs: number): { state: HanabiState; bursts: HanabiBurst[] } {
  const elapsedMs = state.elapsedMs + deltaMs
  let stars = state.stars.map((star) => moveStar(star, deltaMs / 1000))
  const bursts: HanabiBurst[] = []
  let lit = state.lit

  const shells = state.shells
    .filter((shell) => elapsedMs < shell.burstAt + BURST_SHOW_MS)
    .map((shell) => {
      if (shell.burst || elapsedMs < shell.burstAt) return shell
      let caught = 0
      stars = stars.map((star) => {
        if (star.litAt !== null || !isInBurst(shell, star)) return star
        caught += 1
        return { ...star, litAt: elapsedMs }
      })
      lit += caught
      bursts.push({ shellId: shell.id, caught })
      return { ...shell, burst: true, caught }
    })

  stars = stars.filter((star) => star.litAt === null || elapsedMs < star.litAt + LIT_SHOW_MS)
  const allLit = stars.every((star) => star.litAt !== null)
  const completedAt = state.completedAt ?? (allLit ? elapsedMs : null)
  return { state: { ...state, elapsedMs, stars, shells, lit, completedAt }, bursts }
}

/** ぜんぶ ともしたか（さいごの はなびは まだ ひらいている）。 */
export function isCompleted(state: HanabiState): boolean {
  return state.completedAt !== null
}

/** さいごの はなびを みおわって、けっかを だして よいか。 */
export function isFinished(state: HanabiState): boolean {
  return state.completedAt !== null && state.elapsedMs >= state.completedAt + FINALE_MS
}

/** すくない はなびで ともすほど ★が ふえる。クリアすれば かならず ★1。 */
export function scoreStars(stage: HanabiStage, shots: number): 1 | 2 | 3 {
  if (shots <= stage.threeStarShots) return 3
  if (shots <= stage.twoStarShots) return 2
  return 1
}

/** とんでいる はなびの いまの たかさ（0 = うちあげだい、1 = ひらく ところ）。 */
export function flightProgress(shell: HanabiShell, elapsedMs: number): number {
  return clamp(1 - (shell.burstAt - elapsedMs) / FLIGHT_MS, 0, 1)
}
