// 動物の制作ガイド（docs/3d-zoo/animal-production.md）と Skill（zoo-animal-creator）が、
// 実装と食い違っていないことを確かめる。動物を足したのに個別仕様を書き忘れた、
// スクリプトの場所を変えたのに Skill が古いまま、といったずれを検出する。
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { STANDARD_CLIPS } from './motion'
import { SPECIES, SPECIES_ORDER } from './species'

const root = process.cwd()
const GUIDE = join(root, 'docs', '3d-zoo', 'animal-production.md')
const SKILL = join(root, '.agents', 'skills', 'zoo-animal-creator', 'SKILL.md')
const CLAUDE_SKILL = join(root, '.claude', 'skills', 'zoo-animal-creator', 'SKILL.md')

function frontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  expect(match, 'SKILL.md は --- で囲んだ frontmatter で始まる').not.toBeNull()
  return Object.fromEntries(match![1].split('\n').map(line => {
    const i = line.indexOf(':')
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
  }))
}

/** 本文中の `...` に書かれた、リポジトリ内のファイル・フォルダーのパス（<id> などの置き換え前提は除く）。 */
function repoPaths(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/[),]$/, '')
    if (!/^(scripts|src|docs|assets-src|public|\.agents|e2e)\//.test(p) || /[<>*]/.test(p)) continue
    found.add(p.replace(/\/$/, ''))
  }
  return [...found]
}

describe('動物の制作ガイドと Skill', () => {
  const guide = readFileSync(GUIDE, 'utf8')
  const skill = readFileSync(SKILL, 'utf8')

  test('Skill は Codex（.agents/skills）と Claude Code（.claude/skills）の両方から同じ内容で読める', () => {
    expect(existsSync(CLAUDE_SKILL)).toBe(true)
    expect(realpathSync(CLAUDE_SKILL)).toBe(realpathSync(SKILL))
    const meta = frontmatter(skill)
    expect(meta.name).toBe('zoo-animal-creator')
    expect(meta.description.length).toBeGreaterThan(40)
    // Codex は名前と説明を必須とし、どちらのツールも説明は短いほど確実に読まれる
    expect(meta.description.length).toBeLessThanOrEqual(1024)
    expect(Object.keys(meta).sort()).toEqual(['description', 'name'])
    expect(skill.split('\n').length).toBeLessThan(500)
  })

  test('Skill とガイドが参照するスクリプト・フォルダーが実在する', () => {
    for (const p of [...repoPaths(skill), ...repoPaths(guide)]) {
      expect(existsSync(join(root, p)), p).toBe(true)
    }
    expect(skill).toContain('docs/3d-zoo/animal-production.md')
  })

  test('ゲームに登録したすべての動物に、ガイドの個別仕様と生成スクリプトがある', () => {
    for (const id of SPECIES_ORDER) {
      expect(guide, `${id} の個別仕様`).toContain(`（\`${id}\`）`)
      expect(existsSync(join(root, 'scripts', 'zoo-3d', 'zoo3d', 'animals', `${id}.py`)), `${id}.py`).toBe(true)
      expect(existsSync(join(root, 'scripts', 'zoo-3d', 'zoo3d', 'animals', `${id}_motion.py`)), `${id}_motion.py`).toBe(true)
      expect(existsSync(join(root, 'assets-src', 'zoo-3d', `${id}.blend`)), `${id}.blend`).toBe(true)
      for (const s of SPECIES[id].specials) expect(guide, `${id} の固有アクション ${s.clip}`).toContain(`\`${s.clip}\``)
    }
  })

  test('ガイドと Skill の共通クリップ一覧が、ゲームが前提にするクリップと一致する', () => {
    for (const clip of STANDARD_CLIPS) {
      expect(guide).toContain(`\`${clip}\``)
      expect(skill).toContain(`\`${clip}\``)
    }
  })
})
