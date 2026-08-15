import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import FlagBall from '../../components/flag-ball/FlagBall'
import {
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  CANNON_MUZZLE_OFFSET,
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
import {
  playPinballBumperSound,
  playPinballLaunchSound,
  playPinballLauncherSound,
  playPinballSpinnerSound,
} from '../../utils/quizSound'
import type { AdventureGimmickEvent } from './gimmicks'
import styles from './AdventureStage.module.css'

type AdventureStageProps = {
  flag: FlagBallData
  runId: number
  onAreaEnter: (areaId: string) => void
  onGoal: () => void
}

/** ピンの発光を見せる時間。React stateではなくclassListにするための固定値。 */
const PIN_HIT_FLASH_MS = 220
const GIMMICK_FLASH_MS = 360

const portalKindClass: Record<PortalKind, string> = {
  hole: styles.portalHole,
  tunnel: styles.portalTunnel,
  pipe: styles.portalPipe,
  cavemouth: styles.portalCavemouth,
}

const WORLD_SIZE = worldSize(AREAS)

function gimmickElementKey(kind: string, id: string): string {
  return `${kind}:${id}`
}

function gimmickClassName(event: AdventureGimmickEvent): string {
  switch (event.kind) {
    case 'cannon-capture':
      return styles.cannonLoaded
    case 'cannon-fire':
      return styles.cannonFired
    case 'jump':
      return styles.jumpHit
    case 'boost':
      return styles.boostActive
  }
}

/**
 * 固定カメラの1画面を描く。
 * fit > stage > viewport > world の入れ子にして、stageの実pxとworldの論理座標を分離する。
 * worldのtranslateとボールのtransformはuseAdventureEngineが直接書き換える。
 */
export default function AdventureStage({ flag, runId, onAreaEnter, onGoal }: AdventureStageProps) {
  const { containerRef, scale, width, height } = useAreaScale()
  const pinElementsRef = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const pinTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const gimmickElementsRef = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const gimmickTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timeouts = pinTimeoutsRef.current
    const gimmickTimeouts = gimmickTimeoutsRef.current
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      timeouts.clear()
      gimmickTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      gimmickTimeouts.clear()
    }
  }, [])

  const flashGimmick = useCallback((event: AdventureGimmickEvent) => {
    const element = gimmickElementsRef.current.get(gimmickElementKey(event.kind.split('-')[0] ?? event.kind, event.id))
    if (!element) return
    const className = gimmickClassName(event)
    const timeoutKey = `${event.kind}:${event.id}`
    element.classList.add(className)
    if (event.kind === 'cannon-capture') return
    if (event.kind === 'cannon-fire') element.classList.remove(styles.cannonLoaded)
    const previous = gimmickTimeoutsRef.current.get(timeoutKey)
    if (previous) clearTimeout(previous)
    const timeoutId = setTimeout(() => {
      element.classList.remove(className)
      gimmickTimeoutsRef.current.delete(timeoutKey)
    }, GIMMICK_FLASH_MS)
    gimmickTimeoutsRef.current.set(timeoutKey, timeoutId)
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
    onGimmick: (event) => {
      flashGimmick(event)
      if (event.kind === 'cannon-fire') playPinballLauncherSound()
      if (event.kind === 'jump') playPinballBumperSound()
      if (event.kind === 'boost') playPinballSpinnerSound()
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
                  {(area.zones ?? []).map((zone) => {
                    const key = gimmickElementKey(zone.kind, zone.id)
                    if (zone.kind === 'cannon') {
                      return (
                        <div
                          key={zone.id}
                          ref={(element) => {
                            gimmickElementsRef.current.set(key, element)
                          }}
                          className={styles.cannon}
                          data-gimmick-id={zone.id}
                          style={{
                            left: zone.x - zone.radius,
                            top: zone.y - zone.radius,
                            width: zone.radius * 2,
                            height: zone.radius * 2,
                            transform: `rotate(${zone.angle}rad)`,
                          }}
                        >
                          <span
                            className={styles.cannonBarrel}
                            style={{ '--cannon-barrel-length': `${CANNON_MUZZLE_OFFSET + 18}px` } as CSSProperties}
                          />
                          <span className={styles.cannonMuzzle} />
                          <span className={styles.cannonArrow}>➜</span>
                        </div>
                      )
                    }
                    if (zone.kind === 'boost') {
                      return (
                        <div
                          key={zone.id}
                          ref={(element) => {
                            gimmickElementsRef.current.set(key, element)
                          }}
                          className={styles.boostLane}
                          data-gimmick-id={zone.id}
                          style={{
                            left: zone.x - zone.width / 2,
                            top: zone.y - zone.height / 2,
                            width: zone.width,
                            height: zone.height,
                            transform: `rotate(${zone.angle}rad)`,
                          }}
                        >
                          <span className={styles.boostArrows}>» » »</span>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={zone.id}
                        className={styles.floatZone}
                        data-gimmick-id={zone.id}
                        style={{
                          left: zone.x - zone.width / 2,
                          top: zone.y - zone.height / 2,
                          width: zone.width,
                          height: zone.height,
                        }}
                      >
                        <span className={styles.floatDots}>· · ·</span>
                      </div>
                    )
                  })}

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
                    if (object.kind === 'jump') {
                      const key = gimmickElementKey(object.kind, object.id)
                      return (
                        <div
                          key={object.id}
                          ref={(element) => {
                            gimmickElementsRef.current.set(key, element)
                          }}
                          className={styles.jumpPad}
                          data-object-id={object.id}
                          style={{
                            left: object.x - object.width / 2,
                            top: object.y - object.height / 2,
                            width: object.width,
                            height: object.height,
                            transform: `rotate(${object.angle}rad)`,
                          }}
                        >
                          <span
                            className={styles.jumpArrow}
                            style={{ transform: `rotate(${object.launchAngle - object.angle}rad)` }}
                          >
                            ↑
                          </span>
                        </div>
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
