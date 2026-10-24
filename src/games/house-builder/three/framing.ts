import * as THREE from 'three'

/** そとの おうちと にわの ものを、いまの むき・がめんの たてよこひで おさめる。 */
export function fitExterior(points: readonly THREE.Vector3[], yaw: number, pitch: number, verticalFov: number, horizontalFov: number) {
  const forward = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
  const up = new THREE.Vector3().crossVectors(forward, right)
  const projected = points.map((p) => new THREE.Vector3(p.dot(right), p.dot(up), p.dot(forward)))
  const center = new THREE.Box3().setFromPoints(projected).getCenter(new THREE.Vector3())
  const target = right.clone().multiplyScalar(center.x).addScaledVector(up, center.y).addScaledVector(forward, center.z)
  const tanX = Math.tan(horizontalFov / 2)
  const tanY = Math.tan(verticalFov / 2)
  let distance = 1
  for (const p of projected) {
    // てまえの ものほど おおきく うつる ぶんも ふくめる。まわりに すこし よはくを のこす。
    const depth = p.z - center.z
    distance = Math.max(distance, (Math.abs(p.x - center.x) + .25) / tanX + depth, (Math.abs(p.y - center.y) + .25) / tanY + depth)
  }
  return { target, distance: distance * 1.08 }
}

/** かざり・かべ・やね ごとの はこを つかうと、そらや あきちの よはくに ひっぱられない。 */
export function exteriorFramePoints(objects: readonly THREE.Object3D[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (const object of objects) {
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) continue
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z))
  }
  return points
}
