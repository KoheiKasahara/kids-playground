import { InstancedMesh, type Object3D } from 'three'

/** 線路固有のinstance bufferだけを解放する。geometry/materialはengine全体で共有する。 */
export function releaseRailPiece(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof InstancedMesh) object.dispose()
  })
  root.clear()
  root.removeFromParent()
}
