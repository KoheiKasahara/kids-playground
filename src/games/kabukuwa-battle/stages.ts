// たたかう ばしょ。ばしょごとに みる むき（カメラ）と、あしばの かたちが ちがう。
//
// たたかいは ばしょの ざひょう（u: たたかう すじ、v: よこ、z: たかさ。たんいは ドット）で すすみ、
// 絵を かくときに カメラで 画面へ うつす。

export type StageId = 'branch' | 'log' | 'stump'

export type Stage = {
  id: StageId
  name: string
  /** みる むきの ことば（よこから・ななめから・うえから）。 */
  view: string
  lead: string
  /** カメラの みおろす 角度（0 で まよこ、90° で まうえ）[rad]。 */
  elevation: number
  /** たたかう すじ（u）が 画面の どちらを むくか [rad]。 */
  axis: number
  /** この 大きさ（ドット）が 画面に かならず おさまる。 */
  minW: number
  minH: number
  /** はじめの いち（u）。 */
  startU: number
}

const DEG = Math.PI / 180

export const STAGES: readonly Stage[] = [
  {
    id: 'branch', name: 'よるの き の えだ', view: 'よこから', lead: 'じゅえきの でる えだの うえ。なげられると したへ おちるよ',
    elevation: 6 * DEG, axis: 0, minW: 210, minH: 170, startU: 62,
  },
  {
    id: 'log', name: 'もりの まるた', view: 'ななめから', lead: 'よこたわった まるたの うえ。はしや よこから おちたら まけ',
    elevation: 36 * DEG, axis: 28 * DEG, minW: 250, minH: 190, startU: 52,
  },
  {
    id: 'stump', name: 'きりかぶ どひょう', view: 'うえから', lead: 'まるい きりかぶの うえ。そとへ おしだせ！',
    elevation: 90 * DEG, axis: 0, minW: 236, minH: 236, startU: 52,
  },
]

export function stageById(id: string | null | undefined): Stage | undefined {
  return STAGES.find(stage => stage.id === id)
}

// ---- あしばの かたち ----

/** まるたの はんけい・はんぶんの ながさ・のれる はば（u・v）。 */
export const LOG_RADIUS = 24
export const LOG_HALF = 118
export const LOG_TOP_HALF = 15
/** きりかぶの はんけい。 */
export const STUMP_RADIUS = 104
/** えだの みえる はんい（これより そとへ にげたら おしまい）。 */
export const BRANCH_RUN_OFF = 230

/**
 * (u, v) に あしばが あるか。えだは ほそい ので、なげられたら ほぼ おちる（べつに しらべる）。
 */
export function hasGround(stage: StageId, u: number, v: number) {
  switch (stage) {
    case 'branch': return Math.abs(v) < 6
    case 'log': return Math.abs(u) <= LOG_HALF && Math.abs(v) <= LOG_TOP_HALF
    case 'stump': return u * u + v * v <= STUMP_RADIUS * STUMP_RADIUS
  }
}

/** あしばの たかさ（まるたは まるい ので まんなかが いちばん たかい）。 */
export function groundHeight(stage: StageId, v: number) {
  if (stage !== 'log') return 0
  const vv = Math.min(Math.abs(v), LOG_RADIUS - .01)
  return Math.sqrt(LOG_RADIUS * LOG_RADIUS - vv * vv) - LOG_RADIUS
}

/** はしまでの のこり（ちいさいほど あぶない）。えだは はしが ないので とても 大きい。 */
export function edgeRoom(stage: StageId, u: number, v: number) {
  switch (stage) {
    case 'branch': return Infinity
    case 'log': return Math.min(LOG_HALF - Math.abs(u), (LOG_TOP_HALF - Math.abs(v)) * 3)
    case 'stump': return STUMP_RADIUS - Math.hypot(u, v)
  }
}

/** おちた あと、どこまで おちるか（z）。 */
export function fallFloor(stage: StageId) {
  switch (stage) {
    case 'branch': return -220
    case 'log': return -LOG_RADIUS * 2
    case 'stump': return -60
  }
}

/** その ばしょの よびかた（〜から おちた）。 */
function placeName(stage: StageId) {
  return stage === 'branch' ? 'えだ' : stage === 'log' ? 'まるた' : 'きりかぶ'
}

/** しょうぶの きまりかたの せつめい。loser は まけた むしの よびな。 */
export function resultText(stage: StageId, loser: string, reason: 'throw' | 'push' | 'slip' | 'flee' | 'judge') {
  switch (reason) {
    case 'throw': return `${loser}を なげて、${placeName(stage)}から おとした！`
    case 'push': return `${loser}を ${placeName(stage)}の そとへ おしだした！`
    case 'slip': return `${loser}は あしが すべって えだから おちた！`
    case 'flee': return `${loser}は かなわないと おもって にげだした！`
    case 'judge': return 'じかんぎれ！ げんきが たくさん のこって いた ほうの かち'
  }
}
