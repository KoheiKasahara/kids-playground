export type ShepherdDomino = {
  id: string
  chainIndex: number
  fallen: boolean
  /** 倒れきらずに静止している場合だけ補助対象にする。 */
  sleeping: boolean
}

export type ShepherdPlan = {
  /** 押すべきドミノのidと、補助の強さ倍率。 */
  nudges: { id: string; strength: number }[]
}

export type ShepherdMemory = {
  /** まだ立っていると初めて確認した時刻。 */
  standingSince: Record<string, number>
  /** このランで各ドミノへ補助を入れた回数。 */
  nudgeCounts: Record<string, number>
  /** 個別の補助を連打しないための最終補助時刻。 */
  lastNudgeAt: Record<string, number>
  /** 最後に確認した波面と、同じ波面で進行があった時刻。 */
  lastWavefront: number | null
  lastFallenCount: number
  lastProgressAt: number | null
  /** 停滞時の次列への補助を短い間隔で重ねないための時刻。 */
  lastStallNudgeAt: number | null
}

export const SHEPHERD_STUCK_MS = 600
export const SHEPHERD_STALL_MS = 1500
export const SHEPHERD_MAX_NUDGES = 3
export const SHEPHERD_NUDGE_COOLDOWN_MS = 600
export const SHEPHERD_STRENGTHS = [0.75, 1.05, 1.4] as const
/** V字波面の停滞時に、一度に起こす経路ドミノ数の上限。 */
export const SHEPHERD_STALL_MAX_NUDGES = 3

export function createShepherdMemory(): ShepherdMemory {
  return {
    standingSince: {},
    nudgeCounts: {},
    lastNudgeAt: {},
    lastWavefront: null,
    lastFallenCount: 0,
    lastProgressAt: null,
    lastStallNudgeAt: null,
  }
}

function copyMemory(memory: ShepherdMemory): ShepherdMemory {
  return {
    standingSince: { ...memory.standingSince },
    nudgeCounts: { ...memory.nudgeCounts },
    lastNudgeAt: { ...memory.lastNudgeAt },
    lastWavefront: memory.lastWavefront,
    lastFallenCount: memory.lastFallenCount,
    lastProgressAt: memory.lastProgressAt,
    lastStallNudgeAt: memory.lastStallNudgeAt,
  }
}

function strengthFor(count: number): number {
  return SHEPHERD_STRENGTHS[Math.min(count, SHEPHERD_STRENGTHS.length - 1)]
}

/** 状態を変更せず、取り残しと停滞した次列への補助だけを計画する。 */
export function planShepherdNudges(
  dominoes: ShepherdDomino[],
  memory: ShepherdMemory,
  nowMs: number,
): { plan: ShepherdPlan; memory: ShepherdMemory } {
  const nextMemory = copyMemory(memory)
  const nudges: ShepherdPlan['nudges'] = []
  const fallenDominoes = dominoes.filter((domino) => domino.fallen)

  // まだスタートしていないときは波面がないため、補助を入れない。
  if (fallenDominoes.length === 0) {
    nextMemory.lastWavefront = null
    nextMemory.lastFallenCount = 0
    nextMemory.lastProgressAt = null
    nextMemory.lastStallNudgeAt = null
    // 開始前は全員が立っているため、取り残しの計時を始めない。
    nextMemory.standingSince = {}
    return { plan: { nudges }, memory: nextMemory }
  }

  const wavefront = Math.max(...fallenDominoes.map((domino) => domino.chainIndex))
  const fallenCount = fallenDominoes.length
  const progress =
    nextMemory.lastWavefront === null ||
    wavefront > nextMemory.lastWavefront ||
    fallenCount > nextMemory.lastFallenCount

  if (progress) {
    nextMemory.lastWavefront = wavefront
    nextMemory.lastFallenCount = fallenCount
    nextMemory.lastProgressAt = nowMs
    nextMemory.lastStallNudgeAt = null
  }

  for (const domino of dominoes) {
    if (domino.fallen) {
      delete nextMemory.standingSince[domino.id]
      continue
    }
    const isCandidate = domino.sleeping && domino.chainIndex < wavefront
    if (isCandidate) {
      // 波面より前に入り、かつ静止した時点から600msを数える。
      nextMemory.standingSince[domino.id] ??= nowMs
    } else {
      delete nextMemory.standingSince[domino.id]
    }
  }

  const nudgedIds = new Set<string>()
  const addNudge = (domino: ShepherdDomino) => {
    if (nudgedIds.has(domino.id)) return
    const count = nextMemory.nudgeCounts[domino.id] ?? 0
    if (count >= SHEPHERD_MAX_NUDGES) return
    const lastNudgeAt = nextMemory.lastNudgeAt[domino.id]
    if (lastNudgeAt !== undefined && nowMs - lastNudgeAt < SHEPHERD_NUDGE_COOLDOWN_MS) return

    nudges.push({ id: domino.id, strength: strengthFor(count) })
    nudgedIds.add(domino.id)
    nextMemory.nudgeCounts[domino.id] = count + 1
    nextMemory.lastNudgeAt[domino.id] = nowMs
  }

  // 波面より前の立ったドミノは、接触を取り逃した取り残しとして救出する。
  for (const domino of dominoes) {
    if (
      !domino.fallen &&
      domino.sleeping &&
      domino.chainIndex < wavefront &&
      nowMs - (nextMemory.standingSince[domino.id] ?? nowMs) >= SHEPHERD_STUCK_MS
    ) {
      addNudge(domino)
    }
  }

  // 同じ列の進行も止まった場合は、波面の次の列をまとめて軽く押す。
  if (
    nextMemory.lastProgressAt !== null &&
    nowMs - nextMemory.lastProgressAt >= SHEPHERD_STALL_MS &&
    (nextMemory.lastStallNudgeAt === null ||
      nowMs - nextMemory.lastStallNudgeAt >= SHEPHERD_NUDGE_COOLDOWN_MS)
  ) {
    let stallNudgeCount = 0
    for (const domino of dominoes) {
      if (stallNudgeCount >= SHEPHERD_STALL_MAX_NUDGES) break
      if (
        !domino.fallen &&
        domino.sleeping &&
        domino.chainIndex === wavefront + 1
      ) {
        const nudgesBefore = nudges.length
        addNudge(domino)
        stallNudgeCount += nudges.length - nudgesBefore
      }
    }
    if (nudges.length > 0) nextMemory.lastStallNudgeAt = nowMs
  }

  return { plan: { nudges }, memory: nextMemory }
}
