import { describe, expect, test } from 'vitest'
import { pictureScrollHint } from './pictureScrollHint'

describe('pictureScrollHint', () => {
  test('中身が枠に収まっていればスクロール不要なので両方false', () => {
    expect(pictureScrollHint(0, 300, 300)).toEqual({ left: false, right: false })
    expect(pictureScrollHint(0, 200, 300)).toEqual({ left: false, right: false })
  })

  test('レイアウトを持たない環境（すべて0）でも矢印を出さない', () => {
    expect(pictureScrollHint(0, 0, 0)).toEqual({ left: false, right: false })
  })

  test('左端では右にだけ続きがある', () => {
    expect(pictureScrollHint(0, 600, 300)).toEqual({ left: false, right: true })
  })

  test('途中では左右どちらにも続きがある', () => {
    expect(pictureScrollHint(150, 600, 300)).toEqual({ left: true, right: true })
  })

  test('右端では左にだけ続きがある', () => {
    expect(pictureScrollHint(300, 600, 300)).toEqual({ left: true, right: false })
  })

  test('端から1pxのずれは端とみなす（矢印がチカチカしない）', () => {
    expect(pictureScrollHint(1, 600, 300)).toEqual({ left: false, right: true })
    expect(pictureScrollHint(299, 600, 300)).toEqual({ left: true, right: false })
  })

  test('負のscrollLeft（iOSのバウンス）でもleftはfalse', () => {
    expect(pictureScrollHint(-20, 600, 300)).toEqual({ left: false, right: true })
  })
})
