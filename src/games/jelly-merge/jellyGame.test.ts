import { describe, expect, test } from 'vitest'
import { columnAt, createJellyGame, landingRow, planJellyDrop, ROWS, type JellyGame } from './jellyGame'

const mass = (game: JellyGame) => game.pieces.reduce((sum, piece) => sum + 2 ** piece.tier, 0)

describe('jelly merge turns', () => {
  test('center drop chains, collapses gaps and retains immutable animation/undo snapshots', () => {
    const game = createJellyGame(42)
    const before = structuredClone(game)
    const turn = planJellyDrop(game, 2)!
    expect(game).toEqual(before)
    expect(turn.frames[0].pieces.at(-1)?.row).toBe(ROWS)
    expect(turn.frames.some((frame) => frame.kind === 'land')).toBe(true)
    expect(turn.frames.filter((frame) => frame.kind === 'merge').length).toBeGreaterThanOrEqual(2)
    expect(turn.frames.some((frame) => frame.kind === 'pull')).toBe(true)
    expect(turn.frames.some((frame) => frame.kind === 'fall')).toBe(true)
    expect(turn.result.score).toBeGreaterThanOrEqual(100)
    expect(mass(turn.result)).toBe(mass(game) + 2 ** game.current)
    expect(turn.frames[1].pieces.at(-1)?.tier).toBe(1)
    expect(planJellyDrop(game, 2)).toEqual(turn)
  })

  test('a full column can clear on its last allowed drop before checking the limit', () => {
    const game = createJellyGame(1)
    game.pieces = [3, 2, 3, 1].map((tier, row) => ({ id: row, tier, row, col: 0 }))
    const turn = planJellyDrop(game, 0)!
    expect(turn.result.status).toBe('playing')
    expect(landingRow(turn.result.pieces, 0)).toBe(4)
  })

  test('rainbow wins; unmatched fifth jelly ends the game; stopped games cannot drop', () => {
    const win = createJellyGame(1)
    win.current = 4
    win.pieces = [{ id: 0, col: 0, row: 0, tier: 4 }]
    expect(planJellyDrop(win, 0)?.result.status).toBe('won')
    const full = createJellyGame(1)
    full.pieces = [3, 2, 1, 2].map((tier, row) => ({ id: row, tier, row, col: 0 }))
    const ended = planJellyDrop(full, 0)!.result
    expect(ended.status).toBe('full')
    expect(planJellyDrop(ended, 4)).toBeNull()
    expect(planJellyDrop({ ...ended, status: 'won' }, 4)).toBeNull()
  })

  test('rejects invalid or already full columns and maps pointer edges safely', () => {
    const game = createJellyGame(3)
    for (const col of [-1, 5, 1.5, NaN, Infinity]) expect(planJellyDrop(game, col)).toBeNull()
    game.pieces = Array.from({ length: 5 }, (_, row) => ({ id: row, tier: 1, row, col: 0 }))
    expect(planJellyDrop(game, 0)).toBeNull()
    expect(columnAt(-20, 0, 500)).toBe(0)
    expect(columnAt(500, 0, 500)).toBe(4)
    expect(columnAt(350, 100, 500)).toBe(2)
    expect(columnAt(20, 0, 0)).toBe(2)
  })

  test('different placements produce different scores; generated turns conserve jelly value and compact columns', () => {
    expect(planJellyDrop(createJellyGame(9), 1)?.result.score).not.toBe(planJellyDrop(createJellyGame(9), 2)?.result.score)
    for (let seed = 1; seed <= 12; seed++) {
      let game = createJellyGame(seed)
      for (let turn = 0; turn < 25 && game.status === 'playing'; turn++) {
        const next = planJellyDrop(game, (turn * 3 + seed) % 5)!.result
        expect(mass(next)).toBe(mass(game) + 2 ** game.current)
        expect(new Set(next.pieces.map((piece) => piece.id)).size).toBe(next.pieces.length)
        for (let col = 0; col < 5; col++) {
          const rows = next.pieces.filter((piece) => piece.col === col).map((piece) => piece.row).sort((a, b) => a - b)
          expect(rows).toEqual(rows.map((_, row) => row))
        }
        expect(next.next.every((tier) => tier === 1 || tier === 2)).toBe(true)
        game = next
      }
    }
  })
})
