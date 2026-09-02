import { describe, expect, test } from 'vitest'
import { buildMotionTree, flattenMotionTree } from './motionTree'
import { PAINT_PICTURES, type PaintMotionRef } from './paintPictures'

type Item = { name: string; motion?: PaintMotionRef }

const items = (...list: Item[]) => list

describe('buildMotionTree', () => {
  test('motion指定がなければ、すべてそのままの順で最上位に並ぶ', () => {
    const list = items({ name: 'a' }, { name: 'b' }, { name: 'c' })
    const tree = buildMotionTree(list)
    expect(tree.every((node) => node.kind === 'item')).toBe(true)
    expect(flattenMotionTree(tree).map((item) => item.name)).toEqual(['a', 'b', 'c'])
  })

  test('同じgroupの要素は1つの<g>にまとまり、最初の要素があった位置に置かれる', () => {
    const list = items(
      { name: 'bg' },
      { name: 'a', motion: { group: 'car' } },
      { name: 'b', motion: { group: 'car' } },
      { name: 'fg' },
    )
    const tree = buildMotionTree(list)
    expect(tree).toHaveLength(3)
    expect(tree[0]).toMatchObject({ kind: 'item', item: { name: 'bg' } })
    expect(tree[1]).toMatchObject({ kind: 'branch', attr: 'group', name: 'car' })
    expect(tree[2]).toMatchObject({ kind: 'item', item: { name: 'fg' } })
    expect(flattenMotionTree(tree).map((item) => item.name)).toEqual(['bg', 'a', 'b', 'fg'])
  })

  test('partはgroupの<g>の中に、さらに入れ子の<g>として作られる', () => {
    const list = items(
      { name: 'body', motion: { group: 'car' } },
      { name: 'wheel', motion: { group: 'car', part: 'wheelFront' } },
      { name: 'spoke', motion: { group: 'car', part: 'wheelFront' } },
    )
    const tree = buildMotionTree(list)
    expect(tree).toHaveLength(1)
    const group = tree[0]
    if (group.kind !== 'branch') throw new Error('groupが作られていない')
    expect(group.children).toHaveLength(2)
    expect(group.children[1]).toMatchObject({ kind: 'branch', attr: 'part', name: 'wheelFront' })
    expect(flattenMotionTree(tree).map((item) => item.name)).toEqual(['body', 'wheel', 'spoke'])
  })

  test('同じpart名でも所属groupが違えば別の<g>になる', () => {
    const list = items(
      { name: 'a', motion: { group: 'g1', part: 'wing' } },
      { name: 'b', motion: { group: 'g2', part: 'wing' } },
    )
    const tree = buildMotionTree(list)
    expect(tree).toHaveLength(2)
    expect(tree[0]).toMatchObject({ kind: 'branch', attr: 'group', name: 'g1' })
    expect(tree[1]).toMatchObject({ kind: 'branch', attr: 'group', name: 'g2' })
  })

  test('groupなしのpartは最上位の<g>になる（さかなのあわ）', () => {
    const list = items({ name: 'bubble', motion: { part: 'bubbleBig' } })
    const tree = buildMotionTree(list)
    expect(tree[0]).toMatchObject({ kind: 'branch', attr: 'part', name: 'bubbleBig' })
  })

  test('グループ化しても要素が増減しない（全題材の実データ）', () => {
    for (const picture of PAINT_PICTURES) {
      const list = [
        ...picture.areas.map((area) => ({ name: `area:${area.id}`, motion: area.motion })),
        ...picture.details.map((detail, index) => ({ name: `detail:${index}`, motion: detail.motion })),
      ]
      const flattened = flattenMotionTree(buildMotionTree(list))
      expect(flattened, `${picture.id}: 要素数`).toHaveLength(list.length)
      expect(new Set(flattened.map((item) => item.name)).size).toBe(list.length)
    }
  })

  test('全題材で、背景(motionなし)は必ずグループ外の最上位に残る', () => {
    for (const picture of PAINT_PICTURES) {
      const backgroundIds = picture.areas.filter((area) => !area.motion).map((area) => area.id)
      expect(backgroundIds.length, `${picture.id}: 背景エリア`).toBeGreaterThan(0)
      const tree = buildMotionTree(
        picture.areas.map((area) => ({ name: area.id, motion: area.motion })),
      )
      const topLevelItemIds = tree
        .filter((node) => node.kind === 'item')
        .map((node) => (node.kind === 'item' ? node.item.name : ''))
      for (const id of backgroundIds) {
        expect(topLevelItemIds, `${picture.id}.${id}`).toContain(id)
      }
    }
  })
})
