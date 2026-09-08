import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { KomaVisualConfig } from './komaSpecs'

/** 少数の面で装甲を作り、同材質のパネルをまとめて描画する。外部テクスチャは不要。 */
export function createKomaArmor(visual: KomaVisualConfig, radius: number) {
  const style = visual.rimStyle
  const count = style === 'spike' ? 3 : style === 'block' ? 8 : style === 'star' ? 5 : 6
  const sweep = style === 'block' ? 0.03 : style === 'spike' ? 0.34 : 0.2
  const reach = style === 'spike' ? 1.19 : style === 'star' ? 1.1 : 1.04
  const sector = Math.PI * 2 / count
  const panels: THREE.BufferGeometry[] = []
  const inlays: THREE.BufferGeometry[] = []
  const extrude = (points: number[][], depth: number) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x * radius, y * radius)))
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: depth * radius, bevelEnabled: true, bevelSize: radius * 0.018,
      bevelThickness: radius * 0.015, bevelSegments: 1, curveSegments: 1,
    })
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }
  const polar = (angle: number, r: number) => [Math.cos(angle) * r, Math.sin(angle) * r]
  for (let i = 0; i < count; i++) {
    // 後方へ流れる幅広い刃。上面の濃い隙間で回転方向と積層感を見せる。
    const panel = extrude([
      polar(-sector * 0.36, 0.4), polar(-sector * 0.38, 0.81),
      polar(-sector * 0.18 + sweep, reach), polar(sector * 0.3 + sweep, reach * 0.95),
      polar(sector * 0.36, 0.61), polar(sector * 0.2, 0.4),
    ], style === 'block' ? 0.16 : 0.1)
    panel.rotateY(i * sector)
    panels.push(panel)
    const inlay = extrude([
      polar(-sector * 0.22, 0.51), polar(-sector * 0.23, 0.77),
      polar(sweep, 0.98), polar(sector * 0.11 + sweep, 0.91),
      polar(sector * 0.05, 0.6),
    ], 0.018)
    inlay.translate(0, radius * (style === 'block' ? 0.18 : 0.12), 0)
    inlay.rotateY(i * sector)
    inlays.push(inlay)
  }
  const armor = mergeGeometries(panels)!
  const trim = mergeGeometries(inlays)!
  panels.forEach((geometry) => geometry.dispose())
  inlays.forEach((geometry) => geometry.dispose())

  // つまみの代わりに、低く広いメダリオンへタイプの紋章を載せる。
  const emblemPoints = style === 'spike'
    ? [[0.1, 0.3], [-0.21, -0.03], [-0.04, -0.03], [-0.1, -0.3], [0.22, 0.07], [0.04, 0.07]]
    : style === 'block'
      ? [[-0.23, 0.22], [-0.23, -0.06], [0, -0.3], [0.23, -0.06], [0.23, 0.22]]
      : Array.from({ length: style === 'star' ? 10 : 12 }, (_, i) =>
        polar(Math.PI / 2 + i * Math.PI * 2 / (style === 'star' ? 10 : 12), i % 2 ? 0.14 : 0.29))
  const emblem = extrude(emblemPoints, 0.035)
  return { armor, trim, emblem }
}
