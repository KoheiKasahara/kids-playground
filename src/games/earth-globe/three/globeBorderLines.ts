import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import type { GlobeFeature } from '../types'
import { BASE_BORDER_RADIUS } from './globeLayers'

type Position = readonly [longitude: number, latitude: number]
type Ring = readonly Position[]
type Polygon = readonly Ring[]

// 元データは0.5°以下まで密度化済みで、球面の弦の沈み込みは
// 100 * (1 - cos(0.25°)) ≈ 0.001 world unit（最大ズームでも0.01px未満）しかない。
// これ以上細かく分割しても見た目は変わらず頂点数だけが増えるため、同じ0.5°に合わせる。
export const MAX_BORDER_SEGMENT_DEGREES = 0.5
// CSSピクセル単位の線幅。1デバイスピクセルの素の線と違い、DPRが変わっても太さが
// 変わらず、端がアンチエイリアスされるため階段状のギザつきが出ない。
export const BORDER_LINE_WIDTH = 1.3

function normalizedLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

function shortestLongitudeDelta(start: number, end: number): number {
  return ((end - start + 540) % 360) - 180
}

function positionAt(longitude: number, latitude: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latitude)
  const theta = THREE.MathUtils.degToRad(90 - longitude)
  const sinPhi = Math.sin(phi)

  return new THREE.Vector3(
    radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  )
}

function segmentCount(start: Position, end: Position): number {
  const longitudeDistance = shortestLongitudeDelta(start[0], end[0])
  const latitudeDistance = end[1] - start[1]
  return Math.max(
    1,
    Math.ceil(Math.hypot(longitudeDistance, latitudeDistance) / MAX_BORDER_SEGMENT_DEGREES),
  )
}

function polygonsOf(feature: GlobeFeature): readonly Polygon[] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Polygon]
    : feature.geometry.coordinates as readonly Polygon[]
}

/**
 * 国の当たり判定・面ポリゴンとは別に、滑らかな見た目用の国境線だけを生成する。
 * 1つのLineSegments2にまとめ、countryごとのObject3D増加を避ける。
 */
export function createGlobeBorderLines(
  features: readonly GlobeFeature[],
  radius = BASE_BORDER_RADIUS,
): LineSegments2 {
  const points: number[] = []

  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      for (const ring of polygon) {
        for (let index = 1; index < ring.length; index += 1) {
          const start = ring[index - 1]
          const end = ring[index]
          const segments = segmentCount(start, end)
          const longitudeDelta = shortestLongitudeDelta(start[0], end[0])
          const latitudeDelta = end[1] - start[1]

          for (let segment = 0; segment < segments; segment += 1) {
            const startRatio = segment / segments
            const endRatio = (segment + 1) / segments
            const startPosition = positionAt(
              normalizedLongitude(start[0] + longitudeDelta * startRatio),
              start[1] + latitudeDelta * startRatio,
              radius,
            )
            const endPosition = positionAt(
              normalizedLongitude(start[0] + longitudeDelta * endRatio),
              start[1] + latitudeDelta * endRatio,
              radius,
            )
            points.push(
              startPosition.x, startPosition.y, startPosition.z,
              endPosition.x, endPosition.y, endPosition.z,
            )
          }
        }
      }
    }
  }

  const geometry = new LineSegmentsGeometry()
  geometry.setPositions(points)
  geometry.computeBoundingSphere()
  // 素のLineSegmentsはWebGLの仕様上つねに1デバイスピクセル幅で、DPRを2に
  // 抑えたiPhoneでは細く霞む。板ポリゴンとして描くLineMaterialなら線幅を
  // CSSピクセルで指定でき、端はレンダラーのMSAAで滑らかになる。
  const material = new LineMaterial({
    color: '#173b75',
    linewidth: BORDER_LINE_WIDTH,
    worldUnits: false,
    // alphaToCoverageは線分の継ぎ目でカバレッジが合成されず、1px程度の短い線分が
    // 連なる地球全体表示では国境線が点線のように途切れて見える。MSAAだけを使う。
    alphaToCoverage: false,
    // 線同士が深度バッファを塞がないようにする。depthTestは維持するため背面は地球に隠れる。
    depthWrite: false,
  })
  return new LineSegments2(geometry, material)
}

/**
 * LineMaterialは線幅を画面解像度から逆算するため、描画サイズが変わるたびに伝える。
 * 単位はCSSピクセル（devicePixelRatioを掛けない値）。
 */
export function setGlobeBorderLinesSize(
  borderLines: LineSegments2,
  width: number,
  height: number,
): void {
  const materials = borderLines.material instanceof Array
    ? borderLines.material
    : [borderLines.material]

  materials.forEach((material) => {
    if (material instanceof LineMaterial) material.resolution.set(width, height)
  })
}

export function disposeGlobeBorderLines(borderLines: LineSegments2): void {
  borderLines.geometry.dispose()
  const materials = borderLines.material instanceof Array
    ? borderLines.material
    : [borderLines.material]
  materials.forEach((material) => material.dispose())
}
