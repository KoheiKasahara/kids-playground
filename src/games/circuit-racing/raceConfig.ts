/** Race cars reuse the vehicle models and axle dimensions from car-builder. */
export type RaceCarId = 'sportsCar' | 'car' | 'suv' | 'policeCar' | 'ambulance' | 'taxi' | 'pickup' | 'van'

/**
 * The tuning values use SI units: speed is m/s, and the three rates are m/s².
 * `cornering` is the lateral acceleration available before the car needs to slow.
 */
export type RaceCarDefinition = {
  id: RaceCarId
  label: string
  emoji: string
  description: string
  maxSpeed: number
  acceleration: number
  braking: number
  cornering: number
}

/** A car and its paint choice, shared by the start screen and race scene. */
export type RaceSelection = {
  carId: RaceCarId
  color: string
}

export type RaceColor = {
  label: string
  value: string
}

/**
 * Race-tuned values for the existing vehicle models.
 * Keep this as an array so the selection order remains obvious in the UI.
 */
export const RACE_CARS: readonly RaceCarDefinition[] = [
  {
    id: 'sportsCar',
    label: 'スポーツカー',
    emoji: '🏎️',
    description: 'はやくて、カーブもとくい',
    maxSpeed: 50,
    acceleration: 5.8,
    braking: 10.5,
    cornering: 12.5,
  },
  {
    id: 'car',
    label: 'ふつうのくるま',
    emoji: '🚗',
    description: 'バランスのよいくるま',
    maxSpeed: 44,
    acceleration: 4.6,
    braking: 8.8,
    cornering: 9.2,
  },
  {
    id: 'suv',
    label: 'SUV',
    emoji: '🚙',
    description: 'おおきくて、あんてい',
    maxSpeed: 40,
    acceleration: 3.8,
    braking: 7.5,
    cornering: 7.1,
  },
  {
    id: 'policeCar',
    label: 'パトカー',
    emoji: '🚓',
    description: 'ぐんぐん スピードアップ',
    maxSpeed: 48,
    acceleration: 6.5,
    braking: 10,
    cornering: 10.8,
  },
  {
    id: 'ambulance',
    label: 'きゅうきゅうしゃ',
    emoji: '🚑',
    description: 'おおきな からだで すいすい',
    maxSpeed: 41,
    acceleration: 4.2,
    braking: 9,
    cornering: 7.8,
  },
  {
    id: 'taxi',
    label: 'タクシー',
    emoji: '🚕',
    description: 'カーブを くるりと まがる',
    maxSpeed: 43,
    acceleration: 5.1,
    braking: 9.5,
    cornering: 11.5,
  },
  {
    id: 'pickup',
    label: 'ピックアップ',
    emoji: '🛻',
    description: 'ながい みちで ぐんぐん',
    maxSpeed: 46,
    acceleration: 4.1,
    braking: 7.8,
    cornering: 7.5,
  },
  {
    id: 'van',
    label: 'バン',
    emoji: '🚐',
    description: 'ゆったり なめらかに はしる',
    maxSpeed: 38,
    acceleration: 3.6,
    braking: 8,
    cornering: 8.5,
  },
]

export const RACE_COLORS: readonly RaceColor[] = [
  { label: 'あか', value: '#ef4444' },
  { label: 'あお', value: '#2563eb' },
  { label: 'きいろ', value: '#facc15' },
  { label: 'みどり', value: '#16a34a' },
  { label: 'むらさき', value: '#9333ea' },
]

/** Two ready-to-race defaults keep the start screen usable without extra choices. */
export const DEFAULT_SELECTIONS: readonly RaceSelection[] = [
  { carId: 'sportsCar', color: RACE_COLORS[0].value },
  { carId: 'car', color: RACE_COLORS[1].value },
]
