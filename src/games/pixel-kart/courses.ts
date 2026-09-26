import type { Course, CourseId, Point, TrackPoint } from './types'

const TAU = Math.PI * 2
const wrapAngle = (angle: number) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI

/** Closed cubic B-splines, resampled by arc length for steady racing and rendering. */
function makeCourse(id: CourseId, name: string, subtitle: string, accent: string, length: number, knots: Point[]): Course {
  const dense: Point[] = []
  for (let segment = 0; segment < knots.length; segment++) {
    const a = knots[(segment + knots.length - 1) % knots.length]
    const b = knots[segment]
    const c = knots[(segment + 1) % knots.length]
    const d = knots[(segment + 2) % knots.length]
    for (let step = 0; step < 80; step++) {
      const t = step / 80
      const coordinate = (key: 'x' | 'y') => ((1 - t) ** 3 * a[key]
        + (3 * t ** 3 - 6 * t * t + 4) * b[key]
        + (-3 * t ** 3 + 3 * t * t + 3 * t + 1) * c[key] + t ** 3 * d[key]) / 6
      dense.push({ x: coordinate('x'), y: coordinate('y') })
    }
  }
  const cumulative = [0]
  for (let index = 1; index <= dense.length; index++) {
    const a = dense[index - 1]
    const b = dense[index % dense.length]
    cumulative.push(cumulative[index - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const sourceLength = cumulative[dense.length]
  const scale = length / sourceLength
  const points: TrackPoint[] = []
  let segment = 0
  for (let index = 0; index < 512; index++) {
    const distance = index / 512 * sourceLength
    while (cumulative[segment + 1] < distance) segment++
    const t = (distance - cumulative[segment]) / (cumulative[segment + 1] - cumulative[segment])
    const a = dense[segment]
    const b = dense[(segment + 1) % dense.length]
    points.push({ x: (a.x + (b.x - a.x) * t) * scale, y: (a.y + (b.y - a.y) * t) * scale, angle: 0, curve: 0 })
  }
  for (let index = 0; index < points.length; index++) {
    const before = points[(index + points.length - 1) % points.length]
    const after = points[(index + 1) % points.length]
    points[index].angle = Math.atan2(after.y - before.y, after.x - before.x)
  }
  for (let index = 0; index < points.length; index++) {
    const before = points[(index + points.length - 1) % points.length]
    const after = points[(index + 1) % points.length]
    points[index].curve = wrapAngle(after.angle - before.angle) * 0.5
  }
  return { id, name, subtitle, accent, length, halfWidth: 110, points }
}

export const COURSES: Course[] = [
  makeCourse('forest', 'はなさく もり', '木もれびと お花の みち', '#a4ec80', 4900, [
    { x: -600, y: -350 }, { x: -220, y: -460 }, { x: 230, y: -420 }, { x: 650, y: -260 },
    { x: 800, y: 90 }, { x: 520, y: 410 }, { x: 170, y: 500 }, { x: -130, y: 370 },
    { x: -500, y: 460 }, { x: -820, y: 160 },
  ]),
  makeCourse('coast', 'ゆうやけ ビーチ', 'きらきら 波と さんごの しま', '#ffb878', 5100, [
    { x: -570, y: -360 }, { x: -150, y: -450 }, { x: 300, y: -440 }, { x: 750, y: -240 },
    { x: 730, y: 130 }, { x: 400, y: 300 }, { x: 100, y: 490 }, { x: -230, y: 420 },
    { x: -650, y: 390 }, { x: -830, y: 40 },
  ]),
  makeCourse('crystal', 'きらめく どうくつ', 'ほたると 宝石の ひみつの みち', '#a6b0ff', 5200, [
    { x: -580, y: -370 }, { x: -150, y: -500 }, { x: 280, y: -430 }, { x: 760, y: -330 },
    { x: 790, y: 0 }, { x: 570, y: 350 }, { x: 150, y: 450 }, { x: -160, y: 270 },
    { x: -520, y: 420 }, { x: -780, y: 210 }, { x: -840, y: -80 },
  ]),
  makeCourse('sky', 'ほしぞらの おしろ', '雲のうえの にじいろ レース', '#ffd687', 5350, [
    { x: -580, y: -400 }, { x: -120, y: -460 }, { x: 270, y: -300 }, { x: 700, y: -340 },
    { x: 890, y: -40 }, { x: 660, y: 270 }, { x: 300, y: 410 }, { x: -90, y: 360 },
    { x: -410, y: 500 }, { x: -760, y: 310 }, { x: -840, y: -70 },
  ]),
]

export function sampleTrack(course: Course, distance: number): TrackPoint {
  const position = ((distance % course.length) + course.length) % course.length / course.length * course.points.length
  const index = Math.floor(position)
  const t = position - index
  const a = course.points[index]
  const b = course.points[(index + 1) % course.points.length]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    angle: a.angle + wrapAngle(b.angle - a.angle) * t, curve: a.curve + (b.curve - a.curve) * t }
}
