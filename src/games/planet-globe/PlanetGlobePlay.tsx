import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { celestialBodies, celestialBodyById, DEFAULT_CELESTIAL_BODY_ID } from './data/celestialBodies'
import { featureSpotsFor } from './data/featureSpots'
import styles from './PlanetGlobePlay.module.css'
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, type CelestialBodyId, type ZoomLevel } from './types'
import { usePlanetEngine } from './three/usePlanetEngine'
import BodySelector from './ui/BodySelector'
import FeatureCard from './ui/FeatureCard'
import ZoomControls from './ui/ZoomControls'
import { SpeechToggle, useQuestionSpeech } from '../../speech'
import { playPlanetSpotSelectSound } from '../../utils/quizSound'

export default function PlanetGlobePlay() {
  const navigate = useNavigate()
  const [bodyId, setBodyId] = useState<CelestialBodyId>(DEFAULT_CELESTIAL_BODY_ID)
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(MIN_ZOOM_LEVEL)
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [selectionFeedbackKey, setSelectionFeedbackKey] = useState(0)
  const body = celestialBodyById(bodyId)
  const spots = featureSpotsFor(bodyId)
  const selectedSpot = spots.find((spot) => spot.id === selectedSpotId) ?? null

  const handleSpotSelect = useCallback((spotId: string | null) => {
    setSelectedSpotId(spotId)
    if (spotId === null) return

    // pointerup のユーザー操作中に鳴らすことで、iOS Safari でも Web Audio の再生が許可される。
    playPlanetSpotSelectSound()
    setSelectionFeedbackKey((key) => key + 1)
  }, [])

  const { registerContainer } = usePlanetEngine({
    body,
    zoomLevel,
    spots,
    selectedSpotId,
    selectionFeedbackKey,
    onSpotSelect: handleSpotSelect,
  })

  useQuestionSpeech(
    selectedSpot === null ? null : `${selectedSpot.spokenName ?? selectedSpot.displayName}。${selectedSpot.description}`,
    `${bodyId}:${selectedSpotId ?? 'none'}`,
  )

  const handleSelectBody = (id: CelestialBodyId) => {
    setBodyId(id)
    // 切り替え直後は必ず天体全体が見える状態に戻す。別天体の説明カードも残さない。
    setZoomLevel(MIN_ZOOM_LEVEL)
    setSelectedSpotId(null)
  }

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <div ref={registerContainer} className={styles.scene} aria-hidden="true" />

        <header className={styles.header}>
          <h1 className={styles.title}>
            <span aria-hidden="true">🪐</span> わくせいぎ
          </h1>
          <p className={styles.instruction}>ひかる ところを さわってみよう</p>
        </header>

        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          もどる
        </button>

        <div className={styles.speechToggleSlot}>
          <SpeechToggle />
        </div>

        <FeatureCard spot={selectedSpot} onClose={() => setSelectedSpotId(null)} />

        <ZoomControls
          zoomLevel={zoomLevel}
          onZoomIn={() => setZoomLevel((level) => Math.min(MAX_ZOOM_LEVEL, level + 1) as ZoomLevel)}
          onZoomOut={() => setZoomLevel((level) => Math.max(MIN_ZOOM_LEVEL, level - 1) as ZoomLevel)}
        />
      </div>

      <BodySelector bodies={celestialBodies} selectedId={bodyId} onSelect={handleSelectBody} />
    </main>
  )
}
