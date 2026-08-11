import { useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { playCorrectSound, playPanelOpenSound } from '../../utils/quizSound'
import { prefecturesForRegion, REGION_LABEL } from './data/regions'
import type { PrefectureId, RegionId } from './data/prefectures'
import PrefecturePuzzleMap from './PrefecturePuzzleMap'
import { correctCount, createPlacements, isComplete, placePiece, returnPiece } from './puzzleState'
import styles from './PrefecturePuzzlePlay.module.css'

const validRegions: readonly RegionId[] = ['tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushuOkinawa']
type DragState = { id: PrefectureId; x: number; y: number; moved: boolean } | null

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export default function PrefecturePuzzlePlay() {
  const { region: regionParam } = useParams()
  const region = validRegions.find((candidate) => candidate === regionParam)
  if (!region) return <Navigate to="/games/prefecture-quiz/puzzle" replace />
  return <PuzzleGame region={region} />
}

function PuzzleGame({ region }: { region: RegionId }) {
  const navigate = useNavigate()
  const [items] = useState(() => prefecturesForRegion(region))
  const ids = items.map((item) => item.id)
  const [pieceOrder] = useState(() => shuffled(ids))
  const [placements, setPlacements] = useState(() => createPlacements(ids))
  const [selectedPieceId, setSelectedPieceId] = useState<PrefectureId | null>(null)
  const [checked, setChecked] = useState(false)
  const [drag, setDrag] = useState<DragState>(null)
  const downPoint = useRef<{ x: number; y: number } | null>(null)
  const complete = isComplete(placements, ids)
  const score = correctCount(placements, ids)
  const unplaced = pieceOrder.filter((id) => !Object.values(placements).includes(id))
  const byId = new Map(items.map((item) => [item.id, item]))

  const choosePiece = (id: PrefectureId) => {
    if (checked) return
    setSelectedPieceId((selected) => selected === id ? null : id)
    playPanelOpenSound()
  }
  const place = (targetId: PrefectureId, pieceId = selectedPieceId) => {
    if (!pieceId || checked) return
    setPlacements((current) => placePiece(current, pieceId, targetId))
    setSelectedPieceId(null)
    playPanelOpenSound()
  }
  const selectTarget = (targetId: PrefectureId) => {
    if (checked) return
    if (selectedPieceId) place(targetId)
    else if (placements[targetId]) choosePiece(placements[targetId]!)
  }
  const reset = () => {
    setPlacements(createPlacements(ids)); setSelectedPieceId(null); setChecked(false)
  }
  const startPointer = (event: PointerEvent<HTMLButtonElement>, id: PrefectureId) => {
    downPoint.current = { x: event.clientX, y: event.clientY }
    // jsdom and a few older embedded browsers do not expose Pointer Capture.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ id, x: event.clientX, y: event.clientY, moved: false })
  }
  const movePointer = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag || !downPoint.current) return
    const moved = drag.moved || Math.hypot(event.clientX - downPoint.current.x, event.clientY - downPoint.current.y) > 8
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved })
  }
  const endPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag
    setDrag(null); downPoint.current = null
    if (!active?.moved || checked) return
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-puzzle-target]')?.dataset.puzzleTarget as PrefectureId | undefined
    if (target) place(target, active.id)
  }
  const dragStart = (event: DragEvent<HTMLButtonElement>, id: PrefectureId) => { event.dataTransfer.setData('text/plain', id); choosePiece(id) }
  const dragTarget = (targetId: PrefectureId) => { if (selectedPieceId) place(targetId) }
  const praise = score === ids.length ? 'ぜんぶせいかい！すごい！' : `${ids.length}こ中 ${score}こ せいかい！もういちど やってみよう！`

  return <main className={styles.page}>
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={() => navigate('/games/prefecture-quiz/puzzle')}>もどる</button>
      <div><h1>{REGION_LABEL[region]}地方 パズル</h1><p>{Object.values(placements).filter(Boolean).length} / {ids.length} おいたよ</p></div>
    </header>
    {checked && <section className={styles.result} aria-live="polite"><strong>{praise}</strong><span>みどりは せいかい。オレンジは「ここだったよ」の しるしだよ。</span></section>}
    <section className={styles.mapPanel}>
      <PrefecturePuzzleMap items={items} placements={placements} selectedPieceId={selectedPieceId} checked={checked} onTarget={selectTarget} onDragTarget={dragTarget} />
    </section>
    {!checked && <>
      <p className={styles.hint}>{selectedPieceId ? `${byId.get(selectedPieceId)?.nameHiragana}を ちずの ばしょに おいてね` : 'ピースを えらんで、ちずの ばしょを おしてね'}</p>
      {selectedPieceId && <button type="button" className={styles.returnButton} onClick={() => { setPlacements((current) => returnPiece(current, selectedPieceId)); setSelectedPieceId(null) }}>えらんだピースを もどす</button>}
      <section className={styles.tray} data-puzzle-tray="true" aria-label="まだおいていないピース">
        {unplaced.map((id) => <button key={id} type="button" draggable className={[styles.piece, selectedPieceId === id ? styles.pieceSelected : ''].filter(Boolean).join(' ')} aria-pressed={selectedPieceId === id} onClick={() => choosePiece(id)} onDragStart={(event) => dragStart(event, id)} onPointerDown={(event) => startPointer(event, id)} onPointerMove={movePointer} onPointerUp={endPointer}>{byId.get(id)?.nameHiragana}</button>)}
        {unplaced.length === 0 && <p className={styles.trayDone}>ぜんぶ おけたよ！</p>}
      </section>
      <BigButton className={styles.check} disabled={!complete} onClick={() => { setChecked(true); if (score === ids.length) playCorrectSound() }}>こたえあわせ！</BigButton>
    </>}
    {checked && <div className={styles.actions}><BigButton onClick={reset}>もういちど</BigButton><BigButton variant="secondary" onClick={() => navigate('/games/prefecture-quiz/puzzle')}>地方をえらぶ</BigButton><BigButton variant="secondary" onClick={() => navigate('/')}>ホームへ</BigButton></div>}
    {drag?.moved && <div className={styles.dragPreview} style={{ left: drag.x, top: drag.y }}>{byId.get(drag.id)?.nameHiragana}</div>}
  </main>
}
