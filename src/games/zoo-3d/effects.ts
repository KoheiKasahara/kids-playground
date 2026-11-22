// ふれあいの演出（ハート・音符・Zzz・水しぶき・キラキラ）とエサの小物。
// 粒は種類ごとに1つの Points（独自シェーダーで粒ごとの大きさ・透明度）にまとめ、描画呼び出しを抑える。

import * as THREE from 'three'

export type ParticleKind = 'heart' | 'note' | 'sleep' | 'water' | 'sparkle'

type Particle = { pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; gravity: number }

const CAPACITY: Record<ParticleKind, number> = { heart: 24, note: 16, sleep: 8, water: 140, sparkle: 40 }

function drawTexture(kind: ParticleKind): THREE.Texture {
  const size = 64
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : undefined
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return new THREE.Texture()
  canvas.width = canvas.height = size
  ctx.translate(size / 2, size / 2)
  if (kind === 'heart') {
    ctx.fillStyle = '#ff6f9c'
    ctx.beginPath()
    ctx.moveTo(0, 20)
    ctx.bezierCurveTo(-30, 0, -22, -24, 0, -10)
    ctx.bezierCurveTo(22, -24, 30, 0, 0, 20)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.arc(-9, -8, 4, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'note' || kind === 'sleep') {
    ctx.fillStyle = kind === 'note' ? '#ffb238' : '#8aa6ff'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.font = 'bold 44px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const text = kind === 'note' ? '♪' : 'Z'
    ctx.strokeText(text, 0, 2)
    ctx.fillText(text, 0, 2)
  } else if (kind === 'water') {
    const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 28)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, '#9fe2ff')
    g.addColorStop(1, 'rgba(80,180,240,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 28, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = '#fff3a0'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 9 : 28
      const a = (i / 8) * Math.PI * 2
      ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r)
    }
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const vertexShader = /* glsl */ `
attribute float size;
attribute float alpha;
varying float vAlpha;
uniform float scale;
void main() {
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`

const fragmentShader = /* glsl */ `
uniform sampler2D map;
varying float vAlpha;
void main() {
  vec4 c = texture2D(map, gl_PointCoord);
  if (c.a * vAlpha < 0.02) discard;
  gl_FragColor = vec4(c.rgb, c.a * vAlpha);
  #include <colorspace_fragment>
}`

class ParticlePool {
  readonly points: THREE.Points
  private particles: Particle[] = []
  private geometry = new THREE.BufferGeometry()
  private positions: Float32Array
  private sizes: Float32Array
  private alphas: Float32Array

  constructor(private kind: ParticleKind, private material: THREE.ShaderMaterial) {
    const n = CAPACITY[kind]
    this.positions = new Float32Array(n * 3)
    this.sizes = new Float32Array(n)
    this.alphas = new Float32Array(n)
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setDrawRange(0, 0)
    this.points = new THREE.Points(this.geometry, material)
    this.points.frustumCulled = false
    this.points.renderOrder = 10
    this.points.name = `zoo-particles-${kind}`
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, life: number, size: number, gravity = 0): void {
    if (this.particles.length >= CAPACITY[this.kind]) this.particles.shift()
    this.particles.push({ pos: pos.clone(), vel: vel.clone(), age: 0, life, size, gravity })
  }

  update(dt: number): void {
    const alive: Particle[] = []
    for (const p of this.particles) {
      p.age += dt
      if (p.age >= p.life) continue
      p.vel.y -= p.gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      if (this.kind === 'water' && p.pos.y < 0.05) continue
      alive.push(p)
    }
    this.particles = alive
    alive.forEach((p, i) => {
      const k = p.age / p.life
      this.positions.set([p.pos.x, p.pos.y, p.pos.z], i * 3)
      const pop = this.kind === 'water' ? 1 : Math.min(1, k * 6) * (1 + 0.15 * Math.sin(k * 12))
      this.sizes[i] = p.size * pop
      this.alphas[i] = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
    })
    this.geometry.setDrawRange(0, alive.length)
    for (const name of ['position', 'size', 'alpha']) (this.geometry.attributes[name] as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.uniforms.map.value.dispose()
    this.material.dispose()
  }
}

export type Effects = {
  group: THREE.Group
  burst: (kind: ParticleKind, at: THREE.Vector3, count?: number) => void
  spray: (from: THREE.Vector3, dir: THREE.Vector3, count: number) => void
  update: (dt: number) => void
  setScale: (pixelsPerUnit: number) => void
  dispose: () => void
}

export function createEffects(): Effects {
  const group = new THREE.Group()
  group.name = 'zoo-effects'
  const pools = new Map<ParticleKind, ParticlePool>()
  const kinds: ParticleKind[] = ['heart', 'note', 'sleep', 'water', 'sparkle']
  for (const kind of kinds) {
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: drawTexture(kind) }, scale: { value: 400 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    })
    const pool = new ParticlePool(kind, material)
    pools.set(kind, pool)
    group.add(pool.points)
  }
  const tmpV = new THREE.Vector3()
  const tmpP = new THREE.Vector3()
  return {
    group,
    burst(kind, at, count = 6) {
      const pool = pools.get(kind)!
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2
        const spread = kind === 'sleep' ? 0.1 : 0.45
        tmpP.copy(at).add(tmpV.set(Math.sin(a) * spread * Math.random(), Math.random() * 0.2, Math.cos(a) * spread * Math.random()))
        const rise = kind === 'sleep' ? 0.35 : 0.8 + Math.random() * 0.5
        tmpV.set(Math.sin(a) * 0.25, rise, Math.cos(a) * 0.25)
        const size = kind === 'sparkle' ? 0.35 : kind === 'sleep' ? 0.5 + i * 0.12 : 0.55
        pool.spawn(tmpP, tmpV, kind === 'sleep' ? 2.4 : 1.4 + Math.random() * 0.4, size)
      }
    },
    spray(from, dir, count) {
      const pool = pools.get('water')!
      for (let i = 0; i < count; i++) {
        tmpV.copy(dir).multiplyScalar(2.6 + Math.random() * 1.2)
        tmpV.x += (Math.random() - 0.5) * 0.9
        tmpV.y += (Math.random() - 0.5) * 0.6
        tmpV.z += (Math.random() - 0.5) * 0.9
        pool.spawn(from, tmpV, 1.4, 0.16 + Math.random() * 0.1, 6)
      }
    },
    update(dt) {
      for (const pool of pools.values()) pool.update(dt)
    },
    setScale(pixelsPerUnit) {
      for (const pool of pools.values()) (pool.points.material as THREE.ShaderMaterial).uniforms.scale.value = pixelsPerUnit
    },
    dispose() {
      for (const pool of pools.values()) pool.dispose()
    },
  }
}

// ---------------------------------------------------------------------------
// エサ

export type FoodKind = 'apple' | 'leaves' | 'meat' | 'bamboo' | 'fish' | 'grass' | 'watermelon' | 'carrot'

export function createFood(kind: FoodKind): THREE.Group {
  const group = new THREE.Group()
  group.name = `zoo-food-${kind}`
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true })
  if (kind === 'apple') {
    const apple = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mat('#e8413c'))
    apple.scale.set(1, 0.9, 1)
    apple.position.y = 0.15
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.08, 5), mat('#7a4b2a'))
    stem.position.y = 0.3
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat('#5cb84d'))
    leaf.scale.set(1.4, 0.3, 0.7)
    leaf.position.set(0.05, 0.31, 0)
    group.add(apple, stem, leaf)
  } else if (kind === 'leaves') {
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat(i % 2 ? '#6cc04f' : '#4fa443'))
      leaf.scale.set(1.3, 0.25, 0.7)
      leaf.position.set(Math.sin(i * 1.3) * 0.1, 0.06 + i * 0.03, Math.cos(i * 1.3) * 0.1)
      leaf.rotation.y = i * 1.3
      group.add(leaf)
    }
  } else if (kind === 'bamboo') {
    // 竹: 節のある緑の茎と、先の葉っぱ
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.16, 7), mat(i % 2 ? '#7cc35a' : '#6bb44c'))
      seg.position.set(0, 0.04, -0.17 + i * 0.17)
      seg.rotation.x = Math.PI / 2
      const node = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.02, 7), mat('#4e9a3c'))
      node.position.set(0, 0.04, -0.09 + i * 0.17)
      node.rotation.x = Math.PI / 2
      group.add(seg, node)
    }
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#5cb84d'))
      leaf.scale.set(0.4, 0.15, 1.3)
      leaf.position.set((i - 1) * 0.05, 0.06, 0.32)
      leaf.rotation.y = (i - 1) * 0.6
      group.add(leaf)
    }
  } else if (kind === 'carrot') {
    // にんじん: オレンジの円すいと緑の葉
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 8), mat('#f28a2e'))
    root.rotation.x = Math.PI / 2
    root.position.set(0, 0.06, 0.02)
    group.add(root)
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 4), mat('#5cb84d'))
      leaf.rotation.set(-Math.PI / 2 - 0.3, 0, (i - 1) * 0.45)
      leaf.position.set((i - 1) * 0.025, 0.08, -0.18)
      group.add(leaf)
    }
  } else if (kind === 'watermelon') {
    // スイカ: 緑の玉に濃い緑のしま
    const melon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), mat('#4caf50'))
    melon.scale.set(1, 0.9, 1.05)
    melon.position.y = 0.16
    group.add(melon)
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.183, 3, 9, (i / 6) * Math.PI * 2, 0.22), mat('#1f6e34'))
      stripe.scale.copy(melon.scale)
      stripe.position.y = 0.16
      group.add(stripe)
    }
  } else if (kind === 'grass') {
    // ほし草のたば: 細い葉を放射状に立て、根元をひもで結ぶ
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 4), mat(i % 3 ? '#9bc45a' : '#c8c46a'))
      blade.position.set(Math.sin(a) * 0.05, 0.17, Math.cos(a) * 0.05)
      blade.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35)
      group.add(blade)
    }
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 5, 10), mat('#c98b54'))
    tie.rotation.x = Math.PI / 2
    tie.position.y = 0.08
    group.add(tie)
  } else if (kind === 'fish') {
    // 魚: 青い体に白いおなか、三角の尾びれ
    const fish = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 7), mat('#5b8fd6'))
    fish.scale.set(0.55, 0.6, 1.3)
    fish.position.y = 0.08
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 5), mat('#e8f2fb'))
    belly.scale.set(0.5, 0.35, 1.2)
    belly.position.set(0, 0.05, 0.01)
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 4), mat('#4a78bd'))
    fin.rotation.x = -Math.PI / 2
    fin.scale.set(0.35, 1, 1)
    fin.position.set(0, 0.08, 0.2)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat('#1d2233'))
    eye.position.set(0.05, 0.1, -0.08)
    group.add(fish, belly, fin, eye)
  } else {
    const meat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), mat('#d8625a'))
    meat.scale.set(1.2, 0.8, 1)
    meat.position.y = 0.14
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 6), mat('#fff4e0'))
    bone.rotation.z = Math.PI / 2
    bone.position.set(0.18, 0.14, 0)
    const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), mat('#fff4e0'))
    knob.position.set(0.34, 0.14, 0)
    group.add(meat, bone, knob)
  }
  group.traverse(o => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true
  })
  return group
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse(o => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of materials) m.dispose()
  })
}
