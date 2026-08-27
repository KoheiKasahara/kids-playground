import { celestialBodyById, solarSystemOverviewBodies } from './data/celestialBodies'
import type { CelestialBodyId } from './types'
import { useSolarSystemOverviewEngine } from './three/useSolarSystemOverviewEngine'
import PlayPauseControl from './ui/PlayPauseControl'
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
  const { registerContainer } = useSolarSystemOverviewEngine({
    bodies: solarSystemOverviewBodies,
    moon,
    playing,
    onSelectBody,
  })

  return (
    <>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />
      <PlayPauseControl playing={playing} onToggle={onTogglePlaying} />
    </>
  )
}
