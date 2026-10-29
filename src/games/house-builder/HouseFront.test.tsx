import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { DOORS, EXTRAS, GARDENS, OUTDOOR_EXTRAS, POOLS, ROOFS, WALLS, WINDOWS, type Exterior } from './data'
import { ExteriorSwatch, HouseFront, type ExteriorCategory } from './HouseFront'
import { createDesign } from './plan'

describe('house-builder 2D exterior', () => {
  test('キャンプと あそびばを いっしょに かき、テントだけ はずせる', () => {
    const base = createDesign('hiraya', 'narrow')
    const exterior = { ...base.exterior, extras: OUTDOOR_EXTRAS.map((item) => item.id) }
    const view = render(<HouseFront design={{ ...base, exterior }} />)
    for (const item of OUTDOOR_EXTRAS) {
      expect(view.container.querySelector(`[data-outdoor="${item.id}"]`)).toHaveAttribute('aria-label', item.name)
    }
    view.rerender(<HouseFront design={{ ...base, exterior: { ...exterior, extras: exterior.extras.filter((id) => id !== 'tent') } }} />)
    expect(view.container.querySelector('[data-outdoor="tent"]')).toBeNull()
    expect(view.container.querySelectorAll('[data-outdoor]')).toHaveLength(OUTDOOR_EXTRAS.length - 1)
    expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  test('えらべる かべ・やね・まど・ドア・にわ・プール・おまけは それぞれ みほんの えが ちがう', () => {
    const categories = { wall: WALLS, roof: ROOFS, window: WINDOWS, door: DOORS, garden: GARDENS, pool: POOLS, extras: EXTRAS }
    const view = render(<ExteriorSwatch category="wall" id="white" />)
    for (const [category, options] of Object.entries(categories)) {
      const pictures = new Set<string>()
      for (const option of options) {
        view.rerender(<ExteriorSwatch category={category as ExteriorCategory} id={option.id} />)
        const svg = view.container.querySelector('svg')!
        expect(svg.querySelectorAll('rect,path,circle,ellipse,line,polygon').length, `${category}/${option.id}`).toBeGreaterThan(0)
        // ラベルだけ変えて同じ絵に落ちていないことも確かめる。
        const picture = svg.innerHTML.replace(/ aria-label="[^"]*"/g, '')
        expect(pictures.has(picture), `${category}/${option.id}`).toBe(false)
        pictures.add(picture)
      }
    }
  })

  test('プール・はたけ・おまけを いっしょに かき、プールだけ はずせる', () => {
    const base = createDesign('hiraya', 'narrow')
    const exterior: Exterior = { ...base.exterior, garden: 'strawberries', pool: 'round', parking: 'two', doghouse: 'red', extras: ['picnic', 'fountain'] }
    const view = render(<HouseFront design={{ ...base, exterior }} />)
    for (const label of ['まるい プール', 'いちごばたけ', 'ピクニック テーブル', 'ふんすい']) {
      const art = view.container.querySelector(`[aria-label="${label}"]`)
      expect(art, label).not.toBeNull()
      expect(art!.querySelectorAll('rect,path,circle,ellipse,line,polygon').length, label).toBeGreaterThan(0)
    }
    view.rerender(<HouseFront design={{ ...base, exterior: { ...exterior, pool: 'none' } }} />)
    expect(view.container.querySelector('[aria-label="まるい プール"]')).toBeNull()
    expect(view.container.querySelector('[aria-label="いちごばたけ"]')).not.toBeNull()
    expect(view.container.querySelector('[aria-label="ピクニック テーブル"]')).not.toBeNull()

    view.rerender(<HouseFront design={{ ...base, exterior: { ...exterior, pool: 'rectangle', garden: 'orchard' } }} />)
    expect(view.container.querySelector('[aria-label="しかくい プール"]')).not.toBeNull()
    expect(view.container.querySelectorAll('[aria-label="くだものの き"]').length).toBeGreaterThan(0)
    expect(view.container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})
