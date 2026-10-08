import { EMPTY_PAINT, MAX_STROKE_POINTS, MAX_TOTAL_POINTS, ringStroke, totalPoints, type BrushId, type GlazeId, type PaintState, type Stroke } from './paint'
import { createLump, nudgeProfile, stretchProfile, wallFractionAtHeight, type Profile } from './pottery'
import type { TargetId } from './targets'

/** menu → かたち → いろ → やく → できあがり。ひとつの URL の なかで きりかえる。 */
export type Screen = 'menu' | 'shape' | 'paint' | 'bake' | 'done'
/** 'all' は うつわ ぜんたいを ぬる（うわぐすり）。それ以外は ふで。 */
export type Tool = 'all' | BrushId

export type RokuroState = {
  screen: Screen
  /** null は「じゆうに つくる」。 */
  targetId: TargetId | null
  profile: Profile
  shapeHistory: readonly Profile[]
  paint: PaintState
  paintHistory: readonly PaintState[]
  tool: Tool
  color: GlazeId
  /** キーボードで さわる たかさ（0〜1）。 */
  cursor: number
  /** せんを かきすぎて これ以上 かけない。 */
  paintFull: boolean
  saved: boolean
}

export type RokuroAction =
  | { type: 'start'; targetId: TargetId | null }
  | { type: 'back' }
  | { type: 'profile'; profile: Profile }
  | { type: 'stretch'; direction: 1 | -1 }
  | { type: 'nudge'; delta: number }
  | { type: 'cursor'; step: 1 | -1 }
  | { type: 'undoShape' }
  | { type: 'resetShape' }
  | { type: 'toPaint' }
  | { type: 'tool'; tool: Tool }
  | { type: 'color'; color: GlazeId }
  | { type: 'base'; base: GlazeId | null }
  | { type: 'stroke'; stroke: Stroke }
  | { type: 'paintRing' }
  | { type: 'undoPaint' }
  | { type: 'bake' }
  | { type: 'baked' }
  | { type: 'saved' }
  | { type: 'restart' }

const HISTORY_LIMIT = 30
export const CURSOR_STEP = 0.1

export const initialRokuroState: RokuroState = {
  screen: 'menu',
  targetId: null,
  profile: createLump(),
  shapeHistory: [],
  paint: EMPTY_PAINT,
  paintHistory: [],
  tool: 'all',
  color: 'sky',
  cursor: 0.5,
  paintFull: false,
  saved: false,
}

function pushed<T>(history: readonly T[], value: T): readonly T[] {
  return [...history, value].slice(-HISTORY_LIMIT)
}

function withProfile(state: RokuroState, profile: Profile): RokuroState {
  if (profile === state.profile) return state
  return { ...state, profile, shapeHistory: pushed(state.shapeHistory, state.profile) }
}

function withStroke(state: RokuroState, stroke: Stroke): RokuroState {
  const room = MAX_TOTAL_POINTS - totalPoints(state.paint)
  if (room <= 0 || stroke.points.length === 0) return { ...state, paintFull: room <= 0 }
  const points = stroke.points.slice(0, Math.min(room, MAX_STROKE_POINTS))
  const paint = { ...state.paint, strokes: [...state.paint.strokes, { ...stroke, points }] }
  return { ...state, paint, paintHistory: pushed(state.paintHistory, state.paint), paintFull: totalPoints(paint) >= MAX_TOTAL_POINTS }
}

function fresh(state: RokuroState, targetId: TargetId | null): RokuroState {
  return { ...initialRokuroState, screen: 'shape', targetId, color: state.color }
}

export function rokuroReducer(state: RokuroState, action: RokuroAction): RokuroState {
  switch (action.type) {
    case 'start':
      return fresh(state, action.targetId)
    case 'restart':
      return fresh(state, state.targetId)
    case 'back': {
      const previous: Record<Screen, Screen> = { menu: 'menu', shape: 'menu', paint: 'shape', bake: 'paint', done: 'menu' }
      return { ...state, screen: previous[state.screen] }
    }
    case 'profile':
      return state.screen === 'shape' ? withProfile(state, action.profile) : state
    case 'stretch':
      return state.screen === 'shape' ? withProfile(state, stretchProfile(state.profile, action.direction)) : state
    case 'nudge':
      return state.screen === 'shape' ? withProfile(state, nudgeProfile(state.profile, state.cursor, action.delta)) : state
    case 'cursor':
      return { ...state, cursor: Math.round(Math.min(1, Math.max(0, state.cursor + action.step * CURSOR_STEP)) * 10) / 10 }
    case 'undoShape': {
      const previous = state.shapeHistory[state.shapeHistory.length - 1]
      return previous ? { ...state, profile: previous, shapeHistory: state.shapeHistory.slice(0, -1) } : state
    }
    case 'resetShape':
      return withProfile(state, createLump())
    case 'toPaint':
      return state.screen === 'shape' ? { ...state, screen: 'paint' } : state
    case 'tool':
      return { ...state, tool: action.tool }
    case 'color':
      return { ...state, color: action.color }
    case 'base': {
      const color = action.base ?? state.color
      if (state.screen !== 'paint' || state.paint.base === action.base) return { ...state, color }
      return { ...state, color, paint: { ...state.paint, base: action.base }, paintHistory: pushed(state.paintHistory, state.paint) }
    }
    case 'stroke':
      return state.screen === 'paint' ? withStroke(state, action.stroke) : state
    case 'paintRing':
      return state.screen === 'paint' && state.tool !== 'all' ? withStroke(state, ringStroke(wallFractionAtHeight(state.profile, state.cursor), state.color, state.tool)) : state
    case 'undoPaint': {
      const previous = state.paintHistory[state.paintHistory.length - 1]
      return previous ? { ...state, paint: previous, paintHistory: state.paintHistory.slice(0, -1), paintFull: false } : state
    }
    case 'bake':
      return state.screen === 'paint' ? { ...state, screen: 'bake', saved: false } : state
    case 'baked':
      return state.screen === 'bake' ? { ...state, screen: 'done' } : state
    case 'saved':
      return { ...state, saved: true }
  }
}
