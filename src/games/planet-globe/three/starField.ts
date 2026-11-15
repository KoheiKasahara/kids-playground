import * as THREE from 'three'
import { createRandom } from './planetSurface'

/**
 * 背景の星。CSSの静止した点描(Phase 1)をやめてWebGL側に置くことで、
 * カメラの向きに応じて星も一緒に回り、宇宙の中にいる感覚を出す。
 * 主役は天体なので、輝度は抑えて演出は入れない(流れる・瞬く等はしない)。
 *
 * 奥行きを出すため、星ごとに大きさ・明るさ・色温度(青白〜橙)を変え、一部を天の川のような
 * 帯へ寄せて密度にむらを作る。描画は1つのPoints(1ドローコール)のまま、
 * 星ごとの大きさだけを頂点属性で持つ軽量なシェーダーで描く。
 */
export const STAR_COUNT = 900
/** `planetCamera.CAMERA_FAR`(3000)の内側に収まる半径。 */
export const STAR_FIELD_RADIUS = 1200

/** 天体データのseedと衝突しない、星専用の固定seed。 */
const STAR_FIELD_SEED = 20260826

/** 天の川のように帯へ寄せる星の割合と、帯の厚み(球面上の高さ方向の広がり)。 */
const BAND_STAR_RATIO = 0.4
const BAND_HALF_THICKNESS = 0.16
/** 帯の傾き。天体の公転面と重ならないよう斜めにする。 */
const BAND_TILT_RADIANS = 1.05

/** 星の色温度の見本(青白・白・黄白・橙)。実際の星の色の並びに合わせた控えめな色。 */
const STAR_TINTS: readonly (readonly [number, number, number])[] = [
  [0.72, 0.82, 1.0],
  [0.9, 0.94, 1.0],
  [1.0, 1.0, 1.0],
  [1.0, 0.95, 0.82],
  [1.0, 0.84, 0.64],
]

export type StarFieldPositions = { positions: Float32Array; colors: Float32Array; sizes: Float32Array }

/**
 * 球面上の星の位置・色・大きさをseedから決定的に作る。
 * 一様分布の星は z成分を一様に選んでからθを一様に選ぶ標準的な方法で、極付近に偏らないようにする。
 * 帯の星は傾けた大円のまわりへ寄せてから球面へ正規化する。
 */
export function createStarPositions(seed: number): StarFieldPositions {
  const random = createRandom(seed)
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  const sizes = new Float32Array(STAR_COUNT)
  const cosTilt = Math.cos(BAND_TILT_RADIANS)
  const sinTilt = Math.sin(BAND_TILT_RADIANS)

  for (let i = 0; i < STAR_COUNT; i += 1) {
    let x: number
    let y: number
    let z: number
    const inBand = random() < BAND_STAR_RATIO
    if (inBand) {
      const theta = 2 * Math.PI * random()
      // 2つの一様乱数の差で、中央ほど濃い三角分布の高さを作る。
      const height = (random() - random()) * BAND_HALF_THICKNESS
      const bx = Math.cos(theta)
      const by = height
      const bz = Math.sin(theta)
      // X軸まわりに傾ける。
      x = bx
      y = by * cosTilt - bz * sinTilt
      z = by * sinTilt + bz * cosTilt
      const length = Math.hypot(x, y, z)
      x /= length
      y /= length
      z /= length
    } else {
      z = 1 - 2 * random()
      const theta = 2 * Math.PI * random()
      const ringRadius = Math.sqrt(Math.max(0, 1 - z * z))
      x = ringRadius * Math.cos(theta)
      y = ringRadius * Math.sin(theta)
    }

    positions[i * 3] = x * STAR_FIELD_RADIUS
    positions[i * 3 + 1] = y * STAR_FIELD_RADIUS
    positions[i * 3 + 2] = z * STAR_FIELD_RADIUS

    // 暗い星ほど多く、明るい星は少ない(べき乗で偏らせる)。帯の星は小さく淡くして「にじみ」に見せる。
    const magnitude = Math.pow(random(), inBand ? 3.2 : 3.5)
    const brightness = (inBand ? 0.28 : 0.4) + magnitude * (inBand ? 0.5 : 0.6)
    const tint = STAR_TINTS[Math.min(STAR_TINTS.length - 1, Math.floor(random() * STAR_TINTS.length))]!
    colors[i * 3] = THREE.MathUtils.clamp(brightness * tint[0], 0, 1)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(brightness * tint[1], 0, 1)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(brightness * tint[2], 0, 1)
    // CSSピクセル単位の直径。ごく一部だけ大きい1等星にする。
    sizes[i] = (inBand ? 1.1 : 1.4) + magnitude * (inBand ? 1.4 : 3.2)
  }

  return { positions, colors, sizes }
}

const STAR_VERTEX_SHADER = `
attribute float size;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vSize;

void main() {
  vColor = color;
  vSize = size;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  // 遠近で大きさを変えない(sizeAttenuationなし)。小さい星もにじみ込みで最低2px確保する。
  gl_PointSize = max(2.0, size * 1.8) * uPixelRatio;
  gl_Position = projectionMatrix * mvPosition;
}
`

const STAR_FRAGMENT_SHADER = `
uniform float uOpacity;
varying vec3 vColor;
varying float vSize;

void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  // 芯(くっきり)＋周りのにじみ。大きい星ほどにじみを強くし、明るい星が光って見えるようにする。
  float core = 1.0 - smoothstep(0.0, 0.55, d);
  float halo = exp(-d * d * 5.0) * clamp((vSize - 2.0) / 3.0, 0.0, 1.0) * 0.55;
  float alpha = clamp(core + halo, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(vColor, alpha);
  #include <colorspace_fragment>
}
`

/** scene直下に1つだけ置く星のPoints。天体を切り替えても作り直さない。 */
export function createStarField(pixelRatio: number): THREE.Points {
  const { positions, colors, sizes } = createStarPositions(STAR_FIELD_SEED)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER,
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 0.9 },
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  })

  const points = new THREE.Points(geometry, material)
  points.renderOrder = -1
  points.frustumCulled = false
  return points
}

export function disposeStarField(points: THREE.Points): void {
  points.geometry.dispose()
  ;(points.material as THREE.Material).dispose()
}
