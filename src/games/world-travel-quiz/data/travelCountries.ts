import { countries } from '../../flag-quiz/data/countries'
import type { TravelCountry } from '../types'

type Entry = readonly [string, number, readonly [number, number], ('primary' | 'all')?]
const entries: readonly Entry[] = [
  ['jp', 392, [138, 37], 'all'], ['kr', 410, [128, 36]], ['cn', 156, [104, 35]], ['mn', 496, [103, 47]], ['in', 356, [79, 22]], ['th', 764, [101, 15]], ['vn', 704, [108, 16]], ['ph', 608, [122, 13], 'all'], ['id', 360, [118, -2], 'all'], ['sg', 702, [104, 1.35]], ['tw', 158, [121, 23.7]], ['my', 458, [102, 4], 'all'],
  ['pt', 620, [-8, 39]], ['es', 724, [-4, 40]], ['fr', 250, [2, 46]], ['gb', 826, [-3, 55], 'all'], ['nl', 528, [5, 52]], ['de', 276, [10, 51]], ['se', 752, [16, 62]], ['ch', 756, [8, 47]], ['it', 380, [12, 42], 'all'], ['gr', 300, [22, 39], 'all'], ['pl', 616, [19, 52]], ['at', 40, [14, 47]],
  ['ma', 504, [-6, 32]], ['dz', 12, [2, 28]], ['tn', 788, [9, 34]], ['eg', 818, [30, 27]], ['et', 231, [40, 9]], ['ke', 404, [37, 0]], ['tz', 834, [35, -6]], ['zw', 716, [30, -19]], ['za', 710, [25, -29]], ['mg', 450, [47, -19], 'all'], ['sn', 686, [-14, 14]], ['ci', 384, [-5, 7]], ['gh', 288, [-1, 7]], ['ng', 566, [8, 9]], ['cm', 120, [12, 6]], ['ug', 800, [32, 1]],
] as const

export const travelCountries: readonly TravelCountry[] = entries.map(([countryId, mapId, anchor, fitMode]) => ({ countryId, mapId, anchor, fitMode }))
export const travelCountryById = new Map(travelCountries.map((country) => [country.countryId, country]))
export const countryById = new Map(countries.map((country) => [country.id, country]))
