import type { CelestialBody, CelestialBodyId } from '../types'
import { lonToU, rotationYFacing } from '../three/planetCoords'

/**
 * 4天体の見た目・大きさ・輪をまとめて表現するデータ。
 * `three/usePlanetEngine.ts` はこの配列の値だけを読んで3Dオブジェクトを組み立てる。
 * 天体が増えても、ここへ1件足すだけで済むようにする(画面・エンジン側に分岐を作らない)。
 *
 * 表面の模様(海、クレーター、極冠、大赤斑など)はすべて経度・緯度(度)で定義する。
 * ピクセルへの変換は `three/planetCoords.ts` と `three/planetSurface.ts` に一本化してあるため、
 * ここでは実際の天体地図に近い値をそのまま書けばよい。
 */
export const celestialBodies: readonly CelestialBody[] = [
  {
    id: 'moon',
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
] as const

const celestialBodiesById: Record<CelestialBodyId, CelestialBody> = Object.fromEntries(
  celestialBodies.map((body) => [body.id, body]),
) as Record<CelestialBodyId, CelestialBody>

/** id から天体定義を引く。全idが上の配列に定義されている前提でフォールバックは持たない。 */
export function celestialBodyById(id: CelestialBodyId): CelestialBody {
  return celestialBodiesById[id]
}

export const DEFAULT_CELESTIAL_BODY_ID: CelestialBodyId = 'moon'
