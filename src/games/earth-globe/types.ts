/**
 * 「ちきゅうぎ」ゲーム全体で共有する型。
 * データ層(data/)・3Dエンジン層(three/)・UI層(ui/, EarthGlobePlay.tsx)を
 * 疎結合にするための契約として、実装より先にここへ定義する。
 */

/** world-atlas の TopoJSON を GeoJSON化した1か国ぶんの形状。id は ISO 3166-1 numeric。 */
export type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
export type GlobeFeature = { id: number; geometry: Geometry }

/**
 * 地球儀上でタップ対象になる1か国。
 * `flag-quiz` の国マスタ(`Country`)と world-atlas の数値IDを紐付けたもの。
 * 数値IDが world-atlas 側に存在しない国は、この一覧から除外する（フォールバックなし）。
 */
export type GlobeCountry = {
  /** ISO 3166-1 alpha-2 の小文字コード (例: 'jp')。flag-quiz の Country.id と一致する。 */
  id: string
  /** 子ども向けの日本語表記 */
  nameJa: string
  /** base からの相対パス (例: 'flags/jp.svg')。先頭にスラッシュを付けない */
  flag: string
  /** world-atlas (Natural Earth 50m) の地形と突き合わせる ISO 3166-1 numeric ID */
  numericId: number
}

/** 有限4段階のズーム。0=地球全体, 3=国の形が識別できる最大ズーム。 */
export type ZoomLevel = 0 | 1 | 2 | 3
export const MIN_ZOOM_LEVEL: ZoomLevel = 0
export const MAX_ZOOM_LEVEL: ZoomLevel = 3

/** three-globeの地球半径と同じワールド単位。ラベルの投影にも使う。 */
export const GLOBE_RADIUS = 100

export type GlobeVector3 = {
  x: number
  y: number
  z: number
}

export type GlobeProjectedPoint = {
  /** 地球儀コンテナ左上を原点とするCSSピクセル座標。 */
  x: number
  y: number
  /** Three.jsのNDC深度。-1に近いほど手前。 */
  depth: number
}

export type GlobeCameraUpdate = {
  cameraPosition: GlobeVector3
  viewportWidth: number
  viewportHeight: number
  projectPoint: (point: GlobeVector3) => GlobeProjectedPoint | null
}

/**
 * 3Dエンジンを React から操作するためのフック契約。
 * `useDominoEngine`（src/games/domino-flag）と同じ「div を registerContainer に
 * 渡し、three.js のライフサイクルは hook 内で完結させる」形に揃える。
 *
 * 状態（zoomLevel / selectedCountryId）は呼び出し側（EarthGlobePlay）が
 * React state として保持し、hook は props の変化を購読して描画へ反映する
 * "controlled" な作りにする。hook 内に重複した状態を持たない。
 */
export type UseGlobeEngineOptions = {
  /** タップ対象国の一覧。初回マウント後は再生成されない前提（親で安定させる）。 */
  countries: readonly GlobeCountry[]
  /** world-atlas 由来の全世界の国境フィーチャ（陸地の見た目・当たり判定の元）。 */
  features: readonly GlobeFeature[]
  /** 現在のズーム段階。変化したらカメラを短いアニメーションで遷移させる。 */
  zoomLevel: ZoomLevel
  /** 現在選択中の国（alpha-2）。null は未選択。変化したらハイライト表示を更新する。 */
  selectedCountryId: string | null
  /** 地球上の国がタップされたら alpha-2 コードで通知する。海・国境データ外のタップは null。 */
  onCountrySelect: (countryId: string | null) => void
  /** prefers-reduced-motion のとき true。true の間はカメラ・ハイライトのアニメーションを即時化する。 */
  reducedMotion: boolean
  /** HTMLラベルオーバーレイへカメラ位置と投影口を渡す。 */
  onCameraUpdate?: (update: GlobeCameraUpdate) => void
}

export type UseGlobeEngineHandle = {
  /** 3D描画先の div を登録する ref コールバック（null で解除）。 */
  registerContainer: (element: HTMLDivElement | null) => void
}
