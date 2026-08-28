import { useCallback, useState } from 'react'
import { celestialBodyById, solarSystemOverviewBodies } from './data/celestialBodies'
import type { CelestialBodyId } from './types'
import { useSolarSystemOverviewEngine } from './three/useSolarSystemOverviewEngine'
import PlayPauseControl from './ui/PlayPauseControl'
import ZoomControls from './ui/ZoomControls'
import styles from './PlanetGlobePlay.module.css'

type SolarSystemOverviewStageProps = {
  playing: boolean
  onTogglePlaying: () => void
  onSelectBody: (id: CelestialBodyId) => void
}

const moon = celestialBodyById('moon')

/**
 * 太陽系全体表示モードの3D表示。`usePlanetEngine`(個別観察)とは別のエンジンを使い、
 * このコンポーネント自体をモード切替のたびにマウント/アンマウントすることで、
 * 全体表示のレンダーループが個別観察モード中も裏で動き続けないようにする。
 */
export default function SolarSystemOverviewStage({ playing, onTogglePlaying, onSelectBody }: SolarSystemOverviewStageProps) {
  const [zoomAvailability, setZoomAvailability] = useState({ canZoomIn: true, canZoomOut: false })
  const handleZoomAvailabilityChange = useCallback((availability: { canZoomIn: boolean; canZoomOut: boolean }) => {
    setZoomAvailability((current) => (
      current.canZoomIn === availability.canZoomIn && current.canZoomOut === availability.canZoomOut
        ? current
        : availability
    ))
  }, [])

  const { registerContainer, zoomIn, zoomOut } = useSolarSystemOverviewEngine({
    bodies: solarSystemOverviewBodies,
    moon,
    playing,
    onSelectBody,
    onZoomAvailabilityChange: handleZoomAvailabilityChange,
  })

  return (
    <>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />
      <PlayPauseControl playing={playing} onToggle={onTogglePlaying} aboveZoomControls />
      <ZoomControls
        canZoomIn={zoomAvailability.canZoomIn}
        canZoomOut={zoomAvailability.canZoomOut}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />
    </>
  )
}
