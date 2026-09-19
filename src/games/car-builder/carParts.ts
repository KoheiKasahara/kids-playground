/**
 * カテゴリごとの3Dパーツ生成関数と、その登録表。
 *
 * どの生成関数も、座標は必ず `CarDimensions` / `CarAttachments` から計算する。
 * タイヤ・フロント・屋根・飾り・マークの座標へボディ種別を持ち込まないこと。
 */
import * as THREE from 'three'
import type { CarSurface } from './carSurface'
import type { CarCategoryId, CarConfig, CarMarkIcon, CarOptionIdMap, FrontType, MarkType } from './carConfig'
import type {
  CarAttachment,
  CarAttachments,
  CarDimensions,
  CarWheelAttachment,
  CarWheelAttachmentId,
} from './carDimensions'
import type { CarHeadlightMount } from './vehicleBody'

export type CarPartContext = {
  config: CarConfig
  surface?: CarSurface
  dimensions: CarDimensions
  attachments: CarAttachments
  /** 元GLBにある左右のライト開口部。存在するときは共通前面座標より優先する。 */
  headlightMount?: CarHeadlightMount | null
  /** ボディカラー（hex）。カラーカテゴリの選択がここへ流れてくる。 */
  color: string
}

/** パーツを持たない選択（「なし」）では null を返す。 */
export type CarPartBuilder = (context: CarPartContext) => THREE.Object3D | null

/** ここで手続き的に組み立てるカテゴリ。 */
export const CAR_PART_CATEGORY_IDS = ['wheel', 'front', 'roof', 'decoration', 'mark'] as const
export type CarPartCategoryId = (typeof CAR_PART_CATEGORY_IDS)[number]

/**
 * GLBの読み込みで表示するカテゴリ。生成関数を持たず carModel.ts が非同期に差し替える。
 */
export const CAR_MODEL_CATEGORY_IDS = ['body'] as const satisfies readonly CarCategoryId[]

/**
 * 自前のレイヤーを持たず、他のパーツの入力（色・寸法）として効くカテゴリ。
 * カテゴリを足したときにどれにも入れ忘れると carModel.test.ts が落ちる。
 */
export const CAR_DERIVED_CATEGORY_IDS = ['color', 'rideHeight'] as const satisfies readonly CarCategoryId[]

const TIRE_COLOR = '#2f3438'
const CHROME_COLOR = '#d5dbe1'

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

/** タイヤ外側の面へ飾りだけを足す種類。タイヤ本体の作りは共通。 */
type WheelFaceDetail = 'whitewall' | 'flower' | 'star' | 'rainbow'

type WheelVisual = {
  hubColor: string
  hubRadiusRatio: number
  detail: 'standard' | 'offroad' | 'racing' | WheelFaceDetail
}

/** にじいろタイヤの並び。虹と同じ順に一周させる。 */
const RAINBOW_COLORS = ['#ef4d4d', '#f59f00', '#ffd43b', '#51cf66', '#3d7bf5', '#8256c7'] as const

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
  rimRing.position.set(wheel.position.x + wheel.side * wheel.width * 0.51, wheel.position.y, wheel.position.z)
  rimRing.castShadow = true

  const centerCap = new THREE.Mesh(
    new THREE.SphereGeometry(wheel.radius * (namePrefix === 'car-racing' ? 0.14 : 0.17), 12, 8),
    hubMaterial,
  )
  centerCap.name = `${namePrefix}-center-cap-${wheel.id}`
  centerCap.position.set(wheel.position.x + wheel.side * wheel.width * 0.51, wheel.position.y, wheel.position.z)
  centerCap.castShadow = true

  // 外側の面に短いスポークを置き、レーシングはリムを大きくしてスポーツカー以外でも判別できるようにする。
  const spokeFaceX = wheel.position.x + wheel.side * (wheel.width * 0.51)
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

/**
 * タイヤ外側の面へ飾りを足す。ホイールの中心・半径・厚みはすべて attachment 由来で、
 * 種類ごとの違いはこの関数の中だけに閉じる。
 */
function addWheelFace(
  group: THREE.Group,
  wheel: CarAttachments['wheels'][number],
  detail: WheelFaceDetail,
): void {
  const faceX = wheel.position.x + wheel.side * wheel.width * 0.55
  if (detail === 'whitewall') {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(wheel.radius * 0.58, wheel.radius * 0.85, 24),
      standard('#fff7e6', 0.7),
    )
    ring.name = `car-whitewall-ring-${wheel.id}`
    ring.rotation.y = wheel.side * Math.PI / 2
    ring.position.set(faceX, wheel.position.y, wheel.position.z)
    group.add(ring)
    return
  }
  if (detail === 'flower') {
    const petals = standard('#f48fb1', 0.45)
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3
      const petal = new THREE.Mesh(new THREE.SphereGeometry(wheel.radius * 0.21, 10, 6), petals)
      petal.name = `car-flower-petal-${wheel.id}-${index}`
      petal.scale.x = 0.2
      petal.position.set(faceX, wheel.position.y + Math.cos(angle) * wheel.radius * 0.43,
        wheel.position.z + Math.sin(angle) * wheel.radius * 0.43)
      group.add(petal)
    }
    return
  }
  if (detail === 'star') {
    // ハブを小さくしてあるので（CAR_PART_BUILDERS）、面いっぱいの星がそのまま見える。
    const star = new THREE.Mesh(
      createStarGeometry(wheel.radius * 0.62),
      new THREE.MeshStandardMaterial({ color: '#ffd43b', roughness: 0.38, side: THREE.DoubleSide }),
    )
    star.name = `car-star-face-${wheel.id}`
    star.rotation.y = wheel.side * Math.PI / 2
    // ハブの外端より確実に外側へ置き、面が重なってちらつかないようにする。
    star.position.set(wheel.position.x + wheel.side * wheel.width * 0.62, wheel.position.y, wheel.position.z)
    star.castShadow = true
    group.add(star)
    return
  }
  RAINBOW_COLORS.forEach((color, index) => {
    const angle = (index * Math.PI * 2) / RAINBOW_COLORS.length
    const segment = box(
      { x: wheel.width * 0.14, y: wheel.radius * 0.66, z: wheel.radius * 0.28 },
      {
        x: wheel.position.x + wheel.side * wheel.width * 0.56,
        y: wheel.position.y + Math.cos(angle) * wheel.radius * 0.42,
        z: wheel.position.z + Math.sin(angle) * wheel.radius * 0.42,
      },
      standard(color, 0.42),
    )
    segment.name = `car-rainbow-segment-${wheel.id}-${index}`
    segment.rotation.x = angle
    group.add(segment)
  })
}

/**
 * 1輪ぶんの部品をまとめる軸グループの名前。
 * 走行画面（useCarDriveScene）はこの名前でグループを引き、X軸まわりに回してタイヤを転がす。
 */
export function carWheelPivotName(id: CarWheelAttachmentId): string {
  return `car-wheel-${id}`
}

function buildWheels(visual: WheelVisual) {
  return ({ attachments, config }: CarPartContext): THREE.Object3D => {
    const group = new THREE.Group()
    group.name = 'car-wheels'
    const tireMaterial = standard(TIRE_COLOR, 0.85, 0)
    const hubMaterial = standard(visual.hubColor, 0.35, 0.2)
    const treadMaterial = standard('#24282c', 0.92, 0)
    const sportsWheel = config.body === 'sportsCar'

    for (const wheel of attachments.wheels) {
      // タイヤの中心位置は attachment 由来。サイズは寸法基盤から、見た目の差はvisual定義から決まる。
      // 車軸を原点とするグループへ部品を入れ、位置はグループ側だけが持つ。こうすると
      // 飾り（おはな・ほし・にじいろ・オフロードのブロック）も含めて1か所回すだけで転がる。
      const pivot = new THREE.Group()
      pivot.name = carWheelPivotName(wheel.id)
      pivot.position.set(wheel.position.x, wheel.position.y, wheel.position.z)
      const axle: CarWheelAttachment = { ...wheel, position: { x: 0, y: 0, z: 0 } }

      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wheel.radius, wheel.radius, wheel.width, 24),
        tireMaterial,
      )
      tire.name = `car-wheel-tire-${wheel.id}`
      tire.rotation.z = Math.PI / 2
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
      pivot.add(tire, hub)

      if (visual.detail === 'offroad') {
        addOffroadTread(pivot, axle, treadMaterial)
      } else if (visual.detail === 'racing') {
        addPerformanceRim(pivot, axle, hubMaterial, 'car-racing')
      } else if (visual.detail === 'standard') {
        if (sportsWheel) addPerformanceRim(pivot, axle, hubMaterial, 'car-sports')
      } else {
        addWheelFace(pivot, axle, visual.detail)
      }
      group.add(pivot)
    }
    return group
  }
}

/** フロント種類ごとの、中央マスクとバンパーの見た目。選択肢を足すときはこの表に1行足す。 */
type FrontTrim = {
  /** 中央マスクの色。にこにこでは口の色。 */
  maskColor: string
  bumperColor: string
  /** 角ばったマスクの幅・高さ比。にこにこは弧の口を置くため参照しない。 */
  maskWidthRatio: number
  maskHeightRatio: number
  bumperWidthRatio: number
}

const FRONT_TRIMS: Record<FrontType, FrontTrim> = {
  round: { maskColor: '#303943', bumperColor: CHROME_COLOR, maskWidthRatio: 0.42, maskHeightRatio: 0.17, bumperWidthRatio: 0.92 },
  square: { maskColor: '#202830', bumperColor: '#65717d', maskWidthRatio: 0.5, maskHeightRatio: 0.22, bumperWidthRatio: 0.92 },
  slim: { maskColor: '#172027', bumperColor: '#252d35', maskWidthRatio: 0.62, maskHeightRatio: 0.12, bumperWidthRatio: 0.86 },
  twin: { maskColor: '#172027', bumperColor: '#252d35', maskWidthRatio: 0.62, maskHeightRatio: 0.12, bumperWidthRatio: 0.92 },
  smile: { maskColor: '#b4404f', bumperColor: CHROME_COLOR, maskWidthRatio: 0.5, maskHeightRatio: 0.2, bumperWidthRatio: 0.92 },
}

/**
 * ライト1灯の大きさ。元GLBのライト開口部があればその実測値から、無ければ共通の目安から決める。
 * 丸い形（丸・よつめ・にこにこ）は縦横を同じにして真円にする。
 */
function frontLightSize(
  shape: FrontType,
  aperture: { width: number; height: number } | null,
  fallback: number,
): { width: number; height: number } {
  if (aperture !== null) {
    switch (shape) {
      case 'round': {
        const size = Math.min(aperture.width * 0.52, aperture.height * 0.84)
        return { width: size, height: size }
      }
      case 'twin': {
        const size = Math.min(aperture.width * 0.28, aperture.height * 0.62)
        return { width: size, height: size }
      }
      case 'smile': {
        const size = Math.min(aperture.width * 1.05, aperture.height * 1.6)
        return { width: size, height: size }
      }
      case 'square':
        return { width: aperture.width * 0.86, height: aperture.height * 0.7 }
      case 'slim':
        return { width: aperture.width * 0.92, height: aperture.height * 0.38 }
    }
  }
  switch (shape) {
    case 'round': {
      const size = fallback * 0.9
      return { width: size, height: size }
    }
    case 'twin':
      return { width: fallback, height: fallback }
    case 'smile': {
      const size = fallback * 1.35
      return { width: size, height: size }
    }
    case 'square':
      return { width: fallback * 1.5, height: fallback * 0.7 }
    case 'slim':
      return { width: fallback * 2.2, height: fallback * 0.28 }
  }
}

function buildFront(shape: FrontType) {
  return ({ attachments, dimensions, headlightMount, surface }: CarPartContext): THREE.Object3D => {
    const front = attachments.front
    const group = new THREE.Group()
    group.name = 'car-front'
    // にこにこは目に見せたいので、電球色ではなく白目の色にする。
    const lightMaterial = standard(shape === 'smile' ? '#fdfbf3' : '#fff3c4', 0.2, 0.1)
    const pupilMaterial = standard('#25313d', 0.3, 0.1)
    const trim = FRONT_TRIMS[shape]

    const rounded = shape === 'round' || shape === 'twin' || shape === 'smile'
    const fallbackLightSize = front.size.extent * 0.34 * (shape === 'twin' ? 0.7 : 1)
    const lightDepth = 0.1
    const surroundMaterial = standard(shape === 'round' || shape === 'smile' ? CHROME_COLOR : '#3f4b57', 0.32, 0.35)
    for (const side of [1, -1]) {
      const mount = side === 1 ? headlightMount?.left : headlightMount?.right
      const apertureWidth = mount?.size.x ?? 0
      const apertureHeight = mount?.size.y ?? 0
      const lightSize = frontLightSize(
        shape,
        mount ? { width: apertureWidth, height: apertureHeight } : null,
        fallbackLightSize,
      )
      const lightWidth = lightSize.width
      const lightHeight = lightSize.height
      const baseX = mount?.position.x ?? side * front.size.width * (shape === 'slim' ? 0.3 : 0.32)
      const baseY = mount?.position.y !== undefined
        ? mount.position.y + dimensions.bodyLift
        : front.position.y + front.size.extent * 0.16

      // 元ライトを隠したあとに残るくぼみを、実測した開口部と同じ位置・大きさのハウジングで覆う。
      if (mount) {
        const coverCenter = offsetFrom(front, lightDepth * 0.22)
        const cover = box(
          { x: apertureWidth * 1.06, y: apertureHeight * 1.1, z: lightDepth * 0.55 },
          { x: baseX, y: baseY, z: coverCenter.z },
          surroundMaterial,
        )
        cover.name = `car-front-cutout-cover-${side === 1 ? 'left' : 'right'}`
        group.add(cover)
      }

      for (const lampOffset of (shape === 'twin' ? [-1, 1] : [0])) {
        const center = offsetFrom(front, lightDepth / 2)
        const position = {
          x: baseX + lampOffset * (mount ? apertureWidth * 0.22 : fallbackLightSize * 0.58),
          y: baseY,
          z: center.z,
        }

        if (rounded) {
          const surround = new THREE.Mesh(
            new THREE.TorusGeometry(lightWidth * 0.42, lightWidth * 0.08, 8, 20),
            surroundMaterial,
          )
          surround.name = `car-front-surround-${shape}-${side === 1 ? 'left' : 'right'}${shape === 'twin' ? `-${lampOffset}` : ''}`
          surround.position.set(position.x, position.y, position.z)
          surround.castShadow = true
          const light = new THREE.Mesh(new THREE.SphereGeometry(lightWidth * 0.42, 16, 12), lightMaterial)
          light.name = `car-front-light-${shape}-${side === 1 ? 'left' : 'right'}${shape === 'twin' ? `-${lampOffset}` : ''}`
          light.position.set(position.x, position.y, position.z)
          // 前面の丸さは保ちつつ、ライト本体が車体の前端から出すぎないよう奥行きを薄くする。
          light.scale.set(1, 1, 0.62)
          light.rotation.z = side * -0.08
          light.castShadow = true
          group.add(surround, light)
          if (shape === 'smile') {
            // 黒目は目の子にして、目の位置・向きへそのまま追従させる。
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(lightWidth * 0.17, 12, 10), pupilMaterial)
            pupil.name = `car-front-pupil-${side === 1 ? 'left' : 'right'}`
            pupil.position.set(0, lightWidth * 0.04, lightWidth * 0.3)
            pupil.castShadow = true
            light.add(pupil)
          }
        } else {
          const surroundPadding = mount ? Math.min(apertureWidth, apertureHeight) * 0.12 : fallbackLightSize * 0.18
          const surround = box(
            { x: lightWidth + surroundPadding, y: lightHeight + surroundPadding, z: lightDepth * 0.72 },
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
    }

    // ライトだけでなく、中央のマスクと下端のバンパーも選択肢ごとに変える。
    const grilleMaterial = standard(trim.maskColor, 0.5, 0.12)
    const bumperMaterial = standard(trim.bumperColor, 0.35, 0.35)
    const grilleCenter = offsetFrom(front, 0.055)
    if (shape === 'smile') {
      // 口はバンパーへ当たらない大きさに収め、どの車種でも地面より上に出るようにする。
      const mouthRadius = Math.min(front.size.extent * 0.34, front.size.width * 0.22)
      const mouth = new THREE.Mesh(
        new THREE.TorusGeometry(mouthRadius, mouthRadius * 0.18, 8, 20, Math.PI),
        grilleMaterial,
      )
      mouth.name = 'car-front-grille-smile'
      // 上向きの弧を半回転させて、口角の上がった笑顔にする。縦につぶして横長の口にする。
      mouth.rotation.z = Math.PI
      mouth.scale.y = 0.62
      mouth.position.set(0, grilleCenter.y, grilleCenter.z)
      mouth.castShadow = true
      group.add(mouth)
    } else {
      const grille = box(
        { x: front.size.width * trim.maskWidthRatio, y: front.size.extent * trim.maskHeightRatio, z: 0.08 },
        { x: 0, y: grilleCenter.y - front.size.extent * 0.28, z: grilleCenter.z },
        grilleMaterial,
      )
      grille.name = `car-front-grille-${shape}`
      group.add(grille)
    }

    const bumperCenter = offsetFrom(front, 0.08)
    const bumper = box(
      { x: front.size.width * trim.bumperWidthRatio, y: front.size.extent * 0.14, z: 0.12 },
      { x: 0, y: bumperCenter.y - front.size.extent * 0.34, z: bumperCenter.z },
      bumperMaterial,
    )
    bumper.name = `car-front-bumper-${shape}`
    group.add(bumper)
    // Fit each housing at its own height and lateral position, not the bounding box front.
    for (const child of group.children) {
      const point = new THREE.Vector3(child.position.x, child.position.y, front.position.z)
      const mounted = surface?.(point, new THREE.Vector3(0, 0, 1)) ?? point
      child.position.z += mounted.z - front.position.z - 0.035
    }
    return group
  }
}

/** ルーフ天面の取り付け基準を、読み込み済み車体の実際の屋根の高さへ合わせ直す。 */
function mountedRoof({ attachments, surface }: CarPartContext): CarAttachment {
  const roof = attachments.roof
  const point = new THREE.Vector3(roof.position.x, roof.position.y, roof.position.z)
  return { ...roof, position: surface?.(point, new THREE.Vector3(0, 1, 0)) ?? point }
}

function buildRoofPoliceLight(context: CarPartContext): THREE.Object3D {
  const roof = mountedRoof(context)
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

function buildRoofLuggage(context: CarPartContext): THREE.Object3D {
  const roof = mountedRoof(context)
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

function buildRoofSpoiler(context: CarPartContext): THREE.Object3D {
  const roof = mountedRoof(context)
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
    const foot = new THREE.Vector3(support.position.x, roof.position.y, wingZ)
    const footY = context.surface?.(foot, new THREE.Vector3(0, 1, 0)).y ?? foot.y
    const topY = roof.position.y + supportHeight
    const legHeight = Math.max(0.02, topY - footY + 0.01)
    support.scale.y = legHeight / supportHeight
    support.position.y = topY - legHeight / 2
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

function buildRoofCrown(context: CarPartContext): THREE.Object3D {
  const roof = mountedRoof(context)
  const group = new THREE.Group()
  group.name = 'car-roof'
  const goldMaterial = standard('#f2c14a', 0.28, 0.5)
  const jewelMaterial = standard('#e0447a', 0.22, 0.25)
  const radius = Math.min(Math.max(roof.size.width * 0.26, 0.22), 0.44)
  const bandHeight = 0.13
  const pointHeight = 0.19

  // 台座は屋根の実面にぴたりと乗せる（高さの基準は mountedRoof が返す位置だけ）。
  const band = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, bandHeight, 16), goldMaterial)
  band.name = 'car-roof-crown-base'
  band.position.set(roof.position.x, roof.position.y + bandHeight / 2, roof.position.z)
  band.castShadow = true
  group.add(band)

  for (let index = 0; index < 5; index += 1) {
    const angle = (index * Math.PI * 2) / 5
    const x = roof.position.x + Math.cos(angle) * radius * 0.76
    const z = roof.position.z + Math.sin(angle) * radius * 0.76
    const point = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.26, pointHeight, 8), goldMaterial)
    point.name = `car-roof-crown-point-${index}`
    point.position.set(x, roof.position.y + bandHeight + pointHeight / 2, z)
    point.castShadow = true
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.14, 10, 8), jewelMaterial)
    jewel.name = `car-roof-crown-jewel-${index}`
    jewel.position.set(x, roof.position.y + bandHeight + pointHeight + radius * 0.07, z)
    jewel.castShadow = true
    group.add(point, jewel)
  }
  return group
}

function buildRoofIceCream(context: CarPartContext): THREE.Object3D {
  const roof = mountedRoof(context)
  const group = new THREE.Group()
  group.name = 'car-roof'
  const holderMaterial = standard('#c9d2da', 0.38, 0.3)
  const coneMaterial = standard('#e0a15c', 0.6, 0.02)
  const cherryMaterial = standard('#e0443f', 0.3)
  // 車種によって屋根の広さが違うので、全体の大きさを1つの倍率から決めて形を崩さない。
  const size = Math.min(Math.max(roof.size.width * 0.38, 0.3), 0.55)
  const holderHeight = 0.04
  const baseY = roof.position.y + holderHeight

  const holder = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.32, size * 0.36, holderHeight, 14),
    holderMaterial,
  )
  holder.name = 'car-roof-icecream-base'
  holder.position.set(roof.position.x, roof.position.y + holderHeight / 2, roof.position.z)
  holder.castShadow = true

  const cone = new THREE.Mesh(new THREE.ConeGeometry(size * 0.26, size * 0.6, 12), coneMaterial)
  cone.name = 'car-roof-icecream-cone'
  // コーンは先を下へ向け、台座に立てた見た目にする。
  cone.rotation.z = Math.PI
  cone.position.set(roof.position.x, baseY + size * 0.3, roof.position.z)
  cone.castShadow = true
  group.add(holder, cone)

  const scoops = [
    { color: '#fff1e0', radius: size * 0.28, y: baseY + size * 0.62 },
    { color: '#f7a8c4', radius: size * 0.22, y: baseY + size * 0.92 },
  ]
  scoops.forEach((scoop, index) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(scoop.radius, 14, 10), standard(scoop.color, 0.5))
    mesh.name = `car-roof-icecream-scoop-${index}`
    mesh.position.set(roof.position.x, scoop.y, roof.position.z)
    mesh.castShadow = true
    group.add(mesh)
  })

  const cherry = new THREE.Mesh(new THREE.SphereGeometry(size * 0.09, 10, 8), cherryMaterial)
  cherry.name = 'car-roof-icecream-cherry'
  cherry.position.set(roof.position.x, baseY + size * 1.18, roof.position.z)
  cherry.castShadow = true
  group.add(cherry)
  return group
}

/** Roof toys sit on a rail with feet sampled separately on the real shell. */
function buildRoofToy(kind: 'rabbit' | 'surfboard'): CarPartBuilder {
  return ({ attachments, surface }) => {
    const roof = attachments.roof
    const group = new THREE.Group()
    group.name = 'car-roof'
    const width = Math.min(roof.size.width * 0.62, 1.1)
    const depth = Math.min(roof.size.extent * 0.35, 0.65)
    const feet = [-1, 1].flatMap((x) => [-1, 1].map((z) => {
      const point = new THREE.Vector3(x * width * 0.4, roof.position.y, roof.position.z + z * depth * 0.4)
      return surface?.(point, new THREE.Vector3(0, 1, 0)) ?? point
    }))
    const top = Math.max(...feet.map((point) => point.y)) + 0.08
    const railMaterial = standard('#334155', 0.5)
    feet.forEach((point, index) => {
      const height = top - point.y
      const foot = box({ x: 0.08, y: height, z: 0.08 },
        { x: point.x, y: point.y + height / 2, z: point.z }, railMaterial)
      foot.name = `car-roof-${kind}-support-${index}`
      group.add(foot)
    })
    group.add(box({ x: width, y: 0.05, z: depth }, { x: 0, y: top + 0.025, z: roof.position.z }, railMaterial))
    if (kind === 'rabbit') {
      const white = standard('#fff4eb', 0.65)
      const pink = standard('#f38cac', 0.6)
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), white)
        ear.name = `car-roof-rabbit-ear-${side}`
        ear.scale.set(width * 0.15, 0.31, 0.095)
        ear.position.set(side * width * 0.28, top + 0.34, roof.position.z)
        const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), pink)
        inner.scale.set(width * 0.085, 0.23, 0.035)
        inner.position.copy(ear.position).add(new THREE.Vector3(0, 0.025, 0.075))
        group.add(ear, inner)
      }
    } else {
      const boardLength = Math.min(roof.size.extent * 0.85, 2.5)
      const board = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), standard('#27c7ce', 0.4))
      board.name = 'car-roof-surfboard'
      board.scale.set(width * 0.46, 0.07, boardLength / 2)
      board.position.set(0, top + 0.12, roof.position.z)
      group.add(board)
      for (const z of [-1, 1]) {
        group.add(box({ x: width * 0.68, y: 0.025, z: 0.075 },
          { x: 0, y: top + 0.185, z: roof.position.z + z * boardLength * 0.2 }, standard('#ffd43b')))
      }
    }
    return group
  }
}

function buildPatternDecoration(kind: 'hearts' | 'checker'): CarPartBuilder {
  return (context) => {
    const group = new THREE.Group()
    group.name = 'car-decoration'
    const size = context.dimensions.hullHeight * 0.18
    const dark = standard(kind === 'hearts' ? '#f0598f' : '#25313d')
    const light = standard('#fff5eb')
    for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
      for (let column = 0; column < (kind === 'hearts' ? 3 : 6); column++) {
        if (kind === 'hearts') {
          const z = (column - 1) * context.dimensions.length * 0.15
          group.add(sideStickerMesh(createHeartGeometry(size * 1.5), light, context, side, z, 0.3, 0.019))
          group.add(sideStickerMesh(createHeartGeometry(size * 1.2), dark, context, side, z, 0.3, 0.029))
        } else {
          for (let row = 0; row < 2; row++) {
            group.add(sideStickerMesh(new THREE.PlaneGeometry(size, size), (row + column) % 2 ? dark : light,
              context, side, (column - 2.5) * size, 0.3 + (row - 0.5) * 0.225))
          }
        }
      }
    }
    return group
  }
}

function createFlowerGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  for (let index = 0; index <= 96; index++) {
    const angle = index * Math.PI * 2 / 96
    const radius = size * (0.42 + 0.14 * Math.cos(angle * 6))
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createMoonGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(size * 0.18, size * 0.52)
  shape.bezierCurveTo(-size * 0.65, size * 0.55, -size * 0.65, -size * 0.55, size * 0.18, -size * 0.52)
  shape.bezierCurveTo(-size * 0.23, -size * 0.25, -size * 0.23, size * 0.25, size * 0.18, size * 0.52)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
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

/**
 * 虹の帯を1本ぶん作る。`index` が大きいほど内側の細い帯になり、
 * 全部を同じ中心へ重ねると1本の虹になる。
 */
function createRainbowBandGeometry(size: number, index: number, count: number): THREE.ShapeGeometry {
  const bandWidth = size / (count + 1.6)
  const outer = size - index * bandWidth
  const inner = outer - bandWidth
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outer, 0, Math.PI, false)
  shape.lineTo(-inner, 0)
  shape.absarc(0, 0, inner, Math.PI, 0, true)
  shape.closePath()
  return new THREE.ShapeGeometry(shape, 24)
}

/** にくきゅう（肉球）。大きい肉球1つと指4つを1つのgeometryにまとめる。 */
function createPawGeometry(size: number): THREE.ShapeGeometry {
  const pad = new THREE.Shape()
  pad.absellipse(0, -size * 0.2, size * 0.44, size * 0.34, 0, Math.PI * 2, false, 0)
  const toes = [
    { x: -0.4, y: 0.16, radius: 0.15 },
    { x: -0.14, y: 0.4, radius: 0.16 },
    { x: 0.14, y: 0.4, radius: 0.16 },
    { x: 0.4, y: 0.16, radius: 0.15 },
  ].map((toe) => {
    const shape = new THREE.Shape()
    shape.absellipse(toe.x * size, toe.y * size, toe.radius * size, toe.radius * size * 1.15, 0, Math.PI * 2, false, 0)
    return shape
  })
  return new THREE.ShapeGeometry([pad, ...toes], 14)
}

type SideStickerSurface = {
  position: THREE.Vector3
  normal: THREE.Vector3
}

/**
 * 側面ステッカーの貼り付け面を求める。
 * 読み込み済みGLBの側面へ投影し、最大車幅からの浮きを防ぐ。
 */
function sideStickerSurface(
  context: CarPartContext,
  side: CarAttachment,
  z: number,
  u: number,
): SideStickerSurface {
  const point = new THREE.Vector3(
    side.position.x,
    context.dimensions.bodyFloorY + context.dimensions.hullHeight * (0.48 + (u - 0.3) * 0.8),
    side.position.z + z,
  )
  const normal = new THREE.Vector3(side.normal.x, side.normal.y, side.normal.z).normalize()
  const position = context.surface?.(point, normal) ?? point
  if (context.surface) {
    const above = context.surface(point.clone().add(new THREE.Vector3(0, 0.02, 0)), normal)
    const ahead = context.surface(point.clone().add(new THREE.Vector3(0, 0, 0.02)), normal)
    const tangentY = above.sub(position)
    const tangentZ = ahead.sub(position)
    normal.copy(tangentY.cross(tangentZ).normalize()).multiplyScalar(side.normal.x)
  }
  return { position, normal }
}

/** 平面の横軸を車の前後、縦軸を車体断面の接線へ合わせる。 */
function placeSideSticker(
  mesh: THREE.Mesh,
  surface: SideStickerSurface,
  distance: number,
): void {
  const normal = surface.normal.clone().normalize()
  const horizontal = new THREE.Vector3(0, 1, 0).cross(normal).normalize()
  const vertical = normal.clone().cross(horizontal).normalize()
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
  placeSideSticker(mesh, sideStickerSurface(context, side, z, u), distance)
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

function buildRainbowDecoration(context: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const size = context.dimensions.hullHeight * 0.44
  const bands = RAINBOW_COLORS.map((color, index) => ({
    geometry: createRainbowBandGeometry(size, index, RAINBOW_COLORS.length),
    material: new THREE.MeshStandardMaterial({ color, roughness: 0.4, side: THREE.DoubleSide }),
  }))

  for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
    for (const offset of [-0.15, 0.15]) {
      for (const band of bands) {
        // 帯どうしは重ならないので、同じ高さへ並べても互いにちらつかない。
        group.add(
          sideStickerMesh(band.geometry, band.material, context, side, context.dimensions.length * offset, 0.06, 0.024),
        )
      }
    }
  }
  return group
}

function buildPawDecoration(context: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-decoration'
  const outlineMaterial = new THREE.MeshStandardMaterial({ color: '#fff5eb', roughness: 0.42, side: THREE.DoubleSide })
  const material = new THREE.MeshStandardMaterial({ color: '#f0598f', roughness: 0.4, side: THREE.DoubleSide })
  const size = context.dimensions.hullHeight * 0.3
  const outlineGeometry = createPawGeometry(size * 1.22)
  const geometry = createPawGeometry(size)
  // 高さを交互にずらして、足あとが歩いているように見せる。
  const steps = [
    { offset: -0.17, u: 0.22 },
    { offset: 0, u: 0.37 },
    { offset: 0.17, u: 0.22 },
  ]

  for (const side of [context.attachments.sideLeft, context.attachments.sideRight]) {
    for (const step of steps) {
      const z = context.dimensions.length * step.offset
      group.add(
        sideStickerMesh(outlineGeometry, outlineMaterial, context, side, z, step.u, 0.019),
        sideStickerMesh(geometry, material, context, side, z, step.u, 0.029),
      )
    }
  }
  return group
}

function createHeartGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, -size * 0.58)
  shape.bezierCurveTo(-size * 0.18, -size * 0.38, -size * 0.62, -size * 0.1, -size * 0.52, size * 0.24)
  shape.bezierCurveTo(-size * 0.45, size * 0.52, -size * 0.14, size * 0.58, 0, size * 0.3)
  shape.bezierCurveTo(size * 0.14, size * 0.58, size * 0.45, size * 0.52, size * 0.52, size * 0.24)
  shape.bezierCurveTo(size * 0.62, -size * 0.1, size * 0.18, -size * 0.38, 0, -size * 0.58)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createLightningGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-size * 0.12, size * 0.58)
  shape.lineTo(size * 0.36, size * 0.06)
  shape.lineTo(size * 0.05, size * 0.06)
  shape.lineTo(size * 0.18, -size * 0.58)
  shape.lineTo(-size * 0.36, -size * 0.02)
  shape.lineTo(-size * 0.05, -size * 0.02)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createCrownGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-size * 0.54, -size * 0.42)
  shape.lineTo(-size * 0.46, size * 0.38)
  shape.lineTo(-size * 0.17, size * 0.08)
  shape.lineTo(0, size * 0.46)
  shape.lineTo(size * 0.17, size * 0.08)
  shape.lineTo(size * 0.46, size * 0.38)
  shape.lineTo(size * 0.54, -size * 0.42)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createAnimalGeometry(size: number): THREE.ShapeGeometry {
  // 動物系の初期マークは、幼児にも識別しやすいネコの顔にする。
  const shape = new THREE.Shape()
  shape.moveTo(-size * 0.52, -size * 0.34)
  shape.lineTo(-size * 0.5, size * 0.42)
  shape.lineTo(-size * 0.2, size * 0.25)
  shape.quadraticCurveTo(0, size * 0.42, size * 0.2, size * 0.25)
  shape.lineTo(size * 0.5, size * 0.42)
  shape.lineTo(size * 0.52, -size * 0.34)
  shape.quadraticCurveTo(size * 0.42, -size * 0.58, 0, -size * 0.58)
  shape.quadraticCurveTo(-size * 0.42, -size * 0.58, -size * 0.52, -size * 0.34)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createRocketGeometry(size: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, size)
  shape.quadraticCurveTo(size * 0.45, size * 0.5, size * 0.4, size * 0.05)
  shape.lineTo(size * 0.4, -size * 0.35)
  shape.lineTo(size * 0.82, -size * 0.85)
  shape.lineTo(size * 0.22, -size * 0.72)
  shape.lineTo(size * 0.22, -size * 0.98)
  shape.lineTo(-size * 0.22, -size * 0.98)
  shape.lineTo(-size * 0.22, -size * 0.72)
  shape.lineTo(-size * 0.82, -size * 0.85)
  shape.lineTo(-size * 0.4, -size * 0.35)
  shape.lineTo(-size * 0.4, size * 0.05)
  shape.quadraticCurveTo(-size * 0.45, size * 0.5, 0, size)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

function createDinosaurGeometry(size: number): THREE.ShapeGeometry {
  // 首と尾の長い草食恐竜のかたち。輪郭だけで恐竜と分かるよう、
  // 丸い胴・持ち上げた尾・太めの首を大きく取る。
  const shape = new THREE.Shape()
  shape.moveTo(-size, size * 0.52)
  shape.quadraticCurveTo(-size * 0.8, size * 0.3, -size * 0.5, size * 0.18)
  shape.quadraticCurveTo(-size * 0.15, size * 0.45, size * 0.15, size * 0.3)
  shape.quadraticCurveTo(size * 0.3, size * 0.45, size * 0.42, size * 0.72)
  shape.quadraticCurveTo(size * 0.5, size * 0.95, size * 0.78, size * 0.9)
  shape.quadraticCurveTo(size * 0.98, size * 0.85, size * 0.92, size * 0.62)
  shape.quadraticCurveTo(size * 0.85, size * 0.52, size * 0.68, size * 0.52)
  shape.quadraticCurveTo(size * 0.6, size * 0.35, size * 0.52, size * 0.05)
  shape.lineTo(size * 0.5, -size * 0.5)
  shape.lineTo(size * 0.24, -size * 0.5)
  shape.lineTo(size * 0.24, -size * 0.15)
  shape.lineTo(-size * 0.18, -size * 0.15)
  shape.lineTo(-size * 0.18, -size * 0.5)
  shape.lineTo(-size * 0.44, -size * 0.5)
  shape.lineTo(-size * 0.44, -size * 0.1)
  shape.quadraticCurveTo(-size * 0.7, -size * 0.05, -size * 0.82, size * 0.12)
  shape.quadraticCurveTo(-size * 0.95, size * 0.3, -size, size * 0.52)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
}

type MarkIconType = CarMarkIcon

function markNumber(mark: MarkType): number | null {
  if (!mark.startsWith('number')) return null
  const value = Number(mark.slice('number'.length))
  return Number.isInteger(value) && value >= 1 && value <= 9 ? value : null
}

function createMarkIconGeometry(mark: MarkIconType, size: number): THREE.ShapeGeometry {
  switch (mark) {
    case 'star':
      return createStarGeometry(size)
    case 'heart':
      return createHeartGeometry(size)
    case 'lightning':
      return createLightningGeometry(size)
    case 'crown':
      return createCrownGeometry(size)
    case 'animal':
      return createAnimalGeometry(size)
    case 'flower':
      return createFlowerGeometry(size)
    case 'moon':
      return createMoonGeometry(size)
    case 'rocket':
      return createRocketGeometry(size)
    case 'dinosaur':
      return createDinosaurGeometry(size)
  }
}

const NUMBER_SEGMENTS: Record<number, readonly string[]> = {
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
}

function addNumberMark(
  group: THREE.Group,
  value: number,
  width: number,
  height: number,
  material: THREE.Material,
): void {
  const thickness = Math.min(width * 0.22, height * 0.14)
  const verticalHeight = (height - thickness * 3) / 2
  const segments: Record<string, { x: number; y: number; width: number; height: number }> = {
    a: { x: 0, y: height / 2 - thickness / 2, width, height: thickness },
    b: { x: width / 2 - thickness / 2, y: thickness / 2 + verticalHeight / 2, width: thickness, height: verticalHeight },
    c: { x: width / 2 - thickness / 2, y: -thickness / 2 - verticalHeight / 2, width: thickness, height: verticalHeight },
    d: { x: 0, y: -height / 2 + thickness / 2, width, height: thickness },
    e: { x: -width / 2 + thickness / 2, y: -thickness / 2 - verticalHeight / 2, width: thickness, height: verticalHeight },
    f: { x: -width / 2 + thickness / 2, y: thickness / 2 + verticalHeight / 2, width: thickness, height: verticalHeight },
    g: { x: 0, y: 0, width, height: thickness },
  }

  for (const segmentId of NUMBER_SEGMENTS[value] ?? []) {
    const segment = segments[segmentId]
    if (segment === undefined) continue
    const mesh = box(
      { x: segment.width, y: segment.height, z: 0.035 },
      { x: segment.x, y: segment.y, z: 0.035 },
      material,
    )
    mesh.name = `car-mark-number-${value}-${segmentId}`
    group.add(mesh)
  }
}

function addIconMark(
  group: THREE.Group,
  mark: MarkIconType,
  size: number,
  outlineMaterial: THREE.Material,
  markMaterial: THREE.Material,
): void {
  const outline = new THREE.Mesh(createMarkIconGeometry(mark, size * 1.16), outlineMaterial)
  outline.name = `car-mark-${mark}-outline`
  outline.position.z = 0.022
  outline.castShadow = true
  outline.receiveShadow = true

  const icon = new THREE.Mesh(createMarkIconGeometry(mark, size), markMaterial)
  icon.name = `car-mark-${mark}`
  icon.position.z = 0.045
  icon.castShadow = true
  icon.receiveShadow = true
  group.add(outline, icon)
}

function buildNumberPlate({ attachments, config, surface }: CarPartContext): THREE.Object3D {
  const group = new THREE.Group()
  group.name = 'car-mark'
  const plateMaterial = standard('#f8f9fa', 0.5)
  const plateBorderMaterial = standard('#25313d', 0.45, 0.1)
  const markMaterial = standard('#25313d', 0.4, 0.1)
  const markOutlineMaterial = standard('#25313d', 0.42, 0.1)
  const mark = config.mark
  const number = markNumber(mark)
  const iconColors: Record<MarkIconType, string> = {
    star: '#f59f00',
    heart: '#e64a4a',
    lightning: '#f08c00',
    crown: '#8256c7',
    animal: '#188a8a',
    flower: '#e95198',
    moon: '#f5bc32',
    rocket: '#4c6ef5',
    dinosaur: '#2f9e44',
  }

  for (const original of [attachments.front, attachments.rear]) {
    const point = new THREE.Vector3(original.position.x, original.position.y - original.size.extent * 0.04, original.position.z)
    const normal = new THREE.Vector3(original.normal.x, original.normal.y, original.normal.z)
    const mounted = surface?.(point, normal) ?? point
    const face = { ...original, position: { ...original.position, z: mounted.z - normal.z * 0.025 } }
    // 実車のナンバープレートに近い、車幅の3割ほどに収まる大きさ。
    // 以前は前面の半分近くを覆っていたので、数字・マークが読める範囲で小さくする。
    const plateWidth = Math.min(Math.max(face.size.width * 0.27, 0.46), 0.72)
    const plateHeight = Math.min(Math.max(face.size.extent * 0.28, 0.2), 0.28)
    const plateY = face.position.y - face.size.extent * 0.04
    const borderCenter = offsetFrom(face, 0.038)
    borderCenter.y = plateY
    const plateCenter = offsetFrom(face, 0.068)
    plateCenter.y = plateY
    group.add(
      box(
        { x: plateWidth + 0.06, y: plateHeight + 0.06, z: 0.045 },
        { x: borderCenter.x, y: borderCenter.y, z: borderCenter.z },
        plateBorderMaterial,
      ),
      box(
        { x: plateWidth, y: plateHeight, z: 0.045 },
        { x: plateCenter.x, y: plateCenter.y, z: plateCenter.z },
        plateMaterial,
      ),
    )

    const markAnchor = offsetFrom(face, 0.105)
    markAnchor.y = plateY
    const markGroup = new THREE.Group()
    markGroup.name = `car-mark-${mark}`
    markGroup.position.copy(markAnchor)
    // 前後どちらから見ても、数字や図形が外向きに正しく読める向きにする。
    markGroup.rotation.y = face.normal.z > 0 ? 0 : Math.PI

    if (number !== null) {
      // 数字は横に潰れないよう、幅をプレート高さからも抑える。
      addNumberMark(
        markGroup,
        number,
        Math.min(plateWidth * 0.42, plateHeight * 0.7),
        plateHeight * 0.8,
        markMaterial,
      )
    } else if (mark !== 'none') {
      addIconMark(
        markGroup,
        mark as MarkIconType,
        Math.min(plateHeight * 0.68, 0.27),
        markOutlineMaterial,
        new THREE.MeshStandardMaterial({ color: iconColors[mark as MarkIconType], roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide }),
      )
    }
    group.add(markGroup)
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
  wheel: {
    small: buildWheels({ hubColor: CHROME_COLOR, hubRadiusRatio: 0.45, detail: 'standard' }),
    big: buildWheels({ hubColor: '#ff922b', hubRadiusRatio: 0.5, detail: 'standard' }),
    offroad: buildWheels({ hubColor: '#c8873d', hubRadiusRatio: 0.42, detail: 'offroad' }),
    whitewall: buildWheels({ hubColor: CHROME_COLOR, hubRadiusRatio: 0.46, detail: 'whitewall' }),
    flower: buildWheels({ hubColor: '#ffd43b', hubRadiusRatio: 0.24, detail: 'flower' }),
    star: buildWheels({ hubColor: '#f08c00', hubRadiusRatio: 0.22, detail: 'star' }),
    rainbow: buildWheels({ hubColor: '#f8fafc', hubRadiusRatio: 0.3, detail: 'rainbow' }),
    racing: buildWheels({ hubColor: '#d83f45', hubRadiusRatio: 0.62, detail: 'racing' }),
  },
  front: {
    round: buildFront('round'),
    square: buildFront('square'),
    slim: buildFront('slim'),
    twin: buildFront('twin'),
    smile: buildFront('smile'),
  },
  roof: {
    none: nothing,
    policeLight: buildRoofPoliceLight,
    luggage: buildRoofLuggage,
    spoiler: buildRoofSpoiler,
    rabbit: buildRoofToy('rabbit'),
    surfboard: buildRoofToy('surfboard'),
    crown: buildRoofCrown,
    iceCream: buildRoofIceCream,
  },
  decoration: {
    none: nothing,
    star: buildStarDecoration,
    flame: buildFlameDecoration,
    stripes: buildStripesDecoration,
    dots: buildDotsDecoration,
    hearts: buildPatternDecoration('hearts'),
    checker: buildPatternDecoration('checker'),
    rainbow: buildRainbowDecoration,
    paw: buildPawDecoration,
  },
  mark: {
    none: nothing,
    number1: buildNumberPlate,
    number2: buildNumberPlate,
    number3: buildNumberPlate,
    number4: buildNumberPlate,
    number5: buildNumberPlate,
    number6: buildNumberPlate,
    number7: buildNumberPlate,
    number8: buildNumberPlate,
    number9: buildNumberPlate,
    star: buildNumberPlate,
    heart: buildNumberPlate,
    lightning: buildNumberPlate,
    crown: buildNumberPlate,
    animal: buildNumberPlate,
    flower: buildNumberPlate,
    moon: buildNumberPlate,
    rocket: buildNumberPlate,
    dinosaur: buildNumberPlate,
  },
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
