/**
 * 「わくせいぎ」ゲーム全体で共有する型。
 * データ層(data/)・3Dエンジン層(three/)・UI層(ui/, PlanetGlobePlay.tsx)を
 * 疎結合にするための契約として、実装より先にここへ定義する。
 *
 * `earth-globe` と異なり、国境ポリゴンや当たり判定用のフィーチャは持たない。
 * 天体ごとの見た目・大きさ・輪の有無はすべて `CelestialBody` の値として表現し、
 * 画面・3Dエンジンに `if (id === 'saturn')` のような天体別の分岐を書かない。
 * 唯一の例外は `SurfaceSpec` の `style: 'rocky' | 'gas'` という判別可能ユニオンで、
 * 岩石天体とガス惑星は生成アルゴリズムが本質的に別物なので「2つの生成器」として扱う。
 */

export type CelestialBodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'

/**
 * 天体の分類。「全部わくせい」として扱わず、恒星・衛星・準惑星を惑星と区別する
 * (Phase 4で太陽・冥王星を追加するにあたり、説明・データ上の正しさを保つために導入する)。
 */
export type CelestialBodyKind = 'star' | 'planet' | 'moon' | 'dwarf-planet'

/**
 * 有限6段階のズーム。既存の0〜3は維持し、-2/-1だけをズームアウト側へ追加する。
 * 0=従来どおり天体全体がゆったり見える初期状態、3=表面に寄った状態。
 */
export type ZoomLevel = -2 | -1 | 0 | 1 | 2 | 3
export const MIN_ZOOM_LEVEL: ZoomLevel = -2
/** 天体を選んだ直後に使う、従来から変えない初期ズーム段階。 */
export const DEFAULT_ZOOM_LEVEL: ZoomLevel = 0
export const MAX_ZOOM_LEVEL: ZoomLevel = 3

/** 緯度方向の色プロファイルの1点。latDeg は +90(北極) → -90(南極) の降順で並べる。 */
export type LatitudeStop = { latDeg: number; color: string }

/**
 * 表面のアルベド模様(月の海、火星の暗色域・オリンポス山・マリネリス峡谷など)。
 * Phase 3の特徴スポットは、この id と経緯度をそのまま使えるようにしておく
 * (今回はタップ判定を実装しないが、座標の持ち方だけは先に揃えておく)。
 */
export type SurfacePatch = {
  id: string
  lonDeg: number
  latDeg: number
  /** 経度方向・緯度方向の半径(度) */
  lonRadiusDeg: number
  latRadiusDeg: number
  rotationDeg?: number
  color: string
  opacity: number
  /** 0=くっきり 1=ふんわり。楕円の縁のぼけ具合。 */
  softness: number
  /** バンプマップへの寄与。省略時は凹凸なし。center>0 で盛り上がり、<0 でくぼみ。-1..1 */
  relief?: number
}

export type SurfaceCrater = {
  id?: string
  lonDeg: number
  latDeg: number
  radiusDeg: number
  /** バンプの深さ 0..1 */
  depth: number
  /** ティコのような光条。省略時は描かない。 */
  rays?: { count: number; lengthDeg: number; color: string; opacity: number }
}

/** seedから決定的に散らす小クレーター群。 */
export type ScatteredCraters = {
  count: number
  minRadiusDeg: number
  maxRadiusDeg: number
  /** この緯度(絶対値)より極側には置かない。極付近のUV歪みを避ける。 */
  latLimitDeg: number
  depth: number
  seed: number
}

/** 極冠。縁はseedから決めた凹凸を持たせ、帯状のベタ塗りにしない。 */
export type PolarCaps = {
  northEdgeLatDeg: number
  southEdgeLatDeg: number
  color: string
  /** 縁の揺らぎ(度) */
  raggednessDeg: number
  seed: number
}

/**
 * 自然な海岸線を持つ陸地レイヤー。現在はNatural Earth由来の世界陸地データだけを
 * 使う。テクスチャ生成時に一度だけCanvasへ焼き込むため、描画ループでGeoJSONを
 * 扱わず、幼児向けの見やすい地球とスマホ負荷を両立する。
 */
export type LandmassSpec = {
  source: 'natural-earth-110m'
  color: string
  coastColor: string
  opacity: number
  /** バンプマップへの寄与。省略時は凹凸なし。 */
  relief?: number
}

export type SurfaceNoise = {
  seed: number
  octaves: number
  /** X方向の格子数(整数)。タイル周期になる。 */
  periodX: number
  /** Y方向の周波数。periodXと同程度にすると等方に見える。 */
  frequencyY: number
  /** 明暗の強さ 0..1 */
  amount: number
  /**
   * fbmの出力を0.5を中心に何倍へ広げるか(省略時は1=そのまま)。
   * fbmは各オクターブの平均のため値が0.5付近へ集まりやすく、そのまま使うと
   * 地表が「のっぺりしたプラスチック」に見える。1より大きくすると明暗がはっきりする。
   */
  contrast?: number
  lightColor: string
  darkColor: string
}

export type RockySurfaceSpec = {
  style: 'rocky'
  baseColor: string
  latitudeStops: readonly LatitudeStop[]
  noise: SurfaceNoise
  patches: readonly SurfacePatch[]
  craters: readonly SurfaceCrater[]
  scatteredCraters: ScatteredCraters
  polarCaps?: PolarCaps
  landmasses?: LandmassSpec
}

/** ガス惑星の渦・斑点(大赤斑、白斑、大赤斑まわりの淡い"くぼみ")。 */
export type GasSpot = {
  id: string
  lonDeg: number
  latDeg: number
  lonRadiusDeg: number
  latRadiusDeg: number
  rotationDeg?: number
  /** 中心→外周の色。半径比at(0..1)付き。最後は必ずopacity 0にして帯へ溶け込ませる。 */
  stops: readonly { at: number; color: string; opacity: number }[]
  /** 渦の輪郭線。省略時は描かない。 */
  swirl?: { turns: number; color: string; opacity: number; width: number }
}

export type GasSurfaceSpec = {
  style: 'gas'
  baseColor: string
  /** 帯の色。latDeg降順。境界は滑らかに補間するが、stopを密に置くことで縞として見せる。 */
  belts: readonly LatitudeStop[]
  /** 帯を波打たせる歪み。X方向に引き伸ばしたfbmで緯度をずらす。 */
  turbulence: { seed: number; octaves: number; periodX: number; frequencyY: number; amplitudeDeg: number }
  /** 細かなむら。明暗のみ。 */
  mottle: { seed: number; octaves: number; periodX: number; frequencyY: number; amount: number }
  spots: readonly GasSpot[]
}

export type SurfaceSpec = RockySurfaceSpec | GasSurfaceSpec

/** 輪の1本の帯(＝1枚のRingGeometry)。 */
export type RingSegment = {
  id: string
  innerRadiusRatio: number
  outerRadiusRatio: number
  /** 内(0)→外(1)。すき間はopacityを落として表現する。 */
  bands: readonly { at: number; color: string; opacity: number }[]
  /** 細いリングレットの濃淡。alphaを周期的に揺らす。 */
  ringlets?: { seed: number; count: number; amount: number }
}

export type RingSpec = { segments: readonly RingSegment[] }

/**
 * 表面とは別に薄く重ねる雲。独立した薄い球として重ねることで、静止した
 * テクスチャを貼っただけではない地球らしい奥行きを出す。
 * `patches` は地表と同じ経緯度座標系を使うため、追加の座標変換を持ち込まない。
 */
export type CloudLayerSpec = {
  patches: readonly SurfacePatch[]
  opacity: number
  /** ラジアン/秒。スポットと見た目を一致させるため、通常は地表と同じ値にする。 */
  spinSpeed: number
}

/** 天体ごとの低負荷な見た目の重ね。必要な天体だけ指定する。 */
export type AtmosphereSpec = {
  color: string
  opacity: number
  /** 球半径に対する拡大率。1.0より少し大きくする。 */
  scale: number
}

export type BodyVisualSpec = {
  atmosphere?: AtmosphereSpec
  clouds?: CloudLayerSpec
}

/** 天体ごとのライティング補正。すべて既定値からの上書き。 */
export type LightingSpec = {
  keyIntensity: number
  ambientIntensity: number
  hemisphereIntensity: number
  fillIntensity: number
}

export type CelestialBody = {
  id: CelestialBodyId
  /** 恒星・惑星・衛星・準惑星の別。説明・グルーピングで「全部わくせい」と扱わないための分類。 */
  kind: CelestialBodyKind
  /** 幼児向けのひらがな表記 */
  displayName: string
  /** 選択UIのプレビュー円に使うCSS背景。3D表示と同系色にして文字なしでも見分けられるようにする。 */
  previewBackground: string
  /** 表示用の球の半径(world unit)。実際の天体の大きさ比ではなく、画面での見やすさで決める。 */
  radius: number
  /** 極方向の潰れ(0..0.15)。ガス惑星の扁平を表す。省略時0。 */
  flattening?: number
  /** 自転軸の傾き(度)。輪の傾きにも使う。 */
  axialTiltDegrees: number
  /** 初期の自転角(ラジアン)。天体を切り替えるたびにこの角度へ戻す。 */
  initialRotationY: number
  /** ゆっくりした自転(ラジアン/秒)。prefers-reduced-motionのときは止める。負の値で逆回転(金星)を表せる。 */
  spinSpeed: number
  surface: SurfaceSpec
  material: {
    roughness: number
    bumpScale?: number
    /**
     * 自己発光色。太陽だけが持つ。恒星は光源に照らされる側面と影側面を持つ通常の天体と違い、
     * 影側でも真っ暗にならないようにするための最小限の表現(Phase 5で表面模様とあわせて仕上げる)。
     */
    emissive?: string
    /** emissiveの強さ。省略時1。 */
    emissiveIntensity?: number
  }
  lighting: LightingSpec
  /**
   * ズーム段階ごとのカメラ距離を「天体(輪を含む)がちょうど画面に収まる距離の何倍か」で持つ。
   * 絶対距離ではなく倍率にすることで、縦画面・横画面のどちらでも天体全体が切れずに収まる。
   */
  zoom: { outMargin: number; inMargin: number }
  /** 既定視点を上書きしたい天体だけ持つ(土星は輪をよく開かせる)。 */
  viewDirection?: { x: number; y: number; z: number }
  ring?: RingSpec
  /** 既存の表面・輪に軽量な補助レイヤーを足すための任意設定。 */
  visual?: BodyVisualSpec
  /**
   * 太陽系全体表示(Phase 6)での軌道配置。太陽・月は持たない(太陽は中心に固定、
   * 月は地球の衛星として別枠で描くため)。実際の距離比・周期比ではなく、
   * スマホ縦画面で並び順と公転の関係が見やすいよう圧縮した値。
   */
  orbit?: OrbitSpec
}

/** 太陽系全体表示(Phase 6)での1天体ぶんの軌道。 */
export type OrbitSpec = {
  /** 太陽(原点)からの軌道半径(world unit)。実距離比ではなく見やすさで決める。 */
  radius: number
  /** 公転の角速度(ラジアン/秒)。内側の惑星ほど大きい値にする。 */
  angularSpeed: number
}

/** 「たいようけい」内の2つの遊び方。個別観察と太陽系全体表示を切り替える。 */
export type SolarSystemMode = 'single' | 'overview'

/**
 * 特徴スポットのタップ対象。球面上の点(surface)か、輪(ring)のどちらか。
 * 「将来なんでも置けるように」という抽象化はしない。実際に必要な2種類だけを持つ。
 */
export type FeatureSpotTarget =
  | {
      kind: 'surface'
      /** Phase 2 の模様と同じ経緯度(度)。texture上の位置と3D位置はここで一致する。 */
      lonDeg: number
      latDeg: number
    }
  | {
      kind: 'ring'
      /** マーカーを置く輪の半径(天体半径に対する比)。 */
      radiusRatio: number
      /** マーカーを置く輪の中心角(度)。0=+X方向、+Z方向へ向かって増える(tiltGroupローカル)。 */
      angleDeg: number
      /** ハイライトする輪のセグメント(`RingSegment.id`)。輪全体を光らせるときに使う。 */
      highlightSegmentIds?: readonly string[]
      /** セグメントで表せない帯(カッシーニ間隙など)を直接指定する。 */
      highlightRadiusBand?: { innerRatio: number; outerRatio: number }
    }

export type FeatureSpot = {
  id: string
  /** 幼児向けのひらがな/カタカナ表記。説明カードに大きく出す。 */
  displayName: string
  /** displayName のままでは読み上げが不自然な場合だけ持つ。省略時は displayName を読む。 */
  spokenName?: string
  /** 4〜5歳向けの短い説明。原則1〜2文。 */
  description: string
  target: FeatureSpotTarget
  /**
   * 画面上の当たり判定半径(CSSピクセル)。見た目のマーカー(直径15px前後)よりずっと大きくして、
   * 幼児が指で押しても必ず反応するようにする。見た目と当たり判定は意図的に分離している。
   */
  hitRadiusPx: number
  /** 選択時のマーカー・ハイライトの色。 */
  accentColor: string
}

export type UsePlanetEngineOptions = {
  /** 表示中の天体。変わったら3Dオブジェクトを作り替える。 */
  body: CelestialBody
  /** 現在のズーム段階。変化したらカメラ距離を短いアニメーションで遷移させる。 */
  zoomLevel: ZoomLevel
  /** 表示中の天体の特徴スポット。body と対応するものを渡す。 */
  spots: readonly FeatureSpot[]
  /** 選択中のスポットid。null で選択なし。 */
  selectedSpotId: string | null
  /** 同じスポットを再タップしたときにも選択演出をやり直すためのカウンタ(earth-globeと同じ方式)。 */
  selectionFeedbackKey: number
  /** キャンバス上の軽いタップでスポットが選ばれたときに呼ぶ。何も無い場所をタップしたら null。 */
  onSpotSelect: (spotId: string | null) => void
}

export type UsePlanetEngineHandle = {
  /** 3D描画先のdivを登録するrefコールバック(nullで解除)。 */
  registerContainer: (element: HTMLDivElement | null) => void
}

export type UseSolarSystemOverviewEngineOptions = {
  /** 太陽・8惑星・冥王星(太陽から外側への順)。月は含めない。 */
  bodies: readonly CelestialBody[]
  /** 地球の付近に小さく描く衛星。省略時は月を描かない。 */
  moon?: CelestialBody
  /** 公転を進めるか。falseなら現在の配置のまま静止する。 */
  playing: boolean
  /** 天体がタップされたときに呼ぶ。個別観察へ切り替える入口として使う。 */
  onSelectBody: (id: CelestialBodyId) => void
  /** カメラ距離が両端に達したかをUIへ伝える。 */
  onZoomAvailabilityChange: (availability: { canZoomIn: boolean; canZoomOut: boolean }) => void
}

export type UseSolarSystemOverviewEngineHandle = {
  /** 3D描画先のdivを登録するrefコールバック(nullで解除)。 */
  registerContainer: (element: HTMLDivElement | null) => void
  /** 一覧表示のカメラを一段階近づける。 */
  zoomIn: () => void
  /** 一覧表示のカメラを一段階離す。 */
  zoomOut: () => void
}
