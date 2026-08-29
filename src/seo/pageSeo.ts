// ページ単位のSEO情報（title/description/canonicalなど）を組み立てる純粋関数群。
// DOMやimport.meta.envに依存させないことで、SPA遷移時のSeoManagerだけでなく、
// ビルド時（Node.js側）のsrc/build/staticRoutePages.tsからも同じロジックを共有できる。

import { GAME_ROUTE_PREFIX, findGameBySlug, gameRoutePath, type GameCatalogEntry } from '../games/gameCatalog'
import { DEFAULT_OG_IMAGE_PATH, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from './siteMeta'
import { buildGameStructuredData, buildHomeStructuredData, type JsonLdDocument } from './structuredData'

export type PageSeo = {
  title: string
  description: string
  canonicalUrl: string
  /** 'website' | 'article' 相当。幼児向けゲームのプレイページはすべて記事ではないため 'website' 固定。 */
  ogType: string
  ogImageUrl: string
  /** このページに埋め込む構造化データ（JSON-LD）のグラフ。src/seo/structuredData.ts が組み立てる。 */
  jsonLd: JsonLdDocument
}

export const HOME_SEO: PageSeo = {
  title: 'こどもミニゲーム｜国旗・宇宙・電車で遊べる幼児向け無料ゲーム',
  description: SITE_DESCRIPTION,
  canonicalUrl: absoluteUrl('/'),
  ogType: 'website',
  ogImageUrl: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
  jsonLd: buildHomeStructuredData(),
}

export function buildGameSeo(entry: GameCatalogEntry): PageSeo {
  // canonicalUrl/ogImageUrlはPageSeo自身とJSON-LD（WebApplication/BreadcrumbList）の
  // 両方から参照される値のため、ここで1回だけ計算して使い回す
  // （absoluteUrlの呼び出しをここと構造化データ側で二重に持たない）。
  const canonicalUrl = absoluteUrl(gameRoutePath(entry.slug))
  const ogImageUrl = absoluteUrl(entry.seo.ogImage ?? DEFAULT_OG_IMAGE_PATH)
  return {
    title: `${entry.seo.headline} - ${SITE_NAME}`,
    description: entry.seo.description,
    canonicalUrl,
    ogType: 'website',
    ogImageUrl,
    jsonLd: buildGameStructuredData(entry, { url: canonicalUrl, imageUrl: ogImageUrl }),
  }
}

// '/games/<slug>' の直後の1セグメントだけを取り出す。
// '/games/planet-globe/play' や '/games/math-quiz/add/hard/play' のような
// むずかしさ選択・プレイ・結果画面のURLも、同じゲームの状態違いでしかなく
// 静的HTMLが生成されるのもゲームルートのみのため、ゲームルートのslugへ正規化する。
// この正規化はJSON-LDにもそのまま効く。buildGameSeo(entry)が返すjsonLdはゲームルートの
// canonicalUrlを使って組み立てられているため、深いURLでも常にゲームルートと同じグラフになる。
const GAME_SLUG_PATTERN = new RegExp(`^${GAME_ROUTE_PREFIX}/([^/]+)(?:/.*)?$`)

/**
 * pathname（クエリ・ハッシュを含まない想定だが、念のため取り除く）からページのSEO情報を解決する。
 * '/' はトップ、'/games/<slug>' 配下はそのゲームのルートへ正規化して解決し、
 * それ以外・未知のslugはトップ（Homeへリダイレクトされる '*' ルートと同じ扱い）を返す。
 */
export function resolvePageSeo(pathname: string): PageSeo {
  const pathWithoutQueryOrHash = pathname.split(/[?#]/)[0] ?? '/'
  const normalizedPath =
    pathWithoutQueryOrHash.length > 1 && pathWithoutQueryOrHash.endsWith('/')
      ? pathWithoutQueryOrHash.slice(0, -1)
      : pathWithoutQueryOrHash

  if (normalizedPath === '/' || normalizedPath === '') {
    return HOME_SEO
  }

  const gameSlugMatch = normalizedPath.match(GAME_SLUG_PATTERN)
  if (gameSlugMatch) {
    const entry = findGameBySlug(gameSlugMatch[1])
    if (entry) {
      return buildGameSeo(entry)
    }
  }

  return HOME_SEO
}
