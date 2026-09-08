import type { Point } from './bentoState'

type Drag = { pointerId: number; id: number; offset: Point }
type Options = {
  enabled: () => boolean
  hit: (event: PointerEvent) => { id: number; position: Point } | null
  project: (event: PointerEvent) => Point | null
  select: (id: number | null) => void
  preview: (id: number, point: Point) => void
  drop: (id: number, point: Point) => void
  cancel: () => void
}
/** One captured pointer owns a drag. Cancellation always restores the committed layout. */
export function bindBentoPointer(host: HTMLElement, options: Options) {
  let drag: Drag | null = null
  function down(event: PointerEvent) {
    if (!options.enabled() || drag || event.button !== 0 || event.isPrimary === false) return
    event.preventDefault()
    const hit = options.hit(event)
    options.select(hit?.id ?? null)
    const point = options.project(event)
    if (!hit || !point) return
    drag = { pointerId: event.pointerId, id: hit.id, offset: { x: hit.position.x - point.x, z: hit.position.z - point.z } }
    host.setPointerCapture?.(event.pointerId)
  }
  function pointFor(event: PointerEvent): Point | null {
    const point = options.project(event)
    return point && drag ? { x: point.x + drag.offset.x, z: point.z + drag.offset.z } : null
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    const point = pointFor(event)
    if (point) options.preview(drag.id, point)
  }
  function release() {
    const current = drag
    drag = null // releasePointerCapture may synchronously fire lostpointercapture.
    if (current && host.hasPointerCapture?.(current.pointerId)) host.releasePointerCapture(current.pointerId)
  }
  function up(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    const point = pointFor(event)
    if (point) options.drop(drag.id, point)
    else options.cancel()
    release()
  }
  function cancel(event?: PointerEvent) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return
    release()
    options.cancel()
  }
  function blur() { cancel() }
  host.addEventListener('pointerdown', down)
  host.addEventListener('pointermove', move)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', cancel)
  host.addEventListener('lostpointercapture', cancel)
  window.addEventListener('blur', blur)
  return {
    cancel: blur,
    dispose() {
      release()
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', cancel)
      host.removeEventListener('lostpointercapture', cancel)
      window.removeEventListener('blur', blur)
    },
  }
}
