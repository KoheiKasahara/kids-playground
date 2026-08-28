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

      const missingTags = findMissingCanonicalTags(indexHtml)
      if (missingTags.length > 0) {
        // canonical / og:url タグの形が想定と変わると、ゲームごとの静的ページが
        // 差し替わらずルートのcanonicalのまま出力されてしまう（テストは気づけない）ため、
        // ビルド時に警告として必ず可視化する。
        this.warn(
          `staticRoutePages: dist/index.html に想定した ${missingTags.join(' / ')} タグが見つからないため、` +
            'ゲームごとのcanonical/og:url書き換えがスキップされます。',
        )
      }

      for (const entry of GAME_CATALOG) {
        const pagePath = gameRoutePath(entry.slug)
        const pageHtml = applyCanonicalUrl(indexHtml, `${SITE_ORIGIN}${pagePath}`)

        // /games/<slug> と /games/<slug>/ の両方をリダイレクトなしで200配信するため、
        // ディレクトリ形式(index.html)とファイル形式(.html)の両方を書き出す。
        const gameDir = path.join(resolvedOutDir, 'games', entry.slug)
        await mkdir(gameDir, { recursive: true })
        await writeFile(path.join(gameDir, 'index.html'), pageHtml)
        await writeFile(path.join(resolvedOutDir, 'games', `${entry.slug}.html`), pageHtml)
      }

      // むずかしさ選択・プレイ・結果画面など、静的ページを持たないより深いURLへの
      // 直接アクセスやリロードは、index.htmlと同内容の404.htmlをSPAフォールバックとして
      // GitHub Pagesが返し、クライアント側のルーティングで正しい画面を描画する。
      await writeFile(path.join(resolvedOutDir, '404.html'), indexHtml)
    },
  }
}
