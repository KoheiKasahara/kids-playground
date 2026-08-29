// 構造化データ（JSON-LD, schema.org）を組み立てる純粋関数群。
// DOMにもimport.meta.envにも依存させないことで、SPA遷移時のapplyDocumentSeo（DOM側）と、
// ビルド時（Node.js側）のsrc/build/staticRoutePages.tsの両方から同じロジックを共有できる。
// なお、このファイルは ./pageSeo からは import しない（pageSeo.ts が buildHomeStructuredData /
// buildGameStructuredData をこちらから import して使う関係なので、逆向きに import すると
// 循環importになってしまう）。
//
// --- スキーマ選定の理由 ---
//
// なぜ SoftwareApplication ではなく WebApplication か:
// 本サイトの各ゲームはブラウザ上でそのまま動くウェブアプリであり、インストールが要る
// ダウンロード配布物ではない。WebApplication は SoftwareApplication のサブタイプであり、
// 実態としてより正確な型を選んでいる。
// なお、Googleのソフトウェアアプリ向けリッチリザルトはaggregateRating（評価）とofferまたは
// aggregateOffer（価格）の両方を要求するが、本サイトには実在するレビュー評価も価格も無く、
// 捏造もできないため、SoftwareApplicationを選んでもWebApplicationを選んでもリッチリザルトは
// 出ない。リッチリザルトの表示で得をしない以上、実態により近い型を選ぶのが筋である。
//
// なぜ WebSite ノードを全ページに出すか:
// '@id' を持つ同一ノード（WEBSITE_NODE_ID）を、ホーム・各ゲームページの両方のグラフに
// 1つだけ置く形にしている。SPA遷移のたびにscriptタグが増殖しないよう、DOM側は
// applyDocumentSeo（src/seo/applyDocumentSeo.ts）でupsertする。一方、ビルドが生成する
// 各静的HTML（dist/games/<slug>/index.html など）はそれぞれ別々の文書としてクローラに
// 読まれるため、各ページのJSON-LDがそれぞれ自己完結したグラフ（WebSiteを含む）を
// 持っているのが正しい（他ページのHTMLを読みに行かないと解決できない参照は作らない）。
//
// なぜ評価・価格・作者などを入れないか:
// aggregateRating / review / offers / author / publisher / datePublished はいずれも、
// 実在する集計値・実在する著者情報・実在する公開日が無ければ書けない項目である。
// 本サイトにはそれらの裏付けとなる実データが無く、書けば検索エンジンに対する虚偽表示になる
// （Google のガイドラインでも構造化データへの捏造データの記入は禁止されている）。
// 「無いものは書かない」を徹底し、事実として言えることだけを構造化データにする。

import { GAME_CATEGORIES, type GameCatalogEntry } from '../games/gameCatalog'
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, absoluteUrl } from './siteMeta'

export type JsonLdNode = Record<string, unknown>
export type JsonLdDocument = { '@context': 'https://schema.org'; '@graph': JsonLdNode[] }

/** サイト全体を表す WebSite ノードの '@id'。全ページのグラフから同じ値で参照する。 */
export const WEBSITE_NODE_ID = `${SITE_ORIGIN}/#website`

/**
 * サイト全体を表す WebSite ノード。全ページ共通で、内容はページごとに変わらない。
 * 検索フォームを持たないサイトのため potentialAction（SearchAction）は含めない。
 */
export function buildWebSiteNode(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_NODE_ID,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description: SITE_DESCRIPTION,
    inLanguage: 'ja',
  }
}

/** ゲーム1つぶんの WebApplication ノード。urlsはPageSeo側で計算済みの値を受け取り、ここでは組み立てない。 */
export function buildGameApplicationNode(
  entry: GameCatalogEntry,
  urls: { url: string; imageUrl: string },
): JsonLdNode {
  return {
    '@type': 'WebApplication',
    '@id': `${urls.url}#webapp`,
    name: entry.title,
    url: urls.url,
    description: entry.seo.description,
    inLanguage: 'ja',
    applicationCategory: GAME_CATEGORIES[entry.category].applicationCategory,
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    image: urls.imageUrl,
    isPartOf: { '@id': WEBSITE_NODE_ID },
  }
}

/**
 * ゲーム1つぶんの BreadcrumbList ノード。ホーム→ゲームの2階層のみで、
 * '/games' はそれ自体が実在するページではないため中間パンくずは作らない。
 */
export function buildBreadcrumbNode(entry: GameCatalogEntry, urls: { url: string }): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${urls.url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: entry.title, item: urls.url },
    ],
  }
}

/** ホームページのJSON-LDグラフ。WebSiteノード1つだけを持つ。 */
export function buildHomeStructuredData(): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@graph': [buildWebSiteNode()],
  }
}

/** ゲームページのJSON-LDグラフ。WebSite / WebApplication / BreadcrumbList の3ノードを持つ。 */
export function buildGameStructuredData(
  entry: GameCatalogEntry,
  urls: { url: string; imageUrl: string },
): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@graph': [buildWebSiteNode(), buildGameApplicationNode(entry, urls), buildBreadcrumbNode(entry, urls)],
  }
}

/**
 * JsonLdDocument を <script type="application/ld+json"> へ安全に埋め込める文字列へ直列化する。
 * '<' '>' '&' はJSONの文字列値としては素通りしてしまうため、そのままでは
 * ペイロードの中に "</script>" という並びが出現すると script 要素がそこで終了してしまう
 * （HTMLパーサはscript内でも "</" を見た瞬間にタグ終了とみなすため）。
 * ここでの置換（\u003c / \u003e / \u0026 相当のエスケープ）はいずれも有効なJSONエスケープであり、
 * JSON.parse で元の値へ戻せる。今日の入力（GAME_CATALOGの文言）は自分たちで書いたリテラルで
 * 悪意あるペイロードを含みえないが、将来カタログの文言が増えたり誰かが書き換えたりしても
 * </script> による埋め込み崩壊が二度と起きないよう、常に無条件でエスケープしておく。
 */
export function serializeJsonLd(document: JsonLdDocument): string {
  return JSON.stringify(document).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}
