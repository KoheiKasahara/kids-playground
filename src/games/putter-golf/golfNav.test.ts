import { describe, expect, test } from 'vitest'
import { createNavField } from './golfNav'

/** x は -3〜3、z は -5〜5 の ひろば。blocked の 所は とおれない。 */
function field(route: { x: number; z: number }[], blocked: (x: number, z: number) => boolean = () => false) {
  return createNavField({
    bounds: { minX: -3, maxX: 3, minZ: -5, maxZ: 5 },
    route,
    passable: (x, z) => Math.abs(x) < 3 && Math.abs(z) < 5 && !blocked(x, z),
  })
}

describe('パターゴルフの みちのりの ちず', () => {
  test('みちすじの 上では、カップまでの のこりの ながさに なる', () => {
    const nav = field([{ x: 0, z: 4 }, { x: 0, z: -4 }])
    expect(nav.remaining(0)).toBeCloseTo(8, 6)
    expect(nav.remaining(1)).toBe(0)
    expect(nav.costAt({ x: 0, z: 4 })).toBeCloseTo(8, 0)
    expect(nav.costAt({ x: 0, z: 0 })).toBeCloseTo(4, 0)
    // よこへ はなれると、みちすじへ もどる ぶんだけ ながくなる。
    expect(nav.costAt({ x: 2, z: 0 })).toBeGreaterThan(nav.costAt({ x: 0, z: 0 }))
    // ひろばの そとは たどりつけない。
    expect(nav.costAt({ x: 9, z: 9 })).toBe(Infinity)
  })

  // まん中に z = -3 まで のびる しきりの ある Uの字。左を 下り、下で わたり、右を のぼる。
  const divider = (x: number, z: number) => Math.abs(x) < 0.4 && z > -3
  const uRoute = [{ x: -2, z: 4 }, { x: -2, z: -4 }, { x: 2, z: -4 }, { x: 2, z: 4 }]

  test('Uの字では、しきりの むこうの みちを 近いと みなさない', () => {
    const nav = field(uRoute, divider)
    // 左の みちの しきりぎわ。まっすぐなら 右の みち（カップの そば）まで 3m ほどだが、みちのりは ぐるっと まわる。
    const left = nav.costAt({ x: -0.7, z: 3 })
    const right = nav.costAt({ x: 0.7, z: 3 })
    expect(left).toBeGreaterThan(13)
    expect(right).toBeLessThan(4)
    // 見る 先は、しきりを こえない（左の みちを 下へ すすむ ほう）。
    const ahead = nav.lookAhead({ x: -0.7, z: 3 })!
    expect(ahead.x).toBeLessThan(-0.4)
    expect(ahead.z).toBeLessThan(0)
    expect(nav.clear({ x: -0.7, z: 3 }, { x: 0.7, z: 3 })).toBe(false)
    expect(nav.clear({ x: -0.7, z: 3 }, { x: -2, z: -4 })).toBe(true)
  })

  test('みちなりの 点は、しきりを まわりこんで みちすじへ もどり、カップで おわる', () => {
    const nav = field(uRoute, divider)
    const path = nav.pathFrom({ x: -0.7, z: 3 })
    expect(path.at(-1)).toEqual({ x: 2, z: 4 })
    for (const point of path) expect(divider(point.x, point.z)).toBe(false)
    // みちのりは 先へ すすむほど みじかくなる。
    const costs = path.map(point => nav.costAt(point, false))
    costs.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(costs[index]! + 1e-4))
  })

  test('じゃま物の かげでは、よこを ぬける ほうを 見る', () => {
    // みちの まん中に いわ。その すぐ 手前に 止まった ボール。
    const rock = (x: number, z: number) => Math.hypot(x, z) < 0.7
    const nav = field([{ x: 0, z: 4 }, { x: 0, z: -4 }], rock)
    const ball = { x: 0, z: 1.1 }
    expect(nav.clear(ball, { x: 0, z: -4 })).toBe(false)
    const ahead = nav.lookAhead(ball)!
    expect(nav.clear(ball, ahead)).toBe(true)
    // うしろでは なく、いわの よこを 先へ。
    expect(ahead.z).toBeLessThan(ball.z)
    expect(Math.abs(ahead.x)).toBeGreaterThan(0.3)
  })

  test('ゆかの きれめを とびこえる 区間では、きれめの 手前は まだ すすんでいない', () => {
    // z が -1〜1 の あいだは たに。みちすじは ジャンプで こえる。
    const gap = (_x: number, z: number) => Math.abs(z) < 1
    const nav = field([{ x: 0, z: 4 }, { x: 0, z: 2 }, { x: 0, z: -4 }], gap)
    const launch = nav.costAt({ x: 0, z: 2 }, false)
    // ふみきりの 点から たにの きわへ よっても、みちのりは ちぢまない。
    expect(nav.costAt({ x: 0, z: 1.3 }, false)).toBeGreaterThanOrEqual(launch - 1e-4)
    // たにの むこうは ふつうに ちぢむ。
    expect(nav.costAt({ x: 0, z: -2 }, false)).toBeCloseTo(2, 0)
    // 見とおせなくても、見る 先は とびこえた 先の 点。
    expect(nav.lookAhead({ x: 0, z: 2 })).toEqual({ x: 0, z: -4 })
  })
})
