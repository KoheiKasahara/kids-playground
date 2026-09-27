export type CourseId = 'forest' | 'coast' | 'crystal' | 'sky'
export type ItemId = 'boost' | 'jump' | 'star' | 'bomb' | 'puddle'
export type Point = { x: number; y: number }
/** `width` is the road's half-width at this point; it narrows and widens along each course. */
export type TrackPoint = Point & { angle: number; curve: number; width: number }
/**
 * Road features, positioned by race distance and signed lane (+ is right).
 * rough: a slow patch (mud, tide pool, rubble, cloud puff); dash: a speed panel;
 * island: a solid divider that splits the road into two paths.
 */
export type ZoneKind = 'rough' | 'dash' | 'island'
export type CourseZone = { kind: ZoneKind; start: number; end: number; lane: number; half: number }
export type ItemBox = { distance: number; lane: number }
export type Course = {
  id: CourseId; name: string; subtitle: string; accent: string
  length: number; points: TrackPoint[]; zones: CourseZone[]; boxes: ItemBox[]
}
export type Racer = {
  id: number; name: string; color: string; distance: number; lane: number; speed: number
  item: ItemId | null; boost: number; jump: number; star: number; stun: number
  protection: number; drift: number; rough: boolean; finished: boolean; finishTime: number | null
}
export type Hazard = { id: number; owner: number; distance: number; lane: number; life: number }
export type Projectile = { id: number; owner: number; target: number; distance: number; lane: number; life: number }
export type RaceEvent = { id: number; kind: 'pickup' | 'dash' | 'boost' | 'jump' | 'star' | 'bomb' | 'puddle' | 'hit' | 'lap' | 'finish'; racer: number }
export type RaceState = {
  course: Course; racers: Racer[]; hazards: Hazard[]; projectiles: Projectile[]
  elapsed: number; countdown: number; phase: 'countdown' | 'racing' | 'finished'
  lapCount: number; assist: boolean; events: RaceEvent[]; nextId: number; seed: number
}
export type RaceInput = { steer: number; useItem: boolean }
