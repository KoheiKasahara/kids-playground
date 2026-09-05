import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countGames } from './gameCatalog.mjs'

const buildSource = (slugs) => `
export type GameCatalogEntry = {
  id: string
  slug: string
}

// 実ファイルと同様、型注釈にも \`[]\` を含む（配列開始位置の誤検出を防げているか確認するため）。
export const GAME_CATALOG: readonly GameCatalogEntry[] = [
${slugs.map((slug) => `  { id: '${slug}', slug: '${slug}', title: 'x' },`).join('\n')}
]

export function findGameBySlug(slug) {
  return GAME_CATALOG.find((game) => game.slug === slug)
}
`

describe('countGames', () => {
  it('カタログ内のゲーム件数を数える', () => {
    expect(countGames(buildSource(['a', 'b', 'c']))).toBe(3)
  })

  it('ゲームを追加すると件数が追従する', () => {
    const before = countGames(buildSource(['a', 'b']))
    const after = countGames(buildSource(['a', 'b', 'c']))
    expect(after).toBe(before + 1)
  })

  it('型定義側の `slug: string` は数えない', () => {
    // buildSource は常に type 定義付き。0件でも型定義分は誤カウントしない。
    expect(countGames(buildSource([]))).toBe(0)
  })

  it('GAME_CATALOG が見つからない場合は null を返す', () => {
    expect(countGames('export const OTHER = []')).toBeNull()
  })

  it('実際の src/games/gameCatalog.ts から件数を取得できる', () => {
    const source = readFileSync(new URL('../../../src/games/gameCatalog.ts', import.meta.url), 'utf8')
    const count = countGames(source)
    // 独立した別の数え方（配列内の `slug: '...'` を全文検索）と突き合わせる。
    // ゲームが増減しても、この一致は将来にわたって成立し続ける。
    const independentCount = [...source.matchAll(/^\s*slug: '/gm)].length

    expect(count).not.toBeNull()
    expect(count).toBeGreaterThan(0)
    expect(count).toBe(independentCount)
  })
})
