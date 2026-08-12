import type { JapanTravelCourse } from '../types'

/**
 * 地方を順に制覇するのではなく、日本中を移動する10県の旅。
 * コース全体では47都道府県をすべて含み、各コース内では重複させない。
 */
export const japanTravelCourses: readonly JapanTravelCourse[] = [
  { id: 'central-hop', name: 'にほんアルプスを こえて', prefectureIds: ['15', '20', '19', '22', '23', '21', '17', '16', '10', '09'] },
  { id: 'north-to-south', name: 'ほっかいどうから みなみへ', prefectureIds: ['01', '02', '04', '13', '22', '23', '27', '34', '40', '46'] },
  { id: 'big-jumps', name: 'にほんを ぴょんぴょん たび', prefectureIds: ['01', '13', '47', '40', '26', '39', '15', '20', '12', '46'] },
  { id: 'famous-stops', name: 'にんきの まちを めぐろう', prefectureIds: ['13', '27', '26', '22', '01', '47', '34', '40', '28', '17'] },
  { id: 'far-and-wide', name: 'きたと みなみを いったりきたり', prefectureIds: ['01', '47', '02', '46', '13', '40', '15', '39', '04', '27'] },
  { id: 'east-detour', name: 'ひがしにほん ぐるっとたび', prefectureIds: ['05', '06', '07', '08', '11', '14', '19', '20', '16', '17'] },
  { id: 'west-hop', name: 'にしにほん とびこえたび', prefectureIds: ['31', '32', '35', '42', '44', '38', '36', '37', '33', '30'] },
  { id: 'coast-to-coast', name: 'うみべを わたる たび', prefectureIds: ['18', '26', '24', '30', '31', '34', '37', '43', '45', '47'] },
  { id: 'mountain-to-sea', name: 'やまと うみを いったりきたり', prefectureIds: ['03', '10', '12', '13', '14', '25', '27', '32', '38', '41'] },
  { id: 'northwest-south', name: 'にほんかいから みなみのしまへ', prefectureIds: ['06', '15', '17', '21', '23', '28', '33', '35', '42', '47'] },
  { id: 'seven-seas', name: 'ひがしから にしへ だいぼうけん', prefectureIds: ['05', '07', '09', '11', '16', '19', '22', '29', '36', '40'] },
  { id: 'cross-country', name: 'ぜんこく よこだん たび', prefectureIds: ['02', '08', '20', '24', '25', '31', '39', '44', '46', '01'] },
  { id: 'city-and-nature', name: 'まちと しぜんを めぐろう', prefectureIds: ['04', '18', '23', '27', '30', '34', '38', '41', '45', '12'] },
  { id: 'sunny-route', name: 'おひさま きらきら たび', prefectureIds: ['14', '10', '20', '17', '26', '28', '35', '43', '42', '47'] },
  { id: 'zigzag', name: 'にほん じぐざぐ たび', prefectureIds: ['01', '03', '06', '11', '15', '21', '24', '29', '37', '40'] },
  { id: 'spring-to-autumn', name: 'やまから うみへ たび', prefectureIds: ['09', '12', '19', '22', '25', '32', '36', '39', '44', '46'] },
  { id: 'railway-trip', name: 'でんしゃと ひこうきの たび', prefectureIds: ['07', '13', '16', '18', '24', '27', '33', '35', '41', '45'] },
  { id: 'wide-arc', name: 'おおきな にじの たび', prefectureIds: ['05', '08', '14', '20', '23', '26', '31', '34', '38', '42'] },
  { id: 'island-hopper', name: 'ほっぽうから しまへ', prefectureIds: ['02', '04', '10', '17', '21', '28', '30', '32', '43', '47'] },
  { id: 'final-flight', name: 'にほん ひこうき たび', prefectureIds: ['01', '07', '11', '22', '29', '35', '37', '40', '44', '46'] },
]
