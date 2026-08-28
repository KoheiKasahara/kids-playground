import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'

// GitHub Pagesは静的ホスティングでサーバー側ルーティングを持たないため、
// ビルド出力にゲームごとの実ファイルを用意しておかないと、
// /games/<game-id> への直接アクセスやリロードが404になってしまう。
// このプラグインは dist/index.html を元に、ゲームごとの静的HTML
// （/games/<slug>/index.html と /games/<slug>.html の両方）と、
// それ以外の深い階層のURL（/games/<id>/<mode>/:level/play など）向けの
// SPAフォールバックとして dist/404.html を生成する。

export const SITE_ORIGIN = 'https://kids.kasapg.com'

const CANONICAL_LINK_PATTERN = /(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/
const OG_URL_META_PATTERN = /(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/

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

export function staticRoutePages(): Plugin {
  let outDir = 'dist'

  return {
    name: 'kids-playground:static-route-pages',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      const indexHtmlPath = path.resolve(outDir, 'index.html')
      const indexHtml = await readFile(indexHtmlPath, 'utf-8')

      for (const entry of GAME_CATALOG) {
        const pagePath = gameRoutePath(entry.slug)
        const pageHtml = applyCanonicalUrl(indexHtml, `${SITE_ORIGIN}${pagePath}`)

        // /games/<slug> と /games/<slug>/ の両方をリダイレクトなしで200配信するため、
        // ディレクトリ形式(index.html)とファイル形式(.html)の両方を書き出す。
        const gameDir = path.resolve(outDir, 'games', entry.slug)
        await mkdir(gameDir, { recursive: true })
        await writeFile(path.join(gameDir, 'index.html'), pageHtml)
        await writeFile(path.resolve(outDir, 'games', `${entry.slug}.html`), pageHtml)
      }

      // むずかしさ選択・プレイ・結果画面など、静的ページを持たないより深いURLへの
      // 直接アクセスやリロードは、index.htmlと同内容の404.htmlをSPAフォールバックとして
      // GitHub Pagesが返し、クライアント側のルーティングで正しい画面を描画する。
      await writeFile(path.resolve(outDir, '404.html'), indexHtml)
    },
  }
}
