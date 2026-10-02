/**
 * ホームのカードでゲーム名を2行に分けるときの区切りを決める。
 *
 * 日本語は1文字ごとに折り返せるため、ブラウザ任せだと「こっきピ／ンボール」のように
 * ことばの途中で切れやすい。ここでは文字種の変わり目（こっき｜ピンボール）、空白、
 * 「！」「？」のうしろだけを区切り候補にし、長い方が最も短くなる位置を1つ選ぶ。どちらかが1行に収まらない長さに
 * なるときは区切らず、ブラウザの折り返しに任せる。
 */

type ScriptKind = 'hiragana' | 'katakana' | 'kanji' | 'latin' | 'other'

export type TileTitleSplit = {
  head: string
  tail: string
  /** 元の名前で head と tail のあいだに空白があったか。 */
  spaced: boolean
}

/**
 * 1行に収める区切りの長さの上限（全角1・半角0.6として数える）。
 * Home.module.css のカード（一覧・棚とも）は、幅360px以上なら全角7文字が1行に入る。
 */
export const MAX_TILE_TITLE_LINE_WIDTH = 7

function scriptOf(char: string): ScriptKind {
  if (/[\u3041-\u309f]/.test(char)) return 'hiragana'
  if (/[\u30a0-\u30ff]/.test(char)) return 'katakana'
  if (/[\u4e00-\u9fff]/.test(char)) return 'kanji'
  if (/[A-Za-z0-9]/.test(char)) return 'latin'
  return 'other'
}

function displayWidth(text: string): number {
  return [...text].reduce((width, char) => width + (char.charCodeAt(0) < 0x80 ? 0.6 : 1), 0)
}

function isBreakBetween(before: string, after: string): boolean {
  const a = scriptOf(before)
  const b = scriptOf(after)
  if (/[！？!?]/.test(before)) return b !== 'other'
  if (a === 'other' || b === 'other' || a === b) return false
  // 漢字＋送りがな（「遊ぶ」など）は1つのことばなので切らない。
  return !(a === 'kanji' && b === 'hiragana')
}

export function splitTileTitle(title: string): TileTitleSplit | null {
  const chars = [...title]
  let best: (TileTitleSplit & { longest: number }) | null = null

  for (let index = 1; index < chars.length; index += 1) {
    let head: string
    let tail: string
    let spaced = false
    if (chars[index] === ' ') {
      head = chars.slice(0, index).join('')
      tail = chars.slice(index + 1).join('')
      spaced = true
    } else if (chars[index - 1] !== ' ' && isBreakBetween(chars[index - 1], chars[index])) {
      head = chars.slice(0, index).join('')
      tail = chars.slice(index).join('')
    } else {
      continue
    }
    if (head.trim() === '' || tail.trim() === '') continue

    const longest = Math.max(displayWidth(head), displayWidth(tail))
    // 同じ長さなら前で切る方（こっき｜コロコロパズル）を選ぶ。
    if (best === null || longest < best.longest) {
      best = { head, tail, spaced, longest }
    }
  }

  if (best === null || best.longest > MAX_TILE_TITLE_LINE_WIDTH) return null
  return { head: best.head, tail: best.tail, spaced: best.spaced }
}
