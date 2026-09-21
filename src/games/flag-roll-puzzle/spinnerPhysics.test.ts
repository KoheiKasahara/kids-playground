import { describe, expect, test } from 'vitest'
import { CELL_SIZE } from './boardLayout'
import { partDefinition, SPINNER_TYPE_IDS } from './partTypes'
import { spinnerSpec } from './spinnerPhysics'

/** 羽根の先が進む速さ(px/step)。ボールを弾く強さの目安になる。 */
function bladeTipSpeed(typeId: (typeof SPINNER_TYPE_IDS)[number]): number {
  const spec = spinnerSpec(typeId)
  return Math.abs(spec.angularVelocity) * spec.radius
}

describe('spinnerPhysics', () => {
  test('羽根の寸法と回転軸は、パーツ定義の見た目からそのまま読む', () => {
    for (const typeId of SPINNER_TYPE_IDS) {
      const spec = spinnerSpec(typeId)
      const blade = partDefinition(typeId).segments.find((segment) => segment.role === 'blade')!
      expect(spec.radius).toBe(blade.width / 2)
      expect(spec.bladeThickness).toBe(blade.height)
      expect(spec.center).toEqual({ x: blade.offsetX, y: blade.offsetY })
    }
  })

  test('1マス版はアンカーセル中心、2×2版は4マスの中心が回転軸になる', () => {
    expect(spinnerSpec('spinner').center).toEqual({ x: 0, y: 0 })
    expect(spinnerSpec('spinnerLarge').center).toEqual({ x: CELL_SIZE / 2, y: CELL_SIZE / 2 })
    expect(spinnerSpec('spinnerLarge').radius).toBeGreaterThan(spinnerSpec('spinner').radius)
  })

  test('逆回しは、速さはそのままで向きだけが反転する', () => {
    expect(spinnerSpec('spinner').angularVelocity).toBeGreaterThan(0)
    expect(spinnerSpec('spinnerLarge').angularVelocity).toBeGreaterThan(0)
    expect(spinnerSpec('spinnerReverse').angularVelocity).toBe(-spinnerSpec('spinner').angularVelocity)
    expect(spinnerSpec('spinnerLargeReverse').angularVelocity).toBe(-spinnerSpec('spinnerLarge').angularVelocity)
  })

  test('2×2版は角速度を落とし、羽根の先の速さを1マス版とそろえる', () => {
    expect(Math.abs(spinnerSpec('spinnerLarge').angularVelocity))
      .toBeLessThan(Math.abs(spinnerSpec('spinner').angularVelocity))
    // 大きいぶんだけ速く弾くと幼児が球を追えなくなるため、先端の速さで合わせる。
    expect(bladeTipSpeed('spinnerLarge')).toBeCloseTo(bladeTipSpeed('spinner'), 0)
  })

  test('回転盤以外の種類を渡したら例外にする（取り違えに早く気付くため）', () => {
    expect(() => spinnerSpec('bumper')).toThrow(/回転盤ではありません/)
  })
})
