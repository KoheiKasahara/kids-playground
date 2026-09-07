import * as THREE from 'three'

/** Sample only the vehicle shell: signs and emergency lights are attachments themselves.
 * Called when rebuilding parts, never from the animation loop. Coordinates are car-local.
 */
export function createCarSurface(body: THREE.Object3D, lift: number) {
  body.updateWorldMatrix(true, true)
  const meshes: THREE.Object3D[] = []
  body.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (materials.some((material) => /^(Body|BodyLower|Accent|Trim|TrimDark|LightFront|LightRear)$/.test(material.name))) {
      meshes.push(object)
    }
  })
  const ray = new THREE.Raycaster()
  const inverse = body.matrixWorld.clone().invert()
  return (point: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 => {
    const local = point.clone()
    local.y -= lift
    const origin = local.clone().addScaledVector(normal, 20).applyMatrix4(body.matrixWorld)
    const direction = normal.clone().negate().transformDirection(body.matrixWorld)
    ray.set(origin, direction)
    const hit = ray.intersectObjects(meshes, false)[0]
    if (!hit) return point.clone()
    const result = hit.point.clone().applyMatrix4(inverse)
    result.y += lift
    return result
  }
}

export type CarSurface = ReturnType<typeof createCarSurface>
