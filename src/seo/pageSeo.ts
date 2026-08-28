// ページ単位のSEO情報（title/description/canonicalなど）を組み立てる純粋関数群。
// DOMやimport.meta.envに依存させないことで、SPA遷移時のSeoManagerだけでなく、
// ビルド時（Node.js側）のsrc/build/staticRoutePages.tsからも同じロジックを共有できる。

import { GAME_ROUTE_PREFIX, findGameBySlug, gameRoutePath, type GameCatalogEntry } from '../games/gameCatalog'
import { DEFAULT_OG_IMAGE_PATH, SITE_NAME, absoluteUrl } from './siteMeta'

export type PageSeo = {
  title: string
  description: string
  canonicalUrl: string
  /** 'website' | 'article' 相当。幼児向けゲームのプレイページはすべて記事ではないため 'website' 固定。 */
  ogType: string
  ogImageUrl: string
}

export const HOME_SEO: PageSeo = {
  title: 'こどもミニゲーム｜国旗・宇宙・電車で遊べる幼児向け無料ゲーム',
  description:
    '国旗や都道府県のクイズ、太陽系や地球儀をさわる宇宙あそび、3Dの線路づくりやコロコロパズルなど、幼児向けのミニゲームを集めた無料サイトです。スマホ・タブレットのブラウザですぐ遊べます。',
  canonicalUrl: absoluteUrl('/'),
  ogType: 'website',
  ogImageUrl: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
}

export function buildGameSeo(entry: GameCatalogEntry): PageSeo {
  return {
    title: `${entry.seo.headline} - ${SITE_NAME}`,
    description: entry.seo.description,
    canonicalUrl: absoluteUrl(gameRoutePath(entry.slug)),
    ogType: 'website',
    ogImageUrl: absoluteUrl(entry.seo.ogImage ?? DEFAULT_OG_IMAGE_PATH),
  }
}

// '/games/<slug>' の直後の1セグメントだけを取り出す。
// '/games/planet-globe/play' や '/games/math-quiz/add/hard/play' のような
// むずかしさ選択・プレイ・結果画面のURLも、同じゲームの状態違いでしかなく
// 静的HTMLが生成されるのもゲームルートのみのため、ゲームルートのslugへ正規化する。
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
