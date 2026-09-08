export type ItemKind = 'acorn' | 'gift' | 'snowman' | 'tree' | 'car'
export const ITEM_TYPES = {
  acorn: { label: 'どんぐり', emoji: '🌰', required: 0.6, size: 0.28, growth: 0.035, count: 16, ring: 3.5 },
  gift: { label: 'プレゼント', emoji: '🎁', required: 1, size: 0.48, growth: 0.055, count: 14, ring: 6.5 },
  snowman: { label: 'ゆきだるま', emoji: '⛄', required: 1.55, size: 0.75, growth: 0.075, count: 10, ring: 10 },
  tree: { label: 'もみのき', emoji: '🌲', required: 2.2, size: 1.1, growth: 0.1, count: 8, ring: 13 },
  car: { label: 'くるま', emoji: '🚙', required: 2.95, size: 1.45, growth: 0.13, count: 6, ring: 16 },
} as const
export const START_RADIUS = 0.65
export const GOAL_RADIUS = 3.85
export const FIELD_LIMIT = 21
export type SnowItem = { id: number; kind: ItemKind; x: number; z: number; collected: boolean }
export type SnowWorld = { x: number; z: number; radius: number; collected: number; won: boolean; items: SnowItem[] }
export type SnowUpdate = { picked: SnowItem[]; blocked: ItemKind | null; justWon: boolean }

export function createSnowWorld(): SnowWorld {
  const items: SnowItem[] = []
  for (const [kind, config] of Object.entries(ITEM_TYPES)) {
    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2 + config.ring * 0.3
      const distance = config.ring + (i % 2) * 0.8
      items.push({ id: items.length, kind: kind as ItemKind, x: Math.cos(angle) * distance, z: Math.sin(angle) * distance, collected: false })
    }
  }
  return { x: 0, z: 0, radius: START_RADIUS, collected: 0, won: false, items }
}

export function progress(world: SnowWorld): number {
  return Math.min(1, Math.max(0, (world.radius - START_RADIUS) / (GOAL_RADIUS - START_RADIUS)))
}

/** Bounded, frame-rate-independent movement; an oversized object gently pushes back. */
export function stepSnowWorld(world: SnowWorld, direction: { x: number; z: number }, seconds: number): SnowUpdate {
  const result: SnowUpdate = { picked: [], blocked: null, justWon: false }
  if (world.won) return result
  const dt = Math.max(0, Math.min(seconds, 0.05))
  const length = Math.hypot(direction.x, direction.z)
  if (!Number.isFinite(length) || length === 0 || dt === 0) return result
  const speed = 3.8 + world.radius * 0.7
  world.x += direction.x / Math.max(1, length) * speed * dt
  world.z += direction.z / Math.max(1, length) * speed * dt
  for (const item of world.items) {
    if (item.collected) continue
    const config = ITEM_TYPES[item.kind]
    const dx = world.x - item.x
    const dz = world.z - item.z
    const distance = Math.hypot(dx, dz)
    const contact = world.radius + config.size * 0.65
    if (distance > contact) continue
    if (world.radius + 1e-9 >= config.required) {
      item.collected = true
      world.collected++
      world.radius += config.growth
      result.picked.push(item)
    } else {
      result.blocked = item.kind
      const nx = distance > 0.001 ? dx / distance : -direction.x / length
      const nz = distance > 0.001 ? dz / distance : -direction.z / length
      world.x = item.x + nx * (contact + 0.02)
      world.z = item.z + nz * (contact + 0.02)
    }
  }
  const limit = FIELD_LIMIT - world.radius
  world.x = Math.max(-limit, Math.min(limit, world.x))
  world.z = Math.max(-limit, Math.min(limit, world.z))
  if (world.radius + 1e-9 >= GOAL_RADIUS) {
    world.won = true
    result.justWon = true
  }
  return result
}

export function nextItemKind(radius: number): ItemKind | null {
  return (Object.keys(ITEM_TYPES) as ItemKind[]).find(kind => ITEM_TYPES[kind].required > radius + 1e-9) ?? null
}
