/**
 * 「3Dクルマづくり」で使う車体（Quaternius製CC0モデル）のカタログ。
 *
 * three.jsに依存しない純粋なデータなので、UI・寸法計算・テストがここを共通の
 * 正として参照できる。数値はすべて `scripts/build-car-builder-models.py` が
 * 書き出したGLBからの実測値で、手で目分量の値を入れてはいけない
 * （GLBを作り直したら、スクリプトの `--metrics` 出力で更新する）。
 *
 * 座標系はGLBと同じ「地面 y=0 / 前が +Z / 原点は車体の左右・前後中心」。
 * `carDimensions.ts` の約束とそのまま一致するため、読み込み後の回転・
 * スケール補正は不要。
 */

/** 採用車種。GLBのファイル名（kebab-case）とは別に、コード上のIDはcamelCaseで持つ。 */
export type CarVehicleId = 'sportsCar' | 'car' | 'suv' | 'taxi' | 'policeCar' | 'schoolBus' | 'ambulance'

/**
 * GLB内のマテリアル名。ビルドスクリプトが役割の分かる名前へ付け替えているので、
 * ゲーム側はこの名前だけを見ればよく、元Packごとの命名差を意識しなくてよい。
 *
 * - `Body` / `BodyLower` … ボディカラーを反映する塗装面
 * - `Accent` … パトカーの白帯・救急車の赤帯のように、塗り替えると車種が分からなくなる面
 * - `Sign*` … タクシーのルーフサイン
 * - `PoliceLight*` … パトカー内蔵のパトランプ
 */
export type CarMaterialRole =
  | 'Body'
  | 'BodyLower'
  | 'Accent'
  | 'Glass'
  | 'Trim'
  | 'TrimDark'
  | 'LightFront'
  | 'LightRear'
  | 'SignPlate'
  | 'SignText'
  | 'PoliceLightBar'
  | 'PoliceLightBlue'
  | 'PoliceLightWhite'
  | 'PoliceLightRed'

/** ボディカラーをそのまま反映するマテリアル。 */
export const CAR_BODY_MATERIAL: CarMaterialRole = 'Body'
/** ボディカラーを暗くして反映する下部パネル。 */
export const CAR_BODY_LOWER_MATERIAL: CarMaterialRole = 'BodyLower'
/** 車体内蔵のヘッドライト。ゲーム側のフロントライトと二重にしないために使う。 */
export const CAR_HEADLIGHT_MATERIAL: CarMaterialRole = 'LightFront'
/** パトランプ一式に共通する接頭辞。表示/非表示をまとめて切り替えるために使う。 */
export const CAR_POLICE_LIGHT_PREFIX = 'PoliceLight'

/** 元タイヤを外した位置。Phase 3 で共通タイヤを置くときの基準になる。 */
export type CarVehicleAxle = {
  /** 車体中心からの前後位置（+が前）。 */
  z: number
  /** 中心線からタイヤ中心までの距離。左右対称なので片側ぶんだけ持つ。 */
  halfTrack: number
  /** 元タイヤの半径。ゲーム側タイヤの大きさを決めるときの目安。 */
  radius: number
  /** 元タイヤの幅。 */
  width: number
}

export type CarVehicleDefinition = {
  id: CarVehicleId
  /** 詳細選択UIに出すラベル。 */
  label: string
  /** カテゴリ一覧のアイコン。 */
  emoji: string
  /** `public/models/car-builder/` 配下のファイル名。 */
  modelFile: string
  /** 実測の外形。車種差が幼児の手がかりになるので、車種間で正規化しない。 */
  size: { length: number; width: number; height: number }
  /** 車体下端の地上高（接地面を0とする）。 */
  bodyFloor: number
  /** 窓の広がりから測ったキャビン。屋根パーツの取り付け基準に使う。 */
  cabin: { centerZ: number; length: number; width: number; floorY: number }
  /**
   * 内蔵ヘッドライト（`LightFront`）前面の実測Z。フロントのライト・グリル・
   * ナンバーなど外装パーツの取り付け基準に使う。
   *
   * `size.length / 2` はボディ全長の最先端（バンパー角など）の値でしかなく、
   * ヘッドライトの高さでは実際の前面がそれよりボディ側へ入り込んでいる車種が
   * 多い。ここへ全長の半分をそのまま使うと、ライトやナンバーが前面から
   * 浮いて見える（Issueの実測値。GLBを作り直したら測り直すこと）。
   */
  frontFaceZ: number
  wheels: { front: CarVehicleAxle; rear: CarVehicleAxle }
  /** GLBに実在するマテリアル名の一覧。carVehicles.test.ts が実ファイルと突き合わせる。 */
  materials: readonly CarMaterialRole[]
  /** 出典。CC0のため表示義務はないが、将来出所不明にならないよう持っておく。 */
  source: { pack: string; model: string }
}

/**
 * 採用7車種。並び順はそのまま車種選択UIの並びになる。
 * 小さい乗用車から大きい特殊車両へ向かう順にして、サイズの差が伝わるようにしている。
 */
export const CAR_VEHICLES: { readonly [K in CarVehicleId]: CarVehicleDefinition } = {
  sportsCar: {
    id: 'sportsCar',
    label: 'スポーツカー',
    emoji: '🏎️',
    modelFile: 'sports-car.glb',
    size: { length: 3.926, width: 1.872, height: 1.035 },
    bodyFloor: 0.168,
    cabin: { centerZ: -0.278, length: 2.242, width: 1.446, floorY: 0.83 },
    frontFaceZ: 1.8435,
    wheels: {
      front: { z: 1.251, halfTrack: 0.725, radius: 0.28, width: 0.179 },
      rear: { z: -1.256, halfTrack: 0.701, radius: 0.28, width: 0.179 },
    },
    materials: ['Body', 'Glass', 'Trim', 'LightFront', 'LightRear'],
    source: { pack: 'Cars Pack', model: 'SportsCar2' },
  },
  car: {
    id: 'car',
    label: 'ふつうのくるま',
    emoji: '🚗',
    modelFile: 'car.glb',
    size: { length: 3.31, width: 1.638, height: 0.975 },
    bodyFloor: 0.171,
    cabin: { centerZ: -0.233, length: 1.986, width: 1.309, floorY: 0.777 },
    frontFaceZ: 1.5652,
    wheels: {
      front: { z: 1.035, halfTrack: 0.658, radius: 0.247, width: 0.18 },
      rear: { z: -0.961, halfTrack: 0.658, radius: 0.247, width: 0.18 },
    },
    materials: ['Body', 'Glass', 'TrimDark', 'Trim', 'LightFront', 'BodyLower', 'LightRear'],
    source: { pack: 'Cars Pack', model: 'NormalCar2' },
  },
  suv: {
    id: 'suv',
    label: 'SUV',
    emoji: '🚙',
    modelFile: 'suv.glb',
    size: { length: 4.209, width: 2.111, height: 1.274 },
    bodyFloor: 0.254,
    cabin: { centerZ: -0.436, length: 2.776, width: 1.687, floorY: 1.035 },
    frontFaceZ: 1.9951,
    wheels: {
      front: { z: 1.317, halfTrack: 0.767, radius: 0.327, width: 0.238 },
      rear: { z: -1.251, halfTrack: 0.794, radius: 0.327, width: 0.238 },
    },
    materials: ['Body', 'Glass', 'TrimDark', 'Trim', 'LightFront', 'LightRear'],
    source: { pack: 'Cars Pack', model: 'SUV' },
  },
  taxi: {
    id: 'taxi',
    label: 'タクシー',
    emoji: '🚕',
    modelFile: 'taxi.glb',
    size: { length: 4.221, width: 1.807, height: 1.146 },
    bodyFloor: 0.165,
    cabin: { centerZ: -0.245, length: 2.212, width: 1.49, floorY: 0.764 },
    frontFaceZ: 2.0616,
    wheels: {
      front: { z: 1.193, halfTrack: 0.69, radius: 0.262, width: 0.191 },
      rear: { z: -1.246, halfTrack: 0.688, radius: 0.262, width: 0.191 },
    },
    materials: ['Body', 'Glass', 'TrimDark', 'Trim', 'LightFront', 'LightRear', 'SignPlate', 'SignText'],
    source: { pack: 'Cars Pack', model: 'Taxi' },
  },
  policeCar: {
    id: 'policeCar',
    label: 'パトカー',
    emoji: '🚓',
    modelFile: 'police-car.glb',
    size: { length: 3.731, width: 1.778, height: 1.132 },
    bodyFloor: 0.106,
    cabin: { centerZ: -0.285, length: 2.054, width: 1.42, floorY: 0.756 },
    frontFaceZ: 1.7246,
    wheels: {
      front: { z: 1.143, halfTrack: 0.712, radius: 0.275, width: 0.175 },
      rear: { z: -1.153, halfTrack: 0.689, radius: 0.275, width: 0.175 },
    },
    materials: [
      'Accent',
      'Glass',
      'Trim',
      'LightFront',
      'Body',
      'LightRear',
      'PoliceLightBar',
      'PoliceLightBlue',
      'PoliceLightWhite',
      'PoliceLightRed',
    ],
    source: { pack: 'Cars Pack', model: 'Cop' },
  },
  schoolBus: {
    id: 'schoolBus',
    label: 'スクールバス',
    emoji: '🚌',
    modelFile: 'school-bus.glb',
    size: { length: 5.529, width: 2.254, height: 2.486 },
    bodyFloor: 0.145,
    cabin: { centerZ: -0.389, length: 4.533, width: 1.995, floorY: 0.988 },
    frontFaceZ: 2.7033,
    wheels: {
      front: { z: 2.253, halfTrack: 0.903, radius: 0.197, width: 0.263 },
      rear: { z: -2.021, halfTrack: 0.844, radius: 0.197, width: 0.263 },
    },
    materials: ['Body', 'Glass', 'Trim', 'TrimDark', 'LightFront'],
    source: { pack: 'Public Transport Pack', model: 'SchoolBus' },
  },
  ambulance: {
    id: 'ambulance',
    label: 'きゅうきゅうしゃ',
    emoji: '🚑',
    modelFile: 'ambulance.glb',
    size: { length: 4.688, width: 2.327, height: 2.173 },
    bodyFloor: 0.216,
    cabin: { centerZ: -0.408, length: 3.728, width: 2.281, floorY: 0.968 },
    frontFaceZ: 2.3197,
    wheels: {
      front: { z: 1.577, halfTrack: 0.813, radius: 0.231, width: 0.307 },
      rear: { z: -1.433, halfTrack: 1.003, radius: 0.231, width: 0.307 },
    },
    materials: ['Body', 'Accent', 'Glass', 'TrimDark', 'LightFront', 'Trim'],
    source: { pack: 'Public Transport Pack', model: 'Ambulance' },
  },
}

/** 車種選択UIと3D側が共有する並び順。 */
export const CAR_VEHICLE_ORDER: readonly CarVehicleId[] = [
  'car',
  'sportsCar',
  'suv',
  'taxi',
  'policeCar',
  'ambulance',
  'schoolBus',
]

/** GLBの公開URL。`public/` 配下をそのまま配信するため、base込みで組み立てる。 */
export function carVehicleModelUrl(id: CarVehicleId): string {
  return `${import.meta.env.BASE_URL}models/car-builder/${CAR_VEHICLES[id].modelFile}`
}

/** マテリアル名がパトランプ一式かどうか。Phase 3 で内蔵パトランプを隠すのに使う。 */
export function isPoliceLightMaterial(materialName: string): boolean {
  return materialName.startsWith(CAR_POLICE_LIGHT_PREFIX)
}

/** その車種が内蔵パトランプを持つか。 */
export function hasBuiltInPoliceLight(id: CarVehicleId): boolean {
  return CAR_VEHICLES[id].materials.some(isPoliceLightMaterial)
}
