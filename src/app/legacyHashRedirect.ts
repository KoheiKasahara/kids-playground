/**
 * 旧HashRouter時代のURL（例: https://kids.kasapg.com/#/games/flag-pinball）で
 * 開かれた場合に、同じ画面のパス型URLへ書き換える。
 * 既存のブックマーク・ホーム画面ショートカットを壊さないための互換処理。
 */
type LegacyHashRedirectTarget = {
  location: Pick<Location, 'hash'>
  history: Pick<History, 'replaceState'>
}

export function redirectLegacyHashUrl(win: LegacyHashRedirectTarget = window): string | null {
  const { hash } = win.location
  if (!hash.startsWith('#/')) {
    return null
  }

  // '?'などのクエリはハッシュ内にそのまま含まれているため、そのまま引き継ぐ。
  const target = hash.slice(1)

  // '//' で始まる場合はプロトコル相対URL（例: '#//evil.example'）となり、
  // history.replaceState に渡すと別オリジンへ誘導されうるため、何もしない。
  // '\' で始まる場合（例: '#/\evil.example' → target '/\evil.example'）も、
  // ブラウザがURL解決時に先頭の '\' を '/' へ正規化するため実質的に同じ
  // プロトコル相対URLになり、replaceStateが例外(SecurityError)を投げて
  // main.tsxのモジュール評価自体が止まりうる。そのため '/' の直後が
  // '/' でも '\' でもないことまで確認する。
  if (!/^\/(?![/\\])/.test(target)) {
    return null
  }

  win.history.replaceState(null, '', target)
  return target
}
