import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import GamePlaySurface from './GamePlaySurface'
import styles from './GamePlaySurface.module.css'

const CSS_PATH = path.join(__dirname, 'GamePlaySurface.module.css')
const CSS_SOURCE = readFileSync(CSS_PATH, 'utf-8')

describe('GamePlaySurface(Issue #166)', () => {
  test('childrenをそのまま描画する', () => {
    render(
      <GamePlaySurface>
        <button type="button">ボタン</button>
      </GamePlaySurface>,
    )
    expect(screen.getByRole('button', { name: 'ボタン' })).toBeInTheDocument()
  })

  test('CSS Modulesのclassが付与される', () => {
    render(
      <GamePlaySurface>
        <button type="button">ボタン</button>
      </GamePlaySurface>,
    )
    const wrapper = screen.getByRole('button').parentElement
    expect(wrapper).toHaveClass(styles.surface)
  })

  test('contextmenu(長押しメニュー)がpreventDefaultされる', () => {
    render(
      <GamePlaySurface>
        <button type="button">ボタン</button>
      </GamePlaySurface>,
    )
    const wrapper = screen.getByRole('button').parentElement!
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    wrapper.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  test('CSSはdisplay: contentsとuser-select系の抑制を持ち、touch-actionは含まない', () => {
    expect(CSS_SOURCE).toMatch(/display:\s*contents\s*;/)
    expect(CSS_SOURCE).toMatch(/(?<!-webkit-)user-select:\s*none\s*;/)
    expect(CSS_SOURCE).toMatch(/-webkit-user-select:\s*none\s*;/)
    expect(CSS_SOURCE).toMatch(/-webkit-touch-callout:\s*none\s*;/)
    // ズーム抑制はA(global.css/preventBrowserPageZoom.ts)でサイト共通に済ませているため、
    // ここにtouch-actionを書くと祖先との積集合で各ゲームの既存touch-actionに影響してしまう。
    // （コメントでの言及は許容し、実際のプロパティ宣言だけを見るためコメントを取り除いて検証する）
    const withoutComments = CSS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(withoutComments).not.toMatch(/touch-action/)
  })

  test('img子孫の-webkit-user-dragを打ち消している', () => {
    expect(CSS_SOURCE).toMatch(/\.surface\s+img\s*\{[^}]*-webkit-user-drag:\s*none/)
  })
})
