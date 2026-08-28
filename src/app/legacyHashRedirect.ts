/**
 * 旧HashRouter時代のURL（例: https://kids.kasapg.com/#/games/flag-pinball）で
 * 開かれた場合に、同じ画面のパス型URLへ書き換える。
 * 既存のブックマーク・ホーム画面ショートカットを壊さないための互換処理。
 */
export function redirectLegacyHashUrl(win: Pick<Window, 'location' | 'history'> = window): string | null {
  const { hash } = win.location
  if (!hash.startsWith('#/')) {
    return null
  }

  // '?'などのクエリはハッシュ内にそのまま含まれているため、そのまま引き継ぐ。
  const target = hash.slice(1)

  // '//' で始まる場合はプロトコル相対URL（例: '#//evil.example'）となり、
  // history.replaceState に渡すと別オリジンへ誘導されうるため、何もしない。
  if (target.startsWith('//')) {
    return null
  }

  win.history.replaceState(null, '', target)
  return target
}
