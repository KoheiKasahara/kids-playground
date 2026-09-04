import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TsumikiBowlingStageSelect from './TsumikiBowlingStageSelect'
import TsumikiBowlingPlay from './TsumikiBowlingPlay'
import { BOWLING_STAGES } from './bowlingStage'
import type { TsumikiBowlingEngineOptions } from './useTsumikiBowlingEngine'

// WebGLとRapierはjsdomで動かさない。ここではエンジンへ渡ったstageIdと、
// TsumikiBowlingGameが本当にアンマウント（＝release()相当）されたかだけを見る。
const engineMock = vi.hoisted(() => ({
  options: undefined as TsumikiBowlingEngineOptions | undefined,
  registerContainer: vi.fn(),
  setBallId: vi.fn(),
  /** エンジンが呼ばれた（マウントされた）回数。 */
  mountCount: 0,
  /** エンジンを使うコンポーネントが本当にアンマウントされた回数。 */
  unmountCount: 0,
}))

vi.mock('./useTsumikiBowlingEngine', () => ({
  // "use"で始まる名前を持たせる（メソッド省略記法）ことで、下のuseEffect呼び出しが
  // eslint-plugin-react-hooksからも正しくHooksとして認識されるようにする。
  useTsumikiBowlingEngine(options: TsumikiBowlingEngineOptions) {
    engineMock.options = options
    engineMock.mountCount += 1
    // 実物のuseTsumikiBowlingEngineはeffectのクリーンアップでworldを解放する。
    // ここでも同じ形（空配列依存のuseEffect）でアンマウントだけを数える。
    useEffect(() => {
      return () => {
        engineMock.unmountCount += 1
      }
    }, [])
    return { registerContainer: engineMock.registerContainer, setBallId: engineMock.setBallId }
  },
}))

beforeEach(() => {
  engineMock.options = undefined
  engineMock.mountCount = 0
  engineMock.unmountCount = 0
  engineMock.registerContainer.mockClear()
  engineMock.setBallId.mockClear()
})

describe('TsumikiBowlingStageSelect', () => {
  it('全ステージぶんのボタンがあり、名前が表示されている', () => {
    render(
      <MemoryRouter>
        <TsumikiBowlingStageSelect onSelect={vi.fn()} />
      </MemoryRouter>,
    )
    for (const stage of BOWLING_STAGES) {
      expect(screen.getByRole('button', { name: new RegExp(stage.name) })).toBeInTheDocument()
    }
  })

  it('各カードに形のプレビュー（SVG）がある', () => {
    const { container } = render(
      <MemoryRouter>
        <TsumikiBowlingStageSelect onSelect={vi.fn()} />
      </MemoryRouter>,
    )
    expect(container.querySelectorAll('svg')).toHaveLength(BOWLING_STAGES.length)
  })

  it('ステージを選ぶと、onSelectがそのidで呼ばれる', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <TsumikiBowlingStageSelect onSelect={onSelect} />
      </MemoryRouter>,
    )
    const triangle = BOWLING_STAGES.find((stage) => stage.id === 'triangle')!
    await user.click(screen.getByRole('button', { name: new RegExp(triangle.name) }))
    expect(onSelect).toHaveBeenCalledWith('triangle')
  })

  it('ホームへもどるリンクがある', () => {
    render(
      <MemoryRouter>
        <TsumikiBowlingStageSelect onSelect={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'もどる' })).toHaveAttribute('href', '/')
  })
})

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/games/tsumiki-bowling']}>
      <TsumikiBowlingPlay />
    </MemoryRouter>,
  )
}

describe('TsumikiBowlingPlay（選択画面⇄ゲーム画面の切替）', () => {
  it('最初はステージ選択が出ていて、ゲーム画面は出ていない', () => {
    renderApp()
    expect(screen.getByText('どの つみきを たおす？')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'たまをえらぶ' })).not.toBeInTheDocument()
    expect(engineMock.mountCount).toBe(0)
  })

  it('ステージを選ぶとゲーム画面になり、エンジンへそのstageIdが渡る', async () => {
    const user = userEvent.setup()
    renderApp()
    const heart = BOWLING_STAGES.find((stage) => stage.id === 'heart')!
    await user.click(screen.getByRole('button', { name: new RegExp(heart.name) }))

    expect(screen.getByRole('group', { name: 'たまをえらぶ' })).toBeInTheDocument()
    expect(engineMock.options?.stageId).toBe('heart')
    expect(screen.getByText(heart.name)).toBeInTheDocument()
  })

  it('「ステージをかえる」で選択画面へ戻り、エンジンがアンマウントされる', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /つみきタワー/ }))
    expect(engineMock.unmountCount).toBe(0)

    await user.click(screen.getByRole('button', { name: 'ステージをかえる' }))

    expect(screen.getByText('どの つみきを たおす？')).toBeInTheDocument()
    expect(engineMock.unmountCount).toBe(1)
  })

  it('別ステージを選ぶと、エンジンが作り直されて新しいstageIdが渡る', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /つみきタワー/ }))
    const mountsAfterFirst = engineMock.mountCount

    await user.click(screen.getByRole('button', { name: 'ステージをかえる' }))
    await user.click(screen.getByRole('button', { name: /さんかくタワー/ }))

    expect(engineMock.mountCount).toBeGreaterThan(mountsAfterFirst)
    expect(engineMock.options?.stageId).toBe('triangle')
  })

  it('同じステージをもう一度選んでも、二重生成ではなく作り直しになる', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /つみきタワー/ }))
    const mountsAfterFirst = engineMock.mountCount

    await user.click(screen.getByRole('button', { name: 'ステージをかえる' }))
    expect(engineMock.unmountCount).toBe(1)

    await user.click(screen.getByRole('button', { name: /つみきタワー/ }))
    // 選択画面へ戻った時点で前のエンジンは必ず解放されており、
    // 同じステージでも新しいエンジンが1個だけ作られる（二重生成にならない）。
    expect(engineMock.unmountCount).toBe(1)
    expect(engineMock.mountCount).toBeGreaterThan(mountsAfterFirst)
    expect(engineMock.options?.stageId).toBe('tower')
  })
})
