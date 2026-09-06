import { extname, join, relative, sep } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

// Project Health Web Dashboard（Issue #526）は dist/project-health/ 配下へ
// 独立したentryとして出力される（vite.config.ts参照）。ここで集計する
// 「本体ゲームのbundle size」にDashboard自身のJS/CSSが混ざらないよう除外する。
const EXCLUDED_TOP_LEVEL_DIRS = new Set(['project-health'])

// 既存 build が生成した dist/ をそのまま集計する（Dashboard専用の追加buildは行わない）。
export function measureBundleSize(distDir) {
  let entries
  try {
    entries = readdirSync(distDir, { withFileTypes: true, recursive: true })
  } catch {
    return null
  }

  let js = 0
  let css = 0

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const ext = extname(entry.name)
    if (ext === '.map') {
      continue
    }

    const parentDir = entry.parentPath ?? entry.path ?? distDir
    const relativeDir = relative(distDir, parentDir)
    const topLevelDir = relativeDir.split(sep)[0]
    if (EXCLUDED_TOP_LEVEL_DIRS.has(topLevelDir)) {
      continue
    }

    const size = statSync(join(parentDir, entry.name)).size

    if (ext === '.js') {
      js += size
    } else if (ext === '.css') {
      css += size
    }
  }

  return { js, css, total: js + css }
}
