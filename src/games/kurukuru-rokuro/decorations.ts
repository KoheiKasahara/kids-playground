import * as THREE from 'three'
import { floorHeight, innerRadiusAt } from './potGeometry'
import type { PotKind, Profile } from './pottery'

/**
 * やきあがった うつわを「つかってみる」かざり。できた かたちに あわせて
 * はないれ→チューリップ、コップ→ジュース、おちゃわん→ごはん、おさら→おだんご、つぼ→あめだま を いれる。
 */

const material = (color: string, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness })

function mesh(geometry: THREE.BufferGeometry, color: string, roughness?: number) {
  const node = new THREE.Mesh(geometry, material(color, roughness))
  node.castShadow = true
  return node
}

function tulips(profile: Profile): THREE.Group {
  const group = new THREE.Group()
  const opening = innerRadiusAt(profile, profile.height)
  const flowers = [
    { color: '#f0566e', tilt: -0.32, lean: 0.1, length: 1.05 },
    { color: '#f7d038', tilt: 0.02, lean: -0.16, length: 1.3 },
    { color: '#f59ac0', tilt: 0.34, lean: 0.06, length: 1.1 },
  ]
  flowers.forEach((flower, index) => {
    const stem = new THREE.Group()
    stem.position.set((index - 1) * opening * 0.35, profile.height - 0.45, 0)
    stem.rotation.set(flower.lean, 0, flower.tilt)
    const stalk = mesh(new THREE.CylinderGeometry(0.025, 0.032, flower.length, 6).translate(0, flower.length / 2, 0), '#4f9a3c', 0.7)
    const leaf = mesh(new THREE.SphereGeometry(0.1, 10, 8), '#5fb048', 0.7)
    leaf.scale.set(0.45, 1.6, 0.25)
    leaf.position.set(index === 1 ? -0.09 : 0.09, flower.length * 0.55, 0)
    leaf.rotation.z = index === 1 ? 0.5 : -0.5
    const bud = mesh(new THREE.SphereGeometry(0.15, 16, 12), flower.color, 0.45)
    bud.scale.set(1, 1.3, 1)
    bud.position.y = flower.length + 0.12
    const tips = new THREE.Group()
    for (let i = 0; i < 3; i++) {
      const tip = mesh(new THREE.ConeGeometry(0.07, 0.14, 8), flower.color, 0.45)
      const angle = (i / 3) * Math.PI * 2
      tip.position.set(Math.sin(angle) * 0.08, flower.length + 0.3, Math.cos(angle) * 0.08)
      tips.add(tip)
    }
    stem.add(stalk, leaf, bud, tips)
    group.add(stem)
  })
  return group
}

function juice(profile: Profile): THREE.Group {
  const group = new THREE.Group()
  const level = profile.height * 0.8
  const radius = innerRadiusAt(profile, level) - 0.01
  const surface = mesh(new THREE.CylinderGeometry(radius, radius, 0.03, 40), '#ff9f2e', 0.25)
  surface.position.y = level
  const tilt = -0.28
  const length = (profile.height - level + 0.3 + 0.6) / Math.cos(tilt)
  const straw = mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 10).translate(0, length / 2, 0), '#ff6f91', 0.4)
  straw.position.set(-radius * 0.35, level - 0.3, 0)
  straw.rotation.z = tilt
  group.add(surface, straw)
  return group
}

function rice(profile: Profile): THREE.Group {
  const group = new THREE.Group()
  const radius = innerRadiusAt(profile, profile.height) * 0.96
  const mound = mesh(new THREE.SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), '#fffaf0', 0.95)
  const rise = Math.min(0.5, radius * 0.45)
  mound.scale.y = rise / radius
  mound.position.y = profile.height - 0.08
  const plum = mesh(new THREE.SphereGeometry(0.12, 14, 10), '#d93a4a', 0.5)
  plum.position.y = profile.height - 0.08 + rise + 0.05
  group.add(mound, plum)
  return group
}

function dango(profile: Profile): THREE.Group {
  const group = new THREE.Group()
  const floor = floorHeight(profile.height)
  const size = Math.min(0.2, Math.max(0.1, innerRadiusAt(profile, floor) * 0.16))
  const colors = ['#f7a8c0', '#fbf7ee', '#9ccc65']
  colors.forEach((color, index) => {
    const ball = mesh(new THREE.SphereGeometry(size, 18, 12), color, 0.8)
    ball.position.set((index - 1) * size * 2, floor + size, 0)
    group.add(ball)
  })
  const length = size * 6 + 0.5
  const stick = mesh(new THREE.CylinderGeometry(0.025, 0.025, length, 6), '#d8b27a', 0.8)
  stick.rotation.z = Math.PI / 2
  stick.position.set(0.15, floor + size, 0)
  group.add(stick)
  return group
}

function candies(profile: Profile): THREE.Group {
  const group = new THREE.Group()
  const opening = innerRadiusAt(profile, profile.height)
  const size = Math.min(0.16, Math.max(0.08, opening * 0.35))
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f45']
  for (let i = 0; i < 8; i++) {
    const candy = mesh(new THREE.SphereGeometry(size, 16, 12), colors[i % colors.length]!, 0.25)
    const angle = i * 2.4
    const distance = opening * 0.55 * Math.sqrt(i / 8)
    candy.position.set(Math.sin(angle) * distance, profile.height - 0.02 + (1 - i / 8) * size * 1.4, Math.cos(angle) * distance)
    group.add(candy)
  }
  return group
}

const BUILDERS: Record<PotKind, (profile: Profile) => THREE.Group> = { vase: tulips, cup: juice, bowl: rice, plate: dango, jar: candies }

/** かざりが うつわの うえに どれだけ はみだすか（カメラの わくに いれるため）。 */
export const DECORATION_RISE: Record<PotKind, number> = { vase: 1.4, cup: 0.7, bowl: 0.6, plate: 0.3, jar: 0.3 }

export function createDecoration(kind: PotKind, profile: Profile): THREE.Group {
  const group = BUILDERS[kind](profile)
  group.name = `decoration-${kind}`
  return group
}
