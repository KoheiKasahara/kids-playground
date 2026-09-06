import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

// Project Health Web Dashboard（Issue #526）のHTMLエントリは src/project-health/index.html
// に置いている。リポジトリ直下の `project-health/` はCIが実行時に書き出す一時取得データ用
// ディレクトリとして既に .gitignore で無視されているため、Dashboardのソース一式を
// そこへ直接置くと誤ってコミットされなくなってしまう（実際に踏んだ問題）。
// そのためソースは src/ 配下に置き、Viteのデフォルト挙動（HTMLエントリの出力先を
// root からの相対パスでミラーする）で dist/src/project-health/index.html に出力された
// ものを、build完了後にこのプラグインで dist/project-health/index.html へ移す。
// JS/CSSは vite.config.ts の output.entryFileNames 等で最初から dist/project-health/assets/
// へ出力しているため、ここで動かす対象はHTMLファイルだけでよい。
export function projectHealthDashboardOutput(): Plugin {
  let resolvedOutDir = path.resolve(process.cwd(), 'dist')

  return {
    name: 'kids-playground:project-health-dashboard-output',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const fromHtml = path.join(resolvedOutDir, 'src', 'project-health', 'index.html')
      const toHtml = path.join(resolvedOutDir, 'project-health', 'index.html')

      try {
        await mkdir(path.dirname(toHtml), { recursive: true })
        await rename(fromHtml, toHtml)
        // dist/src には他に何も出力されない想定（本体ゲームは index.html 直下からbuildされる）
        // ため、丸ごと片付けてよい。
        await rm(path.join(resolvedOutDir, 'src'), { recursive: true, force: true })
      } catch (error) {
        this.warn(
          `projectHealthDashboardOutput: dist/src/project-health/index.html を dist/project-health/index.html へ移動できませんでした: ${
            error instanceof Error ? error.message : error
          }`,
        )
      }
    },
  }
}
