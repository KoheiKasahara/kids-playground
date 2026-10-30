import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { ROOM_SIZES, ROOM_TYPES } from './data'
import { RoomSwatch } from './RoomArt'

describe('house-builder room pictures', () => {
  test('趣味と くらしの へやは 色だけでなく かぐの かたちも かわる', () => {
    const view = render(<RoomSwatch type="library" style="library" />)
    for (const id of ['library', 'music', 'art', 'playroom', 'pet', 'laundry', 'closet', 'plants'] as const) {
      const type = ROOM_TYPES.find((t) => t.id === id)!
      const pictures = new Set<string>()
      for (const style of type.styles) {
        for (const size of ROOM_SIZES) {
          const [w, h] = type.sizes[size.id]
          view.rerender(<RoomSwatch type={id} style={style.id} w={w} h={h} />)
          expect(view.container.innerHTML).not.toMatch(/NaN|Infinity|undefined/)
        }
        view.rerender(<RoomSwatch type={id} style={style.id} />)
        const furniture = view.container.querySelector('g[transform]')!
        expect(furniture.querySelectorAll('rect,path,circle,ellipse').length, style.name).toBeGreaterThan(2)
        pictures.add(furniture.innerHTML.replace(/#[\da-f]{6}/gi, '#color'))
      }
      expect(pictures.size, type.name).toBe(type.styles.length)
    }
  })
})
