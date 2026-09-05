import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { measureBundleSize } from './bundleSize.mjs'

describe('measureBundleSize', () => {
  let dir

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('dist配下のJS/CSSサイズを合計し、mapは除外する', () => {
    dir = mkdtempSync(join(tmpdir(), 'project-health-bundle-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'assets', 'app.js'), 'a'.repeat(100))
    writeFileSync(join(dir, 'assets', 'app.css'), 'b'.repeat(50))
    writeFileSync(join(dir, 'assets', 'app.js.map'), 'c'.repeat(1000))

    expect(measureBundleSize(dir)).toEqual({ js: 100, css: 50, total: 150 })
  })

  it('バンドルサイズが増減すると値が変化する', () => {
    dir = mkdtempSync(join(tmpdir(), 'project-health-bundle-'))
    writeFileSync(join(dir, 'a.js'), 'x'.repeat(10))
    const before = measureBundleSize(dir).total

    writeFileSync(join(dir, 'b.js'), 'x'.repeat(20))
    const after = measureBundleSize(dir).total

    expect(after).toBeGreaterThan(before)
  })

  it('distが存在しない場合はnullを返す（Dashboard全体は壊れない）', () => {
    expect(measureBundleSize(join(tmpdir(), 'project-health-does-not-exist'))).toBeNull()
  })
})
