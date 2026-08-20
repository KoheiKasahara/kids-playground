import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { globeCountries } from './data/globeCountries'
import { worldFeatures } from './data/worldFeatures'
import styles from './EarthGlobePlay.module.css'
import { MIN_ZOOM_LEVEL, type GlobeCameraUpdate, type ZoomLevel } from './types'
import { useGlobeEngine } from './three/useGlobeEngine'
import CountryCard from './ui/CountryCard'
import CountryLabels, { type CountryLabelOverlayHandle } from './ui/CountryLabels'
import ZoomControls from './ui/ZoomControls'
import { useReducedMotion } from './useReducedMotion'
import { zoomIn, zoomOut } from './zoomState'

export default function EarthGlobePlay() {
  const navigate = useNavigate()
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(MIN_ZOOM_LEVEL)
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null)
  const [countryNamesVisible, setCountryNamesVisible] = useState(false)
  const countryLabelsRef = useRef<CountryLabelOverlayHandle | null>(null)
  const reducedMotion = useReducedMotion()
  const handleCameraUpdate = useCallback((update: GlobeCameraUpdate) => {
    countryLabelsRef.current?.update(update)
  }, [])

  const { registerContainer } = useGlobeEngine({
    countries: globeCountries,
    features: worldFeatures,
    zoomLevel,
    selectedCountryId,
    onCountrySelect: setSelectedCountryId,
    reducedMotion,
    onCameraUpdate: countryNamesVisible ? handleCameraUpdate : undefined,
  })

  const handleReset = () => {
    setZoomLevel(MIN_ZOOM_LEVEL)
    setSelectedCountryId(null)
  }

  return (
    <main className={styles.page}>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />
      <CountryLabels
        ref={countryLabelsRef}
        countries={globeCountries}
        features={worldFeatures}
        zoomLevel={zoomLevel}
        enabled={countryNamesVisible}
      />

      <div className={styles.ui}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <span aria-hidden="true">🌍</span> ちきゅうぎ
          </h1>
          <p className={styles.instruction}>さわって うごかして みよう</p>
        </header>

        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          もどる
        </button>

        <button
          type="button"
          className={styles.labelToggle}
          aria-label="くにの なまえを ひょうじ"
          aria-pressed={countryNamesVisible}
          onClick={() => setCountryNamesVisible((visible) => !visible)}
        >
          <span className={styles.labelToggleIcon} aria-hidden="true">あ</span>
          <span className={styles.labelToggleState} aria-hidden="true">
            {countryNamesVisible ? 'ON' : 'OFF'}
          </span>
        </button>

        <CountryCard
          selectedCountryId={selectedCountryId}
          onCountrySelect={setSelectedCountryId}
        />
        <ZoomControls
          zoomLevel={zoomLevel}
          onZoomIn={() => setZoomLevel((level) => zoomIn(level))}
          onZoomOut={() => setZoomLevel((level) => zoomOut(level))}
          onReset={handleReset}
        />
      </div>
    </main>
  )
}
