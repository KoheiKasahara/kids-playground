// サイトのURL生成に関する単一情報源（Single Source of Truth）。
// SITE_ORIGIN はもともと src/build/staticRoutePages.ts に定義されていたが、
// SPA遷移時のメタ更新（SeoManager）とビルド時の静的HTML書き換え（staticRoutePages）の
// 両方から同じ値・同じ組み立てロジックを使う必要があるため、ここへ集約する。

export const SITE_ORIGIN = 'https://kids.kasapg.com'
export const SITE_NAME = 'こどもミニゲーム'
export const DEFAULT_OG_IMAGE_PATH = '/icons/icon-512.png'

// サイト全体の説明文。トップページのmeta descriptionと、構造化データ（WebSiteノード）の
// description の両方から参照される唯一の値。src/seo/pageSeo.ts の HOME_SEO.description と
// src/seo/structuredData.ts の buildWebSiteNode() が同じ文字列を使うことで、
// 「トップの説明文」がページ内で1種類しか存在しないことを構造的に保証する。
// structuredData.ts は pageSeo.ts から独立させたい（循環importを避けたい）ため、
// pageSeo.tsではなくこちらに置く。
export const SITE_DESCRIPTION =
  '国旗や都道府県のクイズ、太陽系や地球儀をさわる宇宙あそび、3Dの線路づくりやコロコロパズルなど、幼児向けのミニゲームを集めた無料サイトです。スマホ・タブレットのブラウザですぐ遊べます。'

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
