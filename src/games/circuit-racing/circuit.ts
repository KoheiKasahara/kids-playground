import * as THREE from 'three'

export const CIRCUIT_SCENERY = {
  grandPrix: { label: 'かんらんしゃと ピット', icon: '🎡', sky: '#aeddf5', ground: '#79ad65', road: '#353a40', curb: '#de5254' },
  stadium: { label: 'おおきな スタンド', icon: '🏟️', sky: '#b8dbef', ground: '#8eac83', road: '#39414e', curb: '#438bc9' },
  forest: { label: 'みどりの もり', icon: '🌲', sky: '#c0e6dd', ground: '#628f50', road: '#41443d', curb: '#e0af43' },
  alpine: { label: 'いわやまの けしき', icon: '⛰️', sky: '#cbdfee', ground: '#b1ac8c', road: '#49474a', curb: '#ce6946' },
} as const

export type CircuitDefinition = {
  id: string
  name: string
  description: string
  scenery: keyof typeof CIRCUIT_SCENERY
  width: number
  curve: THREE.CatmullRomCurve3
}

/**
 * Control points for a broad, closed circuit. Coordinates are metres in the XZ
 * plane; y=0 is the road surface. The long lower and upper straights give
 * children time to see the cars accelerate, while the east and north-west
 * groups make corners with different radii.
 */
const CONTROL_POINTS: readonly [number, number][] = [
  [-125, -55],
  [-65, -68],
  [45, -68],
  [110, -58],
  [132, -25],
  [132, 12],
  [116, 45],
  [75, 62],
  [25, 68],
  [-8, 45],
  [-38, 42],
  [-82, 52],
  [-120, 38],
  [-138, 10],
  [-136, -25],
]

function createCurve(controlPoints: readonly [number, number][] = CONTROL_POINTS): THREE.CatmullRomCurve3 {
  const points = controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z))
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5)
}

export function buildCircuit(): CircuitDefinition {
  return {
    id: 'classic-circuit',
    name: 'みんなのサーキット',
    description: 'まっすぐも カーブも！',
    scenery: 'grandPrix',
    width: 12,
    curve: createCurve(),
  }
}

export const CIRCUIT: CircuitDefinition = buildCircuit()


/** Each route is a flat, non-crossing loop with room for all three lanes. */
export const CIRCUITS: readonly CircuitDefinition[] = [
  CIRCUIT,
  {
    id: 'speed-oval',
    name: 'びゅんびゅんオーバル',
    description: 'ながい みちを びゅーん！',
    scenery: 'stadium',
    width: 12,
    curve: createCurve([
      [-110, -60], [-40, -60], [40, -60], [110, -60],
      [152, -42], [170, 0], [152, 42], [110, 60],
      [40, 60], [-40, 60], [-110, 60], [-152, 42], [-170, 0], [-152, -42],
    ]),
  },
  {
    id: 's-curves',
    name: 'くねくねカーブ',
    description: 'みぎへ ひだりへ くねくね！',
    scenery: 'forest',
    width: 12,
    curve: createCurve([
      [-145, -45], [-100, -65], [-55, -35], [-10, -65],
      [35, -35], [80, -65], [125, -45], [155, 0],
      [125, 60], [60, 80], [-30, 80], [-115, 65], [-155, 20],
    ]),
  },
  {
    id: 'hairpin',
    name: 'ぐるっとヘアピン',
    description: 'ゆっくり まがって また ダッシュ！',
    scenery: 'alpine',
    width: 12,
    curve: createCurve([
      [-130, -70], [-50, -70], [40, -70], [130, -70],
      [155, -30], [145, 50], [100, 80], [65, 50],
      [60, 0], [35, -25], [10, 0], [5, 50],
      [-35, 80], [-110, 65], [-145, 20],
    ]),
  },
]

/** The selector uses the same sampled curve as the road, not a separate icon. */
export function circuitPreview(circuit: CircuitDefinition): { viewBox: string; points: string } {
  const points = circuit.curve.getPoints(160)
  const bounds = new THREE.Box3().setFromPoints(points).expandByScalar(16)
  return {
    viewBox: `${bounds.min.x} ${bounds.min.z} ${bounds.max.x - bounds.min.x} ${bounds.max.z - bounds.min.z}`,
    points: points.map((point) => `${point.x.toFixed(1)},${point.z.toFixed(1)}`).join(' '),
  }
}
