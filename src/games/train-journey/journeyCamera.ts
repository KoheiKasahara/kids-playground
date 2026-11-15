import { Vector3 } from 'three'
import type { JourneyCourse, JourneyMotion } from './journeyModel'

/** Each stretch owns fixed tripods. Movement only pans toward the train;
 * crossing a stretch boundary cuts directly to the next tripod, never flies. */
export function tracksideCameraPose(course: JourneyCourse, motion: Pick<JourneyMotion, 'edge' | 'distance'>, aspect: number) {
  const length = course.lengths[motion.edge]
  const count = Math.max(1, Math.ceil(length / 18))
  const index = Math.min(count - 1, Math.floor(Math.max(0, motion.distance) / length * count))
  const curve = course.curves[motion.edge]
  const anchor = curve.getPointAt((index + 0.5) / count)
  const tangent = curve.getTangentAt((index + 0.5) / count)
  const side = new Vector3(tangent.z, 0, -tangent.x).normalize()
  const distance = 18 * Math.max(1, 0.85 / Math.max(0.1, aspect))
  // Elevated tripods keep station roofs and nearby trees below the sightline.
  const position = anchor.clone().addScaledVector(side, distance)
  position.y += distance * 0.85
  return { id: `${motion.edge}-${index}`, position }
}
