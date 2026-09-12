/**
 * クレーンゲームの機械（ステージ）と景品の定義。
 * 形・重さ・まさつ・アームの強さといった物理の性格をここへ集約し、
 * Rapier側（craneWorld.ts）とThree側（craneScene.ts）は同じ定義を読むだけにする。
 * 乱数は持たず、同じ machine と round からは必ず同じ並びになる（テストと再挑戦の再現性のため）。
 */

export type Vec3 = { x: number; y: number; z: number }

/** 景品の物理形状。見た目（look）と分けておき、同じ形で見た目だけ違う景品を作れるようにする。 */
export type PrizeBody =
  | { form: 'ball'; radius: number }
  | { form: 'capsule'; radius: number; half: number }
  | { form: 'box'; half: Vec3; round: number }

export type PrizeLook = 'bear' | 'bunny' | 'chick' | 'egg' | 'marble' | 'snack' | 'drink'

export type PrizeSpecies = {
  id: string
  label: string
  emoji: string
  color: string
  accent: string
  look: PrizeLook
  body: PrizeBody
  /** 質量[kg]。重い景品はアームのばねを強く伸ばすため、すべり落ちやすい。 */
  mass: number
  friction: number
  restitution: number
}

export type MachineGrip = {
  /** アームが支えられる最大の力[N]。これを超える負荷がかかると景品はすべり落ちる。 */
  hold: number
  /** アームのばね定数[N/m]と減衰[N·s/m]。つかんだ景品はここからぶら下がって揺れる。 */
  stiffness: number
  damping: number
  /** つかめる範囲。アームの中心軸からの水平距離[m]。 */
  capture: number
}

export type PrizeSlot = { species: string; x: number; z: number }

export type CraneMachine = {
  id: string
  label: string
  emoji: string
  color: string
  description: string
  hint: string
  grip: MachineGrip
  species: readonly PrizeSpecies[]
  slots: readonly PrizeSlot[]
}

/** 景品が入っているケースの内寸[m]。床は y=0 で、手前が z+。 */
export const BIN = { x: 0.62, z: 0.44, height: 0.92 } as const
/** 景品を落とすと取れる穴と、その下の受け皿。手前左の角に開けている。 */
export const CHUTE = { minX: -BIN.x, maxX: -0.3, minZ: 0.12, maxZ: BIN.z, floor: -0.34 } as const

/**
 * 床に置いたときの中心の高さ。
 * カプセル形は立てると必ず倒れてしまうため、最初からねかせて置く（高さは半径ぶん）。
 */
export function restingHeight(body: PrizeBody): number {
  if (body.form === 'ball') return body.radius
  if (body.form === 'capsule') return body.radius
  return body.half.y + body.round
}

/** つかみ判定と並べ方に使う、水平方向のおおよその半径。 */
export function prizeReach(body: PrizeBody): number {
  if (body.form === 'ball') return body.radius
  if (body.form === 'capsule') return body.radius + body.half
  return Math.hypot(body.half.x, body.half.z) + body.round
}

const PLUSH_SPECIES: readonly PrizeSpecies[] = [
  { id: 'bear', label: 'くまさん', emoji: '🧸', color: '#c58a54', accent: '#f4ddc1', look: 'bear', body: { form: 'ball', radius: 0.082 }, mass: 0.05, friction: 0.95, restitution: 0.04 },
  { id: 'bunny', label: 'うさぎさん', emoji: '🐰', color: '#f3e6ef', accent: '#ef9fb4', look: 'bunny', body: { form: 'capsule', radius: 0.058, half: 0.042 }, mass: 0.05, friction: 0.9, restitution: 0.04 },
  { id: 'chick', label: 'ひよこ', emoji: '🐥', color: '#ffd75e', accent: '#ef8c3a', look: 'chick', body: { form: 'ball', radius: 0.068 }, mass: 0.04, friction: 0.92, restitution: 0.05 },
]

const CAPSULE_SPECIES: readonly PrizeSpecies[] = [
  { id: 'egg-pink', label: 'ピンクのたまご', emoji: '🥚', color: '#f7a8bb', accent: '#fff4f6', look: 'egg', body: { form: 'capsule', radius: 0.047, half: 0.019 }, mass: 0.06, friction: 0.3, restitution: 0.22 },
  { id: 'egg-mint', label: 'みどりのたまご', emoji: '🥚', color: '#8fd8c0', accent: '#f1fffa', look: 'egg', body: { form: 'capsule', radius: 0.045, half: 0.017 }, mass: 0.055, friction: 0.28, restitution: 0.24 },
  { id: 'marble', label: 'ビッグボール', emoji: '🔮', color: '#6fb4ef', accent: '#eaf6ff', look: 'marble', body: { form: 'ball', radius: 0.062 }, mass: 0.07, friction: 0.2, restitution: 0.3 },
]

const SNACK_SPECIES: readonly PrizeSpecies[] = [
  { id: 'cookie', label: 'クッキー', emoji: '🍪', color: '#e0a356', accent: '#7a4b22', look: 'snack', body: { form: 'box', half: { x: 0.072, y: 0.048, z: 0.05 }, round: 0.012 }, mass: 0.105, friction: 0.72, restitution: 0.06 },
  { id: 'chocolate', label: 'チョコ', emoji: '🍫', color: '#7b4a2e', accent: '#f3d9a4', look: 'snack', body: { form: 'box', half: { x: 0.08, y: 0.034, z: 0.046 }, round: 0.01 }, mass: 0.095, friction: 0.68, restitution: 0.05 },
  { id: 'juice', label: 'ジュース', emoji: '🧃', color: '#ef8340', accent: '#fff1d8', look: 'drink', body: { form: 'box', half: { x: 0.036, y: 0.062, z: 0.036 }, round: 0.008 }, mass: 0.115, friction: 0.62, restitution: 0.04 },
]

/** 穴の上を避けた並べ場所。ケースの内側へ景品の大きさ分の余白を残してある。 */
function grid(species: readonly string[]): PrizeSlot[] {
  const xs = [-0.45, -0.16, 0.13, 0.42]
  const zs = [-0.31, -0.09, 0.13, 0.33]
  const slots: PrizeSlot[] = []
  for (const z of zs) {
    for (const x of xs) {
      // 穴の真上は空けておく。並べた直後に落ちて最初から取れてしまうのを防ぐ。
      if (x < CHUTE.maxX && z > CHUTE.minZ) continue
      slots.push({ species: species[slots.length % species.length]!, x, z })
    }
  }
  return slots
}

export const CRANE_MACHINES: readonly CraneMachine[] = [
  {
    id: 'plush',
    label: 'ぬいぐるみ',
    emoji: '🧸',
    color: '#ef7d9d',
    description: 'ふわふわで つかみやすいよ',
    hint: 'ふわふわだから アームが よく ひっかかるよ',
    grip: { hold: 2.6, stiffness: 150, damping: 3.4, capture: 0.09 },
    species: PLUSH_SPECIES,
    slots: grid(['bear', 'bunny', 'chick', 'bunny', 'chick', 'bear']),
  },
  {
    id: 'capsule',
    label: 'カプセル',
    emoji: '🥚',
    color: '#5fb7d8',
    description: 'つるつる すべりやすい',
    hint: 'つるつるだから アームから すべりやすいよ',
    grip: { hold: 1.62, stiffness: 150, damping: 3.2, capture: 0.085 },
    species: CAPSULE_SPECIES,
    slots: grid(['egg-pink', 'marble', 'egg-mint', 'egg-pink', 'egg-mint', 'marble']),
  },
  {
    id: 'snack',
    label: 'おかし',
    emoji: '🍪',
    color: '#e8a13c',
    description: 'しかくくて おもたいよ',
    hint: 'おもいから まんなかを ねらおう',
    grip: { hold: 2.1, stiffness: 150, damping: 3.4, capture: 0.085 },
    species: SNACK_SPECIES,
    slots: grid(['cookie', 'chocolate', 'juice', 'chocolate', 'cookie', 'juice']),
  },
]

export function findMachine(id: string): CraneMachine | undefined {
  return CRANE_MACHINES.find(machine => machine.id === id)
}

export function findSpecies(machine: CraneMachine, id: string): PrizeSpecies | undefined {
  return machine.species.find(species => species.id === id)
}

/** 並べ直すたびに少しずつ位置がずれる、決まった形のゆらぎ。round が同じなら結果も同じ。 */
function wobble(seed: number): number {
  const value = Math.sin(seed * 127.1 + 13.7) * 43758.5453
  return value - Math.floor(value) - 0.5
}

export type PrizeSpawn = { id: string; species: PrizeSpecies; position: Vec3; yaw: number }

/**
 * 景品の初期配置。ほんの少し浮かせた高さから落とし、山の形は物理に決めさせる。
 * 大きく落とすと景品が転がって穴へ入ってしまうため、落差は小さくしてある。
 */
export function prizeSpawns(machine: CraneMachine, round = 0): PrizeSpawn[] {
  return machine.slots.map((slot, index) => {
    const species = findSpecies(machine, slot.species) ?? machine.species[0]!
    const seed = round * 71 + index * 3.3
    return {
      id: `prize-${round}-${index}`,
      species,
      position: {
        x: slot.x + wobble(seed) * 0.03,
        y: restingHeight(species.body) + 0.012 + (index % 3) * 0.02,
        z: slot.z + wobble(seed + 1.7) * 0.03,
      },
      yaw: wobble(seed + 4.2) * Math.PI,
    }
  })
}
