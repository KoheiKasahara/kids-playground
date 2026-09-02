/**
 * カテゴリごとの3Dパーツ生成関数と、その登録表。
 *
 * どの生成関数も、座標は必ず `CarDimensions` / `CarAttachments` から計算する。
 * タイヤ・フロント・屋根・飾り・マークの座標へボディ種別を持ち込まないこと。
 */
import * as THREE from 'three'
import type { BodyType, CarCategoryId, CarConfig, CarOptionIdMap } from './carConfig'
import type { CarAttachment, CarAttachments, CarDimensions } from './carDimensions'

export type CarPartContext = {
  config: CarConfig
  dimensions: CarDimensions
  attachments: CarAttachments
  /** ボディカラー（hex）。カラーカテゴリの選択がここへ流れてくる。 */
  color: string
}

/** パーツを持たない選択（「なし」）では null を返す。 */
export type CarPartBuilder = (context: CarPartContext) => THREE.Object3D | null

/** 3Dの見た目（レイヤー）を持つカテゴリ。 */
export const CAR_PART_CATEGORY_IDS = ['body', 'wheel', 'front', 'roof', 'decoration', 'mark'] as const
export type CarPartCategoryId = (typeof CAR_PART_CATEGORY_IDS)[number]

/**
 * 自前のレイヤーを持たず、他のパーツの入力（色・寸法）として効くカテゴリ。
 * カテゴリを足したときにどちらにも入れ忘れると carParts.test.ts が落ちる。
 */
export const CAR_DERIVED_CATEGORY_IDS = ['color', 'rideHeight'] as const satisfies readonly CarCategoryId[]

const TIRE_COLOR = '#2f3438'
const CHROME_COLOR = '#d5dbe1'
const GLASS_COLOR = '#33506b'
const WHITE_ACCENT = '#f7f9fc'
const POLICE_BLUE = '#2451a6'
const POLICE_RED = '#e64a4a'

function standard(color: string, roughness = 0.45, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function sportsPaint(color: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.24,
    metalness: 0.08,
    clearcoat: 0.52,
    clearcoatRoughness: 0.14,
    side: THREE.DoubleSide,
  })
}

function box(
  size: { x: number; y: number; z: number },
  position: { x: number; y: number; z: number },
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material)
  mesh.position.set(position.x, position.y, position.z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function catmullRom(previous: number, current: number, next: number, afterNext: number, amount: number): number {
  const amountSquared = amount * amount
  const amountCubed = amountSquared * amount
  const value = 0.5 * (
    2 * current
    + (-previous + next) * amount
    + (2 * previous - 5 * current + 4 * next - afterNext) * amountSquared
    + (-previous + 3 * current - 3 * next + afterNext) * amountCubed
  )
  // フェンダーの張り出しなど、意図的に単調な値は補間のオーバーシュートを
  // 許さない。曲率だけを滑らかにし、設計した断面の範囲は保持する。
  return clamp(value, Math.min(current, next), Math.max(current, next))
}

function defaultShoulderY(section: LoftSection): number {
  const height = Math.max(0.04, section.topY - section.bottomY)
  const requested = section.shoulderY ?? lerp(section.bottomY, section.topY, 0.94)
  // 断面の頂点順が逆転すると、ショルダーに折り返し面ができて陰影が割れる。
  // 意図した低い肩は保ちつつ、断面の外周だけは常に単調に上がるようにする。
  return clamp(requested, section.bottomY + height * 0.82, section.topY - height * 0.035)
}

type LoftSection = {
  /** 車体前後方向の中心位置。+Zが前。 */
  z: number
  /** 下側の最大幅。上側はtopWidthへ向かって絞る。 */
  width: number
  /** 天面の幅。未指定なら下側より少し絞る。 */
  topWidth?: number
  bottomY: number
  topY: number
  /** 上半分だけを前後へずらし、フロントガラスやリアガラスを寝かせる。 */
  topZOffset?: number
  /** 天面の左右ショルダーの高さ。中央のクラウンとは別に緩い抑揚を作る。 */
  shoulderY?: number
  /** 中央クラウンだけを前後へ出し、ノーズの先端にわずかな表情をつける。 */
  centerZOffset?: number
  /** 中央の面だけを少し持ち上げ、ボンネットの平板感を抑える。 */
  centerYOffset?: number
}

/**
 * 前後の断面をつないだ低ポリゴンの外殻。
 * 断面の共有頂点をsmooth shadingするため、単純なBoxGeometryの集合よりも
 * 少ないMesh数で面の連続感とフェンダーの張り出しを表現できる。
 */
function loftMesh(
  sections: readonly LoftSection[],
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  // 断面の境目が陰影の筋として見えないよう、設計断面の間を補間してから
  // メッシュ化する。寸法や外形は変えず、面のつながりだけを滑らかにする。
  const denseSections: LoftSection[] = []
  for (let index = 0; index < sections.length - 1; index += 1) {
    const current = sections[index]
    const next = sections[index + 1]
    if (current === undefined || next === undefined) continue
    denseSections.push(current)
    const previous = sections[index - 1] ?? current
    const afterNext = sections[index + 2] ?? next
    const topWidthOf = (section: LoftSection) => section.topWidth ?? section.width * 0.84
    const interpolate = (get: (section: LoftSection) => number, amount: number) => catmullRom(
      get(previous),
      get(current),
      get(next),
      get(afterNext),
      amount,
    )
    for (const amount of [0.16, 0.32, 0.48, 0.64, 0.8]) {
      denseSections.push({
        z: lerp(current.z, next.z, amount),
        width: interpolate((section) => section.width, amount),
        topWidth: interpolate(topWidthOf, amount),
        bottomY: interpolate((section) => section.bottomY, amount),
        topY: interpolate((section) => section.topY, amount),
        topZOffset: interpolate((section) => section.topZOffset ?? 0, amount),
        shoulderY: interpolate(defaultShoulderY, amount),
        centerZOffset: interpolate((section) => section.centerZOffset ?? 0, amount),
        centerYOffset: interpolate((section) => section.centerYOffset ?? 0, amount),
      })
    }
  }
  const lastSection = sections[sections.length - 1]
  if (lastSection !== undefined) denseSections.push(lastSection)

  const ringVertices = denseSections.map((section) => {
    const halfWidth = section.width / 2
    const topHalfWidth = (section.topWidth ?? section.width * 0.84) / 2
    const height = Math.max(0.04, section.topY - section.bottomY)
    const topZOffset = section.topZOffset ?? 0
    const shoulderY = defaultShoulderY(section)
    const centerZOffset = section.centerZOffset ?? 0
    const centerYOffset = section.centerYOffset ?? 0
    const zAt = (weight: number) => section.z + topZOffset * weight

    return [
      [-halfWidth * 0.72, section.bottomY, section.z],
      [-halfWidth * 0.9, section.bottomY + height * 0.04, section.z],
      [-halfWidth * 0.98, section.bottomY + height * 0.1, section.z],
      [-halfWidth, section.bottomY + height * 0.22, zAt(0.02)],
      [-halfWidth, section.bottomY + height * 0.36, zAt(0.04)],
      [-halfWidth, section.bottomY + height * 0.5, zAt(0.06)],
      [-halfWidth * 0.995, section.bottomY + height * 0.64, zAt(0.24)],
      [-halfWidth * 0.97, section.bottomY + height * 0.75, zAt(0.42)],
      [-topHalfWidth * 0.99, section.bottomY + height * 0.83, zAt(0.62)],
      [-topHalfWidth * 0.98, shoulderY, zAt(0.8)],
      [-topHalfWidth * 0.95, section.bottomY + height * 0.91, zAt(0.92)],
      [-topHalfWidth * 0.84, section.topY - height * 0.045, zAt(0.97)],
      [-topHalfWidth * 0.6, section.topY - height * 0.018, zAt(0.99)],
      [0, section.topY + centerYOffset, zAt(1) + centerZOffset],
      [topHalfWidth * 0.6, section.topY - height * 0.018, zAt(0.99)],
      [topHalfWidth * 0.84, section.topY - height * 0.045, zAt(0.97)],
      [topHalfWidth * 0.95, section.bottomY + height * 0.91, zAt(0.92)],
      [topHalfWidth * 0.98, shoulderY, zAt(0.8)],
      [topHalfWidth * 0.99, section.bottomY + height * 0.83, zAt(0.62)],
      [halfWidth * 0.97, section.bottomY + height * 0.75, zAt(0.42)],
      [halfWidth * 0.995, section.bottomY + height * 0.64, zAt(0.24)],
      [halfWidth, section.bottomY + height * 0.5, zAt(0.06)],
      [halfWidth, section.bottomY + height * 0.36, zAt(0.04)],
      [halfWidth, section.bottomY + height * 0.22, zAt(0.02)],
      [halfWidth * 0.98, section.bottomY + height * 0.1, section.z],
      [halfWidth * 0.9, section.bottomY + height * 0.04, section.z],
      [halfWidth * 0.72, section.bottomY, section.z],
    ] as const
  })

  const positions: number[] = []
  for (const ring of ringVertices) {
    for (const vertex of ring) positions.push(vertex[0], vertex[1], vertex[2])
  }

  const ringSize = ringVertices[0]?.length ?? 0
  const indices: number[] = []
  for (let sectionIndex = 0; sectionIndex < denseSections.length - 1; sectionIndex += 1) {
    const currentOffset = sectionIndex * ringSize
    const nextOffset = (sectionIndex + 1) * ringSize
    for (let vertexIndex = 0; vertexIndex < ringSize; vertexIndex += 1) {
      const nextVertexIndex = (vertexIndex + 1) % ringSize
      const current = currentOffset + vertexIndex
      const currentNext = currentOffset + nextVertexIndex
      const next = nextOffset + vertexIndex
      const nextNext = nextOffset + nextVertexIndex
      indices.push(current, next, currentNext, currentNext, next, nextNext)
    }
  }

  // 前後の端面も閉じ、内側から見たときに穴が見えないようにする。
  const rearCenterIndex = positions.length / 3
  const rear = denseSections[0]
  if (rear !== undefined) positions.push(0, (rear.bottomY + rear.topY) / 2, rear.z)
  const frontCenterIndex = positions.length / 3
  const front = denseSections[denseSections.length - 1]
  if (front !== undefined) positions.push(0, (front.bottomY + front.topY) / 2, front.z)

  if (ringSize > 0) {
    for (let vertexIndex = 0; vertexIndex < ringSize; vertexIndex += 1) {
      const nextVertexIndex = (vertexIndex + 1) % ringSize
      indices.push(rearCenterIndex, vertexIndex, nextVertexIndex)
      const frontOffset = (denseSections.length - 1) * ringSize
      indices.push(frontCenterIndex, frontOffset + nextVertexIndex, frontOffset + vertexIndex)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  // 外殻自身の細い断面面をシャドウマップへ戻すと、ボンネットに自己影の筋が
  // 出やすい。地面へは影を落としつつ、塗装面は直接光の滑らかさを優先する。
  mesh.receiveShadow = false
  return mesh
}

function surfacePolygonMesh(
  points: readonly ProfilePoint[],
  xForPoint: (point: ProfilePoint) => number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const positions: number[] = []
  for (const [z, y] of points) positions.push(xForPoint([z, y]), y, z)

  const indices: number[] = []
  for (let index = 1; index < points.length - 1; index += 1) {
    indices.push(0, index, index + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function sportsWindshieldMesh(
  dimensions: CarDimensions,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  // フロントガラスを一枚の板ではなく、上下3列×左右3列の浅い曲面にする。
  // 中央だけをわずかに前へ出し、左右対称のまま光が面に沿って流れるようにする。
  const bottomY = dimensions.hullTopY + dimensions.cabinHeight * 0.38
  const topY = dimensions.roofTopY - 0.02
  const bottomZ = dimensions.cabinCenterZ + dimensions.cabinLength * 0.5 + 0.06
  const topZ = dimensions.cabinCenterZ + dimensions.cabinLength * 0.5 - dimensions.cabinLength * 0.31 + 0.02
  const rows = [
    { amount: 0, y: bottomY, z: bottomZ, halfWidth: dimensions.cabinWidth * 0.46 },
    { amount: 0.5, y: lerp(bottomY, topY, 0.5) + 0.018, z: lerp(bottomZ, topZ, 0.5) + 0.028, halfWidth: dimensions.cabinWidth * 0.42 },
    { amount: 1, y: topY, z: topZ, halfWidth: dimensions.cabinWidth * 0.35 },
  ]
  const positions: number[] = []
  for (const row of rows) {
    positions.push(
      -row.halfWidth, row.y, row.z,
      0, row.y + 0.008, row.z + 0.006,
      row.halfWidth, row.y, row.z,
    )
  }
  const indices: number[] = []
  for (let row = 0; row < rows.length - 1; row += 1) {
    const current = row * 3
    const next = (row + 1) * 3
    for (let column = 0; column < 2; column += 1) {
      indices.push(current + column, next + column, current + column + 1)
      indices.push(current + column + 1, next + column, next + column + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function sportsWindowX(dimensions: CarDimensions, side: 1 | -1, z: number, y: number): number {
  const verticalProgress = Math.min(
    1,
    Math.max(0, (y - dimensions.hullTopY) / Math.max(0.01, dimensions.cabinHeight)),
  )
  const smoothProgress = verticalProgress * verticalProgress * (3 - verticalProgress * 2)
  // 窓の下端はボディの肩、上端はルーフの外周に乗せる。キャビン幅だけを
  // 基準にすると下端が車体へ埋まり、上端が外へ浮くため、外殻の断面に追従させる。
  const hullHalfWidth = (dimensions.width / 2) * 0.985
  const roofHalfWidth = (dimensions.cabinWidth / 2) * 0.9
  const halfWidth = lerp(hullHalfWidth, roofHalfWidth, smoothProgress)
  const longitudinalProgress = Math.min(
    1,
    Math.max(-1, (z - dimensions.cabinCenterZ) / (dimensions.cabinLength / 2)),
  )
  // 窓の中央だけをほんの少し外へ膨らませ、側面の平板感を抑える。
  const sideCurve = 0.018 * (1 - longitudinalProgress * longitudinalProgress)
  return side * (halfWidth + sideCurve + 0.018)
}

function curveTube(
  points: readonly THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([...points])
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 6, false), material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * タイヤの上半分にボディ色の立体的なアーチ面をかぶせる。
 * 細いTorusだけではタイヤが外付けに見えるため、車体側からタイヤ外側へ
 * 面の厚みを持たせ、フェンダーがボディから張り出しているように見せる。
 */
function sportsFenderMesh(
  wheel: CarAttachments['wheels'][number],
  dimensions: CarDimensions,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const segments = 18
  const outerRadius = wheel.radius * 1.025
  const innerRadius = wheel.radius * 0.985
  const bodySide = dimensions.width / 2 - 0.02
  const wheelSide = Math.abs(wheel.position.x)
  // タイヤ外側までフェンダーを引き出すと赤い輪が貼り付いて見えるため、
  // ボディの膨らみの内側へ戻し、タイヤがその上から見える重なりにする。
  const outerSide = wheelSide + wheel.width * 0.3
  const innerX = wheel.side * bodySide
  const outerX = wheel.side * Math.max(bodySide + 0.12, outerSide)
  const positions: number[] = []

  for (let index = 0; index <= segments; index += 1) {
    const angle = (Math.PI * index) / segments
    const outerZ = wheel.position.z + Math.cos(angle) * outerRadius
    const outerY = wheel.position.y + Math.sin(angle) * outerRadius
    const innerZ = wheel.position.z + Math.cos(angle) * innerRadius
    const innerY = wheel.position.y + Math.sin(angle) * innerRadius
    positions.push(
      innerX, outerY, outerZ,
      outerX, outerY, outerZ,
      innerX, innerY, innerZ,
      outerX, innerY, innerZ,
    )
  }

  const indices: number[] = []
  for (let index = 0; index < segments; index += 1) {
    const current = index * 4
    const next = (index + 1) * 4
    // アーチの上面、内側面、車体側面、外側の見える面。
    indices.push(
      current, next, current + 1,
      current + 1, next, next + 1,
      current + 2, current + 3, next + 2,
      current + 3, next + 3, next + 2,
      current, current + 2, next,
      current + 2, next + 2, next,
      current + 1, next + 1, current + 3,
      current + 3, next + 1, next + 3,
    )
  }

  // 前後の端面を閉じ、フェンダーの厚みを横からも読めるようにする。
  indices.push(0, 1, 3, 0, 3, 2)
  const last = segments * 4
  indices.push(last, last + 2, last + 3, last, last + 3, last + 1)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * 車体側面の輪郭を押し出したMesh。
 * x方向へ押し出してからY軸回転することで、点列の横軸を車のZ方向として扱う。
 * 箱だけを積むよりも、スポーツカーの低い鼻先やバスの直立した輪郭を自然に出せる。
 */
type ProfilePoint = readonly [z: number, y: number]

function profileMesh(
  points: readonly ProfilePoint[],
  width: number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const shape = new THREE.Shape()
  const first = points[0]
  if (first === undefined) throw new Error('車体プロファイルが空です')
  shape.moveTo(first[0], first[1])
  for (const point of points.slice(1)) shape.lineTo(point[0], point[1])
  shape.closePath()

  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }),
    material,
  )
  mesh.name = name
  mesh.rotation.y = -Math.PI / 2
  mesh.position.x = width / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** 取り付け面から法線方向へ `distance` だけ離した位置を返す。 */
function offsetFrom(attachment: CarAttachment, distance: number): THREE.Vector3 {
  return new THREE.Vector3(
    attachment.position.x + attachment.normal.x * distance,
    attachment.position.y + attachment.normal.y * distance,
    attachment.position.z + attachment.normal.z * distance,
  )
}

function createBodyGroup(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'car-body'
  return group
}

function cabinProfile(
  dimensions: CarDimensions,
  frontRoofRatio: number,
  rearRoofRatio: number,
): readonly ProfilePoint[] {
  const halfCabin = dimensions.cabinLength / 2
  const center = dimensions.cabinCenterZ
  return [
    [center - halfCabin, dimensions.hullTopY],
    [center + halfCabin, dimensions.hullTopY],
    [center + halfCabin * frontRoofRatio, dimensions.roofTopY],
    [center - halfCabin * rearRoofRatio, dimensions.roofTopY],
  ]
}

function addCabin(
  group: THREE.Group,
  dimensions: CarDimensions,
  bodyMaterial: THREE.Material,
  glassMaterial: THREE.Material,
  frontRoofRatio: number,
  rearRoofRatio: number,
): void {
  group.add(profileMesh(cabinProfile(dimensions, frontRoofRatio, rearRoofRatio), dimensions.cabinWidth, bodyMaterial, 'car-body-cabin'))
  group.add(
    box(
      {
        x: dimensions.cabinWidth * 1.01,
        y: dimensions.cabinHeight * 0.42,
        z: dimensions.cabinLength * 0.86,
      },
      {
        x: 0,
        y: dimensions.hullTopY + dimensions.cabinHeight * 0.58,
        z: dimensions.cabinCenterZ,
      },
      glassMaterial,
    ),
  )
}

function addBumpers(group: THREE.Group, dimensions: CarDimensions, material: THREE.Material): void {
  const front = dimensions.length / 2
  const bumperY = dimensions.bodyFloorY + dimensions.hullHeight * 0.18
  group.add(
    box(
      { x: dimensions.width * 0.9, y: dimensions.hullHeight * 0.14, z: 0.12 },
      { x: 0, y: bumperY, z: front + 0.035 },
      material,
    ),
    box(
      { x: dimensions.width * 0.9, y: dimensions.hullHeight * 0.14, z: 0.12 },
      { x: 0, y: bumperY, z: -front - 0.035 },
      material,
    ),
  )
}

function buildSportsBody({ dimensions, attachments, color }: CarPartContext): THREE.Object3D {
  const group = createBodyGroup()
  const bodyMaterial = sportsPaint(color)
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#223d51',
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.48,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  })
  const trimMaterial = standard(CHROME_COLOR, 0.28, 0.42)
  const grilleMaterial = standard('#202b36', 0.3, 0.18)
  // フェンダーの境界を黒い別部品にせず、塗装面の反射差だけで読む。
  // これによりタイヤ周りに赤い輪を貼った印象を抑え、外殻の続きとして見せる。
  const archMaterial = sportsPaint(color)
  const half = dimensions.length / 2
  const floor = dimensions.bodyFloorY
  const cabinHalf = dimensions.cabinLength / 2
  const cabinRear = dimensions.cabinCenterZ - cabinHalf
  const cabinFront = dimensions.cabinCenterZ + cabinHalf
  const roofRear = cabinRear + dimensions.cabinLength * 0.19
  const roofFront = cabinFront - dimensions.cabinLength * 0.31
  const hoodStart = half - dimensions.hoodLength
  const hullTop = dimensions.hullTopY
  const roofTop = dimensions.roofTopY
  const frontWheelZ = dimensions.wheelbase / 2
  const rearWheelZ = -frontWheelZ

  // 下段とキャビンを別々に積まず、リアデッキからノーズまでの高さを一つの
  // 連続した側面シルエットとして定義する。ルーフ断面も広く残すことで、
  // ボンネット→フロントガラス→ルーフ→リアを一つの外皮として読ませる。
  group.add(
    loftMesh(
      [
        { z: -half, width: dimensions.width * 0.72, topWidth: dimensions.width * 0.58, bottomY: floor, topY: floor + dimensions.hullHeight * 0.28 },
        { z: -half + 0.2, width: dimensions.width * 0.88, topWidth: dimensions.width * 0.74, bottomY: floor, topY: floor + dimensions.hullHeight * 0.48 },
        { z: rearWheelZ - 0.36, width: dimensions.width * 1.02, topWidth: dimensions.width * 0.86, bottomY: floor, topY: floor + dimensions.hullHeight * 0.7 },
        { z: rearWheelZ - 0.16, width: dimensions.width * 1.08, topWidth: dimensions.width * 0.92, bottomY: floor, topY: floor + dimensions.hullHeight * 0.86 },
        { z: rearWheelZ + 0.08, width: dimensions.width * 1.1, topWidth: dimensions.width * 0.96, bottomY: floor, topY: hullTop + 0.015 },
        { z: cabinRear - 0.08, width: dimensions.width * 1.08, topWidth: dimensions.width * 0.94, bottomY: floor, topY: hullTop + 0.02, shoulderY: hullTop - 0.02 },
        { z: cabinRear + 0.12, width: dimensions.width * 1.04, topWidth: dimensions.cabinWidth * 0.94, bottomY: floor, topY: hullTop + dimensions.cabinHeight * 0.35, topZOffset: 0.06 },
        { z: roofRear - 0.14, width: dimensions.width * 1.0, topWidth: dimensions.cabinWidth * 0.9, bottomY: floor, topY: roofTop - dimensions.cabinHeight * 0.12, topZOffset: 0.08 },
        { z: roofRear, width: dimensions.width * 0.98, topWidth: dimensions.cabinWidth * 0.88, bottomY: floor, topY: roofTop - dimensions.cabinHeight * 0.025, topZOffset: 0.08 },
        { z: dimensions.cabinCenterZ - dimensions.cabinLength * 0.18, width: dimensions.width * 0.96, topWidth: dimensions.cabinWidth * 0.86, bottomY: floor, topY: roofTop, topZOffset: 0.05 },
        { z: dimensions.cabinCenterZ + dimensions.cabinLength * 0.14, width: dimensions.width * 0.95, topWidth: dimensions.cabinWidth * 0.85, bottomY: floor, topY: roofTop, topZOffset: 0 },
        { z: roofFront, width: dimensions.width * 0.96, topWidth: dimensions.cabinWidth * 0.82, bottomY: floor, topY: roofTop - dimensions.cabinHeight * 0.025, topZOffset: -0.08 },
        { z: cabinFront + 0.12, width: dimensions.width * 1.02, topWidth: dimensions.width * 0.9, bottomY: floor, topY: hullTop + dimensions.cabinHeight * 0.32, topZOffset: -0.04 },
        { z: hoodStart, width: dimensions.width * 1.04, topWidth: dimensions.width * 0.92, bottomY: floor, topY: hullTop + 0.075, shoulderY: hullTop + 0.055, centerYOffset: 0.008 },
        { z: frontWheelZ - 0.36, width: dimensions.width * 1.06, topWidth: dimensions.width * 0.95, bottomY: floor, topY: hullTop + 0.065, shoulderY: hullTop + 0.055, centerYOffset: 0.012 },
        { z: frontWheelZ - 0.16, width: dimensions.width * 1.1, topWidth: dimensions.width * 0.98, bottomY: floor, topY: hullTop + 0.08, shoulderY: hullTop + 0.065, centerYOffset: 0.014 },
        { z: frontWheelZ + 0.04, width: dimensions.width * 1.08, topWidth: dimensions.width * 0.94, bottomY: floor, topY: hullTop + 0.055, shoulderY: hullTop + 0.045, centerYOffset: 0.008 },
        { z: half - 0.34, width: dimensions.width * 0.96, topWidth: dimensions.width * 0.78, bottomY: floor, topY: floor + dimensions.hullHeight * 0.56, centerZOffset: 0.018, centerYOffset: 0.014 },
        { z: half - 0.12, width: dimensions.width * 0.82, topWidth: dimensions.width * 0.66, bottomY: floor, topY: floor + dimensions.hullHeight * 0.34, centerZOffset: 0.04, centerYOffset: 0.01 },
        { z: half, width: dimensions.width * 0.64, topWidth: dimensions.width * 0.5, bottomY: floor, topY: floor + dimensions.hullHeight * 0.18, centerZOffset: 0.065, centerYOffset: 0.006 },
      ],
      bodyMaterial,
      'car-body-hull',
    ),
  )

  const sideBottomY = dimensions.hullTopY + dimensions.cabinHeight * 0.12
  const sideTopY = dimensions.roofTopY - dimensions.cabinHeight * 0.1
  const pillarZ = dimensions.cabinCenterZ - cabinHalf * 0.06
  const rearWindowBottomRearZ = cabinRear + 0.16
  const rearWindowBottomFrontZ = pillarZ - 0.05
  const rearWindowTopFrontZ = pillarZ - 0.18
  const rearWindowTopRearZ = roofRear + 0.1
  const frontWindowBottomRearZ = pillarZ + 0.05
  const frontWindowBottomFrontZ = cabinFront - 0.02
  const frontWindowTopFrontZ = roofFront + 0.02
  const frontWindowTopRearZ = pillarZ + 0.18
  for (const side of [1, -1] as const) {
    const sideName = side === 1 ? 'left' : 'right'
    const xForPoint = ([z, y]: ProfilePoint) => sportsWindowX(dimensions, side, z, y)
    group.add(
      surfacePolygonMesh(
        [
          [rearWindowBottomRearZ, sideBottomY],
          [lerp(rearWindowBottomRearZ, rearWindowBottomFrontZ, 0.52), sideBottomY + 0.012],
          [rearWindowBottomFrontZ, sideBottomY],
          [rearWindowTopFrontZ, sideTopY],
          [lerp(rearWindowTopFrontZ, rearWindowTopRearZ, 0.52), sideTopY + 0.018],
          [rearWindowTopRearZ, sideTopY - 0.018],
        ],
        xForPoint,
        glassMaterial,
        `car-sports-side-window-rear-${sideName}`,
      ),
      surfacePolygonMesh(
        [
          [frontWindowBottomRearZ, sideBottomY],
          [lerp(frontWindowBottomRearZ, frontWindowBottomFrontZ, 0.52), sideBottomY + 0.012],
          [frontWindowBottomFrontZ, sideBottomY],
          [frontWindowTopFrontZ, sideTopY + 0.008],
          [lerp(frontWindowTopFrontZ, frontWindowTopRearZ, 0.52), sideTopY + 0.02],
          [frontWindowTopRearZ, sideTopY],
        ],
        xForPoint,
        glassMaterial,
        `car-sports-side-window-front-${sideName}`,
      ),
    )

    const frameX = (z: number, y: number) => sportsWindowX(dimensions, side, z, y) + side * 0.022
    const frameRadius = 0.025
    group.add(
      curveTube(
        [
          new THREE.Vector3(frameX(frontWindowBottomFrontZ, sideBottomY), sideBottomY, frontWindowBottomFrontZ),
          new THREE.Vector3(frameX(frontWindowTopFrontZ, sideTopY + 0.008), sideTopY + 0.008, frontWindowTopFrontZ),
        ],
        frameRadius * 1.05,
        bodyMaterial,
        `car-sports-a-pillar-${sideName}`,
      ),
      curveTube(
        [
          new THREE.Vector3(frameX(frontWindowBottomRearZ, sideBottomY), sideBottomY, frontWindowBottomRearZ),
          new THREE.Vector3(frameX(frontWindowTopRearZ, sideTopY), sideTopY, frontWindowTopRearZ),
        ],
        frameRadius * 0.86,
        bodyMaterial,
        `car-sports-b-pillar-${sideName}`,
      ),
      curveTube(
        [
          new THREE.Vector3(frameX(rearWindowBottomRearZ, sideBottomY), sideBottomY, rearWindowBottomRearZ),
          new THREE.Vector3(frameX(rearWindowTopRearZ, sideTopY - 0.018), sideTopY - 0.018, rearWindowTopRearZ),
        ],
        frameRadius,
        bodyMaterial,
        `car-sports-c-pillar-${sideName}`,
      ),
    )
  }

  group.add(
    sportsWindshieldMesh(dimensions, glassMaterial, 'car-sports-windshield'),
  )

  // フロントガラスの左右に細いAピラーを置き、ガラスが黒い板として
  // キャビンの外へ浮いて見えるのを防ぐ。ルーフ側も一本の曲線でつなぐ。
  const windshieldBottomY = dimensions.hullTopY + dimensions.cabinHeight * 0.38
  const windshieldTopY = dimensions.roofTopY - 0.02
  const windshieldBottomZ = cabinFront + 0.06
  const windshieldTopZ = roofFront + 0.02
  const windshieldBottomHalfWidth = dimensions.cabinWidth * 0.46
  const windshieldTopHalfWidth = dimensions.cabinWidth * 0.35
  for (const side of [-1, 1] as const) {
    group.add(
      curveTube(
        [
          new THREE.Vector3(side * (windshieldBottomHalfWidth + 0.022), windshieldBottomY, windshieldBottomZ),
          new THREE.Vector3(side * (windshieldTopHalfWidth + 0.022), windshieldTopY, windshieldTopZ),
        ],
        0.023,
        bodyMaterial,
        `car-sports-windshield-pillar-${side === 1 ? 'left' : 'right'}`,
      ),
    )
  }
  group.add(
    curveTube(
      [
        new THREE.Vector3(-windshieldTopHalfWidth, windshieldTopY + 0.005, windshieldTopZ),
        new THREE.Vector3(0, windshieldTopY + 0.014, windshieldTopZ + 0.012),
        new THREE.Vector3(windshieldTopHalfWidth, windshieldTopY + 0.005, windshieldTopZ),
      ],
      0.021,
      bodyMaterial,
      'car-sports-roof-front-frame',
    ),
  )

  // フェンダー上部だけを細い同色アーチで縁取り、タイヤとボディの境界を読み取りやすくする。
  for (const wheel of attachments.wheels) {
    group.add(sportsFenderMesh(wheel, dimensions, bodyMaterial, `car-sports-fender-${wheel.id}`))
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(wheel.radius * 1.035, 0.012, 8, 28, Math.PI),
      archMaterial,
    )
    arch.name = `car-sports-wheel-arch-${wheel.id}`
    arch.rotation.y = Math.PI / 2
    arch.position.set(
      wheel.position.x + wheel.side * wheel.width * 0.4,
      wheel.position.y,
      wheel.position.z,
    )
    arch.castShadow = true
    arch.receiveShadow = true
    group.add(arch)
  }

  const grilleY = floor + dimensions.hullHeight * 0.33
  const grille = box(
    { x: dimensions.width * 0.52, y: dimensions.hullHeight * 0.16, z: 0.07 },
    { x: 0, y: grilleY, z: half + 0.045 },
    grilleMaterial,
  )
  grille.name = 'car-sports-front-grille'
  group.add(grille)

  const grilleSlatY = dimensions.hullHeight * 0.065
  for (const offset of [-1, 0, 1]) {
    group.add(
      box(
        { x: dimensions.width * 0.36, y: 0.014, z: 0.074 },
        { x: 0, y: grilleY + offset * grilleSlatY, z: half + 0.085 },
        grilleMaterial,
      ),
    )
  }

  const splitter = box(
    { x: dimensions.width * 0.68, y: 0.035, z: 0.07 },
    { x: 0, y: floor + dimensions.hullHeight * 0.1, z: half + 0.055 },
    bodyMaterial,
  )
  splitter.name = 'car-sports-front-splitter'
  group.add(splitter)

  // 小物は主外殻の補助に限定し、面構成で出した輪郭を邪魔しない薄さにする。
  group.add(
    box(
      { x: 0.035, y: 0.018, z: dimensions.hoodLength * 0.68 },
      { x: 0, y: dimensions.hullTopY + 0.02, z: half - dimensions.hoodLength * 0.42 },
      trimMaterial,
    ),
  )
  const rearDeck = box(
    { x: dimensions.width * 0.48, y: 0.026, z: 0.14 },
    { x: 0, y: dimensions.hullTopY - 0.018, z: -half * 0.68 },
    trimMaterial,
  )
  rearDeck.name = 'car-sports-rear-deck'
  group.add(rearDeck)

  return group
}

function buildSuvBody({ dimensions, color }: CarPartContext): THREE.Object3D {
  const group = createBodyGroup()
  const bodyMaterial = standard(color, 0.44)
  const glassMaterial = standard(GLASS_COLOR, 0.18, 0.1)
  const trimMaterial = standard('#687585', 0.5, 0.18)
  const half = dimensions.length / 2
  const floor = dimensions.bodyFloorY
  const hoodEnd = half - dimensions.hoodLength

  // スポーツカーより背が高く、厚い下段と大きなキャビンを持つ。
  group.add(
    profileMesh(
      [
        [-half, floor],
        [half, floor],
        [half, floor + dimensions.hullHeight * 0.76],
        [hoodEnd, floor + dimensions.hullHeight],
        [-half * 0.86, floor + dimensions.hullHeight],
        [-half, floor + dimensions.hullHeight * 0.7],
      ],
      dimensions.width,
      bodyMaterial,
      'car-body-hull',
    ),
  )
  addCabin(group, dimensions, bodyMaterial, glassMaterial, 0.86, 0.9)
  group.add(
    box(
      { x: dimensions.width * 0.88, y: 0.11, z: dimensions.hoodLength * 0.78 },
      { x: 0, y: dimensions.hullTopY + 0.04, z: half - dimensions.hoodLength * 0.45 },
      trimMaterial,
    ),
    box(
      { x: dimensions.width * 1.04, y: 0.14, z: dimensions.length * 0.78 },
      { x: 0, y: floor + 0.15, z: 0 },
      trimMaterial,
    ),
  )
  addBumpers(group, dimensions, trimMaterial)
  return group
}

function buildBusBody({ dimensions, color }: CarPartContext): THREE.Object3D {
  const group = createBodyGroup()
  const bodyMaterial = standard(color, 0.48)
  const glassMaterial = standard('#2f6582', 0.13, 0.1)
  const trimMaterial = standard('#e7edf2', 0.36, 0.2)
  const half = dimensions.length / 2
  const floor = dimensions.bodyFloorY

  // 長く高い箱形客室。横一列の窓と柱を加えて、乗用車との違いを明確にする。
  group.add(
    profileMesh(
      [
        [-half, floor],
        [half, floor],
        [half, floor + dimensions.hullHeight * 0.92],
        [half * 0.96, floor + dimensions.hullHeight],
        [-half * 0.96, floor + dimensions.hullHeight],
        [-half, floor + dimensions.hullHeight * 0.92],
      ],
      dimensions.width,
      bodyMaterial,
      'car-body-hull',
    ),
  )
  addCabin(group, dimensions, bodyMaterial, glassMaterial, 0.97, 0.97)

  const windowY = dimensions.hullTopY + dimensions.cabinHeight * 0.58
  const pillarMaterial = standard(color, 0.38)
  const halfCabin = dimensions.cabinLength / 2
  for (let index = 1; index < 7; index += 1) {
    const z = dimensions.cabinCenterZ - halfCabin + (dimensions.cabinLength * index) / 7
    for (const side of [-1, 1] as const) {
      group.add(
        box(
          { x: 0.055, y: dimensions.cabinHeight * 0.48, z: 0.075 },
          { x: side * (dimensions.cabinWidth / 2 + 0.012), y: windowY, z },
          pillarMaterial,
        ),
      )
    }
  }
  group.add(
    box(
      { x: dimensions.width * 0.72, y: dimensions.cabinHeight * 0.22, z: 0.08 },
      { x: 0, y: dimensions.roofTopY - dimensions.cabinHeight * 0.1, z: half - 0.08 },
      trimMaterial,
    ),
  )
  addBumpers(group, dimensions, trimMaterial)
  return group
}

function buildTruckBody({ dimensions, color }: CarPartContext): THREE.Object3D {
  const group = createBodyGroup()
  const bodyMaterial = standard(color, 0.5)
  const glassMaterial = standard(GLASS_COLOR, 0.16, 0.1)
  const trimMaterial = standard('#66717c', 0.5, 0.2)
  const cargoMaterial = standard('#d99a4a', 0.52)
  const half = dimensions.length / 2
  const floor = dimensions.bodyFloorY
  const cargoLength = Math.max(0.7, dimensions.length - dimensions.cabinLength - 0.18)
  const cargoCenterZ = -half + cargoLength / 2 + 0.08

  // 低い車台に、前方キャビンと後方荷台を別体で載せる。
  group.add(
    profileMesh(
      [
        [-half, floor],
        [half, floor],
        [half, floor + dimensions.hullHeight * 0.76],
        [-half, floor + dimensions.hullHeight * 0.76],
      ],
      dimensions.width,
      bodyMaterial,
      'car-body-hull',
    ),
  )
  addCabin(group, dimensions, bodyMaterial, glassMaterial, 0.76, 0.82)

  const cargoHeight = dimensions.cabinHeight * 0.66
  group.add(
    box(
      { x: dimensions.width * 0.91, y: cargoHeight, z: cargoLength },
      { x: 0, y: dimensions.hullTopY - 0.02 + cargoHeight / 2, z: cargoCenterZ },
      cargoMaterial,
    ),
    box(
      { x: dimensions.width * 0.96, y: 0.11, z: cargoLength + 0.08 },
      { x: 0, y: dimensions.hullTopY + cargoHeight - 0.015, z: cargoCenterZ },
      trimMaterial,
    ),
    box(
      { x: dimensions.width * 0.94, y: 0.1, z: dimensions.cabinLength * 0.75 },
      { x: 0, y: dimensions.hullTopY + 0.04, z: dimensions.cabinCenterZ + dimensions.cabinLength * 0.08 },
      trimMaterial,
    ),
  )
  addBumpers(group, dimensions, trimMaterial)
  return group
}

function buildPoliceBody({ dimensions, color }: CarPartContext): THREE.Object3D {
  const group = createBodyGroup()
  const bodyMaterial = standard(color, 0.4)
  const glassMaterial = standard('#253d60', 0.14, 0.14)
  const whiteMaterial = standard(WHITE_ACCENT, 0.3)
  const blueMaterial = standard(POLICE_BLUE, 0.3, 0.12)
  const redMaterial = standard(POLICE_RED, 0.3, 0.08)
  const half = dimensions.length / 2
  const floor = dimensions.bodyFloorY
  const hoodEnd = half - dimensions.hoodLength

  // 乗用車の形に、白い側面帯と前方の青赤アクセントを加える。
  group.add(
    profileMesh(
      [
        [-half, floor],
        [half, floor],
        [half, floor + dimensions.hullHeight * 0.62],
        [hoodEnd, floor + dimensions.hullHeight],
        [-half * 0.78, floor + dimensions.hullHeight * 0.95],
        [-half, floor + dimensions.hullHeight * 0.58],
      ],
      dimensions.width,
      bodyMaterial,
      'car-body-hull',
    ),
  )
  addCabin(group, dimensions, bodyMaterial, glassMaterial, 0.78, 0.84)
  group.add(
    box(
      { x: dimensions.width * 1.02, y: 0.13, z: dimensions.length * 0.72 },
      { x: 0, y: floor + dimensions.hullHeight * 0.58, z: -dimensions.length * 0.01 },
      whiteMaterial,
    ),
    box(
      { x: dimensions.width * 0.86, y: 0.1, z: dimensions.hoodLength * 0.72 },
      { x: 0, y: dimensions.hullTopY + 0.03, z: half - dimensions.hoodLength * 0.45 },
      blueMaterial,
    ),
    box(
      { x: dimensions.width * 0.28, y: 0.09, z: 0.08 },
      { x: -dimensions.width * 0.28, y: dimensions.hullTopY + 0.11, z: half + 0.04 },
      blueMaterial,
    ),
    box(
      { x: dimensions.width * 0.28, y: 0.09, z: 0.08 },
      { x: dimensions.width * 0.28, y: dimensions.hullTopY + 0.11, z: half + 0.04 },
      redMaterial,
    ),
  )
  addBumpers(group, dimensions, blueMaterial)
  return group
}

const BODY_BUILDERS: Record<BodyType, CarPartBuilder> = {
  sports: buildSportsBody,
  suv: buildSuvBody,
  bus: buildBusBody,
  truck: buildTruckBody,
  police: buildPoliceBody,
}

function buildWheels(hubColor: string, hubRadiusRatio: number) {
  return ({ attachments, config }: CarPartContext): THREE.Object3D => {
    const group = new THREE.Group()
    group.name = 'car-wheels'
    const tireMaterial = standard(TIRE_COLOR, 0.85, 0)
    const hubMaterial = standard(hubColor, 0.35, 0.2)
    const sportsWheel = config.body === 'sports'

    for (const wheel of attachments.wheels) {
      // タイヤの中心位置は attachment 由来。スポーツカーだけリムの見た目を追加する。
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheel.radius, wheel.radius, wheel.width, 24),
        tireMaterial,
      )
      tire.rotation.z = Math.PI / 2
      tire.position.set(wheel.position.x, wheel.position.y, wheel.position.z)
      tire.castShadow = true
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          wheel.radius * hubRadiusRatio,
          wheel.radius * hubRadiusRatio,
          wheel.width * 1.08,
          16,
        ),
        hubMaterial,
      )
      hub.rotation.z = Math.PI / 2
      hub.position.copy(tire.position)

      if (sportsWheel) {
        const spokeMaterial = standard(CHROME_COLOR, 0.22, 0.65)
        const rimRing = new THREE.Mesh(
          new THREE.TorusGeometry(wheel.radius * 0.58, wheel.radius * 0.055, 8, 20),
          hubMaterial,
        )
        rimRing.name = `car-sports-rim-ring-${wheel.id}`
        rimRing.rotation.y = Math.PI / 2
        rimRing.position.copy(tire.position)
        rimRing.castShadow = true

        const centerCap = new THREE.Mesh(
          new THREE.SphereGeometry(wheel.radius * 0.17, 12, 8),
          hubMaterial,
        )
        centerCap.name = `car-sports-center-cap-${wheel.id}`
        centerCap.position.copy(tire.position)
        centerCap.castShadow = true

        // 平面のハブだけで終わらせず、外側の面に短い5本スポークを置く。
        // ホイールの印象を整えるための最小限の追加で、ボディ造形の主役は奪わない。
        const spokeFaceX = wheel.position.x + wheel.side * (wheel.width * 0.58)
        for (let spokeIndex = 0; spokeIndex < 5; spokeIndex += 1) {
          const spoke = box(
            { x: 0.04, y: wheel.radius * 0.1, z: wheel.radius * 0.5 },
            { x: spokeFaceX, y: wheel.position.y, z: wheel.position.z },
            spokeMaterial,
          )
          spoke.name = `car-sports-spoke-${wheel.id}-${spokeIndex}`
          spoke.rotation.x = (spokeIndex * Math.PI * 2) / 5
          group.add(spoke)
        }
        group.add(tire, hub, rimRing, centerCap)
      } else {
        group.add(tire, hub)
      }
    }
    return group
  }
}

type FrontLightShape = 'box' | 'round'

function buildFront(shape: FrontLightShape) {
  return ({ attachments, config }: CarPartContext): THREE.Object3D => {
    const front = attachments.front
    const group = new THREE.Group()
    group.name = 'car-front'
    const sports = config.body === 'sports'
    const lightMaterial = standard(sports ? '#f7fbff' : '#fff3c4', sports ? 0.16 : 0.2, sports ? 0.18 : 0.1)
    const bumperMaterial = sports
      ? standard('#1d2730', 0.3, 0.12)
      : standard(CHROME_COLOR, 0.35, 0.35)

    const lightSize = front.size.extent * (sports ? 0.27 : 0.34)
    const lightDepth = sports ? 0.065 : 0.1
    for (const side of [1, -1]) {
      const center = offsetFrom(front, lightDepth / 2)
      const position = {
        x: center.x + side * front.size.width * (sports ? 0.35 : 0.32),
        y: center.y + front.size.extent * (sports ? -0.22 : 0.16),
        z: center.z,
      }
      if (sports && shape === 'box') {
        // 箱形ライトをそのまま置くとノーズ上に小さな直方体が浮くため、
        // 薄い楕円体にして低いボンネットの曲面へなじませる。
        const light = new THREE.Mesh(new THREE.SphereGeometry(lightSize * 0.58, 16, 10), lightMaterial)
        light.scale.set(1.35, 0.26, 0.22)
        light.position.set(position.x, position.y, position.z)
        light.rotation.z = side * -0.12
        light.castShadow = true
        group.add(light)
      } else if (shape === 'round') {
        const light = new THREE.Mesh(new THREE.SphereGeometry(lightSize * 0.55, 16, 12), lightMaterial)
        light.position.set(position.x, position.y, position.z)
        light.castShadow = true
        group.add(light)
      } else {
        group.add(box({ x: lightSize * (sports ? 1.7 : 1.3), y: lightSize * (sports ? 0.46 : 0.7), z: lightDepth }, position, lightMaterial))
      }
    }

    const bumperCenter = offsetFrom(front, sports ? 0.025 : 0.05)
    group.add(
      box(
        { x: front.size.width * (sports ? 0.62 : 0.92), y: front.size.extent * (sports ? 0.12 : 0.18), z: sports ? 0.07 : 0.12 },
        { x: bumperCenter.x, y: bumperCenter.y - front.size.extent * (sports ? 0.38 : 0.34), z: bumperCenter.z },
        bumperMaterial,
      ),
    )
    return group
  }
}

function buildRoofCarrier({ attachments }: CarPartContext): THREE.Object3D {
  const roof = attachments.roof
  const group = new THREE.Group()
  group.name = 'car-roof'
  const material = standard('#4d5b6b', 0.5, 0.2)

  const railHeight = 0.12
  const bar = 0.06
  const halfWidth = (roof.size.width * 0.82) / 2
  const halfDepth = (roof.size.extent * 0.86) / 2
  const legTop = offsetFrom(roof, railHeight / 2)
  const railTop = offsetFrom(roof, railHeight)

  for (const side of [1, -1]) {
    for (const otherSide of [1, -1]) {
      group.add(
        box(
          { x: bar, y: railHeight, z: bar },
          { x: legTop.x + side * halfWidth, y: legTop.y, z: legTop.z + otherSide * halfDepth },
          material,
        ),
      )
    }
    group.add(
      box(
        { x: bar, y: bar, z: halfDepth * 2 + bar },
        { x: railTop.x + side * halfWidth, y: railTop.y, z: railTop.z },
        material,
      ),
    )
    group.add(
      box(
        { x: halfWidth * 2, y: bar, z: bar },
        { x: railTop.x, y: railTop.y, z: railTop.z + side * halfDepth },
        material,
      ),
    )
  }
  return group
}

function createStarGeometry(outerRadius: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  const innerRadius = outerRadius * 0.46
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = (Math.PI / 5) * index + Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function buildStarDecoration({ attachments }: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const material = new THREE.MeshStandardMaterial({
    color: '#ffd43b',
    roughness: 0.4,
    side: THREE.DoubleSide,
  })

  for (const side of [attachments.sideLeft, attachments.sideRight]) {
    const geometry = createStarGeometry(side.size.extent * 0.34)
    const star = new THREE.Mesh(geometry, material)
    const position = offsetFrom(side, 0.012)
    star.position.copy(position)
    star.rotation.y = (side.normal.x > 0 ? 1 : -1) * (Math.PI / 2)
    group.add(star)
  }
  return group
}

function buildNumberPlate({ attachments }: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-mark'
  const plateMaterial = standard('#f8f9fa', 0.5)
  const markMaterial = standard('#3d7bf5', 0.4)

  for (const face of [attachments.front, attachments.rear]) {
    const center = offsetFrom(face, 0.035)
    const plateWidth = face.size.width * 0.34
    const plateHeight = face.size.extent * 0.2
    const plateY = center.y - face.size.extent * 0.06
    group.add(box({ x: plateWidth, y: plateHeight, z: 0.05 }, { x: center.x, y: plateY, z: center.z }, plateMaterial))
    const badgeCenter = offsetFrom(face, 0.065)
    group.add(
      box(
        { x: plateWidth * 0.22, y: plateHeight * 0.5, z: 0.03 },
        { x: badgeCenter.x - plateWidth * 0.3, y: plateY, z: badgeCenter.z },
        markMaterial,
      ),
    )
  }
  return group
}

const nothing: CarPartBuilder = () => null

/**
 * カテゴリ × 選択肢 → 生成関数。
 * 選択肢を足すと、この表に足すまで型エラーになる（Record の網羅性）。
 */
export const CAR_PART_BUILDERS: {
  [K in CarPartCategoryId]: Record<CarOptionIdMap[K], CarPartBuilder>
} = {
  body: BODY_BUILDERS,
  wheel: { normal: buildWheels(CHROME_COLOR, 0.45), big: buildWheels('#ff922b', 0.5) },
  front: { normal: buildFront('box'), round: buildFront('round') },
  roof: { none: nothing, carrier: buildRoofCarrier },
  decoration: { none: nothing, star: buildStarDecoration },
  mark: { none: nothing, plate: buildNumberPlate },
}

/**
 * オブジェクトツリーのgeometry / materialをすべて解放する。
 * パーツはレイヤー間でgeometryやmaterialを共有しないため、レイヤー単位でこれを呼べばよい。
 */
export function disposeCarObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    const mesh = object as Partial<THREE.Mesh>
    if (mesh.geometry !== undefined) geometries.add(mesh.geometry)
    if (Array.isArray(mesh.material)) for (const material of mesh.material) materials.add(material)
    else if (mesh.material !== undefined) materials.add(mesh.material)
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
