import { appendPart, type Course, type PartKind } from './marbleModel'

export const COURSE_PRESETS: { id: string; label: string; parts: PartKind[] }[] = [
  { id: 'first', label: 'はじめの さかみち', parts: ['slope', 'straight', 'goal'] },
  { id: 'long', label: 'ながい ながい みち', parts: ['straight', 'long', 'long', 'straight', 'goal'] },
  { id: 'corners', label: 'まがって まがって', parts: ['straight', 'curve', 'straight', 'curveRight', 'goal'] },
  { id: 'wave', label: 'くねくね さんぽ', parts: ['straight', 'wave', 'wave', 'goal'] },
  { id: 'jump', label: 'ぴょーん ジャンプ', parts: ['slope', 'jump', 'straight', 'goal'] },
  { id: 'spin', label: 'くるくる ひろば', parts: ['slope', 'spinner', 'straight', 'goal'] },
  { id: 'funnel', label: 'ぐるぐる すべりだい', parts: ['slope', 'funnel', 'straight', 'goal'] },
  { id: 'seesaw', label: 'ぎったん ばっこん', parts: ['slope', 'seesaw', 'straight', 'goal'] },
  { id: 'boost', label: 'びゅーん とぼう', parts: ['straight', 'booster', 'jump', 'long', 'goal'] },
  { id: 'adventure', label: 'しかけの ぼうけん', parts: ['slope', 'spinner', 'funnel', 'wave', 'goal'] },
]

/** Fresh IDs keep scene resources distinct from pieces edited in another preset. */
export function presetCourse(id: string): Course {
  const preset = COURSE_PRESETS.find(item => item.id === id)
  let course: Course = { parts: [], startId: null }
  for (const [index, kind] of (preset?.parts ?? []).entries()) {
    course = appendPart(course, kind, 'preset-' + id + '-' + index, course.parts.at(-1)?.id ?? null)
  }
  return course
}
