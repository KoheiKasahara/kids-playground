import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env = process.env
const summaryPath = env.GITHUB_STEP_SUMMARY

if (!summaryPath) {
  process.exit(0)
}

const readJson = (filePath) => {
  try {
    return JSON.parse(readFileSync(resolve(filePath), 'utf8'))
  } catch {
    return null
  }
}

const readText = (filePath) => {
  try {
    return readFileSync(resolve(filePath), 'utf8')
  } catch {
    return null
  }
}

const asNumber = (...values) => {
  for (const value of values) {
    if (value === '' || value === null || value === undefined) {
      continue
    }
    const number = Number(value)
    if (Number.isFinite(number)) {
      return number
    }
  }
  return null
}

const formatDuration = (value) => {
  const seconds = asNumber(value)
  if (seconds === null) {
    return '—'
  }

  const rounded = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(rounded / 60)
  const remainingSeconds = rounded % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

const testReport = readJson(env.CI_TEST_RESULTS_FILE ?? 'vitest-results.json')
const testResults = Array.isArray(testReport?.testResults) ? testReport.testResults : []
const testFilesTotal = asNumber(
  testReport?.numTotalTestSuites,
  testReport?.numTotalTestFiles,
  testResults.length,
)
const testFilesPassed = asNumber(
  testReport?.numPassedTestSuites,
  testReport?.numPassedTestFiles,
  testResults.filter((result) => result?.status === 'passed').length,
)
const testsTotal = asNumber(testReport?.numTotalTests, testReport?.numTotalTestResults)
const testsPassed = asNumber(testReport?.numPassedTests, testReport?.numPassedTestResults)

const countSlowTests = () => {
  const config = readText('vite.config.ts')
  if (!config) {
    return { files: null, tests: null }
  }

  const block = config.match(/const slowTestFiles = \[(.*?)\]/s)?.[1] ?? ''
  const files = [...block.matchAll(/['"]([^'"]+\.test\.[jt]sx?)['"]/g)].map((match) => match[1])
  const tests = files.reduce((total, filePath) => {
    const source = readText(filePath)
    if (!source) {
      return total
    }

    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    const declarations = withoutComments.match(
      /\b(?:it|test)(?:\.(?:each|skip|only|concurrent))?(?:\.each)?\s*\(/g,
    )
    return total + (declarations?.length ?? 0)
  }, 0)

  return { files: files.length, tests }
}

const slow = countSlowTests()
const isFull = (env.CI_TEST_MODE ?? '').startsWith('FULL')
const slowLabel = isFull ? 'included' : 'excluded'
const slowValue = `${slow.files ?? '—'} files / ${slow.tests ?? '—'} tests ${slowLabel}`

const coverageReport = readJson(env.CI_COVERAGE_FILE ?? 'coverage/coverage-summary.json')
const coverageTotal = coverageReport?.total
const coverageMetric = (key) => {
  const value = coverageTotal?.[key]?.pct
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—'
}

const durationValues = [env.CI_LINT_DURATION, env.CI_TEST_DURATION, env.CI_BUILD_DURATION]
const totalDuration = durationValues.every((value) => asNumber(value) !== null)
  ? durationValues.reduce((total, value) => total + Number(value), 0)
  : null

const resultLabel = (passed, total) => {
  if (passed === null || total === null) {
    return 'Not available'
  }
  return `${passed} passed / ${total} total`
}

const lines = [
  '# Vitest Test Report',
  '',
  '## Run',
  '',
  '| Item | Value |',
  '| --- | ---: |',
  `| Mode | **${env.CI_TEST_MODE ?? 'UNKNOWN'}** |`,
  `| Branch | ${env.GITHUB_REF_NAME ?? '—'} |`,
  `| Commit | \`${(env.GITHUB_SHA ?? '—').slice(0, 12)}\` |`,
  `| Runtime | Node ${env.CI_NODE_VERSION ?? '—'} / ${env.CI_PACKAGE_MANAGER ?? 'npm'} |`,
  `| Cache | ${env.CI_CACHE ?? '—'} |`,
  '',
  '## Tests',
  '',
  '| Item | Result |',
  '| --- | ---: |',
  `| Test files | ${resultLabel(testFilesPassed, testFilesTotal)} |`,
  `| Tests | ${resultLabel(testsPassed, testsTotal)} |`,
  `| Slow suite | ${slowValue} |`,
  '',
]

if (isFull) {
  lines.push(
    '## Coverage',
    '',
    '| Metric | Coverage |',
    '| --- | ---: |',
    `| Statements | ${coverageMetric('statements')} |`,
    `| Branches | ${coverageMetric('branches')} |`,
    `| Functions | ${coverageMetric('functions')} |`,
    `| Lines | ${coverageMetric('lines')} |`,
    '',
  )
}

lines.push(
  '## Duration',
  '',
  '| Step | Result | Time |',
  '| --- | --- | ---: |',
  `| Lint | ${env.CI_LINT_OUTCOME ?? 'unknown'} | ${formatDuration(env.CI_LINT_DURATION)} |`,
  `| Test | ${env.CI_TEST_OUTCOME ?? 'unknown'} | ${formatDuration(env.CI_TEST_DURATION)} |`,
  `| Build | ${env.CI_BUILD_OUTCOME ?? 'unknown'} | ${formatDuration(env.CI_BUILD_DURATION)} |`,
  `| Total (lint + test + build) | — | ${formatDuration(totalDuration)} |`,
  '',
  '_Coverage is collected only in FULL / NIGHTLY runs to keep QUICK CI fast. No coverage threshold is enforced._',
  '',
)

appendFileSync(summaryPath, `${lines.join('\n')}\n`)
