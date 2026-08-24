import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { findFlagBall, type FlagBallData } from '../../components/flag-ball/flagBalls'
import { playCorrectSound, playPanelOpenSound, primeAudio } from '../../utils/quizSound'
import PartShape from './PartShape'
import PartTray from './PartTray'
import PuzzleBoard from './PuzzleBoard'
import { nearestCell, sameCell, type GridCell } from './grid'
import type { PartTypeId } from './partTypes'
import { boardPointFromClient, canPlacePart, partAtCell } from './placement'
import {
  clearAll,
  clearPartSelection,
  createPuzzleState,
  reachGoal,
  removeSelectedPart,
  returnBall,
  selectPart,
  startRun,
  tryPlacePart,
} from './puzzleState'
import { useBoardScale } from './useBoardScale'
import { usePuzzleEngine } from './usePuzzleEngine'
import styles from './FlagRollPuzzlePlay.module.css'

/**
 * Phase 1で使う国旗ボール。
 * 国旗を選ぶ画面はこのPhaseの目的（配置 → 落とす → ゴール のループを作る）から外れるため、
 * 共通の国旗ボールデータから1つを固定で使う。選べるようにするときは、
 * こっきドミノやこっきピンボールと同じ選択画面の作りをここへ足せばよい。
 */
const BALL_FLAG_ID = 'jp'

/**
 * 使う国旗ボール。未知のidはデータ不整合なので、flagBalls.ts と同じ方針で
 * （画面を描き始める前に）早期に throw する。
 */
const BALL_FLAG = ((): FlagBallData => {
  const flag = findFlagBall(BALL_FLAG_ID)
  if (!flag) throw new Error(`flag-roll-puzzle: 不明な国旗ボールです: ${BALL_FLAG_ID}`)
  return flag
})()

/** 置けなかったときなどの案内を出しておく時間(ms) */
const MESSAGE_DURATION_MS = 1600

/** タップとドラッグを見分けるしきい値(px)。幼児の指ぶれで誤ってドラッグ扱いにしない */
const DRAG_THRESHOLD_PX = 8

/** ドラッグ終了の直後に飛んでくる click を、タップ選択と取り違えないための猶予(ms) */
const CLICK_AFTER_DRAG_IGNORE_MS = 300

type DragState = {
  readonly typeId: PartTypeId
  /** 画面上のポインタ位置。指についてくる分身の表示に使う */
  readonly x: number
  readonly y: number
  readonly moved: boolean
}

const EDIT_HINT = 'いたを おいて、ゴールまで はこぼう！'

export default function FlagRollPuzzlePlay() {
  const navigate = useNavigate()
  const [state, setState] = useState(createPuzzleState)
  const [selectedTypeId, setSelectedTypeId] = useState<PartTypeId | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghostCell, setGhostCell] = useState<GridCell | null>(null)
  const [message, setMessage] = useState('')

  const { containerRef, scale, width, height } = useBoardScale()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null)
  // ドラッグして置いた直後にも click は飛んでくる。その click で「選択」まで
  // 起きてしまわないよう、ドラッグが終わった時刻を覚えておき、直後の click だけ捨てる
  // （真偽値で覚えると、click が飛ばない環境で値が残り、次のタップを食べてしまう）。
  const dragEndedAtRef = useRef(0)
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current !== null) clearTimeout(messageTimeoutRef.current)
    }
  }, [])

  const showMessage = useCallback((text: string) => {
    if (messageTimeoutRef.current !== null) clearTimeout(messageTimeoutRef.current)
    setMessage(text)
    messageTimeoutRef.current = setTimeout(() => setMessage(''), MESSAGE_DURATION_MS)
  }, [])

  const handleGoal = useCallback(() => {
    setState((current) => reachGoal(current))
    playCorrectSound()
  }, [])

  const { registerBall } = usePuzzleEngine({
    parts: state.parts,
    // ゴール後もボールをその位置に見せたままにするため、cleared のあいだも物理世界は保つ。
    // 編集へ戻ったときにだけ世界を捨てて、ボールを開始位置へ戻す。
    running: state.phase !== 'edit',
    runId: state.runId,
    onGoal: handleGoal,
  })

  /** 画面上のポインタ位置を、盤面のマスへ変換する */
  const cellFromClient = useCallback(
    (clientX: number, clientY: number): GridCell | null => {
      const board = boardRef.current
      if (!board) return null
      const rect = board.getBoundingClientRect()
      return nearestCell(boardPointFromClient(clientX, clientY, rect, scale))
    },
    [scale],
  )

  /** そのマスへ置く。置けなければ理由を短く伝えるだけで、盤面は変えない */
  const place = useCallback(
    (typeId: PartTypeId, cell: GridCell | null) => {
      if (!cell) return
      const next = tryPlacePart(state, typeId, cell)
      if (!next) {
        showMessage('ここには おけないよ')
        return
      }
      setState(next)
      playPanelOpenSound()
    },
    [state, showMessage],
  )

  const handlePartPointerDown = (typeId: PartTypeId, event: PointerEvent<HTMLButtonElement>) => {
    if (state.phase !== 'edit') return
    primeAudio()
    // jsdom や一部の組込みブラウザは Pointer Capture を持たないことがある。
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragStartPointRef.current = { x: event.clientX, y: event.clientY }
    setState((current) => clearPartSelection(current))
    setDrag({ typeId, x: event.clientX, y: event.clientY, moved: false })
  }

  const handlePartPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStartPointRef.current
    if (!drag || !start) return
    const moved =
      drag.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD_PX
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved })
    if (!moved) return

    // 置ける場所だけ下書きを出す。置けない場所では何も出さないことが
    // そのまま「ここには置けない」の合図になる。
    const cell = cellFromClient(event.clientX, event.clientY)
    const nextGhost = cell && canPlacePart(state.parts, drag.typeId, cell) ? cell : null
    setGhostCell((current) => {
      if (current === null && nextGhost === null) return current
      if (current && nextGhost && sameCell(current, nextGhost)) return current
      return nextGhost
    })
  }

  const handlePartPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag
    setDrag(null)
    setGhostCell(null)
    dragStartPointRef.current = null
    // 動かしていなければタップ。選択は click 側で扱う（キーボード操作と同じ経路にするため）
    if (!active?.moved) return
    dragEndedAtRef.current = Date.now()
    place(active.typeId, cellFromClient(event.clientX, event.clientY))
  }

  /** パーツ置き場のタップ。選んでから盤面をタップして置く操作の入口 */
  const handlePartClick = (typeId: PartTypeId) => {
    if (Date.now() - dragEndedAtRef.current < CLICK_AFTER_DRAG_IGNORE_MS) return
    if (state.phase !== 'edit') return
    primeAudio()
    // パーツ置き場の選択と、盤面のパーツの選択は同時に持たない（操作の対象を1つに保つ）
    setState((current) => clearPartSelection(current))
    setSelectedTypeId((current) => (current === typeId ? null : typeId))
  }

  /**
   * 盤面のタップ。
   * パーツ置き場でパーツを選んでいるときは、そのマスへ置く。
   * 何も選んでいないときは、タップしたマスにあるパーツを「選ぶ」
   * （選んだパーツは「けす」で1つだけ外せる。Phase 2の移動・回転も同じ選択を使う想定）。
   */
  const handleBoardPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (state.phase !== 'edit' || drag) return
    const cell = cellFromClient(event.clientX, event.clientY)
    if (!cell) return

    // すでにパーツがあるマスを押したら、置こうとするのではなく、そのパーツを選ぶ。
    // 幼児がパーツ置き場を選んだまま置いたパーツを押しても「置けない」と言われず、
    // そのまま消す操作へ進める（消すのは「けす」を押したときだけなので、誤って消えない）。
    const part = partAtCell(state.parts, cell)
    if (part) {
      setSelectedTypeId(null)
      setState((current) => selectPart(current, part.id))
      return
    }
    if (selectedTypeId) {
      place(selectedTypeId, cell)
      return
    }
    setState((current) => clearPartSelection(current))
  }

  /** 選んでいるパーツを1つだけ消す */
  const handleRemoveSelectedPart = () => {
    setState((current) => removeSelectedPart(current))
    playPanelOpenSound()
  }

  const handleDrop = () => {
    primeAudio()
    setSelectedTypeId(null)
    setGhostCell(null)
    setState((current) => startRun(current))
  }

  const handleReturnBall = () => {
    setState((current) => returnBall(current))
  }

  const handleClearAll = () => {
    setSelectedTypeId(null)
    setGhostCell(null)
    setState((current) => clearAll(current))
  }

  const editing = state.phase === 'edit'
  const partSelected = state.selectedPartId !== null
  // パーツを選んでいるあいだは、同じ行に出る「えらんだ いたを けす」がそのまま案内になるため
  // ひとことは出さない（同じことを2つ並べて書かない）。
  const editHint = partSelected ? '' : EDIT_HINT
  const status = message || (state.phase === 'cleared' ? 'ゴール！ すごい！' : editing ? editHint : 'ころころ ころがってるよ！')

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>
          やめる
        </button>
        <h1 className={styles.title}>こっきコロコロパズル</h1>
      </header>

      <div className={styles.body}>
        <PuzzleBoard
          parts={state.parts}
          selectedPartId={state.selectedPartId}
          flag={BALL_FLAG}
          ghost={ghostCell && drag ? { typeId: drag.typeId, cell: ghostCell } : null}
          highlightGrid={editing && (drag !== null || selectedTypeId !== null)}
          cleared={state.phase === 'cleared'}
          containerRef={containerRef}
          boardRef={boardRef}
          scale={scale}
          width={width}
          height={height}
          registerBall={registerBall}
          onPointerDown={handleBoardPointerDown}
        />

        {/*
          ひとこと・パーツ置き場・操作ボタンのまとまり。
          縦画面では盤面の下に積み、低い横画面では盤面の横へ回す（.body の row 切替）。
        */}
        <div className={styles.side}>
          {/*
            ひとことと「けす」を同じ行に置き、選択中でも行の高さが変わらないようにする
            （盤面の高さが選択のたびに動くと、置いたパーツの位置が見た目で動いてしまう）。
          */}
          <div className={styles.statusRow}>
            <p className={styles.status} role="status" aria-live="polite" data-cleared={state.phase === 'cleared'}>
              {status}
            </p>
            {partSelected ? (
              <button type="button" className={styles.removeButton} onClick={handleRemoveSelectedPart}>
                えらんだ いたを けす
              </button>
            ) : null}
          </div>

          <PartTray
            selectedTypeId={selectedTypeId}
            disabled={!editing}
            onPartPointerDown={handlePartPointerDown}
            onPartPointerMove={handlePartPointerMove}
            onPartPointerUp={handlePartPointerUp}
            onPartClick={handlePartClick}
          />

          <div className={styles.controls}>
            {editing ? (
              <BigButton className={styles.dropButton} onClick={handleDrop}>
                ボールを おとす！
              </BigButton>
            ) : (
              <BigButton className={styles.dropButton} variant="secondary" onClick={handleReturnBall}>
                ボールを もどす
              </BigButton>
            )}
            <button type="button" className={styles.clearButton} onClick={handleClearAll}>
              ぜんぶ けす
            </button>
          </div>
        </div>
      </div>

      {/* 指についてくるパーツの分身。盤面と同じ倍率で見せて、置いたときの大きさを想像しやすくする */}
      {drag?.moved ? (
        <div
          className={styles.dragPreview}
          style={{ left: drag.x, top: drag.y, transform: `scale(${scale})` }}
          aria-hidden="true"
        >
          <PartShape typeId={drag.typeId} variant="dragging" />
        </div>
      ) : null}
    </main>
  )
}
