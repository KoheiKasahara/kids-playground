import { describe, expect, test } from 'vitest'
import { GAME_CATALOG } from '../games/gameCatalog'
import { splitTileTitle } from './tileTitle'

describe('splitTileTitle', () => {
  test('文字種の変わり目で切る', () => {
    expect(splitTileTitle('こっきピンボール')).toEqual({
      head: 'こっき',
      tail: 'ピンボール',
      spaced: false,
    })
  })

  test('候補が複数あれば、長い方が最も短くなる位置を選ぶ', () => {
    expect(splitTileTitle('3Dビーだまコースづくり')).toMatchObject({
      head: '3Dビーだま',
      tail: 'コースづくり',
    })
  })

  test('同じ長さなら前で切る', () => {
    expect(splitTileTitle('こっきコロコロパズル')).toMatchObject({
      head: 'こっき',
      tail: 'コロコロパズル',
    })
  })

  test('空白があればそこで切り、空白を区切りとして覚えておく', () => {
    expect(splitTileTitle('でんしゃの たび')).toEqual({
      head: 'でんしゃの',
      tail: 'たび',
      spaced: true,
    })
  })

  test('漢字と送りがなのあいだでは切らない', () => {
    expect(splitTileTitle('遊ぶゲーム')).toMatchObject({ head: '遊ぶ', tail: 'ゲーム' })
  })

  test('切れ目が無い名前や、片側が1行に入らない名前は区切らない', () => {
    expect(splitTileTitle('こっきころころめいろ')).toBeNull()
    expect(splitTileTitle('3Dおべんとうづくり')).toBeNull()
  })

  test('区切っても全ゲームの名前が欠けずに元へ戻る', () => {
    for (const { title } of GAME_CATALOG) {
      const split = splitTileTitle(title)
      if (split === null) continue
      expect(split.head + (split.spaced ? ' ' : '') + split.tail).toBe(title)
    }
  })
})
