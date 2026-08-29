// Issue #298の回帰テスト: React.lazy()で遅延ロードされるゲーム（rail-builderなど10ゲーム）で、
// チャンク未解決の間にGameIntroだけが先に描画されてゲーム本体の<main>が存在しない、
// という中間状態が構造的に発生しないことを検証する。
//
// 調査コメントではPlaywrightで実チャンクの取得を700ms遅延させ、開発サーバー上のDOMを
// 20ms間隔でサンプリングして中間状態を実証した。ここでは同じ発生条件（Suspenseが
// 解決するまでの間）をvi.mockで人為的に再現し、CIで決定的に検証できるユニットテストにする。
import type { ReactElement } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// 動的importをこちらで完全に制御するため、rail-builder本体をスタブに差し替える。
// resolveRailBuilderImport()を呼ぶまでimport()のPromiseは解決しない。
const deferred = vi.hoisted(() => {
  let resolve!: (module: { default: () => ReactElement }) => void
  const promise = new Promise<{ default: () => ReactElement }>((r) => {
    resolve = r
  })
  return { promise, resolve: (mod: { default: () => ReactElement }) => resolve(mod) }
})

vi.mock('../games/rail-builder/RailBuilderPlay', () => deferred.promise)

// vi.mockはファイル先頭へ巻き上げられるため、Appのimportはモック登録より後に書く必要はないが、
// 可読性のため一連の流れとして最後に置く。
const { default: App } = await import('./App')

// 何らかの理由でPromiseが解決されずSuspenseが解決しない場合、テストがハングして
// CI全体を長時間ブロックしてしまうのを防ぐため、明示的に短いタイムアウトを設定する。
const TEST_TIMEOUT = 10_000

describe('lazyルートとGameIntroのSuspense同期(Issue #298)', () => {
  test(
    'チャンク未解決の間はGameIntro単独状態にならず、解決後は本体と同時に現れる',
    async () => {
      render(
        <MemoryRouter initialEntries={['/games/rail-builder']}>
          <App />
        </MemoryRouter>,
      )

      // Suspense解決前: GameIntro（「このゲームについて」見出し）が先に露出しないこと。
      // App.tsxで{element}とGameIntroを同じSuspense境界に入れているため、
      // 未解決の間はどちらもfallback={null}に置き換わり、何も描画されない。
      expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
      expect(screen.queryByRole('main')).not.toBeInTheDocument()

      deferred.resolve({ default: () => <main>rail-builder stub</main> })

      // 解決後: ゲーム本体とGameIntroが同一コミットで揃って現れる。
      expect(await screen.findByRole('main', undefined, { timeout: TEST_TIMEOUT })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    },
    TEST_TIMEOUT,
  )
})
