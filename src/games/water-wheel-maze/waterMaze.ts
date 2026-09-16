// 円形めいろの 水シミュレーション。
// ます目の うえで 水つぶを 落とす セルオートマトンで、物理エンジンは つかわない。
// 円盤が まわっても 水の「下」は つねに 画面の下なので、重力の向きは 固定のまま、
// かべの ほうを 回転ぶん ずらして 読む（rings.ts の ならびを 引きなおす）。

import {
  CATCH_ROW, DISC, GRID_HEIGHT, GRID_WIDTH, POOL_RADIUS, RING_SLOTS,
  buildFixedWalls, gridIndex,
} from './scene'
import { buildRingMasks, normalizeSector, type Ring } from './rings'

/** 1回の step で 円盤を まわせる 角度の上限。いちどに まわしすぎると 水がすり抜ける。 */
export const MAX_ROTATE_PER_STEP = 3

/** 水が よこへ 落ち口を さがす きょり。 */
const LOOKAHEAD = 12

/** かべに のみこまれた 水つぶを おし出すとき、どこまで はなれた ますを さがすか。 */
const PUSH_RANGE = 5

/** おし出す 向きの ゆうせん順。うえ・よこを さきに見て、かべの外へ すくい上げる。 */
const PUSH_DIRECTIONS = [
  [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1],
] as const

export class WaterMaze {
  readonly width = GRID_WIDTH
  readonly height = GRID_HEIGHT
  /** 1=水つぶ。えがく がわも この配列を そのまま読む。 */
  readonly water = new Uint8Array(GRID_WIDTH * GRID_HEIGHT)
  /** はじめに おいた 水つぶの かず。 */
  readonly total: number
  /** いまの 円盤の むき（度）。0..359。 */
  rotation = 0
  /** すいしゃに とどいた 水つぶの かず。 */
  caught = 0
  /** まだ ばんめんに のこっている 水つぶの かず。 */
  remaining = 0
  /** ちょくぜんの step で うごいた つぶの かず。0なら すべて とまっている。 */
  activity = 0

  private readonly fixed = buildFixedWalls()
  private readonly ringSlot: Int8Array
  private readonly sector: Uint16Array
  /** かべを 持つ ますだけを 集めた 索引。回転のたびに ばんめん全体を なめないための もの。 */
  private readonly ringCells: Int32Array
  private readonly masks: (Uint8Array | null)[]
  private readonly moved = new Uint8Array(GRID_WIDTH * GRID_HEIGHT)
  private bias = new Int8Array(GRID_WIDTH * GRID_HEIGHT)
  private nextBias = new Int8Array(GRID_WIDTH * GRID_HEIGHT)
  private tick = 0

  constructor(rings: readonly Ring[], private readonly random: () => number = Math.random) {
    this.ringSlot = new Int8Array(GRID_WIDTH * GRID_HEIGHT).fill(-1)
    this.sector = new Uint16Array(GRID_WIDTH * GRID_HEIGHT)
    this.masks = buildRingMasks(rings, RING_SLOTS.length)
    const ringCells: number[] = []
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const dx = x + 0.5 - DISC.x
        const dy = y + 0.5 - DISC.y
        const distance = Math.hypot(dx, dy)
        if (distance > DISC.radius) continue
        const index = gridIndex(x, y)
        this.sector[index] = normalizeSector(Math.round(Math.atan2(dy, dx) * 180 / Math.PI))
        const slot = RING_SLOTS.findIndex((ring) => distance >= ring.inner && distance < ring.outer)
        if (slot < 0) continue
        this.ringSlot[index] = slot
        // かべの ない slot は 回転しても ずっと 素通りなので 索引に入れない。
        if (this.masks[slot]) ringCells.push(index)
      }
    }
    this.ringCells = Int32Array.from(ringCells)
    this.total = this.fill()
    this.remaining = this.total
  }

  /** まんなかの みずたまりを 水で みたす。もどした つぶの かずを返す。 */
  private fill(): number {
    let count = 0
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const index = gridIndex(x, y)
        const inside = Math.hypot(x + 0.5 - DISC.x, y + 0.5 - DISC.y) < POOL_RADIUS
        this.water[index] = inside ? 1 : 0
        if (inside) count++
      }
    }
    return count
  }

  reset(): void {
    this.rotation = 0
    this.caught = 0
    this.activity = 0
    this.tick = 0
    this.moved.fill(0)
    this.bias.fill(0)
    this.nextBias.fill(0)
    this.remaining = this.fill()
  }

  /** そのますが かべかどうか。ばんめんの そとは かべ あつかいにして、つぶを こぼさない。 */
  isWall(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true
    const index = gridIndex(x, y)
    if (this.fixed[index]) return true
    const slot = this.ringSlot[index]
    if (slot < 0) return false
    const mask = this.masks[slot]
    return mask ? mask[normalizeSector(this.sector[index] - this.rotation)] === 1 : false
  }

  /** つぶが 入れる ますかどうか。 */
  private isOpen(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false
    return !this.isWall(x, y) && this.water[gridIndex(x, y)] === 0
  }

  /**
   * 円盤を まわす。いちどに まわしすぎると かべが 水を すり抜けるので、
   * すこしずつ まわしては そのつど かべの中の つぶを おし出す。
   */
  rotate(delta: number): void {
    let left = Math.round(delta)
    const direction = Math.sign(left)
    while (left !== 0) {
      const step = direction * Math.min(Math.abs(left), MAX_ROTATE_PER_STEP)
      this.rotation = normalizeSector(this.rotation + step)
      this.evacuate()
      left -= step
    }
  }

  /** かべが 通りすぎた ところに のこった つぶを、近くの あいている ますへ にがす。 */
  private evacuate(): void {
    for (const index of this.ringCells) {
      if (this.water[index] === 0) continue
      const x = index % GRID_WIDTH
      const y = (index - x) / GRID_WIDTH
      if (!this.isWall(x, y)) continue
      for (let distance = 1; distance <= PUSH_RANGE; distance++) {
        let escaped = false
        for (const [dx, dy] of PUSH_DIRECTIONS) {
          const nx = x + dx * distance
          const ny = y + dy * distance
          if (!this.isOpen(nx, ny)) continue
          this.water[index] = 0
          this.water[gridIndex(nx, ny)] = 1
          this.activity++
          escaped = true
          break
        }
        if (escaped) break
      }
    }
  }

  /** つぶを うつす。CATCH_ROW より下へ 出たら すいしゃに とどいた ことにする。 */
  private move(x: number, y: number, nx: number, ny: number): boolean {
    if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT) return false
    if (this.isWall(nx, ny)) return false
    const from = gridIndex(x, y)
    const to = gridIndex(nx, ny)
    if (this.water[to]) return false
    this.water[from] = 0
    this.moved[from] = 1
    this.activity++
    if (ny >= CATCH_ROW) {
      this.caught++
      this.remaining--
      return true
    }
    this.water[to] = 1
    this.moved[to] = 1
    return true
  }

  /**
   * 下へ 行けない水は、よこの 落ち口を さがして ながれる。
   * 落ち口が 見つかった ときだけ よこへ うごかす。見つからない のに 広がると、
   * たまった水の 表面が いつまでも 左右に ゆれ続けて「とまった」と 判定できなくなる。
   */
  private flow(x: number, y: number, direction: number): void {
    for (const sign of [direction, -direction]) {
      for (let distance = 1; distance <= LOOKAHEAD; distance++) {
        if (!this.isOpen(x + sign * distance, y)) break
        if (!this.isOpen(x + sign * distance, y + 1)) continue
        if (this.move(x, y, x + sign, y)) this.remember(x, y, sign)
        return
      }
    }
  }

  /** ながれた 向きを おぼえて、つぎの step でも おなじ向きへ はしらせる。 */
  private remember(x: number, y: number, sign: number): void {
    for (const [bx, by] of [[x, y], [x + sign, y], [x, y + 1]]) {
      if (bx < 0 || bx >= GRID_WIDTH || by < 0 || by >= GRID_HEIGHT) continue
      this.nextBias[gridIndex(bx, by)] = sign
    }
  }

  step(): void {
    this.tick++
    this.moved.fill(0)
    this.nextBias.fill(0)
    this.activity = 0
    this.evacuate()
    const reverse = this.tick % 2 === 0
    for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
      for (let n = 0; n < GRID_WIDTH; n++) {
        const x = reverse ? GRID_WIDTH - 1 - n : n
        const index = gridIndex(x, y)
        if (this.water[index] === 0 || this.moved[index]) continue
        if (this.move(x, y, x, y + 1)) continue
        const momentum = this.bias[index]
        const direction = momentum || (this.random() < 0.5 ? 1 : -1)
        if (this.move(x, y, x + direction, y + 1) || this.move(x, y, x - direction, y + 1)) continue
        this.flow(x, y, direction)
      }
    }
    const previous = this.bias
    this.bias = this.nextBias
    this.nextBias = previous
  }
}

