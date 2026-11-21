export const LAPS = 2
export const STEP = 1 / 30
export const RECHARGE = 4
export const BOOST_TIME = 1.35

export function grid() {
  return { distance: 0, elapsed: 0, cooldown: 0 }
}
export type Race = ReturnType<typeof grid>

// Distances are in laps, including the two rivals' staggered grid positions.
export function rivals(elapsed: number) {
  return [0.024 + elapsed / 14.3, 0.052 + elapsed / 13.9]
}

export function position(race: Race) {
  return 1 + rivals(race.elapsed).filter(distance => distance > race.distance).length
}

export function advance(race: Race): Race {
  if (race.distance >= LAPS) return race
  const boosted = race.cooldown > RECHARGE - BOOST_TIME
  const speed = (boosted ? 1.62 : 1) / 15
  const dt = Math.min(STEP, (LAPS - race.distance) / speed)
  return {
    distance: Math.min(LAPS, race.distance + dt * speed),
    elapsed: race.elapsed + dt,
    cooldown: Math.max(0, race.cooldown - dt),
  }
}
