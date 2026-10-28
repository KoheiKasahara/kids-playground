import { readFileSync } from 'node:fs'
import { measureLoadingSize } from './lib/loadingSize.mjs'
import { evaluateLoadingBudgets, parseLoadingBudgets } from './lib/loadingBudgets.mjs'

// build直後の成果物を検査する。初期読込の超過は失敗、全ゲーム分のPWA増加は警告。
const budgets = parseLoadingBudgets(readFileSync('.project-health.json', 'utf8'))
const metrics = measureLoadingSize('dist')
const { errors, warnings } = evaluateLoadingBudgets(metrics, budgets)
console.log(`Loading: JS ${(metrics.initial.js.gzip / 1024).toFixed(1)} KiB gzip, CSS ${(metrics.initial.css.gzip / 1024).toFixed(1)} KiB gzip; PWA ${(metrics.precache.bytes / 1024).toFixed(1)} KiB (${metrics.precache.count} files)`)
for (const warning of warnings) console.warn(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'WARNING: '}${warning}`)
for (const error of errors) console.error(`${process.env.GITHUB_ACTIONS ? '::error::' : 'ERROR: '}${error}`)
if (errors.length) process.exitCode = 1
