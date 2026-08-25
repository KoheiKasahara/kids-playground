import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { findFlagBall, type FlagBallData } from '../../components/flag-ball/flagBalls'
import { playCorrectSound, playPanelOpenSound, primeAudio } from '../../utils/quizSound'
import PartShape from './PartShape'
import PartTray from './PartTray'
import PuzzleBoard from './PuzzleBoard'
import { nearestCell, sameCell, type GridCell } from './grid'
import { isRotatablePart, type PartTypeId } from './partTypes'
import { boardPointFromClient, canMovePart, canPlacePart, partAtCell } from './placement'
import {
  clearAll,
  clearPartSelection,
  createPuzzleState,
  reachGoal,
  removeSelectedPart,
  returnBall,
  rotateSelectedPart,
  selectPart,
  startRun,
  stopRun,
  tryMovePart,
  tryPlacePart,
  isEditingPhase,
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

/**
 * ドラッグ中の状態。パーツ置き場から出すときと、置いたパーツを動かすときで
 * 掴んだ相手だけが違い、あとの流れ（指についてくる分身・吸着先の下書き・
 * 離した場所へ置く／戻す）は同じなので、1つの型にまとめて同じ手順で扱う。
 */
type DragState = {
  /** tray: パーツ置き場から出す / board: 置いてあるパーツを動かす */
  readonly source: 'tray' | 'board'
  readonly typeId: PartTypeId
  /** source が board のとき、動かしているパーツのid */
  readonly partId?: string
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

  const handleStopped = useCallback(() => {
    setState((current) => stopRun(current))
  }, [])

  const { registerBall } = usePuzzleEngine({
    parts: state.parts,
    // ゴール後は自然に転がり続ける。途中停止では世界を止め、開始位置へ戻して編集へ戻る。
    running: state.phase === 'running' || state.phase === 'cleared',
    runId: state.runId,
    onGoal: handleGoal,
    onStopped: handleStopped,
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

  /** 置いてあるパーツを別のマスへ動かす。動かせなければ元の場所のままにする */
  const move = useCallback(
    (partId: string, cell: GridCell | null) => {
      const next = cell ? tryMovePart(state, partId, cell) : null
      if (!next) {
        showMessage('ここには おけないよ')
        return
      }
      setState(next)
      playPanelOpenSound()
    },
    [state, showMessage],
  )

  /** ドラッグを開始する。掴んだ相手（置き場のパーツ／盤面のパーツ）だけが違う */
  const startDrag = (next: DragState, event: PointerEvent<Element>) => {
    primeAudio()
    // jsdom や一部の組込みブラウザは Pointer Capture を持たないことがある。
    // 置き場は横スワイプをブラウザ標準のスクロールへ渡すため、Captureしない。
    if (next.source === 'board') event.currentTarget.setPointerCapture?.(event.pointerId)
    dragStartPointRef.current = { x: event.clientX, y: event.clientY }
    setDrag(next)
  }

  /**
   * ドラッグ中の移動。置ける（動かせる）場所だけ下書きを出す。
   * 置けない場所では何も出さないことが、そのまま「ここには置けない」の合図になる。
   */
  const handleDragMove = (event: PointerEvent<Element>) => {
    const start = dragStartPointRef.current
    if (!drag || !start) return
    const moved =
      drag.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD_PX
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved })
    if (!moved) return

    // 実際に動き始めた瞬間、掴んだものと違うパーツの選択は解く。
    // 「けす」が、今つまんでいるものとは別のパーツを指したままにならないようにする。
    if (!drag.moved && drag.source === 'board' && drag.partId) {
      const partId = drag.partId
      setState((current) => (current.selectedPartId === partId ? current : clearPartSelection(current)))
    }

    const cell = cellFromClient(event.clientX, event.clientY)
    const placeable =
      cell !== null &&
      (drag.source === 'tray'
        ? canPlacePart(state.parts, drag.typeId, cell)
        : canMovePart(state.parts, drag.partId!, cell))
    const nextGhost = placeable ? cell : null
    setGhostCell((current) => {
      if (current === null && nextGhost === null) return current
      if (current && nextGhost && sameCell(current, nextGhost)) return current
      return nextGhost
    })
  }

  /** ドラッグの終了。動かしていなければタップとして扱う */
  const handleDragEnd = (event: PointerEvent<Element>) => {
    const active = drag
    setDrag(null)
    setGhostCell(null)
    dragStartPointRef.current = null
    if (!active) return

    if (!active.moved) {
      // 盤面のパーツをタップしただけ＝「選ぶ」。置き場のパーツのタップ選択は
      // click 側で扱う（キーボード操作と同じ経路にするため）。
      if (active.source === 'board' && active.partId) {
        setSelectedTypeId(null)
        const partId = active.partId
        setState((current) => selectPart(current, partId))
      }
      return
    }

    dragEndedAtRef.current = Date.now()
    const cell = cellFromClient(event.clientX, event.clientY)
    if (active.source === 'tray') place(active.typeId, cell)
    else move(active.partId!, cell)
  }

  const handlePartPointerDown = (typeId: PartTypeId, event: PointerEvent<HTMLButtonElement>) => {
    if (!isEditingPhase(state.phase)) return
    setState((current) => clearPartSelection(current))
    // PartTray が盤面方向への移動だと判定してから呼ぶ。ここではすでにドラッグ開始済みなので、
    // 最初の移動地点でも分身とグリッド下書きをすぐ表示する。
    startDrag({ source: 'tray', typeId, x: event.clientX, y: event.clientY, moved: true }, event)
    const cell = cellFromClient(event.clientX, event.clientY)
    setGhostCell(cell && canPlacePart(state.parts, typeId, cell) ? cell : null)
  }

  /** パーツ置き場のタップ。選んでから盤面をタップして置く操作の入口 */
  const handlePartClick = (typeId: PartTypeId) => {
    if (Date.now() - dragEndedAtRef.current < CLICK_AFTER_DRAG_IGNORE_MS) return
    if (!isEditingPhase(state.phase)) return
    primeAudio()
    // パーツ置き場の選択と、盤面のパーツの選択は同時に持たない（操作の対象を1つに保つ）
    setState((current) => clearPartSelection(current))
    setSelectedTypeId((current) => (current === typeId ? null : typeId))
  }

  /**
   * 盤面を押したとき。
   * - すでにパーツがあるマス: そのパーツを掴む（そのまま指を動かせば移動、離せば選択）
   * - パーツ置き場で選んでいるとき: そのマスへ置く
   * - どちらでもないとき: 選択を解く
   *
   * パーツのあるマスで「置く」より「掴む」を優先しているのは、幼児が置き場を選んだまま
   * 置いたパーツを押しても「置けない」と言われず、そのまま動かす／消す操作へ進めるため。
   */
  const handleBoardPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isEditingPhase(state.phase) || drag) return
    const cell = cellFromClient(event.clientX, event.clientY)
    if (!cell) return

    const part = partAtCell(state.parts, cell)
    if (part) {
      setSelectedTypeId(null)
      startDrag(
        { source: 'board', typeId: part.typeId, partId: part.id, x: event.clientX, y: event.clientY, moved: false },
        event,
      )
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

  const handleRotateSelectedPart = () => {
    // UI側で可否を先に見て、Reactのstate更新関数を副作用のないままに保つ。
    // （停止中のボールに食い込む向きなどは、現在の向きをそのまま残す。）
    if (rotateSelectedPart(state) === state) {
      showMessage('ここでは まわせないよ')
      return
    }
    setState((current) => rotateSelectedPart(current))
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

  const editing = isEditingPhase(state.phase)
  const partSelected = state.selectedPartId !== null
  const selectedPart = state.parts.find((part) => part.id === state.selectedPartId) ?? null
  // パーツを選んでいるあいだは、同じ行に出る「えらんだ いたを けす」がそのまま案内になるため
  // ひとことは出さない（同じことを2つ並べて書かない）。
  const editHint = partSelected ? '' : EDIT_HINT
  const status =
    message ||
    (state.phase === 'cleared'
      ? 'ゴール！ すごい！'
      : state.phase === 'stopped'
        ? 'つづきを つくろう！'
        : editing
          ? editHint
          : 'ころころ ころがってるよ！')

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
          draggingPartId={drag?.source === 'board' && drag.moved ? (drag.partId ?? null) : null}
          highlightGrid={editing && (drag !== null || selectedTypeId !== null)}
          cleared={state.phase === 'cleared'}
          containerRef={containerRef}
          boardRef={boardRef}
          scale={scale}
          width={width}
          height={height}
          registerBall={registerBall}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
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
              <div className={styles.partActions}>
                {selectedPart && isRotatablePart(selectedPart.typeId) ? (
                  <button type="button" className={styles.rotateButton} onClick={handleRotateSelectedPart}>
                    まわす
                  </button>
                ) : null}
                <button type="button" className={styles.removeButton} onClick={handleRemoveSelectedPart}>
                  えらんだ いたを けす
                </button>
              </div>
            ) : null}
          </div>

          <PartTray
            selectedTypeId={selectedTypeId}
            disabled={!editing}
            onPartPointerDown={handlePartPointerDown}
            onPartPointerMove={handleDragMove}
            onPartPointerUp={handleDragEnd}
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
