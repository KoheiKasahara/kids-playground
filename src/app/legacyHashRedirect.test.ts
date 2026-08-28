import { describe, expect, test, vi } from 'vitest'
import { redirectLegacyHashUrl } from './legacyHashRedirect'

function createFakeWindow(hash: string) {
  return {
    location: { hash },
    history: { replaceState: vi.fn() },
  }
}

describe('redirectLegacyHashUrl', () => {
  test('#/games/flag-pinball 形式なら replaceState がパス型URLで呼ばれ、戻り値も同じ', () => {
    const win = createFakeWindow('#/games/flag-pinball')
    const result = redirectLegacyHashUrl(win)
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/games/flag-pinball')
    expect(result).toBe('/games/flag-pinball')
  })

  test('ハッシュが無ければ何もしない', () => {
    const win = createFakeWindow('')
    const result = redirectLegacyHashUrl(win)
    expect(win.history.replaceState).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  test('#section のようなルート形式でないハッシュは何もしない', () => {
    const win = createFakeWindow('#section')
    const result = redirectLegacyHashUrl(win)
    expect(win.history.replaceState).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  test('#//evil.example のようなプロトコル相対URLは何もしない', () => {
    const win = createFakeWindow('#//evil.example')
    const result = redirectLegacyHashUrl(win)
    expect(win.history.replaceState).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  test('クエリ付きのハッシュも保持される', () => {
    const win = createFakeWindow('#/games/prefecture-quiz/kanji/play?a=1')
    const result = redirectLegacyHashUrl(win)
    expect(win.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/games/prefecture-quiz/kanji/play?a=1',
    )
    expect(result).toBe('/games/prefecture-quiz/kanji/play?a=1')
  })
})
