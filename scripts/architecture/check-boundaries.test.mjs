import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { collectViolations, compareBaseline, moduleReferences, violatesBoundary } from './check-boundaries.mjs'

test('game isolation, shared layers, integration roots and test ownership', () => {
  const target = 'src/games/b/logic.ts'
  assert.equal(violatesBoundary('src/games/a/play.tsx', target), true)
  assert.equal(violatesBoundary('src/games/a/play.test.tsx', target), true)
  assert.equal(violatesBoundary('src/games/b/play.tsx', target), false)
  for (const from of ['src/components/Button.tsx', 'src/games/shared/store.ts', 'src/games/quiz-core/types.ts', 'src/games/gameCatalog.ts']) {
    assert.equal(violatesBoundary(from, target), true, from)
  }
  for (const from of ['src/app/routes.tsx', 'src/test/audio/gameSoundSamples.ts', 'src/games/gameCatalog.test.ts']) {
    assert.equal(violatesBoundary(from, target), false, from)
  }
  for (const to of ['src/games/shared/store.ts', 'src/games/image-quiz/types.ts', 'src/games/quiz-core/types.ts', 'src/audio/sound.ts']) {
    assert.equal(violatesBoundary('src/games/a/play.tsx', to), false, to)
  }
  assert.equal(violatesBoundary('src\\games\\a\\play.ts', 'src\\games\\b\\data.ts'), true)
})

test('AST finds static, type, re-export, side-effect, dynamic and require references, not comments', () => {
  const source = `
    import type { T } from './types'; export * from './barrel';
    import './style.css'; const x = import('./lazy');
    type Y = import('./type-query').Y; const z = require('./legacy');
    import old = require('./old');
    // import './fake'
    const text = "import './fake2'";
  `
  assert.deepEqual(moduleReferences('test.ts', source).sort(), ['./barrel', './lazy', './legacy', './old', './style.css', './type-query', './types'])
  assert.throws(() => moduleReferences('test.ts', 'import(name)'), /文字列リテラル/)
})

test('exceptions are exact edges, require reasons, and shrink when dependencies disappear', () => {
  const edge = 'src/games/a/x.ts -> src/games/b/y.ts'
  const entry = { edge, reason: '既存実装の互換維持' }
  assert.deepEqual(compareBaseline([edge], [entry]), [])
  assert.match(compareBaseline([edge.replace('/x.ts', '/new.ts')], [entry]).join('\n'), /新しい境界違反/)
  assert.match(compareBaseline([], [entry]).join('\n'), /不要な例外/)
  assert.match(compareBaseline([edge], [entry, entry]).join('\n'), /重複例外/)
  assert.match(compareBaseline([edge], [{ edge, reason: '' }]).join('\n'), /reason/)
})

test('filesystem scan resolves aliases, normalized paths, index barrels and asset imports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-boundaries-'))
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  try {
    write('tsconfig.app.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } }, include: ['src'] }))
    write('src/games/a/play.ts', `import '@/games/b'; export * from '../b/./data'; import '../b/style.css'; import('three')`)
    write('src/games/b/index.ts', `export * from './data'`)
    write('src/games/b/data.ts', 'export const data = 1')
    assert.deepEqual(collectViolations(root), [
      'src/games/a/play.ts -> src/games/b/data.ts',
      'src/games/a/play.ts -> src/games/b/index.ts',
      'src/games/a/play.ts -> src/games/b/style.css',
    ])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
