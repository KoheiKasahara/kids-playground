import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRailPiece,
  deleteRailPiece,
  rotateRailPiece,
  snapAndConnectRailPiece,
  toggleRailBranch,
  type RailPiece,
  type RailPieceKind,
  type RailVec3,
} from './railModel'
import type { RailTrainStatus } from './railTrainModel'
import {
  DEFAULT_TRAIN_TYPE,
  MAX_RAIL_FLEET_SIZE,
  RAIL_TRAIN_APPEARANCES,
  type RailFleetTrainSummary,
  type TrainType,
} from './railFleetModel'
import TrainTypePicker from './TrainTypePicker'
import RailPartIcon from './RailPartIcon'
import styles from './RailBuilderPlay.module.css'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  useRailBuilderEngine,
} from './useRailBuilderEngine'
import { primeAudio } from '../../utils/quizSound'

function createInitialRailPieces(): RailPiece[] {
  // しゃこ(depot)が1番線・2番線の平行2線を持つ。rail-2とrail-3は
  // それぞれの延長として置き、あらかじめ接続した状態で始める。
  // curveは従来どおり自由に動かせるスターターpieceとして残す。
  let pieces: RailPiece[] = [
    createRailPiece('depot', 'rail-1', { x: -6, y: 0, z: 0 }),
    createRailPiece('straight', 'rail-2', { x: 0, y: 0, z: -1.2 }),
    createRailPiece('straight', 'rail-3', { x: 0, y: 0, z: 1.2 }),
    createRailPiece('curve', 'rail-4', { x: 7, y: 0, z: 1 }, 0, 'left'),
  ]
  // 接続に失敗しても落とさず、そのまま未接続の並びとして返す。
  pieces = snapAndConnectRailPiece(pieces, 'rail-2')
  pieces = snapAndConnectRailPiece(pieces, 'rail-3')
  return pieces
}

const INITIAL_PIECES: RailPiece[] = createInitialRailPieces()

const INITIAL_FLEET_SUMMARIES: RailFleetTrainSummary[] = [0].map((index) => ({
  id: `train-${index + 1}`,
  label: `${index + 1}`,
  trainType: DEFAULT_TRAIN_TYPE,
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

type RailBuilderSelection =
  | { kind: 'piece'; id: string }
  | { kind: 'train'; id: string }
  | null

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
    <span className={styles.icon} aria-hidden="true">
      <RailPartIcon kind={kind} />
    </span>
  )
}

export default function RailBuilderPlay() {
  const navigate = useNavigate()
  const [pieces, setPieces] = useState<RailPiece[]>(() => INITIAL_PIECES.map((piece) => ({
    ...piece,
    position: { ...piece.position },
    connections: { ...piece.connections },
  })))
  // 選択対象は常に1つだけ。パーツIDと電車IDを別々に持たず、選択切り替え時に
  // 前の対象が残ることを状態構造から防ぐ。
  const [selection, setSelection] = useState<RailBuilderSelection>(null)
  const selectedPieceId = selection?.kind === 'piece' ? selection.id : null
  const selectedTrainId = selection?.kind === 'train' ? selection.id : null
  const [zoom, setZoom] = useState(1)
  const [fleetSummaries, setFleetSummaries] = useState<RailFleetTrainSummary[]>(INITIAL_FLEET_SUMMARIES)
  const [occupiedRailIds, setOccupiedRailIds] = useState<string[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  // 'add'=でんしゃを追加するときの新規デザイン選択、'change'=配置済みでんしゃのデザイン変更。
  // 必要なときだけ出すパネルなので、常設UIは増やさない。
  const [trainPickerMode, setTrainPickerMode] = useState<'add' | 'change' | null>(null)

  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId)
  const selectedTrain = fleetSummaries.find((train) => train.id === selectedTrainId)
  const occupiedRailIdSet = useMemo(() => new Set(occupiedRailIds), [occupiedRailIds])
  const selectedPieceIsOccupied = selectedPieceId !== null && occupiedRailIdSet.has(selectedPieceId)

  const handlePiecesChange = useCallback((nextPieces: RailPiece[]) => {
    setPieces(nextPieces)
  }, [])

  const handleSelectPiece = useCallback((pieceId: string | null) => {
    setSelection(pieceId === null ? null : { kind: 'piece', id: pieceId })
  }, [])

  const handleSelectTrain = useCallback((trainId: string | null) => {
    setSelection(trainId === null ? null : { kind: 'train', id: trainId })
  }, [])

  const { registerContainer, getCameraTarget, startTrain, pauseTrain, addTrain, removeTrain, focusDepot, setTrainType } = useRailBuilderEngine({
    pieces,
    selectedPieceId,
    selectedTrainId,
    zoom,
    onPiecesChange: handlePiecesChange,
    onSelectPiece: handleSelectPiece,
    onSelectTrain: handleSelectTrain,
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
    setSelection({ kind: 'piece', id: piece.id })
  }, [getCameraTarget, pieces])

  const rotateSelected = useCallback(() => {
    if (selectedPieceId === null || occupiedRailIdSet.has(selectedPieceId)) return
    setPieces((current) => rotateRailPiece(current, selectedPieceId))
  }, [occupiedRailIdSet, selectedPieceId])

  const deleteSelected = useCallback(() => {
    if (selectedPieceId === null || occupiedRailIdSet.has(selectedPieceId)) return
    setPieces((current) => deleteRailPiece(current, selectedPieceId))
    setSelection(null)
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

  const allTrainsRunning = fleetSummaries.length > 0 && fleetSummaries.every((train) => train.wantsToRun)
  const toggleAllTrains = useCallback(() => {
    if (allTrainsRunning) {
      for (const train of fleetSummaries) pauseTrain(train.id)
    } else {
      for (const train of fleetSummaries) {
        if (!train.wantsToRun) startTrain(train.id)
      }
    }
  }, [allTrainsRunning, fleetSummaries, pauseTrain, startTrain])

  const openAddTrainPicker = useCallback(() => {
    setTrainPickerMode('add')
  }, [])

  const openChangeTrainTypePicker = useCallback(() => {
    setTrainPickerMode('change')
  }, [])

  const closeTrainPicker = useCallback(() => {
    setTrainPickerMode(null)
  }, [])

  const handleTrainTypeSelect = useCallback((trainType: TrainType) => {
    if (trainPickerMode === 'add') {
      addTrain(trainType)
    } else if (trainPickerMode === 'change' && selectedTrainId !== null) {
      setTrainType(selectedTrainId, trainType)
    }
    setTrainPickerMode(null)
  }, [addTrain, selectedTrainId, setTrainType, trainPickerMode])

  const removeFleetTrain = useCallback(() => {
    // removeTrain()は常に最後尾の編成を消す。選択中の電車が消える場合は
    // 実IDが再利用されて古い選択が復活しないよう先に選択を外す。
    const targetId = fleetSummaries[fleetSummaries.length - 1]?.id
    if (targetId !== undefined && targetId === selectedTrainId) {
      setSelection(null)
    }
    removeTrain()
  }, [fleetSummaries, removeTrain, selectedTrainId])

  const hint = useMemo(() => {
    if (selectedPieceIsOccupied) return 'でんしゃが のっている せんろは そのままだよ'
    if (selectedPiece?.kind === 'branch') return 'ひかっている ほうへ すすむよ。ポイントを きりかえよう'
    if (selectedPiece !== undefined) return 'つなぎめを ちかづけると ぴったり！'
    if (selectedTrain !== undefined) return 'はしる／とまる で うんてん してみよう'
    if (fleetSummaries.some((train) => train.blocked)) return 'まえが あくまで ゆっくり まつよ'
    const trainStatus: RailTrainStatus = fleetSummaries[0]?.status ?? 'ready'
    if (trainStatus === 'stoppedAtStation') return 'えきで ひとやすみ。すぐ しゅっぱつするよ'
    if (trainStatus === 'approachingStation') return 'えきに ちかづいているよ'
    if (trainStatus === 'departing') return 'えきから しゅっぱつしたよ'
    if (trainStatus === 'waiting') return 'まってるよ。せんろを つないで すすもう'
    return 'でんしゃも せんろも うごかせるよ。ゆびで ひっぱってね'
  }, [fleetSummaries, selectedPiece, selectedPieceIsOccupied, selectedTrain])

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
          <div className={styles.headerRow}>
            <button type="button" className={styles.backButton} onClick={() => navigate('/')} aria-label="ホームへ もどる">
              <span aria-hidden="true">‹</span>
              <span>もどる</span>
            </button>
            <h1 className={styles.title}><span aria-hidden="true">🚂</span> 3Dせんろづくり</h1>
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

          <div className={styles.trainControls} aria-label="でんしゃの そうさ">
            <div className={styles.trainCountGroup}>
              <button
                type="button"
                className={styles.trainCountButton}
                onClick={removeFleetTrain}
                disabled={fleetSummaries.length <= 1}
                aria-label="でんしゃを へらす"
              >
                <span aria-hidden="true">−</span>
              </button>
              <span className={styles.trainCountLabel} aria-label={`でんしゃ ${fleetSummaries.length}りょうへんせい`}>
                <span aria-hidden="true">🚃</span>
                {fleetSummaries.length}
              </span>
              <button
                type="button"
                className={styles.trainCountButton}
                onClick={openAddTrainPicker}
                disabled={fleetSummaries.length >= MAX_RAIL_FLEET_SIZE}
                aria-label="でんしゃを ふやす"
              >
                <span aria-hidden="true">＋</span>
              </button>
            </div>
            <button
              type="button"
              className={styles.bulkRunButton}
              onClick={toggleAllTrains}
              aria-pressed={allTrainsRunning}
              aria-label={allTrainsRunning ? 'ぜんぶの でんしゃを とめる' : 'ぜんぶの でんしゃを うごかす'}
            >
              <span aria-hidden="true">{allTrainsRunning ? '■' : '▶'}</span>
              <span>{allTrainsRunning ? 'ぜんぶとめる' : 'ぜんぶうごかす'}</span>
            </button>
            <button type="button" className={styles.depotButton} onClick={focusDepot} aria-label="しゃこを みる">
              <span aria-hidden="true">🏠</span>
            </button>
          </div>
        </header>

        <div className={styles.stage}>
          <div className={styles.zoomControls} aria-label="カメラのズーム">
            <button type="button" className={styles.iconButton} onClick={zoomOut} aria-label="ちいさく みる">−</button>
            <button type="button" className={styles.iconButton} onClick={zoomIn} aria-label="おおきく みる">＋</button>
          </div>

          {(selectedPiece !== undefined || selectedTrain !== undefined) && (
            <div className={styles.contextPanel} aria-label="えらんだものの そうさ">
              {selectedPiece !== undefined && (
                <>
                  {selectedPiece.kind === 'branch' && (
                    <button
                      type="button"
                      className={styles.branchActionButton}
                      onClick={toggleSelectedBranch}
                      disabled={selectedPieceIsOccupied}
                      aria-label="ポイントを きりかえる"
                    >
                      <span className={styles.actionIcon} aria-hidden="true">⑂</span>
                      <span>ポイント</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.rotateActionButton}
                    onClick={rotateSelected}
                    disabled={selectedPieceIsOccupied}
                    aria-label="せんろを 90ど まわす"
                  >
                    <span className={styles.actionIcon} aria-hidden="true">↻</span>
                    <span>まわす</span>
                  </button>
                  <button
                    type="button"
                    className={styles.deleteActionButton}
                    onClick={deleteSelected}
                    disabled={selectedPieceIsOccupied}
                    aria-label="せんろを けす"
                  >
                    <span className={styles.actionIcon} aria-hidden="true">×</span>
                    <span>けす</span>
                  </button>
                </>
              )}

              {selectedTrain !== undefined && (
                <>
                  <span className={styles.trainActionColor} style={{ backgroundColor: selectedTrain.color }} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.trainActionButton}
                    onClick={() => (selectedTrain.wantsToRun ? pauseTrain(selectedTrain.id) : startTrain(selectedTrain.id))}
                    aria-label={selectedTrain.wantsToRun ? `でんしゃ ${selectedTrain.label}を とめる` : `でんしゃ ${selectedTrain.label}を はしらせる`}
                  >
                    <span aria-hidden="true">{selectedTrain.wantsToRun ? '■' : '▶'}</span>
                    <span>{selectedTrain.wantsToRun ? 'とまる' : 'はしる'}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.trainDesignButton}
                    onClick={openChangeTrainTypePicker}
                    aria-label={`でんしゃ ${selectedTrain.label}の みためを かえる`}
                  >
                    <span aria-hidden="true">🎨</span>
                    <span>みため</span>
                  </button>
                </>
              )}
            </div>
          )}
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
            <button type="button" className={styles.toolButton} onClick={() => addPiece('depot')} aria-label="しゃこを ついか">
              <RailPreview kind="depot" />
              <span>しゃこ</span>
            </button>
          </div>
          <p id="rail-builder-help" className={styles.trayHint}>{hint}</p>
        </section>
      </div>

      {trainPickerMode !== null && (trainPickerMode === 'add' || selectedTrain !== undefined) && (
        <TrainTypePicker
          title={trainPickerMode === 'add' ? 'あたらしい でんしゃを えらぼう' : 'でんしゃの みためを かえよう'}
          ariaLabel="でんしゃの みためを えらぶ"
          selectedType={trainPickerMode === 'change' ? selectedTrain?.trainType ?? null : null}
          onSelect={handleTrainTypeSelect}
          onClose={closeTrainPicker}
        />
      )}
    </main>
  )
}
