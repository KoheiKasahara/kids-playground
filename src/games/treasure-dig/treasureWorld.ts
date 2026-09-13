// ざくざく たからほり の砂・水シミュレーション。
// Original cellular automaton written for this game: grains fall, water flows and
// carries the grains it runs over. No physics engine and no copied third-party code.
export const Cell = { Empty: 0, Sand: 1, Gem: 2, Water: 3, Dirt: 4, Rock: 5, Stone: 6, Box: 7, Drain: 8, Spring: 9 } as const
export type Point = { x: number; y: number }
/** ほる=すな/つち/おいた いしを けずる。ほかは その そざいを おく。 */
export type Tool = 'dig' | 'sand' | 'stone' | 'water'
export type Layout = { width: number; height: number; cells: Uint8Array }

// 60 steps/second. A spring drips often enough to keep a channel flowing,
// but slowly enough that a sealed basin fills in a few seconds instead of instantly.
const SPRING_INTERVAL = 8
// How far water peeks sideways for a lower spot before it spreads.
const LOOKAHEAD = 8
// Chance per step that a current drags the grain it runs over. Treasure is the
// heavier grain, so a stream sorts sand out first and moves the gems slowly.
const SAND_DRIFT = 0.5
const GEM_DRIFT = 0.3

export class TreasureWorld {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array
  /** ステージ開始時の たからの つぶ数。ぜんぶ あつめたかの判定に使う。 */
  readonly total: number
  /** たからばこの範囲。中身の たまり具合を えがくために使う。 */
  readonly box: { left: number; right: number; top: number; bottom: number }
  private readonly start: Uint8Array
  private readonly moved: Uint8Array
  private bias: Int8Array
  private nextBias: Int8Array
  private tick = 0
  collected = 0
  lost = 0
  /** まだ ばんめんに のこっている たからの つぶ数。 */
  gems = 0
  /** ちょくぜんの1stepで うごいた つぶの数。0なら すべて とまっている。 */
  activity = 0

  constructor(layout: Layout, readonly need: number, private readonly random: () => number = Math.random) {
    this.width = layout.width
    this.height = layout.height
    this.start = Uint8Array.from(layout.cells)
    this.cells = Uint8Array.from(layout.cells)
    this.moved = new Uint8Array(this.cells.length)
    this.bias = new Int8Array(this.cells.length)
    this.nextBias = new Int8Array(this.cells.length)
    this.box = { left: 0, right: -1, top: 0, bottom: -1 }
    this.measure()
    this.total = this.gems
  }

  get cleared() { return this.collected >= this.need }
  get perfect() { return this.total > 0 && this.collected >= this.total }
  /** のこりを ぜんぶ あつめても とどかない状態。やりなおしを すすめる。 */
  get hopeless() { return this.collected + this.gems < this.need }

  private measure() {
    this.gems = 0
    let left = this.width, right = -1, top = this.height, bottom = -1
    for (let i = 0; i < this.cells.length; i++) {
      const material = this.cells[i]
      if (material === Cell.Gem) this.gems++
      else if (material === Cell.Box) {
        const x = i % this.width, y = Math.floor(i / this.width)
        left = Math.min(left, x); right = Math.max(right, x)
        top = Math.min(top, y); bottom = Math.max(bottom, y)
      }
    }
    Object.assign(this.box, { left, right, top, bottom })
  }

  reset() {
    this.cells.set(this.start)
    this.moved.fill(0)
    this.bias.fill(0)
    this.nextBias.fill(0)
    this.tick = 0
    this.collected = 0
    this.lost = 0
    this.activity = 0
    this.measure()
  }

  /** 外は いわ あつかい。つぶが ばんめんの そとへ こぼれない。 */
  get(x: number, y: number): number {
    return x < 0 || x >= this.width || y < 0 || y >= this.height ? Cell.Rock : this.cells[y * this.width + x]
  }

  private set(x: number, y: number, material: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return
    this.cells[y * this.width + x] = material
  }

  private move(x: number, y: number, nx: number, ny: number) {
    if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return false
    const i = y * this.width + x, j = ny * this.width + nx
    const material = this.cells[i], target = this.cells[j]
    if (target === Cell.Box || target === Cell.Drain) {
      // The chest and the hole swallow whatever arrives; only treasure is counted.
      if (material === Cell.Gem) {
        this.gems--
        if (target === Cell.Box) this.collected++
        else this.lost++
      }
      this.cells[i] = Cell.Empty
      this.moved[i] = 1
      this.activity++
      return true
    }
    if (target !== Cell.Empty) {
      if (target !== Cell.Water || (material !== Cell.Sand && material !== Cell.Gem)) return false
      // Sand settles through water half as often as treasure, so a pond sorts them.
      if (material === Cell.Sand && this.tick % 2 === 0) return false
    }
    this.cells[i] = target
    this.cells[j] = material
    this.moved[i] = this.moved[j] = 1
    this.activity++
    return true
  }

  /** 水は下へ行けないとき、近くの落ち口を探して横へ広がる。 */
  private flow(x: number, y: number, direction: number) {
    let flow = direction, current = false
    for (const sign of [direction, -direction]) {
      for (let d = 1; d <= LOOKAHEAD; d++) {
        if (!this.open(this.get(x + sign * d, y))) break
        if (this.open(this.get(x + sign * d, y + 1))) { flow = sign; current = true; break }
      }
      if (current) break
    }
    for (const sign of [flow, -flow]) {
      if (!this.move(x, y, x + sign, y)) continue
      this.remember(x, y, sign)
      return
    }
    // よこへ 行けないとき、うえに みずが のっていれば その おもみで つぶを かわいた側へ おす。
    // すなや たからの かべは やがて おし流され、いしの かべは もちこたえる。
    if (this.get(x, y - 1) !== Cell.Water) return
    for (const sign of [flow, -flow]) {
      const ahead = this.get(x + sign, y)
      if ((ahead !== Cell.Sand && ahead !== Cell.Gem) || this.get(x + sign * 2, y) !== Cell.Empty) continue
      if (this.moved[y * this.width + x + sign] || this.random() >= (ahead === Cell.Sand ? SAND_DRIFT : GEM_DRIFT)) continue
      if (this.move(x + sign, y, x + sign * 2, y)) {
        this.nextBias[y * this.width + x + sign * 2] = sign
        return
      }
    }
  }

  private open(cell: number) {
    return cell === Cell.Empty || cell === Cell.Box || cell === Cell.Drain
  }

  /**
   * 流れた向きを おぼえておく。まえ・うしろにも 残すことで ながれが 一方向に そろい、
   * ひとつ下の ますにも 残すことで、つぎのstepで その上を通った つぶを おし流せる。
   */
  private remember(x: number, y: number, sign: number) {
    for (const [bx, by] of [[x, y], [x + sign, y], [x - sign, y], [x, y + 1]]) {
      if (bx < 0 || bx >= this.width || by < 0 || by >= this.height) continue
      this.nextBias[by * this.width + bx] = sign
    }
  }

  step() {
    this.tick++
    this.moved.fill(0)
    this.nextBias.fill(0)
    this.activity = 0
    const reverse = this.tick % 2 === 0
    for (let y = this.height - 1; y >= 0; y--) {
      for (let n = 0; n < this.width; n++) {
        const x = reverse ? this.width - 1 - n : n
        const i = y * this.width + x
        if (this.moved[i]) continue
        const material = this.cells[i]
        if (material === Cell.Spring) {
          // 列ごとに わき出す間隔を ずらして、横一線ではなく 雨のように 落ちるようにする。
          if ((this.tick + x * 3) % SPRING_INTERVAL === 0 && this.get(x, y + 1) === Cell.Empty) {
            this.set(x, y + 1, Cell.Water)
            this.moved[(y + 1) * this.width + x] = 1
          }
          continue
        }
        if (material !== Cell.Sand && material !== Cell.Gem && material !== Cell.Water) continue
        if (this.move(x, y, x, y + 1)) continue
        const momentum = this.bias[i]
        if (material === Cell.Water) {
          // ながれている みずは すぐに ななめへ 落ちず、その向きへ はしり続ける。
          // これで 水路の ながれが とぎれず、つぶを さきへ はこべる。
          if (momentum && this.get(x + momentum, y) === Cell.Empty && this.move(x, y, x + momentum, y)) {
            this.remember(x, y, momentum)
            continue
          }
          const direction = momentum || (this.random() < 0.5 ? 1 : -1)
          if (this.move(x, y, x + direction, y + 1) || this.move(x, y, x - direction, y + 1)) continue
          this.flow(x, y, direction)
          continue
        }
        const direction = this.random() < 0.5 ? 1 : -1
        if (this.move(x, y, x + direction, y + 1) || this.move(x, y, x - direction, y + 1)) continue
        if (momentum && this.random() < (material === Cell.Sand ? SAND_DRIFT : GEM_DRIFT)) this.move(x, y, x + momentum, y)
      }
    }
    const previous = this.bias
    this.bias = this.nextBias
    this.nextBias = previous
  }

  /** 道具を1か所へ当てる。変えた ますの数を返す（音を鳴らすかの判断に使う）。 */
  apply(point: Point, tool: Tool, radius: number) {
    const cx = Math.round(point.x), cy = Math.round(point.y)
    let changed = 0
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const x = cx + dx, y = cy + dy
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue
      const next = replacement(tool, this.cells[y * this.width + x])
      if (next === null) continue
      this.set(x, y, next)
      changed++
    }
    return changed
  }

  stroke(from: Point, to: Point, tool: Tool, radius: number) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius)))
    let changed = 0
    for (let i = 0; i <= steps; i++) {
      changed += this.apply({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }, tool, radius)
    }
    return changed
  }
}

/** その ますに 道具を あてた 結果。null は「なにも おきない」。 */
function replacement(tool: Tool, current: number): number | null {
  // いわ・たから・たからばこ・あなは ほれない。おいた いしだけは ほりなおせる。
  if (tool === 'dig') return current === Cell.Sand || current === Cell.Dirt || current === Cell.Stone ? Cell.Empty : null
  if (current !== Cell.Empty && !(current === Cell.Water && tool !== 'water')) return null
  return tool === 'sand' ? Cell.Sand : tool === 'stone' ? Cell.Stone : Cell.Water
}

// ドット絵の色。ざらつきと きらめきは ますの位置と フレームから決めるので、
// 乱数を持たなくても 毎フレーム同じ絵にならず、砂の粒立ちが出る。
const COLORS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], [216, 186, 130], [255, 196, 40], [58, 134, 214], [126, 88, 56],
  [92, 90, 104], [176, 178, 190], [78, 48, 28], [26, 22, 38], [150, 226, 255],
]
const SPARKLE: readonly [number, number, number] = [255, 250, 214]

export function renderWorld(world: TreasureWorld, pixels: Uint8ClampedArray, frame: number) {
  const { width, box, need } = world
  const height = box.bottom - box.top + 1
  // たからばこは あつめた ぶんだけ 下から きんいろに なる。
  const filled = need > 0 ? Math.round(Math.min(1, world.collected / need) * height) : 0
  const fillTop = box.bottom - filled + 1
  for (let i = 0; i < world.cells.length; i++) {
    const material = world.cells[i], offset = i * 4
    if (material === Cell.Empty) { pixels[offset + 3] = 0; continue }
    const x = i % width, y = Math.floor(i / width)
    let color: readonly [number, number, number] = COLORS[material]
    let shade = ((x * 7 + y * 13) % 5 - 2) * 5
    switch (material) {
      case Cell.Gem:
        if ((x * 5 + y * 3 + frame) % 19 < 2) color = SPARKLE
        break
      case Cell.Water:
        // みなもを明るく、流れの筋を ゆっくり 動かす。
        if (world.get(x, y - 1) === Cell.Empty) shade += 34
        else if ((x * 2 + y * 3 + frame) % 23 < 3) shade += 16
        break
      case Cell.Rock:
        // かたまりごとの 濃淡にして、細かい しま模様に 見えないようにする。
        shade += ((((x >> 2) * 7 + (y >> 2) * 11) % 5) - 2) * 6
        if ((x * 3 + y * 7) % 29 === 0) shade += 22
        break
      case Cell.Stone:
        if (x % 8 === 0 || y % 5 === 0) shade -= 26
        break
      case Cell.Dirt:
        shade += ((((x >> 2) * 5 + (y >> 2) * 13) % 4) - 1) * 5
        if ((x * 11 + y * 7) % 23 === 0) shade += 26
        break
      case Cell.Box:
        // したから きんいろに たまり、ふちと ふたの おびで たからばこに見せる。
        if (y >= fillTop) color = (x * 5 + y * 3 + frame) % 19 < 2 ? SPARKLE : COLORS[Cell.Gem]
        else if (y <= box.top + 1 || x <= box.left + 1 || x >= box.right - 1) { color = [146, 104, 44]; shade += 12 }
        else if (y % 5 === 0) shade -= 14
        break
      case Cell.Drain:
        // うずを 紫で まわして、「おちると なくなる あな」だと 見て分かるようにする。
        if ((x + y * 2 + frame) % 11 < 3) color = [120, 74, 170]
        break
      case Cell.Spring:
        if ((x * 3 + y + frame) % 13 < 4) shade += 26
        break
    }
    pixels[offset] = color[0] + shade
    pixels[offset + 1] = color[1] + shade
    pixels[offset + 2] = color[2] + shade
    pixels[offset + 3] = 255
  }
}
