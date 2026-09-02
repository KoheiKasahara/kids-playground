/**
 * カテゴリごとの3Dパーツ生成関数と、その登録表。
 *
 * どの生成関数も、座標は必ず `CarDimensions` / `CarAttachments` から計算する。
 * タイヤ・フロント・屋根・飾り・マークの座標へボディ種別を持ち込まないこと。
 */
import * as THREE from 'three'
import type { BodyType, CarCategoryId, CarConfig, CarOptionIdMap } from './carConfig'
import type { CarAttachment, CarAttachments, CarDimensions } from './carDimensions'
import { createSportsHull, sportsSurfacePoint } from './sportsBodySurface'

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
    roughness: 0.4,
    metalness: 0.05,
    clearcoat: 0.22,
    clearcoatRoughness: 0.26,
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
  // ガラスも開口部も外殻と同じサーフェスのマテリアルグループ。板や箱を貼らない。
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#1b2f42',
    roughness: 0.09,
    metalness: 0.1,
    clearcoat: 0.7,
    clearcoatRoughness: 0.06,
  })
  const openingMaterial = standard('#1b232c', 0.42, 0.14)

  const hull = createSportsHull(dimensions, attachments, bodyMaterial, glassMaterial, openingMaterial)
  group.add(hull.mesh)

  // テールランプ。外殻の面を直接問い合わせて置くので、リアが丸くなっても
  // 埋まったり浮いたりしない。箱やクロームの帯はリアへ貼り足さない。
  const lampMaterial = standard('#e2413c', 0.3, 0.12)
  const lampAnchor = sportsSurfacePoint(dimensions, attachments, -dimensions.length / 2 + 0.16, 0.42)
  for (const side of [1, -1] as const) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), lampMaterial)
    lamp.name = `car-sports-tail-lamp-${side === 1 ? 'left' : 'right'}`
    lamp.scale.set(2.1, 0.5, 0.55)
    lamp.position.set(
      side * lampAnchor.position.x * 0.62,
      lampAnchor.position.y,
      lampAnchor.position.z - 0.02,
    )
    lamp.castShadow = true
    group.add(lamp)
  }

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
  return ({ attachments, config, dimensions }: CarPartContext): THREE.Object3D => {
    const front = attachments.front
    const group = new THREE.Group()
    group.name = 'car-front'
    const sports = config.body === 'sports'
    const lightMaterial = standard(sports ? '#f7fbff' : '#fff3c4', sports ? 0.16 : 0.2, sports ? 0.18 : 0.1)

    const lightSize = front.size.extent * (sports ? 0.27 : 0.34)
    const lightDepth = sports ? 0.065 : 0.1
    for (const side of [1, -1]) {
      const center = offsetFrom(front, lightDepth / 2)
      // スポーツカーのノーズは丸く絞り込まれているため、前端の平面ではなく
      // ボンネットの肩の高さ・少し内側・少し後ろへ置いてボディ面へなじませる。
      // スポーツカーのノーズは丸く絞り込まれているため、前端の平面を基準にすると
      // ライトが浮くか埋まる。外殻サーフェス上の点を直接問い合わせて置く。
      const position = sports
        ? (() => {
            const anchor = sportsSurfacePoint(dimensions, attachments, dimensions.length / 2 - 0.3, 0.37)
            return {
              x: side * anchor.position.x * 0.74,
              y: anchor.position.y - 0.01,
              z: anchor.position.z,
            }
          })()
        : {
            x: center.x + side * front.size.width * 0.32,
            y: center.y + front.size.extent * 0.16,
            z: center.z,
          }
      if (sports && shape === 'box') {
        // 箱形ライトをそのまま置くとノーズ上に小さな直方体が浮くため、
        // 薄い楕円体にして低いボンネットの曲面へなじませる。
        const light = new THREE.Mesh(new THREE.SphereGeometry(lightSize * 0.95, 18, 10), lightMaterial)
        light.scale.set(1.5, 0.3, 0.55)
        light.position.set(position.x, position.y, position.z)
        light.rotation.z = side * -0.16
        light.rotation.y = side * 0.2
        light.castShadow = true
        group.add(light)
      } else if (shape === 'round') {
        const light = new THREE.Mesh(new THREE.SphereGeometry(lightSize * (sports ? 0.42 : 0.55), 16, 12), lightMaterial)
        light.position.set(position.x, position.y, position.z)
        if (sports) light.scale.set(1, 0.62, 0.62)
        light.castShadow = true
        group.add(light)
      } else {
        group.add(box({ x: lightSize * (sports ? 1.7 : 1.3), y: lightSize * (sports ? 0.46 : 0.7), z: lightDepth }, position, lightMaterial))
      }
    }

    // スポーツカーのフロント開口は外殻のマテリアルグループとして作ってあるので、
    // ここでバンパーの箱を前へ貼り足さない（貼ると後付け部品に見える）。
    if (!sports) {
      const bumperMaterial = standard(CHROME_COLOR, 0.35, 0.35)
      const bumperCenter = offsetFrom(front, 0.05)
      group.add(
        box(
          { x: front.size.width * 0.92, y: front.size.extent * 0.18, z: 0.12 },
          { x: bumperCenter.x, y: bumperCenter.y - front.size.extent * 0.34, z: bumperCenter.z },
          bumperMaterial,
        ),
      )
    }
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
