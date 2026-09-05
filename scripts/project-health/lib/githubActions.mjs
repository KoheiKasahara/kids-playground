// GitHub Actions REST API のレスポンスを解釈する純粋関数。
// API呼び出し自体はここでは行わない（fetch-github-context.mjs が担当）ため、
// ネットワークに依存せずテストできる。
export function parseLatestRun(runsPayload) {
  const run = runsPayload?.workflow_runs?.[0]
  if (!run) {
    return null
  }

  return {
    id: run.id ?? null,
    conclusion: run.conclusion ?? null,
    status: run.status ?? null,
    htmlUrl: run.html_url ?? null,
  }
}

export function findJob(jobsPayload, jobName) {
  const jobs = jobsPayload?.jobs
  if (!Array.isArray(jobs)) {
    return null
  }

  const job = jobs.find((candidate) => candidate?.name === jobName)
  if (!job) {
    return null
  }

  return {
    conclusion: job.conclusion ?? null,
    status: job.status ?? null,
    htmlUrl: job.html_url ?? null,
  }
}
