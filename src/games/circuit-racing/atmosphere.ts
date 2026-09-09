import * as THREE from 'three'
import type { CircuitDefinition } from './circuit'
import { RACE_SUN_OFFSET } from './sceneryShadows'

const BIOMES = {
  grandPrix: ['#3e97d0', '#d7ebe6', '#568474'],
  stadium: ['#3b91c9', '#dfede9', '#6c9191'],
  forest: ['#4b9daa', '#d6e7cb', '#47775f'],
  alpine: ['#4b88b9', '#dce5ed', '#718b9a'],
  city: ['#438fc5', '#e9e4d6', '#8197a5'],
  coast: ['#278ac7', '#d9efe6', '#659c8e'],
} as const

/** A gradient sky, two distant ridge layers, and batched clouds: three static draws. */
export function createRaceAtmosphere(circuit: CircuitDefinition) {
  const colors = BIOMES[circuit.scenery]
  const skyGeometry = new THREE.SphereGeometry(1, 24, 12)
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: {
      zenith: { value: new THREE.Color(colors[0]) },
      horizon: { value: new THREE.Color(colors[1]) },
      sunDirection: { value: RACE_SUN_OFFSET.clone().normalize() },
    },
    vertexShader: `varying vec3 direction;
      void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 direction; uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDirection;
      void main() {
        vec3 ray = normalize(direction);
        float height = pow(max(ray.y, 0.0), 0.35);
        vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.65, height));
        float sun = pow(max(dot(ray, sunDirection), 0.0), 900.0);
        float glow = pow(max(dot(ray, sunDirection), 0.0), 16.0);
        gl_FragColor = vec4(color + vec3(1.0, 0.82, 0.5) * (sun * 1.4 + glow * 0.13), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(skyGeometry, skyMaterial)
  sky.name = 'race-sky'
  sky.renderOrder = -100
  sky.frustumCulled = false
  const group = new THREE.Group()
  group.name = 'race-atmosphere'
  group.add(sky)

  const positions: number[] = []
  const tints: number[] = []
  const baseColor = new THREE.Color(colors[2])
  const haze = new THREE.Color(colors[1])
  const color = new THREE.Color()
  for (let layer = 0; layer < 2; layer++) {
    const radius = 400 + layer * 115
    const count = 96
    const mountain = circuit.scenery === 'alpine'
    const heightAt = (angle: number) => (17 + (mountain ? 55 : 20)
      * (0.9 + Math.sin(angle * 5 + layer) * 0.4 + Math.sin(angle * 11) * 0.16 + Math.sin(angle * 23 + 2) * 0.1))
      * (circuit.scenery === 'coast' ? THREE.MathUtils.clamp((0.15 - Math.cos(angle)) / 0.25, 0, 1) : 1)
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2
      const b = (i + 1) / count * Math.PI * 2
      // Leave the eastern sea horizon open.
      if (circuit.scenery === 'coast' && Math.cos(a) > 0.15) continue
      const corners = [
        [Math.cos(a) * radius, -8, Math.sin(a) * radius],
        [Math.cos(a) * radius, heightAt(a), Math.sin(a) * radius],
        [Math.cos(b) * radius, heightAt(b), Math.sin(b) * radius],
        [Math.cos(b) * radius, -8, Math.sin(b) * radius],
      ]
      for (const corner of [0, 1, 2, 0, 2, 3]) {
        const point = corners[corner]!
        positions.push(...point)
        color.copy(baseColor).lerp(haze, layer * 0.22 + (point[1]! > 0 ? 0.28 : 0.08))
        tints.push(color.r, color.g, color.b)
      }
    }
  }
  const ridgeGeometry = new THREE.BufferGeometry()
  ridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  ridgeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3))
  const ridgeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })
  const ridges = new THREE.Mesh(ridgeGeometry, ridgeMaterial)
  ridges.name = 'distant-ridges'
  group.add(ridges)

  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1)
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#fff9ec', roughness: 1,
    emissive: '#aabfcd', emissiveIntensity: 0.3, fog: false })
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 48)
  clouds.name = 'clouds'
  const dummy = new THREE.Object3D()
  for (let i = 0; i < clouds.count; i++) {
    const cluster = Math.floor(i / 4)
    const lobe = i % 4
    const angle = cluster / 12 * Math.PI * 2
    const radius = 320 + (cluster % 3) * 37
    dummy.position.set(Math.cos(angle) * radius + (lobe - 1.5) * 14,
      (circuit.scenery === 'alpine' ? 88 : 53) + (cluster % 3) * 9 + (lobe % 2) * 5, Math.sin(angle) * radius)
    dummy.scale.set(17 + lobe * 2, 5 + lobe % 3 * 2, 9 + lobe * 2)
    dummy.updateMatrix()
    clouds.setMatrixAt(i, dummy.matrix)
  }
  clouds.computeBoundingSphere()
  group.add(clouds)
  return {
    group,
    horizonColor: new THREE.Color(colors[1]),
    update(camera: THREE.PerspectiveCamera) {
      sky.position.copy(camera.position)
      sky.scale.setScalar(camera.far * 0.9)
    },
    dispose() {
      clouds.dispose()
      for (const resource of [skyGeometry, skyMaterial, ridgeGeometry, ridgeMaterial, cloudGeometry, cloudMaterial]) resource.dispose()
      group.removeFromParent()
    },
  }
}
