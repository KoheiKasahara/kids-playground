import type { CelestialBody, CelestialBodyId } from '../types'

/**
 * 4天体の見た目・大きさ・輪をまとめて表現するデータ。
 * `three/usePlanetEngine.ts` はこの配列の値だけを読んで3Dオブジェクトを組み立てる。
 * 天体が増えても、ここへ1件足すだけで済むようにする（画面・エンジン側に分岐を作らない）。
 */
export const celestialBodies: readonly CelestialBody[] = [
  {
    id: 'moon',
    displayName: 'つき',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #eceae2 0%, #b9b7ae 52%, #7c7a74 100%)',
    radius: 46,
    axialTiltDegrees: 6.7,
    initialRotationY: 0.35,
    spinSpeed: 0.05,
    surface: {
      baseColor: '#b9b7ae',
      bands: [
        { at: 0, color: '#c8c6be' },
        { at: 0.4, color: '#b0aea5' },
        { at: 0.62, color: '#a5a39a' },
        { at: 1, color: '#bdbbb2' },
      ],
      speckles: {
        count: 130,
        minRadius: 0.006,
        maxRadius: 0.045,
        color: '#8d8b83',
        rimColor: '#d8d6ce',
        opacity: 0.5,
        seed: 7,
      },
    },
    material: { roughness: 1 },
    zoom: { outMargin: 1.28, inMargin: 0.62 },
  },
  {
    id: 'mars',
    displayName: 'かせい',
    previewBackground:
      'radial-gradient(circle at 34% 30%, #e8935f 0%, #b5502a 52%, #6d2c15 100%)',
    radius: 48,
    axialTiltDegrees: 25.2,
    initialRotationY: 1.1,
    spinSpeed: 0.06,
    surface: {
      baseColor: '#b5502a',
      // 南北の極冠(白)を、極(0/1)付近だけ明るくすることで表す。
      bands: [
        { at: 0, color: '#f4f1ea' },
        { at: 0.06, color: '#e9e2d6' },
        { at: 0.11, color: '#bd6132' },
        { at: 0.42, color: '#a94a25' },
        { at: 0.62, color: '#c15c2c' },
        { at: 0.9, color: '#c98d5c' },
        { at: 0.95, color: '#efeae1' },
        { at: 1, color: '#f6f3ec' },
      ],
      speckles: {
        count: 95,
        minRadius: 0.01,
        maxRadius: 0.055,
        color: '#8a3a1c',
        opacity: 0.4,
        seed: 21,
      },
    },
    material: { roughness: 0.95 },
    zoom: { outMargin: 1.28, inMargin: 0.62 },
  },
  {
    id: 'jupiter',
    displayName: 'もくせい',
    previewBackground:
      'linear-gradient(#efe0c6 0%, #c69a72 18%, #f2e7d2 34%, #b07f5e 52%, #eaddc0 70%, #bd8a63 88%, #e8dcc2 100%)',
    radius: 62,
    axialTiltDegrees: 3.1,
    initialRotationY: 0,
    spinSpeed: 0.1,
    surface: {
      baseColor: '#dcc099',
      // 木星らしいはっきりした横縞: クリームと茶を交互に14点並べる。
      bands: [
        { at: 0, color: '#f0e4cc' },
        { at: 0.08, color: '#b98a5f' },
        { at: 0.16, color: '#f0e4cc' },
        { at: 0.24, color: '#a2724d' },
        { at: 0.32, color: '#f0e4cc' },
        { at: 0.4, color: '#b98a5f' },
        { at: 0.48, color: '#f0e4cc' },
        { at: 0.56, color: '#a2724d' },
        { at: 0.64, color: '#f0e4cc' },
        { at: 0.72, color: '#b98a5f' },
        { at: 0.8, color: '#f0e4cc' },
        { at: 0.88, color: '#a2724d' },
        { at: 0.96, color: '#f0e4cc' },
        { at: 1, color: '#b98a5f' },
      ],
      speckles: {
        count: 40,
        minRadius: 0.008,
        maxRadius: 0.03,
        color: '#a9764f',
        opacity: 0.22,
        seed: 33,
      },
    },
    material: { roughness: 0.85 },
    zoom: { outMargin: 1.24, inMargin: 0.6 },
  },
  {
    id: 'saturn',
    displayName: 'どせい',
    previewBackground:
      'linear-gradient(#f2e6c4 0%, #d9c193 30%, #efe3c2 55%, #cbae7d 80%, #e6d8b0 100%)',
    radius: 54,
    axialTiltDegrees: 26.7,
    initialRotationY: 0.6,
    spinSpeed: 0.09,
    surface: {
      baseColor: '#e0cba0',
      // 木星より弱いコントラストの淡い黄〜褐色の縞。
      bands: [
        { at: 0, color: '#f2e6c4' },
        { at: 0.14, color: '#e6d8b0' },
        { at: 0.28, color: '#efe3c2' },
        { at: 0.42, color: '#d9c193' },
        { at: 0.56, color: '#eadfc2' },
        { at: 0.7, color: '#cbae7d' },
        { at: 0.85, color: '#e6d8b0' },
        { at: 1, color: '#f2e6c4' },
      ],
      speckles: {
        count: 24,
        minRadius: 0.006,
        maxRadius: 0.02,
        color: '#c2ab7c',
        opacity: 0.12,
        seed: 55,
      },
    },
    material: { roughness: 0.9 },
    zoom: { outMargin: 1.16, inMargin: 0.62 },
    ring: {
      innerRadiusRatio: 1.35,
      outerRadiusRatio: 2.25,
      bands: [
        { at: 0, color: '#d9c9a4', opacity: 0 },
        { at: 0.06, color: '#e6d8b6', opacity: 0.55 },
        { at: 0.34, color: '#f0e6cd', opacity: 0.85 },
        // カッシーニ間隙の"気配"程度に、輪の途中を一段暗くする。
        { at: 0.46, color: '#cbbb98', opacity: 0.25 },
        { at: 0.58, color: '#eadfc2', opacity: 0.8 },
        { at: 0.88, color: '#d6c7a2', opacity: 0.45 },
        { at: 1, color: '#cfc09c', opacity: 0 },
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
