import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../app/App'
import { HOME_SEO, buildGameSeo } from './pageSeo'
import { findGameBySlug } from '../games/gameCatalog'

// jsdomのdocument.headはテストファイル内で共有される。@testing-library/reactの自動cleanupは
// document.bodyだけを掃除しdocument.headには手を付けないため、SeoManagerが書き込んだ
// meta/linkタグが前のテストから残らないよう、テストごとにheadを初期化しておく。
beforeEach(() => {
  document.head.innerHTML = ''
  document.title = ''
})

function expectSeoTags(seo: ReturnType<typeof buildGameSeo> | typeof HOME_SEO) {
  expect(document.title).toBe(seo.title)
  expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(seo.description)
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(seo.canonicalUrl)
  expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(seo.title)
  expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(seo.description)
  expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(seo.canonicalUrl)
  expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(seo.ogType)
  expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(seo.ogImageUrl)
  expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary')
  expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(seo.title)
  expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe(seo.description)
  expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(seo.ogImageUrl)

  // 各タグが1個ずつであること（SPA遷移のたびに増えていないこと）を合わせて確認する。
  expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[property="og:type"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[name="twitter:card"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(1)
  expect(document.head.querySelectorAll('meta[name="twitter:image"]')).toHaveLength(1)
}

/**
 * SeoManagerのdocument書き換えはuseEffect（画面のコミット後に非同期で走るpassive effect）で
 * 行われる。findByRoleで見えるDOMコミットのタイミングとpassive effectの発火タイミングは
 * 本来ズレうるため（Issue #166でGamePlaySurfaceを1階層挟んだことで、CI環境の負荷次第では
 * このズレが数msだが顕在化することがあった）、遷移直後の検証は即断せずwaitForで
 * 追いつくのを待ってから確認する。
 */
async function expectSeoTagsEventually(seo: ReturnType<typeof buildGameSeo> | typeof HOME_SEO) {
  await waitFor(() => expectSeoTags(seo))
}

describe('SPA遷移でのSEOメタ情報の切り替え', () => {
  test('トップ表示時はHOME_SEOの値になる', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    expectSeoTags(HOME_SEO)
  })

  test('「たいようけい」へ遷移すると全項目がたいようけいの値へ更新される', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expectSeoTags(HOME_SEO)

    await user.click(screen.getByRole('link', { name: 'たいようけい' }))
    // たいようけいの画面は遅延読込のため、実際の画面が出るまで待ってから検証する。
    expect(await screen.findByRole('heading', { name: /たいようけい/ })).toBeInTheDocument()

    const planetGlobe = findGameBySlug('planet-globe')
    expect(planetGlobe).toBeDefined()
    await expectSeoTagsEventually(buildGameSeo(planetGlobe!))
  })

  test('さらに「3Dせんろづくり」へ遷移すると前ページ（たいようけい）の値が残らない', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: 'たいようけい' }))
    const planetGlobe = findGameBySlug('planet-globe')
    expect(await screen.findByRole('heading', { name: /たいようけい/ })).toBeInTheDocument()
    const planetGlobeSeo = buildGameSeo(planetGlobe!)
    await expectSeoTagsEventually(planetGlobeSeo)

    // ゲーム画面の「もどる」ボタンでホームへ戻り、別のゲームへ遷移する。
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(await screen.findByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '3Dせんろづくり' }))
    const railBuilder = findGameBySlug('rail-builder')
    expect(railBuilder).toBeDefined()
    expect(await screen.findByRole('heading', { name: /3Dせんろづくり/ })).toBeInTheDocument()
    await expectSeoTagsEventually(buildGameSeo(railBuilder!))

    // 前のページ（たいようけい）の文言が残っていないことも確認する。
    expect(document.title).not.toContain('たいようけい')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).not.toBe(
      planetGlobeSeo.description,
    )
  })
})
