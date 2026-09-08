export type BoxKind = 'rectangle' | 'round' | 'divided'
export type FoodKind = 'onigiri' | 'egg' | 'sausage' | 'chicken' | 'broccoli' | 'tomato' | 'sushi' | 'carrot'
export const BOXES: { id: BoxKind; name: string }[] = [
  { id: 'rectangle', name: 'しかく' }, { id: 'round', name: 'まる' }, { id: 'divided', name: 'しきりつき' },
]
export const COLORS = [
  { name: 'あか', hex: '#ee6664' }, { name: 'あお', hex: '#62b9df' },
  { name: 'きいろ', hex: '#f3c95c' }, { name: 'ピンク', hex: '#ed9abc' },
]
export type FoodDefinition = { id: FoodKind; name: string; emoji: string; radius: number; model?: string; rotation: number; tilt?: number }
// radius encloses the model's X/Z footprint, so a quarter turn cannot cross a wall.
export const FOODS: FoodDefinition[] = [
  { id: 'onigiri', name: 'おにぎり', emoji: '🍙', radius: 0.62, rotation: 0 },
  { id: 'egg', name: 'たまご', emoji: '🍳', radius: 0.58, model: 'egg.glb', rotation: 0 },
  { id: 'sausage', name: 'ウインナー', emoji: '🌭', radius: 0.53, rotation: 0 },
  { id: 'chicken', name: 'からあげ', emoji: '🍗', radius: 0.49, rotation: 0 },
  { id: 'broccoli', name: 'ブロッコリー', emoji: '🥦', radius: 0.48, model: 'broccoli.glb', rotation: 0 },
  { id: 'tomato', name: 'ミニトマト', emoji: '🍅', radius: 0.36, model: 'tomato.glb', rotation: 0 },
  { id: 'sushi', name: 'おすし', emoji: '🍣', radius: 0.57, model: 'sushi.glb', rotation: 0 },
  { id: 'carrot', name: 'にんじん', emoji: '🥕', radius: 0.49, model: 'carrot.glb', rotation: 0, tilt: Math.PI / 2 },
]
export const foodDefinition = (kind: FoodKind) => FOODS.find(food => food.id === kind)!
export type CupKind = 'green' | 'pink' | 'blue'
export const CUPS: { id: CupKind; name: string; color: string }[] = [
  { id: 'green', name: 'みどり', color: '#82d871' },
  { id: 'pink', name: 'ピンク', color: '#ff9fbb' },
  { id: 'blue', name: 'あお', color: '#83d5f3' },
]
export const MAX_FOODS = 40
// Footprint circles include empty corners around long/triangular foods.
// Allow those margins to touch so children can pack food closely.
export const PACKING_RATIO = 0.74
export const HALF_WIDTH = 3
export const HALF_DEPTH = 2.2
export const ROUND_RADIUS = 2.65
export const DIVIDER_HALF = 0.1
export const FLOOR_Y = 0.2
export type Point = { x: number; z: number }
export type Food = Point & { id: number; kind: FoodKind; rotation: number; cup?: CupKind }
export type BentoState = {
  mode: 'choose' | 'edit' | 'done'; box: BoxKind; color: string
  foods: Food[]; selected: number | null; nextId: number; message: string
}
export const initialBentoState: BentoState = {
  mode: 'choose', box: 'rectangle', color: COLORS[0]!.hex,
  foods: [], selected: null, nextId: 1, message: '',
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
export function clampToBox(box: BoxKind, p: Point, radius: number): Point {
  if (box === 'round') {
    const limit = ROUND_RADIUS - radius
    const length = Math.hypot(p.x, p.z)
    const factor = length > limit ? limit / length : 1
    return { x: p.x * factor, z: p.z * factor }
  }
  let x = clamp(p.x, -HALF_WIDTH + radius, HALF_WIDTH - radius)
  const z = clamp(p.z, -HALF_DEPTH + radius, HALF_DEPTH - radius)
  if (box === 'divided' && Math.abs(x) < radius + DIVIDER_HALF) {
    x = (x < 0 ? -1 : 1) * (radius + DIVIDER_HALF)
  }
  return { x, z }
}
export function fits(box: BoxKind, p: Point, radius: number, others: Food[], contactRadius = radius * PACKING_RATIO): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return false
  const bounded = clampToBox(box, p, radius)
  if (Math.hypot(bounded.x - p.x, bounded.z - p.z) > 0.0001) return false
  // A little contact is allowed; large overlaps are prevented without rigid-body physics.
  return others.every(other => Math.hypot(other.x - p.x, other.z - p.z) >= contactRadius + foodDefinition(other.kind).radius * (other.cup ? 1 : PACKING_RATIO))
}
export function findPlacement(box: BoxKind, desired: Point, radius: number, others: Food[], searchDistance: number, contactRadius = radius * PACKING_RATIO): Point | null {
  if (!Number.isFinite(desired.x) || !Number.isFinite(desired.z)) return null
  const origin = clampToBox(box, desired, radius)
  if (fits(box, origin, radius, others, contactRadius)) return origin
  for (let distance = 0.12; distance <= searchDistance; distance += 0.12) {
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16
      const p = { x: origin.x + Math.cos(angle) * distance, z: origin.z + Math.sin(angle) * distance }
      if (fits(box, p, radius, others, contactRadius)) return p
    }
  }
  return null
}
export type BentoAction =
  | { type: 'box'; box: BoxKind } | { type: 'color'; color: string }
  | { type: 'start' | 'back' | 'finish' | 'edit' | 'restart' | 'rotate' | 'remove' }
  | { type: 'cup'; cup: CupKind | null }
  | { type: 'add'; kind: FoodKind } | { type: 'select'; id: number | null }
  | { type: 'move'; id: number; point: Point }
export function bentoReducer(state: BentoState, action: BentoAction): BentoState {
  switch (action.type) {
    case 'box': return state.mode === 'choose' && action.box !== state.box ? { ...state, box: action.box, foods: [], selected: null } : state
    case 'color': return state.mode === 'choose' ? { ...state, color: action.color } : state
    case 'start': return { ...state, mode: 'edit', message: 'おかずを えらんでね' }
    case 'back': return { ...state, mode: state.mode === 'done' ? 'edit' : 'choose', message: '' }
    case 'finish': return state.mode === 'edit' && state.foods.length ? { ...state, mode: 'done', selected: null, message: '' } : state
    case 'edit': return { ...state, mode: 'edit', message: 'なおして みよう' }
    case 'restart': return { ...initialBentoState, box: state.box, color: state.color }
  }
  if (state.mode !== 'edit') return state
  switch (action.type) {
    case 'add': {
      const definition = foodDefinition(action.kind)
      const point = state.foods.length < MAX_FOODS
        ? findPlacement(state.box, { x: 0, z: 0 }, definition.radius, state.foods, 7) : null
      if (!point) return { ...state, message: 'いっぱいだね！ おかずを へらすか「できた！」' }
      const food = { ...point, id: state.nextId, kind: action.kind, rotation: definition.rotation }
      return { ...state, foods: [...state.foods, food], selected: food.id, nextId: food.id + 1, message: `${definition.name}を いれたよ！ ゆびで うごかせるよ` }
    }
    case 'cup': {
      const selected = state.foods.find(food => food.id === state.selected)
      if (!selected || selected.cup === (action.cup ?? undefined)) return state
      const radius = foodDefinition(selected.kind).radius
      // Plastic rims need their full footprint, even when nearby food is packed tightly.
      const point = action.cup ? findPlacement(state.box, selected, radius,
        state.foods.filter(food => food.id !== selected.id), 0.6, radius) : selected
      if (!point) return { ...state, message: 'カップの ばしょを あけてね。おかずを すこし うごかそう' }
      return {
        ...state,
        foods: state.foods.map(food => food.id === selected.id ? { ...food, ...point, cup: action.cup ?? undefined } : food),
        message: action.cup ? 'カップに いれたよ！ いっしょに うごかせるよ' : 'カップを はずしたよ',
      }
    }
    case 'select': return { ...state, selected: state.foods.some(food => food.id === action.id) ? action.id : null, message: '' }
    case 'remove': return { ...state, foods: state.foods.filter(food => food.id !== state.selected), selected: null, message: 'とりだしたよ' }
    case 'rotate': return { ...state, foods: state.foods.map(food => food.id === state.selected ? { ...food, rotation: (food.rotation + Math.PI / 2) % (Math.PI * 2) } : food) }
    case 'move': {
      const food = state.foods.find(item => item.id === action.id)
      if (!food) return state
      const point = findPlacement(state.box, action.point, foodDefinition(food.kind).radius, state.foods.filter(item => item.id !== food.id), 0.6, food.cup ? foodDefinition(food.kind).radius : undefined)
      return { ...state, foods: state.foods.map(item => item.id === food.id ? { ...item, ...(point ?? food) } : item), message: point ? 'ここに おいたよ' : 'ここは いっぱい。もとの ばしょに もどしたよ' }
    }
  }
}
