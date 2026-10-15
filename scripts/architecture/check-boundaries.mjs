import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const sharedGames = new Set(['shared', 'quiz-core', 'image-quiz'])
const sharedLayers = new Set(['components', 'audio', 'physics', 'speech', 'utils'])
const normalize = value => value.replaceAll('\\', '/')
const isTest = file => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)

function gameOwner(file) {
  const parts = normalize(file).split('/')
  return parts[0] === 'src' && parts[1] === 'games' && parts.length > 3 && !sharedGames.has(parts[2])
    ? parts[2] : null
}

export function violatesBoundary(from, to) {
  const target = gameOwner(to)
  if (!target) return false
  const owner = gameOwner(from)
  if (owner) return owner !== target
  const parts = normalize(from).split('/')
  // Integration tests may intentionally exercise app routes; production shared code may not.
  if (isTest(from)) return false
  return parts[0] === 'src' && (sharedLayers.has(parts[1]) ||
    (parts[1] === 'games' && (sharedGames.has(parts[2]) || parts[2] === 'gameCatalog.ts')))
}

export function moduleReferences(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const references = []
  function visit(node) {
    let argument
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) argument = node.moduleSpecifier
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) argument = node.argument.literal
    if (ts.isExternalModuleReference(node)) argument = node.expression
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      argument = node.arguments[0]
      if (!argument || (!ts.isStringLiteralLike(argument))) {
        throw new Error(`${file}: 動的なモジュール名は検査できません。文字列リテラルで列挙してください。`)
      }
    }
    if (argument && ts.isStringLiteralLike(argument)) references.push(argument.text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return [...new Set(references)]
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : []
  })
}

export function collectViolations(root) {
  const configPath = path.join(root, 'tsconfig.app.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  if (parsed.errors.length) throw new Error(parsed.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'))
  const edges = new Set()
  for (const file of sourceFiles(path.join(root, 'src'))) {
    const from = normalize(path.relative(root, file))
    for (const reference of moduleReferences(file, fs.readFileSync(file, 'utf8'))) {
      const specifier = reference.split(/[?#]/)[0]
      const resolved = ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule
      // CSS/assets are not TypeScript modules, but relative cross-game imports still count.
      const target = resolved?.resolvedFileName ?? (specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null)
      if (!target) continue
      const to = normalize(path.relative(root, target))
      if (violatesBoundary(from, to)) edges.add(`${from} -> ${to}`)
    }
  }
  return [...edges].sort()
}

export function compareBaseline(edges, exceptions) {
  const actual = new Set(edges)
  const allowed = new Set()
  const errors = []
  for (const entry of exceptions) {
    if (typeof entry.edge !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push('例外には具体的な edge と reason が必要です。')
      continue
    }
    if (allowed.has(entry.edge)) errors.push(`重複例外: ${entry.edge}`)
    allowed.add(entry.edge)
    if (!actual.has(entry.edge)) errors.push(`不要な例外を削除してください: ${entry.edge}`)
  }
  for (const edge of actual) if (!allowed.has(edge)) errors.push(`新しい境界違反: ${edge}`)
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = fileURLToPath(new URL('../../', import.meta.url))
    const exceptions = JSON.parse(fs.readFileSync(new URL('./boundary-exceptions.json', import.meta.url), 'utf8'))
    const edges = collectViolations(root)
    const errors = compareBaseline(edges, exceptions)
    if (errors.length) {
      console.error(errors.join('\n'))
      process.exitCode = 1
    } else console.log(`Dependency boundaries OK (${exceptions.length} existing exceptions).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
