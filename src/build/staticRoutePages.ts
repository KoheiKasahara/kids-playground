import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import { resolvePageSeo, type PageSeo } from '../seo/pageSeo'
import { serializeJsonLd } from '../seo/structuredData'

// GitHub Pagesは静的ホスティングでサーバー側ルーティングを持たないため、
// ビルド出力にゲームごとの実ファイルを用意しておかないと、
// /games/<game-id> への直接アクセスやリロードが404になってしまう。
// このプラグインは dist/index.html を元に、ゲームごとの静的HTML
// （/games/<slug>/index.html と /games/<slug>.html の両方）と、
// それ以外の深い階層のURL（/games/<id>/<mode>/:level/play など）向けの
// SPAフォールバックとして dist/404.html を生成する。
// これにより、JavaScriptを実行しないクローラでもゲームごとのtitle/descriptionを読める。

// SITE_ORIGIN はURL生成の単一情報源である src/seo/siteMeta.ts へ移した。
// staticRoutePages.test.ts など既存のimportを壊さないよう、ここから再exportしておく。
export { SITE_ORIGIN } from '../seo/siteMeta'

const CANONICAL_LINK_PATTERN = /(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/
const OG_URL_META_PATTERN = /(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/
const TITLE_PATTERN = /(<title>)[\s\S]*?(<\/title>)/
const DESCRIPTION_META_PATTERN = /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/
const OG_TITLE_META_PATTERN = /(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/
const OG_DESCRIPTION_META_PATTERN = /(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/
const OG_TYPE_META_PATTERN = /(<meta\s+property="og:type"\s+content=")[^"]*("\s*\/?>)/
const OG_IMAGE_META_PATTERN = /(<meta\s+property="og:image"\s+content=")[^"]*("\s*\/?>)/
const TWITTER_TITLE_META_PATTERN = /(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/?>)/
const TWITTER_DESCRIPTION_META_PATTERN = /(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/?>)/
// 既存のJSON-LD script（前回のビルド出力を入力にした場合など）をまるごと検出して置き換える。
const JSON_LD_SCRIPT_PATTERN = /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/
const HEAD_CLOSE_PATTERN = /<\/head>/

// index.html のdescription/og:description/twitter:descriptionは、属性が改行して
// 書かれている（`\s+`はデフォルトで改行にもマッチするため、このまま`\s+`で書けば
// タグが複数行にまたがっていても問題なく一致する）。

/** index.html の canonical / og:url を、そのページ自身のURLへ差し替える。 */
export function applyCanonicalUrl(html: string, pageUrl: string): string {
  let result = html
  if (CANONICAL_LINK_PATTERN.test(result)) {
    result = result.replace(CANONICAL_LINK_PATTERN, `$1${pageUrl}$2`)
  }
  if (OG_URL_META_PATTERN.test(result)) {
    result = result.replace(OG_URL_META_PATTERN, `$1${pageUrl}$2`)
  }
  return result
}

/**
 * applyCanonicalUrl が書き換えられなかったタグ名を返す（空配列なら両方書き換え可能）。
 * index.html側のタグの属性順序・空白が変わってパターンに一致しなくなった場合に検出するための、
 * ビルドプラグイン側の警告用ヘルパー。applyCanonicalUrl自体は純粋関数のまま保つ。
 */
export function findMissingCanonicalTags(html: string): string[] {
  const missing: string[] = []
  if (!CANONICAL_LINK_PATTERN.test(html)) {
    missing.push('<link rel="canonical">')
  }
  if (!OG_URL_META_PATTERN.test(html)) {
    missing.push('<meta property="og:url">')
  }
  return missing
}

/**
 * index.html の中のJSON-LD scriptタグを、そのページ自身の構造化データへ差し替える。
 * index.html（ビルドの入力）自体にはJSON-LDのプレースホルダを置いていない
 * （src/build/staticRoutePages.ts のコメント・READMEを参照）ため、通常は
 * 「既存タグが無い→</head>の直前に新規挿入」の経路を通る。ただし、このプラグインの
 * 出力を再度入力にした場合（後述のテストや、dist/index.htmlの2回書き換えなど）は
 * 既存のJSON-LDを壊さず1つに保つ必要があるため、「既にあれば丸ごと置き換え」も用意している。
 * </head>もJSON-LD scriptも見つからない場合は何もしない（純粋関数として例外を投げない）。
 */
function applyJsonLdToHtml(html: string, seo: PageSeo): string {
  // ペイロード文字列を置換関数の外で先に組み立てておき、String.replaceの第二引数には
  // 必ず関数を渡す。ペイロード中に "$&" などの並びが含まれていても、replace特殊構文
  // として解釈されることが構造的に無くなる（他のタグの置換と同じ方針）。
  const scriptTag = `<script type="application/ld+json">${serializeJsonLd(seo.jsonLd)}</script>`

  if (JSON_LD_SCRIPT_PATTERN.test(html)) {
    return html.replace(JSON_LD_SCRIPT_PATTERN, () => scriptTag)
  }
  if (HEAD_CLOSE_PATTERN.test(html)) {
    return html.replace(HEAD_CLOSE_PATTERN, () => `${scriptTag}\n  </head>`)
  }
  return html
}

/**
 * index.html を元に、ページ全体のSEO情報（title/description/canonical/OGP/Twitterカード/JSON-LD）を
 * そのページ自身の値へ差し替える。canonical/og:urlの差し替えはapplyCanonicalUrlへ、
 * JSON-LDの差し替え・挿入はapplyJsonLdToHtmlへ委譲する。
 * 対象タグが見つからない場合はそのタグを変更せず素通りする（純粋関数として例外を投げない）。
 */
export function applyPageSeoToHtml(html: string, seo: PageSeo): string {
  let result = applyCanonicalUrl(html, seo.canonicalUrl)

  const replacements: Array<[RegExp, string]> = [
    [TITLE_PATTERN, seo.title],
    [DESCRIPTION_META_PATTERN, seo.description],
    [OG_TITLE_META_PATTERN, seo.title],
    [OG_DESCRIPTION_META_PATTERN, seo.description],
    [OG_TYPE_META_PATTERN, seo.ogType],
    [OG_IMAGE_META_PATTERN, seo.ogImageUrl],
    [TWITTER_TITLE_META_PATTERN, seo.title],
    [TWITTER_DESCRIPTION_META_PATTERN, seo.description],
  ]

  for (const [pattern, value] of replacements) {
    if (pattern.test(result)) {
      // valueは文言テーブル由来の固定文字列で "$" を含まないが、replace特殊構文
      // （$&など）の影響を受けないよう、置換関数の形で安全に差し込む。
      result = result.replace(pattern, (_match, before: string, after: string) => `${before}${value}${after}`)
    }
  }

  result = applyJsonLdToHtml(result, seo)

  return result
}

/**
 * applyPageSeoToHtml が書き換えられなかったタグ名を返す（空配列ならすべて書き換え可能）。
 * findMissingCanonicalTags と同じ理由（index.html側の書式が想定と変わった場合の検出）で、
 * closeBundle の警告用に対象タグ全体をカバーする形へ拡張したもの。
 */
export function findMissingSeoTags(html: string): string[] {
  const missing = findMissingCanonicalTags(html)
  const patterns: Array<[RegExp, string]> = [
    [TITLE_PATTERN, '<title>'],
    [DESCRIPTION_META_PATTERN, '<meta name="description">'],
    [OG_TITLE_META_PATTERN, '<meta property="og:title">'],
    [OG_DESCRIPTION_META_PATTERN, '<meta property="og:description">'],
    [OG_TYPE_META_PATTERN, '<meta property="og:type">'],
    [OG_IMAGE_META_PATTERN, '<meta property="og:image">'],
    [TWITTER_TITLE_META_PATTERN, '<meta name="twitter:title">'],
    [TWITTER_DESCRIPTION_META_PATTERN, '<meta name="twitter:description">'],
  ]
  for (const [pattern, label] of patterns) {
    if (!pattern.test(html)) {
      missing.push(label)
    }
  }
  // </head> が無いと、既存のJSON-LD scriptも無い場合にapplyJsonLdToHtmlが
  // 差し込み先を見つけられずJSON-LDが焼き込まれないまま出力されてしまうため、
  // 他のタグと同じく欠落として検出する。
  if (!HEAD_CLOSE_PATTERN.test(html)) {
    missing.push('</head>')
  }
  return missing
}

export function staticRoutePages(): Plugin {
  // config.build.outDir は多くの場合 'dist' のような相対パスで、Viteの root からの
  // 相対パスとして解決されるべきもの。process.cwd() 基準で解決すると、cwdが
  // Viteのrootと異なる場合に書き出し先がずれてしまうため、configResolved内で
  // config.root と組み合わせた絶対パスへ解決しておく。
  let resolvedOutDir = path.resolve(process.cwd(), 'dist')

  return {
    name: 'kids-playground:static-route-pages',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const indexHtmlPath = path.join(resolvedOutDir, 'index.html')
      const indexHtml = await readFile(indexHtmlPath, 'utf-8')

      const missingTags = findMissingSeoTags(indexHtml)
      if (missingTags.length > 0) {
        // タグの形が想定と変わると、ゲームごとの静的ページがtitle/description/canonicalなどを
        // 差し替えられずトップのSEOのまま出力されてしまう（テストは気づけない）ため、
        // ビルド時に警告として必ず可視化する。
        this.warn(
          `staticRoutePages: dist/index.html に想定した ${missingTags.join(' / ')} タグが見つからないため、` +
            'ゲームごとのSEO書き換えがスキップされます。',
        )
      }

      for (const entry of GAME_CATALOG) {
        const pagePath = gameRoutePath(entry.slug)
        const pageHtml = applyPageSeoToHtml(indexHtml, resolvePageSeo(pagePath))

        // /games/<slug> と /games/<slug>/ の両方をリダイレクトなしで200配信するため、
        // ディレクトリ形式(index.html)とファイル形式(.html)の両方を書き出す。
        const gameDir = path.join(resolvedOutDir, 'games', entry.slug)
        await mkdir(gameDir, { recursive: true })
        await writeFile(path.join(gameDir, 'index.html'), pageHtml)
        await writeFile(path.join(resolvedOutDir, 'games', `${entry.slug}.html`), pageHtml)
      }

      // title/description/canonicalはもともとトップの値なのでこの書き換えは実質no-opだが、
      // JSON-LDだけはindex.html（ビルドの入力）に書かれていないため、ここを通すことで
      // トップと404フォールバックにも同じ経路でJSON-LDが焼き込まれる。
      const homeHtml = applyPageSeoToHtml(indexHtml, resolvePageSeo('/'))
      await writeFile(indexHtmlPath, homeHtml)

      // むずかしさ選択・プレイ・結果画面など、静的ページを持たないより深いURLへの
      // 直接アクセスやリロードは、404.htmlをSPAフォールバックとしてGitHub Pagesが返し、
      // クライアント側のルーティングで正しい画面を描画する。404.htmlは任意のURLに対して
      // 返るページであり、canonicalも元からトップを指しているため、トップと同じ
      // homeHtml（同じグラフのJSON-LDを含む）を書き出すのが整合的。
      await writeFile(path.join(resolvedOutDir, '404.html'), homeHtml)
    },
  }
}
