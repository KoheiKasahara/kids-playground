export const WORLD_WIDTH = 320
export const WORLD_HEIGHT = 288
export const TILE_SIZE = 16
const COLUMNS = WORLD_WIDTH / TILE_SIZE
const ROWS = WORLD_HEIGHT / TILE_SIZE
const WALK_SPEED = 80
const INTERACTION_RADIUS = 20
const BUILDING_FOOTPRINTS = [
  { left: 2, right: 4, top: 10, bottom: 12 },
  { left: 14, right: 16, top: 3, bottom: 4 },
  { left: 14, right: 16, top: 11, bottom: 12 },
  { left: 15, right: 17, top: 7, bottom: 8 },
  { left: 6, right: 6, top: 2, bottom: 2 },
] as const

export type PoiId = 'post' | 'wood' | 'bridge' | 'garden' | 'apple' | 'squirrel' | 'rabbit' | 'bear'
export type RecipientId = 'squirrel' | 'rabbit' | 'bear'
export type ItemId = 'parcel' | 'carrot' | 'apple' | 'wood'
export type Point = { x: number; y: number }
export type Poi = Point & {
  id: PoiId
  name: string
  kind: 'post' | 'wood' | 'bridge' | 'garden' | 'apple' | 'animal'
}
export type Stage = {
  id: 'spring' | 'summer' | 'dusk'
  name: string
  subtitle: string
  season: 'spring' | 'summer' | 'dusk'
  deliveries: readonly RecipientId[]
}

export const STAGES: readonly Stage[] = [
  { id: 'spring', name: 'はるの はいたつ', subtitle: 'はしを なおして、はじめての おとどけ', season: 'spring', deliveries: ['squirrel', 'rabbit'] },
  { id: 'summer', name: 'なつの ごちそう', subtitle: 'もりの みんなに おいしい しあわせ', season: 'summer', deliveries: ['squirrel', 'rabbit', 'bear'] },
  { id: 'dusk', name: 'ほたるの よる', subtitle: 'やさしい あかりの なかを おさんぽ', season: 'dusk', deliveries: ['squirrel', 'rabbit', 'bear'] },
]

export const POIS: readonly Poi[] = [
  { id: 'post', name: 'ゆうびんやさん', x: 56, y: 216, kind: 'post' },
  { id: 'wood', name: 'きのえだ', x: 104, y: 88, kind: 'wood' },
  { id: 'bridge', name: 'はし', x: 136, y: 152, kind: 'bridge' },
  { id: 'garden', name: 'にんじんばたけ', x: 72, y: 136, kind: 'garden' },
  { id: 'apple', name: 'りんごの き', x: 104, y: 56, kind: 'apple' },
  { id: 'squirrel', name: 'りすさん', x: 248, y: 88, kind: 'animal' },
  { id: 'rabbit', name: 'うさぎさん', x: 248, y: 216, kind: 'animal' },
  { id: 'bear', name: 'くまさん', x: 264, y: 152, kind: 'animal' },
]

const REQUESTS: Record<RecipientId, Exclude<ItemId, 'wood'>> = {
  squirrel: 'parcel',
  rabbit: 'carrot',
  bear: 'apple',
}
const ITEM_NAMES: Record<ItemId, string> = {
  parcel: 'にもつ', carrot: 'にんじん', apple: 'りんご', wood: 'きのえだ',
}

export type World = {
  stageIndex: number
  player: Point & { facing: 'left' | 'right' | 'up' | 'down'; walking: boolean }
  path: Point[]
  targetId: PoiId | null
  inventory: Record<ItemId, boolean>
  flags: {
    bridgeRepaired: boolean
    carrotWatered: boolean
    carrotHarvested: boolean
    parcelTaken: boolean
    appleTaken: boolean
    woodCollected: boolean
  }
  delivered: PoiId[]
  completed: boolean
  message: string
}
export type Interaction = { label: string; enabled: boolean; poiId: PoiId | null }
export type GameEvent = {
  type: 'collect' | 'water' | 'harvest' | 'repair' | 'deliver' | 'complete' | 'none'
  text: string
  poiId?: PoiId
}

export function createWorld(stageIndex = 0): World {
  const validIndex = Number.isInteger(stageIndex) && stageIndex >= 0 && stageIndex < STAGES.length ? stageIndex : 0
  return {
    stageIndex: validIndex,
    player: { x: 56, y: 232, facing: 'down', walking: false },
    path: [],
    targetId: null,
    inventory: { parcel: false, carrot: false, apple: false, wood: false },
    flags: { bridgeRepaired: false, carrotWatered: false, carrotHarvested: false, parcelTaken: false, appleTaken: false, woodCollected: false },
    delivered: [],
    completed: false,
    message: 'もりの みんなに おとどけしよう！',
  }
}

/** The river has one crossing. Border cells keep the courier inside the scene. */
export function isWalkableCell(world: World, column: number, row: number): boolean {
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 1 || column >= COLUMNS - 1 || row < 1 || row >= ROWS - 1) return false
  if (BUILDING_FOOTPRINTS.some((area) => column >= area.left && column <= area.right && row >= area.top && row <= area.bottom)) return false
  if (column === 9 || column === 10) return row === 9 && world.flags.bridgeRepaired
  return true
}

function cellCenter(column: number, row: number): Point {
  return { x: column * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 }
}

function findPath(world: World, destination: Point): Point[] | null {
  const from = Math.floor(world.player.y / TILE_SIZE) * COLUMNS + Math.floor(world.player.x / TILE_SIZE)
  const to = Math.floor(destination.y / TILE_SIZE) * COLUMNS + Math.floor(destination.x / TILE_SIZE)
  if (!isWalkableCell(world, to % COLUMNS, Math.floor(to / COLUMNS))) return null
  const queue = [from]
  const previous = new Map<number, number>([[from, -1]])
  for (let index = 0; index < queue.length && !previous.has(to); index += 1) {
    const current = queue[index]
    const column = current % COLUMNS
    const row = Math.floor(current / COLUMNS)
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nextColumn = column + dx
      const nextRow = row + dy
      const next = nextRow * COLUMNS + nextColumn
      if (previous.has(next) || !isWalkableCell(world, nextColumn, nextRow)) continue
      previous.set(next, current)
      queue.push(next)
    }
  }
  if (!previous.has(to)) return null
  const path: Point[] = []
  let current = to
  while (current !== -1) {
    path.push(cellCenter(current % COLUMNS, Math.floor(current / COLUMNS)))
    current = previous.get(current) ?? -1
  }
  // Include the current cell center so retargeting mid-stride cannot cut corners.
  return path.reverse().filter((point, index) => index !== 0 || Math.hypot(point.x - world.player.x, point.y - world.player.y) > 0.01)
}

export function targetPoint(world: World, x: number, y: number): boolean {
  if (world.completed || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) return false
  const nearby = POIS.filter((point) => Math.hypot(point.x - x, point.y - y) <= 18)
    .sort((left, right) => Math.hypot(left.x - x, left.y - y) - Math.hypot(right.x - x, right.y - y))[0]
  // Children can tap the illustrated building as well as its front-door marker.
  const poi = nearby ?? POIS.find((point) =>
    (point.kind === 'animal' || point.kind === 'post' || point.kind === 'apple')
      && Math.abs(point.x - x) <= 24 && y >= point.y - 56 && y <= point.y,
  )
  // Stop in front of recipients instead of drawing the courier over their sprite.
  const destination = poi?.kind === 'animal' ? { x: poi.x, y: poi.y + TILE_SIZE } : poi ?? { x, y }
  const path = findPath(world, destination)
  if (path === null) {
    world.message = !world.flags.bridgeRepaired && destination.x >= 144
      ? world.inventory.wood ? 'きのえだで はしを なおそう！' : 'まずは きのえだを ひろって はしを なおそう！'
      : 'くさの みちを タップしてね'
    return false
  }
  world.path = path
  world.targetId = poi?.id ?? null
  world.player.walking = path.length > 0
  return true
}

export function targetPoi(world: World, id: PoiId): boolean {
  const poi = POIS.find((point) => point.id === id)
  return poi ? targetPoint(world, poi.x, poi.y) : false
}

/** Movement is the only time-driven state; a background tab never skips a task. */
export function updateWorld(world: World, dtSeconds: number): void {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0 || world.completed) return
  let distance = Math.min(dtSeconds, 0.1) * WALK_SPEED
  while (distance > 0 && world.path.length > 0) {
    const next = world.path[0]
    const dx = next.x - world.player.x
    const dy = next.y - world.player.y
    const length = Math.hypot(dx, dy)
    if (length > 0) world.player.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up'
    if (length <= distance) {
      world.player.x = next.x
      world.player.y = next.y
      world.path.shift()
      distance -= length
    } else {
      world.player.x += dx / length * distance
      world.player.y += dy / length * distance
      distance = 0
    }
  }
  world.player.walking = world.path.length > 0
}

function nearestPoi(world: World): Poi | undefined {
  return POIS.filter((poi) => Math.hypot(poi.x - world.player.x, poi.y - world.player.y) <= INTERACTION_RADIUS)
    .sort((left, right) => Math.hypot(left.x - world.player.x, left.y - world.player.y) - Math.hypot(right.x - world.player.x, right.y - world.player.y))[0]
}

export function getInteraction(world: World): Interaction {
  if (world.completed) return { label: 'おとどけ かんりょう！', enabled: false, poiId: null }
  if (world.player.walking) return { label: 'とことこ あるいているよ', enabled: false, poiId: world.targetId }
  const poi = nearestPoi(world)
  if (!poi) return { label: 'いきたい ところを タップ', enabled: false, poiId: null }
  const choice = (label: string, enabled: boolean): Interaction => ({ label, enabled, poiId: poi.id })
  switch (poi.id) {
    case 'post': return choice(world.flags.parcelTaken ? 'にもつを おねがいね！' : 'にもつを うけとる', !world.flags.parcelTaken)
    case 'wood': return choice(world.flags.woodCollected ? 'きのえだを ひろったよ' : 'きのえだを ひろう', !world.flags.woodCollected)
    case 'bridge': return choice(world.flags.bridgeRepaired ? 'じょうぶな はしが できた！' : world.inventory.wood ? 'はしを なおす' : 'きのえだを さがそう', !world.flags.bridgeRepaired && world.inventory.wood)
    case 'garden': return choice(world.flags.carrotHarvested ? 'にんじんが とれたよ' : world.flags.carrotWatered ? 'にんじんを ぬく' : 'おみずを あげる', !world.flags.carrotHarvested)
    case 'apple': return choice(world.flags.appleTaken ? 'りんごが とれたよ' : 'りんごを とる', !world.flags.appleTaken)
    default: {
      if (!STAGES[world.stageIndex].deliveries.includes(poi.id)) return choice('きょうは のんびり おさんぽ', false)
      if (world.delivered.includes(poi.id)) return choice('ありがとう！ また あそぼうね', false)
      const item = REQUESTS[poi.id]
      return choice(world.inventory[item] ? `${ITEM_NAMES[item]}を わたす` : `${ITEM_NAMES[item]}を もってこよう`, world.inventory[item])
    }
  }
}

export function getObjective(world: World): { text: string; targetId: PoiId | null } {
  if (world.completed) return { text: 'みんなに とどいた！ ありがとう！', targetId: null }
  const recipient = STAGES[world.stageIndex].deliveries.find((id) => !world.delivered.includes(id))
  if (!recipient) return { text: 'みんなに とどいた！', targetId: null }
  const item = REQUESTS[recipient]
  if (!world.inventory[item]) {
    if (item === 'parcel') return { text: 'ゆうびんやさんで にもつを うけとろう', targetId: 'post' }
    if (item === 'carrot') return { text: world.flags.carrotWatered ? 'おおきな にんじんを ぬこう' : 'はたけに おみずを あげよう', targetId: 'garden' }
    return { text: 'まっかな りんごを とろう', targetId: 'apple' }
  }
  if (!world.flags.bridgeRepaired) return world.inventory.wood
    ? { text: 'きのえだで はしを なおそう', targetId: 'bridge' }
    : { text: 'はしを なおす きのえだを ひろおう', targetId: 'wood' }
  return { text: `${POIS.find((poi) => poi.id === recipient)!.name}に ${ITEM_NAMES[item]}を とどけよう`, targetId: recipient }
}

export function interact(world: World): GameEvent {
  const action = getInteraction(world)
  if (!action.enabled || !action.poiId) return { type: 'none', text: action.label }
  let event: GameEvent
  switch (action.poiId) {
    case 'post':
      world.inventory.parcel = true
      world.flags.parcelTaken = true
      event = { type: 'collect', text: 'りすさんの にもつを あずかったよ！' }
      break
    case 'wood':
      world.inventory.wood = true
      world.flags.woodCollected = true
      event = { type: 'collect', text: 'きのえだ みつけた！ はしを なおそう' }
      break
    case 'bridge':
      world.flags.bridgeRepaired = true
      world.inventory.wood = false
      event = { type: 'repair', text: 'トントン！ はしが つながったよ！' }
      break
    case 'garden':
      if (!world.flags.carrotWatered) {
        world.flags.carrotWatered = true
        event = { type: 'water', text: 'すくすく！ にんじんが おおきくなった！' }
      } else {
        world.flags.carrotHarvested = true
        world.inventory.carrot = true
        event = { type: 'harvest', text: 'すぽん！ おいしそうな にんじん！' }
      }
      break
    case 'apple':
      world.flags.appleTaken = true
      world.inventory.apple = true
      event = { type: 'collect', text: 'ころん！ まっかな りんごが とれたよ！' }
      break
    default: {
      const recipient = action.poiId
      world.inventory[REQUESTS[recipient]] = false
      world.delivered.push(recipient)
      world.completed = STAGES[world.stageIndex].deliveries.every((id) => world.delivered.includes(id))
      const name = POIS.find((poi) => poi.id === recipient)!.name
      event = { type: world.completed ? 'complete' : 'deliver', text: world.completed ? 'みんなに とどいた！ すてきな おとどけやさん！' : `${name}「ありがとう！ とっても うれしいな」` }
    }
  }
  event.poiId = action.poiId
  world.message = event.text
  return event
}
