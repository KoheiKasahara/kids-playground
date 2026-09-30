import { describe, expect, test } from 'vitest'
import { initialOrigamiState, origamiReducer } from './origamiState'
import { foldHint } from './origamiView'
import { ORIGAMI_TEMPLATES, PAPER_COLORS, origamiSequence } from './origamiTemplates'

test('作品と紙の色は重複せず、すべての手順のヒントが画面内にある', () => {
  for (const entries of [ORIGAMI_TEMPLATES, PAPER_COLORS]) {
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length)
    expect(new Set(entries.map(entry => entry.name)).size).toBe(entries.length)
  }
  for (const template of ORIGAMI_TEMPLATES) {
    expect(template.steps.length).toBeGreaterThan(0)
    template.steps.forEach((step, index) => {
      expect(step.instruction.trim().length).toBeGreaterThan(0)
      const hint = foldHint(template.id, index)
      expect(hint.x).toBeGreaterThan(0)
      expect(hint.x).toBeLessThan(400)
      expect(hint.y).toBeGreaterThan(0)
      expect(hint.y).toBeLessThan(360)
    })
  }
  for (const color of PAPER_COLORS) {
    for (const tone of [color.main, color.light, color.dark]) expect(tone).toMatch(/^#[0-9a-f]{6}$/i)
  }
})

describe('おりがみの進行', () => {
  test.each(ORIGAMI_TEMPLATES)('$nameは一折りずつ進み、完成後は進まない', (template) => {
    const total = template.steps.length
    let state = initialOrigamiState

    for (let step = 0; step < total; step += 1) {
      expect(origamiReducer(state, { type: 'settle', total })).toBe(state)
      state = origamiReducer(state, { type: 'fold', total })
      expect(state).toEqual({ step, folding: true })
      // Several fingers or rapid taps during a fold must not skip its animation.
      for (let tap = 0; tap < 8; tap += 1) {
        expect(origamiReducer(state, { type: 'fold', total })).toBe(state)
      }
      state = origamiReducer(state, { type: 'settle', total })
      expect(state).toEqual({ step: step + 1, folding: false })
    }

    expect(origamiReducer(state, { type: 'fold', total })).toBe(state)
    expect(origamiReducer(state, { type: 'settle', total })).toBe(state)
    expect(origamiReducer(state, { type: 'reset' })).toEqual(initialOrigamiState)
  })

  test('折っている途中でやり直すと、遅れて届く完了通知を無視する', () => {
    const total = ORIGAMI_TEMPLATES[0]!.steps.length
    const folding = origamiReducer(initialOrigamiState, { type: 'fold', total })
    const reset = origamiReducer(folding, { type: 'reset' })
    expect(reset).toEqual({ step: 0, folding: false })
    expect(origamiReducer(reset, { type: 'settle', total })).toBe(reset)
    expect(initialOrigamiState).toEqual({ step: 0, folding: false })
  })

  test('完了通知が最後の折り数を超えず、折り数がない場合は開始しない', () => {
    expect(origamiReducer({ step: 3, folding: true }, { type: 'settle', total: 3 }))
      .toEqual({ step: 3, folding: false })
    expect(origamiReducer(initialOrigamiState, { type: 'fold', total: 0 })).toBe(initialOrigamiState)
  })
})

describe('折り紙の手順', () => {
  test.each(ORIGAMI_TEMPLATES)('$nameは正方形の紙から、すべての手順で紙が動いて作品になる', (template) => {
    const { states, frames } = origamiSequence(template.id)
    expect(frames).toHaveLength(template.steps.length)
    expect(states).toHaveLength(template.steps.length + 1)
    expect(states[0]).toHaveLength(1)
    for (const faces of states) {
      expect(faces.length).toBeGreaterThan(0)
      for (const face of faces) {
        expect(face.points.length).toBeGreaterThanOrEqual(3)
        for (const [x, y] of face.points) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
        }
      }
    }
    for (const frame of frames) {
      if (frame.type === 'reshape') expect(frame.removed.size).toBeGreaterThan(0)
      else if (frame.type !== 'flip') expect(frame.moving.size).toBeGreaterThan(0)
    }
  })

  test('つるは たくさん おる ちょうせんの さくひん', () => {
    expect(ORIGAMI_TEMPLATES.find((template) => template.id === 'crane')!.steps.length).toBeGreaterThanOrEqual(15)
  })
})
