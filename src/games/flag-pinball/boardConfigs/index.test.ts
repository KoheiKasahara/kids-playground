import { describe, expect, it } from 'vitest'
import type { PinballThemeId } from '../themes/types'
import { BOARD_CONFIGS, candyBoard, getBoardConfig, normalBoard, oceanBoard, skyBoard, spaceBoard } from './index'

const THEME_IDS: readonly PinballThemeId[] = ['normal', 'space', 'ocean', 'candy', 'sky']

describe('BOARD_CONFIGS', () => {
  it('5テーマすべてに盤面設定が存在する', () => {
    for (const themeId of THEME_IDS) {
      expect(BOARD_CONFIGS[themeId]).toBeDefined()
    }
    expect(Object.keys(BOARD_CONFIGS).sort()).toEqual([...THEME_IDS].sort())
  })

  it('getBoardConfig はテーマIDから対応する盤面設定を取得できる', () => {
    expect(getBoardConfig('normal')).toBe(normalBoard)
    expect(getBoardConfig('space')).toBe(spaceBoard)
    expect(getBoardConfig('ocean')).toBe(oceanBoard)
    expect(getBoardConfig('candy')).toBe(candyBoard)
    expect(getBoardConfig('sky')).toBe(skyBoard)
  })

  it('不明なテーマIDを渡すと既定盤面へ握りつぶさずthrowする', () => {
    // PinballThemeId の範囲外の値が紛れ込んだ場合（呼び出し側の不具合）を想定した検査
    expect(() => getBoardConfig('unknown-theme' as PinballThemeId)).toThrow()
  })

  it('宇宙は専用盤面になっており、通常盤面とは異なる配置を持つ', () => {
    expect(spaceBoard).not.toEqual(normalBoard)
    expect(spaceBoard.obstacles).not.toEqual(normalBoard.obstacles)
    expect(spaceBoard.walls).not.toEqual(normalBoard.walls)
    expect(spaceBoard.toys).not.toEqual(normalBoard.toys)
  })

  it('海は専用盤面になっており、通常盤面とは異なる配置を持つ', () => {
    expect(oceanBoard).not.toEqual(normalBoard)
    expect(oceanBoard.obstacles).not.toEqual(normalBoard.obstacles)
    expect(oceanBoard.walls).not.toEqual(normalBoard.walls)
    expect(oceanBoard.toys).not.toEqual(normalBoard.toys)
  })

  it('Phase Dでおかしも専用盤面になっており、通常盤面とは異なる配置を持つ', () => {
    expect(candyBoard).not.toEqual(normalBoard)
    expect(candyBoard.obstacles).not.toEqual(normalBoard.obstacles)
    expect(candyBoard.walls).not.toEqual(normalBoard.walls)
    expect(candyBoard.toys).not.toEqual(normalBoard.toys)
  })

  it('Phase Eで空も専用盤面になっており、通常盤面とは異なる配置を持つ', () => {
    // 空盤面は「広い空間」を優先し、宇宙・海・おかしと違って専用の斜めガイド壁や
    // 短いガイド板を追加していない（壁一式は通常盤面と同じ6枚のまま）。それでも
    // obstacles・toysは通常盤面とはっきり異なるため、盤面設定全体としては別物になる。
    expect(skyBoard).not.toEqual(normalBoard)
    expect(skyBoard.obstacles).not.toEqual(normalBoard.obstacles)
    expect(skyBoard.toys).not.toEqual(normalBoard.toys)
  })

  it('テーマ設定同士は内容が同じでも同一のmutableオブジェクトを共有していない', () => {
    const configs = [normalBoard, spaceBoard, oceanBoard, candyBoard, skyBoard]
    for (let i = 0; i < configs.length; i += 1) {
      for (let j = i + 1; j < configs.length; j += 1) {
        expect(configs[i]).not.toBe(configs[j])
        expect(configs[i].obstacles).not.toBe(configs[j].obstacles)
        expect(configs[i].walls).not.toBe(configs[j].walls)
        expect(configs[i].toys).not.toBe(configs[j].toys)
        expect(configs[i].launch).not.toBe(configs[j].launch)
      }
    }
  })

  it('一方のテーマの配列を書き換えても、他テーマの配置には影響しない', () => {
    const spaceToysBefore = spaceBoard.toys.length
    const oceanToysBefore = oceanBoard.toys.length
    const normalToysBefore = normalBoard.toys.length

    // space.toys.push(...) のような事故を模した破壊的変更。
    // spaceBoard.toys は readonly 型だが、実行時の配列参照が独立していることを
    // 確認するため、あえて型を迂回して push する。
    ;(spaceBoard.toys as unknown as unknown[]).push({
      id: 'test-injected-toy',
      kind: 'spinner',
      x: 0,
      y: 0,
      radius: 1,
      tapRadius: 1,
      labelJa: 'test',
    })

    expect(spaceBoard.toys.length).toBe(spaceToysBefore + 1)
    expect(oceanBoard.toys.length).toBe(oceanToysBefore)
    expect(normalBoard.toys.length).toBe(normalToysBefore)

    // テスト後始末: 他のテストへ影響しないよう注入した要素を取り除く
    ;(spaceBoard.toys as unknown as unknown[]).pop()
  })
})
