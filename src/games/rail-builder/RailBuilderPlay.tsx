import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRailPiece,
  deleteRailPiece,
  rotateRailPiece,
  toggleRailBranch,
  type RailPiece,
  type RailPieceKind,
  type RailVec3,
} from './railModel'
import type { RailTrainStatus } from './railTrainModel'
import {
  MAX_RAIL_FLEET_SIZE,
  RAIL_TRAIN_APPEARANCES,
  type RailFleetTrainSummary,
} from './railFleetModel'
import styles from './RailBuilderPlay.module.css'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useRailBuilderEngine } from './useRailBuilderEngine'
import { primeAudio } from '../../utils/quizSound'

const INITIAL_PIECES: RailPiece[] = [
  // 3本の発着線は車庫の扉から伸びる。初期2本と追加1本が重ならず、
  // curveは従来どおり自由に動かせるスターターpieceとして残す。
  createRailPiece('straight', 'rail-1', { x: -1, y: 0, z: -1.05 }),
  createRailPiece('straight', 'rail-2', { x: -1, y: 0, z: 0 }),
  createRailPiece('straight', 'rail-3', { x: -1, y: 0, z: 1.05 }),
  createRailPiece('curve', 'rail-4', { x: 7, y: 0, z: 1 }, 0, 'left'),
]

const INITIAL_FLEET_SUMMARIES: RailFleetTrainSummary[] = [0, 1].map((index) => ({
  id: `train-${index + 1}`,
  label: `${index + 1}`,
  color: RAIL_TRAIN_APPEARANCES[index]!.color,
  status: 'ready',
  wantsToRun: false,
  blocked: false,
}))

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
    <span className={`${styles.preview} ${styles[`${kind}Preview` as keyof typeof styles] ?? ''}`} aria-hidden="true">
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
  const [fleetSummaries, setFleetSummaries] = useState<RailFleetTrainSummary[]>(INITIAL_FLEET_SUMMARIES)
  const [occupiedRailIds, setOccupiedRailIds] = useState<string[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId)
  const occupiedRailIdSet = useMemo(() => new Set(occupiedRailIds), [occupiedRailIds])
  const selectedPieceIsOccupied = selectedPieceId !== null && occupiedRailIdSet.has(selectedPieceId)

  const handlePiecesChange = useCallback((nextPieces: RailPiece[]) => {
    setPieces(nextPieces)
  }, [])

  const handleSelectPiece = useCallback((pieceId: string | null) => {
    setSelectedPieceId(pieceId)
  }, [])

  const { registerContainer, getCameraTarget, startTrain, pauseTrain, addTrain, focusTrain, focusDepot } = useRailBuilderEngine({
    pieces,
    selectedPieceId,
    zoom,
    onPiecesChange: handlePiecesChange,
    onSelectPiece: handleSelectPiece,
    onZoomChange: setZoom,
    lockedPieceIds: occupiedRailIdSet,
    onFleetChange: setFleetSummaries,
    onTrainOccupiedIdsChange: setOccupiedRailIds,
    soundEnabled,
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
    if (selectedPieceId === null || occupiedRailIdSet.has(selectedPieceId)) return
    setPieces((current) => rotateRailPiece(current, selectedPieceId))
  }, [occupiedRailIdSet, selectedPieceId])

  const deleteSelected = useCallback(() => {
    if (selectedPieceId === null || occupiedRailIdSet.has(selectedPieceId)) return
    setPieces((current) => deleteRailPiece(current, selectedPieceId))
    setSelectedPieceId(null)
  }, [occupiedRailIdSet, selectedPieceId])

  const toggleSelectedBranch = useCallback(() => {
    // 先頭車だけでなく後続車もbranchを抜けるまでrouteを固定する。
    // occupiedは編成全体のpiece unionなので、通過中の車体が折れない。
    if (selectedPieceId === null || occupiedRailIdSet.has(selectedPieceId)) return
    setPieces((current) => toggleRailBranch(current, selectedPieceId))
  }, [occupiedRailIdSet, selectedPieceId])

  const zoomOut = useCallback(() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP)), [])
  const zoomIn = useCallback(() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP)), [])
  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current
      if (next) primeAudio()
      return next
    })
  }, [])

  const hint = useMemo(() => {
    if (selectedPieceIsOccupied) return 'でんしゃが のっている せんろは そのままだよ'
    if (selectedPiece?.kind === 'branch') return 'ひかっている ほうへ すすむよ。ポイントを きりかえよう'
    if (fleetSummaries.some((train) => train.blocked)) return 'まえが あくまで ゆっくり まつよ'
    const trainStatus: RailTrainStatus = fleetSummaries[0]?.status ?? 'ready'
    if (trainStatus === 'stoppedAtStation') return 'えきで ひとやすみ。すぐ しゅっぱつするよ'
    if (trainStatus === 'approachingStation') return 'えきに ちかづいているよ'
    if (trainStatus === 'departing') return 'えきから しゅっぱつしたよ'
    if (trainStatus === 'waiting') return 'まってるよ。せんろを つないで すすもう'
    if (selectedPiece === undefined) return 'せんろを えらんで うごかそう'
    return 'せんろを つかんで つなげよう'
  }, [fleetSummaries, selectedPiece, selectedPieceIsOccupied])

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

        <div className={styles.trainControls} aria-label="でんしゃの そうさ">
          <div className={styles.trainList}>
            {fleetSummaries.map((train) => (
              <div className={styles.trainItem} key={train.id}>
                <button
                  type="button"
                  className={styles.trainFocusButton}
                  onClick={() => focusTrain(train.id)}
                  aria-label={`でんしゃ ${train.label}を みる`}
                >
                  <span className={styles.trainColor} style={{ backgroundColor: train.color }} aria-hidden="true" />
                  <span aria-hidden="true">🚃{train.label}</span>
                </button>
                <button
                  type="button"
                  className={styles.trainToggleButton}
                  onClick={() => (train.wantsToRun ? pauseTrain(train.id) : startTrain(train.id))}
                  aria-label={train.wantsToRun ? `でんしゃ ${train.label}を とめる` : `でんしゃ ${train.label}を はしらせる`}
                >
                  <span aria-hidden="true">{train.wantsToRun ? '⏸' : '▶'}</span>
                </button>
              </div>
            ))}
          </div>
          {fleetSummaries.length < MAX_RAIL_FLEET_SIZE && (
            <button type="button" className={styles.addTrainButton} onClick={addTrain} aria-label="しゃこから でんしゃを ついか">
              <span aria-hidden="true">＋🚃</span>
            </button>
          )}
          <button type="button" className={styles.depotButton} onClick={focusDepot} aria-label="しゃこを みる">
            <span aria-hidden="true">🏠</span>
          </button>
          <button
            type="button"
            className={styles.soundButton}
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? 'おとを けす' : 'おとを つける'}
          >
            <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
          </button>
        </div>

        {selectedPiece?.kind === 'branch' && (
          <button
            type="button"
            className={styles.branchQuickButton}
            onClick={toggleSelectedBranch}
            disabled={selectedPieceIsOccupied}
            aria-label="ポイントを きりかえる"
          >
            <span className={styles.actionIcon} aria-hidden="true">⑂</span>
            <span>ポイント</span>
          </button>
        )}

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
            <button type="button" className={styles.toolButton} onClick={() => addPiece('branch')} aria-label="ぶんきを ついか">
              <RailPreview kind="branch" />
              <span>ぶんき</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('short-straight')} aria-label="みじかい せんろを ついか">
              <RailPreview kind="short-straight" />
              <span>みじかい</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('slope')} aria-label="さかみちを ついか">
              <RailPreview kind="slope" />
              <span>さか</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('bridge')} aria-label="はしを ついか">
              <RailPreview kind="bridge" />
              <span>はし</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('station')} aria-label="えきを ついか">
              <RailPreview kind="station" />
              <span>えき</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={() => addPiece('tunnel')} aria-label="トンネルを ついか">
              <RailPreview kind="tunnel" />
              <span>トンネル</span>
            </button>
            <button type="button" className={styles.toolButton} onClick={rotateSelected} disabled={selectedPiece === undefined || selectedPieceIsOccupied} aria-label="せんろを 90ど まわす">
              <span className={styles.actionIcon} aria-hidden="true">↻</span>
              <span>まわす</span>
            </button>
            <button type="button" className={`${styles.toolButton} ${styles.deleteButton}`} onClick={deleteSelected} disabled={selectedPiece === undefined || selectedPieceIsOccupied} aria-label="せんろを けす">
              <span className={styles.actionIcon} aria-hidden="true">×</span>
              <span>けす</span>
            </button>
          </div>
          <p className={styles.trayHint}>{selectedPieceIsOccupied ? 'でんしゃが いる あいだは せんろを うごかせないよ' : 'つなぎめを ちかづけると ぴったり！'}</p>
        </section>
      </div>
    </main>
  )
}
