import { describe, expect, test } from 'vitest'
import { shapeBounds } from './shapeBounds'

describe('shapeBounds', () => {
  test('pathのbboxが正しい（直線のみ）', () => {
    const bounds = shapeBounds({ kind: 'path', d: 'M 10,20 L 50,20 L 50,60 L 10,60 Z' })
    expect(bounds).toEqual({ minX: 10, minY: 20, maxX: 50, maxY: 60, width: 40, height: 40 })
  })

  test('pathのbboxが正しい（Cの制御点を含む外接矩形）', () => {
    // 制御点(0,30)がstart/endより外側にあるため、bboxはその制御点まで広がる。
    const bounds = shapeBounds({ kind: 'path', d: 'M 10,10 C 0,30 40,30 30,10 Z' })
    expect(bounds.minX).toBe(0)
    expect(bounds.maxX).toBe(40)
    expect(bounds.minY).toBe(10)
    expect(bounds.maxY).toBe(30)
  })

  test('pathのbboxが正しい（Qの制御点を含む）', () => {
    const bounds = shapeBounds({ kind: 'path', d: 'M 0,0 Q 50,-20 100,0 Z' })
    expect(bounds).toEqual({ minX: 0, minY: -20, maxX: 100, maxY: 0, width: 100, height: 20 })
  })

  test('circleのbboxが正しい', () => {
    const bounds = shapeBounds({ kind: 'circle', cx: 50, cy: 40, r: 10 })
    expect(bounds).toEqual({ minX: 40, minY: 30, maxX: 60, maxY: 50, width: 20, height: 20 })
  })

  test('ellipseのbboxが正しい', () => {
    const bounds = shapeBounds({ kind: 'ellipse', cx: 50, cy: 40, rx: 12, ry: 6 })
    expect(bounds).toEqual({ minX: 38, minY: 34, maxX: 62, maxY: 46, width: 24, height: 12 })
  })

  test('相対コマンド(小文字)を含むpathでthrowする', () => {
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 l 20,20 Z' })).toThrow()
  })

  test('Aコマンド(弧)を含むpathでthrowする', () => {
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 A 5,5 0 0 1 20,20 Z' })).toThrow()
  })

  test('H/V/S/Tコマンドを含むpathでthrowする', () => {
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 H 20 Z' })).toThrow()
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 V 20 Z' })).toThrow()
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 S 15,15 20,20 Z' })).toThrow()
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 T 20,20 Z' })).toThrow()
  })

  test('コマンドの引数の数が不正だとthrowする', () => {
    expect(() => shapeBounds({ kind: 'path', d: 'M 10,10 L 20 Z' })).toThrow()
  })
})
