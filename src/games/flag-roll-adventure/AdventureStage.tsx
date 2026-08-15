import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import FlagBall from '../../components/flag-ball/FlagBall'
import {
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  EXIT_SENSOR_HEIGHT,
  EXIT_SWALLOW_MS,
  EXIT_WIDTH,
  ENTRY_EMERGE_MS,
} from './adventurePhysics'
import { AREAS } from './data/areas'
import { areaGroundRects, cupWellRect, worldSize } from './adventureGeometry'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import type { PortalKind } from './types'
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

const portalKindClass: Record<PortalKind, string> = {
  hole: styles.portalHole,
  tunnel: styles.portalTunnel,
  pipe: styles.portalPipe,
  cavemouth: styles.portalCavemouth,
}

const WORLD_SIZE = worldSize(AREAS)

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

  const { registerBall, registerBallVisual, registerWorld } = useAdventureEngine({
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
            style={{ width: WORLD_SIZE.width, height: WORLD_SIZE.height }}
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

                  {areaGroundRects(area).map((rect, index) => (
                    <div
                      key={`ground-${area.id}-${index}`}
                      className={styles.portalFloor}
                      style={rect}
                    />
                  ))}

                  {area.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={[styles.portal, styles.entryPortal, portalKindClass[entry.kind]].join(' ')}
                      data-portal-id={entry.id}
                      data-portal-kind={entry.kind}
                      style={{
                        left: entry.x - EXIT_WIDTH / 2,
                        top: entry.y - EXIT_SENSOR_HEIGHT / 2,
                        width: EXIT_WIDTH,
                        height: EXIT_SENSOR_HEIGHT,
                      }}
                    >
                      <span className={styles.portalInner} />
                    </div>
                  ))}

                  {area.exits.map((exit) => (
                    <div
                      key={exit.id}
                      className={[styles.portal, styles.exitPortal, portalKindClass[exit.kind]].join(' ')}
                      data-portal-id={exit.id}
                      data-portal-kind={exit.kind}
                      style={{
                        left: exit.x - exit.width / 2,
                        top: exit.y - exit.height / 2,
                        width: exit.width,
                        height: exit.height,
                      }}
                    >
                      <span className={styles.portalInner} />
                    </div>
                  ))}

                  {area.cup && (
                    <div className={styles.cupBack} data-cup-id={area.cup.id} style={cupWellRect(area.cup)}>
                      <span className={styles.cupOpening} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div
              ref={registerBall}
              className={styles.ballSlot}
              style={{ zIndex: ADVENTURE_LAYER_Z_INDEX.ball }}
              aria-hidden="true"
            >
              <div
                ref={registerBallVisual}
                className={styles.ballVisual}
                style={
                  {
                    '--exit-swallow-ms': `${EXIT_SWALLOW_MS}ms`,
                    '--entry-emerge-ms': `${ENTRY_EMERGE_MS}ms`,
                  } as CSSProperties
                }
              >
                <FlagBall flag={flag} size={BALL_RADIUS * 2} />
              </div>
            </div>

            {AREAS.map((area) => (
              <AreaForeground
                key={area.id}
                theme={area.theme}
                entries={area.entries}
                exits={area.exits}
                cup={area.cup}
                style={{ left: area.origin.x, top: area.origin.y, width: AREA_WIDTH, height: AREA_HEIGHT }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
