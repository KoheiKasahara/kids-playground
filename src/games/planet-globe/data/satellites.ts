import type { CelestialBodyId, SatelliteSpec } from '../types'

const rocky = (baseColor: string, accentColor: string, darkColor?: string, shape: SatelliteSpec['appearance']['shape'] = 'faceted') => ({
  baseColor,
  accentColor,
  darkColor,
  pattern: 'rocky' as const,
  shape,
})

const icy = (baseColor: string, accentColor: string, darkColor?: string) => ({
  baseColor,
  accentColor,
  darkColor,
  pattern: 'icy' as const,
  shape: 'faceted' as const,
})

export const satellites: readonly SatelliteSpec[] = [
  { id: 'phobos', displayName: 'フォボス', spokenName: 'フォボス', parentBodyId: 'mars', displayScale: 0.22, orbitRadius: 65, orbitSpeed: 0.42, initialAngle: 0.3, appearance: rocky('#83766d', '#b7a08c', '#3e3937', 'irregular'), description: 'かせいの ちいさな つきだよ。いびつな かたちを しているよ。', hitRadiusPx: 38, shapeScale: { x: 1.35, y: 0.72, z: 0.95 }, orbitInclination: 0.05 },
  { id: 'deimos', displayName: 'ダイモス', spokenName: 'ダイモス', parentBodyId: 'mars', displayScale: 0.16, orbitRadius: 90, orbitSpeed: 0.28, initialAngle: 2.5, appearance: rocky('#98897b', '#d0baa2', '#514844', 'irregular'), description: 'かせいの ちいさな つきだよ。かせいの そばを ゆっくり まわるよ。', hitRadiusPx: 38, shapeScale: { x: 1.2, y: 0.8, z: 0.9 }, orbitInclination: -0.07 },
  { id: 'io', displayName: 'イオ', spokenName: 'イオ', parentBodyId: 'jupiter', displayScale: 0.34, orbitRadius: 82, orbitSpeed: 0.34, initialAngle: 0.1, appearance: rocky('#f0c85c', '#e98935', '#8a552c'), description: 'もくせいの つきだよ。かざんが いちばん さかんな せかいだよ。', hitRadiusPx: 40, orbitInclination: 0.04 },
  { id: 'europa', displayName: 'エウロパ', spokenName: 'エウロパ', parentBodyId: 'jupiter', displayScale: 0.31, orbitRadius: 104, orbitSpeed: 0.27, initialAngle: 1.8, appearance: icy('#e8e6d8', '#9ec1d8', '#6f8390'), description: 'こおりに おおわれた もくせいの つきだよ。', hitRadiusPx: 40, orbitInclination: -0.05 },
  { id: 'ganymede', displayName: 'ガニメデ', spokenName: 'ガニメデ', parentBodyId: 'jupiter', displayScale: 0.42, orbitRadius: 128, orbitSpeed: 0.21, initialAngle: 3.4, appearance: rocky('#948d83', '#c7bda7', '#4e4a48'), description: 'たいようけいで いちばん おおきな つきだよ。', hitRadiusPx: 42, orbitInclination: 0.08 },
  { id: 'callisto', displayName: 'カリスト', spokenName: 'カリスト', parentBodyId: 'jupiter', displayScale: 0.38, orbitRadius: 152, orbitSpeed: 0.16, initialAngle: 5.1, appearance: rocky('#625f5b', '#8e8981', '#292827'), description: 'クレーターが たくさん ある もくせいの つきだよ。', hitRadiusPx: 42, orbitInclination: -0.1 },
  { id: 'titan', displayName: 'タイタン', spokenName: 'タイタン', parentBodyId: 'saturn', displayScale: 0.46, orbitRadius: 162, orbitSpeed: 0.14, initialAngle: 0.5, appearance: { baseColor: '#c98d45', accentColor: '#edbf70', darkColor: '#76502d', pattern: 'atmosphere', atmosphere: { color: '#f0c67d', opacity: 0.24, scale: 1.08 }, shape: 'sphere' }, description: 'どせいの おおきな つきだよ。ぶあつい くうきに つつまれているよ。', hitRadiusPx: 42, orbitInclination: 0.06 },
  { id: 'enceladus', displayName: 'エンケラドゥス', spokenName: 'エンケラドゥス', parentBodyId: 'saturn', displayScale: 0.24, orbitRadius: 142, orbitSpeed: 0.22, initialAngle: 3.0, appearance: icy('#e8f4f5', '#b5e5f1', '#7196a1'), description: 'こおりで おおわれた どせいの つきだよ。みずの すいじょうきや こおりの つぶを ふきだすよ。', hitRadiusPx: 40, orbitInclination: -0.08 },
  { id: 'titania', displayName: 'チタニア', spokenName: 'チタニア', parentBodyId: 'uranus', displayScale: 0.34, orbitRadius: 106, orbitSpeed: 0.18, initialAngle: 2.0, appearance: rocky('#a9a59c', '#d3cbbb', '#5c5a56'), description: 'てんのうせいの おおきな つきだよ。', hitRadiusPx: 40, orbitInclination: 0.1 },
  { id: 'miranda', displayName: 'ミランダ', spokenName: 'ミランダ', parentBodyId: 'uranus', displayScale: 0.22, orbitRadius: 82, orbitSpeed: 0.3, initialAngle: 4.6, appearance: rocky('#c0bdb3', '#f1dfc4', '#696765', 'irregular'), description: 'てんのうせいの つきだよ。へんてこな もようが あるよ。', hitRadiusPx: 40, shapeScale: { x: 1.25, y: 0.82, z: 1.05 }, orbitInclination: -0.06 },
  { id: 'triton', displayName: 'トリトン', spokenName: 'トリトン', parentBodyId: 'neptune', displayScale: 0.37, orbitRadius: 100, orbitSpeed: 0.2, initialAngle: 1.2, appearance: icy('#c6d6d1', '#e6efe4', '#667b7b'), description: 'かいおうせいの おおきな つきだよ。かいおうせいの じてんと ぎゃくむきに まわるよ。', hitRadiusPx: 42, orbitInclination: 0.12, retrograde: true },
  { id: 'charon', displayName: 'カロン', spokenName: 'カロン', parentBodyId: 'pluto', displayScale: 0.48, orbitRadius: 57, orbitSpeed: 0.18, initialAngle: 0.2, appearance: rocky('#85827d', '#b7b0a7', '#424140'), description: 'めいおうせいの およそ はんぶんの おおきさだよ。めいおうせいと ふたりで きょうつうの おもりの まわりを まわるよ。', hitRadiusPx: 44, shapeScale: { x: 1.08, y: 0.98, z: 1.02 }, orbitInclination: 0.03, parentOffsetRadiusRatio: 1.05 },
]

const satelliteGroups = satellites.reduce<Record<CelestialBodyId, SatelliteSpec[]>>((groups, satellite) => {
  groups[satellite.parentBodyId]!.push(satellite)
  return groups
}, {
  sun: [],
  mercury: [],
  venus: [],
  earth: [],
  moon: [],
  mars: [],
  jupiter: [],
  saturn: [],
  uranus: [],
  neptune: [],
  pluto: [],
})

export const satellitesByParentBodyId: Readonly<Record<CelestialBodyId, readonly SatelliteSpec[]>> = Object.freeze(satelliteGroups)

export function satellitesFor(parentBodyId: CelestialBodyId): readonly SatelliteSpec[] {
  return satellitesByParentBodyId[parentBodyId] ?? []
}
