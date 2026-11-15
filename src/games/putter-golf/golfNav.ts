/**
 * パターゴルフの「みちのり」の ちず。Three.js にも 物理エンジンにも 依存しない 計算だけを置く。
 *
 * ゆかを 小さな マス目に わけ、みちすじ（tee → … → cup）の 上の マスに「カップまでの のこりの ながさ」を置く。
 * そこから ボールが とおれる マスだけを たどって ひろげると、どの場所にも「みちすじへ もどって カップまで いく みちのり」が 決まる。
 * かべや たにの むこうがわの みちは とおくなるので、Uの字の みちや じゃま物の かげでも、すすむ ほうが まよわず 分かる。
 * ジャンプ台・トランポリン・どかんの ような ゆかの きれめは、みちすじが こえているので そのまま つながる。
 * みちすじの 上に じゃま物（バンパーや いわ）が あれば、その 手前は よこを まわりこむ みちのりに なる。
 */
import type { Vec2 } from './golfCourses'

export type NavInput = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  route: readonly Vec2[]
  /** ボールの 中心を おけるか（ゆかの上で、かべや じゃま物に かからない）。 */
  passable: (x: number, z: number) => boolean
  cell?: number
}

export type NavField = {
  /** みちすじの index ばんめの 点から カップまでの みちすじの ながさ。 */
  remaining(index: number): number
  /** p から カップまでの みちのり。たどりつけない 場所は Infinity。snap が false なら、p の マスが とおれないときも Infinity。 */
  costAt(p: Vec2, snap?: boolean): number
  /** p から カップまで みちなりに すすむ 点の ならび（p は ふくまない）。 */
  pathFrom(p: Vec2): Vec2[]
  /** a から b まで まっすぐ ころがせるか。 */
  clear(a: Vec2, b: Vec2): boolean
  /** p から みちなりに すすむときの、まっすぐ 見とおせる いちばん 先の 点。 */
  lookAhead(p: Vec2): Vec2 | null
}

const NEIGHBORS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]] as const
/** これより 近い 点は、むきが ふらつくので 見る 先に しない。 */
const NEAR = 0.6

export function createNavField({ bounds, route, passable, cell = 0.2 }: NavInput): NavField {
  const originX = bounds.minX - cell * 2
  const originZ = bounds.minZ - cell * 2
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cell) + 5
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell) + 5
  const size = cols * rows
  // 0: まだ しらべていない、1: とおれる、2: とおれない。
  const state = new Uint8Array(size)
  const centerX = (col: number) => originX + (col + 0.5) * cell
  const centerZ = (row: number) => originZ + (row + 0.5) * cell
  const open = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return false
    const index = row * cols + col
    if (state[index] === 0) state[index] = passable(centerX(col), centerZ(row)) ? 1 : 2
    return state[index] === 1
  }
  const colOf = (x: number) => Math.floor((x - originX) / cell)
  const rowOf = (z: number) => Math.floor((z - originZ) / cell)

  const along: number[] = [0]
  for (let index = 1; index < route.length; index++) along.push(along[index - 1]! + Math.hypot(route[index]!.x - route[index - 1]!.x, route[index]!.z - route[index - 1]!.z))
  const total = along[along.length - 1] ?? 0

  const cost = new Float32Array(size).fill(Infinity)
  /** みちすじの 上の マスは、みちすじの はじめからの ながさを おぼえる（-1 は みちすじの 外）。 */
  const routeAt = new Float32Array(size).fill(-1)
  const heap: number[] = []
  const push = (index: number) => {
    heap.push(index)
    let child = heap.length - 1
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (cost[heap[parent]!]! <= cost[heap[child]!]!) break
      ;[heap[parent], heap[child]] = [heap[child]!, heap[parent]!]
      child = parent
    }
  }
  const pop = (): number => {
    const top = heap[0]!
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let parent = 0
      for (;;) {
        const left = parent * 2 + 1
        const right = left + 1
        let least = parent
        if (left < heap.length && cost[heap[left]!]! < cost[heap[least]!]!) least = left
        if (right < heap.length && cost[heap[right]!]! < cost[heap[least]!]!) least = right
        if (least === parent) break
        ;[heap[parent], heap[least]] = [heap[least]!, heap[parent]!]
        parent = least
      }
    }
    return top
  }

  for (let index = 0; index < route.length - 1; index++) {
    const a = route[index]!
    const b = route[index + 1]!
    const length = along[index + 1]! - along[index]!
    const steps = Math.max(1, Math.ceil(length / (cell * 0.5)))
    const cells: number[] = []
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      const col = colOf(a.x + (b.x - a.x) * t)
      const row = rowOf(a.z + (b.z - a.z) * t)
      cells.push(open(col, row) ? row * cols + col : -1)
    }
    // とちゅうで とぎれる 区間（ゆかの きれめを とびこえる ジャンプ台・トランポリン・どかん、みちの 上の じゃま物）は、
    // とぎれた 先だけに 置く。手前は 区間の はじめの 点から たどるので、きれめの きわへ よっても すすんだ ことに ならず、
    // じゃま物の 手前は よこを まわりこむ みちのりに なる。
    const resume = cells.lastIndexOf(-1) + 1
    cells.forEach((cellIndex, step) => {
      if (cellIndex < 0 || (step < resume && step > 0)) return
      const at = along[index]! + (length * step) / steps
      if (total - at < cost[cellIndex]!) { cost[cellIndex] = total - at; routeAt[cellIndex] = at }
    })
  }
  for (let index = 0; index < size; index++) if (routeAt[index]! >= 0) push(index)
  const settled = new Uint8Array(size)
  while (heap.length) {
    const index = pop()
    if (settled[index]) continue
    settled[index] = 1
    const col = index % cols
    const row = (index - col) / cols
    for (const [dc, dr, step] of NEIGHBORS) {
      const nc = col + dc
      const nr = row + dr
      if (!open(nc, nr)) continue
      // ななめは、両どなりも とおれるときだけ（かどを すりぬけない）。
      if (dc !== 0 && dr !== 0 && (!open(col + dc, row) || !open(col, row + dr))) continue
      const next = nr * cols + nc
      // みちすじの 上の マスは みちすじの ながさの まま（近道で 書きかえない）。
      if (routeAt[next]! >= 0) continue
      const value = cost[index]! + step * cell
      if (value < cost[next]!) { cost[next] = value; push(next) }
    }
  }

  /** p の マス。とおれない マスなら、まわりの いちばん 近い とおれる マス。 */
  function cellNear(p: Vec2): number {
    const col = colOf(p.x)
    const row = rowOf(p.z)
    let best = -1
    let bestGap = Infinity
    for (let ring = 0; ring <= 4 && best < 0; ring++) {
      for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue
        const c = col + dc
        const r = row + dr
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        const index = r * cols + c
        if (!Number.isFinite(cost[index]!)) continue
        const gap = Math.hypot(centerX(c) - p.x, centerZ(r) - p.z)
        if (gap < bestGap) { bestGap = gap; best = index }
      }
    }
    return best
  }

  function clear(a: Vec2, b: Vec2): boolean {
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    const steps = Math.max(1, Math.ceil(length / (cell * 0.5)))
    // はじめの マスは しらべない（かべぎわに 止まった ボールでも 見とおせるように）。
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      if (Math.hypot(x - a.x, z - a.z) < cell) continue
      if (!open(colOf(x), rowOf(z))) return false
    }
    return true
  }

  function pathFrom(p: Vec2): Vec2[] {
    const points: Vec2[] = []
    let index = cellNear(p)
    if (index < 0) return points
    for (let guard = 0; guard < size && routeAt[index]! < 0; guard++) {
      const col = index % cols
      const row = (index - col) / cols
      let next = -1
      for (const [dc, dr] of NEIGHBORS) {
        const nc = col + dc
        const nr = row + dr
        if (!open(nc, nr)) continue
        if (dc !== 0 && dr !== 0 && (!open(col + dc, row) || !open(col, row + dr))) continue
        const candidate = nr * cols + nc
        if (cost[candidate]! < cost[next < 0 ? index : next]!) next = candidate
      }
      if (next < 0) break
      index = next
      points.push({ x: centerX(index % cols), z: centerZ((index - (index % cols)) / cols) })
    }
    const joined = routeAt[index]!
    if (joined < 0) return points
    for (let vertex = 0; vertex < route.length; vertex++) {
      if (along[vertex]! > joined + 1e-4) points.push({ x: route[vertex]!.x, z: route[vertex]!.z })
    }
    return points
  }

  return {
    remaining(index: number) { return total - (along[Math.max(0, Math.min(along.length - 1, index))] ?? 0) },
    costAt(p: Vec2, snap = true) {
      if (!snap) {
        const col = colOf(p.x)
        const row = rowOf(p.z)
        return col < 0 || row < 0 || col >= cols || row >= rows ? Infinity : cost[row * cols + col]!
      }
      const index = cellNear(p)
      if (index < 0) return Infinity
      const col = index % cols
      return cost[index]! + Math.hypot(centerX(col) - p.x, centerZ((index - col) / cols) - p.z) * 0.5
    },
    pathFrom,
    clear,
    lookAhead(p: Vec2) {
      const path = pathFrom(p)
      let best: Vec2 | null = null
      for (const point of path) {
        if (Math.hypot(point.x - p.x, point.z - p.z) < NEAR) continue
        if (clear(p, point)) best = point
      }
      // 見とおせる 点が なければ（とびこえる 先など）、みちなりの つぎの 点。
      return best ?? path.find(point => Math.hypot(point.x - p.x, point.z - p.z) >= NEAR) ?? path[path.length - 1] ?? null
    },
  }
}
