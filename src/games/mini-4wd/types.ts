export type PartCategory = 'body' | 'motor' | 'tires' | 'rollers'

export type Build = Record<PartCategory, string> & { color: string }

export type CarStats = { speed: number; grip: number; stability: number }

export type Part = {
  id: string
  name: string
  description: string
  icon: string
  stats: CarStats
}

export type TrackPoint = { x: number; y: number }
export type TrackZone = {
  /** Fraction of one lap, in the direction of travel. */
  start: number
  end: number
  kind: 'curve' | 'jump' | 'wave'
  severity: number
}

export type Course = {
  id: string
  name: string
  subtitle: string
  theme: 'park' | 'forest' | 'coast' | 'night'
  accent: string
  points: TrackPoint[]
  length: number
  zones: TrackZone[]
}

export type Racer = {
  /** Zero is the player; one and two are the rival cars. */
  id: number
  name: string
  build: Build
  distance: number
  speed: number
  finishTime: number | null
  wobble: number
  stats: CarStats
  recovery: number
  zoneKey: string | null
}

export type RaceEvent = {
  kind: 'go' | 'lap' | 'bump' | 'finish'
  racer: number
}

export type RaceState = {
  course: Course
  racers: Racer[]
  phase: 'countdown' | 'racing' | 'finished'
  countdown: number
  elapsed: number
  lapCount: number
  /** Events from the most recent step. Consume before the next step. */
  events: RaceEvent[]
}
