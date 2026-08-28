import { describe, expect, test } from 'vitest'
import { applyDocumentSeo } from './applyDocumentSeo'
import type { PageSeo } from './pageSeo'

// jsdomのglobal documentはテストファイル内で共有されるため、テストごとに
// createHTMLDocumentで独立したdocumentを作り、他のテストを汚染しないようにする。
function createTestDocument(): Document {
  return document.implementation.createHTMLDocument('')
}

const SEO_A: PageSeo = {
  title: 'たいようけい - こどもミニゲーム',
  description: '太陽・地球・木星・土星など11の天体を、3Dでさわってまわせる宇宙あそびです。',
  canonicalUrl: 'https://kids.kasapg.com/games/planet-globe',
  ogType: 'website',
  ogImageUrl: 'https://kids.kasapg.com/icons/icon-512.png',
}

const SEO_B: PageSeo = {
  title: '3Dせんろづくり - こどもミニゲーム',
  description: '3Dの世界に線路をつないでコースをつくり、電車を走らせるあそびです。',
  canonicalUrl: 'https://kids.kasapg.com/games/rail-builder',
  ogType: 'website',
  ogImageUrl: 'https://kids.kasapg.com/icons/icon-512.png',
}

describe('applyDocumentSeo（空のdocumentへ適用）', () => {
  test('各タグが1個ずつ生成される', () => {
    const doc = createTestDocument()
    applyDocumentSeo(doc, SEO_A)

    expect(doc.title).toBe(SEO_A.title)
    expect(doc.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:type"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:card"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:image"]')).toHaveLength(1)
  })

  test('各タグの中身がPageSeoの値と一致する', () => {
    const doc = createTestDocument()
    applyDocumentSeo(doc, SEO_A)

    expect(doc.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(SEO_A.description)
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SEO_A.canonicalUrl)
    expect(doc.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(SEO_A.title)
    expect(doc.head.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(
      SEO_A.description,
    )
    expect(doc.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(SEO_A.canonicalUrl)
    expect(doc.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(SEO_A.ogType)
    expect(doc.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(SEO_A.ogImageUrl)
    expect(doc.head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary')
    expect(doc.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content')).toBe(SEO_A.title)
    expect(doc.head.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toBe(
      SEO_A.description,
    )
    expect(doc.head.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(SEO_A.ogImageUrl)
  })
})

describe('applyDocumentSeo（既存タグがあるdocumentへ適用）', () => {
  test('個数が増えず、contentだけ更新される', () => {
    const doc = createTestDocument()
    applyDocumentSeo(doc, SEO_A)
    applyDocumentSeo(doc, SEO_B)

    expect(doc.title).toBe(SEO_B.title)
    expect(doc.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(doc.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(SEO_B.description)
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SEO_B.canonicalUrl)
  })

  test('2回連続適用しても個数が変わらない（冪等）', () => {
    const doc = createTestDocument()
    applyDocumentSeo(doc, SEO_A)
    applyDocumentSeo(doc, SEO_A)

    expect(doc.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:type"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:card"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:description"]')).toHaveLength(1)
    expect(doc.head.querySelectorAll('meta[name="twitter:image"]')).toHaveLength(1)
  })
})

describe('applyDocumentSeo（重複タグが既にある場合）', () => {
  test('重複しているmetaタグが1個に集約される', () => {
    const doc = createTestDocument()
    const duplicate = doc.createElement('meta')
    duplicate.setAttribute('name', 'description')
    duplicate.setAttribute('content', '古い説明文その1')
    doc.head.appendChild(duplicate)
    const duplicate2 = doc.createElement('meta')
    duplicate2.setAttribute('name', 'description')
    duplicate2.setAttribute('content', '古い説明文その2')
    doc.head.appendChild(duplicate2)

    applyDocumentSeo(doc, SEO_A)

    const tags = doc.head.querySelectorAll('meta[name="description"]')
    expect(tags).toHaveLength(1)
    expect(tags[0].getAttribute('content')).toBe(SEO_A.description)
  })

  test('重複しているlink[rel="canonical"]が1個に集約される', () => {
    const doc = createTestDocument()
    const duplicate = doc.createElement('link')
    duplicate.setAttribute('rel', 'canonical')
    duplicate.setAttribute('href', 'https://kids.kasapg.com/old')
    doc.head.appendChild(duplicate)
    const duplicate2 = doc.createElement('link')
    duplicate2.setAttribute('rel', 'canonical')
    duplicate2.setAttribute('href', 'https://kids.kasapg.com/old2')
    doc.head.appendChild(duplicate2)

    applyDocumentSeo(doc, SEO_A)

    const tags = doc.head.querySelectorAll('link[rel="canonical"]')
    expect(tags).toHaveLength(1)
    expect(tags[0].getAttribute('href')).toBe(SEO_A.canonicalUrl)
  })
})
