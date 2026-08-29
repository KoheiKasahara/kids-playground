// GameIntro（検索エンジン向けの本文セクション）が、狙ったURLだけに正しく出ることを検証する。
// レイアウトの異なる4つの代表ゲーム（開始画面がシンプルなもの・共有シェルを使うもの・
// 全画面3Dキャンバスのもの・3Dだがオーバーレイ操作を持つもの）で個別に確認したうえで、
// 全17ゲームに対する横展開のスモークテスト（test.each）も合わせて行う。

import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../app/App'
import { GAME_CATALOG, findGameBySlug, gameRoutePath } from '../games/gameCatalog'

// 3Dゲーム（earth-globe / rail-builder など）はroutes.tsxでlazy importされており、
// フルテスト実行で並列度が上がるとチャンクの動的import・Three.jsの評価に時間がかかる。
// findBy*の既定タイムアウト(1000ms)では負荷時に間に合わずフレーキーになるため、
// このファイルのfindBy*とテスト自体のタイムアウトを明示的に広げておく。
// （GameIntro自体は同期描画なので待つ必要はないが、h1→h2→h3の順序を確かめるテストは
//  ゲーム本体のh1が出るまで待つ必要がある。）
const FIND = { timeout: 10_000 }
const TEST_TIMEOUT = 20_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

type RepresentativeCase = { slug: string; layoutNote: string }

const REPRESENTATIVE_CASES: RepresentativeCase[] = [
  { slug: 'flag-quiz', layoutNote: 'シンプルな開始画面' },
  { slug: 'vegetable-quiz', layoutNote: '共有image-quizシェル' },
  { slug: 'earth-globe', layoutNote: '全画面3Dキャンバス' },
  { slug: 'rail-builder', layoutNote: '3D+オーバーレイUI' },
]

describe('GameIntro（代表ゲームでの詳細確認）', () => {
  for (const { slug, layoutNote } of REPRESENTATIVE_CASES) {
    describe(`${slug}（${layoutNote}）`, () => {
      test('h1にゲーム名、h2に「このゲームについて」、h3に「あそびかた」が出る', async () => {
        const entry = findGameBySlug(slug)
        expect(entry).toBeDefined()
        renderAt(gameRoutePath(slug))

        expect(await screen.findByRole('heading', { level: 1, name: new RegExp(entry!.title) }, FIND)).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: 'このゲームについて' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 3, name: 'あそびかた' })).toBeInTheDocument()
      }, TEST_TIMEOUT)

      test('seo.descriptionの文章が画面に出る', async () => {
        const entry = findGameBySlug(slug)!
        renderAt(gameRoutePath(slug))
        await screen.findByRole('heading', { level: 2, name: 'このゲームについて' }, FIND)
        expect(screen.getByText(entry.seo.description)).toBeInTheDocument()
      }, TEST_TIMEOUT)

      test('intro.howToPlayの全行が画面に出る', async () => {
        const entry = findGameBySlug(slug)!
        renderAt(gameRoutePath(slug))
        await screen.findByRole('heading', { level: 3, name: 'あそびかた' }, FIND)
        for (const line of entry.intro.howToPlay) {
          expect(screen.getByText(line)).toBeInTheDocument()
        }
      }, TEST_TIMEOUT)

      test('「ほかのゲームを みる」という、href="/"の通常リンクが出る', async () => {
        renderAt(gameRoutePath(slug))
        const link = await screen.findByRole('link', { name: 'ほかのゲームを みる' }, FIND)
        expect(link.getAttribute('href')).toBe('/')
      }, TEST_TIMEOUT)
    })
  }
})

// 新しいゲームをgameCatalogへ追加するだけでGameIntroが自動的に付いてくることを保証する
// 横展開テスト。個々のゲーム画面の詳細（h1の内容など）までは見ず、GameIntroが
// 描画したはずの文言だけを確認する。
describe('GameIntro（全ゲームへの横展開スモークテスト）', () => {
  test.each(GAME_CATALOG)('$slug: descriptionとhowToPlayの全行が出る', async (entry) => {
    renderAt(gameRoutePath(entry.slug))
    expect(await screen.findByText(entry.seo.description, undefined, FIND)).toBeInTheDocument()
    for (const line of entry.intro.howToPlay) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
  }, TEST_TIMEOUT)
})

describe('GameIntro（表示しないURL）', () => {
  test('ホーム（/）では「このゲームについて」は出ない', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
  })

  test('こっきクイズのむずかしさ選択より深いURL（/games/flag-quiz/flag-to-name）では出ない', async () => {
    renderAt('/games/flag-quiz/flag-to-name')
    expect(await screen.findByRole('heading', { name: 'むずかしさを えらんでね' }, FIND)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
  }, TEST_TIMEOUT)

  test('さんすうクイズのプレイ画面（/games/math-quiz/add/hard/play）では出ない', async () => {
    renderAt('/games/math-quiz/add/hard/play')
    expect(await screen.findByRole('progressbar', undefined, FIND)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
  }, TEST_TIMEOUT)
})
