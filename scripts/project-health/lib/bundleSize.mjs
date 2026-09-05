import { extname, join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

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
    const size = statSync(join(parentDir, entry.name)).size

    if (ext === '.js') {
      js += size
    } else if (ext === '.css') {
      css += size
    }
  }

  return { js, css, total: js + css }
}
