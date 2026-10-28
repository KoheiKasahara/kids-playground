import { useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { ActionArt, BouquetArt, FlowerArt, GardenScenery, RabbitArt } from './GardenArt'
import { createGarden, gardenHint, pickedCount, PLOT_ACTION, PLOT_COUNT, tendPlot } from './garden'
import { playGardenSound, type GardenSound } from './sounds'
import styles from './PixelGardenPlay.module.css'

export default function PixelGardenPlay() {
  const [garden, setGarden] = useState(createGarden)
  const [started, setStarted] = useState(false)
  const [sound, toggleSound] = useSoundToggle()
  const replayRef = useRef<HTMLButtonElement>(null)
  const firstPlotRef = useRef<HTMLButtonElement>(null)
  const picked = pickedCount(garden)
  const complete = picked === PLOT_COUNT
  useGameIntroPlaying(started)

  useEffect(() => {
    if (complete) replayRef.current?.focus({ preventScroll: true })
    else if (garden.round > 0) firstPlotRef.current?.focus({ preventScroll: true })
  }, [complete, garden.round])

  function tend(index: number) {
    const next = tendPlot(garden, index)
    if (next === garden) return
    primeAudio()
    const stage = next.plots[index]
    const kind: GardenSound = pickedCount(next) === PLOT_COUNT ? 'complete'
      : stage === 'sprout' ? 'plant' : stage === 'bud' ? 'water' : stage === 'flower' ? 'bloom' : 'pick'
    playGardenSound(kind)
    vibrate(kind === 'complete' ? 'celebrate' : kind === 'pick' || kind === 'bloom' ? 'success' : 'tap')
    setStarted(true)
    setGarden(next)
  }

  function replay() {
    primeAudio()
    playGardenSound('plant')
    setGarden(createGarden(garden.round + 1))
  }

  const content = <div className={styles.page}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <span className={styles.round}>{garden.round + 1}つめの はなたば</span>
      <button className={styles.sound} type="button" onClick={toggleSound} aria-label="おと" aria-pressed={sound}>
        <span aria-hidden="true">{sound ? '♪' : '×♪'}</span>
      </button>
    </header>
    <main className={styles.garden}>
      <div className={styles.sky}>
        <h1>ドットの おはなばたけ</h1>
        <GardenScenery />
        <div className={styles.rabbit}><RabbitArt /></div>
      </div>
      <div className={styles.field}>
        <p className={styles.hint} role="status">{complete ? 'はなたば できたね！' : gardenHint(garden)}</p>
        {!complete && <div className={styles.plots} role="group" aria-label="おはなばたけ">
          {garden.plots.map((stage, index) => <button
            key={index}
            ref={index === 0 ? firstPlotRef : undefined}
            type="button"
            className={styles.plot}
            data-stage={stage}
            aria-label={`${index + 1}ばんの はなだん：${PLOT_ACTION[stage]}`}
            aria-disabled={stage === 'picked'}
            onClick={() => tend(index)}
          >
            <span className={styles.plant} key={stage}><FlowerArt stage={stage} variant={index + garden.round} /></span>
            {(stage === 'sprout' || stage === 'bud' || stage === 'flower') && <span className={styles.action}>
              <ActionArt water={stage !== 'flower'} />
            </span>}
          </button>)}
        </div>}
        {complete ? <div className={styles.bouquet} role="img" aria-label={`つんだ おはな ${picked} / ${PLOT_COUNT}`}>
          <BouquetArt round={garden.round} />
        </div> : <div className={styles.basket} aria-label={`つんだ おはな ${picked} / ${PLOT_COUNT}`}>
          <div className={styles.flowers} aria-hidden="true">
            {garden.plots.map((stage, index) => <span key={index} className={stage === 'picked' ? styles.collected : styles.empty}>
              <FlowerArt variant={index + garden.round} />
            </span>)}
          </div>
          <span className={styles.count}>{picked} <span>/ {PLOT_COUNT}</span></span>
        </div>}
        {complete && <div className={styles.finish}>
          <p>うさぎさんに おはなの おくりもの</p>
          <button ref={replayRef} className={styles.replay} type="button" onClick={replay}>もういちど <span aria-hidden="true">↻</span></button>
        </div>}
        {!complete && <p className={styles.caption}>たね → おみず → おはな</p>}
      </div>
    </main>
  </div>
  return complete ? content : <GamePlaySurface>{content}</GamePlaySurface>
}
