import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import GamePlaySurface from '../../components/GamePlaySurface'
import {
  DEFAULT_SELECTIONS,
  RACE_CARS,
  RACE_COLORS,
  type RaceCarId,
  type RaceSelection,
} from './raceConfig'
import { CIRCUITS, CIRCUIT_SCENERY, circuitPreview } from './circuit'
import type { RaceCameraMode } from './raceCamera'
import {
  useCircuitRacingEngine,
  type CircuitRacingEngineStatus,
} from './useCircuitRacingEngine'
import styles from './CircuitRacingPlay.module.css'

import { SPECIALS, type SpecialState } from './special'

const COURSE_PREVIEWS = CIRCUITS.map(circuitPreview)

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

function carById(id: RaceCarId) {
  return RACE_CARS.find((car) => car.id === id) ?? RACE_CARS[0]!
}

function copySelections(selections: readonly RaceSelection[]): RaceSelection[] {
  return selections.map((selection) => ({ ...selection }))
}

function SceneStatus({ status, onRetry }: { status: CircuitRacingEngineStatus; onRetry: () => void }) {
  if (status === 'ready') return null
  return (
    <div className={styles.sceneStatus} role={status === 'error' ? 'alert' : 'status'}>
      <span className={styles.sceneStatusIcon} aria-hidden="true">{status === 'error' ? '⚠️' : '⏳'}</span>
      <span>{status === 'error' ? '3Dを ひょうじできないよ' : 'くるまを よみこんでいるよ'}</span>
      {status === 'error' ? (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          もういちど
        </button>
      ) : null}
    </div>
  )
}

export default function CircuitRacingPlay() {
  const [selections, setSelections] = useState<RaceSelection[]>(() => copySelections(DEFAULT_SELECTIONS))
  const [circuit, setCircuit] = useState(CIRCUITS[0]!)
  const [carCount, setCarCount] = useState<2 | 3>(2)
  const [phase, setPhase] = useState<'select' | 'race'>('select')
  const [cameraMode, setCameraMode] = useState<RaceCameraMode>(() => prefersReducedMotion() ? 'trackside' : 'chase')
  const [targetIndex, setTargetIndex] = useState(0)
  const [sceneStatus, setSceneStatus] = useState<CircuitRacingEngineStatus>('loading')
  const [specialStates, setSpecialStates] = useState<readonly SpecialState[]>([])
  const [boostFeedback, setBoostFeedback] = useState(0)

  const handleSceneStatus = useCallback((status: CircuitRacingEngineStatus) => {
    setSceneStatus(status)
  }, [])
  const engine = useCircuitRacingEngine({
    selections,
    circuit,
    running: phase === 'race' && sceneStatus === 'ready',
    cameraMode,
    targetIndex,
    onStatusChange: handleSceneStatus,
    onSpecialChange: setSpecialStates,
  })
  const { registerContainer, retry, boost, special, adjustCamera } = engine

  useEffect(() => {
    if (boostFeedback === 0) return undefined
    const timeout = window.setTimeout(() => setBoostFeedback(0), 420)
    return () => window.clearTimeout(timeout)
  }, [boostFeedback])

  const chooseCarCount = useCallback((count: 2 | 3) => {
    setCarCount(count)
    setSelections((current) => {
      if (count === 2) return current.slice(0, 2)
      const third = current[2] ?? { carId: 'suv' as RaceCarId, color: RACE_COLORS[2]!.value }
      return [...current.slice(0, 2), { ...third }]
    })
    setTargetIndex((index) => Math.min(index, count - 1))
  }, [])

  const chooseCar = useCallback((slot: number, carId: RaceCarId) => {
    setTargetIndex(slot)
    setSelections((current) => current.map((selection, index) => index === slot ? { ...selection, carId } : selection))
  }, [])

  const chooseColor = useCallback((slot: number, color: string) => {
    setTargetIndex(slot)
    setSelections((current) => current.map((selection, index) => index === slot ? { ...selection, color } : selection))
  }, [])

  const beginRace = useCallback(() => {
    setTargetIndex(0)
    setCameraMode(prefersReducedMotion() ? 'trackside' : 'chase')
    setPhase('race')
  }, [])

  const backToSelection = useCallback(() => {
    setCameraMode(prefersReducedMotion() ? 'trackside' : 'chase')
    setPhase('select')
  }, [])

  const handleBoost = useCallback(() => {
    boost(targetIndex)
    setBoostFeedback((value) => value + 1)
  }, [boost, targetIndex])

  const selectedSpecial = SPECIALS[selections[targetIndex]!.carId]
  const specialState = specialStates[targetIndex]
  const specialReady = (specialState?.charge ?? 0) >= 1 && !specialState?.remaining
  const specialActive = (specialState?.remaining ?? 0) > 0

  const cameraButtons = useMemo(() => [
    { mode: 'chase' as const, label: 'おいかける', icon: '🚗' },
    { mode: 'trackside' as const, label: 'みちばた', icon: '👀' },
    { mode: 'free' as const, label: 'じゆうに みる', icon: '🌀' },
  ], [])

  return (
    <GamePlaySurface>
      <main className={styles.page} data-game-back-overlap-ok>
        <div ref={registerContainer} className={styles.scene} role="application" aria-label="サーキットレースの 3Dコース">
          <SceneStatus status={sceneStatus} onRetry={retry} />
        </div>

        {phase === 'select' ? (
          <section className={styles.selectionPanel} aria-label="レースの じゅんび">
            <header className={styles.header}>
              <h1 className={styles.title}><span aria-hidden="true">🏁</span> サーキットレース</h1>
            </header>
            <div className={styles.selectionScroll}>
              <section className={styles.courseSection} aria-label="コースを えらぶ">
                <h2 className={styles.sectionLabel}>コースを えらぶ</h2>
                <div className={styles.courseGrid}>
                  {CIRCUITS.map((course, index) => (
                    <button
                      key={course.id}
                      type="button"
                      className={styles.courseButton}
                      style={{ '--course-ground': CIRCUIT_SCENERY[course.scenery].ground, '--course-sky': CIRCUIT_SCENERY[course.scenery].sky } as CSSProperties}
                      aria-label={course.name}
                      aria-pressed={circuit.id === course.id}
                      onClick={() => {
                        if (circuit.id === course.id) return
                        setSceneStatus('loading')
                        setCircuit(course)
                      }}
                    >
                      <svg viewBox={COURSE_PREVIEWS[index]!.viewBox} aria-hidden="true" focusable="false">
                        <polyline points={COURSE_PREVIEWS[index]!.points} fill="none" stroke="currentColor" strokeWidth="10" strokeLinejoin="round" />
                      </svg>
                      <span>{circuit.id === course.id ? '✓ ' : ''}{course.name}</span>
                      <small>{course.description}</small>
                      <small><span aria-hidden="true">{CIRCUIT_SCENERY[course.scenery].icon}</span> {CIRCUIT_SCENERY[course.scenery].label}</small>
                    </button>
                  ))}
                </div>
              </section>
              <div className={styles.countRow} aria-label="くるまの かず">
                <span className={styles.sectionLabel}>くるまの かず</span>
                {[2, 3].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={styles.countButton}
                    aria-pressed={carCount === count}
                    onClick={() => chooseCarCount(count as 2 | 3)}
                  >
                    {count}だい
                  </button>
                ))}
              </div>
              <div className={styles.slotList}>
                {selections.map((selection, slot) => {
                  const selectedCar = carById(selection.carId)
                  return (
                    <section key={slot} className={styles.slot} aria-label={`${slot + 1}だいめの くるま`}>
                      <h2 className={styles.slotTitle}><span className={styles.slotNumber}>{slot + 1}</span> だいめ</h2>
                      <div className={styles.choiceRow} aria-label={`${slot + 1}だいめの くるまを えらぶ`}>
                        {RACE_CARS.map((car) => {
                          return (
                            <button
                              key={car.id}
                              type="button"
                              className={styles.carButton}
                              aria-label={`${car.label}を えらぶ`}
                              aria-pressed={selection.carId === car.id}
                              onClick={() => chooseCar(slot, car.id)}
                            >
                              <span className={styles.carEmoji} aria-hidden="true">{car.emoji}</span>
                              <span>{selection.carId === car.id ? '✓ ' : ''}{car.label}</span>
                            </button>
                          )
                        })}
                      </div>
                      <p className={styles.carDescription}>{selectedCar.description}</p>
                      <div className={styles.colorRow} aria-label={`${selectedCar.label}の いろを えらぶ`}>
                        <span className={styles.colorLabel}>いろ</span>
                        {RACE_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={styles.colorButton}
                            aria-label={color.label}
                            aria-pressed={selection.color === color.value}
                            onClick={() => chooseColor(slot, color.value)}
                            style={{ '--swatch': color.value } as CSSProperties}
                          >
                            <span aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
            <button type="button" className={styles.beginButton} onClick={beginRace} disabled={sceneStatus !== 'ready'}>
              <span aria-hidden="true">▶</span> レースを はじめる
            </button>
          </section>
        ) : (
          <section className={styles.racePanel} aria-label="レースの そうさ">
            <div className={styles.raceHeader}>
              <button type="button" className={styles.backButton} onClick={backToSelection} aria-label="えらびなおす"><span aria-hidden="true">えらび<br />なおす</span></button>
              <h1 className={styles.raceTitle}><span aria-hidden="true">🏁</span> はしってるよ！</h1>
              <button
                type="button"
                className={styles.specialButton}
                disabled={!specialReady || sceneStatus !== 'ready'}
                data-ready={specialReady}
                aria-label={`スペシャル：${selectedSpecial.label}`}
                onClick={() => special(targetIndex)}
              >
                <span>{selectedSpecial.icon} スペシャル</span>
                <span className={styles.specialGauge} role="progressbar" aria-label="スペシャルゲージ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor((specialState?.charge ?? 0) * 100)}>
                  <span style={{ width: `${(specialState?.charge ?? 0) * 100}%` }} />
                </span>
                <small>{specialActive ? 'はつどうちゅう！' : specialReady ? 'つかえるよ！' : 'ためているよ'}</small>
              </button>
              <button
                type="button"
                className={styles.boostButton}
                data-active={boostFeedback > 0 ? 'true' : 'false'}
                aria-label={`${targetIndex + 1}だいめを かそく`}
                onClick={handleBoost}
              >
                <span aria-hidden="true">⚡</span> かそく！
              </button>
            </div>
            <p className={styles.courseName}>{circuit.name}</p>
            <div className={styles.raceTools}>
              <div className={styles.cameraModes} aria-label="カメラを えらぶ">
                {cameraButtons.map((button) => (
                  <button
                    key={button.mode}
                    type="button"
                    className={styles.cameraButton}
                    aria-pressed={cameraMode === button.mode}
                    onClick={() => setCameraMode(button.mode)}
                  >
                    <span aria-hidden="true">{button.icon}</span>{button.label}
                  </button>
                ))}
              </div>
              <div className={styles.targetRow} aria-label="みる くるまを えらぶ">
                <span>みる くるま</span>
                {selections.map((selection, index) => {
                  return (
                    <button
                      key={index}
                      type="button"
                      className={styles.targetButton}
                      aria-pressed={targetIndex === index}
                      onClick={() => setTargetIndex(index)}
                    >
                      <span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: selection.color }} /> {index + 1}だいめ
                    </button>
                  )
                })}
              </div>
              {cameraMode === 'free' ? <div className={styles.accessibleCamera} aria-label="カメラの ボタンそうさ">
                <button type="button" className={styles.overviewButton} onClick={() => adjustCamera('overview')}>▣ ぜんたい</button>
                <button type="button" aria-label="カメラを ひだりに まわす" onClick={() => adjustCamera('turnLeft')}>↶</button>
                <button type="button" aria-label="カメラを みぎに まわす" onClick={() => adjustCamera('turnRight')}>↷</button>
                <button type="button" aria-label="カメラを ひだりへ" onClick={() => adjustCamera('left')}>←</button>
                <button type="button" aria-label="カメラを みぎへ" onClick={() => adjustCamera('right')}>→</button>
                <button type="button" aria-label="カメラを うえへ" onClick={() => adjustCamera('up')}>↑</button>
                <button type="button" aria-label="カメラを したへ" onClick={() => adjustCamera('down')}>↓</button>
                <button type="button" aria-label="カメラを ちかく" onClick={() => adjustCamera('in')}>＋</button>
                <button type="button" aria-label="カメラを とおく" onClick={() => adjustCamera('out')}>−</button>
              </div> : null}
            </div>
          </section>
        )}
      </main>
    </GamePlaySurface>
  )
}
