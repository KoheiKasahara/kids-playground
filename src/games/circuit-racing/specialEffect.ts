import * as THREE from 'three'
import type { RaceCarId } from './raceConfig'
import { SPECIALS, SPECIAL_DURATION_SECONDS } from './special'

const PARTICLE_COUNT = 36

// Camera-facing quads have soft analytic edges, with no texture download or
// point-size hardware limit. All particles share one instanced draw call.
const vertexShader = `
  attribute vec3 particle;
  attribute vec3 tint;
  uniform float time;
  uniform float kind;
  varying vec2 effectUv;
  varying vec3 effectColor;
  varying float life;
  void main() {
    float age = fract(particle.x + time * 0.85);
    float side = particle.y;
    float spread = particle.z;
    vec3 center = vec3(side * (1.15 + age * 0.45), 0.55, 1.1 - age * 7.5);
    float size = 0.9 + age * 0.9;
    if (kind < 0.5) {
      center.x += sin(time * 6.0 + particle.x * 18.0) * age * 0.25;
      center.y += age * (1.0 + spread);
      size = 1.15 + sin(age * 3.14159) * 0.6;
    } else if (kind < 1.5) {
      center.x += side * age * spread;
      center.y += spread * 1.7 + sin(age * 6.28) * 0.35;
      size = 0.65 + spread * 0.55;
    } else if (kind < 2.5) {
      center.x += side * age * 1.5;
      center.y += age * (0.5 + spread);
      size = 0.7 + age * 2.3;
    } else {
      center.x = side * (1.25 + sin(age * 5.0 + time * 2.0) * 0.25);
      center.y = 0.7 + spread * 0.9;
      size = 1.0 + age * 0.5;
    }
    vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
    viewCenter.xy += position.xy * size;
    gl_Position = projectionMatrix * viewCenter;
    effectUv = uv;
    effectColor = tint;
    life = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.45, 1.0, age));
  }
`

const fragmentShader = `
  uniform float kind;
  uniform float strength;
  varying vec2 effectUv;
  varying vec3 effectColor;
  varying float life;
  void main() {
    vec2 p = effectUv * 2.0 - 1.0;
    float radius = length(p);
    float glow = exp(-radius * radius * 5.0) * (1.0 - smoothstep(0.7, 1.0, radius));
    vec3 color = effectColor;
    float alpha = glow;
    if (kind < 0.5) {
      // A tapered, feathered flame with a hot core, not a solid cone.
      vec2 flame = vec2(p.x / max(0.22, 0.65 - p.y * 0.35), (p.y + 0.2) * 0.9);
      float heat = exp(-dot(flame, flame) * 2.6);
      alpha = heat * (1.0 - smoothstep(0.65, 1.0, radius));
      color = mix(effectColor, vec3(1.0, 0.9, 0.45), heat * 0.75);
    } else if (kind < 1.5) {
      float rays = exp(-abs(p.x * p.y) * 65.0) * pow(max(0.0, 1.0 - radius), 2.0);
      alpha = max(glow * 0.5, rays);
      color = mix(effectColor, vec3(1.0), glow * 0.65);
    } else if (kind < 2.5) {
      alpha = glow * 0.38;
    }
    gl_FragColor = vec4(color, alpha * life * strength);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Resources stay attached to the car root for the engine's existing disposal. */
export function createSpecialEffect(id: RaceCarId): THREE.Group {
  const spec = SPECIALS[id]
  const group = new THREE.Group()
  group.visible = false
  const quad = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = quad.index!.clone()
  geometry.setAttribute('position', quad.getAttribute('position').clone())
  geometry.setAttribute('uv', quad.getAttribute('uv').clone())
  quad.dispose()
  const colors = id === 'van'
    ? ['#ff6666', '#ffb347', '#ffe66d', '#70df93', '#62d8ff', '#8190ff', '#cc83ff', '#ff95cd']
    : spec.colors
  const particles = new Float32Array(PARTICLE_COUNT * 3)
  const tints = new Float32Array(PARTICLE_COUNT * 3)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.set([i / PARTICLE_COUNT, i % 2 ? 1 : -1, (i * 0.618034) % 1], i * 3)
    new THREE.Color(colors[i % colors.length]).toArray(tints, i * 3)
  }
  geometry.setAttribute('particle', new THREE.InstancedBufferAttribute(particles, 3))
  geometry.setAttribute('tint', new THREE.InstancedBufferAttribute(tints, 3))
  geometry.instanceCount = PARTICLE_COUNT
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      kind: { value: ['flame', 'star', 'cloud', 'ring'].indexOf(spec.shape) },
      strength: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: spec.shape === 'cloud' ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
  })
  const particlesMesh = new THREE.Mesh(geometry, material)
  particlesMesh.name = 'special-particles'
  // Positions move in the shader; the base quad's bounds do not cover the trail.
  particlesMesh.frustumCulled = false
  group.add(particlesMesh)
  return group
}

export function animateSpecialEffect(group: THREE.Group, remaining: number): void {
  group.visible = remaining > 0
  if (!group.visible) return
  const particles = group.children[0] as THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>
  const elapsed = SPECIAL_DURATION_SECONDS - remaining
  particles.material.uniforms.time!.value = elapsed
  particles.material.uniforms.strength!.value = Math.min(1, (elapsed + 0.05) / 0.2, remaining / 0.35)
}
