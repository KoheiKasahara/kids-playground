import * as THREE from 'three'
import { getDominoFlagDefinition, type DominoFlagId } from './flagDefinitions'
import { DOMINO_DEPTH, DOMINO_HEIGHT, FLAG_PITCH_Z, type DominoPlacement } from './dominoLayout'

/** Keep the printed face clear of solver penetration and the wooden face. */
export const FLAG_FACE_CLEARANCE = 0.025

export function createFlagFaceLocalMatrix(): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(0, 0, -0.5 - FLAG_FACE_CLEARANCE / DOMINO_DEPTH),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
    new THREE.Vector3(0.96, 0.94, 1),
  )
}

export const FLAG_FINISH_DURATION_MS = 650

/** A clean, non-overlapping mosaic after the physical chain has completed. */
export function completedFlagBodyMatrix(placement: DominoPlacement): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(placement.x, DOMINO_DEPTH / 2, placement.z + DOMINO_HEIGHT / 2),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
    new THREE.Vector3(placement.width, FLAG_PITCH_Z * 0.98, DOMINO_DEPTH),
  )
}

/** Project the artwork over the fallen surface so overlapping dominoes do not
 * hide a slice of each tile (which would erase small stars and coat-of-arms).
 * The instance matrices already contain the -Z face rotation, so X is not mirrored.
 */
export function flagPrintBounds(placements: readonly DominoPlacement[]): THREE.Vector4 {
  const minX = Math.min(...placements.map((p) => p.x - p.width * 0.96 / 2))
  const maxX = Math.max(...placements.map((p) => p.x + p.width * 0.96 / 2))
  const halfPrintedHeight = FLAG_PITCH_Z * 0.98 * 0.94 / 2
  const minZ = Math.min(...placements.map((p) => p.z)) + DOMINO_HEIGHT / 2 - halfPrintedHeight
  const maxZ = Math.max(...placements.map((p) => p.z)) + DOMINO_HEIGHT / 2 + halfPrintedHeight
  return new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ)
}

export function configureFlagFaceTexture(
  material: THREE.MeshBasicMaterial,
  placements: readonly DominoPlacement[],
): void {
  const bounds = flagPrintBounds(placements)
  material.polygonOffset = true
  material.polygonOffsetFactor = -2
  material.polygonOffsetUnits = -2
  material.onBeforeCompile = (shader) => {
    shader.uniforms.flagPrintBounds = { value: bounds }
    shader.vertexShader = 'uniform vec4 flagPrintBounds;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      #ifdef USE_MAP
        vec3 flagPosition = (instanceMatrix * vec4(position, 1.0)).xyz;
        vMapUv = (flagPosition.xz - flagPrintBounds.xy) / flagPrintBounds.zw;
        vMapUv.y = 1.0 - vMapUv.y;
      #endif
    `)
  }
  material.customProgramCacheKey = () => 'domino-flag-projection-v1'
}

/** One shared texture per game, irrespective of the number of dominoes. */
export async function loadFlagFaceTexture(id: DominoFlagId): Promise<THREE.CanvasTexture> {
  const image = await new THREE.ImageLoader().loadAsync(
    `${import.meta.env.BASE_URL}${getDominoFlagDefinition(id).imagePath}`,
  )
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const context = canvas.getContext('2d')
  if (!context) throw new Error('国旗の描画に失敗しました')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
