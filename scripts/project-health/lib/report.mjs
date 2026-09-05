import { formatBytes, ratioIcon, statusIcon } from './format.mjs'

const DASH = '—'

// 収集済みデータ（すべて null/undefined 許容）から Summary の行を組み立てる。
// ここではファイルI/OやAPI呼び出しを一切行わないため、失敗時の表示（—, ❓）を
// 外部依存なしにテストできる。
export function buildProjectHealthRows({
  gamesCount = null,
  unitTests = { total: null, passed: null },
  bundle = null,
  dependencies = null,
  nightly = null,
  deploy = null,
  e2e = null,
} = {}) {
  const unitTotal = unitTests?.total ?? null
  const unitPassed = unitTests?.passed ?? null
  const e2eTarget = e2e?.total ?? gamesCount ?? null
  const e2ePassed = e2e?.passed ?? null

  const dependencySeverity = (deps) => {
    if (!deps) {
      return '❓'
    }
    if (deps.total === 0) {
      return '✅'
    }
    if ((deps.critical ?? 0) > 0 || (deps.high ?? 0) > 0) {
      return '❌'
    }
    return '⚠️'
  }

  return [
    {
      metric: 'Games',
      value: gamesCount !== null ? String(gamesCount) : DASH,
      status: gamesCount !== null ? '' : '❓',
    },
    {
      metric: 'Unit tests',
      value: unitTotal !== null ? `${unitPassed ?? '?'} / ${unitTotal}` : DASH,
      status: ratioIcon(unitPassed, unitTotal),
    },
    {
      metric: 'E2E smoke',
      value: e2eTarget !== null ? `${e2ePassed ?? '?'} / ${e2eTarget}` : DASH,
      status: ratioIcon(e2ePassed, e2eTarget),
    },
    {
      metric: 'Bundle',
      value: bundle ? formatBytes(bundle.total) : DASH,
      status: bundle ? '' : '❓',
    },
    {
      metric: 'Dependencies',
      value: dependencies ? `${dependencies.total} vulnerable` : DASH,
      status: dependencySeverity(dependencies),
    },
    {
      metric: 'Nightly',
      value: nightly ? (nightly.conclusion ?? nightly.status ?? DASH) : DASH,
      status: statusIcon(nightly?.conclusion ?? null),
    },
    {
      metric: 'Last deploy',
      value: deploy ? (deploy.conclusion ?? deploy.status ?? DASH) : DASH,
      status: statusIcon(deploy?.conclusion ?? null),
    },
  ]
}

export function renderProjectHealthMarkdown(rows, { links = [] } = {}) {
  const lines = [
    '## Project Health',
    '',
    '| Metric | Value | Status |',
    '| --- | --- | :---: |',
    ...rows.map((row) => `| ${row.metric} | ${row.value} | ${row.status} |`),
    '',
  ]

  if (links.length > 0) {
    lines.push('<details><summary>Details</summary>', '', ...links.map((link) => `- ${link}`), '', '</details>', '')
  }

  lines.push(
    '_Games / Unit tests / Bundle / Dependencies はこのジョブの build・test 結果の再集計です。' +
      ' E2E smoke / Nightly / Last deploy は直近の Nightly・Deploy ワークフロー実行結果の再利用です' +
      '（Dashboardのために再実行はしていません）。' +
      ' 取得に失敗した指標は — / ❓ で表示され、Dashboard全体は失敗しません。_',
    '',
  )

  return lines.join('\n')
}
