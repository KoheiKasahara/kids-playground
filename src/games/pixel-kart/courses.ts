import type { Course, CourseId, CourseZone, ItemBox, Point, TrackPoint, ZoneKind } from './types'

const TAU = Math.PI * 2
const wrapAngle = (angle: number) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI

const smooth = (t: number) => t * t * (3 - 2 * t)
/** Race-feature layout in course fractions; lanes and half-widths are road units (+ is right). */
type Layout = {
  /** Road half-width keyframes, eased between neighbours around the closed loop. */
  widths: [at: number, width: number][]
  zones: [kind: ZoneKind, start: number, end: number, lane: number, half: number][]
  boxes: [at: number, lane: number][]
}

function widthAt(keys: Layout['widths'], fraction: number) {
  for (let index = 0; index < keys.length; index++) {
    const [a, wa] = keys[index]
    const [b, wb] = keys[(index + 1) % keys.length]
    const span = ((b - a) % 1 + 1) % 1 || 1
    const t = ((fraction - a) % 1 + 1) % 1
    if (t <= span) return wa + (wb - wa) * smooth(t / span)
  }
  return keys[0][1]
}

/** Closed cubic B-splines, resampled by arc length for steady racing and rendering. */
function makeCourse(id: CourseId, name: string, subtitle: string, accent: string, length: number, knots: Point[], layout: Layout): Course {
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
    points.push({ x: (a.x + (b.x - a.x) * t) * scale, y: (a.y + (b.y - a.y) * t) * scale, angle: 0, curve: 0, width: widthAt(layout.widths, index / 512) })
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
  const zones: CourseZone[] = layout.zones.map(([kind, start, end, lane, half]) => ({ kind, start: start * length, end: end * length, lane, half }))
  const boxes: ItemBox[] = layout.boxes.map(([at, lane]) => ({ distance: at * length, lane }))
  return { id, name, subtitle, accent, length, points, zones, boxes }
}

export const COURSES: Course[] = [
  makeCourse('forest', 'はなさく もり', '木もれびと お花の みち', '#a4ec80', 4900, [
    { x: -600, y: -350 }, { x: -220, y: -460 }, { x: 230, y: -420 }, { x: 650, y: -260 },
    { x: 800, y: 90 }, { x: 520, y: 410 }, { x: 170, y: 500 }, { x: -130, y: 370 },
    { x: -500, y: 460 }, { x: -820, y: 160 },
  ], {
    widths: [[0, 115], [0.14, 115], [0.18, 82], [0.26, 82], [0.3, 110], [0.46, 110], [0.49, 150], [0.58, 150], [0.61, 110], [0.63, 88], [0.72, 88], [0.75, 110]],
    zones: [
      ['rough', 0.33, 0.37, -62, 40], ['dash', 0.37, 0.38, 50, 22], ['rough', 0.4, 0.42, 84, 26],
      // The big tree splits the road: the inside path is shorter but muddy, the outside has a dash panel.
      ['island', 0.5, 0.575, 10, 40], ['dash', 0.52, 0.53, -92, 22], ['rough', 0.535, 0.556, 112, 30],
      ['rough', 0.655, 0.675, 38, 32], ['rough', 0.8, 0.84, -68, 36], ['dash', 0.845, 0.855, 58, 22],
    ],
    boxes: [[0.12, -65], [0.125, 0], [0.13, 65], [0.22, -34], [0.235, 34], [0.44, 32], [0.447, 76],
      [0.53, 88], [0.545, -92], [0.76, 0], [0.766, -60], [0.766, 60], [0.9, -45], [0.9, 45]],
  }),
  makeCourse('coast', 'ゆうやけ ビーチ', 'きらきら 波と さんごの しま', '#ffb878', 5100, [
    { x: -570, y: -360 }, { x: -150, y: -450 }, { x: 300, y: -440 }, { x: 750, y: -240 },
    { x: 730, y: 130 }, { x: 400, y: 300 }, { x: 100, y: 490 }, { x: -230, y: 420 },
    { x: -650, y: 390 }, { x: -830, y: 40 },
  ], {
    widths: [[0, 110], [0.14, 110], [0.17, 135], [0.26, 135], [0.29, 110], [0.46, 105], [0.48, 80], [0.56, 80], [0.59, 110], [0.63, 110], [0.655, 150], [0.735, 150], [0.765, 110]],
    zones: [
      // Sand dunes on a wide beach make a gentle slalom.
      ['rough', 0.19, 0.205, -46, 38], ['rough', 0.225, 0.24, 50, 38], ['dash', 0.245, 0.255, -72, 22],
      ['rough', 0.34, 0.38, -70, 36], ['dash', 0.51, 0.52, 0, 22],
      // A palm island: a narrow lane with a dash panel, or a wide lane past a tide pool.
      ['island', 0.665, 0.725, -20, 42], ['dash', 0.69, 0.7, -106, 20], ['rough', 0.7, 0.715, 70, 38],
      ['rough', 0.8, 0.83, -65, 40], ['rough', 0.87, 0.89, 72, 28],
    ],
    boxes: [[0.12, -70], [0.125, -10], [0.13, 50], [0.212, -100], [0.212, 0], [0.212, 100], [0.4, 40], [0.405, 80],
      [0.53, -30], [0.53, 30], [0.69, 110], [0.71, -106], [0.86, -30], [0.865, 20], [0.87, -80]],
  }),
  makeCourse('crystal', 'きらめく どうくつ', 'ほたると 宝石の ひみつの みち', '#a6b0ff', 5200, [
    { x: -580, y: -370 }, { x: -150, y: -500 }, { x: 280, y: -430 }, { x: 760, y: -330 },
    { x: 790, y: 0 }, { x: 570, y: 350 }, { x: 150, y: 450 }, { x: -160, y: 270 },
    { x: -520, y: 420 }, { x: -780, y: 210 }, { x: -840, y: -80 },
  ], {
    widths: [[0, 110], [0.1, 110], [0.13, 145], [0.24, 145], [0.27, 110], [0.33, 95], [0.38, 95], [0.41, 110], [0.44, 110], [0.47, 80], [0.6, 80], [0.63, 110], [0.84, 110], [0.87, 130], [0.95, 130], [0.98, 110]],
    zones: [
      // Crystal pillars split the cave: rubble on the right, a dash panel on the left.
      ['island', 0.14, 0.23, 0, 45], ['rough', 0.17, 0.19, 85, 24], ['dash', 0.19, 0.2, -95, 22],
      ['rough', 0.32, 0.36, -64, 30], ['dash', 0.335, 0.345, 55, 20],
      // The narrow tunnel alternates puddles of rubble.
      ['rough', 0.5, 0.515, 38, 30], ['rough', 0.545, 0.56, -38, 30], ['dash', 0.585, 0.595, 0, 20],
      ['rough', 0.89, 0.91, 0, 40], ['dash', 0.925, 0.935, 80, 22],
    ],
    boxes: [[0.08, -60], [0.085, 0], [0.09, 60], [0.155, -95], [0.162, 95], [0.29, -30], [0.29, 30],
      [0.43, -50], [0.435, 0], [0.44, 50], [0.53, 0], [0.7, -50], [0.71, 50], [0.9, -88], [0.9, 88]],
  }),
  makeCourse('sky', 'ほしぞらの おしろ', '雲のうえの にじいろ レース', '#ffd687', 5350, [
    { x: -580, y: -400 }, { x: -120, y: -460 }, { x: 270, y: -300 }, { x: 700, y: -340 },
    { x: 890, y: -40 }, { x: 660, y: 270 }, { x: 300, y: 410 }, { x: -90, y: 360 },
    { x: -410, y: 500 }, { x: -760, y: 310 }, { x: -840, y: -70 },
  ], {
    widths: [[0, 112], [0.08, 112], [0.11, 82], [0.24, 82], [0.27, 110], [0.42, 110], [0.45, 150], [0.555, 150], [0.585, 110], [0.72, 110], [0.75, 135], [0.86, 135], [0.89, 112]],
    zones: [
      ['dash', 0.18, 0.19, -30, 20], ['rough', 0.31, 0.35, -70, 38], ['dash', 0.355, 0.365, 60, 20],
      // A cloud with a tower: the inside path is narrow with a dash panel, the outside is wide but puffy.
      ['island', 0.46, 0.54, 25, 45], ['dash', 0.49, 0.5, 110, 20], ['rough', 0.5, 0.52, -60, 35],
      ['rough', 0.77, 0.785, 50, 40], ['rough', 0.81, 0.825, -50, 40], ['dash', 0.84, 0.85, 60, 22],
    ],
    boxes: [[0.06, -50], [0.065, 0], [0.07, 50], [0.16, -25], [0.168, 25], [0.42, 30], [0.425, 72],
      [0.47, 110], [0.505, -120], [0.68, -40], [0.686, 40], [0.797, 0], [0.797, -95], [0.95, -40], [0.95, 40]],
  }),
]

export function sampleTrack(course: Course, distance: number): TrackPoint {
  const position = ((distance % course.length) + course.length) % course.length / course.length * course.points.length
  const index = Math.floor(position)
  const t = position - index
  const a = course.points[index]
  const b = course.points[(index + 1) % course.points.length]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    angle: a.angle + wrapAngle(b.angle - a.angle) * t, curve: a.curve + (b.curve - a.curve) * t,
    width: a.width + (b.width - a.width) * t }
}

/** Signed distance from `from` forward to `to`, wrapped to the nearest lap. */
export const aheadOf = (course: Course, from: number, to: number) => ((to - from) % course.length + course.length * 1.5) % course.length - course.length / 2

/** The zone of `kind` covering this spot, if any. `margin` widens the lane test. */
export function zoneAt(course: Course, distance: number, lane: number, kind: CourseZone['kind'], margin = 0): CourseZone | undefined {
  const wrapped = (distance % course.length + course.length) % course.length
  return course.zones.find(zone => zone.kind === kind && wrapped >= zone.start && wrapped <= zone.end && Math.abs(lane - zone.lane) <= zone.half + margin)
}

/** Island half-width at `distance`; its ends taper to points so karts glance off instead of stopping. */
export function islandAt(course: Course, distance: number): { lane: number; half: number } | null {
  const wrapped = (distance % course.length + course.length) % course.length
  for (const zone of course.zones) {
    if (zone.kind !== 'island' || wrapped < zone.start || wrapped > zone.end) continue
    const taper = Math.min(1, (wrapped - zone.start) / 70, (zone.end - wrapped) / 70)
    return { lane: zone.lane, half: zone.half * Math.sqrt(Math.max(0, taper)) }
  }
  return null
}

/** The open road interval a kart at `lane` is driving in: the whole road, or one side of an island. */
export function openLanes(course: Course, distance: number, lane: number, kartRadius = 16): [number, number] {
  const width = sampleTrack(course, distance).width
  const island = islandAt(course, distance)
  if (!island || island.half < 1) return [-width, width]
  return lane < island.lane ? [-width, island.lane - island.half - kartRadius] : [island.lane + island.half + kartRadius, width]
}
