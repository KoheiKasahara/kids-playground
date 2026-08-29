import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { celestialBodies, celestialBodyById, DEFAULT_CELESTIAL_BODY_ID } from './data/celestialBodies'
import { featureSpotsFor } from './data/featureSpots'
import styles from './PlanetGlobePlay.module.css'
import { DEFAULT_ZOOM_LEVEL, type CelestialBodyId, type SolarSystemMode, type ZoomLevel } from './types'
import SingleBodyStage from './SingleBodyStage'
import SolarSystemOverviewStage from './SolarSystemOverviewStage'
import BodySelector from './ui/BodySelector'
import ModeToggle from './ui/ModeToggle'
import { SpeechToggle } from '../../speech'
import { playPlanetSpotSelectSound } from '../../utils/quizSound'

const SINGLE_MODE_INSTRUCTION = 'ひかる ところを さわってみよう'
const OVERVIEW_MODE_INSTRUCTION = 'みやすいように おおきさや きょりを かえているよ'

export default function PlanetGlobePlay() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SolarSystemMode>('single')
  const [bodyId, setBodyId] = useState<CelestialBodyId>(DEFAULT_CELESTIAL_BODY_ID)
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(DEFAULT_ZOOM_LEVEL)
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null)
  const [selectionFeedbackKey, setSelectionFeedbackKey] = useState(0)
  const [overviewPlaying, setOverviewPlaying] = useState(true)
  const body = celestialBodyById(bodyId)
  const spots = featureSpotsFor(bodyId)

  const handleSpotSelect = useCallback((spotId: string | null) => {
    setSelectedSpotId(spotId)
    if (spotId === null) return

    // pointerup のユーザー操作中に鳴らすことで、iOS Safari でも Web Audio の再生が許可される。
    playPlanetSpotSelectSound()
    setSelectionFeedbackKey((key) => key + 1)
  }, [])

  const handleSelectBody = useCallback((id: CelestialBodyId) => {
    setBodyId(id)
    // 切り替え直後は必ず天体全体が見える状態に戻す。別天体の説明カードも残さない。
    setZoomLevel(DEFAULT_ZOOM_LEVEL)
    setSelectedSpotId(null)
  }, [])

  // 全体表示で天体をタップしたときも、個別観察側の「切り替え直後は全体が見える」不変条件をそのまま使う。
  // 地球をタップしても既存「ちきゅうぎ」へは遷移させず、この「たいようけい」内の個別観察へ切り替えるだけにする。
  const handleSelectFromOverview = useCallback(
    (id: CelestialBodyId) => {
      handleSelectBody(id)
      setMode('single')
    },
    [handleSelectBody],
  )

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        {mode === 'single' ? (
          <SingleBodyStage
            body={body}
            zoomLevel={zoomLevel}
            spots={spots}
            selectedSpotId={selectedSpotId}
            selectionFeedbackKey={selectionFeedbackKey}
            onSpotSelect={handleSpotSelect}
            onZoomChange={setZoomLevel}
          />
        ) : (
          <SolarSystemOverviewStage
            playing={overviewPlaying}
            onTogglePlaying={() => setOverviewPlaying((playing) => !playing)}
            onSelectBody={handleSelectFromOverview}
          />
        )}

        <header className={styles.header}>
          <h1 className={styles.title}>
            <span aria-hidden="true">🪐</span> たいようけい
          </h1>
          <p className={styles.instruction}>
            {mode === 'single' ? SINGLE_MODE_INSTRUCTION : OVERVIEW_MODE_INSTRUCTION}
          </p>
        </header>

        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          もどる
        </button>

        {/*
         * よみあげトグルとモード切替は、天体表示・3Dシーンのズームやリサイズと無関係に
         * 常に同じ画面位置へ固定表示したいので、stage内の他要素とはまとめて
         * 独立した固定UI領域(position: fixed)に置く。
         */}
        <div className={styles.topRightSlot}>
          <SpeechToggle />
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      {mode === 'single' && <BodySelector bodies={celestialBodies} selectedId={bodyId} onSelect={handleSelectBody} />}
    </main>
  )
}
