import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import {
  computeCountryLabelCandidates,
  estimateLabelWidth,
  filterLabelCandidatesForZoom,
  isInVisibleHemisphere,
  LABEL_HEIGHT_PX,
  LABEL_VIEWPORT_PADDING,
  maxVisibleLabelsForViewport,
  placeLabelsGreedily,
  visibleHemisphereEdgeThresholdForZoom,
  type CountryLabelCandidate,
} from '../countryLabels'
import type {
  GlobeCameraUpdate,
  GlobeCountry,
  GlobeFeature,
  GlobeVector3,
  ZoomLevel,
} from '../types'
import { GLOBE_RADIUS } from '../types'
import styles from './CountryLabels.module.css'

// カメラ操作中のReact再描画を避け、ラベル位置だけを約20fpsで更新する。
const LABEL_UPDATE_INTERVAL_MS = 50

export type CountryLabelOverlayHandle = {
  update: (update: GlobeCameraUpdate) => void
  setEnabled: (enabled: boolean) => void
  setZoomLevel: (zoomLevel: ZoomLevel) => void
}

type CountryLabelsProps = {
  countries: readonly GlobeCountry[]
  features: readonly GlobeFeature[]
  zoomLevel: ZoomLevel
  enabled: boolean
}

function worldPositionOf(anchor: GlobeVector3): GlobeVector3 {
  return {
    x: anchor.x * GLOBE_RADIUS,
    y: anchor.y * GLOBE_RADIUS,
    z: anchor.z * GLOBE_RADIUS,
  }
}

function createLabelOverlayController(
  root: HTMLDivElement,
  candidates: readonly CountryLabelCandidate[],
): CountryLabelOverlayHandle & { dispose: () => void } {
  let enabled = false
  let zoomLevel: ZoomLevel = 0
  let latestUpdate: GlobeCameraUpdate | null = null
  let timeoutId: number | null = null
  let hasPainted = false
  let lastPaintAt = 0
  let disposed = false
  const labelNodes = new Map<string, HTMLDivElement>()

  function cancelScheduledPaint() {
    if (timeoutId === null) return
    window.clearTimeout(timeoutId)
    timeoutId = null
  }

  function clearLabels() {
    for (const node of labelNodes.values()) {
      if (node.parentElement === root) root.removeChild(node)
    }
    labelNodes.clear()
  }

  function paint(update: GlobeCameraUpdate) {
    if (disposed || !enabled) return
    cancelScheduledPaint()

    const zoomCandidates = filterLabelCandidatesForZoom(candidates, zoomLevel)
    const viewport = {
      width: update.viewportWidth,
      height: update.viewportHeight,
      padding: LABEL_VIEWPORT_PADDING,
    }
    const layoutCandidates = zoomCandidates.flatMap((candidate) => {
      if (!isInVisibleHemisphere(
        update.cameraPosition,
        candidate.anchor,
        visibleHemisphereEdgeThresholdForZoom(zoomLevel),
      )) return []

      const projection = update.projectPoint(worldPositionOf(candidate.anchor))
      if (projection === null) return []
      if (!Number.isFinite(projection.x) || !Number.isFinite(projection.y)) return []
      if (projection.depth < -1 || projection.depth > 1) return []

      return [{
        id: candidate.countryId,
        name: candidate.nameJa,
        x: projection.x,
        y: projection.y,
        width: estimateLabelWidth(candidate.nameJa),
        height: LABEL_HEIGHT_PX,
        priority: candidate.priority,
      }]
    })
    const placements = placeLabelsGreedily(
      layoutCandidates,
      viewport,
      maxVisibleLabelsForViewport(zoomLevel, update.viewportWidth),
      zoomLevel,
    )
    const activeIds = new Set(placements.map((placement) => placement.id))

    for (const [countryId, node] of labelNodes) {
      if (activeIds.has(countryId)) continue
      if (node.parentElement === root) root.removeChild(node)
      labelNodes.delete(countryId)
    }

    for (const placement of placements) {
      let node = labelNodes.get(placement.id)
      if (node === undefined) {
        node = document.createElement('div')
        node.className = styles.label
        node.setAttribute('aria-hidden', 'true')
        root.appendChild(node)
        labelNodes.set(placement.id, node)
      }

      node.textContent = placement.name
      node.style.left = `${placement.x}px`
      node.style.top = `${placement.y}px`
    }

    hasPainted = true
    lastPaintAt = performance.now()
  }

  function requestPaint(update: GlobeCameraUpdate) {
    latestUpdate = update
    if (disposed || !enabled) return

    const now = performance.now()
    const elapsed = now - lastPaintAt
    if (!hasPainted || elapsed >= LABEL_UPDATE_INTERVAL_MS) {
      paint(update)
      return
    }

    if (timeoutId === null) {
      timeoutId = window.setTimeout(() => {
        timeoutId = null
        if (latestUpdate !== null && enabled) paint(latestUpdate)
      }, Math.max(0, LABEL_UPDATE_INTERVAL_MS - elapsed))
    }
  }

  return {
    update: requestPaint,
    setEnabled(nextEnabled) {
      enabled = nextEnabled
      if (!enabled) {
        cancelScheduledPaint()
        clearLabels()
        return
      }

      if (latestUpdate !== null) paint(latestUpdate)
    },
    setZoomLevel(nextZoomLevel) {
      zoomLevel = nextZoomLevel
      if (enabled && latestUpdate !== null) paint(latestUpdate)
    },
    dispose() {
      disposed = true
      cancelScheduledPaint()
      clearLabels()
      latestUpdate = null
    },
  }
}

const CountryLabels = forwardRef<CountryLabelOverlayHandle, CountryLabelsProps>(
  function CountryLabels({ countries, features, zoomLevel, enabled }, ref) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const controllerRef = useRef<(CountryLabelOverlayHandle & { dispose: () => void }) | null>(null)
    const candidates = useMemo(
      () => computeCountryLabelCandidates(countries, features),
      [countries, features],
    )
    const handle = useMemo<CountryLabelOverlayHandle>(() => ({
      update(update) {
        controllerRef.current?.update(update)
      },
      setEnabled(nextEnabled) {
        controllerRef.current?.setEnabled(nextEnabled)
      },
      setZoomLevel(nextZoomLevel) {
        controllerRef.current?.setZoomLevel(nextZoomLevel)
      },
    }), [])

    useImperativeHandle(ref, () => handle, [handle])

    useLayoutEffect(() => {
      const root = rootRef.current
      if (root === null) return undefined

      const controller = createLabelOverlayController(root, candidates)
      controllerRef.current = controller
      return () => {
        controller.dispose()
        if (controllerRef.current === controller) controllerRef.current = null
      }
    }, [candidates])

    useEffect(() => {
      controllerRef.current?.setEnabled(enabled)
    }, [enabled])

    useEffect(() => {
      controllerRef.current?.setZoomLevel(zoomLevel)
    }, [zoomLevel])

    return <div ref={rootRef} className={styles.overlay} aria-hidden="true" />
  },
)

export default CountryLabels
