/**
 * カテゴリごとの3Dパーツ生成関数と、その登録表。
 *
 * どの生成関数も、座標は必ず `CarDimensions` / `CarAttachments` から計算する。
 * タイヤ・フロント・屋根・飾り・マークの座標へボディ種別を持ち込まないこと。
 */
import * as THREE from 'three'
import type { BodyType, CarCategoryId, CarConfig, CarOptionIdMap, FrontType } from './carConfig'
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

type WheelVisual = {
  hubColor: string
  hubRadiusRatio: number
  detail: 'standard' | 'offroad' | 'racing'
}

function addPerformanceRim(
  group: THREE.Group,
  wheel: CarAttachments['wheels'][number],
  hubMaterial: THREE.Material,
  namePrefix: 'car-sports' | 'car-racing',
): void {
  const spokeMaterial = standard(namePrefix === 'car-racing' ? '#f1f4f7' : CHROME_COLOR, 0.22, 0.65)
  const rimRing = new THREE.Mesh(
    new THREE.TorusGeometry(wheel.radius * (namePrefix === 'car-racing' ? 0.68 : 0.58), wheel.radius * 0.055, 8, 20),
    hubMaterial,
  )
  rimRing.name = `${namePrefix}-rim-ring-${wheel.id}`
  rimRing.rotation.y = Math.PI / 2
  rimRing.position.set(wheel.position.x, wheel.position.y, wheel.position.z)
  rimRing.castShadow = true

  const centerCap = new THREE.Mesh(
    new THREE.SphereGeometry(wheel.radius * (namePrefix === 'car-racing' ? 0.14 : 0.17), 12, 8),
    hubMaterial,
  )
  centerCap.name = `${namePrefix}-center-cap-${wheel.id}`
  centerCap.position.set(wheel.position.x, wheel.position.y, wheel.position.z)
  centerCap.castShadow = true

  // 外側の面に短いスポークを置き、レーシングはリムを大きくしてスポーツカー以外でも判別できるようにする。
  const spokeFaceX = wheel.position.x + wheel.side * (wheel.width * 0.58)
  for (let spokeIndex = 0; spokeIndex < 5; spokeIndex += 1) {
    const spoke = box(
      { x: 0.04, y: wheel.radius * 0.1, z: wheel.radius * (namePrefix === 'car-racing' ? 0.58 : 0.5) },
      { x: spokeFaceX, y: wheel.position.y, z: wheel.position.z },
      spokeMaterial,
    )
    spoke.name = `${namePrefix}-spoke-${wheel.id}-${spokeIndex}`
    spoke.rotation.x = (spokeIndex * Math.PI * 2) / 5
    group.add(spoke)
  }
  group.add(rimRing, centerCap)
}

function addOffroadTread(
  group: THREE.Group,
  wheel: CarAttachments['wheels'][number],
  material: THREE.Material,
): void {
  // 少数のブロックを外周へ置くだけで、重い高精細タイヤモデルなしにゴツゴツした輪郭を作る。
  const treadCount = 10
  // ブロックは回転時の角でも地面へ潜らないよう、中心をタイヤ外周より少し内側へ置く。
  // ブロック自体の厚みで外周へ十分に張り出し、シルエットはゴツゴツしたまま保つ。
  const outerRadius = wheel.radius * 0.83
  for (let index = 0; index < treadCount; index += 1) {
    const angle = (index * Math.PI * 2) / treadCount
    const tread = box(
      { x: wheel.width * 0.5, y: wheel.radius * 0.18, z: wheel.radius * 0.3 },
      {
        x: wheel.position.x + wheel.side * wheel.width * 0.16,
        y: wheel.position.y + Math.cos(angle) * outerRadius,
        z: wheel.position.z + Math.sin(angle) * outerRadius,
      },
      material,
    )
    tread.name = `car-offroad-tread-${wheel.id}-${index}`
    tread.rotation.x = angle
    group.add(tread)
  }
}

function buildWheels(visual: WheelVisual) {
  return ({ attachments, config }: CarPartContext): THREE.Object3D => {
    const group = new THREE.Group()
    group.name = 'car-wheels'
    const tireMaterial = standard(TIRE_COLOR, 0.85, 0)
    const hubMaterial = standard(visual.hubColor, 0.35, 0.2)
    const treadMaterial = standard('#24282c', 0.92, 0)
    const sportsWheel = config.body === 'sports'

    for (const wheel of attachments.wheels) {
      // タイヤの中心位置は attachment 由来。サイズは寸法基盤から、見た目の差はvisual定義から決まる。
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheel.radius, wheel.radius, wheel.width, 24),
        tireMaterial,
      )
      tire.name = `car-wheel-tire-${wheel.id}`
      tire.rotation.z = Math.PI / 2
      tire.position.set(wheel.position.x, wheel.position.y, wheel.position.z)
      tire.castShadow = true
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          wheel.radius * visual.hubRadiusRatio,
          wheel.radius * visual.hubRadiusRatio,
          wheel.width * 1.08,
          16,
        ),
        hubMaterial,
      )
      hub.name = `car-wheel-hub-${wheel.id}`
      hub.rotation.z = Math.PI / 2
      hub.position.copy(tire.position)
      group.add(tire, hub)

      if (visual.detail === 'offroad') {
        addOffroadTread(group, wheel, treadMaterial)
      } else if (visual.detail === 'racing') {
        addPerformanceRim(group, wheel, hubMaterial, 'car-racing')
      } else if (sportsWheel) {
        addPerformanceRim(group, wheel, hubMaterial, 'car-sports')
      }
    }
    return group
  }
}

function buildFront(shape: FrontType) {
  return ({ attachments, config, dimensions }: CarPartContext): THREE.Object3D => {
    const front = attachments.front
    const group = new THREE.Group()
    group.name = 'car-front'
    const sports = config.body === 'sports'
    const lightMaterial = standard(sports ? '#f7fbff' : '#fff3c4', sports ? 0.16 : 0.2, sports ? 0.18 : 0.1)

    const lightSize = front.size.extent * (sports ? 0.29 : 0.34)
    const lightDepth = sports ? 0.065 : 0.1
    const lightWidth =
      shape === 'round' ? lightSize * 0.9 : shape === 'square' ? lightSize * 1.5 : lightSize * 2.2
    const lightHeight =
      shape === 'round' ? lightSize * 0.9 : shape === 'square' ? lightSize * 0.7 : lightSize * 0.28
    const surroundMaterial = standard(shape === 'round' ? CHROME_COLOR : '#3f4b57', 0.32, 0.35)
    for (const side of [1, -1]) {
      const center = offsetFrom(front, lightDepth / 2)
      // スポーツカーのノーズは丸く絞り込まれているため、前端の平面ではなく
      // ボンネットの肩の高さ・少し内側・少し後ろへ置いてボディ面へなじませる。
      // スポーツカーのノーズは丸く絞り込まれているため、前端の平面を基準にすると
      // ライトが浮くか埋まる。外殻サーフェス上の点を直接問い合わせて置く。
      const position = sports
        ? (() => {
            const anchor = sportsSurfacePoint(dimensions, attachments, dimensions.length / 2 - 0.34, 0.37)
            return {
              x: side * anchor.position.x * (shape === 'slim' ? 0.7 : 0.74),
              y: anchor.position.y - (shape === 'slim' ? 0.02 : 0.01),
              z: anchor.position.z,
            }
          })()
        : {
            x: center.x + side * front.size.width * (shape === 'slim' ? 0.3 : 0.32),
            y: center.y + front.size.extent * 0.16,
            z: center.z,
          }

      if (shape === 'round') {
        const surround = new THREE.Mesh(
          new THREE.TorusGeometry(lightSize * 0.5, lightSize * 0.08, 8, 20),
          surroundMaterial,
        )
        surround.name = `car-front-surround-round-${side === 1 ? 'left' : 'right'}`
        surround.position.set(position.x, position.y, position.z)
        surround.castShadow = true
        const light = new THREE.Mesh(new THREE.SphereGeometry(lightSize * 0.48, 16, 12), lightMaterial)
        light.name = `car-front-light-round-${side === 1 ? 'left' : 'right'}`
        light.position.set(position.x, position.y, position.z)
        // 前面の丸さは保ちつつ、ライト本体が車体の前端から出すぎないよう奥行きを薄くする。
        light.scale.set(0.8, 0.8, sports ? 0.68 : 0.62)
        light.rotation.z = side * -0.08
        light.castShadow = true
        group.add(surround, light)
      } else {
        const surround = box(
          { x: lightWidth + lightSize * 0.18, y: lightHeight + lightSize * 0.18, z: lightDepth * 0.72 },
          { x: position.x, y: position.y, z: position.z - lightDepth * 0.12 },
          surroundMaterial,
        )
        surround.name = `car-front-surround-${shape}-${side === 1 ? 'left' : 'right'}`
        const light = box(
          { x: lightWidth, y: lightHeight, z: lightDepth },
          { x: position.x, y: position.y, z: position.z + lightDepth * 0.08 },
          lightMaterial,
        )
        light.name = `car-front-light-${shape}-${side === 1 ? 'left' : 'right'}`
        group.add(surround, light)
      }
    }

    // ライトだけでなく、中央のマスクと下端のバンパーも選択肢ごとに変える。
    // スポーツカーは外殻に開口があるため、surface上の低い位置へ薄く置いて後付け感を抑える。
    const grilleMaterial = standard(shape === 'round' ? '#303943' : shape === 'square' ? '#202830' : '#172027', 0.5, 0.12)
    const bumperMaterial = standard(shape === 'round' ? CHROME_COLOR : shape === 'square' ? '#65717d' : '#252d35', 0.35, 0.35)
    const grilleWidth = front.size.width * (shape === 'round' ? 0.42 : shape === 'square' ? 0.5 : 0.62)
    const grilleHeight = front.size.extent * (shape === 'round' ? 0.17 : shape === 'square' ? 0.22 : 0.12)
    const grilleCenter = sports
      ? sportsSurfacePoint(dimensions, attachments, dimensions.length / 2 - 0.34, 0.18).position
      : offsetFrom(front, 0.055)
    const grille = box(
      { x: grilleWidth, y: grilleHeight, z: sports ? 0.045 : 0.08 },
      {
        x: 0,
        y: sports ? grilleCenter.y + 0.025 : grilleCenter.y - front.size.extent * 0.28,
        z: sports ? grilleCenter.z + 0.02 : grilleCenter.z,
      },
      grilleMaterial,
    )
    grille.name = `car-front-grille-${shape}`
    group.add(grille)

    const bumperCenter = sports
      ? sportsSurfacePoint(dimensions, attachments, dimensions.length / 2 - 0.25, 0.08).position
      : offsetFrom(front, 0.08)
    const bumper = box(
      { x: front.size.width * (shape === 'slim' ? 0.86 : 0.92), y: front.size.extent * 0.14, z: sports ? 0.045 : 0.12 },
      {
        x: 0,
        y: sports ? bumperCenter.y + 0.015 : bumperCenter.y - front.size.extent * 0.34,
        z: sports ? bumperCenter.z + 0.02 : bumperCenter.z,
      },
      bumperMaterial,
    )
    bumper.name = `car-front-bumper-${shape}`
    group.add(bumper)
    return group
  }
}

function buildRoofPoliceLight({ attachments }: CarPartContext): THREE.Object3D {
  const roof = attachments.roof
  const group = new THREE.Group()
  group.name = 'car-roof'
  const baseMaterial = standard('#202a35', 0.35, 0.35)
  const blueMaterial = standard('#2f78e6', 0.22, 0.18)
  const redMaterial = standard('#ee4b55', 0.22, 0.12)
  const barWidth = Math.min(Math.max(roof.size.width * 0.68, 0.62), 1.5)
  const barDepth = Math.min(Math.max(roof.size.extent * 0.2, 0.22), 0.5)

  const base = box(
    { x: barWidth * 0.98, y: 0.07, z: barDepth },
    { x: roof.position.x, y: roof.position.y + 0.035, z: roof.position.z },
    baseMaterial,
  )
  base.name = 'car-roof-police-light-base'
  group.add(base)

  for (const [side, material, name] of [
    [1, blueMaterial, 'blue'],
    [-1, redMaterial, 'red'],
  ] as const) {
    const light = box(
      { x: barWidth * 0.43, y: 0.13, z: barDepth * 0.86 },
      {
        x: roof.position.x + side * barWidth * 0.22,
        y: roof.position.y + 0.13,
        z: roof.position.z,
      },
      material,
    )
    light.name = `car-roof-police-light-${name}`
    group.add(light)
  }
  return group
}

function buildRoofLuggage({ attachments }: CarPartContext): THREE.Object3D {
  const roof = attachments.roof
  const group = new THREE.Group()
  group.name = 'car-roof'
  const luggageMaterial = standard('#c88643', 0.62, 0.02)
  const lidMaterial = standard('#e0a15c', 0.56, 0.02)
  const strapMaterial = standard('#4b3b35', 0.72, 0)
  const width = Math.min(Math.max(roof.size.width * 0.62, 0.58), 1.35)
  const depth = Math.min(Math.max(roof.size.extent * 0.48, 0.48), 2.05)
  const height = 0.22

  const luggage = box(
    { x: width, y: height, z: depth },
    { x: roof.position.x, y: roof.position.y + height / 2, z: roof.position.z },
    luggageMaterial,
  )
  luggage.name = 'car-roof-luggage'
  group.add(luggage)

  const lid = box(
    { x: width * 0.94, y: 0.045, z: depth * 0.9 },
    { x: roof.position.x, y: roof.position.y + height + 0.022, z: roof.position.z },
    lidMaterial,
  )
  lid.name = 'car-roof-luggage-lid'
  group.add(lid)

  for (const zOffset of [-depth * 0.27, depth * 0.27]) {
    const strap = box(
      { x: width * 1.02, y: 0.028, z: 0.055 },
      { x: roof.position.x, y: roof.position.y + height + 0.048, z: roof.position.z + zOffset },
      strapMaterial,
    )
    strap.name = `car-roof-luggage-strap-${zOffset < 0 ? 'rear' : 'front'}`
    group.add(strap)
  }
  return group
}

function buildRoofSpoiler({ attachments }: CarPartContext): THREE.Object3D {
  const roof = attachments.roof
  const group = new THREE.Group()
  group.name = 'car-roof'
  const wingMaterial = standard('#3b4651', 0.32, 0.3)
  const supportMaterial = standard('#252e37', 0.4, 0.25)
  const wingWidth = Math.min(Math.max(roof.size.width * 0.82, 0.7), 1.65)
  const wingDepth = Math.min(Math.max(roof.size.extent * 0.08, 0.1), 0.24)
  const supportHeight = 0.18
  const wingZ = roof.position.z - roof.size.extent * 0.36

  for (const side of [-1, 1] as const) {
    const support = box(
      { x: 0.075, y: supportHeight, z: 0.075 },
      {
        x: roof.position.x + side * wingWidth * 0.3,
        y: roof.position.y + supportHeight / 2,
        z: wingZ,
      },
      supportMaterial,
    )
    support.name = `car-roof-spoiler-support-${side === 1 ? 'left' : 'right'}`
    group.add(support)
  }

  const wing = box(
    { x: wingWidth, y: 0.1, z: wingDepth },
    { x: roof.position.x, y: roof.position.y + supportHeight + 0.05, z: wingZ },
    wingMaterial,
  )
  wing.name = 'car-roof-spoiler-wing'
  group.add(wing)
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

function createFlameGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, size * 0.58)
  shape.quadraticCurveTo(size * 0.07, size * 0.25, size * 0.32, size * 0.08)
  shape.quadraticCurveTo(size * 0.5, -size * 0.08, size * 0.38, -size * 0.28)
  shape.quadraticCurveTo(size * 0.22, -size * 0.52, 0, -size * 0.58)
  shape.quadraticCurveTo(-size * 0.22, -size * 0.52, -size * 0.38, -size * 0.28)
  shape.quadraticCurveTo(-size * 0.5, -size * 0.08, -size * 0.32, size * 0.08)
  shape.quadraticCurveTo(-size * 0.08, size * 0.25, 0, size * 0.58)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createStripeGeometry(width: number, height: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  const slant = width * 0.42
  shape.moveTo(-width / 2 + slant, -height / 2)
  shape.lineTo(width / 2 + slant, -height / 2)
  shape.lineTo(width / 2 - slant, height / 2)
  shape.lineTo(-width / 2 - slant, height / 2)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

type SideStickerSurface = {
  position: THREE.Vector3
  normal: THREE.Vector3
}

/**
 * 側面ステッカーの貼り付け面を求める。
 * スポーツカーだけは断面が丸く、固定した attachment の平面では浮くため、
 * 既存の外殻サーフェスから実際の位置と法線を問い合わせる。
 */
function sideStickerSurface(
  context: CarPartContext,
  side: CarAttachment,
  z: number,
  u: number,
): SideStickerSurface {
  const sideSign = side.normal.x > 0 ? 1 : -1
  if (context.dimensions.bodyStyle === 'sports') {
    const surface = sportsSurfacePoint(context.dimensions, context.attachments, z, u)
    return {
      position: new THREE.Vector3(sideSign * surface.position.x, surface.position.y, surface.position.z),
      normal: new THREE.Vector3(sideSign * surface.normal.x, surface.normal.y, 0).normalize(),
    }
  }

  return {
    position: new THREE.Vector3(
      side.position.x,
      context.dimensions.bodyFloorY + context.dimensions.hullHeight * (0.48 + (u - 0.3) * 0.8),
      side.position.z + z,
    ),
    normal: new THREE.Vector3(side.normal.x, side.normal.y, side.normal.z).normalize(),
  }
}

/** 平面の横軸を車の前後、縦軸を車体断面の接線へ合わせる。 */
function placeSideSticker(
  mesh: THREE.Mesh,
  surface: SideStickerSurface,
  side: CarAttachment,
  distance: number,
): void {
  const sideSign = side.normal.x > 0 ? 1 : -1
  const normal = surface.normal.clone().normalize()
  const horizontal = new THREE.Vector3(0, 0, -sideSign)
  const vertical = new THREE.Vector3(-normal.y / sideSign, Math.abs(normal.x), 0).normalize()
  const basis = new THREE.Matrix4().makeBasis(horizontal, vertical, normal)

  mesh.position.copy(surface.position).addScaledVector(normal, distance)
  mesh.quaternion.setFromRotationMatrix(basis)
  mesh.castShadow = true
  mesh.receiveShadow = true
}

function sideStickerMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  context: CarPartContext,
  side: CarAttachment,
  z: number,
  u: number,
  distance = 0.024,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  placeSideSticker(mesh, sideStickerSurface(context, side, z, u), side, distance)
  return mesh
}

function buildStarDecoration(context: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const outlineMaterial = new THREE.MeshStandardMaterial({ color: '#9a3412', roughness: 0.42, side: THREE.DoubleSide })
  const material = new THREE.MeshStandardMaterial({ color: '#ffd43b', roughness: 0.4, side: THREE.DoubleSide })
  const outlineGeometry = createStarGeometry(context.dimensions.hullHeight * 0.39)
  const geometry = createStarGeometry(context.dimensions.hullHeight * 0.32)

  for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
    group.add(
      sideStickerMesh(outlineGeometry, outlineMaterial, context, side, 0, 0.3, 0.019),
      sideStickerMesh(geometry, material, context, side, 0, 0.3, 0.029),
    )
  }
  return group
}

function buildFlameDecoration(context: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const outerMaterial = new THREE.MeshStandardMaterial({ color: '#b42318', roughness: 0.4, side: THREE.DoubleSide })
  const innerMaterial = new THREE.MeshStandardMaterial({ color: '#ffd43b', roughness: 0.38, side: THREE.DoubleSide })
  const outerGeometry = createFlameGeometry(context.dimensions.hullHeight * 0.72)
  const innerGeometry = createFlameGeometry(context.dimensions.hullHeight * 0.42)

  for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
    group.add(
      sideStickerMesh(outerGeometry, outerMaterial, context, side, context.dimensions.length * 0.02, 0.3, 0.019),
      sideStickerMesh(innerGeometry, innerMaterial, context, side, context.dimensions.length * 0.02, 0.3, 0.029),
    )
  }
  return group
}

function buildStripesDecoration(context: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const materials = [
    new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#ffd43b', roughness: 0.38, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4, side: THREE.DoubleSide }),
  ]
  const geometry = createStripeGeometry(context.dimensions.hullHeight * 0.17, context.dimensions.hullHeight * 0.56)
  const offsets = [-0.16, 0, 0.16]

  for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
    offsets.forEach((offset, index) => {
      group.add(
        sideStickerMesh(
          geometry,
          materials[index]!,
          context,
          side,
          context.dimensions.length * offset,
          0.3,
          0.024,
        ),
      )
    })
  }
  return group
}

function buildDotsDecoration(context: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const materials = [
    new THREE.MeshStandardMaterial({ color: '#e64a4a', roughness: 0.38, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#ffd43b', roughness: 0.36, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#51cf66', roughness: 0.38, side: THREE.DoubleSide }),
  ]
  const radius = context.dimensions.hullHeight * 0.105
  const geometry = new THREE.CircleGeometry(radius, 20)
  const zOffsets = [-0.16, 0, 0.16]
  const rows = [0.22, 0.37]
  let colorIndex = 0

  for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
    for (const u of rows) {
      for (const offset of zOffsets) {
        group.add(
          sideStickerMesh(
            geometry,
            materials[colorIndex++ % materials.length]!,
            context,
            side,
            context.dimensions.length * offset,
            u,
            0.024,
          ),
        )
      }
    }
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
  wheel: {
    small: buildWheels({ hubColor: CHROME_COLOR, hubRadiusRatio: 0.45, detail: 'standard' }),
    big: buildWheels({ hubColor: '#ff922b', hubRadiusRatio: 0.5, detail: 'standard' }),
    offroad: buildWheels({ hubColor: '#c8873d', hubRadiusRatio: 0.42, detail: 'offroad' }),
    racing: buildWheels({ hubColor: '#d83f45', hubRadiusRatio: 0.62, detail: 'racing' }),
  },
  front: { round: buildFront('round'), square: buildFront('square'), slim: buildFront('slim') },
  roof: {
    none: nothing,
    policeLight: buildRoofPoliceLight,
    luggage: buildRoofLuggage,
    spoiler: buildRoofSpoiler,
  },
  decoration: {
    none: nothing,
    star: buildStarDecoration,
    flame: buildFlameDecoration,
    stripes: buildStripesDecoration,
    dots: buildDotsDecoration,
  },
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
