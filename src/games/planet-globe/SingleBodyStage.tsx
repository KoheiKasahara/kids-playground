import type { CelestialBody, FeatureSpot, ZoomLevel } from './types'
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from './types'
import { usePlanetEngine } from './three/usePlanetEngine'
import FeatureCard from './ui/FeatureCard'
import ZoomControls from './ui/ZoomControls'
import styles from './PlanetGlobePlay.module.css'
import { useQuestionSpeech } from '../../speech'

type SingleBodyStageProps = {
  body: CelestialBody
  zoomLevel: ZoomLevel
  spots: readonly FeatureSpot[]
  selectedSpotId: string | null
  selectionFeedbackKey: number
  onSpotSelect: (spotId: string | null) => void
  onZoomChange: (level: ZoomLevel) => void
}

/**
 * 個別観察モードの3D表示。Phase 6でモード切替を追加するにあたり`PlanetGlobePlay`から
 * そのまま切り出しただけで、`usePlanetEngine`の呼び出し方・挙動は変えていない
 * (全体表示モードへ切り替えている間はこのコンポーネント自体をアンマウントし、
 * 個別観察のレンダーループが裏で動き続けないようにする。`PlanetGlobePlay`参照)。
 */
export default function SingleBodyStage({
  body,
  zoomLevel,
  spots,
  selectedSpotId,
  selectionFeedbackKey,
  onSpotSelect,
  onZoomChange,
}: SingleBodyStageProps) {
  const selectedSpot = spots.find((spot) => spot.id === selectedSpotId) ?? null

  const { registerContainer } = usePlanetEngine({
    body,
    zoomLevel,
    spots,
    selectedSpotId,
    selectionFeedbackKey,
    onSpotSelect,
  })

  useQuestionSpeech(
    selectedSpot === null ? null : `${selectedSpot.spokenName ?? selectedSpot.displayName}。${selectedSpot.description}`,
    `${body.id}:${selectedSpotId ?? 'none'}`,
  )

  return (
    <>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />

      <FeatureCard spot={selectedSpot} onClose={() => onSpotSelect(null)} />

      <ZoomControls
        zoomLevel={zoomLevel}
        onZoomIn={() => onZoomChange(Math.min(MAX_ZOOM_LEVEL, zoomLevel + 1) as ZoomLevel)}
        onZoomOut={() => onZoomChange(Math.max(MIN_ZOOM_LEVEL, zoomLevel - 1) as ZoomLevel)}
      />
    </>
  )
}
