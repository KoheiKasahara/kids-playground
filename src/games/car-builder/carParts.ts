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
  const ringVertices = sections.map((section) => {
    const halfWidth = section.width / 2
    const topHalfWidth = (section.topWidth ?? section.width * 0.84) / 2
    const height = Math.max(0.04, section.topY - section.bottomY)
    const topZOffset = section.topZOffset ?? 0
    const shoulderY = section.shoulderY ?? section.bottomY + height * 0.96
    const centerZOffset = section.centerZOffset ?? 0
    const zAt = (weight: number) => section.z + topZOffset * weight

    return [
      [-halfWidth * 0.78, section.bottomY, section.z],
      [-halfWidth * 0.98, section.bottomY + height * 0.14, section.z],
      [-halfWidth, section.bottomY + height * 0.38, zAt(0.04)],
      [-halfWidth * 0.97, section.bottomY + height * 0.68, zAt(0.32)],
      [-topHalfWidth * 0.98, section.bottomY + height * 0.86, zAt(0.7)],
      [-topHalfWidth * 0.68, shoulderY, zAt(0.94)],
      [0, section.topY, zAt(1) + centerZOffset],
      [topHalfWidth * 0.68, shoulderY, zAt(0.94)],
      [topHalfWidth * 0.98, section.bottomY + height * 0.86, zAt(0.7)],
      [halfWidth * 0.97, section.bottomY + height * 0.68, zAt(0.32)],
      [halfWidth, section.bottomY + height * 0.38, zAt(0.04)],
      [halfWidth * 0.98, section.bottomY + height * 0.14, section.z],
      [halfWidth * 0.78, section.bottomY, section.z],
    ] as const
  })

  const positions: number[] = []
  for (const ring of ringVertices) {
    for (const vertex of ring) positions.push(vertex[0], vertex[1], vertex[2])
  }

  const ringSize = ringVertices[0]?.length ?? 0
  const indices: number[] = []
  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
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
  const rear = sections[0]
  if (rear !== undefined) positions.push(0, (rear.bottomY + rear.topY) / 2, rear.z)
  const frontCenterIndex = positions.length / 3
  const front = sections[sections.length - 1]
  if (front !== undefined) positions.push(0, (front.bottomY + front.topY) / 2, front.z)

  if (ringSize > 0) {
    for (let vertexIndex = 0; vertexIndex < ringSize; vertexIndex += 1) {
      const nextVertexIndex = (vertexIndex + 1) % ringSize
      indices.push(rearCenterIndex, vertexIndex, nextVertexIndex)
      const frontOffset = (sections.length - 1) * ringSize
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
  mesh.receiveShadow = true
  return mesh
}

function surfacePolygonMesh(
  points: readonly ProfilePoint[],
  xForY: (y: number) => number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const positions: number[] = []
  for (const [z, y] of points) positions.push(xForY(y), y, z)

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
  // ボンネットからルーフへ寝かせた一枚面。車体外殻の上にわずかに浮かせ、
  // 赤いキャビンの塊を別パーツとして見せない。
  const bottomY = dimensions.hullTopY + dimensions.cabinHeight * 0.29
  const topY = dimensions.roofTopY - 0.018
  const bottomZ = dimensions.cabinCenterZ + dimensions.cabinLength * 0.5 - 0.055
  const topZ = dimensions.cabinCenterZ + dimensions.cabinLength * 0.5 - dimensions.cabinLength * 0.28
  const bottomHalfWidth = dimensions.cabinWidth * 0.46
  const topHalfWidth = dimensions.cabinWidth * 0.33
  const positions = [
    -bottomHalfWidth, bottomY, bottomZ,
    0, bottomY + 0.022, bottomZ + 0.014,
    bottomHalfWidth, bottomY, bottomZ,
    -topHalfWidth, topY, topZ,
    0, topY + 0.014, topZ + 0.012,
    topHalfWidth, topY, topZ,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5])
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material)
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
  const outerRadius = wheel.radius * 1.12
  const innerRadius = wheel.radius * 0.84
  const bodySide = dimensions.width / 2 - 0.012
  const wheelSide = Math.abs(wheel.position.x)
  const outerSide = wheelSide + wheel.width * 0.46
  const innerX = wheel.side * bodySide
  const outerX = wheel.side * Math.max(bodySide + 0.08, outerSide)
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
  const bodyMaterial = standard(color, 0.32, 0.08)
  bodyMaterial.side = THREE.DoubleSide
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: GLASS_COLOR,
    roughness: 0.12,
    metalness: 0.14,
    side: THREE.DoubleSide,
  })
  const trimMaterial = standard(CHROME_COLOR, 0.28, 0.42)
  const grilleMaterial = standard('#202b36', 0.3, 0.18)
  const archMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.56),
    roughness: 0.42,
    metalness: 0.12,
  })
  const half = dimensions.length / 2
  const floor = dimensions.bodyFloorY
  const cabinHalf = dimensions.cabinLength / 2
  const cabinRear = dimensions.cabinCenterZ - cabinHalf
  const cabinFront = dimensions.cabinCenterZ + cabinHalf
  const roofRear = cabinRear + dimensions.cabinLength * 0.2
  const roofFront = cabinFront - dimensions.cabinLength * 0.28
  const hoodStart = half - dimensions.hoodLength
  const hullTop = dimensions.hullTopY
  const roofTop = dimensions.roofTopY
  const frontWheelZ = dimensions.wheelbase / 2
  const rearWheelZ = -frontWheelZ

  // 下段とキャビンを別々に積まず、リアデッキからノーズまでの高さを一つの
  // 連続した側面シルエットとして定義する。これが「上に載ったキャビン」を
  // 消し、ボンネット→フロントガラス→ルーフ→リアを一体に見せる中心部分。
  group.add(
    loftMesh(
      [
        { z: -half, width: dimensions.width * 0.72, topWidth: dimensions.width * 0.58, bottomY: floor, topY: floor + dimensions.hullHeight * 0.36 },
        { z: -half + 0.18, width: dimensions.width * 0.9, topWidth: dimensions.width * 0.73, bottomY: floor, topY: floor + dimensions.hullHeight * 0.54 },
        { z: -half + 0.42, width: dimensions.width * 0.99, topWidth: dimensions.width * 0.8, bottomY: floor, topY: floor + dimensions.hullHeight * 0.7 },
        { z: rearWheelZ - 0.15, width: dimensions.width * 1.05, topWidth: dimensions.width * 0.86, bottomY: floor, topY: floor + dimensions.hullHeight * 0.78, shoulderY: floor + dimensions.hullHeight * 0.7 },
        { z: cabinRear - 0.04, width: dimensions.width * 1.04, topWidth: dimensions.width * 0.86, bottomY: floor, topY: floor + dimensions.hullHeight * 0.84, shoulderY: floor + dimensions.hullHeight * 0.74 },
        { z: rearWheelZ + 0.12, width: dimensions.width * 1.05, topWidth: dimensions.width * 0.86, bottomY: floor, topY: floor + dimensions.hullHeight * 0.86, shoulderY: floor + dimensions.hullHeight * 0.76 },
        { z: roofRear - 0.2, width: dimensions.width * 0.99, topWidth: dimensions.cabinWidth * 0.88, bottomY: floor, topY: hullTop + dimensions.cabinHeight * 0.74, topZOffset: 0.08 },
        { z: roofRear, width: dimensions.width * 0.97, topWidth: dimensions.cabinWidth * 0.82, bottomY: floor, topY: roofTop - dimensions.cabinHeight * 0.12, topZOffset: 0.1 },
        { z: dimensions.cabinCenterZ - dimensions.cabinLength * 0.22, width: dimensions.width * 0.96, topWidth: dimensions.cabinWidth * 0.78, bottomY: floor, topY: roofTop - 0.012, topZOffset: 0.06 },
        { z: dimensions.cabinCenterZ + dimensions.cabinLength * 0.08, width: dimensions.width * 0.95, topWidth: dimensions.cabinWidth * 0.76, bottomY: floor, topY: roofTop, topZOffset: 0.01 },
        { z: roofFront, width: dimensions.width * 0.96, topWidth: dimensions.cabinWidth * 0.72, bottomY: floor, topY: roofTop - dimensions.cabinHeight * 0.08, topZOffset: -0.1 },
        { z: cabinFront + 0.14, width: dimensions.width * 0.98, topWidth: dimensions.width * 0.82, bottomY: floor, topY: hullTop + dimensions.cabinHeight * 0.58, topZOffset: -0.06 },
        { z: hoodStart - 0.1, width: dimensions.width * 0.98, topWidth: dimensions.width * 0.85, bottomY: floor, topY: hullTop + 0.06, shoulderY: hullTop + 0.045 },
        { z: hoodStart, width: dimensions.width * 1.0, topWidth: dimensions.width * 0.87, bottomY: floor, topY: hullTop + 0.075, shoulderY: hullTop + 0.06 },
        { z: frontWheelZ - 0.22, width: dimensions.width * 1.04, topWidth: dimensions.width * 0.88, bottomY: floor, topY: hullTop + 0.08, shoulderY: hullTop + 0.065 },
        { z: frontWheelZ + 0.04, width: dimensions.width * 1.07, topWidth: dimensions.width * 0.9, bottomY: floor, topY: hullTop + 0.06, shoulderY: hullTop + 0.05 },
        { z: frontWheelZ + 0.22, width: dimensions.width * 1.03, topWidth: dimensions.width * 0.86, bottomY: floor, topY: floor + dimensions.hullHeight * 0.86, shoulderY: floor + dimensions.hullHeight * 0.76 },
        { z: half - 0.3, width: dimensions.width * 0.91, topWidth: dimensions.width * 0.72, bottomY: floor, topY: floor + dimensions.hullHeight * 0.58, centerZOffset: 0.02 },
        { z: half - 0.1, width: dimensions.width * 0.78, topWidth: dimensions.width * 0.62, bottomY: floor, topY: floor + dimensions.hullHeight * 0.32, centerZOffset: 0.045 },
        { z: half, width: dimensions.width * 0.62, topWidth: dimensions.width * 0.48, bottomY: floor, topY: floor + dimensions.hullHeight * 0.18, centerZOffset: 0.07 },
      ],
      bodyMaterial,
      'car-body-hull',
    ),
  )

  const sideBottomY = dimensions.hullTopY + dimensions.cabinHeight * 0.13
  const sideTopY = dimensions.roofTopY - dimensions.cabinHeight * 0.1
  const pillarZ = dimensions.cabinCenterZ - cabinHalf * 0.05
  for (const side of [1, -1] as const) {
    const sideName = side === 1 ? 'left' : 'right'
    const xForY = (y: number) => {
      const roofProgress = Math.min(1, Math.max(0, (y - dimensions.hullTopY) / dimensions.cabinHeight))
      const halfWidth = dimensions.cabinWidth / 2
      const taperedHalfWidth = halfWidth * (1 - roofProgress * 0.26)
      return side * (taperedHalfWidth + 0.018)
    }
    group.add(
      surfacePolygonMesh(
        [
          [cabinRear + 0.12, sideBottomY],
          [pillarZ - 0.08, sideBottomY],
          [pillarZ - 0.16, sideTopY],
          [roofRear + 0.1, sideTopY - 0.03],
        ],
        xForY,
        glassMaterial,
        `car-sports-side-window-rear-${sideName}`,
      ),
      surfacePolygonMesh(
        [
          [pillarZ + 0.08, sideBottomY],
          [cabinFront - 0.12, sideBottomY],
          [roofFront - 0.03, sideTopY + 0.01],
          [pillarZ + 0.16, sideTopY],
        ],
        xForY,
        glassMaterial,
        `car-sports-side-window-front-${sideName}`,
      ),
    )
  }

  group.add(
    sportsWindshieldMesh(dimensions, glassMaterial, 'car-sports-windshield'),
  )

  // フェンダー上部だけを細いアーチで縁取り、タイヤとボディの境界を読み取りやすくする。
  for (const wheel of attachments.wheels) {
    group.add(sportsFenderMesh(wheel, dimensions, bodyMaterial, `car-sports-fender-${wheel.id}`))
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(wheel.radius * 1.08, 0.018, 8, 28, Math.PI),
      archMaterial,
    )
    arch.name = `car-sports-wheel-arch-${wheel.id}`
    arch.rotation.y = Math.PI / 2
    arch.position.set(wheel.position.x, wheel.position.y, wheel.position.z)
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
    const lightMaterial = standard('#fff3c4', 0.2, 0.1)
    const sports = config.body === 'sports'
    const bumperMaterial = sports
      ? standard('#1d2730', 0.3, 0.12)
      : standard(CHROME_COLOR, 0.35, 0.35)

    const lightSize = front.size.extent * (sports ? 0.27 : 0.34)
    const lightDepth = sports ? 0.065 : 0.1
    for (const side of [1, -1]) {
      const center = offsetFrom(front, lightDepth / 2)
      const position = {
        x: center.x + side * front.size.width * (sports ? 0.35 : 0.32),
        y: center.y + front.size.extent * (sports ? 0.12 : 0.16),
        z: center.z,
      }
      if (shape === 'round') {
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
