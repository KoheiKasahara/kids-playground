import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import TrainJourneyPlay from './TrainJourneyPlay'
import type { useTrainJourneyEngine } from './useTrainJourneyEngine'

type Options = Parameters<typeof useTrainJourneyEngine>[0]
const engine = vi.hoisted(() => ({ options: undefined as Options | undefined, retry: vi.fn(), boost: vi.fn(), overview: vi.fn() }))
vi.mock('./useTrainJourneyEngine', () => ({
  useTrainJourneyEngine: (options: Options) => {
    engine.options = options
    return { registerContainer: () => {}, registerMapMarker: () => {}, registerSwitchMarker: () => () => {}, retry: engine.retry, boost: engine.boost, overview: engine.overview }
  },
}))
vi.mock('./journeySound', () => ({ journeySound: vi.fn() }))

function ready() {
  render(<TrainJourneyPlay />)
  act(() => engine.options?.onStatus('ready'))
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('でんしゃの たび controls', () => {
  test('chooses all three trains and retains the selected train when returning', async () => {
    const user = userEvent.setup()
    ready()
    for (const [id, name] of [['bullet', 'しんかんせん'], ['cargo', 'かもつれっしゃ'], ['steam', 'きかんしゃ']]) {
      await user.click(screen.getByRole('button', { name: `${name}を えらぶ` }))
      expect(engine.options?.train).toBe(id)
    }
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ！' }))
    expect(engine.options?.running).toBe(true)
    await user.click(screen.getByRole('button', { name: 'でんしゃを えらびなおす' }))
    expect(engine.options?.running).toBe(false)
    expect(screen.getByRole('button', { name: 'きかんしゃを えらぶ' })).toHaveAttribute('aria-pressed', 'true')
  })
  test('both point controls cycle through every destination in step', async () => {
    const user = userEvent.setup()
    ready()
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ！' }))
    for (const [control, route, label] of [
      ['ポイントを きりかえる', 'forest', 'トンネル'],
      ['コースの ポイントを きりかえる', 'city', 'まち'],
      ['ポイントを きりかえる', 'bridge', 'はし'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: control }))
      expect(engine.options?.routes).toEqual([route])
      expect(screen.getByRole('complementary')).toHaveAccessibleName(`コースマップ。つぎは ${label}`)
    }
  })
  test('the city map rebuilds the world and gives each of its two points its own control', async () => {
    const user = userEvent.setup()
    ready()
    const island = engine.options?.course
    await user.click(screen.getByRole('button', { name: 'とかいの コースを えらぶ' }))
    expect(screen.getByRole('button', { name: 'とかいの コースを えらぶ' })).toHaveAttribute('aria-pressed', 'true')
    expect(engine.options?.course).not.toBe(island)
    expect(engine.options?.course.id).toBe('downtown')
    expect(engine.options?.routes).toEqual(['skyway', 'tower'])
    act(() => engine.options?.onStatus('ready'))
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ！' }))
    expect(screen.queryByRole('button', { name: 'ポイントを きりかえる' })).toBeNull()
    for (const expected of [['subway', 'tower'], ['river', 'tower'], ['skyway', 'tower']]) {
      await user.click(screen.getByRole('button', { name: 'ひとつめの ポイントを きりかえる' }))
      expect(engine.options?.routes).toEqual(expected)
    }
    await user.click(screen.getByRole('button', { name: 'ふたつめの ポイントを きりかえる' }))
    expect(engine.options?.routes).toEqual(['skyway', 'harbor'])
    await user.click(screen.getByRole('button', { name: 'コースの ふたつめの ポイントを きりかえる' }))
    expect(engine.options?.routes).toEqual(['skyway', 'tower'])
    expect(screen.getByRole('complementary')).toHaveAccessibleName('コースマップ。つぎは こうか')
    // Once the train is past the first point, the map and hint follow the second.
    act(() => engine.options?.onFeedback({ location: 'ビルの まちを すすむよ！', boosting: false, atStation: false, nextSwitch: 1 }))
    expect(screen.getByRole('complementary')).toHaveAccessibleName('コースマップ。つぎは タワー')
    expect(screen.getByRole('button', { name: 'ふたつめの ポイントを きりかえる' })).toHaveAttribute('data-next', 'true')
    await user.click(screen.getByRole('button', { name: 'でんしゃを えらびなおす' }))
    await user.click(screen.getByRole('button', { name: 'しまの コースを えらぶ' }))
    expect(engine.options?.course).toBe(island)
    expect(engine.options?.routes).toEqual(['bridge'])
  })
  test('pausing, resuming with boost, camera selection, and mute are independent', async () => {
    const user = userEvent.setup()
    ready()
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ！' }))
    await user.click(screen.getByRole('button', { name: 'とまる' }))
    expect(engine.options?.running).toBe(false)
    await user.click(screen.getByRole('button', { name: 'かそく！' }))
    expect(engine.boost).toHaveBeenCalledOnce()
    expect(engine.options?.running).toBe(true)
    await user.click(screen.getByRole('button', { name: 'ぜんたい' }))
    expect(engine.options?.camera).toBe('overview')
    await user.click(screen.getByRole('button', { name: 'おと' }))
    expect(engine.options?.sound).toBe(false)
    expect(engine.options?.running).toBe(true)
  })
  test('model errors disable departure and expose retry', async () => {
    const user = userEvent.setup()
    render(<TrainJourneyPlay />)
    expect(screen.getByRole('button', { name: 'しゅっぱつ！' })).toBeDisabled()
    act(() => engine.options?.onStatus('error'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engine.retry).toHaveBeenCalledOnce()
    act(() => engine.options?.onStatus('ready'))
    expect(screen.getByRole('button', { name: 'しゅっぱつ！' })).toBeEnabled()
  })
  test('reduced-motion starts with a stable full-course camera', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    ready()
    await userEvent.setup().click(screen.getByRole('button', { name: 'しゅっぱつ！' }))
    expect(engine.options?.camera).toBe('overview')
    expect(engine.options?.reducedMotion).toBe(true)
  })
})
