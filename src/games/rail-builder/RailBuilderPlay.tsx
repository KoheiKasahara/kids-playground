import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRailPiece,
  deleteRailPiece,
  rotateRailPiece,
  type RailPiece,
  type RailPieceKind,
  type RailVec3,
} from './railModel'
import styles from './RailBuilderPlay.module.css'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useRailBuilderEngine } from './useRailBuilderEngine'

const INITIAL_PIECES: RailPiece[] = [
  createRailPiece('straight', 'rail-1', { x: -1, y: 0, z: 0 }),
  createRailPiece('curve', 'rail-2', { x: 7, y: 0, z: 1 }, 0, 'left'),
]

const SPAWN_OFFSETS: RailVec3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 6, y: 0, z: 0 },
  { x: -6, y: 0, z: 0 },
  { x: 0, y: 0, z: 6 },
  { x: 0, y: 0, z: -6 },
  { x: 6, y: 0, z: 6 },
  { x: -6, y: 0, z: -6 },
]

function nextSpawnPosition(pieces: readonly RailPiece[], cameraTarget: RailVec3): RailVec3 {
  for (const offset of SPAWN_OFFSETS) {
    // 線路全体が50x50の地面からはみ出さない範囲に、現在見ている場所を基準に出す。
    const candidate = {
      x: Math.min(20, Math.max(-20, cameraTarget.x + offset.x)),
      y: 0,
      z: Math.min(20, Math.max(-20, cameraTarget.z + offset.z)),
    }
    const isOpen = pieces.every((piece) => {
      const dx = piece.position.x - candidate.x
      const dz = piece.position.z - candidate.z
      return Math.hypot(dx, dz) > 4.5
    })
    if (isOpen) return { ...candidate }
  }
  const index = pieces.length
  return {
    x: Math.min(20, Math.max(-20, cameraTarget.x + ((index % 4) - 1.5) * 5)),
    y: 0,
    z: Math.min(20, Math.max(-20, cameraTarget.z + Math.floor(index / 4) * 5)),
  }
}

function nextPieceId(pieces: readonly RailPiece[]): string {
  const used = new Set(pieces.map((piece) => piece.id))
  let index = pieces.length + 1
  while (used.has(`rail-${index}`)) index += 1
  return `rail-${index}`
}

function RailPreview({ kind }: { kind: RailPieceKind }) {
  return (
    <span className={`${styles.preview} ${kind === 'curve' ? styles.curvePreview : ''}`} aria-hidden="true">
      <span className={styles.previewRail} />
      <span className={styles.previewRail} />
      <span className={styles.previewSleeper} />
      <span className={styles.previewSleeper} />
    </span>
  )
}

export default function RailBuilderPlay() {
  const navigate = useNavigate()
  const [pieces, setPieces] = useState<RailPiece[]>(() => INITIAL_PIECES.map((piece) => ({
    ...piece,
    position: { ...piece.position },
    connections: {},
  })))
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>('rail-1')
  const [zoom, setZoom] = useState(1)

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId)

  const handlePiecesChange = useCallback((nextPieces: RailPiece[]) => {
    setPieces(nextPieces)
  }, [])

  const handleSelectPiece = useCallback((pieceId: string | null) => {
    setSelectedPieceId(pieceId)
  }, [])

  const { registerContainer, getCameraTarget } = useRailBuilderEngine({
    pieces,
    selectedPieceId,
    zoom,
    onPiecesChange: handlePiecesChange,
    onSelectPiece: handleSelectPiece,
    onZoomChange: setZoom,
  })

  const addPiece = useCallback((kind: RailPieceKind) => {
    const piece = createRailPiece(
      kind,
      nextPieceId(pieces),
      nextSpawnPosition(pieces, getCameraTarget()),
    )
    setPieces((current) => [...current, piece])
    setSelectedPieceId(piece.id)
  }, [getCameraTarget, pieces])

  const rotateSelected = useCallback(() => {
    if (selectedPieceId === null) return
    setPieces((current) => rotateRailPiece(current, selectedPieceId))
  }, [selectedPieceId])

  const deleteSelected = useCallback(() => {
    if (selectedPieceId === null) return
    setPieces((current) => deleteRailPiece(current, selectedPieceId))
    setSelectedPieceId(null)
  }, [selectedPieceId])

  const zoomOut = useCallback(() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP)), [])
  const zoomIn = useCallback(() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP)), [])

  const hint = useMemo(() => (
    selectedPiece === undefined
      ? 'せんろを えらんで うごかそう'
      : 'せんろを つかんで つなげよう'
  ), [selectedPiece])

  return (
    <main className={styles.page}>
      <div
        ref={registerContainer}
        className={styles.scene}
        role="application"
        aria-label="3Dせんろづくりのあそびば"
        aria-describedby="rail-builder-help"
      />

      <div className={styles.overlay}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/')} aria-label="ホームへ もどる">
            <span aria-hidden="true">‹</span>
            <span>もどる</span>
          </button>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}><span aria-hidden="true">🚂</span> 3Dせんろづくり</h1>
            <p id="rail-builder-help" className={styles.instruction}>{hint}。ゆびで ひっぱってね</p>
          </div>
        </header>

        <div className={styles.zoomControls} aria-label="カメラのズーム">
          <button type="button" className={styles.iconButton} onClick={zoomOut} aria-label="ちいさく みる">−</button>
          <button type="button" className={styles.iconButton} onClick={zoomIn} aria-label="おおきく みる">＋</button>
        </div>

        <section className={styles.tray} aria-label="せんろを えらぶ">
          <div className={styles.trayTools}>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('straight')} aria-label="ちょくせんを ついか">
              <RailPreview kind="straight" />
              <span>ちょくせん</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('curve')} aria-label="カーブを ついか">
              <RailPreview kind="curve" />
              <span>カーブ</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={rotateSelected} disabled={selectedPiece === undefined} aria-label="せんろを 90ど まわす">
              <span className={styles.actionIcon} aria-hidden="true">↻</span>
              <span>まわす</span>
            </button>
            <button type="button" className={`${styles.toolButton} ${styles.deleteButton}`} onClick={deleteSelected} disabled={selectedPiece === undefined} aria-label="せんろを けす">
              <span className={styles.actionIcon} aria-hidden="true">×</span>
              <span>けす</span>
            </button>
          </div>
          <p className={styles.trayHint}>つなぎめを ちかづけると ぴったり！</p>
        </section>
      </div>
    </main>
  )
}
