import type { Country } from '../flag-quiz/types'

export const QUESTION_COUNT = 10
export const CHOICE_COUNT = 4

export const TRAVEL_REGIONS = ['asia', 'europe', 'africa'] as const
export type TravelRegion = (typeof TRAVEL_REGIONS)[number]
export type TravelCountry = {
  countryId: Country['id']
  /** Natural Earth / ISO 3166-1 numeric country id. */
  mapId: number
  /** 国土が小さい・島国のときにも使える地図上の目印。 */
  anchor: readonly [number, number]
  fitMode?: 'primary' | 'all'
}
export type TravelCourse = { id: string; region: TravelRegion; name: string; countryIds: readonly string[] }
export type TravelQuestion = { answer: Country; choices: readonly Country[]; answerIndex: number }
export type TravelPhase = 'answering' | 'feedback' | 'traveling'

export function isTravelRegion(value: string | undefined): value is TravelRegion {
  return Boolean(value && (TRAVEL_REGIONS as readonly string[]).includes(value))
}
