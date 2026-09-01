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
 * フィールド固有の地形・障害物をまとめた定義。
 *
 * 物理と見た目が同じ定義を読むようにしておくことで、フィールドを増やすときに
 * ゲーム本体へフィールド名ごとの条件分岐を足さずに済む。Phase 4では固定障害物
 * だけを扱い、動的な剛体は追加しない。
 */
export type KomaFieldId = 'basic' | 'bumper' | 'ridge' | 'belt'

export type KomaFieldRidge = {
  radius: number
  height: number
  width: number
}

export type KomaFieldObstacle = {
  type: 'bumper'
  x: number
  z: number
  radius: number
  height: number
}

/**
 * 動く床（ベルト）1枚ぶんのデータ。
 *
 * 物理は「エリア内にいるコマへ毎ステップ弱いimpulseを進行方向へ足すだけ」の
 * 軽量な方式にするため、専用のRigidBodyやColliderは持たない。
 * エリアは軸並行の矩形をangleぶん回転させただけの単純な形にして、判定を安く保つ。
 */
export type KomaFieldBelt = {
  /** エリア中心の座標。 */
  x: number
  z: number
  /** コマを押す向き[rad]。見た目の矢印もこの向きへ流れる。 */
  angle: number
  /** 進行方向（angle方向）の半長。 */
  halfLength: number
  /** 進行方向と直交する向きの半幅。 */
  halfWidth: number
  /** 基準の力（KOMA_BELT_FORCE）に掛ける倍率。既定1。 */
  strength: number
}

/**
 * 点がベルトの矩形エリア内にあるか。
 *
 * ベルトのangleぶん回転させたローカル座標系（X=進行方向）へ変換してから
 * 軸並行の矩形判定をするだけで、毎ステップ・コマごとに呼んでも軽い。
 * 状態を持たないので、境界を何度も出入りしても多重に力が積み上がることはない。
 */
export function isKomaWithinBelt(belt: KomaFieldBelt, x: number, z: number): boolean {
  const dx = x - belt.x
  const dz = z - belt.z
  const cos = Math.cos(belt.angle)
  const sin = Math.sin(belt.angle)
  const localX = dx * cos + dz * sin
  const localZ = -dx * sin + dz * cos
  return Math.abs(localX) <= belt.halfLength && Math.abs(localZ) <= belt.halfWidth
}

/**
 * 外周壁の開口部（場外ポイント）の配置。
 *
 * `createWallSegments` が作る円周上のcuboid列のうち、どのセグメントを
 * 「壁なし区間」にするかを、角度の生の値ではなくセグメント番号で表す。
 * 角度で直接指定すると境界付近の丸め誤差でセグメント数が意図せずずれるため、
 * 壁と同じ離散単位（セグメント）で数えたほうが安全で読みやすい。
 */
export type KomaWallGapConfig = {
  /** 開口部の数。等間隔に配置する。 */
  count: number
  /** 1か所あたりの開口の幅（壁セグメント何枚ぶんか）。 */
  widthSegments: number
  /** 最初の開口を置く基準セグメント番号。既存テストが前提とする東西南北（角度0/90/180/270度）を避けるために使う。 */
  offsetSegments: number
}

/**
 * ベーシックフィールドで使う既定の開口配置。
 *
 * WALL_SEGMENTSが24のとき、45度・135度・225度・315度を中心に
 * 2セグメント（約30度）ぶんの開口を4か所作る。0/90/180/270度（東西南北）は
 * 既存の壁際挙動テストが前提にしているため避けている。
 * 24セグメント中8セグメントを開口にするので、外周の2/3は壁が残る。
 */
export const DEFAULT_WALL_GAPS: KomaWallGapConfig = {
  count: 4,
  widthSegments: 2,
  offsetSegments: 3,
}

const EMPTY_GAP_INDICES: ReadonlySet<number> = new Set()

/**
 * 開口配置から、壁を作らないセグメント番号の集合を求める。
 * `createWallSegments` と `useKomaBattleEngine` の見た目メッシュが同じ集合を読むことで、
 * 物理の開口と見た目の開口が常に一致する。
 */
export function wallGapSegmentIndices(
  gaps: KomaWallGapConfig | null | undefined,
  totalSegments: number = WALL_SEGMENTS,
): ReadonlySet<number> {
  if (
    !gaps ||
    !Number.isFinite(totalSegments) ||
    totalSegments <= 0 ||
    !Number.isFinite(gaps.count) ||
    gaps.count <= 0 ||
    !Number.isFinite(gaps.widthSegments) ||
    gaps.widthSegments <= 0
  ) {
    return EMPTY_GAP_INDICES
  }
  const indices = new Set<number>()
  const spacing = totalSegments / gaps.count
  const offset = Number.isFinite(gaps.offsetSegments) ? gaps.offsetSegments : 0
  for (let gapIndex = 0; gapIndex < gaps.count; gapIndex += 1) {
    const center = offset + gapIndex * spacing
    for (let width = 0; width < gaps.widthSegments; width += 1) {
      const raw = Math.round(center + width)
      const wrapped = ((raw % totalSegments) + totalSegments) % totalSegments
      indices.add(wrapped)
    }
  }
  return indices
}

/** バンパーの共通物理・見た目設定。少数固定配置で扱う。 */
export const BUMPER_RADIUS = 0.22
export const BUMPER_HEIGHT = 0.3
export const BUMPER_FRICTION = 0.18
export const BUMPER_RESTITUTION = 0.28

export type KomaField = {
  id: KomaFieldId
  name: string
  description: string
  icon: string
  shape: 'bowl' | 'bumper' | 'ridge' | 'belt'
  bowlDepth: number
  valleyRadius: number
  ridges: readonly KomaFieldRidge[]
  obstacles: readonly KomaFieldObstacle[]
  belts: readonly KomaFieldBelt[]
  wallHeight: number
  /** 場外判定の共通境界。Phase 4では全フィールドで同じ値を使う。 */
  outRadius: number
  /** 外周壁の開口配置。nullなら全周を壁で囲む（Phase 4以前と同じ）。 */
  wallGaps: KomaWallGapConfig | null
  theme: {
    floor: number
    rim: number
    wall: number
    accent: number
  }
}

const NO_RIDGES: readonly KomaFieldRidge[] = []
const NO_OBSTACLES: readonly KomaFieldObstacle[] = []
const NO_BELTS: readonly KomaFieldBelt[] = []

/** フィールド定義の正本。順番は選択UIの表示順を兼ねる。 */
export const KOMA_FIELD_DEFINITIONS: readonly KomaField[] = [
  {
    id: 'basic',
    name: 'ベーシック',
    description: 'まんなかへ あつまりやすい',
    icon: '⭕',
    shape: 'bowl',
    bowlDepth: BOWL_DEPTH,
    valleyRadius: VALLEY_RADIUS,
    ridges: NO_RIDGES,
    obstacles: NO_OBSTACLES,
    belts: NO_BELTS,
    wallHeight: WALL_HEIGHT,
    outRadius: OUT_RADIUS,
    wallGaps: DEFAULT_WALL_GAPS,
    theme: { floor: 0xf2e4c8, rim: 0x3c5f92, wall: 0x5a7fb5, accent: 0xe0c9a0 },
  },
  {
    id: 'bumper',
    name: 'バンパー',
    description: 'ぶつかって みちが かわる',
    icon: '🔵',
    shape: 'bumper',
    bowlDepth: BOWL_DEPTH,
    valleyRadius: VALLEY_RADIUS,
    ridges: NO_RIDGES,
    obstacles: [
      { type: 'bumper', x: Math.cos(Math.PI / 6) * 0.95, z: Math.sin(Math.PI / 6) * 0.95, radius: BUMPER_RADIUS, height: BUMPER_HEIGHT },
      { type: 'bumper', x: Math.cos((5 * Math.PI) / 6) * 0.95, z: Math.sin((5 * Math.PI) / 6) * 0.95, radius: BUMPER_RADIUS, height: BUMPER_HEIGHT },
      { type: 'bumper', x: Math.cos((3 * Math.PI) / 2) * 0.95, z: Math.sin((3 * Math.PI) / 2) * 0.95, radius: BUMPER_RADIUS, height: BUMPER_HEIGHT },
    ],
    belts: NO_BELTS,
    wallHeight: WALL_HEIGHT,
    outRadius: OUT_RADIUS,
    wallGaps: DEFAULT_WALL_GAPS,
    theme: { floor: 0xf4dfc3, rim: 0x935b84, wall: 0x7e6ab0, accent: 0xff9a76 },
  },
  {
    id: 'ridge',
    name: 'リングの きふく',
    description: 'ゆるい おかで みちが かわる',
    icon: '🟠',
    shape: 'ridge',
    bowlDepth: BOWL_DEPTH,
    valleyRadius: VALLEY_RADIUS,
    // 幅広く低いGaussianの盛り上がり。最大勾配は約0.20で、コマが引っかからない。
    ridges: [{ radius: 1.2, height: 0.075, width: 0.4 }],
    obstacles: NO_OBSTACLES,
    belts: NO_BELTS,
    wallHeight: WALL_HEIGHT,
    outRadius: OUT_RADIUS,
    wallGaps: DEFAULT_WALL_GAPS,
    theme: { floor: 0xe7e7cf, rim: 0x568a82, wall: 0x5f9c91, accent: 0xf1a15b },
  },
  {
    id: 'belt',
    name: 'ながれる ゆか',
    description: 'のると ぐいっと おされる',
    icon: '➡️',
    shape: 'belt',
    bowlDepth: BOWL_DEPTH,
    valleyRadius: VALLEY_RADIUS,
    ridges: NO_RIDGES,
    obstacles: NO_OBSTACLES,
    belts: [
      // 谷(VALLEY_RADIUS)のすぐ外側までを覆う、中央を横切る一本のベルト。
      // 谷に沿って回り続けるだけの軌道を+X方向へ押し出し、反対側から来た
      // もう1個と再接近しやすくする。壁からは十分離れているので、
      // ベルトの力だけで場外へ一直線に押し出されることはない。
      { x: 0, z: 0, angle: 0, halfLength: 0.85, halfWidth: 0.34, strength: 1 },
    ],
    wallHeight: WALL_HEIGHT,
    outRadius: OUT_RADIUS,
    wallGaps: DEFAULT_WALL_GAPS,
    theme: { floor: 0xe3ece8, rim: 0x3c6f78, wall: 0x4f8fa0, accent: 0xffb24e },
  },
]

export const DEFAULT_KOMA_FIELD_ID: KomaFieldId = 'basic'

/** 未知の値は安全にベーシックへ戻す。URLや保存データを直接信用しない。 */
export function getKomaField(field: KomaFieldId | KomaField | string | null | undefined): KomaField {
  if (typeof field === 'object' && field !== null && 'id' in field) return field
  return (
    KOMA_FIELD_DEFINITIONS.find((definition) => definition.id === field) ??
    KOMA_FIELD_DEFINITIONS[0]!
  )
}

/** 別名は外部のテストや将来の選択画面からも使いやすくするために公開する。 */
export const KOMA_FIELDS = KOMA_FIELD_DEFINITIONS
export const KOMA_FIELD_CONFIGS = KOMA_FIELD_DEFINITIONS

function bowlHeightForField(field: KomaField, radius: number): number {
  if (!Number.isFinite(radius)) return 0
  const clamped = Math.min(Math.max(radius, 0), FIELD_RADIUS)
  if (clamped >= BOWL_RADIUS) return 0
  const curvature = field.bowlDepth / ((BOWL_RADIUS - field.valleyRadius) ** 2)
  const offset = clamped - field.valleyRadius
  return curvature * offset * offset - field.bowlDepth
}

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
  return bowlHeightForField(KOMA_FIELD_DEFINITIONS[0]!, radius)
}

/**
 * 選択したフィールドの床の高さ。
 * Ridgeは高さ場へ直接合成するため、物理・見た目・影・開始位置が同じ曲面を読む。
 */
export function fieldHeightAt(
  field: KomaField | KomaFieldId | string | null | undefined,
  radius: number,
): number {
  if (!Number.isFinite(radius)) return 0
  const resolved = getKomaField(field)
  const base = bowlHeightForField(resolved, radius)
  if (resolved.ridges.length === 0 || radius >= BOWL_RADIUS) return base

  return resolved.ridges.reduce((height, ridge) => {
    if (!Number.isFinite(ridge.radius) || !Number.isFinite(ridge.height) || !Number.isFinite(ridge.width) || ridge.width <= 0) {
      return height
    }
    const distance = (radius - ridge.radius) / ridge.width
    return height + ridge.height * Math.exp(-0.5 * distance * distance)
  }, base)
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

/** 地形の傾斜を確認するテストやチューニングで使う。 */
export function fieldSlopeAt(
  field: KomaField | KomaFieldId | string | null | undefined,
  radius: number,
): number {
  if (!Number.isFinite(radius) || radius <= 0 || radius >= BOWL_RADIUS) return 0
  const resolved = getKomaField(field)
  const delta = 0.001
  return (fieldHeightAt(resolved, radius + delta) - fieldHeightAt(resolved, radius - delta)) / (2 * delta)
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
  segmentsOrField: number | KomaField | KomaFieldId = HEIGHTFIELD_SEGMENTS,
  fieldOrSegments: KomaField | KomaFieldId | number = DEFAULT_KOMA_FIELD_ID,
): StadiumHeightfield {
  const segments = typeof segmentsOrField === 'number' ? segmentsOrField :
    typeof fieldOrSegments === 'number' ? fieldOrSegments : HEIGHTFIELD_SEGMENTS
  const fieldInput =
    typeof segmentsOrField === 'number'
      ? typeof fieldOrSegments === 'number'
        ? DEFAULT_KOMA_FIELD_ID
        : fieldOrSegments
      : segmentsOrField
  const field = getKomaField(fieldInput)
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
        radius > FIELD_RADIUS ? -2 : fieldHeightAt(field, radius)
    }
  }
  return { segments, heights, size }
}

export type WallSegment = {
  /** 円周上の通し番号。開口の見た目（縞模様の床マーカーなど）を同じ番号で揃えるために使う。 */
  index: number
  /** 中心の角度[rad]。 */
  angle: number
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
 *
 * `gapSegmentIndices` に含まれる番号は壁を作らず、配列から丸ごと省く。
 * 物理Collider・見た目Meshの両方がこの結果をそのまま読むので、
 * 「見た目は開口しているのに透明な壁が残る」状態にならない。
 */
export function createWallSegments(
  count: number = WALL_SEGMENTS,
  wallHeight: number = WALL_HEIGHT,
  gapSegmentIndices: ReadonlySet<number> = EMPTY_GAP_INDICES,
): WallSegment[] {
  const segments: WallSegment[] = []
  const centerRadius = WALL_INNER_RADIUS + WALL_THICKNESS / 2
  // 隣同士に隙間ができないよう、1枚の幅は弦の長さより少しだけ広く取る。
  const halfWidth = Math.tan(Math.PI / count) * centerRadius + WALL_THICKNESS / 2
  for (let index = 0; index < count; index += 1) {
    if (gapSegmentIndices.has(index)) continue
    const angle = (index / count) * Math.PI * 2
    segments.push({
      index,
      angle,
      center: {
        x: Math.cos(angle) * centerRadius,
        y: wallHeight / 2,
        z: Math.sin(angle) * centerRadius,
      },
      // cuboidのローカルZ(厚み)を半径方向、X(幅)を接線方向へ向けるYaw。
      yaw: Math.PI / 2 - angle,
      halfWidth,
      halfHeight: wallHeight / 2,
      halfDepth: WALL_THICKNESS / 2,
    })
  }
  return segments
}

export type WallGapMarker = {
  /** `createWallSegments` と同じ通し番号。壁が無い箇所。 */
  index: number
  /** 中心の角度[rad]。壁があった場合と同じ計算式で揃えている。 */
  angle: number
}

/**
 * 壁を作らなかったセグメントの角度だけを取り出す。
 * 見た目側が「壁の代わりに床の注意表示を置く」ときの位置合わせに使う。
 */
export function wallGapMarkers(
  gapSegmentIndices: ReadonlySet<number>,
  count: number = WALL_SEGMENTS,
): WallGapMarker[] {
  const markers: WallGapMarker[] = []
  for (let index = 0; index < count; index += 1) {
    if (!gapSegmentIndices.has(index)) continue
    markers.push({ index, angle: (index / count) * Math.PI * 2 })
  }
  return markers
}
