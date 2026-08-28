// sitemap.xml をビルド時に生成するViteプラグイン。
// canonical URLの単一情報源は src/seo/pageSeo.ts（HOME_SEO / buildGameSeo）であり、
// sitemapのURLもそこから取得することで、sitemapとcanonicalの不一致や、
// ゲーム追加時にsitemapへの追加を忘れるという事態を構造的に防ぐ
// （このファイルの中で独自にURLを組み立てるコードは書かない）。

import type { Plugin } from 'vite'
import { GAME_CATALOG } from '../games/gameCatalog'
import { HOME_SEO, buildGameSeo } from '../seo/pageSeo'

/**
 * sitemapに載せるURLの一覧を集める。
 * HOME_SEO.canonicalUrl / buildGameSeo(entry).canonicalUrl（＝各ページのcanonical本人）を
 * そのまま並べるだけで、URLの組み立てロジックはpageSeo側に委譲する。
 */
export function collectSitemapUrls(): string[] {
  return [HOME_SEO.canonicalUrl, ...GAME_CATALOG.map((entry) => buildGameSeo(entry).canonicalUrl)]
}

/** <loc> に安全に埋め込めるよう、XMLの予約文字をエスケープする。 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * sitemaps.org プロトコル 0.9 形式のXML文字列を組み立てる。
 * lastmod/changefreq/priorityは意図的に出力しない。実際の更新日を継続的に
 * 正しく保守する仕組みが無く、形だけの値（生成日や固定値）を入れても
 * 検索エンジンにとって信頼できる情報にならないため。
 */
export function buildSitemapXml(urls: string[] = collectSitemapUrls()): string {
  const urlEntries = urls.map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`).join('\n')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urlEntries}\n` +
    '</urlset>\n'
  )
}

export const SITEMAP_FILE_NAME = 'sitemap.xml'

export function sitemapFile(): Plugin {
  return {
    name: 'kids-playground:sitemap',
    apply: 'build',
    enforce: 'post',
    generateBundle() {
      // fsへ直接書き込むのではなくemitFileでバンドルへ登録することで、dist配下へ
      // 確実に出力されるようにする（出力先ディレクトリの解決をVite任せにできる）。
      // なお.xmlはvite-plugin-pwaのworkbox.globPatterns
      // （js,css,html,svg,png,jpg,jpeg,webp,ico,webmanifest）に含まれないため、
      // このファイルはService Workerのprecache対象にはならない。
      this.emitFile({
        type: 'asset',
        fileName: SITEMAP_FILE_NAME,
        source: buildSitemapXml(),
      })
    },
  }
}
