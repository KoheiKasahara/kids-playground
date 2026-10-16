import type { Species } from './data'
import type { Model } from './raster'

/**
 * idle: その場の いきづかい、move: すすむ うごき、act: とくいわざ（タップで みられる）、
 * habit: くらしの ようす（えさを とる・こそだて など、その いきものらしい ふだんの うごき）。
 */
export type ClipName = 'idle' | 'move' | 'act' | 'habit'

/** t は 0〜1。idle と move は くりかえし、act と habit は 1かいきり。 */
export type Pose = { clip: ClipName; t: number }

/** からだ ぜんたいの いろを かえるとき（きせつで こくなる など）。 */
export type Look = { tint?: { color: string; amount: number } }

export type Builder = (m: Model, pose: Pose, sp: Species) => Look | void
