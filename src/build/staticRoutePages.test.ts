import { describe, expect, test } from 'vitest'
import { applyCanonicalUrl } from './staticRoutePages'

const BASE_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <title>こどもミニゲーム｜無料で遊べる幼児向けクイズ・知育ゲーム</title>
    <meta name="description" content="幼児向け無料ミニゲーム集の説明文" />
    <link rel="canonical" href="https://kids.kasapg.com/" />
    <meta property="og:title" content="こどもミニゲーム" />
    <meta property="og:url" content="https://kids.kasapg.com/" />
    <meta property="og:image" content="https://kids.kasapg.com/icons/icon-512.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

describe('applyCanonicalUrl', () => {
  test('canonical と og:url を差し替える', () => {
    const result = applyCanonicalUrl(BASE_HTML, 'https://kids.kasapg.com/games/flag-pinball')
    expect(result).toContain('<link rel="canonical" href="https://kids.kasapg.com/games/flag-pinball">')
    expect(result).toContain('<meta property="og:url" content="https://kids.kasapg.com/games/flag-pinball">')
  })

  test('title / description / og:image は変わらない', () => {
    const result = applyCanonicalUrl(BASE_HTML, 'https://kids.kasapg.com/games/flag-pinball')
    expect(result).toContain('<title>こどもミニゲーム｜無料で遊べる幼児向けクイズ・知育ゲーム</title>')
    expect(result).toContain('<meta name="description" content="幼児向け無料ミニゲーム集の説明文" />')
    expect(result).toContain('<meta property="og:title" content="こどもミニゲーム" />')
    expect(result).toContain('<meta property="og:image" content="https://kids.kasapg.com/icons/icon-512.png" />')
  })

  test('canonical / og:url タグが無いHTMLでも壊れない', () => {
    const html = '<html><head><title>タイトル</title></head><body></body></html>'
    expect(() => applyCanonicalUrl(html, 'https://kids.kasapg.com/games/flag-pinball')).not.toThrow()
    expect(applyCanonicalUrl(html, 'https://kids.kasapg.com/games/flag-pinball')).toBe(html)
  })
})
