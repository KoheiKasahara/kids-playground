// ぬりえの図形（PaintShape）から、タップ領域サイズ検証用のバウンディングボックスを求める。
// このファイルはDOM APIに触れない純ロジックなので、素材の座標ミスをunit projectの
// 軽いテスト（paintPictures.test.ts）だけで検出できる。

export type PaintShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

export type ShapeBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

// このアプリのぬりえ素材が使う絶対座標コマンドだけを許可する。
// 相対コマンド(小文字)やH/V/A/S/Tを使うと後述の制御点抽出が成立しないため、
// 素材側のミスとしてここでthrowし、テストで機械的に検出できるようにする。
const ALLOWED_COMMANDS = new Set(['M', 'L', 'C', 'Q', 'Z'])
const ARG_COUNT: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, Z: 0 }

function parseNumbers(argsText: string): number[] {
  const trimmed = argsText.trim()
  if (trimmed === '') return []
  const tokens = trimmed.split(/[\s,]+/).filter((token) => token.length > 0)
  return tokens.map((token) => {
    const value = Number(token)
    if (Number.isNaN(value)) {
      throw new Error(`shapeBounds: pathのdに不正な数値 "${token}" が含まれています: ${argsText}`)
    }
    return value
  })
}

/**
 * path の bbox を求める。
 *
 * 制約: d は絶対座標の M / L / C / Q / Z コマンドのみで構成されている前提。
 * 相対コマンド(小文字)やH/V/A/S/Tが含まれる場合はthrowする（素材側のミスとして検出する）。
 *
 * 注意: C/Qの制御点も含めた座標ペアのmin/maxをそのまま使うため、この値は
 * 実際に描かれる曲線のbboxそのものではなく、その外接（過大評価）になる。
 * ベジェ曲線の実曲線は制御点の凸包に収まるため、この近似はタップ領域の
 * 最小サイズ検証（実サイズ以上であることの確認）には十分安全な向きの誤差である。
 */
function pathBounds(d: string): ShapeBounds {
  const letters = d.match(/[a-zA-Z]/g) ?? []
  for (const letter of letters) {
    if (!ALLOWED_COMMANDS.has(letter)) {
      throw new Error(`shapeBounds: 未対応のpathコマンド "${letter}" が含まれています（絶対座標のM/L/C/Q/Zのみ対応）: ${d}`)
    }
  }

  const segments = d.match(/[MLCQZ][^MLCQZ]*/g) ?? []
  if (segments.length === 0) {
    throw new Error(`shapeBounds: pathのdが空、またはコマンドを含みません: ${d}`)
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const segment of segments) {
    const command = segment[0]
    const numbers = parseNumbers(segment.slice(1))
    const expected = ARG_COUNT[command]
    if (numbers.length !== expected) {
      throw new Error(
        `shapeBounds: pathコマンド "${command}" の引数の数が想定外です（期待: ${expected}, 実際: ${numbers.length}）: ${segment}`,
      )
    }
    for (let i = 0; i < numbers.length; i += 2) {
      const x = numbers[i]
      const y = numbers[i + 1]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    throw new Error(`shapeBounds: pathから座標を取得できませんでした（Zのみ等）: ${d}`)
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

export function shapeBounds(shape: PaintShape): ShapeBounds {
  if (shape.kind === 'path') return pathBounds(shape.d)
  if (shape.kind === 'circle') {
    const { cx, cy, r } = shape
    return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r, width: r * 2, height: r * 2 }
  }
  const { cx, cy, rx, ry } = shape
  return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry, width: rx * 2, height: ry * 2 }
}
