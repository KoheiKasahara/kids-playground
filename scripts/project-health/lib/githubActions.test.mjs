import { describe, expect, it } from 'vitest'
import { findJob, parseLatestRun } from './githubActions.mjs'

describe('parseLatestRun', () => {
  it('成功したワークフロー実行を解釈する', () => {
    expect(
      parseLatestRun({
        workflow_runs: [{ id: 1, conclusion: 'success', status: 'completed', html_url: 'https://x/1' }],
      }),
    ).toEqual({ id: 1, conclusion: 'success', status: 'completed', htmlUrl: 'https://x/1' })
  })

  it('失敗したワークフロー実行を解釈する', () => {
    expect(parseLatestRun({ workflow_runs: [{ id: 2, conclusion: 'failure' }] })?.conclusion).toBe('failure')
  })

  it('実行が無い/APIレスポンスが壊れている場合はnullを返す', () => {
    expect(parseLatestRun({ workflow_runs: [] })).toBeNull()
    expect(parseLatestRun(null)).toBeNull()
    expect(parseLatestRun({})).toBeNull()
  })
})

describe('findJob', () => {
  it('名前でジョブを見つける', () => {
    const jobsPayload = {
      jobs: [
        { name: 'build', conclusion: 'success' },
        { name: 'deploy', conclusion: 'failure', html_url: 'https://x/deploy' },
      ],
    }
    expect(findJob(jobsPayload, 'deploy')).toEqual({
      conclusion: 'failure',
      status: null,
      htmlUrl: 'https://x/deploy',
    })
  })

  it('該当ジョブが無い場合はnullを返す', () => {
    expect(findJob({ jobs: [{ name: 'build' }] }, 'deploy')).toBeNull()
  })

  it('APIレスポンスが壊れている場合はnullを返す', () => {
    expect(findJob(null, 'deploy')).toBeNull()
    expect(findJob({}, 'deploy')).toBeNull()
  })
})
