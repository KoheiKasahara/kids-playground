import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { celestialBodies, celestialBodyById, DEFAULT_CELESTIAL_BODY_ID } from './data/celestialBodies'
import styles from './PlanetGlobePlay.module.css'
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, type CelestialBodyId, type ZoomLevel } from './types'
import { usePlanetEngine } from './three/usePlanetEngine'
import BodySelector from './ui/BodySelector'
import ZoomControls from './ui/ZoomControls'

export default function PlanetGlobePlay() {
  const navigate = useNavigate()
  const [bodyId, setBodyId] = useState<CelestialBodyId>(DEFAULT_CELESTIAL_BODY_ID)
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(MIN_ZOOM_LEVEL)
  const body = celestialBodyById(bodyId)

  const { registerContainer } = usePlanetEngine({ body, zoomLevel })

  const handleSelectBody = (id: CelestialBodyId) => {
    setBodyId(id)
    // 切り替え直後は必ず天体全体が見える状態に戻す。
    setZoomLevel(MIN_ZOOM_LEVEL)
  }

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <div ref={registerContainer} className={styles.scene} aria-hidden="true" />

        <header className={styles.header}>
          <h1 className={styles.title}>
            <span aria-hidden="true">🪐</span> わくせいぎ
          </h1>
          <p className={styles.instruction}>さわって うごかして みよう</p>
        </header>

        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          もどる
        </button>

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
