import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  SCORE_ZONES,
  ZONE_DIVIDERS,
  ZONE_TOP,
  BALL_RADIUS,
  wallsForMode,
  type ScoreZone,
} from './boardLayout'
import { getBoardConfig } from './boardConfigs'
import { findPinballFlag } from './data/pinballFlags'
import FlagBall from '../../components/flag-ball/FlagBall'
import { useBoardScale } from './useBoardScale'
import { usePinballEngine } from './usePinballEngine'
import type { PinballMode } from './types'
import PinballToy from './PinballToy'
import { usePinballTheme } from './themeStore'
import {
  playPinballBumperSound,
  playPinballJumppadSound,
  playPinballLauncherSound,
  playPinballLaunchSound,
  playPinballScoreSound,
  playPinballSeesawSound,
  playPinballSpinnerSound,
} from '../../utils/quizSound'
import styles from './PinballBoard.module.css'

type PinballBoardProps = {
  /** 選択された flagId（並び順が ballIndex） */
  flagIds: readonly string[]
  /** 遊びかた。壁の構成・射出間隔・終了判定が変わるため usePinballEngine へそのまま渡す */
  mode: PinballMode
  runId: number
  onBallScored: (ballIndex: number, score: number) => void
  onFinished: () => void
}

/** バンパー衝突の光る演出を消すまでの時間(ms) */
const OBSTACLE_HIT_FLASH_MS = 220
/** 得点ポップを表示しておく時間(ms) */
const SCORE_POP_DURATION_MS = 900
/** 得点ゾーンの上端から少し上にポップを出す。盤面高さを変えても位置が追従する。 */
const SCORE_POP_OFFSET_Y = 50

type ScorePop = {
  id: number
  /** ポップを出すゾーンのx中心・幅（ゾーン自体は使い回すので描画時に必要な値だけ持つ） */
  x: number
  width: number
  score: number
}

export default function PinballBoard({ flagIds, mode, runId, onBallScored, onFinished }: PinballBoardProps) {
  const { containerRef, scale, width, height } = useBoardScale()
  const theme = usePinballTheme()
  // 選択中テーマの盤面設定（ピン・バンパー・壁・おもちゃ・射出口）。テーマIDだけを二重管理せず、
  // 既存のテーマ状態(usePinballTheme)からそのまま対応する盤面設定を引く。
  const boardConfig = getBoardConfig(theme.id)

  // 壁の見た目もモードで変える（全射出モードでは床(wall-bottom)の見た目も消す）。
  // usePinballEngine 側の物理壁と同じ関数から導出することで、見た目と当たり判定がずれない。
  const walls = wallsForMode(boardConfig.walls, mode)

  // flagIdsは選択画面（PINBALL_FLAG_IDSの範囲）から渡ってくる前提。
  // 解決できないidが来るのはデータ不整合なので、pinballFlags.tsと同じ方針で早期に気付けるようthrowする。
  const flags = flagIds.map((flagId) => {
    const flag = findPinballFlag(flagId)
    if (!flag) throw new Error(`flag-pinball: 不明な flagId が渡されました: ${flagId}`)
    return flag
  })

  const [pops, setPops] = useState<ScorePop[]>([])
  const [announcement, setAnnouncement] = useState('')

  const popIdRef = useRef(0)
  const popTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const obstacleElementsRef = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const obstacleTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // アンマウント時に、バンパー演出・得点ポップのタイマーを取りこぼさず全部片付ける
  useEffect(() => {
    const popTimeouts = popTimeoutsRef.current
    const obstacleTimeouts = obstacleTimeoutsRef.current
    return () => {
      popTimeouts.forEach((id) => clearTimeout(id))
      popTimeouts.clear()
      obstacleTimeouts.forEach((id) => clearTimeout(id))
      obstacleTimeouts.clear()
    }
  }, [])

  /**
   * バンパー／ピンの発光演出。毎フレーム再レンダーを避けるため React state ではなく
   * classList を直接書き換える（3球が同時に何度も当たるため、ここをstate化すると
   * そのたびにボード全体が再レンダーされてしまう）。
   */
  const flashObstacle = useCallback((obstacleId: string) => {
    const el = obstacleElementsRef.current.get(obstacleId)
    if (!el) return
    el.classList.add(styles.hit)
    const previous = obstacleTimeoutsRef.current.get(obstacleId)
    if (previous) clearTimeout(previous)
    const timeoutId = setTimeout(() => {
      el.classList.remove(styles.hit)
      obstacleTimeoutsRef.current.delete(obstacleId)
    }, OBSTACLE_HIT_FLASH_MS)
    obstacleTimeoutsRef.current.set(obstacleId, timeoutId)
  }, [])

  /** 得点ポップ。1プレイに3回しか起きないので React state で管理してよい */
  const addScorePop = useCallback((zone: ScoreZone) => {
    const id = popIdRef.current
    popIdRef.current += 1
    setPops((prev) => [...prev, { id, x: zone.x + zone.width / 2, width: zone.width, score: zone.score }])
    const timeoutId = setTimeout(() => {
      setPops((prev) => prev.filter((pop) => pop.id !== id))
      popTimeoutsRef.current.delete(timeoutId)
    }, SCORE_POP_DURATION_MS)
    popTimeoutsRef.current.add(timeoutId)
  }, [])

  const { registerBall, registerToy, activateToy } = usePinballEngine({
    flagIds,
    mode,
    boardConfig,
    runId,
    onBallLaunched: () => {
      playPinballLaunchSound()
    },
    onObstacleHit: (obstacleId) => {
      playPinballBumperSound()
      flashObstacle(obstacleId)
    },
    onBallScored: (ballIndex, zone) => {
      playPinballScoreSound(zone.score)
      addScorePop(zone)
      const flag = flags[ballIndex]
      setAnnouncement(flag ? `${flag.nameJa} ${zone.score}てん` : `${zone.score}てん`)
      onBallScored(ballIndex, zone.score)
    },
    onFinished: () => {
      onFinished()
    },
  })

  return (
    <div ref={containerRef} className={styles.fit}>
      <div className={styles.stage} style={{ width, height }}>
        <div
          className={`${styles.logical} ${theme.boardClassName}`}
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `scale(${scale})` }}
        >
          <div className={styles.background} aria-hidden="true" />

          {theme.renderBackdrop ? (
            <div className={styles.backdropLayer} aria-hidden="true">
              {theme.renderBackdrop()}
            </div>
          ) : null}

          {walls.map((wall) => (
            <div
              key={wall.id}
              aria-hidden="true"
              className={wall.id.startsWith('wall-guide') ? styles.guideWall : styles.wall}
              style={{
                left: wall.x - wall.width / 2,
                top: wall.y - wall.height / 2,
                width: wall.width,
                height: wall.height,
                transform: `rotate(${wall.angle}rad)`,
              }}
            />
          ))}

          {ZONE_DIVIDERS.map((divider) => (
            <div
              key={divider.id}
              aria-hidden="true"
              className={styles.divider}
              style={{
                left: divider.x - divider.width / 2,
                top: divider.y - divider.height / 2,
                width: divider.width,
                height: divider.height,
              }}
            />
          ))}

          {boardConfig.obstacles.map((obstacle) => (
            <div
              key={obstacle.id}
              ref={(el) => {
                obstacleElementsRef.current.set(obstacle.id, el)
              }}
              data-obstacle-id={obstacle.id}
              aria-hidden="true"
              className={obstacle.kind === 'bumper' ? styles.bumper : styles.peg}
              style={{
                left: obstacle.x - obstacle.radius,
                top: obstacle.y - obstacle.radius,
                width: obstacle.radius * 2,
                height: obstacle.radius * 2,
              }}
            />
          ))}

          {SCORE_ZONES.map((zone) => (
            <div
              key={zone.id}
              aria-hidden="true"
              className={styles.zone}
              data-score={zone.score}
              style={{
                left: zone.x,
                top: ZONE_TOP,
                width: zone.width,
                height: BOARD_HEIGHT - ZONE_TOP,
              }}
            >
              <span className={styles.zoneScore}>{zone.score}</span>
            </div>
          ))}

          {pops.map((pop) => (
            <div
              key={pop.id}
              aria-hidden="true"
              className={styles.scorePop}
              style={{ left: pop.x, width: pop.width, top: ZONE_TOP - SCORE_POP_OFFSET_Y }}
            >
              {pop.score}てん！
            </div>
          ))}

          {/* おもちゃはボールより先に描き、国旗ボールを隠さないようにする。 */}
          {boardConfig.toys.map((toy) => (
            <PinballToy
              key={toy.id}
              toy={toy}
              theme={theme}
              registerToy={registerToy}
              onActivate={(toyId) => {
                if (toy.kind === 'spinner') {
                  playPinballSpinnerSound()
                } else if (toy.kind === 'jumppad') {
                  playPinballJumppadSound()
                } else if (toy.kind === 'seesaw') {
                  playPinballSeesawSound()
                } else {
                  playPinballLauncherSound()
                }
                activateToy(toyId)
              }}
            />
          ))}

          {/*
            usePinballEngine は「.logical コンテナの原点(0,0)を基準にした
            transform: translate(x, y)」をボール要素へ直接書き込む。FlagBall.module.css の
            .ball は単体利用（選択画面など）でも成立するよう position: relative を既定にしており、
            2つの CSS Modules ファイルにまたがって position を上書きすると結合順に依存し
            確実ではない。そこで FlagBall 自体には触れず、絶対配置専用のラッパー div を
            この盤面側だけに用意し、ref（registerBall）と position: absolute はラッパーが持つ。
          */}
          {flags.map((flag, ballIndex) => (
            <div key={flag.id} ref={registerBall(ballIndex)} className={styles.ballSlot} aria-hidden="true">
              <FlagBall flag={flag} size={BALL_RADIUS * 2} />
            </div>
          ))}
        </div>
      </div>

      <div role="status" aria-live="polite" className={styles.announcement}>
        {announcement}
      </div>
    </div>
  )
}
