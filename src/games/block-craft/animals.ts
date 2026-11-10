import { DEFAULT_WORLD, landmark, materialCode, type World, type Block, type WoolColor } from './world'

export type AnimalKind = 'sheep' | 'chicken' | 'rabbit'
export type Cell = { x: number; z: number }
export type Spawn = Cell & { kind: AnimalKind; wool?: WoolColor }

/** せかいに いる どうぶつ。x・z は うまれた ばしょ（あるいている ばしょは ほぞんしない）。 */
export type Animal = Spawn & {
  id: number
  /** けを とった ひつじ。こむぎを あげると また はえる。 */
  sheared?: boolean
  baby?: boolean
  /** こむぎを もらって なかよし。おなじ どうぶつの なかよしが そろうと あかちゃんが うまれる。 */
  love?: boolean
}
export type Herd = readonly Animal[]
/** どうぶつの かずの じょうげん（ふえすぎて おもく ならないように）。 */
export const MAX_HERD = 16
export const ANIMAL_KINDS: readonly AnimalKind[] = ['sheep', 'chicken', 'rabbit']
export const WOOL_COLORS: readonly WoolColor[] = ['white', 'pink', 'yellow', 'blue']

/** くさはらの どうぶつ。 */
export const ANIMAL_SPAWNS: readonly Spawn[] = [
  { kind: 'sheep', x: 6, z: 8, wool: 'white' },
  { kind: 'sheep', x: 10, z: 11, wool: 'pink' },
  { kind: 'chicken', x: 5, z: 13 },
  { kind: 'rabbit', x: 9, z: 4 },
]

export const herdFrom = (spawns: readonly Spawn[], size = DEFAULT_WORLD.size): Herd =>
  spawns.map((spawn, id) => ({ ...spawn, x: landmark(spawn.x, size), z: landmark(spawn.z, size), id }))

const WATER = materialCode('water'), CACTUS = materialCode('cactus'), LAVA = materialCode('lava')
const STEPS: readonly Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]

/** どうぶつが のれる じめん：みず・サボテン・ようがんの うえには いかない。 */
export function walkable(ground: Block | undefined): ground is Block {
  return !!ground && ground.material !== 'water' && ground.material !== 'cactus' && ground.material !== 'lava'
}

/** Reuse the destination and direction buffer in the animation loop. */
export function chooseAnimalStep(world: World, from: Cell, to: Cell, options: Int8Array, random: () => number) {
  const here = world.topY(from.x, from.z, true)
  let count = 0
  for (let i = 0; i < STEPS.length; i++) {
    const x = from.x + STEPS[i].x, z = from.z + STEPS[i].z
    const y = world.topY(x, z, true)
    if (y < 0 || (here >= 0 && Math.abs(y - here) > 1)) continue
    const ground = world.codeAt(x, y, z)
    if (ground !== WATER && ground !== CACTUS && ground !== LAVA) options[count++] = i
  }
  if (!count) return false
  const step = STEPS[options[Math.min(count - 1, Math.floor(random() * count))]]
  to.x = from.x + step.x
  to.z = from.z + step.z
  return true
}

export type FeedResult = 'grow' | 'wool' | 'love' | 'baby'
/**
 * こむぎを あげる。あかちゃんは おとなに なり、けを とった ひつじは けが はえ、
 * それ いがいは なかよしに なる。おなじ どうぶつの なかよしが もう 1ぴき いれば、
 * 2ひきとも なかよしを おえて、あげた どうぶつの そばに あかちゃんが うまれる。
 */
export function feedAnimal(herd: Herd, id: number, at: Cell): { herd: Herd; result: FeedResult } | null {
  const animal = herd.find(a => a.id === id)
  if (!animal) return null
  /** しるしを つける・はずす（はずした しるしは のこさない）。 */
  const mark = (flag: 'baby' | 'sheared' | 'love', on: boolean, ids: readonly number[] = [id]) => herd.map(a => {
    if (!ids.includes(a.id)) return a
    const next = { ...a }
    if (on) next[flag] = true
    else delete next[flag]
    return next
  })
  if (animal.baby) return { herd: mark('baby', false), result: 'grow' }
  if (animal.sheared) return { herd: mark('sheared', false), result: 'wool' }
  const mate = herd.find(a => a.id !== id && a.kind === animal.kind && a.love && !a.baby)
  if (!mate || herd.length >= MAX_HERD) return { herd: mark('love', true), result: 'love' }
  const baby: Animal = { id: Math.max(...herd.map(a => a.id)) + 1, kind: animal.kind, x: at.x, z: at.z, baby: true, ...(animal.wool && { wool: animal.wool }) }
  return { herd: [...mark('love', false, [id, mate.id]), baby], result: 'baby' }
}

/** ひつじの けを とる。とれた けいとの いろを かえす。 */
export function shearSheep(herd: Herd, id: number): { herd: Herd; wool: WoolColor } | null {
  const sheep = herd.find(a => a.id === id)
  if (!sheep?.wool || sheep.sheared || sheep.baby) return null
  return { herd: herd.map(a => a === sheep ? { ...a, sheared: true } : a), wool: sheep.wool }
}

const isCellNumber = (value: unknown, size: number) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < size
const optionalFlag = (value: unknown) => value === undefined || typeof value === 'boolean'
/** ほぞんした どうぶつを よみこむ。こわれていたら null。 */
export function decodeHerd(data: unknown, size = DEFAULT_WORLD.size): Herd | null {
  if (!Array.isArray(data) || data.length > MAX_HERD) return null
  const ids = new Set<number>()
  for (const a of data) {
    if (!a || typeof a !== 'object' || !Number.isInteger(a.id) || ids.has(a.id)) return null
    if (!ANIMAL_KINDS.includes(a.kind) || !isCellNumber(a.x, size) || !isCellNumber(a.z, size)) return null
    if (a.wool !== undefined && (a.kind !== 'sheep' || !WOOL_COLORS.includes(a.wool))) return null
    if (![a.sheared, a.baby, a.love].every(optionalFlag)) return null
    ids.add(a.id)
  }
  return data.map(({ id, kind, x, z, wool, sheared, baby, love }: Animal) => ({
    id, kind, x, z, ...(wool && { wool }), ...(sheared && { sheared }), ...(baby && { baby }), ...(love && { love }),
  }))
}
