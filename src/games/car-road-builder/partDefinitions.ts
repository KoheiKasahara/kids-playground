import {
  DIRECTIONS,
  normalizeRotationStep,
  rotateDirection,
  type Direction,
} from './direction'

export type PartKind = 'start' | 'straight' | 'curve' | 'goal'

/** The only state needed to describe a placed road part. */
export type PlacedPart = Readonly<{
  kind: PartKind
  rotationStep: number
}>

export type PartDefinition = Readonly<{
  kind: PartKind
  label: string
  emoji: string
  /** Ports before rotation. */
  baseConnections: readonly Direction[]
  /** Rotations exposed by the palette. */
  rotationSteps: readonly number[]
}>

const ALL_ROTATIONS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7])
const STRAIGHT_ROTATIONS = Object.freeze([0, 1, 2, 3])

export const PART_DEFINITIONS: Readonly<Record<PartKind, PartDefinition>> = {
  start: {
    kind: 'start',
    label: 'スタート',
    emoji: '🚩',
    baseConnections: ['N'],
    rotationSteps: ALL_ROTATIONS,
  },
  straight: {
    kind: 'straight',
    label: 'まっすぐ',
    emoji: '━',
    baseConnections: ['N', 'S'],
    // N-S, NE-SW, E-W and SE-NW.  Opposite pairs make steps 4..7 duplicates.
    rotationSteps: STRAIGHT_ROTATIONS,
  },
  curve: {
    kind: 'curve',
    label: 'カーブ',
    emoji: '⌒',
    baseConnections: ['N', 'E'],
    rotationSteps: ALL_ROTATIONS,
  },
  goal: {
    kind: 'goal',
    label: 'ゴール',
    emoji: '🏁',
    // A goal accepts a car from every direction and does not rotate.
    baseConnections: DIRECTIONS,
    rotationSteps: [0],
  },
} as const

export const PART_KINDS: readonly PartKind[] = ['start', 'straight', 'curve', 'goal']

export function getPartDefinition(kind: PartKind): PartDefinition {
  return PART_DEFINITIONS[kind]
}

export function isPartKind(value: unknown): value is PartKind {
  return typeof value === 'string' && PART_KINDS.includes(value as PartKind)
}

export function allowedRotationSteps(kind: PartKind): readonly number[] {
  return PART_DEFINITIONS[kind].rotationSteps
}

export function normalizePartRotation(kind: PartKind, rotationStep: number): number {
  if (kind === 'goal') return 0
  const normalized = normalizeRotationStep(rotationStep)
  if (kind === 'straight') return normalized % 4
  return normalized
}

export function createPlacedPart(kind: PartKind, rotationStep = 0): PlacedPart {
  return { kind, rotationStep: normalizePartRotation(kind, rotationStep) }
}

/** Derive ports every time; connections are never persisted on a placed part. */
export function connectionsForPart(part: PlacedPart): readonly Direction[] {
  if (part.kind === 'goal') return DIRECTIONS
  const definition = PART_DEFINITIONS[part.kind]
  return definition.baseConnections.map((direction) => rotateDirection(direction, part.rotationStep))
}

export const getPartConnections = connectionsForPart
export const partConnections = connectionsForPart
export const portsForPart = connectionsForPart

export function hasPartConnection(part: PlacedPart, direction: Direction): boolean {
  return connectionsForPart(part).includes(direction)
}

export function rotatePlacedPart(part: PlacedPart, amount = 1): PlacedPart {
  return createPlacedPart(part.kind, part.rotationStep + amount)
}
