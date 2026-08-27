import type { CelestialBody, CelestialBodyId } from '../types'
import { lonToU, rotationYFacing } from '../three/planetCoords'

/**
 * 11天体の見た目・大きさ・輪をまとめて表現するデータ。
 * `three/usePlanetEngine.ts` はこの配列の値だけを読んで3Dオブジェクトを組み立てる。
 * 天体が増えても、ここへ1件足すだけで済むようにする(画面・エンジン側に分岐を作らない)。
 *
 * 表面の模様(海、クレーター、極冠、大赤斑など)はすべて経度・緯度(度)で定義する。
 * ピクセルへの変換は `three/planetCoords.ts` と `three/planetSurface.ts` に一本化してあるため、
 * ここでは実際の天体地図に近い値をそのまま書けばよい。
 *
 * 表示順は太陽から外側へ向かう実際の並び(太陽・水星・金星・地球・月・火星・木星・土星・天王星・海王星・冥王星)。
 * 月だけは衛星として地球の直後に置く。
 *
 * Phase 4で追加した7天体(太陽・水星・金星・地球・天王星・海王星・冥王星)も、Phase 1〜3と同じ
 * `SurfaceSpec`(rocky/gas)の2生成器だけで表現している。太陽・金星・天王星・海王星は`gas`スタイルを、
 * 水星・地球・冥王星は`rocky`スタイルを流用し、天体ごとの新しい生成器・新しい画面分岐は追加していない。
 * 太陽の発光感だけは`material.emissive`という新しい任意フィールドで表現する(データだけの拡張)。
 */
export const celestialBodies: readonly CelestialBody[] = [
  {
    id: 'sun',
    kind: 'star',
    displayName: 'たいよう',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #fff6d0 0%, #ffcf5e 35%, #ffb347 68%, #d97f1f 100%)',
    radius: 72,
    axialTiltDegrees: 7.25,
    // sunspot-aがやや正面に見える面を初期表示にする。
    initialRotationY: rotationYFacing(lonToU(0)) - 0.1,
    spinSpeed: 0.02,
    // emissiveは表面シェーダー(three/sunVisual.ts)の「熱い部分」の色、emissiveIntensityは
    // ベース模様とのブレンド強さとして使う(MeshStandardMaterialのemissiveではない。
    // 太陽はkind:'star'のときだけ専用ShaderMaterialへ差し替わるため、通常のemissiveと
    // 意味は異なるが、既存のデータ形を増やさずに済ませるためこの2フィールドを流用する)。
    material: { roughness: 1, emissive: '#fff3c4', emissiveIntensity: 0.55 },
    // 恒星は影のできる側面でも真っ暗にならないよう、ambient/fillを他天体よりだいぶ高くする
    // (ShaderMaterialへ切り替わった今も、Canvas 2Dが使えない環境向けのMeshStandardMaterial
    // フォールバックが同じ値を読むため維持する)。
    lighting: { keyIntensity: 2.0, ambientIntensity: 0.55, hemisphereIntensity: 0.4, fillIntensity: 0.42 },
    zoom: { outMargin: 1.15, inMargin: 0.6 },
    visual: {
      // 表面テクスチャと別の、非常に薄い発光の縁。Bloomやparticleを使わず恒星感を足す。
      halo: { color: '#ffba4c', opacity: 0.46, scale: 3.1 },
      // 半透明の1枚膜によるコロナ。既存の`visual.atmosphere`(usePlanetEngine.tsに汎用的に
      // 実装済みだが、これまでどの天体も指定していなかった経路)をそのまま流用するだけで、
      // 新しいメッシュ生成コードを増やさずに済む。
      // scaleを広めにして、球のすぐ外側が濃い輪に見えないよう外側へなだらかに薄まるようにする。
      atmosphere: { color: '#ffa25a', opacity: 0.16, scale: 1.22 },
    },
    surface: {
      style: 'gas',
      baseColor: '#ffcf5e',
      // 木星のような帯ではなく、緯度による色差を弱くして「表面全体が光っている」印象にする。
      belts: [
        { latDeg: 90, color: '#ffb347' },
        { latDeg: 60, color: '#ffd27a' },
        { latDeg: 30, color: '#fff1b8' },
        { latDeg: 0, color: '#fff6d0' },
        { latDeg: -30, color: '#fff1b8' },
        { latDeg: -60, color: '#ffd27a' },
        { latDeg: -90, color: '#ffb347' },
      ],
      // 周波数を高くして、縞ではなく粒状の対流(粒状斑)らしいむらに見せる。
      turbulence: { seed: 71, octaves: 4, periodX: 8, frequencyY: 42, amplitudeDeg: 2 },
      mottle: { seed: 83, octaves: 5, periodX: 14, frequencyY: 34, amount: 0.22 },
      spots: [
        {
          id: 'sunspot-a',
          lonDeg: 20,
          latDeg: 12,
          lonRadiusDeg: 5,
          latRadiusDeg: 3,
          stops: [
            { at: 0, color: '#7a3b12', opacity: 0.55 },
            { at: 0.6, color: '#c9701f', opacity: 0.35 },
            { at: 1, color: '#ffcf5e', opacity: 0 },
          ],
        },
        {
          id: 'sunspot-b',
          lonDeg: -55,
          latDeg: -18,
          lonRadiusDeg: 4,
          latRadiusDeg: 2.6,
          stops: [
            { at: 0, color: '#7a3b12', opacity: 0.5 },
            { at: 0.6, color: '#c9701f', opacity: 0.3 },
            { at: 1, color: '#ffcf5e', opacity: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'mercury',
    kind: 'planet',
    // Phase 6: 太陽系全体表示での軌道。半径は太陽からの並び順が伝わる圧縮値、
    // 角速度は「47.1 / radius」(内側ほど速く回る、の簡易近似)で揃える。
    orbit: { radius: 90, angularSpeed: 0.5233 },
    displayName: 'すいせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #cbb79a 0%, #a08a72 45%, #7a6754 78%, #5a4a3a 100%)',
    radius: 44,
    axialTiltDegrees: 0.03,
    initialRotationY: rotationYFacing(lonToU(0)),
    spinSpeed: 0.02,
    material: { roughness: 1, bumpScale: 2.0 },
    lighting: { keyIntensity: 2.6, ambientIntensity: 0.14, hemisphereIntensity: 0.26, fillIntensity: 0.18 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    surface: {
      style: 'rocky',
      baseColor: '#a08a72',
      // 月より茶色寄りにして、並べたときに一目で違う天体だと分かるようにする。
      latitudeStops: [
        { latDeg: 90, color: '#ab9678' },
        { latDeg: 0, color: '#a08a72' },
        { latDeg: -90, color: '#8f7a62' },
      ],
      noise: {
        seed: 133,
        octaves: 5,
        periodX: 8,
        frequencyY: 4,
        amount: 0.4,
        contrast: 1.7,
        lightColor: '#c9b79c',
        darkColor: '#5a4a3a',
      },
      patches: [
        // カロリス盆地。巨大な衝突で明るいエジェクタが広がった地形として、薄い明色パッチで表す。
        { id: 'caloris-basin', lonDeg: 165, latDeg: 30, lonRadiusDeg: 18, latRadiusDeg: 16, color: '#c7b79f', opacity: 0.5, softness: 0.55, relief: 0.3 },
      ],
      craters: [
        { id: 'mercury-crater-a', lonDeg: -30, latDeg: 10, radiusDeg: 3.4, depth: 0.85, rays: { count: 12, lengthDeg: 24, color: '#dccdb0', opacity: 0.22 } },
        { id: 'mercury-crater-b', lonDeg: 60, latDeg: -35, radiusDeg: 2.6, depth: 0.75 },
        { id: 'mercury-crater-c', lonDeg: -95, latDeg: -12, radiusDeg: 4.0, depth: 0.7 },
      ],
      scatteredCraters: { count: 260, minRadiusDeg: 0.4, maxRadiusDeg: 2.6, latLimitDeg: 80, depth: 0.66, seed: 205 },
    },
  },
  {
    id: 'venus',
    kind: 'planet',
    orbit: { radius: 130, angularSpeed: 0.3623 },
    displayName: 'きんせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #fdf3d2 0%, #f2dfae 45%, #e7cf92 78%, #c9a869 100%)',
    radius: 50,
    axialTiltDegrees: 2.6,
    initialRotationY: rotationYFacing(lonToU(0)),
    // 金星は実際に他の惑星と逆向きに自転している。値だけで表現でき、特別な分岐は不要。
    spinSpeed: -0.02,
    material: { roughness: 1 },
    lighting: { keyIntensity: 2.3, ambientIntensity: 0.22, hemisphereIntensity: 0.3, fillIntensity: 0.22 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    surface: {
      style: 'gas',
      baseColor: '#f2dfae',
      // 木星ほどコントラストを付けず、地表を隠す厚い雲そのものが主役に見えるようにする。
      belts: [
        { latDeg: 90, color: '#e7cf92' },
        { latDeg: 60, color: '#f1e0ac' },
        { latDeg: 30, color: '#f7ecc4' },
        { latDeg: 0, color: '#fdf3d2' },
        { latDeg: -30, color: '#f7ecc4' },
        { latDeg: -60, color: '#f1e0ac' },
        { latDeg: -90, color: '#e7cf92' },
      ],
      // 大きな振幅のturbulenceで、雲がうねりながら地表を覆う印象を強める。
      turbulence: { seed: 51, octaves: 5, periodX: 8, frequencyY: 22, amplitudeDeg: 6 },
      mottle: { seed: 59, octaves: 5, periodX: 12, frequencyY: 30, amount: 0.14 },
      spots: [
        {
          id: 'venus-cloud-band',
          lonDeg: 0,
          latDeg: 10,
          lonRadiusDeg: 40,
          latRadiusDeg: 6,
          stops: [
            { at: 0, color: '#c9a869', opacity: 0.35 },
            { at: 1, color: '#c9a869', opacity: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'earth',
    kind: 'planet',
    orbit: { radius: 170, angularSpeed: 0.2771 },
    displayName: 'ちきゅう',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #eef3f6 0%, #4f83ad 30%, #1f5f9e 55%, #6b8f4e 78%, #154a7d 100%)',
    radius: 50,
    axialTiltDegrees: 23.4,
    // アジア・アフリカ・ヨーロッパがまとまって見える面を初期表示にする。
    initialRotationY: rotationYFacing(lonToU(20)),
    spinSpeed: 0.035,
    material: { roughness: 0.9, bumpScale: 0.6 },
    lighting: { keyIntensity: 2.4, ambientIntensity: 0.18, hemisphereIntensity: 0.3, fillIntensity: 0.22 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    visual: {
      clouds: {
        opacity: 0.58,
        // 雲のスポットと常に一致するよう、地表と同じ自転速度で回す。
        // 別メッシュによる奥行きは保ちつつ、回転後にマーカーだけずれないことを優先する。
        spinSpeed: 0.035,
        patches: [
          { id: 'earth-cloud-layer-a', lonDeg: -30, latDeg: 20, lonRadiusDeg: 28, latRadiusDeg: 8, color: '#ffffff', opacity: 0.52, softness: 0.78 },
          { id: 'earth-cloud-layer-b', lonDeg: 60, latDeg: -30, lonRadiusDeg: 32, latRadiusDeg: 9, color: '#ffffff', opacity: 0.46, softness: 0.8 },
          { id: 'earth-cloud-layer-c', lonDeg: 160, latDeg: 5, lonRadiusDeg: 25, latRadiusDeg: 7, color: '#ffffff', opacity: 0.5, softness: 0.75 },
          { id: 'earth-cloud-layer-d', lonDeg: 105, latDeg: 55, lonRadiusDeg: 26, latRadiusDeg: 6, color: '#ffffff', opacity: 0.38, softness: 0.82 },
          { id: 'earth-cloud-layer-e', lonDeg: -120, latDeg: -35, lonRadiusDeg: 24, latRadiusDeg: 7, color: '#ffffff', opacity: 0.42, softness: 0.8 },
        ],
      },
    },
    surface: {
      style: 'rocky',
      baseColor: '#1f5f9e',
      latitudeStops: [
        { latDeg: 90, color: '#eef3f6' },
        { latDeg: 70, color: '#4f83ad' },
        { latDeg: 0, color: '#1f5f9e' },
        { latDeg: -70, color: '#4f83ad' },
        { latDeg: -90, color: '#eef3f6' },
      ],
      noise: {
        seed: 301,
        octaves: 4,
        periodX: 8,
        frequencyY: 4,
        // 海は陸に比べて模様を弱くし、ノイズだらけの海面にしない。
        amount: 0.12,
        contrast: 1.2,
        lightColor: '#3f7fb0',
        darkColor: '#154a7d',
      },
      patches: [
      ],
      craters: [],
      scatteredCraters: { count: 0, minRadiusDeg: 0.4, maxRadiusDeg: 0.4, latLimitDeg: 0, depth: 0, seed: 1 },
      // Natural Earth 110mの海岸線をCanvasテクスチャへ一度だけ焼き込み、国境線は描かない。
      // https://github.com/topojson/world-atlas (ISC) / Natural Earth (public domain)
      landmasses: { source: 'natural-earth-110m', color: '#6f9655', coastColor: '#315a43', opacity: 0.98, relief: 0.28 },
      // 北極・南極を示す白い極冠だけを置く。
      polarCaps: { northEdgeLatDeg: 80, southEdgeLatDeg: -78, color: '#f5f8fa', raggednessDeg: 5, seed: 302 },
    },
  },
  {
    id: 'moon',
    kind: 'moon',
    displayName: 'つき',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #d8d6cd 0%, #a19f97 45%, #7c7a74 78%, #5f5d58 100%)',
    radius: 46,
    axialTiltDegrees: 6.7,
    initialRotationY: rotationYFacing(lonToU(0)),
    spinSpeed: 0.03,
    material: { roughness: 1, bumpScale: 2.4 },
    lighting: { keyIntensity: 2.6, ambientIntensity: 0.13, hemisphereIntensity: 0.26, fillIntensity: 0.18 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    surface: {
      style: 'rocky',
      baseColor: '#9e9c95',
      // 月は緯度で色があまり変わらないため、極がわずかに暗い程度の弱いプロファイルにする。
      latitudeStops: [
        { latDeg: 90, color: '#a8a69f' },
        { latDeg: 0, color: '#9e9c95' },
        { latDeg: -90, color: '#918f88' },
      ],
      noise: {
        seed: 7,
        octaves: 5,
        periodX: 8,
        frequencyY: 4,
        amount: 0.34,
        contrast: 1.5,
        lightColor: '#c6c4bc',
        darkColor: '#6f6d67',
      },
      // 表側の「月の海」。実際の位置関係(東経正)に合わせて置き、海どうしが
      // 重なり合って1つの大きな暗色域に見えるようにする(実際そう見える)。
      patches: [
        { id: 'mare-imbrium', lonDeg: -16, latDeg: 33, lonRadiusDeg: 22, latRadiusDeg: 17, color: '#5f5f63', opacity: 0.82, softness: 0.45 },
        { id: 'mare-serenitatis', lonDeg: 17, latDeg: 28, lonRadiusDeg: 14, latRadiusDeg: 12, color: '#5a5a5f', opacity: 0.8, softness: 0.4 },
        { id: 'mare-tranquillitatis', lonDeg: 31, latDeg: 8, lonRadiusDeg: 16, latRadiusDeg: 13, color: '#565660', opacity: 0.8, softness: 0.42 },
        { id: 'mare-crisium', lonDeg: 59, latDeg: 17, lonRadiusDeg: 10, latRadiusDeg: 8, color: '#545460', opacity: 0.85, softness: 0.35 },
        { id: 'mare-fecunditatis', lonDeg: 52, latDeg: -8, lonRadiusDeg: 11, latRadiusDeg: 12, color: '#5b5b62', opacity: 0.78, softness: 0.45 },
        { id: 'mare-nectaris', lonDeg: 34, latDeg: -15, lonRadiusDeg: 8, latRadiusDeg: 8, color: '#5c5c63', opacity: 0.8, softness: 0.4 },
        { id: 'oceanus-procellarum', lonDeg: -57, latDeg: 19, lonRadiusDeg: 27, latRadiusDeg: 30, color: '#63636a', opacity: 0.72, softness: 0.55 },
        { id: 'mare-nubium', lonDeg: -17, latDeg: -21, lonRadiusDeg: 13, latRadiusDeg: 10, color: '#62626a', opacity: 0.75, softness: 0.5 },
        { id: 'mare-humorum', lonDeg: -39, latDeg: -24, lonRadiusDeg: 9, latRadiusDeg: 8, color: '#5e5e66', opacity: 0.78, softness: 0.45 },
        // 裏側は海がほとんど無いという実際の月の性質に沿い、小さく薄いものだけを置く。
        { id: 'far-side-a', lonDeg: 152, latDeg: 22, lonRadiusDeg: 12, latRadiusDeg: 10, color: '#78787c', opacity: 0.4, softness: 0.6 },
        { id: 'far-side-b', lonDeg: -145, latDeg: -28, lonRadiusDeg: 10, latRadiusDeg: 9, color: '#7a7a7e', opacity: 0.35, softness: 0.6 },
      ],
      craters: [
        {
          id: 'tycho',
          lonDeg: -11,
          latDeg: -43,
          radiusDeg: 4.2,
          depth: 0.95,
          rays: { count: 16, lengthDeg: 58, color: '#e8e6de', opacity: 0.3 },
        },
        { id: 'copernicus', lonDeg: -20, latDeg: 10, radiusDeg: 3.2, depth: 0.9 },
        {
          id: 'kepler',
          lonDeg: -38,
          latDeg: 8,
          radiusDeg: 2.0,
          depth: 0.8,
          rays: { count: 10, lengthDeg: 20, color: '#ded9cf', opacity: 0.18 },
        },
        { id: 'aristarchus', lonDeg: -47, latDeg: 24, radiusDeg: 2.0, depth: 0.85 },
        { id: 'plato', lonDeg: -9, latDeg: 51, radiusDeg: 3.0, depth: 0.7 },
        { id: 'clavius', lonDeg: -14, latDeg: -58, radiusDeg: 5.6, depth: 0.75 },
        { id: 'grimaldi', lonDeg: -68, latDeg: -6, radiusDeg: 3.4, depth: 0.6 },
        { id: 'far-side-crater-a', lonDeg: 165, latDeg: 5, radiusDeg: 4.6, depth: 0.72 },
        { id: 'far-side-crater-b', lonDeg: -168, latDeg: -40, radiusDeg: 4.0, depth: 0.68 },
      ],
      scatteredCraters: { count: 220, minRadiusDeg: 0.5, maxRadiusDeg: 3.0, latLimitDeg: 76, depth: 0.62, seed: 91 },
    },
  },
  {
    id: 'mars',
    kind: 'planet',
    orbit: { radius: 210, angularSpeed: 0.2243 },
    displayName: 'かせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #e6a06c 0%, #c1622f 45%, #93401f 78%, #f2efe6 100%)',
    radius: 48,
    axialTiltDegrees: 25.2,
    // マリネリス峡谷を中央付近に、オリンポス山を明るい側に置いた面を初期表示にする
    // (経度-100付近を正面にすると、明るい高地ばかりで暗色域がほとんど見えなかった)。
    initialRotationY: rotationYFacing(lonToU(-85)),
    spinSpeed: 0.035,
    material: { roughness: 0.95, bumpScale: 1.5 },
    lighting: { keyIntensity: 2.5, ambientIntensity: 0.16, hemisphereIntensity: 0.28, fillIntensity: 0.2 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    surface: {
      style: 'rocky',
      baseColor: '#b0542c',
      // 北半球(低地)はやや明るい橙、南半球(高地)はやや暗い赤茶に。
      // 極付近は`polarCaps`が別途重なるので色を変えすぎない。
      latitudeStops: [
        { latDeg: 90, color: '#c9754a' },
        { latDeg: 40, color: '#cf8452' },
        { latDeg: 0, color: '#b0542c' },
        { latDeg: -40, color: '#9c4726' },
        { latDeg: -90, color: '#8f3f21' },
      ],
      noise: {
        seed: 21,
        octaves: 5,
        periodX: 8,
        frequencyY: 4,
        // 火星は地表のざらつきが見どころなので、月より強めに効かせる。
        amount: 0.45,
        contrast: 1.9,
        lightColor: '#dd9a63',
        darkColor: '#6f3319',
      },
      // 実際のアルベド地形。olympus-mons・valles-marineris・hellas-planitiaは
      // Phase 3の特徴スポット候補なのでidを安定させておく。
      patches: [
        { id: 'syrtis-major', lonDeg: 70, latDeg: 8, lonRadiusDeg: 17, latRadiusDeg: 16, color: '#5b3c29', opacity: 0.86, softness: 0.35 },
        { id: 'acidalia-planitia', lonDeg: -25, latDeg: 45, lonRadiusDeg: 33, latRadiusDeg: 18, color: '#67432f', opacity: 0.72, softness: 0.5 },
        { id: 'utopia-planitia', lonDeg: 118, latDeg: 45, lonRadiusDeg: 30, latRadiusDeg: 16, color: '#6b4732', opacity: 0.62, softness: 0.55 },
        { id: 'sinus-meridiani', lonDeg: -2, latDeg: -3, lonRadiusDeg: 12, latRadiusDeg: 7, color: '#5f3d2a', opacity: 0.8, softness: 0.4 },
        { id: 'mare-erythraeum', lonDeg: -40, latDeg: -25, lonRadiusDeg: 26, latRadiusDeg: 12, color: '#65422e', opacity: 0.75, softness: 0.45 },
        // ソリス湖(「火星の目」)。初期表示の正面付近に来る、丸くて分かりやすい暗色域。
        { id: 'solis-lacus', lonDeg: -88, latDeg: -27, lonRadiusDeg: 11, latRadiusDeg: 7, color: '#573824', opacity: 0.82, softness: 0.35 },
        { id: 'mare-sirenum', lonDeg: -155, latDeg: -30, lonRadiusDeg: 30, latRadiusDeg: 12, color: '#623f2c', opacity: 0.72, softness: 0.45 },
        { id: 'mare-cimmerium', lonDeg: 145, latDeg: -25, lonRadiusDeg: 30, latRadiusDeg: 12, color: '#65422e', opacity: 0.72, softness: 0.45 },
        { id: 'hellas-planitia', lonDeg: 70, latDeg: -42, lonRadiusDeg: 18, latRadiusDeg: 13, color: '#e3ac78', opacity: 0.7, softness: 0.4 },
        { id: 'arabia-terra', lonDeg: 20, latDeg: 20, lonRadiusDeg: 24, latRadiusDeg: 16, color: '#d2905b', opacity: 0.5, softness: 0.5 },
        { id: 'tharsis-rise', lonDeg: -105, latDeg: 5, lonRadiusDeg: 28, latRadiusDeg: 26, color: '#c98552', opacity: 0.45, softness: 0.55, relief: 0.25 },
        { id: 'olympus-mons', lonDeg: -134, latDeg: 18, lonRadiusDeg: 6.5, latRadiusDeg: 6.5, color: '#dda878', opacity: 0.75, softness: 0.3, relief: 0.85 },
        { id: 'olympus-caldera', lonDeg: -134, latDeg: 18, lonRadiusDeg: 1.8, latRadiusDeg: 1.8, color: '#6f3f24', opacity: 0.8, softness: 0.15, relief: -0.5 },
        { id: 'valles-marineris', lonDeg: -70, latDeg: -9, lonRadiusDeg: 38, latRadiusDeg: 3.2, rotationDeg: -7, color: '#4d3020', opacity: 0.88, softness: 0.2, relief: -0.9 },
      ],
      craters: [
        { id: 'huygens', lonDeg: 55, latDeg: -14, radiusDeg: 3.0, depth: 0.7 },
        { id: 'schiaparelli', lonDeg: -17, latDeg: -3, radiusDeg: 2.6, depth: 0.65 },
        { id: 'gale', lonDeg: 137, latDeg: -6, radiusDeg: 1.4, depth: 0.6 },
      ],
      scatteredCraters: { count: 150, minRadiusDeg: 0.5, maxRadiusDeg: 2.6, latLimitDeg: 68, depth: 0.42, seed: 33 },
      // 南極冠のほうがやや大きい(実際そう見える時期がある)。両極に必ず見えるようにする。
      polarCaps: { northEdgeLatDeg: 79, southEdgeLatDeg: -76, color: '#f2efe6', raggednessDeg: 4.5, seed: 12 },
    },
  },
  {
    id: 'jupiter',
    kind: 'planet',
    orbit: { radius: 255, angularSpeed: 0.1847 },
    displayName: 'もくせい',
    previewBackground:
      'linear-gradient(#efe4c6 0%, #8f6242 16%, #f0e4cc 32%, #8a5c3e 48%, #f2e7cf 62%, #9e7c5c 78%, #dfcdae 100%)',
    radius: 62,
    flattening: 0.065,
    axialTiltDegrees: 3.1,
    // 大赤斑が正面やや右にあり、最初から見えるが真正面固定にはしない。
    initialRotationY: rotationYFacing(lonToU(0)) - 0.1,
    spinSpeed: 0.045,
    material: { roughness: 1 },
    lighting: { keyIntensity: 2.2, ambientIntensity: 0.24, hemisphereIntensity: 0.34, fillIntensity: 0.26 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    surface: {
      style: 'gas',
      baseColor: '#d8bb92',
      // 実際の帯構造(ゾーン=明、ベルト=暗)に沿った20点。Phase 1の失敗(縞がぼやける)を
      // 繰り返さないよう、隣接stopのコントラストをはっきり付ける。
      belts: [
        { latDeg: 90, color: '#b9a48d' },
        { latDeg: 72, color: '#a89680' },
        { latDeg: 62, color: '#c7b49b' },
        { latDeg: 52, color: '#9e7c5c' },
        { latDeg: 44, color: '#dfcdae' },
        { latDeg: 34, color: '#a8825f' },
        { latDeg: 26, color: '#e7d7ba' },
        { latDeg: 18, color: '#8f6242' },
        { latDeg: 8, color: '#a06a45' },
        { latDeg: 4, color: '#efe2c6' },
        { latDeg: -4, color: '#f2e7cf' },
        { latDeg: -9, color: '#b07a52' },
        { latDeg: -16, color: '#8a5c3e' },
        { latDeg: -24, color: '#9b6a48' },
        { latDeg: -30, color: '#e3d2b3' },
        { latDeg: -40, color: '#a5835f' },
        { latDeg: -50, color: '#d9c7a8' },
        { latDeg: -62, color: '#9c8468' },
        { latDeg: -74, color: '#a89680' },
        { latDeg: -90, color: '#b9a48d' },
      ],
      turbulence: { seed: 5, octaves: 4, periodX: 8, frequencyY: 34, amplitudeDeg: 3.4 },
      mottle: { seed: 19, octaves: 4, periodX: 10, frequencyY: 26, amount: 0.16 },
      spots: [
        {
          // 大赤斑が乗る、周囲をわずかに明るくする"くぼみ"。
          id: 'great-red-spot-hollow',
          lonDeg: 0,
          latDeg: -22,
          lonRadiusDeg: 24,
          latRadiusDeg: 9,
          stops: [
            { at: 0, color: '#f1e2bf', opacity: 0.5 },
            { at: 1, color: '#f1e2bf', opacity: 0 },
          ],
        },
        {
          // 見かけの大きさ: 経度30度×緯度13度。実物(約経度18度×緯度11度)よりやや大きいが、
          // 幼児が普通に眺めて分かることを優先した意図的な強調。これ以上大きくしない。
          id: 'great-red-spot',
          lonDeg: 0,
          latDeg: -22,
          lonRadiusDeg: 15,
          latRadiusDeg: 6.5,
          rotationDeg: 0,
          stops: [
            { at: 0, color: '#b3452a', opacity: 1 },
            { at: 0.35, color: '#c0552f', opacity: 1 },
            { at: 0.62, color: '#cf7040', opacity: 0.92 },
            { at: 0.82, color: '#dda070', opacity: 0.6 },
            { at: 1, color: '#e0c39a', opacity: 0 },
          ],
          swirl: { turns: 2.2, color: '#8e3520', opacity: 0.35, width: 1.6 },
        },
        {
          id: 'white-oval-a',
          lonDeg: 52,
          latDeg: -33,
          lonRadiusDeg: 6,
          latRadiusDeg: 3,
          stops: [
            { at: 0, color: '#f2ead4', opacity: 0.55 },
            { at: 1, color: '#f2ead4', opacity: 0 },
          ],
        },
        {
          id: 'white-oval-b',
          lonDeg: -70,
          latDeg: -33,
          lonRadiusDeg: 5,
          latRadiusDeg: 2.6,
          stops: [
            { at: 0, color: '#f2ead4', opacity: 0.55 },
            { at: 1, color: '#f2ead4', opacity: 0 },
          ],
        },
        {
          // NEBの暗い樽状模様。
          id: 'brown-barge',
          lonDeg: -120,
          latDeg: 16,
          lonRadiusDeg: 9,
          latRadiusDeg: 2.6,
          stops: [
            { at: 0, color: '#7a5236', opacity: 0.5 },
            { at: 1, color: '#7a5236', opacity: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'saturn',
    kind: 'planet',
    orbit: { radius: 300, angularSpeed: 0.157 },
    displayName: 'どせい',
    previewBackground:
      'linear-gradient(#eddcb0 0%, #d3c095 22%, #f0e2b8 42%, #cabb90 60%, #e6d5a8 78%, #9aa3ad 100%)',
    radius: 54,
    flattening: 0.098,
    axialTiltDegrees: 26.7,
    initialRotationY: rotationYFacing(lonToU(0)),
    spinSpeed: 0.04,
    material: { roughness: 1 },
    lighting: { keyIntensity: 2.5, ambientIntensity: 0.2, hemisphereIntensity: 0.22, fillIntensity: 0.14 },
    // 輪をよく開いて見せるための視点上書き。
    viewDirection: { x: 0.3, y: 0.52, z: 0.8 },
    zoom: { outMargin: 1.08, inMargin: 0.62 },
    surface: {
      style: 'gas',
      baseColor: '#d9c193',
      // 木星よりコントラストを弱くし、色相は黄〜ベージュに寄せる。極域はやや青灰色寄りにする。
      belts: [
        { latDeg: 90, color: '#9aa3ad' },
        { latDeg: 78, color: '#b9ac8d' },
        { latDeg: 64, color: '#cdbd94' },
        { latDeg: 50, color: '#ddc99e' },
        { latDeg: 38, color: '#cabb90' },
        { latDeg: 26, color: '#e6d5a8' },
        { latDeg: 14, color: '#d3c093' },
        { latDeg: 4, color: '#f0e2b8' },
        { latDeg: -4, color: '#edddb0' },
        { latDeg: -14, color: '#d6c295' },
        { latDeg: -26, color: '#e3d2a5' },
        { latDeg: -38, color: '#c9b689' },
        { latDeg: -50, color: '#ddcda0' },
        { latDeg: -64, color: '#b9ac8d' },
        { latDeg: -78, color: '#a29a86' },
        { latDeg: -90, color: '#9aa3ad' },
      ],
      turbulence: { seed: 41, octaves: 4, periodX: 8, frequencyY: 30, amplitudeDeg: 2.2 },
      mottle: { seed: 63, octaves: 4, periodX: 10, frequencyY: 22, amount: 0.1 },
      spots: [],
    },
    ring: {
      segments: [
        {
          id: 'c-ring',
          innerRadiusRatio: 1.24,
          outerRadiusRatio: 1.52,
          bands: [
            { at: 0, color: '#a89275', opacity: 0 },
            { at: 0.15, color: '#a89275', opacity: 0.32 },
            { at: 0.6, color: '#b8a384', opacity: 0.38 },
            { at: 1, color: '#c6b291', opacity: 0.32 },
          ],
          ringlets: { seed: 3, count: 26, amount: 0.35 },
        },
        {
          id: 'b-ring',
          innerRadiusRatio: 1.53,
          outerRadiusRatio: 1.95,
          bands: [
            { at: 0, color: '#cbbb9b', opacity: 0.62 },
            { at: 0.12, color: '#efe3c6', opacity: 0.94 },
            { at: 0.45, color: '#f4ead2', opacity: 0.97 },
            { at: 0.72, color: '#e2d3b2', opacity: 0.9 },
            { at: 1, color: '#cfbf9d', opacity: 0.8 },
          ],
          ringlets: { seed: 11, count: 42, amount: 0.2 },
        },
        {
          id: 'a-ring',
          innerRadiusRatio: 2.02,
          outerRadiusRatio: 2.27,
          bands: [
            { at: 0, color: '#d3c4a4', opacity: 0.62 },
            { at: 0.3, color: '#ddcfb0', opacity: 0.7 },
            { at: 0.74, color: '#d6c7a7', opacity: 0.66 },
            // エンケ間隙。
            { at: 0.79, color: '#b5a68a', opacity: 0.12 },
            { at: 0.84, color: '#d4c5a5', opacity: 0.72 },
            { at: 1, color: '#c3b394', opacity: 0.4 },
          ],
          ringlets: { seed: 23, count: 30, amount: 0.18 },
        },
        {
          id: 'f-ring',
          innerRadiusRatio: 2.32,
          outerRadiusRatio: 2.36,
          bands: [
            { at: 0, color: '#e8dcc0', opacity: 0 },
            { at: 0.5, color: '#e8dcc0', opacity: 0.45 },
            { at: 1, color: '#e8dcc0', opacity: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'uranus',
    kind: 'planet',
    orbit: { radius: 345, angularSpeed: 0.1365 },
    displayName: 'てんのうせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #d3f3ec 0%, #c3ece4 45%, #a9d9d2 78%, #7fc0b7 100%)',
    radius: 58,
    flattening: 0.02,
    // 横倒しに近い自転軸。他の惑星と回転軸の向きがはっきり違って見える(値だけで表現でき、
    // tiltGroupの回転式や画面側に天王星専用の分岐は要らない)。
    axialTiltDegrees: 97.77,
    initialRotationY: rotationYFacing(lonToU(0)),
    spinSpeed: 0.03,
    material: { roughness: 1 },
    lighting: { keyIntensity: 2.3, ambientIntensity: 0.22, hemisphereIntensity: 0.3, fillIntensity: 0.22 },
    zoom: { outMargin: 1.15, inMargin: 0.6 },
    surface: {
      style: 'gas',
      baseColor: '#c3ece4',
      // 木星・海王星よりコントラストの弱い、のっぺりした青緑の大気。
      belts: [
        { latDeg: 90, color: '#a9d9d2' },
        { latDeg: 45, color: '#c3ece4' },
        { latDeg: 0, color: '#d3f3ec' },
        { latDeg: -45, color: '#c3ece4' },
        { latDeg: -90, color: '#a9d9d2' },
      ],
      turbulence: { seed: 97, octaves: 3, periodX: 8, frequencyY: 16, amplitudeDeg: 1.5 },
      mottle: { seed: 101, octaves: 3, periodX: 10, frequencyY: 20, amount: 0.08 },
      spots: [
        {
          id: 'uranus-storm',
          lonDeg: 40,
          latDeg: 20,
          lonRadiusDeg: 8,
          latRadiusDeg: 4,
          stops: [
            { at: 0, color: '#8fcdc3', opacity: 0.35 },
            { at: 1, color: '#8fcdc3', opacity: 0 },
          ],
        },
      ],
    },
    // 既存の輪(RingSpec)構造をそのまま流用した簡易表示。土星よりずっと細く淡い1本だけにする。
    ring: {
      segments: [
        {
          id: 'epsilon-ring',
          innerRadiusRatio: 1.5,
          outerRadiusRatio: 1.62,
          bands: [
            { at: 0, color: '#cfe3e0', opacity: 0 },
            { at: 0.5, color: '#cfe3e0', opacity: 0.35 },
            { at: 1, color: '#cfe3e0', opacity: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'neptune',
    kind: 'planet',
    orbit: { radius: 390, angularSpeed: 0.1208 },
    displayName: 'かいおうせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #6f95e8 0%, #3a6fe0 40%, #2c56b8 70%, #16265c 100%)',
    radius: 56,
    flattening: 0.02,
    axialTiltDegrees: 28.3,
    // 大暗斑が正面付近に見える面を初期表示にする。
    initialRotationY: rotationYFacing(lonToU(-20)),
    spinSpeed: 0.04,
    material: { roughness: 1 },
    lighting: { keyIntensity: 2.3, ambientIntensity: 0.22, hemisphereIntensity: 0.3, fillIntensity: 0.22 },
    zoom: { outMargin: 1.15, inMargin: 0.6 },
    surface: {
      style: 'gas',
      baseColor: '#3a6fe0',
      // 天王星より濃い青にし、turbulence・mottleも強めて「活動的」な差を付ける。
      belts: [
        { latDeg: 90, color: '#20408f' },
        { latDeg: 45, color: '#2c56b8' },
        { latDeg: 0, color: '#3a6fe0' },
        { latDeg: -45, color: '#2c56b8' },
        { latDeg: -90, color: '#20408f' },
      ],
      turbulence: { seed: 113, octaves: 4, periodX: 8, frequencyY: 24, amplitudeDeg: 3 },
      mottle: { seed: 127, octaves: 4, periodX: 10, frequencyY: 26, amount: 0.14 },
      spots: [
        {
          // 大暗斑(Great Dark Spot)。
          id: 'great-dark-spot',
          lonDeg: -20,
          latDeg: -22,
          lonRadiusDeg: 10,
          latRadiusDeg: 6,
          stops: [
            { at: 0, color: '#13245c', opacity: 0.75 },
            { at: 0.6, color: '#1c3373', opacity: 0.4 },
            { at: 1, color: '#3a6fe0', opacity: 0 },
          ],
          swirl: { turns: 1.6, color: '#0b1840', opacity: 0.3, width: 1.2 },
        },
        {
          id: 'neptune-bright-cloud',
          lonDeg: 60,
          latDeg: 10,
          lonRadiusDeg: 14,
          latRadiusDeg: 3,
          stops: [
            { at: 0, color: '#eaf2ff', opacity: 0.5 },
            { at: 1, color: '#eaf2ff', opacity: 0 },
          ],
        },
      ],
    },
  },
  {
    id: 'pluto',
    kind: 'dwarf-planet',
    // 海王星(390)よりずっと大きい間隔をあけ、8惑星の等間隔な並びに紛れないようにする。
    orbit: { radius: 480, angularSpeed: 0.0981 },
    displayName: 'めいおうせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #f5ead4 0%, #cdbba0 40%, #a89577 70%, #5f4f3c 100%)',
    radius: 34,
    axialTiltDegrees: 57,
    // トンボー地域(ハート形に見える明るい地形)が正面に見える面を初期表示にする。
    initialRotationY: rotationYFacing(lonToU(30)),
    spinSpeed: 0.025,
    material: { roughness: 1, bumpScale: 1.4 },
    lighting: { keyIntensity: 2.3, ambientIntensity: 0.12, hemisphereIntensity: 0.24, fillIntensity: 0.16 },
    zoom: { outMargin: 1.15, inMargin: 0.58 },
    surface: {
      style: 'rocky',
      baseColor: '#b7a58c',
      // 白・茶・灰色が入り混じった、まだらな準惑星の地表。
      latitudeStops: [
        { latDeg: 90, color: '#e8ddc9' },
        { latDeg: 30, color: '#cdbba0' },
        { latDeg: 0, color: '#b7a58c' },
        { latDeg: -30, color: '#a89577' },
        { latDeg: -90, color: '#8f7c62' },
      ],
      noise: {
        seed: 411,
        octaves: 5,
        periodX: 8,
        frequencyY: 5,
        amount: 0.42,
        contrast: 1.6,
        lightColor: '#eee2cc',
        darkColor: '#5f4f3c',
      },
      patches: [
        // トンボー地域(ハート形の明るい地形)。左右のふくらみと下向きの先端を重ねて、
        // 小さな球でもハートだと分かる輪郭にする。
        { id: 'tombaugh-regio-west', lonDeg: 20, latDeg: -5, lonRadiusDeg: 16, latRadiusDeg: 14, color: '#f2e6cf', opacity: 0.85, softness: 0.4 },
        { id: 'tombaugh-regio-east', lonDeg: 40, latDeg: -10, lonRadiusDeg: 14, latRadiusDeg: 12, color: '#f5ead4', opacity: 0.85, softness: 0.4 },
        { id: 'tombaugh-regio-tip', lonDeg: 31, latDeg: -19, lonRadiusDeg: 8, latRadiusDeg: 13, rotationDeg: 2, color: '#f5ead4', opacity: 0.78, softness: 0.46 },
        // スプートニク平原。トンボー地域の中でもひときわ明るい、なめらかな氷の平原。
        { id: 'sputnik-planitia', lonDeg: 30, latDeg: -8, lonRadiusDeg: 10, latRadiusDeg: 8, color: '#fbf3e2', opacity: 0.9, softness: 0.3, relief: -0.2 },
        // 暗い地形(トンボー地域との対比)。
        { id: 'dark-terrain', lonDeg: -120, latDeg: 0, lonRadiusDeg: 30, latRadiusDeg: 14, color: '#4a3d2e', opacity: 0.65, softness: 0.5 },
        // 氷の山。
        { id: 'icy-mountains', lonDeg: 15, latDeg: -20, lonRadiusDeg: 5, latRadiusDeg: 4, color: '#e4d8bf', opacity: 0.6, softness: 0.3, relief: 0.7 },
      ],
      craters: [{ id: 'pluto-crater-a', lonDeg: -60, latDeg: 30, radiusDeg: 2.4, depth: 0.5 }],
      scatteredCraters: { count: 60, minRadiusDeg: 0.4, maxRadiusDeg: 1.8, latLimitDeg: 70, depth: 0.35, seed: 410 },
      polarCaps: { northEdgeLatDeg: 82, southEdgeLatDeg: -80, color: '#f7f1e2', raggednessDeg: 6, seed: 412 },
    },
  },
] as const

const celestialBodiesById: Record<CelestialBodyId, CelestialBody> = Object.fromEntries(
  celestialBodies.map((body) => [body.id, body]),
) as Record<CelestialBodyId, CelestialBody>

/** id から天体定義を引く。全idが上の配列に定義されている前提でフォールバックは持たない。 */
export function celestialBodyById(id: CelestialBodyId): CelestialBody {
  return celestialBodiesById[id]
}

export const DEFAULT_CELESTIAL_BODY_ID: CelestialBodyId = 'moon'

/**
 * Phase 6の太陽系全体表示で描く天体(太陽・8惑星・冥王星)。`celestialBodies`と同じ
 * 太陽から外側への順序を保ったまま、`orbit`を持たない月だけを取り除く
 * (月は地球の衛星として全体表示側で別扱いにするため、ここには含めない)。
 */
export const solarSystemOverviewBodies: readonly CelestialBody[] = celestialBodies.filter(
  (body) => body.id !== 'moon',
)
