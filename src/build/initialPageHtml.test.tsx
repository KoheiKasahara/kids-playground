import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import { resolvePageSeo } from '../seo/pageSeo'
import { HOME_INTRO_DESCRIPTION, absoluteUrl } from '../seo/siteMeta'
import { collectSitemapUrls } from './sitemap'
import { applyPageSeoToHtml } from './staticRoutePages'
import { applyInitialPageHtml } from './initialPageHtml'

const template = readFileSync('index.html', 'utf8')

describe('initial crawlable document', () => {
  test.each(['/', ...GAME_CATALOG.map((game) => gameRoutePath(game.slug))])('%s matches its canonical and sitemap', (pathname) => {
    const html = applyInitialPageHtml(applyPageSeoToHtml(template, resolvePageSeo(pathname)), pathname)
    const document = new DOMParser().parseFromString(html, 'text/html')
    const main = document.querySelector('main')!
    expect(main.textContent!.trim().length).toBeGreaterThan(50)
    expect(main.querySelectorAll('h1')).toHaveLength(1)
    const canonicals = document.querySelectorAll('link[rel="canonical"]')
    expect(canonicals).toHaveLength(1)
    expect(canonicals[0].getAttribute('href')).toBe(absoluteUrl(pathname))
    expect(collectSitemapUrls()).toContain(absoluteUrl(pathname))
    expect(document.getElementById('root')!.hasAttribute('inert')).toBe(true)
    if (pathname === '/') {
      expect(main.textContent).toContain(HOME_INTRO_DESCRIPTION)
      expect([...main.querySelectorAll('a')].map((anchor) => absoluteUrl(anchor.getAttribute('href')!)))
        .toEqual(collectSitemapUrls().slice(1))
    } else {
      const game = GAME_CATALOG.find((entry) => gameRoutePath(entry.slug) === pathname)!
      expect(main.querySelector('h1')!.textContent).toBe(game.title)
      expect(main.textContent).toContain(game.seo.description)
      for (const line of game.intro.howToPlay) expect(main.textContent).toContain(line)
      expect(main.querySelector('a')!.getAttribute('href')).toBe('/')
    }
  })
})
