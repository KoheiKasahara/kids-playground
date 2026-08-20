import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, type ZoomLevel } from './types'

export function zoomIn(level: ZoomLevel): ZoomLevel {
  return Math.min(MAX_ZOOM_LEVEL, level + 1) as ZoomLevel
}

export function zoomOut(level: ZoomLevel): ZoomLevel {
  return Math.max(MIN_ZOOM_LEVEL, level - 1) as ZoomLevel
}
