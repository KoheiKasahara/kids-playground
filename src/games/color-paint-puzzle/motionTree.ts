// 完成演出のために、描画順を保ったまま図形を入れ子の<g>へまとめる純ロジック。
// DOM APIに触れないので、「グループ化しても Phase 1 の重なり順が変わらない」ことを
// 軽いunitテストで機械的に確認できる。
import type { PaintMotionRef } from './paintPictures'

export type MotionTreeNode<T> =
  /** そのまま描く図形。 */
  | { kind: 'item'; item: T }
  /** data-motion-group / data-motion-part を持つ<g>。 */
  | { kind: 'branch'; attr: 'group' | 'part'; name: string; children: MotionTreeNode<T>[] }

type Branch<T> = Extract<MotionTreeNode<T>, { kind: 'branch' }>

/**
 * `motion.group` / `motion.part` の指定に従って、items を最大2階層の木にまとめる。
 *
 * 重なり順の保証: 各<g>は「そのグループに属する最初の要素があった位置」に作られ、
 * 同じグループの要素はすべてそこへ集まる。つまり順序が変わるのは
 * 「同じグループの要素どうしが（間に挟まる他グループの要素を飛び越えて）隣接する」
 * ときだけで、題材データ側はその入れ替わりが見た目に影響しないように並べてある。
 */
export function buildMotionTree<T extends { motion?: PaintMotionRef }>(
  items: readonly T[],
): MotionTreeNode<T>[] {
  const roots: MotionTreeNode<T>[] = []
  // 同じ名前の<g>を1つだけ作るための索引。partは所属groupが違えば別の<g>にする。
  const branches = new Map<string, Branch<T>>()

  const ensureBranch = (
    siblings: MotionTreeNode<T>[],
    attr: 'group' | 'part',
    name: string,
    indexKey: string,
  ): Branch<T> => {
    const existing = branches.get(indexKey)
    if (existing) return existing
    const created: Branch<T> = { kind: 'branch', attr, name, children: [] }
    branches.set(indexKey, created)
    siblings.push(created)
    return created
  }

  for (const item of items) {
    const group = item.motion?.group
    const part = item.motion?.part
    let siblings = roots
    if (group) siblings = ensureBranch(roots, 'group', group, `group:${group}`).children
    if (part) siblings = ensureBranch(siblings, 'part', part, `part:${group ?? ''}:${part}`).children
    siblings.push({ kind: 'item', item })
  }

  return roots
}

/** 木を深さ優先で走査して、実際に描かれる順の items を返す（テスト・検証用）。 */
export function flattenMotionTree<T>(nodes: readonly MotionTreeNode<T>[]): T[] {
  const out: T[] = []
  for (const node of nodes) {
    if (node.kind === 'item') out.push(node.item)
    else out.push(...flattenMotionTree(node.children))
  }
  return out
}
