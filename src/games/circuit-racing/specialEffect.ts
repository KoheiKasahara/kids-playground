import * as THREE from 'three'
import type { RaceCarId } from './raceConfig'
import { SPECIALS } from './special'

/** Fixed small mesh count; resources are owned and disposed by the car root. */
export function createSpecialEffect(id: RaceCarId): THREE.Group {
  const spec = SPECIALS[id]
  const group = new THREE.Group()
  group.visible = false
  const star = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 + Math.PI / 2
    const radius = i % 2 === 0 ? 0.7 : 0.3
    if (i === 0) star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
    else star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  star.closePath()
  const geometry = spec.shape === 'flame' ? new THREE.ConeGeometry(0.48, 2.4, 5)
    : spec.shape === 'star' ? new THREE.ShapeGeometry(star)
    : spec.shape === 'cloud' ? new THREE.IcosahedronGeometry(0.65, 0)
    : new THREE.TorusGeometry(1.65, 0.12, 4, 20)
  const colors = id === 'van' ? ['#ff6666', '#ffb347', '#ffe66d', '#70df93', '#62d8ff', '#8190ff', '#cc83ff', '#ff95cd'] : spec.colors
  const materials = colors.map(color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }))
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(geometry, materials[i % materials.length])
    mesh.position.set((i % 2 ? 1 : -1) * 1.35, 0.65 + (i % 3) * 0.5, 1.4 - Math.floor(i / 2) * 1.5)
    if (spec.shape === 'flame') mesh.rotation.x = -0.55
    if (spec.shape === 'ring') {
      mesh.position.set(0, 1, -i * 0.8)
      mesh.scale.setScalar(1 + i * 0.1)
    }
    group.add(mesh)
  }
  return group
}

export function animateSpecialEffect(group: THREE.Group, remaining: number): void {
  group.visible = remaining > 0
  if (!group.visible) return
  group.children.forEach((mesh, index) => {
    mesh.scale.setScalar(0.8 + Math.sin(remaining * 5 + index) * 0.2)
    mesh.rotation.z = remaining * 0.7 + index * 0.3
  })
}
