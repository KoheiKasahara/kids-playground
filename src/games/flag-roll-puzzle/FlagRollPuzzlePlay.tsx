import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from '../../components/flag-ball/FlagBall'
import { findFlagBall, type FlagBallData } from '../../components/flag-ball/flagBalls'
import { playCorrectSound, playPanelOpenSound, primeAudio } from '../../utils/quizSound'
import FlagPickerDialog from './FlagPickerDialog'
import PartShape from './PartShape'
import PartTray from './PartTray'
import PuzzleBoard from './PuzzleBoard'
import PuzzleStageSelect from './PuzzleStageSelect'
import { nearestCell, sameCell, type GridCell } from './grid'
import { isRotatablePart, type PartTypeId } from './partTypes'
import { boardPointFromClient, canMovePart, canPlacePart, partAtCell } from './placement'
import {
  clearAll,
  changeStage,
  clearPartSelection,
  createPuzzleState,
  markBallGoal,
  markBallStopped,
  removeSelectedPart,
  returnBall,
  rotateSelectedPart,
  selectPart,
  startRun,
  tryMovePart,
  tryPlacePart,
  isEditingPhase,
  setBallFlag,
} from './puzzleState'
import { ballLetter, puzzleStage, type PuzzleStageId } from './puzzleStages'
import type { PuzzleBallSnapshot } from './puzzleState'
import { useBoardScale } from './useBoardScale'
import { useLandscapeLayout } from './useLandscapeLayout'
import { usePuzzleEngine } from './usePuzzleEngine'
import styles from './FlagRollPuzzlePlay.module.css'

const INITIAL_BALL_FLAG_ID = 'jp'

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
  /** null はステージ選択画面。ステージを選ぶと同じroute内でプレイ画面へ進む。 */
  const [selectedStageId, setSelectedStageId] = useState<PuzzleStageId | null>(null)
  /** 国旗選びダイアログで、今どのボールの国旗を選んでいるか。閉じているときはnull。 */
  const [flagPickerBallId, setFlagPickerBallId] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<PartTypeId | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghostCell, setGhostCell] = useState<GridCell | null>(null)
  const [message, setMessage] = useState('')
  const [justPlacedPartId, setJustPlacedPartId] = useState<string | null>(null)
  const [rotatingPartId, setRotatingPartId] = useState<string | null>(null)
  const [invalidDrop, setInvalidDrop] = useState(false)

  const { containerRef, scale, width, height } = useBoardScale()
  const isLandscapeLayout = useLandscapeLayout()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null)
  // ドラッグして置いた直後にも click は飛んでくる。その click で「選択」まで
  // 起きてしまわないよう、ドラッグが終わった時刻を覚えておき、直後の click だけ捨てる
  // （真偽値で覚えると、click が飛ばない環境で値が残り、次のタップを食べてしまう）。
  const dragEndedAtRef = useRef(0)
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goalHandledRef = useRef(new Set<string>())

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current !== null) clearTimeout(messageTimeoutRef.current)
      if (feedbackTimeoutRef.current !== null) clearTimeout(feedbackTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!justPlacedPartId) return
    const timer = setTimeout(() => setJustPlacedPartId(null), 260)
    return () => clearTimeout(timer)
  }, [justPlacedPartId])

  useEffect(() => {
    if (!rotatingPartId) return
    const timer = setTimeout(() => setRotatingPartId(null), 260)
    return () => clearTimeout(timer)
  }, [rotatingPartId])

  const showMessage = useCallback((text: string) => {
    if (messageTimeoutRef.current !== null) clearTimeout(messageTimeoutRef.current)
    setMessage(text)
    messageTimeoutRef.current = setTimeout(() => setMessage(''), MESSAGE_DURATION_MS)
  }, [])

  const flashInvalidDrop = useCallback(() => {
    setInvalidDrop(true)
    if (feedbackTimeoutRef.current !== null) clearTimeout(feedbackTimeoutRef.current)
    feedbackTimeoutRef.current = setTimeout(() => setInvalidDrop(false), 240)
  }, [])

  const handleGoal = useCallback((ballId?: string, snapshots?: readonly PuzzleBallSnapshot[]) => {
    const targetId = ballId ?? 'ball-a'
    // Matter.jsの通知はゴール内で複数回届き得るため、ボール単位で冪等にする。
    if (goalHandledRef.current.has(targetId)) return
    goalHandledRef.current.add(targetId)
    // 同一tickで2球の通知が連続しても、React stateの古いclosureではなく
    // 通知済みSetの同期的なsizeで最終球を判定する。
    const allBallsReached = goalHandledRef.current.size >= state.balls.length
    if (!allBallsReached) {
      showMessage('あと 1こ！')
    } else {
      setMessage('')
      playCorrectSound()
    }
    setState((current) => markBallGoal(current, targetId, snapshots))
  }, [showMessage, state.balls])

  const handleStopped = useCallback((ballId?: string, snapshots?: readonly PuzzleBallSnapshot[]) => {
    const targetId = ballId ?? state.balls.find((ball) => ball.status === 'moving')?.id
    if (!targetId) return
    setState((current) => markBallStopped(current, targetId, snapshots))
  }, [state.balls])

  const { registerBall, registerPartElement = () => {} } = usePuzzleEngine({
    parts: state.parts,
    balls: state.balls,
    goalArea: state.goalArea,
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
        flashInvalidDrop()
        return
      }
      setState(next)
      setJustPlacedPartId(next.parts.at(-1)?.id ?? null)
      playPanelOpenSound()
    },
    [state, showMessage, flashInvalidDrop],
  )

  /** 置いてあるパーツを別のマスへ動かす。動かせなければ元の場所のままにする */
  const move = useCallback(
    (partId: string, cell: GridCell | null) => {
      const next = cell ? tryMovePart(state, partId, cell) : null
      if (!next) {
        showMessage('ここには おけないよ')
        flashInvalidDrop()
        return
      }
      setState(next)
      playPanelOpenSound()
    },
    [state, showMessage, flashInvalidDrop],
  )

  /** ドラッグを開始する。掴んだ相手（置き場のパーツ／盤面のパーツ）だけが違う */
  const startDrag = (next: DragState, event: PointerEvent<Element>) => {
    primeAudio()
    // PartTray 側でスクロールかドラッグかを判定した後にだけここへ来る。
    // Captureを取ってペイン境界を越えても pointerup を受け取り、右側のカードから
    // 左側盤面まで長くドラッグしてもプレビューとドロップが途切れないようにする。
    event.currentTarget.setPointerCapture?.(event.pointerId)
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
      flashInvalidDrop()
      return
    }
    setState((current) => rotateSelectedPart(current))
    setRotatingPartId(state.selectedPartId)
    playPanelOpenSound()
  }

  const handleDrop = () => {
    primeAudio()
    setSelectedTypeId(null)
    setGhostCell(null)
    // 再開時は、すでにゴールしたボールを成功判定から外さない。
    // 初回run・両停止runではこの一覧が空なので、同じ処理で開始できる。
    const reachedBallIds = state.balls
      .filter((ball) => ball.status === 'goal')
      .map((ball) => ball.id)
    goalHandledRef.current.clear()
    for (const ballId of reachedBallIds) goalHandledRef.current.add(ballId)
    setState((current) => startRun(current))
  }

  const handleReturnBall = () => {
    goalHandledRef.current.clear()
    setState((current) => returnBall(current))
  }

  const handleClearAll = () => {
    setSelectedTypeId(null)
    setGhostCell(null)
    goalHandledRef.current.clear()
    setState((current) => clearAll(current))
  }

  const handleFlagSelect = (flagId: string) => {
    const ballId = flagPickerBallId
    if (!ballId) return
    setState((current) => setBallFlag(current, ballId, flagId))
    setFlagPickerBallId(null)
    playPanelOpenSound()
  }

  const defaultFlag: FlagBallData = findFlagBall(INITIAL_BALL_FLAG_ID)!
  const stage = puzzleStage(state.stageId)
  // flagBallsからしか選べないため通常は必ず見つかる。データ不整合時もゲームを操作不能に
  // しないよう、初期国旗へ戻して描画を続ける。
  const boardBalls = state.balls.map((ball) => ({
    ...ball,
    flag: findFlagBall(ball.flagId) ?? defaultFlag,
  }))
  const hasMultipleBalls = boardBalls.length > 1
  const flagPickerBall = boardBalls.find((ball) => ball.id === flagPickerBallId) ?? null

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

  const handleSelectStage = (stageId: PuzzleStageId) => {
    goalHandledRef.current.clear()
    setState((current) => changeStage(current, stageId))
    setSelectedStageId(stageId)
    setSelectedTypeId(null)
    setGhostCell(null)
  }

  if (selectedStageId === null) {
    return <PuzzleStageSelect onSelect={handleSelectStage} />
  }

  return (
    <main className={styles.page} data-layout={isLandscapeLayout ? 'landscape' : 'portrait'}>
      <header className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>
          やめる
        </button>
        <h1 className={styles.title}>こっきコロコロパズル</h1>
        <button
          type="button"
          className={styles.stageButton}
          aria-label="ステージを えらびなおす"
          disabled={!editing}
          onClick={() => setSelectedStageId(null)}
        >
          {stage.emoji} {stage.nameJa}
        </button>
        {!isLandscapeLayout && !hasMultipleBalls ? (
          <button
            type="button"
            className={[styles.flagButton, styles.headerFlagButton].join(' ')}
            aria-label={`こっきを かえる（${boardBalls[0].flag.nameJa}）`}
            disabled={!editing}
            onClick={() => setFlagPickerBallId(boardBalls[0].id)}
          >
            <span className={styles.flagButtonLabel}>こっき</span>
            <FlagBall flag={boardBalls[0].flag} size={28} />
          </button>
        ) : null}
      </header>

      <div className={styles.body} data-testid="puzzle-layout">
        <div className={styles.boardPane} data-testid="puzzle-board-pane">
          <PuzzleBoard
            parts={state.parts}
            selectedPartId={state.selectedPartId}
            balls={boardBalls}
            goalArea={state.goalArea}
            ghost={ghostCell && drag ? { typeId: drag.typeId, cell: ghostCell } : null}
            draggingPartId={drag?.source === 'board' && drag.moved ? (drag.partId ?? null) : null}
            highlightGrid={editing && (drag !== null || selectedTypeId !== null)}
            cleared={state.phase === 'cleared'}
            justPlacedPartId={justPlacedPartId}
            rotatingPartId={rotatingPartId}
            invalidDrop={invalidDrop}
            containerRef={containerRef}
            boardRef={boardRef}
            scale={scale}
            width={width}
            height={height}
            registerBall={registerBall}
            registerPartElement={registerPartElement}
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          />
        </div>

        {/*
          ひとこと・パーツ置き場・操作ボタンのまとまり。
          縦画面では盤面の下に積み、低い横画面では盤面の横へ回す（.body の row 切替）。
        */}
        <aside className={styles.side} aria-label="そうさパネル" data-testid="puzzle-control-pane">
          {isLandscapeLayout && !hasMultipleBalls ? (
            <button
              type="button"
              className={[styles.flagButton, styles.panelFlagButton].join(' ')}
              aria-label={`こっきを かえる（${boardBalls[0].flag.nameJa}）`}
              disabled={!editing}
              onClick={() => setFlagPickerBallId(boardBalls[0].id)}
            >
              <span className={styles.flagButtonLabel}>こっき</span>
              <FlagBall flag={boardBalls[0].flag} size={28} />
              <span className={styles.panelFlagName}>{boardBalls[0].flag.nameJa}</span>
            </button>
          ) : null}
          {hasMultipleBalls ? (
            <div className={styles.multiFlagRow} role="group" aria-label="こっき">
              {boardBalls.map((ball) => (
                <button
                  key={ball.id}
                  type="button"
                  className={styles.flagButton}
                  aria-label={`${ballLetter(ball.id)}の こっきを かえる（${ball.flag.nameJa}）`}
                  disabled={!editing}
                  onClick={() => setFlagPickerBallId(ball.id)}
                >
                  <span className={styles.flagButtonLabel}>{ballLetter(ball.id)}</span>
                  <FlagBall flag={ball.flag} size={28} />
                </button>
              ))}
            </div>
          ) : null}
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
            isLandscapeLayout={isLandscapeLayout}
            availablePartTypeIds={stage.availablePartTypeIds}
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
        </aside>
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

      {flagPickerBall ? (
        <FlagPickerDialog
          selectedFlagId={flagPickerBall.flagId}
          title={hasMultipleBalls ? `${ballLetter(flagPickerBall.id)}の こっきを えらぼう！` : undefined}
          ariaLabel={hasMultipleBalls ? `${ballLetter(flagPickerBall.id)}の こっきを えらぶ` : undefined}
          onSelect={handleFlagSelect}
          onClose={() => setFlagPickerBallId(null)}
        />
      ) : null}
    </main>
  )
}
