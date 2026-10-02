import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { KomaVisualConfig } from './komaSpecs'

/**
 * 円盤より下(軸・ドライバー部分)の見た目。物理Colliderには関係しない。
 *
 * slim   : 太めの円錐軸と、円盤の下の小さなカラー。従来の「こま」らしい形。
 * stacked: ベイブレードX風。歯の付いた半透明のラチェット層と、溝の入った太いビット(軸)を積む。
 *          横から見ても上下に厚みのある塊に見える。
 *
 * すべてのgeometryはローカル原点(先端の接地点)基準で頂点を焼き込み済みなので、
 * Meshは位置0のまま置けばよい。
 */
export type KomaDriverGeometry = {
  /** 接地する先端。メタル色で塗る。 */
  point: THREE.BufferGeometry
  /** 軸の本体。樹脂色で塗る。 */
  body: THREE.BufferGeometry
  /** stackedだけが持つ半透明のラチェット層。 */
  ratchet: THREE.BufferGeometry | null
}

function toothShape(teeth: number, outer: number, inner: number, tipRatio: number): THREE.Shape {
  const shape = new THREE.Shape()
  const step = (Math.PI * 2) / teeth
  const half = (step * tipRatio) / 2
  const points: [number, number][] = []
  for (let i = 0; i < teeth; i++) {
    const c = i * step
    points.push([c - step / 2, inner], [c - half, outer], [c + half, outer], [c + step / 2, inner])
  }
  points.forEach(([angle, r], index) => {
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()
  return shape
}

/** XY平面の輪郭をY方向へ押し出し、下端をbottomYに置く。 */
function extrudeUp(shape: THREE.Shape, bottomY: number, height: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, bottomY + bevel, 0)
  return geometry
}

function cylinder(top: number, bottom: number, bottomY: number, height: number, segments: number) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, segments).toNonIndexed()
  geometry.translate(0, bottomY + height / 2, 0)
  return geometry
}

function merge(parts: THREE.BufferGeometry[]) {
  // Extrudeはuvを持ち、Cylinderも持つが、groupsは不要なので落として1ドローコールにまとめる。
  parts.forEach((part) => part.clearGroups())
  const merged = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return merged
}

/**
 * @param diskBottomY 円盤下段の下端の高さ。ドライバーはここへ接するように積む。
 */
export function createKomaDriver(
  visual: KomaVisualConfig,
  diskRadius: number,
  diskBottomY: number,
): KomaDriverGeometry {
  if (visual.bodyStyle === 'stacked') {
    const flangeTop = diskBottomY - diskRadius * 0.22
    const ratchetHeight = diskBottomY - flangeTop + diskRadius * 0.02
    // ラチェット: 円盤の8割ほどの半径で、歯のギザギザが横からも見える厚い層。
    const ratchet = extrudeUp(
      toothShape(visual.rimStyle === 'block' ? 10 : 7, diskRadius * 0.84, diskRadius * 0.7, 0.55),
      flangeTop,
      ratchetHeight,
      diskRadius * 0.02,
    )

    const flangeHeight = diskRadius * 0.09
    const bodyTop = flangeTop - flangeHeight
    const pointHeight = diskRadius * 0.17
    const bodyHeight = bodyTop - pointHeight
    const body = merge([
      // ビット上部のつば。ラチェットを受ける広い土台。
      cylinder(diskRadius * 0.52, diskRadius * 0.44, bodyTop, flangeHeight, 20),
      // 縦溝の入った太い胴。タイヤのような凹凸で回転が目で追える。
      extrudeUp(toothShape(14, diskRadius * 0.37, diskRadius * 0.31, 0.5), pointHeight, bodyHeight, 0),
      cylinder(diskRadius * 0.3, diskRadius * 0.3, pointHeight, bodyHeight, 16),
    ])
    // 先端: 胴から接地点へ絞る短い円錐台。
    const point = cylinder(diskRadius * 0.28, diskRadius * 0.1, 0, pointHeight, 16)
    return { point, body, ratchet }
  }

  // slim: 従来より太い円錐軸 + 円盤直下のカラーで、横からの細さを和らげる。
  const collarHeight = diskRadius * 0.14
  const collarBottom = diskBottomY - collarHeight
  const point = cylinder(diskRadius * 0.3, diskRadius * 0.06, 0, collarBottom + 0.005, 16)
  const body = merge([
    cylinder(diskRadius * 0.5, diskRadius * 0.34, collarBottom, collarHeight + 0.005, 20),
    // 軸の中ほどに締まったリングを入れ、単調な円錐に段を付ける。
    cylinder(diskRadius * 0.27, diskRadius * 0.22, collarBottom * 0.45, collarBottom * 0.14, 16),
  ])
  return { point, body, ratchet: null }
}
