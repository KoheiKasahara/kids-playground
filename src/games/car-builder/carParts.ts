/**
 * カテゴリごとの3Dパーツ生成関数と、その登録表。
 *
 * どの生成関数も、座標は必ず `CarDimensions` / `CarAttachments` から計算する。
 * ボディ種別やタイヤ径ごとの座標をここへ直接書かないこと（書いた瞬間に、
 * ボディやタイヤを増やすたびに全カテゴリを直す構造になってしまう）。
 */
import * as THREE from 'three'
import type { CarCategoryId, CarConfig, CarOptionIdMap } from './carConfig'
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

/** 取り付け面から法線方向へ `distance` だけ離した位置を返す。 */
function offsetFrom(attachment: CarAttachment, distance: number): THREE.Vector3 {
  return new THREE.Vector3(
    attachment.position.x + attachment.normal.x * distance,
    attachment.position.y + attachment.normal.y * distance,
    attachment.position.z + attachment.normal.z * distance,
  )
}

function buildBody({ dimensions, color }: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-body'
  const bodyMaterial = standard(color, 0.42)
  const glassMaterial = standard(GLASS_COLOR, 0.18, 0.1)

  group.add(
    box(
      { x: dimensions.width, y: dimensions.hullHeight, z: dimensions.length },
      { x: 0, y: dimensions.bodyFloorY + dimensions.hullHeight / 2, z: 0 },
      bodyMaterial,
    ),
  )
  group.add(
    box(
      { x: dimensions.width * 0.86, y: dimensions.cabinHeight, z: dimensions.cabinLength },
      { x: 0, y: dimensions.hullTopY + dimensions.cabinHeight / 2, z: dimensions.cabinCenterZ },
      bodyMaterial,
    ),
  )
  // 窓は、キャビンより前後左右に少しだけ大きい帯を重ねて表現する。
  group.add(
    box(
      { x: dimensions.width * 0.88, y: dimensions.cabinHeight * 0.5, z: dimensions.cabinLength * 1.02 },
      {
        x: 0,
        y: dimensions.hullTopY + dimensions.cabinHeight * 0.6,
        z: dimensions.cabinCenterZ,
      },
      glassMaterial,
    ),
  )
  return group
}

function buildWheels(hubColor: string, hubRadiusRatio: number) {
  return ({ attachments }: CarPartContext): THREE.Object3D => {
    const group = new THREE.Group()
    group.name = 'car-wheels'
    const tireMaterial = standard(TIRE_COLOR, 0.85, 0)
    const hubMaterial = standard(hubColor, 0.35, 0.2)

    for (const wheel of attachments.wheels) {
      // タイヤは1本ずつ独立に置く。位置はすべて attachment 由来で、車種ごとの分岐は無い。
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
      group.add(tire, hub)
    }
    return group
  }
}

type FrontLightShape = 'box' | 'round'

function buildFront(shape: FrontLightShape) {
  return ({ attachments }: CarPartContext): THREE.Object3D => {
    const front = attachments.front
    const group = new THREE.Group()
    group.name = 'car-front'
    const lightMaterial = standard('#fff3c4', 0.2, 0.1)
    const bumperMaterial = standard(CHROME_COLOR, 0.35, 0.35)

    const lightSize = front.size.extent * 0.34
    const lightDepth = 0.1
    for (const side of [1, -1]) {
      const center = offsetFrom(front, lightDepth / 2)
      const position = {
        x: center.x + side * front.size.width * 0.32,
        y: center.y + front.size.extent * 0.16,
        z: center.z,
      }
      if (shape === 'round') {
        const light = new THREE.Mesh(new THREE.SphereGeometry(lightSize * 0.55, 16, 12), lightMaterial)
        light.position.set(position.x, position.y, position.z)
        light.castShadow = true
        group.add(light)
      } else {
        group.add(box({ x: lightSize * 1.3, y: lightSize * 0.7, z: lightDepth }, position, lightMaterial))
      }
    }

    const bumperCenter = offsetFrom(front, 0.05)
    group.add(
      box(
        { x: front.size.width * 0.92, y: front.size.extent * 0.18, z: 0.12 },
        { x: bumperCenter.x, y: bumperCenter.y - front.size.extent * 0.34, z: bumperCenter.z },
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

  // side = +1 / -1 の2周で、4本の脚と、左右のレール・前後のクロスバーを1本ずつ置く。
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
    // 側面は法線が ±X なので、Y軸まわりに90度回すだけで面へ貼り付く。
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
  // ボディ2種は寸法だけが違い、生成関数は共通。ボディを増やしても座標の書き足しは起きない。
  body: { normal: buildBody, long: buildBody },
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
