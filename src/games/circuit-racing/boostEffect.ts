import * as THREE from 'three'

export const BOOST_DURATION_SECONDS = 1.6
const PARTICLE_COUNT = 40

// Soft billboards travel away from the rear bumper. No solid flame geometry,
// textures, or per-frame allocations; each car needs just one draw call.
export function createBoostEffect(rearZ: number, halfWidth: number): THREE.Group {
  const group = new THREE.Group()
  group.name = 'boost-effect'
  group.visible = false
  const quad = new THREE.PlaneGeometry(1, 1)
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = quad.index!.clone()
  geometry.setAttribute('position', quad.getAttribute('position').clone())
  geometry.setAttribute('uv', quad.getAttribute('uv').clone())
  quad.dispose()
  const seeds = new Float32Array(PARTICLE_COUNT * 3)
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    seeds.set([i / PARTICLE_COUNT, i % 2 ? 1 : -1, (i * 0.618034) % 1], i * 3)
  }
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 3))
  geometry.instanceCount = PARTICLE_COUNT
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      strength: { value: 0 },
      rearZ: { value: rearZ },
      halfWidth: { value: halfWidth },
    },
    vertexShader: `
      attribute vec3 seed;
      uniform float time;
      uniform float rearZ;
      uniform float halfWidth;
      varying vec2 effectUv;
      varying float life;
      varying float heat;
      void main() {
        float age = fract(seed.x + time * 2.2);
        vec3 center = vec3(
          seed.y * halfWidth * 0.62 + sin(seed.z * 23.0 + time * 13.0) * age * 0.16,
          0.42 + age * 0.18 + sin(seed.z * 17.0 + time * 10.0) * age * 0.12,
          rearZ - 0.12 - age * (2.5 + seed.z * 0.8)
        );
        vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
        // Align the feathered streak with the projected direction of travel.
        vec2 backward = (modelViewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xy;
        float projectedLength = length(backward);
        vec2 along = projectedLength > 0.001 ? backward / projectedLength : vec2(0.0, 1.0);
        vec2 across = vec2(along.y, -along.x);
        float width = (0.52 + sin(age * 3.14159) * 0.32) * (1.0 - age * 0.45);
        float size = width + projectedLength * (0.8 + age * 0.9);
        viewCenter.xy += across * position.x * width + along * position.y * size;
        gl_Position = projectionMatrix * viewCenter;
        effectUv = uv;
        heat = 1.0 - age;
        // Do not populate the entire trail on the first frame.
        life = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.25, 1.0, age));
        life *= smoothstep(0.0, 0.06, time - age / 2.2);
      }
    `,
    fragmentShader: `
      uniform float strength;
      varying vec2 effectUv;
      varying float life;
      varying float heat;
      void main() {
        vec2 p = effectUv * 2.0 - 1.0;
        float radius = length(p);
        float glow = exp(-dot(p, p) * 3.8) * (1.0 - smoothstep(0.65, 1.0, radius));
        vec3 color = mix(vec3(1.0, 0.16, 0.015), vec3(1.0, 0.68, 0.16), heat);
        color = mix(color, vec3(1.0, 0.95, 0.65), glow * heat * 0.8);
        gl_FragColor = vec4(color, glow * life * strength * 0.22);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const particles = new THREE.Mesh(geometry, material)
  particles.name = 'boost-particles'
  particles.frustumCulled = false
  group.add(particles)
  return group
}

export function animateBoostEffect(group: THREE.Group, remaining: number): void {
  group.visible = remaining > 0
  const particles = group.children[0] as THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>
  const elapsed = BOOST_DURATION_SECONDS - remaining
  particles.material.uniforms.time!.value = elapsed
  particles.material.uniforms.strength!.value = Math.max(0, Math.min(1, elapsed / 0.1, remaining / 0.3))
}
