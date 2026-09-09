import * as THREE from 'three'

/** An uneven ridge and snow line, contained in the same half-unit footprint as a cone. */
export function createMountainGeometry() {
  const vertices: number[] = []
  const colors: number[] = []
  const count = 9
  const rings = [0, 1, 2].map(layer => Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2
    const radius = [0.5, 0.32, 0.16][layer]! * (0.88 + Math.sin(i * 2.3 + layer) * 0.1)
    const height = [-0.5, -0.14, 0.19][layer]! + (layer ? Math.sin(i * 2.1) * 0.055 : 0)
    return new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
  }))
  const peak = new THREE.Vector3(0.045, 0.5, -0.04)
  function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, tint: THREE.Color) {
    for (const point of [a, b, c]) { vertices.push(...point.toArray()); colors.push(tint.r, tint.g, tint.b) }
  }
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count
    const rock = new THREE.Color(['#78858b', '#89949a', '#9ca39e'][i % 3]!)
    for (let layer = 0; layer < 2; layer++) {
      const lower = rings[layer]!
      const upper = rings[layer + 1]!
      triangle(lower[i]!, upper[i]!, lower[next]!, rock)
      triangle(lower[next]!, upper[i]!, upper[next]!, rock)
    }
    triangle(rings[2]![i]!, peak, rings[2]![next]!, new THREE.Color('#f0f1e8'))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
