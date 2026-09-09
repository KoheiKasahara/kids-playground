import { addCrab, addTurtle, tapCrab, tapTurtle, stepCrabs, stepTurtles, renderCrabs, renderTurtles, type Creature } from './sandboxCrabs'

// Original, bounded falling-sand simulation. No external engine or copied OSS code.
export const Cell = { Empty: 0, Sand: 1, Water: 2, Stone: 3, Seed: 4, Mud: 5, Stem: 6, Petal: 7, Pollen: 8, Root: 9 } as const
export type Material = 0 | 1 | 2 | 3 | 4
export type Point = { x: number; y: number }
type Plant = Point & { height: number; age: number; target: number; cells: Map<number, number> }

export class Sandbox {
  readonly cells: Uint8Array
  private readonly age: Uint16Array
  private readonly moved: Uint8Array
  private plants: Plant[] = []
  private tick = 0
  readonly crabs: Creature[] = []
  readonly turtles: Creature[] = []
  addCrab() { return addCrab(this, this.random) }
  addTurtle() { return addTurtle(this, this.random) }
  tapCrab(point: Point) { return tapCrab(this, point) }
  tapTurtle(point: Point) { return tapTurtle(this, point) }
  bloomingFlowers(): Point[] {
    return this.plants.filter(p => p.height === p.target && this.get(p.x, p.y) === Cell.Root &&
      this.get(p.x, p.y - p.height) === Cell.Pollen).map(p => ({ x: p.x, y: p.y - p.height }))
  }
  eatFlower(point: Point) {
    if (!this.bloomingFlowers().some(p => p.x === point.x && p.y === point.y)) return false
    const plant = this.plants.find(p => p.x === point.x && p.y - p.height === point.y)!
    this.wither(plant)
    this.plants = this.plants.filter(p => p !== plant)
    return true
  }
  private wither(plant: Plant) {
    // Remove only this plant's surviving cells, preserving replacement grains.
    for (const [index, material] of plant.cells) {
      if (this.cells[index] === material) this.set(index % this.width, Math.floor(index / this.width), Cell.Empty)
    }
  }
  private plantCell(plant: Plant, x: number, y: number, material: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    this.set(x, y, material)
    plant.cells.set(y * this.width + x, material)
  }
  flowers = 0
  constructor(readonly width = 144, readonly height = 176, private random = Math.random) {
    this.cells = new Uint8Array(width * height)
    this.age = new Uint16Array(width * height)
    this.moved = new Uint8Array(width * height)
  }
  get(x: number, y: number): number {
    return x < 0 || x >= this.width || y < 0 || y >= this.height ? Cell.Stone : this.cells[y * this.width + x]
  }
  private set(x: number, y: number, material: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    const i = y * this.width + x
    this.cells[i] = material
    this.age[i] = 0
    this.moved[i] = 1
  }
  clear() {
    this.crabs.length = 0
    this.turtles.length = 0
    this.cells.fill(0)
    this.age.fill(0)
    this.plants = []
    this.flowers = 0
  }
  prepare() {
    this.clear()
    for (let x = 0; x < this.width; x++) {
      const depth = Math.round(10 + 9 * Math.sin(x / this.width * Math.PI * 2) ** 2)
      for (let y = this.height - depth; y < this.height; y++) this.set(x, y, Cell.Sand)
    }
  }
  paint(point: Point, material: Material, radius: number) {
    const cx = Math.round(point.x), cy = Math.round(point.y)
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const x = cx + dx, y = cy + dy
      if (material === Cell.Empty || this.get(x, y) === Cell.Empty) this.set(x, y, material)
    }
  }
  stroke(from: Point, to: Point, material: Material, radius: number) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius)))
    for (let i = 0; i <= steps; i++) this.paint({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }, material, radius)
  }
  private move(x: number, y: number, nx: number, ny: number) {
    const i = y * this.width + x, j = ny * this.width + nx
    const destination = this.get(nx, ny)
    const material = this.cells[i]
    if (destination !== Cell.Empty && !(destination === Cell.Water && (material === Cell.Sand || material === Cell.Mud || material === Cell.Seed))) return false
    const age = this.age[i]
    this.cells[i] = destination
    this.cells[j] = material
    this.age[i] = this.age[j]
    this.age[j] = age
    this.moved[i] = this.moved[j] = 1
    return true
  }
  step() {
    this.tick++
    this.moved.fill(0)
    const reverse = this.tick % 2 === 0
    for (let y = this.height - 1; y >= 0; y--) for (let n = 0; n < this.width; n++) {
      const x = reverse ? this.width - n - 1 : n
      const i = y * this.width + x
      let material = this.cells[i]
      if (this.moved[i] || material < Cell.Sand || material > Cell.Mud || material === Cell.Stone) continue
      if (material === Cell.Sand && (this.get(x - 1, y) === Cell.Water || this.get(x + 1, y) === Cell.Water || this.get(x, y - 1) === Cell.Water || this.get(x, y + 1) === Cell.Water)) {
        material = this.cells[i] = Cell.Mud
      }
      // Seeds need damp soil beneath them; dry sand and stone never germinate.
      if (material === Cell.Seed && this.get(x, y + 1) === Cell.Mud) {
        this.age[i]++
        if (this.age[i] >= 18 && y > 12 && (this.get(x, y - 1) === Cell.Empty || this.get(x, y - 1) === Cell.Water) && !this.plants.some(p => Math.abs(p.x - x) < 6 && Math.abs(p.y - y) < 14)) {
          this.set(x, y, Cell.Root)
          this.plants.push({ x, y, height: 0, age: 0, target: 8 + Math.floor(this.random() * 5), cells: new Map([[i, Cell.Root]]) })
        }
        continue
      }
      const direction = this.random() < 0.5 ? -1 : 1
      if (this.move(x, y, x, y + 1)) continue
      if (this.move(x, y, x + direction, y + 1) || this.move(x, y, x - direction, y + 1)) continue
      if (material === Cell.Water) {
        // Prefer a nearby drop, otherwise spread sideways, without crossing a wall.
        let flow = direction
        for (const sign of [direction, -direction]) {
          for (let d = 1; d <= 4; d++) {
            if (this.get(x + sign * d, y) !== Cell.Empty) break
            if (this.get(x + sign * d, y + 1) === Cell.Empty) { flow = sign; break }
          }
        }
        if (!this.move(x, y, x + flow, y)) this.move(x, y, x - flow, y)
      }
    }
    this.grow()
    stepCrabs(this, this.random)
    stepTurtles(this, this.random)
  }
  private grow() {
    this.plants = this.plants.filter(p => {
      const support = this.get(p.x, p.y + 1)
      if (this.get(p.x, p.y) === Cell.Root && (support === Cell.Mud || support === Cell.Sand || support === Cell.Stone)) return true
      this.wither(p)
      return false
    })
    for (const plant of this.plants) {
      if (plant.height >= plant.target || ++plant.age % 4 !== 0) continue
      const y = plant.y - plant.height - 1
      // A puddle must not make watering a failure: shoots can grow through water.
      if (this.get(plant.x, y) !== Cell.Empty && this.get(plant.x, y) !== Cell.Water) continue
      this.plantCell(plant, plant.x, y, Cell.Stem)
      plant.height++
      if (plant.height % 3 === 0) {
        const side = plant.height % 2 ? -1 : 1
        if (this.get(plant.x + side, y) === Cell.Empty) this.plantCell(plant, plant.x + side, y, Cell.Stem)
      }
      if (plant.height === plant.target) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3) continue
          if (this.get(plant.x + dx, y + dy) === Cell.Empty) this.plantCell(plant, plant.x + dx, y + dy, Cell.Petal)
        }
        this.plantCell(plant, plant.x, y, Cell.Pollen)
        this.flowers++
      }
    }
  }
  shake() {
    // Lift loose grains into available space; stone walls and rooted flowers stay put.
    for (let y = 1; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const material = this.get(x, y)
      if (material < Cell.Sand || material > Cell.Mud || material === Cell.Stone) continue
      let ny = y
      const lift = 4 + Math.floor(this.random() * 12)
      while (y - ny < lift && this.get(x, ny - 1) === Cell.Empty) ny--
      if (ny !== y) this.move(x, y, x, ny)
    }
  }
}

const COLORS = [[0, 0, 0], [239, 187, 92], [62, 164, 225], [118, 131, 151], [126, 81, 44], [153, 105, 64], [67, 148, 76], [246, 132, 172], [255, 226, 97], [71, 125, 63]]
export function renderSandbox(world: Sandbox, pixels: Uint8ClampedArray) {
  for (let i = 0; i < world.cells.length; i++) {
    const material = world.cells[i], offset = i * 4
    const color = COLORS[material]
    const variation = ((i * 17 + Math.floor(i / world.width) * 13) % 7 - 3) * 3
    pixels[offset] = color[0] + variation
    pixels[offset + 1] = color[1] + variation
    pixels[offset + 2] = color[2] + variation
    pixels[offset + 3] = material === Cell.Empty ? 0 : 255
  }
  renderCrabs(world, pixels)
  renderTurtles(world, pixels)
}
