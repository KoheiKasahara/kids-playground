import { useCallback, useEffect, useRef } from 'react'
import FlagBall from '../../components/flag-ball/FlagBall'
import {
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
} from './adventurePhysics'
import { AREAS } from './data/areas'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import AreaBackground from './AreaBackground'
import AreaForeground from './AreaForeground'
import { ADVENTURE_LAYER_Z_INDEX } from './layerOrder'
import { useAdventureEngine } from './useAdventureEngine'
import { useAreaScale } from './useAreaScale'
import { playPinballBumperSound, playPinballLaunchSound } from '../../utils/quizSound'
import styles from './AdventureStage.module.css'

type AdventureStageProps = {
  flag: FlagBallData
  runId: number
  onAreaEnter: (areaId: string) => void
  onGoal: () => void
}

/** ピンの発光を見せる時間。React stateではなくclassListにするための固定値。 */
const PIN_HIT_FLASH_MS = 220

/**
 * 固定カメラの1画面を描く。
 * fit > stage > viewport > world の入れ子にして、stageの実pxとworldの論理座標を分離する。
 * worldのtranslateとボールのtransformはuseAdventureEngineが直接書き換える。
 */
export default function AdventureStage({ flag, runId, onAreaEnter, onGoal }: AdventureStageProps) {
  const { containerRef, scale, width, height } = useAreaScale()
  const pinElementsRef = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const pinTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timeouts = pinTimeoutsRef.current
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  const flashPin = useCallback((pinId: string) => {
    const element = pinElementsRef.current.get(pinId)
    if (!element) return
    element.classList.add(styles.hit)
    const previous = pinTimeoutsRef.current.get(pinId)
    if (previous) clearTimeout(previous)
    const timeoutId = setTimeout(() => {
      element.classList.remove(styles.hit)
      pinTimeoutsRef.current.delete(pinId)
    }, PIN_HIT_FLASH_MS)
    pinTimeoutsRef.current.set(pinId, timeoutId)
  }, [])

  const { registerBall, registerWorld } = useAdventureEngine({
    runId,
    onAreaEnter,
    onGoal,
    onBallLaunched: playPinballLaunchSound,
    onPinHit: (pinId) => {
      // ピンボールと同じ既存音を使う。音の意味は「ピンに当たった」なので再利用できる。
      // 実際のクールダウンはエンジン側とquizSound側の二重で間引く。
      playPinballBumperSound()
      flashPin(pinId)
    },
  })

  return (
    <div ref={containerRef} className={styles.fit}>
      <div className={styles.stage} style={{ width, height }}>
        <div
          className={styles.viewport}
          style={{ width: AREA_WIDTH, height: AREA_HEIGHT, transform: `scale(${scale})` }}
        >
          <div
            ref={registerWorld}
            className={styles.world}
            style={{ width: AREA_WIDTH, height: AREA_HEIGHT * AREAS.length }}
          >
            {AREAS.map((area) => (
              <div
                key={area.id}
                className={[styles.area, styles[`theme${area.theme[0].toUpperCase()}${area.theme.slice(1)}`]].join(' ')}
                style={{ left: area.origin.x, top: area.origin.y, width: AREA_WIDTH, height: AREA_HEIGHT }}
              >
                <AreaBackground theme={area.theme} />

                <div className={styles.course} style={{ zIndex: ADVENTURE_LAYER_Z_INDEX.course }} aria-hidden="true">
                  {area.objects.map((object) => {
                    if (object.kind === 'wall') {
                      return (
                        <div
                          key={object.id}
                          className={styles.wall}
                          data-object-id={object.id}
                          style={{
                            left: object.x - object.width / 2,
                            top: object.y - object.height / 2,
                            width: object.width,
                            height: object.height,
                            transform: `rotate(${object.angle}rad)`,
                          }}
                        />
                      )
                    }
                    return (
                      <div
                        key={object.id}
                        ref={(element) => {
                          pinElementsRef.current.set(object.id, element)
                        }}
                        className={styles.pin}
                        data-object-id={object.id}
                        style={{
                          left: object.x - object.radius,
                          top: object.y - object.radius,
                          width: object.radius * 2,
                          height: object.radius * 2,
                        }}
                      />
                    )
                  })}

                  {area.exits.map((exit) => (
                    <div
                      key={exit.id}
                      className={[styles.exit, exit.to === null ? styles.goalExit : ''].filter(Boolean).join(' ')}
                      style={{
                        left: exit.x - exit.width / 2,
                        top: exit.y - exit.height / 2,
                        width: exit.width,
                        height: exit.height,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div
              ref={registerBall}
              className={styles.ballSlot}
              style={{ zIndex: ADVENTURE_LAYER_Z_INDEX.ball }}
              aria-hidden="true"
            >
              <FlagBall flag={flag} size={BALL_RADIUS * 2} />
            </div>

            {AREAS.map((area) => (
              <AreaForeground
                key={area.id}
                theme={area.theme}
                style={{ left: area.origin.x, top: area.origin.y, width: AREA_WIDTH, height: AREA_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
