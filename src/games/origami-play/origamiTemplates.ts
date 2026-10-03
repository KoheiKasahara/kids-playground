import {
  buildSequence, centroid, faceCenterX, fromPaper, hasTag, lacksTag, reflect, squareSheet,
  type FaceFilter, type FaceSpec, type OrigamiOp, type Point, type Sequence,
} from './origamiEngine'

export type OrigamiId = 'fox' | 'tulip' | 'boat' | 'dog' | 'cup' | 'cicada' | 'kabuto' | 'crane'

type Step = { instruction: string; op: OrigamiOp }
type Template = {
  id: OrigamiId
  name: string
  subtitle: string
  start: readonly FaceSpec[]
  steps: readonly Step[]
}

const all = (...filters: FaceFilter[]): FaceFilter => (face) => filters.every((filter) => filter(face))
const leftHalf: FaceFilter = (face) => faceCenterX(face) < 0
const rightHalf: FaceFilter = (face) => faceCenterX(face) > 0

/** A line through `point` heading `degrees` clockwise from the +x axis. */
function lineAt([x, y]: Point, degrees: number): readonly [Point, Point] {
  const radians = degrees * Math.PI / 180
  return [[x - Math.cos(radians) * 20, y - Math.sin(radians) * 20], [x + Math.cos(radians) * 20, y + Math.sin(radians) * 20]]
}

/** Where the kite folds of a square base meet its outer edges: 140 · tan(22.5°) / (1 + tan(22.5°)). */
const KITE = 140 * (1 - Math.SQRT1_2)
/** Thinning a bird-base leg halves the kite angle again (11.25°). */
const THIN = (140 - KITE) * Math.tan(Math.PI / 16)
const paperRight = fromPaper(([x]) => x > 0)
const paperLeft = fromPaper(([x]) => x < 0)
const paperTop = fromPaper(([, y]) => y < 0)
const paperBottom = fromPaper(([, y]) => y > 0)
/** The crane's legs below the wings, one on each side of the middle. */
const legLeft: FaceFilter = (face) => centroid([face])[1] > KITE && faceCenterX(face) < 0
const legRight: FaceFilter = (face) => centroid([face])[1] > KITE && faceCenterX(face) > 0

const angleOf = ([x, y]: Point) => Math.atan2(y, x) * 180 / Math.PI
/** The thin legs are reverse-folded up into a long neck and tail; the head bends the neck tip. */
const NECK = lineAt([-9, 52], -25)
const TAIL = lineAt([9, 52], 25)
const NECK_TIP = reflect([0, 140], NECK)
const NECK_DIRECTION = angleOf([NECK_TIP[0] + 9, NECK_TIP[1] - 52])
const HEAD_AT: Point = [
  NECK_TIP[0] - Math.cos(NECK_DIRECTION * Math.PI / 180) * 20,
  NECK_TIP[1] - Math.sin(NECK_DIRECTION * Math.PI / 180) * 20,
]
const HEAD = lineAt(HEAD_AT, (NECK_DIRECTION + 165) / 2)
/** The quarters of the sheet around its left and right corners, split by the creases from edge middle to edge middle. */
const leftQuarter = fromPaper(([x, y]) => x < -Math.abs(y))
const rightQuarter = fromPaper(([x, y]) => x > Math.abs(y))
/** The petal flaps that become the wings; the triangle near the middle of the sheet stays as the crane's back. */
const leftWing = all(leftQuarter, fromPaper(([x]) => x < -KITE))
const rightWing = all(rightQuarter, fromPaper(([x]) => x > KITE))
/** The middle of a quarter, between the kite creases running from its corner. */
const kiteMiddle = fromPaper(([x, y]) => Math.abs(y) < (140 - Math.abs(x)) * Math.tan(Math.PI / 8))

/**
 * Petal fold: the middle of the front layer lifts up along the line where the kite folds
 * meet the edges, and its sides follow and close over it so the edges meet in the middle.
 */
function petal(quarter: FaceFilter): OrigamiOp {
  const line: readonly [Point, Point] = [[-KITE, KITE], [KITE, KITE]]
  return {
    type: 'collapse', folds: [
      { type: 'valley', line, move: [0, 110], select: all(quarter, kiteMiddle) },
      { type: 'valley', line, move: [0, 110], select: all(quarter, (face) => !kiteMiddle(face)) },
    ],
  }
}

/**
 * Squash the flap lying on the `from` half of the triangle: its pocket opens, the folded
 * spine comes down onto the middle and each layer folds its outer corner back over itself,
 * making one side of a square base.
 */
function squash(top: FaceFilter, under: FaceFilter, from: -1 | 1): OrigamiOp {
  return {
    type: 'collapse', folds: [
      { type: 'valley', line: [[0, 0], [0, 140]], move: [from * 60, 40], select: top },
      { type: 'valley', line: [[0, 0], [-from * 70, 70]], move: [-from * 110, 15], select: top, tuck: true },
      { type: 'valley', line: [[0, 0], [from * 70, 70]], move: [from * 110, 15], select: under, tuck: true },
    ],
  }
}

const TOP_DOWN: OrigamiOp = { type: 'valley', line: [[-140, 0], [140, 0]], move: [0, -100], tag: 'a' }
const BOTTOM_UP: OrigamiOp = { type: 'valley', line: [[-140, 0], [140, 0]], move: [0, 100], tag: 'a' }

export const ORIGAMI_TEMPLATES: readonly Template[] = [
  {
    id: 'fox',
    name: 'きつね',
    subtitle: 'ぴん！と おみみ',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'うえを したへ ぱたん！', op: TOP_DOWN },
      { instruction: 'かどを うえに おって おみみ', op: { type: 'valley', line: [[0, 140], [-70, 0]], move: [-120, 5] } },
      { instruction: 'もう ひとつの おみみ！', op: { type: 'valley', line: [[0, 140], [70, 0]], move: [120, 5] } },
      { instruction: 'くるっと うらがえそう', op: { type: 'flip' } },
      { instruction: 'はなさきを うしろへ おろう', op: { type: 'mountain', line: [[-30, 120], [30, 120]], move: [0, 135] } },
    ],
  },
  {
    id: 'tulip',
    name: 'チューリップ',
    subtitle: 'ぱっと はなさこう',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'したを うえへ ぱたん！', op: BOTTOM_UP },
      { instruction: 'かどを ななめに はなびら', op: { type: 'valley', line: [[-37.5, 0], [-100, -50]], move: [-130, -3] } },
      { instruction: 'はんたいも はなびら！', op: { type: 'valley', line: [[37.5, 0], [100, -50]], move: [130, -3] } },
      { instruction: 'したの かどを うしろへ', op: { type: 'mountain', line: [[-18, 0], [-54, -26]], move: [-36, -2] } },
      { instruction: 'こっちも うしろへ！', op: { type: 'mountain', line: [[18, 0], [54, -26]], move: [36, -2] } },
    ],
  },
  {
    id: 'boat',
    name: 'ふね',
    subtitle: 'そよかぜで すいすい',
    start: squareSheet('back', 'square'),
    steps: [
      { instruction: 'したを うえへ ぱたん！', op: { type: 'valley', line: [[-100, 30], [100, 30]], move: [0, 80], tag: 'hull' } },
      { instruction: 'かどを うしろへ おろう', op: { type: 'mountain', line: [[-10, -100], [-80, -40]], move: [-90, -90] } },
      { instruction: 'こっちの かども うしろへ', op: { type: 'mountain', line: [[-10, -100], [90, -40]], move: [90, -90] } },
      { instruction: 'ふねの はしを うしろへ', op: { type: 'mountain', line: [[-100, 0], [-66, 30]], move: [-95, 25] } },
      { instruction: 'はんたいの はしも！', op: { type: 'mountain', line: [[100, 0], [66, 30]], move: [95, 25] } },
    ],
  },
  {
    id: 'dog',
    name: 'いぬ',
    subtitle: 'たれみみ わんわん',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'うえを したへ ぱたん！', op: TOP_DOWN },
      { instruction: 'かどを したへ おって おみみ', op: { type: 'valley', line: [[-48, 0], [-112, 28]], move: [-130, 5], tag: 'ear' } },
      { instruction: 'もう ひとつの おみみ！', op: { type: 'valley', line: [[48, 0], [112, 28]], move: [130, 5], tag: 'ear' } },
      { instruction: 'あたまの かどを うしろへ', op: { type: 'mountain', line: [[-60, 14], [60, 14]], move: [0, 5], select: lacksTag('ear') } },
      { instruction: 'はなを 1まいだけ うえへ', op: { type: 'valley', line: [[-25, 112], [25, 112]], move: [0, 135], select: all(hasTag('a'), lacksTag('ear')) } },
    ],
  },
  {
    id: 'cup',
    name: 'コップ',
    subtitle: 'おみずも はいるかな',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'したを うえへ ぱたん！', op: BOTTOM_UP },
      { instruction: 'かどを はんたいの はしへ', op: { type: 'valley', line: [[-24, 0], [-58, -82]], move: [-130, -3], tag: 'side' } },
      { instruction: 'こっちの かども！', op: { type: 'valley', line: [[24, 0], [58, -82]], move: [130, -3], tag: 'side' } },
      { instruction: 'うえを 1まい まえへ', op: { type: 'valley', line: [[-58, -82], [58, -82]], move: [0, -130], select: all(hasTag('a'), lacksTag('side')) } },
      { instruction: 'のこりは うしろへ おろう', op: { type: 'mountain', line: [[-58, -82], [58, -82]], move: [0, -130], select: lacksTag('a', 'side') } },
    ],
  },
  {
    id: 'cicada',
    name: 'せみ',
    subtitle: 'みーん みーん',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'したを うえへ ぱたん！', op: BOTTOM_UP },
      { instruction: 'かどを うえの はしへ', op: { type: 'valley', line: [[0, 0], [-70, -70]], move: [-120, -5], tag: 'wing' } },
      { instruction: 'こっちの かども うえへ', op: { type: 'valley', line: [[0, 0], [70, -70]], move: [120, -5], tag: 'wing' } },
      { instruction: 'ななめに おって はね', op: { type: 'valley', line: [[0, -65], [-70, -96]], move: [-5, -130], select: all(hasTag('wing'), leftHalf) } },
      { instruction: 'もう ひとつの はね！', op: { type: 'valley', line: [[0, -65], [70, -96]], move: [5, -130], select: all(hasTag('wing'), rightHalf) } },
      { instruction: 'うえの かどを 1まい おろそう', op: { type: 'valley', line: [[-40, -104], [40, -104]], move: [0, -130], select: all(hasTag('a'), lacksTag('wing')) } },
      { instruction: 'もう 1まい すこし ずらして', op: { type: 'valley', line: [[-40, -118], [40, -118]], move: [0, -135], select: lacksTag('a', 'wing') } },
      { instruction: 'よこを うしろへ おろう', op: { type: 'mountain', line: [[-56, -140], [-56, 0]], move: [-100, -40] } },
      { instruction: 'はんたいも うしろへ！', op: { type: 'mountain', line: [[56, -140], [56, 0]], move: [100, -40] } },
    ],
  },
  {
    id: 'kabuto',
    name: 'かぶと',
    subtitle: 'つよそうな つの',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'うえを したへ ぱたん！', op: TOP_DOWN },
      { instruction: 'かどを したの はしへ', op: { type: 'valley', line: [[0, 0], [-70, 70]], move: [-120, 5], tag: 'flapL' } },
      { instruction: 'こっちの かども したへ', op: { type: 'valley', line: [[0, 0], [70, 70]], move: [120, 5], tag: 'flapR' } },
      { instruction: 'はしを うえへ もどそう', op: { type: 'valley', line: [[-70, 70], [0, 70]], move: [-10, 130], select: hasTag('flapL'), tag: 'up' } },
      { instruction: 'こっちも うえへ！', op: { type: 'valley', line: [[0, 70], [70, 70]], move: [10, 130], select: hasTag('flapR'), tag: 'up' } },
      { instruction: 'ななめに おって つの', op: { type: 'valley', line: [[-12, 70], [-30, 14]], move: [-2, 8], select: all(hasTag('flapL'), hasTag('up')) } },
      { instruction: 'もう ひとつの つの！', op: { type: 'valley', line: [[12, 70], [30, 14]], move: [2, 8], select: all(hasTag('flapR'), hasTag('up')) } },
      { instruction: 'したの かどを 1まい うえへ', op: { type: 'valley', line: [[-40, 92], [40, 92]], move: [0, 135], select: all(hasTag('a'), lacksTag('flapL', 'flapR')) } },
      { instruction: 'もういちど うえへ ぱたん', op: { type: 'valley', line: [[-70, 70], [70, 70]], move: [0, 100], select: all(hasTag('a'), lacksTag('flapL', 'flapR')) } },
      { instruction: 'のこりは うしろへ おろう', op: { type: 'mountain', line: [[-70, 70], [70, 70]], move: [0, 120], select: lacksTag('a', 'flapL', 'flapR') } },
    ],
  },
  {
    id: 'crane',
    name: 'つる',
    subtitle: 'ちょうせん！ むずかしいよ',
    start: squareSheet('back', 'diamond'),
    steps: [
      { instruction: 'うえを したへ ぱたん！', op: TOP_DOWN },
      { instruction: 'はんぶんに おろう', op: { type: 'valley', line: [[0, 0], [0, 140]], move: [60, 40] } },
      { instruction: 'ふくろを ひらいて つぶそう', op: squash(all(paperRight, paperBottom), all(paperRight, paperTop), -1) },
      { instruction: 'くるっと うらがえそう', op: { type: 'flip' } },
      { instruction: 'こっちも ひらいて つぶそう', op: squash(all(paperLeft, paperBottom), all(paperLeft, paperTop), 1) },
      { instruction: 'はしを まんなかへ おろう', op: { type: 'valley', line: [[0, 140], [-KITE, KITE]], move: [-45, 75], top: 2 } },
      { instruction: 'はんたいも まんなかへ', op: { type: 'valley', line: [[0, 140], [KITE, KITE]], move: [45, 75], top: 2 } },
      { instruction: 'したの かどを うえへ もちあげよう', op: petal(leftQuarter) },
      { instruction: 'くるっと うらがえそう', op: { type: 'flip' } },
      { instruction: 'はしを まんなかへ おろう', op: { type: 'valley', line: [[0, 140], [-KITE, KITE]], move: [-45, 75], top: 2 } },
      { instruction: 'はんたいも まんなかへ', op: { type: 'valley', line: [[0, 140], [KITE, KITE]], move: [45, 75], top: 2 } },
      { instruction: 'こっちも かどを もちあげよう', op: petal(rightQuarter) },
      { instruction: 'あしを ほそく おろう', op: { type: 'valley', line: [[0, 140], [-THIN, KITE]], move: [-20, 75], top: 2, tuck: true } },
      { instruction: 'はんたいも ほそく', op: { type: 'valley', line: [[0, 140], [THIN, KITE]], move: [20, 75], top: 2, tuck: true } },
      { instruction: 'くるっと うらがえそう', op: { type: 'flip' } },
      { instruction: 'こっちも ほそく おろう', op: { type: 'valley', line: [[0, 140], [-THIN, KITE]], move: [-20, 75], top: 2, tuck: true } },
      { instruction: 'はんたいも ほそく', op: { type: 'valley', line: [[0, 140], [THIN, KITE]], move: [20, 75], top: 2, tuck: true } },
      { instruction: 'なかに おりこんで くび', op: { type: 'reverse', line: NECK, move: [-4, 130], select: legLeft, tag: 'neck' } },
      { instruction: 'はんたいは しっぽ', op: { type: 'reverse', line: TAIL, move: [4, 130], select: legRight, tag: 'tail' } },
      { instruction: 'くびの さきを おって あたま', op: { type: 'reverse', line: HEAD, move: NECK_TIP, select: hasTag('neck'), tag: 'head' } },
      { instruction: 'はねを したへ おろそう', op: { type: 'valley', line: [[-KITE, KITE], [KITE, KITE]], move: [0, 0], select: leftWing } },
      { instruction: 'うしろの はねも おろそう', op: { type: 'mountain', line: [[-KITE, KITE], [KITE, KITE]], move: [0, 0], select: rightWing } },
    ],
  },
]

const sequences = new Map<OrigamiId, Sequence>()

export function origamiSequence(id: OrigamiId): Sequence {
  let sequence = sequences.get(id)
  if (!sequence) {
    const template = ORIGAMI_TEMPLATES.find((item) => item.id === id)!
    sequence = buildSequence(template.start, template.steps.map((step) => step.op))
    sequences.set(id, sequence)
  }
  return sequence
}

export const PAPER_COLORS = [
  { id: 'peach', name: 'もも', main: '#f49679', light: '#ffd8bd', dark: '#d96551' },
  { id: 'sunshine', name: 'きいろ', main: '#f5c75b', light: '#ffecab', dark: '#daa036' },
  { id: 'rose', name: 'ピンク', main: '#ed88ac', light: '#ffcfdf', dark: '#cf5e8a' },
  { id: 'sky', name: 'みずいろ', main: '#79c4df', light: '#c9eaf5', dark: '#4d9dbf' },
  { id: 'lilac', name: 'むらさき', main: '#afa0df', light: '#e3dafa', dark: '#8872ba' },
  { id: 'mint', name: 'みどり', main: '#8ac9a6', light: '#d0edd6', dark: '#5b9e80' },
] as const

export type PaperColor = (typeof PAPER_COLORS)[number]
