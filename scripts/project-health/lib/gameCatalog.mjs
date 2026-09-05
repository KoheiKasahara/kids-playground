// src/games/gameCatalog.ts（ゲーム一覧の正本）から件数を数える。
// TypeScript をコンパイルせずに静的解析だけで数えるため、まず
// `export const GAME_CATALOG = [ ... ]` の配列リテラル部分を括弧の対応で
// 切り出し、型定義側の `slug: string` を誤って数えないようにする。
export function extractGameCatalogBlock(source) {
  const marker = 'export const GAME_CATALOG'
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) {
    return null
  }

  // `GAME_CATALOG: readonly GameCatalogEntry[] = [...]` のように、配列リテラル
  // より前の型注釈にも `[]` が現れるため、代入の `=` より後ろから探す。
  const equalsIndex = source.indexOf('=', markerIndex)
  if (equalsIndex === -1) {
    return null
  }

  const arrayStart = source.indexOf('[', equalsIndex)
  if (arrayStart === -1) {
    return null
  }

  let depth = 0
  for (let i = arrayStart; i < source.length; i += 1) {
    if (source[i] === '[') {
      depth += 1
    } else if (source[i] === ']') {
      depth -= 1
      if (depth === 0) {
        return source.slice(arrayStart, i + 1)
      }
    }
  }

  return null
}

export function countGames(source) {
  const block = extractGameCatalogBlock(source)
  if (!block) {
    return null
  }

  const matches = block.match(/\bslug:\s*'[^']*'/g)
  return matches ? matches.length : 0
}
