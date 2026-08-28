// サイトのURL生成に関する単一情報源（Single Source of Truth）。
// SITE_ORIGIN はもともと src/build/staticRoutePages.ts に定義されていたが、
// SPA遷移時のメタ更新（SeoManager）とビルド時の静的HTML書き換え（staticRoutePages）の
// 両方から同じ値・同じ組み立てロジックを使う必要があるため、ここへ集約する。

export const SITE_ORIGIN = 'https://kids.kasapg.com'
export const SITE_NAME = 'こどもミニゲーム'
export const DEFAULT_OG_IMAGE_PATH = '/icons/icon-512.png'

/**
 * サイト内の絶対パス（'/' 始まり）から、末尾スラッシュを正規化した公開URLを組み立てる。
 * ルート('/')以外は末尾スラッシュを付けない（'/games/flag-quiz/' を渡されても除去する）。
 */
export function absoluteUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (normalizedPath === '/') {
    return `${SITE_ORIGIN}/`
  }
  const trimmedPath = normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : normalizedPath
  return `${SITE_ORIGIN}${trimmedPath}`
}
