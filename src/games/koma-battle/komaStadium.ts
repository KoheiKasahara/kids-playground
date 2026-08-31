/**
 * 円形スタジアムの形状。
 *
 * 物理は「浅いすり鉢の高さ場1枚 + 外周壁のcuboid列」だけで作る。
 * 見た目Meshは同じ profile 関数から作るので、形が二重管理にならない。
 */

/** すり鉢の半径。ここまでが遊べる面。 */
export const BOWL_RADIUS = 2.4

/**
 * いちばん低い「谷」の半径。
 *
 * 単純に中心がいちばん低いすり鉢にすると、2個のコマが必ず中央の一点へ集まって
 * 寄りかかったまま同時に倒れ、引き分けばかりになる。
 * 中心をわずかに盛り上げてドーナツ状の谷を作ると、2個は谷に沿って回り続け、
 * 何度もすれ違って衝突しつつ、別々のタイミングで力尽きるようになる。
 */
export const VALLEY_RADIUS = 0.3

/** 谷の底が外周の縁より何メートル低いか。浅くして急勾配にしない。 */
export const BOWL_DEPTH = 0.2

/** 高さ場が覆う範囲の半径。縁の外側に少しだけ平らな踏みしろを残す。 */
export const FIELD_RADIUS = 2.62

/** 外周壁。 */
export const WALL_INNER_RADIUS = 2.4
export const WALL_THICKNESS = 0.16
export const WALL_HEIGHT = 0.34
/** 壁を作る cuboid の枚数。多角形近似の粗さと剛体数のバランス。 */
export const WALL_SEGMENTS = 24

/** 高さ場の分割数。1マス約0.08mで、浅い曲面を滑らかに近似できる。静的なので負荷は無視できる。 */
export const HEIGHTFIELD_SEGMENTS = 64

/** 場外と見なす水平距離。壁の外側の、床が無い領域。 */
export const OUT_RADIUS = 2.72

/**
 * 谷を底とする二次曲線の係数。縁(BOWL_RADIUS)でちょうど高さ0になるように決める。
 * これにより中心はおよそ0.14mだけ谷より高い、ゆるやかな盛り上がりになる。
 */
export const BOWL_CURVATURE =
  BOWL_DEPTH / ((BOWL_RADIUS - VALLEY_RADIUS) * (BOWL_RADIUS - VALLEY_RADIUS))

/**
 * 中心からの距離に対する床の高さ。
 *
 * 谷(VALLEY_RADIUS)を最も低い -BOWL_DEPTH とし、縁(BOWL_RADIUS)で0になる二次曲線。
 * 谷より内側では中心へ向かって少しずつ高くなるため、
 * 中央へ寄ったコマはゆるやかに谷へ押し戻される。
 */
export function bowlHeightAt(radius: number): number {
  if (!Number.isFinite(radius)) return 0
  const clamped = Math.min(Math.max(radius, 0), FIELD_RADIUS)
  if (clamped >= BOWL_RADIUS) return 0
  const offset = clamped - VALLEY_RADIUS
  return BOWL_CURVATURE * offset * offset - BOWL_DEPTH
}

/**
 * 床の傾き(dy/dr)。符号は谷へ向かう向きを表し、絶対値が大きいほど寄せる力が強い。
 * テストで「浅すぎない・急すぎない」を数値で押さえるために公開している。
 */
export function bowlSlopeAt(radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return 0
  if (radius >= BOWL_RADIUS) return 0
  // 谷より外側は正（内向きに戻す）、内側は負（外向きに押し出す）。
  return 2 * BOWL_CURVATURE * (radius - VALLEY_RADIUS)
}

export type StadiumHeightfield = {
  /** Rapierへ渡す行数・列数（頂点数はそれぞれ+1）。 */
  segments: number
  /** 列優先(column-major)で並んだ高さ。Rapierの要求に合わせている。 */
  heights: Float32Array
  /** 高さ場が覆う一辺の長さ。 */
  size: number
}

/**
 * すり鉢の高さ場を作る。
 *
 * 半径 FIELD_RADIUS の外側は、壁を越えたコマがそのまま落ちて場外になるよう
 * 大きく下げた値を入れておく（壁の内側にいる限りこの領域には触れない）。
 */
export function createStadiumHeightfield(
  segments: number = HEIGHTFIELD_SEGMENTS,
): StadiumHeightfield {
  const size = FIELD_RADIUS * 2
  const vertices = segments + 1
  const heights = new Float32Array(vertices * vertices)
  for (let column = 0; column < vertices; column += 1) {
    for (let row = 0; row < vertices; row += 1) {
      const x = (column / segments - 0.5) * size
      const z = (row / segments - 0.5) * size
      const radius = Math.hypot(x, z)
      // 列優先。Rapierのheightfieldはこの順序で読む。
      heights[column * vertices + row] =
        radius > FIELD_RADIUS ? -2 : bowlHeightAt(radius)
    }
  }
  return { segments, heights, size }
}

export type WallSegment = {
  /** 壁の中心座標。yは縁の高さ(0)から壁の高さの半分だけ上。 */
  center: { x: number; y: number; z: number }
  /** Y軸まわりの回転。壁の面が円の接線を向く。 */
  yaw: number
  halfWidth: number
  halfHeight: number
  halfDepth: number
}

/**
 * 外周壁を、円周上に並べた少数のcuboidで作る。
 * 高さ場に急な壁を立てると接触が暴れやすいため、壁だけは平らな箱に分けている。
 */
export function createWallSegments(count: number = WALL_SEGMENTS): WallSegment[] {
  const segments: WallSegment[] = []
  const centerRadius = WALL_INNER_RADIUS + WALL_THICKNESS / 2
  // 隣同士に隙間ができないよう、1枚の幅は弦の長さより少しだけ広く取る。
  const halfWidth = Math.tan(Math.PI / count) * centerRadius + WALL_THICKNESS / 2
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    segments.push({
      center: {
        x: Math.cos(angle) * centerRadius,
        y: WALL_HEIGHT / 2,
        z: Math.sin(angle) * centerRadius,
      },
      // cuboidのローカルZ(厚み)を半径方向、X(幅)を接線方向へ向けるYaw。
      yaw: Math.PI / 2 - angle,
      halfWidth,
      halfHeight: WALL_HEIGHT / 2,
      halfDepth: WALL_THICKNESS / 2,
    })
  }
  return segments
}
