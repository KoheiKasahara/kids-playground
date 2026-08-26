/**
 * 「わくせいぎ」ゲーム全体で共有する型。
 * データ層(data/)・3Dエンジン層(three/)・UI層(ui/, PlanetGlobePlay.tsx)を
 * 疎結合にするための契約として、実装より先にここへ定義する。
 *
 * `earth-globe` と異なり、国境ポリゴンや当たり判定用のフィーチャは持たない。
 * 天体ごとの見た目・大きさ・輪の有無はすべて `CelestialBody` の値として表現し、
 * 画面・3Dエンジンに `if (id === 'saturn')` のような天体別の分岐を書かない。
 */

export type CelestialBodyId = 'moon' | 'mars' | 'jupiter' | 'saturn'

/** 有限4段階のズーム。0=天体全体がゆったり見える, 3=表面に寄った状態。 */
export type ZoomLevel = 0 | 1 | 2 | 3
export const MIN_ZOOM_LEVEL: ZoomLevel = 0
export const MAX_ZOOM_LEVEL: ZoomLevel = 3

/** 緯度方向のグラデーションの1点。at は 0=北極 / 1=南極。木星・土星の縞、火星の極冠をこれで表す。 */
export type SurfaceBand = { at: number; color: string }

/** クレーター・地表のまだら模様。seed から決定的に配置する。 */
export type SurfaceSpeckles = {
  count: number
  /** テクスチャ高さに対する比 */
  minRadius: number
  maxRadius: number
  color: string
  /** クレーターの明るい縁。省略時は縁を描かない。 */
  rimColor?: string
  opacity: number
  seed: number
}

export type SurfaceSpec = {
  baseColor: string
  bands?: readonly SurfaceBand[]
  speckles?: SurfaceSpeckles
}

/** 土星の輪のような、天体に付随する円盤。内外の半径は天体半径に対する比で持つ。 */
export type RingSpec = {
  innerRadiusRatio: number
  outerRadiusRatio: number
  /** 内(0)から外(1)へ向かう帯。すき間は opacity を下げて表現する。 */
  bands: readonly { at: number; color: string; opacity: number }[]
}

export type CelestialBody = {
  id: CelestialBodyId
  /** 幼児向けのひらがな表記 */
  displayName: string
  /** 選択UIのプレビュー円に使うCSS背景。3D表示と同系色にして文字なしでも見分けられるようにする。 */
  previewBackground: string
  /** 表示用の球の半径(world unit)。実際の天体の大きさ比ではなく、画面での見やすさで決める。 */
  radius: number
  /** 自転軸の傾き(度)。輪の傾きにも使う。 */
  axialTiltDegrees: number
  /** 初期の自転角(ラジアン)。天体を切り替えるたびにこの角度へ戻す。 */
  initialRotationY: number
  /** ゆっくりした自転(ラジアン/秒)。prefers-reduced-motion のときは止める。 */
  spinSpeed: number
  surface: SurfaceSpec
  material: { roughness: number }
  /**
   * ズーム段階ごとのカメラ距離を「天体（輪を含む）がちょうど画面に収まる距離の何倍か」で持つ。
   * 絶対距離ではなく倍率にすることで、縦画面・横画面のどちらでも天体全体が切れずに収まる。
   */
  zoom: { outMargin: number; inMargin: number }
  ring?: RingSpec
}

export type UsePlanetEngineOptions = {
  /** 表示中の天体。変わったら3Dオブジェクトを作り替える。 */
  body: CelestialBody
  /** 現在のズーム段階。変化したらカメラ距離を短いアニメーションで遷移させる。 */
  zoomLevel: ZoomLevel
}

export type UsePlanetEngineHandle = {
  /** 3D描画先の div を登録する ref コールバック（null で解除）。 */
  registerContainer: (element: HTMLDivElement | null) => void
}
