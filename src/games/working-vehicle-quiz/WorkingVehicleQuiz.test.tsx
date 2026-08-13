import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from '../../app/App'
import { vehicles, vehiclesForLevel } from './data/vehicles'
import type { Vehicle } from './types'
import { LEVEL_LABEL, QUESTION_COUNT } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function vehicleIdFromImage(image: Element | null): string {
  const src = image?.getAttribute('src') ?? ''
  const match = src.match(/images\/working-vehicles\/([a-z-]+)\.png$/)
  if (!match) throw new Error(`unexpected vehicle src: ${src}`)
  return match[1]
}

function questionVehicleFromPhoto(): Vehicle {
  const image = screen.getByAltText('もんだいの くるまの しゃしん')
  const vehicle = vehicles.find((item) => item.id === vehicleIdFromImage(image))
  if (!vehicle) throw new Error('question vehicle not found')
  return vehicle
}

function questionVehicleFromName(): Vehicle {
  const heading = screen.getByRole('heading')
  const match = (heading.textContent ?? '').match(/「(.+)」は\s*どれ？/)
  const vehicle = vehicles.find((item) => item.nameJa === match?.[1])
  if (!vehicle) throw new Error(`question vehicle not found: ${heading.textContent}`)
  return vehicle
}

function photoChoiceButtons(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /ばんめ の くるまの しゃしん/ })
}

async function answerPhotoToName(user: UserEvent, correct: boolean) {
  const answer = questionVehicleFromPhoto()
  const buttons = vehicles
    .map((vehicle) => screen.queryByRole('button', { name: vehicle.nameJa }))
    .filter((button): button is HTMLElement => button !== null)
  const target = correct
    ? screen.getByRole('button', { name: answer.nameJa })
    : buttons.find((button) => button.textContent !== answer.nameJa)
  if (!target) throw new Error('answer button not found')
  await user.click(target)
  await user.click(screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ }))
}

async function answerNameToPhoto(user: UserEvent, correct: boolean) {
  const answer = questionVehicleFromName()
  const buttons = photoChoiceButtons()
  const target = correct
    ? buttons.find((button) => vehicleIdFromImage(button.querySelector('img')) === answer.id)
    : buttons.find((button) => vehicleIdFromImage(button.querySelector('img')) !== answer.id)
  if (!target) throw new Error('photo answer button not found')
  await user.click(target)
  await user.click(screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ }))
}

describe('はたらくくるまクイズ', () => {
  test('開始画面から2つのモードを選べる', () => {
    renderApp('/games/working-vehicle-quiz')
    expect(screen.getByRole('heading', { name: 'はたらくくるまクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /しゃしんを みて こたえる/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /なまえを みて こたえる/ })).toBeInTheDocument()
  })

  test('モード選択後にレベルごとの種類数を選べる', async () => {
    const user = userEvent.setup()
    renderApp('/games/working-vehicle-quiz')
    await user.click(screen.getByRole('button', { name: /しゃしんを みて こたえる/ }))
    expect(screen.getByText('しゃしん → なまえ')).toBeInTheDocument()
    for (const level of ['easy', 'normal', 'hard'] as const satisfies QuizLevel[]) {
      const count = vehiclesForLevel(level).length
      const namePattern = new RegExp(`${LEVEL_LABEL[level]}.*${count}しゅるい`)
      expect(screen.getByRole('button', { name: namePattern })).toBeInTheDocument()
    }
  })

  test('写真→名前は問題写真と名前4択を表示する', () => {
    renderApp('/games/working-vehicle-quiz/photo-to-name/easy/play')
    expect(screen.getByRole('heading', { name: 'この くるまの なまえは？' })).toBeInTheDocument()
    expect(questionVehicleFromPhoto()).toBeDefined()
    const nameButtons = vehicles.filter((vehicle) =>
      screen.queryByRole('button', { name: vehicle.nameJa }),
    )
    expect(nameButtons).toHaveLength(4)
    expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
  })

  test('名前→写真は車名と写真4択を表示する', () => {
    renderApp('/games/working-vehicle-quiz/name-to-photo/normal/play')
    expect(questionVehicleFromName()).toBeDefined()
    expect(photoChoiceButtons()).toHaveLength(4)
    expect(screen.getByText('ふつう')).toBeInTheDocument()
  })

  test('回答後は正誤を色だけでなく記号と文でも通知する', async () => {
    const user = userEvent.setup()
    renderApp('/games/working-vehicle-quiz/photo-to-name/hard/play')
    const answer = questionVehicleFromPhoto()
    await user.click(screen.getByRole('button', { name: answer.nameJa }))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('せいかい！')
    expect(status).toHaveTextContent(`こたえ: ${answer.nameJa}`)
    expect(screen.getByRole('button', { name: `◯ ${answer.nameJa}` })).toBeDisabled()
  })

  test('回答前後でページのルート要素の className が変化しない（レイアウトシフトしない）', async () => {
    const user = userEvent.setup()
    const { container } = renderApp('/games/working-vehicle-quiz/photo-to-name/hard/play')
    const pageElement = container.firstElementChild
    const classNameBefore = pageElement?.className
    expect(classNameBefore).toBeTruthy()
    const answer = questionVehicleFromPhoto()
    await user.click(screen.getByRole('button', { name: answer.nameJa }))
    expect(container.firstElementChild?.className).toBe(classNameBefore)
  })

  test('不正なlevelは同じモードのむずかしさ選択へ安全に戻す', () => {
    renderApp('/games/working-vehicle-quiz/name-to-photo/super-hard/play')
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByText('なまえ → しゃしん')).toBeInTheDocument()
  })

  test('写真→名前を10問終えると結果を表示する', async () => {
    const user = userEvent.setup()
    renderApp('/games/working-vehicle-quiz/photo-to-name/hard/play')
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      await answerPhotoToName(user, true)
    }
    expect(screen.getByRole('heading', { name: 'けっか' })).toBeInTheDocument()
    expect(screen.getByText(/10\s*\/\s*10もん せいかい/)).toBeInTheDocument()
  }, 20000)

  test('名前→写真を10問終えて「もういちど」で再開できる', async () => {
    const user = userEvent.setup()
    renderApp('/games/working-vehicle-quiz/name-to-photo/hard/play')
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      await answerNameToPhoto(user, true)
    }
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
    expect(photoChoiceButtons()).toHaveLength(4)
  }, 20000)

  test('結果URLへ直接アクセスすると開始画面へ戻る', () => {
    renderApp('/games/working-vehicle-quiz/photo-to-name/easy/result')
    expect(screen.getByRole('heading', { name: 'はたらくくるまクイズ' })).toBeInTheDocument()
  })
})
