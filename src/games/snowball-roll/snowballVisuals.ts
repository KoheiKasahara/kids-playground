import * as THREE from 'three'
import { ITEM_TYPES, type ItemKind } from './snowballWorld'

/** Shared low-poly geometry/materials keep both download size and GPU allocation small. */
export function createSnowVisuals() {
  const sphere = new THREE.SphereGeometry(1, 16, 12)
  const box = new THREE.BoxGeometry(1, 1, 1)
  const cone = new THREE.ConeGeometry(1, 1, 12)
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12)
  const materials = new Map<string, THREE.MeshStandardMaterial>()
  function part(parent: THREE.Object3D, shape: THREE.BufferGeometry, color: string, position: number[], scale: number[]) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    const mesh = new THREE.Mesh(shape, materials.get(color))
    mesh.position.set(position[0]!, position[1]!, position[2]!)
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!)
    parent.add(mesh)
    return mesh
  }
  function item(kind: ItemKind, index: number) {
    const group = new THREE.Group()
    const color = ['#ec687c', '#64b9d2', '#f7be55', '#ad8ad6'][index % 4]!
    if (kind === 'acorn') {
      part(group, sphere, '#b87943', [0, 0.65, 0], [0.65, 0.8, 0.65])
      part(group, sphere, '#704832', [0, 1.12, 0], [0.78, 0.32, 0.78])
      part(group, cylinder, '#704832', [0, 1.5, 0], [0.13, 0.45, 0.13])
    } else if (kind === 'gift') {
      part(group, box, color, [0, 0.7, 0], [1.35, 1.4, 1.35])
      part(group, box, '#fff1b4', [0, 0.72, 0], [0.22, 1.46, 1.4])
      part(group, box, '#fff1b4', [0, 0.72, 0], [1.4, 1.46, 0.22])
      for (const x of [-0.22, 0.22]) part(group, sphere, '#fff1b4', [x, 1.52, 0], [0.25, 0.15, 0.18])
    } else if (kind === 'snowman') {
      part(group, sphere, '#f8fcff', [0, 0.65, 0], [0.7, 0.7, 0.7])
      part(group, sphere, '#ffffff', [0, 1.55, 0], [0.5, 0.5, 0.5])
      part(group, cylinder, color, [0, 1.15, 0], [0.5, 0.16, 0.5])
      part(group, cylinder, color, [0, 2.02, 0], [0.62, 0.1, 0.62])
      part(group, cylinder, color, [0, 2.23, 0], [0.38, 0.42, 0.38])
      for (const x of [-0.18, 0.18]) part(group, sphere, '#31485c', [x, 1.66, 0.45], [0.065, 0.065, 0.065])
      const nose = part(group, cone, '#ef9440', [0, 1.5, 0.6], [0.1, 0.42, 0.1])
      nose.rotation.x = Math.PI / 2
    } else if (kind === 'tree') {
      part(group, cylinder, '#876044', [0, 0.35, 0], [0.2, 0.7, 0.2])
      part(group, cone, '#398775', [0, 1.05, 0], [0.9, 1.6, 0.9])
      part(group, cone, '#70bba0', [0, 1.8, 0], [0.66, 1.3, 0.66])
      part(group, cone, '#f1fbff', [0, 2.13, 0], [0.36, 0.72, 0.36])
    } else {
      part(group, box, color, [0, 0.55, 0], [1.25, 0.6, 2])
      part(group, box, '#d3f3ff', [0, 1, -0.1], [1.04, 0.6, 1.05])
      part(group, box, color, [0, 1.32, -0.1], [1.17, 0.15, 1.18])
      for (const x of [-0.65, 0.65]) for (const z of [-0.62, 0.62]) {
        const wheel = part(group, cylinder, '#35485a', [x, 0.34, z], [0.31, 0.18, 0.31])
        wheel.rotation.z = Math.PI / 2
      }
      for (const x of [-0.4, 0.4]) part(group, box, '#fff2aa', [x, 0.63, 1.01], [0.24, 0.18, 0.05])
    }
    group.scale.setScalar(ITEM_TYPES[kind].size)
    return group
  }
  return {
    item, part, sphere, box, cone, cylinder,
    dispose() {
      for (const geometry of [sphere, box, cone, cylinder]) geometry.dispose()
      materials.forEach(material => material.dispose())
    },
  }
}
