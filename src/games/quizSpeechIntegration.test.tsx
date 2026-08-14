import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../app/App'
import JapanTravelQuizPlay from './japan-travel-quiz/JapanTravelQuizPlay'
import WorldTravelQuizPlay from './world-travel-quiz/WorldTravelQuizPlay'

/**
 * 「すべてのクイズのプレイ画面に よみあげトグルが置かれているか」だけを保証する
 * ガードテスト。将来クイズが追加されたときに、このトグルの配線を入れ忘れたら
 * ここで気づけるようにする（各クイズの挙動そのものは各クイズのテストファイルで見る）。
 *
 * 世界旅行・にほん旅行クイズの地図は window.matchMedia に依存しており、jsdom には
 * 実装がないため、他の WorldTravelQuiz.test.tsx / JapanTravelQuiz.test.tsx と同じく
 * reduced-motion を返すモックを描画前に用意する（本題のよみあげトグルとは無関係）。
 */
const originalMatchMedia = window.matchMedia
afterEach(() => {
  window.matchMedia = originalMatchMedia
})
function reducedMotion() {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function renderWorldTravel(path: string) {
  reducedMotion()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/world-travel-quiz/:region/:answerMode/play" element={<WorldTravelQuizPlay />} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderJapanTravel(path: string) {
  reducedMotion()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/games/japan-travel-quiz/play" element={<JapanTravelQuizPlay />} />
      </Routes>
    </MemoryRouter>,
  )
}

type Case = {
  name: string
  render: () => void
  heading: string | RegExp
}

const cases: Case[] = [
  {
    name: '国旗クイズ（こっき→なまえ）',
    render: () => renderApp('/games/flag-quiz/flag-to-name/hard/play'),
    heading: 'この くにの なまえは？',
  },
  {
    name: '国旗クイズ（なまえ→こっき）',
    render: () => renderApp('/games/flag-quiz/name-to-flag/hard/play'),
    heading: /の\s*こっきは\s*どれ？/,
  },
  {
    name: '国旗クイズ（パネルめくり）',
    render: () => renderApp('/games/flag-quiz/panel-flag/hard/play'),
    heading: 'この くにの なまえは？',
  },
  {
    name: 'はたらくくるまクイズ（しゃしん→なまえ）',
    render: () => renderApp('/games/working-vehicle-quiz/photo-to-name/easy/play'),
    heading: 'この くるまの なまえは？',
  },
  {
    name: 'はたらくくるまクイズ（なまえ→しゃしん）',
    render: () => renderApp('/games/working-vehicle-quiz/name-to-photo/normal/play'),
    heading: /は\s*どれ？/,
  },
  {
    name: 'おやさいクイズ（イラスト→なまえ）',
    render: () => renderApp('/games/vegetable-quiz/image-to-name/play'),
    heading: 'これは なに？',
  },
  {
    name: 'おやさいクイズ（なまえ→イラスト）',
    render: () => renderApp('/games/vegetable-quiz/name-to-image/play'),
    heading: /は\s*どれ？/,
  },
  {
    name: 'さんすうクイズ',
    render: () => renderApp('/games/math-quiz/add/easy/play'),
    heading: /=\s*\?/,
  },
  {
    name: '都道府県クイズ（かたち→なまえ）',
    render: () => renderApp('/games/prefecture-quiz/shape-to-name/play'),
    heading: 'この かたちは なーんだ？',
  },
  {
    name: '都道府県クイズ（なまえ→かたち）',
    render: () => renderApp('/games/prefecture-quiz/name-to-shape/play'),
    heading: /は\s*どれ？/,
  },
  {
    name: '都道府県クイズ（なまえ→ちず）',
    render: () => renderApp('/games/prefecture-quiz/name-to-map/play'),
    heading: /は\s*どこ？/,
  },
  {
    name: '都道府県パズル',
    render: () => renderApp('/games/prefecture-quiz/puzzle/kanto/play'),
    heading: 'かんとう地方 パズル',
  },
  {
    name: 'いろまぜクイズ',
    render: () => renderApp('/games/color-mix-quiz/play'),
    heading: /この (2|3)しょくを まぜると？|この いろから ひくと？/,
  },
  {
    name: 'せかい旅行クイズ（国名）',
    render: () => renderWorldTravel('/games/world-travel-quiz/asiaOceania/country-name/play'),
    heading: 'この くには どこ？',
  },
  {
    name: 'せかい旅行クイズ（国旗）',
    render: () => renderWorldTravel('/games/world-travel-quiz/europe/flag/play'),
    heading: 'この くにの こっきは どれ？',
  },
  {
    name: 'にほん旅行クイズ',
    render: () => renderJapanTravel('/games/japan-travel-quiz/play'),
    heading: 'ここは なんけん？',
  },
]

describe('すべてのクイズのプレイ画面に よみあげトグルがある', () => {
  test.each(cases.map((testCase) => [testCase.name, testCase] as const))(
    '%s',
    (_name, testCase) => {
      testCase.render()
      expect(screen.getByRole('heading', { name: testCase.heading })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /よみあげ/ })).toBeInTheDocument()
    },
  )
})
