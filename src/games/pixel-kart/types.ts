export type CourseId = 'forest' | 'coast' | 'crystal' | 'sky'
export type ItemId = 'boost' | 'jump' | 'star' | 'bomb' | 'puddle'
export type Point = { x: number; y: number }
export type TrackPoint = Point & { angle: number; curve: number }
export type Course = {
  id: CourseId; name: string; subtitle: string; accent: string
  length: number; halfWidth: number; points: TrackPoint[]
}
export type Racer = {
  id: number; name: string; color: string; distance: number; lane: number; speed: number
  item: ItemId | null; boost: number; jump: number; star: number; stun: number
  protection: number; drift: number; finished: boolean; finishTime: number | null
}
export type Hazard = { id: number; owner: number; distance: number; lane: number; life: number }
export type Projectile = { id: number; owner: number; target: number; distance: number; lane: number; life: number }
export type RaceEvent = { id: number; kind: 'pickup' | 'boost' | 'jump' | 'star' | 'bomb' | 'puddle' | 'hit' | 'lap' | 'finish'; racer: number }
export type RaceState = {
  course: Course; racers: Racer[]; hazards: Hazard[]; projectiles: Projectile[]
  elapsed: number; countdown: number; phase: 'countdown' | 'racing' | 'finished'
  lapCount: number; assist: boolean; events: RaceEvent[]; nextId: number; seed: number
}
export type RaceInput = { steer: number; useItem: boolean }
