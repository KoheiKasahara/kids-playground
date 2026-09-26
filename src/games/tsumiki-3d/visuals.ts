import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BLOCK_COLORS, findShape, type BlockColorId, type BlockShapeId } from './blocks'
import { MAT_RADIUS } from './placement'

/**
 * 3Dつみきの 見た目。がぞうファイルは つかわず、もくめ・ゆか・マットを Canvas で かいて
 * テクスチャに する。かどを まるめた かたち と クリアコートで、ぬった 木の おもちゃ に みせる。
 */

/** かどの まるみ。物理の はこ より ほんの すこし だけ ちいさく して、つんだ ときに めりこんで みえない ようにする。 */
const BEVEL = 0.05

/** きまった たねで ゆれる ランダム。まいかい おなじ もようを かく。 */
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  return { canvas, ctx }
}

/**
 * もくめ。strength が ちいさいと ぬった つみき（いろが こい）、おおきいと 木の いろ そのまま の つみき に つかう。
 * たてに ながれる すじを ずらしながら かさねて、ふしも すこし いれる。
 */
function woodGrainTexture(strength: number, base: string, seed: number) {
  const size = 256
  const { canvas, ctx } = makeCanvas(size, size)
  if (ctx) {
    const random = seeded(seed)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 70; i++) {
      const x0 = random() * size
      const wave = 4 + random() * 10
      const phase = random() * Math.PI * 2
      ctx.strokeStyle = `rgba(92, 52, 18, ${(0.05 + random() * 0.12) * strength})`
      ctx.lineWidth = 0.6 + random() * 2.2
      ctx.beginPath()
      for (let y = -4; y <= size + 4; y += 4) {
        const x = x0 + Math.sin(y / (18 + wave * 3) + phase) * wave
        if (y < 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      // よこに まわりこんで つなぎめを めだたなく する。
      ctx.save()
      ctx.translate(x0 > size / 2 ? -size : size, 0)
      ctx.stroke()
      ctx.restore()
    }
    for (let i = 0; i < 3; i++) {
      const x = random() * size
      const y = random() * size
      const knot = ctx.createRadialGradient(x, y, 0, x, y, 7 + random() * 6)
      knot.addColorStop(0, `rgba(80, 42, 12, ${0.35 * strength})`)
      knot.addColorStop(1, 'rgba(80, 42, 12, 0)')
      ctx.fillStyle = knot
      ctx.beginPath()
      ctx.ellipse(x, y, 5 + random() * 4, 12 + random() * 8, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** へやの ゆか。あたたかい いろの フローリング。 */
function floorTexture() {
  const size = 512
  const { canvas, ctx } = makeCanvas(size, size)
  if (ctx) {
    const random = seeded(41)
    const rows = 8
    const rowHeight = size / rows
    for (let row = 0; row < rows; row++) {
      let x = -random() * 200
      while (x < size) {
        const length = 150 + random() * 170
        const light = 64 + random() * 8
        ctx.fillStyle = `hsl(${30 + random() * 6} ${48 + random() * 10}% ${light}%)`
        ctx.fillRect(x, row * rowHeight, length, rowHeight)
        for (let i = 0; i < 9; i++) {
          ctx.strokeStyle = `rgba(120, 72, 32, ${0.05 + random() * 0.08})`
          ctx.lineWidth = 1 + random() * 1.5
          const y = row * rowHeight + random() * rowHeight
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.bezierCurveTo(x + length * 0.3, y + (random() - 0.5) * 8, x + length * 0.7, y + (random() - 0.5) * 8, x + length, y)
          ctx.stroke()
        }
        ctx.fillStyle = 'rgba(90, 52, 22, 0.35)'
        ctx.fillRect(x, row * rowHeight, 2, rowHeight)
        x += length
      }
      ctx.fillStyle = 'rgba(90, 52, 22, 0.3)'
      ctx.fillRect(0, row * rowHeight, size, 2)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 5)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** ゆかの はしを ふわっと けして、はいけいの グラデーションに なじませる。 */
function radialFadeTexture() {
  const size = 256
  const { canvas, ctx } = makeCanvas(size, size)
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.55, '#bbbbbb')
    gradient.addColorStop(1, '#000000')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

/**
 * まるい プレイマット。パステルの わ と ぬいめ、ほしの もようで、
 * 「ここに つもう」が ぱっと わかる ように する。
 */
function matTexture() {
  const size = 1024
  const { canvas, ctx } = makeCanvas(size, size)
  if (ctx) {
    const c = size / 2
    const random = seeded(7)
    const rings = ['#7cc6c9', '#f7efe0', '#f6b9a5', '#f7efe0', '#fbd98b', '#f7efe0']
    rings.forEach((color, index) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(c, c, c * (1 - index * 0.085), 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.fillStyle = '#fbf6ec'
    ctx.beginPath()
    ctx.arc(c, c, c * 0.49, 0, Math.PI * 2)
    ctx.fill()
    // こうし（うすく）。どこに おいたか わかる めやす。
    ctx.strokeStyle = 'rgba(160, 128, 96, 0.14)'
    ctx.lineWidth = 2
    const cell = c / MAT_RADIUS
    for (let i = -MAT_RADIUS; i <= MAT_RADIUS; i++) {
      const p = c + i * cell
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke()
    }
    // ぬいめ
    ctx.setLineDash([16, 12])
    ctx.lineCap = 'round'
    for (const [radius, color] of [[0.955, '#fffaf0'], [0.49, '#e6a88c']] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(c, c, c * radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.setLineDash([])
    // ほし もよう
    const star = (x: number, y: number, r: number, color: string, turn: number) => {
      ctx.fillStyle = color
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const angle = turn + (i * Math.PI) / 5 - Math.PI / 2
        const radius = i % 2 ? r * 0.45 : r
        ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
      }
      ctx.closePath()
      ctx.fill()
    }
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2
      const radius = c * 0.79
      star(c + Math.cos(angle) * radius, c + Math.sin(angle) * radius, 20, i % 2 ? '#ffffffcc' : '#e0795fb0', angle)
    }
    // ぬのの けば
    const image = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = (random() - 0.5) * 14
      image.data[i] += noise
      image.data[i + 1] += noise
      image.data[i + 2] += noise
    }
    ctx.putImageData(image, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** けむり・きらきら 用の ふんわり まる。 */
function softDotTexture() {
  const size = 64
  const { canvas, ctx } = makeCanvas(size, size)
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.6)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

/** えもじを かいた かんばん（たかさ の めあて に つかう）。 */
export function emojiTexture(emoji: string) {
  const size = 128
  const { canvas, ctx } = makeCanvas(size, size)
  if (ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#f0b64d'
    ctx.stroke()
    ctx.font = `${size * 0.56}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, size / 2, size / 2 + 5)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** よこ から 見た かたち を 0.05 だけ うちがわに けずる（ExtrudeGeometry の かど が そとへ ふくらむ ぶん）。 */
function extrude(shape: THREE.Shape, depth: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - BEVEL * 2,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 28,
  })
  geometry.translate(0, 0, -(depth - BEVEL * 2) / 2)
  // ExtrudeGeometry の UV は かたちの ざひょう そのまま。もくめが こまかく なりすぎない よう ひろげる。
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.45, uv.getY(i) * 0.45)
  return geometry
}

/** まるい ものの よこがお（LatheGeometry 用）。かどを まるめる。 */
function roundedProfile(radius: number, height: number, round: number, topRadius: number) {
  const points: THREE.Vector2[] = []
  const bottom = -height / 2
  const top = height / 2
  points.push(new THREE.Vector2(0, bottom))
  for (let i = 0; i <= 6; i++) {
    const angle = -Math.PI / 2 + (i / 6) * (Math.PI / 2)
    points.push(new THREE.Vector2(radius - round + Math.cos(angle) * round, bottom + round + Math.sin(angle) * round))
  }
  if (topRadius > round) {
    points.push(new THREE.Vector2(radius, top - round))
    for (let i = 1; i <= 6; i++) {
      const angle = (i / 6) * (Math.PI / 2)
      points.push(new THREE.Vector2(radius - round + Math.cos(angle) * round, top - round + Math.sin(angle) * round))
    }
  } else {
    // とんがり: さきっぽ だけ ちいさく まるめる。
    points.push(new THREE.Vector2(0.06, top - 0.04))
    points.push(new THREE.Vector2(0.025, top - 0.008))
  }
  points.push(new THREE.Vector2(0, top))
  return points
}

function createGeometry(id: BlockShapeId): THREE.BufferGeometry {
  const { size } = findShape(id)
  switch (id) {
    case 'cube':
    case 'plank':
      return new RoundedBoxGeometry(size.x, size.y, size.z, 4, BEVEL + 0.02)
    case 'pillar':
      return new THREE.LatheGeometry(roundedProfile(size.x / 2, size.y, 0.07, size.x / 2), 40)
    case 'cone':
      return new THREE.LatheGeometry(roundedProfile(size.x / 2, size.y, 0.06, 0), 40)
    case 'roof': {
      const hx = size.x / 2
      const hy = size.y / 2
      // さんかくの へりを BEVEL ぶん うちがわへ ずらす（3へんを それぞれ ずらした こうてん）。
      const slope = Math.atan2(size.y, hx)
      const inset = BEVEL
      const baseY = -hy + inset
      const sideShift = inset / Math.cos(slope)
      const baseHalf = hx - inset / Math.tan(slope / 2)
      const shape = new THREE.Shape()
      shape.moveTo(-baseHalf, baseY)
      shape.lineTo(baseHalf, baseY)
      shape.lineTo(0, hy - sideShift)
      shape.closePath()
      return extrude(shape, size.z)
    }
    case 'arch': {
      const hx = size.x / 2 - BEVEL
      const hy = size.y / 2 - BEVEL
      const hole = 0.5 + BEVEL
      const shape = new THREE.Shape()
      shape.moveTo(-hx, -hy)
      shape.lineTo(-hole, -hy)
      shape.absarc(0, -hy, hole, Math.PI, 0, true)
      shape.lineTo(hx, -hy)
      shape.lineTo(hx, hy)
      shape.lineTo(-hx, hy)
      shape.closePath()
      return extrude(shape, size.z)
    }
  }
}

export type TsumikiVisuals = ReturnType<typeof createTsumikiVisuals>

export function createTsumikiVisuals() {
  const geometries = new Map<BlockShapeId, THREE.BufferGeometry>()
  const materials = new Map<BlockColorId, THREE.MeshPhysicalMaterial>()
  const paintedGrain = woodGrainTexture(0.32, '#ffffff', 3)
  const naturalGrain = woodGrainTexture(1.6, '#f3dcb5', 11)
  const textures: THREE.Texture[] = [paintedGrain, naturalGrain]
  const disposables: { dispose(): void }[] = []

  const geometry = (id: BlockShapeId) => {
    let value = geometries.get(id)
    if (!value) {
      value = createGeometry(id)
      value.computeBoundingBox()
      geometries.set(id, value)
    }
    return value
  }

  const material = (id: BlockColorId) => {
    let value = materials.get(id)
    if (!value) {
      const color = BLOCK_COLORS.find(entry => entry.id === id)?.hex ?? '#ffffff'
      const natural = id === 'wood'
      value = new THREE.MeshPhysicalMaterial({
        color: natural ? '#ffffff' : color,
        map: natural ? naturalGrain : paintedGrain,
        roughness: natural ? 0.62 : 0.42,
        metalness: 0,
        clearcoat: natural ? 0.15 : 0.55,
        clearcoatRoughness: 0.32,
        sheen: 0.2,
        sheenColor: new THREE.Color('#ffffff'),
      })
      materials.set(id, value)
    }
    return value
  }

  /** おく まえの 「ここに おちるよ」の すけた つみき。 */
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.5,
    roughness: 0.3,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.25,
    depthWrite: false,
  })
  disposables.push(ghostMaterial)

  /** へやの ゆか・プレイマット・たかさの ものさし。 */
  function createRoom() {
    const group = new THREE.Group()
    const floorMap = floorTexture()
    const fade = radialFadeTexture()
    textures.push(floorMap, fade)
    const floorGeometry = new THREE.CircleGeometry(38, 72)
    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorMap, alphaMap: fade, transparent: true, roughness: 0.78, depthWrite: false })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.07
    floor.receiveShadow = true
    floor.renderOrder = -2
    group.add(floor)

    const matMap = matTexture()
    textures.push(matMap)
    const matGeometry = new THREE.CylinderGeometry(MAT_RADIUS + 0.35, MAT_RADIUS + 0.45, 0.07, 96)
    const matTop = new THREE.MeshStandardMaterial({ map: matMap, roughness: 0.95 })
    const matSide = new THREE.MeshStandardMaterial({ color: '#6fb8bb', roughness: 0.9 })
    // CylinderGeometry の グループ: 0=よこ 1=うえ 2=した
    const mat = new THREE.Mesh(matGeometry, [matSide, matTop, matSide])
    mat.position.y = -0.035
    mat.receiveShadow = true
    group.add(mat)
    disposables.push(floorGeometry, floorMaterial, matGeometry, matTop, matSide)
    return group
  }

  /** けむり・きらきら の ざいりょう。 */
  const dotTexture = softDotTexture()
  textures.push(dotTexture)

  return {
    geometry,
    material,
    ghostMaterial,
    dotTexture,
    createRoom,
    /** あとで すてる ものを とうろく する。 */
    track<T extends { dispose(): void }>(value: T): T {
      disposables.push(value)
      return value
    },
    dispose() {
      geometries.forEach(value => value.dispose())
      materials.forEach(value => value.dispose())
      textures.forEach(value => value.dispose())
      disposables.forEach(value => value.dispose())
      geometries.clear()
      materials.clear()
    },
  }
}
